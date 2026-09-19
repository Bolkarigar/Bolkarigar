/**
 * BolKarigar — Quotation / Estimate Builder UI (Business ₹299)
 */
(function () {
  const API = () => (typeof window.bkGetApiUrl === 'function' ? window.bkGetApiUrl() : (window.API_URL || ''));
  const token = () => localStorage.getItem('bk_token') || localStorage.getItem('token') || '';
  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });

  let draftLines = [];
  let editingLineIdx = -1;
  let editingEstimateId = null;

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
      return { success: false, error: `Invalid server response (${r.status}). Restart server or refresh.` };
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
  async function apiPut(path, body) {
    const r = await fetch(`${API()}${path}`, { method: 'PUT', headers: headers(), body: JSON.stringify(body || {}) });
    return parseApiResponse(r);
  }
  async function apiDelete(path) {
    const r = await fetch(`${API()}${path}`, { method: 'DELETE', headers: headers() });
    return parseApiResponse(r);
  }

  function me() { return window._bkAccountInfo || null; }

  function hasAccess() {
    const m = me();
    return !!m?.subscription?.fullAccess && !m?.isStaff;
  }

  function lineTotal(item) {
    const price = parseFloat(item.price) || 0;
    const qty = parseFloat(item.qty) || 1;
    const gstOn = document.getElementById('estGstToggle')?.checked !== false;
    const gstRate = gstOn ? (parseFloat(item.gstRate) || 0) : 0;
    const base = price * qty;
    return base + (base * gstRate) / 100;
  }

  function readFormHeader() {
    return {
      customer: document.getElementById('estCustomer')?.value.trim() || '',
      customerGstin: document.getElementById('estCustomerGstin')?.value.trim() || '',
      customerAddress: document.getElementById('estCustomerAddress')?.value.trim() || '',
      customerState: document.getElementById('estCustomerState')?.value.trim() || '',
      customerPincode: document.getElementById('estCustomerPincode')?.value.trim() || '',
      projectName: document.getElementById('estProject')?.value.trim() || '',
      paymentType: document.getElementById('estPaymentType')?.value || 'Cash',
      notes: document.getElementById('estNotes')?.value.trim() || '',
      estimateDate: document.getElementById('estDate')?.value || '',
      validUntil: document.getElementById('estValidUntil')?.value || '',
      gstEnabled: document.getElementById('estGstToggle')?.checked !== false,
      estimateNo: document.getElementById('estNumber')?.value.trim() || ''
    };
  }

  function renderDraftLines() {
    const body = document.getElementById('estLineBody');
    const totalEl = document.getElementById('estGrandTotal');
    if (!body) return;
    let grand = 0;
    body.innerHTML = '';
    if (!draftLines.length) {
      body.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:12px;">Add work / material lines below.</td></tr>';
    } else {
      draftLines.forEach((item, i) => {
        const lt = lineTotal(item);
        grand += lt;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${i + 1}</td>
          <td>${esc(item.product)}${item.hsn ? `<br><small>HSN: ${esc(item.hsn)}</small>` : ''}</td>
          <td>${esc(item.qty)}</td>
          <td>${esc(item.unit || 'Pcs')}</td>
          <td>₹${(parseFloat(item.price) || 0).toFixed(2)}</td>
          <td>₹${lt.toFixed(2)}</td>
          <td>
            <button type="button" class="secondary est-line-edit" data-i="${i}">Edit</button>
            <button type="button" class="secondary est-line-del" data-i="${i}">Del</button>
          </td>`;
        body.appendChild(tr);
      });
    }
    if (totalEl) totalEl.textContent = grand.toFixed(2);
    body.querySelectorAll('.est-line-edit').forEach((btn) => {
      btn.addEventListener('click', () => editLine(Number(btn.dataset.i)));
    });
    body.querySelectorAll('.est-line-del').forEach((btn) => {
      btn.addEventListener('click', () => {
        draftLines.splice(Number(btn.dataset.i), 1);
        if (editingLineIdx === Number(btn.dataset.i)) editingLineIdx = -1;
        renderDraftLines();
      });
    });
  }

  function clearLineFields() {
    ['estItemName', 'estItemHsn', 'estItemPrice'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const q = document.getElementById('estItemQty');
    if (q) q.value = '1';
    editingLineIdx = -1;
    const addBtn = document.getElementById('estAddLineBtn');
    if (addBtn) addBtn.textContent = '➕ Add Line';
  }

  function editLine(i) {
    const item = draftLines[i];
    if (!item) return;
    document.getElementById('estItemName').value = item.product || '';
    document.getElementById('estItemHsn').value = item.hsn || '';
    document.getElementById('estItemQty').value = item.qty ?? 1;
    document.getElementById('estItemUnit').value = item.unit || 'Pcs';
    document.getElementById('estItemPrice').value = item.price ?? '';
    document.getElementById('estItemGst').value = item.gstRate ?? 18;
    editingLineIdx = i;
    document.getElementById('estAddLineBtn').textContent = '💾 Update Line';
  }

  function addLineFromForm() {
    const product = document.getElementById('estItemName')?.value.trim();
    const price = parseFloat(document.getElementById('estItemPrice')?.value || '0');
    if (!product || !price || price <= 0) {
      toast('Enter item description and rate.', 'error');
      return;
    }
    const gstOn = document.getElementById('estGstToggle')?.checked !== false;
    const row = {
      product,
      hsn: document.getElementById('estItemHsn')?.value.trim() || '',
      qty: parseFloat(document.getElementById('estItemQty')?.value || '1') || 1,
      unit: document.getElementById('estItemUnit')?.value.trim() || 'Pcs',
      price,
      gstRate: gstOn ? (parseFloat(document.getElementById('estItemGst')?.value || '0') || 0) : 0
    };
    if (editingLineIdx >= 0) {
      draftLines[editingLineIdx] = row;
      editingLineIdx = -1;
      document.getElementById('estAddLineBtn').textContent = '➕ Add Line';
    } else {
      draftLines.push(row);
    }
    clearLineFields();
    renderDraftLines();
  }

  function buildPayloadFromForm() {
    const h = readFormHeader();
    if (!h.customer) throw new Error('Client / customer name is required.');
    if (!draftLines.length) throw new Error('Add at least one line item.');
    return {
      ...h,
      lines: draftLines.map((l) => ({
        product: l.product,
        hsn: l.hsn,
        qty: l.qty,
        unit: l.unit,
        price: l.price,
        gstRate: h.gstEnabled ? l.gstRate : 0
      }))
    };
  }

  function estimateToPrintItems(est) {
    const gstOn = est.gstEnabled !== false;
    return (est.lines || []).map((line) => ({
      product: line.product,
      hsn: line.hsn,
      qty: line.qty,
      unit: line.unit || 'Pcs',
      price: line.price,
      gstRate: gstOn ? line.gstRate : 0,
      totalAmount: line.lineTotal || lineTotal(line)
    }));
  }

  function openEstimatePdf(est) {
    if (typeof window.bkBuildBusyInvoicePayload !== 'function' || typeof window.bkRenderBusyTaxInvoiceHtml !== 'function') {
      toast('Invoice renderer not loaded — refresh the page.', 'error');
      return;
    }
    let savedProfile = {};
    try { savedProfile = JSON.parse(localStorage.getItem('bolkarigar_company_profile') || '{}'); } catch { /* */ }
    const items = estimateToPrintItems(est);
    const gstOn = est.gstEnabled !== false && items.some((i) => (parseFloat(i.gstRate) || 0) > 0);
    const payload = window.bkBuildBusyInvoicePayload({
      profile: savedProfile,
      buyer: {
        name: est.customer,
        gstin: est.customerGstin || '',
        address: est.customerAddress || '',
        state: est.customerState || '',
        pincode: est.customerPincode || ''
      },
      items,
      invoiceNo: est.estimateNo,
      invoiceDate: est.estimateDate || new Date(),
      gstOn,
      paymentType: est.paymentType || '',
      copyLabel: 'Estimate Copy'
    });
    let html = window.bkRenderBusyTaxInvoiceHtml(payload);
    html = html
      .replace(/TAX INVOICE/g, 'QUOTATION / ESTIMATE')
      .replace(/Tax Invoice/g, 'Quotation / Estimate')
      .replace(/Invoice No\./g, 'Estimate No.')
      .replace(/<title>Tax Invoice/g, '<title>Estimate');
    const valid = est.validUntil ? new Date(est.validUntil).toLocaleDateString('en-IN') : '';
    const note = [
      est.projectName ? `Project: ${est.projectName}` : '',
      valid ? `Valid until: ${valid}` : '',
      'This document is an estimate only — not a tax invoice until converted.',
      est.notes || ''
    ].filter(Boolean).join(' | ');
    if (note) {
      html = html.replace(
        '<div class="terms">',
        `<div class="terms"><p><strong>Note:</strong> ${esc(note).replace(/\|/g, '<br>')}</p>`
      );
    }
    if (typeof window.bkOpenTaxInvoicePrint === 'function') {
      window.bkOpenTaxInvoicePrint(html, `Estimate - ${est.estimateNo}`);
    } else {
      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); }
    }
  }

  async function ensureEstimateNumber() {
    const el = document.getElementById('estNumber');
    if (el?.value.trim()) return el.value.trim();
    const data = await apiGet('/api/estimates/next-number');
    if (data.success && data.estimateNo) {
      el.value = data.estimateNo;
      return data.estimateNo;
    }
    throw new Error(data.error || 'Could not get estimate number.');
  }

  async function saveEstimate() {
    try {
      const payload = buildPayloadFromForm();
      if (!payload.estimateNo) payload.estimateNo = await ensureEstimateNumber();
      const statusEl = document.getElementById('estSaveStatus');
      if (statusEl) { statusEl.textContent = 'Saving…'; statusEl.style.color = '#fbbf24'; }

      let data;
      if (editingEstimateId) {
        data = await apiPut(`/api/estimates/${editingEstimateId}`, payload);
      } else {
        data = await apiPost('/api/estimates', payload);
      }
      if (!data.success) throw new Error(data.error || 'Save failed.');
      editingEstimateId = data.estimate._id;
      document.getElementById('estNumber').value = data.estimate.estimateNo;
      if (statusEl) {
        statusEl.textContent = `✅ Saved — ${data.estimate.estimateNo}`;
        statusEl.style.color = '#22c55e';
      }
      toast(`Estimate saved — ${data.estimate.estimateNo}`, 'success');
      await loadSavedList();
      return data.estimate;
    } catch (e) {
      toast(e.message, 'error');
      const statusEl = document.getElementById('estSaveStatus');
      if (statusEl) { statusEl.textContent = '❌ ' + e.message; statusEl.style.color = '#ef4444'; }
      return null;
    }
  }

  async function downloadPdfFromForm() {
    let est;
    if (editingEstimateId) {
      const data = await apiGet(`/api/estimates/${editingEstimateId}`);
      if (data.success) est = data.estimate;
    }
    if (!est) {
      try {
        est = await saveEstimate();
      } catch { /* saveEstimate handles toast */ }
    }
    if (est) openEstimatePdf(est);
    else {
      try {
        const payload = buildPayloadFromForm();
        payload.estimateNo = payload.estimateNo || (await ensureEstimateNumber());
        openEstimatePdf(payload);
      } catch (e) {
        toast(e.message, 'error');
      }
    }
    toast("In print dialog choose 'Save as PDF' to share with client.", 'info');
  }

  function loadEstimateIntoForm(est) {
    editingEstimateId = est._id;
    document.getElementById('estNumber').value = est.estimateNo || '';
    document.getElementById('estCustomer').value = est.customer || '';
    document.getElementById('estCustomerGstin').value = est.customerGstin || '';
    document.getElementById('estCustomerAddress').value = est.customerAddress || '';
    document.getElementById('estCustomerState').value = est.customerState || '';
    document.getElementById('estCustomerPincode').value = est.customerPincode || '';
    document.getElementById('estProject').value = est.projectName || '';
    document.getElementById('estPaymentType').value = est.paymentType || 'Cash';
    document.getElementById('estNotes').value = est.notes || '';
    const gstToggle = document.getElementById('estGstToggle');
    if (gstToggle) gstToggle.checked = est.gstEnabled !== false;
    if (est.estimateDate) {
      const d = new Date(est.estimateDate);
      document.getElementById('estDate').value = d.toISOString().slice(0, 10);
    }
    if (est.validUntil) {
      document.getElementById('estValidUntil').value = new Date(est.validUntil).toISOString().slice(0, 10);
    }
    draftLines = (est.lines || []).map((l) => ({ ...l }));
    renderDraftLines();
    document.getElementById('estFormSubtab')?.click();
  }

  function resetForm() {
    editingEstimateId = null;
    draftLines = [];
    editingLineIdx = -1;
    ['estCustomer', 'estCustomerGstin', 'estCustomerAddress', 'estCustomerState', 'estCustomerPincode', 'estProject', 'estNotes', 'estNumber'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const today = new Date().toISOString().slice(0, 10);
    const dateEl = document.getElementById('estDate');
    if (dateEl) dateEl.value = today;
    document.getElementById('estValidUntil').value = '';
    clearLineFields();
    renderDraftLines();
    document.getElementById('estSaveStatus').textContent = '';
    ensureEstimateNumber().catch(() => {});
  }

  function statusBadge(st) {
    const map = {
      draft: '📝 Draft',
      sent: '📤 Sent',
      accepted: '✅ Accepted',
      converted: '🧾 Invoiced',
      rejected: '❌ Rejected'
    };
    return map[st] || st;
  }

  async function loadSavedList() {
    const body = document.getElementById('estSavedBody');
    if (!body) return;
    body.innerHTML = '<tr><td colspan="6">Loading…</td></tr>';
    const data = await apiGet('/api/estimates?limit=80');
    if (!data.success) {
      body.innerHTML = `<tr><td colspan="6">${esc(data.error)}</td></tr>`;
      return;
    }
    const rows = data.estimates || [];
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="6" style="text-align:center;">No saved estimates yet.</td></tr>';
      return;
    }
    body.innerHTML = '';
    rows.forEach((est) => {
      const tr = document.createElement('tr');
      const amt = Number(est.grandTotal || 0).toFixed(2);
      const dt = est.estimateDate ? new Date(est.estimateDate).toLocaleDateString('en-IN') : '—';
      tr.innerHTML = `
        <td>${esc(est.estimateNo)}</td>
        <td>${esc(est.customer)}</td>
        <td>${dt}</td>
        <td>₹${amt}</td>
        <td>${statusBadge(est.status)}${est.linkedInvoiceNo ? `<br><small>Inv: ${esc(est.linkedInvoiceNo)}</small>` : ''}</td>
        <td class="est-actions-cell"></td>`;
      const cell = tr.querySelector('.est-actions-cell');
      const mk = (label, fn, primary) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.className = primary ? '' : 'secondary';
        b.style.marginRight = '4px';
        b.style.marginBottom = '4px';
        b.addEventListener('click', fn);
        cell.appendChild(b);
      };
      mk('Open', () => loadEstimateIntoForm(est));
      mk('PDF', () => openEstimatePdf(est));
      if (est.status !== 'converted') {
        mk('Sent', async () => {
          const r = await apiPost(`/api/estimates/${est._id}/mark-sent`);
          if (r.success) { toast('Marked as sent.', 'success'); loadSavedList(); }
          else toast(r.error, 'error');
        }, false);
        mk('Accept', async () => {
          const r = await apiPost(`/api/estimates/${est._id}/accept`);
          if (r.success) { toast('Client acceptance recorded.', 'success'); loadSavedList(); }
          else toast(r.error, 'error');
        }, false);
        mk('→ Invoice', () => convertToInvoice(est._id), true);
      }
      if (est.status !== 'converted') {
        mk('Del', async () => {
          if (!confirm('Delete this estimate?')) return;
          const r = await apiDelete(`/api/estimates/${est._id}`);
          if (r.success) { toast('Deleted.', 'success'); loadSavedList(); }
          else toast(r.error, 'error');
        }, false);
      }
      body.appendChild(tr);
    });
  }

  async function convertToInvoice(id) {
    if (!confirm('Convert this estimate to a tax invoice? This creates sales records with a new invoice number.')) return;
    const payEl = document.getElementById('estPaymentType');
    const data = await apiPost(`/api/estimates/${id}/convert-to-invoice`, {
      voucherDate: document.getElementById('estDate')?.value || undefined
    });
    if (!data.success) {
      toast(data.error || 'Convert failed.', 'error');
      return;
    }
    const invoiceNo = data.invoiceNo;
    const payType = payEl?.value || 'Cash';
    const records = data.salesRecords || [];
    if (typeof window.recordKhataSaleFromInvoice === 'function') {
      for (const rec of records) {
        await window.recordKhataSaleFromInvoice({
          customer: rec.customer,
          product: rec.product,
          hsn: rec.hsn,
          price: rec.price,
          qty: rec.qty,
          gstRate: rec.gstRate,
          paymentType: payType,
          salesHistoryId: rec._id,
          invoiceNo: rec.invoiceNo || invoiceNo,
          silent: true
        });
      }
    }
    toast(`✅ Invoice created — ${invoiceNo}`, 'success');
    if (typeof window.refreshOverviewSalesFromHistory === 'function') window.refreshOverviewSalesFromHistory();
    if (typeof window.refreshUdharKhata === 'function') window.refreshUdharKhata();
    await loadSavedList();
    if (data.estimate) loadEstimateIntoForm(data.estimate);
  }

  function bindSubtabs() {
    document.querySelectorAll('.est-subtab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sub = btn.dataset.sub;
        document.querySelectorAll('.est-subtab-btn').forEach((b) => b.classList.toggle('active', b === btn));
        document.querySelectorAll('.est-subpanel').forEach((p) => p.classList.toggle('active', p.id === sub));
        if (sub === 'estListSub') loadSavedList();
      });
    });
  }

  function updateAccessUI() {
    const ok = hasAccess();
    const noAccess = document.getElementById('estNoAccess');
    const main = document.getElementById('estMainContent');
    if (noAccess) noAccess.classList.toggle('hidden', ok);
    if (main) main.style.display = ok ? '' : 'none';
  }

  function bindEvents() {
    document.getElementById('estAddLineBtn')?.addEventListener('click', addLineFromForm);
    document.getElementById('estSaveBtn')?.addEventListener('click', saveEstimate);
    document.getElementById('estPdfBtn')?.addEventListener('click', downloadPdfFromForm);
    document.getElementById('estNewBtn')?.addEventListener('click', resetForm);
    document.getElementById('estConvertBtn')?.addEventListener('click', () => {
      if (!editingEstimateId) {
        toast('Save the estimate first, then convert.', 'error');
        return;
      }
      convertToInvoice(editingEstimateId);
    });
    document.getElementById('estGstToggle')?.addEventListener('change', renderDraftLines);
    bindSubtabs();
  }

  function ensureDefaultDate() {
    const el = document.getElementById('estDate');
    if (el && !el.value) el.value = new Date().toISOString().slice(0, 10);
  }

  function loadEstimatePanel() {
    updateAccessUI();
    if (!hasAccess()) return;
    ensureDefaultDate();
    renderDraftLines();
    const listPanel = document.getElementById('estListSub');
    if (listPanel?.classList.contains('active')) loadSavedList();
    else if (!document.getElementById('estNumber')?.value) {
      ensureEstimateNumber().catch(() => {});
    }
  }

  window.BolKarigarEstimates = {
    loadEstimatePanel,
    openEstimatePdf,
    convertToInvoice,
    refreshAccess: updateAccessUI
  };

  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    updateAccessUI();
  });
})();
