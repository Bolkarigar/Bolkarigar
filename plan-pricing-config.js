/**
 * Accounts Orbit — single source for plan prices & trials (server + can mirror in public/plan-pricing.js)
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
    staffSlots: 25
  }
};

/** Business plan — extra staff packs (₹49 each = +25 login slots, stackable) */
const STAFF_PACK_SIZE = 25;
const STAFF_PACK_PRICE_RS = 49;
const STAFF_PACK_AMOUNT_PAISE = STAFF_PACK_PRICE_RS * 100;
const STAFF_PACK_MAX_QTY = 20;

function computeStaffSlotLimit(planKey, staffSlotPacks) {
  if (planKey !== 'business') {
    return {
      staffSlotsBase: 0,
      staffSlotPacks: 0,
      staffSlots: 0,
      staffPackSize: STAFF_PACK_SIZE,
      staffPackPrice: STAFF_PACK_PRICE_RS
    };
  }
  const base = BK_PLAN_PRICING.business.staffSlots || 0;
  const packs = Math.max(0, Number(staffSlotPacks) || 0);
  return {
    staffSlotsBase: base,
    staffSlotPacks: packs,
    staffSlots: base + packs * STAFF_PACK_SIZE,
    staffPackSize: STAFF_PACK_SIZE,
    staffPackPrice: STAFF_PACK_PRICE_RS
  };
}

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
  STAFF_PACK_SIZE,
  STAFF_PACK_PRICE_RS,
  STAFF_PACK_AMOUNT_PAISE,
  STAFF_PACK_MAX_QTY,
  computeStaffSlotLimit,
  getPlanAmountPaise,
  getPlanDurationDays,
  getTrialDays
};
