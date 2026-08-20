/**
 * Dev test — login + full inventory CRUD (add, edit, stock adjust, delete)
 * Usage: node scripts/test-inventory-flow.js [username]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const BASE = process.env.TEST_BASE_URL || 'http://localhost:5002';
const TEST_PASS = 'Test@1234';
const username = process.argv[2] || 'admin12';

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
  const user = await User.findOne({ username, ownerId: null });
  if (!user) {
    console.error('User not found:', username);
    process.exit(1);
  }

  const hash = await bcrypt.hash(TEST_PASS, 10);
  await User.updateOne({ _id: user._id }, { $set: { password: hash } });
  console.log(`Password set for ${username} → ${TEST_PASS}`);

  const login = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: TEST_PASS })
  });
  if (!login.data.token) {
    console.error('Login failed:', login);
    process.exit(1);
  }
  const token = login.data.token;
  const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  console.log('✅ Login OK | plan:', login.data.subscription?.planName);

  const me = await api('/api/auth/me', { headers: h });
  const sub = me.data.subscription;
  console.log('✅ /me OK | fullAccess:', sub?.fullAccess, '| allowedTabs:', sub?.allowedTabs?.length ?? 'all');

  const testName = `Test Cement ${Date.now()}`;
  const add = await api('/api/items', {
    method: 'POST',
    headers: h,
    body: JSON.stringify({
      itemName: testName,
      unit: 'Bag',
      hsnCode: '2523',
      gstRate: 18,
      purchasePrice: 350,
      sellingPrice: 420,
      openingStock: 25,
      reorderLevel: 5,
      godown: 'Main Godown',
      batchNo: 'BATCH-001'
    })
  });
  if (!add.data.success) {
    console.error('❌ Add item failed:', add);
    process.exit(1);
  }
  const itemId = add.data.item?._id;
  console.log('✅ Item added:', testName, itemId);

  const summary = await api('/api/reports/stock-summary', { headers: h });
  const found = (summary.data.items || []).find((i) => i.itemName === testName);
  if (!found) {
    console.error('❌ Item not in stock-summary');
    process.exit(1);
  }
  console.log('✅ Stock summary | qty:', found.stockQty, '| status:', found.status);

  const edit = await api(`/api/items/${itemId}`, {
    method: 'PUT',
    headers: h,
    body: JSON.stringify({ sellingPrice: 450, reorderLevel: 10 })
  });
  if (!edit.data.success) {
    console.error('❌ Edit failed:', edit);
    process.exit(1);
  }
  console.log('✅ Item edited | sale price:', edit.data.item?.sellingPrice);

  const adjust = await api(`/api/items/${itemId}/adjust-stock`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ qtyChange: -3, note: 'Test stock out' })
  });
  if (!adjust.data.success) {
    console.error('❌ Stock adjust failed:', adjust);
    process.exit(1);
  }
  console.log('✅ Stock adjusted | new qty:', adjust.data.item?.stockQty);

  const del = await api(`/api/items/${itemId}`, { method: 'DELETE', headers: h });
  if (!del.data.success) {
    console.error('❌ Delete failed:', del);
    process.exit(1);
  }
  console.log('✅ Item deleted');

  console.log('\n🎉 Inventory flow — sab tests pass!\n');
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
