/**
 * BolKarigar Team Meeting UI — in-app voice/video (embedded room)
 */
(function () {
  const API = () => (typeof window.bkGetApiUrl === 'function' ? window.bkGetApiUrl() : (window.API_URL || ''));
  const token = () => localStorage.getItem('bk_token') || localStorage.getItem('token') || '';
  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });

  let jitsiApi = null;
  let activeMeetingId = null;
  let meetPollTimer = null;

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s ?? '';
    return d.innerHTML;
  }

  function toast(msg, type) {
    if (typeof window.showToast === 'function') window.showToast(msg, type);
    else if (type === 'error') alert(msg);
  }

  async function parseApiResponse(r) {
    const text = await r.text();
    try {
      const data = JSON.parse(text);
      if (!r.ok && data.success === undefined) data.success = false;
      if (!r.ok && !data.error) data.error = `Server error (${r.status})`;
      return data;
    } catch {
      return { success: false, error: `Invalid server response (${r.status})` };
    }
  }

  async function apiGet(path) {
    const r = await fetch(`${API()}${path}`, { headers: headers() });
    return parseApiResponse(r);
  }

  async function apiPost(path, body) {
    const r = await fetch(`${API()}${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body || {}) });
    return parseApiResponse(r);
  }

  function absoluteJoinUrl(joinPath) {
    const path = String(joinPath || '').replace(/^\//, '');
    return `${window.location.origin}/${path}`;
  }

  function defaultMeetingTitle(callType) {
    const kind = callType === 'audio' ? 'Voice' : 'Video';
    const t = new Date();
    return `Team ${kind} — ${t.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} ${t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
  }

  function getInviteMode() {
    const sel = document.querySelector('input[name="meetInviteMode"]:checked');
    return sel?.value === 'selected' ? 'selected' : 'all';
  }

  function selectedStaffIds() {
    return [...document.querySelectorAll('#meetStaffList input[type="checkbox"]:checked')].map((cb) => cb.value);
  }

  function paintStaffPickers(staff, canHost) {
    const box = document.getElementById('meetStaffList');
    const hostBlock = document.getElementById('meetHostBlock');
    if (hostBlock) hostBlock.classList.toggle('hidden', !canHost);
    if (!box) return;
    if (!canHost) return;
    if (!staff?.length) {
      box.innerHTML = '<p class="helper-text">No staff accounts yet. Create invite codes from the Staff panel.</p>';
      return;
    }
    box.innerHTML = staff.map((u) =>
      `<label class="meet-staff-chip"><input type="checkbox" value="${u.id}" /> ${esc(u.username)} <span class="helper-text">(${esc(u.role)})</span></label>`
    ).join('');
    toggleStaffPickVisibility();
  }

  function paintLiveBanner(meetings) {
    const banner = document.getElementById('meetLiveBanner');
    if (!banner) return;
    const live = (meetings || []).filter((m) => m.status === 'live' || m.status === 'scheduled');
    if (!live.length) {
      banner.classList.add('hidden');
      banner.innerHTML = '';
      return;
    }
    const m = live[0];
    banner.classList.remove('hidden');
    banner.innerHTML = `<strong>🔴 Meeting ready:</strong> ${esc(m.title)} — tap <strong>Join</strong> below to enter the call inside BolKarigar.`;
  }

  function paintMeetingsList(meetings, canHost) {
    const list = document.getElementById('meetingsList');
    if (!list) return;
    paintLiveBanner(meetings);
    if (!meetings?.length) {
      list.innerHTML = '<p class="helper-text">No active meeting. Owner/Manager: use <strong>Start Video Call</strong> above — staff will see Join here automatically.</p>';
      return;
    }
    list.innerHTML = meetings.map((m) => {
      const typeLabel = m.callType === 'audio' ? '🎙️ Voice' : '📹 Video';
      const inviteLabel = m.inviteMode === 'all' ? 'All staff' : 'Selected members';
      const joinUrl = absoluteJoinUrl(m.joinPath);
      const liveTag = m.status === 'live' ? ' 🔴 LIVE' : '';
      return `<div class="meet-card" data-id="${m.id}">
        <div class="meet-card-head">
          <strong>${esc(m.title)}${liveTag}</strong>
          <span class="meet-badge meet-badge--${esc(m.status)}">${esc(m.status)}</span>
        </div>
        <p class="helper-text">${typeLabel} · ${inviteLabel}${m.agenda ? ' · ' + esc(m.agenda) : ''}</p>
        <div class="meet-card-actions">
          <button type="button" class="theme-btn meet-join-btn" data-id="${m.id}" data-code="${esc(m.joinCode)}">Join in app</button>
          ${canHost ? `<button type="button" class="secondary meet-copy-btn" data-url="${esc(joinUrl)}">Copy link (optional)</button>` : ''}
          ${canHost ? `<button type="button" class="secondary meet-wa-btn" data-url="${esc(joinUrl)}" data-title="${esc(m.title)}">WhatsApp</button>` : ''}
          ${canHost ? `<button type="button" class="secondary meet-end-btn" data-id="${m.id}">End</button>` : ''}
        </div>
      </div>`;
    }).join('');

    list.querySelectorAll('.meet-join-btn').forEach((btn) => {
      btn.addEventListener('click', () => joinMeeting(btn.dataset.id, btn.dataset.code));
    });
    list.querySelectorAll('.meet-copy-btn').forEach((btn) => {
      btn.addEventListener('click', () => copyText(btn.dataset.url, 'Link copied (optional — staff can also Join from this tab)'));
    });
    list.querySelectorAll('.meet-wa-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const text = encodeURIComponent(`BolKarigar meeting: ${btn.dataset.title}\nOpen app → Team Meeting → Join\nOr link: ${btn.dataset.url}`);
        window.open(`https://wa.me/?text=${text}`, '_blank');
      });
    });
    list.querySelectorAll('.meet-end-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('End this meeting for everyone?')) return;
        const res = await apiPost(`/api/meetings/${btn.dataset.id}/end`, {});
        toast(res.message || res.error || 'Done', res.success ? 'success' : 'error');
        loadTeamMeetingPanel();
      });
    });
  }

  async function copyText(text, okMsg) {
    try {
      await navigator.clipboard.writeText(text);
      toast(okMsg || 'Copied', 'success');
    } catch {
      toast(okMsg || 'Could not copy — staff can Join from Team Meeting tab', 'info');
    }
  }

  function loadJitsiScript() {
    return new Promise((resolve, reject) => {
      if (window.JitsiMeetExternalAPI) return resolve();
      const s = document.createElement('script');
      s.src = 'https://meet.jit.si/external_api.js';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Meeting engine load failed. Check internet and try again.'));
      document.head.appendChild(s);
    });
  }

  function closeMeetingRoom() {
    const modal = document.getElementById('teamMeetingRoomModal');
    if (jitsiApi) {
      try { jitsiApi.dispose(); } catch (_) { /* ignore */ }
      jitsiApi = null;
    }
    activeMeetingId = null;
    const host = document.getElementById('jitsiMeetingContainer');
    if (host) host.innerHTML = '';
    if (modal) modal.classList.add('hidden');
  }

  async function requestMediaAccess(needVideo) {
    if (!navigator.mediaDevices?.getUserMedia) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: !!needVideo
      });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch {
      return false;
    }
  }

  function applyJitsiIframePermissions(container) {
    const apply = () => {
      container.querySelectorAll('iframe').forEach((iframe) => {
        const allow = 'camera; microphone; fullscreen; display-capture; autoplay; clipboard-write';
        iframe.setAttribute('allow', allow);
        iframe.allow = allow;
      });
    };
    apply();
    const obs = new MutationObserver(apply);
    obs.observe(container, { childList: true, subtree: true });
    setTimeout(() => obs.disconnect(), 15000);
  }

  async function joinMeeting(meetingId, code) {
    const joinBtn = document.querySelector(`.meet-join-btn[data-id="${meetingId}"]`);
    if (joinBtn) {
      joinBtn.disabled = true;
      joinBtn.textContent = 'Connecting…';
    }
    const res = await apiPost(`/api/meetings/${meetingId}/join`, { code });
    if (joinBtn) {
      joinBtn.disabled = false;
      joinBtn.textContent = 'Join in app';
    }
    if (!res.success) {
      toast(res.error || 'Could not join', 'error');
      return;
    }
    try {
      await loadJitsiScript();
    } catch (e) {
      toast(e.message || 'Meeting load failed', 'error');
      return;
    }

    const modal = document.getElementById('teamMeetingRoomModal');
    const titleEl = document.getElementById('teamMeetingRoomTitle');
    const host = document.getElementById('jitsiMeetingContainer');
    if (!modal || !host) return;

    closeMeetingRoom();
    activeMeetingId = meetingId;
    if (titleEl) titleEl.textContent = res.meeting.title || 'BolKarigar Meeting';

    modal.classList.remove('hidden');
    const { domain, roomName, displayName, isModerator, startWithVideoMuted, subject } = res.jitsi;
    const audioOnly = res.meeting.callType === 'audio';
    const mediaOk = await requestMediaAccess(!audioOnly);
    if (!mediaOk) {
      toast('Mic/camera allow karein — address bar 🔒 → Site settings → Allow microphone & camera', 'error');
    }

    jitsiApi = new window.JitsiMeetExternalAPI(domain, {
      roomName,
      parentNode: host,
      width: '100%',
      height: '100%',
      userInfo: { displayName },
      configOverwrite: {
        startWithAudioMuted: false,
        startWithVideoMuted: audioOnly || !!startWithVideoMuted,
        prejoinPageEnabled: true,
        enableWelcomePage: false,
        disableDeepLinking: true,
        subject: subject || 'BolKarigar Meeting',
        constraints: {
          video: audioOnly ? false : { height: { ideal: 720, max: 720, min: 180 } }
        }
      },
      interfaceConfigOverwrite: {
        MOBILE_APP_PROMO: false,
        SHOW_JITSI_WATERMARK: false,
        APP_NAME: 'BolKarigar',
        NATIVE_APP_NAME: 'BolKarigar'
      }
    });

    applyJitsiIframePermissions(host);

    if (isModerator && subject) {
      try { jitsiApi.executeCommand('subject', subject); } catch (_) { /* ignore */ }
    }

    jitsiApi.addListener('readyToClose', () => {
      closeMeetingRoom();
      loadTeamMeetingPanel();
    });

    toast('✅ Call opened inside BolKarigar — allow mic/camera when browser asks', 'success');
  }

  function startMeetPolling() {
    if (meetPollTimer) clearInterval(meetPollTimer);
    meetPollTimer = setInterval(() => {
      if (!activeMeetingId) loadTeamMeetingPanel(true);
    }, 12000);
  }

  async function loadTeamMeetingPanel(silent) {
    const noAccess = document.getElementById('meetNoAccess');
    const main = document.getElementById('meetMainContent');
    const me = window._bkAccountInfo;
    const active = me?.subscription?.isActive || me?.subscription?.fullAccess;
    if (!active) {
      if (noAccess) noAccess.classList.remove('hidden');
      if (main) main.classList.add('hidden');
      return;
    }
    if (noAccess) noAccess.classList.add('hidden');
    if (main) main.classList.remove('hidden');

    const data = await apiGet('/api/meetings');
    if (!data.success) {
      if (!silent) toast(data.error || 'Could not load meetings', 'error');
      return;
    }
    paintMeetingsList(data.meetings, data.canHost);

    const staffData = await apiGet('/api/meetings/staff');
    if (staffData.success) paintStaffPickers(staffData.staff, data.canHost);
    startMeetPolling();
  }

  async function createMeeting(callType, autoJoin) {
    let title = document.getElementById('meetTitle')?.value.trim();
    const agenda = document.getElementById('meetAgenda')?.value.trim();
    const type = callType || document.getElementById('meetCallType')?.value || 'video';
    const inviteMode = getInviteMode();
    const inviteeUserIds = inviteMode === 'selected' ? selectedStaffIds() : [];
    if (!title) title = defaultMeetingTitle(type);
    if (inviteMode === 'selected' && !inviteeUserIds.length) {
      return toast('Select at least one team member, or choose All staff', 'error');
    }

    const btn = autoJoin
      ? document.getElementById(type === 'audio' ? 'meetQuickVoiceBtn' : 'meetQuickVideoBtn')
      : document.getElementById('meetCreateBtn');
    const prevText = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Starting…'; }

    const res = await apiPost('/api/meetings', { title, agenda, callType: type, inviteMode, inviteeUserIds });
    if (btn) { btn.disabled = false; btn.textContent = prevText || btn.textContent; }

    if (!res.success) return toast(res.error || 'Failed to start meeting', 'error');

    if (res.meeting?.id && window.BolKarigarAlerts?.markSeen) {
      window.BolKarigarAlerts.markSeen('meetings', res.meeting.id);
    }

    document.getElementById('meetTitle').value = '';
    document.getElementById('meetAgenda').value = '';
    await loadTeamMeetingPanel(true);

    if (autoJoin && res.meeting?.id && res.meeting?.joinCode) {
      await joinMeeting(String(res.meeting.id), res.meeting.joinCode);
      return;
    }
    toast('✅ Meeting started — open the call with Join in app', 'success');
    if (res.meeting?.id && res.meeting?.joinCode) {
      await joinMeeting(String(res.meeting.id), res.meeting.joinCode);
    }
  }

  function toggleStaffPickVisibility() {
    const block = document.getElementById('meetStaffPickBlock');
    if (!block) return;
    block.classList.toggle('hidden', getInviteMode() !== 'selected');
  }

  async function joinFromLink(meetingId, code) {
    if (!meetingId || !code) return;
    await joinMeeting(meetingId, code);
  }

  function tryMeetJoinFromUrl() {
    const p = new URLSearchParams(window.location.search);
    const id = p.get('meetJoin');
    const code = p.get('code');
    if (!id || !code) return;
    if (!token()) {
      const ret = `${window.location.pathname}${window.location.search}`;
      window.location.href = `loginpage.html?redirect=${encodeURIComponent(ret)}`;
      return;
    }
    openPanelAndJoin(id, code);
  }

  async function openPanelAndJoin(id, code) {
    if (typeof window.openPanel === 'function') window.openPanel('teamMeetingPanel');
    await loadTeamMeetingPanel(true);
    setTimeout(() => joinFromLink(id, code), 400);
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('meetQuickVideoBtn')?.addEventListener('click', () => createMeeting('video', true));
    document.getElementById('meetQuickVoiceBtn')?.addEventListener('click', () => createMeeting('audio', true));
    document.getElementById('meetCreateBtn')?.addEventListener('click', () => createMeeting(null, true));
    document.getElementById('teamMeetingRoomCloseBtn')?.addEventListener('click', closeMeetingRoom);
    document.getElementById('teamMeetingRoomModal')?.addEventListener('click', (e) => {
      if (e.target?.id === 'teamMeetingRoomModal') closeMeetingRoom();
    });
    document.querySelectorAll('input[name="meetInviteMode"]').forEach((r) => {
      r.addEventListener('change', toggleStaffPickVisibility);
    });
    document.querySelectorAll('.tab-btn[data-tab="teamMeetingPanel"]').forEach((btn) => {
      btn.addEventListener('click', () => loadTeamMeetingPanel());
    });
    toggleStaffPickVisibility();
    setTimeout(tryMeetJoinFromUrl, 1500);
  });

  window.BolKarigarMeetings = {
    loadTeamMeetingPanel,
    joinFromLink,
    closeMeetingRoom,
    tryMeetJoinFromUrl
  };
})();
