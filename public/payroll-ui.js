/**
 * BolKarigar Payroll UI — Employee Hajri & Monthly Salary (Business ₹699)
 */
(function () {
  const API = () => (typeof window.bkGetApiUrl === 'function' ? window.bkGetApiUrl() : (window.API_URL || ''));
  const token = () => localStorage.getItem('bk_token') || localStorage.getItem('token') || '';
  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });

  const STATUS_OPTS = [
    { v: 'present', l: '✅ Present' },
    { v: 'half_day', l: '🕐 Half Day' },
    { v: 'paid_leave', l: '🏖️ Paid Leave' },
    { v: 'unpaid_leave', l: '🚫 Unpaid Leave' },
    { v: 'absent', l: '❌ Absent' }
  ];

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s ?? '';
    return d.innerHTML;
  }

  function toast(msg, type) {
    if (typeof window.showToast === 'function') window.showToast(msg, type);
    else alert(msg);
  }

  async function apiGet(path) {
    const r = await fetch(`${API()}${path}`, { headers: headers() });
    return r.json();
  }
  async function apiPost(path, body) {
    const r = await fetch(`${API()}${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body || {}) });
    return r.json();
  }
  async function apiPut(path, body) {
    const r = await fetch(`${API()}${path}`, { method: 'PUT', headers: headers(), body: JSON.stringify(body || {}) });
    return r.json();
  }
  async function apiDelete(path) {
    const r = await fetch(`${API()}${path}`, { method: 'DELETE', headers: headers() });
    return r.json();
  }

  function me() { return window._bkAccountInfo || null; }
  function isManagerView() {
    const m = me();
    if (!m?.subscription?.fullAccess) return false;
    if (!m.isStaff) return true;
    return !!(m.payroll?.canViewSalary || m.payroll?.canManage);
  }
  function isSelfView() {
    const m = me();
    return !!(m?.isStaff && m?.payroll?.isLinkedEmployee);
  }

  function monthYearInputs() {
    const month = document.getElementById('payrollMonth')?.value || String(new Date().getMonth() + 1);
    const year = document.getElementById('payrollYear')?.value || String(new Date().getFullYear());
    return { month: Number(month), year: Number(year) };
  }

  function setPayrollViewMode() {
    const manager = isManagerView();
    const selfOnly = isSelfView() && !manager;
    document.querySelectorAll('.payroll-manager-only').forEach((el) => {
      el.style.display = manager ? '' : 'none';
    });
    document.querySelectorAll('.payroll-self-only').forEach((el) => {
      el.style.display = selfOnly ? '' : 'none';
    });
    const noAccess = document.getElementById('payrollNoAccess');
    if (noAccess) {
      const show = !manager && !selfOnly;
      noAccess.classList.toggle('hidden', !show);
    }
  }

  async function loadPayrollSettings() {
    const sel = document.getElementById('payrollViewerRole');
    if (!sel || me()?.isStaff) return;
    const data = await apiGet('/api/payroll/settings');
    if (data.payrollViewerRole) sel.value = data.payrollViewerRole;
    const hint = document.getElementById('payrollViewerHint');
    if (hint) {
      hint.textContent = data.payrollViewerRole === 'cashier'
        ? 'Ab Cashier ko salary module dikhega (Manager ko nahi).'
        : 'Ab Manager ko salary module dikhega (Cashier ko nahi).';
    }
  }

  async function loadEmployees() {
    const body = document.getElementById('payrollEmployeeBody');
    if (!body) return;
    body.innerHTML = '<tr><td colspan="6">Loading...</td></tr>';
    const data = await apiGet('/api/payroll/employees');
    if (!data.success) {
      body.innerHTML = `<tr><td colspan="6">${esc(data.error || 'Error')}</td></tr>`;
      return;
    }
    if (!data.employees?.length) {
      body.innerHTML = '<tr><td colspan="6">Koi employee nahi. Neeche add karein.</td></tr>';
      populateAdvanceSelect();
      return;
    }
    body.innerHTML = data.employees.map((e) => `
      <tr>
        <td><strong>${esc(e.name)}</strong><br><span class="helper-text">${esc(e.designation)}</span></td>
        <td>${esc(e.phone || '—')}</td>
        <td>₹${Number(e.monthlySalary).toFixed(2)}</td>
        <td>${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][e.weeklyOff ?? 0]}</td>
        <td>${e.linkedUserId ? '✅ App linked' : '—'}</td>
        <td><button type="button" class="secondary payroll-del-emp" data-id="${e._id}">Remove</button></td>
      </tr>
    `).join('');
    body.querySelectorAll('.payroll-del-emp').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Employee hata dein?')) return;
        const res = await apiDelete('/api/payroll/employees/' + btn.dataset.id);
        toast(res.message || res.error || 'Done', res.success ? 'success' : 'error');
        loadEmployees();
      });
    });
    populateAdvanceSelect();
  }

  async function populateStaffLinkSelect() {
    const sel = document.getElementById('payrollLinkUser');
    if (!sel || sel.dataset.loaded) return;
    const data = await apiGet('/api/payroll/staff-users');
    if (!data.success) return;
    sel.innerHTML = '<option value="">— App login link (optional) —</option>' +
      (data.users || []).map((u) => `<option value="${u.id}" ${u.alreadyLinked ? 'disabled' : ''}>${esc(u.username)} (${u.role})${u.alreadyLinked ? ' — linked' : ''}</option>`).join('');
    sel.dataset.loaded = '1';
  }

  async function loadDailyAttendance() {
    const body = document.getElementById('payrollAttendanceBody');
    const dateInput = document.getElementById('payrollAttDate');
    if (!body) return;
    const date = dateInput?.value || new Date().toISOString().slice(0, 10);
    body.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
    const data = await apiGet('/api/payroll/attendance?date=' + encodeURIComponent(date));
    if (!data.success) {
      body.innerHTML = `<tr><td colspan="4">${esc(data.error)}</td></tr>`;
      return;
    }
    if (!data.rows?.length) {
      body.innerHTML = '<tr><td colspan="4">Pehle employee add karein.</td></tr>';
      return;
    }
    body.innerHTML = data.rows.map((row) => {
      const cur = row.attendance?.status || 'present';
      const opts = STATUS_OPTS.map((o) => `<option value="${o.v}" ${o.v === cur ? 'selected' : ''}>${o.l}</option>`).join('');
      return `<tr data-emp="${row.employee._id}">
        <td><strong>${esc(row.employee.name)}</strong></td>
        <td>${esc(row.employee.designation)}</td>
        <td><select class="payroll-att-status">${opts}</select></td>
        <td><input class="payroll-att-note" type="text" placeholder="Note" value="${esc(row.attendance?.note || '')}" /></td>
      </tr>`;
    }).join('');
  }

  async function saveDailyAttendance() {
    const date = document.getElementById('payrollAttDate')?.value;
    const rows = [...document.querySelectorAll('#payrollAttendanceBody tr[data-emp]')].map((tr) => ({
      employeeId: tr.dataset.emp,
      status: tr.querySelector('.payroll-att-status')?.value,
      note: tr.querySelector('.payroll-att-note')?.value || ''
    }));
    const res = await apiPost('/api/payroll/attendance', { date, records: rows });
    toast(res.success ? `✅ ${res.saved} attendance save` : (res.error || 'Fail'), res.success ? 'success' : 'error');
    loadDailyAttendance();
  }

  async function populateAdvanceSelect() {
    const sel = document.getElementById('payrollAdvanceEmp');
    if (!sel) return;
    const data = await apiGet('/api/payroll/employees');
    if (!data.success) return;
    sel.innerHTML = '<option value="">Advance — Employee select</option>' +
      (data.employees || []).map((e) => `<option value="${e._id}">${esc(e.name)}</option>`).join('');
  }

  async function loadSalarySummary() {
    const out = document.getElementById('payrollSalaryOutput');
    if (!out) return;
    const { month, year } = monthYearInputs();
    out.innerHTML = '<p>Calculating salary...</p>';
    const data = await apiGet(`/api/payroll/salary-summary?month=${month}&year=${year}`);
    if (!data.success) {
      out.innerHTML = `<p style="color:#ef4444">${esc(data.error)}</p>`;
      return;
    }
    let html = `<div class="payroll-summary-bar">
      <strong>Month:</strong> ${month}/${year} &nbsp;|&nbsp;
      <strong>Total Payable:</strong> <span style="color:#22c55e;font-size:1.1rem;">₹${Number(data.totalNetPayable || 0).toFixed(2)}</span>
    </div>`;
    html += '<table><thead><tr><th>Employee</th><th>Working Days</th><th>Earned Days</th><th>Gross</th><th>Advance</th><th>Net Pay</th><th></th></tr></thead><tbody>';
    (data.summaries || []).forEach((s) => {
      html += `<tr>
        <td><strong>${esc(s.employee.name)}</strong><br><span class="helper-text">${esc(s.employee.designation)}</span></td>
        <td>${s.workingDays}</td>
        <td>${s.earnedDays}</td>
        <td>₹${s.grossSalary.toFixed(2)}</td>
        <td>₹${s.totalAdvances.toFixed(2)}</td>
        <td><strong style="color:#22c55e">₹${s.netPayable.toFixed(2)}</strong></td>
        <td><button type="button" class="secondary payroll-slip-btn" data-id="${s.employee.id}">📄 Slip</button></td>
      </tr>`;
    });
    html += '</tbody></table>';
    out.innerHTML = html;
    out.querySelectorAll('.payroll-slip-btn').forEach((btn) => {
      btn.addEventListener('click', () => showSalarySlip(btn.dataset.id));
    });
  }

  async function showSalarySlip(employeeId) {
    const { month, year } = monthYearInputs();
    const data = await apiGet(`/api/payroll/salary/${employeeId}?month=${month}&year=${year}`);
    if (!data.success) return toast(data.error || 'Error', 'error');
    const s = data.slip;
    const modal = document.getElementById('payrollSlipModal');
    const body = document.getElementById('payrollSlipBody');
    if (!modal || !body) return;
    let rows = (s.dailyRows || []).filter((d) => d.status !== 'weekly_off').map((d) =>
      `<tr><td>${esc(d.date)}</td><td>${esc(d.weekday)}</td><td>${esc(d.status)}</td><td>${d.earned}</td></tr>`
    ).join('');
    body.innerHTML = `
      <h3 style="margin-top:0;">Salary Slip — ${esc(s.employee.name)}</h3>
      <p>${month}/${year} | ${esc(s.employee.designation)} | Monthly: ₹${s.employee.monthlySalary.toFixed(2)}</p>
      <div class="grid-2" style="margin:12px 0;">
        <div class="mini-card">Working Days: <strong>${s.workingDays}</strong></div>
        <div class="mini-card">Earned Days: <strong>${s.earnedDays}</strong></div>
        <div class="mini-card">Per Day: <strong>₹${s.perDayRate.toFixed(2)}</strong></div>
        <div class="mini-card">Gross: <strong>₹${s.grossSalary.toFixed(2)}</strong></div>
        <div class="mini-card">Advance: <strong>₹${s.totalAdvances.toFixed(2)}</strong></div>
        <div class="mini-card" style="border-left:4px solid #22c55e;">Net Pay: <strong>₹${s.netPayable.toFixed(2)}</strong></div>
      </div>
      <details><summary>Daily breakdown</summary>
        <table style="margin-top:8px;"><thead><tr><th>Date</th><th>Day</th><th>Status</th><th>Earned</th></tr></thead><tbody>${rows}</tbody></table>
      </details>`;
    modal.classList.remove('hidden');
  }

  async function loadSelfAttendance() {
    const box = document.getElementById('payrollSelfBox');
    if (!box) return;
    const data = await apiGet('/api/payroll/me');
    if (!data.employee) {
      box.innerHTML = '<p class="helper-text">Aapka employee profile abhi link nahi hai. Owner se Staff Payroll me link karwayein.</p>';
      return;
    }
    const att = await apiGet('/api/payroll/attendance');
    const cur = att.attendance?.status || '';
    const btns = STATUS_OPTS.map((o) =>
      `<button type="button" class="theme-btn payroll-self-mark ${cur === o.v ? 'active' : ''}" data-status="${o.v}">${o.l}</button>`
    ).join(' ');
    box.innerHTML = `
      <p><strong>${esc(data.employee.name)}</strong> — Aaj ki hajri mark karein (${att.date || 'today'})</p>
      <div class="btn-row" style="flex-wrap:wrap;gap:8px;margin:12px 0;">${btns}</div>
      <p class="helper-text">Current: <strong>${cur || 'Not marked'}</strong></p>
      <button type="button" id="payrollViewMySlipBtn" class="secondary">📄 Meri Salary Slip</button>`;
    box.querySelectorAll('.payroll-self-mark').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const res = await apiPost('/api/payroll/attendance/self', { status: btn.dataset.status });
        toast(res.message || res.error || 'Saved', res.success ? 'success' : 'error');
        loadSelfAttendance();
      });
    });
    document.getElementById('payrollViewMySlipBtn')?.addEventListener('click', () => {
      if (data.employee?._id) showSalarySlip(data.employee._id);
    });
  }

  function initPayrollSubtabs() {
    document.querySelectorAll('.payroll-subtab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.payroll-subtab-btn').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.payroll-subpanel').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.sub)?.classList.add('active');
        const sub = btn.dataset.sub;
        if (sub === 'payrollEmpSub') loadEmployees();
        if (sub === 'payrollAttSub') loadDailyAttendance();
        if (sub === 'payrollSalSub') loadSalarySummary();
        if (sub === 'payrollSetSub') loadPayrollSettings();
      });
    });
  }

  async function loadPayrollPanel() {
    if (!me()?.subscription?.fullAccess) return;
    setPayrollViewMode();
    if (isManagerView()) {
      await loadPayrollSettings();
      populateStaffLinkSelect();
      const active = document.querySelector('.payroll-subtab-btn.active')?.dataset.sub;
      if (active === 'payrollEmpSub' || !active) loadEmployees();
      if (active === 'payrollAttSub') loadDailyAttendance();
      if (active === 'payrollSalSub') loadSalarySummary();
    }
    if (isSelfView()) loadSelfAttendance();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const pm = document.getElementById('payrollMonth');
    const py = document.getElementById('payrollYear');
    const ad = document.getElementById('payrollAttDate');
    if (pm) pm.value = String(new Date().getMonth() + 1);
    if (py) py.value = String(new Date().getFullYear());
    if (ad) ad.value = new Date().toISOString().slice(0, 10);

    initPayrollSubtabs();

    document.getElementById('payrollAddEmpBtn')?.addEventListener('click', async () => {
      const name = document.getElementById('payrollEmpName')?.value.trim();
      const phone = document.getElementById('payrollEmpPhone')?.value.trim();
      const designation = document.getElementById('payrollEmpDesignation')?.value.trim();
      const monthlySalary = document.getElementById('payrollEmpSalary')?.value;
      const weeklyOff = document.getElementById('payrollEmpWeeklyOff')?.value;
      const linkedUserId = document.getElementById('payrollLinkUser')?.value || null;
      if (!name) return toast('Naam zaroori hai', 'error');
      const res = await apiPost('/api/payroll/employees', { name, phone, designation, monthlySalary, weeklyOff, linkedUserId });
      toast(res.success ? '✅ Employee add ho gaya' : (res.error || 'Fail'), res.success ? 'success' : 'error');
      if (res.success) {
        document.getElementById('payrollEmpName').value = '';
        document.getElementById('payrollEmpPhone').value = '';
        document.getElementById('payrollEmpSalary').value = '';
        loadEmployees();
      }
    });

    document.getElementById('payrollSaveAttBtn')?.addEventListener('click', saveDailyAttendance);
    document.getElementById('payrollLoadAttBtn')?.addEventListener('click', loadDailyAttendance);
    document.getElementById('payrollLoadSalaryBtn')?.addEventListener('click', loadSalarySummary);

    document.getElementById('payrollAddAdvanceBtn')?.addEventListener('click', async () => {
      const { month, year } = monthYearInputs();
      const employeeId = document.getElementById('payrollAdvanceEmp')?.value;
      const amount = document.getElementById('payrollAdvanceAmt')?.value;
      const note = document.getElementById('payrollAdvanceNote')?.value;
      if (!employeeId || !amount) return toast('Employee aur amount chahiye', 'error');
      const res = await apiPost('/api/payroll/advances', { employeeId, amount, month, year, note });
      toast(res.success ? '✅ Advance save' : (res.error || 'Fail'), res.success ? 'success' : 'error');
    });

    document.getElementById('payrollSaveSettingsBtn')?.addEventListener('click', async () => {
      const payrollViewerRole = document.getElementById('payrollViewerRole')?.value;
      const res = await apiPut('/api/payroll/settings', { payrollViewerRole });
      toast(res.message || res.error || 'Saved', res.success ? 'success' : 'error');
      loadPayrollSettings();
    });

    document.getElementById('payrollSlipCloseBtn')?.addEventListener('click', () => {
      document.getElementById('payrollSlipModal')?.classList.add('hidden');
    });

    document.querySelectorAll('.tab-btn[data-tab="payrollPanel"]').forEach((btn) => {
      btn.addEventListener('click', loadPayrollPanel);
    });
  });

  window.BolKarigarPayroll = { loadPayrollPanel, setPayrollViewMode };
})();
