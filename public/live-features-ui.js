/**
 * BolKarigar — Live feature UI (daily summary, alerts, backup, onboarding, bank CSV)
 */
(function () {
  const API = () => (typeof window.bkGetApiUrl === 'function' ? window.bkGetApiUrl() : (window.API_URL || window.location.origin));
  const token = () => localStorage.getItem('bk_token') || localStorage.getItem('token') || '';
  const hdr = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });

  function toast(msg, type) {
    if (typeof window.showToast === 'function') window.showToast(msg, type);
    else console.log(msg);
  }

  function updateTodayDateLabel() {
    const el = document.getElementById('todayDateLabel');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleDateString('hi-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  async function loadDailySummary() {
    try {
      const r = await fetch(`${API()}/api/reports/daily-summary`, { headers: hdr() });
      if (!r.ok) return;
      const d = await r.json();
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = `₹${(val || 0).toFixed(2)}`; };
      set('dailyCashVal', d.cashReceived);
      set('dailyUpiVal', d.upiReceived);
      set('dailyCreditVal', d.creditSales);
      set('dailyCollectionsVal', d.udharCollections);
      const inv = document.getElementById('dailyInvoiceCount');
      if (inv) inv.textContent = String(d.invoiceCount || 0);
    } catch (e) { /* silent */ }
  }

  async function loadLowStockAlerts() {
    const box = document.getElementById('lowStockAlertBox');
    if (!box) return;
    try {
      const r = await fetch(`${API()}/api/alerts/low-stock?threshold=5`, { headers: hdr() });
      if (!r.ok) return;
      const d = await r.json();
      if (!d.count) { box.classList.add('hidden'); return; }
      box.classList.remove('hidden');
      box.innerHTML = `<strong>⚠️ Low Stock (${d.count} items):</strong> ` +
        d.items.slice(0, 5).map(i => `${i.itemName} (${i.stockQty} ${i.unit || 'Pcs'})`).join(' · ') +
        (d.count > 5 ? ' …' : '');
    } catch (e) { box.classList.add('hidden'); }
  }

  async function downloadBackup(path, filename) {
    try {
      const r = await fetch(`${API()}${path}`, { headers: hdr() });
      const data = await r.json();
      if (!r.ok) { toast(data.error || 'Download fail', 'error'); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      a.download = filename;
      a.click();
      toast('✅ File download ho gayi.');
    } catch (e) { toast('Download error: ' + e.message, 'error'); }
  }

  function showOnboardingIfNeeded() {
    if (localStorage.getItem('bk_onboarding_done')) return;
    const modal = document.getElementById('onboardingModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    let step = 1;
    const showStep = (n) => {
      modal.querySelectorAll('.onboard-step').forEach(s => s.classList.toggle('hidden', Number(s.dataset.step) !== n));
      const prog = document.getElementById('onboardProgress');
      if (prog) prog.textContent = `Step ${n} / 3`;
    };
    showStep(1);
    document.getElementById('onboardNextBtn')?.addEventListener('click', () => {
      step++;
      if (step > 3) {
        localStorage.setItem('bk_onboarding_done', '1');
        modal.classList.add('hidden');
        if (typeof openPanel === 'function') openPanel('invoicePanel');
        toast('Profile setup karein — phir bill banayein!', 'info');
        return;
      }
      showStep(step);
    });
    document.getElementById('onboardSkipBtn')?.addEventListener('click', () => {
      localStorage.setItem('bk_onboarding_done', '1');
      modal.classList.add('hidden');
    });
  }

  async function importBankCsv(file) {
    if (!file) return;
    const text = await file.text();
    const r = await fetch(`${API()}/api/bank-recon/import-csv`, {
      method: 'POST', headers: hdr(), body: JSON.stringify({ csvText: text })
    });
    const d = await r.json();
    if (d.success) {
      toast(`✅ ${d.imported} entries import ho gayi.`);
      if (typeof window.BolKarigarPro?.loadBankRecon === 'function') window.BolKarigarPro.loadBankRecon();
      else document.getElementById('bankReconPanel')?.dispatchEvent(new Event('focus'));
    } else toast('❌ ' + (d.error || 'Import fail'), 'error');
  }

  document.addEventListener('DOMContentLoaded', () => {
    updateTodayDateLabel();
    setTimeout(() => { loadDailySummary(); loadLowStockAlerts(); }, 800);
    showOnboardingIfNeeded();
    setInterval(updateTodayDateLabel, 60000);

    document.getElementById('refreshDailyBtn')?.addEventListener('click', () => {
      loadDailySummary();
      loadLowStockAlerts();
      toast('Dashboard refresh ho gaya.');
    });
    document.getElementById('downloadBackupBtn')?.addEventListener('click', () =>
      downloadBackup('/api/backup/full', `bolkarigar-backup-${Date.now()}.json`));
    document.getElementById('downloadCaPackBtn')?.addEventListener('click', () => {
      const m = new Date().getMonth() + 1, y = new Date().getFullYear();
      downloadBackup(`/api/backup/ca-pack?month=${m}&year=${y}`, `bolkarigar-ca-${m}-${y}.json`);
    });
    document.getElementById('bankCsvInput')?.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (f) importBankCsv(f);
      e.target.value = '';
    });
  });

  window.BolKarigarLive = { loadDailySummary, loadLowStockAlerts, updateTodayDateLabel };
})();
