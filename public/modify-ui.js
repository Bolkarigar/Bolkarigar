// ==========================================================================
// Modification Center — Account → Item → Invoice → Purchase/Payment/Receipt
// Tally / Vyapar / Zoho style: pehle type chuno, phir search, phir edit
// ==========================================================================
(function () {
  const panel = document.getElementById("modifyPanel");
  if (!panel) return;

  const API = () => (
    typeof window.bkGetApiUrl === "function"
      ? window.bkGetApiUrl()
      : (window.API_URL || window.location.origin)
  );

  async function parseApiResponse(res) {
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      const snippet = text.replace(/\s+/g, " ").trim().slice(0, 80);
      throw new Error(
        res.ok
          ? "Server did not return valid JSON."
          : `Server error (${res.status}). ${snippet.includes("<!DOCTYPE") ? "Restart the server — PUT API route may not be loaded." : snippet}`
      );
    }
  }

  const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${typeof getToken === "function" ? getToken() : ""}`
  });

  const MODIFY_TYPES = [
    { id: "account", icon: "👤", label: "Account / Party", desc: "Customer, Supplier name, address, GSTIN" },
    { id: "item", icon: "📦", label: "Stock Item", desc: "Item name, rate, HSN, GST" },
    { id: "invoice", icon: "🧾", label: "Invoice (Sales)", desc: "Saved sales history record" },
    { id: "purchase", icon: "📥", label: "Purchase Bill", desc: "Supplier bill, amount, note" },
    { id: "payment", icon: "💸", label: "Payment", desc: "Paid to party, amount, mode" },
    { id: "receipt", icon: "💰", label: "Receipt", desc: "Received from party, amount" }
  ];

  const LEDGER_GROUP_OPTS = [
    "Sundry Debtor", "Sundry Creditor", "Cash", "Bank", "Expense", "Income", "Capital", "Fixed Asset"
  ];

  const DATE_SEARCH_TYPES = new Set(["invoice", "purchase", "payment", "receipt"]);

  let currentType = null;
  let selectedRecord = null;
  let searchResults = [];
  let ledgerCache = [];
  let searchTimer = null;

  function esc(s) {
    return typeof escapeHtml === "function" ? escapeHtml(s) : String(s || "");
  }

  function setStep(step) {
    panel.querySelectorAll(".modify-step").forEach((el) => {
      const n = parseInt(el.dataset.step, 10);
      el.classList.toggle("active", n === step);
      el.classList.toggle("done", n < step);
    });
  }

  function setStatus(msg, ok) {
    const el = document.getElementById("modifyStatusText");
    if (!el) return;
    el.textContent = msg || "";
    el.style.color = ok === true ? "#22c55e" : ok === false ? "#ef4444" : "var(--muted)";
  }

  function renderTypeCards() {
    const grid = document.getElementById("modifyTypeGrid");
    if (!grid) return;
    grid.innerHTML = MODIFY_TYPES.map((t) => `
      <button type="button" class="modify-type-card${currentType === t.id ? " selected" : ""}" data-type="${t.id}">
        <span class="modify-type-icon">${t.icon}</span>
        <span class="modify-type-label">${esc(t.label)}</span>
        <span class="modify-type-desc">${esc(t.desc)}</span>
      </button>
    `).join("");
    grid.querySelectorAll(".modify-type-card").forEach((btn) => {
      btn.addEventListener("click", () => selectType(btn.dataset.type));
    });
  }

  function usesDateSearch(typeId) {
    return DATE_SEARCH_TYPES.has(typeId);
  }

  function updateDateFiltersVisibility(typeId) {
    const wrap = document.getElementById("modifyDateFilters");
    if (!wrap) return;
    wrap.classList.toggle("hidden", !usesDateSearch(typeId));
  }

  function getSearchDateRange() {
    const from = document.getElementById("modifySearchFrom")?.value || "";
    const to = document.getElementById("modifySearchTo")?.value || "";
    if (!from && !to) return { fromDate: "", toDate: "" };
    return { fromDate: from || to, toDate: to || from };
  }

  function clearDateFilters() {
    const from = document.getElementById("modifySearchFrom");
    const to = document.getElementById("modifySearchTo");
    if (from) from.value = "";
    if (to) to.value = "";
  }

  function selectType(typeId) {
    currentType = typeId;
    selectedRecord = null;
    searchResults = [];
    renderTypeCards();
    const searchEl = document.getElementById("modifySearchInput");
    if (searchEl) searchEl.value = "";
    clearDateFilters();
    hideSearchResults();
    document.getElementById("modifyEditArea").innerHTML = "";
    document.getElementById("modifySearchSection")?.classList.remove("hidden");
    updateDateFiltersVisibility(typeId);
    if (searchEl) searchEl.placeholder = getSearchPlaceholder(typeId);
    setStep(2);
    setStatus("");
  }

  function getSearchPlaceholder(typeId) {
    const map = {
      account: "Party / Customer / Supplier name search...",
      item: "Item name search...",
      invoice: "Customer name, invoice no, product search...",
      purchase: "Supplier name, bill no, note search...",
      payment: "Party name, note search...",
      receipt: "Party name, note search..."
    };
    return map[typeId] || "Search...";
  }

  function hideSearchResults() {
    const list = document.getElementById("modifySearchResults");
    if (list) {
      list.classList.add("hidden");
      list.innerHTML = "";
    }
  }

  function showSearchResults(items, onPick) {
    const list = document.getElementById("modifySearchResults");
    if (!list) return;
    if (!items.length) {
      list.innerHTML = `<li style="cursor:default;color:var(--muted)">No records found.</li>`;
      list.classList.remove("hidden");
      return;
    }
    list.innerHTML = items.map((row, i) => `
      <li role="option" data-idx="${i}" tabindex="0">
        ${esc(row.title)}
        ${row.meta ? `<span class="modify-result-meta">${esc(row.meta)}</span>` : ""}
      </li>
    `).join("");
    list.classList.remove("hidden");
    list.querySelectorAll("li[data-idx]").forEach((li) => {
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const idx = parseInt(li.dataset.idx, 10);
        if (items[idx]) onPick(items[idx]);
      });
    });
  }

  async function ensureLedgers() {
    if (ledgerCache.length) return ledgerCache;
    try {
      const res = await fetch(`${API()}/api/ledgers`, { headers: headers() });
      const data = await res.json();
      if (data.success) ledgerCache = data.ledgers || [];
    } catch (err) {
      console.warn("Modify ledger cache:", err);
    }
    return ledgerCache;
  }

  async function runSearch(query) {
    if (!currentType) return;
    const q = String(query ?? document.getElementById("modifySearchInput")?.value ?? "").trim();
    const { fromDate, toDate } = getSearchDateRange();
    const hasDate = !!(fromDate || toDate);

    if (!q && !(hasDate && usesDateSearch(currentType))) {
      hideSearchResults();
      return;
    }

    try {
      let rows = [];
      if (currentType === "account") {
        await ensureLedgers();
        const lower = q.toLowerCase();
        rows = ledgerCache
          .filter((l) => {
            const name = (l.partyName || "").toLowerCase();
            const mob = (l.mobile || "").toLowerCase();
            const gst = (l.gstin || "").toLowerCase();
            return name.includes(lower) || mob.includes(lower) || gst.includes(lower);
          })
          .slice(0, 15)
          .map((l) => ({
            id: l._id,
            raw: l,
            title: l.partyName,
            meta: [l.ledgerGroup, l.mobile, l.gstin].filter(Boolean).join(" · ")
          }));
      } else if (currentType === "item") {
        const res = await fetch(`${API()}/api/items`, { headers: headers() });
        const data = await res.json();
        const lower = q.toLowerCase();
        rows = (data.items || [])
          .filter((i) => (i.itemName || "").toLowerCase().includes(lower))
          .slice(0, 15)
          .map((i) => ({
            id: i._id,
            raw: i,
            title: i.itemName,
            meta: `Stock: ${i.stockQty} · ₹${i.sellingPrice} · GST ${i.gstRate || 0}%`
          }));
      } else if (currentType === "invoice") {
        const params = new URLSearchParams({ limit: "30" });
        if (q) params.set("search", q);
        if (fromDate) params.set("fromDate", fromDate);
        if (toDate) params.set("toDate", toDate);
        const res = await fetch(`${API()}/api/sales?${params}`, { headers: headers() });
        const data = await res.json();
        rows = (data.records || []).map((r) => ({
          id: r._id,
          raw: r,
          title: `${r.customer || "—"} — ${r.product || "—"}`,
          meta: [r.invoiceNo, new Date(r.date).toLocaleDateString("en-IN"), `₹${Number(r.totalAmount || 0).toFixed(2)}`].filter(Boolean).join(" · ")
        }));
      } else {
        const vType = currentType === "purchase" ? "Purchase" : currentType === "payment" ? "Payment" : "Receipt";
        const params = new URLSearchParams({ type: vType, limit: "30" });
        if (q) params.set("search", q);
        if (fromDate) params.set("fromDate", fromDate);
        if (toDate) params.set("toDate", toDate);
        const res = await fetch(`${API()}/api/vouchers?${params}`, { headers: headers() });
        const data = await res.json();
        rows = (data.vouchers || []).map((v) => ({
          id: v._id,
          raw: v,
          title: `${v.partyId?.partyName || "—"} — ₹${Number(v.amount || 0).toFixed(2)}`,
          meta: [
            new Date(v.date).toLocaleDateString("en-IN"),
            v.supplierInvoiceNo,
            v.paymentMode,
            v.note
          ].filter(Boolean).join(" · ")
        }));
      }
      searchResults = rows;
      showSearchResults(rows, pickSearchResult);
    } catch (err) {
      setStatus("Search error: " + err.message, false);
    }
  }

  function pickSearchResult(row) {
    selectedRecord = row;
    hideSearchResults();
    const searchEl = document.getElementById("modifySearchInput");
    if (searchEl) searchEl.value = row.title;
    renderEditForm();
    setStep(3);
  }

  function groupOptions(selected) {
    return LEDGER_GROUP_OPTS.map((g) =>
      `<option value="${esc(g)}"${g === selected ? " selected" : ""}>${esc(g)}</option>`
    ).join("");
  }

  function calcModifyLineTotal(qty, rate, gstRate) {
    const q = parseFloat(qty) || 0;
    const r = parseFloat(rate) || 0;
    const g = parseFloat(gstRate) || 0;
    if (!q || !r) return 0;
    const taxable = q * r;
    return taxable + (taxable * g / 100);
  }

  function wireModifyAutoTotal(qtyId, rateId, gstId, totalId) {
    const recalc = () => {
      const totalEl = document.getElementById(totalId);
      if (!totalEl) return;
      const total = calcModifyLineTotal(
        document.getElementById(qtyId)?.value,
        document.getElementById(rateId)?.value,
        document.getElementById(gstId)?.value
      );
      totalEl.value = total > 0 ? total.toFixed(2) : "0.00";
    };
    [qtyId, rateId, gstId].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", recalc);
      document.getElementById(id)?.addEventListener("change", recalc);
    });
    recalc();
  }

  function renderEditForm() {
    const area = document.getElementById("modifyEditArea");
    if (!area || !selectedRecord) return;
    const r = selectedRecord.raw;

    if (currentType === "account") {
      area.innerHTML = `
        <div class="modify-edit-card">
          <h4 class="modify-edit-title">✏️ Account / Party Edit</h4>
          <div class="modify-form-grid">
            <label class="modify-span2"><span>Party / Ledger Name *</span>
              <input type="text" id="mdfPartyName" value="${esc(r.partyName || "")}" /></label>
            <label><span>Ledger Group</span>
              <select id="mdfLedgerGroup">${groupOptions(r.ledgerGroup)}</select></label>
            <label><span>Mobile</span>
              <input type="text" id="mdfMobile" value="${esc(r.mobile || "")}" /></label>
            <label class="modify-span2"><span>GSTIN</span>
              <input type="text" id="mdfGstin" maxlength="15" value="${esc(r.gstin || "")}" /></label>
            <label class="modify-span2"><span>Address</span>
              <textarea id="mdfAddress" rows="2">${esc(r.address || "")}</textarea></label>
            <label><span>Current Balance (read-only)</span>
              <input type="text" readonly value="₹${Math.abs(r.currentBalance || 0).toFixed(2)} ${(r.currentBalance || 0) >= 0 ? "Dr" : "Cr"}" /></label>
          </div>
          <p class="modify-hint">Use Payment / Receipt voucher to change balance — here you can only update name, address, GSTIN.</p>
        </div>`;
    } else if (currentType === "item") {
      area.innerHTML = `
        <div class="modify-edit-card">
          <h4 class="modify-edit-title">✏️ Stock Item Edit</h4>
          <div class="modify-form-grid">
            <label class="modify-span2"><span>Item Name *</span>
              <input type="text" id="mdfItemName" value="${esc(r.itemName || "")}" /></label>
            <label><span>Unit</span>
              <input type="text" id="mdfUnit" value="${esc(r.unit || "Pcs")}" /></label>
            <label><span>HSN Code</span>
              <input type="text" id="mdfHsn" value="${esc(r.hsnCode || "")}" /></label>
            <label><span>GST %</span>
              <input type="number" id="mdfGstRate" min="0" step="0.01" value="${r.gstRate ?? 0}" /></label>
            <label><span>Purchase Rate ₹</span>
              <input type="number" id="mdfPurchase" min="0" step="0.01" value="${r.purchasePrice ?? 0}" /></label>
            <label><span>Selling Rate ₹</span>
              <input type="number" id="mdfSelling" min="0" step="0.01" value="${r.sellingPrice ?? 0}" /></label>
            <label><span>Godown</span>
              <input type="text" id="mdfGodown" value="${esc(r.godown || "Main Godown")}" /></label>
            <label><span>Reorder Level</span>
              <input type="number" id="mdfReorder" min="0" value="${r.reorderLevel ?? 5}" /></label>
            <label><span>Current Stock (read-only)</span>
              <input type="text" readonly value="${r.stockQty ?? 0}" /></label>
          </div>
          <p class="modify-hint">Use Inventory → Stock Adjust to change stock quantity.</p>
        </div>`;
    } else if (currentType === "invoice") {
      const invDateStr = r.date ? new Date(r.date).toISOString().slice(0, 10) : "";
      area.innerHTML = `
        <div class="modify-edit-card">
          <h4 class="modify-edit-title">✏️ Invoice (Sales History) Edit</h4>
          <div class="modify-form-grid">
            <label><span>Invoice Date</span>
              <input type="date" id="mdfInvDate" value="${invDateStr}" /></label>
            <label><span>Invoice No.</span>
              <input type="text" id="mdfInvNo" value="${esc(r.invoiceNo || "")}" /></label>
            <label><span>Payment Type</span>
              <select id="mdfPayType">
                <option${r.paymentType === "Cash" ? " selected" : ""}>Cash</option>
                <option${r.paymentType === "Credit" ? " selected" : ""}>Credit</option>
                <option${r.paymentType === "UPI" ? " selected" : ""}>UPI</option>
                <option${r.paymentType === "Bank" ? " selected" : ""}>Bank</option>
              </select></label>
            <label class="modify-span2"><span>Customer Name *</span>
              <input type="text" id="mdfCustomer" value="${esc(r.customer || "")}" /></label>
            <label class="modify-span2"><span>Product / Item *</span>
              <input type="text" id="mdfProduct" value="${esc(r.product || "")}" /></label>
            <label><span>HSN</span>
              <input type="text" id="mdfInvHsn" value="${esc(r.hsn || "")}" /></label>
            <label><span>Qty</span>
              <input type="number" id="mdfQty" min="0" step="0.01" value="${r.qty ?? 1}" /></label>
            <label><span>Price ₹</span>
              <input type="number" id="mdfPrice" min="0" step="0.01" value="${r.price ?? 0}" /></label>
            <label><span>GST %</span>
              <input type="number" id="mdfInvGst" min="0" step="0.01" value="${r.gstRate ?? 0}" /></label>
            <label><span>Total Amount ₹ (auto)</span>
              <input type="number" id="mdfTotal" min="0" step="0.01" value="${r.totalAmount ?? 0}" readonly title="Auto from Qty × Price + GST" /></label>
            <label><span>Status</span>
              <select id="mdfStatus">
                <option${r.status === "Paid" ? " selected" : ""}>Paid</option>
                <option${r.status === "Credit" ? " selected" : ""}>Credit</option>
              </select></label>
          </div>
          <p class="modify-hint">Change Qty, Price or GST — Total Amount will update automatically.</p>
        </div>`;
      wireModifyAutoTotal("mdfQty", "mdfPrice", "mdfInvGst", "mdfTotal");
    } else {
      const isPurchase = currentType === "purchase";
      const partyName = r.partyId?.partyName || "";
      const partyId = r.partyId?._id || r.partyId || "";
      const dateStr = r.date ? new Date(r.date).toISOString().slice(0, 10) : "";
      const firstItem = (r.items && r.items[0]) || {};
      const purQty = firstItem.qty ?? "";
      const purRate = firstItem.rate ?? "";
      const purGst = firstItem.gstRate ?? 0;
      area.innerHTML = `
        <div class="modify-edit-card">
          <h4 class="modify-edit-title">✏️ ${isPurchase ? "Purchase Bill" : currentType === "payment" ? "Payment" : "Receipt"} Edit</h4>
          <div class="modify-form-grid">
            <label><span>Date</span>
              <input type="date" id="mdfVchDate" value="${dateStr}" /></label>
            ${isPurchase ? `
            <label><span>Qty</span>
              <input type="number" id="mdfPurQty" min="0" step="0.01" value="${purQty}" /></label>
            <label><span>Rate ₹</span>
              <input type="number" id="mdfPurRate" min="0" step="0.01" value="${purRate}" /></label>
            <label><span>GST %</span>
              <input type="number" id="mdfPurGst" min="0" step="0.01" value="${purGst}" /></label>` : ""}
            <label><span>Amount ₹ *${isPurchase ? " (auto)" : ""}</span>
              <input type="number" id="mdfVchAmount" min="0" step="0.01" value="${r.amount ?? 0}" ${isPurchase ? 'readonly title="Auto from Qty × Rate + GST"' : ""} /></label>
            <label class="modify-span2"><span>Party / Ledger *</span>
              <div class="inv-party-autocomplete">
                <input type="text" id="mdfVchPartySearch" value="${esc(partyName)}" placeholder="Party search..." autocomplete="off" />
                <input type="hidden" id="mdfVchPartyId" value="${partyId}" />
                <ul id="mdfVchPartySuggest" class="inv-party-suggest hidden"></ul>
              </div></label>
            ${isPurchase ? `
            <label><span>Supplier Invoice No. *</span>
              <input type="text" id="mdfSupplierBill" value="${esc(r.supplierInvoiceNo || "")}" /></label>
            <label><span>Supplier GSTIN</span>
              <input type="text" id="mdfSupplierGst" maxlength="15" value="${esc(r.supplierGstin || "")}" /></label>` : ""}
            <label><span>Payment Mode</span>
              <select id="mdfVchMode">
                ${["Cash", "Bank", "UPI", "Cheque", "Credit"].map((m) =>
                  `<option value="${m}"${r.paymentMode === m ? " selected" : ""}>${m}</option>`
                ).join("")}
              </select></label>
            <label class="modify-span2"><span>Narration / Note</span>
              <textarea id="mdfVchNote" rows="2">${esc(r.note || "")}</textarea></label>
          </div>
          <p class="modify-hint">${isPurchase
            ? "Purchase amount is auto-calculated from Qty × Rate + GST."
            : "Payment / Receipt: Enter amount directly (how much was paid to / received from party)."}</p>
        </div>`;
      setupModifyPartyAutocomplete();
      if (isPurchase) wireModifyAutoTotal("mdfPurQty", "mdfPurRate", "mdfPurGst", "mdfVchAmount");
    }
  }

  function setupModifyPartyAutocomplete() {
    const input = document.getElementById("mdfVchPartySearch");
    const list = document.getElementById("mdfVchPartySuggest");
    const hidden = document.getElementById("mdfVchPartyId");
    if (!input || !list || !hidden) return;

    async function showPartySuggest() {
      await ensureLedgers();
      const q = input.value.trim().toLowerCase();
      const matches = ledgerCache.filter((l) => {
        if (!q) return true;
        return (l.partyName || "").toLowerCase().includes(q);
      }).slice(0, 12);

      if (!matches.length) {
        list.classList.add("hidden");
        return;
      }
      list.innerHTML = matches.map((l, i) => `
        <li role="option" data-idx="${i}">
          ${esc(l.partyName)}
          <span class="party-meta">${esc(l.ledgerGroup || "")}</span>
        </li>
      `).join("");
      list.classList.remove("hidden");
      list._matches = matches;
      list.querySelectorAll("li").forEach((li) => {
        li.addEventListener("mousedown", (e) => {
          e.preventDefault();
          const idx = parseInt(li.dataset.idx, 10);
          const ledger = list._matches[idx];
          if (!ledger) return;
          hidden.value = ledger._id;
          input.value = ledger.partyName;
          list.classList.add("hidden");
        });
      });
    }

    input.addEventListener("input", () => {
      if (hidden.value) {
        const ledger = ledgerCache.find((l) => l._id === hidden.value);
        if (!ledger || ledger.partyName !== input.value.trim()) hidden.value = "";
      }
      showPartySuggest();
    });
    input.addEventListener("focus", showPartySuggest);
    document.addEventListener("click", (e) => {
      const wrap = input.closest(".inv-party-autocomplete");
      if (wrap && !wrap.contains(e.target)) list.classList.add("hidden");
    });
  }

  async function saveModification() {
    if (!selectedRecord || !currentType) {
      setStatus("Please choose a type and search for a record first.", false);
      return;
    }

    try {
      let res, data, url, method, body;

      if (currentType === "account") {
        const partyName = document.getElementById("mdfPartyName")?.value.trim();
        if (!partyName) { setStatus("Party name is required.", false); return; }
        url = `${API()}/api/ledgers/${selectedRecord.id}`;
        method = "PUT";
        body = {
          partyName,
          ledgerGroup: document.getElementById("mdfLedgerGroup")?.value,
          mobile: document.getElementById("mdfMobile")?.value.trim(),
          gstin: document.getElementById("mdfGstin")?.value.trim(),
          address: document.getElementById("mdfAddress")?.value.trim()
        };
      } else if (currentType === "item") {
        const itemName = document.getElementById("mdfItemName")?.value.trim();
        if (!itemName) { setStatus("Item name zaroori hai.", false); return; }
        url = `${API()}/api/items/${selectedRecord.id}`;
        method = "PUT";
        body = {
          itemName,
          unit: document.getElementById("mdfUnit")?.value.trim() || "Pcs",
          hsnCode: document.getElementById("mdfHsn")?.value.trim(),
          gstRate: parseFloat(document.getElementById("mdfGstRate")?.value) || 0,
          purchasePrice: parseFloat(document.getElementById("mdfPurchase")?.value) || 0,
          sellingPrice: parseFloat(document.getElementById("mdfSelling")?.value) || 0,
          godown: document.getElementById("mdfGodown")?.value.trim(),
          reorderLevel: parseFloat(document.getElementById("mdfReorder")?.value) || 5
        };
      } else if (currentType === "invoice") {
        const customer = document.getElementById("mdfCustomer")?.value.trim();
        const product = document.getElementById("mdfProduct")?.value.trim();
        if (!customer || !product) { setStatus("Customer aur product zaroori hain.", false); return; }
        url = `${API()}/api/sales/${selectedRecord.id}`;
        method = "PUT";
        body = {
          invoiceNo: document.getElementById("mdfInvNo")?.value.trim(),
          customer,
          product,
          hsn: document.getElementById("mdfInvHsn")?.value.trim(),
          qty: parseFloat(document.getElementById("mdfQty")?.value) || 0,
          price: parseFloat(document.getElementById("mdfPrice")?.value) || 0,
          gstRate: parseFloat(document.getElementById("mdfInvGst")?.value) || 0,
          totalAmount: parseFloat(document.getElementById("mdfTotal")?.value) || 0,
          paymentType: document.getElementById("mdfPayType")?.value,
          status: document.getElementById("mdfStatus")?.value,
          voucherDate: document.getElementById("mdfInvDate")?.value || undefined
        };
      } else {
        const partyId = document.getElementById("mdfVchPartyId")?.value;
        const amount = parseFloat(document.getElementById("mdfVchAmount")?.value) || 0;
        if (!partyId) { setStatus("Please select a party from the list.", false); return; }
        if (!amount || amount <= 0) { setStatus("Please enter a valid amount.", false); return; }
        url = `${API()}/api/vouchers/${selectedRecord.id}`;
        method = "PUT";
        body = {
          partyId,
          amount,
          voucherDate: document.getElementById("mdfVchDate")?.value,
          paymentMode: document.getElementById("mdfVchMode")?.value,
          note: document.getElementById("mdfVchNote")?.value.trim()
        };
        if (currentType === "purchase") {
          body.supplierInvoiceNo = document.getElementById("mdfSupplierBill")?.value.trim();
          body.supplierGstin = document.getElementById("mdfSupplierGst")?.value.trim();
          if (!body.supplierInvoiceNo) { setStatus("Supplier Invoice No. zaroori hai.", false); return; }
        }
      }

      res = await fetch(url, { method, headers: headers(), body: JSON.stringify(body) });
      data = await parseApiResponse(res);
      if (!res.ok || !data.success) throw new Error(data.error || "Update fail");

      setStatus("✅ " + (data.message || "Saved successfully."), true);
      if (typeof showToast === "function") showToast("✅ " + (data.message || "Updated!"));

      if (currentType === "account") ledgerCache = [];
      if (typeof window.refreshKhataPro === "function") window.refreshKhataPro();
      if (typeof loadInvoiceLedgers === "function") loadInvoiceLedgers();
      if (currentType === "invoice" && typeof window.bkRefreshSalesPanel === "function") {
        window.bkRefreshSalesPanel({ resetPage: false });
      }
    } catch (err) {
      setStatus("❌ " + err.message, false);
      if (typeof showToast === "function") showToast("❌ " + err.message, "error");
    }
  }

  function resetModifyPanel() {
    currentType = null;
    selectedRecord = null;
    searchResults = [];
    ledgerCache = [];
    const searchEl = document.getElementById("modifySearchInput");
    if (searchEl) searchEl.value = "";
    clearDateFilters();
    hideSearchResults();
    document.getElementById("modifyEditArea").innerHTML = "";
    document.getElementById("modifySearchSection")?.classList.add("hidden");
    renderTypeCards();
    setStep(1);
    setStatus("");
  }

  window.refreshModifyPanel = resetModifyPanel;

  window.openModifyVoucherFromDaybook = function (id, voucherType) {
    const map = { Purchase: "purchase", Payment: "payment", Receipt: "receipt" };
    const type = map[voucherType];
    if (!type) {
      if (typeof showToast === "function") showToast("Is voucher type ke liye Modification abhi Purchase/Payment/Receipt par hai.", "info");
      return;
    }
    window.openModifyPanel(type, id);
  };

  window.openModifyPanel = function (type, recordId) {
    if (typeof openPanel === "function") openPanel("modifyPanel");
    resetModifyPanel();
    if (type) {
      selectType(type);
      if (recordId) {
        setTimeout(() => loadRecordById(type, recordId), 300);
      }
    }
  };

  async function loadRecordById(type, id) {
    try {
      if (type === "account") {
        await ensureLedgers();
        const l = ledgerCache.find((x) => String(x._id) === String(id));
        if (l) pickSearchResult({ id: l._id, raw: l, title: l.partyName, meta: "" });
      } else if (type === "item") {
        const res = await fetch(`${API()}/api/items`, { headers: headers() });
        const data = await res.json();
        const i = (data.items || []).find((x) => String(x._id) === String(id));
        if (i) pickSearchResult({ id: i._id, raw: i, title: i.itemName, meta: "" });
      } else if (type === "invoice") {
        const res = await fetch(`${API()}/api/sales/${id}`, { headers: headers() });
        const data = await res.json();
        if (data.record) pickSearchResult({ id: data.record._id, raw: data.record, title: data.record.customer, meta: "" });
      } else {
        const res = await fetch(`${API()}/api/vouchers/${id}`, { headers: headers() });
        const data = await res.json();
        if (data.voucher) {
          const v = data.voucher;
          pickSearchResult({
            id: v._id,
            raw: v,
            title: v.partyId?.partyName || "Voucher",
            meta: ""
          });
        }
      }
    } catch (err) {
      setStatus("Record load error: " + err.message, false);
    }
  }

  function triggerSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runSearch(), 280);
  }

  document.getElementById("modifySearchInput")?.addEventListener("input", triggerSearch);
  document.getElementById("modifySearchInput")?.addEventListener("focus", triggerSearch);
  document.getElementById("modifySearchFrom")?.addEventListener("change", triggerSearch);
  document.getElementById("modifySearchTo")?.addEventListener("change", triggerSearch);
  document.getElementById("modifySaveBtn")?.addEventListener("click", saveModification);
  document.getElementById("modifyResetBtn")?.addEventListener("click", resetModifyPanel);

  renderTypeCards();
  setStep(1);
})();
