/**
 * Voice command parsing — OpenAI + Gemini (best available)
 */
const fetch = require('node-fetch');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { isValidGeminiApiKey } = require('./ai-offline');

const VOICE_PARSE_SCHEMA = `{"intent":"invoice|todo|nav|payment|none","customer":"","product":"","price":0,"qty":1,"state":"","pin":"","save":true}`;

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash-lite',
  'gemini-3-flash-preview',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash'
];
const OPENAI_MODELS = ['gpt-4o-mini', 'gpt-4o'];

function buildVoicePrompt(text) {
  return `You are BolKarigar voice parser for Indian shop owners. Extract command from Hindi/Hinglish speech.
Return ONLY valid JSON (no markdown).
Input: "${String(text).replace(/"/g, '\\"').slice(0, 500)}"
Schema: ${VOICE_PARSE_SCHEMA}
Rules:
- "Ram ne laptop liya 25000 ka Haryana pincode 123456" -> intent invoice, save true
- "todo me kal cement lana" -> intent todo, task text in product field or customer empty
- "invoice kholo" -> intent nav, panel invoice
- pin = 6 digits only. state = full Indian state name. price = number only.`;
}

function parseJsonFromText(raw) {
  const cleaned = String(raw || '').trim().replace(/^```json\s*|```$/g, '').trim();
  return JSON.parse(cleaned);
}

async function callGeminiVoiceParse(text, apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const prompt = buildVoicePrompt(text);
  let lastErr = null;
  for (const modelName of GEMINI_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const parsed = parseJsonFromText(result.response.text());
      return { parsed, provider: 'gemini', model: modelName };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Gemini voice parse unavailable');
}

async function callOpenAIVoiceParse(text, apiKey) {
  const prompt = buildVoicePrompt(text);
  let lastErr = null;
  for (const modelName of OPENAI_MODELS) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'You extract structured shop commands from Hindi/Hinglish. Reply with JSON only.' },
            { role: 'user', content: prompt }
          ]
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `OpenAI HTTP ${res.status}`);
      const parsed = parseJsonFromText(data.choices?.[0]?.message?.content || '');
      return { parsed, provider: 'openai', model: modelName };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('OpenAI voice parse unavailable');
}

function getVoiceProvider() {
  const p = String(process.env.VOICE_AI_PROVIDER || 'auto').toLowerCase();
  if (p === 'openai' || p === 'gemini') return p;
  return 'auto';
}

async function callVoiceParse(text) {
  const geminiKey = process.env.GEMINI_API_KEY || '';
  const openaiKey = process.env.OPENAI_API_KEY || '';
  const hasGemini = isValidGeminiApiKey(geminiKey);
  const hasOpenai = openaiKey.startsWith('sk-') && openaiKey.length > 20;
  const mode = getVoiceProvider();

  const tryOpenAI = async () => {
    if (!hasOpenai) throw new Error('OpenAI key missing');
    return callOpenAIVoiceParse(text, openaiKey);
  };
  const tryGemini = async () => {
    if (!hasGemini) throw new Error('Gemini key missing');
    return callGeminiVoiceParse(text, geminiKey);
  };

  if (mode === 'openai') return tryOpenAI();
  if (mode === 'gemini') return tryGemini();

  // auto: prefer OpenAI for Hindi structured JSON (generally more reliable)
  if (hasOpenai) {
    try {
      return await tryOpenAI();
    } catch (openaiErr) {
      if (hasGemini) {
        const gemini = await tryGemini();
        return { ...gemini, fallbackFrom: 'openai', fallbackError: openaiErr.message };
      }
      throw openaiErr;
    }
  }
  if (hasGemini) return tryGemini();
  throw new Error('No AI key configured (OPENAI_API_KEY or GEMINI_API_KEY)');
}

/** Score parsed result against expected fields (for tests) */
function scoreVoiceParse(parsed, expected) {
  let score = 0;
  let total = 0;
  for (const [key, val] of Object.entries(expected)) {
    total++;
    const got = parsed?.[key];
    if (key === 'price' || key === 'qty') {
      if (Number(got) === Number(val)) score++;
    } else if (key === 'product') {
      if (String(got || '').toLowerCase().includes(String(val).toLowerCase())) score++;
    } else if (String(got || '').toLowerCase() === String(val).toLowerCase()) {
      score++;
    }
  }
  return { score, total, pct: total ? Math.round((score / total) * 100) : 0 };
}

module.exports = {
  callVoiceParse,
  callGeminiVoiceParse,
  callOpenAIVoiceParse,
  scoreVoiceParse,
  buildVoicePrompt
};
