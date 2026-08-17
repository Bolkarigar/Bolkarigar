/**
 * Dev UI — top bar se ₹349 Pro / ₹699 Business switch (testing only).
 * Baad me is file + HTML bar hata dena.
 */
(function () {
  const API = () => window.location.origin;
  const getToken = () => localStorage.getItem("bk_token") || localStorage.getItem("token") || "";

  function isLocalHost() {
    const h = location.hostname;
    return h === "localhost" || h === "127.0.0.1";
  }

  function updateHighlight(me) {
    const sub = me?.subscription;
    const plan = sub?.fullAccess ? "business" : "pro";
    document.getElementById("devPlanProBtn")?.classList.toggle("active", plan === "pro");
    document.getElementById("devPlanBusinessBtn")?.classList.toggle("active", plan === "business");
    const label = document.getElementById("devPlanActiveLabel");
    if (label) {
      label.textContent = plan === "business" ? "Active: Business ₹699" : "Active: Pro ₹349";
    }
  }

  async function switchDevPlan(plan) {
    const planId = plan === "business" ? "business" : "pro";
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
    } catch (err) {
      if (typeof showToast === "function") showToast("❌ " + err.message, "error");
      else alert(err.message);
    }
  }

  let wired = false;

  async function initDevPlanToggle() {
    const bar = document.getElementById("devPlanToggleBar");
    if (!bar) return;

    let enabled = isLocalHost();
    try {
      const res = await fetch(`${API()}/api/dev/plan-toggle`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        enabled = !!data.enabled;
      }
    } catch (_) { /* ignore */ }

    if (!enabled) return;

    bar.classList.remove("hidden");
    document.body.classList.add("has-dev-plan-toggle");
    updateHighlight(window._bkAccountInfo);

    if (!wired) {
      wired = true;
      document.getElementById("devPlanProBtn")?.addEventListener("click", () => switchDevPlan("pro"));
      document.getElementById("devPlanBusinessBtn")?.addEventListener("click", () => switchDevPlan("business"));
    }
  }

  window.bkUpdateDevPlanToggle = updateHighlight;
  window.bkInitDevPlanToggle = initDevPlanToggle;

  document.addEventListener("DOMContentLoaded", initDevPlanToggle);
})();
