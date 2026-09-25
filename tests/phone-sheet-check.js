const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "phone-sheet-check.html"), "utf8");
const js = fs.readFileSync(path.join(__dirname, "../public/mobile-app.js"), "utf8");
const page = html.replace('<script src="../public/mobile-app.js"></script>', "<script>" + js + "</script>");

const dom = new JSDOM(page, {
  runScripts: "dangerously",
  url: "http://localhost/phone-sheet-check.html",
  beforeParse(window) {
    window.matchMedia = function () {
      return { matches: true, addEventListener: function () {}, removeEventListener: function () {} };
    };
  }
});

const { window } = dom;
const { document } = window;
const assert = (ok, msg) => {
  if (!ok) throw new Error(msg);
};

function ready() {
  return new Promise(function (resolve) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () { setTimeout(resolve, 0); }, { once: true });
      return;
    }
    setTimeout(resolve, 0);
  });
}

ready().then(function () {
assert(document.documentElement.classList.contains("ao-phone"), "phone mode on");
assert(document.getElementById("aoPhoneMore").classList.contains("hidden"), "more starts closed");
assert(document.getElementById("aoPhoneAccount").classList.contains("hidden"), "account starts closed");
assert(!document.getElementById("aoPhoneTabbar").hidden, "tabbar visible at start");

document.getElementById("aoPhoneMoreBtn").click();
assert(!document.getElementById("aoPhoneMore").classList.contains("hidden"), "more opens");
assert(document.getElementById("aoPhoneTabbar").hidden === false, "tabbar stays after more open");
assert(document.getElementById("aoPhoneMoreGrid").textContent.indexOf("Stock") !== -1, "more lists extra pages");

document.getElementById("aoPhoneMoreBtn").click();
assert(document.getElementById("aoPhoneMore").classList.contains("hidden"), "more toggle closes");

document.getElementById("aoPhoneMoreBtn").click();
document.querySelector("#aoPhoneMore [data-ao-close='1']").click();
assert(document.getElementById("aoPhoneMore").classList.contains("hidden"), "more X closes");

document.getElementById("aoPhoneMoreBtn").click();
document.getElementById("aoPhoneMore").click();
assert(document.getElementById("aoPhoneMore").classList.contains("hidden"), "more backdrop closes");

let logoutClicks = 0;
document.getElementById("logoutBtn").addEventListener("click", function () { logoutClicks += 1; });

document.getElementById("topbarMoreBtn").click();
assert(document.getElementById("aoPhoneMore").classList.contains("hidden"), "dots do not open more");
assert(!document.getElementById("aoPhoneAccount").classList.contains("hidden"), "dots open account");
assert(!document.body.classList.contains("topbar-more-open"), "old logout dropdown stays closed");

document.querySelector("#aoPhoneAccount [data-ao-close='1']").click();
assert(document.getElementById("aoPhoneAccount").classList.contains("hidden"), "account X closes");

document.getElementById("topbarMoreBtn").click();
document.getElementById("aoPhoneAccLogout").click();
assert(document.getElementById("aoPhoneAccount").classList.contains("hidden"), "account logout closes sheet");
assert(logoutClicks === 1, "account logout clicks real logout");

document.getElementById("aoPhoneMoreBtn").click();
document.getElementById("aoPhoneMoreLogout").click();
assert(document.getElementById("aoPhoneMore").classList.contains("hidden"), "more logout closes sheet");
assert(logoutClicks === 2, "more logout clicks real logout");

document.getElementById("aoPhoneMoreBtn").click();
document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
assert(document.getElementById("aoPhoneMore").classList.contains("hidden"), "escape closes more");

console.log("PHONE SHEET CHECK PASS");
}).catch(function (err) {
  console.error(err);
  process.exit(1);
});
