/**
 * Offline AI knowledge for BolKarigar — Gemini fail hone par bhi jawab de sake.
 */

const APP_FEATURES_OVERVIEW =
  'BolKarigar ek Hindi voice-first business app hai. Isme yeh sab hai: Overview dashboard (sales/expense/profit), Voice AI se poora control, Invoice/GST bill banana aur download, WhatsApp share, Tally Prime sync, Project aur Expense tracking, Inventory/Stock, Udhar Khata, Ledgers, Stock Items, Voucher, Day Book, Total Sales report, Gallery, Todo list, QR Tool, Calculator, Unit Converter, Notes, Media scanner, Business Profile settings, aur Help & Guide. Kisi bhi feature ke baare me detail me poochhiye!';

const OFFLINE_FAQ = [
  { keywords: ['namaste', 'hello', 'hi', 'hey', 'kaise ho', 'good morning'], answer: 'Namaste! Main BolKarigar AI hoon. App ke baare me kuch bhi poochhiye — invoice, project, khata, tally, voice commands, sab bata sakta hoon.' },
  { keywords: ['tum kaun', 'aap kaun', 'who are you', 'kya ho tum', 'your name'], answer: 'Main BolKarigar AI hoon — is app ka smart assistant. Main app ke har feature ke baare me guide kar sakta hoon aur kuch commands bhi chala sakta hoon.' },
  { keywords: ['kya kya', 'ho skta', 'ho sakta', 'ho skte', 'features', 'modules', 'kitne model', 'kya kaam', 'kar sakte', 'ker skte', 'kr skte', 'what can', 'app me kya', 'app m kya', 'iss app', 'is app'], answer: APP_FEATURES_OVERVIEW },
  { keywords: ['bolkarigar kya', 'app kya hai', 'app kis liye', 'what is this'], answer: APP_FEATURES_OVERVIEW },
  { keywords: ['invoice', 'bill banaye', 'bill banao', 'invoice kaise', 'invoice kese'], answer: 'Invoice tab kholo, pehle Business Profile save karo. Phir Customer, Product, Price, Qty aur GST rate bharo, Add Item dabao. Download se bill print karo, WhatsApp Share se customer ko bhejo, Tally mode me Sync to Tally bhi kar sakte ho.' },
  { keywords: ['gst', 'igst', 'cgst', 'sgst'], answer: 'Same state buyer par CGST+SGST lagta hai, alag state par IGST. Invoice me Buyer State select karo — app automatically sahi tax calculate karega. GST rate 0/5/12/18/28% dropdown se choose hoti hai.' },
  { keywords: ['tally', 'tally sync', 'tally prime'], answer: 'Tally sync ke liye Tally Prime kholo, HTTP Server port 9000 ON karo. Invoice me Tally Prime mode select karke Sync to Tally dabao. Cloud server par Desktop Agent chalana padta hai.' },
  { keywords: ['project', 'expense', 'kharcha'], answer: 'Projects tab me naya project add karo (name, customer, budget). Usi tab me Quick Expense Entry se kharcha track karo. Voice se bhi bol sakte ho jaise project Mandir work budget 50000.' },
  { keywords: ['udhar', 'khata', 'ledger'], answer: 'Udhar Khata me customer credit track hota hai. Accounting me Ledgers, Stock Items, Voucher aur Day Book alag tabs me hain.' },
  { keywords: ['inventory', 'stock', 'saman'], answer: 'Inventory tab me item name, quantity aur price daal kar stock manage karo. Accounting me Stock Items tab me bhi detailed items/stock hai.' },
  { keywords: ['voice', 'bol kar', 'mic'], answer: 'Header me Voice OFF button dabao — continuous voice mode ON hoga. Phir bol sakte ho jaise open invoice, customer Ramesh product cement price 500, dark mode on.' },
  { keywords: ['todo', 'task'], answer: 'Todo tab me kaam likh kar Add dabao. Voice: todo me likho kal cement lana hai.' },
  { keywords: ['gallery', 'photo'], answer: 'Gallery tab me apni product photos upload aur dekho.' },
  { keywords: ['qr', 'qr code'], answer: 'QR Tool me text ya UPI link daal kar QR code generate karo.' },
  { keywords: ['calculator', 'calculate', 'jod', 'ghata'], answer: 'Calculator tab use karo ya bol do 25 plus 30, 100 into 5.' },
  { keywords: ['converter', 'convert', 'meter', 'feet'], answer: 'Converter tab me length, weight, temperature units convert karo.' },
  { keywords: ['notes', 'note likho'], answer: 'Notes tab me likho aur Download notes se save karo.' },
  { keywords: ['profile', 'gstin', 'company name', 'business profile'], answer: 'Invoice tab ke upar Business Profile Settings me company name, GSTIN, phone, address bharo aur Save karo. Iske baad invoice generator unlock hota hai.' },
  { keywords: ['dark mode', 'light mode', 'theme'], answer: 'Header me Light/Dark button se theme badlo, ya bolo dark mode on.' },
  { keywords: ['logout', 'password', 'login'], answer: 'Logout header me right side hai. Password bhool gaye to login page par Forgot Password use karo.' },
  { keywords: ['help', 'guide', 'manual'], answer: 'Sidebar me Help & Guide tab kholo — har module ki poori Hindi+English guide hai.' },
  { keywords: ['free', 'cost', 'paisa', 'paid'], answer: 'BolKarigar app use karna free hai. Sirf Gemini AI chat ke liye optional API key chahiye (Google AI Studio se free).' },
  { keywords: ['whatsapp'], answer: 'Invoice banane ke baad WhatsApp Share button se bill customer ko bhejo.' },
  { keywords: ['eway', 'e way', 'vehicle'], answer: 'Invoice panel me E-Way Bill section me bill number, vehicle number aur distance bhar sakte ho (optional).' },
  { keywords: ['overview', 'profit', 'sales', 'expense', 'report'], answer: 'Overview tab me Total Sales, Total Expense, Net Profit/Loss aur Udhar summary cards dikhte hain — auto calculate hota hai invoices aur expenses se.' }
];

const KHATA_PRO_MODULE_ANSWER =
  'Accounting me yeh sab hai: (1) Ledgers — party/customer ledger add, (2) Stock Items — saman aur rate, (3) New Voucher — Sales/Purchase/Receipt/Payment/Journal, (4) Day Book — din ki entries. Invoice sale par auto ledger entry aur Tally Prime sync bhi hota hai.';

const TODO_MODULE_ANSWER =
  'Todo List me: naya task add karna (type ya voice "todo cement mangwana add karo"), delete karna, Clear All se poori list saaf karna, aur Todo tab se dekhna. Tasks save rehte hain.';

function isInformationalQuestion(text) {
  const norm = normalizeFaqText(text);
  if (!norm) return false;
  if (norm.includes('?')) return true;
  const markers = [
    /\bkya\b/, /\bkaise\b/, /\bkese\b/, /\bwhat\b/, /\bhow\b/,
    /\bbatao\b/, /\bbatado\b/, /\bkar sakte\b/, /\bker skte\b/, /\bkar skte\b/,
    /\bkier skte\b/, /\bkya kya\b/, /\bsikte\b/, /\bsakte\b/
  ];
  if (markers.some(p => p.test(norm))) return true;
  if (/\b(keregi|karega|hai|hain|ho)\b/.test(norm) && /\b(kya|kaise|kese)\b/.test(norm)) return true;
  return false;
}

function matchModuleFaq(text) {
  if (!isInformationalQuestion(text)) return null;
  const norm = normalizeFaqText(text);
  if (/\bkhata pro\b|खाता प्रो/.test(norm)) return KHATA_PRO_MODULE_ANSWER;
  if (/\btodo\b|टूडू|\btask\b|टास्क/.test(norm)) return TODO_MODULE_ANSWER;
  return null;
}

function normalizeFaqText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u097F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreFaqMatch(text, keywords) {
  const norm = normalizeFaqText(text);
  let score = 0;
  for (const k of keywords) {
    const kn = k.toLowerCase();
    if (norm.includes(kn)) score += kn.length;
  }
  if (/app|bolkarigar|isme|yahan|iss/.test(norm) && /kya|kaise|what|help|feature|ho skt|ho sak|kar sak|kitne/.test(norm)) {
    score += 8;
  }
  return score;
}

function getOfflineAiReply(message) {
  const text = String(message || '').trim();
  if (!text) return 'Kuch poochhiye — main BolKarigar app ke baare me sab bata sakta hoon.';

  const moduleFaq = matchModuleFaq(text);
  if (moduleFaq) return moduleFaq;

  let best = null;
  let bestScore = 0;
  for (const item of OFFLINE_FAQ) {
    const s = scoreFaqMatch(text, item.keywords);
    if (s > bestScore) {
      bestScore = s;
      best = item;
    }
  }
  if (best && bestScore >= 4) return best.answer;

  // Broad fallback for app-related questions
  const norm = normalizeFaqText(text);
  if (/kya|kaise|what|how|batao|batado|help|guide|feature|app|bolkarigar/.test(norm)) {
    return APP_FEATURES_OVERVIEW;
  }

  return 'Main BolKarigar app ke features ke baare me madad kar sakta hoon. Try karein: "invoice kaise banaye", "tally sync kaise kare", "app me kya kya hai", ya "voice commands kya hain".';
}

function isValidGeminiApiKey(key) {
  if (!key || !String(key).trim()) return false;
  const k = String(key).trim();
  // AIza... = Google AI Studio | AQ.... = newer Gemini API keys
  return (k.startsWith('AIza') || k.startsWith('AQ.')) && k.length >= 20;
}

module.exports = { getOfflineAiReply, isValidGeminiApiKey, APP_FEATURES_OVERVIEW, OFFLINE_FAQ };
