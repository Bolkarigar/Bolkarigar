/**
 * Shared client-side table pagination (5 / 10 / 20 rows).
 * Usage: const pag = bkCreatePaginator("myPrefix", () => renderMyTable());
 *        const pageRows = pag.slice(allRows);
 */
(function () {
  const instances = {};

  window.bkCreatePaginator = function (prefix, onChange) {
    if (instances[prefix]) return instances[prefix];

    const st = { page: 1, size: 10, total: 0 };

    function updateUI() {
      const totalPages = Math.max(1, Math.ceil(st.total / st.size) || 1);
      if (st.page > totalPages) st.page = totalPages;
      const start = st.total === 0 ? 0 : (st.page - 1) * st.size + 1;
      const end = Math.min(st.page * st.size, st.total);
      const info = document.getElementById(`${prefix}PaginationInfo`);
      const indicator = document.getElementById(`${prefix}PageIndicator`);
      const prev = document.getElementById(`${prefix}PrevBtn`);
      const next = document.getElementById(`${prefix}NextBtn`);
      if (info) info.textContent = st.total ? `Showing ${start}–${end} of ${st.total}` : "";
      if (indicator) indicator.textContent = `Page ${st.page} of ${totalPages}`;
      if (prev) prev.disabled = st.page <= 1;
      if (next) next.disabled = st.page >= totalPages || st.total === 0;
    }

    function slice(data) {
      const arr = Array.isArray(data) ? data : [];
      st.total = arr.length;
      updateUI();
      const start = (st.page - 1) * st.size;
      return arr.slice(start, start + st.size);
    }

    function reset() {
      st.page = 1;
    }

    const sizeSel = document.getElementById(`${prefix}PageSize`);
    if (sizeSel) {
      st.size = parseInt(sizeSel.value, 10) || 10;
      sizeSel.addEventListener("change", () => {
        st.size = parseInt(sizeSel.value, 10) || 10;
        st.page = 1;
        if (typeof onChange === "function") onChange();
      });
    }

    document.getElementById(`${prefix}PrevBtn`)?.addEventListener("click", () => {
      if (st.page > 1) {
        st.page--;
        if (typeof onChange === "function") onChange();
      }
    });

    document.getElementById(`${prefix}NextBtn`)?.addEventListener("click", () => {
      const totalPages = Math.max(1, Math.ceil(st.total / st.size) || 1);
      if (st.page < totalPages) {
        st.page++;
        if (typeof onChange === "function") onChange();
      }
    });

    const api = { slice, reset, updateUI, getState: () => ({ ...st }) };
    instances[prefix] = api;
    return api;
  };
})();
