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
    if (!wantsPhone()) closeMore();
    if (wantsPhone()) {
      var active = document.querySelector(".panel.active");
      if (active) setActiveTab(active.id);
    }
  }

  function closeMore() {
    document.getElementById("aoPhoneMore")?.classList.add("hidden");
  }

  function openMore() {
    fillMore();
    document.getElementById("aoPhoneMore")?.classList.remove("hidden");
  }

  function setActiveTab(panelId) {
    var key = MAIN[panelId] || "more";
    document.querySelectorAll(".ao-phone-tab").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.phoneKey === key);
    });
  }

  function fillMore() {
    var grid = document.getElementById("aoPhoneMoreGrid");
    if (!grid || grid.dataset.ready === "1") return;
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
      var label = (btn.textContent || "").replace(/\s+/g, " ").trim();
      html += '<button type="button" class="ao-phone-more-btn" data-tab="' + id + '">' +
        label + "</button>";
    });
    grid.innerHTML = html;
    grid.dataset.ready = "1";
    grid.querySelectorAll("button[data-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        closeMore();
        if (typeof window.openPanel === "function") window.openPanel(btn.dataset.tab);
      });
    });
  }

  function bindBar() {
    document.querySelectorAll(".ao-phone-tab[data-phone-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        closeMore();
        if (typeof window.openPanel === "function") window.openPanel(btn.dataset.phoneTab);
      });
    });
    document.getElementById("aoPhoneMoreBtn")?.addEventListener("click", function () {
      var sheet = document.getElementById("aoPhoneMore");
      if (sheet && !sheet.classList.contains("hidden")) closeMore();
      else openMore();
    });
    document.getElementById("aoPhoneMore")?.addEventListener("click", function (e) {
      if (e.target.id === "aoPhoneMore") closeMore();
    });
    document.getElementById("aoPhoneMoreProfile")?.addEventListener("click", function () {
      closeMore();
      document.getElementById("businessProfileBtn")?.click();
    });
    document.getElementById("aoPhoneMoreAi")?.addEventListener("click", function () {
      closeMore();
      document.getElementById("liveAiToggle")?.click();
    });
    document.getElementById("aoPhoneMoreTheme")?.addEventListener("click", function () {
      document.getElementById("themeToggle")?.click();
    });
    document.getElementById("aoPhoneMoreLogout")?.addEventListener("click", function () {
      closeMore();
      document.getElementById("logoutBtn")?.click();
    });
  }

  window.aoPhoneOnPanel = function (id) {
    if (!wantsPhone()) return;
    setActiveTab(id);
    closeMore();
  };

  applyMode();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      applyMode();
      bindBar();
    });
  } else {
    bindBar();
  }
  window.matchMedia(MQ).addEventListener("change", applyMode);
})();
