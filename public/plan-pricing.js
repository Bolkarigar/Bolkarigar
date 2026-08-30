/** BolKarigar — single source for plan prices shown in UI */
(function () {
  window.BK_PLAN_PRICING = {
    pro: { id: "pro", name: "Pro Dukaan", price: 0, label: "Bilkul FREE", amountPaise: 0 },
    business: { id: "business", name: "Business", price: 299, label: "₹299/month", amountPaise: 29900 }
  };

  window.bkFormatPlanLabel = function (planId, fallback) {
    const p = window.BK_PLAN_PRICING[planId];
    if (p) return p.label;
    if (planId === "pro") return "Bilkul FREE";
    return fallback || "";
  };
})();
