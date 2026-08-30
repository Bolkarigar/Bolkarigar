/**
 * BolKarigar — Razorpay subscription payments (owner only).
 * Staff never pays — linked to owner's plan via invite code.
 */


const Razorpay = require('razorpay');
const { validatePaymentVerification } = require('razorpay/dist/utils/razorpay-utils');
const { PLANS, buildSubscriptionPayload, activateOwnerPlan } = require('./subscription');

const PLAN_AMOUNTS_PAISE = {
  business: 29900
};

const PLAN_DURATION_DAYS = 30;

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

function isRazorpayConfigured() {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function verifyPaymentSignature(orderId, paymentId, signature) {
  const secret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  if (!secret || !orderId || !paymentId || !signature) return false;
  try {
    return validatePaymentVerification(
      { order_id: orderId, payment_id: paymentId },
      signature,
      secret
    );
  } catch {
    return false;
  }
}

async function fetchPaymentStatus(razorpay, paymentId) {
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    return payment;
  } catch {
    return null;
  }
}

function setupRazorpayPayments({ app, mongoose, User, authenticateToken }) {
  const paymentOrderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    plan: { type: String, enum: ['pro', 'business'], required: true },
    amountPaise: { type: Number, required: true },
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
        return res.status(403).json({ error: 'Sirf shop owner payment kar sakta hai.' });
      }
      res.json({
        success: true,
        configured: isRazorpayConfigured(),
        keyId: process.env.RAZORPAY_KEY_ID || null,
        testMode: (process.env.RAZORPAY_KEY_ID || '').startsWith('rzp_test_'),
        plans: {
          business: { name: PLANS.business.name, amount: PLANS.business.price, amountPaise: PLAN_AMOUNTS_PAISE.business }
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
        return res.status(503).json({ error: 'Razorpay configure nahi hai. .env mein keys check karein.' });
      }

      const user = await User.findById(req.user.id);
      if (!user || user.ownerId) {
        return res.status(403).json({ error: 'Sirf shop owner plan kharid sakta hai.' });
      }

      const plan = req.body?.plan === 'business' ? 'business' : null;
      if (!plan || !PLAN_AMOUNTS_PAISE[plan]) {
        return res.status(400).json({
          error: 'Pro plan ab bilkul FREE hai. Sirf Business (₹299/month) ke liye payment karein.'
        });
      }
      const amountPaise = PLAN_AMOUNTS_PAISE[plan];
      const planInfo = PLANS[plan];

      const receipt = `bk_${String(user._id).slice(-8)}_${Date.now()}`;
      const order = await razorpay.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt,
        notes: {
          userId: String(user._id),
          username: user.username,
          plan,
          product: 'BolKarigar Subscription'
        }
      });

      await PaymentOrder.create({
        userId: user._id,
        plan,
        amountPaise,
        razorpayOrderId: order.id,
        status: 'created'
      });

      res.json({
        success: true,
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: order.id,
        amount: amountPaise,
        currency: 'INR',
        plan,
        planName: planInfo.name,
        planLabel: planInfo.label
      });
    } catch (e) {
      console.error('Razorpay create-order error:', e);
      res.status(500).json({ error: e.message || 'Order create fail hua.' });
    }
  });

  app.post('/api/payment/verify', authenticateToken, async (req, res) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ error: 'Payment details incomplete hain.' });
      }

      const user = await User.findById(req.user.id);
      if (!user || user.ownerId) {
        return res.status(403).json({ error: 'Sirf shop owner plan activate ho sakta hai.' });
      }

      const paymentOrder = await PaymentOrder.findOne({
        razorpayOrderId: razorpay_order_id,
        userId: user._id
      });
      if (!paymentOrder) {
        return res.status(404).json({ error: 'Order nahi mila ya aapka nahi hai.' });
      }
      if (paymentOrder.status === 'paid') {
        return res.json({
          success: true,
          alreadyPaid: true,
          message: 'Yeh payment pehle se verify ho chuki hai.',
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
          || `Payment ${paymentInfo.status} — complete nahi hui.`;
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
          error: 'Payment verify fail. Test mode me UPI use karein: success@razorpay (card international block ho sakta hai).'
        });
      }

      paymentOrder.status = 'paid';
      paymentOrder.razorpayPaymentId = razorpay_payment_id;
      paymentOrder.razorpaySignature = razorpay_signature;
      paymentOrder.paidAt = new Date();
      await paymentOrder.save();

      activateOwnerPlan(user, paymentOrder.plan, PLAN_DURATION_DAYS);
      user.lastPaymentId = razorpay_payment_id;
      user.lastPaymentAt = new Date();
      await user.save();

      res.json({
        success: true,
        message: `${PLANS[paymentOrder.plan].name} plan ${PLAN_DURATION_DAYS} din ke liye activate ho gaya!`,
        subscription: buildSubscriptionPayload(user),
        paymentId: razorpay_payment_id
      });
    } catch (e) {
      console.error('Razorpay verify error:', e);
      res.status(500).json({ error: e.message || 'Payment verify fail hua.' });
    }
  });

  return { PaymentOrder };
}

module.exports = {
  setupRazorpayPayments,
  isRazorpayConfigured,
  PLAN_AMOUNTS_PAISE
};
