/**
 * BolKarigar — Live-ready feature routes (daily summary, backup, alerts, CSV import)
 */
const { parseBankCsvRows } = require('./bank-csv-utils');
const { autoMatchBankRecon } = require('./bank-recon-service');

function setupLiveFeatures({ app, mongoose, authenticateToken, models, rbac, requireBusinessPlan }) {
  const { SalesHistory, Item, Ledger, Voucher, UserData, BusinessProfile } = models;
  const Payment = () => mongoose.model('Payment');
  const { requireOwner, requirePermission, PERMISSIONS } = rbac;
  const biz = requireBusinessPlan || ((req, res, next) => next());

  function todayRange() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  // --- Aaj ka cash / UPI / udhar summary ---
  app.get('/api/reports/daily-summary', authenticateToken, async (req, res) => {
    try {
      const uid = req.dataUserId;
      const { start, end } = todayRange();
      const sales = await SalesHistory.find({ userId: uid, date: { $gte: start, $lte: end } });
      const payments = await Payment().find({ userId: uid, date: { $gte: start, $lte: end } });

      let cash = 0, upi = 0, credit = 0, totalSales = 0;
      sales.forEach((s) => {
        const amt = s.totalAmount || (s.price || 0) * (s.qty || 1);
        totalSales += amt;
        const mode = (s.paymentType || '').toLowerCase();
        const st = (s.status || '').toLowerCase();
        if (st === 'pending' || st === 'credit' || mode === 'credit') credit += amt;
        else if (mode.includes('upi')) upi += amt;
        else cash += amt;
      });

      const collections = payments.reduce((a, p) => a + (p.amount || 0), 0);
      res.json({
        success: true,
        date: start.toISOString().split('T')[0],
        totalSales,
        cashReceived: cash,
        upiReceived: upi,
        creditSales: credit,
        udharCollections: collections,
        netCashIn: cash + upi + collections,
        invoiceCount: sales.length
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Low stock alert ---
  app.get('/api/alerts/low-stock', authenticateToken, async (req, res) => {
    try {
      const threshold = parseInt(req.query.threshold) || 5;
      const items = await Item.find({
        userId: req.dataUserId,
        stockQty: { $lte: threshold }
      }).sort({ stockQty: 1 }).limit(50);
      res.json({
        success: true,
        threshold,
        count: items.length,
        items: items.map((i) => ({
          id: i._id,
          itemName: i.itemName,
          stockQty: i.stockQty,
          unit: i.unit
        }))
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Full business backup (JSON) ---
  app.get('/api/backup/full', authenticateToken, requireOwner, biz, async (req, res) => {
    try {
      const uid = req.dataUserId;
      const [profile, userData, sales, ledgers, items, vouchers, payments] = await Promise.all([
        BusinessProfile.findOne({ userId: uid }),
        UserData.findOne({ userId: uid }),
        SalesHistory.find({ userId: uid }).sort({ date: -1 }).limit(5000),
        Ledger.find({ userId: uid }),
        Item.find({ userId: uid }),
        Voucher.find({ userId: uid }).sort({ date: -1 }).limit(5000),
        Payment.find({ userId: uid }).sort({ date: -1 }).limit(5000)
      ]);
      const payload = {
        exportedAt: new Date().toISOString(),
        generator: 'BolKarigar',
        profile,
        todos: userData?.todos || [],
        projects: userData?.projects || [],
        expenses: userData?.expenses || [],
        invoiceDrafts: userData?.invoices || [],
        salesHistory: sales,
        ledgers,
        items,
        vouchers,
        payments
      };
      res.setHeader('Content-Disposition', `attachment; filename="bolkarigar-backup-${Date.now()}.json"`);
      res.json(payload);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- CA export pack (reports bundle) ---
  app.get('/api/backup/ca-pack', authenticateToken, biz, requirePermission(PERMISSIONS.REPORTS_VIEW), async (req, res) => {
    try {
      const uid = req.dataUserId;
      const m = parseInt(req.query.month) || new Date().getMonth() + 1;
      const y = parseInt(req.query.year) || new Date().getFullYear();
      const from = new Date(y, m - 1, 1);
      const to = new Date(y, m, 0, 23, 59, 59);

      const [profile, sales, vouchers, ledgers] = await Promise.all([
        BusinessProfile.findOne({ userId: uid }),
        SalesHistory.find({ userId: uid, date: { $gte: from, $lte: to } }),
        Voucher.find({ userId: uid, date: { $gte: from, $lte: to } }),
        Ledger.find({ userId: uid })
      ]);

      let outTax = 0;
      sales.forEach((s) => { outTax += (s.price || 0) * (s.qty || 1) * ((s.gstRate || 0) / 100); });

      const pack = {
        exportedAt: new Date().toISOString(),
        period: `${m}/${y}`,
        company: { name: profile?.companyName, gstin: profile?.gstin, address: profile?.fullAddress },
        summary: {
          totalSales: sales.reduce((a, s) => a + (s.totalAmount || (s.price || 0) * (s.qty || 1)), 0),
          invoiceCount: sales.length,
          estimatedGst: outTax,
          voucherCount: vouchers.length,
          ledgerCount: ledgers.length
        },
        sales,
        vouchers,
        ledgers,
        note: 'CA ke liye export — GSTR portal par verify karke file karein.'
      };
      res.setHeader('Content-Disposition', `attachment; filename="bolkarigar-ca-pack-${m}-${y}.json"`);
      res.json(pack);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Bank statement CSV import ---
  app.post('/api/bank-recon/import-csv', authenticateToken, requireOwner, biz, requirePermission(PERMISSIONS.BANK_RECON), async (req, res) => {
    try {
      const BankRecon = mongoose.model('BankRecon');
      const { csvText } = req.body;
      if (!csvText || typeof csvText !== 'string') {
        return res.status(400).json({ error: 'CSV text zaroori hai.' });
      }

      const { rows, skipped, errors } = parseBankCsvRows(csvText);
      if (!rows.length) {
        return res.status(400).json({
          error: errors[0] || 'Koi valid row nahi mili. Date column DD/MM/YYYY ya YYYY-MM-DD honi chahiye.',
          skipped,
          hints: errors
        });
      }

      const userId = req.dataUserId;
      let imported = 0;
      const Payment = mongoose.model('Payment');
      for (const row of rows) {
        if (!row.statementDate || Number.isNaN(new Date(row.statementDate).getTime())) continue;
        await BankRecon.create({
          userId,
          description: row.description,
          debit: row.debit,
          credit: row.credit,
          statementDate: row.statementDate,
          date: row.date || row.statementDate
        });
        imported++;
      }
      const SalesHistory = models.SalesHistory;
      const matchResult = await autoMatchBankRecon({ BankRecon, Payment, SalesHistory, userId });

      res.json({
        success: true,
        imported,
        skipped,
        matched: matchResult.matchedCount,
        warnings: errors,
        message: `${imported} bank entries import ho gayi${skipped ? ` (${skipped} row skip — galat date/format)` : ''}${matchResult.matchedCount ? `; ${matchResult.matchedCount} Udhar payment se match.` : ''}.`
      });
    } catch (e) {
      res.status(500).json({ error: e.message || 'CSV import fail.' });
    }
  });

  console.log('✓ Live features loaded (Daily summary, Low stock, Backup, CA pack, Bank CSV)');
}

module.exports = { setupLiveFeatures };
