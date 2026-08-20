/**
 * BolKarigar Voice Engine v3 — natural Hindi, ek saath poora sentence
 */
(function () {
  const INDIAN_STATES = [
    ["haryana", "Haryana"], ["delhi", "Delhi"], ["punjab", "Punjab"],
    ["uttar pradesh", "Uttar Pradesh"], ["rajasthan", "Rajasthan"], ["gujarat", "Gujarat"],
    ["maharashtra", "Maharashtra"], ["karnataka", "Karnataka"], ["tamil nadu", "Tamil Nadu"],
    ["bihar", "Bihar"], ["west bengal", "West Bengal"], ["madhya pradesh", "Madhya Pradesh"]
  ];

  const PRODUCT_WORDS = "laptop|mobile|phone|computer|cement|plywood|table|chair|fan|tv|fridge|ac|saman|maal|item|लैपटॉप|मोबाइल|सीमेंट|प्लाईवुड|सामान";

  function norm(text) {
    return String(text || "").toLowerCase().replace(/[.,!?।]/g, " ").replace(/\s+/g, " ").trim();
  }

  function stripPunct(text) {
    return String(text || "").replace(/[.!?।,]/g, " ").replace(/\s+/g, " ").trim();
  }

  /** Speech errors fix: "ram n ek" -> "ram ne ek", "iss ko" hatao */
  function cleanUtterance(raw) {
    return stripPunct(raw)
      .replace(/\biss\s*ko\b|\bisko\b|\bus\s*ko\b|\bthis\s+is\b|\bye\b|\bwo\b/gi, " ")
      .replace(/\b([a-zA-Z\u0900-\u097F]{2,20})\s+n\s+(?=ek\b)/gi, "$1 ne ")
      .replace(/\b([a-zA-Z\u0900-\u097F]{2,20})\s+n\s+/gi, "$1 ne ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function notify(msg, speakShort) {
    if (typeof showCommand === "function") showCommand(msg);
    const hint = document.getElementById("voiceBufferHint");
    if (hint) hint.textContent = msg;
    if (speakShort && typeof speakText === "function") speakText(msg);
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
      notify("Yeh feature aapke plan me nahi hai.");
      return false;
    }
    if (typeof openPanel === "function") openPanel(panelId);
    notify(msg);
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
    return /\b(add|save|submit|create|confirm|done|banao|bana do|kar do|kardo|jodo|jod do|save karo|add karo|add kar do|जोड़|सेव|बनाओ|कर दो|करो|डालो|daal do)\b/.test(text);
  }

  function isOpen(text) {
    return /\b(open|kholo|khol|show|dikhao|dikha|go to|खोल|दिखा)\b/.test(text);
  }

  function isSaleSentence(n) {
    return /ne\s+(?:ek\s+)?\w+.*(?:liya|liye|kharida|khareeda|purchase|li\b)|\bko\s+.*\b\d+\b.*(?:rupaye|rupees|rs|ka|me)\b|\bbill\b|invoice|बिल|इनवॉइस|खरीद|बेच/.test(n);
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
      console.warn("Gemini voice parse skip:", e.message);
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
      notify(ok ? `✅ Bill add — ${data.customer}: ${data.product} ₹${data.price}` : "❌ Bill add fail — product/price check karein.", ok);
      return true;
    }

    notify(`Bhara: ${data.customer}, ${data.product}, ₹${data.price}. "Add karo" boliye save ke liye.`);
    return true;
  }

  async function fillAndAddInvoice(raw) {
    let parsed = parseSmartInvoice(raw);
    if (!parsed.isInvoice) {
      const n = norm(cleanUtterance(raw));
      if (isSaleSentence(n) && /\d{3,}/.test(n)) {
        const ai = await parseWithGemini(raw);
        if (ai && (ai.intent === "invoice" || ai.intent === "sale")) {
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

  const NAV_INTENTS = [
    { panel: "overviewPanel", words: ["overview", "dashboard", "home", "होम", "डैशबोर्ड"] },
    { panel: "invoicePanel", words: ["invoice kholo", "invoice", "bill kholo", "बिल खोल", "इनवॉइस"] },
    { panel: "todoPanel", words: ["todo", "to do", "task", "टूडू", "टास्क"] },
    { panel: "ledgerPanel", words: ["udhar khata", "udhar", "उधार"] },
    { panel: "inventoryPanel", words: ["inventory", "stock", "स्टॉक", "इन्वेंटरी"] },
    { panel: "helpPanel", words: ["help", "guide", "मदद", "गाइड"] },
    { panel: "galleryPanel", words: ["gallery", "photos", "गैलरी"] },
    { panel: "khataVoucherPanel", words: ["voucher", "वाउचर"] },
    { panel: "totalSalesPanel", words: ["total sales", "sales history", "बिक्री"] }
  ];

  function matchNavigation(raw) {
    const t = norm(raw);
    if (!t || t.split(" ").length > 6) return null;
    if (!isOpen(t) && !/^(invoice|todo|udhar|help|gallery|stock|bill|home)$/i.test(t.trim())) return null;
    for (const item of NAV_INTENTS) {
      for (const w of item.words) {
        if (t === norm(w) || t.includes(norm(w))) return item;
      }
    }
    return null;
  }

  async function tryFastAction(raw) {
    if (!raw || !raw.trim()) return false;
    const cleaned = cleanUtterance(raw);

    if (/voice\s*band|mic\s*band|सुनना\s*बंद/i.test(cleaned)) {
      if (typeof stopVoice === "function") stopVoice();
      notify("Voice band.");
      return true;
    }
    if (/voice\s*on|mic\s*on/i.test(cleaned)) {
      if (typeof startVoice === "function") startVoice();
      notify("Voice ON — poora sentence ek saath boliye.");
      return true;
    }

    if (await fillAndAddInvoice(cleaned)) return true;

    const nav = matchNavigation(cleaned);
    if (nav) {
      openTab(nav.panel, "Khol diya.");
      return true;
    }
    return false;
  }

  window.bkVoiceController = {
    cleanUtterance,
    parseSmartInvoice,
    tryFastAction,
    isSaleSentence
  };
})();
