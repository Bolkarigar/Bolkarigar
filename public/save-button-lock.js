/**
 * Prevents double-clicks on Save buttons until async save completes.
 */
(function () {
  const BUSY = "bk-save-busy";
  const SAVE_CLS = "bk-save-btn";

  function isBusy(btn) {
    return !!(btn && (btn.disabled || btn.dataset.bkSaving === "1"));
  }

  window.bkIsSaveBusy = isBusy;

  window.bkWithSaveLock = async function (btn, work, options) {
    if (!btn || typeof work !== "function" || isBusy(btn)) return undefined;
    const opts = options || {};
    const loadingText = opts.loadingText || "⏳ Saving...";
    const origHtml = btn.innerHTML;

    btn.dataset.bkSaving = "1";
    btn.disabled = true;
    btn.classList.add(BUSY, SAVE_CLS);
    btn.setAttribute("aria-busy", "true");
    if (opts.showLoading !== false) btn.innerHTML = loadingText;

    try {
      return await work();
    } finally {
      btn.dataset.bkSaving = "0";
      btn.disabled = false;
      btn.classList.remove(BUSY);
      btn.removeAttribute("aria-busy");
      btn.innerHTML = origHtml;
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", markSaveButtons);
  } else {
    markSaveButtons();
  }
})();
