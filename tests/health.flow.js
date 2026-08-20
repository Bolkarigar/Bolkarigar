/**
 * Basic health-check test — server chal raha hai aur MongoDB connected hai.
 * Usage: node tests/health.flow.js
 */
const BASE = process.env.TEST_BASE_URL || 'http://localhost:5002';

async function main() {
  const res = await fetch(`${BASE}/api/health`);
  const data = await res.json().catch(() => ({}));

  if (res.status !== 200) {
    console.error('❌ Health check failed — status:', res.status);
    process.exit(1);
  }
  if (!data.ok) {
    console.error('❌ Health check returned ok:false', data);
    process.exit(1);
  }
  if (!data.mongo) {
    console.error('❌ MongoDB connected nahi hai (health check ke mutabik)', data);
    process.exit(1);
  }

  console.log('✅ Health check OK | version:', data.version, '| env:', data.env);
}

main().catch((e) => {
  console.error('❌ Health test crashed:', e.message);
  process.exit(1);
});
