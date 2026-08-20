/**
 * Compare OpenAI vs Gemini for Hindi voice parse
 * Run: node tests/voice-ai-compare.js
 */
require('dotenv').config();
const { callOpenAIVoiceParse, callGeminiVoiceParse, scoreVoiceParse } = require('../voice-ai');
const { isValidGeminiApiKey } = require('../ai-offline');

const SAMPLES = [
  {
    text: 'Ram ne ek laptop liya hai 25000 ka Haryana se hai pincode 123456',
    expect: { intent: 'invoice', customer: 'Ram', product: 'laptop', price: 25000, state: 'Haryana', pin: '123456' }
  },
  {
    text: 'iss ko ram n ek laptop liya hai 25000 ka',
    expect: { intent: 'invoice', customer: 'Ram', product: 'laptop', price: 25000 }
  },
  {
    text: 'Ramesh ko cement 500 rupaye me 2 piece bill banao',
    expect: { intent: 'invoice', customer: 'Ramesh', product: 'cement', price: 500, qty: 2 }
  },
  {
    text: 'todo me kal cement lana likho add karo',
    expect: { intent: 'todo' }
  },
  {
    text: 'invoice kholo',
    expect: { intent: 'nav' }
  }
];

async function runProvider(name, fn) {
  let totalScore = 0;
  let totalMax = 0;
  const details = [];

  for (const sample of SAMPLES) {
    try {
      const { parsed, model } = await fn(sample.text);
      const { score, total, pct } = scoreVoiceParse(parsed, sample.expect);
      totalScore += score;
      totalMax += total;
      details.push({ text: sample.text.slice(0, 50), score, total, pct, parsed, model });
      console.log(`  [${name}] ${pct}% — ${sample.text.slice(0, 45)}…`);
    } catch (e) {
      details.push({ text: sample.text.slice(0, 50), error: e.message });
      console.log(`  [${name}] FAIL — ${sample.text.slice(0, 45)}… (${e.message})`);
    }
  }

  const overall = totalMax ? Math.round((totalScore / totalMax) * 100) : 0;
  return { name, overall, totalScore, totalMax, details };
}

async function main() {
  const openaiKey = process.env.OPENAI_API_KEY || '';
  const geminiKey = process.env.GEMINI_API_KEY || '';
  const hasOpenai = openaiKey.startsWith('sk-') && openaiKey.length > 20;
  const hasGemini = isValidGeminiApiKey(geminiKey);

  console.log('\n=== Voice AI Compare ===\n');
  console.log('OpenAI key:', hasOpenai ? 'OK' : 'MISSING/INVALID');
  console.log('Gemini key:', hasGemini ? 'OK' : 'MISSING/INVALID (AIza... chahiye)\n');

  const results = [];

  if (hasOpenai) {
    console.log('Testing OpenAI...');
    results.push(await runProvider('OpenAI', (t) => callOpenAIVoiceParse(t, openaiKey)));
  }

  if (hasGemini) {
    console.log('\nTesting Gemini...');
    results.push(await runProvider('Gemini', (t) => callGeminiVoiceParse(t, geminiKey)));
  }

  if (!results.length) {
    console.error('No valid API keys to test.');
    process.exit(1);
  }

  results.sort((a, b) => b.overall - a.overall);
  const winner = results[0];

  console.log('\n=== RESULT ===');
  for (const r of results) {
    console.log(`${r.name}: ${r.overall}% (${r.totalScore}/${r.totalMax})`);
  }
  console.log(`\nWinner: ${winner.name} — VOICE_AI_PROVIDER=${winner.name.toLowerCase()}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
