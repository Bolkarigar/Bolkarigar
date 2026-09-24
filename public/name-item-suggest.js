/**
 * Accounts Orbit — type-to-suggest for party names and item names.
 * Existing ledger search boxes keep their own handlers; this covers the rest.
 */
(function () {
  "use strict";

  const ATTACHED = new Set();

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function uniqueByLabel(items, getLabel) {
    const seen = new Set();
    const out = [];
    (items || []).forEach((item) => {
      const label = String(getLabel(item) || "").trim();
      if (!label) return;
      const key = label.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(item);
    });
    return out;
  }

  function filterItems(items, query, getLabel) {
    const q = String(query || "").trim().toLowerCase();
    const starts = [];
    const contains = [];
    items.forEach((item) => {
      const name = String(getLabel(item) || "").trim();
      if (!name) return;
      if (!q) {
        starts.push(item);
        return;
      }
      const lower = name.toLowerCase();
      if (lower.startsWith(q)) starts.push(item);
      else if (lower.includes(q)) contains.push(item);
    });
    return [...starts, ...contains].slice(0, 12);
  }

  function getLedgers() {
    if (typeof window.aoGetLedgers === "function") return window.aoGetLedgers() || [];
    return [];
  }

  function getStockItems() {
    if (typeof window.aoGetItems === "function") return window.aoGetItems() || [];
    return [];
  }

  function getProjects() {
    const fromState = (window.state && window.state.projects) || [];
    const extra = [];
    document.querySelectorAll("#labourBody tr td:nth-child(3), #raBillBody tr td:nth-child(2), #materialSlipBody tr td:nth-child(2)")
      .forEach((td) => extra.push({ name: td.textContent.trim() }));
    return uniqueByLabel(
      [...fromState.map((p) => ({ name: p.name || p.projectName || "" })), ...extra],
      (p) => p.name
    );
  }

  function getEmployees() {
    if (typeof window.aoGetEmployees === "function") {
      return (window.aoGetEmployees() || []).map((e) => ({ name: e.name || "" }));
    }
    return [];
  }

  function getWorkers() {
    const names = [];
    document.querySelectorAll("#labourBody tr td:nth-child(2)").forEach((td) => {
      names.push({ name: td.textContent.trim() });
    });
    return uniqueByLabel(names, (w) => w.name);
  }

  function namesFromKind(kind) {
    if (kind === "item") {
      return uniqueByLabel(getStockItems(), (i) => i.itemName);
    }
    if (kind === "project") return getProjects();
    if (kind === "employee") {
      const emp = getEmployees();
      return emp.length ? uniqueByLabel(emp, (e) => e.name) : getWorkers();
    }
    if (kind === "worker") {
      const workers = getWorkers();
      return workers.length ? workers : getEmployees();
    }
    return uniqueByLabel(getLedgers(), (l) => l.partyName);
  }

  function labelOf(item, kind) {
    if (kind === "item") return item.itemName || item.label || "";
    if (kind === "project" || kind === "employee" || kind === "worker") return item.name || item.partyName || "";
    return item.partyName || item.name || item.itemName || item.label || "";
  }

  function metaOf(item, kind) {
    if (kind === "item") {
      return [item.hsnCode, item.unit, item.stockQty != null ? `Stock ${item.stockQty}` : ""]
        .filter(Boolean)
        .join(" · ");
    }
    if (kind === "party") {
      return [item.ledgerGroup, item.address || item.mobile, item.gstin].filter(Boolean).join(" · ");
    }
    return item.customer || item.site || item.designation || "";
  }

  function fillItemFields(item, map) {
    if (!item || !map) return;
    Object.keys(map).forEach((id) => {
      const el = document.getElementById(id);
      if (!el || el.value) return;
      const val = item[map[id]];
      if (val == null || val === "") return;
      el.value = val;
    });
  }

  function keySafe(el) {
    return (el && el.id) || "aoField" + Math.random().toString(36).slice(2);
  }

  function attach(inputOrId, kind, extra) {
    const input = typeof inputOrId === "string" ? document.getElementById(inputOrId) : inputOrId;
    if (!input || input.dataset.aoSuggest === "1") return;
    input.dataset.aoSuggest = "1";
    input.setAttribute("autocomplete", "off");
    input.removeAttribute("list");

    let wrap = input.closest(".inv-party-autocomplete");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "inv-party-autocomplete ao-suggest-wrap";
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
    }
    let list = document.getElementById((input.id || keySafe(input)) + "SuggestList");
    if (!list) {
      list = document.createElement("ul");
      list.id = (input.id || keySafe(input)) + "SuggestList";
      list.className = "inv-party-suggest ao-suggest-float hidden";
      list.setAttribute("role", "listbox");
      document.body.appendChild(list);
    }

    const key = input.id || Math.random().toString(36).slice(2);
    ATTACHED.add(key);
    let picking = false;

    function pick(item) {
      picking = true;
      input.value = labelOf(item, kind);
      list.classList.add("hidden");
      if (kind === "item") {
        if (input.id === "productName" && typeof window.applyStockItemToInvoiceFields === "function") {
          window.applyStockItemToInvoiceFields(input.value);
        } else if (input.id === "pvItemNameInput" && typeof window.applyPurchaseStockItemToFields === "function") {
          window.applyPurchaseStockItemToFields(input.value);
        } else if (input.id === "estItemName") {
          fillItemFields(item, { estItemHsn: "hsnCode", estItemPrice: "sellingPrice", estItemUnit: "unit", estItemGst: "gstRate" });
        } else if (input.id === "invItemName") {
          fillItemFields(item, { invHsn: "hsnCode", invPurchase: "purchasePrice", invSelling: "sellingPrice" });
        } else if (input.id === "itemNameInput") {
          fillItemFields(item, {
            itemHsnInput: "hsnCode",
            itemUnitInput: "unit",
            itemGstRateInput: "gstRate",
            itemPurchasePriceInput: "purchasePrice",
            itemSellingPriceInput: "sellingPrice"
          });
        }
      } else if (kind === "party") {
        if (input.id === "ledgerNameInput") {
          const group = document.getElementById("ledgerGroupInput");
          const gst = document.getElementById("ledgerGstinInput");
          const addr = document.getElementById("ledgerAddressInput");
          if (group && item.ledgerGroup) group.value = item.ledgerGroup;
          if (gst && item.gstin && !gst.value) gst.value = item.gstin;
          if (addr && (item.address || item.mobile) && !addr.value) addr.value = item.address || item.mobile;
        }
        if (input.id === "estCustomer") {
          const gst = document.getElementById("estCustomerGstin");
          const addr = document.getElementById("estCustomerAddress");
          const state = document.getElementById("estCustomerState");
          if (gst && item.gstin && !gst.value) gst.value = item.gstin;
          if (addr && (item.address || item.mobile) && !addr.value) addr.value = item.address || item.mobile;
          if (state && item.gstin && !state.value && typeof window.stateFromGstinFrontend === "function") {
            state.value = window.stateFromGstinFrontend(item.gstin) || state.value;
          }
        }
        if (extra && extra.onPick) extra.onPick(item);
      }
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      picking = false;
    }

    function placeList() {
      const r = input.getBoundingClientRect();
      list.style.position = "fixed";
      list.style.left = Math.max(8, r.left) + "px";
      list.style.top = (r.bottom + 4) + "px";
      list.style.width = Math.max(r.width, 180) + "px";
      list.style.right = "auto";
      list.style.zIndex = "8000";
    }

    function renderMatches(matches) {
      if (!matches.length) {
        list.classList.add("hidden");
        list.innerHTML = "";
        return;
      }
      list.innerHTML = matches.map((item, i) => {
        const meta = metaOf(item, kind);
        return `<li role="option" data-idx="${i}" tabindex="0">${esc(labelOf(item, kind))}${
          meta ? `<span class="party-meta">${esc(meta)}</span>` : ""
        }</li>`;
      }).join("");
      list.classList.remove("hidden");
      placeList();
      list._matches = matches;
      list.querySelectorAll("li").forEach((li) => {
        li.addEventListener("mousedown", (e) => {
          e.preventDefault();
          const idx = parseInt(li.dataset.idx, 10);
          if (list._matches && list._matches[idx]) pick(list._matches[idx]);
        });
      });
    }

    function show() {
      if (picking) return;
      const draw = () => renderMatches(filterItems(namesFromKind(kind), input.value, (item) => labelOf(item, kind)));
      if (kind === "party" && !getLedgers().length && typeof window.aoEnsureLedgers === "function") {
        window.aoEnsureLedgers().then(draw);
        return;
      }
      if (kind === "item" && !getStockItems().length && typeof window.aoEnsureItems === "function") {
        window.aoEnsureItems().then(draw);
        return;
      }
      draw();
    }

    input.addEventListener("input", show);
    input.addEventListener("focus", show);
    input.addEventListener("keydown", (e) => {
      if (list.classList.contains("hidden")) return;
      const items = [...list.querySelectorAll("li")];
      if (!items.length) return;
      let active = items.findIndex((li) => li.classList.contains("active"));
      if (e.key === "ArrowDown") {
        e.preventDefault();
        active = (active + 1) % items.length;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        active = active <= 0 ? items.length - 1 : active - 1;
      } else if (e.key === "Enter") {
        const idx = active >= 0 ? active : 0;
        const match = list._matches && list._matches[idx];
        const typed = input.value.trim().toLowerCase();
        const matchName = match ? String(labelOf(match, kind)).toLowerCase() : "";
        if (match && typed && (active >= 0 || matchName.startsWith(typed) || matchName.includes(typed))) {
          e.preventDefault();
          e.stopPropagation();
          pick(match);
        }
        return;
      } else if (e.key === "Escape") {
        list.classList.add("hidden");
        return;
      } else {
        return;
      }
      items.forEach((li, i) => li.classList.toggle("active", i === active));
    });

    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target) && !list.contains(e.target)) list.classList.add("hidden");
    });
    window.addEventListener("resize", () => {
      if (!list.classList.contains("hidden")) placeList();
    });
    document.addEventListener("scroll", () => {
      if (!list.classList.contains("hidden")) placeList();
    }, true);
  }

  function initStatic() {
    const partyIds = [
      "ledgerNameInput",
      "projectCustomer",
      "raClientInput",
      "estCustomer",
      "payCustomerName",
      "voiceCustomer",
      "bmPartyName",
      "bmInParty",
      "ovCustomerSearch",
      "salesSearchInput",
      "ovPurchaseSearch",
      "ovPaymentSearch",
      "ovReceiptSearch"
    ];
    const itemIds = [
      "productName",
      "pvItemNameInput",
      "itemNameInput",
      "invItemName",
      "estItemName",
      "voiceProduct",
      "msItemInput"
    ];
    const projectIds = [
      "projectName",
      "labourProjectInput",
      "raProjectInput",
      "msProjectInput",
      "estProject",
      "voiceProject"
    ];

    partyIds.forEach((id) => attach(id, "party"));
    itemIds.forEach((id) => attach(id, "item"));
    projectIds.forEach((id) => attach(id, "project"));
    attach("labourNameInput", "worker");
    attach("payrollEmpName", "employee");
    attach("msIssuedToInput", "worker");
  }

  window.aoAttachNameSuggest = attach;
  window.aoInitNameItemSuggests = initStatic;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initStatic);
  } else {
    initStatic();
  }
})();
