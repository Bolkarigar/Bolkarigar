/**
 * Accounts Orbit Pro — Frontend for professional features
 */
(function () {
  const API = () => (typeof window.bkGetApiUrl === 'function' ? window.bkGetApiUrl() : (window.API_URL || ''));
  const token = () => localStorage.getItem('bk_token') || localStorage.getItem('token') || '';
  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });

  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.__bkInstallPrompt = e;
  });

  function showToast(msg, type) {
    if (typeof window.showToast === 'function') window.showToast(msg, type);
    else alert(msg);
  }

  async function apiGet(path) {
    const r = await fetch(`${API()}${path}`, { headers: headers() });
    return r.json();
  }
  async function apiPost(path, body) {
    const r = await fetch(`${API()}${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
    return r.json();
  }
  async function apiDelete(path) {
    const r = await fetch(`${API()}${path}`, { method: 'DELETE', headers: headers() });
    return r.json();
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  // ==================== REPORTS PRO ====================
  let reportPagRows = [];
  let reportPagMeta = { title: '', headers: [], rowHtml: null };

  function setReportPaginationVisible(show) {
    const bar = document.getElementById('reportPaginationBar');
    if (bar) bar.classList.toggle('hidden', !show);
  }

  function paintReportTablePage() {
    const out = document.getElementById('reportOutput');
    if (!out || typeof reportPagMeta.rowHtml !== 'function') return;
    const pag = window.bkReportPaginator || (window.bkReportPaginator = window.bkCreatePaginator('reportTable', paintReportTablePage));
    const pageRows = pag.slice(reportPagRows);
    let html = `<h4>${reportPagMeta.title}</h4><table><thead><tr>`;
    reportPagMeta.headers.forEach((h) => { html += `<th>${h}</th>`; });
    html += '</tr></thead><tbody>';
    if (!pageRows.length) html += `<tr><td colspan="${reportPagMeta.headers.length}">No records</td></tr>`;
    else pageRows.forEach((r) => { html += reportPagMeta.rowHtml(r); });
    html += '</tbody></table>';
    out.innerHTML = html;
    setReportPaginationVisible(reportPagRows.length > 0);
  }

  function renderPaginatedReport(title, headers, rows, rowHtmlFn) {
    reportPagMeta = { title, headers, rowHtml: rowHtmlFn };
    reportPagRows = rows || [];
    if (window.bkReportPaginator) window.bkReportPaginator.reset();
    paintReportTablePage();
  }

  async function loadReportsPro() {
    const month = document.getElementById('reportMonth')?.value || new Date().getMonth() + 1;
    const year = document.getElementById('reportYear')?.value || new Date().getFullYear();
    const tab = document.querySelector('.report-tab-btn.active')?.dataset.report || 'pl';
    const out = document.getElementById('reportOutput');
    if (!out) return;
    setReportPaginationVisible(false);
    out.innerHTML = '<p>Loading...</p>';
    try {
      let data, html = '';
      if (tab === 'pl') {
        data = await apiGet('/api/reports/pl');
        html = `<h4>Profit & Loss</h4><p><strong>Total Income:</strong> ₹${(data.totalIncome||0).toFixed(2)} | <strong>Expenses:</strong> ₹${(data.totalExpenses||0).toFixed(2)} | <strong>Net Profit:</strong> <span style="color:${data.netProfit>=0?'#22c55e':'#ef4444'}">₹${(data.netProfit||0).toFixed(2)}</span></p>`;
        html += '<table><thead><tr><th>Income</th><th>Group</th><th>₹</th></tr></thead><tbody>';
        (data.income||[]).forEach(r => { html += `<tr><td>${esc(r.name)}</td><td>${esc(r.group)}</td><td>${r.amount.toFixed(2)}</td></tr>`; });
        html += '</tbody></table><table style="margin-top:12px"><thead><tr><th>Expense</th><th>Group</th><th>₹</th></tr></thead><tbody>';
        (data.expenses||[]).forEach(r => { html += `<tr><td>${esc(r.name)}</td><td>${esc(r.group)}</td><td>${r.amount.toFixed(2)}</td></tr>`; });
        html += '</tbody></table>';
      } else if (tab === 'bs') {
        data = await apiGet('/api/reports/balance-sheet');
        html = `<h4>Balance Sheet</h4><p>Assets: ₹${(data.totalAssets||0).toFixed(2)} | Liabilities: ₹${(data.totalLiabilities||0).toFixed(2)}</p>`;
        html += '<div class="grid-2"><div><h5>Assets</h5><table><tbody>';
        (data.assets||[]).forEach(r => { html += `<tr><td>${esc(r.name)}</td><td>₹${r.amount.toFixed(2)}</td></tr>`; });
        html += '</tbody></table></div><div><h5>Liabilities</h5><table><tbody>';
        (data.liabilities||[]).forEach(r => { html += `<tr><td>${esc(r.name)}</td><td>₹${r.amount.toFixed(2)}</td></tr>`; });
        html += '</tbody></table></div></div>';
      } else if (tab === 'ageing') {
        data = await apiGet('/api/reports/ageing');
        renderPaginatedReport(
          'Bill-wise Outstanding (Ageing)',
          ['Party', 'Amount', 'Days', 'Bucket'],
          data.rows || [],
          (r) => `<tr><td>${esc(r.partyName)}</td><td>₹${r.amount.toFixed(2)}</td><td>${r.days}</td><td>${esc(r.bucket)}</td></tr>`
        );
        return;
      } else if (tab === 'cashflow') {
        data = await apiGet(`/api/reports/cash-flow?month=${month}&year=${year}`);
        html = `<h4>Cash Flow (${data.period})</h4><p>Inflow: ₹${(data.inflow||0).toFixed(2)} | Outflow: ₹${(data.outflow||0).toFixed(2)} | Net: ₹${(data.netCash||0).toFixed(2)}</p>`;
      } else if (tab === 'gstr1') {
        data = await apiGet(`/api/reports/gstr1?month=${month}&year=${year}`);
        html = `<h4>GSTR-1 Export (${data.period})</h4><p class="helper-text">${esc(data.note)}</p><p>B2B: ${(data.b2b||[]).length} | B2CL: ${(data.b2cl||[]).length} | B2CS: ${(data.b2cs||[]).length} | Taxable: ₹${(data.summary?.totalTaxable||0).toFixed(2)}</p>`;
        html += `<button type="button" id="downloadGstr1Btn" class="secondary">📥 Download GSTR-1 JSON</button>`;
        window._lastGstr1 = data;
      } else if (tab === 'gstr3b') {
        data = await apiGet(`/api/reports/gstr3b?month=${month}&year=${year}`);
        html = `<h4>GSTR-3B Summary (${data.period})</h4><p class="helper-text">${esc(data.note)}</p>`;
        html += `<p>Outward Tax: ₹${(data.outwardTax||0).toFixed(2)} | Inward Tax: ₹${(data.inwardTax||0).toFixed(2)} | <strong>Net Payable: ₹${(data.netPayable||0).toFixed(2)}</strong></p>`;
        html += `<button type="button" id="downloadGstr3bBtn" class="secondary">📥 Download GSTR-3B JSON</button>`;
        window._lastGstr3b = data;
      }
      out.innerHTML = html;
      document.getElementById('downloadGstr1Btn')?.addEventListener('click', () => downloadJson(window._lastGstr1, 'gstr1-export.json'));
      document.getElementById('downloadGstr3bBtn')?.addEventListener('click', () => downloadJson(window._lastGstr3b, 'gstr3b-export.json'));
    } catch (e) { out.innerHTML = `<p style="color:#ef4444">Error: ${esc(e.message)}</p>`; }
  }

  function downloadJson(obj, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
    a.download = filename;
    a.click();
    showToast('✅ File downloaded.');
  }

  // ==================== STAFF ====================
  let staffListRows = [];

  function paintStaffPage() {
    const body = document.getElementById('staffListBody');
    if (!body) return;
    const pag = window.bkStaffPaginator || (window.bkStaffPaginator = window.bkCreatePaginator('staffList', paintStaffPage));
    const pageRows = pag.slice(staffListRows);
    if (!staffListRows.length) {
      body.innerHTML = '<tr><td colspan="4">No staff yet — add using an invite code.</td></tr>';
      return;
    }
    body.innerHTML = pageRows.map(s =>
      `<tr><td>${esc(s.username)}</td><td>${esc(s.email)}</td><td>${esc(s.role)}</td><td><button type="button" class="del-staff-btn" data-id="${s._id}">Remove</button></td></tr>`
    ).join('');
    body.querySelectorAll('.del-staff-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await apiDelete('/api/staff/' + btn.dataset.id);
        loadStaff();
      });
    });
  }

  async function loadStaff() {
    const body = document.getElementById('staffListBody');
    const codeEl = document.getElementById('staffInviteCode');
    const roleEl = document.getElementById('staffInviteRoleLabel');
    if (!body) return;
    try {
      const data = await apiGet('/api/staff/list');
      if (codeEl) codeEl.textContent = data.inviteCode || 'Generate';
      if (roleEl) roleEl.textContent = data.inviteRole ? `(${data.inviteRole})` : '';
      const slotsEl = document.getElementById('staffSlotsLabel');
      if (slotsEl && data.staffSlots != null) {
        const used = data.staffCount ?? (data.staff || []).length;
        const max = data.staffSlots;
        const packs = data.staffSlotPacks || 0;
        const base = data.staffSlotsBase ?? 25;
        let line = max
          ? `Staff used: ${used} / ${max} (${base} included${packs ? ` + ${packs} paid pack${packs > 1 ? 's' : ''}` : ''})`
          : 'Staff invite — Business plan (₹299) required.';
        if (max && data.staffSlotsRemaining === 0) {
          line += ' — limit full. Buy +25 staff (₹49) or remove someone.';
        }
        slotsEl.textContent = line;
      }
      const buyBtn = document.getElementById('staffBuyPackBtn');
      if (buyBtn) buyBtn.style.display = (data.staffSlots > 0) ? '' : 'none';
      staffListRows = data.staff || [];
      if (!staffListRows.length) {
        const pag = window.bkStaffPaginator || (window.bkStaffPaginator = window.bkCreatePaginator('staffList', paintStaffPage));
        pag.slice([]);
        body.innerHTML = '<tr><td colspan="4">No staff yet — add using an invite code.</td></tr>';
        return;
      }
      if (window.bkStaffPaginator) window.bkStaffPaginator.reset();
      paintStaffPage();
    } catch (e) { body.innerHTML = `<tr><td colspan="4">${esc(e.message)}</td></tr>`; }
  }
  window.loadStaff = loadStaff;

  // ==================== CONTRACTOR ====================
  async function loadLabour() {
    const body = document.getElementById('labourBody');
    if (!body) return;
    const data = await apiGet('/api/labour');
    body.innerHTML = (data.records||[]).map(r =>
      `<tr><td>${new Date(r.date).toLocaleDateString()}</td><td>${esc(r.workerName)}</td><td>${esc(r.projectName)}</td><td>${esc(r.status)}</td><td>₹${(r.wage||0).toFixed(0)}</td><td><button class="del-labour-btn" data-id="${r._id}">Del</button></td></tr>`
    ).join('') || '<tr><td colspan="6">No records</td></tr>';
    body.querySelectorAll('.del-labour-btn').forEach(b => b.addEventListener('click', async () => { await apiDelete('/api/labour/' + b.dataset.id); loadLabour(); }));
  }

  async function loadRABills() {
    const body = document.getElementById('raBillBody');
    if (!body) return;
    const data = await apiGet('/api/ra-bill');
    body.innerHTML = (data.records||[]).map(r =>
      `<tr><td>${esc(r.billNo)}</td><td>${esc(r.projectName)}</td><td>${esc(r.clientName)}</td><td>₹${r.amount.toFixed(2)}</td><td>${esc(r.status)}</td><td><button class="del-ra-btn" data-id="${r._id}">Del</button></td></tr>`
    ).join('') || '<tr><td colspan="6">No RA Bills</td></tr>';
    body.querySelectorAll('.del-ra-btn').forEach(b => b.addEventListener('click', async () => { await apiDelete('/api/ra-bill/' + b.dataset.id); loadRABills(); }));
  }

  async function loadMaterialSlips() {
    const body = document.getElementById('materialSlipBody');
    if (!body) return;
    const data = await apiGet('/api/material-slip');
    body.innerHTML = (data.records||[]).map(r =>
      `<tr><td>${esc(r.slipNo)}</td><td>${esc(r.projectName)}</td><td>${esc(r.itemName)}</td><td>${r.qty} ${esc(r.unit)}</td><td>${esc(r.issuedTo)}</td><td><button class="del-ms-btn" data-id="${r._id}">Del</button></td></tr>`
    ).join('') || '<tr><td colspan="6">No slips</td></tr>';
    body.querySelectorAll('.del-ms-btn').forEach(b => b.addEventListener('click', async () => { await apiDelete('/api/material-slip/' + b.dataset.id); loadMaterialSlips(); }));
  }

  // ==================== BANK RECON ====================
  function formatBankMoney(n) {
    const x = Number(n);
    if (!Number.isFinite(x) || x <= 0 || x > 50000000000) return '-';
    return '₹' + x.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function loadBankRecon() {
    const body = document.getElementById('bankReconBody');
    if (!body) return;
    const data = await apiGet('/api/bank-recon');
    body.innerHTML = (data.records||[]).map(r => {
      const dt = r.statementDate || r.date;
      const d = dt ? new Date(dt) : null;
      const y = d && !Number.isNaN(d.getTime()) ? d.getFullYear() : 0;
      const dateStr = d && y >= 1990 && y <= 2100 ? d.toLocaleDateString('en-IN') : '—';
      const matchCell = r.matched
        ? `✅ <span class="helper-text">${esc(r.matchHint || 'Matched in app')}</span>`
        : '❌ Pending';
      return `<tr><td>${dateStr}</td><td>${esc(r.description)}</td><td>${formatBankMoney(r.debit)}</td><td>${formatBankMoney(r.credit)}</td><td>${matchCell}</td></tr>`;
    }).join('') || '<tr><td colspan="5">No bank entries — upload a statement.</td></tr>';
  }

  async function clearBankReconEntries() {
    if (!confirm('Delete all bank statement entries? This cannot be undone.')) return;
    const res = await apiDelete('/api/bank-recon/all');
    if (res.error) {
      showToast('❌ ' + res.error, 'error');
      return;
    }
    loadBankRecon();
    showToast('✅ Bank entries cleared — upload the correct CSV again.');
  }

  // ==================== COMPANIES ====================
  function coAddr(c) {
    return (c.fullAddress || c.address || '').trim();
  }
  function coShort(s, n) {
    const t = String(s || '');
    return t.length <= n ? esc(t) : esc(t.slice(0, n - 1)) + '…';
  }
  function refreshProfileAfterCompanyChange() {
    if (typeof window.loadCompanyProfile === 'function') window.loadCompanyProfile();
  }

  async function loadCompanies() {
    const body = document.getElementById('companiesBody');
    if (!body) return;
    const data = await apiGet('/api/companies');
    const addBtn = document.getElementById('addCompanyBtn');
    const count = data.count ?? (data.companies || []).length;
    const limit = data.limit ?? 0;
    if (addBtn) {
      addBtn.disabled = limit > 0 ? count >= limit : true;
      addBtn.title = count >= limit && limit ? 'Plan limit reached — upgrade or delete a company.' : '';
    }
    body.innerHTML = (data.companies || []).map(c => {
      const activeBtn = c.isActive
        ? '<button type="button" class="activate-co-btn co-active-btn" disabled>Active Company</button>'
        : `<button type="button" class="activate-co-btn">Set Active</button>`;
      return `<tr data-id="${c._id}">
        <td>${esc(c.companyName)}</td>
        <td>${esc(c.phone || '—')}</td>
        <td>${esc(c.gstin || '—')}</td>
        <td>${esc(c.upiId || '—')}</td>
        <td>${esc(c.statePincode || '—')}</td>
        <td title="${esc(coAddr(c))}">${coShort(coAddr(c), 28)}</td>
        <td>${c.isActive ? '✅ Active' : '—'}</td>
        <td class="co-actions-cell">${activeBtn} <button type="button" class="delete-co-btn">Delete</button></td>
      </tr>`;
    }).join('') || '<tr><td colspan="8">Add a company — same fields as Business Profile.</td></tr>';

    body.querySelectorAll('tr[data-id]').forEach(row => {
      const id = row.getAttribute('data-id');
      const name = row.querySelector('td')?.textContent || 'company';
      row.querySelector('.activate-co-btn:not(.co-active-btn)')?.addEventListener('click', async () => {
        const res = await apiPost('/api/companies/' + id + '/activate', {});
        if (res.success) {
          showToast('✅ Active company — Business Profile updated.');
          loadCompanies();
          refreshProfileAfterCompanyChange();
        } else showToast('❌ ' + (res.error || 'Switch fail'), 'error');
      });
      row.querySelector('.delete-co-btn')?.addEventListener('click', async () => {
        if (!confirm('Delete company "' + name + '"?')) return;
        const del = await apiDelete('/api/companies/' + id);
        if (del.success) {
          showToast('✅ Company removed.');
          loadCompanies();
          refreshProfileAfterCompanyChange();
        } else showToast('❌ ' + (del.error || 'Delete fail'), 'error');
      });
    });
  }

  // ==================== UDHAR PAYMENT ====================
  window.openUdharPayment = function (customerName) {
    const modal = document.getElementById('udharPaymentModal');
    if (!modal) return;
    document.getElementById('payCustomerName').value = customerName || '';
    modal.classList.remove('hidden');
  };

  async function saveUdharPayment() {
    const customerName = document.getElementById('payCustomerName')?.value.trim();
    const amount = parseFloat(document.getElementById('payAmount')?.value);
    const paymentMode = document.getElementById('payMode')?.value || 'Cash';
    const note = document.getElementById('payNote')?.value || '';
    if (!customerName || !amount) { showToast('Please enter customer and amount.', 'error'); return; }
    const saveBtn = document.getElementById('savePaymentBtn');
    await window.bkWithSaveLock(saveBtn, async () => {
      const data = await apiPost('/api/payments', { customerName, amount, paymentMode, note });
      if (data.success) {
        showToast('✅ Payment recorded and receipt voucher created.');
        document.getElementById('udharPaymentModal')?.classList.add('hidden');
        if (typeof window.refreshUdharKhata === 'function') window.refreshUdharKhata();
        if (typeof window.calculateFinancials === 'function') window.calculateFinancials(window.state?.invoices || [], window.state?.expenses || []);
      } else showToast('❌ ' + (data.error || 'Fail'), 'error');
    });
  }

  // ==================== TALLY IMPORT ====================
  async function importFromTally() {
    showToast('Importing ledgers from Tally...');
    const data = await apiPost('/api/tally/import-ledgers', {});
    if (data.success) showToast(`✅ ${data.imported} ledgers imported, ${data.skipped} already existed.`);
    else showToast('❌ ' + (data.error || 'Import fail'), 'error');
    if (typeof window.refreshKhataPro === 'function') window.refreshKhataPro();
  }

  // ==================== LEDGER GROUPS DROPDOWN ====================
  async function populateLedgerGroups() {
    const sel = document.getElementById('ledgerGroupInput');
    if (!sel || sel.dataset.proLoaded) return;
    try {
      const data = await apiGet('/api/ledger-groups');
      if (data.groups) {
        sel.innerHTML = data.groups.map(g => `<option>${esc(g)}</option>`).join('');
        sel.dataset.proLoaded = '1';
      }
    } catch (e) { /* keep defaults */ }
  }

  // ==================== INIT ====================
  function initProPanel(tab) {
    if (tab === 'reportsProPanel') loadReportsPro();
    if (tab === 'staffPanel') loadStaff();
    if (tab === 'contractorPanel') { loadLabour(); loadRABills(); loadMaterialSlips(); }
    if (tab === 'bankReconPanel') loadBankRecon();
    if (tab === 'companiesPanel') loadCompanies();
    if (tab === 'khataLedgersPanel') populateLedgerGroups();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const rm = document.getElementById('reportMonth');
    if (rm) rm.value = String(new Date().getMonth() + 1);
    // Report tabs
    document.querySelectorAll('.report-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.report-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadReportsPro();
      });
    });
    document.getElementById('loadReportBtn')?.addEventListener('click', loadReportsPro);
    document.getElementById('importTallyBtn')?.addEventListener('click', importFromTally);

    // Staff
    document.getElementById('generateInviteBtn')?.addEventListener('click', async () => {
      const role = document.getElementById('inviteRoleSelect')?.value || 'cashier';
      const data = await apiPost('/api/staff/invite', { role });
      if (data.inviteCode) {
        showToast(`Invite (${data.inviteRole || role}): ` + data.inviteCode);
        loadStaff();
      } else showToast('❌ ' + (data.error || 'Fail'), 'error');
    });

    document.getElementById('staffBuyPackBtn')?.addEventListener('click', async () => {
      const qty = parseInt(document.getElementById('staffPackQty')?.value, 10) || 1;
      if (typeof window.bkPayStaffSlotPack === 'function') {
        await window.bkPayStaffSlotPack(qty);
        loadStaff();
      } else {
        showToast('Payment module loading — refresh the page.', 'error');
      }
    });

    // Labour
    document.getElementById('addLabourBtn')?.addEventListener('click', async () => {
      const workerName = document.getElementById('labourNameInput')?.value.trim();
      const projectName = document.getElementById('labourProjectInput')?.value.trim();
      const status = document.getElementById('labourStatusInput')?.value;
      const wage = parseFloat(document.getElementById('labourWageInput')?.value) || 0;
      if (!workerName) return;
      await apiPost('/api/labour', { workerName, projectName, status, wage });
      document.getElementById('labourNameInput').value = '';
      loadLabour();
      showToast('✅ Attendance saved.');
    });

    // RA Bill
    document.getElementById('addRABillBtn')?.addEventListener('click', async () => {
      const projectName = document.getElementById('raProjectInput')?.value.trim();
      const clientName = document.getElementById('raClientInput')?.value.trim();
      const workDescription = document.getElementById('raWorkInput')?.value.trim();
      const amount = parseFloat(document.getElementById('raAmountInput')?.value);
      if (!projectName || !amount) return;
      await apiPost('/api/ra-bill', { projectName, clientName, workDescription, amount });
      loadRABills();
      showToast('✅ RA Bill saved.');
    });

    // Material Slip
    document.getElementById('addMaterialSlipBtn')?.addEventListener('click', async () => {
      const projectName = document.getElementById('msProjectInput')?.value.trim();
      const itemName = document.getElementById('msItemInput')?.value.trim();
      const qty = parseFloat(document.getElementById('msQtyInput')?.value);
      const issuedTo = document.getElementById('msIssuedToInput')?.value.trim();
      if (!projectName || !itemName || !qty) return;
      await apiPost('/api/material-slip', { projectName, itemName, qty, issuedTo });
      loadMaterialSlips();
      showToast('✅ Material slip saved.');
    });

    // Bank Recon
    const bankDateInput = document.getElementById('bankDateInput');
    if (bankDateInput && !bankDateInput.value) {
      bankDateInput.value = new Date().toISOString().slice(0, 10);
    }
    document.getElementById('clearBankReconBtn')?.addEventListener('click', () => clearBankReconEntries());
    document.getElementById('addBankEntryBtn')?.addEventListener('click', async () => {
      const description = document.getElementById('bankDescInput')?.value.trim();
      const debit = parseFloat(document.getElementById('bankDebitInput')?.value) || 0;
      const credit = parseFloat(document.getElementById('bankCreditInput')?.value) || 0;
      const statementDate = document.getElementById('bankDateInput')?.value || '';
      if (!description) return;
      if (!debit && !credit) {
        showToast('Debit ya Credit amount likhein.', 'error');
        return;
      }
      const res = await apiPost('/api/bank-recon', { description, debit, credit, statementDate });
      if (res.error) {
        showToast('❌ ' + res.error, 'error');
        return;
      }
      loadBankRecon();
      showToast('✅ Bank entry added.');
    });

    // Company
    document.getElementById('addCompanyBtn')?.addEventListener('click', async () => {
      const companyName = document.getElementById('coNameInput')?.value.trim();
      const gstin = document.getElementById('coGstinInput')?.value.trim();
      const phone = document.getElementById('coPhoneInput')?.value.trim();
      const upiId = document.getElementById('coUpiInput')?.value.trim();
      const statePincode = document.getElementById('coStateInput')?.value.trim();
      const fullAddress = document.getElementById('coAddressInput')?.value.trim();
      if (!companyName) { showToast('Company name required.', 'error'); return; }
      if (!gstin) { showToast('GSTIN required.', 'error'); return; }
      if (!fullAddress) { showToast('Full address required.', 'error'); return; }
      const res = await apiPost('/api/companies', { companyName, gstin, phone, upiId, statePincode, fullAddress });
      if (res.success) {
        ['coNameInput', 'coGstinInput', 'coPhoneInput', 'coUpiInput', 'coStateInput', 'coAddressInput'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = '';
        });
        loadCompanies();
        showToast('✅ Company added.');
      } else showToast('❌ ' + (res.error || 'Add fail'), 'error');
    });

    // Udhar payment
    document.getElementById('savePaymentBtn')?.addEventListener('click', saveUdharPayment);
    document.getElementById('closePaymentModal')?.addEventListener('click', () => {
      document.getElementById('udharPaymentModal')?.classList.add('hidden');
    });

    // Hook tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => initProPanel(btn.dataset.tab));
    });

    // Contractor sub-tabs
    document.querySelectorAll('.contractor-subtab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.contractor-subtab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.contractor-subpanel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.sub)?.classList.add('active');
      });
    });

    populateLedgerGroups();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js?v=7').then((reg) => {
        reg.update().catch(() => {});
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }).catch(() => {});
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (sessionStorage.getItem('bk_sw_reload') === '1') return;
        sessionStorage.setItem('bk_sw_reload', '1');
        window.location.reload();
      });
    }
    document.getElementById('installAppBtn')?.addEventListener('click', () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
      if (isStandalone) {
        showToast('App already installed.');
        return;
      }
      const prompt = deferredPrompt || window.__bkInstallPrompt;
      if (prompt) {
        prompt.prompt();
        prompt.userChoice.then(() => {
          deferredPrompt = null;
          window.__bkInstallPrompt = null;
        });
        return;
      }
      const ua = navigator.userAgent || '';
      const isIOS = /iphone|ipad|ipod/i.test(ua);
      const isAndroid = /android/i.test(ua);
      if (isIOS) {
        alert('Safari: Share button → "Add to Home Screen"');
      } else if (isAndroid) {
        alert('Browser menu → "Install app" or "Add to Home screen"');
      } else {
        alert('Install on laptop/desktop:\n\nChrome / Edge: Click the ⊕ or "Install" icon in the address bar\n\nOr menu (⋮) → "Install Accounts Orbit" / "Apps" → "Install this site as an app"');
      }
    });
  });

  // Expose for udhar table
  window.BolKarigarPro = { loadReportsPro, importFromTally, openUdharPayment, loadBankRecon, clearBankReconEntries, loadCompanies };
})();
