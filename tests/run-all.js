/**
 * Test runner — tests/ folder ke saare *.flow.js files ek ek karke chalata hai.
 * IMPORTANT: Server pehle se chal raha hona chahiye (node server.js ya pm2 se)
 * kyunki ye black-box HTTP tests hain, real running server ke against.
 *
 * Usage: npm test
 *    ya: node tests/run-all.js
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const testDir = __dirname;
const files = fs.readdirSync(testDir).filter((f) => f.endsWith('.flow.js')).sort();

if (files.length === 0) {
  console.log('Koi test file (*.flow.js) nahi mila.');
  process.exit(0);
}

console.log(`\n🧪 ${files.length} test file(s) chalaye ja rahe hain...\n`);

let passed = 0;
let failed = 0;

for (const file of files) {
  console.log(`--- ${file} ---`);
  try {
    execSync(`node ${path.join(testDir, file)}`, { stdio: 'inherit' });
    passed++;
  } catch (e) {
    failed++;
  }
  console.log('');
}

console.log('========================================');
console.log(`✅ Passed: ${passed}   ❌ Failed: ${failed}`);
console.log('========================================\n');

if (failed > 0) process.exit(1);
