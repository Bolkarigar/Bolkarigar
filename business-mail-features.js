/**
 * Accounts Orbit Business Mail — send + inbox (Business ₹299 plan)
 */
const crypto = require('crypto');
const {
  sendBusinessEmail,
  wrapBusinessEmailHtml,
  isEmailConfigured,
  getBusinessSenderEmail
} = require('./email-service');
const {
  encryptSecret,
  decryptSecret,
  envFallbackFor,
  fetchMailboxEmails,
  cleanStoredEmailBody,
  normalizeImapHost
} = require('./mail-inbox-sync');

const MAIL_TEMPLATES = {
  payment_reminder: {
    subject: (ctx) => `Payment reminder — ${ctx.shopName}`,
    text: (ctx) =>
      `Dear ${ctx.partyName || 'Customer'},\n\n`
      + `This is a friendly reminder regarding your pending balance${ctx.amount ? ` of ${ctx.amount}` : ''}.\n\n`
      + `Please arrange payment at your earliest convenience. If already paid, kindly ignore this message.\n\n`
      + `Thank you,\n${ctx.shopName}\n${ctx.shopPhone || ''}`.trim()
  },
  invoice_sent: {
    subject: (ctx) => `Invoice from ${ctx.shopName}`,
    text: (ctx) =>
      `Dear ${ctx.partyName || 'Customer'},\n\n`
      + `Please find details of your recent purchase${ctx.invoiceNo ? ` (Invoice ${ctx.invoiceNo})` : ''}.\n\n`
      + `${ctx.customNote || 'Thank you for your business.'}\n\n`
      + `${ctx.shopName}\n${ctx.shopPhone || ''}`.trim()
  },
  quotation: {
    subject: (ctx) => `Quotation / Estimate — ${ctx.shopName}`,
    text: (ctx) =>
      `Dear ${ctx.partyName || 'Customer'},\n\n`
      + `Thank you for your interest. Please review our quotation${ctx.refNo ? ` (${ctx.refNo})` : ''}.\n\n`
      + `${ctx.customNote || 'We look forward to working with you.'}\n\n`
      + `${ctx.shopName}`.trim()
  },
  thank_you: {
    subject: (ctx) => `Thank you — ${ctx.shopName}`,
    text: (ctx) =>
      `Dear ${ctx.partyName || 'Customer'},\n\n`
      + `Thank you for choosing ${ctx.shopName}. We appreciate your trust and look forward to serving you again.\n\n`
      + `Best regards,\n${ctx.shopName}`.trim()
  },
  custom: {
    subject: (ctx) => ctx.subject || `Message from ${ctx.shopName}`,
    text: (ctx) => ctx.body || ''
  }
};

function setupBusinessMailFeatures({ app, mongoose, authenticateToken, requireBusinessPlan, models }) {
  const { BusinessProfile, User } = models;
  const biz = requireBusinessPlan || ((req, res, next) => next());

  const mailSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    threadId: { type: String, index: true },
    direction: { type: String, enum: ['outbound', 'inbound'], required: true },
    from: String,
    to: String,
    partyName: String,
    subject: String,
    bodyText: String,
    bodyHtml: String,
    templateId: String,
    status: { type: String, enum: ['sent', 'failed', 'received', 'logged'], default: 'sent' },
    provider: String,
    providerMessageId: String,
    error: String,
    createdAt: { type: Date, default: Date.now, index: true }
  });

  const BusinessMail = mongoose.models.BusinessMail || mongoose.model('BusinessMail', mailSchema);

  async function shopContext(userId) {
    const [profile, user] = await Promise.all([
      BusinessProfile.findOne({ userId }),
      User.findById(userId).select('email username')
    ]);
    const shopName = profile?.companyName || 'Your Business';
    const replyEmail = (profile?.businessEmail || user?.email || '').trim().toLowerCase();
    return {
      shopName,
      shopPhone: profile?.phone || '',
      shopAddress: profile?.fullAddress || '',
      replyEmail,
      gstin: profile?.gstin || ''
    };
  }

  app.get('/api/business-mail/status', authenticateToken, biz, async (req, res) => {
    try {
      const ctx = await shopContext(req.dataUserId);
      const senderEmail = getBusinessSenderEmail();
      // Free mailbox domains (gmail/yahoo/outlook) as sender fail DMARC when relayed
      // through Brevo — inbox providers then drop or spam-folder the mail.
      const freeSenderDomain = /@(gmail|googlemail|yahoo|outlook|hotmail|live|rediffmail)\./i.test(senderEmail);
      const profile = await BusinessProfile.findOne({ userId: req.dataUserId }).select('imapPassEnc imapHost imapLastSyncAt');
      const envFb = envFallbackFor(ctx.replyEmail);
      res.json({
        success: true,
        emailConfigured: isEmailConfigured(),
        replyEmail: ctx.replyEmail,
        shopName: ctx.shopName,
        senderEmail,
        freeSenderDomain,
        imapConnected: !!(profile?.imapPassEnc || envFb),
        imapHost: profile?.imapHost || envFb?.host || '',
        imapLastSyncAt: profile?.imapLastSyncAt || null,
        templates: Object.keys(MAIL_TEMPLATES)
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/business-mail/settings', authenticateToken, biz, async (req, res) => {
    try {
      const businessEmail = String(req.body.businessEmail || '').trim().toLowerCase();
      if (businessEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(businessEmail)) {
        return res.status(400).json({ error: 'Enter a valid business email address.' });
      }
      const existing = await BusinessProfile.findOne({ userId: req.dataUserId });
      const $set = { businessEmail: businessEmail || undefined };
      const imapPass = String(req.body.imapPass || req.body.imapPassword || '').trim();
      const imapHost = String(req.body.imapHost || '').trim();
      const prevDomain = String(existing?.businessEmail || '').split('@')[1] || '';
      const nextDomain = String(businessEmail || '').split('@')[1] || '';
      if (businessEmail && prevDomain && nextDomain && prevDomain !== nextDomain) {
        $set.imapPassEnc = '';
        $set.imapHost = normalizeImapHost(businessEmail, imapHost);
        $set.imapLastSyncAt = null;
      } else if (imapHost || businessEmail) {
        $set.imapHost = normalizeImapHost(businessEmail || existing?.businessEmail || '', imapHost);
      }
      if (req.body.disconnectImap) {
        $set.imapPassEnc = '';
        $set.imapHost = '';
        $set.imapLastSyncAt = null;
      } else if (imapPass) {
        $set.imapPassEnc = encryptSecret(imapPass);
      }
      const profile = await BusinessProfile.findOneAndUpdate(
        { userId: req.dataUserId },
        { $set },
        { new: true, upsert: true }
      );
      res.json({
        success: true,
        businessEmail: profile.businessEmail || '',
        imapConnected: !!profile.imapPassEnc
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/business-mail/messages', authenticateToken, biz, async (req, res) => {
    try {
      const folder = String(req.query.folder || 'all');
      const q = { userId: req.dataUserId };
      if (folder === 'sent') q.direction = 'outbound';
      if (folder === 'inbox') q.direction = 'inbound';
      const limit = Math.min(parseInt(req.query.limit, 10) || 80, 200);
      const rows = await BusinessMail.find(q).sort({ createdAt: -1 }).limit(limit);
      res.json({
        success: true,
        messages: rows.map((m) => {
          const o = m.toObject();
          o.bodyText = cleanStoredEmailBody(o.bodyText, o.bodyHtml);
          return o;
        })
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/business-mail/send', authenticateToken, biz, async (req, res) => {
    try {
      if (!isEmailConfigured()) {
        return res.status(503).json({
          error: 'Server email is not configured. Add BREVO_API_KEY on Render (same as forgot-password OTP).'
        });
      }
      const to = String(req.body.to || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        return res.status(400).json({ error: 'Valid recipient email is required.' });
      }
      const ctx = await shopContext(req.dataUserId);
      const templateId = String(req.body.templateId || 'custom');
      const tpl = MAIL_TEMPLATES[templateId] || MAIL_TEMPLATES.custom;
      const partyName = String(req.body.partyName || '').trim();
      const customBody = String(req.body.body || req.body.message || '').trim();
      const customSubject = String(req.body.subject || '').trim();
      const amount = String(req.body.amount || '').trim();
      const invoiceNo = String(req.body.invoiceNo || '').trim();

      const mergeCtx = {
        ...ctx,
        partyName,
        amount,
        invoiceNo,
        refNo: req.body.refNo || '',
        customNote: customBody,
        subject: customSubject,
        body: customBody
      };
      const subject = customSubject || tpl.subject(mergeCtx);
      const text = customBody || tpl.text(mergeCtx);
      const bodyHtml = `<p style="white-space:pre-wrap;margin:0 0 12px;">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`
        + (ctx.shopPhone ? `<p style="margin:12px 0 0;font-size:13px;color:#475569;"><strong>Phone:</strong> ${ctx.shopPhone}</p>` : '')
        + (ctx.shopAddress ? `<p style="margin:4px 0 0;font-size:13px;color:#475569;"><strong>Address:</strong> ${ctx.shopAddress}</p>` : '');
      const html = wrapBusinessEmailHtml({
        shopName: ctx.shopName,
        bodyHtml,
        footerLine: ctx.replyEmail
          ? `Replies go to ${ctx.replyEmail}. You can also log customer replies inside Accounts Orbit → Business Mail → Inbox.`
          : undefined
      });

      const threadId = req.body.threadId || crypto.randomUUID();
      const result = await sendBusinessEmail({
        to,
        subject,
        text,
        html,
        replyTo: ctx.replyEmail || undefined,
        senderName: ctx.shopName
      });

      const doc = await BusinessMail.create({
        userId: req.dataUserId,
        threadId,
        direction: 'outbound',
        from: ctx.replyEmail || process.env.BREVO_FROM_EMAIL || 'Accounts Orbit',
        to,
        partyName,
        subject,
        bodyText: text,
        bodyHtml: html,
        templateId,
        status: result.sent ? 'sent' : 'failed',
        provider: result.provider,
        providerMessageId: result.messageId || '',
        error: result.error || ''
      });

      if (!result.sent) {
        return res.status(502).json({ success: false, error: result.error || 'Send failed', message: doc });
      }
      res.json({
        success: true,
        message: doc,
        provider: result.provider,
        messageId: result.messageId || ''
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  function resolveImapAuth(profile, replyEmail, overridePass) {
    const email = String(replyEmail || '').trim().toLowerCase();
    if (!email) return null;
    if (overridePass) {
      return {
        email,
        pass: overridePass,
        host: profile?.imapHost || '',
        port: profile?.imapPort || 993
      };
    }
    if (profile?.imapPassEnc) {
      return {
        email,
        pass: decryptSecret(profile.imapPassEnc),
        host: profile.imapHost || '',
        port: profile.imapPort || 993
      };
    }
    const envFb = envFallbackFor(email);
    if (envFb?.pass) {
      return { email, pass: envFb.pass, host: envFb.host || '', port: envFb.port || 993 };
    }
    return null;
  }

  async function upsertSyncedMessages(userId, rows) {
    let added = 0;
    for (const row of rows) {
      const existing = await BusinessMail.findOne({
        userId,
        $or: [
          { providerMessageId: row.providerMessageId },
          ...(row.messageId ? [{ providerMessageId: row.messageId }] : [])
        ]
      });
      if (existing) {
        const nextText = row.bodyText || existing.bodyText;
        const nextHtml = row.bodyHtml || existing.bodyHtml;
        if (
          (nextText && nextText !== existing.bodyText)
          || (nextHtml && nextHtml !== existing.bodyHtml)
          || (row.subject && row.subject !== existing.subject)
        ) {
          existing.bodyText = nextText;
          if (nextHtml) existing.bodyHtml = nextHtml;
          if (row.subject) existing.subject = row.subject;
          await existing.save();
        }
        continue;
      }
      await BusinessMail.create({
        userId,
        threadId: row.messageId || crypto.randomUUID(),
        direction: row.folderHint === 'outbound' ? 'outbound' : 'inbound',
        from: row.from,
        to: row.to,
        partyName: '',
        subject: row.subject,
        bodyText: row.bodyText,
        bodyHtml: row.bodyHtml || '',
        status: row.folderHint === 'outbound' ? 'sent' : 'received',
        provider: 'imap',
        providerMessageId: row.providerMessageId,
        createdAt: row.date || new Date()
      });
      added += 1;
    }
    return added;
  }

  app.post('/api/business-mail/sync-inbox', authenticateToken, biz, async (req, res) => {
    try {
      const ctx = await shopContext(req.dataUserId);
      if (!ctx.replyEmail) {
        return res.status(400).json({ error: 'Pehle Reply-to email save karo — usi mailbox ki mails Inbox mein aayengi.' });
      }
      const profile = await BusinessProfile.findOne({ userId: req.dataUserId });
      const overridePass = String(req.body.imapPass || req.body.imapPassword || '').trim();
      const auth = resolveImapAuth(profile, ctx.replyEmail, overridePass);
      if (!auth) {
        return res.status(400).json({
          error: 'Inbox connect nahi hai. Selected email ka mailbox password (ya Gmail App Password) daal ke Connect Inbox dabao.'
        });
      }
      const fetched = await fetchMailboxEmails({
        email: auth.email,
        pass: auth.pass,
        host: normalizeImapHost(auth.email, String(req.body.imapHost || auth.host || '').trim()),
        port: auth.port,
        limit: 40
      });
      if (overridePass) {
        await BusinessProfile.findOneAndUpdate(
          { userId: req.dataUserId },
          {
            $set: {
              imapPassEnc: encryptSecret(overridePass),
              imapHost: fetched.host,
              imapPort: fetched.port,
              imapLastSyncAt: new Date()
            }
          },
          { upsert: true }
        );
      } else {
        await BusinessProfile.findOneAndUpdate(
          { userId: req.dataUserId },
          { $set: { imapHost: fetched.host, imapPort: fetched.port, imapLastSyncAt: new Date() } }
        );
      }
      const added = await upsertSyncedMessages(req.dataUserId, fetched.messages);
      const rows = await BusinessMail.find({ userId: req.dataUserId }).sort({ createdAt: -1 }).limit(100);
      res.json({
        success: true,
        added,
        pulled: fetched.messages.length,
        imapHost: fetched.host,
        messages: rows.map((m) => {
          const o = m.toObject();
          o.bodyText = cleanStoredEmailBody(o.bodyText, o.bodyHtml);
          return o;
        })
      });
    } catch (e) {
      res.status(502).json({ error: e.message || 'Inbox sync failed' });
    }
  });

  app.delete('/api/business-mail/messages/:id', authenticateToken, biz, async (req, res) => {
    try {
      const doc = await BusinessMail.findOneAndDelete({
        _id: req.params.id,
        userId: req.dataUserId
      });
      if (!doc) return res.status(404).json({ error: 'Message not found.' });
      res.json({ success: true, deletedId: String(doc._id) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/business-mail/log-inbound', authenticateToken, biz, async (req, res) => {
    try {
      const from = String(req.body.from || '').trim();
      const subject = String(req.body.subject || '').trim() || '(No subject)';
      const body = String(req.body.body || '').trim();
      if (!from || !body) {
        return res.status(400).json({ error: 'Sender email and message text are required.' });
      }
      const ctx = await shopContext(req.dataUserId);
      const doc = await BusinessMail.create({
        userId: req.dataUserId,
        threadId: req.body.threadId || crypto.randomUUID(),
        direction: 'inbound',
        from,
        to: ctx.replyEmail || '',
        partyName: String(req.body.partyName || '').trim(),
        subject,
        bodyText: body,
        status: 'logged'
      });
      res.json({ success: true, message: doc });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return { BusinessMail };
}

module.exports = { setupBusinessMailFeatures, MAIL_TEMPLATES };
