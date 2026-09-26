/**
 * Accounts Orbit — password reset emails
 * Production (Render free): SMTP ports 25/465/587 BLOCKED — use Resend or Brevo (HTTPS).
 * Local / paid Render: Gmail SMTP still works.
 */
const logger = require('./logger');

function normalizeSmtpPass(pass) {
  return String(pass || '').replace(/\s+/g, '');
}

function isRenderHost() {
  return !!(process.env.RENDER || process.env.RENDER_EXTERNAL_URL);
}

function getSmtpConfig() {
  const host = String(process.env.SMTP_HOST || '').trim();
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = normalizeSmtpPass(process.env.SMTP_PASS);
  if (!host || !user || !pass) return null;

  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const isGmail = /gmail\.com$/i.test(host) || /@gmail\.com$/i.test(user);

  const transport = {
    host,
    port,
    secure,
    auth: { user, pass }
  };

  if (isGmail) {
    transport.host = 'smtp.gmail.com';
    transport.port = secure ? 465 : 587;
    transport.secure = secure;
    transport.requireTLS = !secure;
    transport.tls = { minVersion: 'TLSv1.2', rejectUnauthorized: true };
  } else if (!secure && port === 587) {
    transport.requireTLS = true;
  }

  const fromName = /bolkarigar/i.test(String(process.env.SMTP_FROM_NAME || ''))
    ? 'Accounts Orbit'
    : (process.env.SMTP_FROM_NAME || 'Accounts Orbit');
  let from = String(process.env.SMTP_FROM || '').trim();
  if (!from || (isGmail && !from.includes(user))) {
    from = `"${fromName}" <${user}>`;
  }

  return { transport, from, user, isGmail };
}

function isWrongBrevoSmtpKey() {
  const key = String(process.env.BREVO_API_KEY || '').trim();
  return key.startsWith('xsmtpsib');
}

function getBrevoApiKey() {
  const key = String(process.env.BREVO_API_KEY || '').trim();
  if (!key) return '';
  if (isWrongBrevoSmtpKey()) {
    logger.error('[Email] BREVO_API_KEY galat hai — aapne SMTP key (xsmtpsib) daali hai. Brevo → SMTP & API → API keys se xkeysib- wali key use karein.');
    return '';
  }
  return key;
}

function isEmailConfigured() {
  return hasHttpsEmailProvider() || !!getSmtpConfig();
}

function hasHttpsEmailProvider() {
  return !!(
    String(process.env.RESEND_API_KEY || '').trim()
    || getBrevoApiKey()
  );
}

const SMTP_SEND_TIMEOUT_MS = Number(process.env.SMTP_SEND_TIMEOUT_MS) || 35000;

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    })
  ]).finally(() => clearTimeout(timer));
}

function buildSmtpTransports() {
  const cfg = getSmtpConfig();
  if (!cfg) return [];
  const nodemailer = require('nodemailer');

  const gmailService = cfg.isGmail
    ? [{
      transporter: nodemailer.createTransport({
        service: 'gmail',
        auth: cfg.transport.auth,
        pool: false,
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
        family: 4
      }),
      from: cfg.from,
      label: 'gmail-service'
    }]
    : [];

  const port465 = cfg.isGmail ? [{
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: cfg.transport.auth,
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    pool: false,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    family: 4
  }] : [];

  const portConfigured = [{ ...cfg.transport, pool: false, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 20000, family: 4 }];

  const ordered = isRenderHost()
    ? [...gmailService, ...port465, ...portConfigured]
    : [...portConfigured, ...port465, ...gmailService];

  const seen = new Set();
  const unique = [];
  for (const t of ordered) {
    const key = `${t.host || t.service}:${t.port || 'svc'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(t);
  }

  return unique.map((t) => ({
    transporter: t.transporter || nodemailer.createTransport(t),
    from: cfg.from,
    label: t.label || `smtp:${t.port || 'gmail'}`
  }));
}

function createMailTransporter() {
  const list = buildSmtpTransports();
  return list[0] || null;
}

async function verifyEmailTransport() {
  if (!isEmailConfigured()) {
    logger.warn('[Email] No email provider configured — forgot-password will fail.');
    return { ok: false, provider: null, error: 'not_configured' };
  }

  if (process.env.RESEND_API_KEY) {
    logger.info('[Email] Resend API ready (HTTPS — works on Render free).');
    return { ok: true, provider: 'resend' };
  }

  if (isWrongBrevoSmtpKey()) {
    return {
      ok: false,
      provider: 'brevo',
      error: 'wrong_brevo_smtp_key',
      hint: 'BREVO_API_KEY me SMTP key (xsmtpsib) hai. API key (xkeysib) use karein — Brevo → SMTP & API → API keys.'
    };
  }

  if (getBrevoApiKey()) {
    try {
      const fetch = require('node-fetch');
      const res = await fetch('https://api.brevo.com/v3/account', {
        headers: { 'api-key': getBrevoApiKey(), Accept: 'application/json' }
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        logger.error('[Email] Brevo API key invalid:', body);
        return {
          ok: false,
          provider: 'brevo',
          error: 'invalid_brevo_api_key',
          hint: 'Use API key starting with xkeysib- (not xsmtpsib- SMTP key).'
        };
      }
      logger.info('[Email] Brevo API ready (HTTPS — works on Render free).');
      return { ok: true, provider: 'brevo' };
    } catch (err) {
      return { ok: false, provider: 'brevo', error: err.message };
    }
  }

  if (isRenderHost()) {
    logger.error('[Email] Render blocks SMTP on free plan. Add BREVO_API_KEY or RESEND_API_KEY in Render Environment.');
    return {
      ok: false,
      provider: 'smtp',
      error: 'render_smtp_blocked',
      hint: 'Add BREVO_API_KEY (free) or RESEND_API_KEY on Render — Gmail SMTP ports are blocked.'
    };
  }

  const transports = buildSmtpTransports();
  let lastErr = null;
  for (const mail of transports) {
    try {
      await mail.transporter.verify();
      logger.info(`[Email] SMTP ready (${mail.label}).`);
      return { ok: true, provider: 'smtp' };
    } catch (err) {
      lastErr = err;
      logger.warn(`[Email] SMTP verify failed (${mail.label}):`, err.message);
    }
  }
  return { ok: false, provider: 'smtp', error: lastErr?.message || 'verify_failed' };
}

async function sendViaSmtp({ to, subject, text, html, replyTo }) {
  if (isRenderHost() && !process.env.ALLOW_RENDER_SMTP) {
    throw new Error('Render free plan blocks SMTP ports 465/587. Add BREVO_API_KEY or RESEND_API_KEY.');
  }

  const transports = buildSmtpTransports();
  if (!transports.length) throw new Error('SMTP is not configured.');

  let lastErr = null;
  for (const mail of transports) {
    try {
      await withTimeout(
        mail.transporter.sendMail({
          from: mail.from,
          to,
          subject,
          replyTo: replyTo && String(replyTo).includes('@') ? replyTo : undefined,
          text,
          html: html || undefined
        }),
        SMTP_SEND_TIMEOUT_MS,
        `SMTP send (${mail.label})`
      );
      return;
    } catch (err) {
      lastErr = err;
      logger.warn(`[Email] Send failed (${mail.label}):`, err.message);
    }
  }
  throw lastErr || new Error('SMTP send failed on all transports.');
}

async function sendViaResend({ to, subject, text, html, replyTo }) {
  const fetch = require('node-fetch');
  const from = process.env.RESEND_FROM || 'Accounts Orbit <onboarding@resend.dev>';
  const body = {
    from,
    to: [to],
    subject,
    text,
    html: html || undefined
  };
  if (replyTo && String(replyTo).includes('@')) body.reply_to = String(replyTo).trim();
  const res = await withTimeout(fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  }), 20000, 'Resend API');
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

async function sendViaBrevo({ to, subject, text, html, replyTo, senderName, senderEmail }) {
  const apiKey = getBrevoApiKey();
  if (!apiKey) {
    throw new Error('BREVO_API_KEY galat hai — SMTP key (xsmtpsib) mat use karein. API key (xkeysib) chahiye.');
  }

  const fromEmail = String(senderEmail || process.env.BREVO_FROM_EMAIL || process.env.SMTP_USER || '').trim().toLowerCase();
  const envFrom = String(process.env.SMTP_FROM_NAME || '');
  const fromName = senderName && !/bolkarigar/i.test(senderName)
    ? senderName
    : (/bolkarigar/i.test(envFrom) ? 'Accounts Orbit' : (envFrom || 'Accounts Orbit'));
  if (!fromEmail) throw new Error('Set BREVO_FROM_EMAIL or SMTP_USER');

  const payload = {
    sender: { name: fromName, email: fromEmail },
    to: [{ email: to }],
    subject,
    textContent: text,
    htmlContent: html || undefined
  };
  if (replyTo && String(replyTo).includes('@')) {
    payload.replyTo = { email: String(replyTo).trim().toLowerCase(), name: fromName };
  }

  const fetch = require('node-fetch');
  const res = await withTimeout(fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(payload)
  }), 20000, 'Brevo API');

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Brevo API error ${res.status}: ${body}`);
  }
  const okBody = await res.json().catch(() => ({}));
  return { messageId: okBody.messageId || '' };
}

/** Sender address Brevo/Resend use karega — diagnostics ke liye. */
function getBusinessSenderEmail() {
  if (getBrevoApiKey()) {
    return String(process.env.BREVO_FROM_EMAIL || process.env.SMTP_USER || '').trim().toLowerCase();
  }
  if (process.env.RESEND_API_KEY) {
    const from = String(process.env.RESEND_FROM || 'onboarding@resend.dev');
    const m = from.match(/<([^>]+)>/);
    return (m ? m[1] : from).trim().toLowerCase();
  }
  return String(process.env.SMTP_USER || '').trim().toLowerCase();
}

function buildOtpEmail(otp) {
  const subject = 'Accounts Orbit — Password Reset OTP';
  const text = [
    'Namaste,',
    '',
    `Aapka password reset OTP hai: ${otp}`,
    '',
    'Yeh OTP 10 minute ke liye valid hai.',
    'Agar aapne yeh request nahi ki, is email ko ignore karein.',
    '',
    '— Accounts Orbit Team'
  ].join('\n');
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#2563eb;margin:0 0 12px;">Accounts Orbit Password Reset</h2>
      <p style="color:#334155;line-height:1.5;">Aapka 6-digit OTP:</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#0f172a;margin:16px 0;">${otp}</p>
      <p style="color:#64748b;font-size:14px;">Yeh OTP <strong>10 minute</strong> ke liye valid hai.</p>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;">Agar aapne request nahi ki, is email ko ignore karein.</p>
    </div>`;
  return { subject, text, html };
}

function wrapBusinessEmailHtml({ shopName, bodyHtml, footerLine }) {
  const shop = shopName || 'Accounts Orbit';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
    <tr><td style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:20px 24px;color:#fff;">
      <div style="font-size:18px;font-weight:700;">${shop}</div>
      <div style="font-size:12px;opacity:.9;margin-top:4px;">Business communication</div>
    </td></tr>
    <tr><td style="padding:24px;color:#0f172a;font-size:15px;line-height:1.55;">${bodyHtml}</td></tr>
    <tr><td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
      ${footerLine || 'Sent via Accounts Orbit Business Mail. Please reply to this email for a direct response.'}
    </td></tr>
  </table></body></html>`;
}

async function sendBusinessEmail({ to, subject, text, html, replyTo, senderName, bcc }) {
  const errors = [];
  const htmlBody = html || (text ? `<p style="white-space:pre-wrap">${String(text).replace(/</g, '&lt;')}</p>` : '');
  const payload = { to, subject, text: text || htmlBody.replace(/<[^>]+>/g, ' '), html: htmlBody, replyTo };

  if (getBrevoApiKey()) {
    try {
      const out = await sendViaBrevo({ ...payload, senderName });
      return { sent: true, provider: 'brevo', messageId: out?.messageId || '' };
    } catch (err) {
      errors.push(`Brevo: ${err.message}`);
    }
  }
  if (process.env.RESEND_API_KEY) {
    try {
      await sendViaResend(payload);
      return { sent: true, provider: 'resend' };
    } catch (err) {
      errors.push(`Resend: ${err.message}`);
    }
  }
  if (getSmtpConfig()) {
    try {
      await sendViaSmtp(payload);
      return { sent: true, provider: 'smtp' };
    } catch (err) {
      errors.push(`SMTP: ${err.message}`);
    }
  }
  return { sent: false, provider: null, error: errors.join(' | ') || 'Email not configured on server.' };
}

function buildCompanyDeleteOtpEmail(otp, companyName) {
  const name = companyName || 'this company';
  const subject = 'Accounts Orbit — Company delete OTP';
  const text = [
    'Hello,',
    '',
    `Your 6-digit OTP to delete "${name}": ${otp}`,
    '',
    'If you delete this company, all of its data will be permanently removed.',
    'This OTP is valid for 10 minutes.',
    'If you did not request this, ignore this email.',
    '',
    '— Accounts Orbit Team'
  ].join('\n');
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#b91c1c;margin:0 0 12px;">Company delete confirmation</h2>
      <p style="color:#334155;line-height:1.5;">6-digit OTP to delete <strong>${name}</strong>:</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#0f172a;margin:16px 0;">${otp}</p>
      <p style="color:#b91c1c;font-size:14px;">All data for this company will be permanently deleted.</p>
      <p style="color:#64748b;font-size:14px;">This OTP is valid for <strong>10 minutes</strong>.</p>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;">If you did not request this, ignore this email.</p>
    </div>`;
  return { subject, text, html };
}

async function sendOtpMail(email, { subject, text, html }, logLabel) {
  const errors = [];

  if (isWrongBrevoSmtpKey()) {
    return {
      sent: false,
      provider: 'brevo',
      error: 'BREVO_API_KEY galat hai — SMTP key (xsmtpsib) mat use karo. API key (xkeysib) lagao.'
    };
  }

  if (getBrevoApiKey()) {
    try {
      await sendViaBrevo({ to: email, subject, text, html });
      logger.info(`[${logLabel}] OTP sent to ${email} via Brevo`);
      return { sent: true, provider: 'brevo' };
    } catch (err) {
      errors.push(`Brevo: ${err.message}`);
      logger.error(`[${logLabel}] Brevo failed:`, err.message);
    }
  }

  if (process.env.RESEND_API_KEY) {
    try {
      await sendViaResend({ to: email, subject, text, html });
      logger.info(`[${logLabel}] OTP sent to ${email} via Resend`);
      return { sent: true, provider: 'resend' };
    } catch (err) {
      errors.push(`Resend: ${err.message}`);
      logger.error(`[${logLabel}] Resend failed:`, err.message);
    }
  }

  if (getSmtpConfig()) {
    try {
      await sendViaSmtp({ to: email, subject, text, html });
      logger.info(`[${logLabel}] OTP sent to ${email} via SMTP`);
      return { sent: true, provider: 'smtp' };
    } catch (err) {
      errors.push(`SMTP: ${err.message}`);
      logger.error(`[${logLabel}] SMTP failed:`, err.message);
    }
  }

  const renderHint = isRenderHost()
    ? ' Render FREE plan par Gmail SMTP band hai — Render Environment me BREVO_API_KEY add karein (free, 300 email/day).'
    : '';
  if (process.env.NODE_ENV !== 'production') {
    logger.warn(`[${logLabel} OTP] ${email} (email failed — dev only log)`);
  } else {
    logger.error(`[${logLabel} OTP] Email delivery failed for ${email}`);
  }
  return { sent: false, provider: null, error: (errors.join(' | ') || 'not_configured') + renderHint };
}

async function sendPasswordResetOtp(email, otp) {
  const { subject, text, html } = buildOtpEmail(otp);
  return sendOtpMail(email, { subject, text, html }, 'Password Reset');
}

async function sendCompanyDeleteOtp(email, otp, companyName) {
  const { subject, text, html } = buildCompanyDeleteOtpEmail(otp, companyName);
  return sendOtpMail(email, { subject, text, html }, 'Company Delete');
}

function buildSignupOtpEmail(otp) {
  const subject = 'Accounts Orbit — Verify your email';
  const text = [
    'Hello,',
    '',
    `Your 6-digit OTP to create your Accounts Orbit account: ${otp}`,
    '',
    'This OTP is valid for 10 minutes.',
    'If you did not request this, ignore this email.',
    '',
    '— Accounts Orbit Team'
  ].join('\n');
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#1e3a5f;margin:0 0 12px;">Verify your email</h2>
      <p style="color:#334155;line-height:1.5;">Enter this 6-digit OTP to create your Accounts Orbit account:</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#0f172a;margin:16px 0;">${otp}</p>
      <p style="color:#64748b;font-size:14px;">This OTP is valid for <strong>10 minutes</strong>.</p>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;">If you did not request this, ignore this email.</p>
    </div>`;
  return { subject, text, html };
}

async function sendSignupOtp(email, otp) {
  const { subject, text, html } = buildSignupOtpEmail(otp);
  return sendOtpMail(email, { subject, text, html }, 'Signup');
}

module.exports = {
  isEmailConfigured,
  hasHttpsEmailProvider,
  isWrongBrevoSmtpKey,
  isRenderHost,
  verifyEmailTransport,
  createMailTransporter,
  sendPasswordResetOtp,
  sendCompanyDeleteOtp,
  sendSignupOtp,
  sendBusinessEmail,
  wrapBusinessEmailHtml,
  getBusinessSenderEmail
};
