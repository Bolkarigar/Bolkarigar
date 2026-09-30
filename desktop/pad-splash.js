const fs = require("fs");
const path = require("path");
const { Resvg } = require("../play-store-assets/node_modules/@resvg/resvg-js");

const logo = fs.readFileSync(path.join(__dirname, "..", "public", "ao-logo.svg"), "utf8")
  .replace(/<\?xml[^>]*>/, "")
  .replace(/<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#06144a"/>
  <g transform="translate(512 500) scale(0.48) translate(-320 -320)">${logo}</g>
</svg>`;

const png = new Resvg(svg, { fitTo: { mode: "width", value: 1024 } }).render().asPng();
const out = path.join(__dirname, "..", "android", "app", "src", "main", "res", "drawable", "splash_logo.png");
fs.writeFileSync(out, png);
console.log("wrote", out, png.length);
