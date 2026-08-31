/** Voice search tests — node scripts/test-voice-search.js */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const src = fs.readFileSync(path.join(__dirname, "../public/bolkarigar.js"), "utf8");
const start = src.indexOf("function normalize(text) {");
const end = src.indexOf("function getActiveSearchInput");
const sandbox = { window: { bkVoiceController: null }, console };
vm.createContext(sandbox);
vm.runInContext(
  `function stripSpeechPunctuation(text) {
    return String(text || "").replace(/[.!?।,]/g, " ").replace(/\\s+/g, " ").trim();
  }\n` + src.slice(start, end),
  sandbox
);
const parseSearchQuery = sandbox.parseSearchQuery;

const cases = [
  ["laxmi naam search kero", "laxmi"],
  ["laxmi name search keri", "laxmi"],
  ["search kero laxmi", "laxmi"],
  ["search karo laxmi", "laxmi"],
  ["laxmi search karo", "laxmi"],
  ["लक्ष्मी search kero", "laxmi"],
  ["naam laxmi search karo", "laxmi"],
  ["total sales par ja kar laxmi search kero", "laxmi"]
];

let failed = 0;
for (const [phrase, expect] of cases) {
  const r = parseSearchQuery(phrase);
  const ok = r && r.query === expect;
  console.log((ok ? "OK" : "FAIL") + ":", phrase, "=>", r?.query || r);
  if (!ok) failed++;
}
process.exit(failed ? 1 : 0);
