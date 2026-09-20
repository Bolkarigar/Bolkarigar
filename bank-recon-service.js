/**
 * Bank reconciliation — safe payloads + auto-match against app Payments (UPI/Bank/Cheque).
 */
const { parseBankStatementDate, parseAmount } = require('./bank-csv-utils');

function dayKeyIST(value) {
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function buildBankReconPayload(body, userId) {
  const description = String(body?.description || '').trim() || 'Bank entry';
  const debit = parseAmount(body?.debit);
  const credit = parseAmount(body?.credit);
  let statementDate = null;
  const rawDate = body?.statementDate ?? body?.date;
  if (rawDate) {
    if (rawDate instanceof Date && !Number.isNaN(rawDate.getTime())) statementDate = rawDate;
    else statementDate = parseBankStatementDate(rawDate);
  }
  if (!statementDate || Number.isNaN(statementDate.getTime())) {
    statementDate = new Date();
  }
  return {
    userId,
    description,
    debit,
    credit,
    statementDate,
    date: statementDate
  };
}

function isBankLikePaymentType(paymentType) {
  return /^(upi|bank|cheque|card|neft|rtgs|imps)$/i.test(String(paymentType || '').trim());
}

async function autoMatchBankRecon({ BankRecon, Payment, SalesHistory, userId }) {
  const uid = String(userId);
  const payments = await Payment.find({
    userId: uid,
    paymentMode: { $in: ['UPI', 'Bank', 'Cheque'] }
  }).lean();
  const sales = SalesHistory
    ? await SalesHistory.find({ userId: uid, status: { $ne: 'Pending' } }).lean()
    : [];
  const bankSales = sales.filter((s) => isBankLikePaymentType(s.paymentType));

  const usedRefIds = new Set(
    (await BankRecon.find({ userId: uid, matched: true, voucherId: { $ne: null } }).select('voucherId').lean())
      .map((r) => String(r.voucherId))
  );

  const pending = await BankRecon.find({ userId: uid, matched: false });
  let matchedCount = 0;

  for (const row of pending) {
    const amount = row.credit > 0 ? row.credit : row.debit;
    if (!amount) continue;
    const rowDay = dayKeyIST(row.statementDate || row.date);
    if (!rowDay) continue;

    const payHit = payments.find((p) => {
      if (usedRefIds.has(String(p._id))) return false;
      if (Math.abs(Number(p.amount) - amount) > 0.02) return false;
      if (dayKeyIST(p.date) !== rowDay) return false;
      return true;
    });

    if (payHit) {
      const hint = `Udhar payment — ${payHit.customerName}, ₹${Number(payHit.amount).toFixed(2)} (${payHit.paymentMode})`;
      await BankRecon.updateOne({ _id: row._id }, { matched: true, voucherId: payHit._id, matchHint: hint });
      usedRefIds.add(String(payHit._id));
      matchedCount++;
      continue;
    }

    const saleHit = bankSales.find((s) => {
      if (usedRefIds.has(String(s._id))) return false;
      const amt = Number(s.totalAmount) || 0;
      if (!amt || Math.abs(amt - amount) > 0.02) return false;
      if (dayKeyIST(s.date) !== rowDay) return false;
      return true;
    });

    if (saleHit) {
      const hint = `Bill/Sale — ${saleHit.customer || 'Customer'}, ₹${Number(saleHit.totalAmount).toFixed(2)} (${saleHit.paymentType})`;
      await BankRecon.updateOne({ _id: row._id }, { matched: true, voucherId: saleHit._id, matchHint: hint });
      usedRefIds.add(String(saleHit._id));
      matchedCount++;
    }
  }

  return { matchedCount };
}

module.exports = { buildBankReconPayload, autoMatchBankRecon, dayKeyIST };
