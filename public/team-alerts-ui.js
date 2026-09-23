/**
 * Accounts Orbit — team alerts (meeting / todo / gallery) with sound + browser notification
 */
(function () {
  const API = () => (typeof window.bkGetApiUrl === 'function' ? window.bkGetApiUrl() : (window.API_URL || ''));
  const token = () => localStorage.getItem('bk_token') || localStorage.getItem('token') || '';
  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });
  const STORAGE_KEY = 'bk_team_alert_state_v1';
  const POLL_MS = 14000;

  let pollTimer = null;
  let audioCtx = null;

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function saveState(st) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
  }

  function ensureState() {
    const st = loadState();
    if (!st.meetings) st.meetings = {};
    if (!st.todos) st.todos = {};
    if (!st.gallery) st.gallery = {};
    if (!st.initialized) st.initialized = false;
    return st;
  }

  function markSeen(kind, id) {
    const st = ensureState();
    st[kind][String(id)] = Date.now();
    saveState(st);
  }

  function isSeen(st, kind, id) {
    return !!st[kind][String(id)];
  }

  function myUserId() {
    const me = window._bkAccountInfo;
    return String(me?.userId || me?.id || me?._id || '');
  }

  function playTone(freq, ms, gainVal) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.value = gainVal ?? 0.12;
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      setTimeout(() => {
        try { o.stop(); } catch (_) { /* ignore */ }
      }, ms);
    } catch (_) { /* ignore */ }
  }

  function playMessageAlert() {
    playTone(660, 180);
    setTimeout(() => playTone(880, 180), 220);
  }

  function playCallAlert() {
    [0, 350, 700].forEach((delay, i) => {
      setTimeout(() => playTone(i % 2 ? 784 : 988, 280, 0.14), delay);
    });
  }

  function toast(msg, type) {
    if (typeof window.showToast === 'function') window.showToast(msg, type);
  }

  function showFloatingAlert({ title, body, actionLabel, onAction, kind }) {
    let bar = document.getElementById('bkTeamAlertBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'bkTeamAlertBar';
      bar.className = 'bk-team-alert-bar hidden';
      bar.innerHTML = `<div class="bk-team-alert-inner">
        <div class="bk-team-alert-text"><strong class="bk-team-alert-title"></strong><span class="bk-team-alert-body"></span></div>
        <div class="bk-team-alert-actions">
          <button type="button" class="theme-btn bk-team-alert-go"></button>
          <button type="button" class="secondary bk-team-alert-dismiss">Dismiss</button>
        </div>
      </div>`;
      document.body.appendChild(bar);
      bar.querySelector('.bk-team-alert-dismiss')?.addEventListener('click', () => bar.classList.add('hidden'));
    }
    bar.querySelector('.bk-team-alert-title').textContent = title;
    bar.querySelector('.bk-team-alert-body').textContent = body ? ` — ${body}` : '';
    const go = bar.querySelector('.bk-team-alert-go');
    go.textContent = actionLabel;
    go.onclick = () => {
      bar.classList.add('hidden');
      if (typeof onAction === 'function') onAction();
    };
    bar.classList.remove('hidden');
    bar.dataset.kind = kind || 'msg';
  }

  function pushBrowserNotification(title, body, tag, onclick) {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    try {
      const n = new Notification(title, { body, tag, icon: '/favicon.ico' });
      n.onclick = () => {
        window.focus();
        if (onclick) onclick();
        n.close();
      };
    } catch (_) { /* ignore */ }
  }

  function requestNotifyPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }

  async function apiGet(path) {
    const r = await fetch(`${API()}${path}`, { headers: headers() });
    try {
      return await r.json();
    } catch {
      return { success: false };
    }
  }

  function bootstrapSeen(st, meetings, todos, shares) {
    (meetings || []).forEach((m) => { st.meetings[String(m.id)] = Date.now(); });
    (todos || []).forEach((t) => { st.todos[String(t.id)] = Date.now(); });
    (shares || []).forEach((s) => { st.gallery[String(s.id)] = Date.now(); });
    st.initialized = true;
    saveState(st);
  }

  function notifyMeeting(m) {
    const label = m.callType === 'audio' ? 'Voice call' : 'Video call';
    playCallAlert();
    toast(`📞 ${label}: ${m.title}`, 'info');
    showFloatingAlert({
      title: `${label} — ${m.title}`,
      body: 'Team Meeting',
      actionLabel: 'Join call',
      kind: 'call',
      onAction: () => {
        if (typeof window.openPanel === 'function') window.openPanel('teamMeetingPanel');
        if (window.BolKarigarMeetings?.joinFromLink) {
          window.BolKarigarMeetings.joinFromLink(String(m.id), m.joinCode);
        }
      }
    });
    pushBrowserNotification(`Accounts Orbit ${label}`, m.title, `meet-${m.id}`, () => {
      if (typeof window.openPanel === 'function') window.openPanel('teamMeetingPanel');
    });
  }

  function notifyTodo(t) {
    playMessageAlert();
    toast(`📋 Team todo: ${t.text}`, 'info');
    showFloatingAlert({
      title: 'New team todo',
      body: t.text,
      actionLabel: 'Open Todo',
      kind: 'todo',
      onAction: () => {
        if (typeof window.openPanel === 'function') window.openPanel('todoPanel');
        if (window.BolKarigarTeamTodos?.loadTeamTodos) window.BolKarigarTeamTodos.loadTeamTodos();
      }
    });
    pushBrowserNotification('Accounts Orbit — Team todo', t.text, `todo-${t.id}`, () => {
      if (typeof window.openPanel === 'function') window.openPanel('todoPanel');
    });
  }

  function notifyGallery(s) {
    playMessageAlert();
    const note = s.note || 'New photo shared with you';
    toast(`🖼️ Gallery: ${note}`, 'info');
    showFloatingAlert({
      title: 'Gallery share',
      body: note,
      actionLabel: 'Open Gallery',
      kind: 'gallery',
      onAction: () => {
        if (typeof window.openPanel === 'function') window.openPanel('galleryPanel');
        if (window.BolKarigarTeamGallery?.loadTeamGallery) window.BolKarigarTeamGallery.loadTeamGallery();
      }
    });
    pushBrowserNotification('Accounts Orbit — Gallery', note, `gal-${s.id}`, () => {
      if (typeof window.openPanel === 'function') window.openPanel('galleryPanel');
    });
  }

  async function pollAlerts() {
    if (!token()) return;
    const me = window._bkAccountInfo;
    if (!me?.subscription?.isActive && !me?.subscription?.fullAccess) return;

    const uid = myUserId();
    const st = ensureState();
    const canMeet = me.subscription?.fullAccess || me.subscription?.isActive;

    const [meetRes, todoRes, galRes] = await Promise.all([
      canMeet ? apiGet('/api/meetings') : Promise.resolve({ success: false }),
      apiGet('/api/team-todos'),
      apiGet('/api/team-gallery')
    ]);

    const meetings = meetRes.success ? meetRes.meetings || [] : [];
    const todos = todoRes.success ? todoRes.todos || [] : [];
    const shares = galRes.success ? galRes.shares || [] : [];

    if (!st.initialized) {
      bootstrapSeen(st, meetings, todos, shares);
      return;
    }

    meetings.forEach((m) => {
      if (m.status === 'ended') return;
      if (isSeen(st, 'meetings', m.id)) return;
      if (uid && String(m.createdBy) === uid) {
        markSeen('meetings', m.id);
        return;
      }
      markSeen('meetings', m.id);
      notifyMeeting(m);
    });

    todos.forEach((t) => {
      if (isSeen(st, 'todos', t.id)) return;
      if (t.isDoneForMe) {
        markSeen('todos', t.id);
        return;
      }
      markSeen('todos', t.id);
      if (uid && String(t.createdBy) === uid) return;
      notifyTodo(t);
    });

    shares.forEach((s) => {
      if (isSeen(st, 'gallery', s.id)) return;
      markSeen('gallery', s.id);
      if (uid && s.createdBy && String(s.createdBy) === uid) return;
      notifyGallery(s);
    });
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    requestNotifyPermission();
    pollAlerts();
    pollTimer = setInterval(pollAlerts, POLL_MS);
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(startPolling, 2500);
  });

  window.addEventListener('focus', () => {
    if (token()) pollAlerts();
  });

  window.BolKarigarAlerts = {
    startPolling,
    stopPolling,
    markSeen,
    requestNotifyPermission,
    pollNow: pollAlerts
  };
})();
