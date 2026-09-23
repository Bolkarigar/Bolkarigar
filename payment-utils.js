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

function formatDetailQty(qty) {
  const n = Number(qty);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.abs(n - Math.round(n)) < 0.001 ? String(Math.round(n)) : n.toFixed(2);
}

/** Parse qty from note/narration e.g. "laptop x2", "kar x1", "Qty: 3" */
function parseQtyFromText(text) {
  const t = String(text || '');
  let m = t.match(/\bx(\d+(?:\.\d+)?)\b/i);
  if (m) return formatDetailQty(m[1]);
  m = t.match(/(?:qty|quantity)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i);
  if (m) return formatDetailQty(m[1]);
  m = t.match(/\|\s*[^|]*?\sx(\d+(?:\.\d+)?)\b/i);
  if (m) return formatDetailQty(m[1]);
  return null;
}

function voucherItemsTotalQty(voucher) {
  if (!voucher?.items?.length) return null;
  let sum = 0;
  let any = false;
  for (const it of voucher.items) {
    const q = Number(it.qty);
    if (q > 0) {
      sum += q;
      any = true;
    }
  }
  return any ? formatDetailQty(sum) : null;
}

function resolveEventQty({ voucherType, status, qty, product, note, voucher }) {
  const isPayment = voucherType === 'Payment' || status === 'Received';
  if (isPayment) return null;
  const direct = formatDetailQty(qty);
  if (direct) return direct;
  const fromItems = voucher ? voucherItemsTotalQty(voucher) : null;
  if (fromItems) return fromItems;
  const fromNote = parseQtyFromText(note) || parseQtyFromText(product);
  if (fromNote) return fromNote;
  if (voucherType === 'Sale' || voucherType === 'Sales') return '1';
  return null;
}

/**
 * How each voucher type moves a Sundry Debtor balance. Mirrors the double-entry
 * deltas in server.js getVoucherLedgerDeltas(): `party` applies when the ledger is
 * the voucher's party, `secondary` when it is the other side of a Journal/Contra.
 */
const DEBTOR_VOUCHER_RULES = {
  Sales: { party: 1, status: 'Udhar' },
  'Debit Note': { party: 1, status: 'Debit Note' },
  Payment: { party: 1, status: 'Cash Given' },
  Receipt: { party: -1, status: 'Received' },
  'Credit Note': { party: -1, status: 'Returned' },
  Purchase: { party: -1, status: 'Returned' },
  Journal: { party: 1, secondary: -1, status: 'Journal' },
  Contra: { party: -1, secondary: 1, status: 'Contra' }
};

/**
 * Signed udhar effect of one voucher on a debtor ledger.
 * + = customer owes more, − = customer owes less.
 */
function debtorVoucherUdharEffect(voucher, ledgerId) {
  const amt = Number(voucher?.amount) || 0;
  const rule = DEBTOR_VOUCHER_RULES[voucher?.voucherType];
  if (!rule || amt <= 0) return { effect: 0, status: 'Accounting' };

  const onParty = voucher.partyId && String(voucher.partyId) === String(ledgerId);
  const sign = onParty ? rule.party : (rule.secondary || 0);
  if (!sign) return { effect: 0, status: 'Accounting' };

  if (voucher.voucherType === 'Sales') {
    const credit = isCreditPayment(voucher.paymentMode, null);
    return { effect: credit ? amt : 0, status: credit ? 'Udhar' : 'Paid' };
  }
  return { effect: sign * amt, status: rule.status };
}

/** Vouchers already represented by a SalesHistory / Payment row must not double-count. */
function debtorVoucherIsDuplicate(voucher, sales) {
  if (voucher.voucherType === 'Receipt' && voucher.linkedPaymentId) return true;
  if (voucher.voucherType === 'Sales' && salesVoucherDuplicate(sales, voucher)) return true;
  return false;
}

/** Signed net udhar: + = customer owes you, − = you owe customer (refund due). */
function summarizeDebtorBalance(netRaw) {
  const net = Math.round((Number(netRaw) || 0) * 100) / 100;
  if (Math.abs(net) <= 0.01) {
    return {
      netBalance: 0,
      pendingUdhar: 0,
      refundDue: 0,
      udharDue: 0,
      udharClear: true,
      status: 'clear',
      displayLabel: 'Paid / Clear'
    };
  }
  if (net > 0) {
    return {
      netBalance: net,
      pendingUdhar: net,
      refundDue: 0,
      udharDue: net,
      udharClear: false,
      status: 'udhar',
      displayLabel: `₹${net.toFixed(2)} Udhar`
    };
  }
  const refund = Math.abs(net);
  return {
    netBalance: net,
    pendingUdhar: net,
    refundDue: refund,
    udharDue: 0,
    udharClear: false,
    status: 'refund',
    displayLabel: `−₹${refund.toFixed(2)} Refund Due`
  };
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

  const vouchers = await Voucher.find({
    userId,
    $or: [{ partyId: ledger._id }, { secondaryLedgerId: ledger._id }]
  });
  for (const v of vouchers) {
    if (debtorVoucherIsDuplicate(v, sales)) continue;
    balance += debtorVoucherUdharEffect(v, ledger._id).effect;
  }

  return Math.round(balance * 100) / 100;
}

async function reconcileAllDebtorLedgers(userId, models, options = {}) {
  const { force = false } = options;
  const { Ledger } = models;
  const debtors = await Ledger.find({ userId, ledgerGroup: 'Sundry Debtor' });
  const updates = [];
  for (const ledger of debtors) {
    const computed = await reconcileDebtorLedger(userId, ledger, models);
    if (force || Math.abs(computed - (Number(ledger.currentBalance) || 0)) > 0.009) {
      ledger.currentBalance = computed;
      await ledger.save();
      updates.push({ partyName: ledger.partyName, balance: computed });
    }
  }
  return updates;
}

/** Billed / paid / pending udhar — same logic as Credit Ledger outstanding row. */
async function getDebtorUdharSummary(userId, ledger, models) {
  const { SalesHistory, Payment, Voucher } = models;
  const pendingRaw = await reconcileDebtorLedger(userId, ledger, models);
  const rx = partyRegex(ledger.partyName);
  let billed = 0;
  let paid = 0;
  let returns = 0;

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

  if (Voucher) {
    const vouchers = await Voucher.find({
      userId,
      $or: [{ partyId: ledger._id }, { secondaryLedgerId: ledger._id }]
    });
    for (const v of vouchers) {
      if (debtorVoucherIsDuplicate(v, sales)) continue;
      const { effect } = debtorVoucherUdharEffect(v, ledger._id);
      if (effect > 0) {
        // Credit sale voucher or cash handed to the customer — both raise the bill
        billed += effect;
      } else if (effect < 0) {
        const isGoodsReturn = v.voucherType === 'Credit Note' || v.voucherType === 'Purchase';
        if (isGoodsReturn) returns += -effect;
        else paid += -effect;
      }
    }
  }

  const balance = summarizeDebtorBalance(pendingRaw);
  return {
    netBalance: balance.netBalance,
    pendingUdhar: balance.pendingUdhar,
    pending: balance.pendingUdhar,
    refundDue: balance.refundDue,
    udharDue: balance.udharDue,
    billed: Math.max(0, billed - returns),
    grossBilled: billed,
    returns,
    paid,
    udharClear: balance.udharClear,
    balanceStatus: balance.status,
    balanceLabel: balance.displayLabel
  };
}

function draftLineAmount(item) {
  if (!item) return 0;
  const direct = Number(item.totalAmount);
  if (direct > 0) return direct;
  const base = (Number(item.price) || 0) * (Number(item.qty) || 1);
  const gst = base * ((Number(item.gstRate) || 0) / 100);
  return base + gst;
}

/** Remove one matching row from UserData invoice draft when permanent sale is deleted. */
async function removeOneMatchingDraftInvoice(userId, sale, UserData) {
  if (!UserData || !sale) return 0;
  const data = await UserData.findOne({ userId });
  if (!data?.invoices?.length) return 0;

  const customer = String(sale.customer || '').trim().toLowerCase();
  const product = String(sale.product || '').trim().toLowerCase();
  const amt = saleRecordAmount(sale);
  let removeIdx = -1;

  for (let i = 0; i < data.invoices.length; i++) {
    const item = data.invoices[i];
    const itemCust = String(item.customer || '').trim().toLowerCase();
    const itemProd = String(item.product || '').trim().toLowerCase();
    if (itemCust !== customer || itemProd !== product) continue;
    if (Math.abs(draftLineAmount(item) - amt) < 0.02) {
      removeIdx = i;
      break;
    }
  }

  if (removeIdx < 0) return 0;
  data.invoices.splice(removeIdx, 1);
  await data.save();
  return 1;
}

function salesVoucherDuplicate(sales, voucher) {
  const amt = Number(voucher.amount) || 0;
  return sales.some((s) =>
    Math.abs(saleRecordAmount(s) - amt) < 0.02 && sameCalendarDay(s.date, voucher.date)
  );
}

function voucherMatchesSale(voucher, sale) {
  if (voucher.linkedSalesId && String(voucher.linkedSalesId) === String(sale._id)) return true;
  if (sale.linkedVoucherId && String(voucher._id) === String(sale.linkedVoucherId)) return true;
  const amt = saleRecordAmount(sale);
  if (Math.abs(Number(voucher.amount) - amt) >= 0.02) return false;
  if (!sameCalendarDay(voucher.date, sale.date)) return false;
  const note = String(voucher.note || '').toLowerCase();
  const invKey = String(sale.invoiceNo || '').toLowerCase();
  const productKey = String(sale.product || '').toLowerCase();
  if (invKey && note.includes(invKey)) return true;
  if (productKey && note.includes(productKey)) return true;
  return false;
}

/** Find ALL Sales vouchers linked to a SalesHistory invoice record. */
async function findLinkedSalesVouchers(userId, sale, models) {
  const { Voucher, Ledger } = models;
  const found = new Map();

  if (sale.linkedVoucherId) {
    const direct = await Voucher.findOne({ _id: sale.linkedVoucherId, userId, voucherType: 'Sales' });
    if (direct) found.set(String(direct._id), direct);
  }

  const byLink = await Voucher.find({
    userId,
    voucherType: 'Sales',
    linkedSalesId: sale._id
  });
  byLink.forEach((v) => found.set(String(v._id), v));

  const rx = partyRegex(sale.customer);
  const ledger = await Ledger.findOne({ userId, partyName: rx });
  if (ledger) {
    const candidates = await Voucher.find({
      userId,
      partyId: ledger._id,
      voucherType: 'Sales'
    });
    candidates.filter((v) => voucherMatchesSale(v, sale))
      .forEach((v) => found.set(String(v._id), v));
  }

  return Array.from(found.values());
}

/** Payments in Credit Ledger tied to this invoice. */
async function findLinkedPaymentsForSale(userId, sale, models) {
  const { Payment } = models;
  if (!Payment || !sale?.customer) return [];
  const rx = partyRegex(sale.customer);
  const payments = await Payment.find({ userId, customerName: rx });
  const inv = String(sale.invoiceNo || '').trim();
  const amt = saleRecordAmount(sale);
  return payments.filter((p) => {
    if (inv && p.invoiceNo && String(p.invoiceNo).trim() === inv) return true;
    return Math.abs(Number(p.amount) - amt) < 0.02 && sameCalendarDay(p.date, sale.date);
  });
}

/** Receipt vouchers tied to a Payment record. */
async function findReceiptVouchersForPayment(userId, payment, models) {
  const { Voucher, Ledger } = models;
  const found = new Map();

  if (payment?._id) {
    const direct = await Voucher.find({
      userId,
      voucherType: 'Receipt',
      linkedPaymentId: payment._id
    });
    direct.forEach((v) => found.set(String(v._id), v));
  }

  const rx = partyRegex(payment.customerName);
  const ledger = await Ledger.findOne({ userId, partyName: rx });
  if (!ledger) return Array.from(found.values());

  const receipts = await Voucher.find({
    userId,
    partyId: ledger._id,
    voucherType: 'Receipt'
  });
  receipts.filter((r) =>
    Math.abs(Number(r.amount) - Number(payment.amount)) < 0.02
    && sameCalendarDay(r.date, payment.date)
  ).forEach((v) => found.set(String(v._id), v));

  return Array.from(found.values());
}

/** Find SalesHistory record linked to a Sales voucher. */
async function findLinkedSalesRecord(userId, voucher, models) {
  const { SalesHistory, Ledger } = models;
  if (voucher.linkedSalesId) {
    const direct = await SalesHistory.findOne({ _id: voucher.linkedSalesId, userId });
    if (direct) return direct;
  }

  const party = voucher.partyId
    ? await Ledger.findOne({ _id: voucher.partyId, userId })
    : null;
  if (!party) return null;

  const rx = partyRegex(party.partyName);
  const sales = await SalesHistory.find({ userId, customer: rx }).sort({ date: 1 });
  const amt = Number(voucher.amount) || 0;
  const note = String(voucher.note || '').toLowerCase();

  const matched = sales.filter((s) => {
    if (s.linkedVoucherId && String(s.linkedVoucherId) === String(voucher._id)) return true;
    if (Math.abs(saleRecordAmount(s) - amt) >= 0.02) return false;
    if (!sameCalendarDay(s.date, voucher.date)) return false;
    const invKey = String(s.invoiceNo || '').toLowerCase();
    const productKey = String(s.product || '').toLowerCase();
    if (invKey && note.includes(invKey)) return true;
    if (productKey && note.includes(productKey)) return true;
    return false;
  });

  return matched.find((s) => String(s.linkedVoucherId) === String(voucher._id))
    || matched.find((s) => !s.linkedVoucherId)
    || matched[0]
    || null;
}

/** Find Credit Ledger Payment record linked to a Receipt voucher. */
async function findLinkedPaymentForReceipt(userId, voucher, models) {
  const { Payment, Ledger } = models;
  if (voucher.linkedPaymentId) {
    const direct = await Payment.findOne({ _id: voucher.linkedPaymentId, userId });
    if (direct) return direct;
  }

  const party = voucher.partyId
    ? await Ledger.findOne({ _id: voucher.partyId, userId })
    : null;
  if (!party) return null;

  const rx = partyRegex(party.partyName);
  const amt = Number(voucher.amount) || 0;
  const payments = await Payment.find({ userId, customerName: rx }).sort({ date: 1 });
  return payments.find((p) =>
    Math.abs(Number(p.amount) - amt) < 0.02 && sameCalendarDay(p.date, voucher.date)
  ) || null;
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
    const product = s.product || '';
    const note = [product, s.invoiceNo ? `#${s.invoiceNo}` : ''].filter(Boolean).join(' — ') || '-';
    events.push({
      date: s.date,
      sortKey: new Date(s.date).getTime(),
      voucherType: 'Sale',
      amount: amt,
      paymentMode: s.paymentType || 'Cash',
      status: credit ? 'Udhar' : 'Paid',
      udharEffect: credit ? amt : 0,
      note,
      product,
      qty: s.qty,
      invoiceNo: s.invoiceNo || ''
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
      note: p.note || 'Payment received',
      qty: null
    });
  }

  const vouchers = await Voucher.find({
    userId,
    $or: [{ partyId: ledger._id }, { secondaryLedgerId: ledger._id }]
  });
  for (const v of vouchers) {
    const amt = Number(v.amount) || 0;
    if (amt <= 0) continue;
    if (debtorVoucherIsDuplicate(v, sales)) continue;

    const { effect: udharEffect, status } = debtorVoucherUdharEffect(v, ledger._id);

    const displayType = v.voucherType === 'Purchase' ? 'Credit Note' : v.voucherType;
    const displayNote = v.voucherType === 'Purchase'
      ? [v.note, v.supplierInvoiceNo ? `#${v.supplierInvoiceNo}` : '', '(Customer return via Purchase bill)'].filter(Boolean).join(' | ') || 'Customer return'
      : (v.note || '-');

    events.push({
      date: v.date,
      sortKey: new Date(v.date).getTime(),
      voucherType: displayType,
      amount: amt,
      paymentMode: v.paymentMode || '—',
      status,
      udharEffect,
      note: displayNote,
      product: v.note || '',
      qty: v.qty,
      voucher: v
    });
  }

  events.sort((a, b) => a.sortKey - b.sortKey);

  let running = openingBalance;
  const history = events.map((e) => {
    running += e.udharEffect;
    const qtyDisplay = resolveEventQty({
      voucherType: e.voucherType,
      status: e.status,
      qty: e.qty,
      product: e.product,
      note: e.note,
      voucher: e.voucher
    });
    return {
      date: e.date,
      voucherType: e.voucherType,
      amount: e.amount,
      paymentMode: e.paymentMode,
      status: e.status,
      udharEffect: e.udharEffect,
      runningBalance: Math.round(running * 100) / 100,
      note: e.note,
      product: e.product || '',
      qty: qtyDisplay
    };
  });

  const balance = summarizeDebtorBalance(currentUdhar);
  return {
    partyName: ledger.partyName,
    ledgerGroup: ledger.ledgerGroup,
    openingBalance,
    currentBalance: balance.netBalance,
    netBalance: balance.netBalance,
    pendingUdhar: balance.pendingUdhar,
    refundDue: balance.refundDue,
    udharDue: balance.udharDue,
    udharClear: balance.udharClear,
    balanceStatus: balance.status,
    balanceLabel: balance.displayLabel,
    history
  };
}

module.exports = {
  isCreditPayment,
  saleRecordAmount,
  summarizeDebtorBalance,
  debtorVoucherUdharEffect,
  debtorVoucherIsDuplicate,
  reconcileDebtorLedger,
  reconcileAllDebtorLedgers,
  getDebtorUdharSummary,
  buildDebtorLedgerStatement,
  findLinkedSalesVouchers,
  findLinkedSalesRecord,
  findLinkedPaymentForReceipt,
  findLinkedPaymentsForSale,
  findReceiptVouchersForPayment,
  removeOneMatchingDraftInvoice,
  draftLineAmount,
  partyRegex
};
