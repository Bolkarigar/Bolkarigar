/**
 * BolKarigar — single source for plan prices & trials (server + can mirror in public/plan-pricing.js)
 */
const PRO_TRIAL_DAYS = 30;
const BUSINESS_TRIAL_DAYS = 15;
const MONTHLY_DAYS = 30;
const YEARLY_DAYS = 365;

const BK_PLAN_PRICING = {
  pro: {
    id: 'pro',
    name: 'Pro Shop',
    trialDays: PRO_TRIAL_DAYS,
    priceMonthly: 99,
    priceYearly: 999,
    amountPaiseMonthly: 9900,
    amountPaiseYearly: 99900,
    labelMonthly: '₹99/month',
    labelYearly: '₹999/year',
    staffSlots: 0
  },
  business: {
    id: 'business',
    name: 'Business',
    trialDays: BUSINESS_TRIAL_DAYS,
    priceMonthly: 299,
    priceYearly: 2999,
    amountPaiseMonthly: 29900,
    amountPaiseYearly: 299900,
    labelMonthly: '₹299/month',
    labelYearly: '₹2999/year',
    staffSlots: 5
  }
};

function getPlanAmountPaise(planId, billing) {
  const p = BK_PLAN_PRICING[planId];
  if (!p) return null;
  return billing === 'yearly' ? p.amountPaiseYearly : p.amountPaiseMonthly;
}

function getPlanDurationDays(billing) {
  return billing === 'yearly' ? YEARLY_DAYS : MONTHLY_DAYS;
}

function getTrialDays(planId) {
  if (planId === 'business') return BUSINESS_TRIAL_DAYS;
  return PRO_TRIAL_DAYS;
}

module.exports = {
  PRO_TRIAL_DAYS,
  BUSINESS_TRIAL_DAYS,
  MONTHLY_DAYS,
  YEARLY_DAYS,
  BK_PLAN_PRICING,
  getPlanAmountPaise,
  getPlanDurationDays,
  getTrialDays
};
