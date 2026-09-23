import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const p = path.join(path.dirname(fileURLToPath(import.meta.url)), "../public/bolkarigar.js");
const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);
const start = lines.findIndex((l) => l === "  void [");
if (start < 0) {
  console.error("void [ not found");
  process.exit(1);
}
let end = -1;
for (let i = start + 1; i < lines.length; i++) {
  if (lines[i] === "  ];") {
    const rest = lines.slice(i + 1, i + 4).join("\n");
    if (rest.includes("function matchLiveFaq")) {
      end = i;
      break;
    }
  }
}
if (end < 0) {
  console.error("end not found");
  process.exit(1);
}
lines.splice(start, end - start + 1);
fs.writeFileSync(p, lines.join("\n"));
console.log("removed lines", start + 1, "to", end + 1);
