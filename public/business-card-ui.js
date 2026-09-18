/**
 * BolKarigar — Business Card Maker (Khatabook-style)
 * 18 Pro + 30 Business luxury designs | Form editor | Download | WhatsApp Share
 */
(function () {
  const STORAGE_KEY = "bolkarigar_business_card";
  const FREE_COUNT = 18;
  const PREMIUM_COUNT = 30;

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
    { id: "f03", name: "Forest Green", bg: "#14532d", accent: "#86efac", text: "#ffffff", layout: "split", pattern: "none" },
    { id: "f04", name: "Sunset Wave", bg: "#ea580c", accent: "#fed7aa", text: "#ffffff", layout: "wave", pattern: "none" },
    { id: "f05", name: "Royal Purple", bg: "#6b21a8", accent: "#e9d5ff", text: "#ffffff", layout: "banner", pattern: "none" },
    { id: "f06", name: "Minimal Dark", bg: "#0f172a", accent: "#38bdf8", text: "#f8fafc", layout: "minimal", pattern: "lines" },
    { id: "f07", name: "Teal Gradient", bg: "linear-gradient(135deg,#0d9488,#0891b2)", accent: "#ccfbf1", text: "#ffffff", layout: "diagonal", pattern: "none" },
    { id: "f08", name: "Coral Pink", bg: "#be185d", accent: "#fbcfe8", text: "#ffffff", layout: "corner", pattern: "dots" },
    { id: "f09", name: "Slate Pro", bg: "#334155", accent: "#94a3b8", text: "#f1f5f9", layout: "stripe", pattern: "none" },
    { id: "f10", name: "Golden Accent", bg: "#fffbeb", accent: "#d97706", text: "#78350f", layout: "centered", pattern: "none" },
    { id: "f11", name: "Sky Light", bg: "#e0f2fe", accent: "#0284c7", text: "#0c4a6e", layout: "glass", pattern: "none" },
    { id: "f12", name: "Mint Fresh", bg: "#ecfdf5", accent: "#059669", text: "#064e3b", layout: "bold", pattern: "dots" },
    { id: "f13", name: "Midnight Diagonal", bg: "#1e1b4b", accent: "#818cf8", text: "#ffffff", layout: "diagonal", pattern: "lines" },
    { id: "f14", name: "Crimson Corner", bg: "#450a0a", accent: "#fca5a5", text: "#ffffff", layout: "corner", pattern: "none" },
    { id: "f15", name: "Navy Banner", bg: "#0c4a6e", accent: "#7dd3fc", text: "#ffffff", layout: "banner", pattern: "dots" },
    { id: "f16", name: "Sage Center", bg: "#f0fdf4", accent: "#16a34a", text: "#14532d", layout: "centered", pattern: "none" },
    { id: "f17", name: "Charcoal Glass", bg: "#18181b", accent: "#a1a1aa", text: "#fafafa", layout: "glass", pattern: "lines" },
    { id: "f18", name: "Amber Bold", bg: "#78350f", accent: "#fcd34d", text: "#fffbeb", layout: "bold", pattern: "none" }
  ];

  const PREMIUM_TEMPLATES = [
    /* Swoosh curve — 5 unique curves */
    { id: "p01", name: "Black Orange Swoosh", layout: "lux-swoosh", darkBg: "#0a0a0a", lightBg: "#ffffff", accent: "#f97316", textDark: "#111827", swoosh: 0, logo: "bars", deco: "strip", stroke: 28, iconStyle: "circle", nameStyle: "bold", darkStyle: "solid" },
    { id: "p02", name: "Navy Sky Swoosh", layout: "lux-swoosh", darkBg: "#0f172a", lightBg: "#f8fafc", accent: "#0ea5e9", textDark: "#0f172a", swoosh: 3, logo: "triangle", deco: "dots", stroke: 24, iconStyle: "square", nameStyle: "light", darkStyle: "gradient" },
    { id: "p03", name: "Charcoal Gold Swoosh", layout: "lux-swoosh", darkBg: "#1c1917", lightBg: "#fffbeb", accent: "#d4af37", textDark: "#292524", swoosh: 7, logo: "rings", deco: "double", stroke: 30, iconStyle: "filled", nameStyle: "bold", darkStyle: "solid" },
    { id: "p04", name: "Wine Ivory Swoosh", layout: "lux-swoosh", darkBg: "#450a0a", lightBg: "#fef7ed", accent: "#e11d48", textDark: "#431407", swoosh: 11, logo: "diamond", deco: "glow", stroke: 26, iconStyle: "circle", nameStyle: "condensed", darkStyle: "gradient" },
    { id: "p05", name: "Emerald Swoosh", layout: "lux-swoosh", darkBg: "#064e3b", lightBg: "#ffffff", accent: "#10b981", textDark: "#064e3b", swoosh: 15, logo: "hex", deco: "lines", stroke: 22, iconStyle: "square", nameStyle: "bold", darkStyle: "solid" },
    /* Split marble — 5 layouts */
    { id: "p06", name: "Gold Frame Elite", layout: "lux-marble", bg: "#0f0f0f", accent: "#d4af37", text: "#fafafa", pattern: "frame-gold", font: "serif" },
    { id: "p07", name: "Marble Royale", layout: "lux-marble", bg: "#1a1a2e", accent: "#e94560", text: "#eaeaea", pattern: "marble-lux", font: "serif" },
    { id: "p08", name: "Botanical Luxe", layout: "lux-boutique", bg: "#14532d", accent: "#86efac", text: "#ecfdf5", pattern: "botanical", font: "serif" },
    { id: "p09", name: "Geometric Noir", layout: "lux-geometric", bg: "#18181b", accent: "#fbbf24", text: "#fafafa", pattern: "geometric-lux", font: "sans" },
    { id: "p10", name: "Platinum Foil", layout: "lux-platinum", bg: "#1e293b", accent: "#cbd5e1", text: "#f8fafc", pattern: "foil", font: "sans" },
    /* Vertical sidebar — 5 layouts */
    { id: "p11", name: "Royal Purple Side", layout: "lux-vertical", bg: "#3b0764", accent: "#c084fc", text: "#faf5ff", pattern: "corners", font: "serif" },
    { id: "p12", name: "Steel Executive", layout: "lux-vertical", bg: "#1e293b", accent: "#60a5fa", text: "#f1f5f9", pattern: "frame-gold", font: "sans" },
    { id: "p13", name: "Rose Boutique", layout: "lux-vertical", bg: "#831843", accent: "#fda4af", text: "#fff1f2", pattern: "botanical", font: "serif" },
    { id: "p14", name: "Teal Corporate", layout: "lux-vertical", bg: "#134e4a", accent: "#5eead4", text: "#ecfdf5", pattern: "geometric-lux", font: "sans" },
    { id: "p15", name: "Copper Heritage", layout: "lux-vertical", bg: "#292524", accent: "#fb923c", text: "#fafaf9", pattern: "foil", font: "serif" },
    /* Center noir — 5 layouts */
    { id: "p16", name: "Obsidian Center", layout: "lux-noir", bg: "#0a0a0a", accent: "#ec4899", text: "#fdf2f8", pattern: "marble-lux", font: "serif" },
    { id: "p17", name: "Indigo Crown", layout: "lux-noir", bg: "#1e1b4b", accent: "#eab308", text: "#eef2ff", pattern: "frame-gold", font: "serif" },
    { id: "p18", name: "Carbon Elite", layout: "lux-noir", bg: "#09090b", accent: "#22d3ee", text: "#ecfeff", pattern: "geometric-lux", font: "sans" },
    { id: "p19", name: "Burgundy Prestige", layout: "lux-noir", bg: "#4c0519", accent: "#fb7185", text: "#fff7ed", pattern: "corners", font: "serif" },
    { id: "p20", name: "Graphite Premium", layout: "lux-noir", bg: "#27272a", accent: "#facc15", text: "#fefce8", pattern: "foil", font: "sans" },
    /* Diagonal luxury — 5 layouts */
    { id: "p21", name: "Gold Diagonal", layout: "lux-diagonal", bg: "#0c0c0c", accent: "#ca8a04", text: "#fffef7", pattern: "frame-gold", font: "serif" },
    { id: "p22", name: "Ocean Diagonal", layout: "lux-diagonal", bg: "#0c4a6e", accent: "#38bdf8", text: "#f0f9ff", pattern: "marble-lux", font: "sans" },
    { id: "p23", name: "Crimson Diagonal", layout: "lux-diagonal", bg: "#7f1d1d", accent: "#fca5a5", text: "#ffffff", pattern: "geometric-lux", font: "serif" },
    { id: "p24", name: "Forest Diagonal", layout: "lux-diagonal", bg: "#14532d", accent: "#fbbf24", text: "#fffbeb", pattern: "botanical", font: "serif" },
    { id: "p25", name: "Magenta Diagonal", layout: "lux-diagonal", bg: "#500724", accent: "#e879f9", text: "#fce7f3", pattern: "foil", font: "sans" },
    /* Executive banner — 3 layouts */
    { id: "p26", name: "Executive Gold", layout: "lux-executive", bg: "#111827", accent: "#d4af37", text: "#f9fafb", pattern: "frame-gold", font: "serif" },
    { id: "p27", name: "Executive Navy", layout: "lux-executive", bg: "#0f172a", accent: "#3b82f6", text: "#f8fafc", pattern: "corners", font: "sans" },
    { id: "p28", name: "Executive Emerald", layout: "lux-executive", bg: "#064e3b", accent: "#34d399", text: "#ecfdf5", pattern: "marble-lux", font: "serif" },
    /* Art deco — 2 layouts */
    { id: "p29", name: "Art Deco Gold", layout: "lux-artdeco", bg: "#1c1917", accent: "#d4af37", text: "#fafaf9", pattern: "geometric-lux", font: "serif" },
    { id: "p30", name: "Art Deco Onyx", layout: "lux-artdeco", bg: "#000000", accent: "#f59e0b", text: "#fffbeb", pattern: "frame-gold", font: "serif" }
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
        mobile: normalizeIndianMobile(p.phone || ""),
        email: p.email || "",
        gst: p.gstin || "",
        address: p.address || "",
        designation: "Owner",
        shopType: "Shop",
        category: "Retail",
        qrMode: "whatsapp"
      };
    } catch {
      return { name: "", businessName: "", mobile: "", email: "", gst: "", address: "", designation: "Owner", shopType: "Shop", category: "Retail", qrMode: "whatsapp" };
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
      mobile: normalizeIndianMobile(document.getElementById("bcMobile")?.value || ""),
      businessName: document.getElementById("bcBusinessName")?.value?.trim() || "",
      shopType: document.getElementById("bcShopType")?.value || "Shop",
      email: document.getElementById("bcEmail")?.value?.trim() || "",
      category: document.getElementById("bcCategory")?.value || "Retail",
      gst: document.getElementById("bcGst")?.value?.trim() || "",
      address: document.getElementById("bcAddress")?.value?.trim() || "",
      qrMode: document.getElementById("bcQrMode")?.value || "whatsapp"
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
    set("bcQrMode", data.qrMode || "whatsapp");
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

  function renderLuxQRBlock(data, accent, size, label) {
    const sz = size || 112;
    const caption = label || "SCAN TO CONTACT";
    return `<div class="bc-qr-block" style="background:${accent}18;border:2px solid ${accent}55;border-radius:10px;padding:12px 16px;box-shadow:0 4px 14px rgba(0,0,0,0.12)">
      <div class="bc-qr-img-wrap">${renderRealQR(data, sz)}</div>
      <div class="bc-qr-label" style="color:${accent}">${caption}</div>
    </div>`;
  }

  function renderLuxContactRow(label, value, iconType, accent, textColor) {
    if (!value) return "";
    return `<div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:14px">
      <div style="width:42px;height:42px;min-width:42px;border:2px solid ${accent}77;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${accent}18">${luxIcon(iconType, accent)}</div>
      <div style="min-width:0">
        <div style="font-size:11px;letter-spacing:2.5px;color:${accent};font-weight:800;margin-bottom:4px">${label}</div>
        <div style="font-size:20px;font-weight:700;color:${textColor};line-height:1.35;word-break:break-word">${value}</div>
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
    if (cat) chips.push(`<span style="font-size:11px;letter-spacing:2px;padding:7px 16px;border:2px solid ${accent}66;color:${accent};border-radius:20px;text-transform:uppercase;font-weight:800">${cat}</span>`);
    if (shop) chips.push(`<span style="font-size:11px;letter-spacing:2px;padding:7px 16px;border:2px solid ${accent}55;color:${accent};border-radius:20px;text-transform:uppercase;font-weight:700">${shop}</span>`);
    if (gst) chips.push(`<span style="font-size:11px;letter-spacing:1px;padding:7px 14px;background:${accent}22;color:${accent};border-radius:6px;font-weight:700">GST: ${gst}</span>`);
    if (!chips.length) return "";
    return `<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:14px">${chips.join("")}</div>`;
  }

  function renderLuxWatermark(initial, accent) {
    return `<div style="position:absolute;right:8px;bottom:8px;font-size:100px;font-weight:700;color:${accent};opacity:0.05;line-height:1;pointer-events:none;font-family:Georgia,serif">${initial}</div>`;
  }

  function renderLuxFooterBar(addr, accent, textColor, extra) {
    return `<div style="grid-column:1/-1;display:flex;align-items:center;gap:16px;padding:14px 18px;background:${accent}16;border:2px solid ${accent}40;border-radius:8px;margin-top:6px">
      ${addr ? `<div style="flex:1;display:flex;align-items:flex-start;gap:12px;font-size:16px;line-height:1.5;color:${textColor};font-weight:600">
        <div style="width:32px;height:32px;min-width:32px;border:2px solid ${accent}66;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${accent}12">${luxIcon("pin", accent)}</div>
        <span>${addr}</span></div>` : `<div style="flex:1"></div>`}
      ${extra || ""}
    </div>`;
  }

  function renderVisitingAccent(accent) {
    return `<div style="position:absolute;top:0;right:0;width:0;height:0;border-style:solid;border-width:0 220px 220px 0;border-color:transparent ${accent}30 transparent transparent;pointer-events:none;z-index:1"></div>
      <div style="position:absolute;bottom:0;left:0;width:0;height:0;border-style:solid;border-width:140px 0 0 140px;border-color:transparent transparent transparent ${accent}20;pointer-events:none;z-index:1"></div>
      <div style="position:absolute;top:0;left:0;right:0;height:7px;background:linear-gradient(90deg,${accent},${accent}aa,transparent);pointer-events:none;z-index:1"></div>
      <div style="position:absolute;bottom:0;left:0;right:0;height:5px;background:linear-gradient(90deg,transparent,${accent}88,${accent});pointer-events:none;z-index:1"></div>`;
  }

  /** Animated luxury overlay — preview only (shimmer + sparks) */
  function renderLuxAnimLayers(accent) {
    const a = accent || "#d4af37";
    return `<div class="bc-anim-shimmer" style="--bc-shimmer:${a}"></div>
      <div class="bc-anim-border-glow" style="--bc-glow:${a}"></div>
      <div class="bc-anim-spark bc-anim-spark-1" style="background:${a}"></div>
      <div class="bc-anim-spark bc-anim-spark-2" style="background:${a}"></div>
      <div class="bc-anim-spark bc-anim-spark-3" style="background:${a}"></div>`;
  }

  /** Pro plan animated accents */
  function renderProAnimLayers(accent) {
    return `<div class="bc-pro-anim-bar" style="--bc-accent:${accent}"></div>
      <div class="bc-pro-anim-pulse" style="--bc-accent:${accent}"></div>`;
  }

  function renderProCornerFrame(accent) {
    return `<div class="bc-pro-corner bc-pro-corner-tl" style="border-color:${accent}"></div>
      <div class="bc-pro-corner bc-pro-corner-br" style="border-color:${accent}"></div>
      <div class="bc-pro-watermark">PRO</div>`;
  }

  function renderLuxCornerFrame(accent) {
    return `<div class="bc-lux-corner bc-lux-corner-tl" style="border-color:${accent}"></div>
      <div class="bc-lux-corner bc-lux-corner-tr" style="border-color:${accent}"></div>
      <div class="bc-lux-corner bc-lux-corner-bl" style="border-color:${accent}"></div>
      <div class="bc-lux-corner bc-lux-corner-br" style="border-color:${accent}"></div>
      <div class="bc-lux-seal bc-anim-glow" style="--bc-glow:${accent}">👑 LUXURY</div>`;
  }

  /** Centered logo block — used across Pro & Luxury layouts */
  function renderCenteredLuxLogo(initial, tpl, innerHtml) {
    const a = tpl.accent;
    return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
      <div class="bc-anim-float bc-logo-glow" style="--bc-accent:${a};margin-bottom:10px">${renderLuxEmblem(initial, tpl)}</div>
      ${innerHtml || ""}
    </div>`;
  }

  function renderCenteredQR(data, accent, size) {
    const sz = size || 104;
    return `<div class="bc-qr-center">
      <div class="bc-anim-qr-pulse" style="--bc-accent:${accent}">${renderLuxQRBlock(data, accent, sz)}</div>
    </div>`;
  }

  function renderProLogoCircle(initial, accent, logoColor, onDarkSide, size) {
    const sz = size || 90;
    const bg = onDarkSide ? "#fff" : accent;
    const col = onDarkSide ? accent : logoColor;
    return `<div class="bc-anim-float bc-logo-glow" style="--bc-accent:${accent};width:${sz}px;height:${sz}px;border-radius:50%;background:${bg};color:${col};display:flex;align-items:center;justify-content:center;font-size:${Math.round(sz * 0.38)}px;font-weight:800;border:3px solid ${onDarkSide ? accent : accent + "88"};box-shadow:0 8px 24px ${accent}44">${initial}</div>`;
  }

  function renderMetaChip(text, accent, textColor, filled) {
    if (!text) return "";
    const bg = filled ? accent : `${accent}22`;
    const col = filled ? (textColor || "#fff") : accent;
    return `<span style="font-size:10px;letter-spacing:1.5px;padding:6px 12px;border-radius:20px;border:1.5px solid ${accent}66;background:${bg};color:${col};font-weight:800;text-transform:uppercase;white-space:nowrap">${esc(text)}</span>`;
  }

  function renderActionMiniGrid(accent, textDark) {
    const items = [
      { icon: "📞", label: "Call" },
      { icon: "💬", label: "WhatsApp" },
      { icon: "📍", label: "Visit" }
    ];
    return `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:100%;max-width:220px;margin:10px auto">
      ${items.map((it) => `<div style="text-align:center;padding:10px 6px;background:${accent}14;border:1.5px solid ${accent}44;border-radius:10px;box-shadow:0 2px 8px ${accent}22">
        <div style="font-size:18px;line-height:1">${it.icon}</div>
        <div style="font-size:8px;letter-spacing:1.5px;color:${textDark};opacity:0.75;margin-top:4px;font-weight:800">${it.label}</div>
      </div>`).join("")}
    </div>`;
  }

  function renderProBottomBand(data, accent, textColor) {
    const cat = data.category ? esc(data.category) : "";
    const gst = data.gst ? esc(data.gst) : "";
    const shop = data.shopType ? esc(data.shopType) : "";
    const chips = [cat, shop, gst ? `GST ${gst}` : ""].filter(Boolean);
    if (!chips.length) return "";
    return `<div style="grid-column:1/-1;display:flex;flex-wrap:wrap;gap:8px;padding:10px 14px;background:${accent}18;border-top:2px solid ${accent}55;margin-top:8px">
      ${chips.map((c) => renderMetaChip(c, accent, textColor, false)).join("")}
    </div>`;
  }

  function renderActionChips(phone, shopType, accent, textColor) {
    const chips = [];
    if (phone) chips.push(`<span style="font-size:11px;font-weight:800;letter-spacing:1.5px;padding:8px 14px;border:2px solid ${accent};color:${accent};border-radius:5px;text-transform:uppercase">WhatsApp</span>`);
    if (shopType) chips.push(`<span style="font-size:11px;font-weight:800;letter-spacing:1.5px;padding:8px 14px;background:${accent};color:${textColor};border-radius:5px;text-transform:uppercase">${esc(shopType)}</span>`);
    if (phone) chips.push(`<span style="font-size:11px;font-weight:800;letter-spacing:1.5px;padding:8px 14px;border:2px solid ${accent};color:${accent};border-radius:5px;text-transform:uppercase">Call Now</span>`);
    if (!chips.length) return "";
    return `<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:12px">${chips.join("")}</div>`;
  }

  /* ── Swoosh premium layout (reference visiting-card style) ── */
  const SWOOSH_CURVES = [
    { split: 575, c1x: 695, c1y: 95, c2x: 695, c2y: 505 },
    { split: 558, c1x: 712, c1y: 45, c2x: 642, c2y: 555 },
    { split: 588, c1x: 718, c1y: 130, c2x: 678, c2y: 470 },
    { split: 548, c1x: 728, c1y: 155, c2x: 728, c2y: 445 },
    { split: 602, c1x: 668, c1y: 65, c2x: 668, c2y: 535 },
    { split: 565, c1x: 705, c1y: 70, c2x: 655, c2y: 530 },
    { split: 592, c1x: 700, c1y: 110, c2x: 690, c2y: 490 },
    { split: 552, c1x: 735, c1y: 130, c2x: 715, c2y: 470 },
    { split: 608, c1x: 660, c1y: 80, c2x: 675, c2y: 520 },
    { split: 540, c1x: 740, c1y: 60, c2x: 620, c2y: 540 },
    { split: 580, c1x: 690, c1y: 140, c2x: 700, c2y: 460 },
    { split: 598, c1x: 675, c1y: 50, c2x: 685, c2y: 550 },
    { split: 562, c1x: 720, c1y: 100, c2x: 650, c2y: 500 },
    { split: 586, c1x: 710, c1y: 75, c2x: 665, c2y: 525 },
    { split: 550, c1x: 725, c1y: 170, c2x: 735, c2y: 430 },
    { split: 604, c1x: 662, c1y: 90, c2x: 670, c2y: 510 },
    { split: 568, c1x: 708, c1y: 55, c2x: 638, c2y: 545 },
    { split: 594, c1x: 698, c1y: 145, c2x: 688, c2y: 455 },
    { split: 544, c1x: 732, c1y: 85, c2x: 712, c2y: 515 },
    { split: 610, c1x: 655, c1y: 110, c2x: 680, c2y: 490 },
    { split: 556, c1x: 715, c1y: 40, c2x: 645, c2y: 560 },
    { split: 584, c1x: 702, c1y: 160, c2x: 692, c2y: 440 },
    { split: 596, c1x: 672, c1y: 70, c2x: 678, c2y: 530 },
    { split: 546, c1x: 738, c1y: 120, c2x: 718, c2y: 480 },
    { split: 600, c1x: 665, c1y: 100, c2x: 660, c2y: 500 }
  ];

  function getSwooshGeometry(variant) {
    const p = SWOOSH_CURVES[(variant || 0) % SWOOSH_CURVES.length];
    const { split, c1x, c1y, c2x, c2y } = p;
    const clip = `M0,0 L${split},0 C${c1x},${c1y} ${c2x},${c2y} ${split},600 L0,600 Z`;
    const curve = `M${split},0 C${c1x},${c1y} ${c2x},${c2y} ${split},600`;
    return { clip, curve, split, c1x, c1y, c2x, c2y, leftPct: (split / 1050 * 100).toFixed(2) };
  }

  function escAttr(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  function normalizeIndianMobile(raw) {
    let digits = String(raw || "").replace(/\D/g, "");
    if (digits.length >= 12 && digits.startsWith("91")) digits = digits.slice(2);
    if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
    if (digits.length > 10) digits = digits.slice(-10);
    if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) return digits;
    return digits.length === 10 ? digits : "";
  }

  function vcardEscape(value) {
    return String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n");
  }

  function buildCardQrPayload(data) {
    const mode = data.qrMode || "whatsapp";
    const mobile = normalizeIndianMobile(data.mobile);
    const name = data.name || data.businessName || "Contact";
    const org = data.businessName || "";
    const email = data.email || "";
    const addr = (data.address || "").replace(/\n/g, ", ");

    if (mobile.length !== 10) {
      return `BEGIN:VCARD\nVERSION:3.0\nFN:${vcardEscape(name)}\nEND:VCARD`;
    }

    // 10-digit tel: only — avoids carrier adding extra prefix (e.g. 835) before +91 on Indian phones
    if (mode === "call") return `tel:${mobile}`;

    if (mode === "whatsapp") return `https://wa.me/91${mobile}`;

    const lines = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${vcardEscape(name)}`,
      org ? `ORG:${vcardEscape(org)}` : "",
      `TEL;TYPE=CELL:${mobile}`,
      email ? `EMAIL:${vcardEscape(email)}` : "",
      addr ? `ADR;TYPE=WORK:;;${vcardEscape(addr)};;;;` : "",
      data.gst ? `NOTE:${vcardEscape("GST " + data.gst)}` : "",
      "END:VCARD"
    ].filter(Boolean);
    return lines.join("\n");
  }

  function getQrModeHint(data) {
    const mobile = normalizeIndianMobile(data.mobile);
    const mode = data.qrMode || "whatsapp";
    if (mode === "whatsapp") {
      return mobile.length === 10
        ? `QR opens WhatsApp for +91 ${mobile} when scanned.`
        : "Add a valid 10-digit mobile number to activate WhatsApp QR.";
    }
    if (mode === "call") {
      return mobile.length === 10
        ? `QR dials ${mobile} directly (no extra prefix).`
        : "Add a valid 10-digit mobile number to activate call QR.";
    }
    return mobile.length === 10
      ? "QR saves your contact with phone, email and address."
      : "Add a valid 10-digit mobile number for the contact QR.";
  }

  function qrToDataUrl(text, size) {
    if (!text || typeof QRCode === "undefined") return "";
    const wrap = document.createElement("div");
    wrap.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none";
    document.body.appendChild(wrap);
    try {
      new QRCode(wrap, {
        text,
        width: size,
        height: size,
        colorDark: "#111111",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });
      const canvas = wrap.querySelector("canvas");
      if (canvas) return canvas.toDataURL("image/png");
      const img = wrap.querySelector("img");
      return img?.src || "";
    } catch {
      return "";
    } finally {
      wrap.remove();
    }
  }

  function renderRealQR(data, size) {
    const sz = size || 118;
    const payload = buildCardQrPayload(data);
    const dataUrl = qrToDataUrl(payload, sz);
    if (dataUrl) {
      return `<img src="${dataUrl}" width="${sz}" height="${sz}" alt="Scan QR" class="bc-qr-img" style="width:${sz}px;height:${sz}px;background:#fff;border:1px solid #d1d5db;border-radius:4px;padding:4px;box-shadow:0 2px 8px rgba(0,0,0,0.08)"/>`;
    }
    return `<div class="bc-qr-host" data-qr-payload="${escAttr(payload)}" data-qr-size="${sz}" style="width:${sz}px;height:${sz}px;min-width:${sz}px;background:#fff;border:1px solid #d1d5db;border-radius:4px"></div>`;
  }

  function hydrateCardQrs(root) {
    if (!root || typeof QRCode === "undefined") return;
    root.querySelectorAll(".bc-qr-host").forEach((host) => {
      const payload = host.getAttribute("data-qr-payload");
      const size = parseInt(host.getAttribute("data-qr-size") || "118", 10);
      if (!payload) return;
      host.innerHTML = "";
      try {
        new QRCode(host, {
          text: payload,
          width: size,
          height: size,
          colorDark: "#111111",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.H
        });
      } catch { /* ignore */ }
    });
  }

  function swooshNameStyle(style) {
    if (style === "light") return "margin:0;font-size:44px;font-weight:400;color:#ffffff;line-height:1.08;letter-spacing:3px;font-family:Georgia,'Times New Roman',Times,serif;text-transform:uppercase";
    if (style === "condensed") return "margin:0;font-size:48px;font-weight:800;color:#ffffff;line-height:1.02;letter-spacing:0px;font-family:Georgia,'Times New Roman',Times,serif;text-transform:uppercase";
    return "margin:0;font-size:46px;font-weight:700;color:#ffffff;line-height:1.05;letter-spacing:1px;font-family:Georgia,'Times New Roman',Times,serif;text-transform:uppercase";
  }

  function swooshIcon(type, color, size) {
    const s = size || 15;
    const base = `width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"`;
    if (type === "phone") return `<svg ${base}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>`;
    if (type === "email") return `<svg ${base}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`;
    if (type === "globe") return `<svg ${base}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>`;
    if (type === "pin") return `<svg ${base}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
    return "";
  }

  function renderSwooshLogo(type, accent) {
    if (type === "triangle") {
      return `<svg width="54" height="54" viewBox="0 0 54 54"><polygon points="27,6 48,46 6,46" fill="${accent}"/></svg>`;
    }
    if (type === "diamond") {
      return `<svg width="54" height="54" viewBox="0 0 54 54"><polygon points="27,4 50,27 27,50 4,27" fill="${accent}"/></svg>`;
    }
    if (type === "hex") {
      return `<svg width="54" height="54" viewBox="0 0 54 54"><polygon points="27,4 47,16 47,38 27,50 7,38 7,16" fill="${accent}"/></svg>`;
    }
    if (type === "wave") {
      return `<svg width="54" height="54" viewBox="0 0 54 54"><path d="M6 34 C14 22 22 40 30 28 C38 16 46 34 48 28" fill="none" stroke="${accent}" stroke-width="6" stroke-linecap="round"/><circle cx="27" cy="16" r="8" fill="${accent}"/></svg>`;
    }
    if (type === "star") {
      return `<svg width="54" height="54" viewBox="0 0 54 54"><polygon points="27,4 33,20 50,20 36,30 42,46 27,36 12,46 18,30 4,20 21,20" fill="${accent}"/></svg>`;
    }
    if (type === "rings") {
      return `<svg width="54" height="54" viewBox="0 0 54 54"><circle cx="27" cy="27" r="22" fill="none" stroke="${accent}" stroke-width="4"/><circle cx="27" cy="27" r="14" fill="none" stroke="${accent}" stroke-width="3"/><circle cx="27" cy="27" r="6" fill="${accent}"/></svg>`;
    }
    return `<svg width="54" height="54" viewBox="0 0 54 54">
      <rect x="10" y="8" width="7" height="38" rx="2" fill="${accent}" transform="rotate(-18 13.5 27)"/>
      <rect x="23" y="8" width="7" height="38" rx="2" fill="${accent}"/>
      <rect x="36" y="8" width="7" height="38" rx="2" fill="${accent}" transform="rotate(18 39.5 27)"/>
    </svg>`;
  }

  function renderSwooshContactItem(iconType, text, iconStyle) {
    if (!text) return "";
    const style = iconStyle || "circle";
    let iconWrap = "";
    if (style === "square") {
      iconWrap = `<div style="width:38px;height:38px;min-width:38px;border-radius:8px;border:1.5px solid rgba(255,255,255,0.9);display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.06)">${swooshIcon(iconType, "#ffffff")}</div>`;
    } else if (style === "filled") {
      iconWrap = `<div style="width:38px;height:38px;min-width:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.92)">${swooshIcon(iconType, "#1a1a1a")}</div>`;
    } else {
      iconWrap = `<div style="width:38px;height:38px;min-width:38px;border-radius:50%;border:1.5px solid rgba(255,255,255,0.9);display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.06)">${swooshIcon(iconType, "#ffffff")}</div>`;
    }
    return `<div style="display:flex;align-items:center;gap:14px;margin-bottom:18px">
      ${iconWrap}
      <div style="font-size:14px;color:#ffffff;font-weight:400;line-height:1.4;font-family:'Segoe UI',system-ui,sans-serif;word-break:break-word">${text}</div>
    </div>`;
  }

  function renderSwooshDeco(tpl, dark, light, accent, geo) {
    const deco = tpl.deco || "none";
    const leftW = geo.leftPct;
    const rightW = (100 - parseFloat(geo.leftPct)).toFixed(2);
    let html = "";
    if (deco === "dots") {
      html += `<div style="position:absolute;left:0;top:0;width:${leftW}%;height:100%;opacity:0.1;background-image:radial-gradient(circle,#fff 1.2px,transparent 1.2px);background-size:16px 16px;pointer-events:none;z-index:2"></div>`;
    } else if (deco === "lines") {
      html += `<div style="position:absolute;left:0;top:0;width:${leftW}%;height:100%;opacity:0.07;background:repeating-linear-gradient(-45deg,transparent,transparent 10px,#fff 10px,#fff 11px);pointer-events:none;z-index:2"></div>`;
    } else if (deco === "glow") {
      html += `<div style="position:absolute;left:8%;top:18%;width:240px;height:240px;background:radial-gradient(circle,${accent}55,transparent 68%);pointer-events:none;z-index:2"></div>`;
    } else if (deco === "strip") {
      html += `<div style="position:absolute;left:0;top:0;bottom:0;width:9px;background:linear-gradient(180deg,${accent},${accent}88);z-index:4;border-radius:28px 0 0 28px"></div>`;
    } else if (deco === "mesh") {
      html += `<div style="position:absolute;right:0;top:0;width:${rightW}%;height:100%;opacity:0.05;background-image:linear-gradient(${accent} 1px,transparent 1px),linear-gradient(90deg,${accent} 1px,transparent 1px);background-size:22px 22px;pointer-events:none;z-index:2"></div>`;
    } else if (deco === "corners") {
      html += `<div style="position:absolute;right:28px;top:28px;width:44px;height:44px;border-top:3px solid ${accent};border-right:3px solid ${accent};opacity:0.45;z-index:2"></div>`;
      html += `<div style="position:absolute;right:28px;bottom:28px;width:44px;height:44px;border-bottom:3px solid ${accent};border-right:3px solid ${accent};opacity:0.45;z-index:2"></div>`;
    }
    return html;
  }

  function renderSwooshCard(data, tpl) {
    const name = esc((data.name || "Your Name").toUpperCase());
    const desig = esc(data.designation || "Owner");
    const biz = esc((data.businessName || "Company Logo").toUpperCase());
    const tagline = esc([data.category, data.shopType].filter(Boolean).join(" · ") || "Tagline Here");
    const phone = data.mobile ? `+91 ${data.mobile}` : "+91 XXXXX XXXXX";
    const email = data.email ? esc(data.email) : "your email goes here";
    const webLine = esc(data.category || data.shopType || "Your business category");
    const addr = data.address ? esc(data.address) : "your address goes here";
    const dark = tpl.darkBg || "#0a0a0a";
    const light = tpl.lightBg || "#ffffff";
    const accent = tpl.accent || "#f97316";
    const textDark = tpl.textDark || "#111827";
    const geo = getSwooshGeometry(tpl.swoosh);
    const logoType = tpl.logo || "bars";
    const strokeW = tpl.stroke || 26;
    const iconStyle = tpl.iconStyle || "circle";
    const nameStyle = tpl.nameStyle || "bold";
    const darkFill = tpl.darkStyle === "gradient" ? `url(#bcDarkGrad-${tpl.id})` : dark;
    const innerCurve = tpl.deco === "double"
      ? `<path d="${geo.curve}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="8" stroke-linecap="round"/>`
      : "";

    const initial = esc(getInitial(data.name || data.businessName));
    const gst = data.gst ? esc(data.gst) : "";
    const rightW = (100 - parseFloat(geo.leftPct)).toFixed(2);

    return `<div class="bc-card-export bc-swoosh-card bc-card-luxury" style="background:${light};border-radius:28px;overflow:hidden">
      <svg style="position:absolute;inset:0;width:100%;height:100%;z-index:1" viewBox="0 0 1050 600" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bcDarkGrad-${tpl.id}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${dark}"/>
            <stop offset="100%" stop-color="${accent}44"/>
          </linearGradient>
          <pattern id="bcLuxDots-${tpl.id}" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="${accent}" opacity="0.15"/>
          </pattern>
        </defs>
        <rect width="1050" height="600" fill="${light}" rx="28"/>
        <rect x="${geo.split}" y="0" width="${1050 - geo.split}" height="600" fill="url(#bcLuxDots-${tpl.id})"/>
        <path d="${geo.clip}" fill="${darkFill}"/>
        <path d="${geo.curve}" fill="none" stroke="${accent}" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round"/>
        ${innerCurve}
      </svg>
      ${renderLuxAnimLayers(accent)}${renderLuxCornerFrame(accent)}${renderSwooshDeco(tpl, dark, light, accent, geo)}
      <div style="position:absolute;left:0;top:0;width:${geo.leftPct}%;height:100%;padding:44px 36px 40px 48px;display:flex;flex-direction:column;z-index:4;box-sizing:border-box">
        <div style="flex-shrink:0">
          <div style="font-size:10px;letter-spacing:4px;color:${accent};font-weight:800;margin-bottom:8px;opacity:0.95">★ PREMIUM VISITING CARD</div>
          <h2 style="${swooshNameStyle(nameStyle)}">${name}</h2>
          <div style="width:100%;max-width:300px;height:2px;background:linear-gradient(90deg,${accent},rgba(255,255,255,0.5),transparent);margin:14px 0 10px"></div>
          <p style="margin:0;font-size:17px;color:rgba(255,255,255,0.92);font-weight:300;font-family:'Segoe UI',system-ui,sans-serif;letter-spacing:0.3px">${desig}</p>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px">
            ${renderMetaChip(data.shopType, accent, "#fff", true)}
            ${renderMetaChip(data.category, accent, "#fff", false)}
          </div>
        </div>
        <div style="margin-top:auto;padding-top:20px;max-width:92%">
          ${renderSwooshContactItem("phone", phone, iconStyle)}
          ${renderSwooshContactItem("email", email, iconStyle)}
          ${renderSwooshContactItem("globe", webLine, iconStyle)}
          ${renderSwooshContactItem("pin", addr, iconStyle)}
        </div>
      </div>
      <div style="position:absolute;right:0;top:0;width:${rightW}%;height:100%;padding:32px 24px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;z-index:4;box-sizing:border-box">
        <div style="position:absolute;right:10%;top:50%;transform:translateY(-50%);font-size:140px;font-weight:700;color:${accent};opacity:0.06;font-family:Georgia,serif;pointer-events:none;line-height:1">${initial}</div>
        <div class="bc-anim-float bc-logo-glow" style="--bc-accent:${accent};display:flex;justify-content:center;padding:14px;border-radius:50%;background:linear-gradient(135deg,${accent}22,${accent}08);border:2px solid ${accent}44;box-shadow:0 4px 20px ${accent}33">${renderSwooshLogo(logoType, accent)}</div>
        <div style="text-align:center;width:100%">
          <div style="font-size:14px;font-weight:800;letter-spacing:2.5px;color:${textDark};font-family:'Segoe UI',system-ui,sans-serif;text-transform:uppercase;line-height:1.3">${biz}</div>
          <div style="font-size:10px;letter-spacing:1.5px;color:${textDark};opacity:0.6;margin-top:5px;font-family:'Segoe UI',system-ui,sans-serif;text-transform:uppercase;font-weight:600">${tagline}</div>
          <div style="width:70%;height:2px;background:linear-gradient(90deg,transparent,${accent},transparent);margin:12px auto"></div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:4px">
            ${gst ? renderMetaChip(`GST ${gst}`, accent, textDark, false) : ""}
            ${renderMetaChip("Verified Business", accent, textDark, false)}
          </div>
          ${renderActionMiniGrid(accent, textDark)}
        </div>
        <div class="bc-anim-qr-pulse" style="--bc-accent:${accent}">${renderLuxQRBlock(data, accent, 108, "Scan · Connect · Grow")}</div>
      </div>
    </div>`;
  }

  function renderPremiumPatterns(tpl) {
    const a = tpl.accent;
    let out = `<div style="position:absolute;inset:0;opacity:0.06;background:repeating-linear-gradient(45deg,${a} 0,${a} 1px,transparent 1px,transparent 12px);pointer-events:none"></div>`;
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
    const foilBar = `<div style="grid-column:1/-1;height:6px;background:linear-gradient(90deg,transparent,${a},${a}88,${a},transparent);border-radius:3px;opacity:0.75;margin-top:8px"></div>`;

    return `<div class="bc-card-export bc-lux-card bc-card-luxury" style="background:${tpl.bg};color:${t}">${renderLuxAnimLayers(a)}${renderLuxCornerFrame(a)}${renderPremiumPatterns(tpl)}${renderPrintedOverlay(tpl)}${renderVisitingAccent(a)}
      <div style="position:absolute;left:0;top:0;bottom:0;width:5px;background:linear-gradient(180deg,${a},${a}55);z-index:2"></div>
      <div style="position:absolute;inset:0;padding:22px 26px 22px 30px;display:flex;flex-direction:column;font-family:${font};z-index:2;height:100%;box-sizing:border-box">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:6px">
          <div style="font-size:13px;font-weight:800;letter-spacing:4px;text-transform:uppercase;color:${a}">${biz}</div>
          ${meta ? `<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${t};opacity:0.8;text-align:right;font-weight:600">${meta}</div>` : ""}
        </div>
        <div style="height:2px;background:linear-gradient(90deg,${a},${a}66,transparent);margin-bottom:10px"></div>
        <div style="flex:1;display:grid;grid-template-columns:1fr 270px 200px;grid-template-rows:1fr auto auto;gap:12px 18px;align-items:center;min-height:0">
          <div style="grid-row:1;display:flex;flex-direction:column;justify-content:center;padding-right:16px;border-right:2px solid ${a}33;min-height:0">
            ${renderLuxContactRow("MOBILE", phone, "phone", a, t)}
            ${renderLuxContactRow("EMAIL", email, "email", a, t)}
            ${renderLuxMetaChips(cat, shop, gst, a)}
            ${renderActionMiniGrid(a, t)}
          </div>
          <div style="grid-row:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:18px 14px;background:${a}10;border-radius:14px;border:1px solid ${a}35;height:100%;min-height:0">
            ${renderCenteredLuxLogo(initial, tpl, `
              <h2 style="margin:0;font-size:38px;font-weight:700;color:${a};line-height:1.05;letter-spacing:0.5px">${name}</h2>
              ${desig ? `<p style="margin:6px 0 0;font-size:15px;color:${t};opacity:0.9;letter-spacing:2.5px;text-transform:uppercase;font-weight:600">${desig}</p>` : ""}
              <div style="width:64px;height:3px;background:${a};margin:12px auto;opacity:0.9"></div>
              ${renderActionChips(data.mobile, shop, a, tpl.bg)}
              <div style="margin-top:10px;font-size:10px;letter-spacing:4px;color:${a};opacity:0.7;text-transform:uppercase;font-weight:700">Premium Visiting Card</div>
            `)}
          </div>
          <div style="grid-row:1">${renderCenteredQR(data, a, 108)}</div>
          ${renderLuxFooterBar(addr, a, t, `<div style="font-size:10px;letter-spacing:3px;color:${a};opacity:0.75;text-transform:uppercase;white-space:nowrap;font-weight:700">Bolkarigar</div>`)}
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

    return `<div class="bc-card-export bc-lux-card bc-card-luxury" style="background:${tpl.bg};color:${t}">${renderLuxAnimLayers(a)}${renderLuxCornerFrame(a)}${renderPremiumPatterns(tpl)}${renderPrintedOverlay(tpl)}${renderVisitingAccent(a)}
      <div style="position:absolute;left:0;top:0;bottom:0;width:30%;background:linear-gradient(180deg,${a}35,${a}12);border-right:2px solid ${a}55;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:22px 16px;z-index:2">
        <div class="bc-anim-float bc-logo-glow" style="--bc-accent:${a};transform:scale(0.92)">${renderLuxEmblem(initial, tpl)}</div>
        <div style="margin-top:14px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${a};text-align:center;line-height:1.6;font-weight:800">${biz}</div>
        ${renderActionChips(data.mobile, shop, a, tpl.bg)}
      </div>
      <div style="position:absolute;left:30%;right:0;top:0;bottom:0;padding:22px 24px 22px 18px;display:flex;flex-direction:column;font-family:${font};z-index:2">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
          <div style="flex:1;min-width:0">
            <h2 style="margin:0;font-size:44px;font-weight:700;color:${a};line-height:1.05">${name}</h2>
            ${desig ? `<p style="margin:6px 0 0;font-size:17px;color:${t};opacity:0.9;letter-spacing:2px;text-transform:uppercase;font-weight:600">${desig}</p>` : ""}
          </div>
        </div>
        <div style="height:2px;background:linear-gradient(90deg,${a},transparent);margin:12px 0"></div>
        <div style="flex:1;display:flex;flex-direction:column;min-height:0;align-items:stretch">
          ${renderLuxContactRow("MOBILE", phone, "phone", a, t)}
          ${renderLuxContactRow("EMAIL", email, "email", a, t)}
          ${renderLuxMetaChips(cat, shop, gst, a)}
          <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:10px 0">${renderCenteredQR(data, a, 104)}</div>
          <div style="margin-top:6px">${renderLuxFooterBar(addr, a, t, "")}</div>
        </div>
        <div style="height:5px;background:linear-gradient(90deg,transparent,${a},transparent);margin-top:10px;opacity:0.65"></div>
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

    return `<div class="bc-card-export bc-lux-card bc-card-luxury" style="background:${tpl.bg};color:${t}">${renderLuxAnimLayers(a)}${renderLuxCornerFrame(a)}${renderPremiumPatterns(tpl)}${renderPrintedOverlay(tpl)}${renderVisitingAccent(a)}
      <div style="position:absolute;left:0;top:0;bottom:0;width:5px;background:linear-gradient(180deg,${a},${a}44);z-index:2"></div>
      <div style="position:absolute;right:0;top:0;bottom:0;width:5px;background:linear-gradient(180deg,${a}44,${a});z-index:2"></div>
      <div style="position:absolute;inset:0;padding:20px 28px 18px 32px;display:flex;flex-direction:column;font-family:${font};z-index:2;height:100%;box-sizing:border-box">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="font-size:13px;letter-spacing:5px;text-transform:uppercase;color:${a};font-weight:800">${biz}</div>
          ${cat || shop ? `<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${t};opacity:0.8;font-weight:600">${[cat, shop].filter(Boolean).join(" · ")}</div>` : ""}
        </div>
        <div style="height:2px;background:linear-gradient(90deg,${a},${a}55,transparent);margin-bottom:8px"></div>
        <div style="flex:1;display:grid;grid-template-columns:1fr 260px 200px;gap:16px 18px;align-items:center;min-height:0">
          <div style="display:flex;flex-direction:column;justify-content:center;padding:8px 12px 8px 0;border-right:2px solid ${a}33">
            ${renderLuxContactRow("MOBILE", phone, "phone", a, t)}
            ${renderLuxContactRow("EMAIL", email, "email", a, t)}
            ${renderLuxMetaChips(cat, shop, gst, a)}
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:16px 12px;background:${a}10;border-radius:14px;border:1px solid ${a}33;height:100%">
            ${renderCenteredLuxLogo(initial, tpl, `
              <h2 style="margin:0;font-size:${isNoir ? "36" : "34"}px;font-weight:${isNoir ? "300" : "700"};color:${isNoir ? t : a};letter-spacing:${isNoir ? "2px" : "0.5px"};line-height:1.05">${name}</h2>
              ${desig ? `<p style="margin:6px 0 0;font-size:15px;color:${a};letter-spacing:2.5px;text-transform:uppercase;font-weight:600">${desig}</p>` : ""}
              <div style="width:56px;height:2px;background:${a};margin:10px auto"></div>
              ${renderActionChips(data.mobile, shop, a, tpl.bg)}
            `)}
          </div>
          <div>${renderCenteredQR(data, a, 100)}</div>
        </div>
        <div style="margin-top:8px">${renderLuxFooterBar(addr, a, t, "")}</div>
        <div style="height:5px;background:linear-gradient(90deg,transparent,${a},transparent);margin-top:8px;opacity:0.6"></div>
      </div>
    </div>`;
  }

  function renderLuxDiagonalCard(data, tpl) {
    const name = esc(data.name || "Your Name");
    const desig = esc(data.designation || "");
    const biz = esc(data.businessName || "Business Name");
    const phone = data.mobile ? `+91 ${data.mobile}` : "+91 XXXXX XXXXX";
    const email = data.email ? esc(data.email) : "";
    const addr = data.address ? esc(data.address) : "";
    const initial = esc(getInitial(data.name || data.businessName));
    const a = tpl.accent;
    const t = tpl.text;
    const font = luxFont(tpl);

    return `<div class="bc-card-export bc-lux-card bc-card-luxury" style="background:${tpl.bg};color:${t}">${renderLuxAnimLayers(a)}${renderLuxCornerFrame(a)}${renderPremiumPatterns(tpl)}${renderPrintedOverlay(tpl)}
      <div style="position:absolute;inset:0;background:linear-gradient(135deg,${a}44 0%,transparent 42%,${a}22 100%);pointer-events:none;z-index:1"></div>
      <div style="position:absolute;top:-80px;right:-80px;width:320px;height:320px;background:linear-gradient(135deg,${a},${a}55);transform:rotate(45deg);opacity:0.35;z-index:1"></div>
      <div style="position:absolute;bottom:-60px;left:-60px;width:240px;height:240px;border:3px solid ${a};transform:rotate(45deg);opacity:0.25;z-index:1"></div>
      <div style="position:absolute;inset:14px;border:1px solid ${a};opacity:0.45;pointer-events:none;z-index:2"></div>
      <div style="position:absolute;inset:22px;border:1px solid ${a};opacity:0.2;pointer-events:none;z-index:2"></div>
      ${renderLuxWatermark(initial, a)}
      <div style="position:absolute;inset:0;padding:28px 32px;display:grid;grid-template-columns:1fr 250px 200px;grid-template-rows:1fr auto;gap:16px 18px;font-family:${font};z-index:3;height:100%;box-sizing:border-box;align-items:center">
        <div style="display:flex;flex-direction:column;justify-content:center">
          <div style="font-size:12px;letter-spacing:5px;text-transform:uppercase;color:${a};font-weight:800;margin-bottom:8px">${biz}</div>
          <h2 style="margin:0;font-size:44px;font-weight:700;color:${t};line-height:1.05;letter-spacing:0.5px">${name}</h2>
          ${desig ? `<p style="margin:8px 0 0;font-size:17px;color:${a};letter-spacing:3px;text-transform:uppercase;font-weight:600">${desig}</p>` : ""}
          <div style="width:80px;height:3px;background:linear-gradient(90deg,${a},transparent);margin:16px 0"></div>
          ${renderLuxContactRow("MOBILE", phone, "phone", a, t)}
          ${renderLuxContactRow("EMAIL", email, "email", a, t)}
          ${renderActionChips(data.mobile, data.shopType, a, tpl.bg)}
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:14px;background:${a}12;border-radius:14px;border:1px solid ${a}35">
          ${renderCenteredLuxLogo(initial, tpl, "")}
        </div>
        <div>${renderCenteredQR(data, a, 108)}</div>
        ${renderLuxFooterBar(addr, a, t, `<div style="font-size:10px;letter-spacing:4px;color:${a};font-weight:800">LUXURY</div>`)}
      </div>
    </div>`;
  }

  function renderLuxExecutiveCard(data, tpl) {
    const name = esc(data.name || "Your Name");
    const desig = esc(data.designation || "");
    const biz = esc(data.businessName || "Business Name");
    const phone = data.mobile ? `+91 ${data.mobile}` : "+91 XXXXX XXXXX";
    const email = data.email ? esc(data.email) : "";
    const gst = data.gst ? esc(data.gst) : "";
    const addr = data.address ? esc(data.address) : "";
    const cat = data.category ? esc(data.category) : "";
    const initial = esc(getInitial(data.name || data.businessName));
    const a = tpl.accent;
    const t = tpl.text;
    const font = luxFont(tpl);

    return `<div class="bc-card-export bc-lux-card bc-card-luxury" style="background:${tpl.bg};color:${t}">${renderLuxAnimLayers(a)}${renderLuxCornerFrame(a)}${renderPremiumPatterns(tpl)}${renderPrintedOverlay(tpl)}
      <div style="position:absolute;top:0;left:0;right:0;height:120px;background:linear-gradient(135deg,${a},${a}88);z-index:1"></div>
      <div style="position:absolute;top:0;left:0;right:0;height:120px;opacity:0.15;background:repeating-linear-gradient(-45deg,#fff 0,#fff 1px,transparent 1px,transparent 8px);z-index:2"></div>
      <div style="position:absolute;top:22px;left:50%;transform:translateX(-50%);z-index:3">
        <div class="bc-anim-float bc-logo-glow" style="--bc-accent:${a};width:92px;height:92px;border-radius:50%;background:${tpl.bg};border:4px solid ${a};display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:800;color:${a};box-shadow:0 8px 24px rgba(0,0,0,0.35)">${initial}</div>
      </div>
      <div style="position:absolute;inset:0;padding:118px 36px 28px;display:flex;flex-direction:column;font-family:${font};z-index:3;height:100%;box-sizing:border-box">
        <div style="text-align:center;padding-bottom:8px">
          <div style="font-size:13px;letter-spacing:4px;text-transform:uppercase;color:#fff;font-weight:800;opacity:0.95">${biz}</div>
          <h2 style="margin:6px 0 0;font-size:42px;font-weight:700;color:#fff;line-height:1.05;text-shadow:0 2px 8px rgba(0,0,0,0.2)">${name}</h2>
          ${desig ? `<p style="margin:4px 0 0;font-size:16px;color:rgba(255,255,255,0.92);letter-spacing:2px;text-transform:uppercase">${desig}</p>` : ""}
        </div>
        <div style="flex:1;display:grid;grid-template-columns:1fr 200px;gap:16px;margin-top:12px;align-items:center">
          <div>
            ${renderLuxContactRow("MOBILE", phone, "phone", a, t)}
            ${renderLuxContactRow("EMAIL", email, "email", a, t)}
            ${renderLuxMetaChips(cat, data.shopType, gst, a)}
          </div>
          <div>${renderCenteredQR(data, a, 100)}</div>
        </div>
        ${renderLuxFooterBar(addr, a, t, "")}
        <div style="height:4px;background:linear-gradient(90deg,${a},transparent);margin-top:10px;opacity:0.7"></div>
      </div>
    </div>`;
  }

  function renderLuxArtDecoCard(data, tpl) {
    const name = esc(data.name || "Your Name");
    const desig = esc(data.designation || "");
    const biz = esc(data.businessName || "Business Name");
    const phone = data.mobile ? `+91 ${data.mobile}` : "+91 XXXXX XXXXX";
    const email = data.email ? esc(data.email) : "";
    const addr = data.address ? esc(data.address) : "";
    const initial = esc(getInitial(data.name || data.businessName));
    const a = tpl.accent;
    const t = tpl.text;
    const font = luxFont(tpl);
    const decoCorner = (top, left, flip) => {
      const pos = top ? "top:20px" : "bottom:20px";
      const side = left ? "left:20px" : "right:20px";
      const rot = flip ? "scaleX(-1)" : "";
      return `<div style="position:absolute;${pos};${side};width:56px;height:56px;border-${top ? "top" : "bottom"}:3px solid ${a};border-${left ? "left" : "right"}:3px solid ${a};opacity:0.65;transform:${rot};z-index:2"></div>`;
    };

    return `<div class="bc-card-export bc-lux-card bc-card-luxury" style="background:${tpl.bg};color:${t}">${renderLuxAnimLayers(a)}${renderPremiumPatterns(tpl)}${renderPrintedOverlay(tpl)}
      ${decoCorner(true, true, false)}${decoCorner(true, false, true)}${decoCorner(false, true, false)}${decoCorner(false, false, true)}
      <div style="position:absolute;top:50%;left:50%;width:200px;height:200px;margin:-100px 0 0 -100px;border:1px solid ${a};opacity:0.12;transform:rotate(45deg);z-index:1"></div>
      <div style="position:absolute;top:50%;left:50%;width:140px;height:140px;margin:-70px 0 0 -70px;border:1px solid ${a};opacity:0.18;transform:rotate(45deg);z-index:1"></div>
      <div style="position:absolute;inset:0;padding:32px 40px;display:flex;flex-direction:column;align-items:center;text-align:center;font-family:${font};z-index:3;height:100%;box-sizing:border-box">
        <div style="font-size:11px;letter-spacing:6px;text-transform:uppercase;color:${a};font-weight:800;margin-bottom:6px">${biz}</div>
        <div style="width:120px;height:2px;background:linear-gradient(90deg,transparent,${a},transparent);margin-bottom:14px"></div>
        <div style="width:72px;height:72px;border:2px solid ${a};display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:700;color:${a};margin-bottom:12px;transform:rotate(45deg)">
          <span style="transform:rotate(-45deg)">${initial}</span>
        </div>
        <h2 style="margin:0;font-size:46px;font-weight:300;color:${t};letter-spacing:4px;text-transform:uppercase;line-height:1.1">${name}</h2>
        ${desig ? `<p style="margin:8px 0 0;font-size:15px;color:${a};letter-spacing:3px;text-transform:uppercase">${desig}</p>` : ""}
        <div style="width:80px;height:1px;background:${a};margin:16px auto;opacity:0.6"></div>
        <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:20px 32px;margin-top:8px">
          <div style="font-size:18px;font-weight:700;color:${t}">${phone}</div>
          ${email ? `<div style="font-size:16px;color:${t};opacity:0.9">${email}</div>` : ""}
        </div>
        <div style="margin-top:auto;width:100%;display:flex;flex-direction:column;align-items:center;gap:14px;padding-top:16px">
          ${renderCenteredQR(data, a, 96)}
          <div style="font-size:14px;color:${t};opacity:0.85;text-align:center;line-height:1.5;max-width:90%">${addr ? `📍 ${addr}` : ""}</div>
        </div>
      </div>
    </div>`;
  }

  function renderLuxuryCard(data, tpl) {
    const layout = tpl.layout || "lux-swoosh";
    if (layout === "lux-swoosh") return renderSwooshCard(data, tpl);
    if (layout === "lux-vertical") return renderLuxVerticalCard(data, tpl);
    if (layout === "lux-noir") return renderLuxCenterCard(data, tpl);
    if (layout === "lux-diagonal") return renderLuxDiagonalCard(data, tpl);
    if (layout === "lux-executive") return renderLuxExecutiveCard(data, tpl);
    if (layout === "lux-artdeco") return renderLuxArtDecoCard(data, tpl);
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
    const layout = tpl.layout || "classic";
    const isGrad = String(tpl.bg).includes("gradient");
    const logoColor = isGrad ? "#fff" : (tpl.bg === "#ffffff" || tpl.bg.startsWith("#fff") ? a : tpl.bg);
    const onDarkSide = layout === "split" || layout === "banner" || layout === "diagonal";

    let patternHtml = "";
    if (tpl.pattern === "dots") patternHtml = `<div class="bc-pattern-dots" style="color:${t}"></div>`;
    else if (tpl.pattern === "lines") patternHtml = `<div class="bc-pattern-lines" style="color:${t}"></div>`;

    let layoutDeco = "";
    if (layout === "wave") {
      layoutDeco += `<svg style="position:absolute;bottom:0;left:0;right:0;height:100px;pointer-events:none;z-index:1" viewBox="0 0 1050 120" preserveAspectRatio="none"><path fill="${a}" fill-opacity="0.3" d="M0,60 C200,120 400,0 600,60 C800,120 950,30 1050,60 L1050,120 L0,120 Z"/></svg>`;
    } else if (layout === "split") {
      layoutDeco += `<div style="position:absolute;left:0;top:0;bottom:0;width:34%;background:linear-gradient(180deg,${a}ee,${a}88);z-index:1"></div>`;
    } else if (layout === "modern") {
      layoutDeco += `<div style="position:absolute;left:0;top:0;bottom:0;width:10px;background:${a};z-index:1"></div>`;
    } else if (layout === "diagonal") {
      layoutDeco += `<div style="position:absolute;inset:0;background:linear-gradient(125deg,${a}55 0%,${a}22 38%,transparent 38%);z-index:1"></div>`;
    } else if (layout === "corner") {
      layoutDeco += `<div style="position:absolute;top:0;right:0;width:0;height:0;border-style:solid;border-width:0 180px 180px 0;border-color:transparent ${a}44 transparent transparent;z-index:1"></div>`;
    } else if (layout === "banner") {
      layoutDeco += `<div style="position:absolute;top:0;left:0;right:0;height:100px;background:linear-gradient(90deg,${a},${a}aa);z-index:1"></div>`;
    } else if (layout === "stripe") {
      layoutDeco += `<div style="position:absolute;inset:0;opacity:0.08;background:repeating-linear-gradient(90deg,${a} 0,${a} 4px,transparent 4px,transparent 24px);z-index:1"></div>`;
    } else if (layout === "glass") {
      layoutDeco += `<div style="position:absolute;inset:16px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.18);border-radius:16px;backdrop-filter:blur(4px);z-index:1"></div>`;
    }

    const topBand = layout !== "banner"
      ? `<div style="position:absolute;top:0;left:0;right:0;height:8px;background:linear-gradient(90deg,${a},${a}cc,transparent);z-index:1"></div>`
      : "";

    let padLeft = "28px";
    if (layout === "split") padLeft = "38%";
    else if (layout === "modern") padLeft = "44px";

    let nameSize = layout === "bold" ? "48" : "42";
    let nameColor = onDarkSide ? "#fff" : t;
    let accentColor = onDarkSide ? "#fff" : a;
    let bizColor = layout === "banner" ? "#fff" : (onDarkSide ? "#fff" : t);
    let padTop = layout === "banner" ? "112px" : "24px";

    if (layout === "centered") {
      return `<div class="bc-card-export bc-free-card bc-card-pro" style="background:${tpl.bg};color:${t}">${renderProAnimLayers(a)}${renderProCornerFrame(a)}${patternHtml}${topBand}${renderVisitingAccent(a)}
        <div style="position:absolute;inset:0;padding:28px 32px;display:flex;flex-direction:column;align-items:center;text-align:center;z-index:2;height:100%;box-sizing:border-box">
          <div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${a};font-weight:800;margin-bottom:8px">★ PRO VISITING CARD</div>
          ${renderProLogoCircle(initial, a, logoColor, false, 92)}
          <div style="height:12px"></div>
          <div style="font-size:13px;letter-spacing:3px;text-transform:uppercase;color:${a};font-weight:800">${biz}</div>
          <h2 style="margin:10px 0 0;font-size:44px;font-weight:800;color:${t};line-height:1.08">${name}</h2>
          ${desig ? `<p style="margin:6px 0 0;font-size:17px;color:${a};font-weight:700;text-transform:uppercase;letter-spacing:1px">${desig}</p>` : ""}
          <div style="width:64px;height:3px;background:${a};margin:14px auto;border-radius:2px"></div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:10px">
            ${renderMetaChip(shop, a, t, false)}
            ${renderMetaChip(cat, a, t, true)}
          </div>
          <div style="font-size:22px;font-weight:800;color:${t}">${phone}</div>
          ${email ? `<div style="font-size:16px;margin-top:8px;color:${t};opacity:0.9">${email}</div>` : ""}
          ${renderActionMiniGrid(a, t)}
          <div style="margin-top:14px;width:100%;display:flex;justify-content:center">${renderCenteredQR(data, a, 96)}</div>
          <div style="margin-top:12px;width:100%;font-size:15px;line-height:1.5;font-weight:600;padding:10px 14px;background:${a}18;border-left:4px solid ${a};border-radius:0 8px 8px 0;text-align:center">${addr ? `📍 ${addr}` : "Your business address"}</div>
          ${renderProBottomBand(data, a, t)}
        </div>
      </div>`;
    }

    return `<div class="bc-card-export bc-free-card bc-card-pro" style="background:${tpl.bg};color:${t}">${renderProAnimLayers(a)}${renderProCornerFrame(a)}${patternHtml}${layoutDeco}${renderVisitingAccent(a)}${topBand}
      <div style="position:absolute;inset:0;padding:${padTop} 28px 24px ${padLeft};display:flex;flex-direction:column;height:100%;box-sizing:border-box;z-index:2">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:12px">
          <div style="font-size:24px;font-weight:800;color:${bizColor}">${biz}</div>
          ${cat || shop ? `<div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;opacity:0.85;text-align:right;font-weight:700;color:${bizColor}">${[cat, shop].filter(Boolean).join(" · ")}</div>` : ""}
        </div>
        <div style="height:4px;width:72px;background:${accentColor};margin-bottom:10px;border-radius:2px"></div>
        <div style="flex:1;display:grid;grid-template-columns:1fr 190px 180px;gap:14px 16px;min-height:0;align-items:center">
          <div style="display:flex;flex-direction:column;justify-content:center">
            <h2 style="margin:0;font-size:${nameSize}px;font-weight:800;color:${nameColor};line-height:1.08">${name}</h2>
            ${desig ? `<p style="margin:5px 0 0;font-size:18px;color:${onDarkSide ? "#fff" : a};font-weight:700;letter-spacing:1px;text-transform:uppercase">${desig}</p>` : ""}
            <div style="margin-top:12px;display:flex;flex-direction:column;gap:12px;border-left:3px solid ${accentColor};padding-left:16px">
              <div><div style="font-size:10px;letter-spacing:2px;opacity:0.75;margin-bottom:3px;font-weight:700;color:${nameColor}">MOBILE</div><div style="font-size:22px;font-weight:800;color:${nameColor}">${phone}</div></div>
              ${email ? `<div><div style="font-size:10px;letter-spacing:2px;opacity:0.75;margin-bottom:3px;font-weight:700;color:${nameColor}">EMAIL</div><div style="font-size:17px;font-weight:700;word-break:break-all;color:${nameColor}">${email}</div></div>` : ""}
              ${gst ? `<div><div style="font-size:10px;letter-spacing:2px;opacity:0.75;margin-bottom:3px;font-weight:700;color:${nameColor}">GSTIN</div><div style="font-size:15px;font-weight:700;color:${nameColor}">${gst}</div></div>` : ""}
            </div>
            ${renderActionChips(data.mobile, shop, accentColor, onDarkSide ? a : tpl.bg)}
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:12px 8px;background:${a}12;border-radius:12px;border:1px solid ${a}33">
            ${renderProLogoCircle(initial, a, logoColor, onDarkSide, 86)}
          </div>
          <div>${renderCenteredQR(data, accentColor, 100)}</div>
        </div>
        <div style="margin-top:10px;padding:12px 16px;background:${a}22;border-left:4px solid ${a};border-radius:0 8px 8px 0;font-size:16px;line-height:1.5;display:flex;gap:10px;align-items:flex-start;font-weight:600;color:${t}">
          <span style="opacity:0.9;font-size:18px">📍</span><span>${addr || "Your business address"}</span>
        </div>
        ${renderProBottomBand(data, a, t)}
        <div style="height:4px;background:linear-gradient(90deg,${a},transparent);margin-top:10px;opacity:0.55;border-radius:2px"></div>
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
    hydrateCardQrs(preview);
    hydrateCardQrs(exportHost);
    const hint = document.getElementById("bcQrHint");
    if (hint) hint.textContent = getQrModeHint(data);
  }

  function renderPremiumThumbPreview(tpl) {
    const a = tpl.accent || "#f97316";
    const dark = tpl.darkBg || "#0a0a0a";
    const light = tpl.lightBg || "#ffffff";
    const layout = tpl.layout || "lux-swoosh";

    if (layout === "lux-swoosh") {
      return `<div class="bc-tpv bc-tpv-swoosh" style="background:${light}">
        <div class="bc-tpv-swoosh-dark" style="background:${dark}"></div>
        <div class="bc-tpv-swoosh-band" style="background:${a}"></div>
        <div class="bc-tpv-swoosh-logo" style="background:${a}"></div>
        <div class="bc-tpv-swoosh-qr"></div>
        <div class="bc-tpv-crown">👑</div>
        <div class="bc-tpv-text" style="color:${tpl.textDark || '#111'}">
          <div class="bc-tpv-lux" style="color:${a}">LUXURY</div>
          <div class="bc-tpv-sub">${esc(tpl.name)}</div>
        </div>
      </div>`;
    }

    let hint = "";
    if (layout === "lux-vertical") {
      hint = '<div class="bc-tpv-left" style="background:' + a + '33"></div><div class="bc-tpv-split-lines" style="left:36%"><span></span><span></span></div><div class="bc-tpv-qr" style="border-color:' + a + '"></div>';
    } else if (layout === "lux-noir") {
      hint = '<div class="bc-tpv-marble"></div><div class="bc-tpv-ring" style="left:18%;top:32%;border-color:' + a + '"></div><div class="bc-tpv-split-lines" style="left:52%"><span></span><span></span></div><div class="bc-tpv-qr" style="right:10px;border-color:' + a + '"></div>';
    } else if (layout === "lux-diagonal") {
      hint = '<div class="bc-tpv-diagonal" style="background:linear-gradient(135deg,' + a + '55,transparent 50%)"></div><div class="bc-tpv-diamond" style="border-color:' + a + '"></div><div class="bc-tpv-qr" style="border-color:' + a + '"></div>';
    } else if (layout === "lux-executive") {
      hint = '<div class="bc-tpv-exec-banner" style="background:' + a + '"></div><div class="bc-tpv-exec-avatar" style="border-color:' + a + '"></div><div class="bc-tpv-split-lines" style="left:38%;top:48%"><span></span><span></span></div>';
    } else if (layout === "lux-artdeco") {
      hint = '<div class="bc-tpv-deco-corner bc-tpv-deco-tl" style="border-color:' + a + '"></div><div class="bc-tpv-deco-corner bc-tpv-deco-br" style="border-color:' + a + '"></div><div class="bc-tpv-deco-diamond" style="border-color:' + a + '"></div>';
    } else {
      hint = '<div class="bc-tpv-split-left"></div><div class="bc-tpv-vdivider" style="background:' + a + '"></div><div class="bc-tpv-split-lines" style="left:52%"><span></span><span></span><span></span></div><div class="bc-tpv-qr" style="border-color:' + a + '"></div><div class="bc-tpv-bottom-band"></div>';
    }

    return `<div class="bc-tpv" style="background:${tpl.bg || light}">
      <div class="bc-tpv-frame" style="border-color:${a}"></div>
      <div class="bc-tpv-frame2" style="border-color:${a}"></div>
      ${hint}
      <div class="bc-tpv-crown">👑</div>
      <div class="bc-tpv-text" style="color:${tpl.text || tpl.textDark || '#111'}">
        <div class="bc-tpv-lux" style="color:${a}">LUXURY</div>
        <div class="bc-tpv-sub">${esc(tpl.name)}</div>
      </div>
    </div>`;
  }

  function renderFreeThumbPreview(tpl) {
    const layout = tpl.layout || "classic";
    let layoutHint = "";
    if (layout === "split") layoutHint = '<div class="bc-tfv-split" style="background:' + tpl.accent + '"></div>';
    else if (layout === "wave") layoutHint = '<div class="bc-tfv-wave" style="border-color:' + tpl.accent + '"></div>';
    else if (layout === "diagonal") layoutHint = '<div class="bc-tfv-diagonal" style="background:linear-gradient(125deg,' + tpl.accent + '66,transparent 45%)"></div>';
    else if (layout === "corner") layoutHint = '<div class="bc-tfv-corner" style="border-color:' + tpl.accent + ' transparent transparent transparent"></div>';
    else if (layout === "banner") layoutHint = '<div class="bc-tfv-banner" style="background:' + tpl.accent + '"></div>';
    else if (layout === "centered") layoutHint = '<div class="bc-tfv-center-dot" style="background:' + tpl.accent + '"></div>';
    else if (layout === "glass") layoutHint = '<div class="bc-tfv-glass"></div>';
    else if (layout === "bold" || layout === "stripe") layoutHint = '<div class="bc-tfv-stripe" style="background:repeating-linear-gradient(90deg,' + tpl.accent + '33 0,' + tpl.accent + '33 2px,transparent 2px,transparent 8px)"></div>';
    else if (layout === "modern") layoutHint = '<div class="bc-tfv-side" style="background:' + tpl.accent + '"></div>';

    return `<div class="bc-tfv" style="background:${tpl.bg};color:${tpl.text}">
      ${layoutHint}
      <div class="bc-tfv-bar" style="background:${tpl.accent}"></div>
      <div class="bc-tfv-body">
        <div class="bc-tfv-tag" style="color:${tpl.accent}">PRO</div>
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
        : '<span class="bc-free-badge">PRO</span>';
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
        showToast("This premium card is on the Business plan (₹299/mo or ₹2999/yr) — upgrade from My Plan.", "error");
      } else {
        alert("Premium cards are available on the Business plan (₹299/mo or ₹2999/yr).");
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
    const exportHost = document.getElementById("bcExportHost");
    exportHost?.classList.add("bc-export-capture");
    try {
      await new Promise((r) => setTimeout(r, 120));
      const el = document.querySelector("#bcExportHost .bc-card-export");
      if (!el) throw new Error("Card render nahi hua");
      const canvas = await window.html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        width: 1050,
        height: 600
      });
      return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png", 1));
    } finally {
      exportHost?.classList.remove("bc-export-capture");
    }
  }

  async function downloadCard() {
    try {
      if (typeof showToast === "function") showToast("Creating card...");
      const blob = await captureCardBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const biz = getFormData().businessName || "business";
      a.href = url;
      a.download = `BolKarigar-Card-${biz.replace(/\s+/g, "-")}.png`;
      a.click();
      URL.revokeObjectURL(url);
      saveData(getFormData());
      if (typeof showToast === "function") showToast("✅ Business card downloaded!");
    } catch (err) {
      if (typeof showToast === "function") showToast("❌ " + err.message, "error");
      else alert(err.message);
    }
  }

  async function shareWhatsApp() {
    try {
      if (typeof showToast === "function") showToast("Preparing card...");
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
        showToast("Card downloaded — WhatsApp opened. Attach the image and send!", "info");
      }
    } catch (err) {
      if (typeof showToast === "function") showToast("❌ " + err.message, "error");
      else alert(err.message);
    }
  }

  function saveCard() {
    saveData(getFormData());
    if (typeof showToast === "function") showToast("✅ Business card details saved!");
    else alert("Details saved!");
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
            showToast("Premium cards unlock on the Business plan (₹299/mo or ₹2999/yr).", "error");
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
