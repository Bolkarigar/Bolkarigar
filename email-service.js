/**
 * BolKarigar — password reset emails
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

  const fromName = process.env.SMTP_FROM_NAME || 'BolKarigar';
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

async function sendViaSmtp({ to, subject, text, html }) {
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

async function sendViaResend({ to, subject, text, html }) {
  const fetch = require('node-fetch');
  const from = process.env.RESEND_FROM || 'BolKarigar <onboarding@resend.dev>';
  const res = await withTimeout(fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      html: html || undefined
    })
  }), 20000, 'Resend API');
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

async function sendViaBrevo({ to, subject, text, html }) {
  const apiKey = getBrevoApiKey();
  if (!apiKey) {
    throw new Error('BREVO_API_KEY galat hai — SMTP key (xsmtpsib) mat use karein. API key (xkeysib) chahiye.');
  }

  const fromEmail = String(
    process.env.BREVO_FROM_EMAIL || process.env.SMTP_USER || ''
  ).trim().toLowerCase();
  const fromName = process.env.SMTP_FROM_NAME || 'BolKarigar';
  if (!fromEmail) throw new Error('Set BREVO_FROM_EMAIL or SMTP_USER');

  const fetch = require('node-fetch');
  const res = await withTimeout(fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      sender: { name: fromName, email: fromEmail },
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html || undefined
    })
  }), 20000, 'Brevo API');

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Brevo API error ${res.status}: ${body}`);
  }
}

function buildOtpEmail(otp) {
  const subject = 'BolKarigar — Password Reset OTP';
  const text = [
    'Namaste,',
    '',
    `Aapka password reset OTP hai: ${otp}`,
    '',
    'Yeh OTP 10 minute ke liye valid hai.',
    'Agar aapne yeh request nahi ki, is email ko ignore karein.',
    '',
    '— BolKarigar Team'
  ].join('\n');
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#2563eb;margin:0 0 12px;">BolKarigar Password Reset</h2>
      <p style="color:#334155;line-height:1.5;">Aapka 6-digit OTP:</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#0f172a;margin:16px 0;">${otp}</p>
      <p style="color:#64748b;font-size:14px;">Yeh OTP <strong>10 minute</strong> ke liye valid hai.</p>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;">Agar aapne request nahi ki, is email ko ignore karein.</p>
    </div>`;
  return { subject, text, html };
}

async function sendPasswordResetOtp(email, otp) {
  const { subject, text, html } = buildOtpEmail(otp);
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
      logger.info(`[Password Reset] OTP sent to ${email} via Brevo`);
      return { sent: true, provider: 'brevo' };
    } catch (err) {
      errors.push(`Brevo: ${err.message}`);
      logger.error('[Password Reset] Brevo failed:', err.message);
    }
  }

  if (process.env.RESEND_API_KEY) {
    try {
      await sendViaResend({ to: email, subject, text, html });
      logger.info(`[Password Reset] OTP sent to ${email} via Resend`);
      return { sent: true, provider: 'resend' };
    } catch (err) {
      errors.push(`Resend: ${err.message}`);
      logger.error('[Password Reset] Resend failed:', err.message);
    }
  }

  if (getSmtpConfig()) {
    try {
      await sendViaSmtp({ to: email, subject, text, html });
      logger.info(`[Password Reset] OTP sent to ${email} via SMTP`);
      return { sent: true, provider: 'smtp' };
    } catch (err) {
      errors.push(`SMTP: ${err.message}`);
      logger.error('[Password Reset] SMTP failed:', err.message);
    }
  }

  const renderHint = isRenderHost()
    ? ' Render FREE plan par Gmail SMTP band hai — Render Environment me BREVO_API_KEY add karein (free, 300 email/day).'
    : '';
  if (process.env.NODE_ENV !== 'production') {
    logger.warn(`[Password Reset OTP] ${email} => ${otp} (email failed — dev only log)`);
  } else {
    logger.error(`[Password Reset OTP] Email delivery failed for ${email}`);
  }
  return { sent: false, provider: null, error: (errors.join(' | ') || 'not_configured') + renderHint };
}

module.exports = {
  isEmailConfigured,
  hasHttpsEmailProvider,
  isWrongBrevoSmtpKey,
  isRenderHost,
  verifyEmailTransport,
  createMailTransporter,
  sendPasswordResetOtp
};
