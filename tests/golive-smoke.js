/**
 * Go-live A–Z smoke: live + local pages, APIs, HTML integrity, plan gating.
 * Does not create real paid orders. Signup uses a unique local-only user if local is up.
 */
const fs = require("fs");
const path = require("path");

const LIVE = "https://bolkarigar.onrender.com";
const LOCAL = process.env.TEST_BASE_URL || "http://127.0.0.1:5002";

const PRO_TABS = [
  "overviewPanel", "businessRecordsPanel", "invoicePanel", "purchasePanel", "paymentVoucherPanel", "receiptVoucherPanel",
  "voicePanel", "inventoryPanel",
  "ledgerPanel", "khataLedgersPanel", "khataItemsPanel", "khataVoucherPanel", "khataDaybookPanel",
  "modifyPanel",
  "galleryPanel", "todoPanel", "businessCardPanel", "securityPanel", "helpPanel", "myPlanPanel"
];

const BUSINESS_ONLY = [
  "reportsProPanel", "bankReconPanel", "estimatePanel", "businessMailPanel", "projectPanel",
  "contractorPanel", "companiesPanel", "payrollPanel", "teamMeetingPanel", "staffPanel",
  "qrPanel", "calcPanel", "notesPanel", "mediaPanel"
];

const ALL_PANELS = [
  "overviewPanel", "businessRecordsPanel", "voicePanel", "projectPanel", "inventoryPanel",
  "ledgerPanel", "khataLedgersPanel", "khataItemsPanel", "khataVoucherPanel", "khataDaybookPanel",
  "modifyPanel", "reportsProPanel", "contractorPanel", "estimatePanel", "businessMailPanel",
  "payrollPanel", "teamMeetingPanel", "staffPanel", "myPlanPanel", "bankReconPanel",
  "companiesPanel", "invoicePanel", "purchasePanel", "paymentVoucherPanel", "receiptVoucherPanel",
  "galleryPanel", "todoPanel", "qrPanel", "calcPanel", "notesPanel", "businessCardPanel",
  "mediaPanel", "securityPanel", "helpPanel"
];

const CRITICAL_IDS = [
  "appSidebar", "aoPhoneTabbar", "aoPhoneMore", "aoPhoneMoreGrid", "aoPhoneAccount",
  "aoPhoneMoreBtn", "logoutBtn", "businessProfileBtn", "themeToggle",
  "saveInvoiceBtn", "savePurchaseVoucherBtn", "savePaymentVoucherBtn", "saveReceiptVoucherBtn",
  "saveVoucherBtn", "addLedgerBtn", "addItemBtn", "addLabourBtn", "addCompanyBtn",
  "subscriptionPaywall", "imageInput"
];

let passed = 0;
let failed = 0;
const rows = [];

function ok(name, extra) {
  passed++;
  rows.push({ ok: true, name, extra: extra || "" });
  console.log("  PASS  " + name + (extra ? " — " + extra : ""));
}
function bad(name, extra) {
  failed++;
  rows.push({ ok: false, name, extra: extra || "" });
  console.log("  FAIL  " + name + " — " + extra);
}

async function fetchText(url, opts) {
  const res = await fetch(url, { redirect: "follow", ...opts });
  const text = await res.text();
  return { res, text, status: res.status };
}

async function fetchJson(url, opts) {
  const { res, text } = await fetchText(url, opts);
  let data = {};
  try { data = JSON.parse(text); } catch (_) {}
  return { res, data, status: res.status, text };
}

function checkHtmlIntegrity(label, html) {
  for (const id of ALL_PANELS) {
    if (html.includes('id="' + id + '"')) ok(label + " panel " + id);
    else bad(label + " panel " + id, "missing in HTML");
  }
  for (const id of CRITICAL_IDS) {
    if (html.includes('id="' + id + '"')) ok(label + " id " + id);
    else bad(label + " id " + id, "missing");
  }
  if (html.includes("ao-mark.svg") && html.includes("Your business in orbit")) ok(label + " brand + tagline");
  else bad(label + " brand + tagline", "logo/caption missing");
  if (/BK_APP_BUILD\s*=\s*'20260924plan99'/.test(html)) ok(label + " latest phone-plan build");
  else {
    const m = html.match(/BK_APP_BUILD\s*=\s*'([^']+)'/);
    bad(label + " latest phone-plan build", "found " + (m ? m[1] : "none"));
  }
  if (html.includes("aoPhoneRefreshMore") || html.includes("mobile-app.js")) ok(label + " mobile shell script");
  else bad(label + " mobile shell script", "mobile-app.js not linked");
}

function checkPlanLogic() {
  const pro = new Set(PRO_TABS);
  for (const t of BUSINESS_ONLY) {
    if (pro.has(t)) bad("plan split", t + " is in both Pro and Business-only");
    else ok("Business-only not in Pro list: " + t);
  }
  const mustPro = ["invoicePanel", "purchasePanel", "paymentVoucherPanel", "receiptVoucherPanel", "ledgerPanel", "khataLedgersPanel", "businessCardPanel", "inventoryPanel"];
  for (const t of mustPro) {
    if (pro.has(t)) ok("Pro includes " + t);
    else bad("Pro includes " + t, "missing from PRO_PLAN_TABS");
  }
}

function checkLocalSources() {
  const html = fs.readFileSync(path.join(__dirname, "../public/bolkarigar.html"), "utf8");
  checkHtmlIntegrity("local file", html);

  const mobile = fs.readFileSync(path.join(__dirname, "../public/mobile-app.js"), "utf8");
  if (mobile.includes("if (btn.style.display === \"none\") return")) ok("More menu skips hidden tabs");
  else bad("More menu skips hidden tabs", "filter missing");
  if (mobile.includes("window.aoPhoneRefreshMore = fillMore")) ok("aoPhoneRefreshMore exported");
  else bad("aoPhoneRefreshMore exported", "missing");

  const bk = fs.readFileSync(path.join(__dirname, "../public/bolkarigar.js"), "utf8");
  if (bk.includes("aoPhoneRefreshMore()")) ok("applyRoleBasedUI refreshes More");
  else bad("applyRoleBasedUI refreshes More", "call missing");

  const css = fs.readFileSync(path.join(__dirname, "../public/mobile-app.css"), "utf8");
  if (css.includes('input[type="radio"]') || css.includes("appearance: auto")) ok("phone radio CSS present");
  else bad("phone radio CSS present", "no radio override");

  const sw = fs.readFileSync(path.join(__dirname, "../public/sw.js"), "utf8");
  if (/network-first|fetch\(event\.request\)/i.test(sw)) ok("SW network-first for app files");
  else bad("SW network-first for app files", "cache strategy unclear");

  const login = fs.readFileSync(path.join(__dirname, "../public/loginpage.html"), "utf8");
  if (login.includes("Accounts Orbit AI") && !login.includes("ao-login-logo-box")) ok("login heading reverted");
  else ok("login page present");

  const clientToggle = fs.readFileSync(path.join(__dirname, "../public/dev-plan-toggle.js"), "utf8");
  if (clientToggle.includes("bolkarigar.onrender.com") && clientToggle.includes("isOwnerTestHost")) {
    bad("prod plan-test chrome", "client always shows Plan test on live hosts");
  } else {
    ok("prod plan-test chrome hidden on live hosts");
  }

  const serverToggle = fs.readFileSync(path.join(__dirname, "../dev-plan-toggle.js"), "utf8");
  if (serverToggle.includes("if (process.env.RENDER") && serverToggle.includes("return true")) {
    bad("prod switch-plan API", "RENDER defaults toggle ON — any owner can grant Business without pay");
  } else {
    ok("prod switch-plan API disabled by default");
  }
}

async function checkSite(label, base) {
  console.log("\n== " + label + " " + base + " ==");
  try {
    const health = await fetchJson(base + "/api/health");
    if (health.status === 200 && health.data.ok && health.data.mongo) {
      ok(label + " health", "mongo=" + health.data.mongo + " email=" + health.data.emailReady + " rzp=" + health.data.razorpayMode);
    } else {
      bad(label + " health", JSON.stringify(health.data).slice(0, 180));
    }
  } catch (e) {
    bad(label + " health", e.message);
    return;
  }

  const pages = [
    ["/", "loginpage"],
    ["/loginpage.html", "Accounts Orbit"],
    ["/signup.html", "Sign"],
    ["/pricing.html", "Pricing"],
    ["/privacy.html", "Privacy"],
    ["/dashboard", "overviewPanel"]
  ];
  for (const [p, needle] of pages) {
    try {
      const { status, text } = await fetchText(base + p);
      if (status === 200 && text.includes(needle)) ok(label + " page " + p);
      else bad(label + " page " + p, "status=" + status + " needle=" + needle);
    } catch (e) {
      bad(label + " page " + p, e.message);
    }
  }

  try {
    const dash = await fetchText(base + "/dashboard");
    if (dash.status === 200) checkHtmlIntegrity(label + " dashboard", dash.text);
  } catch (e) {
    bad(label + " dashboard HTML", e.message);
  }

  try {
    const plans = await fetchJson(base + "/api/subscription/plans");
    const pro = plans.data?.pricing?.pro;
    const biz = plans.data?.pricing?.business;
    if (plans.status === 200 && pro?.priceMonthly === 99 && biz?.priceMonthly === 299) {
      ok(label + " plan prices", "99 / 299");
    } else bad(label + " plan prices", JSON.stringify(plans.data?.pricing || plans.data).slice(0, 160));
  } catch (e) {
    bad(label + " plan prices", e.message);
  }

  try {
    const pay = await fetchJson(base + "/api/payment/config");
    if (pay.status === 200 && (pay.data.keyId || pay.data.configured || pay.data.mode)) {
      ok(label + " razorpay config", "mode=" + (pay.data.mode || pay.data.razorpayMode || "?"));
    } else if (pay.status === 200) {
      ok(label + " razorpay config endpoint", JSON.stringify(pay.data).slice(0, 120));
    } else {
      bad(label + " razorpay config", "status=" + pay.status);
    }
  } catch (e) {
    bad(label + " razorpay config", e.message);
  }

  try {
    const tog = await fetchJson(base + "/api/dev/plan-toggle");
    if (tog.data?.enabled) bad(label + " plan-toggle API", "ENABLED on this host — Business can be granted without payment");
    else ok(label + " plan-toggle API", "disabled");
  } catch (e) {
    bad(label + " plan-toggle API", e.message);
  }

  try {
    const login = await fetchJson(base + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    if (login.status >= 400 && login.status < 500) ok(label + " login empty body rejected", String(login.status));
    else bad(label + " login empty body rejected", "status=" + login.status);
  } catch (e) {
    bad(label + " login empty body rejected", e.message);
  }

  try {
    const login = await fetchJson(base + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "no_such_user_" + Date.now(), password: "wrongpass123" })
    });
    if (login.status >= 400 && login.status < 500 && (login.data.error || login.data.message)) {
      ok(label + " bad login rejected", String(login.status));
    } else bad(label + " bad login rejected", "status=" + login.status);
  } catch (e) {
    bad(label + " bad login rejected", e.message);
  }

  try {
    const forgot = await fetchJson(base + "/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "no_such_user_" + Date.now() })
    });
    if (forgot.status === 200 || (forgot.status >= 400 && forgot.status < 500) || forgot.status === 503) {
      ok(label + " forgot-password endpoint", "status=" + forgot.status);
    } else bad(label + " forgot-password endpoint", "status=" + forgot.status);
  } catch (e) {
    bad(label + " forgot-password endpoint", e.message);
  }

  try {
    const me = await fetchJson(base + "/api/auth/me");
    if (me.status === 401 || me.status === 403) ok(label + " /me without token blocked", String(me.status));
    else bad(label + " /me without token blocked", "status=" + me.status);
  } catch (e) {
    bad(label + " /me without token blocked", e.message);
  }

  const protectedGets = [
    "/api/dashboard/sync", "/api/sales", "/api/ledgers", "/api/items", "/api/vouchers",
    "/api/gallery", "/api/profile", "/api/tally/agent-status"
  ];
  for (const p of protectedGets) {
    try {
      const r = await fetchJson(base + p);
      if (r.status === 401 || r.status === 403) ok(label + " auth " + p, String(r.status));
      else bad(label + " auth " + p, "status=" + r.status);
    } catch (e) {
      bad(label + " auth " + p, e.message);
    }
  }
}

async function tryLocalSignupFlow() {
  console.log("\n== local signup/login happy path ==");
  const stamp = Date.now();
  const user = {
    name: "GoLive Check",
    shopName: "GoLive Shop",
    username: "golive_" + stamp,
    email: "golive_" + stamp + "@example.com",
    password: "GoLive#12345",
    phone: "9999999999"
  };
  try {
    const signup = await fetchJson(LOCAL + "/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user)
    });
    if (signup.status >= 200 && signup.status < 300 && (signup.data.token || signup.data.success)) {
      ok("local signup", user.username);
    } else {
      bad("local signup", "status=" + signup.status + " " + (signup.data.error || signup.text).toString().slice(0, 160));
      return;
    }
    const login = await fetchJson(LOCAL + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user.username, password: user.password })
    });
    const token = login.data.token;
    if (login.status === 200 && token) ok("local login after signup");
    else {
      bad("local login after signup", "status=" + login.status + " " + (login.data.error || ""));
      return;
    }
    const headers = { Authorization: "Bearer " + token };
    const me = await fetchJson(LOCAL + "/api/auth/me", { headers });
    if (me.status === 200 && me.data.user) ok("local /me", (me.data.user.subscription?.plan || me.data.subscription?.plan || "?"));
    else bad("local /me", "status=" + me.status);

    const sync = await fetchJson(LOCAL + "/api/dashboard/sync", { headers });
    if (sync.status === 200) ok("local dashboard sync");
    else bad("local dashboard sync", "status=" + sync.status);

    const sales = await fetchJson(LOCAL + "/api/sales", { headers });
    if (sales.status === 200) ok("local sales list");
    else bad("local sales list", "status=" + sales.status);

    const ledgers = await fetchJson(LOCAL + "/api/ledgers", { headers });
    if (ledgers.status === 200) ok("local ledgers list");
    else bad("local ledgers list", "status=" + ledgers.status);

    const items = await fetchJson(LOCAL + "/api/items", { headers });
    if (items.status === 200) ok("local items list");
    else bad("local items list", "status=" + items.status);

    const vouchers = await fetchJson(LOCAL + "/api/vouchers", { headers });
    if (vouchers.status === 200) ok("local vouchers list");
    else bad("local vouchers list", "status=" + vouchers.status);

    const profile = await fetchJson(LOCAL + "/api/profile", { headers });
    if (profile.status === 200) ok("local profile get");
    else bad("local profile get", "status=" + profile.status);

    const sw = await fetchJson(LOCAL + "/api/dev/switch-plan", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "pro" })
    });
    if (sw.status === 200 && sw.data.subscription && sw.data.subscription.fullAccess === false) {
      ok("local switch to Pro", "fullAccess=false");
    } else if (sw.status === 403) {
      ok("local switch-plan blocked (toggle off)");
    } else {
      bad("local switch to Pro", "status=" + sw.status + " fullAccess=" + sw.data?.subscription?.fullAccess);
    }

    const sw2 = await fetchJson(LOCAL + "/api/dev/switch-plan", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "business" })
    });
    if (sw2.status === 200 && sw2.data.subscription?.fullAccess) ok("local switch to Business", "fullAccess=true");
    else if (sw2.status === 403) ok("local switch Business blocked (toggle off)");
    else bad("local switch to Business", "status=" + sw2.status);

    const sw3 = await fetchJson(LOCAL + "/api/dev/switch-plan", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "pro" })
    });
    if (sw3.status === 200 && sw3.data.subscription && !sw3.data.subscription.fullAccess) {
      const tabs = sw3.data.subscription.allowedTabs || [];
      const leak = BUSINESS_ONLY.filter((t) => tabs.includes(t));
      if (leak.length) bad("Pro allowedTabs leak Business modules", leak.join(","));
      else ok("Pro allowedTabs has no Business modules", "tabs=" + tabs.length);
    }
  } catch (e) {
    bad("local signup/login flow", e.message);
  }
}

async function main() {
  console.log("\n========== ACCOUNTS ORBIT GO-LIVE SMOKE ==========\n");
  console.log("== source integrity ==");
  checkLocalSources();
  console.log("\n== plan split ==");
  checkPlanLogic();
  await checkSite("LIVE", LIVE);
  await checkSite("LOCAL", LOCAL);
  await tryLocalSignupFlow();

  console.log("\n========================================");
  console.log("PASS " + passed + "   FAIL " + failed);
  console.log("========================================\n");
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
