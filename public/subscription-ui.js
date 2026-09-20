(function () {
  const API_URL = window.API_URL || window.location.origin;
  const getToken = () => localStorage.getItem("bk_token") || localStorage.getItem("token") || "";

  let razorpayScriptLoaded = false;

  function pricing() {
    return window.BK_PLAN_PRICING || {};
  }

  let selectedBilling = "monthly";

  function getSelectedBilling() {
    return selectedBilling === "yearly" ? "yearly" : "monthly";
  }

  function planPriceLabel(planId, billing) {
    const p = pricing()[planId] || {};
    if (billing === "yearly") {
      return { amount: `₹${p.priceYearly || 0}`, period: "/ year", btn: `Pay — ${p.name || planId} ₹${p.priceYearly || 0}/yr` };
    }
    return { amount: `₹${p.priceMonthly || 0}`, period: "/ month", btn: `Pay — ${p.name || planId} ₹${p.priceMonthly || 0}/mo` };
  }

  function syncBillingToggleInputs(checked) {
    document.querySelectorAll(".bk-billing-toggle-input").forEach((input) => {
      input.checked = checked;
    });
    document.querySelectorAll("[data-billing-opt]").forEach((el) => {
      const active = el.dataset.billingOpt === (checked ? "yearly" : "monthly");
      el.classList.toggle("active", active);
    });
  }

  function refreshBillingUI() {
    const billing = getSelectedBilling();
    ["pro", "business"].forEach((planId) => {
      const info = planPriceLabel(planId, billing);
      document.querySelectorAll(`[data-bk-price-plan="${planId}"]`).forEach((el) => {
        el.textContent = info.amount;
      });
      document.querySelectorAll(`[data-bk-price-label="${planId}"]`).forEach((el) => {
        const trialDays = pricing()[planId]?.trialDays;
        const trialPart = trialDays ? ` · ${trialDays}-day free trial` : "";
        el.textContent = `${info.period}${trialPart}`;
      });
      document.querySelectorAll(`.bk-plan-pay-btn[data-bk-plan="${planId}"]`).forEach((btn) => {
        btn.textContent = `💳 ${info.btn}`;
      });
    });
  }

  function setBillingPeriod(period) {
    selectedBilling = period === "yearly" ? "yearly" : "monthly";
    syncBillingToggleInputs(selectedBilling === "yearly");
    refreshBillingUI();
  }

  function wireBillingToggles() {
    document.querySelectorAll(".bk-billing-toggle-input").forEach((input) => {
      if (input.dataset.bkBillingWired) return;
      input.dataset.bkBillingWired = "1";
      input.addEventListener("change", () => {
        setBillingPeriod(input.checked ? "yearly" : "monthly");
      });
    });
    document.querySelectorAll("[data-billing-opt]").forEach((el) => {
      if (el.dataset.bkBillingWired) return;
      el.dataset.bkBillingWired = "1";
      el.style.cursor = "pointer";
      el.addEventListener("click", () => {
        setBillingPeriod(el.dataset.billingOpt === "yearly" ? "yearly" : "monthly");
      });
    });
    syncBillingToggleInputs(selectedBilling === "yearly");
    refreshBillingUI();
  }

  function initBillingToggle() {
    wireBillingToggles();
  }

  function loadRazorpayScript() {
    if (razorpayScriptLoaded || window.Razorpay) {
      razorpayScriptLoaded = true;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => { razorpayScriptLoaded = true; resolve(); };
      s.onerror = () => reject(new Error("Razorpay script load fail"));
      document.head.appendChild(s);
    });
  }

  function normalizeBusinessDays(sub) {
    if (!sub) return 0;
    const n = Number(sub.daysLeft) || 0;
    if (n > 400) return 30;
    return n;
  }

  function businessBannerText(sub) {
    const days = normalizeBusinessDays(sub);
    let tillStr = sub.planExpiresAt
      ? ` (till ${new Date(sub.planExpiresAt).toLocaleDateString("en-IN")})`
      : "";
    const daysPart = days > 0 ? ` — ${days} day${days === 1 ? "" : "s"} left` : "";
    return `✅ ${sub.planName || "Business"} plan active${daysPart}${tillStr}`;
  }

  function trialBannerText(sub) {
    const p = pricing();
    const planName = sub.plan === "business" ? (p.business?.name || "Business") : (p.pro?.name || "Pro Shop");
    const till = sub.trialEndsAt ? new Date(sub.trialEndsAt).toLocaleDateString("en-IN") : "";
    return `🎉 ${planName} trial: ${sub.daysLeft} day${sub.daysLeft === 1 ? "" : "s"} left${till ? ` (until ${till})` : ""}`;
  }

  function renderSubscriptionUI(me) {
    const sub = me?.subscription;
    if (!sub) return;

    const banner = document.getElementById("subscriptionBanner");
    const bannerText = document.getElementById("subscriptionBannerText");
    const paywall = document.getElementById("subscriptionPaywall");
    const myPlanPanel = document.getElementById("myPlanPanel");

    if (me.isStaff) {
      if (banner) {
        banner.classList.remove("hidden", "trial", "expired");
        banner.classList.add("staff");
        bannerText.textContent = `${me.roleLabel || me.role} — invited by owner. No separate plan purchase needed.`;
      }
      document.getElementById("subscriptionBannerAction")?.style.setProperty("display", "none");
      if (myPlanPanel) myPlanPanel.style.display = "none";
      if (paywall) paywall.classList.add("hidden");
    } else if (sub.isTrial) {
      if (banner) {
        banner.classList.remove("hidden", "expired", "staff");
        banner.classList.add("trial");
        bannerText.textContent = trialBannerText(sub);
      }
      if (paywall) paywall.classList.add("hidden");
    } else if (sub.isActive) {
      if (banner) {
        banner.classList.remove("hidden", "trial", "expired", "staff");
        bannerText.textContent = sub.plan === "pro"
          ? businessBannerText(sub).replace("Business", "Pro Shop")
          : businessBannerText(sub);
      }
      if (paywall) paywall.classList.add("hidden");
    } else if (sub.isExpired) {
      if (banner) {
        banner.classList.remove("hidden", "trial", "staff");
        banner.classList.add("expired");
        bannerText.textContent = "⚠️ Trial or plan expired — renew to continue using the app";
      }
      if (paywall) paywall.classList.remove("hidden");
    }

    updateMyPlanPanel(me);
    updatePaywallTestHint(me);
    wirePayButtons();
  }

  function wirePayButtons() {
    document.querySelectorAll("[data-bk-plan]").forEach((btn) => {
      if (btn.dataset.bkWired) return;
      btn.dataset.bkWired = "1";
      btn.addEventListener("click", () => {
        const billing = btn.dataset.bkBilling || getSelectedBilling();
        buyBolKarigarPlan(btn.dataset.bkPlan, billing);
      });
    });
    wireBillingToggles();
  }

  async function updatePaywallTestHint(me) {
    const hint = document.getElementById("paywallTestModeHint");
    const planMode = document.getElementById("myPlanPaymentMode");
    if ((!hint && !planMode) || me?.isStaff || !getToken()) {
      hint?.classList.add("hidden");
      planMode?.classList.add("hidden");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/payment/config`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (!res.ok) {
        hint?.classList.add("hidden");
        planMode?.classList.add("hidden");
        return;
      }
      const cfg = await res.json();
      const isTest = cfg.testMode || cfg.mode === "test";
      if (hint) hint.classList.toggle("hidden", !isTest);
      if (planMode) {
        if (!cfg.configured) {
          planMode.classList.add("hidden");
        } else if (isTest) {
          planMode.classList.remove("hidden");
          planMode.innerHTML = '⚠️ <strong style="color:#f59e0b;">Payment TEST mode</strong> — use UPI <code>success@razorpay</code> in test.';
        } else if (cfg.mode === "live") {
          planMode.classList.remove("hidden");
          planMode.innerHTML = '✅ <strong style="color:#22c55e;">Payment LIVE mode</strong> — real UPI/Card payments enabled.';
        } else {
          planMode.classList.add("hidden");
        }
      }
    } catch (_) {
      hint?.classList.add("hidden");
      planMode?.classList.add("hidden");
    }
  }

  function updateMyPlanPanel(me) {
    const panel = document.getElementById("myPlanPanel");
    if (!panel || me?.isStaff) return;

    const sub = me.subscription || {};
    const p = pricing();
    const statusEl = document.getElementById("myPlanStatus");
    const detailEl = document.getElementById("myPlanDetails");
    const staffNote = document.getElementById("myPlanStaffNote");
    const renewBox = document.getElementById("myPlanRenewBox");

    const planKey = sub.plan || "pro";
    const planCfg = p[planKey] || p.pro || {};

    if (statusEl) {
      statusEl.textContent = sub.isTrial
        ? `${planCfg.name || "Plan"} Trial — ${sub.daysLeft} days left`
        : sub.isActive
          ? `${sub.planName || planCfg.name} Active`
          : "Plan Expired — Please renew";
    }

    if (detailEl) {
      detailEl.innerHTML = `
        <li>Plan: <strong>${sub.planName || planCfg.name || "—"}</strong></li>
        <li>Status: <strong>${sub.subscriptionStatus || "—"}</strong></li>
        ${sub.isTrial ? `<li>Free trial: <strong>${planCfg.trialDays || sub.trialDays} days</strong></li>` : ""}
        ${sub.trialEndsAt ? `<li>Trial ends: ${new Date(sub.trialEndsAt).toLocaleDateString("en-IN")}</li>` : ""}
        ${sub.planExpiresAt ? `<li>Paid until: ${new Date(sub.planExpiresAt).toLocaleDateString("en-IN")}</li>` : ""}
        <li>Pro after trial: <strong>₹${p.pro?.priceMonthly || 99}/mo</strong> or <strong>₹${p.pro?.priceYearly || 999}/yr</strong></li>
        <li>Business after trial: <strong>₹${p.business?.priceMonthly || 299}/mo</strong> or <strong>₹${p.business?.priceYearly || 2999}/yr</strong></li>
        <li>Staff slots (Business): <strong>${sub.staffSlots || 0}</strong>${sub.staffSlotPacks ? ` (${sub.staffSlotsBase || 25} + ${sub.staffSlotPacks}×25 paid)` : ''}</li>
        <li>Extra staff pack: <strong>+${sub.staffPackSize || 25} for ₹${sub.staffPackPrice || 49}</strong> — buy from Staff panel</li>
      `;
    }

    if (staffNote) {
      staffNote.textContent = "Staff/Cashier/Manager do not buy separately — share an invite code from the Staff panel.";
    }

    if (renewBox) {
      const showRenew = !sub.isActive || sub.isTrial || (sub.daysLeft > 0 && sub.daysLeft <= 7);
      renewBox.style.display = showRenew ? "" : "none";
    }
  }

  async function refreshPlanStatus() {
    const token = getToken();
    if (!token) return false;
    try {
      const meRes = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!meRes.ok) return false;
      const me = await meRes.json();
      window._bkAccountInfo = me;
      if (typeof applyRoleBasedUI === "function") applyRoleBasedUI(me);
      else if (typeof window.bkRenderSubscriptionUI === "function") window.bkRenderSubscriptionUI(me);
      return true;
    } catch (_) {
      return false;
    }
  }

  async function getAccountPrefill() {
    if (window._bkAccountInfo?.username) return window._bkAccountInfo;
    if (!getToken()) return {};
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (res.ok) return await res.json();
    } catch (_) { /* ignore */ }
    return {};
  }

  async function buyBolKarigarPlan(plan, billing) {
    const planId = plan === "business" ? "business" : "pro";
    const bill = billing === "yearly" ? "yearly" : "monthly";
    const p = pricing()[planId] || {};
    const planLabel = bill === "yearly"
      ? (p.labelYearly || `₹${p.priceYearly}/year`)
      : (p.labelMonthly || `₹${p.priceMonthly}/month`);

    if (!getToken()) {
      window.location.href = `signup.html?plan=${planId}`;
      return;
    }

    try {
      if (typeof showToast === "function") showToast("⌛ Opening payment...");

      const cfgRes = await fetch(`${API_URL}/api/payment/config`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const cfg = await cfgRes.json().catch(() => ({}));

      if (!cfgRes.ok) {
        throw new Error(cfg.error || "Could not load payment configuration.");
      }

      if (!cfg.configured) {
        const msg = `Online payment (${planLabel}) is not configured yet. Contact support.`;
        if (typeof showToast === "function") showToast(msg, "error");
        else alert(msg);
        if (typeof openPanel === "function") openPanel("myPlanPanel");
        return;
      }

      if (cfg.testMode && !/localhost|127\.0\.0\.1/.test(window.location.hostname)) {
        const proceed = confirm(
          "⚠️ Razorpay TEST mode — real card OTP will not arrive.\n\nTry test payment anyway?"
        );
        if (!proceed) return;
      }

      await loadRazorpayScript();

      const orderRes = await fetch(`${API_URL}/api/payment/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({ plan: planId, billing: bill })
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || "Order create failed");

      const me = await getAccountPrefill();
      let contactPhone = "";
      try {
        const profRes = await fetch(`${API_URL}/api/profile`, {
          headers: { Authorization: `Bearer ${getToken()}` }
        });
        if (profRes.ok) {
          const prof = await profRes.json();
          contactPhone = String(prof.phone || "").replace(/\D/g, "").slice(-10);
        }
      } catch (_) { /* ignore */ }

      const periodLabel = bill === "yearly" ? "1 year" : "30 days";
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "BolKarigar",
        description: `${orderData.planName} — ${planLabel} (${periodLabel})`,
        order_id: orderData.orderId,
        prefill: {
          email: me.email || "",
          name: me.username || "",
          contact: contactPhone || undefined
        },
        theme: { color: "#3b82f6" },
        handler: async function (response) {
          try {
            const verifyRes = await fetch(`${API_URL}/api/payment/verify`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${getToken()}`
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || "Verify failed");

            if (typeof showToast === "function") showToast("✅ " + verifyData.message);
            document.getElementById("subscriptionPaywall")?.classList.add("hidden");
            if (typeof refreshPlanStatus === "function") await refreshPlanStatus();
            else window.location.reload();
          } catch (err) {
            if (typeof showToast === "function") showToast("❌ " + err.message, "error");
            else alert(err.message);
          }
        },
        modal: {
          ondismiss: function () {
            if (typeof showToast === "function") showToast("Payment was cancelled.", "info");
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (resp) {
        let msg = resp.error?.description || "Payment failed.";
        if (resp.error?.reason === "international_transaction_not_allowed") {
          msg = "International card blocked — in test mode use UPI: success@razorpay";
        }
        if (typeof showToast === "function") showToast("❌ " + msg, "error");
      });
      rzp.open();
    } catch (err) {
      if (typeof showToast === "function") showToast("❌ " + err.message, "error");
      else alert(err.message);
    }
  }

  document.getElementById("subscriptionBannerAction")?.addEventListener("click", () => {
    if (typeof openPanel === "function") openPanel("myPlanPanel");
  });

  document.getElementById("refreshPlanBtn")?.addEventListener("click", async (e) => {
    e.preventDefault();
    const btn = e.currentTarget;
    if (btn) btn.disabled = true;
    const ok = await refreshPlanStatus();
    if (btn) btn.disabled = false;
    if (typeof showToast === "function") {
      showToast(ok ? "Plan status refreshed." : "Could not refresh plan status.", ok ? "success" : "error");
    }
  });

  async function payStaffSlotPack(quantity) {
    const qty = Math.min(20, Math.max(1, parseInt(quantity, 10) || 1));
    if (!getToken()) {
      window.location.href = "loginpage.html";
      return;
    }
    try {
      if (typeof showToast === "function") showToast("⌛ Opening payment for extra staff...");
      const cfgRes = await fetch(`${API_URL}/api/payment/config`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const cfg = await cfgRes.json().catch(() => ({}));
      if (!cfgRes.ok || !cfg.configured) {
        throw new Error(cfg.error || "Online payment is not configured yet.");
      }
      if (cfg.testMode && !/localhost|127\.0\.0\.1/.test(window.location.hostname)) {
        const proceed = confirm("⚠️ Razorpay TEST mode.\n\nContinue test payment for staff pack?");
        if (!proceed) return;
      }
      await loadRazorpayScript();
      const orderRes = await fetch(`${API_URL}/api/payment/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({ orderType: "staff_pack", quantity: qty })
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || "Order create failed");

      const packSize = cfg.staffPack?.packSize || 25;
      const priceEach = cfg.staffPack?.priceRs || 49;
      const me = await getAccountPrefill();
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "BolKarigar",
        description: `+${qty * packSize} staff (${qty}× ₹${priceEach})`,
        order_id: orderData.orderId,
        prefill: { email: me.email || "", name: me.username || "" },
        theme: { color: "#3b82f6" },
        handler: async function (response) {
          try {
            const verifyRes = await fetch(`${API_URL}/api/payment/verify`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${getToken()}`
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || "Verify failed");
            if (typeof showToast === "function") showToast("✅ " + verifyData.message);
            if (typeof refreshPlanStatus === "function") await refreshPlanStatus();
            if (typeof loadStaff === "function") loadStaff();
          } catch (err) {
            if (typeof showToast === "function") showToast("❌ " + err.message, "error");
          }
        },
        modal: {
          ondismiss: function () {
            if (typeof showToast === "function") showToast("Payment cancelled.", "info");
          }
        }
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      if (typeof showToast === "function") showToast("❌ " + err.message, "error");
      else alert(err.message);
    }
  }

  window.buyBolKarigarPlan = buyBolKarigarPlan;
  window.bkPayStaffSlotPack = payStaffSlotPack;
  window.bkRenderSubscriptionUI = renderSubscriptionUI;
  window.refreshPlanStatus = refreshPlanStatus;
  window.bkGetSelectedBilling = getSelectedBilling;
  window.bkInitBillingToggle = initBillingToggle;
  document.addEventListener("DOMContentLoaded", wirePayButtons);
})();
