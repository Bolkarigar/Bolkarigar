/**
 * BolKarigar — password reset / notification emails
 * SMTP (nodemailer) ya Resend API — jo configured ho woh use hota hai.
 */
const logger = require('./logger');

function isEmailConfigured() {
  const smtpOk = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  const resendOk = !!process.env.RESEND_API_KEY;
  return smtpOk || resendOk;
}

async function sendViaSmtp({ to, subject, text }) {
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text
  });
}

async function sendViaResend({ to, subject, text }) {
  const fetch = require('node-fetch');
  const from = process.env.RESEND_FROM || 'BolKarigar <onboarding@resend.dev>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, to: [to], subject, text })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

async function sendPasswordResetOtp(email, otp) {
  const subject = 'BolKarigar — Password Reset OTP';
  const text = `Aapka password reset OTP hai: ${otp}\n\nYeh 10 minute ke liye valid hai. Agar aapne yeh request nahi ki, is email ko ignore karein.`;

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    await sendViaSmtp({ to: email, subject, text });
    return { sent: true, provider: 'smtp' };
  }

  if (process.env.RESEND_API_KEY) {
    await sendViaResend({ to: email, subject, text });
    return { sent: true, provider: 'resend' };
  }

  logger.warn(`[Password Reset] Email service configured nahi — OTP console par: ${email}`);
  logger.info(`[Password Reset OTP] ${email} => ${otp}`);
  return { sent: false, provider: null };
}

module.exports = { isEmailConfigured, sendPasswordResetOtp };
