/**
 * Cash vs Credit (Udhar) — shared payment classification
 */

function isCreditPayment(paymentType, status) {
  const p = String(paymentType || '').trim().toLowerCase();
  if (p === 'credit' || p === 'udhar') return true;
  if (['cash', 'upi', 'bank', 'paid'].includes(p)) return false;
  const st = String(status || '').trim().toLowerCase();
  if (st === 'pending' && !p) return true;
  return false;
}

function saleRecordAmount(record) {
  if (!record) return 0;
  const direct = Number(record.totalAmount);
  if (direct > 0) return direct;
  return (Number(record.price) || 0) * (Number(record.qty) || 1);
}

function sameCalendarDay(a, b) {
  if (!a || !b) return false;
  const d1 = new Date(a);
  const d2 = new Date(b);
  return d1.getFullYear() === d2.getFullYear()
    && d1.getMonth() === d2.getMonth()
    && d1.getDate() === d2.getDate();
}

function partyRegex(partyName) {
  const escaped = String(partyName || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}$`, 'i');
}

/**
 * Recompute Sundry Debtor balance from credit sales, receipts & payments (not cash sales).
 */
async function reconcileDebtorLedger(userId, ledger, models) {
  const { SalesHistory, Payment, Voucher } = models;
  if (!ledger?.partyName) return 0;

  const rx = partyRegex(ledger.partyName);
  let balance = Number(ledger.openingBalance) || 0;

  const sales = await SalesHistory.find({ userId, customer: rx });
  for (const s of sales) {
    if (isCreditPayment(s.paymentType, s.status)) {
      balance += saleRecordAmount(s);
    }
  }

  const payments = await Payment.find({ userId, customerName: rx });
  for (const p of payments) {
    balance -= Number(p.amount) || 0;
  }

  const receipts = await Voucher.find({ userId, partyId: ledger._id, voucherType: 'Receipt' });
  for (const r of receipts) {
    balance -= Number(r.amount) || 0;
  }

  const salesVouchers = await Voucher.find({ userId, partyId: ledger._id, voucherType: 'Sales' });
  for (const v of salesVouchers) {
    if (!isCreditPayment(v.paymentMode, null)) continue;
    const dup = sales.some((s) =>
      Math.abs(saleRecordAmount(s) - (Number(v.amount) || 0)) < 0.02
      && sameCalendarDay(s.date, v.date)
    );
    if (!dup) balance += Number(v.amount) || 0;
  }

  return Math.round(balance * 100) / 100;
}

async function reconcileAllDebtorLedgers(userId, models) {
  const { Ledger } = models;
  const debtors = await Ledger.find({ userId, ledgerGroup: 'Sundry Debtor' });
  const updates = [];
  for (const ledger of debtors) {
    const computed = await reconcileDebtorLedger(userId, ledger, models);
    if (Math.abs(computed - (Number(ledger.currentBalance) || 0)) > 0.009) {
      ledger.currentBalance = computed;
      await ledger.save();
      updates.push({ partyName: ledger.partyName, balance: computed });
    }
  }
  return updates;
}

module.exports = {
  isCreditPayment,
  saleRecordAmount,
  reconcileDebtorLedger,
  reconcileAllDebtorLedgers,
  partyRegex
};
