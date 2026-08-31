/**
 * BolKarigar — App Lock (Khatabook-style)
 * PIN + Face ID / Fingerprint (WebAuthn platform authenticator)
 */
(function () {
  const LS_ENABLED = "bk_app_lock_enabled";
  const LS_PIN_HASH = "bk_app_lock_pin_hash";
  const LS_PIN_SALT = "bk_app_lock_pin_salt";
  const LS_BIO_ENABLED = "bk_app_lock_biometric";
  const LS_CRED_ID = "bk_app_lock_cred_id";
  const SS_UNLOCKED = "bk_app_unlocked";

  let pinBuffer = "";
  let setupPinStep = "";
  let setupPinFirst = "";

  function isEnabled() {
    return localStorage.getItem(LS_ENABLED) === "1" && !!localStorage.getItem(LS_PIN_HASH);
  }

  function isUnlocked() {
    return sessionStorage.getItem(SS_UNLOCKED) === "1";
  }

  function setUnlocked(val) {
    if (val) sessionStorage.setItem(SS_UNLOCKED, "1");
    else sessionStorage.removeItem(SS_UNLOCKED);
  }

  function canUseBiometric() {
    return !!(window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable);
  }

  async function hashPin(pin, salt) {
    const data = new TextEncoder().encode(String(salt) + String(pin));
    const buf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function randomSalt() {
    const a = new Uint8Array(16);
    crypto.getRandomValues(a);
    return Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function credIdToB64(rawId) {
    const bytes = new Uint8Array(rawId);
    let s = "";
    bytes.forEach((b) => { s += String.fromCharCode(b); });
    return btoa(s);
  }

  function b64ToCredId(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  async function registerBiometric() {
    if (!await canUseBiometric()) throw new Error("biometric_unavailable");
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const userId = new Uint8Array(16);
    crypto.getRandomValues(userId);
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "BolKarigar", id: window.location.hostname || "localhost" },
        user: { id: userId, name: "bolkarigar@local", displayName: "BolKarigar User" },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
        timeout: 60000,
        attestation: "none"
      }
    });
    if (!cred) throw new Error("register_failed");
    localStorage.setItem(LS_CRED_ID, credIdToB64(cred.rawId));
    localStorage.setItem(LS_BIO_ENABLED, "1");
    return true;
  }

  async function unlockWithBiometric() {
    const idB64 = localStorage.getItem(LS_CRED_ID);
    if (!idB64 || localStorage.getItem(LS_BIO_ENABLED) !== "1") return false;
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const cred = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ id: b64ToCredId(idB64), type: "public-key" }],
        userVerification: "required",
        timeout: 60000
      }
    });
    return !!cred;
  }

  function showOverlay() {
    const el = document.getElementById("appLockOverlay");
    if (el) {
      el.classList.remove("hidden");
      document.body.classList.add("app-lock-active");
    }
    pinBuffer = "";
    updateDots();
    hideError();
    maybeShowBioBtn();
    if (localStorage.getItem(LS_BIO_ENABLED) === "1") {
      setTimeout(() => { tryBiometricUnlock(true); }, 400);
    }
  }

  function hideOverlay() {
    const el = document.getElementById("appLockOverlay");
    if (el) el.classList.add("hidden");
    document.body.classList.remove("app-lock-active");
    pinBuffer = "";
    updateDots();
  }

  function hideError() {
    const e = document.getElementById("appLockError");
    if (e) { e.textContent = ""; e.classList.add("hidden"); }
  }

  function showError(msg) {
    const e = document.getElementById("appLockError");
    if (e) { e.textContent = msg; e.classList.remove("hidden"); }
  }

  function updateDots() {
    const dots = document.querySelectorAll("#appLockDots .app-lock-dot");
    dots.forEach((d, i) => d.classList.toggle("filled", i < pinBuffer.length));
  }

  function maybeShowBioBtn() {
    const btn = document.getElementById("appLockBiometricBtn");
    if (!btn) return;
    const show = localStorage.getItem(LS_BIO_ENABLED) === "1" && !!localStorage.getItem(LS_CRED_ID);
    btn.classList.toggle("hidden", !show);
  }

  async function verifyPin(pin) {
    const salt = localStorage.getItem(LS_PIN_SALT);
    const hash = localStorage.getItem(LS_PIN_HASH);
    if (!salt || !hash) return false;
    const h = await hashPin(pin, salt);
    return h === hash;
  }

  async function savePin(pin) {
    const salt = randomSalt();
    const h = await hashPin(pin, salt);
    localStorage.setItem(LS_PIN_SALT, salt);
    localStorage.setItem(LS_PIN_HASH, h);
    localStorage.setItem(LS_ENABLED, "1");
  }

  async function onPinDigit(digit) {
    hideError();
    if (pinBuffer.length >= 4) return;
    pinBuffer += digit;
    updateDots();
    if (pinBuffer.length < 4) return;

    const mode = document.getElementById("appLockOverlay")?.dataset.mode || "unlock";

    if (mode === "setup") {
      if (!setupPinFirst) {
        setupPinFirst = pinBuffer;
        pinBuffer = "";
        updateDots();
        const sub = document.getElementById("appLockSubtext");
        if (sub) sub.textContent = "PIN dobara enter karein / Confirm PIN";
        return;
      }
      if (setupPinFirst !== pinBuffer) {
        setupPinFirst = "";
        pinBuffer = "";
        updateDots();
        showError("PIN match nahi hua. Dubara try karein.");
        const sub = document.getElementById("appLockSubtext");
        if (sub) sub.textContent = "Naya 4-digit PIN set karein";
        return;
      }
      await savePin(pinBuffer);
      setupPinFirst = "";
      pinBuffer = "";
      document.getElementById("appLockOverlay").dataset.mode = "unlock";
      setUnlocked(true);
      hideOverlay();
      syncSecurityPanelUI();
      toast("App Lock ON — PIN save ho gaya", "success");
      return;
    }

    if (mode === "change") {
      if (setupPinStep === "old") {
        const ok = await verifyPin(pinBuffer);
        pinBuffer = "";
        updateDots();
        if (!ok) { showError("Galat PIN"); return; }
        setupPinStep = "new";
        const sub = document.getElementById("appLockSubtext");
        if (sub) sub.textContent = "Naya PIN enter karein";
        return;
      }
      if (setupPinStep === "new" && !setupPinFirst) {
        setupPinFirst = pinBuffer;
        pinBuffer = "";
        updateDots();
        const sub = document.getElementById("appLockSubtext");
        if (sub) sub.textContent = "Naya PIN confirm karein";
        return;
      }
      if (setupPinStep === "new") {
        if (setupPinFirst !== pinBuffer) {
          setupPinFirst = "";
          pinBuffer = "";
          updateDots();
          showError("PIN match nahi hua");
          return;
        }
        await savePin(pinBuffer);
        setupPinFirst = "";
        setupPinStep = "";
        pinBuffer = "";
        document.getElementById("appLockOverlay").dataset.mode = "unlock";
        hideOverlay();
        toast("PIN change ho gaya", "success");
        return;
      }
    }

    const ok = await verifyPin(pinBuffer);
    pinBuffer = "";
    updateDots();
    if (!ok) {
      showError("Galat PIN — dubara try karein");
      return;
    }
    setUnlocked(true);
    hideOverlay();
  }

  function onPinBackspace() {
    hideError();
    pinBuffer = pinBuffer.slice(0, -1);
    updateDots();
  }

  async function tryBiometricUnlock(silent) {
    try {
      const ok = await unlockWithBiometric();
      if (ok) {
        setUnlocked(true);
        hideOverlay();
        return true;
      }
    } catch (err) {
      if (!silent) showError("Face ID / Fingerprint fail — PIN use karein");
    }
    return false;
  }

  function toast(msg, type) {
    if (typeof window.showToast === "function") window.showToast(msg, type);
    else alert(msg);
  }

  function syncSecurityPanelUI() {
    const toggle = document.getElementById("appLockEnableToggle");
    const setup = document.getElementById("appLockSetupSection");
    const bioToggle = document.getElementById("appLockBiometricToggle");
    const bioRow = document.getElementById("appLockBiometricRow");
    const enabled = isEnabled();
    if (toggle) toggle.checked = enabled;
    if (setup) setup.classList.toggle("hidden", !enabled);
    if (bioRow) bioRow.classList.toggle("hidden", !enabled);
    if (bioToggle) bioToggle.checked = localStorage.getItem(LS_BIO_ENABLED) === "1";
    const status = document.getElementById("appLockStatusText");
    if (status) {
      status.textContent = enabled
        ? "App Lock ON — app khulte hi PIN ya Face ID maangega"
        : "App Lock OFF — koi PIN nahi lagega";
    }
  }

  function startSetupOverlay() {
    setupPinFirst = "";
    pinBuffer = "";
    const overlay = document.getElementById("appLockOverlay");
    if (overlay) {
      overlay.dataset.mode = "setup";
      const title = document.getElementById("appLockTitle");
      const sub = document.getElementById("appLockSubtext");
      if (title) title.textContent = "App Lock PIN Set Karein";
      if (sub) sub.textContent = "Naya 4-digit PIN enter karein";
    }
    document.getElementById("appLockBiometricBtn")?.classList.add("hidden");
    showOverlay();
  }

  function startChangePinOverlay() {
    setupPinStep = "old";
    setupPinFirst = "";
    pinBuffer = "";
    const overlay = document.getElementById("appLockOverlay");
    if (overlay) {
      overlay.dataset.mode = "change";
      const title = document.getElementById("appLockTitle");
      const sub = document.getElementById("appLockSubtext");
      if (title) title.textContent = "PIN Change Karein";
      if (sub) sub.textContent = "Purana PIN enter karein";
    }
    showOverlay();
  }

  function lockApp() {
    if (!isEnabled()) return;
    setUnlocked(false);
    const overlay = document.getElementById("appLockOverlay");
    if (overlay) {
      overlay.dataset.mode = "unlock";
      const title = document.getElementById("appLockTitle");
      const sub = document.getElementById("appLockSubtext");
      if (title) title.textContent = "BolKarigar Locked";
      if (sub) sub.textContent = "PIN ya Face ID se unlock karein";
    }
    showOverlay();
  }

  function bindKeypad() {
    document.querySelectorAll("#appLockKeypad [data-digit]").forEach((btn) => {
      btn.addEventListener("click", () => onPinDigit(btn.dataset.digit));
    });
    document.getElementById("appLockBackspaceBtn")?.addEventListener("click", onPinBackspace);
    document.getElementById("appLockBiometricBtn")?.addEventListener("click", () => tryBiometricUnlock(false));
    document.getElementById("appLockLogoutBtn")?.addEventListener("click", () => {
      localStorage.removeItem("token");
      localStorage.removeItem("bk_token");
      window.location.href = "loginpage.html";
    });
  }

  function bindSecurityPanel() {
    const toggle = document.getElementById("appLockEnableToggle");
    toggle?.addEventListener("change", () => {
      if (toggle.checked) {
        if (isEnabled()) {
          syncSecurityPanelUI();
          return;
        }
        startSetupOverlay();
        toggle.checked = false;
        return;
      }
      if (confirm("App Lock band karna hai? PIN delete ho jayega.")) {
        localStorage.removeItem(LS_ENABLED);
        localStorage.removeItem(LS_PIN_HASH);
        localStorage.removeItem(LS_PIN_SALT);
        localStorage.removeItem(LS_BIO_ENABLED);
        localStorage.removeItem(LS_CRED_ID);
        setUnlocked(true);
        syncSecurityPanelUI();
        toast("App Lock band ho gaya", "success");
      } else {
        toggle.checked = true;
      }
    });

    document.getElementById("appLockChangePinBtn")?.addEventListener("click", () => {
      if (!isEnabled()) return;
      startChangePinOverlay();
    });

    const bioToggle = document.getElementById("appLockBiometricToggle");
    bioToggle?.addEventListener("change", async () => {
      if (!bioToggle.checked) {
        localStorage.removeItem(LS_BIO_ENABLED);
        localStorage.removeItem(LS_CRED_ID);
        syncSecurityPanelUI();
        return;
      }
      try {
        const avail = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (!avail) throw new Error("unavailable");
        await registerBiometric();
        syncSecurityPanelUI();
        toast("Face ID / Fingerprint ON", "success");
      } catch {
        bioToggle.checked = false;
        toast("Is device par Face ID / Fingerprint available nahi hai", "error");
      }
    });

    document.getElementById("appLockTestBtn")?.addEventListener("click", () => lockApp());
  }

  function init() {
    bindKeypad();
    bindSecurityPanel();
    syncSecurityPanelUI();

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") setUnlocked(false);
      else if (isEnabled() && !isUnlocked()) lockApp();
    });

    window.bkOnAppBackground = function () {
      setUnlocked(false);
    };

    window.bkOnAppForeground = function () {
      if (isEnabled() && !isUnlocked()) lockApp();
    };

    if (isEnabled() && !isUnlocked()) {
      const overlay = document.getElementById("appLockOverlay");
      if (overlay) overlay.dataset.mode = "unlock";
      showOverlay();
    } else {
      setUnlocked(true);
    }
  }

  window.BolKarigarAppLock = {
    isEnabled,
    lockApp,
    syncSecurityPanelUI
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
