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

function createMailTransporter() {
  const cfg = getSmtpConfig();
  if (!cfg) return null;
  const nodemailer = require('nodemailer');
  return { transporter: nodemailer.createTransport(cfg.transport), from: cfg.from };
}

async function verifyEmailTransport() {
  if (!isEmailConfigured()) {
    logger.warn('[Email] SMTP/Resend configured nahi — forgot-password emails nahi jayengi.');
    return { ok: false, provider: null, error: 'not_configured' };
  }

  const mail = createMailTransporter();
  if (mail) {
    try {
      await mail.transporter.verify();
      logger.info(`[Email] SMTP ready (${process.env.SMTP_HOST}) — password reset emails enabled.`);
      return { ok: true, provider: 'smtp' };
    } catch (err) {
      logger.error('[Email] SMTP verify failed:', err.message);
      return { ok: false, provider: 'smtp', error: err.message };
    }
  }

  if (process.env.RESEND_API_KEY) {
    logger.info('[Email] Resend API key set — password reset emails enabled.');
    return { ok: true, provider: 'resend' };
  }

  return { ok: false, provider: null, error: 'unknown' };
}

async function sendViaSmtp({ to, subject, text, html }) {
  const mail = createMailTransporter();
  if (!mail) throw new Error('SMTP configured nahi hai.');

  await mail.transporter.sendMail({
    from: mail.from,
    to,
    subject,
    text,
    html: html || undefined
  });
}

async function sendViaResend({ to, subject, text, html }) {
  const fetch = require('node-fetch');
  const from = process.env.RESEND_FROM || 'BolKarigar <onboarding@resend.dev>';
  const res = await fetch('https://api.resend.com/emails', {
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
  });
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

  if (getSmtpConfig()) {
    await sendViaSmtp({ to: email, subject, text, html });
    logger.info(`[Password Reset] OTP email sent to ${email} via SMTP`);
    return { sent: true, provider: 'smtp' };
  }

  if (process.env.RESEND_API_KEY) {
    await sendViaResend({ to: email, subject, text, html });
    logger.info(`[Password Reset] OTP email sent to ${email} via Resend`);
    return { sent: true, provider: 'resend' };
  }

  logger.warn(`[Password Reset] Email service configured nahi — OTP console par: ${email}`);
  logger.info(`[Password Reset OTP] ${email} => ${otp}`);
  return { sent: false, provider: null };
}

module.exports = {
  isEmailConfigured,
  verifyEmailTransport,
  createMailTransporter,
  sendPasswordResetOtp
};
