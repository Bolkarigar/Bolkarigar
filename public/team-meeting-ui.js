/**
 * BolKarigar Team Meeting UI — voice/video via Jitsi, shareable join links
 */
(function () {
  const API = () => (typeof window.bkGetApiUrl === 'function' ? window.bkGetApiUrl() : (window.API_URL || ''));
  const token = () => localStorage.getItem('bk_token') || localStorage.getItem('token') || '';
  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });

  let jitsiApi = null;
  let activeMeetingId = null;

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s ?? '';
    return d.innerHTML;
  }

  function toast(msg, type) {
    if (typeof window.showToast === 'function') window.showToast(msg, type);
    else alert(msg);
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
    const staffBlock = document.getElementById('meetStaffPickBlock');
    if (hostBlock) hostBlock.classList.toggle('hidden', !canHost);
    if (staffBlock) staffBlock.classList.toggle('hidden', !canHost);
    if (!box) return;
    if (!staff?.length) {
      box.innerHTML = '<p class="helper-text">No staff accounts yet. Create invite codes from the Staff panel.</p>';
      return;
    }
    box.innerHTML = staff.map((u) =>
      `<label class="meet-staff-chip"><input type="checkbox" value="${u.id}" /> ${esc(u.username)} <span class="helper-text">(${esc(u.role)})</span></label>`
    ).join('');
  }

  function paintMeetingsList(meetings, canHost) {
    const list = document.getElementById('meetingsList');
    if (!list) return;
    if (!meetings?.length) {
      list.innerHTML = '<p class="helper-text">No active meetings. Owner/Manager can schedule one above.</p>';
      return;
    }
    list.innerHTML = meetings.map((m) => {
      const typeLabel = m.callType === 'audio' ? '🎙️ Voice' : '📹 Video';
      const inviteLabel = m.inviteMode === 'all' ? 'All staff' : 'Selected members';
      const joinUrl = absoluteJoinUrl(m.joinPath);
      return `<div class="meet-card" data-id="${m.id}">
        <div class="meet-card-head">
          <strong>${esc(m.title)}</strong>
          <span class="meet-badge meet-badge--${esc(m.status)}">${esc(m.status)}</span>
        </div>
        <p class="helper-text">${typeLabel} · ${inviteLabel}${m.agenda ? ' · ' + esc(m.agenda) : ''}</p>
        <div class="meet-card-actions">
          <button type="button" class="theme-btn meet-join-btn" data-id="${m.id}" data-code="${esc(m.joinCode)}">Join</button>
          <button type="button" class="secondary meet-copy-btn" data-url="${esc(joinUrl)}">Copy Link</button>
          <button type="button" class="secondary meet-wa-btn" data-url="${esc(joinUrl)}" data-title="${esc(m.title)}">WhatsApp</button>
          ${canHost ? `<button type="button" class="secondary meet-end-btn" data-id="${m.id}">End</button>` : ''}
        </div>
      </div>`;
    }).join('');

    list.querySelectorAll('.meet-join-btn').forEach((btn) => {
      btn.addEventListener('click', () => joinMeeting(btn.dataset.id, btn.dataset.code));
    });
    list.querySelectorAll('.meet-copy-btn').forEach((btn) => {
      btn.addEventListener('click', () => copyText(btn.dataset.url, 'Meeting link copied'));
    });
    list.querySelectorAll('.meet-wa-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const text = encodeURIComponent(`BolKarigar Team Meeting: ${btn.dataset.title}\nJoin: ${btn.dataset.url}`);
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
      toast(text, 'info');
    }
  }

  function loadJitsiScript() {
    return new Promise((resolve, reject) => {
      if (window.JitsiMeetExternalAPI) return resolve();
      const s = document.createElement('script');
      s.src = 'https://meet.jit.si/external_api.js';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Could not load meeting engine'));
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

  async function joinMeeting(meetingId, code) {
    const res = await apiPost(`/api/meetings/${meetingId}/join`, { code });
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
    if (titleEl) titleEl.textContent = res.meeting.title || 'Team Meeting';

    modal.classList.remove('hidden');
    const { domain, roomName, displayName, isModerator, startWithVideoMuted, subject } = res.jitsi;

    jitsiApi = new window.JitsiMeetExternalAPI(domain, {
      roomName,
      parentNode: host,
      width: '100%',
      height: '100%',
      userInfo: { displayName },
      configOverwrite: {
        startWithAudioMuted: false,
        startWithVideoMuted: !!startWithVideoMuted,
        prejoinPageEnabled: true,
        subject: subject || 'BolKarigar Meeting'
      },
      interfaceConfigOverwrite: {
        MOBILE_APP_PROMO: false,
        SHOW_JITSI_WATERMARK: false
      }
    });

    if (isModerator) {
      jitsiApi.executeCommand('subject', subject || 'BolKarigar Meeting');
    }

    jitsiApi.addListener('readyToClose', () => {
      closeMeetingRoom();
      loadTeamMeetingPanel();
    });
  }

  async function loadTeamMeetingPanel() {
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
      toast(data.error || 'Could not load meetings', 'error');
      return;
    }
    paintMeetingsList(data.meetings, data.canHost);

    const staffData = await apiGet('/api/meetings/staff');
    if (staffData.success) paintStaffPickers(staffData.staff, data.canHost);
  }

  async function createMeeting() {
    const title = document.getElementById('meetTitle')?.value.trim();
    const agenda = document.getElementById('meetAgenda')?.value.trim();
    const callType = document.getElementById('meetCallType')?.value || 'video';
    const inviteMode = getInviteMode();
    const inviteeUserIds = inviteMode === 'selected' ? selectedStaffIds() : [];
    if (!title) return toast('Meeting title is required', 'error');

    const res = await apiPost('/api/meetings', { title, agenda, callType, inviteMode, inviteeUserIds });
    if (!res.success) return toast(res.error || 'Failed', 'error');
    toast('✅ Meeting created — share the link with your team', 'success');
    document.getElementById('meetTitle').value = '';
    document.getElementById('meetAgenda').value = '';
    const url = absoluteJoinUrl(res.meeting.joinPath);
    await copyText(url, 'Meeting link copied — send to staff');
    loadTeamMeetingPanel();
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
    await loadTeamMeetingPanel();
    setTimeout(() => joinFromLink(id, code), 400);
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('meetCreateBtn')?.addEventListener('click', createMeeting);
    document.getElementById('teamMeetingRoomCloseBtn')?.addEventListener('click', closeMeetingRoom);
    document.getElementById('teamMeetingRoomModal')?.addEventListener('click', (e) => {
      if (e.target?.id === 'teamMeetingRoomModal') closeMeetingRoom();
    });
    document.querySelectorAll('input[name="meetInviteMode"]').forEach((r) => {
      r.addEventListener('change', toggleStaffPickVisibility);
    });
    document.querySelectorAll('.tab-btn[data-tab="teamMeetingPanel"]').forEach((btn) => {
      btn.addEventListener('click', loadTeamMeetingPanel);
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
