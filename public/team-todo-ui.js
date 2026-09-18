/**
 * Team todo UI — owner sends to all or selected staff; staff mark done.
 */
(function () {
  const API = () => (typeof window.bkGetApiUrl === 'function' ? window.bkGetApiUrl() : (window.API_URL || ''));
  const token = () => localStorage.getItem('bk_token') || localStorage.getItem('token') || '';
  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s ?? '';
    return d.innerHTML;
  }

  function toast(msg, type) {
    if (typeof window.showToast === 'function') window.showToast(msg, type);
  }

  async function parseApiResponse(r) {
    const text = await r.text();
    try {
      const data = JSON.parse(text);
      if (!r.ok && data.success === undefined) data.success = false;
      if (!r.ok && !data.error) data.error = `Server error (${r.status})`;
      return data;
    } catch {
      return { success: false, error: `Invalid response (${r.status})` };
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

  async function apiDelete(path) {
    const r = await fetch(`${API()}${path}`, { method: 'DELETE', headers: headers() });
    return parseApiResponse(r);
  }

  function getAssignMode() {
    const sel = document.querySelector('input[name="teamTodoAssignMode"]:checked');
    return sel?.value === 'selected' ? 'selected' : 'all';
  }

  function selectedStaffIds() {
    return [...document.querySelectorAll('#teamTodoStaffList input[type="checkbox"]:checked')].map((cb) => cb.value);
  }

  function toggleStaffPick() {
    const block = document.getElementById('teamTodoStaffPick');
    if (!block) return;
    block.classList.toggle('hidden', getAssignMode() !== 'selected');
  }

  function paintStaff(staff) {
    const box = document.getElementById('teamTodoStaffList');
    if (!box) return;
    if (!staff?.length) {
      box.innerHTML = '<p class="helper-text">No staff yet — create invite from Staff panel.</p>';
      return;
    }
    box.innerHTML = staff.map((u) =>
      `<label class="meet-staff-chip"><input type="checkbox" value="${u.id}" /> ${esc(u.username)} <span class="helper-text">(${esc(u.role)})</span></label>`
    ).join('');
  }

  function paintTeamTodos(todos, canHost) {
    const list = document.getElementById('teamTodoList');
    const stat = document.getElementById('teamTodoStatus');
    if (!list) return;
    if (stat) {
      stat.textContent = todos?.length
        ? `${todos.length} team message(s) — staff see tasks assigned to them.`
        : 'No team messages yet.';
    }
    if (!todos?.length) {
      list.innerHTML = '<li class="helper-text">Send a message to all staff or pick members above.</li>';
      return;
    }
    list.innerHTML = todos.map((t) => {
      const doneLine = t.canHost && t.doneCount
        ? `<span class="helper-text">Done: ${esc(t.doneNames)}</span>`
        : '';
      const actions = canHost
        ? `<button type="button" class="del-btn team-todo-del" data-id="${t.id}">Remove</button>`
        : (t.isDoneForMe
          ? '<span class="helper-text">✅ Done</span>'
          : `<button type="button" class="theme-btn team-todo-done" data-id="${t.id}">Mark done</button>`);
      return `<li class="team-todo-item ${t.isDoneForMe ? 'team-todo-item--done' : ''}">
        <div class="team-todo-main">
          <strong>${esc(t.text)}</strong>
          <span class="helper-text">To: ${esc(t.assigneesLabel)} · ${new Date(t.createdAt).toLocaleString('en-IN')}</span>
          ${doneLine}
        </div>
        ${actions}
      </li>`;
    }).join('');

    list.querySelectorAll('.team-todo-done').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const res = await apiPost(`/api/team-todos/${btn.dataset.id}/done`, {});
        toast(res.message || res.error || 'Saved', res.success ? 'success' : 'error');
        loadTeamTodos();
      });
    });
    list.querySelectorAll('.team-todo-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remove this team todo?')) return;
        const res = await apiDelete(`/api/team-todos/${btn.dataset.id}`);
        toast(res.message || res.error || 'Removed', res.success ? 'success' : 'error');
        loadTeamTodos();
      });
    });
  }

  async function loadTeamTodos() {
    const hostBlock = document.getElementById('teamTodoHostBlock');
    const data = await apiGet('/api/team-todos');
    if (!data.success) {
      toast(data.error || 'Could not load team todos', 'error');
      return;
    }
    if (hostBlock) hostBlock.classList.toggle('hidden', !data.canHost);
    paintTeamTodos(data.todos, data.canHost);
    if (data.canHost) {
      const staffData = await apiGet('/api/team-todos/staff');
      if (staffData.success) paintStaff(staffData.staff);
      toggleStaffPick();
    }
  }

  async function sendTeamTodo() {
    const text = document.getElementById('teamTodoInput')?.value.trim();
    if (!text) return toast('Write a todo message first', 'error');
    const assignToAll = getAssignMode() === 'all';
    const assigneeUserIds = assignToAll ? [] : selectedStaffIds();
    if (!assignToAll && !assigneeUserIds.length) {
      return toast('Select at least one staff member or choose All staff', 'error');
    }
    const btn = document.getElementById('teamTodoSendBtn');
    const prev = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    const res = await apiPost('/api/team-todos', { text, assignToAll, assigneeUserIds });
    if (btn) { btn.disabled = false; btn.textContent = prev; }
    if (!res.success) return toast(res.error || 'Failed', 'error');
    document.getElementById('teamTodoInput').value = '';
    toast(assignToAll ? '✅ Sent to all staff' : '✅ Sent to selected staff', 'success');
    loadTeamTodos();
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('teamTodoSendBtn')?.addEventListener('click', sendTeamTodo);
    document.querySelectorAll('input[name="teamTodoAssignMode"]').forEach((r) => {
      r.addEventListener('change', toggleStaffPick);
    });
    document.querySelectorAll('.tab-btn[data-tab="todoPanel"]').forEach((btn) => {
      btn.addEventListener('click', loadTeamTodos);
    });
  });

  window.BolKarigarTeamTodos = { loadTeamTodos };
})();
