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
    if (localStorage.getItem("bk_force_dev_plan") === "1") return true;
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
      alert("Pehle login karein.");
      return;
    }
    if (switching) return;
    if (planId === currentPlanSide()) {
      syncToggleUi();
      return;
    }

    switching = true;
    applyPlanToUI(planId, null);

    try {
      const res = await fetch(`${API()}/api/dev/switch-plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({ plan: planId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Plan switch fail");
      applyPlanToUI(planId, data.subscription);
      if (typeof showToast === "function") showToast("🧪 " + (data.message || "Plan switched"), "info");
      const cur = document.querySelector(".panel.active")?.id;
      if (cur && typeof openPanel === "function") openPanel(cur);
    } catch (err) {
      const msg = err.message || "Server switch fail";
      if (typeof showToast === "function") {
        showToast(
          /403|testing|available/i.test(msg)
            ? "⚠️ UI test mode on — server par DEV_PLAN_TOGGLE=true set karein for save"
            : "⚠️ UI switched locally — " + msg,
          "info"
        );
      }
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
    if (isDevPlanForced()) return true;
    return fetchDevToggleEnabled();
  }

  async function initDevPlanToggle() {
    const me = window._bkAccountInfo;
    if (me?.isStaff) {
      showPlanTestChrome(false);
      return;
    }

    const enabled = await isDevEnabled();
    if (!enabled || !getToken()) {
      showPlanTestChrome(false);
      return;
    }

    localStorage.setItem("bk_force_dev_plan", "1");
    showPlanTestChrome(true);
    syncToggleUi();

    if (!wired) {
      wired = true;
      document.getElementById("devPlanProBtn")?.addEventListener("click", () => switchDevPlan("pro"));
      document.getElementById("devPlanBusinessBtn")?.addEventListener("click", () => switchDevPlan("business"));
      document.getElementById("bkPlanDevSwitch")?.addEventListener("change", (e) => {
        if (syncingToggle) return;
        switchDevPlan(e.target.checked ? "business" : "pro");
      });
      document.querySelectorAll(".bk-plan-test-opt").forEach((el) => {
        el.addEventListener("click", () => {
          switchDevPlan(el.getAttribute("data-side") === "biz" ? "business" : "pro");
        });
      });
    }
  }

  window.bkUpdateDevPlanToggle = syncToggleUi;
  window.bkInitDevPlanToggle = initDevPlanToggle;
  window.bkSwitchDevPlan = switchDevPlan;

  document.addEventListener("DOMContentLoaded", initDevPlanToggle);
})();
