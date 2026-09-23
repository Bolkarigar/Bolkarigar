/** Accounts Orbit — plan prices shown in UI (keep in sync with plan-pricing-config.js) */
(function () {
  const PRO_TRIAL_DAYS = 30;
  const BUSINESS_TRIAL_DAYS = 15;

  window.BK_PLAN_PRICING = {
    pro: {
      id: "pro",
      name: "Pro Shop",
      trialDays: PRO_TRIAL_DAYS,
      priceMonthly: 99,
      priceYearly: 999,
      amountPaiseMonthly: 9900,
      amountPaiseYearly: 99900,
      labelMonthly: "₹99/month",
      labelYearly: "₹999/year",
      labelTrial: `${PRO_TRIAL_DAYS}-day free trial`
    },
    business: {
      id: "business",
      name: "Business",
      trialDays: BUSINESS_TRIAL_DAYS,
      priceMonthly: 299,
      priceYearly: 2999,
      amountPaiseMonthly: 29900,
      amountPaiseYearly: 299900,
      labelMonthly: "₹299/month",
      labelYearly: "₹2999/year",
      labelTrial: `${BUSINESS_TRIAL_DAYS}-day free trial`
    }
  };

  window.bkFormatPlanLabel = function (planId, billing, fallback) {
    const p = window.BK_PLAN_PRICING[planId];
    if (!p) return fallback || "";
    if (billing === "yearly") return p.labelYearly;
    if (billing === "monthly") return p.labelMonthly;
    return `${p.labelMonthly} · ${p.labelYearly}`;
  };

  window.bkPlanPayLabel = function (planId, billing) {
    const p = window.BK_PLAN_PRICING[planId];
    if (!p) return "";
    return billing === "yearly" ? p.labelYearly : p.labelMonthly;
  };
})();
