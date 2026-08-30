/**
 * BolKarigar Voice Engine v4 — Hindi/Hinglish, bol ke jawab + kaam dono
 * Har module navigation, FAQ jawab, invoice/todo + AI fallback
 */
(function () {
  const INDIAN_STATES = [
    ["haryana", "Haryana"], ["delhi", "Delhi"], ["punjab", "Punjab"],
    ["uttar pradesh", "Uttar Pradesh"], ["rajasthan", "Rajasthan"], ["gujarat", "Gujarat"],
    ["maharashtra", "Maharashtra"], ["karnataka", "Karnataka"], ["tamil nadu", "Tamil Nadu"],
    ["bihar", "Bihar"], ["west bengal", "West Bengal"], ["madhya pradesh", "Madhya Pradesh"]
  ];

  const PRODUCT_WORDS = "laptop|mobile|phone|computer|cement|plywood|table|chair|fan|tv|fridge|ac|car|bike|scooter|saman|maal|item|लैपटॉप|मोबाइल|सीमेंट|प्लाईवुड|कार|सामान";

  const NAV_INTENTS = [
    { panel: "overviewPanel", words: ["overview", "dashboard", "home", "डैशबोर्ड", "होम", "summary", "सारांश"] },
    { panel: "invoicePanel", words: ["invoice", "bill", "billing", "इनवॉइस", "बिल", "बिलिंग", "रसीद"] },
    { panel: "voicePanel", words: ["voice ai", "voice panel", "वॉइस", "माइक"] },
    { panel: "projectPanel", words: ["project", "projects", "site", "प्रोजेक्ट", "साइट", "ठेकेदारी"] },
    { panel: "inventoryPanel", words: ["inventory", "stock", "स्टॉक", "इन्वेंटरी", "सामान"] },
    { panel: "totalSalesPanel", words: ["total sales", "total sale", "sales history", "sale history", "बिक्री", "कुल बिक्री", "टोटल सेल्स", "सेल्स", "sales report", "bikri report"] },
    { panel: "contractorPanel", words: ["contractor", "mazdoor", "labour", "ठेकेदार", "मजदूर"] },
    { panel: "payrollPanel", words: ["payroll", "hajri", "salary", "staff payroll", "वेतन", "हाजरी", "मेरी हाजरी"] },
    { panel: "ledgerPanel", words: ["udhar khata", "udhar", "credit", "उधार", "उधार खाता"] },
    { panel: "khataLedgersPanel", words: ["ledger", "ledgers", "party ledger", "खाता", "लेजर"] },
    { panel: "khataItemsPanel", words: ["stock items", "stock item", "items list", "सामान सूची"] },
    { panel: "khataVoucherPanel", words: ["voucher", "new voucher", "वाउचर"] },
    { panel: "khataDaybookPanel", words: ["day book", "daybook", "डे बुक", "दैनिक"] },
    { panel: "reportsProPanel", words: ["reports", "gstr", "ca report", "रिपोर्ट"] },
    { panel: "bankReconPanel", words: ["bank recon", "bank reconciliation", "बैंक", "bank"] },
    { panel: "galleryPanel", words: ["gallery", "photos", "photo", "गैलरी", "फोटो"] },
    { panel: "todoPanel", words: ["todo", "to do", "task", "tasks", "टूडू", "टास्क", "काम की लिस्ट"] },
    { panel: "qrPanel", words: ["qr", "qr code", "क्यूआर"] },
    { panel: "calcPanel", words: ["calculator", "calc", "कैलकुलेटर", "हिसाब"] },
    { panel: "converterPanel", words: ["converter", "unit convert", "कन्वर्टर", "नाप"] },
    { panel: "notesPanel", words: ["notes", "note", "नोट्स"] },
    { panel: "mediaPanel", words: ["media", "receipt scan", "पर्ची", "स्कैन"] },
    { panel: "staffPanel", words: ["staff", "employee invite", "कर्मचारी", "स्टाफ"] },
    { panel: "companiesPanel", words: ["companies", "multi company", "फर्म", "कंपनी"] },
    { panel: "myPlanPanel", words: ["my plan", "subscription", "plan", "प्लान"] },
    { panel: "helpPanel", words: ["help", "guide", "manual", "मदद", "गाइड"] }
  ];

  function norm(text) {
    return String(text || "").toLowerCase().replace(/[.,!?।]/g, " ").replace(/\s+/g, " ").trim();
  }

  function stripPunct(text) {
    return String(text || "").replace(/[.!?।,]/g, " ").replace(/\s+/g, " ").trim();
  }

  function cleanUtterance(raw) {
    return stripPunct(raw)
      .replace(/\biss\s*ko\b|\bisko\b|\bus\s*ko\b|\bthis\s+is\b|\bye\b|\bwo\b/gi, " ")
      .replace(/(?:इसको|उसको|मुझे|मेरे\s*को|ये|वो)\s*/gi, " ")
      .replace(/\b([a-zA-Z\u0900-\u097F]{2,20})\s+n\s+(?=ek\b)/gi, "$1 ne ")
      .replace(/\b([a-zA-Z\u0900-\u097F]{2,20})\s+n\s+/gi, "$1 ne ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /** Saaf Hindi/Hinglish — TTS ke liye emoji/symbol hatao */
  function cleanForSpeech(text) {
    return String(text || "")
      .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, "")
      .replace(/[✅❌📄🧾💼📅🤖🔊⚠️💡📲🖨️↗⭐🏢👤]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function shortForSpeech(text, maxLen) {
    const clean = cleanForSpeech(text);
    if (!clean) return "";
    const limit = maxLen || 220;
    if (clean.length <= limit) return clean;
    const cut = clean.slice(0, limit);
    const lastStop = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("?"), cut.lastIndexOf("।"));
    if (lastStop > 80) return cut.slice(0, lastStop + 1).trim();
    return cut.trim() + "...";
  }

  function bkVoiceSpeak(text) {
    const msg = shortForSpeech(text);
    if (!msg) return;
    if (typeof window._bkPauseVoiceForTts === "function") window._bkPauseVoiceForTts();
    const done = () => {
      if (typeof window._bkResumeVoiceAfterTts === "function") window._bkResumeVoiceAfterTts();
    };
    if (typeof window.speakText === "function") {
      window.speakText(msg, true, done);
      return;
    }
    try {
      if (!("speechSynthesis" in window)) { done(); return; }
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(msg);
      utter.lang = localStorage.getItem("bk_voice_lang") || "hi-IN";
      utter.rate = 1.02;
      utter.onend = done;
      utter.onerror = done;
      const voices = window.speechSynthesis.getVoices();
      const hindi = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("hi"));
      if (hindi) utter.voice = hindi;
      window.speechSynthesis.speak(utter);
    } catch (e) {
      done();
    }
  }

  function notify(msg, speak) {
    const display = msg || "";
    if (typeof showCommand === "function") {
      showCommand(display, { speak: speak === true });
    } else if (speak === true) {
      bkVoiceSpeak(display);
    }
    const hint = document.getElementById("voiceBufferHint");
    if (hint) hint.textContent = display;
    const status = document.getElementById("voiceStatus");
    if (status && display) status.textContent = display;
  }

  function getToken() {
    return localStorage.getItem("bk_token") || localStorage.getItem("token") || "";
  }

  function canOpenTab(panelId) {
    if (!panelId) return true;
    const me = window._bkAccountInfo;
    if (me && typeof window.bkCanAccessTab === "function") return window.bkCanAccessTab(me, panelId);
    return true;
  }

  function openTab(panelId, msg, speak) {
    if (!canOpenTab(panelId)) {
      notify("Yeh feature aapke plan ya role me allowed nahi hai.", speak === true);
      return false;
    }
    if (typeof openPanel === "function") openPanel(panelId);
    notify(msg || "Khol diya.", speak === true);
    return true;
  }

  function setEl(id, value) {
    const el = document.getElementById(id);
    if (!el || value == null || value === "") return;
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function capitalizeName(s) {
    if (!s) return "";
    return s.trim().replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function isAdd(text) {
    return /(?:add|save|submit|create|confirm|done|banao|bana do|kar do|kardo|jodo|jod do|save karo|save kero|save ker|add karo|add kero|add kro|add kar do|ऐड|जोड़|सेव|बनाओ|कर दो|करो|डालो|daal do)/i.test(text);
  }

  function isOpen(text) {
    return /(?:\b(open|kholo|khol|show|dikhao|dikha|go to|jao)\b|खोलो|खोल|दिखाओ|दिखा|ले जाओ|देखो|देख)/i.test(text);
  }

  function isQuestion(text) {
    if (typeof window.isInformationalQuestion === "function") {
      return window.isInformationalQuestion(text);
    }
    const n = norm(text);
    return n.includes("?") || /\b(kya|kaise|kese|what|how|batao|batado|bataiye|samjhao|explain)\b/.test(n);
  }

  function isSaleSentence(n) {
    return /ne\s+(?:ek\s+)?\w+.*(?:liya|liye|kharida|khareeda|purchase|li\b)|\bko\s+.*\b\d+\b.*(?:rupaye|rupees|rs|ka|me)\b|\b\d{3,9}\s*(?:ka|ke|ki|रूपये|rupees|rs|rupaye?)\s+(?:\w+)/i.test(n) ||
      /\bbill\b|invoice|बिल|इनवॉइस|खरीद|बेच|बनाओ|banao|banaa|banao/.test(n);
  }

  function cleanProductName(val) {
    return cleanFieldValue(val)
      .replace(/^\d+\s*(?:ka|ke|ki|rupees?|rs|rupaye?|रुपये?)\s+/i, "")
      .replace(/\s+\d+\s*(?:ka|ke|ki|rupees?|rs|rupaye?|रुपये?)\s*$/i, "")
      .replace(/\b(?:banao|banaa|banao|banana|bana|add karo|add kar do|add kero|bill banao|invoice banao|ग्राहक|customer|grahak|ko|ne|ek)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function looksLikeInvoiceFormUtterance(text) {
    const n = norm(cleanUtterance(text));
    if (!n) return false;
    if (/(?:invoice|bill|इनवॉइस|बिल)\s*(?:me|m|में)\b/i.test(n)) return true;
    if (/(?:costmer|customer|grahak|ग्राहक|buyer)\s+/i.test(n) && /(?:ne\s+ek|ko\s+ek|li\s*hai|liya|liye|product|item|\d+\s*(?:rupe|rupaye|rupees|rs))/i.test(n)) return true;
    return false;
  }

  function looksLikeInvoiceUtterance(text) {
    const n = norm(cleanUtterance(text));
    if (!n) return false;
    if (looksLikeInvoiceFormUtterance(text)) return true;
    if (document.querySelector(".panel.active")?.id === "invoicePanel" && /\d/.test(n)) return true;
    if (isSaleSentence(n)) return true;
    if (/\b(invoice|bill|product|item|price|qty|quantity|costmer|grahak|customer|ग्राहक|बिल|इनवॉइस|प्रोडक्ट)\b/i.test(n) && /\d/.test(n)) return true;
    if (new RegExp(`\\b(${PRODUCT_WORDS})\\b`, "i").test(n) && /\d/.test(n)) return true;
    if (/\b\d{1,9}\s*(?:ka|ke|ki|rupees?|rs|rupaye?|rupe|रुपये?)\b/i.test(n)) return true;
    return false;
  }

  function cleanFieldValue(val) {
    return String(val || "")
      .replace(/\s*(?:rakho|rakh do|rakhna|kar do|kardo|कर दो|रख दो|रखो|रखना|add kar do|ऐड कर दो|ऐड कर|usko|उसको|daal do|डाल दो|aaega|aayega|आएगा|rahega|rahegi|रहेगा|रहेगी|hoga|होगा)\s*$/gi, "")
      .replace(/^(?:hamara|hamari|हमारा|हमारी|naam|नाम)\s+/gi, "")
      .replace(/\s+(?:ka|ke|ki|hai|hain|hamara|hamari|है|हैं|का|के|की|हमारा|हमारी)\s*$/gi, "")
      .replace(/^(?:ek|the|a|an|एक)\s+/i, "")
      .trim();
  }

  function sanitizeShort(val, maxWords) {
    let v = cleanFieldValue(val);
    if (!v) return "";
    const limit = maxWords || 4;
    if (v.length > 45) return "";
    if (/(?:कस्टमर|ग्राहक|customer|बजट|budget|साइट|साइड|side|location|लोकेशन)\s/i.test(v) && v.length > 12) return "";
    const words = v.split(/\s+/).filter(Boolean);
    if (words.length > limit) v = words.slice(0, limit).join(" ");
    return v.trim();
  }

  const FIELD_BREAK = ["aur", "and", "और", "fir", "फिर", "phir", "then", "uske baad"];

  function extractTagged(text, startTags, endTags) {
    const start = startTags.join("|");
    const end = [...FIELD_BREAK, ...endTags].join("|");
    // NO \b — Hindi/Devanagari ke saath \b fail hota hai, poora sentence pakad leta hai
    const re = new RegExp(`(?:${start})\\s+(.+?)(?=\\s+(?:${end})(?:\\s|$)|$)`, "iu");
    const m = String(text || "").match(re);
    return m ? sanitizeShort(m[1], 4) : "";
  }

  function parseBudgetValue(text) {
    const t = String(text || "");
    let m = t.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lac|लाख|lakhs)/i);
    if (m) return String(Math.round(parseFloat(m[1]) * 100000));
    m = t.match(/(\d+(?:\.\d+)?)\s*(?:crore|cr|करोड़)/i);
    if (m) return String(Math.round(parseFloat(m[1]) * 10000000));
    m = t.match(/(\d+(?:\.\d+)?)\s*(?:hazaar|hazar|hajar|हज़ार|हजार|thousand)/i);
    if (m) return String(Math.round(parseFloat(m[1]) * 1000));
    m = t.match(/(?:budget|बजट|amount|राशि|kharcha|खर्च)[^0-9\u0966-\u096F]{0,35}(\d+(?:\.\d+)?)/iu);
    if (m) return m[1];
    m = t.match(/(?:hamara|हमारा)[^0-9]{0,20}(\d+(?:\.\d+)?)\s*(?:lakh|lac|लाख)/iu);
    if (m) return String(Math.round(parseFloat(m[1]) * 100000));
    m = t.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lac|लाख)/i);
    if (m) return String(Math.round(parseFloat(m[1]) * 100000));
    m = t.match(/(\d{4,9})/);
    return m ? m[1] : "";
  }

  function parseProjectFields(raw) {
    const t = cleanUtterance(raw);
    let name = "";
    let customer = "";
    let site = "";

    let m = t.match(/(?:project\s+)?(?:naam|name|नाम)\s+(?:hamara|हमारा)?\s*([\u0900-\u097Fa-zA-Z][\u0900-\u097Fa-zA-Z\s]{0,28}?)\s*(?:aaega|aayega|आएगा|rahega|रहेगा|hoga|होगा|hai|है|rakho|रखो|और|aur|कस्टमर|customer|ग्राहक)/iu);
    if (m) name = sanitizeShort(m[1], 3);

    m = t.match(/(?:customer|grahak|कस्टमर|ग्राहक)\s+(?:naam\s+)?(?:hamara|हमारा)?\s*([\u0900-\u097Fa-zA-Z][\u0900-\u097Fa-zA-Z\s]{0,22}?)\s*(?:rahega|रहेगा|hai|है|rakho|रखो|side|साइड|साइट|site|location|लोकेशन|budget|बजट)/iu);
    if (m) customer = sanitizeShort(m[1], 3);

    if (!customer) {
      m = t.match(/(?:कस्टमर|customer|ग्राहक)[\s\S]{0,40}?(?:naam|नाम)\s+(?:hamara|हमारा)?\s*([\u0900-\u097Fa-zA-Z]+)/iu);
      if (m) customer = sanitizeShort(m[1], 2);
    }

    m = t.match(/(?:site|साइट|साइड|side|location|लोकेशन|जगह)\s*(?:location\s+)?(?:hamari|हमारी|hamara|हमारा)?\s*([\u0900-\u097Fa-zA-Z]+?)\s*(?:rahegi|रहेगी|rahega|रहेगा|hai|है|budget|बजट|और|aur)/iu);
    if (m) site = sanitizeShort(m[1], 2);

    if (!name) {
      name = extractTagged(t,
        ["project naam", "project name", "project", "प्रोजेक्ट"],
        ["customer", "grahak", "ग्राहक", "कस्टमर", "client", "site", "साइट", "साइड", "side", "location", "लोकेशन", "budget", "बजट"]);
    }
    if (!customer) {
      customer = extractTagged(t,
        ["customer", "grahak", "ग्राहक", "कस्टमर", "client", "party", "मालिक"],
        ["site", "साइट", "साइड", "side", "location", "लोकेशन", "जगह", "budget", "बजट", "add", "save"]);
    }
    if (!site) {
      site = extractTagged(t,
        ["site", "साइट", "साइड", "side", "location", "लोकेशन", "जगह", "sthan", "स्थान"],
        ["budget", "बजट", "amount", "राशि", "add", "save", "note"]);
    }

    const budget = parseBudgetValue(t);
    const note = extractTagged(t, ["note", "टिप्पणी", "remark"], ["add", "save", "aur", "और"]);
    let status = "";
    if (/running|chalu|chal raha|चालू|प्रगति/.test(norm(t))) status = "running";
    else if (/completed|complete|poora|पूरा|khatam|खत्म/.test(norm(t))) status = "completed";
    else if (/planning|योजना/.test(norm(t))) status = "planning";
    return { name, customer, site, budget, note, status, save: /(?:add karo|add kar do|add kero|ऐड कर|जोड़ दो|save karo|जमा करो)/i.test(t) };
  }

  function projectFieldsInvalid(data) {
    const fields = [data.name, data.customer, data.site];
    return fields.some((v) => v && (v.length > 40 || /(?:कस्टमर|ग्राहक|बजट|साइड|लोकेशन).{8,}/i.test(v)));
  }

  async function parseFormWithAi(raw, formType) {
    const ai = await parseWithGemini(raw);
    if (!ai) return null;
    if (formType === "project") {
      if (isSaleSentence(norm(raw)) || ai.intent === "invoice" || ai.intent === "sale") return null;
      if (!(ai.intent === "project" || ai.projectName || (ai.site && ai.budget))) return null;
      return {
        name: sanitizeShort(cleanFieldValue(ai.projectName || ""), 3),
        customer: sanitizeShort(cleanFieldValue(ai.customer || ""), 3),
        site: sanitizeShort(cleanFieldValue(ai.site || ""), 2),
        budget: ai.budget ? String(ai.budget) : "",
        note: cleanFieldValue(ai.task || ""),
        status: "",
        save: ai.save !== false
      };
    }
    return null;
  }

  function looksLikeProjectUtterance(text) {
    const n = norm(text);
    if (isSaleSentence(n) || looksLikeInvoiceUtterance(text)) return false;
    if (/(?:total\s*sale|sales?\s+history|बिक्री|टोटल\s*सेल|कुल\s*बिक्री|expense|kharcha|खर्च|vendor|वेंडर|quick\s*expense)/i.test(n)) return false;
    if (/(?:search|सर्च|खोज|खोजो|ढूंढ|ढूंड|find|filter|निकाल)/i.test(n)) return false;
    if (/(?:product|item|invoice|bill|qty|price|hsn|gst|laptop|mobile|phone|plywood|cement|लैपटॉप|मोबाइल|सीमेंट)\b/i.test(n)) return false;
    if (/(?:project|प्रोजेक्ट)/i.test(n)) return true;
    if (/(?:budget|बजट)/i.test(n) && /(?:project|site|साइट|customer|grahak|ग्राहक)/i.test(n)) return true;
    if (/(?:site|साइट|साइड|side|location|लोकेशन)/i.test(n) && /(?:project|प्रोजेक्ट|budget|बजट)/i.test(n)) return true;
    if (/(?:customer|grahak|कस्टमर|ग्राहक)/i.test(n) && /(?:project|प्रोजेक्ट|site|साइट|budget|बजट)/i.test(n)) return true;
    if (/(?:project\s+)?(?:naam|नाम)\s+/i.test(n) && /(?:project|प्रोजेक्ट|budget|बजट|site|साइट|customer|grahak|ग्राहक)/i.test(n)) return true;
    if (/(?:हमारा|hamara|hamari)/i.test(n) && /(?:project|प्रोजेक्ट|budget|बजट|site|साइट)/i.test(n)) return true;
    return false;
  }

  function looksLikeSearchUtterance(text) {
    const n = norm(cleanUtterance(text));
    if (looksLikeInvoiceUtterance(text) || isSaleSentence(n)) return false;
    if (looksLikeTodoAddUtterance(text)) return false;
    if (looksLikeProjectUtterance(text)) return false;
    if (looksLikeExpenseUtterance(text)) return false;
    if (/(?:search\s*clear|clear\s*search|सर्च\s*हटा|खोज\s*हटा|खोज\s*साफ)/i.test(n)) return true;
    if (/(?:search|सर्च|खोज|खोजो|ढूंढ|ढूंड|find|filter|निकाल)/i.test(n)) return true;
    if (/(?:naam|name|नाम)\s+.+\s*(?:search|सर्च|खोज|ढूंढ)/i.test(n)) return true;
    if (/.+\s+(?:naam|name|नाम)\s+(?:search|सर्च|खोज|ढूंढ)/i.test(n)) return true;
    if (/.+\s+(?:search|सर्च|खोज|खोजो|ढूंढ|find|filter)\s*(?:karo|kero|keri|kari|kar|kro|करो|कर|kijiye|कीजिए)?$/i.test(n)) return true;
    if (/(?:english|hindi|inglish|इंग्लिश|हिंदी|अंग्रेजी)\s*(?:mein|में)/i.test(n) && /[\u0900-\u097F]{2,}|[A-Za-z]{2,}/.test(text)) return true;
    if (/^[\u0900-\u097F]{2,}\s*(?:khojo|खोजो|dikhao|दिखाओ)/i.test(n)) return true;
    return false;
  }

  function resolveSearchNavPanel(raw) {
    const nav = matchNavigation(raw);
    if (nav) return nav.panel;
    const n = norm(cleanUtterance(raw));
    if (/total\s*sale|टोटल\s*सेल|कुल\s*बिक्री|बिक्री/.test(n)) return "totalSalesPanel";
    if (/inventory|इन्वेंटरी|स्टॉक|\bstock\b/.test(n)) return "inventoryPanel";
    if (/media|gallery|गैलरी|फोटो/.test(n)) return "mediaPanel";
    return null;
  }

  function isCompoundNavSearch(raw) {
    if (!looksLikeSearchUtterance(raw)) return false;
    const n = norm(cleanUtterance(raw));
    const hasNav = /total\s*sales?|टोटल\s*सेल|कुल\s*बिक्री|inventory|इन्वेंटरी|(?:par|per)\s*(?:ja|jao|जा)|ja\s*kar|ja\s*ker|जा\s*कर/i.test(n);
    const hasSearch = /(?:search|सर्च|खोज|खोजो|naam|name|नाम)/i.test(n);
    return hasNav && hasSearch;
  }

  async function tryCompoundNavSearch(raw) {
    if (!isCompoundNavSearch(raw)) return false;
    if (typeof window.bkParseSearchQuery !== "function" || typeof window.bkVoiceSearch !== "function") return false;
    const parsed = window.bkParseSearchQuery(raw);
    if (!parsed) return false;
    const panel = resolveSearchNavPanel(raw) || "totalSalesPanel";
    if (!canOpenTab(panel)) {
      notify("Yeh feature aapke plan me allowed nahi hai.", true);
      return true;
    }
    const q = parsed.clear ? "" : parsed.query;
    return window.bkVoiceSearch(q, { clear: parsed.clear, panelId: panel });
  }

  async function trySearchVoice(raw) {
    if (!looksLikeSearchUtterance(raw)) return false;
    if (typeof window.bkParseSearchQuery !== "function" || typeof window.bkVoiceSearch !== "function") return false;
    const parsed = window.bkParseSearchQuery(raw);
    if (!parsed) {
      notify("Kya search karna hai? Jaise: laxmi search karo.", true);
      return true;
    }
    let panelId = resolveSearchNavPanel(raw);
    const activeId = document.querySelector(".panel.active")?.id;
    if (!panelId && activeId === "totalSalesPanel") panelId = "totalSalesPanel";
    if (!panelId && activeId === "inventoryPanel") panelId = "inventoryPanel";
    if (!panelId && !window.bkGetActiveSearchInput?.(activeId)) panelId = "totalSalesPanel";
    return window.bkVoiceSearch(parsed.clear ? "" : parsed.query, {
      clear: parsed.clear,
      panelId: panelId === activeId ? undefined : panelId
    });
  }

  function looksLikeExpenseUtterance(text) {
    const n = norm(text);
    return /(?:expense|kharcha|खर्च|खर्चा|vendor|वेंडर|supplier|quick\s*expense|expense\s+entry|राशि|दुकान|dukaan)/i.test(n) &&
      !/(?:project\s+naam|project\s+name|प्रोजेक्ट\s+नाम)/i.test(n);
  }

  function parseExpenseFields(raw) {
    const t = cleanUtterance(raw);
    let title = extractTagged(t,
      ["title", "expense title", "expense", "kharcha", "खर्च", "खर्चा"],
      ["vendor", "वेंडर", "supplier", "amount", "राशि", "project", "प्रोजेक्ट", "add", "save"]);
    let vendor = extractTagged(t,
      ["vendor", "supplier", "dealer", "वेंडर", "सप्लायर", "दुकान", "dukaan"],
      ["amount", "राशि", "project", "प्रोजेक्ट", "title", "expense", "add", "save"]);
    let amount = "";
    const am = t.match(/(?:amount|राशि|रुपये|रुपए|rs)\s*[:\-]?\s*(\d+(?:\.\d+)?)/iu) ||
      t.match(/(\d+(?:\.\d+)?)\s*(?:rupaye|rupees|rs|rupya|रुपये|रुपए|का|के)\b/iu);
    if (am) amount = am[1];
    else amount = parseBudgetValue(t);
    let project = extractTagged(t,
      ["project", "प्रोजेक्ट", "site", "साइट", "project ref", "project reference"],
      ["add", "save", "aur", "और", "vendor", "amount"]);
    if (!title && vendor) title = vendor + " Bill";
    return { title, vendor, amount, project, save: isAdd(t) };
  }

  async function tryExpenseVoice(raw) {
    if (!looksLikeExpenseUtterance(raw)) return false;
    const data = parseExpenseFields(raw);
    const hasData = !!(data.title || data.vendor || data.amount || data.project);
    const wantsAdd = isAdd(norm(raw)) || data.save;
    if (!hasData && !wantsAdd) return false;
    if (typeof window.handleExpenseSpeech === "function") {
      await window.handleExpenseSpeech(raw, data);
      return true;
    }
    return false;
  }

  function isExpenseIntent(t) {
    return /(?:expense|kharcha|खर्च|vendor|वेंडर|quick\s*expense|expense\s+entry|राशि)/i.test(t);
  }

  function isProjectIntent(t) {
    return /(?:project|प्रोजेक्ट|naam|नाम|customer|कस्टमर|site|साइट|budget|बजट)/i.test(t);
  }

  function hasExpenseFormData() {
    const amount = document.getElementById("expenseAmount")?.value?.trim();
    const vendor = document.getElementById("expenseVendor")?.value?.trim();
    const title = document.getElementById("expenseTitle")?.value?.trim();
    return !!(amount || vendor || title);
  }

  function hasProjectFormData() {
    const name = document.getElementById("projectName")?.value?.trim();
    const customer = document.getElementById("projectCustomer")?.value?.trim();
    return !!(name || customer);
  }

  async function tryProjectVoice(raw) {
    if (looksLikeInvoiceUtterance(raw) || isSaleSentence(norm(raw))) return false;
    if (!looksLikeProjectUtterance(raw)) return false;
    let data = parseProjectFields(raw);
    const weak = !data.name && !data.customer && !data.site && !data.budget;
    if (weak || projectFieldsInvalid(data)) {
      const ai = await parseFormWithAi(raw, "project");
      if (ai) {
        data = {
          name: sanitizeShort(ai.name, 3) || data.name,
          customer: sanitizeShort(ai.customer, 3) || data.customer,
          site: sanitizeShort(ai.site, 2) || data.site,
          budget: ai.budget || data.budget,
          note: data.note,
          status: data.status,
          save: ai.save
        };
      }
    }
    if (projectFieldsInvalid(data)) {
      data.name = sanitizeShort(data.name, 3);
      data.customer = sanitizeShort(data.customer, 3);
      data.site = sanitizeShort(data.site, 2);
    }
    if (!data.name && !data.customer && !data.site && !data.budget) return false;
    if (data.site && /^\d{4,9}$/.test(String(data.site).trim())) {
      if (!data.budget) data.budget = data.site;
      data.site = "";
    }
    if (typeof window.handleProjectSpeech === "function") {
      await window.handleProjectSpeech(raw, data);
      return true;
    }
    return false;
  }

  function parseStateAndPin(raw) {
    const t = norm(raw);
    let state = "";
    for (const [key, label] of INDIAN_STATES) {
      if (t.includes(key)) { state = label; break; }
    }
    const pin = raw.match(/(?:pincode|pin\s*code|पिन(?:\s*कोड)?)\s*(?:hai\s+)?(\d{4,6})\b/i)?.[1] ||
      raw.match(/\b(\d{6})\b/)?.[1] || "";
    return { state, pin };
  }

  function parsePriceFromText(t) {
    const priceBeforeAddress = t.split(/\b(?:address|addresh|addres|पता|pata|pincode|pin\s*code)\b/i)[0];
    return priceBeforeAddress.match(/(\d{1,9}(?:\.\d{1,2})?)\s*(?:rupaye|rupees|rs|rupya|rupe|रुपये|रुपए|रूपये?)\b/i)?.[1] ||
      priceBeforeAddress.match(/\b(\d{1,9})\s*(?:ka|ke|ki|का|के|की)\b/i)?.[1] || "";
  }

  function parseAddressAndPin(t) {
    let address = "";
    let pin = "";

    const combo = t.match(
      /(?:address|addresh|addres|पता|pata)\s+(?:uska|uski|iska|unka|hai\s+)?(.+?)\s+(?:pincode|pin\s*code|पिन(?:\s*कोड)?)\s*(?:hai\s+)?(\d{4,6})\b/i
    );
    if (combo) {
      address = cleanFieldValue(combo[1].replace(/\s+hai\s*$/i, "").trim());
      pin = combo[2];
      return { address, pin };
    }

    const pinOnly = t.match(/(?:pincode|pin\s*code|पिन(?:\s*कोड)?)\s*(?:hai\s+)?(\d{4,6})\b/i);
    if (pinOnly) pin = pinOnly[1];

    const addrM = t.match(
      /(?:address|addresh|addres|पता|pata)\s+(?:uska|uski|iska|unka|hai\s+)?(.+?)(?:\s+(?:pincode|pin\s*code|पिन(?:\s*कोड)?)\b|\s+(?:add|save|kero|karo|submit)\b|$)/i
    );
    if (addrM) {
      address = cleanFieldValue(addrM[1].replace(/\s+hai\s*$/i, "").trim());
    }

    if (address) {
      address = address
        .replace(/\s*(?:pincode|pin\s*code|पिन(?:\s*कोड)?)\s*(?:hai\s*)?\d{4,6}\b/gi, "")
        .replace(/\s+hai\s*$/i, "")
        .trim();
    }

    return { address, pin };
  }

  function extractProductFromSale(t) {
    const ekItem = t.match(/\bne\s+ek\s+([\u0900-\u097Fa-zA-Z][\u0900-\u097Fa-zA-Z0-9\s-]{0,30}?)\s+li\b/i);
    if (ekItem) return cleanProductName(ekItem[1].trim());
    const pm = t.match(new RegExp(`\\b(ek\\s+)?(${PRODUCT_WORDS})\\b`, "i"));
    if (pm) return cleanProductName(pm[2] || pm[1] || "");
    return "";
  }

  function parseSmartInvoice(raw) {
    const t = cleanUtterance(raw);
    const n = norm(t);
    const data = { customer: "", product: "", price: "", qty: "1", state: "", pin: "", address: "" };
    const loc = parseStateAndPin(t);
    data.state = loc.state;
    const addrPin = parseAddressAndPin(t);
    data.address = addrPin.address;
    data.pin = addrPin.pin || loc.pin;

    const priceAny = parsePriceFromText(t);

    const neSale =
      t.match(/([A-Za-z\u0900-\u097F]{2,25})\s+ne\s+(?:ek\s+)?(.+?)\s+(?:liya|liye|kharida|khareeda|purchase|li)\b/i) ||
      t.match(/([A-Za-z\u0900-\u097F]{2,25})\s+ne\s+(?:ek\s+)?(.+?)\s+(\d{1,9})\s*(?:rupaye|rupees|rs|rupya|rupe|ka|के|का)\b/i);

    if (neSale) {
      data.customer = capitalizeName(neSale[1]);
      data.product = cleanProductName(neSale[2].trim().replace(/^ek\s+/i, "").replace(/\s+(hai|se|from|haryana.*)$/i, "").trim());
      if (neSale[3] && /^\d+$/.test(neSale[3])) data.price = neSale[3];
    }

    if (!data.price && priceAny) data.price = priceAny;

    const kaProduct =
      t.match(/^([A-Za-z\u0900-\u097F]{2,25})\s+(\d{1,9})\s*(?:ka|ke|ki|rupees?|rs|rupaye?|रुपये?)\s+(.+?)(?:\s+(?:banao|banaa|banao|add|bill|invoice|karo|करो))?$/i) ||
      t.match(/(?:customer|costmer|grahak|ग्राहक)\s+([A-Za-z\u0900-\u097F]{2,25})\s+(\d{1,9})\s*(?:ka|ke|ki)\s+(.+?)(?:\s+(?:banao|banaa|banao|add))?$/i);
    if (kaProduct) {
      if (!data.customer) data.customer = capitalizeName(kaProduct[1]);
      if (!data.price) data.price = kaProduct[2];
      if (!data.product) data.product = cleanProductName(kaProduct[3]);
    }

    if (!data.product) {
      data.product = extractProductFromSale(t);
    }

    if (!data.customer) {
      const cm = t.match(/(?:customer|costmer|grahak|ग्राहक)\s+([A-Za-z\u0900-\u097F][\w\u0900-\u097F]{0,25})/i) ||
        t.match(/^([A-Za-z\u0900-\u097F]{2,20})\s+ne\b/i);
      if (cm) data.customer = capitalizeName(cm[1]);
    }

    const koSale = t.match(/([A-Za-z\u0900-\u097F]{2,25})\s+ko\s+(?:ek\s+)?(.+?)\s+(\d{1,9})\s*(?:rupaye|rupees|rs|rupya|रुपये|रुपए|rupe|ka|के|का|me)\b/i);
    if (koSale) {
      if (!data.customer) data.customer = capitalizeName(koSale[1]);
      if (!data.product) data.product = koSale[2].trim().replace(/^ek\s+/i, "").trim();
      if (!data.price) data.price = koSale[3];
    }

    const qm = t.match(/(?:qty|quantity|piece|pieces|नग|मात्रा)\s+(\d+)/i) ||
      t.match(/(\d+)\s*(?:piece|pieces|pcs|नग)\b/i);
    if (qm) data.qty = qm[1];

    const naturalSale = isSaleSentence(n);
    const hasSignal = !!(data.customer && data.product && data.price);
    const partialSale = !!(data.product && data.price && (data.customer || naturalSale));
    const formIntent = looksLikeInvoiceFormUtterance(raw);
    const weakInvoice = formIntent && data.customer && data.product;
    return { data, isInvoice: hasSignal || partialSale || weakInvoice, naturalSale };
  }

  async function parseWithGemini(raw) {
    const api = typeof API_URL !== "undefined" ? API_URL : window.location.origin;
    const token = getToken();
    if (!token) return null;
    try {
      const res = await fetch(`${api}/api/voice/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: raw })
      });
      const json = await res.json();
      if (json.success && json.parsed) return json.parsed;
    } catch (e) {
      console.warn("Voice AI parse skip:", e.message);
    }
    return null;
  }

  async function applyInvoiceData(data, raw, naturalSale) {
    openTab("invoicePanel", "Invoice bana raha hoon...");
    await new Promise((r) => setTimeout(r, 80));

    if (data.customer) setEl("customerName", data.customer);
    if (data.address) setEl("customerAddress", data.address);
    if (data.product) setEl("productName", data.product);
    if (data.price) setEl("productPrice", String(data.price));
    if (data.qty) setEl("productQty", String(data.qty));
    if (data.pin) setEl("buyerPincode", data.pin);
    if (data.state && typeof window.selectState === "function") window.selectState(data.state);
    else if (data.state) {
      setEl("buyerState", data.state);
      const st = document.getElementById("selectedStateText");
      if (st) st.textContent = data.state;
    }

    const n = norm(raw);
    const shouldSave = (isAdd(n) || naturalSale || data.save) && data.product && data.price;

    if (shouldSave && typeof executeInvoiceAdd === "function") {
      await new Promise((r) => setTimeout(r, 120));
      const ok = await executeInvoiceAdd();
      if (ok && typeof renderInvoice === "function") renderInvoice();
      notify(
        ok
          ? `Bill add ho gaya — ${data.customer || "Customer"}, ${data.product}, ₹${data.price}. Neeche invoice list me dekho.`
          : "Bill add nahi hua. Product aur price check karein.",
        true
      );
      return true;
    }

    notify(`Invoice bhara: ${data.customer || "-"}, ${data.product || "-"}, ₹${data.price || "-"}, Address: ${data.address || "-"}, Pin: ${data.pin || "-"}. Add karo boliye save ke liye.`, true);
    return true;
  }

  async function fillAndAddInvoice(raw) {
    let parsed = parseSmartInvoice(raw);
    if (!parsed.isInvoice) {
      const n = norm(cleanUtterance(raw));
      const invoiceIntent = looksLikeInvoiceUtterance(raw) || isSaleSentence(n) || looksLikeInvoiceFormUtterance(raw);
      if (invoiceIntent && /\d/.test(n)) {
        const ai = await parseWithGemini(raw);
        if (ai && (ai.intent === "invoice" || ai.intent === "sale" || ai.intent === "nav")) {
          if (ai.intent === "nav" && ai.panel) {
            return openTab(ai.panel, "Khol diya.");
          }
          parsed = {
            isInvoice: true,
            naturalSale: true,
            data: {
              customer: capitalizeName(ai.customer || ""),
              product: cleanProductName(ai.product || ""),
              price: String(ai.price || ""),
              qty: String(ai.qty || "1"),
              state: ai.state || "",
              pin: ai.pin || "",
              save: ai.save !== false
            }
          };
        }
      }
    }
    if (!parsed.isInvoice) return false;
    if (parsed.data.product) parsed.data.product = cleanProductName(parsed.data.product);
    return applyInvoiceData(parsed.data, raw, parsed.naturalSale);
  }

  function matchNavigation(raw) {
    const t = norm(cleanUtterance(raw));
    if (!t) return null;
    if (looksLikeTodoAddUtterance(raw)) return null;
    if (looksLikeInvoiceFormUtterance(raw)) return null;

    const openHint = isOpen(t) || /(?:kholo|khol|open|show|dikhao|jao|खोल)/i.test(t);
    const shortNav = t.split(" ").length <= 10;

    let best = null;
    let bestLen = 0;
    for (const item of NAV_INTENTS) {
      if (!canOpenTab(item.panel)) continue;
      for (const w of item.words) {
        const nw = norm(w);
        if (!nw) continue;
        if (t === nw || t.includes(nw)) {
          if (nw.length > bestLen) {
            bestLen = nw.length;
            best = item;
          }
        }
      }
    }

    if (best && (openHint || shortNav)) return best;

    if ((/total\s*sale|टोटल\s*सेल|कुल\s*बिक्री|sales?\s+history|बिक्री\s*रिपोर्ट/i.test(t) ||
        (/(?:\bsales?\b|सेल्स?|बिक्री)/i.test(t) && openHint)) && canOpenTab("totalSalesPanel")) {
      return { panel: "totalSalesPanel", words: ["Total Sales"] };
    }

    return null;
  }

  function tryNavigateVoice(raw) {
    const nav = matchNavigation(raw);
    if (!nav) return false;
    const label = nav.words[0];
    return openTab(nav.panel, `${label} khol diya.`, false);
  }

  function looksLikeTodoAddUtterance(raw) {
    const t = norm(cleanUtterance(raw));
    if (!/(?:\btodo\b|\btask\b|टूडू|टास्क|to do)/i.test(t)) return false;
    if (/^(?:todo|task|टूडू|टास्क|to do)(?:\s+(?:list|panel|tab|kholo|khol|open|show|dikhao))?\s*$/i.test(t)) return false;
    if (/^(?:open|kholo|khol|show|dikhao)\s+(?:todo|task|टूडू|टास्क)/i.test(t)) return false;
    if (isAdd(t) && /(?:todo|task|टूडू|टास्क)/i.test(t)) return true;
    if (/(?:todo|task|टूडू|टास्क)\s*(?:me|m|में)?\s+\S+/i.test(t) && !isOpen(t)) return true;
    if (/.+\s+(?:todo|task|टूडू|टास्क)\s*(?:me|में|m)?\s*(?:add|jodo|likho|save|सेव|जोड़)/i.test(t)) return true;
    return false;
  }

  function extractTodoTask(raw) {
    const t = cleanUtterance(raw);
    let task = "";
    let m = t.match(/(?:todo|task|टूडू|टास्क|to\s*do)\s*(?:me|m|में)?\s+(.+)/i);
    if (m) task = m[1];
    if (!task) {
      m = t.match(/(.+?)\s+(?:todo|task|टूडू|टास्क)\s*(?:me|में|m)?\s*(?:add|jodo|likho|save|सेव|जोड़)/i);
      if (m) task = m[1];
    }
    if (!task) return "";
    task = task
      .replace(/\s+(?:please\s+)?(?:save|add|submit|jodo|likho|daal|saev)(?:\s+(?:karo|kero|kro|ker|kar|do|lo|de|दो|करो|कर|लो))*\s*$/i, "")
      .replace(/^(?:add|save|jodo|likho|daal)(?:\s+(?:karo|kero|kro|lo|kar|ker|do))?\s+/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (/^(?:add|save|submit|jodo|likho|daal|lo|karo|kero|kro|ker|kar|do|de|करो|कर|लो|जोड़|सेव)(?:\s+(?:add|save|karo|kero|kro|lo|do|de|करो|कर|लो))*$/i.test(task)) {
      return "";
    }
    return task;
  }

  function tryTodoVoice(raw) {
    if (!looksLikeTodoAddUtterance(raw)) return false;
    const task = extractTodoTask(raw);
    if (!task || task.length < 2) {
      notify("Todo me kya likhna hai bolo — jaise 'todo kal cement lana add karo'.", true);
      return true;
    }
    openTab("todoPanel", null, false);
    const input = document.getElementById("todoInput");
    if (input) {
      input.value = task;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const t = norm(cleanUtterance(raw));
    if (isAdd(t) || /\b(likho|add|jodo|करो|जोड़|save|kero|karo)\b/.test(t)) {
      document.getElementById("addTodoBtn")?.click();
      notify(`Todo add ho gaya: ${task}`, true);
    } else {
      notify(`Todo likha: ${task}. Save ke liye 'add karo' boliye.`, true);
    }
    return true;
  }

  function tryThemeVoice(raw) {
    const t = norm(raw);
    if (/\bdark\s*mode\b|डार्क\s*मोड/.test(t) && /\b(on|on karo|चालू)\b/.test(t)) {
      document.getElementById("themeToggle")?.click();
      notify("Dark mode on.");
      return true;
    }
    if (/\blight\s*mode\b|लाइट\s*मोड/.test(t) && /\b(on|on karo|चालू)\b/.test(t)) {
      const btn = document.getElementById("themeToggle");
      if (btn && document.body.classList.contains("dark")) btn.click();
      notify("Light mode on.");
      return true;
    }
    return false;
  }

  function tryFaqAnswer(raw) {
    if (!isQuestion(raw)) return false;
    const faq = typeof window.matchAppFaq === "function" ? window.matchAppFaq(raw) : null;
    if (!faq) return false;
    notify(faq, true);
    const box = document.getElementById("aiReplyBox");
    if (box) box.textContent = faq;
    return true;
  }

  async function tryAiAnswer(raw) {
    if (!isQuestion(raw)) return false;
    const token = getToken();
    if (!token) return false;
    const api = typeof API_URL !== "undefined" ? API_URL : window.location.origin;
    notify("Soch raha hoon...", false);
    try {
      const history = typeof window.bkGetChatHistory === "function" ? window.bkGetChatHistory() : [];
      const res = await fetch(`${api}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: raw, history })
      });
      const data = await res.json();
      const reply = data?.reply;
      if (!reply) return false;
      notify(reply, true);
      const box = document.getElementById("aiReplyBox");
      if (box) box.textContent = reply;
      return true;
    } catch (e) {
      return false;
    }
  }

  async function tryStandaloneSave(raw) {
    const t = norm(cleanUtterance(raw));
    const short = t.split(/\s+/).length <= 8;
    const addLike = /(?:add|save|jodo|jod|ऐड|जोड़|सेव|करो|कर दो|बनाओ|submit|confirm|karo|kero|डालो|daal)/i.test(t);
    if (!short || !addLike) return false;

    const activePanel = document.querySelector(".panel.active")?.id;
    if (activePanel === "projectPanel") {
      const expenseFirst = isExpenseIntent(t) || (hasExpenseFormData() && !isProjectIntent(t));
      if (expenseFirst && typeof window.bkSaveActiveExpense === "function") {
        await window.bkSaveActiveExpense();
        return true;
      }
      if (typeof window.bkSaveActiveProject === "function") {
        await window.bkSaveActiveProject();
        return true;
      }
    }
    if (activePanel === "invoicePanel") {
      document.getElementById("addInvoiceBtn")?.click();
      notify("Invoice item add karne ki koshish ki.", true);
      return true;
    }
    if (activePanel === "todoPanel") {
      document.getElementById("addTodoBtn")?.click();
      notify("Todo add ho gaya.", true);
      return true;
    }
    return false;
  }

  async function tryFastAction(raw) {
    if (!raw || !raw.trim()) return false;
    const cleaned = cleanUtterance(raw);

    if (/voice\s*band|mic\s*band|सुनना\s*बंद|बंद\s*करो/i.test(cleaned)) {
      if (typeof stopVoice === "function") stopVoice();
      notify("Theek hai, voice band kar di.", true);
      return true;
    }
    if (/voice\s*on|mic\s*on|सुनो|सुनना\s*शुरू/i.test(cleaned)) {
      if (typeof startVoice === "function") startVoice();
      notify("Voice chalu. Poora sentence ek saath boliye.", true);
      return true;
    }

    if (await tryCompoundNavSearch(cleaned)) return true;

    if (looksLikeTodoAddUtterance(cleaned) && tryTodoVoice(cleaned)) return true;

    if (tryNavigateVoice(cleaned)) return true;

    if (looksLikeInvoiceUtterance(cleaned) && await fillAndAddInvoice(cleaned)) return true;

    if (looksLikeProjectUtterance(cleaned) && await tryProjectVoice(cleaned)) return true;
    if (looksLikeExpenseUtterance(cleaned) && await tryExpenseVoice(cleaned)) return true;

    if (await trySearchVoice(cleaned)) return true;

    if (await tryStandaloneSave(cleaned)) return true;

    if (tryThemeVoice(cleaned)) return true;
    if (await tryExpenseVoice(cleaned)) return true;
    if (await tryProjectVoice(cleaned)) return true;
    if (await fillAndAddInvoice(cleaned)) return true;

    if (tryFaqAnswer(cleaned)) return true;

    if (typeof window.parseCommands === "function" && window.parseCommands(raw)) return true;

    return false;
  }

  async function processVoice(raw) {
    if (await tryFastAction(raw)) return true;
    if (isQuestion(raw) && await tryAiAnswer(raw)) return true;
    return false;
  }

  window.bkVoiceSpeak = bkVoiceSpeak;
  window.bkVoiceController = {
    cleanUtterance,
    parseSmartInvoice,
    parseProjectFields,
    parseExpenseFields,
    parseFormWithAi,
    tryFastAction,
    processVoice,
    fillAndAddInvoice,
    looksLikeInvoiceUtterance,
    looksLikeInvoiceFormUtterance,
    cleanProductName,
    tryProjectVoice,
    tryExpenseVoice,
    tryNavigateVoice,
    tryCompoundNavSearch,
    trySearchVoice,
    looksLikeProjectUtterance,
    looksLikeExpenseUtterance,
    looksLikeSearchUtterance,
    looksLikeTodoAddUtterance,
    extractTodoTask,
    tryTodoVoice,
    isSaleSentence,
    matchNavigation,
    NAV_INTENTS
  };
})();
