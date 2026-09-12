/**
 * BolKarigar — Enter key moves focus to next field (Tally / Busy style).
 * Works across panels, modals, and forms. Loaded last so autocomplete handlers run first.
 */
(function () {
  "use strict";

  const SKIP_IDS = new Set(["liveAiInput"]);
  const SKIP_BTN =
    ".secondary, .btn-close, .btn-cancel, .inv-btn-quit, .theme-btn, .voice-btn, .mobile-menu-btn, .toggle-password, .sidebar-close, .forgot-link";
  const SKIP_BTN_NOT = SKIP_BTN.split(",").map((s) => `:not(${s.trim()})`).join("");

  const FIELD_SEL = [
    'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([disabled]):not([readonly]):not([tabindex="-1"])',
    "select:not([disabled]):not([tabindex='-1'])",
    "textarea:not([disabled]):not([readonly]):not([tabindex='-1'])",
    `button:not([disabled]):not([tabindex="-1"])${SKIP_BTN_NOT}`
  ].join(", ");

  const SCOPE_SELECTORS = [
    "#staffSignupBox",
    ".journal-side",
    ".inv-form-card",
    ".voucher-jn-simple",
    ".voucher-form-wrap",
    ".modify-edit-form",
    ".modify-step-search",
    ".expense-box",
    ".login-card",
    ".bc-editor-sidebar",
    ".payroll-form-card",
    "form"
  ];

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    if (el.closest(".hidden")) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    const modal = el.closest(".modal-overlay");
    if (modal && modal.classList.contains("hidden")) return false;
    const panel = el.closest(".panel");
    if (panel && !panel.classList.contains("active")) return false;
    if (el.id === "staffSignupBox" && el.style.display === "none") return false;
    const st = window.getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden") return false;
    if (st.opacity === "0" && document.activeElement !== el) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0 && el.tagName !== "INPUT") return false;
    return true;
  }

  function getScope(el) {
    const modalOverlay = el.closest(".modal-overlay");
    if (modalOverlay && !modalOverlay.classList.contains("hidden")) {
      return modalOverlay.querySelector(".modal-box") || modalOverlay;
    }
    for (const sel of SCOPE_SELECTORS) {
      const node = el.closest(sel);
      if (!node) continue;
      if (node.id === "staffSignupBox" && node.style.display === "none") continue;
      if (isVisible(node)) return node;
    }
    const panel = el.closest(".panel.active");
    if (panel) return panel;
    return document.body;
  }

  function getFocusables(scope) {
    return [...scope.querySelectorAll(FIELD_SEL)].filter(isVisible);
  }

  function findSubmitAction(scope) {
    const form = scope.closest("form") || (scope.tagName === "FORM" ? scope : null);
    if (form) {
      const submit = form.querySelector('button[type="submit"]:not([disabled]), input[type="submit"]:not([disabled])');
      if (submit && isVisible(submit)) return { type: "form", el: form, submit };
    }
    const ids = [
      "saveVoucherBtn", "addInvoiceBtn", "savePurchaseVoucherBtn", "savePaymentVoucherBtn",
      "saveReceiptVoucherBtn", "savePaymentBtn", "submitForgotBtn", "submitNewPasswordBtn",
      "staffSignupBtn", "invSaveBtn", "modifySaveBtn", "generateQrBtn", "convertBtn",
      "btnSaveProfile", "bcSaveBtn", "payrollSaveAttBtn", "payrollSaveSettingsBtn", "saveNotesBtn"
    ];
    for (const id of ids) {
      const btn = document.getElementById(id);
      if (btn && scope.contains(btn) && isVisible(btn) && !btn.disabled) return { type: "click", el: btn };
    }
    const primary =
      scope.querySelector(".modal-actions .btn-submit:not([disabled])") ||
      scope.querySelector(".btn-row button:not(.secondary):not(.btn-close):not([disabled])") ||
      scope.querySelector("button.login-btn:not([disabled])") ||
      scope.querySelector("button.inv-add-btn:not([disabled])") ||
      scope.querySelector("button[type='submit']:not([disabled])");
    if (primary && isVisible(primary)) return { type: "click", el: primary };
    return null;
  }

  function selectField(el) {
    if (el && typeof el.select === "function" && el.type !== "number" && el.type !== "date") {
      try { el.select(); } catch (_) { /* ignore */ }
    }
  }

  function moveNext(current) {
    const scope = getScope(current);
    const focusables = getFocusables(scope);
    const idx = focusables.indexOf(current);
    if (idx < 0) return;

    if (idx < focusables.length - 1) {
      const next = focusables[idx + 1];
      next.focus();
      selectField(next);
      return;
    }

    const action = findSubmitAction(scope);
    if (action?.type === "form") {
      action.el.requestSubmit(action.submit || undefined);
      return;
    }
    if (action?.type === "click") {
      action.el.focus();
      action.el.click();
    }
  }

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Enter") return;
      if (e.isComposing || e.repeat) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.defaultPrevented) return;

      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.tagName === "BUTTON" || target.tagName === "A") return;
      if (target.isContentEditable) return;
      if (target.dataset.bkEnterSkip === "1") return;
      if (SKIP_IDS.has(target.id)) return;
      if (!target.matches("input, select, textarea")) return;
      if (target.tagName === "TEXTAREA" && e.shiftKey) return;

      e.preventDefault();
      moveNext(target);
    },
    false
  );

  window.BK_enterNav = { getScope, getFocusables, moveNext };
})();
