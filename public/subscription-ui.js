(function () {
  const API_URL = window.API_URL || window.location.origin;
  const getToken = () => localStorage.getItem("bk_token") || localStorage.getItem("token") || "";

  let razorpayScriptLoaded = false;

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
        bannerText.textContent = `${me.roleLabel || me.role} — Malik ne invite diya. Aapko alag plan kharidne ki zaroorat nahi.`;
      }
      document.getElementById("subscriptionBannerAction")?.style.setProperty("display", "none");
      if (myPlanPanel) myPlanPanel.style.display = "none";
      if (paywall) paywall.classList.add("hidden");
    } else if (sub.isTrial) {
      if (banner) {
        banner.classList.remove("hidden", "expired", "staff");
        banner.classList.add("trial");
        bannerText.textContent = `🎉 Pro Trial: ${sub.daysLeft} din bache — ${sub.trialEndsAt ? new Date(sub.trialEndsAt).toLocaleDateString("en-IN") : ""} tak full access`;
      }
      if (paywall) paywall.classList.add("hidden");
    } else if (sub.isActive) {
      if (banner) {
        banner.classList.remove("hidden", "trial", "expired", "staff");
        bannerText.textContent = sub.plan === 'pro' && !sub.planExpiresAt
          ? `✅ Pro Dukaan — bilkul FREE, full access`
          : `✅ ${sub.planName} plan active${sub.daysLeft ? ` — ${sub.daysLeft} din bache` : ""}`;
      }
      if (paywall) paywall.classList.add("hidden");
    } else if (sub.isExpired) {
      if (banner) {
        banner.classList.remove("hidden", "trial", "staff");
        banner.classList.add("expired");
        bannerText.textContent = "⚠️ Trial khatam — plan renew karein taaki app chal sake";
      }
      if (paywall) paywall.classList.remove("hidden");
    }

    updateMyPlanPanel(me);
    updatePaywallTestHint(me);
  }

  async function updatePaywallTestHint(me) {
    const hint = document.getElementById("paywallTestModeHint");
    const planMode = document.getElementById("myPlanPaymentMode");
    if ((!hint && !planMode) || me?.isStaff || !getToken()) {
      if (hint) hint.classList.add("hidden");
      if (planMode) planMode.classList.add("hidden");
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
          planMode.innerHTML = '⚠️ <strong style="color:#f59e0b;">Payment TEST mode</strong> — real card OTP nahi aayega. Render Environment me <code>RAZORPAY_KEY_ID</code> = <code>rzp_live_…</code> set karein aur redeploy karein.';
        } else if (cfg.mode === "live") {
          planMode.classList.remove("hidden");
          planMode.innerHTML = '✅ <strong style="color:#22c55e;">Payment LIVE mode</strong> — asli UPI/Card se payment hogi.';
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
    const statusEl = document.getElementById("myPlanStatus");
    const detailEl = document.getElementById("myPlanDetails");
    const staffNote = document.getElementById("myPlanStaffNote");
    const renewBox = document.getElementById("myPlanRenewBox");

    if (statusEl) {
      statusEl.textContent = sub.isTrial
        ? `Pro Trial — ${sub.daysLeft} din bache`
        : sub.isActive
          ? `${sub.planName} Active`
          : "Plan Expired — Renew karein";
    }

    if (detailEl) {
      const planKey = sub.plan || "pro";
      const displayLabel = typeof window.bkFormatPlanLabel === "function"
        ? window.bkFormatPlanLabel(planKey, sub.planLabel)
        : (planKey === "pro" ? "Bilkul FREE" : (sub.planLabel || ""));
      detailEl.innerHTML = `
        <li>Plan: <strong>${sub.planName || "—"}</strong> (${displayLabel})</li>
        <li>Status: <strong>${sub.subscriptionStatus || "—"}</strong></li>
        ${sub.trialEndsAt ? `<li>Trial end: ${new Date(sub.trialEndsAt).toLocaleDateString("en-IN")}</li>` : ""}
        ${sub.planExpiresAt ? `<li>Plan valid till: ${new Date(sub.planExpiresAt).toLocaleDateString("en-IN")}</li>` : ""}
        <li>Staff slots: <strong>${sub.staffSlots || 0}</strong> (invite code se free)</li>
      `;
    }

    if (staffNote) {
      staffNote.textContent = "Staff/Cashier/Manager ko alag se app nahi kharidni — aap invite code generate karke dein.";
    }

    if (renewBox) {
      renewBox.style.display = (!sub.isActive || sub.isTrial) ? "" : (sub.daysLeft <= 7 ? "" : "none");
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

  async function buyBolKarigarPlan(plan) {
    const planId = plan === "business" ? "business" : "pro";
    const pricing = window.BK_PLAN_PRICING || {};
    const planLabel = planId === "business"
      ? `Business ₹${pricing.business?.price || 299}`
      : "Pro FREE";

    if (!getToken()) {
      window.location.href = `signup.html?plan=${planId === "business" ? "business" : "pro"}`;
      return;
    }

    if (planId === "pro") {
      if (typeof showToast === "function") showToast("✅ Pro plan is completely FREE — full access!");
      if (typeof openPanel === "function") openPanel("myPlanPanel");
      else window.location.href = "bolkarigar.html";
      return;
    }

    try {
      if (typeof showToast === "function") showToast("⌛ Checking payment...");

      const cfgRes = await fetch(`${API_URL}/api/payment/config`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const cfg = await cfgRes.json().catch(() => ({}));

      if (!cfgRes.ok) {
        if (cfgRes.status === 403) {
          throw new Error(cfg.error || "Only the shop owner can purchase a plan. Staff accounts cannot pay.");
        }
        if (cfgRes.status === 401) {
          throw new Error("Login expired. Please sign in again.");
        }
        throw new Error(cfg.error || "Could not load payment configuration.");
      }

      if (!cfg.configured) {
        const msg = `Online payment (${planLabel}) is still being set up. Pro plan is FREE — try Business later.`;
        if (typeof showToast === "function") showToast(msg, "error");
        else alert(msg);
        if (typeof openPanel === "function") openPanel("myPlanPanel");
        return;
      }

      if (cfg.testMode && !/localhost|127\.0\.0\.1/.test(window.location.hostname)) {
        const proceed = confirm(
          "⚠️ Razorpay is in TEST mode — real card OTP will not arrive.\n\n" +
          "For live payments, set rzp_live_ keys on Render and redeploy.\n\n" +
          "Try test payment anyway?"
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
        body: JSON.stringify({ plan: planId })
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        if (orderRes.status === 403) {
          throw new Error(orderData.error || "Only the shop owner can purchase a plan.");
        }
        if (orderRes.status === 503) {
          throw new Error(orderData.error || "Razorpay is not configured yet. Please contact support.");
        }
        throw new Error(orderData.error || "Order create fail");
      }

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

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "BolKarigar",
        description: `${orderData.planName} — 30 day subscription`,
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
            if (!verifyRes.ok) throw new Error(verifyData.error || "Verify fail");

            if (typeof showToast === "function") showToast("✅ " + verifyData.message);
            document.getElementById("subscriptionPaywall")?.classList.add("hidden");
            if (typeof loadServerData === "function") loadServerData();
            else if (window.location.pathname.includes("pricing.html")) {
              window.location.href = "bolkarigar.html?payment=success";
            } else window.location.reload();
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
        const reason = resp.error?.reason || "";
        let msg = resp.error?.description || "Payment failed.";
        if (reason === "international_transaction_not_allowed") {
          msg = "This card is international — in test mode use UPI: success@razorpay";
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
    if (typeof loadServerData === "function") {
      try {
        await loadServerData();
        if (typeof showToast === "function") showToast("Plan status refreshed.");
      } catch (err) {
        if (typeof showToast === "function") showToast("Could not refresh plan status.", "error");
      }
    }
  });

  document.getElementById("buyProPlanBtn")?.addEventListener("click", () => buyBolKarigarPlan("pro"));
  document.getElementById("buyBusinessPlanBtn")?.addEventListener("click", () => buyBolKarigarPlan("business"));
  document.getElementById("paywallBuyProBtn")?.addEventListener("click", () => buyBolKarigarPlan("pro"));
  document.getElementById("paywallBuyBusinessBtn")?.addEventListener("click", () => buyBolKarigarPlan("business"));

  window.buyBolKarigarPlan = buyBolKarigarPlan;
  window.bkRenderSubscriptionUI = renderSubscriptionUI;
})();
