/**
 * Voice parsing unit tests (no browser needed)
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const src = fs.readFileSync(path.join(__dirname, "../public/voice-controller.js"), "utf8");
const sandbox = { window: {}, document: { getElementById: () => null } };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const { cleanUtterance, parseSmartInvoice, isSaleSentence } = sandbox.window.bkVoiceController;

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("✅", name);
  } catch (e) {
    console.error("❌", name, e.message);
    process.exitCode = 1;
  }
}

test("Ram ne laptop liya 25000 ka", () => {
  const r = parseSmartInvoice("Ram ne ek laptop liya hai 25000 ka Haryana se hai pincode 123456");
  if (r.data.customer !== "Ram") throw new Error("customer=" + r.data.customer);
  if (!r.data.product.includes("laptop")) throw new Error("product=" + r.data.product);
  if (r.data.price !== "25000") throw new Error("price=" + r.data.price);
  if (r.data.pin !== "123456") throw new Error("pin=" + r.data.pin);
  if (!r.naturalSale) throw new Error("naturalSale false");
  if (!r.isInvoice) throw new Error("isInvoice false");
});

test("iss ko ram n ek laptop", () => {
  const cleaned = cleanUtterance("iss ko ram n ek laptop liya hai 25000 ka");
  const r = parseSmartInvoice(cleaned);
  if (r.data.customer !== "Ram") throw new Error("customer=" + r.data.customer + " cleaned=" + cleaned);
  if (!r.data.product.includes("laptop")) throw new Error("product=" + r.data.product);
  if (r.data.price !== "25000") throw new Error("price=" + r.data.price);
});

test("Ramesh ko cement", () => {
  const r = parseSmartInvoice("Ramesh ko cement 500 rupaye me 2 piece bill banao");
  if (r.data.customer !== "Ramesh") throw new Error("customer=" + r.data.customer);
  if (!r.data.product.includes("cement")) throw new Error("product=" + r.data.product);
  if (r.data.price !== "500") throw new Error("price=" + r.data.price);
});

test("sale sentence not FAQ", () => {
  const n = "ram ne ek laptop liya hai 25000 ka";
  if (!isSaleSentence(n)) throw new Error("should be sale");
});

console.log(`\n${passed} voice parse tests passed`);
