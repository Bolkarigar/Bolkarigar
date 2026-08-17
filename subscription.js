/**
 * BolKarigar — Owner subscription & 3-day Pro trial.
 * Staff/Cashier/Manager accounts NEVER pay — they use owner's invite code.
 */

const TRIAL_DAYS = 3;

const PLANS = {
  trial: { name: 'Pro Trial', price: 0, staffSlots: 0, label: '3 Din Free Pro' },
  starter: { name: 'Starter', price: 0, staffSlots: 0, label: 'Free — 1 user' },
  pro: { name: 'Pro Dukaan', price: 349, staffSlots: 0, label: '₹349/month' },
  business: { name: 'Business', price: 699, staffSlots: 5, label: '₹699/month' }
};

/** Pro (₹349) / trial — sirf yeh sidebar tabs */
const PRO_PLAN_TABS = [
  'overviewPanel', 'invoicePanel', 'inventoryPanel', 'totalSalesPanel',
  'ledgerPanel', 'khataLedgersPanel', 'khataItemsPanel', 'khataVoucherPanel', 'khataDaybookPanel',
  'galleryPanel', 'todoPanel', 'helpPanel', 'myPlanPanel'
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
    error: 'Yeh feature Business plan (₹699) me available hai. My Plan se upgrade karein.',
    code: 'PLAN_UPGRADE_REQUIRED'
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
  '/api/dev/switch-plan'
];

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(from, to) {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function startOwnerTrial(user) {
  const now = new Date();
  user.plan = 'pro';
  user.subscriptionStatus = 'trial';
  user.trialStartedAt = now;
  user.trialEndsAt = addDays(now, TRIAL_DAYS);
  user.planExpiresAt = null;
  user.trialUsed = true;
  return user;
}

function ensureOwnerSubscription(user) {
  if (!user || user.ownerId) return user;

  if (!user.trialStartedAt && !user.planExpiresAt && user.subscriptionStatus !== 'active') {
    startOwnerTrial(user);
    user._subscriptionMigrated = true;
  }

  const now = new Date();
  if (user.subscriptionStatus === 'trial' && user.trialEndsAt && now > user.trialEndsAt) {
    user.subscriptionStatus = 'expired';
    if (!user.plan || user.plan === 'pro') user.plan = 'starter';
  }

  if (user.subscriptionStatus === 'active' && user.planExpiresAt && now > user.planExpiresAt) {
    user.subscriptionStatus = 'expired';
  }

  return user;
}

/** Paid plan activate — extend if already active (renewal). */
function activateOwnerPlan(user, planId, durationDays = 30) {
  if (!user || user.ownerId) return user;
  const allowed = ['pro', 'business'];
  const plan = allowed.includes(planId) ? planId : 'pro';
  const now = new Date();
  const base = user.planExpiresAt && new Date(user.planExpiresAt) > now
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

  let daysLeft = 0;
  if (isTrial && trialEndsAt) {
    daysLeft = daysBetween(now, trialEndsAt);
    if (trialEndsAt <= now) daysLeft = 0;
  } else if (user.subscriptionStatus === 'active' && planExpiresAt) {
    daysLeft = daysBetween(now, planExpiresAt);
  }

  const planKey = user.plan || 'starter';
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
    planExpiresAt: planExpiresAt ? planExpiresAt.toISOString() : null,
    daysLeft,
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
      ? `Pro trial — ${daysLeft} din bache hain`
      : isActive
        ? `${planInfo.name} plan active`
        : 'Trial khatam — plan renew karein'
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
  const needsSave = owner.isModified && owner.isModified();
  if (needsSave || owner._subscriptionMigrated) {
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
      staffNote: 'Staff/Cashier/Manager ko alag se app kharidne ki zaroorat nahi — malik invite code dega.',
      plans: [
        {
          id: 'starter',
          name: 'Starter',
          price: 0,
          period: 'month',
          staffSlots: 0,
          features: ['Invoice + GST bill', 'Udhar Khata', 'Basic reports', '50 invoices/month', 'Sirf owner account']
        },
        {
          id: 'pro',
          name: 'Pro Dukaan',
          price: 349,
          period: 'month',
          staffSlots: 2,
          featured: true,
          features: ['3 din FREE Pro trial', 'Invoice, Udhar, Ledger, Voucher', 'Inventory + Day Book', 'Gallery + Todo', 'Tally sync nahi']
        },
        {
          id: 'business',
          name: 'Business',
          price: 699,
          period: 'month',
          staffSlots: 5,
          features: ['App ki SAARI cheezein', 'Tally sync + Voice AI', 'Reports Pro + GSTR', 'Staff (5) + Contractor', 'Bank Recon + Companies']
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
            : 'Aapka 3 din ka free trial khatam ho gaya. Plan renew karein.',
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
  PLANS,
  PRO_PLAN_TABS,
  getPlanFeatures,
  requireBusinessPlan,
  startOwnerTrial,
  ensureOwnerSubscription,
  activateOwnerPlan,
  buildSubscriptionPayload,
  getSubscriptionForUser,
  setupSubscription,
  createSubscriptionGate,
  isPathSubscriptionExempt
};
