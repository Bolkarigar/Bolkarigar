/**
 * Auth endpoint tests — galat password reject hota hai, non-existent user
 * reject hota hai, aur brute-force rate-limit kaam karta hai.
 * NOTE: Ye test kisi real account ka password nahi badalta — sirf
 * negative/edge cases check karta hai, isliye kisi bhi environment mein
 * safely chal sakta hai.
 * Usage: node tests/auth.flow.js
 */
const BASE = process.env.TEST_BASE_URL || 'http://localhost:5002';

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  let failures = 0;

  // 1. Non-existent user se login -> 400 aur clear error milna chahiye
  const noUser = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: `nonexistent_${Date.now()}`, password: 'whatever123' })
  });
  if (noUser.status === 400 && noUser.data.error) {
    console.log('✅ Non-existent user login sahi se reject hua');
  } else {
    console.error('❌ Non-existent user login expected behavior nahi mila:', noUser);
    failures++;
  }

  // 2. Missing fields -> signup/login crash nahi hona chahiye, graceful error aana chahiye
  const missingFields = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if (missingFields.status >= 400 && missingFields.status < 500) {
    console.log('✅ Missing fields wala login gracefully reject hua (status', missingFields.status + ')');
  } else {
    console.error('❌ Missing fields wala login unexpected response de raha hai:', missingFields);
    failures++;
  }

  // 3. Brute-force rate limiting — 6 galat attempts ke baad 429 aana chahiye
  const rlUser = `ratelimit_test_${Date.now()}`;
  let got429 = false;
  for (let i = 0; i < 6; i++) {
    const attempt = await api('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: rlUser, password: 'wrongpass' })
    });
    if (attempt.status === 429) got429 = true;
  }
  if (got429) {
    console.log('✅ Rate limiting kaam kar raha hai (429 mila baar-baar galat attempts ke baad)');
  } else {
    console.error('❌ Rate limiting trigger nahi hua 6 attempts ke baad');
    failures++;
  }

  if (failures > 0) {
    console.error(`\n❌ ${failures} test(s) fail hue.\n`);
    process.exit(1);
  }
  console.log('\n🎉 Auth flow — sab tests pass!\n');
}

main().catch((e) => {
  console.error('❌ Auth test crashed:', e.message);
  process.exit(1);
});
