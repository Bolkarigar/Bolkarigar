require('dotenv').config();

const http = require('http');
const crypto = require('crypto');
const WebSocket = require('ws');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fetch = require('node-fetch');
const { exec } = require('child_process');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 🟢 IMPORT COMPREHENSIVE SYSTEM PROMPT
const { BOLKARIGAR_SYSTEM_PROMPT } = require('./system-prompt.js');
const { getOfflineAiReply, isValidGeminiApiKey } = require('./ai-offline.js');
const { setupProFeatures, LEDGER_GROUPS_FULL } = require('./pro-features.js');
const rbac = require('./rbac');
const { PERMISSIONS, effectiveRole, getPermissionsForRole, requirePermission, requireOwner, requireDashboardUpdate } = rbac;
const { setupLiveFeatures } = require('./live-features');
const { isEmailConfigured, sendPasswordResetOtp } = require('./email-service');
const {
  getSubscriptionForUser,
  setupSubscription,
  isPathSubscriptionExempt,
  requireBusinessPlan
} = require('./subscription');
const { setupRazorpayPayments } = require('./razorpay-payments');
const { setupDevPlanToggle } = require('./dev-plan-toggle');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 5002;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 16) {
  logger.error('✗ FATAL: JWT_SECRET missing ya bahut chhota hai. .env file me ek strong JWT_SECRET set karo.');
  logger.error('  Generate karne ke liye: node -e "logger.info(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

// 🔴 1. MIDDLEWARE SETUP (इसे सभी routes से ऊपर होना ज़रूरी है)
// 🟡 SECURITY FIX: helmet se kaafi standard security headers mil jaate hain
// (X-Content-Type-Options, X-Frame-Options, HSTS waghera) jo pehle bilkul
// nahi the. NOTE: contentSecurityPolicy yahan disable rakha hai kyunki
// frontend abhi bahut saari jagah inline onclick="..." aur inline <style>
// use karta hai — default strict CSP unhe tod deta. Future mein CSP bhi
// chahiye to pehle inline handlers ko addEventListener wale pattern mein
// badalna padega (bada refactor hai).
app.use(helmet({ contentSecurityPolicy: false }));

// 🟡 SECURITY FIX: pehle sirf login route par hi rate-limit tha. Ab har
// /api/* route par ek halka general limit bhi hai — taaki koi bhi single
// IP se pura backend spam/DoS na kar sake. Yeh login/ask ke apne khaas,
// zyada strict limiters ke ADDITION mein hai, unki jagah nahi.
const generalApiHits = new Map();
app.use('/api', (req, res, next) => {
  const key = req.ip;
  const entry = generalApiHits.get(key) || { count: 0, windowStart: Date.now() };
  if (Date.now() - entry.windowStart > 15 * 60 * 1000) {
    entry.count = 0;
    entry.windowStart = Date.now();
  }
  entry.count++;
  generalApiHits.set(key, entry);
  if (entry.count > 300) {
    return res.status(429).json({ error: 'Bahut zyada requests is IP se. Thodi der baad try karein.' });
  }
  next();
});

app.use(express.json({ limit: '8mb' }));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
    : true
}));

// Browser cache band — purani sidebar/JS files na dikhein
app.use((req, res, next) => {
  if (/\.(html|js|css)$/.test(req.path) || req.path === '/' || req.path.endsWith('.html')) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// 🟢 2. GEMINI AI SETUP
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Auth middleware placeholder — User model ke baad poora version set hota hai (line ~350)
let authenticateToken = (req, res, next) => res.status(503).json({ error: 'Server starting...' });
function dataUid(req) { return req.dataUserId || req.user?.id; }

// 🔴 SECURITY FIX: Yeh route pehle bina kisi authentication ke khula hua tha —
// koi bhi (bina login kiye, seedha internet se) is route ko hit karke aapki
// paid Gemini API key use kar sakta tha, jisse bill badh sakta tha. Ab
// 'authenticateToken' zaroori hai, aur ek simple per-user rate-limit bhi
// laga diya hai taaki ek user bhi spam na kar sake.
const askAttempts = new Map();
function isAskRateLimited(userId) {
  const entry = askAttempts.get(userId);
  if (!entry) return false;
  if (entry.count >= 20 && Date.now() - entry.windowStart < 60 * 1000) return true;
  if (Date.now() - entry.windowStart >= 60 * 1000) askAttempts.delete(userId);
  return false;
}
function recordAskAttempt(userId) {
  const entry = askAttempts.get(userId) || { count: 0, windowStart: Date.now() };
  entry.count++;
  askAttempts.set(userId, entry);
}

// AI Endpoint: Direct Ask Route
app.post("/api/ask", authenticateToken, requireBusinessPlan, async (req, res) => {
  try {
    if (isAskRateLimited(req.user.id)) {
      return res.status(429).json({ error: "Bahut zyada requests. 1 minute baad try karein." });
    }
    recordAskAttempt(req.user.id);

    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    res.json({ text: response.text() });
  } catch (error) {
    logger.error("Ask AI Error:", error);
    res.status(500).json({ error: "AI response failed" });
  }
});

// System Prompt for Chat Bot — now using the comprehensive prompt from system-prompt.js
const AI_SYSTEM_PROMPT = BOLKARIGAR_SYSTEM_PROMPT;
const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash'];

async function callGeminiChat(userMessage) {
  let lastErr = null;
  for (const modelName of GEMINI_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: AI_SYSTEM_PROMPT
      });
      const result = await model.generateContent(userMessage);
      const text = result.response.text().trim();
      if (text) return { reply: text, model: modelName };
    } catch (err) {
      lastErr = err;
      logger.info(`[Gemini] ${modelName} fail:`, err.message);
    }
  }
  throw lastErr || new Error('Gemini models unavailable');
}

// Voice parse — structured JSON from natural Hindi (Pro + Business, no chat plan gate)
async function callGeminiVoiceParse(text) {
  const prompt = `You are BolKarigar voice parser. Extract shop command from Hindi/Hinglish.
Return ONLY valid JSON (no markdown, no explanation).
Input: "${String(text).replace(/"/g, '\\"').slice(0, 500)}"
Schema: {"intent":"invoice|todo|nav|none","customer":"","product":"","price":0,"qty":1,"state":"","pin":"","save":true}
Rules: "Ram ne laptop liya 25000 ka Haryana pincode 123456" -> invoice, save true. Pin is 6 digits. State = Indian state name.`;
  let lastErr = null;
  for (const modelName of GEMINI_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const raw = result.response.text().trim().replace(/^```json\s*|```$/g, '').trim();
      const parsed = JSON.parse(raw);
      return parsed;
    } catch (err) {
      lastErr = err;
      logger.info(`[Voice Parse] ${modelName} fail:`, err.message);
    }
  }
  throw lastErr || new Error('Voice parse unavailable');
}

app.post('/api/voice/parse', authenticateToken, async (req, res) => {
  try {
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ success: false, error: 'Text required' });

    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!isValidGeminiApiKey(apiKey)) {
      return res.json({ success: false, localOnly: true, error: 'Gemini key missing' });
    }

    const parsed = await callGeminiVoiceParse(text);
    return res.json({ success: true, parsed });
  } catch (err) {
    logger.error('Voice parse error:', err.message);
    return res.json({ success: false, error: err.message });
  }
});

// AI Endpoint: Live Chat
app.post('/api/ai/chat', authenticateToken, requireBusinessPlan, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.json({ reply: "Kuch bola nahi gaya, phir se try karo.", source: 'offline' });
    }

    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!isValidGeminiApiKey(apiKey)) {
      logger.warn('[AI Chat] Invalid/missing Gemini key — using offline knowledge. Key should start with AIza from https://aistudio.google.com/app/apikey');
      const offlineReply = getOfflineAiReply(message);
      return res.json({ reply: offlineReply, source: 'offline', hint: 'Valid Gemini key ke liye Google AI Studio se AIza... wali key .env me daalein.' });
    }

    try {
      const { reply, model } = await callGeminiChat(message.trim());
      return res.json({ reply, source: 'gemini', model });
    } catch (geminiErr) {
      logger.error('Gemini API Error:', geminiErr.message);
      const offlineReply = getOfflineAiReply(message);
      const errorMsg = geminiErr.message || '';
      let hint = '';
      if (errorMsg.includes('API_KEY') || errorMsg.includes('API key') || errorMsg.includes('403')) {
        hint = 'API key galat hai — https://aistudio.google.com/app/apikey se nayi AIza... key banayein.';
      }
      return res.json({ reply: offlineReply, source: 'offline', hint });
    }
  } catch (err) {
    logger.error('AI chat error:', err);
    res.json({ reply: getOfflineAiReply(req.body?.message || ''), source: 'offline' });
  }
});

// 🟡 3. MONGODB CONNECTION
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bolkarigar')
  .then(() => {
    logger.info('✓ MongoDB Connected Successfully');
    seedAdmin().catch(err => logger.error('Seed Admin Error:', err));
  })
  .catch(err => logger.error('✗ MongoDB Connection Error:', err));

// --- Schemas & Models ---
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true },
  // 🟢 Forgot-password flow ke liye — plaintext token kabhi store nahi karte,
  // sirf uska hash rakhte hain (standard security practice), aur expiry bhi.
  resetTokenHash: { type: String, default: null },
  resetTokenExpiry: { type: Date, default: null },
  // 🟢 DESKTOP AGENT: yeh ek permanent (non-expiring) token hai jo sirf
  // Desktop Agent app apne aap ko pehchanwane ke liye use karta hai — normal
  // login JWT (24h expiry) ki tarah baar-baar login karne ki zaroorat nahi
  // padti Agent ko. Regenerate button se purana turant invalid ho jaata hai.
  agentToken: { type: String, default: null, index: true, sparse: true },
  role: { type: String, enum: ['owner', 'manager', 'cashier', 'staff'], default: 'owner' },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  staffInviteCode: { type: String, default: null },
  staffInviteRole: { type: String, enum: ['cashier', 'manager', 'staff', null], default: null },
  // Owner subscription — staff accounts NEVER pay (ownerId set = free via invite)
  plan: { type: String, enum: ['starter', 'pro', 'business'], default: 'pro' },
  subscriptionStatus: { type: String, enum: ['trial', 'active', 'expired'], default: 'trial' },
  trialStartedAt: { type: Date, default: null },
  trialEndsAt: { type: Date, default: null },
  planExpiresAt: { type: Date, default: null },
  trialUsed: { type: Boolean, default: false },
  lastPaymentId: { type: String, default: null },
  lastPaymentAt: { type: Date, default: null }
});

const DataSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  todos: { type: [String], default: [] },
  projects: { type: Array, default: [] },
  expenses: { type: Array, default: [] },
  invoices: { type: Array, default: [] }
});

// ==================================================================================
// 🟢 SALES HISTORY (permanent record) — pehle "Total Sales" panel usi
// draft "invoices" array ko padhta tha jo Invoice form use karta hai naya
// bill banane ke liye. Isliye jab aap draft table se item delete karte,
// woh sale history se bhi hamesha ke liye gayab ho jaata tha!
//
// Ab yeh alag, permanent collection hai — draft invoice table se koi
// lena-dena nahi. Jab bhi "Add Item" hota hai, ek copy yahan bhi save
// ho jaati hai (jo kabhi automatically delete nahi hoti).
// ==================================================================================
const salesHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  invoiceNo: String,
  customer: String,
  product: String,
  hsn: String,
  qty: Number,
  price: Number,
  gstRate: Number,
  totalAmount: Number,
  paymentType: { type: String, default: 'Cash' },
  status: { type: String, default: 'Paid' },
  date: { type: Date, default: Date.now }
});

const businessProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  companyName: String,
  gstin: String,
  phone: String,
  upiId: String,
  statePincode: String,
  fullAddress: String,
  // 🟢 Desktop Agent (Tally Sync Agent) is token se apne aap ko is user ke
  // account ke saath pair karta hai — taaki cloud backend jaan sake ki
  // konsa agent connection kis dukaandaar/company ka hai.
  agentToken: { type: String, default: null },
  invoiceCounter: { type: Number, default: 0 }
});

// 🟢 Real Gallery — user ki apni uploaded photos (pehle sirf fake random
// stock photos dikhti thi)
// 🟡 PERFORMANCE FIX: pehle poori base64 image string (5MB tak) seedhe is
// document ke andar store hoti thi — bahut users/photos hone par MongoDB
// collection bahut bhaari/slow ho jaati (aur MongoDB ke 16MB-per-document
// limit ke bhi paas pahunch sakti thi). Ab hum MongoDB ke apne built-in
// GridFS (bade files ke liye banaya gaya feature) mein image store karte
// hain — koi third-party service (S3/Cloudinary) signup ki zaroorat nahi,
// same MongoDB connection use hoti hai, bas properly chunk karke store hoti hai.
const photoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  caption: { type: String, default: '' },
  fileId: { type: mongoose.Schema.Types.ObjectId, required: true }, // GridFS file ka reference
  contentType: { type: String, default: 'image/jpeg' },
  createdAt: { type: Date, default: Date.now }
});

// ==================================================================================
// 🟢 KHATA PRO — Tally-jaisa poora accounting module (Ledger, Stock, Vouchers,
// Reports). Pehle yeh schemas the lekin userId nahi tha — matlab sabhi users
// ka data mix ho jaata (bada bug). Ab fix kiya, aur Tally ke real voucher
// types/groups add kiye.
// ==================================================================================
const LEDGER_GROUPS = LEDGER_GROUPS_FULL;
const VOUCHER_TYPES = ['Sales', 'Purchase', 'Payment', 'Receipt', 'Journal', 'Contra', 'Debit Note', 'Credit Note'];

const ledgerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  partyName: { type: String, required: true },
  ledgerGroup: { type: String, enum: LEDGER_GROUPS, default: 'Sundry Debtor' },
  partyType: { type: String, enum: ['Debtor', 'Creditor'], default: 'Debtor' }, // backward-compat
  mobile: String,
  gstin: String,
  address: String,
  openingBalance: { type: Number, default: 0 },
  currentBalance: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const itemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  itemName: { type: String, required: true },
  unit: { type: String, default: 'Pcs' },
  hsnCode: String,
  gstRate: { type: Number, default: 0 },
  purchasePrice: { type: Number, default: 0 },
  sellingPrice: { type: Number, default: 0 },
  openingStock: { type: Number, default: 0 },
  stockQty: { type: Number, default: 0 },
  godown: { type: String, default: 'Main Godown' },
  batchNo: String,
  reorderLevel: { type: Number, default: 5 },
  expiryDate: Date,
  createdAt: { type: Date, default: Date.now }
});

const voucherSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  voucherType: { type: String, enum: VOUCHER_TYPES, required: true },
  voucherNo: { type: String },
  partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ledger' },
  // Contra/Journal me dusra ledger bhi lagta hai (jaise Cash → Bank)
  secondaryLedgerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ledger' },
  amount: { type: Number, required: true },
  items: [{
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    itemName: String,
    qty: Number,
    rate: Number,
    gstRate: Number
  }],
  note: String,
  supplierInvoiceNo: String,
  supplierGstin: String,
  paymentMode: String,
  syncedToTally: { type: Boolean, default: false },
  tallyXml: String,
  date: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const UserData = mongoose.model('UserData', DataSchema);
const SalesHistory = mongoose.model('SalesHistory', salesHistorySchema);
const BusinessProfile = mongoose.model('BusinessProfile', businessProfileSchema);
const Photo = mongoose.model('Photo', photoSchema);
const Ledger = mongoose.model('Ledger', ledgerSchema);
const Item = mongoose.model('Item', itemSchema);
const Voucher = mongoose.model('Voucher', voucherSchema);

// Auth Middleware — JWT + owner data ID (staff → owner ka data)
authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access Denied. Token Missing.' });

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or Expired Token' });
    req.user = user;
    try {
      const dbUser = await User.findById(user.id);
      req.dataUserId = dbUser?.ownerId ? String(dbUser.ownerId) : String(user.id);
      req.userRole = dbUser?.role || 'owner';
      req.isStaffAccount = !!dbUser?.ownerId;

      if (dbUser) {
        const subscription = await getSubscriptionForUser(User, dbUser);
        req.subscription = subscription;
        if (!isPathSubscriptionExempt(req) && !subscription.isActive) {
          return res.status(402).json({
            error: subscription.isStaffAccount
              ? 'Shop ka plan expire ho gaya. Malik se subscription renew karwain.'
              : 'Aapka 3 din ka free trial khatam ho gaya. Plan renew karein.',
            code: 'SUBSCRIPTION_EXPIRED',
            subscription
          });
        }
      }
    } catch {
      req.dataUserId = String(user.id);
      req.userRole = 'owner';
      req.isStaffAccount = false;
    }
    next();
  });
};

// Seeder
async function seedAdmin() {
  const adminExists = await User.findOne({ username: 'admin' });
  if (!adminExists) {
    // Security: predictable default password ('1234') hata diya — ab
    // random password generate hota hai aur sirf ek baar console me
    // dikhta hai, taaki koi bhi guess na kar sake.
    const randomPassword = require('crypto').randomBytes(6).toString('hex');
    const hashedPassword = await bcrypt.hash(randomPassword, 10);
    const newAdmin = await User.create({
      username: 'admin',
      password: hashedPassword,
      email: 'admin@bolkarigar.com',
      plan: 'business',
      subscriptionStatus: 'active',
      planExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    });
    await UserData.create({ userId: newAdmin._id });
    logger.info('✓ Default Admin Seeded.');
    logger.info(`  Username: admin`);
    logger.info(`  Password: ${randomPassword}  (ISE ABHI NOTE KAR LO — dobara nahi dikhega, .env me nahi hai)`);
  }
}

// --- Auth Endpoints ---

// 🟢 SECURITY FIX: signup aur forgot-password pe bhi rate-limit — pehle
// sirf login pe tha. Bina isske koi bhi bot thousands of fake accounts
// bana sakta hai, ya kisi ke email pe reset-link spam bhej sakta hai.
const authActionAttempts = new Map();
function isAuthActionRateLimited(key, maxAttempts = 5, windowMs = 10 * 60 * 1000) {
  const entry = authActionAttempts.get(key);
  if (!entry) return false;
  if (entry.count >= maxAttempts && Date.now() - entry.firstAttempt < windowMs) return true;
  if (Date.now() - entry.firstAttempt >= windowMs) authActionAttempts.delete(key);
  return false;
}
function recordAuthAction(key) {
  const entry = authActionAttempts.get(key) || { count: 0, firstAttempt: Date.now() };
  entry.count++;
  authActionAttempts.set(key, entry);
}

app.post('/api/auth/signup', async (req, res) => {
  const rlKey = `signup:${req.ip}`;
  if (isAuthActionRateLimited(rlKey, 5, 10 * 60 * 1000)) {
    return res.status(429).json({ error: 'Bahut zyada signup attempts. 10 minute baad try karein.' });
  }
  recordAuthAction(rlKey);
  try {
    const username = String(req.body.username || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = req.body.password;
    const requestedPlan = ['pro', 'business', 'starter'].includes(req.body.plan) ? req.body.plan : 'pro';

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email aur password teeno zaroori hain.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password kam se kam 6 characters ka hona chahiye.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Sahi email address daalein.' });
    }

    const userExists = await User.findOne({ $or: [{ username }, { email }] });
    if (userExists) return res.status(400).json({ error: 'Username ya Email pehle se registered hai!' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date();
    const trialEndsAt = new Date(now);
    trialEndsAt.setDate(trialEndsAt.getDate() + 3);
    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
      role: 'owner',
      plan: requestedPlan === 'business' ? 'pro' : requestedPlan,
      subscriptionStatus: 'trial',
      trialStartedAt: now,
      trialEndsAt,
      trialUsed: true
    });
    await UserData.create({ userId: newUser._id });

    const token = jwt.sign({ id: newUser._id, username: newUser.username }, JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({
      message: `Account ban gaya! 3 din ka FREE Pro trial shuru — ${trialEndsAt.toLocaleDateString('en-IN')} tak full access.`,
      trialEndsAt,
      token,
      username: newUser.username,
      plan: requestedPlan
    });
  } catch (err) {
    logger.error('Signup error', { err: err.message, stack: err.stack, ip: req.ip });
    res.status(500).json({ error: 'Server Error during Registration' });
  }
});

// Simple in-memory rate limiter for login (bina extra npm package ke) —
// brute-force password guessing rokne ke liye. 5 galat attempts ke baad
// 2 minute ka cooldown lagta hai us IP+username combo ke liye.
const loginAttempts = new Map();
function isRateLimited(key) {
  const entry = loginAttempts.get(key);
  if (!entry) return false;
  if (entry.count >= 5 && Date.now() - entry.firstAttempt < 2 * 60 * 1000) return true;
  if (Date.now() - entry.firstAttempt >= 2 * 60 * 1000) loginAttempts.delete(key);
  return false;
}
function recordFailedAttempt(key) {
  const entry = loginAttempts.get(key) || { count: 0, firstAttempt: Date.now() };
  entry.count++;
  loginAttempts.set(key, entry);
}
function clearAttempts(key) {
  loginAttempts.delete(key);
}

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const rateLimitKey = `${req.ip}:${username}`;

  if (isRateLimited(rateLimitKey)) {
    return res.status(429).json({ error: 'Bahut zyada galat attempts. 2 minute baad try karein.' });
  }

  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connect nahi hua. Server restart karein aur 10 second wait karein.' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      recordFailedAttempt(rateLimitKey);
      return res.status(400).json({ error: 'User nahi mila!' });
    }

    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) {
      recordFailedAttempt(rateLimitKey);
      return res.status(400).json({ error: 'Galat password!' });
    }

    clearAttempts(rateLimitKey);
    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    const role = user.ownerId ? (user.role || 'staff') : 'owner';

    let subscription = null;
    try {
      subscription = await getSubscriptionForUser(User, user);
    } catch (subErr) {
      logger.error('Login subscription warning:', subErr.message);
      subscription = { isActive: true, isTrial: false, planName: 'Pro Dukaan', daysLeft: 0 };
    }

    res.json({
      token,
      username: user.username,
      role,
      isStaff: !!user.ownerId,
      roleLabel: rbac.ROLE_LABELS[role] || role,
      permissions: getPermissionsForRole(role),
      subscription,
      message: user.ownerId
        ? `${rbac.ROLE_LABELS[role] || role} account — malik ne invite diya, aapko alag plan nahi kharidna.`
        : subscription.isTrial
          ? `🎉 ${subscription.daysLeft} din ka Pro trial active hai!`
          : null
    });
  } catch (err) {
    logger.error('Login error:', err);
    res.status(500).json({ error: 'Server Error during Login' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('username email role ownerId plan subscriptionStatus trialEndsAt planExpiresAt');
    const dataId = dataUid(req);
    const hasData = await UserData.findOne({ userId: dataId });
    const salesCount = await SalesHistory.countDocuments({ userId: dataId });
    const role = user?.ownerId ? (user?.role || 'staff') : 'owner';
    const subscription = await getSubscriptionForUser(User, user);
    res.json({
      username: user?.username,
      email: user?.email,
      role,
      isStaff: !!user?.ownerId,
      dataUserId: dataId,
      permissions: getPermissionsForRole(role),
      tabs: rbac.TAB_ACCESS,
      roleLabel: rbac.ROLE_LABELS[role] || role,
      subscription,
      hasTodos: (hasData?.todos?.length || 0) > 0,
      salesCount,
      invoicesCount: (hasData?.invoices?.length || 0)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 🔴 BUG FIX #1: pehle is route mein try/catch hi nahi tha — DB mein koi bhi
// glitch aane par poora server crash ho sakta tha sabhi users ke liye.
// 🔴 BUG FIX #2: pehle yeh route batata tha ki email exist karta hai ya nahi
// (404 vs success) — isse attacker pata laga sakta tha kaunse emails
// registered hain (privacy leak). Ab hum hamesha WAHI generic message
// dete hain, chahe email mile ya na mile.
// 🔴 BUG FIX #3: pehle "reset link bhej diya" bolta tha lekin asal mein
// koi email bhejta hi nahi tha — feature bilkul kaam nahi karta tha. Ab
// genuinely ek secure, time-limited reset token generate hota hai. Agar
// .env mein SMTP settings di hui hain to real email jaayega; warna (jab
// tak aap email service setup nahi karte) reset link server ke console
// mein print hota hai taaki testing ke dauraan feature use ho sake.
app.post('/api/auth/forgot-password', async (req, res) => {
  const genericMsg = { message: 'Agar yeh email registered hai, to OTP bhej diya gaya hai.' };
  const rlKey = `forgot:${req.ip}`;
  if (isAuthActionRateLimited(rlKey, 5, 10 * 60 * 1000)) {
    // Yahan bhi generic message hi bhejte hain — enumeration/timing leak se bachne ke liye.
    return res.json(genericMsg);
  }
  recordAuthAction(rlKey);
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) return res.json(genericMsg);

    const user = await User.findOne({ email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
    if (user) {
      if (!isEmailConfigured()) {
        return res.status(503).json({
          error: 'Password reset email abhi server par setup nahi hai. Support: support@bolkarigar.com — ya Render me SMTP/Resend keys add karein.'
        });
      }

      const otp = String(crypto.randomInt(100000, 1000000));
      const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
      user.resetTokenHash = otpHash;
      user.resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000);
      user.resetOtpAttempts = 0;
      await user.save();

      try {
        const delivery = await sendPasswordResetOtp(user.email, otp);
        if (!delivery.sent) {
          return res.status(503).json({
            error: 'OTP email bhej nahi paya. Thodi der baad try karein ya support@bolkarigar.com par contact karein.'
          });
        }
      } catch (mailErr) {
        logger.error('Reset OTP email error:', mailErr.message);
        user.resetTokenHash = null;
        user.resetTokenExpiry = null;
        await user.save();
        return res.status(503).json({
          error: 'Email bhejne mein error aaya. Email sahi hai? Spam folder check karein ya baad mein try karein.'
        });
      }
    }

    return res.json({ ...genericMsg, emailDelivered: true });
  } catch (err) {
    logger.error('Forgot-password error:', err);
    return res.json(genericMsg); // crash ki jagah bhi generic message hi dete hain
  }
});

// Naya route: OTP verify karke asal mein password change karta hai.
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const { otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, OTP aur naya password zaroori hain.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password kam se kam 6 characters ka hona chahiye.' });
    }

    // 🟢 Brute-force safety: OTP sirf 6-digit hai (10 lakh combinations),
    // isliye per-email attempt limit bhi zaroori hai warna koi guess kar
    // sakta hai. 5 galat attempts ke baad OTP turant invalid kar dete hain.
    const rlKey = `reset-otp:${email}`;
    if (isAuthActionRateLimited(rlKey, 5, 10 * 60 * 1000)) {
      return res.status(429).json({ error: 'Bahut zyada galat attempts. Dobara "Forgot Password" se naya OTP mangwayein.' });
    }

    const otpHash = crypto.createHash('sha256').update(String(otp)).digest('hex');
    const user = await User.findOne({
      email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      resetTokenHash: otpHash,
      resetTokenExpiry: { $gt: new Date() }
    });

    if (!user) {
      recordAuthAction(rlKey);
      return res.status(400).json({ error: 'OTP galat ya expire ho chuka hai. Dobara "Forgot Password" try karein.' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetTokenHash = null;
    user.resetTokenExpiry = null;
    await user.save();

    res.json({ message: 'Password successfully reset ho gaya! Ab naye password se login karein.' });
  } catch (err) {
    logger.error('Reset-password error:', err);
    res.status(500).json({ error: 'Password reset karne mein dikkat aayi.' });
  }
});

// --- Business Profile & Sync Endpoints ---
app.get('/api/dashboard/sync', authenticateToken, async (req, res) => {
  try {
    let data = await UserData.findOne({ userId: req.dataUserId });
    if (!data) data = await UserData.create({ userId: req.dataUserId });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Data load karne mein dikkat aayi.' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    version: 'live-ready-v1',
    mongo: mongoose.connection.readyState === 1,
    env: process.env.NODE_ENV || 'development'
  });
});

// Server-side invoice numbering (multi-device safe)
app.get('/api/invoices/next-number', authenticateToken, async (req, res) => {
  try {
    const profile = await BusinessProfile.findOneAndUpdate(
      { userId: req.dataUserId },
      { $inc: { invoiceCounter: 1 } },
      { new: true, upsert: true }
    );
    const companyName = profile.companyName || 'INV';
    const prefix = companyName.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 4) || 'INV';
    const year = String(new Date().getFullYear()).slice(-2);
    const invoiceNo = `${prefix}/${profile.invoiceCounter}/${year}`;
    res.json({ success: true, invoiceNo, counter: profile.invoiceCounter });
  } catch (err) {
    res.status(500).json({ error: 'Invoice number generate nahi ho paya.' });
  }
});

app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const profile = await BusinessProfile.findOne({ userId: req.dataUserId });
    res.json(profile || {});
  } catch (err) {
    res.status(500).json({ error: "Profile fetch error" });
  }
});

app.post('/api/profile', authenticateToken, requirePermission(PERMISSIONS.PROFILE_EDIT), async (req, res) => {
  try {
    const { companyName, gstin, phone, upiId, statePincode, fullAddress } = req.body;
    if (!companyName || !gstin || !fullAddress) {
      return res.status(400).json({ error: 'Company Name, GSTIN aur Address zaroori hain.' });
    }
    const profile = await BusinessProfile.findOneAndUpdate(
      { userId: req.dataUserId },
      { $set: { companyName, gstin, phone, upiId, statePincode, fullAddress } },
      { new: true, upsert: true }
    );
    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ error: 'Profile save karne mein dikkat aayi.' });
  }
});

// ==================================================================================
// 🟢 SALES HISTORY — permanent record routes (Invoice draft table se
// bilkul alag, kabhi automatically delete nahi hota)
// ==================================================================================
app.post('/api/sales/record', authenticateToken, async (req, res) => {
  try {
    const { invoiceNo, customer, product, hsn, qty, price, gstRate, totalAmount, paymentType, status } = req.body;
    if (!customer || !product) return res.status(400).json({ error: 'Customer aur product zaroori hain.' });

    const record = await SalesHistory.create({
      userId: req.dataUserId,
      invoiceNo, customer, product, hsn,
      qty: qty || 1, price: price || 0, gstRate: gstRate || 0,
      totalAmount: totalAmount || 0,
      paymentType: paymentType || 'Cash',
      status: status || 'Paid'
    });
    res.json({ success: true, record });
  } catch (err) {
    logger.error('Sales record error:', err);
    res.status(500).json({ error: 'Sales record save karne mein dikkat aayi.' });
  }
});

app.get('/api/sales', authenticateToken, async (req, res) => {
  try {
    const { search, page = 1, limit = 20, fromDate, toDate } = req.query;
    const filter = { userId: req.dataUserId };

    if (search) {
      const rx = new RegExp(search, 'i');
      filter.$or = [{ customer: rx }, { invoiceNo: rx }, { product: rx }];
    }
    if (fromDate || toDate) {
      filter.date = {};
      if (fromDate) filter.date.$gte = new Date(fromDate);
      if (toDate) filter.date.$lte = new Date(toDate);
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit) || 20);

    const [records, total] = await Promise.all([
      SalesHistory.find(filter).sort({ date: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
      SalesHistory.countDocuments(filter)
    ]);

    res.json({ success: true, records, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    logger.error('Sales list error:', err);
    res.status(500).json({ error: 'Sales history load karne mein dikkat aayi.' });
  }
});

app.delete('/api/sales/:id', authenticateToken, requirePermission(PERMISSIONS.SALES_DELETE), async (req, res) => {
  try {
    await SalesHistory.deleteOne({ _id: req.params.id, userId: req.dataUserId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Record delete karne mein dikkat aayi.' });
  }
});
// 🟢 SALES HISTORY — END

app.post('/api/dashboard/update', authenticateToken, requireDashboardUpdate, async (req, res) => {
  try {
    const { type, payload } = req.body;
    const allowed = ['todos', 'projects', 'expenses', 'invoices'];
    if (!allowed.includes(type)) return res.status(400).json({ error: 'Invalid data type.' });

    const updateObj = {};
    updateObj[type] = payload;
    let data = await UserData.findOneAndUpdate(
      { userId: req.dataUserId },
      { $set: updateObj },
      { new: true, upsert: true }
    );
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: 'Data save karne mein dikkat aayi.' });
  }
});

app.post('/api/dashboard/clear-data', authenticateToken, requirePermission(PERMISSIONS.DATA_CLEAR), async (req, res) => {
  try {
    const { type } = req.body;
    if (type === 'ALL') {
      await UserData.findOneAndUpdate(
        { userId: req.dataUserId },
        { $set: { todos: [], projects: [], expenses: [], invoices: [] } }
      );
    } else {
      const updateObj = {};
      updateObj[type] = [];
      await UserData.findOneAndUpdate({ userId: req.dataUserId }, { $set: updateObj });
    }
    res.json({ success: true, message: `${type} ka data bilkul saaf kar diya gaya hai.` });
  } catch (err) {
    res.status(500).json({ error: 'Data clear karne me error aaya.' });
  }
});

// ==================================================================================
// 🟢 TALLY PRIME INTEGRATION (asli, kaam karne wala) — pehle yeh routes exist hi
// nahi karte the, isliye "Sync to Tally" button crash karta tha. Ab yeh Tally
// Prime ke standard HTTP-XML gateway (localhost:9000) ko real Sales Voucher XML
// bhejta hai.
//
// SETUP (Tally Prime me): Gateway of Tally → F1 (Help) → Settings →
// Connectivity → Client/Server Configuration → "TallyPrime acts as" →
// "Both" ya "Server" ON karo, Port 9000 rakho.
// ==================================================================================
const xml2js = require('xml2js');
const TALLY_XML_URL = process.env.TALLY_XML_URL || 'http://localhost:9000';

// 🟢 Tally Prime ek bhaari application hai — agar woh "Sync to Tally" click karte
// hi launch trigger hui ho, to boot hone me 10-30+ second lag sakte hain. Isi
// dauraan port 9000 par kuch bhi listen nahi kar raha hota, isliye pehla attempt
// turant timeout ho jaata hai. Yeh helper thodi der ruk ruk kar 3 baar try karta
// hai, taaki Tally ko poora khulne ka mauka mile.
async function fetchTallyWithRetry(url, options, attempts = 3, delayMs = 4000) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        logger.info(`[Tally Sync] Attempt ${i + 1} fail hua (${err.message}), ${delayMs}ms baad retry...`);
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }
  throw lastErr;
}

// GST state codes (GSTIN ke pehle 2 digit se state)
const GST_STATE_CODE_MAP = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
  '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '25': 'Daman and Diu', '26': 'Dadra and Nagar Haveli', '27': 'Maharashtra',
  '28': 'Andhra Pradesh', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
  '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman and Nicobar Islands', '36': 'Telangana',
  '37': 'Andhra Pradesh', '38': 'Ladakh'
};

function tallyXmlEscape(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function normalizeStateName(state) {
  return String(state || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function stateFromGstin(gstin) {
  const code = String(gstin || '').trim().substring(0, 2);
  return GST_STATE_CODE_MAP[code] || '';
}

function deriveCompanyState(profile) {
  if (!profile) return 'Haryana';
  const fromGstin = stateFromGstin(profile.gstin);
  if (fromGstin) return fromGstin;
  const addr = String(profile.fullAddress || profile.statePincode || '').toLowerCase();
  for (const name of Object.values(GST_STATE_CODE_MAP)) {
    if (addr.includes(name.toLowerCase())) return name;
  }
  return 'Haryana';
}

function isInterStateSale(companyState, customerState) {
  const a = normalizeStateName(companyState);
  const b = normalizeStateName(customerState);
  if (!b) return false;
  return a !== b;
}

function tallyDateYmd(date = new Date()) {
  const eduSafe = new Date(date.getFullYear(), date.getMonth(), 1);
  return `${eduSafe.getFullYear()}${String(eduSafe.getMonth() + 1).padStart(2, '0')}${String(eduSafe.getDate()).padStart(2, '0')}`;
}

// Tally EDU mode sirf mahine ki 1st, 2nd, ya LAST date par voucher accept karta hai
function getTallyEduSafeDates(ref = new Date()) {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) => `${y}${pad(m + 1)}${pad(d)}`;
  return [...new Set([fmt(1), fmt(2), fmt(lastDay)])];
}

function tallyVoucherCreated(text) {
  return parseInt((text.match(/<CREATED>(\d+)<\/CREATED>/i) || [0, 0])[1], 10);
}

function tallyVoucherSuccess(text) {
  const created = tallyVoucherCreated(text);
  const imported = parseInt((text.match(/<IMPORTED>(\d+)<\/IMPORTED>/i) || [0, 0])[1], 10);
  const exceptions = parseInt((text.match(/<EXCEPTIONS>(\d+)<\/EXCEPTIONS>/i) || [0, 0])[1], 10);
  const lineErrors = extractTallyErrors(text);
  if (created >= 1 || imported >= 1) return true;
  if (exceptions === 0 && !lineErrors.length && text.includes('<LASTVCHID>')) return true;
  return false;
}

function sanitizeTallyLedgerName(name) {
  let n = String(name || '').trim();
  if (!n) return 'Cash Customer';
  if (/^\d+$/.test(n)) n = 'Party ' + n;
  if (n.length > 60) n = n.substring(0, 60);
  return n;
}

let cachedTallyCompany = { name: process.env.TALLY_COMPANY_NAME || '', fetchedAt: 0 };

async function resolveTallyCompanyName(userId, req) {
  if (process.env.TALLY_COMPANY_NAME) return process.env.TALLY_COMPANY_NAME.trim();
  if (cachedTallyCompany.name && Date.now() - cachedTallyCompany.fetchedAt < 300000) {
    return cachedTallyCompany.name;
  }
  const xml = `<?xml version="1.0"?><ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>List of Companies</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></DESC></BODY></ENVELOPE>`;
  try {
    const resp = await relayXmlToTally(userId, xml, req);
    const matches = [...resp.matchAll(/<NAME[^>]*>([^<]+)<\/NAME>/gi)];
    const name = matches.length ? matches[0][1].trim() : '';
    if (name) {
      cachedTallyCompany = { name, fetchedAt: Date.now() };
      logger.info('[Tally] Company auto-detected:', name);
      return name;
    }
  } catch (e) {
    logger.info('[Tally] Company auto-detect fail:', e.message);
  }
  return '';
}

function wrapTallyImportXml(reportName, companyName, innerRequestData) {
  const companyBlock = companyName
    ? `<STATICVARIABLES><SVCURRENTCOMPANY>${tallyXmlEscape(companyName)}</SVCURRENTCOMPANY></STATICVARIABLES>`
    : '<STATICVARIABLES></STATICVARIABLES>';
  // Tally Prime rejects legacy "Import Data" — must use TALLYREQUEST=Import + TYPE=Data + ID
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Import</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>${reportName}</ID>
  </HEADER>
  <BODY>
    <DESC>${companyBlock}</DESC>
    <DATA>${innerRequestData}</DATA>
  </BODY>
</ENVELOPE>`;
}

function buildVoucherInnerXml(vchType, date, partyLedger, narration, ledgerEntriesXml, extraFields = '') {
  const remoteId = 'bk-' + Date.now() + '-' + Math.floor(Math.random() * 9999);
  return `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <VOUCHER REMOTEID="${remoteId}" VCHTYPE="${vchType}" ACTION="Create" OBJVIEW="Accounting Voucher View">
        <OLDAUDITENTRYIDS.LIST TYPE="Number"><OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS></OLDAUDITENTRYIDS.LIST>
        <DATE>${date}</DATE>
        <EFFECTIVEDATE>${date}</EFFECTIVEDATE>
        <VOUCHERTYPENAME>${vchType}</VOUCHERTYPENAME>
        ${partyLedger ? `<PARTYLEDGERNAME>${tallyXmlEscape(partyLedger)}</PARTYLEDGERNAME><PARTYNAME>${tallyXmlEscape(partyLedger)}</PARTYNAME>` : ''}
        <NARRATION>${tallyXmlEscape(narration || 'BolKarigar sync')}</NARRATION>
        <VCHSTATUSISUNDELETED>Yes</VCHSTATUSISUNDELETED>
        ${extraFields}
        ${ledgerEntriesXml}
      </VOUCHER>
    </TALLYMESSAGE>`;
}

function twoLineEntries(customer, salesLedger, grandTotal) {
  const amt = Number(grandTotal).toFixed(2);
  return `
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${tallyXmlEscape(customer)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
          <ISLASTDEEMEDPOSITIVE>Yes</ISLASTDEEMEDPOSITIVE>
          <AMOUNT>-${amt}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${tallyXmlEscape(salesLedger)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${amt}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`;
}

function extractTallyErrors(tallyResponseText) {
  const errors = [];
  const patterns = [
    /<LINEERROR>(.*?)<\/LINEERROR>/gis,
    /<REMOTELINEERROR>(.*?)<\/REMOTELINEERROR>/gis,
    /<ERRORMESSAGE>(.*?)<\/ERRORMESSAGE>/gis,
    /<EXCEPTIONMSG>(.*?)<\/EXCEPTIONMSG>/gis,
    /<MESSAGE>(.*?)<\/MESSAGE>/gis
  ];
  for (const re of patterns) {
    for (const m of tallyResponseText.matchAll(re)) {
      const msg = m[1].replace(/<[^>]+>/g, '').trim();
      if (msg && msg.length > 2 && !errors.includes(msg)) errors.push(msg);
    }
  }
  const exc = tallyResponseText.match(/<EXCEPTIONS>(\d+)<\/EXCEPTIONS>/i);
  if (!errors.length && exc && parseInt(exc[1], 10) > 0) {
    errors.push(`Tally EDU/Exception: ${exc[1]} error(s) — GST voucher reject ho sakta hai, simple mode try ho raha hai.`);
  }
  return errors;
}

function parseTallyMasterResponse(text) {
  const altered = parseInt((text.match(/<ALTERED>(\d+)<\/ALTERED>/i) || [0, 0])[1], 10);
  const created = parseInt((text.match(/<CREATED>(\d+)<\/CREATED>/i) || [0, 0])[1], 10);
  const errors = extractTallyErrors(text);
  if (errors.length && created === 0 && altered === 0) {
    throw new Error(errors.join(' | '));
  }
  return { created, altered };
}

function parseTallyVoucherResponse(text) {
  const errors = extractTallyErrors(text);
  if (!tallyVoucherSuccess(text)) {
    throw new Error(errors.length ? errors.join(' | ') : 'Tally ne voucher create nahi kiya (CREATED=0).');
  }
  return true;
}

function buildTallyMinimalMastersXml({ customer, customerState, companyName }) {
  const cust = sanitizeTallyLedgerName(customer);
  const partyState = customerState || 'Haryana';
  const masters = `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <LEDGER NAME="${tallyXmlEscape(cust)}" ACTION="Create">
        <PARENT>Sundry Debtors</PARENT>
        <ISBILLWISEON>Yes</ISBILLWISEON>
        <COUNTRYNAME>India</COUNTRYNAME>
        <STATENAME>${tallyXmlEscape(partyState)}</STATENAME>
      </LEDGER>
    </TALLYMESSAGE>
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <LEDGER NAME="Sales Account" ACTION="Create">
        <PARENT>Sales Accounts</PARENT>
      </LEDGER>
    </TALLYMESSAGE>
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <LEDGER NAME="Sales" ACTION="Create">
        <PARENT>Sales Accounts</PARENT>
      </LEDGER>
    </TALLYMESSAGE>`;
  return wrapTallyImportXml('All Masters', companyName, masters);
}

function buildTallyJournalVoucherXml({ customer, product, price, qty, totalAmount, tallyDate, salesLedgerName, companyName, partyLedger }) {
  const party = partyLedger || sanitizeTallyLedgerName(customer);
  const grandTotal = Number(totalAmount) || (Number(price) * Number(qty));
  const narration = partyLedger === 'Cash'
    ? `BolKarigar [${customer}]: ${product} x${qty} @ Rs.${price}`
    : `BolKarigar: ${product} x${qty} @ Rs.${price}`;
  const inner = buildVoucherInnerXml('Journal', tallyDate, party, narration, twoLineEntries(party, salesLedgerName || 'Sales Account', grandTotal));
  return wrapTallyImportXml('Vouchers', companyName, inner);
}

function buildTallySimpleSalesVoucherXml({ customer, product, price, qty, totalAmount, tallyDate, salesLedgerName = 'Sales Account', companyName, partyLedger }) {
  const party = partyLedger || sanitizeTallyLedgerName(customer);
  const grandTotal = Number(totalAmount) || (Number(price) * Number(qty));
  const narration = partyLedger === 'Cash'
    ? `BolKarigar [${customer}]: ${product} x${qty} @ Rs.${price}`
    : `${product} x${qty} @ Rs.${price} (BolKarigar)`;
  const inner = buildVoucherInnerXml('Sales', tallyDate, party, narration, twoLineEntries(party, salesLedgerName, grandTotal));
  return wrapTallyImportXml('Vouchers', companyName, inner);
}

function buildTallyLedgerMastersXml({ customer, customerGstin, customerState, gstRate, isInterState, companyName }) {
  const cust = sanitizeTallyLedgerName(customer);
  const gstinPattern = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/i;
  const cleanGstin = customerGstin ? String(customerGstin).trim().toUpperCase() : '';
  const hasGstin = gstinPattern.test(cleanGstin);
  const partyState = customerState || 'Haryana';
  const rate = Number(gstRate) || 0;
  const half = rate / 2;

  let masters = `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <LEDGER NAME="${tallyXmlEscape(cust)}" ACTION="Create">
        <PARENT>Sundry Debtors</PARENT>
        <ISBILLWISEON>Yes</ISBILLWISEON>
        <COUNTRYNAME>India</COUNTRYNAME>
        <STATENAME>${tallyXmlEscape(partyState)}</STATENAME>
        <GSTREGISTRATIONTYPE>${hasGstin ? 'Regular' : 'Unregistered/Consumer'}</GSTREGISTRATIONTYPE>
        ${hasGstin ? `<PARTYGSTIN>${cleanGstin}</PARTYGSTIN>` : ''}
      </LEDGER>
    </TALLYMESSAGE>
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <LEDGER NAME="Sales Account" ACTION="Create">
        <PARENT>Sales Accounts</PARENT>
      </LEDGER>
    </TALLYMESSAGE>`;

  if (rate > 0) {
    if (isInterState) {
      masters += `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <LEDGER NAME="Output IGST @ ${rate}%" ACTION="Create">
        <PARENT>Duties &amp; Taxes</PARENT>
        <TAXTYPE>GST</TAXTYPE>
        <GSTDUTYHEAD>Integrated Tax</GSTDUTYHEAD>
        <RATEOFTAXCALCULATION>${rate}</RATEOFTAXCALCULATION>
      </LEDGER>
    </TALLYMESSAGE>`;
    } else {
      masters += `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <LEDGER NAME="Output CGST @ ${half}%" ACTION="Create">
        <PARENT>Duties &amp; Taxes</PARENT>
        <TAXTYPE>GST</TAXTYPE>
        <GSTDUTYHEAD>Central Tax</GSTDUTYHEAD>
        <RATEOFTAXCALCULATION>${half}</RATEOFTAXCALCULATION>
      </LEDGER>
    </TALLYMESSAGE>
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <LEDGER NAME="Output SGST @ ${half}%" ACTION="Create">
        <PARENT>Duties &amp; Taxes</PARENT>
        <TAXTYPE>GST</TAXTYPE>
        <GSTDUTYHEAD>State Tax</GSTDUTYHEAD>
        <RATEOFTAXCALCULATION>${half}</RATEOFTAXCALCULATION>
      </LEDGER>
    </TALLYMESSAGE>`;
    }
  }

  return wrapTallyImportXml('All Masters', companyName, masters);
}

function buildTallySalesVoucherXml({ customer, product, price, qty, gstRate, gstAmount, totalAmount, cgst, sgst, ewayBillNo, vehicleNo, customerGstin, customerState, companyState, tallyDate, companyName }) {
  const cust = sanitizeTallyLedgerName(customer);
  const voucherDate = tallyDate || tallyDateYmd();
  const baseAmount = Number(price) * Number(qty);
  const rate = Number(gstRate) || 0;
  const grandTotal = Number(totalAmount) || (baseAmount + Number(gstAmount || 0));
  const interState = isInterStateSale(companyState, customerState);
  const half = rate / 2;
  const cgstAmt = interState ? 0 : (Number(cgst) || (baseAmount * half / 100));
  const sgstAmt = interState ? 0 : (Number(sgst) || cgstAmt);
  const igstAmt = interState ? (Number(gstAmount) || (baseAmount * rate / 100)) : 0;

  let ledgerEntries = `
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${tallyXmlEscape(cust)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
          <ISLASTDEEMEDPOSITIVE>Yes</ISLASTDEEMEDPOSITIVE>
          <AMOUNT>-${grandTotal.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>Sales Account</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${baseAmount.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`;

  if (rate > 0) {
    if (interState && igstAmt > 0) {
      ledgerEntries += `
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>Output IGST @ ${rate}%</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${igstAmt.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`;
    } else if (!interState) {
      if (cgstAmt > 0) {
        ledgerEntries += `
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>Output CGST @ ${half}%</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${cgstAmt.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`;
      }
      if (sgstAmt > 0) {
        ledgerEntries += `
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>Output SGST @ ${half}%</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${sgstAmt.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`;
      }
    }
  }

  const narration = `${product} x${qty} @ Rs.${price} (BolKarigar)${interState ? ' [Inter-State IGST]' : ''}${ewayBillNo ? ' | E-Way: ' + ewayBillNo : ''}${vehicleNo ? ' | Vehicle: ' + vehicleNo : ''}`;
  const extraFields = '<PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW><ISINVOICE>Yes</ISINVOICE>';
  const inner = buildVoucherInnerXml('Sales', voucherDate, cust, narration, ledgerEntries, extraFields);
  return wrapTallyImportXml('Vouchers', companyName, inner);
}

// 🔴 ARCHITECTURE NOTE (zaroor padhein): Tally Prime sync sirf tab kaam karta
// hai jab yeh Node.js backend AUR Tally Prime dono EK HI Windows PC par ho —
// kyunki 'exec()' se Tally.exe launch karna aur 'localhost:9000' par XML
// bhejna dono SERVER ke apne computer ke against chalte hain, user ke browser
// ke against nahi. Agar kal ko yeh app kisi cloud server (Render/Railway/
// AWS/VPS) par deploy kiya, to Tally sync KISI BHI user ke liye kaam nahi
// karega — server ka "localhost" alag machine hai, user ke PC se.
//
// Is function se pata chal jaata hai ki abhi request "local setup" jaisi
// situation mein aa rahi hai ya nahi (yeh 100% foolproof nahi hai, sirf best
// guess hai) — taaki user ko turant clear message mile, confusing 30-second
// timeout ke bajaye.
//
// ASLI FIX (jab cloud par live jaana ho): Tally sync ko is backend se hata
// kar ek chhota alag "Desktop Agent" banayein jo khud user ke PC par chale
// (jaisa UI mein pehle se "Tally Sync Agent (.exe) Download" button ka idea
// hai) — woh agent localhost:9000 se baat karega, aur cloud backend sirf
// us agent ko instruction bhejega (WebSocket ya polling se). Yeh ek alag,
// bada feature hai — abhi sirf clear warning add ki gayi hai.
function isLikelyLocalSetup(req) {
  const host = (req.hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

// ==================================================================================
// 🟢 DESKTOP AGENT RELAY (naya) — cloud par deploy hone par bhi Tally sync
// kaam karta rahe, iske liye. Concept: user apne dukaan ke PC par ek chhota
// "Desktop Agent" (agent.js — is package ke saath diya gaya hai) chalata hai.
// Woh Agent is server se ek WebSocket connection banata hai aur zinda rakhta
// hai. Jab browser "Sync to Tally" bolta hai, hum XML seedha Tally ko bhejne
// ki koshish NAHI karte (server ka localhost alag hota hai) — balki us user
// ke connected Agent ko WebSocket se XML bhejte hain, Agent apne PC ke
// localhost:9000 par Tally se baat karta hai, aur result wapas relay karta hai.
// ==================================================================================

const connectedAgents = new Map();       // userId (string) -> WebSocket
const pendingAgentRequests = new Map();  // requestId -> { resolve, reject, timeoutHandle }

function sendToAgentAndWait(userId, xml, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const ws = connectedAgents.get(String(userId));
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return reject(new Error('Desktop Agent connected nahi hai. Apne dukaan ke PC par Agent chalu karein.'));
    }
    const requestId = crypto.randomUUID();
    const timeoutHandle = setTimeout(() => {
      pendingAgentRequests.delete(requestId);
      reject(new Error('Agent ne 20 second mein jawab nahi diya. Confirm karein Tally Prime us PC par khuli hai.'));
    }, timeoutMs);

    pendingAgentRequests.set(requestId, { resolve, reject, timeoutHandle });
    ws.send(JSON.stringify({ type: 'sync_request', requestId, xml }));
  });
}

function sendOpenTallyToAgent(userId) {
  const ws = connectedAgents.get(String(userId));
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'open_tally' }));
    return true;
  }
  return false;
}

// Tally Prime ko launch karne ki koshish karta hai — agar Desktop Agent
// connected hai to usi ko instruction bhejta hai (kyunki Tally uske PC par
// hai), warna (single-PC local setup ke liye) seedha is machine par exec karta hai.
app.get('/api/tally/diagnose', authenticateToken, requireBusinessPlan, async (req, res) => {
  const report = {
    tallyUrl: TALLY_XML_URL,
    agentConnected: connectedAgents.has(String(req.dataUserId)),
    localSetup: isLikelyLocalSetup(req),
    connected: false,
    companyName: '',
    tips: []
  };
  try {
    report.companyName = await resolveTallyCompanyName(req.dataUserId, req);
    if (!report.companyName) {
      report.tips.push('Tally me company select karein (Gateway screen par), ya .env me TALLY_COMPANY_NAME=exact company naam set karein.');
    }
    const pingXml = `<?xml version="1.0"?><ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>LicenseInfo</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></DESC></BODY></ENVELOPE>`;
    const pingResp = await relayXmlToTally(req.dataUserId, pingXml, req);
    report.connected = true;
    report.tallyResponseSnippet = pingResp.substring(0, 400);
    if (pingResp.includes('Educational')) report.tips.push('Tally EDU mode detect hua — sirf mahine ke 1st, 2nd ya last date par voucher save hoga.');
    if (!report.tips.length) report.tips.push('Connection OK. Ab invoice sync try karein.');
    res.json(report);
  } catch (e) {
    report.error = e.message;
    report.tips.push('Tally Prime kholo → F1 → Settings → Connectivity → HTTP Server ON (port 9000).');
    res.status(502).json(report);
  }
});

app.post('/api/tally/open', authenticateToken, requireBusinessPlan, (req, res) => {
  if (sendOpenTallyToAgent(req.dataUserId)) {
    return res.json({ success: true, launched: true, message: 'Desktop Agent ko Tally kholne ka signal bhej diya.' });
  }

  if (!isLikelyLocalSetup(req)) {
    return res.status(400).json({
      error: 'Koi Desktop Agent connected nahi mila, aur yeh app kisi doosre server se access ho raha hai. Apne dukaan ke PC par Desktop Agent chalu karein (Settings → Desktop Agent se download karein).'
    });
  }
  const commonPaths = [
    'C:\\Program Files\\TallyPrime\\tally.exe',
    'C:\\Program Files (x86)\\TallyPrime\\tally.exe',
    'C:\\Tally.ERP9\\tally.exe'
  ];
  let launched = false;
  for (const p of commonPaths) {
    try {
      exec(`"${p}"`, (err) => { if (err) logger.info('Tally launch attempt (non-fatal):', err.message); });
      launched = true;
      break;
    } catch (e) { /* try next path */ }
  }
  res.json({ success: true, launched, message: launched ? 'Tally launch trigger kiya.' : 'Tally auto-launch nahi ho paya — manually khol lein.' });
});

app.post('/api/tally/sync-invoice', authenticateToken, requireBusinessPlan, requirePermission(PERMISSIONS.TALLY_SYNC), async (req, res) => {
  const agentConnected = connectedAgents.has(String(req.dataUserId));
  if (!agentConnected && !isLikelyLocalSetup(req)) {
    return res.status(400).json({
      error: 'Koi Desktop Agent connected nahi mila, aur yeh app kisi doosre server se access ho raha hai. Apne dukaan ke PC par Desktop Agent chalu karein (Settings → Desktop Agent se download karein), phir dobara try karein.'
    });
  }
  try {
    const { customer, product, price, qty, gstRate, gstAmount, totalAmount, cgst, sgst, ewayBillNo, vehicleNo, customerGstin, customerState } = req.body;

    if (!customer || !product || !price || !qty) {
      return res.status(400).json({ error: 'Customer, product, price aur quantity zaroori hain.' });
    }

    const profile = await BusinessProfile.findOne({ userId: req.dataUserId });
    const companyState = deriveCompanyState(profile);
    const resolvedCustomerState = customerState || companyState;
    const interState = isInterStateSale(companyState, customerState);
    const saleAmount = totalAmount || (price * qty + (gstAmount || 0));

    const voucherParams = {
      customer, product, price, qty, gstRate, gstAmount, totalAmount, cgst, sgst,
      ewayBillNo, vehicleNo, customerGstin, customerState: resolvedCustomerState, companyState
    };

    // Pehle Khata Pro me ledger + voucher (duplicate se bachne ke liye recent match dhundo)
    const ledger = await findOrCreateCustomerLedger(req.dataUserId, customer, {
      gstin: customerGstin,
      ledgerGroup: 'Sundry Debtor'
    });

    let savedVoucher = null;
    if (ledger) {
      const since = new Date(Date.now() - 2 * 60 * 60 * 1000);
      savedVoucher = await Voucher.findOne({
        userId: req.dataUserId,
        partyId: ledger._id,
        voucherType: 'Sales',
        amount: saleAmount,
        syncedToTally: false,
        date: { $gte: since }
      }).sort({ date: -1 });

      if (!savedVoucher) {
        savedVoucher = await Voucher.create({
          userId: req.dataUserId,
          voucherType: 'Sales',
          partyId: ledger._id,
          amount: saleAmount,
          note: `${customer} | ${product} x${qty}`,
          tallyXml: '',
          syncedToTally: false
        });
        await Ledger.updateOne({ _id: ledger._id, userId: req.dataUserId }, { $inc: { currentBalance: saleAmount } });
      } else {
        await savedVoucher.save();
      }
    } else {
      savedVoucher = await Voucher.create({
        userId: req.dataUserId,
        voucherType: 'Sales',
        amount: saleAmount,
        note: `${customer} | ${product} x${qty}`,
        tallyXml: '',
        syncedToTally: false
      });
    }

    try {
      const syncResult = await syncVoucherToTallyWithFallback(req.dataUserId, req, voucherParams);
      savedVoucher.tallyXml = syncResult.xml;
      savedVoucher.syncedToTally = true;
      await savedVoucher.save();

      return res.json({
        success: true,
        message: `✅ Tally me sync ho gaya! (${syncResult.mode}, date: ${syncResult.date})`,
        voucherId: savedVoucher._id,
        ledgerId: ledger ? ledger._id : null,
        tallyMode: syncResult.mode
      });
    } catch (tallyErr) {
      logger.error('Tally sync error:', tallyErr.message);
      // Honest response: bata do ki Tally tak connect nahi ho paya, par apna
      // record safe hai — silently fake success mat do.
      return res.status(502).json({
        error: agentConnected
          ? `Desktop Agent se voucher process karne mein dikkat aayi (${tallyErr.message}). Confirm karein Tally Prime us PC par khuli hai aur Settings → Connectivity me HTTP Server ON hai. Aapki invoice BolKarigar Khata mein save ho chuki hai.`
          : `Tally se connect nahi ho paya (${tallyErr.message}). Confirm karein Tally Prime khula hai aur Settings → Connectivity me HTTP Server "Both"/"Server" par ON hai, port 9000. Aapki invoice BolKarigar Khata mein save ho chuki hai.`
      });
    }
  } catch (err) {
    logger.error('Tally sync-invoice error:', err);
    res.status(500).json({ error: `Tally sync mein dikkat aayi: ${err.message}` });
  }
});
// 🟢 TALLY PRIME INTEGRATION — END

// ==================================================================================
// 🟢 GALLERY (asli) — pehle yahan sirf random picsum.photos placeholder images
// dikhti thi, koi upload button nahi tha. Ab user apni asli product photos
// upload/dekh/delete kar sakta hai.
// ==================================================================================

// GridFS bucket — mongoose ready hone ke baad hi banega (isliye ek getter function)
let galleryBucket = null;
mongoose.connection.once('open', () => {
  galleryBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'galleryPhotos' });
});

app.post('/api/gallery/upload', authenticateToken, async (req, res) => {
  try {
    const { imageData, caption } = req.body;
    if (!imageData || !imageData.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Sahi image file chuno.' });
    }
    // ~5MB se bada base64 image reject karo
    if (imageData.length > 7 * 1024 * 1024) {
      return res.status(413).json({ error: 'Image bahut badi hai — 5MB se chhoti photo use karein.' });
    }
    if (!galleryBucket) {
      return res.status(503).json({ error: 'Database abhi taiyar nahi hai, thodi der baad try karein.' });
    }

    const matches = imageData.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Image format samajh nahi aaya.' });
    const contentType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');

    const uploadStream = galleryBucket.openUploadStream(`${req.dataUserId}-${Date.now()}`, { contentType });
    uploadStream.end(buffer);

    uploadStream.on('finish', async () => {
      const photo = await Photo.create({
        userId: req.dataUserId,
        fileId: uploadStream.id,
        contentType,
        caption: caption || ''
      });
      res.json({ success: true, photo: { _id: photo._id, fileId: photo.fileId, caption: photo.caption, createdAt: photo.createdAt } });
    });
    uploadStream.on('error', (err) => {
      logger.error('Gallery GridFS upload error:', err);
      res.status(500).json({ error: 'Photo upload karne mein dikkat aayi.' });
    });
  } catch (err) {
    logger.error('Gallery upload error:', err);
    res.status(500).json({ error: 'Photo upload karne mein dikkat aayi.' });
  }
});

// List ab sirf halka metadata deta hai (fileId + caption + date) — poori image
// bytes nahi, isliye yeh request bahut fast/light hai.
app.get('/api/gallery', authenticateToken, async (req, res) => {
  try {
    const photos = await Photo.find({ userId: req.dataUserId }).sort({ createdAt: -1 });
    res.json({ success: true, photos });
  } catch (err) {
    res.status(500).json({ error: 'Gallery load karne mein dikkat aayi.' });
  }
});

// Naya route: asli image bytes stream karta hai. <img> tag Authorization
// header nahi bhej sakta, isliye yahan token query-param se bhi accept
// hota hai (sirf is read-only, apni-hi-photo-dekhne wale route ke liye).
app.get('/api/gallery/image/:fileId', async (req, res) => {
  try {
    const token = req.query.token || (req.headers['authorization'] || '').split(' ')[1];
    if (!token) return res.status(401).send('Unauthorized');
    let user;
    try { user = jwt.verify(token, JWT_SECRET); } catch { return res.status(403).send('Invalid token'); }

    const photo = await Photo.findOne({ fileId: req.params.fileId, userId: user.id });
    if (!photo) return res.status(404).send('Not found');
    if (!galleryBucket) return res.status(503).send('Not ready');

    res.set('Content-Type', photo.contentType || 'image/jpeg');
    galleryBucket.openDownloadStream(new mongoose.Types.ObjectId(req.params.fileId))
      .on('error', () => res.status(404).send('Not found'))
      .pipe(res);
  } catch (err) {
    logger.error('Gallery image stream error:', err);
    res.status(500).send('Error loading image');
  }
});

app.delete('/api/gallery/:id', authenticateToken, async (req, res) => {
  try {
    const photo = await Photo.findOne({ _id: req.params.id, userId: req.dataUserId });
    if (photo && galleryBucket) {
      try { await galleryBucket.delete(photo.fileId); } catch (e) { /* file already gone, ignore */ }
    }
    await Photo.deleteOne({ _id: req.params.id, userId: req.dataUserId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Photo delete karne mein dikkat aayi.' });
  }
});
// 🟢 GALLERY — END

// Helper: customer ledger dhundho ya naya banao (invoice / khata auto-entry ke liye)
async function findOrCreateCustomerLedger(userId, partyName, opts = {}) {
  const name = String(partyName || '').trim();
  if (!name) return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let ledger = await Ledger.findOne({ userId, partyName: new RegExp(`^${escaped}$`, 'i') });
  if (!ledger) {
    const group = opts.ledgerGroup || 'Sundry Debtor';
    ledger = await Ledger.create({
      userId,
      partyName: name,
      ledgerGroup: group,
      partyType: group === 'Sundry Creditor' ? 'Creditor' : 'Debtor',
      mobile: opts.mobile || '',
      gstin: opts.gstin || '',
      openingBalance: 0,
      currentBalance: 0
    });
  } else if (opts.gstin && !ledger.gstin) {
    ledger.gstin = opts.gstin;
    await ledger.save();
  }
  return ledger;
}

function buildTallyLedgerMasterXml({ partyName, ledgerGroup, gstin, state, companyName }) {
  const name = sanitizeTallyLedgerName(partyName);
  const gstinPattern = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/i;
  const cleanGstin = gstin ? String(gstin).trim().toUpperCase() : '';
  const hasGstin = gstinPattern.test(cleanGstin);
  const parentMap = {
    'Sundry Debtor': 'Sundry Debtors',
    'Sundry Creditor': 'Sundry Creditors',
    'Cash': 'Cash-in-Hand',
    'Bank': 'Bank Accounts',
    'Expense': 'Indirect Expenses',
    'Income': 'Indirect Incomes',
    'Capital': 'Capital Account',
    'Fixed Asset': 'Fixed Assets'
  };
  const parent = parentMap[ledgerGroup] || 'Sundry Debtors';
  const partyFields = (ledgerGroup === 'Sundry Debtor' || ledgerGroup === 'Sundry Creditor')
    ? `<ISBILLWISEON>Yes</ISBILLWISEON><COUNTRYNAME>India</COUNTRYNAME><STATENAME>${tallyXmlEscape(state || 'Haryana')}</STATENAME><GSTREGISTRATIONTYPE>${hasGstin ? 'Regular' : 'Unregistered'}</GSTREGISTRATIONTYPE>${hasGstin ? `<PARTYGSTIN>${cleanGstin}</PARTYGSTIN>` : ''}`
    : '';
  const inner = `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <LEDGER NAME="${tallyXmlEscape(name)}" ACTION="Create">
        <PARENT>${parent}</PARENT>
        ${partyFields}
      </LEDGER>
    </TALLYMESSAGE>`;
  return wrapTallyImportXml('All Masters', companyName || '', inner);
}

async function relayXmlToTally(userId, xml, req) {
  const agentConnected = connectedAgents.has(String(userId));
  if (agentConnected) {
    return sendToAgentAndWait(userId, xml);
  }
  if (!isLikelyLocalSetup(req)) {
    throw new Error('Desktop Agent connected nahi hai aur server cloud par hai. Apne Tally wale PC par Agent chalao.');
  }
  const tallyRes = await fetchTallyWithRetry(TALLY_XML_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body: xml,
    timeout: 15000
  });
  const text = await tallyRes.text();
  if (!tallyRes.ok) throw new Error(`Tally HTTP ${tallyRes.status}`);
  if (text.includes('Unknown Request')) {
    throw new Error('Tally ne XML reject kiya — company select karein aur HTTP Server ON rakhein (port 9000).');
  }
  return text;
}

// Tally EDU + full license dono ke liye — multiple strategies try karta hai
async function syncVoucherToTallyWithFallback(userId, req, params) {
  const eduDates = getTallyEduSafeDates();
  const companyName = await resolveTallyCompanyName(userId, req);
  const cust = sanitizeTallyLedgerName(params.customer);
  const base = {
    customer: cust,
    product: params.product,
    price: params.price,
    qty: params.qty,
    totalAmount: params.totalAmount,
    ewayBillNo: params.ewayBillNo,
    vehicleNo: params.vehicleNo,
    companyName
  };

  logger.info('[Tally Sync] Company:', companyName || '(auto-detect fail — Tally me company select karein)');
  logger.info('[Tally Sync] Customer ledger:', cust);

  logger.info('[Tally Sync] Step 1: Minimal ledger masters...');
  const minMasters = buildTallyMinimalMastersXml({
    customer: cust,
    customerState: params.customerState,
    companyName
  });
  try {
    const masterResp = await relayXmlToTally(userId, minMasters, req);
    logger.info('[Tally Sync] Masters:', masterResp.substring(0, 500));
    if (!masterResp.includes('Unknown Request')) parseTallyMasterResponse(masterResp);
    else logger.info('[Tally Sync] Master import skipped (Tally response issue)');
  } catch (masterErr) {
    logger.info('[Tally Sync] Master import non-fatal:', masterErr.message);
  }

  const strategies = [
    { label: 'Journal (party)', build: (d) => buildTallyJournalVoucherXml({ ...base, tallyDate: d, salesLedgerName: 'Sales Account' }) },
    { label: 'Journal (Cash fallback)', build: (d) => buildTallyJournalVoucherXml({ ...base, tallyDate: d, salesLedgerName: 'Sales Account', partyLedger: 'Cash' }) },
    { label: 'Journal (Sales)', build: (d) => buildTallyJournalVoucherXml({ ...base, tallyDate: d, salesLedgerName: 'Sales' }) },
    { label: 'EDU-Simple (Sales Account)', build: (d) => buildTallySimpleSalesVoucherXml({ ...base, tallyDate: d, salesLedgerName: 'Sales Account' }) },
    { label: 'EDU-Simple (Cash)', build: (d) => buildTallySimpleSalesVoucherXml({ ...base, tallyDate: d, salesLedgerName: 'Sales Account', partyLedger: 'Cash' }) },
    { label: 'GST-Full', build: (d) => buildTallySalesVoucherXml({ ...params, customer: cust, tallyDate: d, companyName }), needsGstMasters: true }
  ];

  let lastError = null;
  let gstMastersSent = false;

  for (const strategy of strategies) {
    if (strategy.needsGstMasters && !gstMastersSent) {
      logger.info('[Tally Sync] GST masters bhej rahe hain...');
      const gstMasters = buildTallyLedgerMastersXml({
        customer: cust,
        customerGstin: params.customerGstin,
        customerState: params.customerState,
        gstRate: params.gstRate,
        isInterState: isInterStateSale(params.companyState, params.customerState),
        companyName
      });
      const gstMasterResp = await relayXmlToTally(userId, gstMasters, req);
      logger.info('[Tally Sync] GST Masters:', gstMasterResp.substring(0, 400));
      parseTallyMasterResponse(gstMasterResp);
      gstMastersSent = true;
    }

    for (const eduDate of eduDates) {
      try {
        const voucherXml = strategy.build(eduDate);
        logger.info(`[Tally Sync] Trying: ${strategy.label} @ date ${eduDate}`);
        const resp = await relayXmlToTally(userId, voucherXml, req);
        logger.info('[Tally Sync] Response:', resp.substring(0, 600));
        if (tallyVoucherSuccess(resp)) {
          return { mode: strategy.label, date: eduDate, xml: voucherXml, response: resp, companyName };
        }
        const errs = extractTallyErrors(resp);
        const created = tallyVoucherCreated(resp);
        lastError = new Error(errs.join(' | ') || `CREATED=${created} (${strategy.label})`);
      } catch (err) {
        lastError = err;
        logger.info(`[Tally Sync] ${strategy.label} @ ${eduDate} fail:`, err.message);
      }
    }
  }

  const hint = companyName
    ? `Company: "${companyName}". Tally EDU me date 1st/2nd/last honi chahiye.`
    : 'Tally me company select karein ya .env me TALLY_COMPANY_NAME set karein.';
  throw lastError || new Error(`Tally me voucher save nahi ho paya. ${hint}`);
}

function parseTallySyncResponse(tallyResponseText) {
  return parseTallyVoucherResponse(tallyResponseText);
}

// ==================================================================================
// 🟢 KHATA PRO — Ledger Master (Party/Group management)
// ==================================================================================
app.post('/api/ledgers', authenticateToken, requirePermission(PERMISSIONS.KHATA_WRITE), async (req, res) => {
  try {
    const { partyName, ledgerGroup, mobile, gstin, address, openingBalance } = req.body;
    if (!partyName) return res.status(400).json({ error: 'Party/Ledger naam zaroori hai.' });

    const partyType = (ledgerGroup === 'Sundry Creditor') ? 'Creditor' : 'Debtor';
    const newLedger = new Ledger({
      userId: req.dataUserId,
      partyName,
      ledgerGroup: ledgerGroup || 'Sundry Debtor',
      partyType,
      mobile, gstin, address,
      openingBalance: openingBalance || 0,
      currentBalance: openingBalance || 0
    });
    await newLedger.save();
    res.json({ success: true, message: "Ledger ban gaya hai!", ledger: newLedger });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/ledgers', authenticateToken, async (req, res) => {
  try {
    const ledgers = await Ledger.find({ userId: req.dataUserId }).sort({ partyName: 1 });
    res.json({ success: true, ledgers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/ledgers/:id', authenticateToken, requirePermission(PERMISSIONS.LEDGER_DELETE), async (req, res) => {
  try {
    const inUse = await Voucher.findOne({ userId: req.dataUserId, $or: [{ partyId: req.params.id }, { secondaryLedgerId: req.params.id }] });
    if (inUse) return res.status(400).json({ error: 'Is ledger ka transaction history hai, delete nahi kar sakte.' });
    await Ledger.deleteOne({ _id: req.params.id, userId: req.dataUserId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================================================================================
// 🟢 KHATA PRO — Item / Stock Master
// ==================================================================================
app.post('/api/items', authenticateToken, requirePermission(PERMISSIONS.INVENTORY_WRITE), async (req, res) => {
  try {
    const { itemName, unit, hsnCode, gstRate, purchasePrice, sellingPrice, openingStock, godown, batchNo, reorderLevel } = req.body;
    if (!itemName) return res.status(400).json({ error: 'Item naam zaroori hai.' });

    const newItem = new Item({
      userId: req.dataUserId,
      itemName, unit: unit || 'Pcs', hsnCode,
      gstRate: gstRate || 0,
      purchasePrice: purchasePrice || 0,
      sellingPrice: sellingPrice || 0,
      openingStock: openingStock || 0,
      stockQty: openingStock || 0,
      godown: godown || 'Main Godown',
      batchNo: batchNo || '',
      reorderLevel: reorderLevel != null ? Number(reorderLevel) : 5
    });
    await newItem.save();
    res.json({ success: true, message: "Item ban gaya hai!", item: newItem });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/items', authenticateToken, async (req, res) => {
  try {
    const items = await Item.find({ userId: req.dataUserId }).sort({ itemName: 1 });
    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/items/:id', authenticateToken, requirePermission(PERMISSIONS.ITEM_DELETE), async (req, res) => {
  try {
    await Item.deleteOne({ _id: req.params.id, userId: req.dataUserId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/items/:id', authenticateToken, requirePermission(PERMISSIONS.INVENTORY_WRITE), async (req, res) => {
  try {
    const { itemName, unit, hsnCode, gstRate, purchasePrice, sellingPrice, godown, batchNo, reorderLevel } = req.body;
    const item = await Item.findOne({ _id: req.params.id, userId: req.dataUserId });
    if (!item) return res.status(404).json({ success: false, error: 'Item nahi mila.' });

    if (itemName) item.itemName = itemName;
    if (unit) item.unit = unit;
    if (hsnCode !== undefined) item.hsnCode = hsnCode;
    if (gstRate != null) item.gstRate = Number(gstRate) || 0;
    if (purchasePrice != null) item.purchasePrice = Number(purchasePrice) || 0;
    if (sellingPrice != null) item.sellingPrice = Number(sellingPrice) || 0;
    if (godown) item.godown = godown;
    if (batchNo !== undefined) item.batchNo = batchNo;
    if (reorderLevel != null) item.reorderLevel = Number(reorderLevel) || 0;

    await item.save();
    res.json({ success: true, message: 'Item update ho gaya.', item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/items/:id/adjust-stock', authenticateToken, requirePermission(PERMISSIONS.INVENTORY_WRITE), async (req, res) => {
  try {
    const { qtyChange, note } = req.body;
    const delta = Number(qtyChange);
    if (!delta || Number.isNaN(delta)) {
      return res.status(400).json({ success: false, error: 'Qty change zaroori hai (+ stock in, - stock out).' });
    }
    const item = await Item.findOne({ _id: req.params.id, userId: req.dataUserId });
    if (!item) return res.status(404).json({ success: false, error: 'Item nahi mila.' });

    const newQty = (item.stockQty || 0) + delta;
    if (newQty < 0) {
      return res.status(400).json({ success: false, error: `Stock negative nahi ho sakta. Available: ${item.stockQty}` });
    }

    item.stockQty = newQty;
    await item.save();
    res.json({
      success: true,
      message: `${item.itemName}: ${delta > 0 ? '+' : ''}${delta} stock ${note ? `(${note})` : ''}`,
      item
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================================================================================
// 🟢 KHATA PRO — Vouchers (Sales / Purchase / Payment / Receipt / Journal / Contra /
// Debit Note / Credit Note) — Tally jaisa double-entry style balance update
// ==================================================================================
app.post('/api/vouchers', authenticateToken, requirePermission(PERMISSIONS.KHATA_WRITE), async (req, res) => {
  try {
    const { voucherType, partyId, secondaryLedgerId, amount, items, note, supplierInvoiceNo, supplierGstin, paymentMode, voucherDate } = req.body;

    if (!VOUCHER_TYPES.includes(voucherType)) return res.status(400).json({ error: 'Voucher type galat hai.' });
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Amount zaroori hai.' });
    if (voucherType === 'Purchase' && !supplierInvoiceNo) {
      return res.status(400).json({ error: 'Purchase bill ke liye Supplier Invoice No. zaroori hai.' });
    }

    const newVoucher = new Voucher({
      userId: req.dataUserId, voucherType, partyId, secondaryLedgerId, amount, items, note,
      supplierInvoiceNo: supplierInvoiceNo || undefined,
      supplierGstin: supplierGstin || undefined,
      paymentMode: paymentMode || undefined,
      date: voucherDate ? new Date(voucherDate) : new Date()
    });

    // Har voucher type ka party ledger balance par sahi asar (Tally logic ki tarah):
    // Positive balance = party humein dena hai (Debtor); Negative = hum dena hai (Creditor)
    if (partyId) {
      const ledgerFilter = { _id: partyId, userId: req.dataUserId };
      if (voucherType === 'Sales' || voucherType === 'Debit Note') {
        await Ledger.updateOne(ledgerFilter, { $inc: { currentBalance: amount } });
      } else if (voucherType === 'Receipt' || voucherType === 'Credit Note') {
        await Ledger.updateOne(ledgerFilter, { $inc: { currentBalance: -amount } });
      } else if (voucherType === 'Purchase') {
        await Ledger.updateOne(ledgerFilter, { $inc: { currentBalance: -amount } });
      } else if (voucherType === 'Payment') {
        await Ledger.updateOne(ledgerFilter, { $inc: { currentBalance: amount } });
      } else if (voucherType === 'Journal') {
        await Ledger.updateOne(ledgerFilter, { $inc: { currentBalance: amount } });
        if (secondaryLedgerId) {
          await Ledger.updateOne({ _id: secondaryLedgerId, userId: req.dataUserId }, { $inc: { currentBalance: -amount } });
        }
      } else if (voucherType === 'Contra') {
        // Cash/Bank ke beech transfer — party ledger par koi net asar nahi,
        // sirf dono account ke beech move hota hai
        await Ledger.updateOne(ledgerFilter, { $inc: { currentBalance: -amount } });
        if (secondaryLedgerId) {
          await Ledger.updateOne({ _id: secondaryLedgerId, userId: req.dataUserId }, { $inc: { currentBalance: amount } });
        }
      }
    }

    // Stock update — Sales se stock kam, Purchase se stock zyada
    if (items && items.length > 0 && (voucherType === 'Sales' || voucherType === 'Purchase')) {
      for (const itm of items) {
        if (!itm.itemId) continue;
        const qtyChange = voucherType === 'Sales' ? -Math.abs(itm.qty) : Math.abs(itm.qty);
        await Item.updateOne({ _id: itm.itemId, userId: req.dataUserId }, { $inc: { stockQty: qtyChange } });
      }
    }

    await newVoucher.save();
    res.json({ success: true, message: `${voucherType} voucher save ho gaya!`, voucherId: newVoucher._id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Day Book — saare vouchers, latest pehle
app.get('/api/vouchers', authenticateToken, async (req, res) => {
  try {
    const vouchers = await Voucher.find({ userId: req.dataUserId })
      .populate('partyId', 'partyName')
      .populate('secondaryLedgerId', 'partyName')
      .sort({ date: -1 });
    res.json({ success: true, vouchers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/ledger-statement/:partyId', authenticateToken, async (req, res) => {
  try {
    const party = await Ledger.findOne({ _id: req.params.partyId, userId: req.dataUserId });
    if (!party) return res.status(404).json({ success: false, error: 'Ledger nahi mila.' });
    const transactions = await Voucher.find({
      userId: req.dataUserId,
      $or: [{ partyId: req.params.partyId }, { secondaryLedgerId: req.params.partyId }]
    }).sort({ date: 1 });
    res.json({ success: true, partyName: party.partyName, openingBalance: party.openingBalance, currentBalance: party.currentBalance, history: transactions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================================================================================
// 🟢 Reports: Stock Summary
// ==================================================================================
app.get('/api/reports/stock-summary', authenticateToken, async (req, res) => {
  try {
    const items = await Item.find({ userId: req.dataUserId }).sort({ itemName: 1 });
    const defaultThreshold = parseInt(req.query.lowThreshold, 10) || 5;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    const enriched = items.map((i) => {
      const reorder = i.reorderLevel != null ? i.reorderLevel : defaultThreshold;
      const stockValue = (i.stockQty || 0) * (i.purchasePrice || 0);
      const saleValue = (i.stockQty || 0) * (i.sellingPrice || 0);
      let status = 'ok';
      if ((i.stockQty || 0) <= 0) {
        status = 'out';
        outOfStockCount += 1;
      } else if ((i.stockQty || 0) <= reorder) {
        status = 'low';
        lowStockCount += 1;
      }
      return {
        ...i.toObject(),
        reorderLevel: reorder,
        stockValue,
        saleValue,
        status
      };
    });

    const totalStockValue = enriched.reduce((sum, i) => sum + i.stockValue, 0);
    const totalSaleValue = enriched.reduce((sum, i) => sum + i.saleValue, 0);

    res.json({
      success: true,
      items: enriched,
      totalStockValue,
      stats: {
        totalItems: items.length,
        totalStockValue,
        totalSaleValue,
        lowStockCount,
        outOfStockCount
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Invoice add hone par auto Khata Pro entry — ledger + sales voucher + stock update
app.post('/api/khata/record-sale', authenticateToken, requirePermission(PERMISSIONS.INVOICE_CREATE), async (req, res) => {
  try {
    const { customer, product, price, qty, gstRate, gstin, mobile, hsn } = req.body;
    if (!customer || !product || !price || !qty) {
      return res.status(400).json({ success: false, error: 'Customer, product, price aur qty zaroori hain.' });
    }

    const baseAmount = Number(price) * Number(qty);
    const gstAmount = (baseAmount * (Number(gstRate) || 0)) / 100;
    const totalAmount = baseAmount + gstAmount;

    const ledger = await findOrCreateCustomerLedger(req.dataUserId, customer, {
      gstin, mobile, ledgerGroup: 'Sundry Debtor'
    });

    const items = [];
    const escapedProduct = String(product).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let stockItem = await Item.findOne({ userId: req.dataUserId, itemName: new RegExp(`^${escapedProduct}$`, 'i') });
    if (!stockItem) {
      stockItem = await Item.create({
        userId: req.dataUserId,
        itemName: product,
        hsnCode: hsn || '',
        gstRate: gstRate || 0,
        sellingPrice: price,
        purchasePrice: price,
        openingStock: 0,
        stockQty: 0
      });
    }
    items.push({ itemId: stockItem._id, itemName: product, qty: Number(qty), rate: Number(price), gstRate: gstRate || 0 });
    if (stockItem.stockQty > 0) {
      await Item.updateOne({ _id: stockItem._id, userId: req.dataUserId }, { $inc: { stockQty: -Math.abs(qty) } });
    }

    const voucher = await Voucher.create({
      userId: req.dataUserId,
      voucherType: 'Sales',
      partyId: ledger._id,
      amount: totalAmount,
      items,
      note: `${customer} | ${product} x${qty} @ ₹${price}`,
      syncedToTally: false
    });

    await Ledger.updateOne({ _id: ledger._id, userId: req.dataUserId }, { $inc: { currentBalance: totalAmount } });

    res.json({
      success: true,
      message: `Ledger "${customer}" banaya/update kiya aur Sales voucher save ho gaya.`,
      ledger,
      voucherId: voucher._id
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Khata Pro ledger ko Tally me master ke roop me bhejo
app.post('/api/tally/sync-ledger/:id', authenticateToken, requireBusinessPlan, requirePermission(PERMISSIONS.TALLY_SYNC), async (req, res) => {
  try {
    const ledger = await Ledger.findOne({ _id: req.params.id, userId: req.dataUserId });
    if (!ledger) return res.status(404).json({ success: false, error: 'Ledger nahi mila.' });

    const xml = buildTallyLedgerMasterXml({
      partyName: ledger.partyName,
      ledgerGroup: ledger.ledgerGroup,
      gstin: ledger.gstin,
      state: req.body.state || 'Haryana',
      companyName: await resolveTallyCompanyName(req.dataUserId, req)
    });

    const tallyResponseText = await relayXmlToTally(req.dataUserId, xml, req);
    parseTallyMasterResponse(tallyResponseText);

    res.json({ success: true, message: `Ledger "${ledger.partyName}" Tally me sync ho gaya.` });
  } catch (err) {
    res.status(502).json({ success: false, error: err.message });
  }
});

// Khata voucher ko Tally me bhejo (Sales type)
app.post('/api/tally/sync-voucher/:id', authenticateToken, requireBusinessPlan, requirePermission(PERMISSIONS.TALLY_SYNC), async (req, res) => {
  try {
    const voucher = await Voucher.findOne({ _id: req.params.id, userId: req.dataUserId }).populate('partyId', 'partyName gstin');
    if (!voucher) return res.status(404).json({ success: false, error: 'Voucher nahi mila.' });
    if (voucher.syncedToTally) return res.json({ success: true, message: 'Yeh voucher pehle se Tally me sync hai.' });

    const partyName = voucher.partyId?.partyName || 'Cash Customer';
    const noteParts = (voucher.note || '').split('|');
    const product = noteParts[1]?.trim() || 'Item';
    const qtyMatch = product.match(/x(\d+(?:\.\d+)?)/i);
    const qty = qtyMatch ? parseFloat(qtyMatch[1]) : 1;
    const priceMatch = (voucher.note || '').match(/@\s*₹?(\d+(?:\.\d+)?)/);
    const price = priceMatch ? parseFloat(priceMatch[1]) : voucher.amount / qty;
    const baseAmount = price * qty;
    const gstAmount = voucher.amount - baseAmount;
    const cgst = gstAmount > 0 ? gstAmount / 2 : 0;
    const sgst = gstAmount > 0 ? gstAmount / 2 : 0;

    const profile = await BusinessProfile.findOne({ userId: req.dataUserId });
    const companyState = deriveCompanyState(profile);
    const customerState = req.body.customerState || '';
    const interState = isInterStateSale(companyState, customerState);
    const gstRate = Number(req.body.gstRate) || (gstAmount > 0 && baseAmount > 0 ? Math.round((gstAmount / baseAmount) * 100) : 0);

    const syncResult = await syncVoucherToTallyWithFallback(req.dataUserId, req, {
      customer: partyName,
      product: product.replace(/\s*x\d+.*$/i, '').trim() || 'Item',
      price, qty, gstRate,
      gstAmount: Math.max(0, gstAmount),
      totalAmount: voucher.amount,
      cgst, sgst,
      customerGstin: voucher.partyId?.gstin || '',
      customerState,
      companyState
    });

    voucher.syncedToTally = true;
    voucher.tallyXml = syncResult.xml;
    await voucher.save();

    res.json({ success: true, message: `Voucher Tally me sync ho gaya! (${syncResult.mode})` });
  } catch (err) {
    res.status(502).json({ success: false, error: err.message });
  }
});
// 🟢 KHATA PRO — END

// 🟢 PRO FEATURES — Staff, GSTR, Reports, Tally Import, Contractor, Bank Recon
let gspClient = null;
try {
  gspClient = require('./gsp-client');
  app.get('/api/gst/gsp-status', authenticateToken, (req, res) => {
    res.json(gspClient.getGspStatus());
  });
  app.get('/api/gst/verify/:gstin', authenticateToken, async (req, res) => {
    try {
      if (!gspClient.isGspConfigured()) {
        return res.status(503).json({ error: 'GSP credentials .env me set karein (MasterGST sandbox).' });
      }
      const data = await gspClient.verifyGstin(req.params.gstin);
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
} catch (e) {
  logger.warn('GSP client not loaded:', e.message);
}

// 🟢 PRO FEATURES hookup
setupProFeatures({
  app, mongoose, authenticateToken, JWT_SECRET, rbac, requireBusinessPlan,
  models: { User, SalesHistory, Ledger, Voucher, Item, BusinessProfile },
  helpers: { relayXmlToTally, resolveTallyCompanyName, tallyXmlEscape, findOrCreateCustomerLedger }
});

setupLiveFeatures({
  app, mongoose, authenticateToken, rbac, requireBusinessPlan,
  models: { User, SalesHistory, Ledger, Voucher, Item, BusinessProfile, UserData }
});

setupSubscription({ app, User, authenticateToken });
setupRazorpayPayments({ app, mongoose, User, authenticateToken });
setupDevPlanToggle({ app, User, authenticateToken });

// Explicit HTML routes (static ke baad bhi safe fallback)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'loginpage.html')));
['/loginpage.html', '/signup.html', '/pricing.html', '/bolkarigar.html'].forEach((page) => {
  app.get(`/${page}`, (req, res) => res.sendFile(path.join(__dirname, 'public', page)));
});

// --- Catch-all Fallback Route (Sabse Niche) ---
app.use('/downloads', express.static(path.join(__dirname, 'public', 'downloads')));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route nahi mila.' });
  }
  res.sendFile(path.join(__dirname, 'public', 'loginpage.html'));
});

// ==================================================================================
// 🟢 DESKTOP AGENT — WebSocket server setup
// Agent (jo user ke apne PC par chalta hai) is server se '/agent-ws?token=...'
// par connect karta hai. Token BusinessProfile.agentToken se match hona chahiye
// — isse pata chalta hai yeh connection KIS user/company ka hai.
// ==================================================================================
const server = http.createServer(app);
const agentWss = new WebSocket.Server({ server, path: '/agent-ws' });

agentWss.on('connection', async (ws, req) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    if (!token) {
      ws.close(4001, 'Token missing');
      return;
    }
    const profile = await BusinessProfile.findOne({ agentToken: token });
    if (!profile) {
      ws.close(4003, 'Invalid agent token');
      return;
    }
    const userId = String(profile.userId);
    connectedAgents.set(userId, ws);
    ws.userId = userId;
    logger.info(`[Desktop Agent] Connected — user ${userId} (${profile.companyName || 'company'})`);
    ws.send(JSON.stringify({ type: 'connected', message: 'BolKarigar Desktop Agent connected!' }));

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (msg.type === 'sync_result' && msg.requestId) {
        const pending = pendingAgentRequests.get(msg.requestId);
        if (pending) {
          clearTimeout(pending.timeoutHandle);
          pendingAgentRequests.delete(msg.requestId);
          if (msg.ok) pending.resolve(msg.responseText || '');
          else pending.reject(new Error(msg.error || 'Agent se unknown error'));
        }
      }
      // 'ping'/'pong' type heartbeat messages yahan chahe to future me handle kar sakte hain.
    });

    ws.on('close', () => {
      if (connectedAgents.get(userId) === ws) {
        connectedAgents.delete(userId);
      }
      logger.info(`[Desktop Agent] Disconnected — user ${userId}`);
    });

    ws.on('error', (err) => {
      logger.error(`[Desktop Agent] Connection error (user ${userId}):`, err.message);
    });
  } catch (err) {
    logger.error('[Desktop Agent] Connection setup error:', err);
    try { ws.close(1011, 'Server error'); } catch {}
  }
});

// Agent ko apna pairing token dikhata hai — agar pehli baar hai to naya
// generate karke BusinessProfile me save kar deta hai.
app.get('/api/tally/agent-token', authenticateToken, requireBusinessPlan, async (req, res) => {
  try {
    let profile = await BusinessProfile.findOne({ userId: req.dataUserId });
    if (!profile) {
      profile = await BusinessProfile.create({ userId: req.dataUserId });
    }
    if (!profile.agentToken) {
      profile.agentToken = crypto.randomBytes(24).toString('hex');
      await profile.save();
    }
    res.json({ success: true, agentToken: profile.agentToken });
  } catch (err) {
    logger.error('Agent token fetch error:', err);
    res.status(500).json({ error: 'Agent token laane mein dikkat aayi.' });
  }
});

// Agar token leak ho jaaye to user isse reset kar sakta hai — purana token turant invalid ho jaata hai.
app.post('/api/tally/agent-token/regenerate', authenticateToken, requireOwner, requireBusinessPlan, requirePermission(PERMISSIONS.TALLY_TOKEN), async (req, res) => {
  try {
    const newToken = crypto.randomBytes(24).toString('hex');
    const profile = await BusinessProfile.findOneAndUpdate(
      { userId: req.dataUserId },
      { $set: { agentToken: newToken } },
      { new: true, upsert: true }
    );
    // Purana connected agent (agar hai) turant disconnect karo taaki purana token kaam na kare.
    const existingWs = connectedAgents.get(String(req.dataUserId));
    if (existingWs) { try { existingWs.close(4009, 'Token regenerated'); } catch {} }
    res.json({ success: true, agentToken: profile.agentToken });
  } catch (err) {
    res.status(500).json({ error: 'Agent token reset karne mein dikkat aayi.' });
  }
});

// 🟢 GLOBAL ERROR HANDLER — koi bhi route jo error throw kare aur khud
// catch na kare, yahan aakar log ho jayega (crash hone ke bajaye).
// Yeh sabse aakhri app.use() hona chahiye, saare routes ke baad.
app.use((err, req, res, next) => {
  logger.error('Unhandled route error', {
    path: req.path,
    method: req.method,
    err: err.message,
    stack: err.stack
  });
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Kuch galat ho gaya. Thodi der baad try karein.' });
});

// 🟢 PROCESS-LEVEL SAFETY NETS — agar kahin bhi ek async error uncaught
// reh jaaye (Promise reject bina .catch ke, ya koi sync throw jo kisi
// try/catch mein nahi hai), server silently crash hone ke bajaye kam se
// kam log karke phir exit kare, taaki PM2 use turant restart kar sake.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', { reason: reason?.message || reason, stack: reason?.stack });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception — server restart ho raha hai', { err: err.message, stack: err.stack });
  process.exit(1); // PM2 isko dekh kar auto-restart kar dega
});

// 🟢 GRACEFUL SHUTDOWN — Ctrl+C (SIGINT) ya PM2/hosting ka stop signal
// (SIGTERM) aane par port ko turant, cleanly release karta hai. Isse
// "EADDRINUSE: port already in use" wali dikkat khatam ho jaati hai jab
// dubara turant start karo.
let shuttingDown = false;
function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} mila — server band ho raha hai...`);
  server.close(() => {
    logger.info('✓ HTTP server band ho gaya, port free hai.');
    mongoose.connection.close(false, () => {
      logger.info('✓ MongoDB connection band ho gaya.');
      process.exit(0);
    });
  });
  // Agar 8 second mein bhi clean close na ho, force exit kar do.
  setTimeout(() => {
    logger.warn('Graceful shutdown timeout — force exit.');
    process.exit(1);
  }, 8000).unref();
}
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Server Listen
server.listen(PORT, () => {
  logger.info(`🚀 BolKarigar Core Engine Running on http://localhost:${PORT}`);
  logger.info(`📌 SERVER CODE VERSION: razorpay-v1`);
  if (process.env.RAZORPAY_KEY_ID) {
    const mode = process.env.RAZORPAY_KEY_ID.startsWith('rzp_test_') ? 'TEST' : 'LIVE';
    logger.info(`💳 Razorpay: ${mode} mode configured`);
  } else {
    logger.warn(`⚠️ Razorpay keys missing — payment disabled`);
  }
});
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`\n❌ Port ${PORT} pehle se use ho raha hai — ek server already chal raha hai.`);
    logger.error('   Fix: PowerShell me yeh chalao, phir dubara node server.js:');
    logger.error(`   Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force\n`);
    process.exit(1);
  }
  throw err;
});