/**
 * BolKarigar Pro — Professional features module
 * Staff login, GSTR reports, P&L, Balance Sheet, Tally import,
 * Contractor tools, Bank reconciliation, Udhar payments, Multi-company
 */
const crypto = require('crypto');
const { getSubscriptionForUser } = require('./subscription');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Full Tally-style chart of accounts (28 groups)
const LEDGER_GROUPS_FULL = [
  'Capital Account', 'Reserves & Surplus', 'Secured Loans', 'Unsecured Loans',
  'Current Liabilities', 'Sundry Creditor', 'Duties & Taxes', 'Provisions',
  'Fixed Asset', 'Investments', 'Current Assets', 'Stock-in-Hand',
  'Sundry Debtor', 'Cash', 'Bank', 'Deposits (Asset)', 'Loans & Advances (Asset)',
  'Direct Expenses', 'Indirect Expenses', 'Direct Incomes', 'Indirect Incomes',
  'Sales Accounts', 'Purchase Accounts', 'Expense', 'Income', 'Capital', 'Suspense A/c', 'Branch/Divisions'
];

const staffSignupAttempts = new Map();
function isStaffSignupRateLimited(ip) {
  const entry = staffSignupAttempts.get(ip);
  if (!entry) return false;
  if (entry.count >= 10 && Date.now() - entry.firstAttempt < 10 * 60 * 1000) return true;
  if (Date.now() - entry.firstAttempt >= 10 * 60 * 1000) staffSignupAttempts.delete(ip);
  return false;
}
function recordStaffSignupAttempt(ip) {
  const entry = staffSignupAttempts.get(ip) || { count: 0, firstAttempt: Date.now() };
  entry.count++;
  staffSignupAttempts.set(ip, entry);
}

function setupProFeatures({ app, mongoose, authenticateToken, models, helpers, JWT_SECRET, rbac, requireBusinessPlan }) {
  const { User, SalesHistory, Ledger, Voucher, Item, BusinessProfile } = models;
  const { relayXmlToTally, resolveTallyCompanyName, tallyXmlEscape, findOrCreateCustomerLedger } = helpers;
  const { PERMISSIONS, requirePermission, requireOwner } = rbac;
  const biz = requireBusinessPlan || ((req, res, next) => next());

  // --- Schemas ---
  const paymentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    customerName: { type: String, required: true },
    amount: { type: Number, required: true },
    paymentMode: { type: String, enum: ['Cash', 'UPI', 'Bank', 'Cheque', 'Other'], default: 'Cash' },
    invoiceNo: String,
    note: String,
    date: { type: Date, default: Date.now }
  });

  const labourSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    workerName: { type: String, required: true },
    projectName: String,
    date: { type: Date, default: Date.now },
    status: { type: String, enum: ['Present', 'Absent', 'Half Day', 'Overtime'], default: 'Present' },
    wage: { type: Number, default: 0 },
    note: String
  });

  const raBillSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    billNo: String,
    projectName: { type: String, required: true },
    clientName: String,
    workDescription: String,
    amount: { type: Number, required: true },
    gstRate: { type: Number, default: 18 },
    status: { type: String, enum: ['Draft', 'Submitted', 'Approved', 'Paid'], default: 'Draft' },
    date: { type: Date, default: Date.now }
  });

  const materialSlipSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    slipNo: String,
    projectName: { type: String, required: true },
    itemName: { type: String, required: true },
    qty: { type: Number, required: true },
    unit: { type: String, default: 'Pcs' },
    issuedTo: String,
    issuedBy: String,
    date: { type: Date, default: Date.now },
    note: String
  });

  const bankReconSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bankLedgerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ledger' },
    statementDate: Date,
    description: String,
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
    matched: { type: Boolean, default: false },
    voucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher' },
    date: { type: Date, default: Date.now }
  });

  const companySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    companyName: { type: String, required: true },
    gstin: String,
    address: String,
    isActive: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  });

  const Payment = mongoose.model('Payment', paymentSchema);
  const LabourAttendance = mongoose.model('LabourAttendance', labourSchema);
  const RABill = mongoose.model('RABill', raBillSchema);
  const MaterialSlip = mongoose.model('MaterialSlip', materialSlipSchema);
  const BankRecon = mongoose.model('BankRecon', bankReconSchema);
  const Company = mongoose.model('Company', companySchema);

  // Resolve data owner — staff users access owner's data
  async function resolveOwnerId(req) {
    const user = await User.findById(req.user.id);
    if (!user) return req.user.id;
    if (user.ownerId) return String(user.ownerId);
    return String(req.user.id);
  }

  async function ownerMiddleware(req, res, next) {
    try {
      req.ownerId = req.dataUserId || await resolveOwnerId(req);
      next();
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }

  // ===================== STAFF / MULTI-USER =====================
  app.post('/api/staff/invite', authenticateToken, requireOwner, biz, requirePermission(PERMISSIONS.STAFF_MANAGE), async (req, res) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user || user.ownerId) return res.status(403).json({ error: 'Sirf owner staff invite kar sakta hai.' });
      const subscription = await getSubscriptionForUser(User, user);
      if (!subscription.canInviteStaff) {
        return res.status(402).json({
          error: subscription.isExpired
            ? 'Plan expire ho gaya — staff invite ke liye Pro plan renew karein.'
            : 'Starter plan me staff invite nahi — Pro ya Business plan lein.',
          subscription
        });
      }
      const allowedRoles = ['cashier', 'manager', 'staff'];
      const inviteRole = allowedRoles.includes(req.body?.role) ? req.body.role : 'cashier';
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      user.staffInviteCode = code;
      user.staffInviteRole = inviteRole;
      await user.save();
      res.json({
        success: true,
        inviteCode: code,
        inviteRole,
        message: `${inviteRole} ke liye invite code — signup page par staff account banayein.`
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/staff/signup', async (req, res) => {
    try {
      const ipKey = req.ip || 'unknown';
      if (isStaffSignupRateLimited(ipKey)) {
        return res.status(429).json({ error: 'Bahut zyada signup attempts. 10 minute baad try karein.' });
      }
      recordStaffSignupAttempt(ipKey);

      const { username, email, password, inviteCode } = req.body;
      if (!username || !email || !password || !inviteCode) {
        return res.status(400).json({ error: 'Username, email, password and invite code are required.' });
      }
      const owner = await User.findOne({ staffInviteCode: inviteCode.toUpperCase() });
      if (!owner) return res.status(400).json({ error: 'Invalid invite code.' });
      const ownerSub = await getSubscriptionForUser(User, owner);
      if (!ownerSub.isActive) {
        return res.status(402).json({
          error: 'This store subscription has expired. Ask the owner to renew before creating a staff account.'
        });
      }
      const exists = await User.findOne({ $or: [{ username }, { email }] });
      if (exists) return res.status(400).json({ error: 'Username or email already exists.' });
      const staffRole = owner.staffInviteRole || 'staff';
      const hashed = await bcrypt.hash(password, 10);
      await User.create({ username, email, password: hashed, role: staffRole, ownerId: owner._id });
      res.status(201).json({
        success: true,
        role: staffRole,
        message: `${staffRole} account created. You can now sign in with limited access.`
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/staff/list', authenticateToken, requireOwner, biz, requirePermission(PERMISSIONS.STAFF_MANAGE), ownerMiddleware, async (req, res) => {
    try {
      const user = await User.findById(req.user.id);
      if (user.ownerId) return res.status(403).json({ error: 'Sirf owner staff list dekh sakta hai.' });
      const staff = await User.find({ ownerId: req.user.id }).select('username email role createdAt');
      res.json({
        success: true,
        staff,
        inviteCode: user.staffInviteCode || null,
        inviteRole: user.staffInviteRole || null
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.delete('/api/staff/:id', authenticateToken, requireOwner, requirePermission(PERMISSIONS.STAFF_MANAGE), async (req, res) => {
    try {
      await User.deleteOne({ _id: req.params.id, ownerId: req.user.id });
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ===================== UDHAR PAYMENTS =====================
  app.post('/api/payments', authenticateToken, ownerMiddleware, requirePermission(PERMISSIONS.UDHAR_PAY), async (req, res) => {
    try {
      const { customerName, amount, paymentMode, invoiceNo, note } = req.body;
      if (!customerName || !amount) return res.status(400).json({ error: 'Customer aur amount zaroori.' });
      const payment = await Payment.create({
        userId: req.ownerId, customerName, amount: parseFloat(amount),
        paymentMode: paymentMode || 'Cash', invoiceNo, note
      });
      // Auto Receipt voucher in Khata Pro
      const ledger = await Ledger.findOne({ userId: req.ownerId, partyName: new RegExp('^' + customerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') });
      if (ledger) {
        await Ledger.updateOne({ _id: ledger._id }, { $inc: { currentBalance: -parseFloat(amount) } });
        await Voucher.create({
          userId: req.ownerId, voucherType: 'Receipt', partyId: ledger._id,
          amount: parseFloat(amount), note: note || `Payment received — ${paymentMode || 'Cash'}`
        });
      }
      res.json({ success: true, payment });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/payments', authenticateToken, ownerMiddleware, async (req, res) => {
    try {
      const { customer } = req.query;
      const filter = { userId: req.ownerId };
      if (customer) filter.customerName = new RegExp(customer, 'i');
      const payments = await Payment.find(filter).sort({ date: -1 });
      res.json({ success: true, payments });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/reports/outstanding', authenticateToken, ownerMiddleware, biz, async (req, res) => {
    try {
      const debtors = await Ledger.find({ userId: req.ownerId, ledgerGroup: { $in: ['Sundry Debtor', 'Sundry Creditor'] } });
      const creditSales = await SalesHistory.find({ userId: req.ownerId, status: { $in: ['Pending', 'Credit'] } });
      const payments = await Payment.find({ userId: req.ownerId });
      const byCustomer = {};

      debtors.forEach(d => {
        byCustomer[d.partyName.toLowerCase()] = {
          partyName: d.partyName, ledgerBalance: d.currentBalance, billed: 0, paid: 0, pending: Math.max(0, d.currentBalance)
        };
      });

      creditSales.forEach(s => {
        const key = (s.customer || 'General').toLowerCase();
        if (!byCustomer[key]) byCustomer[key] = { partyName: s.customer, ledgerBalance: 0, billed: 0, paid: 0, pending: 0 };
        const amt = s.totalAmount || (s.price || 0) * (s.qty || 1);
        byCustomer[key].billed += amt;
      });

      payments.forEach(p => {
        const key = (p.customerName || '').toLowerCase();
        if (!byCustomer[key]) byCustomer[key] = { partyName: p.customerName, ledgerBalance: 0, billed: 0, paid: 0, pending: 0 };
        byCustomer[key].paid += p.amount;
      });

      const rows = Object.values(byCustomer).map(r => {
        const pending = r.ledgerBalance > 0 ? r.ledgerBalance : Math.max(0, r.billed - r.paid);
        return { ...r, pending };
      }).filter(r => r.pending > 0.01 || r.billed > 0);

      res.json({ success: true, rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ===================== GSTR REPORTS (Export for filing) =====================
  app.get('/api/reports/gstr1', authenticateToken, ownerMiddleware, biz, requirePermission(PERMISSIONS.GSTR_EXPORT), async (req, res) => {
    try {
      const { month, year } = req.query;
      const m = parseInt(month) || new Date().getMonth() + 1;
      const y = parseInt(year) || new Date().getFullYear();
      const from = new Date(y, m - 1, 1);
      const to = new Date(y, m, 0, 23, 59, 59);
      const sales = await SalesHistory.find({ userId: req.ownerId, date: { $gte: from, $lte: to } });
      const profile = await BusinessProfile.findOne({ userId: req.ownerId });
      const b2b = [], b2cl = [], b2cs = [];
      sales.forEach(s => {
        const taxable = (s.price || 0) * (s.qty || 1);
        const gst = taxable * ((s.gstRate || 0) / 100);
        const row = {
          invoiceNo: s.invoiceNo, date: s.date, customer: s.customer,
          hsn: s.hsn || '', qty: s.qty, taxableValue: taxable,
          gstRate: s.gstRate || 0, igst: gst, cgst: gst / 2, sgst: gst / 2,
          total: s.totalAmount || taxable + gst
        };
        if (s.customer && s.customer.length > 3) b2b.push(row);
        else if (taxable > 250000) b2cl.push(row);
        else b2cs.push(row);
      });
      res.json({
        success: true, period: `${m}/${y}`, companyGstin: profile?.gstin || '',
        summary: { totalInvoices: sales.length, totalTaxable: sales.reduce((a, s) => a + (s.price || 0) * (s.qty || 1), 0) },
        b2b, b2cl, b2cs,
        note: 'Yeh GSTR-1 export report hai — government portal par manually upload karein ya apne CA ko bhejein.'
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/reports/gstr3b', authenticateToken, ownerMiddleware, biz, requirePermission(PERMISSIONS.GSTR_EXPORT), async (req, res) => {
    try {
      const { month, year } = req.query;
      const m = parseInt(month) || new Date().getMonth() + 1;
      const y = parseInt(year) || new Date().getFullYear();
      const from = new Date(y, m - 1, 1);
      const to = new Date(y, m, 0, 23, 59, 59);
      const sales = await SalesHistory.find({ userId: req.ownerId, date: { $gte: from, $lte: to } });
      const purchases = await Voucher.find({ userId: req.ownerId, voucherType: 'Purchase', date: { $gte: from, $lte: to } });
      let outTax = 0, inTax = 0;
      sales.forEach(s => { outTax += (s.price || 0) * (s.qty || 1) * ((s.gstRate || 0) / 100); });
      purchases.forEach(p => { inTax += (p.amount || 0) * 0.18; });
      res.json({
        success: true, period: `${m}/${y}`,
        outwardTaxable: sales.reduce((a, s) => a + (s.price || 0) * (s.qty || 1), 0),
        outwardTax: outTax, inwardTax: inTax, netPayable: Math.max(0, outTax - inTax),
        note: 'GSTR-3B summary — portal par verify karke file karein.'
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ===================== P&L, BALANCE SHEET, AGEING, CASH FLOW =====================
  const INCOME_GROUPS = ['Direct Incomes', 'Indirect Incomes', 'Income', 'Sales Accounts'];
  const EXPENSE_GROUPS = ['Direct Expenses', 'Indirect Expenses', 'Expense', 'Purchase Accounts'];

  app.get('/api/reports/pl', authenticateToken, ownerMiddleware, biz, requirePermission(PERMISSIONS.REPORTS_VIEW), async (req, res) => {
    try {
      const ledgers = await Ledger.find({ userId: req.ownerId });
      let income = 0, expenses = 0;
      const incomeRows = [], expenseRows = [];
      ledgers.forEach(l => {
        const bal = Math.abs(l.currentBalance);
        if (INCOME_GROUPS.includes(l.ledgerGroup) && l.currentBalance < 0) {
          income += bal; incomeRows.push({ name: l.partyName, group: l.ledgerGroup, amount: bal });
        } else if (EXPENSE_GROUPS.includes(l.ledgerGroup) && l.currentBalance > 0) {
          expenses += bal; expenseRows.push({ name: l.partyName, group: l.ledgerGroup, amount: bal });
        }
      });
      const salesVouchers = await Voucher.find({ userId: req.ownerId, voucherType: 'Sales' });
      const salesTotal = salesVouchers.reduce((a, v) => a + v.amount, 0);
      if (salesTotal > income) { income = salesTotal; incomeRows.push({ name: 'Sales (Vouchers)', group: 'Sales', amount: salesTotal }); }
      res.json({ success: true, income: incomeRows, expenses: expenseRows, totalIncome: income, totalExpenses: expenses, netProfit: income - expenses });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/reports/balance-sheet', authenticateToken, ownerMiddleware, biz, requirePermission(PERMISSIONS.REPORTS_VIEW), async (req, res) => {
    try {
      const ledgers = await Ledger.find({ userId: req.ownerId });
      const assets = [], liabilities = [];
      const assetGroups = ['Fixed Asset', 'Current Assets', 'Stock-in-Hand', 'Sundry Debtor', 'Cash', 'Bank', 'Investments', 'Deposits (Asset)', 'Loans & Advances (Asset)'];
      const liabGroups = ['Capital Account', 'Reserves & Surplus', 'Secured Loans', 'Unsecured Loans', 'Current Liabilities', 'Sundry Creditor', 'Duties & Taxes', 'Provisions', 'Capital'];
      let totalAssets = 0, totalLiabilities = 0;
      ledgers.forEach(l => {
        const bal = Math.abs(l.currentBalance);
        if (!bal) return;
        if (assetGroups.includes(l.ledgerGroup)) { assets.push({ name: l.partyName, group: l.ledgerGroup, amount: bal }); totalAssets += bal; }
        else if (liabGroups.includes(l.ledgerGroup)) { liabilities.push({ name: l.partyName, group: l.ledgerGroup, amount: bal }); totalLiabilities += bal; }
        else if (l.currentBalance > 0) { assets.push({ name: l.partyName, group: l.ledgerGroup, amount: bal }); totalAssets += bal; }
        else { liabilities.push({ name: l.partyName, group: l.ledgerGroup, amount: bal }); totalLiabilities += bal; }
      });
      res.json({ success: true, assets, liabilities, totalAssets, totalLiabilities });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/reports/ageing', authenticateToken, ownerMiddleware, biz, requirePermission(PERMISSIONS.REPORTS_VIEW), async (req, res) => {
    try {
      const debtors = await Ledger.find({ userId: req.ownerId, ledgerGroup: 'Sundry Debtor', currentBalance: { $gt: 0 } });
      const vouchers = await Voucher.find({ userId: req.ownerId, voucherType: 'Sales' }).sort({ date: -1 });
      const rows = debtors.map(d => {
        const lastV = vouchers.find(v => v.partyId && String(v.partyId) === String(d._id));
        const days = lastV ? Math.floor((Date.now() - new Date(lastV.date)) / 86400000) : 0;
        let bucket = '0-30 days';
        if (days > 90) bucket = '90+ days';
        else if (days > 60) bucket = '61-90 days';
        else if (days > 30) bucket = '31-60 days';
        return { partyName: d.partyName, amount: d.currentBalance, days, bucket };
      });
      res.json({ success: true, rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/reports/cash-flow', authenticateToken, ownerMiddleware, biz, requirePermission(PERMISSIONS.REPORTS_VIEW), async (req, res) => {
    try {
      const { month, year } = req.query;
      const m = parseInt(month) || new Date().getMonth() + 1;
      const y = parseInt(year) || new Date().getFullYear();
      const from = new Date(y, m - 1, 1);
      const to = new Date(y, m, 0, 23, 59, 59);
      const vouchers = await Voucher.find({ userId: req.ownerId, date: { $gte: from, $lte: to } });
      let inflow = 0, outflow = 0;
      vouchers.forEach(v => {
        if (['Receipt', 'Sales'].includes(v.voucherType)) inflow += v.amount;
        if (['Payment', 'Purchase'].includes(v.voucherType)) outflow += v.amount;
      });
      res.json({ success: true, period: `${m}/${y}`, inflow, outflow, netCash: inflow - outflow, vouchers: vouchers.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ===================== TALLY IMPORT (Tally → BolKarigar) =====================
  app.post('/api/tally/import-ledgers', authenticateToken, ownerMiddleware, biz, requirePermission(PERMISSIONS.TALLY_SYNC), async (req, res) => {
    try {
      const company = await resolveTallyCompanyName(req.ownerId, req);
      const companyBlock = company ? `<SVCURRENTCOMPANY>${tallyXmlEscape(company)}</SVCURRENTCOMPANY>` : '';
      const xml = `<?xml version="1.0"?><ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>List of Ledgers</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>${companyBlock}</STATICVARIABLES></DESC></BODY></ENVELOPE>`;
      const resp = await relayXmlToTally(req.ownerId, xml, req);
      const names = [...resp.matchAll(/<LANGUAGENAME\.LIST>[\s\S]*?<NAME\.LIST[^>]*>[\s\S]*?<NAME[^>]*>([^<]+)<\/NAME>/gi)]
        .map(m => m[1].trim()).filter(n => n && n.length > 1);
      const altNames = names.length ? names : [...resp.matchAll(/<LEDGER[^>]*NAME="([^"]+)"/gi)].map(m => m[1]);
      let imported = 0, skipped = 0;
      for (const name of [...new Set(altNames)].slice(0, 200)) {
        const exists = await Ledger.findOne({ userId: req.ownerId, partyName: name });
        if (exists) { skipped++; continue; }
        await Ledger.create({ userId: req.ownerId, partyName: name, ledgerGroup: 'Sundry Debtor', currentBalance: 0, openingBalance: 0 });
        imported++;
      }
      res.json({ success: true, imported, skipped, message: `${imported} ledgers Tally se import hue.` });
    } catch (e) { res.status(502).json({ success: false, error: 'Tally import fail: ' + e.message }); }
  });

  // ===================== E-WAY BILL EXPORT (JSON for GSP upload) =====================
  app.post('/api/eway/export', authenticateToken, ownerMiddleware, biz, async (req, res) => {
    try {
      const { customer, product, qty, price, gstRate, ewayBillNo, vehicleNo, distance, customerGstin } = req.body;
      const profile = await BusinessProfile.findOne({ userId: req.ownerId });
      const taxable = (price || 0) * (qty || 1);
      const gst = taxable * ((gstRate || 0) / 100);
      const payload = {
        version: '1.0.1118', generator: 'BolKarigar',
        docNo: ewayBillNo || 'DRAFT-' + Date.now(),
        docDate: new Date().toISOString().split('T')[0],
        fromGstin: profile?.gstin || '', fromTrdName: profile?.companyName || '',
        toGstin: customerGstin || 'URP', toTrdName: customer || '',
        totalValue: taxable, cgstValue: gst / 2, sgstValue: gst / 2, igstValue: gst,
        vehicleNo: vehicleNo || '', transDistance: distance || 0,
        itemList: [{ productName: product, hsnCode: '', quantity: qty, taxableAmount: taxable }],
        note: 'Yeh e-way bill JSON export hai — NIC portal ya GSP (ClearTax, Masters India) par upload karein. Direct portal integration ke liye GSP API credentials chahiye.'
      };
      res.json({ success: true, ewayPayload: payload });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ===================== CONTRACTOR MODULES =====================
  app.post('/api/labour', authenticateToken, ownerMiddleware, biz, requirePermission(PERMISSIONS.CONTRACTOR), async (req, res) => {
    try {
      const rec = await LabourAttendance.create({ userId: req.ownerId, ...req.body });
      res.json({ success: true, record: rec });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.get('/api/labour', authenticateToken, ownerMiddleware, biz, requirePermission(PERMISSIONS.CONTRACTOR), async (req, res) => {
    const records = await LabourAttendance.find({ userId: req.ownerId }).sort({ date: -1 }).limit(200);
    res.json({ success: true, records });
  });
  app.delete('/api/labour/:id', authenticateToken, ownerMiddleware, requirePermission(PERMISSIONS.CONTRACTOR), async (req, res) => {
    await LabourAttendance.deleteOne({ _id: req.params.id, userId: req.ownerId });
    res.json({ success: true });
  });

  app.post('/api/ra-bill', authenticateToken, ownerMiddleware, biz, requirePermission(PERMISSIONS.CONTRACTOR), async (req, res) => {
    try {
      const count = await RABill.countDocuments({ userId: req.ownerId });
      const rec = await RABill.create({ userId: req.ownerId, billNo: 'RA-' + (count + 1), ...req.body });
      res.json({ success: true, record: rec });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.get('/api/ra-bill', authenticateToken, ownerMiddleware, biz, requirePermission(PERMISSIONS.CONTRACTOR), async (req, res) => {
    const records = await RABill.find({ userId: req.ownerId }).sort({ date: -1 });
    res.json({ success: true, records });
  });
  app.delete('/api/ra-bill/:id', authenticateToken, ownerMiddleware, requirePermission(PERMISSIONS.CONTRACTOR), async (req, res) => {
    await RABill.deleteOne({ _id: req.params.id, userId: req.ownerId });
    res.json({ success: true });
  });

  app.post('/api/material-slip', authenticateToken, ownerMiddleware, biz, requirePermission(PERMISSIONS.CONTRACTOR), async (req, res) => {
    try {
      const count = await MaterialSlip.countDocuments({ userId: req.ownerId });
      const rec = await MaterialSlip.create({ userId: req.ownerId, slipNo: 'MS-' + (count + 1), ...req.body });
      res.json({ success: true, record: rec });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.get('/api/material-slip', authenticateToken, ownerMiddleware, biz, requirePermission(PERMISSIONS.CONTRACTOR), async (req, res) => {
    const records = await MaterialSlip.find({ userId: req.ownerId }).sort({ date: -1 });
    res.json({ success: true, records });
  });
  app.delete('/api/material-slip/:id', authenticateToken, ownerMiddleware, requirePermission(PERMISSIONS.CONTRACTOR), async (req, res) => {
    await MaterialSlip.deleteOne({ _id: req.params.id, userId: req.ownerId });
    res.json({ success: true });
  });

  // ===================== BANK RECONCILIATION =====================
  app.post('/api/bank-recon', authenticateToken, ownerMiddleware, requireOwner, biz, requirePermission(PERMISSIONS.BANK_RECON), async (req, res) => {
    try {
      const rec = await BankRecon.create({ userId: req.ownerId, ...req.body });
      res.json({ success: true, record: rec });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.get('/api/bank-recon', authenticateToken, ownerMiddleware, requireOwner, biz, requirePermission(PERMISSIONS.BANK_RECON), async (req, res) => {
    const records = await BankRecon.find({ userId: req.ownerId }).sort({ date: -1 });
    const bankLedgers = await Ledger.find({ userId: req.ownerId, ledgerGroup: 'Bank' });
    res.json({ success: true, records, bankLedgers });
  });
  app.patch('/api/bank-recon/:id/match', authenticateToken, ownerMiddleware, requireOwner, requirePermission(PERMISSIONS.BANK_RECON), async (req, res) => {
    await BankRecon.updateOne({ _id: req.params.id, userId: req.ownerId }, { matched: true, voucherId: req.body.voucherId });
    res.json({ success: true });
  });

  // ===================== MULTI-COMPANY =====================
  app.post('/api/companies', authenticateToken, ownerMiddleware, requireOwner, biz, requirePermission(PERMISSIONS.COMPANIES), async (req, res) => {
    try {
      const { companyName, gstin, address } = req.body;
      if (!companyName) return res.status(400).json({ error: 'Company naam zaroori.' });
      const co = await Company.create({ userId: req.ownerId, companyName, gstin, address });
      res.json({ success: true, company: co });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.get('/api/companies', authenticateToken, ownerMiddleware, requireOwner, biz, requirePermission(PERMISSIONS.COMPANIES), async (req, res) => {
    const companies = await Company.find({ userId: req.ownerId });
    res.json({ success: true, companies });
  });
  app.post('/api/companies/:id/activate', authenticateToken, ownerMiddleware, requireOwner, biz, requirePermission(PERMISSIONS.COMPANIES), async (req, res) => {
    await Company.updateMany({ userId: req.ownerId }, { isActive: false });
    await Company.updateOne({ _id: req.params.id, userId: req.ownerId }, { isActive: true });
    const active = await Company.findById(req.params.id);
    if (active) {
      await BusinessProfile.findOneAndUpdate(
        { userId: req.ownerId },
        { companyName: active.companyName, gstin: active.gstin || '', fullAddress: active.address || '' },
        { upsert: true }
      );
    }
    res.json({ success: true, message: 'Company switch ho gayi.' });
  });

  // Ledger groups list for frontend
  app.get('/api/ledger-groups', authenticateToken, (req, res) => {
    res.json({ success: true, groups: LEDGER_GROUPS_FULL });
  });

  console.log('✓ BolKarigar Pro features loaded (Staff, GSTR, Reports, Tally Import, Contractor, Bank Recon)');
  return { LEDGER_GROUPS_FULL, Payment, LabourAttendance, RABill, MaterialSlip, BankRecon, Company };
}

module.exports = { setupProFeatures, LEDGER_GROUPS_FULL };
