#!/usr/bin/env node
/**
 * SMTP test — node scripts/test-email.js your@email.com
 * .env me SMTP_HOST, SMTP_USER, SMTP_PASS set hone chahiye.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { verifyEmailTransport, sendPasswordResetOtp } = require('../email-service');

async function main() {
  const to = process.argv[2];
  if (!to || !to.includes('@')) {
    console.error('Usage: node scripts/test-email.js recipient@email.com');
    process.exit(1);
  }

  const status = await verifyEmailTransport();
  console.log('Transport:', status);
  if (!status.ok) {
    process.exit(1);
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const result = await sendPasswordResetOtp(to, otp);
  console.log('Send result:', result);
  console.log('Test OTP (agar email na aaye to yeh use karo):', otp);
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
