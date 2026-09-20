/**
 * BolKarigar — Owner subscription trials & paid plans.
 * Pro: 30-day free trial → ₹99/month or ₹999/year
 * Business: 15-day free trial → ₹299/month or ₹2999/year
 * Staff never pays — linked to owner's plan via invite code.
 */

const {
  PRO_TRIAL_DAYS,
  BUSINESS_TRIAL_DAYS,
  MONTHLY_DAYS,
  YEARLY_DAYS,
  BK_PLAN_PRICING,
  getTrialDays
} = require('./plan-pricing-config');

const MAX_BUSINESS_DAYS_AHEAD = 400;

const PLANS = {
  trial: { name: 'Pro Shop', staffSlots: 0 },
  starter: { name: 'Starter', staffSlots: 0 },
  pro: {
    name: BK_PLAN_PRICING.pro.name,
    priceMonthly: BK_PLAN_PRICING.pro.priceMonthly,
    priceYearly: BK_PLAN_PRICING.pro.priceYearly,
    staffSlots: BK_PLAN_PRICING.pro.staffSlots,
    label: BK_PLAN_PRICING.pro.labelMonthly,
    labelYearly: BK_PLAN_PRICING.pro.labelYearly,
    trialDays: PRO_TRIAL_DAYS
  },
  business: {
    name: BK_PLAN_PRICING.business.name,
    priceMonthly: BK_PLAN_PRICING.business.priceMonthly,
    priceYearly: BK_PLAN_PRICING.business.priceYearly,
    staffSlots: BK_PLAN_PRICING.business.staffSlots,
    label: BK_PLAN_PRICING.business.labelMonthly,
    labelYearly: BK_PLAN_PRICING.business.labelYearly,
    trialDays: BUSINESS_TRIAL_DAYS
  }
};

/** Pro plan — sidebar tabs included */
const PRO_PLAN_TABS = [
  'overviewPanel', 'businessRecordsPanel', 'invoicePanel', 'purchasePanel', 'paymentVoucherPanel', 'receiptVoucherPanel',
  'voicePanel', 'inventoryPanel',
  'ledgerPanel', 'khataLedgersPanel', 'khataItemsPanel', 'khataVoucherPanel', 'khataDaybookPanel',
  'modifyPanel',
  'galleryPanel', 'todoPanel', 'businessCardPanel', 'securityPanel', 'helpPanel', 'myPlanPanel'
];

function getPlanFeatures(planKey, isActive) {
  if (!isActive) {
    return { allowedTabs: [], tallySync: false, fullAccess: false, showInstallApp: false };
  }
  if (planKey === 'business') {
    return { allowedTabs: null, tallySync: true, fullAccess: true, showInstallApp: true };
  }
  return {
    allowedTabs: [...PRO_PLAN_TABS],
    tallySync: false,
    fullAccess: false,
    showInstallApp: true
  };
}

function requireBusinessPlan(req, res, next) {
  if (req.subscription?.fullAccess) return next();
  return res.status(403).json({
    error: 'This feature is available on the Business plan (₹299/month). Upgrade from My Plan.',
    code: 'PLAN_UPGRADE_REQUIRED'
  });
}

function requireTallyAccess(req, res, next) {
  if (req.subscription?.fullAccess || req.subscription?.tallySync) return next();
  return res.status(403).json({
    error: 'Tally sync requires Business plan (₹299/month). Open My Plan to upgrade.',
    code: 'PLAN_UPGRADE_REQUIRED'
  });
}

function requireActivePlan(req, res, next) {
  if (req.subscription?.isActive) return next();
  return res.status(403).json({
    error: 'Active plan required. Renew from My Plan.',
    code: 'SUBSCRIPTION_INACTIVE'
  });
}

const SUBSCRIPTION_EXEMPT_PATHS = [
  '/api/auth/me',
  '/api/subscription/status',
  '/api/subscription/plans',
  '/api/payment/config',
  '/api/payment/create-order',
  '/api/payment/verify',
  '/api/dev/plan-toggle',
  '/api/dev/switch-plan',
  '/api/voice/parse'
];

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function daysBetween(from, to) {
  const a = new Date(from);
  const b = new Date(to);
  const utcFrom = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcTo = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.max(0, Math.round((utcTo - utcFrom) / 86400000));
}

/** Days left until endDate — last calendar day counts as 1 day left */
function daysLeftUntil(now, endDate) {
  if (!endDate) return 0;
  const end = new Date(endDate);
  if (end <= now) return 0;
  const days = daysBetween(now, end);
  return days === 0 ? 1 : days;
}

function sanitizePlanExpiry(user, now = new Date()) {
  if (!user?.planExpiresAt) return false;
  const daysAhead = daysBetween(now, user.planExpiresAt);
  if (daysAhead <= MAX_BUSINESS_DAYS_AHEAD) return false;
  user.planExpiresAt = addDays(now, YEARLY_DAYS);
  if (typeof user.markModified === 'function') user.markModified('planExpiresAt');
  user._subscriptionMigrated = true;
  return true;
}

function startOwnerTrial(user, planId = 'pro') {
  if (!user || user.ownerId) return user;
  const plan = planId === 'business' ? 'business' : 'pro';
  const now = new Date();
  const trialDays = getTrialDays(plan);
  user.plan = plan;
  user.subscriptionStatus = 'trial';
  user.trialStartedAt = now;
  user.trialEndsAt = endOfDay(addDays(now, trialDays));
  user.planExpiresAt = null;
  user.trialUsed = true;
  return user;
}

function ensureOwnerSubscription(user) {
  if (!user || user.ownerId) return user;

  const now = new Date();

  // Legacy lifetime-free Pro → start 30-day trial from now (one-time migration)
  if (
    user.plan === 'pro'
    && user.subscriptionStatus === 'active'
    && !user.planExpiresAt
    && !user.trialEndsAt
  ) {
    startOwnerTrial(user, 'pro');
    user._subscriptionMigrated = true;
  }

  if (!user.trialStartedAt && user.subscriptionStatus !== 'active' && !user.planExpiresAt) {
    startOwnerTrial(user, user.plan === 'business' ? 'business' : 'pro');
    user._subscriptionMigrated = true;
  }

  if (user.subscriptionStatus === 'trial' && !user.trialEndsAt) {
    startOwnerTrial(user, user.plan === 'business' ? 'business' : 'pro');
    user._subscriptionMigrated = true;
  }

  if (user.subscriptionStatus === 'trial' && user.trialEndsAt && now > user.trialEndsAt) {
    const paidUntil = user.planExpiresAt ? new Date(user.planExpiresAt) : null;
    if (paidUntil && paidUntil > now) {
      user.subscriptionStatus = 'active';
      user.trialEndsAt = null;
    } else {
      user.subscriptionStatus = 'expired';
    }
    user._subscriptionMigrated = true;
  }

  sanitizePlanExpiry(user, now);

  if (user.subscriptionStatus === 'active' && user.planExpiresAt && now > user.planExpiresAt) {
    user.subscriptionStatus = 'expired';
    user._subscriptionMigrated = true;
  }

  return user;
}

/**
 * Activate paid plan after Razorpay verify.
 * @param {object} opts.extend — stack on current expiry when true
 */
function activateOwnerPlan(user, planId, durationDays = MONTHLY_DAYS, opts = {}) {
  if (!user || user.ownerId) return user;
  const allowed = ['pro', 'business'];
  const plan = allowed.includes(planId) ? planId : 'pro';
  const now = new Date();
  const extend = opts.extend === true;
  const base = extend && user.planExpiresAt && new Date(user.planExpiresAt) > now
    ? new Date(user.planExpiresAt)
    : now;

  user.plan = plan;
  user.subscriptionStatus = 'active';
  user.planExpiresAt = addDays(base, durationDays);
  user.trialEndsAt = null;
  return user;
}

function buildSubscriptionPayload(ownerUser) {
  const user = ensureOwnerSubscription(ownerUser);
  const now = new Date();
  const isTrial = user.subscriptionStatus === 'trial';
  const planExpiresAt = user.planExpiresAt ? new Date(user.planExpiresAt) : null;
  const trialEndsAt = user.trialEndsAt ? new Date(user.trialEndsAt) : null;

  let isActive = user.subscriptionStatus === 'trial' || user.subscriptionStatus === 'active';
  if (isTrial && trialEndsAt && trialEndsAt <= now && !(planExpiresAt && planExpiresAt > now)) {
    isActive = false;
  }
  if (user.subscriptionStatus === 'active' && planExpiresAt && planExpiresAt <= now) {
    isActive = false;
  }

  const planKey = user.plan || 'pro';
  const planInfo = PLANS[planKey] || PLANS.pro;
  const features = getPlanFeatures(planKey, isActive);

  let daysLeft = 0;
  if (isTrial && trialEndsAt) {
    daysLeft = daysLeftUntil(now, trialEndsAt);
  } else if (user.subscriptionStatus === 'active' && planExpiresAt) {
    daysLeft = daysLeftUntil(now, planExpiresAt);
  }

  const trialDaysForPlan = planKey === 'business' ? BUSINESS_TRIAL_DAYS : PRO_TRIAL_DAYS;

  return {
    plan: planKey,
    planName: planInfo.name,
    planLabel: planInfo.label,
    priceMonthly: planInfo.priceMonthly,
    priceYearly: planInfo.priceYearly,
    subscriptionStatus: user.subscriptionStatus || 'expired',
    isActive,
    isTrial: isActive && isTrial,
    isExpired: !isActive,
    trialEndsAt: trialEndsAt ? trialEndsAt.toISOString() : null,
    planExpiresAt: planExpiresAt ? planExpiresAt.toISOString() : null,
    daysLeft,
    staffSlots: planInfo.staffSlots,
    trialDays: trialDaysForPlan,
    proTrialDays: PRO_TRIAL_DAYS,
    businessTrialDays: BUSINESS_TRIAL_DAYS,
    canInviteStaff: isActive && planInfo.staffSlots > 0,
    ownerPays: true,
    staffPays: false,
    allowedTabs: features.allowedTabs,
    tallySync: features.tallySync,
    fullAccess: features.fullAccess,
    showInstallApp: features.showInstallApp,
    message: isActive && isTrial
      ? `${planInfo.name} trial — ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`
      : isActive
        ? `${planInfo.name} plan active — ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`
        : `Trial ended — renew Pro (₹99/mo or ₹999/yr) or Business (₹299/mo or ₹2999/yr) from My Plan`
  };
}

async function resolveOwnerUser(User, dbUser) {
  if (!dbUser) return null;
  if (dbUser.ownerId) return User.findById(dbUser.ownerId);
  return dbUser;
}

async function getSubscriptionForUser(User, dbUser) {
  const owner = await resolveOwnerUser(User, dbUser);
  if (!owner) {
    return {
      plan: 'starter',
      subscriptionStatus: 'expired',
      isActive: false,
      isTrial: false,
      isExpired: true,
      daysLeft: 0,
      canInviteStaff: false,
      ownerPays: true,
      staffPays: false,
      message: 'Owner account not found'
    };
  }

  ensureOwnerSubscription(owner);
  const needsSave = (typeof owner.isModified === 'function' && owner.isModified()) || owner._subscriptionMigrated;
  if (needsSave) {
    try {
      await owner.save();
    } catch (saveErr) {
      console.error('Subscription save warning:', saveErr.message);
    }
  }

  const payload = buildSubscriptionPayload(owner);
  payload.isStaffAccount = !!dbUser?.ownerId;
  return payload;
}

function isPathSubscriptionExempt(req) {
  const path = String(req.originalUrl || req.path || '').split('?')[0];
  return SUBSCRIPTION_EXEMPT_PATHS.some((p) => path === p || path.startsWith(p));
}

function setupSubscription({ app, User, authenticateToken }) {
  app.get('/api/subscription/plans', (_req, res) => {
    res.json({
      success: true,
      proTrialDays: PRO_TRIAL_DAYS,
      businessTrialDays: BUSINESS_TRIAL_DAYS,
      ownerPays: true,
      staffPays: false,
      staffNote: 'Staff do not need a separate purchase — owner shares an invite code.',
      pricing: BK_PLAN_PRICING,
      plans: [
        {
          id: 'pro',
          name: BK_PLAN_PRICING.pro.name,
          trialDays: PRO_TRIAL_DAYS,
          priceMonthly: BK_PLAN_PRICING.pro.priceMonthly,
          priceYearly: BK_PLAN_PRICING.pro.priceYearly,
          staffSlots: 0,
          featured: true,
          features: [
            `${PRO_TRIAL_DAYS}-day free trial`,
            `Then ₹${BK_PLAN_PRICING.pro.priceMonthly}/month or ₹${BK_PLAN_PRICING.pro.priceYearly}/year`,
            'Invoice, Credit Ledger, Voucher',
            'Inventory + Day Book + Gallery + Todo'
          ]
        },
        {
          id: 'business',
          name: BK_PLAN_PRICING.business.name,
          trialDays: BUSINESS_TRIAL_DAYS,
          priceMonthly: BK_PLAN_PRICING.business.priceMonthly,
          priceYearly: BK_PLAN_PRICING.business.priceYearly,
          staffSlots: BK_PLAN_PRICING.business.staffSlots,
          features: [
            `${BUSINESS_TRIAL_DAYS}-day free trial`,
            `Then ₹${BK_PLAN_PRICING.business.priceMonthly}/month or ₹${BK_PLAN_PRICING.business.priceYearly}/year`,
            'Everything in the app',
            'Tally sync + Voice AI + Reports Pro',
            `Staff (${BK_PLAN_PRICING.business.staffSlots}) + Payroll & Attendance`
          ]
        }
      ]
    });
  });

  app.get('/api/subscription/status', authenticateToken, async (req, res) => {
    try {
      const dbUser = await User.findById(req.user.id);
      const subscription = await getSubscriptionForUser(User, dbUser);
      res.json({
        success: true,
        subscription,
        pricing: BK_PLAN_PRICING,
        razorpayConfigured: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}

function createSubscriptionGate(User) {
  return async function subscriptionGate(req, res, next) {
    if (isPathSubscriptionExempt(req)) return next();
    if (!req.user?.id) return next();

    try {
      const dbUser = await User.findById(req.user.id);
      const subscription = await getSubscriptionForUser(User, dbUser);
      req.subscription = subscription;

      if (!subscription.isActive) {
        return res.status(402).json({
          error: subscription.isStaffAccount
            ? 'Shop plan expired. Ask the owner to renew from My Plan.'
            : subscription.message || 'Plan expired. Renew from My Plan.',
          code: 'SUBSCRIPTION_EXPIRED',
          subscription
        });
      }
      next();
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  };
}

module.exports = {
  PRO_TRIAL_DAYS,
  BUSINESS_TRIAL_DAYS,
  MONTHLY_DAYS,
  YEARLY_DAYS,
  BK_PLAN_PRICING,
  PLANS,
  PRO_PLAN_TABS,
  getPlanFeatures,
  requireBusinessPlan,
  requireTallyAccess,
  requireActivePlan,
  startOwnerTrial,
  ensureOwnerSubscription,
  activateOwnerPlan,
  sanitizePlanExpiry,
  buildSubscriptionPayload,
  getSubscriptionForUser,
  setupSubscription,
  createSubscriptionGate,
  isPathSubscriptionExempt
};
