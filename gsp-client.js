/**
 * BolKarigar — GSP API client (MasterGST / WhiteBooks compatible scaffold)
 * Production me .env me credentials daalo; tab tak sandbox disabled rahega.
 */
const fetch = require('node-fetch');

const GSP_BASE = process.env.GSP_BASE_URL || 'https://api.mastergst.com';
const GSP_CLIENT_ID = process.env.GSP_CLIENT_ID || '';
const GSP_CLIENT_SECRET = process.env.GSP_CLIENT_SECRET || '';
const GSP_EMAIL = process.env.GSP_EMAIL || '';

let cachedToken = null;
let tokenExpiry = 0;

function isGspConfigured() {
  return !!(GSP_CLIENT_ID && GSP_CLIENT_SECRET && GSP_EMAIL);
}

function getGspStatus() {
  return {
    configured: isGspConfigured(),
    provider: process.env.GSP_PROVIDER || 'mastergst',
    baseUrl: GSP_BASE,
    message: isGspConfigured()
      ? 'GSP credentials set — integration ready for testing.'
      : 'GSP credentials missing. Add GSP_CLIENT_ID, GSP_CLIENT_SECRET, GSP_EMAIL to .env after MasterGST sandbox approval.'
  };
}

async function getGspToken() {
  if (!isGspConfigured()) throw new Error('GSP not configured');
  if (cachedToken && Date.now() < tokenExpiry - 60000) return cachedToken;

  const res = await fetch(`${GSP_BASE}/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: GSP_EMAIL,
      client_id: GSP_CLIENT_ID,
      client_secret: GSP_CLIENT_SECRET
    })
  });
  const data = await res.json();
  if (!res.ok || !data.access_token && !data.token) {
    throw new Error(data.message || data.error || 'GSP auth failed');
  }
  cachedToken = data.access_token || data.token;
  tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
  return cachedToken;
}

async function verifyGstin(gstin) {
  const token = await getGspToken();
  const res = await fetch(`${GSP_BASE}/public/search?gstin=${encodeURIComponent(gstin)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

module.exports = { isGspConfigured, getGspStatus, getGspToken, verifyGstin };
