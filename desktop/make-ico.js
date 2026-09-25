const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");

const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256];
const baseSvg = fs.readFileSync(path.join(__dirname, "../public/ao-mark.svg"), "utf8");

function svgFor(size) {
  const stroke = size <= 20 ? 6.2 : size <= 32 ? 4.8 : 3.4;
  const bar = size <= 20 ? 13 : size <= 32 ? 11 : 9;
  const dot = size <= 20 ? 7.2 : size <= 32 ? 6.2 : 5.2;
  return baseSvg
    .replace('stroke-width="3.4"', `stroke-width="${stroke}"`)
    .replace(/width="9"/g, `width="${bar}"`)
    .replace('r="5.2"', `r="${dot}"`);
}

function pngAt(size) {
  return Buffer.from(
    new Resvg(svgFor(size), {
      fitTo: { mode: "width", value: size },
      background: "rgba(0,0,0,0)"
    }).render().asPng()
  );
}

function packIco(images) {
  const count = images.length;
  let offset = 6 + 16 * count;
  const header = Buffer.alloc(offset);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  let p = 6;
  const blobs = [];
  for (const img of images) {
    header[p] = img.size >= 256 ? 0 : img.size;
    header[p + 1] = img.size >= 256 ? 0 : img.size;
    header[p + 2] = 0;
    header[p + 3] = 0;
    header.writeUInt16LE(1, p + 4);
    header.writeUInt16LE(32, p + 6);
    header.writeUInt32LE(img.png.length, p + 8);
    header.writeUInt32LE(offset, p + 12);
    p += 16;
    blobs.push(img.png);
    offset += img.png.length;
  }
  return Buffer.concat([header, ...blobs]);
}

const images = sizes.map((size) => ({ size, png: pngAt(size) }));
const ico = packIco(images);
fs.writeFileSync(path.join(__dirname, "icon.ico"), ico);
fs.writeFileSync(path.join(__dirname, "icon.png"), images[images.length - 1].png);
console.log("icon.ico ready", ico.length, "sizes", sizes.join(","));
