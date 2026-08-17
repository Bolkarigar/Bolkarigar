(function () {
  const API_URL = window.location.origin;
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
        bannerText.textContent = `✅ ${sub.planName} plan active${sub.daysLeft ? ` — ${sub.daysLeft} din bache` : ""}`;
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
      detailEl.innerHTML = `
        <li>Plan: <strong>${sub.planName || "—"}</strong> (${sub.planLabel || ""})</li>
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

  async function buyBolKarigarPlan(plan) {
    const planId = plan === "business" ? "business" : "pro";
    try {
      if (typeof showToast === "function") showToast("⌛ Payment page khul rahi hai...");

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
      if (!orderRes.ok) throw new Error(orderData.error || "Order create fail");

      const me = window._bkAccountInfo || {};
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "BolKarigar",
        description: `${orderData.planName} — 30 din subscription`,
        order_id: orderData.orderId,
        prefill: {
          email: me.email || "",
          name: me.username || ""
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
            else window.location.reload();
          } catch (err) {
            if (typeof showToast === "function") showToast("❌ " + err.message, "error");
            else alert(err.message);
          }
        },
        modal: {
          ondismiss: function () {
            if (typeof showToast === "function") showToast("Payment cancel ho gayi.", "info");
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (resp) {
        const reason = resp.error?.reason || "";
        let msg = resp.error?.description || "Payment fail ho gayi.";
        if (reason === "international_transaction_not_allowed") {
          msg = "Yeh card international hai — Test me UPI use karein: success@razorpay";
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

  document.getElementById("refreshPlanBtn")?.addEventListener("click", () => {
    if (typeof loadServerData === "function") loadServerData();
  });

  document.getElementById("buyProPlanBtn")?.addEventListener("click", () => buyBolKarigarPlan("pro"));
  document.getElementById("buyBusinessPlanBtn")?.addEventListener("click", () => buyBolKarigarPlan("business"));
  document.getElementById("paywallBuyProBtn")?.addEventListener("click", () => buyBolKarigarPlan("pro"));
  document.getElementById("paywallBuyBusinessBtn")?.addEventListener("click", () => buyBolKarigarPlan("business"));

  window.buyBolKarigarPlan = buyBolKarigarPlan;
  window.bkRenderSubscriptionUI = renderSubscriptionUI;
})();
