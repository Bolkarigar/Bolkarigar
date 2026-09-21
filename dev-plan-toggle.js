/**
 * Dev/testing — Pro trial ↔ Business plan UI toggle (localhost / non-production).
 * Production me band: NODE_ENV=production aur DEV_PLAN_TOGGLE unset.
 */

const {
  activateOwnerPlan,
  startOwnerTrial,
  buildSubscriptionPayload,
  getSubscriptionForUser,
  sanitizePlanExpiry,
  PLANS,
  MONTHLY_DAYS
} = require('./subscription');

function isDevPlanToggleEnabled() {
  if (process.env.DEV_PLAN_TOGGLE === 'true') return true;
  if (process.env.DEV_PLAN_TOGGLE === 'false') return false;
  // Render deploy: testing toggle on unless explicitly disabled
  if (process.env.RENDER || process.env.RENDER_EXTERNAL_URL) return true;
  return process.env.NODE_ENV !== 'production';
}

function setupDevPlanToggle({ app, User, authenticateToken }) {
  app.get('/api/dev/plan-toggle', (req, res) => {
    res.json({ enabled: isDevPlanToggleEnabled() });
  });

  app.post('/api/dev/switch-plan', authenticateToken, async (req, res) => {
    try {
      if (!isDevPlanToggleEnabled()) {
        return res.status(403).json({ error: 'Dev plan toggle sirf testing me available hai.' });
      }

      const user = await User.findById(req.user.id);
      if (!user || user.ownerId) {
        return res.status(403).json({ error: 'Sirf shop owner ke liye.' });
      }

      const plan = req.body?.plan === 'business' ? 'business' : 'pro';

      if (plan === 'pro') {
        startOwnerTrial(user, 'pro');
      } else {
        activateOwnerPlan(user, 'business', MONTHLY_DAYS, { extend: false });
      }
      await user.save();

      const subscription = await getSubscriptionForUser(User, user);
      const planInfo = PLANS[plan];

      res.json({
        success: true,
        plan,
        subscription,
        message: `Test UI: ${planInfo.name} (${planInfo.label}) — ${subscription.daysLeft || 30} days`
      });
    } catch (e) {
      console.error('Dev switch-plan error:', e);
      res.status(500).json({ error: e.message || 'Plan switch fail' });
    }
  });
}

module.exports = { setupDevPlanToggle, isDevPlanToggleEnabled };
