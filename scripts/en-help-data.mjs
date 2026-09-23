import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const file = path.join(root, "help-module-data.js");
let s = fs.readFileSync(file, "utf8");

s = s.replace(/\{ en: "((?:\\.|[^"\\])*)", hi: "(?:\\.|[^"\\])*"/g, (m, en) => {
  const un = en.replace(/\\"/g, '"');
  const esc = un.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `{ en: "${esc}", hi: "${esc}"`;
});

s = s.replace(
  /english: "((?:\\.|[^"\\])*)",\s*\n\s*hindi: "(?:\\.|[^"\\])*"/g,
  (m, en) => {
    const un = en.replace(/\\"/g, '"');
    const esc = un.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `english: "${esc}",\n      hindi: "${esc}"`;
  }
);

fs.writeFileSync(file, s);
console.log("help-module-data.js synced hi/hindi to English");
