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

  async function parseApiResponse(r) {
    const text = await r.text();
    try {
      const data = JSON.parse(text);
      if (!r.ok && data.success === undefined) data.success = false;
      if (!r.ok && !data.error) data.error = `Server error (${r.status})`;
      return data;
    } catch {
      return {
        success: false,
        error: r.status === 404
          ? 'Payroll API nahi mili — server restart karein (npm start).'
          : `Server ne sahi jawab nahi diya (${r.status}). Page refresh ya dubara login karein.`
      };
    }
  }

  async function apiGet(path) {
    try {
      const r = await fetch(`${API()}${path}`, { headers: headers() });
      return await parseApiResponse(r);
    } catch (e) {
      return { success: false, error: e.message || 'Network error — server check karein.' };
    }
  }
  async function apiPost(path, body) {
    try {
      const r = await fetch(`${API()}${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body || {}) });
      return await parseApiResponse(r);
    } catch (e) {
      return { success: false, error: e.message || 'Network error — server check karein.' };
    }
  }
  async function apiPut(path, body) {
    try {
      const r = await fetch(`${API()}${path}`, { method: 'PUT', headers: headers(), body: JSON.stringify(body || {}) });
      return await parseApiResponse(r);
    } catch (e) {
      return { success: false, error: e.message || 'Network error — server check karein.' };
    }
  }
  async function apiDelete(path) {
    try {
      const r = await fetch(`${API()}${path}`, { method: 'DELETE', headers: headers() });
      return await parseApiResponse(r);
    } catch (e) {
      return { success: false, error: e.message || 'Network error — server check karein.' };
    }
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
    if (!m?.isStaff || isManagerView()) return false;
    return !!(m.payroll?.canMarkHajri || ['cashier', 'manager', 'staff'].includes(m.role || ''));
  }

  function updatePayrollNavLabel() {
    const tab = document.querySelector('.tab-btn[data-tab="payrollPanel"]');
    const header = document.querySelector('#payrollPanel .panel-header h3');
    if (tab) {
      tab.textContent = isSelfView() ? '📅 Meri Hajri' : '💼 Staff Payroll';
    }
    if (header) {
      header.textContent = isSelfView() ? '📅 Meri Hajri' : '💼 Staff Payroll & Hajri';
    }
  }

  function buildSlipWhatsAppText(slip, month, year) {
    const s = slip;
    const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return [
      '*BolKarigar — Salary Slip*',
      `Name: ${s.employee.name}`,
      `Role: ${s.employee.designation}`,
      `Month: ${monthNames[month] || month} ${year}`,
      `Working Days: ${s.workingDays}`,
      `Earned Days: ${s.earnedDays}`,
      `Monthly Salary: ₹${Number(s.employee.monthlySalary).toFixed(2)}`,
      `Gross: ₹${s.grossSalary.toFixed(2)}`,
      `Advance: ₹${s.totalAdvances.toFixed(2)}`,
      `*Net Pay: ₹${s.netPayable.toFixed(2)}*`,
      '— BolKarigar App'
    ].join('\n');
  }

  function shareSlipWhatsApp() {
    const data = window._lastPayrollSlip;
    if (!data?.slip) return toast('Pehle salary slip kholein', 'error');
    const text = encodeURIComponent(buildSlipWhatsAppText(data.slip, data.month, data.year));
    const phone = (data.slip.employee.phone || '').replace(/\D/g, '');
    const url = phone.length >= 10
      ? `https://wa.me/91${phone.slice(-10)}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  }

  function monthYearInputs() {
    const month = document.getElementById('payrollMonth')?.value || String(new Date().getMonth() + 1);
    const year = document.getElementById('payrollYear')?.value || String(new Date().getFullYear());
    return { month: Number(month), year: Number(year) };
  }

  function setPayrollViewMode() {
    const manager = isManagerView();
    const selfOnly = isSelfView() && !manager;
    updatePayrollNavLabel();
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
    try {
      const data = await apiGet('/api/payroll/employees');
      if (!data.success) {
        body.innerHTML = `<tr><td colspan="6" style="color:#ef4444">${esc(data.error || 'Employee list load nahi hui')}</td></tr>`;
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
    } catch (e) {
      body.innerHTML = `<tr><td colspan="6" style="color:#ef4444">${esc(e.message || 'Employee list load fail')}</td></tr>`;
    }
  }

  async function populateStaffLinkSelect(force) {
    const sel = document.getElementById('payrollLinkUser');
    const hint = document.getElementById('payrollLinkHint');
    if (!sel) return;
    if (sel.dataset.loaded && !force) return;
    if (force) delete sel.dataset.loaded;

    sel.innerHTML = '<option value="">Loading staff...</option>';
    const data = await apiGet('/api/payroll/staff-users');
    if (!data.success) {
      sel.innerHTML = '<option value="">— App login link (optional) —</option>';
      if (hint) hint.textContent = data.error || 'Staff list load nahi hui. Dubara try karein.';
      return;
    }
    const users = data.users || [];
    const available = users.filter((u) => !u.alreadyLinked);
    const linked = users.filter((u) => u.alreadyLinked);

    let html = '<option value="">— App login link (optional) —</option>';
    if (available.length) {
      html += '<optgroup label="Link kar sakte hain">';
      html += available.map((u) => `<option value="${u.id}">${esc(u.username)} (${u.role})</option>`).join('');
      html += '</optgroup>';
    }
    if (linked.length) {
      html += '<optgroup label="Pehle se linked (auto)">';
      html += linked.map((u) => {
        const tag = u.linkedEmployeeName ? ` → ${esc(u.linkedEmployeeName)}` : '';
        return `<option value="" disabled>${esc(u.username)} (${u.role}) — linked ✓${tag}</option>`;
      }).join('');
      html += '</optgroup>';
    }
    sel.innerHTML = html;

    if (hint) {
      if (!users.length) {
        hint.textContent = 'Pehle Staff tab se invite code se staff account banao.';
      } else if (!available.length) {
        hint.textContent = `Saare staff linked hain: ${linked.map((u) => u.username).join(', ')}. Employee list me pehle se dikhenge — dubara link ki zaroorat nahi.`;
      } else if (linked.length) {
        hint.textContent = `Linked: ${linked.map((u) => u.username).join(', ')}. Neeche se naya staff link karein.`;
      } else {
        hint.textContent = 'Optional — staff app login ko employee se link karein.';
      }
    }
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

  function closePayrollSlipModal() {
    document.getElementById('payrollSlipModal')?.classList.add('hidden');
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
    window._lastPayrollSlip = { slip: s, month, year };
    modal.classList.remove('hidden');
  }

  async function loadSelfAttendance() {
    const box = document.getElementById('payrollSelfBox');
    if (!box) return;
    box.innerHTML = '<p>Loading...</p>';
    const data = await apiGet('/api/payroll/me');
    if (!data.employee) {
      box.innerHTML = '<p class="helper-text">Hajri profile load nahi hui. Dubara login karein ya owner se contact karein.</p>';
      return;
    }
    const att = await apiGet('/api/payroll/attendance');
    const cur = att.attendance?.status || '';
    const btns = STATUS_OPTS.map((o) =>
      `<button type="button" class="theme-btn payroll-self-mark ${cur === o.v ? 'active' : ''}" data-status="${o.v}">${o.l}</button>`
    ).join(' ');
    box.innerHTML = `
      <p><strong>${esc(data.employee.name)}</strong> (${esc(data.employee.designation)}) — Aaj ki hajri</p>
      <p class="helper-text">Date: ${att.date || 'today'} | Tap karke mark karein</p>
      <div class="btn-row" style="flex-wrap:wrap;gap:8px;margin:12px 0;">${btns}</div>
      <p class="helper-text">Aaj ki status: <strong>${cur ? cur.replace('_', ' ') : 'Abhi mark nahi hui'}</strong></p>
      <div class="btn-row" style="gap:8px;flex-wrap:wrap;">
        <button type="button" id="payrollViewMySlipBtn" class="secondary">📄 Meri Salary Slip</button>
      </div>`;
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
        if (sub === 'payrollEmpSub') {
          loadEmployees();
          populateStaffLinkSelect(true);
        }
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
      populateStaffLinkSelect(true);
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
        document.getElementById('payrollLinkUser').value = '';
        loadEmployees();
        populateStaffLinkSelect(true);
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

    document.getElementById('payrollSlipCloseBtn')?.addEventListener('click', closePayrollSlipModal);
    document.getElementById('payrollSlipPrintBtn')?.addEventListener('click', () => window.print());
    document.getElementById('payrollSlipModal')?.addEventListener('click', (e) => {
      if (e.target?.id === 'payrollSlipModal') closePayrollSlipModal();
    });
    document.getElementById('payrollSlipWhatsAppBtn')?.addEventListener('click', shareSlipWhatsApp);

    document.querySelectorAll('.tab-btn[data-tab="payrollPanel"]').forEach((btn) => {
      btn.addEventListener('click', loadPayrollPanel);
    });
  });

  window.BolKarigarPayroll = { loadPayrollPanel, setPayrollViewMode, shareSlipWhatsApp, closePayrollSlipModal };
})();
