/**
 * Smart Inventory Tracker — India-style (Vyapar/Khatabook pattern)
 * HSN, GST, godown, batch, low-stock alerts, stock adjust
 */
(function () {
  const API = () => (typeof window.bkGetApiUrl === 'function' ? window.bkGetApiUrl() : (window.API_URL || window.location.origin));
  const getToken = () => localStorage.getItem("bk_token") || localStorage.getItem("token") || "";
  const headers = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` });

  let allItems = [];

  function fmt(n) {
    return "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function statusBadge(status) {
    if (status === "out") return '<span class="inv-badge inv-badge-out">Out</span>';
    if (status === "low") return '<span class="inv-badge inv-badge-low">Low</span>';
    return '<span class="inv-badge inv-badge-ok">OK</span>';
  }

  function setChipGroup(groupId, hiddenId, value) {
    const hidden = document.getElementById(hiddenId);
    if (hidden) hidden.value = value;
    document.querySelectorAll(`#${groupId} .inv-chip`).forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.value === String(value));
    });
  }

  function wireChipGroup(groupId, hiddenId) {
    document.querySelectorAll(`#${groupId} .inv-chip`).forEach((btn) => {
      btn.addEventListener("click", () => {
        setChipGroup(groupId, hiddenId, btn.dataset.value);
      });
    });
  }

  function resetForm() {
    document.getElementById("invEditId").value = "";
    document.getElementById("invFormTitle").textContent = "➕ Naya Item Add Karein";
    ["invItemName", "invHsn", "invBatch"].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ""; });
    ["invPurchase", "invSelling", "invOpening"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.value = "";
        el.disabled = false;
        el.placeholder = id === "invOpening" ? "Stock quantity" : el.placeholder;
      }
    });
    setChipGroup("invUnitChips", "invUnit", "Pcs");
    setChipGroup("invGstChips", "invGst", "0");
    const reorder = document.getElementById("invReorder"); if (reorder) reorder.value = "5";
    const godown = document.getElementById("invGodown"); if (godown) godown.value = "Main Godown";
    document.getElementById("invCancelEditBtn")?.classList.add("hidden");
  }

  function getFormPayload() {
    return {
      itemName: document.getElementById("invItemName")?.value.trim(),
      unit: document.getElementById("invUnit")?.value || "Pcs",
      hsnCode: document.getElementById("invHsn")?.value.trim() || "",
      gstRate: parseFloat(document.getElementById("invGst")?.value) || 0,
      purchasePrice: parseFloat(document.getElementById("invPurchase")?.value) || 0,
      sellingPrice: parseFloat(document.getElementById("invSelling")?.value) || 0,
      openingStock: parseFloat(document.getElementById("invOpening")?.value) || 0,
      reorderLevel: parseFloat(document.getElementById("invReorder")?.value) || 5,
      godown: document.getElementById("invGodown")?.value.trim() || "Main Godown",
      batchNo: document.getElementById("invBatch")?.value.trim() || ""
    };
  }

  function updateStats(stats) {
    if (!stats) return;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set("invStatTotal", stats.totalItems ?? 0);
    set("invStatValue", fmt(stats.totalStockValue));
    set("invStatSale", fmt(stats.totalSaleValue));
    set("invStatLow", stats.lowStockCount ?? 0);
    set("invStatOut", stats.outOfStockCount ?? 0);
  }

  function filteredItems() {
    const q = (document.getElementById("invSearch")?.value || "").toLowerCase().trim();
    const filter = document.getElementById("invFilter")?.value || "all";
    return allItems.filter((i) => {
      if (filter !== "all" && i.status !== filter) return false;
      if (!q) return true;
      const hay = [i.itemName, i.hsnCode, i.godown, i.batchNo, i.unit].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  function renderTable() {
    const body = document.getElementById("inventoryBody");
    if (!body) return;
    const items = filteredItems();
    if (!items.length) {
      body.innerHTML = "<tr><td colspan='11'>Koi item nahi mila. Upar form se add karein.</td></tr>";
      return;
    }
    body.innerHTML = items.map((i) => `
      <tr class="inv-row-${i.status}">
        <td><strong>${escapeHtml(i.itemName)}</strong>${i.batchNo ? `<br><small class="helper-text">Batch: ${escapeHtml(i.batchNo)}</small>` : ""}</td>
        <td>${escapeHtml(i.hsnCode) || "—"}</td>
        <td>${escapeHtml(i.unit)}</td>
        <td><strong>${i.stockQty}</strong></td>
        <td>${fmt(i.purchasePrice)}</td>
        <td>${fmt(i.sellingPrice)}</td>
        <td>${fmt(i.stockValue)}</td>
        <td>${i.gstRate || 0}%</td>
        <td>${escapeHtml(i.godown) || "—"}</td>
        <td>${statusBadge(i.status)}</td>
        <td class="inv-actions">
          <button type="button" class="inv-act-btn" title="Edit" onclick="window.invEditItem('${i._id}')">✏️</button>
          <button type="button" class="inv-act-btn" title="Stock +/- " onclick="window.invAdjustStock('${i._id}')">📥</button>
          <button type="button" class="inv-act-btn danger" title="Delete" onclick="window.invDeleteItem('${i._id}')">🗑️</button>
        </td>
      </tr>`).join("");
  }

  async function loadInventory() {
    const body = document.getElementById("inventoryBody");
    if (body) body.innerHTML = "<tr><td colspan='11'>Loading...</td></tr>";
    try {
      const res = await fetch(`${API()}/api/reports/stock-summary`, { headers: headers() });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Load fail");
      allItems = data.items || [];
      updateStats(data.stats);
      renderTable();
    } catch (err) {
      if (body) body.innerHTML = `<tr><td colspan='11'>Error: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  async function saveItem() {
    const editId = document.getElementById("invEditId")?.value;
    const payload = getFormPayload();
    if (!payload.itemName) {
      if (typeof showToast === "function") showToast("Item naam zaroori hai.", "error");
      return;
    }
    try {
      const url = editId ? `${API()}/api/items/${editId}` : `${API()}/api/items`;
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Save fail");
      if (typeof showToast === "function") showToast("✅ " + (data.message || "Item save ho gaya."));
      resetForm();
      loadInventory();
      if (typeof window.refreshKhataPro === "function") window.refreshKhataPro();
    } catch (err) {
      if (typeof showToast === "function") showToast("❌ " + err.message, "error");
    }
  }

  window.invEditItem = function (id) {
    const item = allItems.find((i) => String(i._id) === String(id));
    if (!item) return;
    document.getElementById("invEditId").value = id;
    document.getElementById("invFormTitle").textContent = "✏️ Item Edit — " + item.itemName;
    document.getElementById("invItemName").value = item.itemName || "";
    setChipGroup("invUnitChips", "invUnit", item.unit || "Pcs");
    document.getElementById("invHsn").value = item.hsnCode || "";
    setChipGroup("invGstChips", "invGst", String(item.gstRate ?? 0));
    document.getElementById("invPurchase").value = item.purchasePrice ?? "";
    document.getElementById("invSelling").value = item.sellingPrice ?? "";
    document.getElementById("invOpening").value = item.stockQty ?? "";
    document.getElementById("invOpening").disabled = true;
    document.getElementById("invOpening").placeholder = "Stock adjust (📥) se badlo";
    document.getElementById("invReorder").value = item.reorderLevel ?? 5;
    document.getElementById("invGodown").value = item.godown || "Main Godown";
    document.getElementById("invBatch").value = item.batchNo || "";
    document.getElementById("invCancelEditBtn")?.classList.remove("hidden");
    document.getElementById("invItemName")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  window.invAdjustStock = async function (id) {
    const item = allItems.find((i) => String(i._id) === String(id));
    if (!item) return;
    const raw = prompt(
      `${item.itemName} — current stock: ${item.stockQty}\n\nStock IN (+) ya OUT (-) qty daalein:\nExample: +10 ya -3`,
      "+1"
    );
    if (raw == null || raw.trim() === "") return;
    const qtyChange = parseFloat(raw.replace(/,/g, ""));
    if (Number.isNaN(qtyChange) || qtyChange === 0) {
      if (typeof showToast === "function") showToast("Valid qty daalein (+ ya -).", "error");
      return;
    }
    const note = prompt("Reason (optional):", qtyChange > 0 ? "Stock In" : "Stock Out") || "";
    try {
      const res = await fetch(`${API()}/api/items/${id}/adjust-stock`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ qtyChange, note })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Adjust fail");
      if (typeof showToast === "function") showToast("✅ " + data.message);
      loadInventory();
      if (typeof window.refreshKhataPro === "function") window.refreshKhataPro();
    } catch (err) {
      if (typeof showToast === "function") showToast("❌ " + err.message, "error");
    }
  };

  window.invDeleteItem = async function (id) {
    const item = allItems.find((i) => String(i._id) === String(id));
    if (!confirm(`"${item?.itemName || "Item"}" delete karein?`)) return;
    try {
      const res = await fetch(`${API()}/api/items/${id}`, { method: "DELETE", headers: headers() });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Delete fail");
      if (typeof showToast === "function") showToast("Item delete ho gaya.");
      loadInventory();
      if (typeof window.refreshKhataPro === "function") window.refreshKhataPro();
    } catch (err) {
      if (typeof showToast === "function") showToast("❌ " + err.message, "error");
    }
  };

  window.bkLoadInventory = loadInventory;

  function wireEvents() {
    wireChipGroup("invUnitChips", "invUnit");
    wireChipGroup("invGstChips", "invGst");

    document.querySelectorAll("#invFilterChips .inv-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = btn.dataset.filter || "all";
        document.getElementById("invFilter").value = val;
        document.querySelectorAll("#invFilterChips .inv-chip").forEach((b) => {
          b.classList.toggle("active", b.dataset.filter === val);
        });
        renderTable();
      });
    });

    document.getElementById("invSaveBtn")?.addEventListener("click", saveItem);
    document.getElementById("invCancelEditBtn")?.addEventListener("click", resetForm);
    document.getElementById("invRefreshBtn")?.addEventListener("click", loadInventory);
    document.getElementById("invSearch")?.addEventListener("input", renderTable);
    document.querySelector('.tab-btn[data-tab="inventoryPanel"]')?.addEventListener("click", loadInventory);
  }

  if (document.getElementById("inventoryPanel")) {
    wireEvents();
  }
})();
