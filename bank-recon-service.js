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

async function autoMatchBankRecon({ BankRecon, Payment, userId }) {
  const uid = String(userId);
  const payments = await Payment.find({
    userId: uid,
    paymentMode: { $in: ['UPI', 'Bank', 'Cheque'] }
  }).lean();
  const usedPaymentIds = new Set(
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

    const hit = payments.find((p) => {
      if (usedPaymentIds.has(String(p._id))) return false;
      if (Math.abs(Number(p.amount) - amount) > 0.02) return false;
      if (dayKeyIST(p.date) !== rowDay) return false;
      if (row.credit > 0 && row.debit > 0) return false;
      return true;
    });

    if (!hit) continue;

    const hint = `Udhar payment — ${hit.customerName}, ₹${Number(hit.amount).toFixed(2)} (${hit.paymentMode})`;
    await BankRecon.updateOne(
      { _id: row._id },
      { matched: true, voucherId: hit._id, matchHint: hint }
    );
    usedPaymentIds.add(String(hit._id));
    matchedCount++;
  }

  return { matchedCount };
}

module.exports = { buildBankReconPayload, autoMatchBankRecon, dayKeyIST };
