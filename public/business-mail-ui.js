/**
 * BolKarigar — Business Mail (Business ₹299): send + track customer emails
 */
(function () {
  const API = () => (typeof window.bkGetApiUrl === 'function' ? window.bkGetApiUrl() : (window.API_URL || ''));
  const token = () => localStorage.getItem('bk_token') || localStorage.getItem('token') || '';
  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });

  let mailStatus = null;
  let messagesCache = [];
  let composeTemplate = 'custom';
  let sentPager = null;
  let inboxPager = null;

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
      return { success: false, error: `Invalid server response (${r.status}).` };
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

  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return String(iso);
    }
  }

  function setSubtab(name) {
    document.querySelectorAll('.bm-subtab-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.bmSub === name);
    });
    document.querySelectorAll('.bm-subpanel').forEach((p) => {
      p.classList.toggle('active', p.id === `bmSub_${name}`);
    });
  }

  function templatePreviewText(id) {
    const shop = mailStatus?.shopName || 'Your Shop';
    const party = document.getElementById('bmPartyName')?.value.trim() || 'Customer';
    const amount = document.getElementById('bmAmount')?.value.trim() || '';
    const inv = document.getElementById('bmInvoiceNo')?.value.trim() || '';
    const map = {
      payment_reminder:
        `Dear ${party},\n\nThis is a friendly reminder regarding your pending balance${amount ? ` of ${amount}` : ''}.\n\nPlease arrange payment at your earliest convenience.\n\nThank you,\n${shop}`,
      invoice_sent:
        `Dear ${party},\n\nPlease find details of your recent purchase${inv ? ` (Invoice ${inv})` : ''}.\n\nThank you for your business.\n\n${shop}`,
      quotation:
        `Dear ${party},\n\nThank you for your interest. Please review our quotation.\n\nWe look forward to working with you.\n\n${shop}`,
      thank_you:
        `Dear ${party},\n\nThank you for choosing ${shop}. We appreciate your trust.\n\nBest regards,\n${shop}`,
      custom: ''
    };
    return map[id] || '';
  }

  function templateSubject(id) {
    const shop = mailStatus?.shopName || 'Your business';
    const titles = {
      payment_reminder: `Payment reminder — ${shop}`,
      invoice_sent: `Invoice from ${shop}`,
      quotation: `Quotation — ${shop}`,
      thank_you: `Thank you — ${shop}`,
      custom: ''
    };
    return titles[id] || '';
  }

  function onTemplateChange() {
    const sel = document.getElementById('bmTemplate');
    const id = sel?.value || 'custom';
    composeTemplate = id;
    const body = document.getElementById('bmBody');
    const subj = document.getElementById('bmSubject');
    const extra = document.getElementById('bmExtraFields');
    if (extra) {
      extra.style.display = id === 'payment_reminder' || id === 'invoice_sent' ? '' : 'none';
    }
    if (subj && !subj.dataset.userEdited) subj.value = templateSubject(id);
    if (body && !body.dataset.userEdited) body.value = templatePreviewText(id);
  }

  function renderStatusBanner() {
    const el = document.getElementById('bmStatusBanner');
    if (!el || !mailStatus) return;
    const ok = mailStatus.emailConfigured;
    const reply = mailStatus.replyEmail || '(not set — add below)';
    if (!ok) {
      el.className = 'bm-status-banner bm-status-warn';
      el.innerHTML = '<strong>⚠️ Email not configured on server.</strong> Set <code>BREVO_API_KEY</code> on Render (same key as password-reset OTP). You can still log inbound replies.';
      return;
    }
    const sender = mailStatus.senderEmail || '(server default)';
    const lines = [
      `<strong>✉️ Ready to send.</strong> Mail goes out from <code>${esc(sender)}</code>; replies come back to <code>${esc(reply)}</code>.`
    ];
    if (mailStatus.freeSenderDomain) {
      lines.push(
        `<span class="bm-status-sub">⚠️ Sender is a free mailbox (<code>${esc(sender)}</code>). Gmail and Outlook usually push such mail to <strong>Spam</strong>. Ask the customer to check Spam, and for reliable delivery verify your own domain in Brevo and set <code>BREVO_FROM_EMAIL</code> to it.</span>`
      );
    }
    el.className = `bm-status-banner ${mailStatus.freeSenderDomain ? 'bm-status-warn' : 'bm-status-ok'}`;
    el.innerHTML = lines.join('');
  }

  function renderMessageList(folder) {
    const isSent = folder === 'sent';
    const list = document.getElementById(isSent ? 'bmSentList' : 'bmInboxList');
    if (!list) return;
    const rows = messagesCache.filter((m) =>
      isSent ? m.direction === 'outbound' : m.direction === 'inbound'
    );
    const pager = isSent ? sentPager : inboxPager;
    const pageRows = pager ? pager.slice(rows) : rows;
    if (!pageRows.length) {
      list.innerHTML = `<p class="bm-empty">${isSent ? 'No sent emails yet. Compose your first message.' : 'No customer replies logged yet. Use “Log customer reply” when someone emails you.'}</p>`;
      return;
    }
    list.innerHTML = pageRows.map((m) => {
      const dirLabel = m.direction === 'outbound' ? 'Sent' : 'Received';
      const status = m.status === 'failed' ? `<span class="bm-badge bm-badge-fail">Failed</span>` : '';
      const preview = (m.bodyText || '').slice(0, 120);
      return `
        <article class="bm-msg-card" data-id="${esc(m._id)}" tabindex="0">
          <div class="bm-msg-head">
            <span class="bm-msg-subject">${esc(m.subject || '(No subject)')}</span>
            <span class="bm-msg-head-right">
              ${status}
              <button type="button" class="bm-msg-del" data-id="${esc(m._id)}" aria-label="Delete message" title="Delete">🗑️</button>
            </span>
          </div>
          <div class="bm-msg-meta">
            <span>${dirLabel} · ${esc(m.partyName || m.to || m.from || '')}</span>
            <time>${esc(fmtDate(m.createdAt))}</time>
          </div>
          <p class="bm-msg-preview">${esc(preview)}${preview.length >= 120 ? '…' : ''}</p>
        </article>`;
    }).join('');
    list.querySelectorAll('.bm-msg-card').forEach((card) => {
      card.addEventListener('click', () => showMessageDetail(card.dataset.id));
    });
    list.querySelectorAll('.bm-msg-del').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteMessage(btn.dataset.id);
      });
    });
  }

  async function deleteMessage(id) {
    const m = messagesCache.find((x) => String(x._id) === String(id));
    if (!m) return;
    if (!confirm(`Delete "${m.subject || '(No subject)'}"? This cannot be undone.`)) return;
    const data = await apiDelete(`/api/business-mail/messages/${id}`);
    if (!data.success) {
      toast(data.error || 'Delete failed', 'error');
      return;
    }
    messagesCache = messagesCache.filter((x) => String(x._id) !== String(id));
    const detail = document.getElementById('bmDetailBox');
    if (detail && detail.dataset.id === String(id)) detail.classList.add('hidden');
    renderMessageList('sent');
    renderMessageList('inbox');
    toast('Message deleted', 'success');
  }

  function showMessageDetail(id) {
    const m = messagesCache.find((x) => String(x._id) === String(id));
    const box = document.getElementById('bmDetailBox');
    if (!m || !box) return;
    box.classList.remove('hidden');
    box.dataset.id = String(m._id);
    document.getElementById('bmDetailSubject').textContent = m.subject || '(No subject)';
    document.getElementById('bmDetailMeta').textContent =
      `${m.direction === 'outbound' ? 'To' : 'From'}: ${m.direction === 'outbound' ? m.to : m.from} · ${fmtDate(m.createdAt)}`;
    document.getElementById('bmDetailBody').textContent = m.bodyText || '';
    const delivery = document.getElementById('bmDetailDelivery');
    if (delivery) {
      if (m.direction === 'outbound' && m.status === 'sent') {
        delivery.textContent = m.providerMessageId
          ? `Accepted by ${m.provider || 'provider'} · ID ${m.providerMessageId}`
          : `Accepted by ${m.provider || 'provider'}`;
        delivery.classList.remove('hidden');
      } else {
        delivery.classList.add('hidden');
      }
    }
    if (m.status === 'failed' && m.error) {
      document.getElementById('bmDetailErr').textContent = m.error;
      document.getElementById('bmDetailErr').classList.remove('hidden');
    } else {
      document.getElementById('bmDetailErr').classList.add('hidden');
    }
  }

  async function loadMessages() {
    const data = await apiGet('/api/business-mail/messages?folder=all&limit=100');
    if (!data.success) {
      toast(data.error || 'Could not load messages', 'error');
      return;
    }
    messagesCache = data.messages || [];
    renderMessageList('sent');
    renderMessageList('inbox');
  }

  async function refreshStatus() {
    const data = await apiGet('/api/business-mail/status');
    if (!data.success) {
      toast(data.error || 'Could not load mail settings', 'error');
      return;
    }
    mailStatus = data;
    const inp = document.getElementById('bmReplyEmail');
    if (inp && data.replyEmail) inp.value = data.replyEmail;
    renderStatusBanner();
  }

  async function loadPartySuggestions() {
    const dl = document.getElementById('bmPartyList');
    if (!dl) return;
    try {
      const r = await fetch(`${API()}/api/ledgers`, { headers: headers() });
      const ledgers = await r.json();
      if (!Array.isArray(ledgers)) return;
      dl.innerHTML = ledgers.map((l) => `<option value="${esc(l.partyName)}"></option>`).join('');
    } catch { /* optional */ }
  }

  async function saveReplyEmail() {
    const email = document.getElementById('bmReplyEmail')?.value.trim() || '';
    const data = await apiPut('/api/business-mail/settings', { businessEmail: email });
    if (!data.success) {
      toast(data.error || 'Save failed', 'error');
      return;
    }
    toast('Business reply email saved', 'success');
    await refreshStatus();
  }

  async function sendMail() {
    const to = document.getElementById('bmTo')?.value.trim() || '';
    const partyName = document.getElementById('bmPartyName')?.value.trim() || '';
    const subject = document.getElementById('bmSubject')?.value.trim() || '';
    const body = document.getElementById('bmBody')?.value.trim() || '';
    const amount = document.getElementById('bmAmount')?.value.trim() || '';
    const invoiceNo = document.getElementById('bmInvoiceNo')?.value.trim() || '';
    const templateId = document.getElementById('bmTemplate')?.value || 'custom';

    if (!to) {
      toast('Enter customer email address', 'error');
      return;
    }
    if (templateId === 'custom' && !body) {
      toast('Write your message', 'error');
      return;
    }

    const btn = document.getElementById('bmSendBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Sending…';
    }
    const data = await apiPost('/api/business-mail/send', {
      to,
      partyName,
      subject,
      body,
      templateId,
      amount,
      invoiceNo
    });
    if (btn) {
      btn.disabled = false;
      btn.textContent = '📤 Send Email';
    }
    if (!data.success) {
      toast(data.error || 'Send failed', 'error');
      if (data.message) await loadMessages();
      return;
    }
    toast(
      mailStatus?.freeSenderDomain
        ? 'Email sent. Tell the customer to check Spam too — sender domain is unverified.'
        : 'Email sent successfully',
      'success'
    );
    document.getElementById('bmBody')?.removeAttribute('data-user-edited');
    document.getElementById('bmSubject')?.removeAttribute('data-user-edited');
    onTemplateChange();
    await loadMessages();
    setSubtab('sent');
  }

  async function logInbound() {
    const from = document.getElementById('bmInFrom')?.value.trim() || '';
    const partyName = document.getElementById('bmInParty')?.value.trim() || '';
    const subject = document.getElementById('bmInSubject')?.value.trim() || '';
    const body = document.getElementById('bmInBody')?.value.trim() || '';
    if (!from || !body) {
      toast('Sender email and message are required', 'error');
      return;
    }
    const data = await apiPost('/api/business-mail/log-inbound', { from, partyName, subject, body });
    if (!data.success) {
      toast(data.error || 'Could not save', 'error');
      return;
    }
    toast('Reply saved to Inbox', 'success');
    document.getElementById('bmInFrom').value = '';
    document.getElementById('bmInParty').value = '';
    document.getElementById('bmInSubject').value = '';
    document.getElementById('bmInBody').value = '';
    await loadMessages();
    setSubtab('inbox');
  }

  function bindEvents() {
    if (typeof window.bkCreatePaginator === 'function') {
      sentPager = window.bkCreatePaginator('bmSent', () => renderMessageList('sent'));
      inboxPager = window.bkCreatePaginator('bmInbox', () => renderMessageList('inbox'));
    }
    document.querySelectorAll('.bm-subtab-btn').forEach((btn) => {
      btn.addEventListener('click', () => setSubtab(btn.dataset.bmSub));
    });
    document.getElementById('bmTemplate')?.addEventListener('change', onTemplateChange);
    ['bmBody', 'bmSubject'].forEach((id) => {
      document.getElementById(id)?.addEventListener('input', (e) => {
        e.target.dataset.userEdited = '1';
      });
    });
    document.getElementById('bmRefreshTpl')?.addEventListener('click', () => {
      const body = document.getElementById('bmBody');
      const subj = document.getElementById('bmSubject');
      if (body) delete body.dataset.userEdited;
      if (subj) delete subj.dataset.userEdited;
      onTemplateChange();
    });
    document.getElementById('bmSaveReplyBtn')?.addEventListener('click', saveReplyEmail);
    document.getElementById('bmSendBtn')?.addEventListener('click', sendMail);
    document.getElementById('bmLogInboundBtn')?.addEventListener('click', logInbound);
    document.getElementById('bmDetailClose')?.addEventListener('click', () => {
      document.getElementById('bmDetailBox')?.classList.add('hidden');
    });
  }

  function applyAccessUI() {
    const no = document.getElementById('bmNoAccess');
    const main = document.getElementById('bmMainContent');
    const ok = hasAccess();
    if (no) no.classList.toggle('hidden', ok);
    if (main) main.classList.toggle('hidden', !ok);
  }

  function loadBusinessMailPanel() {
    applyAccessUI();
    if (!hasAccess()) return;
    refreshStatus();
    loadMessages();
    loadPartySuggestions();
    onTemplateChange();
  }

  /** Pre-fill compose (e.g. from Credit Ledger later) */
  function openComposePrefill(opts) {
    if (typeof openPanel === 'function') openPanel('businessMailPanel');
    else loadBusinessMailPanel();
    if (opts?.partyName) document.getElementById('bmPartyName').value = opts.partyName;
    if (opts?.to) document.getElementById('bmTo').value = opts.to;
    if (opts?.templateId) {
      const sel = document.getElementById('bmTemplate');
      if (sel) sel.value = opts.templateId;
      onTemplateChange();
    }
    if (opts?.amount) document.getElementById('bmAmount').value = opts.amount;
    if (opts?.invoiceNo) document.getElementById('bmInvoiceNo').value = opts.invoiceNo;
    setSubtab('compose');
  }

  bindEvents();
  window.BolKarigarBusinessMail = {
    loadBusinessMailPanel,
    openComposePrefill,
    hasAccess
  };
})();
