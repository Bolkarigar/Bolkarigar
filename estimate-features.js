/**
 * Accounts Orbit — Quotation / Estimate (Kaccha Bill) — Business ₹299
 * Save estimates, PDF on client, 1-click convert to tax invoice (sales history).
 */
const ESTIMATE_STATUSES = ['draft', 'sent', 'accepted', 'converted', 'rejected'];

function lineTotal(item) {
  const price = parseFloat(item.price) || 0;
  const qty = parseFloat(item.qty) || 1;
  const gstRate = parseFloat(item.gstRate) || 0;
  const base = price * qty;
  return base + (base * gstRate) / 100;
}

function normalizeLines(lines) {
  if (!Array.isArray(lines)) return [];
  return lines
    .map((row) => {
      const product = String(row.product || '').trim();
      if (!product) return null;
      const price = parseFloat(row.price) || 0;
      const qty = parseFloat(row.qty) || 1;
      const gstRate = parseFloat(row.gstRate) || 0;
      return {
        product,
        hsn: String(row.hsn || '').trim(),
        qty,
        unit: String(row.unit || 'Pcs').trim() || 'Pcs',
        price,
        gstRate,
        lineTotal: lineTotal({ price, qty, gstRate })
      };
    })
    .filter(Boolean);
}

function sumGrandTotal(lines) {
  return lines.reduce((s, l) => s + (l.lineTotal || lineTotal(l)), 0);
}

function setupEstimateFeatures({ app, mongoose, authenticateToken, rbac, requireBusinessPlan, models }) {
  const { BusinessProfile, SalesHistory } = models;
  const { requirePermission, PERMISSIONS } = rbac;
  const biz = requireBusinessPlan || ((req, res, next) => next());
  const canWrite = requirePermission(PERMISSIONS.INVOICE_CREATE);

  const estimateLineSchema = new mongoose.Schema({
    product: { type: String, required: true },
    hsn: String,
    qty: { type: Number, default: 1 },
    unit: { type: String, default: 'Pcs' },
    price: { type: Number, default: 0 },
    gstRate: { type: Number, default: 0 },
    lineTotal: { type: Number, default: 0 }
  }, { _id: false });

  const { uidFilter, uidDoc } = require('./company-scope');

  const estimateSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    estimateNo: { type: String, required: true },
    customer: { type: String, required: true },
    customerGstin: String,
    customerAddress: String,
    customerState: String,
    customerPincode: String,
    projectName: String,
    paymentType: { type: String, default: 'Cash' },
    gstEnabled: { type: Boolean, default: true },
    lines: [estimateLineSchema],
    grandTotal: { type: Number, default: 0 },
    notes: String,
    validUntil: Date,
    status: { type: String, enum: ESTIMATE_STATUSES, default: 'draft' },
    linkedInvoiceNo: String,
    convertedAt: Date,
    estimateDate: { type: Date, default: Date.now }
  }, { timestamps: true });

  estimateSchema.index({ userId: 1, estimateDate: -1 });
  estimateSchema.index({ userId: 1, estimateNo: 1 });

  const Estimate = mongoose.models.Estimate || mongoose.model('Estimate', estimateSchema);

  async function nextEstimateNo(userId) {
    const profile = await BusinessProfile.findOneAndUpdate(
      { userId },
      { $inc: { estimateCounter: 1 } },
      { new: true, upsert: true }
    );
    const companyName = profile.companyName || 'EST';
    const prefix = companyName.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 4) || 'EST';
    const year = String(new Date().getFullYear()).slice(-2);
    return `EST/${profile.estimateCounter}/${year}`;
  }

  async function nextInvoiceNo(userId) {
    const profile = await BusinessProfile.findOneAndUpdate(
      { userId },
      { $inc: { invoiceCounter: 1 } },
      { new: true, upsert: true }
    );
    const companyName = profile.companyName || 'INV';
    const prefix = companyName.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 4) || 'INV';
    const year = String(new Date().getFullYear()).slice(-2);
    return `${prefix}/${profile.invoiceCounter}/${year}`;
  }

  app.get('/api/estimates/next-number', authenticateToken, biz, canWrite, async (req, res) => {
    try {
      const estimateNo = await nextEstimateNo(req.dataUserId);
      res.json({ success: true, estimateNo });
    } catch (e) {
      res.status(500).json({ error: e.message || 'Estimate number failed.' });
    }
  });

  app.get('/api/estimates', authenticateToken, biz, canWrite, async (req, res) => {
    try {
      const { status, search, limit = 50 } = req.query;
      const filter = uidFilter(req);
      if (status && ESTIMATE_STATUSES.includes(status)) filter.status = status;
      if (search) {
        const rx = new RegExp(String(search).trim(), 'i');
        filter.$or = [{ customer: rx }, { estimateNo: rx }, { projectName: rx }];
      }
      const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
      const rows = await Estimate.find(filter).sort({ estimateDate: -1 }).limit(lim);
      res.json({ success: true, estimates: rows });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/estimates/:id', authenticateToken, biz, canWrite, async (req, res) => {
    try {
      const doc = await Estimate.findOne(uidFilter(req, { _id: req.params.id }));
      if (!doc) return res.status(404).json({ error: 'Estimate not found.' });
      res.json({ success: true, estimate: doc });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/estimates', authenticateToken, biz, canWrite, async (req, res) => {
    try {
      const lines = normalizeLines(req.body.lines);
      if (!lines.length) return res.status(400).json({ error: 'Add at least one line item.' });
      const customer = String(req.body.customer || '').trim();
      if (!customer) return res.status(400).json({ error: 'Customer name is required.' });

      let estimateNo = String(req.body.estimateNo || '').trim();
      if (!estimateNo) estimateNo = await nextEstimateNo(req.dataUserId);

      const grandTotal = sumGrandTotal(lines);
      const doc = await Estimate.create(uidDoc(req, {
        estimateNo,
        customer,
        customerGstin: req.body.customerGstin,
        customerAddress: req.body.customerAddress,
        customerState: req.body.customerState,
        customerPincode: req.body.customerPincode,
        projectName: req.body.projectName,
        paymentType: req.body.paymentType || 'Cash',
        gstEnabled: req.body.gstEnabled !== false,
        lines,
        grandTotal,
        notes: req.body.notes,
        validUntil: req.body.validUntil ? new Date(req.body.validUntil) : undefined,
        status: ESTIMATE_STATUSES.includes(req.body.status) ? req.body.status : 'draft',
        estimateDate: req.body.estimateDate ? new Date(req.body.estimateDate) : new Date()
      }));
      res.json({ success: true, estimate: doc });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/estimates/:id', authenticateToken, biz, canWrite, async (req, res) => {
    try {
      const doc = await Estimate.findOne(uidFilter(req, { _id: req.params.id }));
      if (!doc) return res.status(404).json({ error: 'Estimate not found.' });
      if (doc.status === 'converted') {
        return res.status(400).json({ error: 'Converted estimates cannot be edited.' });
      }

      if (req.body.lines) {
        const lines = normalizeLines(req.body.lines);
        if (!lines.length) return res.status(400).json({ error: 'At least one line item required.' });
        doc.lines = lines;
        doc.grandTotal = sumGrandTotal(lines);
      }
      if (req.body.customer !== undefined) {
        const customer = String(req.body.customer || '').trim();
        if (!customer) return res.status(400).json({ error: 'Customer name is required.' });
        doc.customer = customer;
      }
      ['customerGstin', 'customerAddress', 'customerState', 'customerPincode', 'projectName', 'notes', 'paymentType'].forEach((k) => {
        if (req.body[k] !== undefined) doc[k] = req.body[k];
      });
      if (req.body.gstEnabled !== undefined) doc.gstEnabled = !!req.body.gstEnabled;
      if (req.body.validUntil !== undefined) doc.validUntil = req.body.validUntil ? new Date(req.body.validUntil) : null;
      if (req.body.estimateDate) doc.estimateDate = new Date(req.body.estimateDate);
      if (req.body.status && ESTIMATE_STATUSES.includes(req.body.status) && req.body.status !== 'converted') {
        doc.status = req.body.status;
      }

      await doc.save();
      res.json({ success: true, estimate: doc });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/estimates/:id', authenticateToken, biz, canWrite, async (req, res) => {
    try {
      const doc = await Estimate.findOne(uidFilter(req, { _id: req.params.id }));
      if (!doc) return res.status(404).json({ error: 'Estimate not found.' });
      if (doc.status === 'converted') {
        return res.status(400).json({ error: 'Delete the invoice from Modification if needed — estimate is already invoiced.' });
      }
      await Estimate.deleteOne({ _id: doc._id });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/estimates/:id/mark-sent', authenticateToken, biz, canWrite, async (req, res) => {
    try {
      const doc = await Estimate.findOne(uidFilter(req, { _id: req.params.id }));
      if (!doc) return res.status(404).json({ error: 'Estimate not found.' });
      if (doc.status === 'converted') return res.status(400).json({ error: 'Already converted to invoice.' });
      doc.status = 'sent';
      await doc.save();
      res.json({ success: true, estimate: doc });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/estimates/:id/accept', authenticateToken, biz, canWrite, async (req, res) => {
    try {
      const doc = await Estimate.findOne(uidFilter(req, { _id: req.params.id }));
      if (!doc) return res.status(404).json({ error: 'Estimate not found.' });
      if (doc.status === 'converted') return res.status(400).json({ error: 'Already converted to invoice.' });
      doc.status = 'accepted';
      await doc.save();
      res.json({ success: true, estimate: doc });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/estimates/:id/convert-to-invoice', authenticateToken, biz, canWrite, async (req, res) => {
    try {
      const doc = await Estimate.findOne(uidFilter(req, { _id: req.params.id }));
      if (!doc) return res.status(404).json({ error: 'Estimate not found.' });

      if (doc.status === 'converted' && doc.linkedInvoiceNo) {
        return res.json({
          success: true,
          alreadyConverted: true,
          invoiceNo: doc.linkedInvoiceNo,
          estimate: doc
        });
      }

      if (!doc.lines?.length) return res.status(400).json({ error: 'Estimate has no line items.' });

      const invoiceNo = await nextInvoiceNo(req.dataUserId);
      const payType = doc.paymentType || 'Cash';
      const isCredit = payType === 'Credit';
      const voucherDate = req.body.voucherDate || doc.estimateDate || new Date();

      const salesRecords = [];
      for (const line of doc.lines) {
        const totalAmount = line.lineTotal || lineTotal(line);
        const record = await SalesHistory.create(uidDoc(req, {
          invoiceNo,
          customer: doc.customer,
          product: line.product,
          hsn: line.hsn,
          qty: line.qty || 1,
          price: line.price || 0,
          gstRate: doc.gstEnabled ? (line.gstRate || 0) : 0,
          totalAmount,
          paymentType: payType,
          status: isCredit ? 'Pending' : 'Paid',
          date: new Date(voucherDate)
        }));
        salesRecords.push(record);
      }

      doc.status = 'converted';
      doc.linkedInvoiceNo = invoiceNo;
      doc.convertedAt = new Date();
      await doc.save();

      res.json({
        success: true,
        invoiceNo,
        salesRecords,
        estimate: doc
      });
    } catch (e) {
      res.status(500).json({ error: e.message || 'Could not convert to invoice.' });
    }
  });

  return { Estimate };
}

module.exports = { setupEstimateFeatures, ESTIMATE_STATUSES };
