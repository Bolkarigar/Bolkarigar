/**
 * BolKarigar — Business Card Maker (Khatabook-style)
 * 12 Free + 25 Premium designs | Form editor | Download | WhatsApp Share
 */
(function () {
  const STORAGE_KEY = "bolkarigar_business_card";
  const FREE_COUNT = 12;
  const PREMIUM_COUNT = 25;

  const DESIGNATIONS = [
    "Owner", "Proprietor", "Director", "Partner", "Manager",
    "Sales Executive", "Accountant", "Contractor", "Other"
  ];
  const SHOP_TYPES = ["Shop", "Office", "Shop & Office"];
  const CATEGORIES = [
    "Retail", "Wholesale", "Manufacturing", "Services", "Contractor",
    "Restaurant", "Medical", "Electronics", "Grocery", "Other"
  ];

  /* ── Template definitions ── */
  const FREE_TEMPLATES = [
    { id: "f01", name: "Classic White", bg: "#ffffff", accent: "#2563eb", text: "#1e293b", layout: "classic", pattern: "none" },
    { id: "f02", name: "Ocean Blue", bg: "#1e40af", accent: "#93c5fd", text: "#ffffff", layout: "modern", pattern: "dots" },
    { id: "f03", name: "Forest Green", bg: "#14532d", accent: "#86efac", text: "#ffffff", layout: "classic", pattern: "none" },
    { id: "f04", name: "Sunset Orange", bg: "#ea580c", accent: "#fed7aa", text: "#ffffff", layout: "wave", pattern: "none" },
    { id: "f05", name: "Royal Purple", bg: "#6b21a8", accent: "#e9d5ff", text: "#ffffff", layout: "split", pattern: "none" },
    { id: "f06", name: "Minimal Dark", bg: "#0f172a", accent: "#38bdf8", text: "#f8fafc", layout: "minimal", pattern: "lines" },
    { id: "f07", name: "Teal Gradient", bg: "linear-gradient(135deg,#0d9488,#0891b2)", accent: "#ccfbf1", text: "#ffffff", layout: "classic", pattern: "none" },
    { id: "f08", name: "Coral Pink", bg: "#be185d", accent: "#fbcfe8", text: "#ffffff", layout: "modern", pattern: "dots" },
    { id: "f09", name: "Slate Pro", bg: "#334155", accent: "#94a3b8", text: "#f1f5f9", layout: "classic", pattern: "none" },
    { id: "f10", name: "Golden Accent", bg: "#fffbeb", accent: "#d97706", text: "#78350f", layout: "modern", pattern: "none" },
    { id: "f11", name: "Sky Light", bg: "#e0f2fe", accent: "#0284c7", text: "#0c4a6e", layout: "wave", pattern: "none" },
    { id: "f12", name: "Mint Fresh", bg: "#ecfdf5", accent: "#059669", text: "#064e3b", layout: "classic", pattern: "dots" }
  ];

  const PREMIUM_TEMPLATES = [
    { id: "p01", name: "Black Gold Executive", bg: "linear-gradient(145deg,#050505,#1c1c1c)", accent: "#d4af37", text: "#fafaf9", layout: "lux-gold", pattern: "frame-gold", font: "serif" },
    { id: "p02", name: "Platinum Noir", bg: "linear-gradient(160deg,#0f0f10,#2d2d30)", accent: "#e5e7eb", text: "#f9fafb", layout: "lux-noir", pattern: "corners", font: "serif" },
    { id: "p03", name: "Rose Gold Atelier", bg: "linear-gradient(135deg,#2a0a14,#4c0519)", accent: "#e8b4b8", text: "#fff1f2", layout: "lux-vertical", pattern: "foil", font: "serif" },
    { id: "p04", name: "Sapphire Dynasty", bg: "linear-gradient(165deg,#020617,#1e3a8a)", accent: "#c9a227", text: "#eff6ff", layout: "lux-geometric", pattern: "geometric-lux", font: "serif" },
    { id: "p05", name: "Emerald Heritage", bg: "linear-gradient(145deg,#022c22,#064e3b)", accent: "#d4af37", text: "#ecfdf5", layout: "lux-boutique", pattern: "botanical", font: "serif" },
    { id: "p06", name: "Champagne Reserve", bg: "linear-gradient(180deg,#1c1917,#292524)", accent: "#fcd34d", text: "#fef3c7", layout: "lux-gold", pattern: "frame-gold", font: "serif" },
    { id: "p07", name: "Ivory Marble Luxe", bg: "linear-gradient(135deg,#fafaf9,#e7e5e4,#d6d3d1)", accent: "#a16207", text: "#1c1917", layout: "lux-marble", pattern: "marble-lux", font: "serif" },
    { id: "p08", name: "Velvet Burgundy", bg: "linear-gradient(135deg,#3b0514,#450a0a)", accent: "#f5d0c5", text: "#fef2f2", layout: "lux-vertical", pattern: "corners", font: "serif" },
    { id: "p09", name: "Carbon Elite", bg: "linear-gradient(145deg,#000,#18181b)", accent: "#22d3ee", text: "#ecfeff", layout: "lux-noir", pattern: "geometric-lux", font: "sans" },
    { id: "p10", name: "Pearl & Gold", bg: "linear-gradient(135deg,#ffffff,#f5f5f4)", accent: "#b8860b", text: "#292524", layout: "lux-marble", pattern: "frame-gold", font: "serif" },
    { id: "p11", name: "Copper Royal", bg: "linear-gradient(135deg,#1a0a00,#7c2d12)", accent: "#fdba74", text: "#fff7ed", layout: "lux-foil", pattern: "foil", font: "serif" },
    { id: "p12", name: "Indigo Prestige", bg: "linear-gradient(135deg,#1e1b4b,#312e81)", accent: "#fde68a", text: "#eef2ff", layout: "lux-geometric", pattern: "corners", font: "serif" },
    { id: "p13", name: "Sunset Couture", bg: "linear-gradient(135deg,#431407,#9a3412)", accent: "#fef08a", text: "#ffffff", layout: "lux-gold", pattern: "foil", font: "serif" },
    { id: "p14", name: "Diamond Noir", bg: "#030712", accent: "#ffffff", text: "#f8fafc", layout: "lux-noir", pattern: "frame-gold", font: "serif" },
    { id: "p15", name: "Jade Imperial", bg: "linear-gradient(145deg,#042f2e,#115e59)", accent: "#fcd34d", text: "#f0fdfa", layout: "lux-boutique", pattern: "botanical", font: "serif" },
    { id: "p16", name: "Blush Maison", bg: "linear-gradient(135deg,#500724,#831843)", accent: "#fbcfe8", text: "#fdf2f8", layout: "lux-vertical", pattern: "marble-lux", font: "serif" },
    { id: "p17", name: "Steel Magnate", bg: "linear-gradient(180deg,#27272a,#52525b)", accent: "#d4d4d8", text: "#fafafa", layout: "lux-platinum", pattern: "corners", font: "sans" },
    { id: "p18", name: "Aurora Prestige", bg: "linear-gradient(135deg,#0f172a,#4c1d95,#0e7490)", accent: "#fde047", text: "#f0f9ff", layout: "lux-foil", pattern: "geometric-lux", font: "serif" },
    { id: "p19", name: "Wine Cellar", bg: "linear-gradient(145deg,#2d0610,#4c0519)", accent: "#d4af37", text: "#ffe4e6", layout: "lux-gold", pattern: "botanical", font: "serif" },
    { id: "p20", name: "Cream Executive", bg: "linear-gradient(135deg,#fffbeb,#fef3c7,#fde68a)", accent: "#92400e", text: "#451a03", layout: "lux-marble", pattern: "frame-gold", font: "serif" },
    { id: "p21", name: "Titanium CEO", bg: "linear-gradient(135deg,#3f3f46,#18181b)", accent: "#a1a1aa", text: "#fafafa", layout: "lux-platinum", pattern: "geometric-lux", font: "sans" },
    { id: "p22", name: "Crimson Legacy", bg: "linear-gradient(135deg,#450a0a,#991b1b)", accent: "#fde68a", text: "#ffffff", layout: "lux-vertical", pattern: "foil", font: "serif" },
    { id: "p23", name: "Ocean Royale", bg: "linear-gradient(160deg,#042f2e,#0c4a6e,#1e3a8a)", accent: "#d4af37", text: "#ecfeff", layout: "lux-geometric", pattern: "frame-gold", font: "serif" },
    { id: "p24", name: "Golden Horizon Luxe", bg: "linear-gradient(135deg,#422006,#a16207,#ca8a04)", accent: "#fffbeb", text: "#ffffff", layout: "lux-foil", pattern: "foil", font: "serif" },
    { id: "p25", name: "Obsidian Crown", bg: "linear-gradient(145deg,#000,#0a0a0a,#171717)", accent: "#d4af37", text: "#fef3c7", layout: "lux-gold", pattern: "frame-gold", font: "serif" }
  ];

  const ALL_TEMPLATES = [
    ...FREE_TEMPLATES.map((t) => ({ ...t, tier: "free" })),
    ...PREMIUM_TEMPLATES.map((t) => ({ ...t, tier: "premium" }))
  ];

  let currentTier = "free";
  let currentTemplateId = FREE_TEMPLATES[0].id;
  let html2canvasLoaded = false;

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s || "";
    return d.innerHTML;
  }

  function getProfileDefaults() {
    try {
      const p = JSON.parse(localStorage.getItem("bolkarigar_company_profile") || "{}");
      return {
        name: p.ownerName || p.name || "",
        businessName: p.name || "",
        mobile: (p.phone || "").replace(/^\+91/, "").replace(/\D/g, "").slice(-10),
        email: p.email || "",
        gst: p.gstin || "",
        address: p.address || "",
        designation: "Owner",
        shopType: "Shop",
        category: "Retail"
      };
    } catch {
      return { name: "", businessName: "", mobile: "", email: "", gst: "", address: "", designation: "Owner", shopType: "Shop", category: "Retail" };
    }
  }

  function loadSavedData() {
    try {
      return { ...getProfileDefaults(), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
    } catch {
      return getProfileDefaults();
    }
  }

  function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function getFormData() {
    return {
      name: document.getElementById("bcName")?.value?.trim() || "",
      designation: document.getElementById("bcDesignation")?.value || "Owner",
      mobile: document.getElementById("bcMobile")?.value?.replace(/\D/g, "").slice(-10) || "",
      businessName: document.getElementById("bcBusinessName")?.value?.trim() || "",
      shopType: document.getElementById("bcShopType")?.value || "Shop",
      email: document.getElementById("bcEmail")?.value?.trim() || "",
      category: document.getElementById("bcCategory")?.value || "Retail",
      gst: document.getElementById("bcGst")?.value?.trim() || "",
      address: document.getElementById("bcAddress")?.value?.trim() || ""
    };
  }

  function fillForm(data) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ""; };
    set("bcName", data.name);
    set("bcDesignation", data.designation);
    set("bcMobile", data.mobile);
    set("bcBusinessName", data.businessName);
    set("bcShopType", data.shopType);
    set("bcEmail", data.email);
    set("bcCategory", data.category);
    set("bcGst", data.gst);
    set("bcAddress", data.address);
  }

  function getInitial(name) {
    return (name || "B").charAt(0).toUpperCase();
  }

  function luxFont(tpl) {
    return tpl.font === "sans"
      ? "'Segoe UI', system-ui, -apple-system, sans-serif"
      : "Georgia, 'Times New Roman', Times, serif";
  }

  function luxIcon(type, color) {
    const base = `width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
    if (type === "phone") return `<svg ${base}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>`;
    if (type === "email") return `<svg ${base}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`;
    if (type === "pin") return `<svg ${base}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
    if (type === "gst") return `<svg ${base}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h10M7 12h10M7 17h6"/></svg>`;
    return "";
  }

  function renderLuxQR(data, accent, size) {
    const sz = size || 100;
    const seed = (data.mobile || data.businessName || "bk").split("").reduce((n, c) => n + c.charCodeAt(0), 0);
    let dots = "";
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if ((r < 3 && c < 3) || (r < 3 && c > 4) || (r > 4 && c < 3)) continue;
        if (((seed + r * 17 + c * 31) % 4) > 0) {
          dots += `<rect x="${6 + c * 4}" y="${6 + r * 4}" width="3" height="3" fill="${accent}" opacity="0.85"/>`;
        }
      }
    }
    return `<svg width="${sz}" height="${sz}" viewBox="0 0 44 44" style="display:block;background:#fff;border:1px solid ${accent}88;border-radius:6px;padding:3px;box-shadow:0 2px 8px rgba(0,0,0,0.15)">
      <rect x="2" y="2" width="12" height="12" rx="1" fill="${accent}"/>
      <rect x="30" y="2" width="12" height="12" rx="1" fill="${accent}"/>
      <rect x="2" y="30" width="12" height="12" rx="1" fill="${accent}"/>
      <rect x="5" y="5" width="6" height="6" fill="#fff"/>
      <rect x="33" y="5" width="6" height="6" fill="#fff"/>
      <rect x="5" y="33" width="6" height="6" fill="#fff"/>
      ${dots}
    </svg>`;
  }

  function renderLuxQRBlock(data, accent, size) {
    const sz = size || 100;
    const a = accent;
    return `<div style="text-align:center;background:${a}12;border:1px solid ${a}44;border-radius:8px;padding:10px 12px">
      ${renderLuxQR(data, a, sz)}
      <div style="font-size:8px;letter-spacing:2.5px;color:${a};margin-top:6px;opacity:0.8;font-weight:700">SCAN TO CONTACT</div>
    </div>`;
  }

  function renderLuxContactRow(label, value, iconType, accent, textColor) {
    if (!value) return "";
    return `<div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px">
      <div style="width:34px;height:34px;min-width:34px;border:1px solid ${accent}66;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${accent}14">${luxIcon(iconType, accent)}</div>
      <div style="min-width:0">
        <div style="font-size:9px;letter-spacing:2.5px;color:${accent};font-weight:700;margin-bottom:3px">${label}</div>
        <div style="font-size:16px;font-weight:600;color:${textColor};line-height:1.35;word-break:break-word">${value}</div>
      </div>
    </div>`;
  }

  function renderLuxEmblem(initial, tpl) {
    const a = tpl.accent;
    const layout = tpl.layout || "lux-gold";
    if (layout === "lux-geometric") {
      return `<div style="width:128px;height:128px;border:2px solid ${a};transform:rotate(45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 6px ${a}18">
        <span style="transform:rotate(-45deg);font-size:52px;font-weight:700;color:${a}">${initial}</span></div>`;
    }
    if (layout === "lux-boutique") {
      return `<div style="position:relative;width:120px;height:120px">
        <svg width="120" height="120" viewBox="0 0 100 100" style="position:absolute;inset:0;opacity:0.45"><path fill="${a}" d="M50 6 C26 36 14 58 50 94 C86 58 74 36 50 6 Z"/></svg>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:50px;font-weight:700;color:${a}">${initial}</div></div>`;
    }
    if (layout === "lux-platinum") {
      return `<div style="width:118px;height:118px;border-radius:50%;border:2px solid ${a};display:flex;align-items:center;justify-content:center;font-size:48px;font-weight:300;color:${a};box-shadow:0 0 0 10px ${a}15, inset 0 0 20px ${a}22">${initial}</div>`;
    }
    return `<div style="position:relative;width:120px;height:120px">
      <div style="position:absolute;inset:0;border:2px solid ${a};border-radius:50%;opacity:0.35"></div>
      <div style="position:absolute;inset:8px;border:1px solid ${a};border-radius:50%;opacity:0.55"></div>
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:50px;font-weight:700;color:${a}">${initial}</div></div>`;
  }

  function renderPrintedOverlay(tpl) {
    const a = tpl.accent;
    return `<div style="position:absolute;inset:0;opacity:0.035;background-image:repeating-linear-gradient(0deg,transparent,transparent 2px,${a} 2px,${a} 3px);pointer-events:none"></div>
      <div style="position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 50%,rgba(0,0,0,0.12));pointer-events:none"></div>`;
  }

  function renderLuxMetaChips(cat, shop, gst, accent) {
    const chips = [];
    if (cat) chips.push(`<span style="font-size:9px;letter-spacing:2px;padding:5px 14px;border:1px solid ${accent}66;color:${accent};border-radius:20px;text-transform:uppercase;font-weight:700">${cat}</span>`);
    if (shop) chips.push(`<span style="font-size:9px;letter-spacing:2px;padding:5px 14px;border:1px solid ${accent}44;color:${accent};border-radius:20px;text-transform:uppercase;opacity:0.9">${shop}</span>`);
    if (gst) chips.push(`<span style="font-size:9px;letter-spacing:1px;padding:5px 12px;background:${accent}18;color:${accent};border-radius:4px;font-weight:600">GST: ${gst}</span>`);
    if (!chips.length) return "";
    return `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px">${chips.join("")}</div>`;
  }

  function renderLuxWatermark(initial, accent) {
    return `<div style="position:absolute;right:8px;bottom:8px;font-size:100px;font-weight:700;color:${accent};opacity:0.05;line-height:1;pointer-events:none;font-family:Georgia,serif">${initial}</div>`;
  }

  function renderLuxFooterBar(addr, accent, textColor, extra) {
    return `<div style="grid-column:1/-1;display:flex;align-items:center;gap:14px;padding:12px 16px;background:${accent}12;border:1px solid ${accent}33;border-radius:6px;margin-top:4px">
      ${addr ? `<div style="flex:1;display:flex;align-items:flex-start;gap:10px;font-size:14px;line-height:1.5;color:${textColor}">
        <div style="width:28px;height:28px;min-width:28px;border:1px solid ${accent}55;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${accent}10">${luxIcon("pin", accent)}</div>
        <span>${addr}</span></div>` : `<div style="flex:1"></div>`}
      ${extra || ""}
    </div>`;
  }
  function renderPremiumPatterns(tpl) {
    const a = tpl.accent;
    let out = `<div style="position:absolute;inset:0;opacity:0.04;background:repeating-linear-gradient(45deg,${a} 0,${a} 1px,transparent 1px,transparent 14px);pointer-events:none"></div>`;
    if (tpl.pattern === "frame-gold") {
      out += `<div style="position:absolute;inset:10px;border:1px solid ${a};opacity:0.55;pointer-events:none"></div>
        <div style="position:absolute;inset:18px;border:1px solid ${a};opacity:0.28;pointer-events:none"></div>`;
    } else if (tpl.pattern === "corners") {
      out += `<div style="position:absolute;top:16px;right:20px;width:48px;height:48px;border-top:2px solid ${a};border-right:2px solid ${a};opacity:0.55"></div>
        <div style="position:absolute;bottom:16px;left:20px;width:48px;height:48px;border-bottom:2px solid ${a};border-left:2px solid ${a};opacity:0.55"></div>
        <div style="position:absolute;inset:10px;border:1px solid ${a};opacity:0.3;pointer-events:none"></div>`;
    } else if (tpl.pattern === "botanical") {
      out += `<svg style="position:absolute;right:24px;top:50%;transform:translateY(-50%);width:100px;height:100px;opacity:0.2" viewBox="0 0 100 100"><path fill="${a}" d="M50 8 C28 38 18 58 50 92 C82 58 72 38 50 8 Z"/></svg>
        <div style="position:absolute;inset:10px;border:1px solid ${a};opacity:0.35;pointer-events:none"></div>`;
    } else if (tpl.pattern === "foil") {
      out += `<div style="position:absolute;top:-60px;right:-100px;width:380px;height:380px;background:linear-gradient(135deg,${a}55,transparent 58%);transform:rotate(-15deg);pointer-events:none"></div>
        <div style="position:absolute;inset:10px;border:1px solid ${a};opacity:0.4;pointer-events:none"></div>`;
    } else if (tpl.pattern === "geometric-lux") {
      out += `<div style="position:absolute;top:0;right:0;border-width:0 160px 160px 0;border-style:solid;border-color:transparent ${a}28 transparent transparent"></div>
        <div style="position:absolute;bottom:0;left:0;border-width:100px 0 0 100px;border-style:solid;border-color:transparent transparent transparent ${a}18"></div>
        <div style="position:absolute;inset:10px;border:1px solid ${a};opacity:0.35;pointer-events:none"></div>`;
    } else if (tpl.pattern === "marble-lux") {
      out += `<div style="position:absolute;inset:0;opacity:0.16;background:radial-gradient(ellipse at 12% 38%,${a} 0%,transparent 42%),radial-gradient(ellipse at 88% 18%,${a} 0%,transparent 38%),radial-gradient(ellipse at 55% 88%,${a} 0%,transparent 32%);pointer-events:none"></div>
        <div style="position:absolute;inset:10px;border:1px solid ${a};opacity:0.4;pointer-events:none"></div>`;
    } else {
      out += `<div style="position:absolute;inset:10px;border:1px solid ${a};opacity:0.35;pointer-events:none"></div>`;
    }
    return out;
  }

  function renderLuxSplitCard(data, tpl) {
    const name = esc(data.name || "Your Name");
    const desig = esc(data.designation || "");
    const biz = esc(data.businessName || "Business Name");
    const phone = data.mobile ? `+91 ${data.mobile}` : "+91 XXXXX XXXXX";
    const email = data.email ? esc(data.email) : "";
    const gst = data.gst ? esc(data.gst) : "";
    const addr = data.address ? esc(data.address) : "";
    const cat = data.category ? esc(data.category) : "";
    const shop = data.shopType ? esc(data.shopType) : "";
    const initial = esc(getInitial(data.name || data.businessName));
    const a = tpl.accent;
    const t = tpl.text;
    const font = luxFont(tpl);
    const meta = [cat, shop].filter(Boolean).join("  ·  ");
    const foilBar = `<div style="grid-column:1/-1;height:5px;background:linear-gradient(90deg,transparent,${a},${a}88,${a},transparent);border-radius:3px;opacity:0.7;margin-top:6px"></div>`;

    return `<div class="bc-card-export bc-lux-card" style="background:${tpl.bg};color:${t}">${renderPremiumPatterns(tpl)}${renderPrintedOverlay(tpl)}
      <div style="position:absolute;inset:0;padding:24px 28px;display:flex;flex-direction:column;font-family:${font};z-index:2;height:100%;box-sizing:border-box">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px">
          <div style="font-size:11px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:${a}">${biz}</div>
          ${meta ? `<div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${t};opacity:0.75;text-align:right">${meta}</div>` : ""}
        </div>
        <div style="height:1px;background:linear-gradient(90deg,${a},${a}66,transparent);margin-bottom:12px"></div>
        <div style="flex:1;display:grid;grid-template-columns:42% 1fr;grid-template-rows:1fr auto auto;gap:12px 22px;min-height:0">
          <div style="grid-row:1;display:flex;flex-direction:column;justify-content:flex-start;border-right:1px solid ${a}44;padding-right:18px">
            <div style="margin-bottom:12px;transform:scale(0.88);transform-origin:left top">${renderLuxEmblem(initial, tpl)}</div>
            <h2 style="margin:0;font-size:40px;font-weight:700;color:${a};line-height:1.05;letter-spacing:0.5px">${name}</h2>
            ${desig ? `<p style="margin:5px 0 0;font-size:16px;color:${t};opacity:0.88;letter-spacing:2px;text-transform:uppercase;font-weight:500">${desig}</p>` : ""}
            <div style="width:64px;height:2px;background:${a};margin-top:12px;opacity:0.85"></div>
            <div style="margin-top:auto;padding-top:14px;font-size:10px;letter-spacing:4px;color:${a};opacity:0.65;text-transform:uppercase">Premium Visiting Card</div>
          </div>
          <div style="grid-row:1;display:flex;flex-direction:column;min-height:0;height:100%">
            ${renderLuxContactRow("MOBILE", phone, "phone", a, t)}
            ${renderLuxContactRow("EMAIL", email, "email", a, t)}
            ${renderLuxMetaChips(cat, shop, gst, a)}
            <div style="margin-top:auto;display:flex;justify-content:flex-end;padding-top:10px">
              ${renderLuxQRBlock(data, a, 104)}
            </div>
          </div>
          ${renderLuxFooterBar(addr, a, t, `<div style="font-size:9px;letter-spacing:3px;color:${a};opacity:0.7;text-transform:uppercase;white-space:nowrap">Bolkarigar</div>`)}
          ${foilBar}
        </div>
      </div>
    </div>`;
  }

  function renderLuxVerticalCard(data, tpl) {
    const name = esc(data.name || "Your Name");
    const desig = esc(data.designation || "");
    const biz = esc(data.businessName || "Business Name");
    const phone = data.mobile ? `+91 ${data.mobile}` : "+91 XXXXX XXXXX";
    const email = data.email ? esc(data.email) : "";
    const gst = data.gst ? esc(data.gst) : "";
    const addr = data.address ? esc(data.address) : "";
    const cat = data.category ? esc(data.category) : "";
    const shop = data.shopType ? esc(data.shopType) : "";
    const initial = esc(getInitial(data.name || data.businessName));
    const a = tpl.accent;
    const t = tpl.text;
    const font = luxFont(tpl);

    return `<div class="bc-card-export bc-lux-card" style="background:${tpl.bg};color:${t}">${renderPremiumPatterns(tpl)}${renderPrintedOverlay(tpl)}
      <div style="position:absolute;left:0;top:0;bottom:0;width:28%;background:linear-gradient(180deg,${a}28,${a}10);border-right:1px solid ${a}55;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px 14px;z-index:2">
        <div style="transform:scale(0.82)">${renderLuxEmblem(initial, tpl)}</div>
        <div style="margin-top:12px;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:${a};text-align:center;line-height:1.6">${biz}</div>
      </div>
      <div style="position:absolute;left:28%;right:0;top:0;bottom:0;padding:24px 26px 24px 20px;display:flex;flex-direction:column;font-family:${font};z-index:2">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
          <div style="flex:1;min-width:0">
            <h2 style="margin:0;font-size:38px;font-weight:700;color:${a};line-height:1.05">${name}</h2>
            ${desig ? `<p style="margin:5px 0 0;font-size:15px;color:${t};opacity:0.88;letter-spacing:1.5px;text-transform:uppercase">${desig}</p>` : ""}
          </div>
        </div>
        <div style="height:1px;background:linear-gradient(90deg,${a},transparent);margin:12px 0"></div>
        <div style="flex:1;display:flex;flex-direction:column;min-height:0">
          ${renderLuxContactRow("MOBILE", phone, "phone", a, t)}
          ${renderLuxContactRow("EMAIL", email, "email", a, t)}
          ${renderLuxMetaChips(cat, shop, gst, a)}
          <div style="margin-top:auto;display:flex;justify-content:flex-end;padding-top:8px">${renderLuxQRBlock(data, a, 96)}</div>
          <div style="margin-top:10px">${renderLuxFooterBar(addr, a, t, "")}</div>
        </div>
        <div style="height:4px;background:linear-gradient(90deg,transparent,${a},transparent);margin-top:10px;opacity:0.6"></div>
      </div>
    </div>`;
  }

  function renderLuxCenterCard(data, tpl) {
    const name = esc(data.name || "Your Name");
    const desig = esc(data.designation || "");
    const biz = esc(data.businessName || "Business Name");
    const phone = data.mobile ? `+91 ${data.mobile}` : "+91 XXXXX XXXXX";
    const email = data.email ? esc(data.email) : "";
    const gst = data.gst ? esc(data.gst) : "";
    const addr = data.address ? esc(data.address) : "";
    const cat = data.category ? esc(data.category) : "";
    const shop = data.shopType ? esc(data.shopType) : "";
    const initial = esc(getInitial(data.name || data.businessName));
    const a = tpl.accent;
    const t = tpl.text;
    const font = luxFont(tpl);
    const isNoir = tpl.layout === "lux-noir";

    return `<div class="bc-card-export bc-lux-card" style="background:${tpl.bg};color:${t}">${renderPremiumPatterns(tpl)}${renderPrintedOverlay(tpl)}
      <div style="position:absolute;inset:0;padding:24px 32px;display:flex;flex-direction:column;font-family:${font};z-index:2;height:100%">
        <div style="text-align:center;margin-bottom:8px">
          <div style="font-size:10px;letter-spacing:5px;text-transform:uppercase;color:${a}">${biz}</div>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center">
          <div style="transform:scale(0.85);margin-bottom:10px">${renderLuxEmblem(initial, tpl)}</div>
          <div style="width:56px;height:1px;background:${a};margin-bottom:12px"></div>
          <h2 style="margin:0;font-size:${isNoir ? "44" : "40"}px;font-weight:${isNoir ? "300" : "700"};color:${isNoir ? t : a};letter-spacing:${isNoir ? "3px" : "1px"}">${name}</h2>
          ${desig ? `<p style="margin:6px 0 0;font-size:15px;color:${a};letter-spacing:3px;text-transform:uppercase">${desig}</p>` : ""}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:14px;padding:14px 0;border-top:1px solid ${a}44;border-bottom:1px solid ${a}44;align-items:center">
          <div style="text-align:center"><div style="margin:0 auto 5px;width:26px;height:26px;border:1px solid ${a}55;border-radius:50%;display:flex;align-items:center;justify-content:center">${luxIcon("phone", a)}</div><div style="font-size:13px;font-weight:600">${phone}</div></div>
          <div style="text-align:center">${email ? `<div style="margin:0 auto 5px;width:26px;height:26px;border:1px solid ${a}55;border-radius:50%;display:flex;align-items:center;justify-content:center">${luxIcon("email", a)}</div><div style="font-size:12px;font-weight:600;word-break:break-all">${email}</div>` : ""}</div>
          <div>${renderLuxQRBlock(data, a, 88)}</div>
        </div>
        ${renderLuxMetaChips(cat, shop, gst, a)}
        <div style="margin-top:10px">${renderLuxFooterBar(addr, a, t, "")}</div>
        <div style="height:4px;background:linear-gradient(90deg,transparent,${a},transparent);margin-top:10px;opacity:0.55"></div>
      </div>
    </div>`;
  }

  function renderLuxuryCard(data, tpl) {
    const layout = tpl.layout || "lux-gold";
    if (layout === "lux-vertical") return renderLuxVerticalCard(data, tpl);
    if (layout === "lux-marble" || layout === "lux-noir") return renderLuxCenterCard(data, tpl);
    return renderLuxSplitCard(data, tpl);
  }

  function renderFreeCard(data, tpl) {
    const name = esc(data.name || "Your Name");
    const desig = esc(data.designation || "");
    const biz = esc(data.businessName || "Business Name");
    const phone = data.mobile ? `+91 ${data.mobile}` : "+91 XXXXX XXXXX";
    const email = data.email ? esc(data.email) : "";
    const gst = data.gst ? esc(data.gst) : "";
    const addr = data.address ? esc(data.address) : "";
    const cat = data.category ? esc(data.category) : "";
    const shop = data.shopType ? esc(data.shopType) : "";
    const initial = esc(getInitial(data.name || data.businessName));
    const a = tpl.accent;
    const t = tpl.text;
    const isGrad = String(tpl.bg).includes("gradient");
    const logoColor = isGrad ? "#fff" : (tpl.bg === "#ffffff" || tpl.bg.startsWith("#fff") ? a : tpl.bg);

    let patternHtml = "";
    if (tpl.pattern === "dots") patternHtml = `<div class="bc-pattern-dots" style="color:${t}"></div>`;
    else if (tpl.pattern === "lines") patternHtml = `<div class="bc-pattern-lines" style="color:${t}"></div>`;

    const waveAccent = tpl.layout === "wave"
      ? `<svg style="position:absolute;bottom:0;left:0;right:0;height:100px;pointer-events:none" viewBox="0 0 1050 120" preserveAspectRatio="none"><path fill="${a}" fill-opacity="0.3" d="M0,60 C200,120 400,0 600,60 C800,120 950,30 1050,60 L1050,120 L0,120 Z"/></svg>`
      : "";

    const sideBar = tpl.layout === "modern" || tpl.layout === "split"
      ? `<div style="position:absolute;left:0;top:0;bottom:0;width:${tpl.layout === "split" ? "32%" : "8px"};background:${a};opacity:${tpl.layout === "split" ? "0.2" : "1"}"></div>`
      : "";

    return `<div class="bc-card-export bc-free-card" style="background:${tpl.bg};color:${t}">${patternHtml}${sideBar}${waveAccent}
      <div style="position:absolute;inset:0;padding:26px 30px;padding-left:${tpl.layout === "split" ? "36%" : tpl.layout === "modern" ? "40px" : "30px"};display:flex;flex-direction:column;height:100%;box-sizing:border-box;z-index:1">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:12px">
          <div style="font-size:20px;font-weight:800;color:${t}">${biz}</div>
          ${cat || shop ? `<div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;opacity:0.8;text-align:right">${[cat, shop].filter(Boolean).join(" · ")}</div>` : ""}
        </div>
        <div style="height:3px;width:60px;background:${a};margin-bottom:12px;border-radius:2px"></div>
        <div style="flex:1;display:grid;grid-template-columns:1fr auto;gap:16px 20px;min-height:0;align-items:stretch">
          <div style="display:flex;flex-direction:column;justify-content:flex-start">
            <div style="width:60px;height:60px;border-radius:50%;background:${a};color:${logoColor};display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;margin-bottom:12px">${initial}</div>
            <h2 style="margin:0;font-size:36px;font-weight:800;color:${t};line-height:1.1">${name}</h2>
            ${desig ? `<p style="margin:4px 0 0;font-size:16px;color:${a};font-weight:600">${desig}</p>` : ""}
            <div style="margin-top:14px;display:flex;flex-direction:column;gap:10px;border-left:2px solid ${a};padding-left:16px">
              <div><div style="font-size:9px;letter-spacing:2px;opacity:0.7;margin-bottom:2px">MOBILE</div><div style="font-size:17px;font-weight:700">${phone}</div></div>
              ${email ? `<div><div style="font-size:9px;letter-spacing:2px;opacity:0.7;margin-bottom:2px">EMAIL</div><div style="font-size:15px;font-weight:600;word-break:break-all">${email}</div></div>` : ""}
              ${gst ? `<div><div style="font-size:9px;letter-spacing:2px;opacity:0.7;margin-bottom:2px">GSTIN</div><div style="font-size:13px;font-weight:600">${gst}</div></div>` : ""}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;justify-content:flex-end;align-items:center;padding-bottom:4px">
            ${renderLuxQRBlock(data, a, 92)}
          </div>
        </div>
        <div style="margin-top:12px;padding:10px 14px;background:${a}18;border-left:3px solid ${a};border-radius:0 6px 6px 0;font-size:14px;line-height:1.5;display:flex;gap:8px;align-items:flex-start">
          <span style="opacity:0.8">📍</span><span>${addr || "Your business address"}</span>
        </div>
        <div style="height:3px;background:linear-gradient(90deg,${a},transparent);margin-top:10px;opacity:0.5;border-radius:2px"></div>
      </div>
    </div>`;
  }

  function renderCardHTML(data, tpl) {
    if (String(tpl.layout || "").startsWith("lux-") || isPremiumTemplateId(tpl.id)) {
      return renderLuxuryCard(data, tpl);
    }
    return renderFreeCard(data, tpl);
  }

  function getTemplate(id) {
    const found = ALL_TEMPLATES.find((t) => t.id === id);
    if (found) return found;
    return { ...FREE_TEMPLATES[0], tier: "free" };
  }

  function hasPremiumAccess() {
    const sub = window._bkAccountInfo?.subscription;
    return !!(sub?.fullAccess || sub?.plan === "business");
  }

  function isPremiumTemplateId(id) {
    return String(id || "").startsWith("p");
  }

  function syncPlanUI() {
    const tierTabs = document.querySelector(".bc-tier-tabs");
    const premiumTab = document.querySelector('.bc-tier-tab[data-tier="premium"]');
    const freeTab = document.querySelector('.bc-tier-tab[data-tier="free"]');
    const upgradeBanner = document.getElementById("bcUpgradeBanner");
    const freeOnlyTitle = document.getElementById("bcFreeOnlyTitle");
    const premiumOnlyTitle = document.getElementById("bcPremiumOnlyTitle");
    const hasBiz = hasPremiumAccess();

    if (tierTabs) tierTabs.classList.toggle("hidden", !hasBiz);
    if (freeOnlyTitle) freeOnlyTitle.classList.toggle("hidden", hasBiz || currentTier === "premium");
    if (premiumOnlyTitle) premiumOnlyTitle.classList.toggle("hidden", !hasBiz || currentTier !== "premium");
    if (premiumTab) {
      premiumTab.style.display = hasBiz ? "" : "none";
      premiumTab.classList.toggle("hidden-tab", hasBiz && currentTier === "free");
    }
    if (freeTab) {
      freeTab.style.display = hasBiz ? "" : "none";
      freeTab.classList.toggle("hidden-tab", hasBiz && currentTier === "premium");
    }
    const switchFree = document.getElementById("bcSwitchFreeLink");
    if (switchFree) switchFree.classList.toggle("visible", hasBiz && currentTier === "premium");
    if (upgradeBanner) upgradeBanner.classList.toggle("hidden", hasBiz);

    if (!hasBiz) {
      currentTier = "free";
      freeTab?.classList.add("active");
      premiumTab?.classList.remove("active");
    }
  }

  function getTemplatesForTier(tier) {
    if (tier === "premium" && hasPremiumAccess()) {
      return PREMIUM_TEMPLATES.filter((t) => String(t.id).startsWith("p"));
    }
    return FREE_TEMPLATES.filter((t) => String(t.id).startsWith("f"));
  }

  function updatePreview() {
    const tpl = getTemplate(currentTemplateId);
    const data = getFormData();
    const html = renderCardHTML(data, tpl);
    const preview = document.getElementById("bcPreviewHost");
    if (preview) preview.innerHTML = html;
    const exportHost = document.getElementById("bcExportHost");
    if (exportHost) exportHost.innerHTML = html;
  }

  function renderPremiumThumbPreview(tpl) {
    const a = tpl.accent;
    const layout = tpl.layout || "lux-gold";
    let hint = "";
    if (layout === "lux-vertical") {
      hint = '<div class="bc-tpv-left"></div><div class="bc-tpv-split-lines" style="left:36%"><span></span><span></span></div><div class="bc-tpv-qr" style="border-color:' + a + '"></div>';
    } else if (layout === "lux-marble" || layout === "lux-noir") {
      hint = '<div class="bc-tpv-marble"></div><div class="bc-tpv-ring" style="left:50%;top:32%;border-color:' + a + '"></div><div class="bc-tpv-goldline" style="left:50%;transform:translateX(-50%);width:40px;top:52%"></div><div class="bc-tpv-bottom-band"></div>';
    } else {
      hint = '<div class="bc-tpv-split-left"></div><div class="bc-tpv-vdivider" style="background:' + a + '"></div><div class="bc-tpv-split-lines" style="left:52%"><span></span><span></span><span></span></div><div class="bc-tpv-qr" style="border-color:' + a + '"></div><div class="bc-tpv-bottom-band"></div>';
      if (layout === "lux-geometric") hint += '<div class="bc-tpv-diamond" style="left:14%;top:28%"></div>';
      else if (layout === "lux-foil") hint += '<div class="bc-tpv-foil"></div>';
      else if (layout === "lux-boutique") hint += '<div class="bc-tpv-leaf" style="left:12%;top:30%"></div>';
    }

    return `<div class="bc-tpv" style="background:${tpl.bg}">
      <div class="bc-tpv-frame" style="border-color:${a}"></div>
      <div class="bc-tpv-frame2" style="border-color:${a}"></div>
      ${hint}
      <div class="bc-tpv-crown">👑</div>
      <div class="bc-tpv-text" style="color:${tpl.text}">
        <div class="bc-tpv-lux" style="color:${a}">LUXURY</div>
        <div class="bc-tpv-sub">${esc(tpl.name)}</div>
      </div>
    </div>`;
  }

  function renderFreeThumbPreview(tpl) {
    return `<div class="bc-tfv" style="background:${tpl.bg};color:${tpl.text}">
      <div class="bc-tfv-bar" style="background:${tpl.accent}"></div>
      <div class="bc-tfv-body">
        <div class="bc-tfv-tag" style="color:${tpl.accent}">FREE</div>
        <div class="bc-tfv-name">${esc(tpl.name)}</div>
        <div class="bc-tfv-lines">
          <div class="bc-tfv-line med"></div>
          <div class="bc-tfv-line short"></div>
        </div>
      </div>
    </div>`;
  }

  function renderThumbHTML(tpl, data) {
    if (isPremiumTemplateId(tpl.id) || String(tpl.layout || "").startsWith("lux-")) {
      return renderPremiumThumbPreview(tpl);
    }
    return renderFreeThumbPreview(tpl);
  }

  function renderGrid() {
    const grid = document.getElementById("bcCardGrid");
    if (!grid) return;
    syncPlanUI();
    const data = loadSavedData();
    const templates = getTemplatesForTier(currentTier);
    const isPremiumView = currentTier === "premium" && hasPremiumAccess();
    grid.classList.toggle("bc-premium-grid", isPremiumView);

    grid.innerHTML = templates
      .filter((tpl) => (isPremiumView ? isPremiumTemplateId(tpl.id) : !isPremiumTemplateId(tpl.id)))
      .map((tpl) => {
      const tier = isPremiumView ? "premium" : "free";
      const fullTpl = { ...tpl, tier };
      const badge = tier === "premium"
        ? '<span class="bc-premium-badge">LUXURY</span>'
        : '<span class="bc-free-badge">FREE</span>';
      return `
        <div class="bc-thumb${tier === "premium" ? " bc-thumb-is-premium" : ""}" data-id="${tpl.id}" data-tier="${tier}" role="button" tabindex="0" aria-label="${esc(tpl.name)}">
          ${badge}
          ${renderThumbHTML(fullTpl, data)}
          <div class="bc-thumb-label">${esc(tpl.name)}</div>
        </div>`;
    }).join("");

    grid.querySelectorAll(".bc-thumb").forEach((thumb) => {
      thumb.addEventListener("click", () => openEditor(thumb.dataset.id, thumb.dataset.tier));
      thumb.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEditor(thumb.dataset.id, thumb.dataset.tier); }
      });
    });
  }

  function openEditor(templateId, tier) {
    const tpl = getTemplate(templateId);
    const wantsPremium = tier === "premium" || tpl.tier === "premium" || isPremiumTemplateId(templateId);

    if (wantsPremium && !hasPremiumAccess()) {
      if (typeof showToast === "function") {
        showToast("Yeh premium card Business plan (₹299) me hai — My Plan se upgrade karein.", "error");
      } else {
        alert("Premium cards Business plan (₹299) me available hain.");
      }
      if (typeof openPanel === "function") openPanel("myPlanPanel");
      return;
    }

    currentTemplateId = templateId;
    currentTier = wantsPremium ? "premium" : "free";
    fillForm(loadSavedData());
    updatePreview();
    document.getElementById("bcEditorModal")?.classList.remove("hidden");
    document.getElementById("bcEditorTitle").textContent = getTemplate(templateId).name;
  }

  function closeEditor() {
    document.getElementById("bcEditorModal")?.classList.add("hidden");
  }

  function navigateTemplate(dir) {
    const list = currentTier === "premium" ? PREMIUM_TEMPLATES : FREE_TEMPLATES;
    const idx = list.findIndex((t) => t.id === currentTemplateId);
    const next = (idx + dir + list.length) % list.length;
    if (currentTier === "premium" && !hasPremiumAccess()) return;
    currentTemplateId = list[next].id;
    document.getElementById("bcEditorTitle").textContent = list[next].name;
    updatePreview();
  }

  function buildSelectOptions(arr, selected) {
    return arr.map((o) => `<option value="${esc(o)}"${o === selected ? " selected" : ""}>${esc(o)}</option>`).join("");
  }

  function initFormSelects() {
    const data = loadSavedData();
    const desig = document.getElementById("bcDesignation");
    const shop = document.getElementById("bcShopType");
    const cat = document.getElementById("bcCategory");
    if (desig) desig.innerHTML = buildSelectOptions(DESIGNATIONS, data.designation);
    if (shop) shop.innerHTML = buildSelectOptions(SHOP_TYPES, data.shopType);
    if (cat) cat.innerHTML = buildSelectOptions(CATEGORIES, data.category);
  }

  function loadHtml2Canvas() {
    if (html2canvasLoaded || window.html2canvas) {
      html2canvasLoaded = true;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
      s.onload = () => { html2canvasLoaded = true; resolve(); };
      s.onerror = () => reject(new Error("html2canvas load fail"));
      document.head.appendChild(s);
    });
  }

  async function captureCardBlob() {
    await loadHtml2Canvas();
    updatePreview();
    const el = document.querySelector("#bcExportHost .bc-card-export");
    if (!el) throw new Error("Card render nahi hua");
    const canvas = await window.html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
      width: 1050,
      height: 600
    });
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png", 1));
  }

  async function downloadCard() {
    try {
      if (typeof showToast === "function") showToast("Card ban raha hai...");
      const blob = await captureCardBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const biz = getFormData().businessName || "business";
      a.href = url;
      a.download = `BolKarigar-Card-${biz.replace(/\s+/g, "-")}.png`;
      a.click();
      URL.revokeObjectURL(url);
      saveData(getFormData());
      if (typeof showToast === "function") showToast("✅ Business card download ho gaya!");
    } catch (err) {
      if (typeof showToast === "function") showToast("❌ " + err.message, "error");
      else alert(err.message);
    }
  }

  async function shareWhatsApp() {
    try {
      if (typeof showToast === "function") showToast("Card tayyar ho raha hai...");
      const blob = await captureCardBlob();
      saveData(getFormData());
      const data = getFormData();
      const file = new File([blob], "business-card.png", { type: "image/png" });
      const msg = `Namaste! Mera business card — ${data.businessName || data.name}\n📞 +91 ${data.mobile || ""}`;

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Business Card", text: msg });
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "business-card.png";
      a.click();

      const phone = (data.mobile || "").replace(/\D/g, "");
      const waUrl = phone.length >= 10
        ? `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;
      setTimeout(() => {
        URL.revokeObjectURL(url);
        window.open(waUrl, "_blank");
      }, 400);
      if (typeof showToast === "function") {
        showToast("Card download hua — WhatsApp khul gaya. Image attach karke bhejein!", "info");
      }
    } catch (err) {
      if (typeof showToast === "function") showToast("❌ " + err.message, "error");
      else alert(err.message);
    }
  }

  function saveCard() {
    saveData(getFormData());
    if (typeof showToast === "function") showToast("✅ Business card details save ho gayi!");
    else alert("Details save ho gayi!");
  }

  function init() {
    const panel = document.getElementById("businessCardPanel");
    if (!panel) return;

    initFormSelects();

    document.querySelectorAll(".bc-tier-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const tier = tab.dataset.tier || "free";
        if (tier === "premium" && !hasPremiumAccess()) {
          if (typeof showToast === "function") {
            showToast("Premium cards Business plan (₹299) me unlock hote hain.", "error");
          }
          return;
        }
        document.querySelectorAll(".bc-tier-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        currentTier = tier;
        if (tier === "premium") currentTemplateId = PREMIUM_TEMPLATES[0]?.id || "p01";
        else currentTemplateId = FREE_TEMPLATES[0]?.id || "f01";
        renderGrid();
      });
    });

    document.getElementById("bcUpgradeBtn")?.addEventListener("click", () => {
      if (typeof buyBolKarigarPlan === "function") buyBolKarigarPlan("business");
      else if (typeof openPanel === "function") openPanel("myPlanPanel");
    });

    document.getElementById("bcSwitchToFreeBtn")?.addEventListener("click", () => {
      currentTier = "free";
      currentTemplateId = FREE_TEMPLATES[0]?.id || "f01";
      document.querySelectorAll(".bc-tier-tab").forEach((t) => t.classList.remove("active"));
      document.querySelector('.bc-tier-tab[data-tier="free"]')?.classList.add("active");
      renderGrid();
    });

    document.getElementById("bcEditorClose")?.addEventListener("click", closeEditor);
    document.getElementById("bcEditorModal")?.addEventListener("click", (e) => {
      if (e.target.id === "bcEditorModal") closeEditor();
    });
    document.getElementById("bcPrevTpl")?.addEventListener("click", () => navigateTemplate(-1));
    document.getElementById("bcNextTpl")?.addEventListener("click", () => navigateTemplate(1));
    document.getElementById("bcSaveBtn")?.addEventListener("click", saveCard);
    document.getElementById("bcDownloadBtn")?.addEventListener("click", downloadCard);
    document.getElementById("bcWhatsAppBtn")?.addEventListener("click", shareWhatsApp);

    document.querySelectorAll("#bcForm input, #bcForm select, #bcForm textarea").forEach((el) => {
      el.addEventListener("input", updatePreview);
      el.addEventListener("change", updatePreview);
    });

    document.querySelector('.tab-btn[data-tab="businessCardPanel"]')?.addEventListener("click", () => {
      initFormSelects();
      if (hasPremiumAccess()) {
        currentTier = "premium";
        currentTemplateId = PREMIUM_TEMPLATES[0]?.id || "p01";
        document.querySelectorAll(".bc-tier-tab").forEach((t) => t.classList.remove("active"));
        document.querySelector('.bc-tier-tab[data-tier="premium"]')?.classList.add("active");
      }
      renderGrid();
    });

    if (hasPremiumAccess()) {
      currentTier = "premium";
      currentTemplateId = PREMIUM_TEMPLATES[0]?.id || "p01";
    }

    if (panel.classList.contains("active")) renderGrid();
    else renderGrid();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.bkRenderBusinessCardGrid = renderGrid;
  window.bkSyncBusinessCardPlan = syncPlanUI;
})();
