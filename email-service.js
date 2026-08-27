/**
 * BolKarigar — password reset / notification emails
 * SMTP (nodemailer) ya Resend API — jo configured ho woh use hota hai.
 */
const logger = require('./logger');

function normalizeSmtpPass(pass) {
  return String(pass || '').replace(/\s+/g, '');
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

function isEmailConfigured() {
  if (getSmtpConfig()) return true;
  return !!String(process.env.RESEND_API_KEY || '').trim();
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
  const base = {
    ...cfg.transport,
    pool: false,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    family: 4
  };
  const transports = [base];
  if (cfg.isGmail && base.port !== 465) {
    transports.push({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: base.auth,
      tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
      pool: false,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
      family: 4
    });
  }
  return transports.map((t) => ({
    transporter: nodemailer.createTransport(t),
    from: cfg.from,
    label: `smtp:${t.port}`
  }));
}

function createMailTransporter() {
  const list = buildSmtpTransports();
  return list[0] || null;
}

async function verifyEmailTransport() {
  if (!isEmailConfigured()) {
    logger.warn('[Email] SMTP/Resend configured nahi — forgot-password emails nahi jayengi.');
    return { ok: false, provider: null, error: 'not_configured' };
  }

  if (process.env.RESEND_API_KEY) {
    logger.info('[Email] Resend API key set — password reset emails enabled (recommended for Render).');
    return { ok: true, provider: 'resend' };
  }

  const transports = buildSmtpTransports();
  if (transports.length) {
    let lastErr = null;
    for (const mail of transports) {
      try {
        await mail.transporter.verify();
        logger.info(`[Email] SMTP ready (${mail.label}) — password reset emails enabled.`);
        return { ok: true, provider: 'smtp' };
      } catch (err) {
        lastErr = err;
        logger.warn(`[Email] SMTP verify failed (${mail.label}):`, err.message);
      }
    }
    logger.error('[Email] SMTP verify failed on all ports:', lastErr?.message);
    return { ok: false, provider: 'smtp', error: lastErr?.message || 'verify_failed' };
  }

  return { ok: false, provider: null, error: 'unknown' };
}

async function sendViaSmtp({ to, subject, text, html }) {
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
  throw lastErr || new Error('SMTP send failed on all ports.');
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
  }), 15000, 'Resend API');
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend API error ${res.status}: ${body}`);
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

  // Resend (HTTPS) is more reliable on cloud hosts than Gmail SMTP port 587.
  if (process.env.RESEND_API_KEY) {
    await sendViaResend({ to: email, subject, text, html });
    logger.info(`[Password Reset] OTP email sent to ${email} via Resend`);
    return { sent: true, provider: 'resend' };
  }

  if (getSmtpConfig()) {
    await sendViaSmtp({ to: email, subject, text, html });
    logger.info(`[Password Reset] OTP email sent to ${email} via SMTP`);
    return { sent: true, provider: 'smtp' };
  }

  logger.warn(`[Password Reset] Email service not configured — OTP logged for: ${email}`);
  logger.info(`[Password Reset OTP] ${email} => ${otp}`);
  return { sent: false, provider: null };
}

module.exports = {
  isEmailConfigured,
  verifyEmailTransport,
  createMailTransporter,
  sendPasswordResetOtp
};
