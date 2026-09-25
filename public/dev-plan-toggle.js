/**
 * Dev UI — Pro ₹99 ↔ Business ₹299 toggle (testing). Baad me hata dena.
 */
(function () {
  const API = () => window.API_URL || window.location.origin;
  const getToken = () => localStorage.getItem("bk_token") || localStorage.getItem("token") || "";

  const PRO_PLAN_TABS = [
    "overviewPanel", "businessRecordsPanel", "invoicePanel", "purchasePanel", "paymentVoucherPanel", "receiptVoucherPanel",
    "voicePanel", "inventoryPanel",
    "ledgerPanel", "khataLedgersPanel", "khataItemsPanel", "khataVoucherPanel", "khataDaybookPanel",
    "modifyPanel",
    "galleryPanel", "todoPanel", "businessCardPanel", "securityPanel", "helpPanel", "myPlanPanel"
  ];

  (function readDevPlanUrlFlag() {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get("bkDevPlan") === "1") {
        localStorage.setItem("bk_force_dev_plan", "1");
        p.delete("bkDevPlan");
        const q = p.toString();
        window.history.replaceState({}, "", window.location.pathname + (q ? "?" + q : "") + window.location.hash);
      }
    } catch (_) { /* ignore */ }
  })();

  let wired = false;
  let syncingToggle = false;
  let switching = false;

  function isLocalHost() {
    const h = location.hostname;
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
  }

  function isDevPlanForced() {
    if (window.Capacitor?.isNativePlatform?.()) return false;
    return isLocalHost();
  }

  function currentPlanSide() {
    return window._bkAccountInfo?.subscription?.fullAccess ? "business" : "pro";
  }

  function buildClientSubscription(planId) {
    const isBiz = planId === "business";
    const prev = window._bkAccountInfo?.subscription || {};
    return {
      ...prev,
      plan: isBiz ? "business" : "pro",
      planName: isBiz ? "Business" : "Pro Shop",
      planLabel: isBiz ? "Business ₹299" : "Pro ₹99",
      priceMonthly: isBiz ? 299 : 99,
      subscriptionStatus: isBiz ? "active" : "trial",
      isActive: true,
      isTrial: !isBiz,
      isExpired: false,
      daysLeft: prev.daysLeft || 30,
      fullAccess: isBiz,
      tallySync: isBiz,
      showInstallApp: true,
      allowedTabs: isBiz ? null : [...PRO_PLAN_TABS],
      message: isBiz
        ? "🧪 Test view: Business ₹299 plan"
        : "🧪 Test view: Pro ₹99 plan"
    };
  }

  function applyPlanToUI(planId, serverSub) {
    const me = window._bkAccountInfo;
    if (!me) return;
    me.subscription = serverSub || buildClientSubscription(planId);
    if (typeof applyRoleBasedUI === "function") applyRoleBasedUI(me);
    if (typeof window.bkRenderSubscriptionUI === "function") window.bkRenderSubscriptionUI(me);
    syncToggleUi();
  }

  function syncToggleUi() {
    const sub = window._bkAccountInfo?.subscription;
    const isBiz = !!sub?.fullAccess;
    syncingToggle = true;
    const chk = document.getElementById("bkPlanDevSwitch");
    if (chk) chk.checked = isBiz;
    document.querySelectorAll(".bk-plan-test-opt").forEach((el) => {
      const side = el.getAttribute("data-side");
      el.classList.toggle("is-active", (side === "biz" && isBiz) || (side === "pro" && !isBiz));
    });
    document.getElementById("devPlanProBtn")?.classList.toggle("active", !isBiz);
    document.getElementById("devPlanBusinessBtn")?.classList.toggle("active", isBiz);
    const label = document.getElementById("devPlanActiveLabel");
    if (label) {
      label.textContent = isBiz
        ? `Ab test: Business ₹299 (${sub?.daysLeft || 30} din)`
        : `Ab test: Pro ₹99 (${sub?.daysLeft || 30} din)`;
    }
    syncingToggle = false;
  }

  function showPlanTestChrome(show) {
    document.getElementById("devPlanToggleBar")?.classList.toggle("hidden", !show);
    document.getElementById("bkPlanTestToggleWrap")?.classList.toggle("hidden", !show);
    document.body.classList.toggle("has-dev-plan-toggle", !!show);
  }

  async function switchDevPlan(plan) {
    const planId = plan === "business" ? "business" : "pro";
    if (!getToken()) {
      alert("Please log in first.");
      return;
    }
    if (switching) return;
    if (planId === currentPlanSide()) {
      syncToggleUi();
      return;
    }

    switching = true;
    applyPlanToUI(planId, null);
    if (typeof showToast === "function") {
      showToast(planId === "business" ? "Test plan: Business ₹299" : "Test plan: Pro ₹99", "success");
    }

    try {
      const res = await fetch(`${API()}/api/dev/switch-plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({ plan: planId })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.subscription) applyPlanToUI(planId, data.subscription);
    } catch (_) {
      /* local test switch already applied */
    } finally {
      switching = false;
    }
  }

  async function fetchDevToggleEnabled() {
    try {
      const res = await fetch(`${API()}/api/dev/plan-toggle`);
      if (!res.ok) return false;
      return !!(await res.json()).enabled;
    } catch (_) {
      return false;
    }
  }

  async function isDevEnabled() {
    try { localStorage.removeItem("bk_force_dev_plan"); } catch (_) { /* ignore */ }
    return false;
  }

  async function initDevPlanToggle() {
    showPlanTestChrome(false);
    document.getElementById("myPlanTestSwitch")?.classList.add("hidden");
  }

  window.bkUpdateDevPlanToggle = syncToggleUi;
  window.bkInitDevPlanToggle = initDevPlanToggle;
  window.bkSwitchDevPlan = switchDevPlan;

  document.addEventListener("DOMContentLoaded", initDevPlanToggle);
})();
