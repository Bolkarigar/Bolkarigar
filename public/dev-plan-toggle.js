/**
 * Dev UI — Pro ₹99 ↔ Business ₹299 switch (testing only). Baad me hata dena.
 */
(function () {
  const API = () => window.API_URL || window.location.origin;
  const getToken = () => localStorage.getItem("bk_token") || localStorage.getItem("token") || "";

  (function readDevPlanUrlFlag() {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get("bkDevPlan") === "1") {
        localStorage.setItem("bk_force_dev_plan", "1");
        p.delete("bkDevPlan");
        const q = p.toString();
        const next = window.location.pathname + (q ? "?" + q : "") + window.location.hash;
        window.history.replaceState({}, "", next);
      }
    } catch (_) { /* ignore */ }
  })();

  function isLocalHost() {
    const h = location.hostname;
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
  }

  function isDevPlanForced() {
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      return false;
    }
    if (localStorage.getItem("bk_force_dev_plan") === "1") return true;
    return isLocalHost();
  }

  function updateHighlight(me) {
    const sub = me?.subscription;
    const plan = sub?.fullAccess ? "business" : "pro";
    document.getElementById("devPlanProBtn")?.classList.toggle("active", plan === "pro");
    document.getElementById("devPlanBusinessBtn")?.classList.toggle("active", plan === "business");
    const label = document.getElementById("devPlanActiveLabel");
    if (label) {
      const days = sub?.daysLeft;
      if (plan === "business") {
        label.textContent = `Ab dikha rahe ho: Business ₹299 — ${days || 30} din (server)`;
      } else if (sub?.isExpired) {
        label.textContent = "Ab: plan expired — Pro ₹99 dabayein trial ke liye";
      } else {
        label.textContent = `Ab dikha rahe ho: Pro ₹99 — ${days ?? 30} din (server)`;
      }
    }
  }

  function showPlanTestChrome(show) {
    const bar = document.getElementById("devPlanToggleBar");
    const hdr = document.getElementById("bkPlanTestHdrBtn");
    if (bar) bar.classList.toggle("hidden", !show);
    document.body.classList.toggle("has-dev-plan-toggle", !!show);
    if (hdr) {
      if (show) hdr.classList.add("hidden");
      else if (!window._bkAccountInfo?.isStaff && getToken()) hdr.classList.remove("hidden");
      else hdr.classList.add("hidden");
    }
  }

  async function switchDevPlan(plan) {
    const planId = plan === "business" ? "business" : "pro";
    if (!getToken()) {
      alert("Pehle login karein — phir Pro ₹99 / Business ₹299 test kar sakte ho.");
      return;
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Plan switch fail");

      if (window._bkAccountInfo) {
        window._bkAccountInfo.subscription = data.subscription;
        if (typeof applyRoleBasedUI === "function") applyRoleBasedUI(window._bkAccountInfo);
      } else if (typeof loadServerData === "function") {
        await loadServerData();
      }

      updateHighlight(window._bkAccountInfo);
      if (typeof showToast === "function") showToast("🧪 " + data.message, "info");
      if (typeof openPanel === "function") {
        const cur = document.querySelector(".panel.active")?.id;
        if (cur) openPanel(cur);
      }
    } catch (err) {
      const msg = err.message || "Plan switch fail";
      if (/403|testing|available/i.test(msg)) {
        if (typeof showToast === "function") {
          showToast("❌ Render par DEV_PLAN_TOGGLE=true set karein, phir dubara try karein.", "error");
        }
      } else if (typeof showToast === "function") showToast("❌ " + msg, "error");
      else alert(msg);
    }
  }

  let wired = false;

  async function fetchDevToggleEnabled() {
    try {
      const headers = {};
      const t = getToken();
      if (t) headers.Authorization = `Bearer ${t}`;
      const res = await fetch(`${API()}/api/dev/plan-toggle`, { headers });
      if (!res.ok) return false;
      const data = await res.json();
      return !!data.enabled;
    } catch (_) {
      return false;
    }
  }

  async function initDevPlanToggle() {
    const bar = document.getElementById("devPlanToggleBar");
    if (!bar) return;

    const me = window._bkAccountInfo;
    if (me?.isStaff) {
      showPlanTestChrome(false);
      return;
    }

    let enabled = isDevPlanForced();
    if (!enabled) enabled = await fetchDevToggleEnabled();

    if (!enabled || !getToken()) {
      showPlanTestChrome(false);
      if (!me?.isStaff && getToken() && (await fetchDevToggleEnabled())) {
        document.getElementById("bkPlanTestHdrBtn")?.classList.remove("hidden");
      }
      return;
    }

    showPlanTestChrome(true);
    updateHighlight(window._bkAccountInfo);

    if (!wired) {
      wired = true;
      document.getElementById("devPlanProBtn")?.addEventListener("click", () => switchDevPlan("pro"));
      document.getElementById("devPlanBusinessBtn")?.addEventListener("click", () => switchDevPlan("business"));
      document.getElementById("bkPlanTestHdrBtn")?.addEventListener("click", () => {
        localStorage.setItem("bk_force_dev_plan", "1");
        initDevPlanToggle();
        if (typeof showToast === "function") {
          showToast("🧪 Plan test bar on — Pro ₹99 / Business ₹299 choose karein", "info");
        }
        bar.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
  }

  window.bkUpdateDevPlanToggle = updateHighlight;
  window.bkInitDevPlanToggle = initDevPlanToggle;

  document.addEventListener("DOMContentLoaded", initDevPlanToggle);
})();
