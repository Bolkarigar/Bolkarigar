import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const js = path.join(root, "bolkarigar.js");
let s = fs.readFileSync(js, "utf8");

const map = {
  'showCommand("Photo " + (idx + 1) + " dikha rahe hain.");':
    'showCommand("Showing photo " + (idx + 1) + ".");',
  'showCommand("WhatsApp share ke liye Invoice form me Customer Name bharein!");':
    'showCommand("Enter Customer Name on the invoice form before WhatsApp share.");',
  'return openPanelByVoice("bankReconPanel", "Bank Reconciliation khol di.");':
    'return openPanelByVoice("bankReconPanel", "Opening Bank Reconciliation.");',
  "body.innerHTML = `<tr><td colspan='5'>Koi ledger nahi bana abhi.</td></tr>`;":
    "body.innerHTML = `<tr><td colspan='5'>No ledgers yet.</td></tr>`;",
  "body.innerHTML = `<tr><td colspan='6'>Koi item nahi bana abhi.</td></tr>`;":
    "body.innerHTML = `<tr><td colspan='6'>No items yet.</td></tr>`;",
  "body.innerHTML = `<tr><td colspan='6'>Abhi koi voucher nahi bana.</td></tr>`;":
    "body.innerHTML = `<tr><td colspan='6'>No vouchers yet.</td></tr>`;",
  'title="Account edit karo"':
    'title="Edit account"',
  'title="Tally Prime me sync karo / टैली में भेजें"':
    'title="Sync to Tally Prime"',
  'title="Ledger delete karo / हटाएं"':
    'title="Delete ledger"',
  'title="Item delete karo"':
    'title="Delete item"',
  "body.innerHTML = `<tr><td colspan='7' style=\"text-align:center;\">Abhi koi transaction nahi. Sirf opening balance hai.</td></tr>`;":
    "body.innerHTML = `<tr><td colspan='7' style=\"text-align:center;\">No transactions yet — opening balance only.</td></tr>`;",
  '? "Is filter me koi record nahi mila."':
    '? "No records match this filter."',
  ': "Abhi koi sale record nahi hai."':
    ': "No sales records yet."',
  "alert(\"Pehle login karein.\");":
    "alert(\"Please log in first.\");",
};

for (const [k, v] of Object.entries(map)) {
  s = s.split(k).join(v);
}

s = s.replace(
  /const LIVE_FAQ = \[[\s\S]*?\n  \];\n\n  function matchLiveFaq/,
  "const LIVE_FAQ = APP_FAQ;\n\n  function matchLiveFaq"
);

s = s.replace(
  /detail = `⚠️ Purana Agent chal raha hai \(\$\{http\.agentVersion\}\)\. Sidebar se naya Agent vhttp5 download karein\.`;/,
  "detail = `⚠️ Old Agent running (${http.agentVersion}). Download Agent vhttp5 from the sidebar.`;"
);

s = s.replace(
  /\? "🟡 Port 9000 open — company Tally mein load karein \(Day Book\), phir Sync Tally dabao\."/,
  '? "🟡 Port 9000 open — open company in Tally Day Book, then tap Sync Tally."'
);

fs.writeFileSync(js, s);
console.log("bolkarigar.js UI sweep done");
