import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(__dirname, "../public/help-module-data.js");
let s = fs.readFileSync(p, "utf8");
s = s.replace(
  /\n(\s+)hindi: "[^"]*",\n(\s+english: )("[^"]*"),/g,
  "\n$1hindi: $3,\n$2$3,"
);
s = s.replace(/"Invoice kholo"/g, '"Open invoice"');
s = s.replace(/"Udhar khata kholo"/g, '"Open credit ledger"');
s = s.replace(/"Todo add karo"/g, '"Add a todo"');
fs.writeFileSync(p, s);
console.log("help-module-data synced");
