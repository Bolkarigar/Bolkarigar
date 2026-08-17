/**
 * BolKarigar Pro — Frontend for professional features
 */
(function () {
  const API = () => window.API_URL || '';
  const token = () => localStorage.getItem('bk_token') || localStorage.getItem('token') || '';
  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });

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
  async function loadReportsPro() {
    const month = document.getElementById('reportMonth')?.value || new Date().getMonth() + 1;
    const year = document.getElementById('reportYear')?.value || new Date().getFullYear();
    const tab = document.querySelector('.report-tab-btn.active')?.dataset.report || 'pl';
    const out = document.getElementById('reportOutput');
    if (!out) return;
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
        html = '<h4>Bill-wise Outstanding (Ageing)</h4><table><thead><tr><th>Party</th><th>Amount</th><th>Days</th><th>Bucket</th></tr></thead><tbody>';
        (data.rows||[]).forEach(r => { html += `<tr><td>${esc(r.partyName)}</td><td>₹${r.amount.toFixed(2)}</td><td>${r.days}</td><td>${esc(r.bucket)}</td></tr>`; });
        html += '</tbody></table>';
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
    showToast('✅ File download ho gayi.');
  }

  // ==================== STAFF ====================
  async function loadStaff() {
    const body = document.getElementById('staffListBody');
    const codeEl = document.getElementById('staffInviteCode');
    const roleEl = document.getElementById('staffInviteRoleLabel');
    if (!body) return;
    try {
      const data = await apiGet('/api/staff/list');
      if (codeEl) codeEl.textContent = data.inviteCode || 'Generate karein';
      if (roleEl) roleEl.textContent = data.inviteRole ? `(${data.inviteRole})` : '';
      body.innerHTML = (data.staff||[]).length ? data.staff.map(s =>
        `<tr><td>${esc(s.username)}</td><td>${esc(s.email)}</td><td>${esc(s.role)}</td><td><button type="button" class="del-staff-btn" data-id="${s._id}">Remove</button></td></tr>`
      ).join('') : '<tr><td colspan="4">Koi staff nahi — invite code se add karein.</td></tr>';
      body.querySelectorAll('.del-staff-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          await apiDelete('/api/staff/' + btn.dataset.id);
          loadStaff();
        });
      });
    } catch (e) { body.innerHTML = `<tr><td colspan="4">${esc(e.message)}</td></tr>`; }
  }

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
  async function loadBankRecon() {
    const body = document.getElementById('bankReconBody');
    if (!body) return;
    const data = await apiGet('/api/bank-recon');
    body.innerHTML = (data.records||[]).map(r =>
      `<tr><td>${new Date(r.date).toLocaleDateString()}</td><td>${esc(r.description)}</td><td>${r.debit?('₹'+r.debit.toFixed(2)):'-'}</td><td>${r.credit?('₹'+r.credit.toFixed(2)):'-'}</td><td>${r.matched?'✅':'❌'}</td></tr>`
    ).join('') || '<tr><td colspan="5">No bank entries — statement add karein.</td></tr>';
  }

  // ==================== COMPANIES ====================
  async function loadCompanies() {
    const body = document.getElementById('companiesBody');
    if (!body) return;
    const data = await apiGet('/api/companies');
    body.innerHTML = (data.companies||[]).map(c =>
      `<tr><td>${esc(c.companyName)}</td><td>${esc(c.gstin)}</td><td>${c.isActive?'✅ Active':'—'}</td><td><button class="activate-co-btn" data-id="${c._id}">Switch</button></td></tr>`
    ).join('') || '<tr><td colspan="4">Ek company add karein.</td></tr>';
    body.querySelectorAll('.activate-co-btn').forEach(b => b.addEventListener('click', async () => {
      await apiPost('/api/companies/' + b.dataset.id + '/activate', {});
      showToast('✅ Company switch ho gayi.');
      loadCompanies();
    }));
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
    if (!customerName || !amount) { showToast('Customer aur amount daalein.', 'error'); return; }
    const data = await apiPost('/api/payments', { customerName, amount, paymentMode, note });
    if (data.success) {
      showToast('✅ Payment record ho gaya + Receipt voucher bana.');
      document.getElementById('udharPaymentModal')?.classList.add('hidden');
      if (typeof window.refreshUdharKhata === 'function') window.refreshUdharKhata();
      if (typeof window.calculateFinancials === 'function') window.calculateFinancials(window.state?.invoices || [], window.state?.expenses || []);
    } else showToast('❌ ' + (data.error || 'Fail'), 'error');
  }

  // ==================== TALLY IMPORT ====================
  async function importFromTally() {
    showToast('Tally se ledgers import ho rahe hain...');
    const data = await apiPost('/api/tally/import-ledgers', {});
    if (data.success) showToast(`✅ ${data.imported} ledgers import, ${data.skipped} pehle se the.`);
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
    document.getElementById('addBankEntryBtn')?.addEventListener('click', async () => {
      const description = document.getElementById('bankDescInput')?.value.trim();
      const debit = parseFloat(document.getElementById('bankDebitInput')?.value) || 0;
      const credit = parseFloat(document.getElementById('bankCreditInput')?.value) || 0;
      if (!description) return;
      await apiPost('/api/bank-recon', { description, debit, credit });
      loadBankRecon();
      showToast('✅ Bank entry added.');
    });

    // Company
    document.getElementById('addCompanyBtn')?.addEventListener('click', async () => {
      const companyName = document.getElementById('coNameInput')?.value.trim();
      const gstin = document.getElementById('coGstinInput')?.value.trim();
      const address = document.getElementById('coAddressInput')?.value.trim();
      if (!companyName) return;
      await apiPost('/api/companies', { companyName, gstin, address });
      loadCompanies();
      showToast('✅ Company added.');
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

    // PWA — purani cache hatao, fresh files load karo
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => r.unregister());
      });
      setTimeout(() => navigator.serviceWorker.register('/sw.js?v=4').catch(() => {}), 500);
    }
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; });
    document.getElementById('installAppBtn')?.addEventListener('click', async () => {
      if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt = null; }
      else showToast('Browser menu se "Add to Home Screen" / "Install App" choose karein.');
    });
  });

  // Expose for udhar table
  window.BolKarigarPro = { loadReportsPro, importFromTally, openUdharPayment, loadBankRecon, loadCompanies };
})();
