/**
 * Multi-company data isolation.
 * Active company ke records hi API se nikalte / save hote hain.
 * Purana data (bina companyId) pehli company ko assign ho jaata hai.
 */
const { AsyncLocalStorage } = require('async_hooks');
const mongoose = require('mongoose');

const companyAls = new AsyncLocalStorage();
const backfilledUsers = new Set();

const SCOPED_MODELS = [
  'UserData', 'SalesHistory', 'Ledger', 'Item', 'Voucher', 'Photo',
  'Payment', 'LabourAttendance', 'RABill', 'MaterialSlip', 'BankRecon',
  'Estimate', 'PayrollEmployee', 'PayrollAttendance', 'PayrollAdvance'
];

function companyObjectId(value) {
  if (!value) return null;
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
}

function scopedUser(userId, extra = {}) {
  const store = companyAls.getStore();
  const q = { userId, ...extra };
  if (store?.companyId) q.companyId = companyObjectId(store.companyId);
  return q;
}

function scopedDoc(userId, extra = {}) {
  const store = companyAls.getStore();
  const d = { userId, ...extra };
  if (store?.companyId) d.companyId = companyObjectId(store.companyId);
  return d;
}

function uidFilter(req, extra = {}) {
  const f = { userId: req.dataUserId, ...extra };
  if (req.activeCompanyId) f.companyId = companyObjectId(req.activeCompanyId);
  return f;
}

function uidDoc(req, extra = {}) {
  const d = { userId: req.dataUserId, ...extra };
  if (req.activeCompanyId) d.companyId = companyObjectId(req.activeCompanyId);
  return d;
}

async function backfillLegacyToFirstCompany(userId, firstCompanyId) {
  const key = String(userId);
  if (backfilledUsers.has(key)) return;
  const firstId = companyObjectId(firstCompanyId);
  if (!firstId) return;
  const q = {
    userId,
    $or: [{ companyId: null }, { companyId: { $exists: false } }]
  };
  for (const name of SCOPED_MODELS) {
    try {
      const Model = mongoose.model(name);
      await Model.updateMany(q, { $set: { companyId: firstId } });
    } catch {
      /* model not registered yet */
    }
  }
  backfilledUsers.add(key);
}

async function attachCompanyScope(req) {
  const userId = req.dataUserId;
  req.activeCompanyId = null;
  req.activeCompany = null;
  if (!userId) return;

  let Company;
  try {
    Company = mongoose.model('Company');
  } catch {
    return;
  }

  const companies = await Company.find({ userId }).sort({ createdAt: 1 }).lean();
  if (!companies.length) return;

  const active = companies.find((c) => c.isActive) || companies[0];
  req.activeCompanyId = String(active._id);
  req.activeCompany = active;
  await backfillLegacyToFirstCompany(userId, companies[0]._id);
}

function runWithCompanyScope(req, fn) {
  return companyAls.run(
    { companyId: req.activeCompanyId || null, userId: req.dataUserId || null },
    fn
  );
}

module.exports = {
  scopedUser,
  scopedDoc,
  uidFilter,
  uidDoc,
  attachCompanyScope,
  runWithCompanyScope,
  backfillLegacyToFirstCompany,
  companyObjectId
};
