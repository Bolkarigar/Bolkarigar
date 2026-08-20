/**
 * BolKarigar — mobile responsive helpers
 * Tables ko phone par card layout mein badalta hai (scroll ki jagah)
 */
(function () {
  function getHeaders(table) {
    const row = table.querySelector("thead tr");
    if (!row) return [];
    return Array.from(row.querySelectorAll("th")).map((th) =>
      (th.textContent || "").replace(/\s+/g, " ").trim()
    );
  }

  function labelTable(table) {
    const headers = getHeaders(table);
    if (!headers.length) return;
    table.querySelectorAll("tbody tr").forEach((tr) => {
      const cells = tr.querySelectorAll("td");
      cells.forEach((td, i) => {
        const label = headers[i] || "";
        if (label) td.setAttribute("data-label", label);
      });
    });
  }

  function enhanceTables(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll(".table-wrap").forEach((wrap) => {
      wrap.classList.add("mobile-ready");
      const table = wrap.querySelector("table");
      if (table) {
        table.querySelectorAll("tbody td[data-label]").forEach((td) => {
          td.removeAttribute("data-label");
        });
        labelTable(table);
      }
    });
  }

  function bindObservers() {
    document.querySelectorAll(".table-wrap").forEach((wrap) => {
      if (wrap.dataset.mobileObs) return;
      wrap.dataset.mobileObs = "1";
      const tbody = wrap.querySelector("tbody");
      if (!tbody) return;
      const obs = new MutationObserver(() => {
        const table = wrap.querySelector("table");
        if (table) {
          table.querySelectorAll("tbody td[data-label]").forEach((td) => {
            td.removeAttribute("data-label");
          });
          labelTable(table);
        }
      });
      obs.observe(tbody, { childList: true, subtree: true });
    });
  }

  window.enhanceMobileTables = enhanceTables;

  function init() {
    enhanceTables();
    bindObservers();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.addEventListener("resize", () => {
    clearTimeout(window._bkResizeTables);
    window._bkResizeTables = setTimeout(() => enhanceTables(), 150);
  });
})();
