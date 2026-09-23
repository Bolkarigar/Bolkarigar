/**
 * Accounts Orbit — Help panel with animated demos (Hindi + English)
 */
(function () {
  const ALL_MODULES = () => [
    ...(window.HELP_MODULE_CATALOG || []),
    ...(window.HELP_BUSINESS_MODULES || [])
  ];

  function moduleVisibleForUser(mod, me) {
    if (!me) return false;
    if (mod.ownerOnly && me.isStaff) return false;
    if (mod.staffOnly && !(me.isStaff && me.role === "staff")) return false;
    if (mod.hideForStaff && me.isStaff && me.role === "staff") return false;

    if (!mod.panelId) {
      if (mod.id === "tallySync") {
        if (me.isStaff && me.role === "staff") return false;
        return !!me.subscription?.tallySync;
      }
      return false;
    }

    if (typeof window.bkCanAccessTab === "function") {
      return window.bkCanAccessTab(me, mod.panelId);
    }

    const sub = me.subscription || {};
    if (sub.fullAccess) return mod.plans.includes("business") || mod.plans.includes("pro");
    if (!mod.plans.includes("pro")) return false;
    const allowed = sub.allowedTabs;
    if (Array.isArray(allowed) && mod.panelId && !allowed.includes(mod.panelId)) return false;
    return true;
  }

  function escapeHtml(value) {
    if (value == null) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildStepsList(mod) {
    if (!mod.steps?.length) return "";
    const items = mod.steps.map((s, i) => `
      <li>
        <span class="step-en"><strong>${i + 1}.</strong> ${escapeHtml(s.en)}</span>
        <span class="step-hi">${escapeHtml(s.hi)}</span>
      </li>`).join("");
    return `
      <p class="help-steps-title">Step-by-step guide</p>
      <ol class="help-steps-list">${items}</ol>`;
  }

  function renderHelpModules(me) {
    const container = document.getElementById("helpModulesList");
    const badge = document.getElementById("helpPlanBadge");
    if (!container) return;

    const sub = me?.subscription || {};
    const modules = ALL_MODULES().filter((m) => moduleVisibleForUser(m, me));

    if (badge) {
      const isStaffRole = me?.isStaff && me?.role === "staff";
      let planLabel = sub.fullAccess ? "Business Plan (₹299/mo)" : "Pro Plan (₹99/mo after trial)";
      if (isStaffRole) planLabel = "Staff Mode";
      badge.textContent = `${sub.fullAccess ? "🏢" : isStaffRole ? "👤" : "⭐"} ${planLabel} — ${modules.length} modules with animated demos`;
      badge.className = sub.fullAccess ? "help-plan-badge business" : "help-plan-badge pro";
    }

    if (!modules.length) {
      container.innerHTML = '<p class="helper-text">Modules will appear here after your plan loads.</p>';
      return;
    }

    const buildDemo = typeof window.buildHelpDemoHtml === "function"
      ? window.buildHelpDemoHtml
      : () => "";

    container.innerHTML = modules.map((mod, idx) => {
      const cardId = `help-card-${mod.id}`;
      const num = idx + 1;
      const demoHtml = buildDemo(mod);
      return `
        <div class="manual-card mini-card help-module-card" id="${cardId}" data-panel="${mod.panelId || ""}" style="border-left: 4px solid ${mod.color};">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
            <h4 style="color: ${mod.color}; margin: 0;">${num}. ${escapeHtml(mod.title)}</h4>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              ${mod.panelId ? `<button type="button" class="secondary help-open-tab-btn" data-open-tab="${mod.panelId}" style="padding:4px 10px;font-size:12px;">↗ Open Module</button>` : ""}
              <button type="button" class="speak-card-btn" onclick="speakCardText('${cardId}', this)" style="padding:4px 10px;font-size:12px;">🔊 Listen</button>
            </div>
          </div>
          ${demoHtml}
          <div class="card-text">
            <div class="help-text-block help-text-en">${escapeHtml(mod.english || mod.hindi || "")}</div>
            ${buildStepsList(mod)}
          </div>
        </div>`;
    }).join("");

    container.querySelectorAll(".help-open-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.openTab;
        if (tab && typeof window.openPanel === "function") window.openPanel(tab);
      });
    });

    if (typeof window.initHelpDemos === "function") {
      window.initHelpDemos(container);
    }
    if (typeof window.applyHelpLang === "function") {
      window.applyHelpLang(localStorage.getItem("bk_help_lang") || "en");
    }
  }

  window.HELP_MODULE_CATALOG_FULL = ALL_MODULES;
  window.renderHelpModules = renderHelpModules;
  window.moduleVisibleForUser = moduleVisibleForUser;

  document.addEventListener("bk:langchange", () => {
    if (window._bkAccountInfo) renderHelpModules(window._bkAccountInfo);
  });
})();
