/**
 * Desktop install — Chrome/Edge native prompt.
 * Website Download App → loginpage.html?install=1
 */
(function () {
  "use strict";
  var APP = "/loginpage.html";
  var wanted = /(?:\?|&)install=1(?:&|$)/.test(location.search) || /download\.html/i.test(location.pathname);
  var promptEvent = null;
  var installing = false;

  function standalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function goApp() {
    if (/loginpage\.html/i.test(location.pathname)) return;
    location.replace(APP);
  }

  async function tryInstall() {
    if (installing) return;
    if (standalone()) {
      goApp();
      return true;
    }
    if (!promptEvent) return false;
    installing = true;
    try {
      promptEvent.prompt();
      await promptEvent.userChoice;
    } catch (_) { /* user closed */ }
    promptEvent = null;
    window.__bkInstallPrompt = null;
    installing = false;
    return true;
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    promptEvent = e;
    window.__bkInstallPrompt = e;
    if (wanted) tryInstall();
  });

  window.addEventListener("appinstalled", function () {
    goApp();
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js?v=7").catch(function () {});
  }

  window.bkInstallApp = tryInstall;

  function showInstallButton() {
    if (!wanted || standalone() || document.getElementById("bkDesktopInstallBtn")) return;
    var btn = document.createElement("button");
    btn.id = "bkDesktopInstallBtn";
    btn.type = "button";
    btn.textContent = "Install on this computer";
    btn.style.cssText = "position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:99999;border:0;border-radius:999px;padding:14px 22px;font:700 15px Inter,system-ui,sans-serif;background:#16a34a;color:#fff;cursor:pointer;box-shadow:0 8px 24px rgba(22,163,74,.35)";
    btn.addEventListener("click", function () {
      if (!tryInstall()) {
        alert("Chrome or Edge mein address bar ke right side Install (⊕) icon dabao. App desktop pe aa jayegi.");
      }
    });
    document.body.appendChild(btn);
  }

  if (wanted && !standalone()) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", showInstallButton);
    else showInstallButton();
  }

  if (wanted && !standalone()) {
    var n = 0;
    var t = setInterval(function () {
      n += 1;
      if (promptEvent) {
        clearInterval(t);
        tryInstall();
      } else if (n >= 25) {
        clearInterval(t);
      }
    }, 200);
  }
})();
