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
    if (!m.subscription?.isActive) return false;
    return ['cashier', 'manager', 'staff'].includes(m.role || '') || !!m.payroll?.canMarkHajri;
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
              <td class="lbl">Weekly Off</td><td class="val">${esc(s.employee.weeklyOffLabel || 'Sunday')}</td>
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
      toast('Pehle salary slip kholein', 'error');
      return;
    }
    document.body.classList.add('printing-payroll-slip');
    const cleanup = () => document.body.classList.remove('printing-payroll-slip');
    window.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(() => window.print(), 50);
  }

  function shareSlipWhatsApp() {
    const data = window._lastPayrollSlip;
    if (!data?.slip) return toast('Pehle salary slip kholein', 'error');
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
    const m = data.month || month;
    const y = data.year || year;
    body.innerHTML = renderOfficialSlipHTML(s, m, y, data.company);
    if (s.earnedDays === 0 && s.workingDays > 0) {
      body.insertAdjacentHTML('beforeend',
        '<p class="payroll-slip-warning payroll-slip-screen-only">⚠️ Earned Days 0 — pehle Daily Attendance me Present/Half-day mark karein, tab salary calculate hogi.</p>');
    }
    window._lastPayrollSlip = { slip: s, month: m, year: y, company: data.company };
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
