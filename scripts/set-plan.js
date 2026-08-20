/**
 * Dev/testing — owner account par plan set karein (payment ke bina).
 * Usage:
 *   node scripts/set-plan.js                    → owners list
 *   node scripts/set-plan.js business           → latest owner → Business 30 din
 *   node scripts/set-plan.js pro                → latest owner → Pro 30 din
 *   node scripts/set-plan.js business myuser    → username "myuser" → Business
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const PLANS = ['pro', 'business'];

async function main() {
  const arg1 = (process.argv[2] || '').toLowerCase();
  const arg2 = process.argv[3];

  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI .env me nahi mila.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');

  const owners = await User.find({ ownerId: null }).select('username email plan subscriptionStatus planExpiresAt').sort({ _id: -1 });

  if (!arg1 || !PLANS.includes(arg1)) {
    console.log('\nOwner accounts:\n');
    owners.forEach((u, i) => {
      console.log(`  ${i + 1}. ${u.username} (${u.email}) — plan: ${u.plan || '?'}, status: ${u.subscriptionStatus || '?'}`);
    });
    console.log('\nBusiness UI dekhne ke liye:\n  node scripts/set-plan.js business\n');
    console.log('Wapas Pro par:\n  node scripts/set-plan.js pro\n');
    await mongoose.disconnect();
    return;
  }

  const plan = arg1;
  let user;
  if (arg2) {
    user = await User.findOne({ username: arg2, ownerId: null });
    if (!user) user = await User.findOne({ email: arg2, ownerId: null });
  } else {
    user = owners[0];
  }

  if (!user) {
    console.error('Owner account nahi mila.');
    process.exit(1);
  }

  const expires = new Date();
  expires.setDate(expires.getDate() + 30);

  const result = await User.updateOne(
    { _id: user._id },
    {
      $set: {
        plan,
        subscriptionStatus: 'active',
        planExpiresAt: expires,
        trialEndsAt: null
      }
    }
  );

  if (!result.modifiedCount && !result.matchedCount) {
    console.error('Plan update fail — user save nahi hua.');
    process.exit(1);
  }

  console.log(`\n✅ ${user.username} → ${plan.toUpperCase()} plan active (30 din, test ke liye)`);
  console.log('   Logout karke dubara login karo, ya browser refresh (Ctrl+Shift+R)\n');

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
