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

  const PRODUCT_WORDS = "laptop|mobile|phone|computer|cement|plywood|table|chair|fan|tv|fridge|ac|saman|maal|item|लैपटॉप|मोबाइल|सीमेंट|प्लाईवुड|सामान";

  const NAV_INTENTS = [
    { panel: "overviewPanel", words: ["overview", "dashboard", "home", "डैशबोर्ड", "होम", "summary", "सारांश"] },
    { panel: "invoicePanel", words: ["invoice", "bill", "billing", "इनवॉइस", "बिल", "बिलिंग", "रसीद"] },
    { panel: "voicePanel", words: ["voice ai", "voice panel", "वॉइस", "माइक"] },
    { panel: "projectPanel", words: ["project", "projects", "site", "प्रोजेक्ट", "साइट", "ठेकेदारी"] },
    { panel: "inventoryPanel", words: ["inventory", "stock", "स्टॉक", "इन्वेंटरी", "सामान"] },
    { panel: "totalSalesPanel", words: ["total sales", "sales history", "बिक्री", "sales report"] },
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

  function openTab(panelId, msg) {
    if (!canOpenTab(panelId)) {
      notify("Yeh feature aapke plan ya role me allowed nahi hai.", true);
      return false;
    }
    if (typeof openPanel === "function") openPanel(panelId);
    notify(msg || "Khol diya.", true);
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
    return /(?:add|save|submit|create|confirm|done|banao|bana do|kar do|kardo|jodo|jod do|save karo|add karo|add kero|add kar do|ऐड|जोड़|सेव|बनाओ|कर दो|करो|डालो|daal do)/i.test(text);
  }

  function isOpen(text) {
    return /\b(open|kholo|khol|show|dikhao|dikha|go to|jao|ले जाओ|खोल|दिखा|दिखाओ)\b/.test(text);
  }

  function isQuestion(text) {
    if (typeof window.isInformationalQuestion === "function") {
      return window.isInformationalQuestion(text);
    }
    const n = norm(text);
    return n.includes("?") || /\b(kya|kaise|kese|what|how|batao|batado|bataiye|samjhao|explain)\b/.test(n);
  }

  function isSaleSentence(n) {
    return /ne\s+(?:ek\s+)?\w+.*(?:liya|liye|kharida|khareeda|purchase|li\b)|\bko\s+.*\b\d+\b.*(?:rupaye|rupees|rs|ka|me)\b|\bbill\b|invoice|बिल|इनवॉइस|खरीद|बेच/.test(n);
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
        ["naam", "name", "नाम", "project naam", "project name", "project", "प्रोजेक्ट"],
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
    if (formType === "project" && (ai.intent === "project" || ai.projectName || ai.site || ai.budget)) {
      return {
        name: cleanFieldValue(ai.projectName || ai.product || ""),
        customer: cleanFieldValue(ai.customer || ""),
        site: cleanFieldValue(ai.site || ""),
        budget: ai.budget ? String(ai.budget) : (ai.price ? String(ai.price) : ""),
        note: cleanFieldValue(ai.task || ""),
        status: "",
        save: ai.save !== false
      };
    }
    return null;
  }

  function looksLikeProjectUtterance(text) {
    const n = norm(text);
    return /(?:project|naam|name|customer|grahak|site|side|budget|प्रोजेक्ट|नाम|कस्टमर|ग्राहक|साइट|साइड|बजट|लोकेशन|रखो|rakho|हमारा)/i.test(n) &&
      !/(?:product|item|invoice|bill|qty|price|hsn|gst)\b/.test(n);
  }

  async function tryProjectVoice(raw) {
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
    const pin = raw.match(/(?:pincode|pin\s*code|पिन(?:\s*कोड)?)\s*(\d{6})/i)?.[1] ||
      raw.match(/\b(\d{6})\b/)?.[1] || "";
    return { state, pin };
  }

  function parseSmartInvoice(raw) {
    const t = cleanUtterance(raw);
    const n = norm(t);
    const data = { customer: "", product: "", price: "", qty: "1", state: "", pin: "" };
    const loc = parseStateAndPin(t);
    data.state = loc.state;
    data.pin = loc.pin;

    const priceAny = t.match(/(\d{3,9})\s*(?:rupaye|rupees|rs|rupya|रुपये|रुपए|ka|के|का)\b/i)?.[1] ||
      t.match(/\b(\d{4,9})\b/)?.[1] || "";

    const neSale =
      t.match(/([A-Za-z\u0900-\u097F]{2,25})\s+ne\s+(?:ek\s+)?(.+?)\s+(?:liya|liye|kharida|khareeda|purchase|li)\b/i) ||
      t.match(/([A-Za-z\u0900-\u097F]{2,25})\s+ne\s+(?:ek\s+)?(.+?)\s+(\d{3,9})\s*(?:rupaye|rupees|rs|ka|के|का)\b/i);

    if (neSale) {
      data.customer = capitalizeName(neSale[1]);
      data.product = neSale[2].trim().replace(/^ek\s+/i, "").replace(/\s+(hai|se|from|haryana.*)$/i, "").trim();
      if (neSale[3] && /^\d+$/.test(neSale[3])) data.price = neSale[3];
    }

    if (!data.price && priceAny) data.price = priceAny;

    if (!data.product) {
      const pm = t.match(new RegExp(`\\b(ek\\s+)?(${PRODUCT_WORDS})\\b`, "i"));
      if (pm) data.product = (pm[2] || pm[1] || "").trim();
    }

    if (!data.customer) {
      const cm = t.match(/(?:customer|grahak|ग्राहक)\s+([A-Za-z\u0900-\u097F][\w\u0900-\u097F]{0,25})/i) ||
        t.match(/^([A-Za-z\u0900-\u097F]{2,20})\s+ne\b/i);
      if (cm) data.customer = capitalizeName(cm[1]);
    }

    const koSale = t.match(/([A-Za-z\u0900-\u097F]{2,25})\s+ko\s+(?:ek\s+)?(.+?)\s+(\d{2,9})\s*(?:rupaye|rupees|rs|rupya|रुपये|रुपए|ka|के|का|me)\b/i);
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
    return { data, isInvoice: hasSignal && naturalSale, naturalSale };
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
      notify(ok ? `Bill add ho gaya. ${data.customer}, ${data.product}, ${data.price} rupaye.` : "Bill add nahi hua. Product aur price check karein.", true);
      return true;
    }

    notify(`Invoice bhara: ${data.customer}, ${data.product}, ${data.price} rupaye. Add karo boliye save ke liye.`, true);
    return true;
  }

  async function fillAndAddInvoice(raw) {
    let parsed = parseSmartInvoice(raw);
    if (!parsed.isInvoice) {
      const n = norm(cleanUtterance(raw));
      if ((isSaleSentence(n) || /\b(customer|grahak|bill|invoice)\b/.test(n)) && /\d{2,}/.test(n)) {
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
              product: ai.product || "",
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
    return applyInvoiceData(parsed.data, raw, parsed.naturalSale);
  }

  function matchNavigation(raw) {
    const t = norm(raw);
    if (!t) return null;

    const openHint = isOpen(t) || /\b(kholo|khol|open|show|dikhao|jao)\b/.test(t);
    const shortNav = t.split(" ").length <= 8;

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

    if (best && (openHint || shortNav || t.split(" ").length <= 4)) return best;
    return null;
  }

  function tryTodoVoice(raw) {
    const t = norm(raw);
    const todoMatch = raw.match(/(?:todo|task|टूडू|टास्क)\s*(?:me|में|m)?\s+(.+)/i) ||
      raw.match(/(.+?)\s+(?:todo|task)\s*(?:me|में)?\s*(?:add|jodo|likho|लिख)/i);
    if (!todoMatch) return false;
    const task = todoMatch[1].replace(/\b(add|jodo|likho|karo|करो|जोड़)\b/gi, "").trim();
    if (!task || task.length < 2) return false;
    openTab("todoPanel", "Todo khol raha hoon...");
    const input = document.getElementById("todoInput");
    if (input) {
      input.value = task;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (isAdd(t) || /\b(likho|add|jodo|करो|जोड़)\b/.test(t)) {
      document.getElementById("addTodoBtn")?.click();
      notify(`Todo add ho gaya: ${task}`);
    } else {
      notify(`Todo likha: ${task}. Add karo boliye save ke liye.`);
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
      const res = await fetch(`${api}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: raw })
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
    const short = t.split(/\s+/).length <= 6;
    const addLike = /(?:add|save|jodo|jod|ऐड|जोड़|सेव|करो|कर दो|बनाओ|submit|confirm|karo|kero)/i.test(t);
    if (!short || !addLike) return false;

    const activePanel = document.querySelector(".panel.active")?.id;
    if (activePanel === "projectPanel" && typeof window.bkSaveActiveProject === "function") {
      await window.bkSaveActiveProject();
      return true;
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

    if (await tryStandaloneSave(cleaned)) return true;

    if (tryThemeVoice(cleaned)) return true;
    if (tryTodoVoice(cleaned)) return true;
    if (await tryProjectVoice(cleaned)) return true;
    if (await fillAndAddInvoice(cleaned)) return true;

    const nav = matchNavigation(cleaned);
    if (nav) {
      const label = nav.words[0];
      return openTab(nav.panel, `${label} khol diya.`);
    }

    if (tryFaqAnswer(cleaned)) return true;

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
    parseFormWithAi,
    tryFastAction,
    processVoice,
    tryProjectVoice,
    looksLikeProjectUtterance,
    isSaleSentence,
    matchNavigation,
    NAV_INTENTS
  };
})();
