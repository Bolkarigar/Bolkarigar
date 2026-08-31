/**
 * Test payroll staff-users + employees API (owner login)
 * Usage: node scripts/test-payroll-select.js [username] [password]
 */
require('dotenv').config();
const BASE = process.env.TEST_BASE || 'http://localhost:5002';

async function main() {
  const username = process.argv[2] || 'admin';
  const password = process.argv[3] || 'admin123';
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const login = await loginRes.json();
  if (!loginRes.ok) {
    console.error('Login fail:', login.error || login);
    process.exit(1);
  }
  console.log('Login OK:', login.username, login.role);
  const headers = { Authorization: `Bearer ${login.token}` };

  const staffRes = await fetch(`${BASE}/api/payroll/staff-users`, { headers });
  const staffText = await staffRes.text();
  console.log('staff-users HTTP', staffRes.status, staffText.slice(0, 500));

  const empRes = await fetch(`${BASE}/api/payroll/employees`, { headers });
  const empText = await empRes.text();
  console.log('employees HTTP', empRes.status, empText.slice(0, 500));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
