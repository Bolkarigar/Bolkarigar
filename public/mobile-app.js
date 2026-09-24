/**
 * Accounts Orbit phone shell. Desktop is unchanged.
 * Revert: localStorage.setItem('ao_phone_ui','off') then refresh.
 */
(function () {
  "use strict";

  var MQ = "(max-width: 820px)";
  var MAIN = {
    overviewPanel: "home",
    businessRecordsPanel: "home",
    invoicePanel: "sale",
    purchasePanel: "buy",
    ledgerPanel: "khata",
    khataLedgersPanel: "khata"
  };

  function wantsPhone() {
    if (localStorage.getItem("ao_phone_ui") === "off") return false;
    return window.matchMedia(MQ).matches || document.documentElement.classList.contains("capacitor-native");
  }

  function applyMode() {
    document.documentElement.classList.toggle("ao-phone", wantsPhone());
    var bar = document.getElementById("aoPhoneTabbar");
    if (bar) bar.hidden = !wantsPhone();
    if (!wantsPhone()) closeSheets();
    if (wantsPhone()) {
      var active = document.querySelector(".panel.active");
      if (active) setActiveTab(active.id);
    }
  }

  function isSheetOpen(id) {
    var el = document.getElementById(id);
    return !!(el && !el.classList.contains("hidden"));
  }

  function closeSheets() {
    ["aoPhoneMore", "aoPhoneAccount"].forEach(function (id) {
      document.getElementById(id)?.classList.add("hidden");
    });
    document.body.classList.remove("ao-phone-more-open", "topbar-more-open");
    document.body.style.overflow = "";
    document.getElementById("topbarMoreBtn")?.setAttribute("aria-expanded", "false");
  }

  function openSheet(id) {
    closeSheets();
    if (id === "aoPhoneMore") fillMore();
    document.getElementById(id)?.classList.remove("hidden");
    document.body.classList.add("ao-phone-more-open");
    document.body.style.overflow = "hidden";
    if (id === "aoPhoneAccount") {
      document.getElementById("topbarMoreBtn")?.setAttribute("aria-expanded", "true");
    }
  }

  function toggleSheet(id) {
    if (isSheetOpen(id)) closeSheets();
    else openSheet(id);
  }

  window.aoPhoneToggleMore = function () { toggleSheet("aoPhoneMore"); };
  window.aoPhoneToggleAccount = function () { toggleSheet("aoPhoneAccount"); };
  window.aoPhoneCloseSheets = closeSheets;

  function setActiveTab(panelId) {
    var key = MAIN[panelId] || "more";
    document.querySelectorAll(".ao-phone-tab").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.phoneKey === key);
    });
  }

  function fillMore() {
    var grid = document.getElementById("aoPhoneMoreGrid");
    if (!grid) return;
    var skip = {
      overviewPanel: 1,
      invoicePanel: 1,
      purchasePanel: 1,
      ledgerPanel: 1
    };
    var html = "";
    document.querySelectorAll("#appSidebar .tab-btn[data-tab]").forEach(function (btn) {
      var id = btn.dataset.tab;
      if (!id || skip[id]) return;
      if (btn.style.display === "none") return;
      var label = (btn.textContent || "").replace(/\s+/g, " ").trim();
      html += '<button type="button" class="ao-phone-more-btn" data-tab="' + id + '">' +
        label + "</button>";
    });
    grid.innerHTML = html;
    grid.dataset.ready = "1";
    grid.querySelectorAll("button[data-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        closeSheets();
        if (typeof window.openPanel === "function") window.openPanel(btn.dataset.tab);
      });
    });
  }

  window.aoPhoneRefreshMore = fillMore;

  function bindBar() {
    document.querySelectorAll(".ao-phone-tab[data-phone-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        closeSheets();
        if (typeof window.openPanel === "function") window.openPanel(btn.dataset.phoneTab);
      });
    });
    document.getElementById("aoPhoneMoreBtn")?.addEventListener("click", function () {
      toggleSheet("aoPhoneMore");
    });
    document.getElementById("topbarMoreBtn")?.addEventListener("click", function (e) {
      if (!wantsPhone()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      toggleSheet("aoPhoneAccount");
    }, true);
    ["aoPhoneMore", "aoPhoneAccount"].forEach(function (id) {
      document.getElementById(id)?.addEventListener("click", function (e) {
        if (e.target.id === id || e.target.getAttribute("data-ao-close") === "1") closeSheets();
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && document.body.classList.contains("ao-phone-more-open")) {
        closeSheets();
      }
    });
    document.getElementById("aoPhoneMoreProfile")?.addEventListener("click", function () {
      closeSheets();
      document.getElementById("businessProfileBtn")?.click();
    });
    document.getElementById("aoPhoneAccProfile")?.addEventListener("click", function () {
      closeSheets();
      document.getElementById("businessProfileBtn")?.click();
    });
    document.getElementById("aoPhoneAccTheme")?.addEventListener("click", function () {
      document.getElementById("themeToggle")?.click();
    });
    document.getElementById("aoPhoneMoreLogout")?.addEventListener("click", function () {
      closeSheets();
      document.getElementById("logoutBtn")?.click();
    });
    document.getElementById("aoPhoneAccLogout")?.addEventListener("click", function () {
      closeSheets();
      document.getElementById("logoutBtn")?.click();
    });
  }

  function skipTableWrap(wrap) {
    if (!wrap || wrap.classList.contains("inv-tax-table-wrap")) return true;
    if (wrap.closest(".inv-tax-footer")) return true;
    if (wrap.closest("#ledgerPanel, #khataLedgersPanel, #mediaPanel, #calcPanel")) return true;
    var tb = wrap.querySelector("tbody");
    if (!tb) return true;
    return /^(invoiceBody|pvItemsBody|busyTaxSummaryBody|pvTaxSummaryBody|pvTaxBody|ledgerBody|khataLedgersBody)$/.test(tb.id || "");
  }

  function hasNearbySearch(wrap) {
    if (wrap.previousElementSibling && wrap.previousElementSibling.classList.contains("ao-phone-table-search")) return true;
    if (wrap.previousElementSibling && wrap.previousElementSibling.classList.contains("ao-phone-list-tools")) return true;
    var parent = wrap.parentElement;
    if (!parent) return false;
    var kids = Array.prototype.slice.call(parent.children);
    var idx = kids.indexOf(wrap);
    for (var i = Math.max(0, idx - 3); i < idx; i++) {
      var node = kids[i];
      if (!node) continue;
      if (node.matches && node.matches("input.panel-search-input, input[type='search'], .modify-search-wrap, .overview-rec-pane-toolbar, .ao-phone-table-search")) return true;
      if (node.querySelector && node.querySelector("input.panel-search-input, input[type='search'], .ao-phone-table-search, #modifySearchInput")) return true;
    }
    return false;
  }

  function filterTableRows(wrap, query) {
    var q = String(query || "").trim().toLowerCase();
    wrap.querySelectorAll("tbody tr").forEach(function (tr) {
      var empty = tr.querySelector("td[colspan]");
      if (empty) {
        tr.style.display = q ? "none" : "";
        return;
      }
      var text = (tr.textContent || "").replace(/\s+/g, " ").toLowerCase();
      tr.style.display = !q || text.indexOf(q) !== -1 ? "" : "none";
    });
  }

  function ensureTableSearch() {
    if (!wantsPhone()) return;
    document.querySelectorAll(".table-wrap").forEach(function (wrap) {
      if (skipTableWrap(wrap) || hasNearbySearch(wrap)) return;
      var box = document.createElement("div");
      box.className = "ao-phone-list-tools";
      var input = document.createElement("input");
      input.type = "search";
      input.className = "ao-phone-table-search";
      input.placeholder = "Search name, item, bill...";
      input.setAttribute("autocomplete", "off");
      input.addEventListener("input", function () {
        filterTableRows(wrap, input.value);
      });
      box.appendChild(input);
      wrap.parentNode.insertBefore(box, wrap);
      var tbody = wrap.querySelector("tbody");
      if (tbody && wrap.dataset.aoSearchObs !== "1") {
        wrap.dataset.aoSearchObs = "1";
        new MutationObserver(function () {
          filterTableRows(wrap, input.value);
        }).observe(tbody, { childList: true });
      }
    });
  }

  window.aoPhoneOnPanel = function (id) {
    if (!wantsPhone()) return;
    setActiveTab(id);
    closeSheets();
    setTimeout(ensureTableSearch, 50);
  };

  applyMode();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      applyMode();
      bindBar();
      ensureTableSearch();
    });
  } else {
    bindBar();
    ensureTableSearch();
  }
  window.matchMedia(MQ).addEventListener("change", applyMode);
  if (typeof window.enhanceMobileTables === "function") {
    var _enhance = window.enhanceMobileTables;
    window.enhanceMobileTables = function (root) {
      _enhance(root);
      ensureTableSearch();
    };
  }
})();
