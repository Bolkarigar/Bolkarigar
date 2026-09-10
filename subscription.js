/**
 * BolKarigar — Owner subscription & 3-day Pro trial.
 * Staff/Cashier/Manager accounts NEVER pay — they use owner's invite code.
 */

const TRIAL_DAYS = 3;
const BUSINESS_PLAN_DAYS = 30;
/** Sanity cap — stacked dev-toggle bug could inflate expiry to thousands of days */
const MAX_BUSINESS_DAYS_AHEAD = 120;

const PLANS = {
  trial: { name: 'Pro Shop', price: 0, staffSlots: 0, label: 'Completely FREE' },
  starter: { name: 'Starter', price: 0, staffSlots: 0, label: 'Free — legacy' },
  pro: { name: 'Pro Shop', price: 0, staffSlots: 0, label: 'Completely FREE' },
  business: { name: 'Business', price: 299, staffSlots: 5, label: '₹299/month' }
};

/** Pro (FREE) — sidebar tabs included in free plan */
const PRO_PLAN_TABS = [
  'overviewPanel', 'invoicePanel', 'purchasePanel', 'paymentVoucherPanel', 'receiptVoucherPanel',
  'voicePanel', 'inventoryPanel', 'totalSalesPanel',
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
    error: 'This feature is available on the Business plan (₹299). Upgrade from My Plan.',
    code: 'PLAN_UPGRADE_REQUIRED'
  });
}

/** Tally Agent + sync — Business plan OR explicit tallySync feature */
function requireTallyAccess(req, res, next) {
  if (req.subscription?.fullAccess || req.subscription?.tallySync) return next();
  return res.status(403).json({
    error: 'Tally sync requires Business plan (₹299). Open My Plan to upgrade.',
    code: 'PLAN_UPGRADE_REQUIRED'
  });
}

/** Active Pro (free) or Business — for AI chat, voice parse, basic features */
function requireActivePlan(req, res, next) {
  if (req.subscription?.isActive) return next();
  return res.status(403).json({
    error: 'Active plan required. Pro is free — open My Plan or sign in again.',
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

function daysBetween(from, to) {
  const a = new Date(from);
  const b = new Date(to);
  const utcFrom = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcTo = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.max(0, Math.round((utcTo - utcFrom) / 86400000));
}

function sanitizeBusinessExpiry(user, now = new Date()) {
  if (!user || user.plan !== 'business' || !user.planExpiresAt) return false;
  const daysAhead = daysBetween(now, user.planExpiresAt);
  if (daysAhead <= MAX_BUSINESS_DAYS_AHEAD) return false;
  user.planExpiresAt = addDays(now, BUSINESS_PLAN_DAYS);
  user.plan = 'business';
  user.subscriptionStatus = 'active';
  if (typeof user.markModified === 'function') {
    user.markModified('planExpiresAt');
    user.markModified('plan');
    user.markModified('subscriptionStatus');
  }
  user._subscriptionMigrated = true;
  return true;
}

function activateFreePro(user) {
  const now = new Date();
  user.plan = 'pro';
  user.subscriptionStatus = 'active';
  user.trialStartedAt = user.trialStartedAt || now;
  user.trialEndsAt = null;
  user.planExpiresAt = null;
  user.trialUsed = true;
  return user;
}

function startOwnerTrial(user) {
  return activateFreePro(user);
}

function ensureOwnerSubscription(user) {
  if (!user || user.ownerId) return user;

  if (!user.trialStartedAt && !user.planExpiresAt && user.subscriptionStatus !== 'active') {
    activateFreePro(user);
    user._subscriptionMigrated = true;
  }

  const now = new Date();
  if (user.subscriptionStatus === 'trial' && user.trialEndsAt && now > user.trialEndsAt) {
    activateFreePro(user);
  }
  if (user.subscriptionStatus === 'expired' && user.plan === 'pro') {
    activateFreePro(user);
  }

  // Pro is lifetime FREE — clear stale expiry left from old trials / dev toggles / business renewals
  if (user.plan === 'pro' && user.subscriptionStatus === 'active' && user.planExpiresAt) {
    user.planExpiresAt = null;
    user._subscriptionMigrated = true;
  }

  sanitizeBusinessExpiry(user, now);

  if (user.subscriptionStatus === 'active' && user.plan === 'business' && user.planExpiresAt && now > user.planExpiresAt) {
    user.subscriptionStatus = 'expired';
  }

  if (user.plan === 'business' && user.subscriptionStatus === 'active' && !user.planExpiresAt) {
    user.planExpiresAt = addDays(now, BUSINESS_PLAN_DAYS);
    user._subscriptionMigrated = true;
  }

  return user;
}

/**
 * Activate Business (paid) or Pro (free).
 * @param {object} opts
 * @param {boolean} opts.extend — true = stack on current expiry (Razorpay renewal). false = fresh period from today (dev/test).
 */
function activateOwnerPlan(user, planId, durationDays = BUSINESS_PLAN_DAYS, opts = {}) {
  if (!user || user.ownerId) return user;
  const allowed = ['pro', 'business'];
  const plan = allowed.includes(planId) ? planId : 'pro';
  if (plan === 'pro') return activateFreePro(user);

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
  const isActive = user.subscriptionStatus === 'trial' || user.subscriptionStatus === 'active';
  const trialEndsAt = user.trialEndsAt ? new Date(user.trialEndsAt) : null;
  const planExpiresAt = user.planExpiresAt ? new Date(user.planExpiresAt) : null;

  const planKey = user.plan || 'starter';
  let daysLeft = 0;
  if (isTrial && trialEndsAt) {
    daysLeft = daysBetween(now, trialEndsAt);
    if (trialEndsAt <= now) daysLeft = 0;
  } else if (planKey === 'business' && user.subscriptionStatus === 'active' && planExpiresAt) {
    daysLeft = daysBetween(now, planExpiresAt);
    if (daysLeft > MAX_BUSINESS_DAYS_AHEAD) {
      sanitizeBusinessExpiry(user, now);
      const fixed = user.planExpiresAt ? new Date(user.planExpiresAt) : null;
      daysLeft = fixed ? daysBetween(now, fixed) : BUSINESS_PLAN_DAYS;
    }
  }
  // Pro Shop = lifetime free — never show expiry days

  const planInfo = PLANS[planKey] || PLANS.starter;
  const features = getPlanFeatures(planKey, isActive);

  return {
    plan: planKey,
    planName: planInfo.name,
    planLabel: planInfo.label,
    subscriptionStatus: user.subscriptionStatus || 'expired',
    isActive,
    isTrial,
    isExpired: !isActive,
    trialEndsAt: trialEndsAt ? trialEndsAt.toISOString() : null,
    planExpiresAt: planKey === 'pro' ? null : (planExpiresAt ? planExpiresAt.toISOString() : null),
    daysLeft: planKey === 'pro' ? 0 : daysLeft,
    staffSlots: planInfo.staffSlots,
    trialDays: TRIAL_DAYS,
    canInviteStaff: isActive && planInfo.staffSlots > 0,
    ownerPays: true,
    staffPays: false,
    allowedTabs: features.allowedTabs,
    tallySync: features.tallySync,
    fullAccess: features.fullAccess,
    showInstallApp: features.showInstallApp,
    message: isTrial
      ? `Pro plan — ${daysLeft} days left (legacy trial)`
      : isActive
        ? planKey === 'pro'
          ? `${planInfo.name} — completely FREE, full access`
          : `${planInfo.name} plan active`
        : 'Renew your plan from My Plan'
  };
}

async function resolveOwnerUser(User, dbUser) {
  if (!dbUser) return null;
  if (dbUser.ownerId) {
    return User.findById(dbUser.ownerId);
  }
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
      message: 'Owner account nahi mila'
    };
  }

  const beforeStatus = owner.subscriptionStatus;
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
      trialDays: TRIAL_DAYS,
      ownerPays: true,
      staffPays: false,
      staffNote: 'Staff do not need a separate purchase — owner shares an invite code.',
      plans: [
        {
          id: 'pro',
          name: 'Pro Shop',
          price: 0,
          period: 'lifetime',
          staffSlots: 0,
          featured: true,
          features: ['Completely FREE — forever', 'Invoice, Credit Ledger, Voucher', 'Inventory + Day Book', 'Gallery + Todo + Help', 'No payment required']
        },
        {
          id: 'business',
          name: 'Business',
          price: 299,
          period: 'month',
          staffSlots: 5,
          features: ['Everything in the app', 'Tally sync + Voice AI', 'Reports Pro + GSTR', 'Staff (5) + Contractor', 'Bank Recon + Payroll & Attendance']
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
            ? 'Shop ka plan expire ho gaya. Malik se subscription renew karwain.'
            : 'Business plan (₹299) renew karein — Pro plan bilkul FREE hai.',
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
  TRIAL_DAYS,
  BUSINESS_PLAN_DAYS,
  PLANS,
  PRO_PLAN_TABS,
  getPlanFeatures,
  requireBusinessPlan,
  requireTallyAccess,
  requireActivePlan,
  startOwnerTrial,
  ensureOwnerSubscription,
  activateFreePro,
  activateOwnerPlan,
  sanitizeBusinessExpiry,
  buildSubscriptionPayload,
  getSubscriptionForUser,
  setupSubscription,
  createSubscriptionGate,
  isPathSubscriptionExempt
};
