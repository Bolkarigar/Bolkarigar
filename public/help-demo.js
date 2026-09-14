/**
 * BolKarigar — Animated help demos (Hindi + English step captions)
 */
(function () {
  const timers = new Map();
  const observers = new Map();
  const stepStore = new Map();
  const STEP_MS = 2800;

  function esc(value) {
    if (value == null) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getHelpLang() {
    return localStorage.getItem("bk_help_lang") || "both";
  }

  function applyHelpLang(mode) {
    const m = mode === "en" || mode === "hi" ? mode : "both";
    localStorage.setItem("bk_help_lang", m);
    document.body.classList.remove("help-lang-en", "help-lang-hi", "help-lang-both");
    document.body.classList.add(`help-lang-${m}`);
    document.querySelectorAll(".help-lang-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.helpLang === m);
    });
  }

  function renderVisual(visual) {
    if (!visual) return "";
    const lines = (visual.lines || []).map((line) => {
      if (typeof line === "string") {
        return `<li>${esc(line)}</li>`;
      }
      return `<div class="help-mock-row">
        <span class="help-mock-lbl">${esc(line.label || "")}</span>
        <span class="help-mock-val${line.animate ? " help-typing" : ""}">${esc(line.value || "")}</span>
      </div>`;
    }).join("");

    const listBlock = visual.list
      ? `<ul class="help-mock-list">${(visual.list || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`
      : "";

    return `
      <div class="help-mock-title">${esc(visual.title || "")}</div>
      ${visual.list ? listBlock : lines}
      ${visual.action ? `<div class="help-mock-action help-pulse">${esc(visual.action)}</div>` : ""}
    `;
  }

  function buildHelpDemoHtml(mod) {
    if (!mod?.steps?.length) return "";
    const stepsHtml = mod.steps.map((step, i) => `
      <div class="help-demo-step${i === 0 ? " active" : ""}" data-step="${i}">
        ${renderVisual(step.visual)}
      </div>
    `).join("");

    const first = mod.steps[0];
    stepStore.set(mod.id, mod.steps);

    return `
      <div class="help-demo-box" data-mod-id="${esc(mod.id)}">
        <div class="help-demo-screen">${stepsHtml}</div>
        <div class="help-demo-caption">
          <p class="help-cap-en">${esc(first.en)}</p>
          <p class="help-cap-hi">${esc(first.hi)}</p>
        </div>
        <div class="help-demo-dots">
          ${mod.steps.map((_, i) => `<span class="help-dot${i === 0 ? " active" : ""}" data-dot="${i}"></span>`).join("")}
        </div>
      </div>`;
  }

  function stopDemo(box) {
    const t = timers.get(box);
    if (t) {
      clearInterval(t);
      timers.delete(box);
    }
  }

  function showStep(box, idx) {
    const steps = box.querySelectorAll(".help-demo-step");
    const dots = box.querySelectorAll(".help-dot");
    if (!steps.length) return;

    const safeIdx = ((idx % steps.length) + steps.length) % steps.length;
    steps.forEach((el, i) => el.classList.toggle("active", i === safeIdx));
    dots.forEach((el, i) => el.classList.toggle("active", i === safeIdx));

    const meta = stepStore.get(box.dataset.modId) || [];

    const capEn = box.querySelector(".help-cap-en");
    const capHi = box.querySelector(".help-cap-hi");
    if (meta[safeIdx]) {
      if (capEn) capEn.textContent = meta[safeIdx].en || "";
      if (capHi) capHi.textContent = meta[safeIdx].hi || "";
    }
    box.dataset.currentStep = String(safeIdx);
  }

  function startDemo(box) {
    stopDemo(box);
    let idx = Number(box.dataset.currentStep) || 0;
    showStep(box, idx);
    const timer = setInterval(() => {
      idx += 1;
      showStep(box, idx);
    }, STEP_MS);
    timers.set(box, timer);
  }

  function initHelpDemos(root) {
    const scope = root || document.getElementById("helpModulesList");
    if (!scope) return;

    scope.querySelectorAll(".help-demo-box").forEach((box) => {
      if (box.dataset.demoReady) return;
      box.dataset.demoReady = "1";

      if ("IntersectionObserver" in window) {
        const obs = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) startDemo(box);
            else stopDemo(box);
          });
        }, { threshold: 0.25 });
        obs.observe(box);
        observers.set(box, obs);
      } else {
        startDemo(box);
      }

      box.addEventListener("click", () => {
        const cur = Number(box.dataset.currentStep) || 0;
        showStep(box, cur + 1);
        if (timers.has(box)) startDemo(box);
      });
    });
  }

  function wireHelpLangToggle() {
    document.querySelectorAll(".help-lang-btn").forEach((btn) => {
      if (btn.dataset.helpLangWired) return;
      btn.dataset.helpLangWired = "1";
      btn.addEventListener("click", () => applyHelpLang(btn.dataset.helpLang || "both"));
    });
    applyHelpLang(getHelpLang());
  }

  window.buildHelpDemoHtml = buildHelpDemoHtml;
  window.initHelpDemos = initHelpDemos;
  window.applyHelpLang = applyHelpLang;

  document.addEventListener("DOMContentLoaded", wireHelpLangToggle);
})();
