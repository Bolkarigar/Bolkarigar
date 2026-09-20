/**
 * BolKarigar Payroll UI — Employee Hajri & Monthly Salary (Business ₹299)
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
  const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function getEmployeeWeeklyOffs(employee) {
    if (Array.isArray(employee?.weeklyOffs) && employee.weeklyOffs.length) {
      return [...new Set(employee.weeklyOffs.map(Number).filter((n) => n >= 0 && n <= 6))].sort((a, b) => a - b);
    }
    const legacy = employee?.weeklyOff;
    if (Number.isFinite(Number(legacy)) && legacy >= 0 && legacy <= 6) return [Number(legacy)];
    return [];
  }

  function formatWeeklyOffCell(employee) {
    const offs = getEmployeeWeeklyOffs(employee);
    if (!offs.length) return '—';
    return offs.map((d) => WEEKDAY_SHORT[d]).join(', ');
  }

  function getSelectedWeeklyOffs() {
    return [...document.querySelectorAll('#payrollEmpWeeklyOffs input[type="checkbox"]:checked')]
      .map((cb) => Number(cb.value))
      .filter((n) => n >= 0 && n <= 6)
      .sort((a, b) => a - b);
  }

  function setWeeklyOffCheckboxes(offs) {
    const selected = new Set((offs || []).map(Number));
    document.querySelectorAll('#payrollEmpWeeklyOffs input[type="checkbox"]').forEach((cb) => {
      cb.checked = selected.has(Number(cb.value));
    });
  }

  function resetEmployeeForm() {
    document.getElementById('payrollEmpEditId').value = '';
    document.getElementById('payrollEmpName').value = '';
    document.getElementById('payrollEmpPhone').value = '';
    document.getElementById('payrollEmpDesignation').value = '';
    document.getElementById('payrollEmpSalary').value = '';
    document.getElementById('payrollLinkUser').value = '';
    setWeeklyOffCheckboxes([]);
    const addBtn = document.getElementById('payrollAddEmpBtn');
    const cancelBtn = document.getElementById('payrollCancelEmpBtn');
    if (addBtn) addBtn.textContent = '➕ Add Employee';
    if (cancelBtn) cancelBtn.classList.add('hidden');
  }

  function startEditEmployee(employee) {
    document.getElementById('payrollEmpEditId').value = employee._id;
    document.getElementById('payrollEmpName').value = employee.name || '';
    document.getElementById('payrollEmpPhone').value = employee.phone || '';
    document.getElementById('payrollEmpDesignation').value = employee.designation || '';
    document.getElementById('payrollEmpSalary').value = employee.monthlySalary ?? '';
    setWeeklyOffCheckboxes(getEmployeeWeeklyOffs(employee));
    const addBtn = document.getElementById('payrollAddEmpBtn');
    const cancelBtn = document.getElementById('payrollCancelEmpBtn');
    if (addBtn) addBtn.textContent = '💾 Update Employee';
    if (cancelBtn) cancelBtn.classList.remove('hidden');
    populateStaffLinkSelect(true).then(() => {
      const sel = document.getElementById('payrollLinkUser');
      if (sel && employee.linkedUserId) sel.value = String(employee.linkedUserId);
    });
    document.getElementById('payrollEmpName')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

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
          ? 'Payroll API not found — restart the server (npm start).'
          : `Server returned an invalid response (${r.status}). Refresh the page or log in again.`
      };
    }
  }

  async function apiGet(path) {
    try {
      const r = await fetch(`${API()}${path}`, { headers: headers() });
      return await parseApiResponse(r);
    } catch (e) {
      return { success: false, error: e.message || 'Network error — check the server.' };
    }
  }
  async function apiPost(path, body) {
    try {
      const r = await fetch(`${API()}${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body || {}) });
      return await parseApiResponse(r);
    } catch (e) {
      return { success: false, error: e.message || 'Network error — check the server.' };
    }
  }
  async function apiPut(path, body) {
    try {
      const r = await fetch(`${API()}${path}`, { method: 'PUT', headers: headers(), body: JSON.stringify(body || {}) });
      return await parseApiResponse(r);
    } catch (e) {
      return { success: false, error: e.message || 'Network error — check the server.' };
    }
  }
  async function apiDelete(path) {
    try {
      const r = await fetch(`${API()}${path}`, { method: 'DELETE', headers: headers() });
      return await parseApiResponse(r);
    } catch (e) {
      return { success: false, error: e.message || 'Network error — check the server.' };
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
    if (!m.subscription?.isActive) return false;
    return ['cashier', 'manager', 'staff'].includes(m.role || '') || !!m.payroll?.canMarkHajri;
  }

  function updatePayrollNavLabel() {
    const tab = document.querySelector('.tab-btn[data-tab="payrollPanel"]');
    const header = document.querySelector('#payrollPanel .panel-header h3');
    if (tab) {
      tab.textContent = isSelfView() ? '📅 My Attendance' : '💼 Staff Payroll';
    }
    if (header) {
      header.textContent = isSelfView() ? '📅 My Attendance' : '💼 Staff Payroll & Attendance';
    }
  }

  function buildSlipWhatsAppText(slip, month, year, company) {
    const s = slip;
    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const co = company?.name || 'Business';
    return [
      `*${co} — Salary Slip*`,
      `Month: ${monthNames[month] || month} ${year}`,
      `Name: ${s.employee.name}`,
      `Emp ID: ${s.employee.empCode || '—'}`,
      `Designation: ${s.employee.designation}`,
      `Working Days: ${s.workingDays} | Earned: ${s.earnedDays} | LOP: ${s.lopDays ?? 0}`,
      `Basic Salary: ₹${Number(s.employee.monthlySalary).toFixed(2)}`,
      `Gross Earned: ₹${s.grossSalary.toFixed(2)}`,
      `Advance: ₹${s.totalAdvances.toFixed(2)}`,
      `*Net Pay: ₹${s.netPayable.toFixed(2)}*`,
      '— BolKarigar App'
    ].join('\n');
  }

  function fmtMoney(n) {
    return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function fmtDate(d) {
    if (!d) return '—';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function numberToWordsINR(amount) {
    const n = Math.floor(Math.abs(Number(amount) || 0));
    if (!n) return 'Rupees Zero Only';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    function two(num) {
      if (num < 20) return ones[num];
      return `${tens[Math.floor(num / 10)]}${num % 10 ? ` ${ones[num % 10]}` : ''}`.trim();
    }
    function three(num) {
      if (num < 100) return two(num);
      return `${ones[Math.floor(num / 100)]} Hundred${num % 100 ? ` ${two(num % 100)}` : ''}`.trim();
    }
    function section(num, label) {
      if (!num) return '';
      return `${three(num)} ${label}`.trim();
    }
    const crore = Math.floor(n / 10000000);
    const lakh = Math.floor((n % 10000000) / 100000);
    const thousand = Math.floor((n % 100000) / 1000);
    const hundred = n % 1000;
    const parts = [
      section(crore, 'Crore'),
      section(lakh, 'Lakh'),
      section(thousand, 'Thousand'),
      section(hundred, '')
    ].filter(Boolean);
    return `Rupees ${parts.join(' ')} Only`;
  }

  function getLocalCompanyProfile() {
    try {
      return JSON.parse(localStorage.getItem('bolkarigar_company_profile')) || {};
    } catch {
      return {};
    }
  }

  function resolveCompanyProfile(apiCompany) {
    const local = getLocalCompanyProfile();
    return {
      name: apiCompany?.name || local.name || 'Business',
      address: apiCompany?.address || local.address || '',
      phone: apiCompany?.phone || local.phone || '',
      gstin: apiCompany?.gstin || local.gstin || ''
    };
  }

  function renderOfficialSlipHTML(s, month, year, company) {
    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const co = resolveCompanyProfile(company);
    const lopDays = s.lopDays ?? Math.max(0, Math.round((s.workingDays - s.earnedDays) * 100) / 100);
    const lopDeduction = s.lopDeduction ?? Math.round(lopDays * s.perDayRate * 100) / 100;
    const totalDeductions = Math.round((lopDeduction + s.totalAdvances) * 100) / 100;
    const rows = (s.dailyRows || []).filter((d) => d.status !== 'weekly_off').map((d) =>
      `<tr><td>${esc(d.date)}</td><td>${esc(d.weekday)}</td><td>${esc(String(d.status).replace(/_/g, ' '))}</td><td style="text-align:right;">${d.earned}</td></tr>`
    ).join('');

    return `
      <div class="payroll-slip-doc" id="payrollSlipPrintArea">
        <div class="payroll-slip-header">
          <h2 class="payroll-slip-co-name">${esc(co.name)}</h2>
          ${co.address ? `<p class="payroll-slip-co-addr">${esc(co.address)}</p>` : ''}
          ${co.gstin ? `<p class="payroll-slip-co-meta">GSTIN: ${esc(co.gstin)}${co.phone ? ` &nbsp;|&nbsp; Phone: ${esc(co.phone)}` : ''}</p>` : (co.phone ? `<p class="payroll-slip-co-meta">Phone: ${esc(co.phone)}</p>` : '')}
          <p class="payroll-slip-title"><strong>Payslip for the month of ${monthNames[month] || month} / ${year}</strong></p>
        </div>

        <table class="payroll-slip-info-table">
          <tbody>
            <tr>
              <td class="lbl">Emp ID</td><td class="val">${esc(s.employee.empCode || '—')}</td>
              <td class="lbl">Employee Name</td><td class="val"><strong>${esc(s.employee.name)}</strong></td>
            </tr>
            <tr>
              <td class="lbl">Phone</td><td class="val">${esc(s.employee.phone || '—')}</td>
              <td class="lbl">Designation</td><td class="val">${esc(s.employee.designation)}</td>
            </tr>
            <tr>
              <td class="lbl">NOD (Working Days)</td><td class="val">${s.workingDays}</td>
              <td class="lbl">NDP (Paid Days)</td><td class="val">${s.earnedDays}</td>
            </tr>
            <tr>
              <td class="lbl">DOJ</td><td class="val">${fmtDate(s.employee.joinDate)}</td>
              <td class="lbl">Weekly Off</td><td class="val">${esc(s.employee.weeklyOffLabel || 'None')}</td>
            </tr>
            <tr>
              <td class="lbl">Monthly Salary</td><td class="val">${fmtMoney(s.employee.monthlySalary)}</td>
              <td class="lbl">LOP Days</td><td class="val">${lopDays}</td>
            </tr>
            <tr>
              <td class="lbl">Present</td><td class="val">${s.presentDays}</td>
              <td class="lbl">Half Day / Leave</td><td class="val">${s.halfDays} / ${s.paidLeaves + s.unpaidLeaves}</td>
            </tr>
          </tbody>
        </table>

        <table class="payroll-slip-ledger-table">
          <thead>
            <tr>
              <th colspan="2">Earnings</th>
              <th colspan="2">Deductions</th>
            </tr>
            <tr>
              <th>Particulars</th><th style="text-align:right;">Amount (₹)</th>
              <th>Particulars</th><th style="text-align:right;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Basic Salary</td><td class="amt">${fmtMoney(s.employee.monthlySalary)}</td>
              <td>Loss of Pay (LOP)</td><td class="amt">${fmtMoney(lopDeduction)}</td>
            </tr>
            <tr>
              <td>&nbsp;</td><td class="amt"></td>
              <td>Advance Recovery</td><td class="amt">${fmtMoney(s.totalAdvances)}</td>
            </tr>
            <tr class="payroll-slip-total-row">
              <td><strong>Total Earnings</strong></td><td class="amt"><strong>${fmtMoney(s.employee.monthlySalary)}</strong></td>
              <td><strong>Total Deductions</strong></td><td class="amt"><strong>${fmtMoney(totalDeductions)}</strong></td>
            </tr>
          </tbody>
        </table>

        <div class="payroll-slip-net-block">
          <div class="payroll-slip-net-line">
            <span><strong>Net Pay:</strong></span>
            <span class="payroll-slip-net-amt"><strong>${fmtMoney(s.netPayable)}</strong></span>
          </div>
          <p class="payroll-slip-words"><em>In Words:</em> ${esc(numberToWordsINR(s.netPayable))}</p>
        </div>

        <div class="payroll-slip-footer">
          <p class="payroll-slip-note">Per Day Rate: ${fmtMoney(s.perDayRate)} &nbsp;|&nbsp; Absent: ${s.absentDays} &nbsp;|&nbsp; Unpaid Leave: ${s.unpaidLeaves}</p>
          <div class="payroll-slip-sign-row">
            <span></span>
            <span class="payroll-slip-sign">Authorised Signatory<br><small>${esc(co.name)}</small></span>
          </div>
        </div>

        <details class="payroll-slip-daily payroll-slip-screen-only">
          <summary>Daily Attendance Breakdown (screen only)</summary>
          <table class="payroll-slip-daily-table">
            <thead><tr><th>Date</th><th>Day</th><th>Status</th><th>Earned</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="4">No records</td></tr>'}</tbody>
          </table>
        </details>
      </div>`;
  }

  function printSalarySlip() {
    if (!document.getElementById('payrollSlipPrintArea')) {
      toast('Open the salary slip first', 'error');
      return;
    }
    document.body.classList.add('printing-payroll-slip');
    const cleanup = () => document.body.classList.remove('printing-payroll-slip');
    window.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(() => window.print(), 50);
  }

  function shareSlipWhatsApp() {
    const data = window._lastPayrollSlip;
    if (!data?.slip) return toast('Open the salary slip first', 'error');
    const text = encodeURIComponent(buildSlipWhatsAppText(data.slip, data.month, data.year, data.company));
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
    document.querySelectorAll('.payroll-owner-intro').forEach((el) => {
      el.style.display = selfOnly ? 'none' : '';
    });
    const noAccess = document.getElementById('payrollNoAccess');
    if (noAccess) {
      const show = !manager && !selfOnly;
      noAccess.classList.toggle('hidden', !show);
    }
  }

  function selfSlipMonthYear() {
    const month = Number(document.getElementById('payrollSelfMonth')?.value) || new Date().getMonth() + 1;
    const year = Number(document.getElementById('payrollSelfYear')?.value) || new Date().getFullYear();
    return { month, year };
  }

  function monthSelectOptions(selected) {
    const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return names.map((n, i) => {
      const v = i + 1;
      return `<option value="${v}"${v === selected ? ' selected' : ''}>${n}</option>`;
    }).join('');
  }

  function configureSlipModalForViewer(selfMode) {
    const wa = document.getElementById('payrollSlipWhatsAppBtn');
    const printBtn = document.getElementById('payrollSlipPrintBtn');
    if (wa) wa.style.display = selfMode ? 'none' : '';
    if (printBtn) {
      printBtn.textContent = selfMode ? '📥 Download (PDF)' : '🖨️ Print';
      printBtn.style.display = '';
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
        ? 'Cashier can now see the salary module (Manager cannot).'
        : 'Manager can now see the salary module (Cashier cannot).';
    }
  }

  let payrollEmployees = [];

  function paintPayrollEmployees() {
    const body = document.getElementById('payrollEmployeeBody');
    if (!body) return;
    const pag = window.bkPayrollEmpPaginator || (window.bkPayrollEmpPaginator = window.bkCreatePaginator('payrollEmp', paintPayrollEmployees));
    const pageRows = pag.slice(payrollEmployees);
    if (!payrollEmployees.length) {
      body.innerHTML = '<tr><td colspan="6">No employees yet. Add one below.</td></tr>';
      return;
    }
    body.innerHTML = pageRows.map((e) => `
      <tr>
        <td><strong>${esc(e.name)}</strong><br><span class="helper-text">${esc(e.designation)}</span></td>
        <td>${esc(e.phone || '—')}</td>
        <td>₹${Number(e.monthlySalary).toFixed(2)}</td>
        <td>${esc(formatWeeklyOffCell(e))}</td>
        <td>${e.linkedUserId ? '✅ App linked' : '—'}</td>
        <td>
          <div class="payroll-emp-actions">
            <button type="button" class="secondary payroll-edit-emp" data-id="${e._id}">Update</button>
            <button type="button" class="secondary payroll-del-emp" data-id="${e._id}">Remove</button>
          </div>
        </td>
      </tr>
    `).join('');
    body.querySelectorAll('.payroll-edit-emp').forEach((btn) => {
      btn.addEventListener('click', () => {
        const employee = payrollEmployees.find((e) => String(e._id) === btn.dataset.id);
        if (employee) startEditEmployee(employee);
      });
    });
    body.querySelectorAll('.payroll-del-emp').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remove this employee?')) return;
        const res = await apiDelete('/api/payroll/employees/' + btn.dataset.id);
        toast(res.message || res.error || 'Done', res.success ? 'success' : 'error');
        if (String(document.getElementById('payrollEmpEditId')?.value) === btn.dataset.id) resetEmployeeForm();
        loadEmployees();
      });
    });
  }

  async function loadEmployees() {
    const body = document.getElementById('payrollEmployeeBody');
    if (!body) return;
    body.innerHTML = '<tr><td colspan="6">Loading...</td></tr>';
    try {
      const data = await apiGet('/api/payroll/employees');
      if (!data.success) {
        body.innerHTML = `<tr><td colspan="6" style="color:#ef4444">${esc(data.error || 'Could not load employee list')}</td></tr>`;
        return;
      }
    payrollEmployees = data.employees || [];
    if (!payrollEmployees.length) {
      const pag = window.bkPayrollEmpPaginator || (window.bkPayrollEmpPaginator = window.bkCreatePaginator('payrollEmp', paintPayrollEmployees));
      pag.slice([]);
      body.innerHTML = '<tr><td colspan="6">No employees yet. Add one below.</td></tr>';
      populateAdvanceSelect();
      return;
    }
    if (window.bkPayrollEmpPaginator) window.bkPayrollEmpPaginator.reset();
    paintPayrollEmployees();
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
      if (hint) hint.textContent = data.error || 'Could not load staff list. Please try again.';
      return;
    }
    const users = data.users || [];
    const available = users.filter((u) => !u.alreadyLinked);
    const linked = users.filter((u) => u.alreadyLinked);

    let html = '<option value="">— App login link (optional) —</option>';
    if (available.length) {
      html += '<optgroup label="Available to link">';
      html += available.map((u) => `<option value="${u.id}">${esc(u.username)} (${u.role})</option>`).join('');
      html += '</optgroup>';
    }
    if (linked.length) {
      html += '<optgroup label="Already linked (auto)">';
      html += linked.map((u) => {
        const tag = u.linkedEmployeeName ? ` → ${esc(u.linkedEmployeeName)}` : '';
        return `<option value="" disabled>${esc(u.username)} (${u.role}) — linked ✓${tag}</option>`;
      }).join('');
      html += '</optgroup>';
    }
    sel.innerHTML = html;

    if (hint) {
      if (!users.length) {
        hint.textContent = 'Create a staff account first from the Staff tab using an invite code.';
      } else if (!available.length) {
        hint.textContent = `All staff are linked: ${linked.map((u) => u.username).join(', ')}. They already appear in the employee list — no need to link again.`;
      } else if (linked.length) {
        hint.textContent = `Linked: ${linked.map((u) => u.username).join(', ')}. Link new staff below.`;
      } else {
        hint.textContent = 'Optional — link staff app login to an employee.';
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
      body.innerHTML = '<tr><td colspan="4">Add an employee first.</td></tr>';
      return;
    }
    const attDow = new Date(`${date}T12:00:00`).getDay();
    body.innerHTML = data.rows.map((row) => {
      const offs = getEmployeeWeeklyOffs(row.employee);
      const onWeeklyOff = offs.includes(attDow);
      if (onWeeklyOff && !row.attendance?.status) {
        return `<tr data-emp="${row.employee._id}" data-weekly-off="1">
          <td><strong>${esc(row.employee.name)}</strong></td>
          <td>${esc(row.employee.designation)}</td>
          <td colspan="2"><span class="helper-text">Weekly Off (${WEEKDAY_LONG[attDow]})</span></td>
        </tr>`;
      }
      const offHint = onWeeklyOff ? ` <span class="helper-text">(Weekly off — marked)</span>` : '';
      const cur = row.attendance?.status || 'present';
      const opts = STATUS_OPTS.map((o) => `<option value="${o.v}" ${o.v === cur ? 'selected' : ''}>${o.l}</option>`).join('');
      return `<tr data-emp="${row.employee._id}">
        <td><strong>${esc(row.employee.name)}</strong>${offHint}</td>
        <td>${esc(row.employee.designation)}</td>
        <td><select class="payroll-att-status">${opts}</select></td>
        <td><input class="payroll-att-note" type="text" placeholder="Note" value="${esc(row.attendance?.note || '')}" /></td>
      </tr>`;
    }).join('');
  }

  async function saveDailyAttendance() {
    const saveBtn = document.getElementById('payrollSaveAttBtn');
    await window.bkWithSaveLock(saveBtn, async () => {
      const date = document.getElementById('payrollAttDate')?.value;
      const rows = [...document.querySelectorAll('#payrollAttendanceBody tr[data-emp]:not([data-weekly-off="1"])')].map((tr) => ({
        employeeId: tr.dataset.emp,
        status: tr.querySelector('.payroll-att-status')?.value,
        note: tr.querySelector('.payroll-att-note')?.value || ''
      }));
      const res = await apiPost('/api/payroll/attendance', { date, records: rows });
      toast(res.success ? `✅ ${res.saved} attendance save` : (res.error || 'Fail'), res.success ? 'success' : 'error');
      loadDailyAttendance();
      if (document.getElementById('payrollSalSub')?.classList.contains('active')) {
        loadSalarySummary();
      }
    });
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

  async function showSalarySlip(employeeId, opts = {}) {
    const fromSelf = !!opts.fromSelf;
    const { month, year } = fromSelf ? (opts.monthYear || selfSlipMonthYear()) : monthYearInputs();
    const data = await apiGet(`/api/payroll/salary/${employeeId}?month=${month}&year=${year}`);
    if (!data.success) return toast(data.error || 'Error', 'error');
    const s = data.slip;
    const modal = document.getElementById('payrollSlipModal');
    const body = document.getElementById('payrollSlipBody');
    if (!modal || !body) return;
    const m = data.month || month;
    const y = data.year || year;
    body.innerHTML = renderOfficialSlipHTML(s, m, y, data.company);
    if (s.earnedDays === 0 && s.workingDays > 0 && !fromSelf) {
      body.insertAdjacentHTML('beforeend',
        '<p class="payroll-slip-warning payroll-slip-screen-only">⚠️ Earned Days 0 — mark Present/Half-day in Daily Attendance first, then salary will calculate.</p>');
    }
    window._lastPayrollSlip = { slip: s, month: m, year: y, company: data.company };
    configureSlipModalForViewer(fromSelf || (isSelfView() && !isManagerView()));
    modal.classList.remove('hidden');
    if (opts.autoDownload) {
      setTimeout(() => printSalarySlip(), 400);
    }
  }

  async function loadSelfAttendance() {
    const box = document.getElementById('payrollSelfBox');
    if (!box) return;
    box.innerHTML = '<p>Loading...</p>';
    const data = await apiGet('/api/payroll/me');
    if (!data.employee) {
      box.innerHTML = '<p class="helper-text">Could not load attendance profile. Log in again or contact the owner.</p>';
      return;
    }
    const att = await apiGet('/api/payroll/attendance');
    const cur = att.attendance?.status || '';
    const attDate = att.date || new Date().toISOString().slice(0, 10);
    const attDow = new Date(`${attDate}T12:00:00`).getDay();
    const isWeeklyOff = getEmployeeWeeklyOffs(data.employee).includes(attDow);
    const now = new Date();
    const selMonth = now.getMonth() + 1;
    const selYear = now.getFullYear();
    const presentDone = cur === 'present';
    box.innerHTML = `
      <p><strong>${esc(data.employee.name)}</strong> — ${esc(data.employee.designation || 'Staff')}</p>
      <p class="helper-text">Today: ${attDate}${isWeeklyOff ? ` · Weekly off (${WEEKDAY_LONG[attDow]})` : ''}</p>
      ${isWeeklyOff
        ? '<p class="helper-text">Weekly off day — agar aaj kaam par aaye ho toh Present mark karein.</p>'
        : ''}
      <div class="btn-row" style="margin:14px 0;">
        <button type="button" id="payrollSelfPresentBtn" class="theme-btn"${presentDone ? ' disabled' : ''}>${presentDone ? '✅ Present (marked)' : '✅ Mark Present'}</button>
      </div>
      <p class="helper-text">Status: <strong>${cur ? cur.replace(/_/g, ' ') : 'Not marked yet'}</strong></p>
      <hr style="border:none;border-top:1px solid var(--border);margin:16px 0;" />
      <p><strong>📄 Meri Salary Slip</strong></p>
      <p class="helper-text">Month select karke slip dekhein ya PDF download karein.</p>
      <div class="btn-row payroll-self-slip-pick" style="align-items:center;gap:10px;flex-wrap:wrap;margin:10px 0;">
        <select id="payrollSelfMonth">${monthSelectOptions(selMonth)}</select>
        <input id="payrollSelfYear" type="number" min="2020" max="2100" value="${selYear}" style="width:100px;" aria-label="Year" />
      </div>
      <div class="btn-row" style="gap:8px;flex-wrap:wrap;">
        <button type="button" id="payrollViewMySlipBtn" class="theme-btn">👁️ View Slip</button>
        <button type="button" id="payrollDownloadMySlipBtn" class="secondary">📥 Download PDF</button>
      </div>`;
    document.getElementById('payrollSelfPresentBtn')?.addEventListener('click', async () => {
      const res = await apiPost('/api/payroll/attendance/self', { status: 'present' });
      toast(res.message || res.error || 'Saved', res.success ? 'success' : 'error');
      loadSelfAttendance();
    });
    const openMySlip = (autoDownload) => {
      if (!data.employee?._id) return;
      const my = selfSlipMonthYear();
      showSalarySlip(data.employee._id, { fromSelf: true, monthYear: my, autoDownload });
    };
    document.getElementById('payrollViewMySlipBtn')?.addEventListener('click', () => openMySlip(false));
    document.getElementById('payrollDownloadMySlipBtn')?.addEventListener('click', () => openMySlip(true));
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
    const m = me();
    if (!m) return;
    const canFull = !!m.subscription?.fullAccess;
    const canStaffHajri = !!(m.isStaff && m.subscription?.isActive);
    if (!canFull && !canStaffHajri) return;
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
      const editId = document.getElementById('payrollEmpEditId')?.value.trim();
      const name = document.getElementById('payrollEmpName')?.value.trim();
      const phone = document.getElementById('payrollEmpPhone')?.value.trim();
      const designation = document.getElementById('payrollEmpDesignation')?.value.trim();
      const monthlySalary = document.getElementById('payrollEmpSalary')?.value;
      const weeklyOffs = getSelectedWeeklyOffs();
      const linkedUserId = document.getElementById('payrollLinkUser')?.value || null;
      if (!name) return toast('Name is required', 'error');
      const payload = { name, phone, designation, monthlySalary, weeklyOffs, linkedUserId };
      const res = editId
        ? await apiPut('/api/payroll/employees/' + editId, payload)
        : await apiPost('/api/payroll/employees', payload);
      toast(
        res.success ? (editId ? '✅ Employee updated' : '✅ Employee added') : (res.error || 'Failed'),
        res.success ? 'success' : 'error'
      );
      if (res.success) {
        resetEmployeeForm();
        loadEmployees();
        populateStaffLinkSelect(true);
      }
    });

    document.getElementById('payrollCancelEmpBtn')?.addEventListener('click', resetEmployeeForm);

    document.getElementById('payrollSaveAttBtn')?.addEventListener('click', saveDailyAttendance);
    document.getElementById('payrollLoadAttBtn')?.addEventListener('click', loadDailyAttendance);
    document.getElementById('payrollLoadSalaryBtn')?.addEventListener('click', loadSalarySummary);

    document.getElementById('payrollAddAdvanceBtn')?.addEventListener('click', async () => {
      const { month, year } = monthYearInputs();
      const employeeId = document.getElementById('payrollAdvanceEmp')?.value;
      const amount = document.getElementById('payrollAdvanceAmt')?.value;
      const note = document.getElementById('payrollAdvanceNote')?.value;
      if (!employeeId || !amount) return toast('Employee and amount are required', 'error');
      const res = await apiPost('/api/payroll/advances', { employeeId, amount, month, year, note });
      toast(res.success ? '✅ Advance saved' : (res.error || 'Failed'), res.success ? 'success' : 'error');
    });

    document.getElementById('payrollSaveSettingsBtn')?.addEventListener('click', async () => {
      const settingsBtn = document.getElementById('payrollSaveSettingsBtn');
      await window.bkWithSaveLock(settingsBtn, async () => {
        const payrollViewerRole = document.getElementById('payrollViewerRole')?.value;
        const res = await apiPut('/api/payroll/settings', { payrollViewerRole });
        toast(res.message || res.error || 'Saved', res.success ? 'success' : 'error');
        loadPayrollSettings();
      });
    });

    document.getElementById('payrollSlipCloseBtn')?.addEventListener('click', closePayrollSlipModal);
    document.getElementById('payrollSlipPrintBtn')?.addEventListener('click', printSalarySlip);
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
