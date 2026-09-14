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

/** Billed / paid / pending udhar — same logic as Credit Ledger outstanding row. */
async function getDebtorUdharSummary(userId, ledger, models) {
  const { SalesHistory, Payment } = models;
  const pendingRaw = await reconcileDebtorLedger(userId, ledger, models);
  const rx = partyRegex(ledger.partyName);
  let billed = 0;
  let paid = 0;

  const sales = await SalesHistory.find({ userId, customer: rx });
  for (const s of sales) {
    const amt = saleRecordAmount(s);
    billed += amt;
    if (!isCreditPayment(s.paymentType, s.status)) paid += amt;
  }

  const payments = await Payment.find({ userId, customerName: rx });
  for (const p of payments) {
    paid += Number(p.amount) || 0;
  }

  const pendingUdhar = Math.max(0, pendingRaw);
  return {
    pendingUdhar,
    pending: pendingUdhar,
    billed,
    paid,
    udharClear: pendingUdhar <= 0.01
  };
}

function salesVoucherDuplicate(sales, voucher) {
  const amt = Number(voucher.amount) || 0;
  return sales.some((s) =>
    Math.abs(saleRecordAmount(s) - amt) < 0.02 && sameCalendarDay(s.date, voucher.date)
  );
}

/**
 * Ledger statement for Sundry Debtor — shows Paid vs Udhar and running udhar balance.
 */
async function buildDebtorLedgerStatement(userId, ledger, models) {
  const { SalesHistory, Payment, Voucher } = models;
  const openingBalance = Number(ledger.openingBalance) || 0;
  const currentUdhar = await reconcileDebtorLedger(userId, ledger, models);

  if (Math.abs(currentUdhar - (Number(ledger.currentBalance) || 0)) > 0.009) {
    ledger.currentBalance = currentUdhar;
    await ledger.save();
  }

  const rx = partyRegex(ledger.partyName);
  const events = [];

  const sales = await SalesHistory.find({ userId, customer: rx });
  for (const s of sales) {
    const amt = saleRecordAmount(s);
    const credit = isCreditPayment(s.paymentType, s.status);
    events.push({
      date: s.date,
      sortKey: new Date(s.date).getTime(),
      voucherType: 'Sale',
      amount: amt,
      paymentMode: s.paymentType || 'Cash',
      status: credit ? 'Udhar' : 'Paid',
      udharEffect: credit ? amt : 0,
      note: [s.product, s.invoiceNo ? `#${s.invoiceNo}` : ''].filter(Boolean).join(' — ') || '-'
    });
  }

  const payments = await Payment.find({ userId, customerName: rx });
  for (const p of payments) {
    const amt = Number(p.amount) || 0;
    if (amt <= 0) continue;
    events.push({
      date: p.date,
      sortKey: new Date(p.date).getTime(),
      voucherType: 'Payment',
      amount: amt,
      paymentMode: p.paymentMode || 'Cash',
      status: 'Received',
      udharEffect: -amt,
      note: p.note || 'Payment received'
    });
  }

  const vouchers = await Voucher.find({
    userId,
    $or: [{ partyId: ledger._id }, { secondaryLedgerId: ledger._id }]
  });
  for (const v of vouchers) {
    const amt = Number(v.amount) || 0;
    if (amt <= 0) continue;

    if (v.voucherType === 'Sales' && salesVoucherDuplicate(sales, v)) continue;

    let udharEffect = 0;
    let status = 'Accounting';
    if (v.voucherType === 'Sales') {
      const credit = isCreditPayment(v.paymentMode, null);
      udharEffect = credit ? amt : 0;
      status = credit ? 'Udhar' : 'Paid';
    } else if (v.voucherType === 'Receipt') {
      udharEffect = -amt;
      status = 'Received';
    }

    events.push({
      date: v.date,
      sortKey: new Date(v.date).getTime(),
      voucherType: v.voucherType,
      amount: amt,
      paymentMode: v.paymentMode || '—',
      status,
      udharEffect,
      note: v.note || '-'
    });
  }

  events.sort((a, b) => a.sortKey - b.sortKey);

  let running = openingBalance;
  const history = events.map((e) => {
    running += e.udharEffect;
    return {
      date: e.date,
      voucherType: e.voucherType,
      amount: e.amount,
      paymentMode: e.paymentMode,
      status: e.status,
      udharEffect: e.udharEffect,
      runningBalance: Math.round(running * 100) / 100,
      note: e.note
    };
  });

  const pendingUdhar = Math.max(0, currentUdhar);
  return {
    partyName: ledger.partyName,
    ledgerGroup: ledger.ledgerGroup,
    openingBalance,
    currentBalance: Math.round(currentUdhar * 100) / 100,
    pendingUdhar,
    udharClear: pendingUdhar <= 0.01,
    history
  };
}

module.exports = {
  isCreditPayment,
  saleRecordAmount,
  reconcileDebtorLedger,
  reconcileAllDebtorLedgers,
  getDebtorUdharSummary,
  buildDebtorLedgerStatement,
  partyRegex
};
