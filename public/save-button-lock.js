/**
 * Prevents double-clicks on Save buttons until async save completes.
 */
(function () {
  const BUSY = "bk-save-busy";
  const SAVE_CLS = "bk-save-btn";
  const inFlight = new Set();

  function lockKey(btn) {
    if (!btn) return "";
    return btn.id || btn.getAttribute("data-bk-save-key") || String(btn);
  }

  function applyLock(btn, loadingText, showLoading) {
    if (!btn) return;
    btn.dataset.bkSaving = "1";
    btn.disabled = true;
    btn.classList.add(BUSY, SAVE_CLS);
    btn.setAttribute("aria-busy", "true");
    btn.setAttribute("aria-disabled", "true");
    btn.style.cursor = "not-allowed";
    if (showLoading !== false && loadingText) btn.innerHTML = loadingText;
  }

  function releaseLock(btn, origHtml) {
    if (!btn) return;
    btn.dataset.bkSaving = "0";
    btn.disabled = false;
    btn.classList.remove(BUSY);
    btn.removeAttribute("aria-busy");
    btn.removeAttribute("aria-disabled");
    btn.style.cursor = "";
    if (origHtml != null) btn.innerHTML = origHtml;
  }

  window.bkIsSaveBusy = function (btn) {
    if (!btn) return false;
    return inFlight.has(lockKey(btn)) || btn.dataset.bkSaving === "1";
  };

  window.bkWithSaveLock = async function (btn, work, options) {
    if (!btn || typeof work !== "function") return undefined;
    const key = lockKey(btn);
    if (inFlight.has(key)) return undefined;

    const opts = options || {};
    const loadingText = opts.loadingText || "⏳ Saving...";
    const minMs = typeof opts.minLockMs === "number" ? opts.minLockMs : 900;
    const origHtml = btn.innerHTML;
    const extraBtns = (opts.alsoLock || [])
      .map((id) => (typeof id === "string" ? document.getElementById(id) : id))
      .filter(Boolean);
    const extraHtml = extraBtns.map((b) => ({ btn: b, html: b.innerHTML }));

    inFlight.add(key);
    applyLock(btn, loadingText, opts.showLoading);
    extraBtns.forEach((b) => applyLock(b, null, false));

    const started = Date.now();
    try {
      return await work();
    } finally {
      const wait = Math.max(0, minMs - (Date.now() - started));
      if (wait) await new Promise((r) => setTimeout(r, wait));
      releaseLock(btn, origHtml);
      extraHtml.forEach(({ btn: b, html }) => releaseLock(b, html));
      inFlight.delete(key);
    }
  };

  const SAVE_IDS = [
    "saveInvoiceBtn",
    "savePrintInvoiceBtn",
    "saveVoucherBtn",
    "savePurchaseVoucherBtn",
    "savePaymentVoucherBtn",
    "saveReceiptVoucherBtn",
    "invSaveBtn",
    "modifySaveBtn",
    "payrollSaveAttBtn",
    "payrollSaveSettingsBtn",
    "btnSaveProfile",
    "bcSaveBtn",
    "savePaymentBtn"
  ];

  function markSaveButtons() {
    SAVE_IDS.forEach((id) => {
      document.getElementById(id)?.classList.add(SAVE_CLS);
    });
  }

  /** Block duplicate clicks before handlers run (capture phase). */
  document.addEventListener(
    "click",
    function (e) {
      const btn = e.target.closest("button");
      if (!btn) return;
      if (btn.dataset.bkSaving === "1" || btn.classList.contains(BUSY) || inFlight.has(lockKey(btn))) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    },
    true
  );

  document.addEventListener(
    "mousedown",
    function (e) {
      const btn = e.target.closest("button");
      if (!btn) return;
      if (btn.dataset.bkSaving === "1" || btn.classList.contains(BUSY) || inFlight.has(lockKey(btn))) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    },
    true
  );

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", markSaveButtons);
  } else {
    markSaveButtons();
  }
})();
