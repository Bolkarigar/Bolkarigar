/**
 * BolKarigar Live Chat — GPT-4o + Gemini with conversation memory
 */
const fetch = require('node-fetch');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { isValidGeminiApiKey } = require('./ai-offline');

const OPENAI_CHAT_MODELS = ['gpt-4o', 'gpt-4o-mini'];
const GEMINI_CHAT_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash-lite',
  'gemini-3-flash-preview',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash'
];

const MAX_HISTORY = 20;
const MAX_MSG_LEN = 2000;

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && String(m.content || '').trim())
    .slice(-MAX_HISTORY)
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content).trim().slice(0, MAX_MSG_LEN)
    }));
}

function getChatProvider() {
  const mode = String(process.env.CHAT_AI_PROVIDER || process.env.VOICE_AI_PROVIDER || 'auto').toLowerCase();
  if (mode === 'openai' || mode === 'gemini') return mode;
  return 'auto';
}

async function callOpenAIChat(systemPrompt, message, history, apiKey) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: message }
  ];
  let lastErr = null;
  for (const modelName of OPENAI_CHAT_MODELS) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          temperature: 0.7,
          max_tokens: 500,
          messages
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `OpenAI HTTP ${res.status}`);
      const reply = data.choices?.[0]?.message?.content?.trim();
      if (!reply) throw new Error('Empty OpenAI reply');
      return { reply, provider: 'openai', model: modelName };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('OpenAI chat unavailable');
}

async function callGeminiChat(systemPrompt, message, history, apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiHistory = history.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  let lastErr = null;
  for (const modelName of GEMINI_CHAT_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt
      });
      const chat = model.startChat({ history: geminiHistory });
      const result = await chat.sendMessage(message);
      const reply = result.response.text().trim();
      if (!reply) throw new Error('Empty Gemini reply');
      return { reply, provider: 'gemini', model: modelName };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Gemini chat unavailable');
}

async function callChatAI({ message, history = [], systemPrompt }) {
  const userMessage = String(message || '').trim();
  if (!userMessage) throw new Error('Message required');

  const safeHistory = sanitizeHistory(history);
  const openaiKey = process.env.OPENAI_API_KEY || '';
  const geminiKey = process.env.GEMINI_API_KEY || '';
  const hasOpenai = openaiKey.startsWith('sk-') && openaiKey.length > 20;
  const hasGemini = isValidGeminiApiKey(geminiKey);
  const mode = getChatProvider();

  const tryOpenAI = () => callOpenAIChat(systemPrompt, userMessage, safeHistory, openaiKey);
  const tryGemini = () => callGeminiChat(systemPrompt, userMessage, safeHistory, geminiKey);

  if (mode === 'openai') {
    if (!hasOpenai) throw new Error('OpenAI key missing');
    return tryOpenAI();
  }
  if (mode === 'gemini') {
    if (!hasGemini) throw new Error('Gemini key missing');
    return tryGemini();
  }

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

module.exports = { callChatAI, sanitizeHistory, OPENAI_CHAT_MODELS, GEMINI_CHAT_MODELS };
