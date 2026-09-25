/**
 * Render env vars set karo — ek baar chalao:
 *   set RENDER_API_KEY=rnd_xxxx
 *   node scripts/set-render-env.js
 *
 * Optional: GEMINI_API_KEY env me pehle se set ho to wahi use hogi.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fetch = require('node-fetch');

const RENDER_API = 'https://api.render.com/v1';
const API_KEY = process.env.RENDER_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const SERVICE_NAME = process.env.RENDER_SERVICE_NAME || 'bolkarigar';

const ENV_UPDATES = {
  GEMINI_API_KEY: GEMINI_KEY,
  VOICE_AI_PROVIDER: 'gemini',
  DEV_PLAN_TOGGLE: 'false'
};

async function api(path, options = {}) {
  const res = await fetch(`${RENDER_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`Render API ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  return data;
}

async function findService() {
  let cursor = null;
  do {
    const q = cursor ? `?cursor=${cursor}` : '';
    const page = await api(`/services?limit=100${q ? '&' + q.slice(1) : ''}`);
    const items = Array.isArray(page) ? page : page.items || [];
    for (const item of items) {
      const svc = item.service || item;
      const name = (svc.name || '').toLowerCase();
      const url = (svc.serviceDetails?.url || svc.url || '').toLowerCase();
      if (name.includes(SERVICE_NAME) || url.includes('bolkarigar.onrender')) {
        return svc;
      }
    }
    cursor = page.cursor || null;
  } while (cursor);
  throw new Error(`Service "${SERVICE_NAME}" / bolkarigar.onrender.com not found on Render account`);
}

async function getEnvVars(serviceId) {
  const data = await api(`/services/${serviceId}/env-vars`);
  const list = Array.isArray(data) ? data : data.envVars || data.items || [];
  return list.map((e) => ({
    key: e.envVar?.key || e.key,
    value: e.envVar?.value ?? e.value ?? ''
  }));
}

async function setEnvVars(serviceId, updates) {
  const current = await getEnvVars(serviceId);
  const map = new Map(current.map((e) => [e.key, e.value]));
  for (const [key, value] of Object.entries(updates)) {
    if (value != null && value !== '') map.set(key, value);
  }
  // Render PUT rejects empty values — optional blanks become single space
  const envVars = [...map.entries()].map(([key, value]) => ({
    key,
    value: value === '' || value == null ? ' ' : String(value)
  }));
  await api(`/services/${serviceId}/env-vars`, {
    method: 'PUT',
    body: JSON.stringify(envVars)
  });
}

async function triggerDeploy(serviceId) {
  try {
    await api(`/services/${serviceId}/deploys`, { method: 'POST', body: '{}' });
  } catch {
    console.log('Deploy trigger skipped (auto-deploy from git may already run)');
  }
}

async function main() {
  if (!API_KEY) {
    console.error('ERROR: RENDER_API_KEY missing.');
    console.error('Get key: https://dashboard.render.com/u/settings#api-keys');
    console.error('Then: set RENDER_API_KEY=rnd_... && node scripts/set-render-env.js');
    process.exit(1);
  }
  if (!GEMINI_KEY) {
    console.error('ERROR: GEMINI_API_KEY missing in .env');
    process.exit(1);
  }

  console.log('Finding Render service...');
  const svc = await findService();
  const id = svc.id;
  console.log(`Found: ${svc.name} (${id})`);

  console.log('Updating env vars: GEMINI_API_KEY, VOICE_AI_PROVIDER, DEV_PLAN_TOGGLE');
  await setEnvVars(id, ENV_UPDATES);
  console.log('Env vars updated.');

  await triggerDeploy(id);
  console.log('Done. Wait 2-3 min: https://bolkarigar.onrender.com');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
