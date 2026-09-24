const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");

const svg = fs.readFileSync(path.join(__dirname, "../public/ao-mark.svg"));
const png = new Resvg(svg, {
  fitTo: { mode: "width", value: 256 }
}).render().asPng();
fs.writeFileSync(path.join(__dirname, "icon.png"), png);
console.log("icon.png ready");
