/**
 * BolKarigar — Razorpay subscription payments (owner only).
 * Pro: ₹99/month or ₹999/year | Business: ₹299/month or ₹2999/year
 */

const Razorpay = require('razorpay');
const { validatePaymentVerification } = require('razorpay/dist/utils/razorpay-utils');
const {
  PLANS,
  buildSubscriptionPayload,
  activateOwnerPlan
} = require('./subscription');
const {
  BK_PLAN_PRICING,
  getPlanAmountPaise,
  getPlanDurationDays
} = require('./plan-pricing-config');

function normalizeRazorpayEnv() {
  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  return { keyId, keySecret };
}

function getRazorpayMode() {
  const { keyId } = normalizeRazorpayEnv();
  if (!keyId) return 'off';
  if (keyId.startsWith('rzp_live_')) return 'live';
  if (keyId.startsWith('rzp_test_')) return 'test';
  return 'invalid';
}

function getRazorpayClient() {
  const { keyId, keySecret } = normalizeRazorpayEnv();
  if (!keyId || !keySecret) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

function isRazorpayConfigured() {
  const { keyId, keySecret } = normalizeRazorpayEnv();
  return !!(keyId && keySecret);
}

function verifyPaymentSignature(orderId, paymentId, signature) {
  const { keySecret } = normalizeRazorpayEnv();
  if (!keySecret || !orderId || !paymentId || !signature) return false;
  try {
    return validatePaymentVerification(
      { order_id: orderId, payment_id: paymentId },
      signature,
      keySecret
    );
  } catch {
    return false;
  }
}

async function fetchPaymentStatus(razorpay, paymentId) {
  try {
    return await razorpay.payments.fetch(paymentId);
  } catch {
    return null;
  }
}

function setupRazorpayPayments({ app, mongoose, User, authenticateToken }) {
  const paymentOrderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    plan: { type: String, enum: ['pro', 'business'], required: true },
    billing: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    amountPaise: { type: Number, required: true },
    durationDays: { type: Number, default: 30 },
    currency: { type: String, default: 'INR' },
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String, default: null },
    razorpaySignature: { type: String, default: null },
    status: { type: String, enum: ['created', 'paid', 'failed'], default: 'created' },
    createdAt: { type: Date, default: Date.now },
    paidAt: { type: Date, default: null }
  });

  const PaymentOrder = mongoose.models.PaymentOrder
    || mongoose.model('PaymentOrder', paymentOrderSchema);

  app.get('/api/payment/config', authenticateToken, async (req, res) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user || user.ownerId) {
        return res.status(403).json({ error: 'Only the shop owner can make payments.' });
      }
      res.json({
        success: true,
        configured: isRazorpayConfigured(),
        keyId: normalizeRazorpayEnv().keyId || null,
        mode: getRazorpayMode(),
        testMode: getRazorpayMode() === 'test',
        keyPrefix: normalizeRazorpayEnv().keyId ? normalizeRazorpayEnv().keyId.slice(0, 12) + '…' : null,
        pricing: BK_PLAN_PRICING,
        plans: {
          pro: {
            name: PLANS.pro.name,
            priceMonthly: PLANS.pro.priceMonthly,
            priceYearly: PLANS.pro.priceYearly,
            amountPaiseMonthly: BK_PLAN_PRICING.pro.amountPaiseMonthly,
            amountPaiseYearly: BK_PLAN_PRICING.pro.amountPaiseYearly
          },
          business: {
            name: PLANS.business.name,
            priceMonthly: PLANS.business.priceMonthly,
            priceYearly: PLANS.business.priceYearly,
            amountPaiseMonthly: BK_PLAN_PRICING.business.amountPaiseMonthly,
            amountPaiseYearly: BK_PLAN_PRICING.business.amountPaiseYearly
          }
        }
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/payment/create-order', authenticateToken, async (req, res) => {
    try {
      const razorpay = getRazorpayClient();
      if (!razorpay) {
        return res.status(503).json({ error: 'Razorpay is not configured. Check keys in environment settings.' });
      }

      const user = await User.findById(req.user.id);
      if (!user || user.ownerId) {
        return res.status(403).json({ error: 'Only the shop owner can purchase a plan.' });
      }

      const plan = req.body?.plan === 'business' ? 'business' : (req.body?.plan === 'pro' ? 'pro' : null);
      const billing = req.body?.billing === 'yearly' ? 'yearly' : 'monthly';
      if (!plan) {
        return res.status(400).json({ error: 'Invalid plan. Choose pro or business.' });
      }

      const amountPaise = getPlanAmountPaise(plan, billing);
      if (!amountPaise) {
        return res.status(400).json({ error: 'Invalid plan or billing period.' });
      }

      const durationDays = getPlanDurationDays(billing);
      const planInfo = PLANS[plan];
      const billingLabel = billing === 'yearly' ? planInfo.labelYearly || `₹${planInfo.priceYearly}/year` : planInfo.label;

      const { keyId } = normalizeRazorpayEnv();
      if (getRazorpayMode() === 'invalid') {
        return res.status(503).json({
          error: 'Razorpay Key ID format is invalid. Live key must start with rzp_live_.'
        });
      }

      const receipt = `bk_${String(user._id).slice(-8)}_${Date.now()}`;
      const order = await razorpay.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt,
        notes: {
          userId: String(user._id),
          username: user.username,
          plan,
          billing,
          product: 'BolKarigar Subscription'
        }
      });

      await PaymentOrder.create({
        userId: user._id,
        plan,
        billing,
        amountPaise,
        durationDays,
        razorpayOrderId: order.id,
        status: 'created'
      });

      res.json({
        success: true,
        keyId,
        mode: getRazorpayMode(),
        orderId: order.id,
        amount: amountPaise,
        currency: 'INR',
        plan,
        billing,
        durationDays,
        planName: planInfo.name,
        planLabel: billingLabel
      });
    } catch (e) {
      console.error('Razorpay create-order error:', e);
      res.status(500).json({ error: e.message || 'Failed to create order.' });
    }
  });

  app.post('/api/payment/verify', authenticateToken, async (req, res) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ error: 'Payment details are incomplete.' });
      }

      const user = await User.findById(req.user.id);
      if (!user || user.ownerId) {
        return res.status(403).json({ error: 'Only the shop owner can activate the plan.' });
      }

      const paymentOrder = await PaymentOrder.findOne({
        razorpayOrderId: razorpay_order_id,
        userId: user._id
      });
      if (!paymentOrder) {
        return res.status(404).json({ error: 'Order not found or does not belong to you.' });
      }
      if (paymentOrder.status === 'paid') {
        return res.json({
          success: true,
          alreadyPaid: true,
          message: 'This payment has already been verified.',
          subscription: buildSubscriptionPayload(user)
        });
      }

      const razorpay = getRazorpayClient();
      const paymentInfo = razorpay
        ? await fetchPaymentStatus(razorpay, razorpay_payment_id)
        : null;

      if (paymentInfo?.status && paymentInfo.status !== 'captured' && paymentInfo.status !== 'authorized') {
        paymentOrder.status = 'failed';
        await paymentOrder.save();
        const reason = paymentInfo.error_description
          || paymentInfo.error_reason
          || `Payment ${paymentInfo.status} — not completed.`;
        return res.status(400).json({ error: reason });
      }

      const valid = verifyPaymentSignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      );
      if (!valid) {
        paymentOrder.status = 'failed';
        await paymentOrder.save();
        return res.status(400).json({
          error: 'Payment verification failed. In test mode use UPI: success@razorpay (international cards may be blocked).'
        });
      }

      paymentOrder.status = 'paid';
      paymentOrder.razorpayPaymentId = razorpay_payment_id;
      paymentOrder.razorpaySignature = razorpay_signature;
      paymentOrder.paidAt = new Date();
      await paymentOrder.save();

      const durationDays = paymentOrder.durationDays || getPlanDurationDays(paymentOrder.billing);
      activateOwnerPlan(user, paymentOrder.plan, durationDays, { extend: true });
      user.lastPaymentId = razorpay_payment_id;
      user.lastPaymentAt = new Date();
      await user.save();

      const billingText = paymentOrder.billing === 'yearly' ? '1 year' : '30 days';
      res.json({
        success: true,
        message: `${PLANS[paymentOrder.plan].name} plan activated for ${billingText}!`,
        subscription: buildSubscriptionPayload(user),
        paymentId: razorpay_payment_id
      });
    } catch (e) {
      console.error('Razorpay verify error:', e);
      res.status(500).json({ error: e.message || 'Payment verification failed.' });
    }
  });

  return { PaymentOrder };
}

module.exports = {
  setupRazorpayPayments,
  isRazorpayConfigured,
  getRazorpayMode,
  BK_PLAN_PRICING
};
