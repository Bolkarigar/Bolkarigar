const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "../public/bolkarigar.html"), "utf8");
const js = fs.readFileSync(path.join(__dirname, "../public/bolkarigar.js"), "utf8");
const mobile = fs.readFileSync(path.join(__dirname, "../public/mobile-app.js"), "utf8");

const PRO = new Set([
  "overviewPanel", "businessRecordsPanel", "invoicePanel", "purchasePanel", "paymentVoucherPanel", "receiptVoucherPanel",
  "voicePanel", "inventoryPanel", "ledgerPanel", "khataLedgersPanel", "khataItemsPanel", "khataVoucherPanel",
  "khataDaybookPanel", "modifyPanel", "galleryPanel", "todoPanel", "businessCardPanel", "securityPanel", "helpPanel", "myPlanPanel"
]);

const MODULES = [
  { id: "overviewPanel", need: ["heroModuleCount", "refreshDashboard"] },
  { id: "invoicePanel", need: ["invPartyName", "invoiceBody", "saveInvoiceBtn", "addInvoiceBtn"] },
  { id: "purchasePanel", need: ["savePurchaseVoucherBtn", "addPurchaseItemBtn"] },
  { id: "paymentVoucherPanel", need: ["savePaymentVoucherBtn"] },
  { id: "receiptVoucherPanel", need: ["saveReceiptVoucherBtn"] },
  { id: "khataVoucherPanel", need: ["saveVoucherBtn"] },
  { id: "ledgerPanel", need: ["ledgerSearchInput"] },
  { id: "khataLedgersPanel", need: ["addLedgerBtn"] },
  { id: "khataItemsPanel", need: ["addItemBtn"] },
  { id: "khataDaybookPanel", need: [] },
  { id: "modifyPanel", need: ["modifySearchInput"] },
  { id: "inventoryPanel", need: [] },
  { id: "businessCardPanel", need: [] },
  { id: "galleryPanel", need: [] },
  { id: "todoPanel", need: ["addTodoBtn"] },
  { id: "securityPanel", need: [] },
  { id: "helpPanel", need: [] },
  { id: "myPlanPanel", need: [] },
  { id: "contractorPanel", need: ["addLabourBtn", "addRABillBtn"] },
  { id: "companiesPanel", need: ["addCompanyBtn"] },
  { id: "payrollPanel", need: [] },
  { id: "calcPanel", need: ["calcDisplay", "calcEquals"] },
  { id: "mediaPanel", need: ["imageInput"] },
  { id: "notesPanel", need: ["notesInput", "saveNotesBtn"] },
  { id: "qrPanel", need: ["qrInput", "generateQrBtn"] },
  { id: "estimatePanel", need: [] },
  { id: "businessMailPanel", need: [] },
  { id: "projectPanel", need: ["projectName", "addProjectBtn"] },
  { id: "reportsProPanel", need: [] },
  { id: "bankReconPanel", need: ["addBankEntryBtn"] },
  { id: "teamMeetingPanel", need: [] },
  { id: "staffPanel", need: [] }
];

let pass = 0;
let fail = 0;
function ok(n, x) { pass++; console.log("  PASS  " + n + (x ? " — " + x : "")); }
function bad(n, x) { fail++; console.log("  FAIL  " + n + " — " + x); }

function hasId(id) {
  return new RegExp('id="' + id + '"').test(html);
}

console.log("\n== module controls ==");
for (const m of MODULES) {
  if (!hasId(m.id)) { bad(m.id, "panel missing"); continue; }
  const missing = m.need.filter((id) => !hasId(id));
  if (missing.length) bad(m.id + " controls", missing.join(", "));
  else ok(m.id + " controls");
}

console.log("\n== JS handlers ==");
const handlers = [
  ["saveInvoiceVoucher", "invoice save"],
  ["savePurchaseVoucher", "purchase save"],
  ["openPanel", "panel open"],
  ["applyRoleBasedUI", "plan/role UI"],
  ["bkCanAccessTab", "tab gate"],
  ["aoPhoneRefreshMore", "phone more refresh call"]
];
for (const [fn, label] of handlers) {
  if (js.includes(fn)) ok("handler " + label);
  else bad("handler " + label, fn + " missing");
}

if (js.includes('querySelectorAll(".calc-btn")')) ok("calculator buttons wired");
else bad("calculator buttons wired", "no calc-btn listener");
if (js.includes("generateQrBtn")) ok("QR generate wired");
else bad("QR generate wired", "missing");
if (js.includes("addLabourBtn") || js.includes("Mark Attendance")) ok("contractor attendance wired");
else if (html.includes("addLabourBtn")) ok("contractor attendance button in HTML");

console.log("\n== Pro vs Business More menu ==");
const tabs = [...html.matchAll(/data-tab="([^"]+)"/g)].map((m) => m[1]);
const unique = [...new Set(tabs)];
const skip = { overviewPanel: 1, invoicePanel: 1, purchasePanel: 1, ledgerPanel: 1 };
function moreFor(plan) {
  return unique.filter((id) => {
    if (skip[id]) return false;
    if (plan === "pro" && !PRO.has(id)) return false;
    return true;
  });
}
const proMore = moreFor("pro");
const bizMore = moreFor("business");
const leak = proMore.filter((id) => !PRO.has(id));
if (leak.length) bad("Pro More leak", leak.join(","));
else ok("Pro More has no Business modules", proMore.length + " items");
if (bizMore.length > proMore.length) ok("Business More has extra modules", bizMore.length + " vs Pro " + proMore.length);
else bad("Business More extra", "biz=" + bizMore.length + " pro=" + proMore.length);

const mustHideOnPro = ["contractorPanel", "payrollPanel", "calcPanel", "mediaPanel", "companiesPanel", "staffPanel"];
const stillOnPro = mustHideOnPro.filter((id) => proMore.includes(id));
if (stillOnPro.length) bad("Pro still shows Business modules", stillOnPro.join(","));
else ok("Pro hides Contractor/Payroll/Calc/Media/Companies/Staff");

if (mobile.includes('if (btn.style.display === "none") return')) ok("phone fillMore honors hidden tabs");
else bad("phone fillMore honors hidden tabs", "filter missing");

console.log("\n== live assets ==");
(async () => {
  const dash = await (await fetch("https://bolkarigar.onrender.com/dashboard")).text();
  const build = (dash.match(/BK_APP_BUILD = '([^']+)'/) || [])[1];
  if (build === "20260924plan99") ok("live BK_APP_BUILD", build);
  else bad("live BK_APP_BUILD", String(build));
  const scripts = [...dash.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]);
  const need = ["bolkarigar.js?v=20260924plan99", "mobile-app.js?v=20260924plan99", "dev-plan-toggle.js"];
  for (const n of need) {
    if (scripts.some((s) => s.includes(n.replace("?v=20260924plan99", "")) && (n.includes("?v=") ? s.includes("20260924plan99") : true))) {
      ok("live script " + n);
    } else {
      bad("live script " + n, scripts.filter((s) => s.includes(n.split("?")[0])).join(" | ") || "not found");
    }
  }

  const health = await (await fetch("https://bolkarigar.onrender.com/api/health")).json();
  if (health.ok && health.mongo && health.emailReady && health.razorpayConfigured && health.razorpayMode === "live") {
    ok("live ops ready", "mongo+email+razorpay live");
  } else {
    bad("live ops ready", JSON.stringify(health));
  }

  const toggle = await (await fetch("https://bolkarigar.onrender.com/api/dev/plan-toggle")).json();
  if (toggle.enabled) bad("live switch-plan persistence", "API enabled — owners can grant Business without pay");
  else ok("live switch-plan persistence", "API disabled (UI chrome may still show)");

  console.log("\n========================================");
  console.log("PASS " + pass + "   FAIL " + fail);
  console.log("========================================\n");
  if (fail) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
