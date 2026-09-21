// public/bolkarigar.js

// Purani cached files clear karo
if ('caches' in window) {
  caches.keys().then(keys => keys.filter(k => k.startsWith('bolkarigar-')).forEach(k => caches.delete(k)));
}

// API Base configuration
const API_URL = (typeof window.bkGetApiUrl === 'function' ? window.bkGetApiUrl() : (window.API_URL || window.location.origin));
const getToken = () => localStorage.getItem("bk_token") || localStorage.getItem("token") || "";

function getAccountingMode() {
  const selected = document.querySelector('input[name="accMode"]:checked');
  return selected?.value || "inbuilt";
}

function showToast(msg, type = "success") {
  if (typeof window.bkEnMsg === "function") msg = window.bkEnMsg(msg);
  const el = document.getElementById("appToast");
  if (!el) { if (type === "error") alert(msg); else console.log(msg); return; }
  el.textContent = msg;
  el.className = "app-toast " + type;
  el.classList.remove("hidden");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => el.classList.add("hidden"), 3500);
}

function bkVoucherTypeLabel(type) {
  if (type === "Debit Note") return "Purchase Return";
  if (type === "Credit Note") return "Sales Return";
  return type || "";
}
window.bkVoucherTypeLabel = bkVoucherTypeLabel;

/** + = udhar, − = refund due to customer, ~0 = clear */
function bkFormatDebtorNet(netRaw) {
  const net = Math.round((Number(netRaw) || 0) * 100) / 100;
  if (Math.abs(net) <= 0.01) {
    return { net: 0, refundDue: 0, udharDue: 0, clear: true, status: "clear", label: "Paid / Clear", badgeClass: "khata-badge-clear" };
  }
  if (net > 0) {
    return { net, refundDue: 0, udharDue: net, clear: false, status: "udhar", label: `₹${net.toFixed(2)} Credit`, badgeClass: "khata-badge-udhar" };
  }
  const refund = Math.abs(net);
  return {
    net,
    refundDue: refund,
    udharDue: 0,
    clear: false,
    status: "refund",
    label: `−₹${refund.toFixed(2)} Refund Due`,
    badgeClass: "khata-badge-refund"
  };
}
window.bkFormatDebtorNet = bkFormatDebtorNet;

function isCreditSale(item) {
  const pt = String(item?.paymentType || "Cash").trim().toLowerCase();
  if (pt === "credit" || pt === "udhar") return true;
  if (["cash", "upi", "bank", "paid"].includes(pt)) return false;
  return String(item?.status || "").toLowerCase() === "pending";
}

async function recordKhataSaleFromInvoice({ customer, product, hsn, price, qty, gstRate, paymentType, salesHistoryId, invoiceNo, silent = false }) {
  if (!customer || !product) return;
  const payType = paymentType || document.getElementById("invoicePaymentType")?.value || "Cash";
  try {
    const res = await fetch(`${API_URL}/api/khata/record-sale`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({
        customer, product, hsn, price, qty, gstRate, paymentType: payType,
        salesHistoryId, invoiceNo
      })
    });
    const data = await res.json();
    if (data.success) {
      if (!silent) {
        showToast(isCreditSale({ paymentType: payType })
          ? "✅ Credit sale saved to ledger (udhar)."
          : "✅ Paid sale saved — not added to udhar.");
      }
      if (typeof window.refreshKhataPro === "function") window.refreshKhataPro();
      if (typeof window.refreshUdharKhata === "function") window.refreshUdharKhata();
    } else if (data.error) {
      console.warn("Khata record-sale:", data.error);
    }
  } catch (err) {
    console.error("Khata record-sale error:", err);
  }
}
window.recordKhataSaleFromInvoice = recordKhataSaleFromInvoice;

// 🔴 SECURITY FIX: User-entered text (todo, customer name, project name, item
// name, ledger name, etc.) pehle seedha innerHTML mein daala ja raha tha —
// isse koi bhi "<script>...</script>" ya "<img onerror=...>" jaisa text
// daal ke stored XSS kar sakta tha, aur token localStorage mein hone ki
// wajah se account hijack ho sakta tha. Yeh helper HTML-unsafe characters ko
// safe entities mein convert karta hai. Poori file mein jahan bhi user-data
// innerHTML ke andar jaata hai, ab isse escape karna ZAROORI hai.
function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Table ke neeche amount total bar — page total + optional grand total */
window.bkSetTableAmountTotal = function (target, options) {
  const opts = typeof options === "number" ? { amount: options } : (options || {});
  const body = typeof target === "string" ? document.getElementById(target) : target;
  if (!body) return;
  const wrap = body.closest(".table-wrap") || body.parentElement;
  if (!wrap) return;

  let bar = wrap.querySelector(":scope > .table-amount-total-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.className = "table-amount-total-bar";
    wrap.appendChild(bar);
  }

  if (opts.hide) {
    bar.classList.add("hidden");
    bar.innerHTML = "";
    return;
  }

  const fmt = (n) => `₹${(parseFloat(n) || 0).toFixed(2)}`;
  const lines = Array.isArray(opts.lines)
    ? opts.lines
    : [{ label: opts.label || "Total Amount", amount: opts.amount ?? 0, color: opts.color || "#22c55e" }];

  const rowsMeta = opts.rows != null
    ? `<span class="table-total-meta"> (${opts.rows} row${opts.rows === 1 ? "" : "s"})</span>`
    : "";

  bar.innerHTML = lines.map((ln, i) => `
    <div class="table-total-row${i ? " table-total-row-sub" : ""}">
      <span>${escapeHtml(ln.label)}${i === 0 ? rowsMeta : ""}</span>
      <strong style="color:${ln.color || "#22c55e"}">${fmt(ln.amount)}</strong>
    </div>`).join("");

  if (opts.grand != null && Math.abs((opts.grand || 0) - (lines[0]?.amount || 0)) > 0.009) {
    bar.innerHTML += `<div class="table-total-grand">All records total: <strong>${fmt(opts.grand)}</strong></div>`;
  }

  bar.classList.remove("hidden");
};

let editingIndex = -1; // -1 means abhi koi item edit nahi ho raha hai
let invoiceLineItems = []; // Purchase jaisa — memory-only draft, reload par khali

// Session Check
if (!getToken()) {
  window.location.href = "loginpage.html";
}

// Global state cache to minimize server roundtrips
let state = {
  todos: [],
  projects: [],
  expenses: []
};
window.state = state;

/** Invoice draft clear — Purchase jaisa memory-only table */
function resetInvoiceDraftTable() {
  invoiceLineItems = [];
  editingIndex = -1;
  localStorage.removeItem("bolkarigar_invoices");
  const addBtn = document.getElementById("addInvoiceBtn");
  if (addBtn) addBtn.textContent = "Add Item (F2)";
  const statusEl = document.getElementById("invoiceStatus");
  if (statusEl) {
    statusEl.textContent = "";
    statusEl.style.color = "";
  }
  if (typeof renderInvoice === "function") renderInvoice();
}
window.clearInvoiceDraftSession = resetInvoiceDraftTable;

// Unified Sync Engine
async function syncWithBackend(type, newPayload) {
  try {
    const response = await fetch(`${API_URL}/api/dashboard/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ type, payload: newPayload })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    state[type] = newPayload;
    return true;
  } catch (err) {
    console.error(`Sync failed for ${type}:`, err);
    alert("Server sync issue! Please check your connection.");
    return false;
  }
}

function showDataStatusBanner(me, serverInvoices, localInvoices) {
  const el = document.getElementById("dataStatusBanner");
  if (!el) return;
  const msgs = [];
  if (me?.isStaff) {
    const roleLabel = me.roleLabel || me.role || "Staff";
    msgs.push(`<strong>${escapeHtml(roleLabel)} Mode</strong> — ${escapeHtml(me.username || "")} | Owner ka data (limited access). Settings, Staff, Reports owner ke paas hain.`);
  }
  if ((me?.salesCount || 0) === 0 && (me?.invoicesCount || 0) === 0) {
    msgs.push("No saved data found. Wrong account? Log in again with the owner email — data is not deleted, you may be on a different account.");
  } else if (me?.username) {
    msgs.push(`Account: <b>${escapeHtml(me.username)}</b> | Sales: ${me.salesCount || 0} | Invoices: ${me.invoicesCount || 0}`);
  }
  if (!msgs.length) {
    el.classList.add("hidden");
    el.innerHTML = "";
    return;
  }
  el.innerHTML = msgs.join("<br>");
  el.classList.remove("hidden");
}

function bkHasPerm(me, perm) {
  if (!me?.isStaff) return true;
  const perms = me.permissions || [];
  return perms.includes("*") || perms.includes(perm);
}

function bkStaffFallbackTab(me) {
  if (me?.role === "staff" && bkCanAccessTab(me, "payrollPanel")) return "payrollPanel";
  if (bkCanAccessTab(me, "overviewPanel")) return "overviewPanel";
  if (bkCanAccessTab(me, "invoicePanel")) return "invoicePanel";
  const first = [...document.querySelectorAll(".tab-btn[data-tab]")].find((btn) => btn.style.display !== "none");
  return first?.dataset.tab || "invoicePanel";
}

function bkCanAccessTab(me, tabId) {
  const sub = me?.subscription;
  // Overview detail pages (Total Sales, Purchase, etc.) — same access as Overview
  if (tabId === "businessRecordsPanel") return bkCanAccessTab(me, "overviewPanel");
  // Staff Meri Hajri — Pro/Business active plan par; allowedTabs se pehle check karo
  if (tabId === "estimatePanel") {
    if (me?.isStaff) return false;
    return !!sub?.fullAccess;
  }
  if (tabId === "payrollPanel") {
    if (!me?.isStaff) return !!sub?.fullAccess;
    if (!sub?.isActive) return false;
    return ["manager", "cashier", "staff"].includes(me.role || "staff");
  }
  // Security / App Lock — sab users ke liye (device-level)
  if (tabId === "securityPanel") return true;
  // Purchase / Payment / Receipt — Pro FREE par bhi (invoice jaisa), stale allowedTabs fix
  if (tabId === "purchasePanel" || tabId === "paymentVoucherPanel" || tabId === "receiptVoucherPanel" || tabId === "modifyPanel") {
    if (sub?.fullAccess || sub?.isActive) {
      if (!me?.isStaff) return true;
      const role = me.role || "staff";
      const tabs = me.tabs || {};
      const allowed = tabs[tabId];
      if (!allowed) return ["owner", "manager", "cashier"].includes(role);
      return allowed.includes(role);
    }
    return false;
  }
  // Business Card — Pro FREE par bhi (12 free cards), server allowedTabs stale ho to bhi
  if (tabId === "businessCardPanel") {
    if (sub?.fullAccess || sub?.isActive) {
      if (!me?.isStaff) return true;
      const role = me.role || "staff";
      const tabs = me.tabs || {};
      const allowed = tabs[tabId];
      if (!allowed) return true;
      return allowed.includes(role);
    }
    return false;
  }
  if (sub && !sub.fullAccess && Array.isArray(sub.allowedTabs)) {
    if (!sub.allowedTabs.includes(tabId)) return false;
  }
  if (!me?.isStaff) return true;
  const role = me.role || "staff";
  const tabs = me.tabs || {};
  const allowed = tabs[tabId];
  if (!allowed) return true;
  return allowed.includes(role);
}

function applyRoleBasedUI(me) {
  if (!me) return;
  window._bkAccountInfo = me;
  const role = me.role || "owner";

  document.body.classList.toggle("staff-mode", !!me.isStaff);
  document.body.classList.remove("role-owner", "role-manager", "role-cashier", "role-staff");
  document.body.classList.add(`role-${role}`);

  const banner = document.getElementById("staffModeBanner");
  const bannerText = document.getElementById("staffModeText");
  if (me.isStaff && banner) {
    banner.classList.remove("hidden");
    const label = me.roleLabel || role;
    const msg = role === "staff"
      ? `${label} Mode — Meri Hajri + Tools`
      : `${label} Mode — Limited Access`;
    if (bannerText) bannerText.textContent = msg;
  } else if (banner) {
    banner.classList.add("hidden");
  }

  document.querySelector('.tab-btn[data-tab="totalSalesPanel"]')?.remove();
  document.getElementById("totalSalesPanel")?.remove();

  document.querySelectorAll(".tab-btn[data-tab]").forEach((btn) => {
    const tab = btn.dataset.tab;
    const show = bkCanAccessTab(me, tab);
    btn.style.display = show ? "" : "none";
    if (!show) btn.classList.remove("active");
  });

  document.querySelectorAll(".nav-group").forEach((group) => {
    const anyVisible = [...group.querySelectorAll(".tab-btn[data-tab]")].some((btn) => btn.style.display !== "none");
    group.style.display = anyVisible ? "" : "none";
  });

  const hasTally = !!(me.subscription?.tallySync) && bkHasPerm(me, "tally.sync");
  const tallyCard = document.querySelector(".sidebar-tally-card");
  if (tallyCard) tallyCard.style.display = hasTally ? "" : "none";

  const accModeSection = document.getElementById("accModeSection");
  if (accModeSection) accModeSection.style.display = hasTally ? "" : "none";
  if (!hasTally) {
    const inbuiltRadio = document.querySelector('input[name="accMode"][value="inbuilt"]');
    if (inbuiltRadio) inbuiltRadio.checked = true;
    if (typeof toggleTallyBtn === "function") toggleTallyBtn(false);
  } else {
    if (typeof loadAgentToken === "function") loadAgentToken();
    if (typeof refreshTallyAgentStatus === "function") refreshTallyAgentStatus();
  }

  const installBtn = document.getElementById("installAppBtn");
  if (installBtn) installBtn.style.display = me.subscription?.showInstallApp !== false ? "" : "none";

  document.body.classList.toggle("plan-business", !!me.subscription?.fullAccess);
  document.body.classList.toggle("plan-pro", !!(me.subscription?.isActive && !me.subscription?.fullAccess));

  const saveProf = document.getElementById("btnSaveProfile");
  if (saveProf) saveProf.style.display = bkHasPerm(me, "profile.edit") ? "" : "none";

  document.getElementById("importTallyBtn")?.toggleAttribute("disabled", !hasTally);
  document.getElementById("tallySyncBtn")?.toggleAttribute("disabled", !hasTally);
  if (document.getElementById("tallySyncBtn") && !hasTally) {
    document.getElementById("tallySyncBtn").style.display = "none";
  }

  const khataWrite = bkHasPerm(me, "khata.write");
  const khataPanelIds = "#khataLedgersPanel, #khataItemsPanel, #khataVoucherPanel, #khataDaybookPanel, #purchasePanel, #paymentVoucherPanel, #receiptVoucherPanel, #modifyPanel";
  document.querySelectorAll(
    `${khataPanelIds} button:not([data-readonly-ok]), #ledgerPanel .udhar-pay-btn, #recordPaymentBtn`
  ).forEach((el) => {
    if (el.id === "importTallyBtn") return;
    if (!khataWrite && el.closest("#khataLedgersPanel, #khataItemsPanel, #khataVoucherPanel, #khataDaybookPanel, #purchasePanel, #paymentVoucherPanel, #receiptVoucherPanel, #modifyPanel")) {
      el.disabled = true;
      el.title = "Khata edit is not allowed for your role";
    }
  });

  if (!bkHasPerm(me, "udhar.pay")) {
    document.querySelectorAll(".udhar-pay-btn, #recordPaymentBtn, #submitUdharPayment").forEach((el) => {
      el.style.display = "none";
    });
  }

  if (!bkHasPerm(me, "expenses.write")) {
    document.querySelectorAll("#expensePanel button, #addExpenseBtn").forEach((el) => {
      el.disabled = true;
    });
  }

  const activeTab = document.querySelector(".tab-btn.active[data-tab]");
  const activeId = activeTab?.dataset.tab;
  if (!activeId || !bkCanAccessTab(me, activeId)) {
    openPanel(bkStaffFallbackTab(me));
  }

  document.body.classList.toggle("role-staff-limited", !!(me.isStaff && me.role === "staff"));

  if (me.role === "staff") {
    document.getElementById("voiceToggle")?.style.setProperty("display", "none");
    document.getElementById("liveAiToggle")?.style.setProperty("display", "none");
    document.getElementById("devPlanToggleBar")?.classList.add("hidden");
  } else {
    document.getElementById("voiceToggle")?.style.removeProperty("display");
    document.getElementById("liveAiToggle")?.style.removeProperty("display");
  }

  document.querySelectorAll(".owner-only-plan").forEach((el) => {
    el.style.display = me.isStaff ? "none" : "";
  });

  if (typeof window.bkRenderSubscriptionUI === "function") {
    window.bkRenderSubscriptionUI(me);
  }

  if (typeof window.bkInitDevPlanToggle === "function") window.bkInitDevPlanToggle();
  if (typeof window.bkUpdateDevPlanToggle === "function") window.bkUpdateDevPlanToggle(me);

  if (typeof window.renderHelpModules === "function") window.renderHelpModules(me);
  if (typeof window.BolKarigarPayroll?.setPayrollViewMode === "function") {
    window.BolKarigarPayroll.setPayrollViewMode();
  }
  if (typeof window.BolKarigarEstimates?.refreshAccess === "function") {
    window.BolKarigarEstimates.refreshAccess();
  }
  if (typeof window.bkSyncBusinessCardPlan === "function") window.bkSyncBusinessCardPlan();
  if (typeof window.bkRenderBusinessCardGrid === "function") window.bkRenderBusinessCardGrid();
  bkUpdateHeroModuleCount();
}

function bkUpdateHeroModuleCount() {
  const el = document.getElementById("heroModuleCount");
  if (!el) return;
  const count = [...document.querySelectorAll(".tab-btn[data-tab]")].filter(
    (btn) => btn.style.display !== "none"
  ).length;
  el.textContent = String(count);
}

window.bkCanAccessTab = bkCanAccessTab;
window.bkUpdateHeroModuleCount = bkUpdateHeroModuleCount;

async function loadServerData(opts = {}) {
  const silent = !!opts.silent;
  try {
    const token = getToken();
    const meRes = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (meRes.status === 401 || meRes.status === 403) {
      logoutUser();
      return;
    }
    if (meRes.ok) {
      const me = await meRes.json();
      if (me.subscription && !me.subscription.fullAccess && Array.isArray(me.subscription.allowedTabs)) {
        ["businessCardPanel", "securityPanel", "purchasePanel", "businessRecordsPanel"].forEach((tab) => {
          if (!me.subscription.allowedTabs.includes(tab)) me.subscription.allowedTabs.push(tab);
        });
      }
      console.log('[BolKarigar] Account:', me.username, '| Sales:', me.salesCount, '| Invoices:', me.invoicesCount);
      if (!silent) {
        if (me.isStaff) showToast(`${me.roleLabel || me.role} login — invited by owner, no separate plan needed`, "info");
        else if (me.subscription?.isTrial) {
          const tn = me.subscription.planName || (me.subscription.plan === "business" ? "Business" : "Pro Shop");
          showToast(`🎉 ${tn} trial: ${me.subscription.daysLeft} days left`, "info");
        }
      }
      window._bkAccountInfo = me;
      applyRoleBasedUI(me);
      if (window.BolKarigarAlerts?.requestNotifyPermission) window.BolKarigarAlerts.requestNotifyPermission();
      if (window.BolKarigarAlerts?.pollNow) window.BolKarigarAlerts.pollNow();

      if (me.subscription?.isExpired) {
        const paywallText = document.getElementById("subscriptionPaywallText");
        if (paywallText) {
          paywallText.textContent = me.isStaff
            ? "This shop's plan has expired. You do not need to buy anything separately — ask the owner to renew the subscription."
            : "Your free trial has ended. Renew — Pro ₹99/mo or ₹999/yr · Business ₹299/mo or ₹2999/yr.";
        }
      }
    }

    const response = await fetch(`${API_URL}/api/dashboard/sync`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.status === 401 || response.status === 403) {
      logoutUser();
      return;
    }

    if (response.status === 402) {
      const errData = await response.json().catch(() => ({}));
      if (errData.subscription && window._bkAccountInfo) {
        window._bkAccountInfo.subscription = errData.subscription;
        applyRoleBasedUI(window._bkAccountInfo);
      }
      resetInvoiceDraftTable();
      return;
    }
    
    const data = await response.json();

    state.todos = data.todos || [];
    state.projects = data.projects || [];
    state.expenses = data.expenses || [];
    resetInvoiceDraftTable();

    showDataStatusBanner(window._bkAccountInfo, (data.invoices || []).length, 0);

    renderTodos();
    renderProjects();
    renderExpenses();
    renderInvoice();

    await refreshOverviewSalesFromHistory();
    calculateFinancials([], state.expenses);
    await loadCompanyProfile();
    if (typeof window.enhanceMobileTables === "function") {
      window.enhanceMobileTables();
    }
  } catch (err) {
    console.error("Initial load failed:", err);
    resetInvoiceDraftTable();
    renderTodos();
    renderProjects();
    renderExpenses();
    await refreshOverviewSalesFromHistory().catch(() => null);
    calculateFinancials([], state.expenses || []);
    showToast("Could not load all data from server — please refresh.", "error");
  }
}
// ================= TODOS SECTION =================
function renderTodos() {
  const list = document.getElementById("todoList");
  const stat = document.getElementById("todoStatus");
  if (!list) return;
  list.innerHTML = "";
  if (stat) {
    stat.textContent = state.todos.length
      ? (typeof bkT === 'function' ? bkT('todo.statusCount', { n: state.todos.length }) : `${state.todos.length} task(s) added.`)
      : (typeof bkT === 'function' ? bkT('todo.statusEmpty') : 'Your tasks will appear below.');
  }
  
  const delLabel = typeof bkT === 'function' ? bkT('common.delete') : 'Delete';
  state.todos.forEach((todo, index) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${escapeHtml(todo)}</span><button type="button" data-index="${index}" class="del-btn">${delLabel}</button>`;
    list.appendChild(li);
  });

  list.querySelectorAll(".del-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const index = Number(btn.dataset.index);
      const updated = [...state.todos];
      updated.splice(index, 1);
      if (await syncWithBackend('todos', updated)) renderTodos();
    });
  });
}

document.getElementById("addTodoBtn")?.addEventListener("click", async () => {
  const value = document.getElementById("todoInput").value.trim();
  if (!value) return;
  const updated = [...state.todos, value];
  if (await syncWithBackend('todos', updated)) {
    document.getElementById("todoInput").value = "";
    renderTodos();
  }
});

document.getElementById("clearTodoBtn")?.addEventListener("click", async () => {
  if (await syncWithBackend('todos', [])) renderTodos();
});

// ================= PROJECTS SECTION =================
function renderProjects() {
  const projectList = document.getElementById("projectList");
  const projectStatusText = document.getElementById("projectStatusText");
  if (!projectList) return;
  projectList.innerHTML = "";
  if (projectStatusText) projectStatusText.textContent = state.projects.length ? `${state.projects.length} project(s) available.` : "Projects will appear below.";
  
  state.projects.forEach(project => {
    const card = document.createElement("div");
    card.className = "project-card";
    card.innerHTML = `<h4>${escapeHtml(project.name)}</h4><p><strong>Customer:</strong> ${escapeHtml(project.customer)}</p><p><strong>Site:</strong> ${escapeHtml(project.site) || "-"}</p><p><strong>Budget:</strong> ₹${Number(project.budget || 0).toFixed(2)}</p><p><strong>Status:</strong> ${escapeHtml(project.status) || "-"}</p><p><strong>Note:</strong> ${escapeHtml(project.note) || "-"}</p>`;
    projectList.appendChild(card);
  });
}

async function executeProjectAdd() {
  const name = document.getElementById("projectName").value.trim();
  const customer = document.getElementById("projectCustomer").value.trim() || "N/A";
  const site = document.getElementById("projectSite").value.trim();
  const budget = parseFloat(document.getElementById("projectBudget").value || "0");
  const status = document.getElementById("projectStatus").value;
  const note = document.getElementById("projectNote").value.trim();
  if (!name) return false;
  
  const updated = [...state.projects, { name, customer, site, budget, status, note }];
  if (await syncWithBackend('projects', updated)) {
    document.getElementById("projectName").value = "";
    document.getElementById("projectCustomer").value = "";
    document.getElementById("projectSite").value = "";
    document.getElementById("projectBudget").value = "";
    document.getElementById("projectNote").value = "";
    renderProjects();
    return true;
  }
  return false;
}
document.getElementById("addProjectBtn")?.addEventListener("click", executeProjectAdd);

document.getElementById("clearProjectBtn")?.addEventListener("click", async () => {
  if (await syncWithBackend('projects', [])) renderProjects();
});

// ================= EXPENSES SECTION =================
function renderExpenses() {
  const body = document.getElementById("expenseBody");
  if (!body) return;
  body.innerHTML = "";
  state.expenses.forEach(expense => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${escapeHtml(expense.title)}</td><td>${escapeHtml(expense.vendor) || "-"}</td><td>${Number(expense.amount || 0).toFixed(2)}</td><td>${escapeHtml(expense.project) || "-"}</td>`;
    body.appendChild(row);
  });

  calculateFinancials([], state.expenses);
}

async function executeExpenseAdd() {
  let title = document.getElementById("expenseTitle").value.trim();
  const vendor = document.getElementById("expenseVendor").value.trim();
  const amount = parseFloat(document.getElementById("expenseAmount").value || "0");
  const project = document.getElementById("expenseProjectLink").value.trim();
  if (!title && vendor) title = vendor + " Bill";
  if (!title) title = "Expense";
  if (Number.isNaN(amount) || amount <= 0) return false;
  
  const updated = [...state.expenses, { title, vendor, amount, project }];
  if (await syncWithBackend('expenses', updated)) {
    document.getElementById("expenseTitle").value = "";
    document.getElementById("expenseVendor").value = "";
    document.getElementById("expenseAmount").value = "";
    document.getElementById("expenseProjectLink").value = "";
    renderExpenses();
    return true;
  }
  return false;
}
document.getElementById("addExpenseBtn")?.addEventListener("click", executeExpenseAdd);

document.getElementById("clearExpenseBtn")?.addEventListener("click", async () => {
  if (await syncWithBackend('expenses', [])) renderExpenses();
});

// ================= GST STATE / IGST HELPERS =================
const GST_STATE_NAMES = [
  'Jammu and Kashmir', 'Himachal Pradesh', 'Punjab', 'Chandigarh', 'Uttarakhand',
  'Haryana', 'Delhi', 'Rajasthan', 'Uttar Pradesh', 'Bihar', 'Sikkim',
  'Arunachal Pradesh', 'Nagaland', 'Manipur', 'Mizoram', 'Tripura', 'Meghalaya',
  'Assam', 'West Bengal', 'Jharkhand', 'Odisha', 'Chhattisgarh', 'Madhya Pradesh',
  'Gujarat', 'Maharashtra', 'Andhra Pradesh', 'Karnataka', 'Goa', 'Kerala',
  'Tamil Nadu', 'Puducherry', 'Telangana', 'Ladakh', 'Andaman and Nicobar Islands'
];

const GST_STATE_CODE_MAP_FE = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '18': 'Assam', '19': 'West Bengal', '27': 'Maharashtra',
  '29': 'Karnataka', '32': 'Kerala', '33': 'Tamil Nadu', '36': 'Telangana', '38': 'Ladakh'
};

function getCompanyProfile() {
  try { return JSON.parse(localStorage.getItem('bolkarigar_company_profile')) || {}; }
  catch { return {}; }
}

function extractPincode(raw) {
  if (!raw) return '';
  const match = String(raw).match(/\d{6}/);
  return match ? match[0] : '';
}

function normalizeStateName(state) {
  return String(state || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function extractStateFromText(text) {
  const lower = String(text || '').toLowerCase();
  for (const name of GST_STATE_NAMES) {
    if (lower.includes(name.toLowerCase())) return name;
  }
  if (lower.includes('j&k') || lower.includes('jammu')) return 'Jammu and Kashmir';
  if (lower.includes('rewari') || lower.includes('gurgaon') || lower.includes('gurugram')) return 'Haryana';
  return '';
}

function stateFromGstinFrontend(gstin) {
  const code = String(gstin || '').trim().substring(0, 2);
  return GST_STATE_CODE_MAP_FE[code] || '';
}

function deriveCompanyStateFromProfile(profile) {
  if (!profile) return 'Haryana';
  const fromGstin = stateFromGstinFrontend(profile.gstin);
  if (fromGstin) return fromGstin;
  const fromAddress = extractStateFromText(profile.address);
  if (fromAddress) return fromAddress;
  const fromStateField = extractStateFromText(profile.state);
  if (fromStateField) return fromStateField;
  return 'Haryana';
}

function statesAreSame(stateA, stateB) {
  const a = normalizeStateName(stateA);
  const b = normalizeStateName(stateB);
  if (!a || !b) return false;
  if (a === b) return true;
  const jk = (s) => s.includes('jammu') || s.includes('j&k') || s.includes('ladakh');
  if (jk(a) && jk(b)) return true;
  return false;
}

/** Buyer state (primary) ya pincode (fallback) se CGST+SGST vs IGST decide karta hai */
function resolveGstTaxMode(profile, buyerState, buyerPincode) {
  const companyState = deriveCompanyStateFromProfile(profile);
  const buyerStateTrim = String(buyerState || '').trim();

  if (buyerStateTrim) {
    return {
      isIntraState: statesAreSame(companyState, buyerStateTrim),
      companyState,
      buyerState: buyerStateTrim,
      method: 'state'
    };
  }

  const companyPin = extractPincode(profile?.state) || extractPincode(profile?.address);
  const buyerPin = extractPincode(buyerPincode);
  if (companyPin && buyerPin) {
    return {
      isIntraState: companyPin.slice(0, 2) === buyerPin.slice(0, 2),
      companyState,
      buyerState: '',
      method: 'pincode'
    };
  }

  return { isIntraState: true, companyState, buyerState: '', method: 'default' };
}

function getCurrentGstTaxMode() {
  const profile = getCompanyProfile();
  const buyerState = document.getElementById('buyerState')?.value?.trim() || '';
  const buyerPincode = document.getElementById('buyerPincode')?.value?.trim() || '';
  return resolveGstTaxMode(profile, buyerState, buyerPincode);
}

let invoiceStockItemsCache = [];
let invoiceLedgerCache = [];
let invoiceGstLastRate = 18;

function isInvoiceGstEnabled() {
  return document.getElementById("invoiceGstToggle")?.checked === true;
}

function getInvoiceLineGstRate(storedRate) {
  if (!isInvoiceGstEnabled()) return 0;
  const r = parseFloat(storedRate);
  return Number.isNaN(r) ? 0 : r;
}

function applyInvoiceGstToggleUI() {
  const card = document.getElementById("invoiceGeneratorSection");
  const gstSelect = document.getElementById("productGst");
  const enabled = isInvoiceGstEnabled();
  card?.classList.toggle("gst-off", !enabled);
  if (!gstSelect) return;
  if (enabled) {
    gstSelect.value = String(invoiceGstLastRate || 18);
    gstSelect.disabled = false;
  } else {
    invoiceGstLastRate = parseFloat(gstSelect.value) || 18;
    gstSelect.value = "0";
    gstSelect.disabled = true;
  }
  if (typeof renderInvoice === "function") renderInvoice();
}

async function loadInvoiceLedgers() {
  try {
    const res = await fetch(`${API_URL}/api/ledgers`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const data = await res.json();
    if (!data.success || !Array.isArray(data.ledgers)) return;
    invoiceLedgerCache = data.ledgers;
  } catch (err) {
    console.warn("Invoice ledger load:", err);
  }
}

function filterInvoiceLedgers(query, ledgerFilter) {
  const q = String(query || "").trim().toLowerCase();
  if (!q || !invoiceLedgerCache.length) return [];
  const starts = [];
  const contains = [];
  invoiceLedgerCache.forEach(ledger => {
    if (ledgerFilter && !ledgerFilter(ledger)) return;
    const name = String(ledger.partyName || "").trim();
    if (!name) return;
    const lower = name.toLowerCase();
    if (lower.startsWith(q)) starts.push(ledger);
    else if (lower.includes(q)) contains.push(ledger);
  });
  return [...starts, ...contains].slice(0, 12);
}

function hideLedgerPartySuggest(suggestId) {
  const list = document.getElementById(suggestId);
  if (list) list.classList.add("hidden");
}

function hideInvoicePartySuggest() {
  hideLedgerPartySuggest("invoicePartySuggest");
}

function renderLedgerPartySuggest(listEl, matches, onPick) {
  if (!listEl) return;
  if (!matches.length) {
    listEl.classList.add("hidden");
    listEl.innerHTML = "";
    return;
  }
  listEl.innerHTML = matches.map((ledger, i) => {
    const meta = [ledger.ledgerGroup, ledger.address || ledger.mobile, ledger.gstin].filter(Boolean).join(" · ");
    return `<li role="option" data-idx="${i}" tabindex="0">
      ${escapeHtml(ledger.partyName)}
      ${meta ? `<span class="party-meta">${escapeHtml(meta)}</span>` : ""}
    </li>`;
  }).join("");
  listEl.classList.remove("hidden");
  listEl._matches = matches;
  listEl.querySelectorAll("li").forEach(li => {
    li.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const idx = parseInt(li.dataset.idx, 10);
      if (listEl._matches && listEl._matches[idx]) onPick(listEl._matches[idx]);
    });
  });
}

function clearLedgerPartyAutocomplete(hiddenId, searchId, suggestId) {
  const hidden = document.getElementById(hiddenId);
  const search = document.getElementById(searchId);
  if (hidden) hidden.value = "";
  if (search) search.value = "";
  if (suggestId) hideLedgerPartySuggest(suggestId);
}

const ledgerPartyAutocompleteInited = new Set();

function setupLedgerPartyAutocomplete({ searchId, suggestId, hiddenId, onSelect, ledgerFilter }) {
  if (ledgerPartyAutocompleteInited.has(searchId)) return;
  ledgerPartyAutocompleteInited.add(searchId);

  const input = document.getElementById(searchId);
  const list = document.getElementById(suggestId);
  if (!input || !list) return;

  function pick(ledger) {
    if (hiddenId) {
      const hid = document.getElementById(hiddenId);
      if (hid) hid.value = ledger._id || "";
    }
    input.value = ledger.partyName || "";
    hideLedgerPartySuggest(suggestId);
    if (onSelect) onSelect(ledger);
  }

  function syncHiddenFromTypedName() {
    if (!hiddenId) return;
    const hid = document.getElementById(hiddenId);
    if (!hid?.value) return;
    const ledger = invoiceLedgerCache.find(l => l._id === hid.value);
    const typed = input.value.trim().toLowerCase();
    if (!ledger || ledger.partyName.trim().toLowerCase() !== typed) hid.value = "";
  }

  function showSuggestions() {
    syncHiddenFromTypedName();
    const ensureCache = invoiceLedgerCache.length ? Promise.resolve() : loadInvoiceLedgers();
    ensureCache.then(() => {
      renderLedgerPartySuggest(list, filterInvoiceLedgers(input.value, ledgerFilter), pick);
    });
  }

  input.addEventListener("input", () => {
    showSuggestions();
    if (searchId === "customerName" && typeof updateBusyVoucherMeta === "function") updateBusyVoucherMeta();
  });

  input.addEventListener("focus", showSuggestions);

  input.addEventListener("keydown", (e) => {
    if (list.classList.contains("hidden")) return;
    const items = [...list.querySelectorAll("li")];
    if (!items.length) return;
    let active = items.findIndex(li => li.classList.contains("active"));
    if (e.key === "ArrowDown") {
      e.preventDefault();
      active = (active + 1) % items.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      active = active <= 0 ? items.length - 1 : active - 1;
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      const idx = parseInt(items[active].dataset.idx, 10);
      if (list._matches && list._matches[idx]) pick(list._matches[idx]);
      return;
    } else if (e.key === "Escape") {
      hideLedgerPartySuggest(suggestId);
      return;
    } else {
      return;
    }
    items.forEach((li, i) => li.classList.toggle("active", i === active));
  });

  document.addEventListener("click", (e) => {
    const wrap = input.closest(".inv-party-autocomplete");
    if (wrap && !wrap.contains(e.target)) hideLedgerPartySuggest(suggestId);
  });
}

function setupVoucherPartyAutocompletes() {
  setupLedgerPartyAutocomplete({
    searchId: "pvPartySearch",
    suggestId: "pvPartySuggest",
    hiddenId: "pvPartyInput",
    ledgerFilter: (l) => l.ledgerGroup !== "Sundry Debtor",
    onSelect: (ledger) => {
      const gst = document.getElementById("pvSupplierGstinInput");
      if (gst && !gst.value.trim() && ledger.gstin) gst.value = ledger.gstin;
    }
  });
  setupLedgerPartyAutocomplete({ searchId: "pmvPartySearch", suggestId: "pmvPartySuggest", hiddenId: "pmvPartyInput" });
  setupLedgerPartyAutocomplete({ searchId: "rcvPartySearch", suggestId: "rcvPartySuggest", hiddenId: "rcvPartyInput" });
  setupLedgerPartyAutocomplete({ searchId: "voucherPartySearch", suggestId: "voucherPartySuggest", hiddenId: "voucherPartyInput" });
}

function applyInvoiceLedgerToForm(ledger) {
  if (!ledger) return;
  const nameEl = document.getElementById("customerName");
  const gstEl = document.getElementById("customerGstin");
  const addrEl = document.getElementById("customerAddress");
  const stateEl = document.getElementById("buyerState");
  if (nameEl) nameEl.value = ledger.partyName || "";
  if (gstEl && ledger.gstin) gstEl.value = ledger.gstin;
  if (addrEl) addrEl.value = (ledger.address || ledger.mobile || "").trim();
  if (stateEl && ledger.gstin) {
    const derived = stateFromGstinFrontend(ledger.gstin);
    if (derived) stateEl.value = derived;
  }
  syncBuyerStateFromGstin();
  hideInvoicePartySuggest();
  if (typeof updateBusyVoucherMeta === "function") updateBusyVoucherMeta();
  if (typeof renderInvoice === "function") renderInvoice();
}

function renderInvoicePartySuggest(matches) {
  const list = document.getElementById("invoicePartySuggest");
  renderLedgerPartySuggest(list, matches, applyInvoiceLedgerToForm);
}

function showInvoicePartySuggestForInput() {
  const input = document.getElementById("customerName");
  if (!input) return;
  const matches = filterInvoiceLedgers(input.value);
  renderInvoicePartySuggest(matches);
}

function setupInvoicePartyAutocomplete() {
  setupLedgerPartyAutocomplete({
    searchId: "customerName",
    suggestId: "invoicePartySuggest",
    onSelect: applyInvoiceLedgerToForm
  });
}

async function loadInvoiceStockItems() {
  try {
    const res = await fetch(`${API_URL}/api/items`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const data = await res.json();
    if (!data.success || !Array.isArray(data.items)) return;
    invoiceStockItemsCache = data.items;
    const dl = document.getElementById("invoiceStockList");
    if (dl) {
      dl.innerHTML = data.items.map(i =>
        `<option value="${escapeHtml(i.itemName)}"></option>`
      ).join("");
    }
  } catch (err) {
    console.warn("Invoice stock items load:", err);
  }
}

function findInvoiceStockItem(name) {
  const q = String(name || "").trim().toLowerCase();
  if (!q) return null;
  return invoiceStockItemsCache.find(i => String(i.itemName || "").trim().toLowerCase() === q) || null;
}

function applyStockItemToInvoiceFields(name) {
  const match = findInvoiceStockItem(name);
  if (!match) return false;
  const hsnEl = document.getElementById("productHsn");
  const priceEl = document.getElementById("productPrice");
  const gstEl = document.getElementById("productGst");
  const unitEl = document.getElementById("productUnitTag");
  if (hsnEl) hsnEl.value = match.hsnCode || "";
  if (priceEl && match.sellingPrice != null) priceEl.value = match.sellingPrice;
  if (gstEl && isInvoiceGstEnabled() && match.gstRate != null) {
    gstEl.value = String(match.gstRate);
    invoiceGstLastRate = parseFloat(match.gstRate) || 18;
  }
  if (unitEl) unitEl.textContent = match.unit || "Pcs";
  return true;
}

function syncBuyerStateFromGstin() {
  const gstin = document.getElementById("customerGstin")?.value?.trim() || "";
  const stateEl = document.getElementById("buyerState");
  if (!stateEl) return;
  if (gstin.length >= 2) {
    const derived = stateFromGstinFrontend(gstin);
    if (derived) stateEl.value = derived;
  }
}

function bkInvoiceNoPrefix(companyName) {
  return (companyName || "INV").split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 4) || "INV";
}

function getInvoiceNumberPreview() {
  let savedProfile = {};
  try { savedProfile = JSON.parse(localStorage.getItem("bolkarigar_company_profile") || "{}") || {}; } catch (_) {}
  const companyName = savedProfile.name || savedProfile.companyName || "INV";
  const key = "bolkarigar_invoice_counter_" + companyName.replace(/\s+/g, "_");
  const counter = parseInt(localStorage.getItem(key) || "0", 10) + 1;
  const prefix = bkInvoiceNoPrefix(companyName);
  const year = new Date().getFullYear().toString().slice(-2);
  return `${prefix}/${counter}/${year}`;
}

let _invoiceNoUserEdited = false;

async function peekNextInvoiceNumber() {
  try {
    const res = await fetch(`${API_URL}/api/profile`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    if (res.ok) {
      const profile = await res.json();
      const companyName = profile.companyName || profile.name || "INV";
      const counter = (parseInt(profile.invoiceCounter, 10) || 0) + 1;
      const prefix = bkInvoiceNoPrefix(companyName);
      const year = new Date().getFullYear().toString().slice(-2);
      return `${prefix}/${counter}/${year}`;
    }
  } catch (e) {
    console.warn("Invoice number preview:", e);
  }
  return getInvoiceNumberPreview();
}

async function refreshInvoiceDraftNumber(force) {
  const inp = document.getElementById("invoiceNoDraftInput");
  if (!inp) return;
  if (_invoiceNoUserEdited && !force) return;
  inp.value = "…";
  inp.disabled = true;
  try {
    inp.value = await peekNextInvoiceNumber();
    _invoiceNoUserEdited = false;
  } catch (_) {
    inp.value = getInvoiceNumberPreview();
  } finally {
    inp.disabled = false;
  }
}

function getInvoiceDraftNumber() {
  return document.getElementById("invoiceNoDraftInput")?.value?.trim() || "";
}

function formatVoucherDateChip(raw) {
  if (!raw) return "—";
  const d = raw instanceof Date ? raw : new Date(raw + (String(raw).length === 10 ? "T12:00:00" : ""));
  if (isNaN(d.getTime())) return "—";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()} (${days[d.getDay()]})`;
}

function getInvoiceSelectedDate() {
  const inp = document.getElementById("invoiceDateInput");
  if (inp?.value) return new Date(inp.value + "T12:00:00");
  return new Date();
}

function ensureInvoiceDateDefault() {
  const inp = document.getElementById("invoiceDateInput");
  if (inp && !inp.value) inp.value = new Date().toISOString().slice(0, 10);
}

function setupClickableDateChip(chipId, inputId, onChange) {
  const chip = document.getElementById(chipId);
  const inp = document.getElementById(inputId);
  if (!chip || !inp) return;
  chip.addEventListener("click", () => {
    if (typeof inp.showPicker === "function") inp.showPicker();
    else { inp.focus(); inp.click(); }
  });
  inp.addEventListener("change", () => {
    if (onChange) onChange();
  });
}

function updateBusyVoucherMeta() {
  const dateEl = document.getElementById("busyVchDate");
  const saleDesc = document.getElementById("busySaleTypeDesc");
  const itemInfo = document.getElementById("busyItemInfo");
  const gstSelect = document.getElementById("productGst");

  if (dateEl) {
    ensureInvoiceDateDefault();
    dateEl.textContent = formatVoucherDateChip(getInvoiceSelectedDate());
  }

  const gstRate = isInvoiceGstEnabled() ? parseFloat(gstSelect?.value || "0") : 0;
  const taxMode = getCurrentGstTaxMode();
  if (saleDesc) {
    if (!isInvoiceGstEnabled()) {
      saleDesc.textContent = "GST OFF — items will be added without tax.";
    } else {
      const taxLabel = taxMode.isIntraState ? "CGST + SGST" : "IGST";
      saleDesc.textContent = `${taxLabel} @ ${gstRate}% (company state se auto).`;
    }
  }

  if (itemInfo) {
    const party = document.getElementById("customerName")?.value?.trim() || "—";
    const itemCount = invoiceLineItems.length;
    const gstLabel = isInvoiceGstEnabled() ? "ON" : "OFF";
    itemInfo.textContent = `Party: ${party} | Items: ${itemCount} | GST: ${gstLabel}`;
  }
}

function renderBusyTaxSummary(invoices) {
  const tbody = document.getElementById("busyTaxSummaryBody");
  if (!tbody) return;
  if (!isInvoiceGstEnabled()) {
    tbody.innerHTML = "<tr><td colspan='3' style='text-align:center'>GST OFF — no tax</td></tr>";
    return;
  }
  if (!invoices || !invoices.length) {
    tbody.innerHTML = "<tr><td colspan='3' style='text-align:center'>Add items to see tax breakup</td></tr>";
    return;
  }
  const buckets = {};
  invoices.forEach(item => {
    const rate = getInvoiceLineGstRate(item.gstRate);
    const base = (parseFloat(item.price) || 0) * (parseFloat(item.qty) || 1);
    const tax = (base * rate) / 100;
    if (!buckets[rate]) buckets[rate] = { taxable: 0, tax: 0 };
    buckets[rate].taxable += base;
    buckets[rate].tax += tax;
  });
  const taxMode = getCurrentGstTaxMode();
  tbody.innerHTML = Object.keys(buckets).sort((a, b) => parseFloat(a) - parseFloat(b)).map(rate => {
    const b = buckets[rate];
    const rateLabel = taxMode.isIntraState ? `${rate}% (CGST+SGST)` : `${rate}% (IGST)`;
    return `<tr><td>${rateLabel}</td><td>₹${b.taxable.toFixed(2)}</td><td>₹${b.tax.toFixed(2)}</td></tr>`;
  }).join("");
}

// ================= INVOICE SECTION (Purchase panel jaisa — memory-only draft) =================
function invoiceLineTotal(item) {
  const price = parseFloat(item.price) || 0;
  const qty = parseFloat(item.qty) || 1;
  const gstRate = getInvoiceLineGstRate(item.gstRate);
  const baseTotal = price * qty;
  return baseTotal + (baseTotal * gstRate) / 100;
}

function clearInvoiceEntryFields() {
  const ids = ["productName", "productHsn", "productPrice"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const qtyEl = document.getElementById("productQty");
  if (qtyEl) qtyEl.value = "1";
}

function renderInvoice() {
  const body = document.getElementById("invoiceBody");
  const grandTotalEl = document.getElementById("grandTotal");
  if (!body) return;

  body.innerHTML = "";
  let grand = 0;

  if (invoiceLineItems.length > 0) {
    invoiceLineItems.forEach((item, index) => {
      const price = parseFloat(item.price) || 0;
      const qty = parseFloat(item.qty) || 1;
      const gstRate = getInvoiceLineGstRate(item.gstRate);
      const lineTotal = invoiceLineTotal(item);
      grand += lineTotal;

      const hsnLine = item.hsn ? `<br><small style="color:#666">HSN: ${escapeHtml(item.hsn)}</small>` : "";
      const gstSmall = gstRate > 0 ? `<br><small style="color:#666">GST ${gstRate}%</small>` : "";

      const row = document.createElement("tr");
      row.innerHTML = `
        <td class="col-sn">${index + 1}</td>
        <td class="col-item">${escapeHtml(item.product) || "-"}${hsnLine}${gstSmall}</td>
        <td class="col-qty">${qty}</td>
        <td class="col-unit">${escapeHtml(item.unit || "Pcs")}</td>
        <td class="col-price">₹${price.toFixed(2)}</td>
        <td class="inv-amt-cell">₹${lineTotal.toFixed(2)}</td>
        <td>
          <div class="inv-row-actions">
            <button type="button" class="inv-row-edit" onclick="editInvoiceItem(${index})">Edit</button>
            <button type="button" class="inv-row-del" onclick="deleteInvoiceItem(${index})">Del</button>
          </div>
        </td>
      `;
      body.appendChild(row);
    });
  } else {
    body.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:12px;">Select party, add items with Add Item (F2).</td></tr>`;
  }

  if (grandTotalEl) grandTotalEl.textContent = grand.toFixed(2);
  renderBusyTaxSummary(invoiceLineItems);
  updateBusyVoucherMeta();
}

function refreshInvoicePanel() {
  if (typeof ensureInvoiceDateDefault === "function") ensureInvoiceDateDefault();
  if (typeof loadInvoiceStockItems === "function") loadInvoiceStockItems();
  if (typeof loadInvoiceLedgers === "function") loadInvoiceLedgers();
  if (typeof refreshInvoiceDraftNumber === "function") refreshInvoiceDraftNumber(false);
  if (typeof updateBusyVoucherMeta === "function") updateBusyVoucherMeta();
  renderInvoice();
}
window.refreshInvoicePanel = refreshInvoicePanel;

window.editInvoiceItem = function(index) {
  const item = invoiceLineItems[index];
  if (!item) return;

  document.getElementById("customerName").value = item.customer || "";
  document.getElementById("productName").value = item.product || "";
  document.getElementById("productHsn").value = item.hsn || "";
  document.getElementById("productPrice").value = item.price || "";
  document.getElementById("productQty").value = item.qty || 1;
  
  if (document.getElementById("productGst")) {
    const rate = item.gstRate !== undefined ? item.gstRate : 18;
    document.getElementById("productGst").value = rate;
    invoiceGstLastRate = parseFloat(rate) || 18;
    const gstToggle = document.getElementById("invoiceGstToggle");
    if (gstToggle) gstToggle.checked = (parseFloat(rate) || 0) > 0;
    applyInvoiceGstToggleUI();
  }

  editingIndex = index;

  const addBtn = document.getElementById("addInvoiceBtn");
  if (addBtn) addBtn.textContent = "Update Item (F2)";

  const statusEl = document.getElementById("invoiceStatus");
  if (statusEl) statusEl.textContent = "✏️ Editing row #" + (index + 1) + ". Make changes and click 'Update Item'.";
};

async function deleteInvoiceItem(index) {
  if (invoiceLineItems[index] === undefined) return;
  invoiceLineItems.splice(index, 1);
  if (editingIndex === index) {
    editingIndex = -1;
    const addBtn = document.getElementById("addInvoiceBtn");
    if (addBtn) addBtn.textContent = "Add Item (F2)";
    clearInvoiceEntryFields();
  } else if (editingIndex > index) {
    editingIndex -= 1;
  }
  renderInvoice();
}

function draftLineTotal(item) {
  if (!item) return 0;
  const direct = parseFloat(item.totalAmount);
  if (direct > 0) return direct;
  return typeof getInvoiceLineGrandTotal === "function"
    ? getInvoiceLineGrandTotal(item)
    : (parseFloat(item.price) || 0) * (parseFloat(item.qty) || 1);
}

window.removeDraftInvoiceForSale = async function (sale) {
  if (!sale || !invoiceLineItems.length) return false;
  const customer = String(sale.customer || "").trim().toLowerCase();
  const product = String(sale.product || "").trim().toLowerCase();
  const amt = parseFloat(sale.totalAmount) || draftLineTotal(sale);
  let removeIdx = -1;

  for (let i = 0; i < invoiceLineItems.length; i++) {
    const item = invoiceLineItems[i];
    const itemCust = String(item.customer || "").trim().toLowerCase();
    const itemProd = String(item.product || "").trim().toLowerCase();
    if (itemCust !== customer || itemProd !== product) continue;
    if (Math.abs(draftLineTotal(item) - amt) < 0.02) {
      removeIdx = i;
      break;
    }
  }

  if (removeIdx < 0) return false;
  invoiceLineItems.splice(removeIdx, 1);
  renderInvoice();
  return true;
};

async function executeInvoiceAdd() {
  const customer = document.getElementById("customerName").value.trim();
  const product = document.getElementById("productName").value.trim();
  const hsn = document.getElementById("productHsn")?.value.trim() || "";
  const price = parseFloat(document.getElementById("productPrice").value || "0");
  const qty = parseFloat(document.getElementById("productQty").value || "1");
  const gstRate = isInvoiceGstEnabled()
    ? parseFloat(document.getElementById("productGst")?.value || "0")
    : 0;
  const paymentType = document.getElementById("invoicePaymentType")?.value || "Cash";
  const isCredit = paymentType === "Credit";

  if (!product || Number.isNaN(price) || price <= 0) {
    if (typeof showToast === "function") showToast("Enter item name and price to add.", "error");
    return false;
  }

  const baseTotal = price * qty;
  const gstAmount = (baseTotal * gstRate) / 100;
  const grandTotal = baseTotal + gstAmount;

  const newItem = {
    customer, product, hsn, price, qty, gstRate, paymentType,
    paidAmount: isCredit ? 0 : grandTotal
  };

  if (editingIndex > -1) {
    invoiceLineItems[editingIndex] = newItem;
    editingIndex = -1;
    const addBtn = document.getElementById("addInvoiceBtn");
    if (addBtn) addBtn.textContent = "Add Item (F2)";
  } else {
    invoiceLineItems.push(newItem);
  }

  clearInvoiceEntryFields();
  const statusEl = document.getElementById("invoiceStatus");
  if (statusEl) statusEl.textContent = "";
  renderInvoice();
  return true;
}

let _invoiceSaveInFlight = false;

async function saveInvoiceVoucher() {
  if (_invoiceSaveInFlight) return false;
  const customer = document.getElementById("customerName")?.value.trim();
  if (!customer) {
    if (typeof showToast === "function") showToast("Party / customer name is required before saving.", "error");
    document.getElementById("customerName")?.focus();
    return false;
  }
  if (!invoiceLineItems.length) {
    if (typeof showToast === "function") showToast("Add at least one item with Add Item (F2).", "error");
    return false;
  }

  const saveBtn = document.getElementById("saveInvoiceBtn");
  const statusEl = document.getElementById("invoiceStatus");
  const lockFn = typeof window.bkWithSaveLock === "function" ? window.bkWithSaveLock : null;
  _invoiceSaveInFlight = true;

  const runSave = async () => {
  if (statusEl) {
    statusEl.textContent = "⏳ Saving invoice...";
    statusEl.style.color = "#fbbf24";
  }
  try {
    const paymentType = document.getElementById("invoicePaymentType")?.value || "Cash";
    let prof = {};
    try { prof = JSON.parse(localStorage.getItem("bolkarigar_company_profile") || "{}"); } catch { /* */ }
    let invoiceNo = getInvoiceDraftNumber();
    if (!_invoiceNoUserEdited || !invoiceNo) {
      invoiceNo = await getNextInvoiceNumber(prof.name || prof.companyName || "INV");
    }
    let saved = 0;

    for (const item of invoiceLineItems) {
      const cust = String(item.customer || customer).trim() || customer;
      const payType = item.paymentType || paymentType;
      const saleMeta = await recordPermanentSale({
        customer: cust, product: item.product, hsn: item.hsn,
        price: item.price, qty: item.qty, gstRate: item.gstRate,
        paymentType: payType, invoiceNo
      });
      if (!saleMeta) {
        throw new Error("Server did not confirm save. Check login and connection.");
      }
      await recordKhataSaleFromInvoice({
        customer: cust, product: item.product, hsn: item.hsn,
        price: item.price, qty: item.qty, gstRate: item.gstRate,
        paymentType: payType,
        salesHistoryId: saleMeta?.id,
        invoiceNo: saleMeta?.invoiceNo || invoiceNo,
        silent: true
      });
      saved++;
    }

    invoiceLineItems = [];
    editingIndex = -1;
    renderInvoice();
    clearInvoiceEntryFields();
    ["customerName", "customerGstin", "customerAddress", "invoiceNarration"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    const addBtn = document.getElementById("addInvoiceBtn");
    if (addBtn) addBtn.textContent = "Add Item (F2)";
    if (statusEl) {
      statusEl.textContent = `✅ Invoice saved — ${invoiceNo}`;
      statusEl.style.color = "#22c55e";
    }
    if (typeof showToast === "function") showToast(`✅ Invoice saved — ${invoiceNo}`, "success");
    refreshOverviewSalesFromHistory();
    if (typeof refreshUdharKhata === "function") refreshUdharKhata();
    _invoiceNoUserEdited = false;
    if (typeof refreshInvoiceDraftNumber === "function") refreshInvoiceDraftNumber(true);
    if (typeof updateBusyVoucherMeta === "function") updateBusyVoucherMeta();
    return true;
  } catch (err) {
    console.error("Save invoice error:", err);
    if (statusEl) { statusEl.textContent = "❌ " + err.message; statusEl.style.color = "#ef4444"; }
    if (typeof showToast === "function") showToast("Could not save invoice. Check connection and try again.", "error");
    return false;
  }
  };

  try {
    if (lockFn) {
      return await lockFn(saveBtn, runSave, {
        alsoLock: ["savePrintInvoiceBtn"],
        loadingText: "⏳ Saving...",
        minLockMs: 1000
      });
    }

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.classList.add("bk-save-busy");
      saveBtn.style.cursor = "not-allowed";
    }
    return await runSave();
  } finally {
    _invoiceSaveInFlight = false;
    if (!lockFn && saveBtn) {
      saveBtn.disabled = false;
      saveBtn.classList.remove("bk-save-busy");
      saveBtn.style.cursor = "";
    }
  }
}
window.saveInvoiceVoucher = saveInvoiceVoucher;

// 🟢 Permanent Sales History me record save karta hai (Total Sales panel
// isi se data leta hai — draft invoice table delete hone se yeh kabhi
// affect nahi hota)
async function recordPermanentSale({ customer, product, hsn, price, qty, gstRate, paymentType, invoiceNo: fixedInvoiceNo }) {
  try {
    const baseTotal = price * qty;
    const gstAmount = (baseTotal * gstRate) / 100;
    const totalAmount = baseTotal + gstAmount;
    const isCredit = paymentType === "Credit";
    const invoiceNo = fixedInvoiceNo || ((typeof getNextInvoiceNumber === 'function')
      ? await getNextInvoiceNumber((JSON.parse(localStorage.getItem("bolkarigar_company_profile") || "{}").name) || "INV")
      : ("INV-" + Date.now()));

    const res = await fetch(`${API_URL}/api/sales/record`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({
        invoiceNo, customer, product, hsn, qty, price, gstRate, totalAmount,
        paymentType: paymentType || "Cash",
        status: isCredit ? "Pending" : "Paid",
        voucherDate: document.getElementById("invoiceDateInput")?.value || undefined
      })
    });
    const data = await res.json();
    refreshUdharKhata();
    refreshOverviewSalesFromHistory();
    if (data.success && data.record?._id) {
      return { id: data.record._id, invoiceNo: data.record.invoiceNo || invoiceNo };
    }
  } catch (err) {
    console.error("Sales history record error:", err);
  }
  return null;
}

document.getElementById("addInvoiceBtn")?.addEventListener("click", executeInvoiceAdd);
document.getElementById("saveInvoiceBtn")?.addEventListener("click", saveInvoiceVoucher);

document.getElementById("invoiceGstToggle")?.addEventListener("change", applyInvoiceGstToggleUI);

document.getElementById("productName")?.addEventListener("input", (e) => {
  applyStockItemToInvoiceFields(e.target.value);
  if (typeof updateBusyVoucherMeta === "function") updateBusyVoucherMeta();
});
document.getElementById("productName")?.addEventListener("change", (e) => {
  applyStockItemToInvoiceFields(e.target.value);
});

document.getElementById("customerGstin")?.addEventListener("input", () => {
  syncBuyerStateFromGstin();
  if (typeof renderInvoice === "function") renderInvoice();
});

["productGst", "customerName"].forEach(id => {
  document.getElementById(id)?.addEventListener("input", () => {
    if (typeof updateBusyVoucherMeta === "function") updateBusyVoucherMeta();
    if (id === "productGst") {
      invoiceGstLastRate = parseFloat(document.getElementById("productGst")?.value) || 18;
      renderInvoice();
    }
  });
  document.getElementById(id)?.addEventListener("change", () => {
    if (typeof updateBusyVoucherMeta === "function") updateBusyVoucherMeta();
    if (id === "productGst") renderInvoice();
  });
});

// Window Load setup
window.addEventListener("load", () => {
  recognition = createRecognition();
  loadServerData();

  const urlParams = new URLSearchParams(window.location.search);
  const openPanelId = urlParams.get("openPanel");
  const planFromUrl = urlParams.get("plan");
  const meetJoin = urlParams.get("meetJoin");
  if (meetJoin && urlParams.get("code") && document.getElementById("teamMeetingPanel")) {
    openPanel("teamMeetingPanel");
  } else if (openPanelId && document.getElementById(openPanelId)) {
    openPanel(openPanelId);
    if (openPanelId === "myPlanPanel" && planFromUrl) {
      setTimeout(() => {
        if (typeof window.bkHandlePlanPaymentRequest === "function") {
          window.bkHandlePlanPaymentRequest(planFromUrl);
        }
      }, 1200);
    }
  } else {
    openPanel("overviewPanel");
  }
  
  setupImageScanner();

  const wsBtn = document.getElementById("whatsappShareBtn");
  if (wsBtn) wsBtn.addEventListener("click", triggerWhatsAppShare);

  const dlBtn = document.getElementById("downloadInvoiceBtn");
  if (dlBtn) dlBtn.addEventListener("click", downloadInvoiceBill);

  const tallyBtn = document.getElementById("tallySyncBtn");
  if (tallyBtn) tallyBtn.addEventListener("click", handleTallyVoiceCommand);

  if (typeof loadInvoiceStockItems === "function") loadInvoiceStockItems();
  if (typeof loadInvoiceLedgers === "function") loadInvoiceLedgers();
  if (typeof applyInvoiceGstToggleUI === "function") applyInvoiceGstToggleUI();
  if (typeof setupInvoicePartyAutocomplete === "function") setupInvoicePartyAutocomplete();
  if (typeof setupVoucherPartyAutocompletes === "function") setupVoucherPartyAutocompletes();
  ensureInvoiceDateDefault();
  document.getElementById("invoiceDateInput")?.addEventListener("change", () => {
    if (typeof updateBusyVoucherMeta === "function") updateBusyVoucherMeta();
  });
  document.getElementById("invoiceDateInput")?.addEventListener("input", () => {
    if (typeof updateBusyVoucherMeta === "function") updateBusyVoucherMeta();
  });
  const invNoInp = document.getElementById("invoiceNoDraftInput");
  invNoInp?.addEventListener("input", () => { _invoiceNoUserEdited = true; });
  invNoInp?.addEventListener("change", () => { _invoiceNoUserEdited = true; });
  if (typeof refreshInvoiceDraftNumber === "function") refreshInvoiceDraftNumber(true);
});

// ==========================================================================
// 🟢 REAL OCR (Parchi/Bill Scanner) — pehle yahan hamesha same hardcoded
// fake result dikhta tha, chahe koi bhi image daalo. Ab Tesseract.js
// (free, browser ke andar chalne wali OCR library) se asli text nikalta
// hai, aur usme se amount/vendor jaisi details best-effort dhundta hai.
// ==========================================================================
function extractAmountFromOcrText(text) {
  // ₹ ya Rs ke baad wala sabse bada number dhundo (bill ka total aksar
  // sabse bada amount hota hai)
  const matches = [...text.matchAll(/(?:₹|rs\.?|rupees)\s?([\d,]+(?:\.\d{1,2})?)/gi)];
  if (matches.length) {
    const amounts = matches.map(m => parseFloat(m[1].replace(/,/g, ""))).filter(n => !isNaN(n));
    if (amounts.length) return Math.max(...amounts).toString();
  }
  // Fallback: koi bhi 3+ digit number dhundo
  const genericMatches = [...text.matchAll(/\b(\d{3,6})\b/g)];
  if (genericMatches.length) {
    const nums = genericMatches.map(m => parseFloat(m[1])).filter(n => !isNaN(n));
    if (nums.length) return Math.max(...nums).toString();
  }
  return "";
}

function extractVendorFromOcrText(text) {
  // Pehli non-empty, letters-wali line ko vendor/shop name maano (bills
  // me aksar shop ka naam sabse upar hota hai)
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const nameLine = lines.find(l => /[a-zA-Z]{3,}/.test(l) && l.length < 60);
  return nameLine || "";
}

function setupImageScanner() {
  const imageInput = document.getElementById("imageInput");
  if (!imageInput) return;

  imageInput.addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    const placeholder = document.getElementById("previewPlaceholder");
    const previewImg = document.getElementById("previewImage");

    if (placeholder) {
      placeholder.textContent = "🔍 Scanning receipt (OCR)... this may take a moment.";
      placeholder.style.color = "#3b82f6";
      placeholder.style.display = "block";
    }

    reader.onload = async (e) => {
      if (previewImg) {
        previewImg.src = e.target.result;
        previewImg.style.display = "block";
        previewImg.style.margin = "10px auto";
      }

      if (typeof Tesseract === "undefined") {
        if (placeholder) {
          placeholder.textContent = "⚠️ OCR library failed to load (check internet). Please enter details manually.";
          placeholder.style.color = "#f59e0b";
        }
        return;
      }

      try {
        const result = await Tesseract.recognize(e.target.result, "eng");
        const text = result.data.text || "";
        const amount = extractAmountFromOcrText(text);
        const vendor = extractVendorFromOcrText(text);

        if (placeholder) {
          placeholder.textContent = amount
            ? `✅ Scan complete! Amount found: ₹${amount}${vendor ? " (" + vendor + ")" : ""} — please review and confirm.`
            : "⚠️ Scan completed but amount was unclear — enter manually.";
          placeholder.style.color = amount ? "#4CAF50" : "#f59e0b";
        }

        if (amount) setField(document.getElementById("expenseAmount"), amount);
        if (vendor) {
          setField(document.getElementById("expenseTitle"), vendor + " Bill");
          setField(document.getElementById("expenseVendor"), vendor);
        }

        openPanel("projectPanel");
      } catch (ocrErr) {
        console.error("OCR error:", ocrErr);
        if (placeholder) {
          placeholder.textContent = "⚠️ Scan failed. Please enter details manually.";
          placeholder.style.color = "#ef4444";
        }
      }
    };

    reader.readAsDataURL(file);
  });
}

function logoutUser() {
  // Sabhi Profile aur Dashboard Keys ko Clear Karein
  localStorage.removeItem("bk_token");
  localStorage.removeItem("token");
  localStorage.removeItem("bk_user");
  localStorage.removeItem("business_profile"); // 👈 Agar koi alag key rakhi hai profile ke liye
  localStorage.removeItem("bolkarigar_invoices");
  
  // Best practice: Pure LocalStorage ko clear kar dena agar app saara state isme rakhti hai
  // localStorage.clear(); 

  window.location.replace("loginpage.html");
}
// UI Elements & Controls
const root = document.documentElement;
const themeToggle = document.getElementById("themeToggle");
const voiceToggle = document.getElementById("voiceToggle");
const clock = document.getElementById("clock");
const tabButtons = document.querySelectorAll(".tab-btn");
const panels = document.querySelectorAll(".panel");
const voiceStatus = document.getElementById("voiceStatus");
const voiceTranscript = document.getElementById("voiceTranscript");
const voiceResult = document.getElementById("voiceResult");

const startVoiceBtn = document.getElementById("startVoiceBtn");
const stopVoiceBtn = document.getElementById("stopVoiceBtn");
const sampleInvoiceCmdBtn = document.getElementById("sampleInvoiceCmdBtn");
const sampleProjectCmdBtn = document.getElementById("sampleProjectCmdBtn");
const sampleExpenseCmdBtn = document.getElementById("sampleExpenseCmdBtn");
const fillVoiceToInvoiceBtn = document.getElementById("fillVoiceToInvoiceBtn");
const fillVoiceToProjectBtn = document.getElementById("fillVoiceToProjectBtn");
const fillVoiceToExpenseBtn = document.getElementById("fillVoiceToExpenseBtn");
const clearVoiceBtn = document.getElementById("clearVoiceBtn");

const customerName = document.getElementById("customerName");
const productName = document.getElementById("productName");
const productPrice = document.getElementById("productPrice");
const productQty = document.getElementById("productQty");
const projectName = document.getElementById("projectName");
const projectCustomer = document.getElementById("projectCustomer");
const projectBudget = document.getElementById("projectBudget");
const projectNote = document.getElementById("projectNote");
const expenseTitle = document.getElementById("expenseTitle");
const expenseVendor = document.getElementById("expenseVendor");
const expenseAmount = document.getElementById("expenseAmount");
const expenseProjectLink = document.getElementById("expenseProjectLink");
const todoInput = document.getElementById("todoInput");
const addTodoBtn = document.getElementById("addTodoBtn");

let recognition = null;
let voiceOn = false;
let restartTimer = null;
let lastActivityTime = Date.now();
let watchdogInterval = null;
let isRestarting = false;
let consecutiveFailures = 0;
let interimStableTimer = null;
let lastInterimText = "";
let lastVoiceHandled = { key: "", at: 0 };
let voicePausedForInput = false;
let voiceUtteranceBuffer = "";
let voiceUtteranceFlushTimer = null;
let voiceRecPausedForTts = false;
let voiceProcessingLock = false;
const VOICE_FLUSH_MS = 1600;

window._bkPauseVoiceForTts = function () {
  voiceRecPausedForTts = true;
  clearTimeout(voiceUtteranceFlushTimer);
  voiceUtteranceBuffer = "";
  try { if (recognition) recognition.stop(); } catch { /* */ }
};

window._bkResumeVoiceAfterTts = function () {
  voiceRecPausedForTts = false;
  lastActivityTime = Date.now();
  if (voiceOn && !voicePausedForInput) {
    setTimeout(() => {
      if (voiceOn && !voiceRecPausedForTts && !voiceProcessingLock) restartRecognition(400);
    }, 600);
  }
};

function flushVoiceBuffer() {
  voiceUtteranceFlushTimer = null;
  if (voiceRecPausedForTts || voiceProcessingLock) return;
  const text = voiceUtteranceBuffer.trim();
  voiceUtteranceBuffer = "";
  const hint = document.getElementById("voiceBufferHint");
  if (hint) hint.textContent = "";
  if (text) void handleSpeech(text);
}
const MAX_BACKOFF_MS = 8000;
const FATAL_ERRORS = ["not-allowed", "audio-capture", "service-not-allowed"];

function restartRecognition(customDelay) {
  if (voiceRecPausedForTts || voiceProcessingLock) return;
  if (isRestarting) return;
  isRestarting = true;
  clearTimeout(restartTimer);
  const delay = customDelay !== undefined
    ? customDelay
    : Math.min(300 * Math.pow(2, consecutiveFailures), MAX_BACKOFF_MS);

  restartTimer = setTimeout(() => {
    isRestarting = false;
    if (!voiceOn || voiceRecPausedForTts || voiceProcessingLock) return;
    if (recognition) {
      try {
        recognition.onstart = null;
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.abort();
      } catch {}
    }
    recognition = createRecognition();
    if (recognition) {
      try {
        recognition.start();
        lastActivityTime = Date.now();
      } catch {
        consecutiveFailures++;
        restartRecognition();
      }
    }
  }, delay);
}

function startWatchdog() {
  clearInterval(watchdogInterval);
  watchdogInterval = setInterval(() => {
    if (voiceOn && !isRestarting && !voiceRecPausedForTts && !voiceProcessingLock &&
        Date.now() - lastActivityTime > 8000) {
      setStatus("Restarting microphone...");
      lastActivityTime = Date.now();
      restartRecognition(50);
    }
  }, 4000);
}

function stopWatchdog() {
  clearInterval(watchdogInterval);
}

function updateClock() {
  if (clock) clock.textContent = new Date().toLocaleTimeString();
}
setInterval(updateClock, 1000);
updateClock();

function bkVoiceBtnLabel(on) {
  return typeof bkT === "function" ? bkT(on ? "top.voiceOn" : "top.voiceOff") : (on ? "Voice: ON" : "Voice: OFF");
}

function setTheme(mode) {
  root.setAttribute("data-theme", mode);
  if (themeToggle) {
    themeToggle.textContent = typeof bkT === "function"
      ? bkT(mode === "dark" ? "top.light" : "top.dark")
      : (mode === "dark" ? "Light" : "Dark");
  }
}
setTheme(root.getAttribute("data-theme") || "light");
themeToggle?.addEventListener("click", () => {
  const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  setTheme(next);
});

document.addEventListener("bk:langchange", () => {
  if (typeof renderTodos === "function") renderTodos();
  if (voiceToggle) voiceToggle.textContent = bkVoiceBtnLabel(voiceOn);
  const mode = root.getAttribute("data-theme") || "light";
  setTheme(mode);
  if (voiceOn && typeof restartRecognition === "function") {
    try { recognition?.stop(); } catch { /* */ }
    restartRecognition(350);
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => bkUpdateHeroModuleCount());
} else {
  bkUpdateHeroModuleCount();
}

const BK_NAV_PANEL_GROUP = {
  overviewPanel: "nav-group-main", invoicePanel: "nav-group-main", purchasePanel: "nav-group-main",
  paymentVoucherPanel: "nav-group-main", receiptVoucherPanel: "nav-group-main", khataVoucherPanel: "nav-group-main",
  modifyPanel: "nav-group-accounting", ledgerPanel: "nav-group-accounting", khataLedgersPanel: "nav-group-accounting",
  khataItemsPanel: "nav-group-accounting", khataDaybookPanel: "nav-group-accounting", reportsProPanel: "nav-group-accounting",
  bankReconPanel: "nav-group-accounting",
  inventoryPanel: "nav-group-business", estimatePanel: "nav-group-business", projectPanel: "nav-group-business",
  contractorPanel: "nav-group-business", companiesPanel: "nav-group-business",
  payrollPanel: "nav-group-staff", teamMeetingPanel: "nav-group-staff", staffPanel: "nav-group-staff"
};

function bkExpandNavGroupForPanel(panelId) {
  const groupClass = BK_NAV_PANEL_GROUP[panelId];
  if (!groupClass) return;
  document.querySelectorAll(".nav-accordion.nav-group").forEach((el) => {
    el.open = el.classList.contains(groupClass);
  });
}

function openPanel(id) {
  if (id === "totalSalesPanel") {
    id = "businessRecordsPanel";
    window._bkOverviewPendingTab = { tab: "sales", label: "Total Sales" };
  }
  const me = window._bkAccountInfo;
  if (me && !bkCanAccessTab(me, id)) {
    showToast("This section is not allowed for your role.", "error");
    id = bkStaffFallbackTab(me);
  }
  if (typeof window.BolKarigarPayroll?.closePayrollSlipModal === "function") {
    window.BolKarigarPayroll.closePayrollSlipModal();
  }
  const wasAlreadyActive = document.querySelector(".panel.active")?.id === id;
  panels.forEach(panel => panel.classList.toggle("active", panel.id === id));
  tabButtons.forEach(btn => btn.classList.toggle("active", btn.dataset.tab === id));
  bkExpandNavGroupForPanel(id);
  if (id === "ledgerPanel" && typeof refreshUdharKhata === "function") refreshUdharKhata();
  if (id === "khataVoucherPanel" && typeof window.refreshKhataVoucherPanel === "function") {
    window.refreshKhataVoucherPanel();
  }
  if (id === "bankReconPanel" && typeof window.BolKarigarPro?.loadBankRecon === "function") {
    window.BolKarigarPro.loadBankRecon();
  }
  if (id === "payrollPanel" && typeof window.BolKarigarPayroll?.loadPayrollPanel === "function") {
    window.BolKarigarPayroll.loadPayrollPanel();
  }
  if (id === "estimatePanel" && typeof window.BolKarigarEstimates?.loadEstimatePanel === "function") {
    window.BolKarigarEstimates.loadEstimatePanel();
  }
  if (id === "teamMeetingPanel" && typeof window.BolKarigarMeetings?.loadTeamMeetingPanel === "function") {
    window.BolKarigarMeetings.loadTeamMeetingPanel();
  }
  if (id === "todoPanel" && typeof window.BolKarigarTeamTodos?.loadTeamTodos === "function") {
    window.BolKarigarTeamTodos.loadTeamTodos();
  }
  if (id === "galleryPanel" && typeof window.BolKarigarTeamGallery?.loadTeamGallery === "function") {
    window.BolKarigarTeamGallery.loadTeamGallery();
  }
  if (typeof window.BolKarigarMeetings?.closeMeetingRoom === "function") {
    window.BolKarigarMeetings.closeMeetingRoom();
  }
  if (id === "overviewPanel") {
    if (typeof window.bkOverviewResetView === "function") window.bkOverviewResetView();
    if (typeof window.bkRefreshOverviewTotals === "function") window.bkRefreshOverviewTotals();
    document.querySelector(".panel-area")?.scrollTo({ top: 0, behavior: "auto" });
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  if (id === "businessRecordsPanel") {
    const pending = window._bkOverviewPendingTab;
    if (pending && typeof window.bkOverviewApplyTab === "function") {
      window._bkOverviewPendingTab = null;
      setTimeout(() => window.bkOverviewApplyTab(pending.tab, pending.label), 0);
    } else if (typeof window.bkOverviewRefreshActiveTab === "function") {
      window.bkOverviewRefreshActiveTab();
    }
    document.querySelector(".panel-area")?.scrollTo({ top: 0, behavior: "auto" });
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  if (id === "invoicePanel" && typeof window.refreshInvoicePanel === "function") {
    window.refreshInvoicePanel();
  }
  if (id === "purchasePanel" && typeof window.refreshPurchasePanel === "function") {
    window.refreshPurchasePanel();
  }
  if (id === "paymentVoucherPanel" && typeof window.refreshPaymentVoucherPanel === "function") {
    window.refreshPaymentVoucherPanel();
  }
  if (id === "receiptVoucherPanel" && typeof window.refreshReceiptVoucherPanel === "function") {
    window.refreshReceiptVoucherPanel();
  }
  if (id === "modifyPanel" && typeof window.refreshModifyPanel === "function" && !window._bkModifySkipRefresh) {
    window.refreshModifyPanel();
  }
  closeMobileSidebar();
  if (typeof window.enhanceMobileTables === "function") {
    requestAnimationFrame(() => {
      const panel = document.getElementById(id);
      window.enhanceMobileTables(panel || document);
    });
  }
}
tabButtons.forEach(btn => btn.addEventListener("click", () => {
  if (btn.dataset.tab) openPanel(btn.dataset.tab);
}));

/* Mobile / tablet sidebar drawer */
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const appSidebar = document.getElementById("appSidebar");

function isMobileNav() {
  return window.matchMedia("(max-width: 980px)").matches;
}

function openMobileSidebar() {
  if (!isMobileNav()) return;
  document.body.classList.add("sidebar-open");
  mobileMenuBtn?.setAttribute("aria-expanded", "true");
  sidebarOverlay?.setAttribute("aria-hidden", "false");
  const scroll = appSidebar?.querySelector(".sidebar-nav-scroll");
  if (scroll) scroll.scrollTop = 0;
}

function closeMobileSidebar() {
  document.body.classList.remove("sidebar-open");
  mobileMenuBtn?.setAttribute("aria-expanded", "false");
  sidebarOverlay?.setAttribute("aria-hidden", "true");
}

function toggleMobileSidebar() {
  if (document.body.classList.contains("sidebar-open")) closeMobileSidebar();
  else openMobileSidebar();
}

mobileMenuBtn?.addEventListener("click", toggleMobileSidebar);
document.getElementById("sidebarCloseBtn")?.addEventListener("click", closeMobileSidebar);
sidebarOverlay?.addEventListener("click", closeMobileSidebar);

/* Mobile topbar — overflow menu for profile / AI / theme / logout */
const topbarMoreBtn = document.getElementById("topbarMoreBtn");
const topActionsMenu = document.getElementById("topActionsMenu");

function closeTopbarMoreMenu() {
  document.body.classList.remove("topbar-more-open");
  topbarMoreBtn?.setAttribute("aria-expanded", "false");
}

function toggleTopbarMoreMenu() {
  if (!window.matchMedia("(max-width: 768px)").matches) return;
  const open = !document.body.classList.contains("topbar-more-open");
  document.body.classList.toggle("topbar-more-open", open);
  topbarMoreBtn?.setAttribute("aria-expanded", open ? "true" : "false");
}

topbarMoreBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleTopbarMoreMenu();
});

document.addEventListener("click", (e) => {
  if (!document.body.classList.contains("topbar-more-open")) return;
  if (e.target.closest("#topActionsMenu, #topbarMoreBtn")) return;
  closeTopbarMoreMenu();
});

window.addEventListener("resize", () => {
  if (!window.matchMedia("(max-width: 768px)").matches) closeTopbarMoreMenu();
});

window.addEventListener("resize", () => {
  if (!isMobileNav()) closeMobileSidebar();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (document.body.classList.contains("topbar-more-open")) {
      closeTopbarMoreMenu();
      return;
    }
    const activePanel = document.querySelector(".panel.active")?.id;
    if (activePanel === "invoicePanel" && typeof openPanel === "function") {
      openPanel("overviewPanel");
      return;
    }
    closeMobileSidebar();
  }
  if (e.key === "F2") {
    const activePanel = document.querySelector(".panel.active")?.id;
    if (activePanel === "invoicePanel") {
      e.preventDefault();
      executeInvoiceAdd();
    } else if (activePanel === "purchasePanel" && typeof window.executePurchaseAdd === "function") {
      e.preventDefault();
      window.executePurchaseAdd();
    }
  }
});

document.addEventListener("focusin", (e) => {
  if (e.target && e.target.matches("input, textarea, select, [contenteditable='true']")) {
    voicePausedForInput = true;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }
});
document.addEventListener("focusout", (e) => {
  if (e.target && e.target.matches("input, textarea, select, [contenteditable='true']")) {
    setTimeout(() => {
      const active = document.activeElement;
      if (!active || !active.matches("input, textarea, select, [contenteditable='true']")) {
        voicePausedForInput = false;
      }
    }, 200);
  }
});

function normalize(text) {
  return String(text || "").toLowerCase().replace(/[.,!?]/g, " ").replace(/\s+/g, " ").trim();
}

function showCommand(msg, opts) {
  if (typeof window.bkEnMsg === "function") msg = window.bkEnMsg(msg);
  if (voiceResult) voiceResult.textContent = msg;
  if (voiceStatus) voiceStatus.textContent = msg;
  if (opts?.speak === true && typeof window.bkVoiceSpeak === "function") {
    window.bkVoiceSpeak(msg);
  }
}

function openPanelByVoice(id, msg) {
  openPanel(id);
  showCommand(msg);
}

function setField(el, value) {
  if (!el) return;
  el.value = value || "";
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function parseCommands(raw) {
  const text = normalize(raw);
  if (voiceTranscript) voiceTranscript.value = raw;

  if (isInformationalQuestion(raw)) return false;

  if (text.includes("whatsapp") || text.includes("व्हाट्सएप")) {
    openPanel("invoicePanel");
    triggerWhatsAppShare();
    return true;
  }

  if (
    text.includes("todo") || text.includes("to do") || text.includes("two do") ||
    text.includes("todo list") || text.includes("to do list") || text.includes("task") ||
    text.includes("tasks") || text.includes("my task") || text.includes("my tasks") ||
    text.includes("open todo") || text.includes("open todo list") || text.includes("show todo") ||
    text.includes("show tasks") || text.includes("open task") || text.includes("open task list") ||
    text.includes("टूडू") || text.includes("टू डू") || text.includes("टु डू") ||
    text.includes("टास्क") || text.includes("काम की लिस्ट") || text.includes("काम दिखाओ") ||
    text.includes("काम खोlo") || text.includes("लिस्ट खोलो")
  ) {
    if (looksLikeTodoCommand(text) || window.bkVoiceController?.looksLikeTodoAddUtterance?.(raw)) {
      if (window.bkVoiceController?.tryTodoVoice?.(raw)) return true;
      handleTodoSpeech(raw);
      return true;
    }
    openPanel("todoPanel");
    showCommand("Opening Todo List.");
    return true;
  }

  if (
    text.includes("voice") || text.includes("voice ai") || text.includes("voiceai") ||
    text.includes("open voice") || text.includes("open voice ai") || text.includes("voice panel") ||
    text.includes("speech") || text.includes("mic") || text.includes("microphone") ||
    text.includes("start voice") || text.includes("वॉइस") || text.includes("वॉइस एआई") ||
    text.includes("वॉइस पैनल") || text.includes("माइक") || text.includes("स्पीच")
  ) {
    return openPanelByVoice("voicePanel", "Opening Voice AI panel.");
  }
  
  if (
    text.includes("gallery") || text.includes("galary") || text.includes("gallary") ||
    text.includes("open gallery") || text.includes("show gallery") || text.includes("photo") ||
    text.includes("photos") || text.includes("image") || text.includes("images") ||
    text.includes("picture") || text.includes("pictures") || text.includes("album") ||
    text.includes("open photos") || text.includes("show photos") || text.includes("गैलरी") ||
    text.includes("फोटो") || text.includes("फोटो दिखाओ") || text.includes("इमेज") ||
    text.includes("तस्वीर") || text.includes("तस्वीरें")
  ) {
    openPanel("galleryPanel");
    showCommand("Opening Gallery.");
    return true;
  }
  
  if (
    text.includes("invoice") || text.includes("in voice") || text.includes("bill") ||
    text.includes("billing") || text.includes("receipt") || text.includes("payment bill") ||
    text.includes("customer bill") || text.includes("open invoice") || text.includes("show invoice") ||
    text.includes("invoice open") || text.includes("invoice panel") || text.includes("generate invoice") ||
    text.includes("create invoice") || text.includes("make invoice") || text.includes("इनवॉइस") ||
    text.includes("इनवॉइस खोलो") || text.includes("बिल") || text.includes("बिल खोलो") ||
    text.includes("बिल बनाओ") || text.includes("रसीद") || text.includes("पेमेंट bill")
  ) {
    openPanel("invoicePanel");
    showCommand("Opening Invoice panel.");
    return true;
  }

  if (
    text.includes("total sales") || text.includes("total sale") || text.includes("sales history") ||
    text.includes("sale history") || text.includes("बिक्री") || text.includes("टोटल सेल्स") ||
    text.includes("कुल बिक्री") || text.includes("सेल्स") || text.includes("sales report")
  ) {
    openPanel("totalSalesPanel");
    showCommand("Opening Total Sales.", { speak: true });
    return true;
  }
  
  if (
    text.includes("project") || text.includes("projects") || text.includes("open project") ||
    text.includes("open projects") || text.includes("show project") || text.includes("show projects") ||
    text.includes("project panel") || text.includes("my project") || text.includes("new project") ||
    text.includes("create project") || text.includes("add project") || text.includes("site") ||
    text.includes("work") || text.includes("job") || text.includes("प्रोजेक्ट") ||
    text.includes("प्रोजेक्ट खोलो") || text.includes("काम") || text.includes("काम खोलो") ||
    text.includes("साइट") || text.includes("नया प्रोजेक्ट")
  ) {
    openPanel("projectPanel");
    showCommand("Opening Projects panel.");
    return true;
  }
  
  if (
    text.includes("open qr") || text.includes("open qr tool") || text.includes("qr tool") ||
    text.includes("qr") || text.includes("qr code") || text.includes("generate qr") ||
    text.includes("q r") || text.includes("queue are") || text.includes("क्यू आर") ||
    text.includes("क्यूआर") || text.includes("क्यू आर टूल")
  ) {
    openPanel("qrPanel");
    showCommand("Opening QR Tool.");
    return true;
  }
  
  if (
    text.includes("overview") || text.includes("over view") || text.includes("home") ||
    text.includes("homepage") || text.includes("home page") || text.includes("main") ||
    text.includes("main page") || text.includes("dashboard") || text.includes("dashboard page") ||
    text.includes("go home") || text.includes("back home") || text.includes("open home") ||
    text.includes("open overview") || text.includes("show overview") || text.includes("show dashboard") ||
    text.includes("open dashboard") || text.includes("ओवरव्यू") || text.includes("ओवर व्यू") ||
    text.includes("होम") || text.includes("होम पेज") || text.includes("मुख्य पेज") ||
    text.includes("मुख्य स्क्रीन") || text.includes("डैशबोर्ड") || text.includes("डैश बोर्ड")
  ) {
    openPanel("overviewPanel");
    showCommand("Opening Overview.");
    return true;
  }
  
  if (
    text.includes("note") || text.includes("notes") || text.includes("notepad") ||
    text.includes("memo") || text.includes("my notes") || text.includes("open note") ||
    text.includes("open notes") || text.includes("show note") || text.includes("show notes") ||
    text.includes("notes panel") || text.includes("write note") || text.includes("create note") ||
    text.includes("save note") || text.includes("नोट") || text.includes("नोट्स") ||
    text.includes("नोट खोलो") || text.includes("नोट्स खोलो") || text.includes("नोट दिखाओ") ||
    text.includes("मेमो") || text.includes("लिखो")
  ) {
    openPanel("notesPanel");
    showCommand("Opening Notes panel.");
    return true;
  }
  
  if (
    text.includes("calculator") || text.includes("calculate") || text.includes("calc") ||
    text.includes("calculation") || text.includes("math") || text.includes("maths") ||
    text.includes("open calculator") || text.includes("show calculator") || text.includes("calculator panel") ||
    text.includes("open calc") || text.includes("start calculator") || text.includes("open math") ||
    text.includes("कैलकुलेटर") || text.includes("कैल्कुलेटर") || text.includes("कैलकुलेटर खोलो") ||
    text.includes("कैल्कुलेटर खोलो") || text.includes("गणना") || text.includes("हिसाब") ||
    text.includes("कैलकुलेशन")
  ) {
    openPanel("calcPanel");
    showCommand("Opening Calculator.");
    return true;
  }
  
  if (
    text.includes("media") || text.includes("open media") || text.includes("show media") ||
    text.includes("media panel") || text.includes("media tools") || text.includes("image") ||
    text.includes("images") || text.includes("photo") || text.includes("photos") ||
    text.includes("picture") || text.includes("pictures") || text.includes("preview") ||
    text.includes("image preview") || text.includes("search tool") ||
    text.includes("search panel") || text.includes("upload image") || text.includes("browse image") ||
    text.includes("मीडिया") || text.includes("मीडिया खोलो") || text.includes("फोटो") ||
    text.includes("तस्वीर") || text.includes("इमेज") || text.includes("पिक्चर") ||
    text.includes("प्रिव्यू") || text.includes("मीडिया सर्च")
  ) {
    openPanel("mediaPanel");
    showCommand("Opening Media panel.");
    return true;
  }
  
  if (
    text.includes("dark mode off") || text.includes("light mode") || text.includes("light") ||
    text.includes("लाइट मोड") || text.includes("डार्क मोड ऑफ")
  ) {
    setTheme("light");
    showCommand("Turning on light mode.");
    return true;
  }

  if (
    text.includes("dark mode on") || text.includes("dark mode") || text.includes("dark") ||
    text.includes("डार्क मोड") || text.includes("डार्क")
  ) {
    setTheme("dark");
    showCommand("Turning on dark mode.");
    return true;
  }

  if (
    text.includes("stop listening") || text.includes("stop") || text.includes("स्टॉप लिसनिंग") ||
    text.includes("बंद करो")
  ) {
    stopVoice();
    showCommand("Voice stopped.");
    return true;
  }

  if (
    text.includes("udhar") || text.includes("khata") || text.includes("ledger") ||
    text.includes("उधार") || text.includes("खाता") || text.includes("लेजर")
  ) {
    if (text.includes("pro") || text.includes("प्रो") || text.includes("tally style") || text.includes("ledger master")) {
      openPanel("khataLedgersPanel");
      showCommand("Ledgers opened.");
    } else {
      openPanel("ledgerPanel");
      showCommand("Credit Ledger opened.");
    }
    return true;
  }

  if (
    text.includes("inventory") || text.includes("stock") || text.includes("इन्वेंटरी") ||
    text.includes("स्टॉक") || text.includes("saman")
  ) {
    openPanel("inventoryPanel");
    showCommand("Inventory panel opened.");
    return true;
  }

  if (
    text.includes("total sales") || text.includes("total sale") || text.includes("sales history") ||
    text.includes("sale history") || text.includes("बिक्री") || text.includes("टोटल सेल्स") ||
    text.includes("कुल बिक्री") || text.includes("सेल्स") || text.includes("sales report")
  ) {
    openPanel("totalSalesPanel");
    showCommand("Opening Total Sales.", { speak: true });
    return true;
  }

  if (
    text.includes("help") || text.includes("guide") || text.includes("manual") ||
    text.includes("मदद") || text.includes("गाइड")
  ) {
    openPanel("helpPanel");
    showCommand("Help & Guide opened.");
    return true;
  }

  if (
    text.includes("ledgers") || text.includes("ledger master") || text.includes("खाता प्रो")
  ) {
    openPanel("khataLedgersPanel");
    showCommand("Ledgers opened.");
    return true;
  }

  if (text.includes("day book") || text.includes("डे बुक")) {
    openPanel("khataDaybookPanel");
    showCommand("Day Book opened.");
    return true;
  }

  if (text.includes("modification") || text.includes("modify") || text.includes("edit account") || text.includes("संशोधन") || text.includes("बदलाव")) {
    openPanel("modifyPanel");
    showCommand("Modification Center opened.");
    return true;
  }

  if (text.includes("new voucher") || text.includes("voucher entry")) {
    openPanel("khataVoucherPanel");
    showCommand("New Voucher opened.");
    return true;
  }

  if (text.includes("stock items") || text.includes("stock item")) {
    openPanel("khataItemsPanel");
    showCommand("Stock Items opened.");
    return true;
  }

  if (
    text.includes("accounting mode") || text.includes("tally mode") || text.includes("tally prime mode")
  ) {
    openPanel("invoicePanel");
    const tallyRadio = document.querySelector('input[name="accMode"][value="tally"]');
    const inbuiltRadio = document.querySelector('input[name="accMode"][value="inbuilt"]');
    if (text.includes("inbuilt") || text.includes("bolkarigar") || text.includes("in house")) {
      if (inbuiltRadio) { inbuiltRadio.checked = true; toggleTallyBtn(false); }
      showCommand("BolKarigar Khata (in-house) mode ON.");
    } else if (tallyRadio) {
      tallyRadio.checked = true;
      toggleTallyBtn(true);
      showCommand("Tally Prime mode ON. Sync to Tally is now available.");
    }
    return true;
  }

  if (text.includes("eway bill") || text.includes("e way bill") || text.includes("ई वे बिल") || text.includes("vehicle number") || text.includes("गाड़ी")) {
    openPanel("invoicePanel");
    const ewayMatch = raw.match(/(?:eway bill|eway number|ई वे बिल)\s+([a-zA-Z0-9]+)/i);
    const vehicleMatch = raw.match(/(?:vehicle|gadi number|गाड़ी नंबर)\s+([a-zA-Z0-9]+)/i);
    if (ewayMatch && document.getElementById("ewayBillNo")) setField(document.getElementById("ewayBillNo"), ewayMatch[1].toUpperCase());
    if (vehicleMatch && document.getElementById("vehicleNo")) setField(document.getElementById("vehicleNo"), vehicleMatch[1].toUpperCase());
    showCommand("E-Way Bill details updated.");
    return true;
  }

  if (text.includes("payroll") || text.includes("hajri") || text.includes("salary") || text.includes("वेतन") || text.includes("हाजरी")) {
    return openPanelByVoice("payrollPanel", "Opened Staff Payroll & Attendance.");
  }
  if (text.includes("contractor") || text.includes("mazdoor") || text.includes("ठेकेदार") || text.includes("मजदूर")) {
    return openPanelByVoice("contractorPanel", "Opened Contractor panel.");
  }
  if (text.includes("reports") || text.includes("gstr") || text.includes("रिपोर्ट")) {
    return openPanelByVoice("reportsProPanel", "Reports Pro khol di.");
  }
  if (text.includes("bank recon") || text.includes("bank reconciliation") || text.includes("बैंक मिलान")) {
    return openPanelByVoice("bankReconPanel", "Opening Bank Reconciliation.");
  }
  if (text.includes("staff panel") || text.includes("staff invite") || text.includes("कर्मचारी")) {
    return openPanelByVoice("staffPanel", "Staff panel khol diya.");
  }
  if (text.includes("companies") || text.includes("multi company") || text.includes("कई फर्म")) {
    return openPanelByVoice("companiesPanel", "Companies panel khol diya.");
  }
  if (text.includes("my plan") || text.includes("subscription") || text.includes("प्लान")) {
    return openPanelByVoice("myPlanPanel", "My Plan khol diya.");
  }

  return false;
}
window.parseCommands = parseCommands;

// ===== Voice Helper Extractor Functions =====
function extractField(text, triggerPattern, stopWords) {
  const stopPattern = stopWords.join("|");
  const re = new RegExp(
    "(?:" + triggerPattern + ")\\s+(.*?)(?=\\s*(?:" + stopPattern + ")\\b|$)",
    "i"
  );
  const m = text.match(re);
  return m ? m[1].trim() : "";
}

function extractFieldSmart(text, triggerPattern, stopWords) {
  const forward = extractField(text, triggerPattern, stopWords);
  if (forward) return forward;
  const trimmed = text.trim();
  if (trimmed.split(/\s+/).length > 6) return "";
  const re = new RegExp(
    "^([\\u0900-\\u097Fa-zA-Z]+(?:\\s+[\\u0900-\\u097Fa-zA-Z]+)?)\\s+(?:" + triggerPattern + ")\\b",
    "i"
  );
  const m = trimmed.match(re);
  return m ? m[1].trim() : "";
}

function extractStatusFromText(t) {
  if (/planning|योजना|शुरू नहीं|abhi shuru nahi|not started/.test(t)) return "planning";
  if (/running|chalu|chal raha|in progress|progress|चालू|प्रगति/.test(t)) return "running";
  if (/completed|complete|poora|पूरा|khatam|खत्म|finish|finished/.test(t)) return "completed";
  return "";
}

const PROJECT_STOP_WORDS = [
  "customer", "grahak", "graahak", "ग्राहक", "client", "कस्टमर", "party", "पार्टी",
  "malik", "मालिक", "budget", "बजट", "site", "साइट",
  "location", "जगह", "status", "स्टेटस", "note", "टिप्पणी", "add", "save",
  "जोड़ो", "सेव", "बनाओ", "running", "chalu", "completed", "complete", "poora",
  "planning", "चालू", "पूरा", "योजना", "शुरू", "hai", "hain", "है"
];

function stripSpeechPunctuation(text) {
  return String(text || "").replace(/[.!?।,]/g, " ").replace(/\s+/g, " ").trim();
}

function extractProjectData(rawText) {
  if (window.bkVoiceController?.parseProjectFields) {
    return window.bkVoiceController.parseProjectFields(rawText);
  }
  const t = stripSpeechPunctuation(rawText);
  const budgetMatch = t.match(/(?:budget|बजट|amount)\s+(\d+(?:\.\d+)?)/i);
  const noteMatch = t.match(/(?:note|टिप्पणी|remark)\s+(.+?)$/i);
  return {
    name: extractField(t, "project|प्रोजेक्ट|काम", PROJECT_STOP_WORDS),
    customer: extractFieldSmart(t, "customer|grahak|graahak|ग्राहक|client|कस्टमर|party|पार्टी|malik|मालिक", PROJECT_STOP_WORDS),
    site: extractFieldSmart(t, "site|साइट|location|जगह", PROJECT_STOP_WORDS),
    budget: budgetMatch ? budgetMatch[1].trim() : "",
    note: noteMatch ? noteMatch[1].trim() : "",
    status: extractStatusFromText(t.toLowerCase())
  };
}

function isAddCommand(text) {
  const t = String(text || "").toLowerCase();
  if (/(?:^|\s)(?:add|save|submit|create|confirm|done|jodo|jod do|save karo|add karo|add kero|add kro|add kar do|add karke|add ker do|add kero)(?:\s|$)/i.test(t)) return true;
  if (/ऐड\s*कर|ऐड\s*करो|जोड़ो|जोड़\s*दो|सेव\s*करो|बनाओ|जमा\s*करो|पक्का\s*करो|कर\s*दो|डाल\s*दो|daal\s*do/i.test(t)) return true;
  if (/(?:^|\s)(?:karo|kero|kro|करो|कर\s*दो)(?:\s|$)/i.test(t) && /(?:add|save|jod|ऐड|जोड़|सेव|project|प्रोजेक्ट)/i.test(t)) return true;
  return false;
}

function isStandaloneAddCommand(text) {
  const t = normalize(text);
  if (!isAddCommand(t)) return false;
  return t.split(/\s+/).length <= 6;
}

async function saveActiveProjectFromVoice() {
  const nameEl = document.getElementById("projectName");
  const nameVal = nameEl?.value?.trim();
  if (!nameVal) {
    showCommand("Say the project name or type it in the form first.", { speak: true });
    return false;
  }
  if (!document.getElementById("projectCustomer")?.value?.trim()) {
    setField(document.getElementById("projectCustomer"), "N/A");
  }
  const success = await executeProjectAdd();
  const msg = success
    ? `Project saved: ${nameVal}.`
    : "Could not save project. Check your connection or try again.";
  showCommand(msg, { speak: true });
  return success;
}
window.bkSaveActiveProject = saveActiveProjectFromVoice;

function looksLikeExpenseCommand(text) {
  return /\bvendor\b|वेंडर|\bexpense\b|kharcha|खर्च|खर्चा|quick expense|expense entry|राशि|supplier|दुकान/i.test(text);
}

function looksLikeProjectCommand(text, data) {
  if (looksLikeExpenseCommand(text)) return false;
  if (window.bkVoiceController?.looksLikeInvoiceUtterance?.(text)) return false;
  if (window.bkVoiceController?.isSaleSentence?.(normalize(text))) return false;
  const hasProjectSignal = /(?:project|प्रोजेक्ट|budget|बजट|site|साइट|साइड|side|location|लोकेशन)/i.test(text);
  const hasInvoiceSignal = /\bproduct\b|\bitem\b|प्रोडक्ट|\bquantity\b|\bqty\b|\bprice\b|laptop|mobile|phone|plywood|cement|लैपटॉप|मोबाइल/.test(text);
  return hasProjectSignal && !hasInvoiceSignal && (data.name || data.customer || data.budget || data.site || data.status);
}

async function handleProjectSpeech(raw, preParsed) {
  openPanel("projectPanel");
  let data = preParsed || extractProjectData(raw);
  if ((!data.name && !data.customer && !data.site) && window.bkVoiceController?.parseFormWithAi) {
    const ai = await window.bkVoiceController.parseFormWithAi(raw, "project");
    if (ai) data = { ...data, ...ai };
  }

  const text = normalize(raw);
  const hasNewFieldData = !!(data.name || data.customer || data.site || data.budget || data.note || data.status);
  const wantsAdd = isAddCommand(text) || data.save;

  // Sirf "add karo" — form mat clear karo, seedha save
  if (wantsAdd && !hasNewFieldData && isStandaloneAddCommand(text)) {
    await saveActiveProjectFromVoice();
    return true;
  }

  if (hasNewFieldData) {
    ["projectName", "projectCustomer", "projectSite", "projectNote"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    if (data.name) setField(document.getElementById("projectName"), data.name);
    if (data.customer) setField(document.getElementById("projectCustomer"), data.customer);
    if (data.site) setField(document.getElementById("projectSite"), data.site);
    if (data.budget) setField(document.getElementById("projectBudget"), data.budget);
    if (data.note) setField(document.getElementById("projectNote"), data.note);
    if (data.status) document.getElementById("projectStatus").value = data.status;
  }

  const parts = [];
  if (data.name) parts.push(`naam ${data.name}`);
  if (data.customer) parts.push(`customer ${data.customer}`);
  if (data.site) parts.push(`site ${data.site}`);
  if (data.budget) parts.push(`budget ${data.budget}`);

  if (wantsAdd) {
    const nameVal = document.getElementById("projectName").value.trim();
    if (nameVal) {
      if (!document.getElementById("projectCustomer").value.trim()) {
        setField(document.getElementById("projectCustomer"), "N/A");
      }
      const success = await executeProjectAdd();
      const msg = success
        ? `Project saved. ${data.name || nameVal}, budget ₹${data.budget || document.getElementById("projectBudget")?.value || "0"}.`
        : "Could not save project. Please try again.";
      showCommand(msg, { speak: true });
    } else {
      showCommand("Say the project name, e.g. name Aman.", { speak: true });
    }
  } else if (hasNewFieldData) {
    showCommand(
      `Got it: ${parts.join(", ")}. Say 'add' to save.`,
      { speak: true }
    );
  }
  return true;
}
window.handleProjectSpeech = handleProjectSpeech;

const EXPENSE_STOP_WORDS = ["vendor", "वेंडर", "amount", "budget", "बजट", "project", "प्रोजेक्ट", "add", "save", "जोड़ो", "सेव", "hai", "है"];

function extractExpenseData(rawText) {
  const t = stripSpeechPunctuation(rawText);
  const amountMatch = t.match(/(?:amount|budget|price)\s+(\d+(?:\.\d+)?)/i);
  return {
    title: extractField(t, "expense|title|kharcha|खर्चा|खर्च", EXPENSE_STOP_WORDS),
    vendor: extractFieldSmart(t, "vendor|supplier|dealer|वेंडर", EXPENSE_STOP_WORDS),
    amount: amountMatch ? amountMatch[1].trim() : "",
    project: extractField(t, "project|प्रोजेक्ट", EXPENSE_STOP_WORDS)
  };
}

async function saveActiveExpenseFromVoice() {
  const amountVal = document.getElementById("expenseAmount")?.value?.trim();
  const vendorVal = document.getElementById("expenseVendor")?.value?.trim();
  const titleEl = document.getElementById("expenseTitle");
  if (!titleEl?.value?.trim() && vendorVal) {
    setField(titleEl, vendorVal + " Bill");
  }
  if (!amountVal) {
    showCommand("Say the amount to add an expense.", { speak: true });
    return false;
  }
  const success = await executeExpenseAdd();
  const msg = success
    ? `Expense saved: ${document.getElementById("expenseTitle")?.value || vendorVal || "Expense"}, ₹${amountVal}.`
    : "Could not save expense. Check your connection or try again.";
  showCommand(msg, { speak: true });
  return success;
}
window.bkSaveActiveExpense = saveActiveExpenseFromVoice;

async function handleExpenseSpeech(raw, preParsed) {
  openPanel("projectPanel");
  const text = normalize(raw);
  const data = preParsed || (window.bkVoiceController?.parseExpenseFields?.(raw)) || extractExpenseData(raw);

  if (data.title) setField(document.getElementById("expenseTitle"), data.title);
  if (data.vendor) setField(document.getElementById("expenseVendor"), data.vendor);
  if (data.amount) setField(document.getElementById("expenseAmount"), data.amount);
  if (data.project) setField(document.getElementById("expenseProjectLink"), data.project);

  const summary = `Vendor: ${document.getElementById("expenseVendor").value || "-"} | Amount: ${document.getElementById("expenseAmount").value || "-"} | Project: ${document.getElementById("expenseProjectLink").value || "-"}`;
  const hasNewFieldData = !!(data.title || data.vendor || data.amount || data.project);
  const wantsAdd = isAddCommand(text) || data.save;

  if (wantsAdd && !hasNewFieldData && isStandaloneAddCommand(text)) {
    await saveActiveExpenseFromVoice();
    return true;
  }

  if (wantsAdd) {
    const amountVal = document.getElementById("expenseAmount").value.trim();
    const titleVal = document.getElementById("expenseTitle").value.trim() || data.vendor || "Expense";
    setField(document.getElementById("expenseTitle"), titleVal);
    if (amountVal) {
      const success = await executeExpenseAdd();
      if (success) showCommand("Expense saved. " + summary, { speak: true });
    } else {
      showCommand("Say the amount to add an expense.", { speak: true });
    }
  } else {
    showCommand("Expense form filled: " + summary + ". Say 'add' to save.", { speak: true });
  }
  return true;
}

function fillParsedFields(raw) {
  const text = raw.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  const customerMatch = text.match(/(?:customer|grahak|client|कस्टमर)\s+(.+?)(?=\s(?:product|item|price|amount|budget|project|vendor|qty|quantity|$))/i);
  const productMatch = text.match(/(?:product|item|maal|samaan|प्रोडक्ट)\s+(.+?)(?=\s(?:price|amount|budget|project|vendor|qty|quantity|$))/i);
  const projectMatch = text.match(/(?:project|काम|site|प्रोजेक्ट)\s+(.+?)(?=\s(?:customer|product|price|amount|vendor|qty|quantity|$))/i);
  const vendorMatch = text.match(/(?:vendor|supplier|dealer|वेंडर)\s+(.+?)(?=\s(?:project|price|amount|qty|quantity|$))/i);
  const priceMatch = text.match(/(?:price|amount|budget|प्राइस)\s+(\d+(?:\.\d+)?)/i);
  const qtyMatch = text.match(/(?:qty|quantity|pieces|piece|क्वांटिटी)\s+(\d+(?:\.\d+)?)/i);

  const data = {
    customer: customerMatch ? customerMatch[1].trim() : "",
    product: productMatch ? productMatch[1].trim() : "",
    project: projectMatch ? projectMatch[1].trim() : "",
    vendor: vendorMatch ? vendorMatch[1].trim() : "",
    price: priceMatch ? priceMatch[1].trim() : "",
    qty: qtyMatch ? qtyMatch[1].trim() : ""
  };

  setField(document.getElementById("voiceCustomer"), data.customer);
  setField(document.getElementById("voiceProduct"), data.product);
  setField(document.getElementById("voicePrice"), data.price);
  setField(document.getElementById("voiceQty"), data.qty);
  setField(document.getElementById("voiceProject"), data.project);
  setField(document.getElementById("voiceVendor"), data.vendor);

  if (document.getElementById("voiceResult")) {
    document.getElementById("voiceResult").textContent =
      `Customer: ${data.customer || "-"}\nProduct: ${data.product || "-"}\nPrice: ${data.price || "-"}\nQty: ${data.qty || "-"}\nProject: ${data.project || "-"}\nVendor: ${data.vendor || "-"}`;
  }
}

const onesMap = {
  "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7,
  "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14,
  "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19,
  "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70,
  "eighty": 80, "ninety": 90
};
const scaleMap = { "hundred": 100, "thousand": 1000, "lakh": 100000, "lac": 100000 };

const hindiOnesMap = {
  "शून्य": 0, "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5, "पाँच": 5, "छह": 6, "छे": 6,
  "सात": 7, "आठ": 8, "नौ": 9, "दस": 10,
  "ग्यारह": 11, "बारह": 12, "तेरह": 13, "चौदह": 14, "पंद्रह": 15, "सोलह": 16, "सत्रह": 17,
  "अठारह": 18, "उन्नीस": 19, "बीस": 20,
  "इक्कीस": 21, "बाईस": 22, "तेईस": 23, "चौबीस": 24, "पच्चीस": 25, "छब्बीस": 26, "सत्ताईस": 27,
  "अट्ठाईस": 28, "उनतीस": 29, "तीस": 30,
  "इकतीस": 31, "बत्तीस": 32, "तैंतीस": 33, "चौंतीस": 34, "पैंतीस": 35, "छत्तीस": 36, "सैंतीस": 37,
  "अड़तीस": 38, "उनतालीस": 39, "चालीस": 40,
  "इकतालीस": 41, "बयालीस": 42, "तैंतालीस": 43, "चवालीस": 44, "पैंतालीस": 45, "छियालीस": 46,
  "सैंतालीस": 47, "अड़तालीस": 48, "उनचास": 49, "पचास": 50,
  "इक्यावन": 51, "बावन": 52, "तिरेपन": 53, "चौवन": 54, "पचपन": 55, "छप्पन": 56, "सत्तावन": 57,
  "अट्ठावन": 58, "उनसठ": 59, "साठ": 60,
  "इकसठ": 61, "बासठ": 62, "तिरेसठ": 63, "चौंसठ": 64, "पैंसठ": 65, "छियासठ": 66, "सड़सठ": 67,
  "अड़सठ": 68, "उनहत्तर": 69, "सत्तर": 70,
  "इकहत्तर": 71, "बहत्तर": 72, "तिहत्तर": 73, "चौहत्तर": 74, "पचहत्तर": 75, "छिहत्तर": 76,
  "सतहत्तर": 77, "अठहत्तर": 78, "उनासी": 79, "अस्सी": 80,
  "इक्यासी": 81, "बयासी": 82, "तिरासी": 83, "चौरासी": 84, "पचासी": 85, "छियासी": 86,
  "सत्तासी": 87, "अट्ठासी": 88, "नवासी": 89, "नब्बे": 90,
  "इक्यानवे": 91, "बानवे": 92, "तिरानवे": 93, "चौरानवे": 94, "पचानवे": 95, "छियानवे": 96,
  "सत्तानवे": 97, "अट्ठानवे": 98, "निन्यानवे": 99
};
const hindiScaleMap = { "सौ": 100, "हज़ार": 1000, "हजार": 1000, "लाख": 100000 };

function convertSpokenNumbers(text) {
  const tokens = text.split(" ").filter(Boolean);
  const out = [];
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    if (/^\d+(\.\d+)?$/.test(tok)) { out.push(tok); i++; continue; }

    const isNumberStart = (tok in onesMap) || (tok in hindiOnesMap) || (tok in scaleMap) || (tok in hindiScaleMap);
    if (!isNumberStart) { out.push(tok); i++; continue; }

    let total = 0, current = 0, sawAny = false;
    let decimalDigits = "";
    while (i < tokens.length) {
      const t = tokens[i];
      if (t === "point" || t === "दशमलव") {
        i++;
        while (i < tokens.length && ((tokens[i] in onesMap) || (tokens[i] in hindiOnesMap))) {
          const v = onesMap[tokens[i]] !== undefined ? onesMap[tokens[i]] : hindiOnesMap[tokens[i]];
          decimalDigits += String(v);
          i++; sawAny = true;
        }
        break;
      }
      if (t in scaleMap || t in hindiScaleMap) {
        const scale = t in scaleMap ? scaleMap[t] : hindiScaleMap[t];
        current = (current || 1) * scale;
        if (scale >= 1000) { total += current; current = 0; }
        i++; sawAny = true; continue;
      }
      if (t in onesMap) { current += onesMap[t]; i++; sawAny = true; continue; }
      if (t in hindiOnesMap) { current += hindiOnesMap[t]; i++; sawAny = true; continue; }
      break;
    }
    if (!sawAny) { out.push(tok); i++; continue; }
    let numStr = String(total + current);
    if (decimalDigits) numStr += "." + decimalDigits;
    out.push(numStr);
  }
  return out.join(" ");
}

function wordsToExpression(rawText) {
  let t = " " + rawText.toLowerCase() + " ";
  t = t.replace(/\b(plus|jod do|jodo|jod|jama)\b/g, " + ");
  t = t.replace(/\b(minus|ghatao|ghata do|ghata|subtract)\b/g, " - ");
  t = t.replace(/\b(multiplied by|multiply|multiplied|into|times|guna|gunaa)\b/g, " * ");
  t = t.replace(/\b(divided by|divide|divided|bhag|bhaag)\b/g, " / ");
  t = t.replace(/जोड़ो|जोड़ना|जोड़/g, " + ");
  t = t.replace(/घटाओ|घटाना|घटा/g, " - ");
  t = t.replace(/गुणा करो|गुणा/g, " * ");
  t = t.replace(/भाग करो|भाग do|भाग/g, " / ");
  t = t.replace(/[,]/g, " ");
  t = convertSpokenNumbers(t.replace(/\s+/g, " ").trim());
  return t.replace(/\s+/g, " ").trim();
}

function isEqualCommand(text) {
  return /\b(equal|equals|equal to|barabar|result|answer|jawab|total|calculate)\b|जवाब|बराबर|उत्तर|कैलकुलेट|कुल/.test(text);
}

function isClearCommand(text) {
  return /\b(clear|reset|erase)\b|साफ|क्लियर|मिटाओ/.test(text);
}

function extractCalcExpression(text) {
  const expr = wordsToExpression(normalize(text));
  return expr.replace(/[^0-9+\-*/.]/g, "");
}

function looksLikeCalculation(text, cleanExpr) {
  return /\d[+\-*/]\d/.test(cleanExpr) || (isEqualCommand(text) && /\d/.test(cleanExpr));
}

function handleCalculatorSpeech(raw, precomputedExpr) {
  const text = normalize(raw);
  const display = document.getElementById("calcDisplay");

  if (isClearCommand(text)) {
    if (display) display.value = "";
    showCommand("Calculator cleared.");
    return true;
  }

  const cleanExpr = precomputedExpr !== undefined ? precomputedExpr : extractCalcExpression(text);

  if (cleanExpr && display) {
    display.value = cleanExpr;
  }

  if (isEqualCommand(text)) {
    document.getElementById("calcEquals")?.click();
    showCommand("Calculated: " + (display ? display.value : ""));
    return true;
  }

  if (cleanExpr) {
    showCommand("Entered in calculator: " + cleanExpr + ". Say 'equal' for the result.");
    return true;
  }

  return false;
}

const INVOICE_STOP_WORDS = ["customer", "कस्टमर", "product", "प्रोडक्ट", "price", "प्राइस", "qty", "quantity", "क्वांटिटी", "add", "save", "download", "जोड़ो", "सेव", "डाउनलोड", "hai", "है"];

function extractInvoiceData(rawText) {
  const smart = window.bkVoiceController?.parseSmartInvoice?.(rawText);
  if (smart?.data && (smart.data.customer || smart.data.product || smart.data.price)) {
    const d = { ...smart.data };
    if (d.product && window.bkVoiceController?.cleanProductName) {
      d.product = window.bkVoiceController.cleanProductName(d.product);
    }
    return d;
  }
  const t = stripSpeechPunctuation(rawText);
  const priceMatch =
    t.match(/(?:price|rate|प्राइस)\s+(\d+(?:\.\d+)?)/i) ||
    t.match(/(\d+(?:\.\d+)?)\s*(?:ka|rupaye|rupees|rupya|rs|rs\.)\b/i);
  const qtyMatch =
    t.match(/(?:qty|quantity|quntity|pieces|piece|क्वांटिटी)\s+(\d+(?:\.\d+)?)/i) ||
    t.match(/(\d+(?:\.\d+)?)\s*(?:qty|quantity|quntity|pieces|piece|pcs)\b/i);
  return {
    customer: extractFieldSmart(t, "customer|grahak|grahak name|ग्राहक|कस्टमर", INVOICE_STOP_WORDS),
    product: extractFieldSmart(t, "product|item|maal|samaan|प्रोडक्ट", INVOICE_STOP_WORDS),
    price: priceMatch ? priceMatch[1].trim() : "",
    qty: qtyMatch ? qtyMatch[1].trim() : ""
  };
}

function looksLikeInvoiceCommand(text, data) {
  if (window.bkVoiceController?.looksLikeInvoiceUtterance?.(text)) return true;
  const hasInvoiceSignal = /\bproduct\b|\bitem\b|प्रोडक्ट|\bprice\b|\brate\b|प्राइस|\bqty\b|\bquantity\b|क्वांटिटी|\binvoice\b|इनवॉइस|\bbill\b|बिल|\bcustomer\b|grahak|ग्राहक|कस्टमर|laptop|mobile|phone|लैपटॉप|मोबाइल/.test(text);
  return hasInvoiceSignal && (data.customer || data.product || data.price || data.qty);
}

function isDownloadCommand(text) {
  return /\bdownload\b|डाउनलोड|\bexport\b/.test(text);
}

async function handleInvoiceSpeech(raw) {
  const text = normalize(raw);

  if (text.includes("tally") || text.includes("टैली")) {
    openPanel("invoicePanel");
    await handleTallyVoiceCommand();
    return true;
  }

  if (text.includes("whatsapp") || text.includes("व्हाट्सएप") || text.includes("whatsapp share") || text.includes("send bill")) {
    openPanel("invoicePanel");
    triggerWhatsAppShare();
    return true;
  }

  openPanel("invoicePanel");

  if (window.bkVoiceController?.fillAndAddInvoice) {
    const ok = await window.bkVoiceController.fillAndAddInvoice(raw);
    if (ok) return true;
  }

  const smart = window.bkVoiceController?.parseSmartInvoice?.(raw);
  const data = smart?.data || extractInvoiceData(raw);
  if (data.product && window.bkVoiceController?.cleanProductName) {
    data.product = window.bkVoiceController.cleanProductName(data.product);
  }

  if (data.customer) setField(customerName, data.customer);
  if (data.product) setField(productName, data.product);
  if (data.price) setField(productPrice, data.price);
  if (data.qty) setField(productQty, data.qty);

  if (isDownloadCommand(text)) {
    document.getElementById("downloadInvoiceBtn")?.click();
    return true;
  }

  const summary = `Customer: ${customerName?.value || "-"} | Product: ${productName?.value || "-"} | Price: ${productPrice?.value || "-"} | Qty: ${productQty?.value || "-"}`;
  if (isAddCommand(text)) {
    if (productName?.value.trim() && productPrice?.value) {
      const success = await executeInvoiceAdd();
      if (success) showCommand("Invoice line added. " + summary);
    } else {
      showCommand("Say product name and price to add a line.");
    }
  } else {
    showCommand("Invoice form filled: " + summary + ". Say 'add' to add the line.");
  }
  return true;
}

const TODO_STOP_WORDS = ["add", "save", "जोड़ो", "सेव", "list", "लिस्ट", "में", "mein", "task", "टास्क"];

function looksLikeTodoCommand(text) {
  if (window.bkVoiceController?.looksLikeTodoAddUtterance) {
    return window.bkVoiceController.looksLikeTodoAddUtterance(text);
  }
  return (/\btask\b|टास्क|\btodo\b|टूडू|\bto do\b/.test(text)) && isAddCommand(text);
}

// ... existing bolkarigar.js code above ...

function handleTodoSpeech(raw) {
  if (window.bkVoiceController?.tryTodoVoice?.(raw)) return true;
  const t = stripSpeechPunctuation(raw);
  let value = extractField(t, "task|todo|to do|टास्क|टूडू", TODO_STOP_WORDS);
  if (!value) {
    value = normalize(t).replace(/\btask\b|टास्क|\btodo\b|टूडू|\badd\b|\bsave\b|जोड़ो|सेव|\bkaro\b|करो/g, " ").trim();
  }
  if (!value) {
    showCommand("Say the task name, e.g. task order cement add.");
    return true;
  }

  const todoInputEl = document.getElementById("todoInput");
  if (todoInputEl) {
    openPanel("todoPanel");
    todoInputEl.value = value;
    document.getElementById("addTodoBtn")?.click();
    showCommand(`Task added: "${value}"`);
  }
  return true;
}
function looksLikeQrCommand(text) {
  return /\bqr\b|क्यू आर|क्यूआर/.test(text) && (isAddCommand(text) || /\bgenerate\b|बनाओ/.test(text));
}

function handleQrSpeech(raw) {
  const t = stripSpeechPunctuation(raw);
  let value = extractField(t, "qr code|qr|क्यूआर|क्यू आर", ["banao", "generate", "बनाओ", "code", "add", "जोड़ो"]);
  if (!value) {
    value = normalize(t).replace(/\bqr\b|क्यू आर|क्यूआर|\bcode\b|\bgenerate\b|\badd\b|बनाओ|जोड़ो|\bka\b|\bkaro\b|करो/g, " ").trim();
  }
  if (!value) {
    showCommand("Say the text or link for the QR code.");
    return true;
  }
  setField(document.getElementById("qrInput"), value);
  document.getElementById("generateQrBtn")?.click();
  showCommand("QR code ban gaya: " + value);
  return true;
}

function looksLikeNoteWriteCommand(text) {
  return (/\bnote\b|नोट/.test(text)) && (/\blikho\b|\blikhna\b|\btype\b|लिखो|लिखना/.test(text));
}

const defineNoteSaveCommand = (text) => (/\bnote\b|नोट/.test(text)) && (isDownloadCommand(text) || isAddCommand(text));

function handleNoteSpeech(raw) {
  const t = stripSpeechPunctuation(raw);
  const text = normalize(t);
  const notesInput = document.getElementById("notesInput");

  if (looksLikeNoteWriteCommand(text)) {
    let value = extractField(t, "note likho|likho|note|नोट लिखो|लिखो|नोट", ["save", "download", "सेव", "डाउनलोड"]);
    if (value && notesInput) {
      const existing = notesInput.value.trim();
      setField(notesInput, existing ? existing + ". " + value : value);
      showCommand("Note likh diya: " + value);
    } else {
      showCommand("Say what to write in the note.");
    }
    return true;
  }

  if (defineNoteSaveCommand(text)) {
    document.getElementById("saveNotesBtn")?.click();
    return true;
  }
  return false;
}

const UNIT_WORDS = {
  length: { meter: ["meter", "metre", "मीटर"], kilometer: ["kilometer", "km", "किलोमीटर"], mile: ["mile", "मील"], feet: ["feet", "foot", "फीट"] },
  weight: { kilogram: ["kilogram", "kg", "किलो", "किलोग्राम"], gram: ["gram", "gm", "ग्राम"], pound: ["pound", "पाउंड"] },
  temperature: { celsius: ["celsius", "सेल्सियस"], fahrenheit: ["fahrenheit", "फारेनहाइट"], kelvin: ["kelvin", "केल्विन"] }
};

function findUnit(text) {
  for (const type in UNIT_WORDS) {
    for (const unit in UNIT_WORDS[type]) {
      for (const word of UNIT_WORDS[type][unit]) {
        if (text.includes(word)) return { type, unit, word };
      }
    }
  }
  return null;
}

function looksLikeConverterCommand(text) {
  return /\bconvert\b|कन्वर्ट|रूपांतरण/.test(text) && findUnit(text) !== null;
}

function handleConverterSpeech(raw) {
  const t = stripSpeechPunctuation(raw);
  const text = normalize(t);
  const numExpr = convertSpokenNumbers(text);
  const numMatch = numExpr.match(/\d+(?:\.\d+)?/);
  const value = numMatch ? numMatch[0] : "";

  const found = [];
  for (const type in UNIT_WORDS) {
    for (const unit in UNIT_WORDS[type]) {
      for (const word of UNIT_WORDS[type][unit]) {
        const idx = text.indexOf(word);
        if (idx !== -1) found.push({ type, unit, idx });
      }
    }
  }
  found.sort((a, b) => a.idx - b.idx);
  if (!found.length) {
    showCommand("Say the unit to convert, e.g. meter or kilogram.");
    return true;
  }
  const fromInfo = found[0];
  const toInfo = found.find(f => f.unit !== fromInfo.unit) || found[found.length - 1];

  if (document.getElementById("unitType")) document.getElementById("unitType").value = fromInfo.type;
  populateUnits();
  if (document.getElementById("fromUnit")) document.getElementById("fromUnit").value = fromInfo.unit;
  if (document.getElementById("toUnit")) document.getElementById("toUnit").value = toInfo.unit;
  if (value && document.getElementById("unitInput")) document.getElementById("unitInput").value = value;

  document.getElementById("convertBtn")?.click();
  showCommand("Converted: " + (document.getElementById("convertResult")?.textContent || ""));
  return true;
}

function looksLikeGalleryNavCommand(text) {
  return /\bnext\b|अगला|\bprevious\b|\bprev\b|पिछला|\bfirst\b|पहला/.test(text) &&
         (/\bphoto\b|फोटो|\bimage\b|इमेज|\bpicture\b/.test(text) || document.getElementById("galleryPanel")?.classList.contains("active"));
}

function handleGallerySpeech(raw) {
  const text = normalize(raw);
  const thumbs = Array.from(document.querySelectorAll(".gallery-thumb-card, .thumb"));
  if (!thumbs.length) return false;
  let idx = thumbs.findIndex(t => t.classList.contains("active-thumb"));
  if (idx === -1) idx = 0;

  if (/\bnext\b|अगला/.test(text)) idx = (idx + 1) % thumbs.length;
  else if (/\bprevious\b|\bprev\b|पिछला/.test(text)) idx = (idx - 1 + thumbs.length) % thumbs.length;
  else if (/\bfirst\b|पहला/.test(text)) idx = 0;

  thumbs[idx].click();
  showCommand("Showing photo " + (idx + 1) + ".");
  return true;
}

function looksLikeSearchCommand(text) {
  if (window.bkVoiceController?.looksLikeSearchUtterance?.(text)) return true;
  if (window.bkVoiceController?.looksLikeInvoiceUtterance?.(text)) return false;
  return /(?:search|सर्च|खोज|खोजो|ढूंढ|ढूंड|find|filter)/i.test(text);
}

function cleanSearchTerm(val) {
  return String(val || "")
    .replace(/\b(ko|ka|ke|ki|me|m|for|se|hai|hain|karo|kero|kar|kro|kijiye|करो|कर|कीजिए|do|de|दो|bolo|wala|wali|name|naam|नाम|invoice|bill|customer|grahak|ग्राहक|product|item)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Voice meta — search query se hatao (english mein karo, etc.) */
function stripSearchMeta(text) {
  return String(text || "")
    .replace(/(?:english|hindi|inglish|angrezi|angrez|in\s*english|in\s*hindi|इंग्लिश|हिंदी|अंग्रेजी|angreji)/gi, " ")
    .replace(/(?:search|सर्च|खोज|खोजो|ढूंढ|ढूंड|find|filter|निकाल|karo|kero|kar|kro|kijiye|करो|कर|करके|karke|कीजिए|likho|लिखो|kera|kera|bola|bolo|open|kholo)/gi, " ")
    .replace(/(?:naam|name|नाम|ko|ke|ka|ki|me|mein|main|men|में|for|se|bolo|please|wala|wali)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const DEVANAGARI_ROMAN = {
  "अ": "a", "आ": "aa", "इ": "i", "ई": "ee", "उ": "u", "ऊ": "oo", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au",
  "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "ng", "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "ny",
  "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n", "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
  "प": "p", "फ": "ph", "फ़": "f", "ब": "b", "भ": "bh", "म": "m", "य": "y", "र": "r", "ल": "l", "व": "v",
  "श": "sh", "ष": "sh", "स": "s", "ह": "h", "क्ष": "ksh", "त्र": "tr", "ज्ञ": "gy",
  "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
  "ं": "n", "ँ": "n", "ः": "h", "्": "", "़": ""
};

const SEARCH_NAME_ALIASES = {
  lakshmi: "laxmi", laksmi: "laxmi", laxmi: "laxmi", lakshamee: "laxmi", lkshmi: "laxmi",
  vikrant: "vikrant", vikram: "vikram", ramesh: "ramesh", suresh: "suresh",
  lucky: "lucky", lakhi: "lucky"
};

function transliterateDevanagari(text) {
  let out = "";
  const src = String(text || "");
  for (let i = 0; i < src.length;) {
    const two = src.slice(i, i + 2);
    if (DEVANAGARI_ROMAN[two]) { out += DEVANAGARI_ROMAN[two]; i += 2; continue; }
    const one = src[i];
    if (!one) { i += 1; continue; }
    if (DEVANAGARI_ROMAN[one]) { out += DEVANAGARI_ROMAN[one]; i += 1; continue; }
    if (/[A-Za-z0-9]/.test(one)) { out += one; i += 1; continue; }
    if (/\s/.test(one)) { i += 1; continue; }
    i += 1;
  }
  return out.replace(/(.)\1+/g, "$1").trim();
}

function applySearchAliases(term) {
  const key = String(term || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (SEARCH_NAME_ALIASES[key]) return SEARCH_NAME_ALIASES[key];
  if (/kshmi|laksh/.test(key)) return "laxmi";
  return key || String(term || "").toLowerCase();
}

/** Hindi/English voice se DB-friendly English search term */
function normalizeSearchKeyword(raw) {
  let s = stripSearchMeta(cleanSearchTerm(raw));
  if (/[\u0900-\u097F]/.test(s)) s = transliterateDevanagari(s);
  if (!s) {
    const devWords = String(raw || "").match(/[\u0900-\u097F]{2,}/gu);
    if (devWords?.length) s = transliterateDevanagari(devWords[devWords.length - 1]);
  }
  if (!s) {
    const latin = String(raw || "").match(/[A-Za-z][A-Za-z0-9]{1,}/g);
    if (latin?.length) s = latin.find((w) => !/^(english|hindi|search|name|naam|kero|keri|kari|karen)$/i.test(w)) || latin[0];
  }
  s = applySearchAliases(s);
  return String(s || "").replace(/\s+/g, " ").trim();
}

function stripNavFromSearchText(text) {
  return String(text || "")
    .replace(/(?:total\s*sales?|टोटल\s*सेल्स?|कुल\s*बिक्री|sales?\s+history|बिक्री\s*रिपोर्ट|बिक्री)/gi, " ")
    .replace(/(?:inventory|इन्वेंटरी|स्टॉक|stock)/gi, " ")
    .replace(/(?:par|per)\s*(?:ja|jao|जा|जाओ)/gi, " ")
    .replace(/(?:ja\s*kar|ja\s*ker|जा\s*कर|chale?\s*jao|chalo|चलो|ले\s*जाओ)/gi, " ")
    .replace(/(?:kholo|khol|open|show|dikhao|jao|खोलो|खोल|दिखाओ)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Voice se naam nikaalo — regex fail hone par fallback */
function extractVoiceSearchTerm(raw) {
  let s = stripNavFromSearchText(
    (window.bkVoiceController?.cleanUtterance || stripSpeechPunctuation)(raw)
  );
  const parts = s.split(/\s+/).filter(Boolean);
  const stop = new Set([
    "search", "सर्च", "खोज", "खोजो", "find", "filter", "ढूंढ", "ढूंड", "निकाल",
    "karo", "kero", "keri", "kari", "karen", "kar", "kro", "kijiye", "करो", "कर", "कीजिए",
    "naam", "name", "नाम", "ko", "ka", "ke", "ki", "me", "mein", "main", "for", "se",
    "do", "de", "दो", "please", "bolo", "bola", "likho", "english", "hindi", "inglish"
  ]);
  const kept = parts.filter((w) => !stop.has(normalize(w)));
  if (kept.length) return normalizeSearchKeyword(kept.join(" "));
  return normalizeSearchKeyword(s);
}

function isValidSearchQuery(q) {
  if (!q || q.length < 2) return false;
  return !/^(kero|keri|kari|karo|kar|kro|search|naam|name|na|o|ko|ka|ke|ki)$/i.test(q);
}

function parseSearchQuery(raw) {
  const cleaned = (window.bkVoiceController?.cleanUtterance || stripSpeechPunctuation)(raw);
  const t = stripNavFromSearchText(cleaned);
  const n = normalize(t);

  if (/(?:search\s*clear|clear\s*search|सर्च\s*हटा|खोज\s*हटा|खोज\s*साफ|सब\s*दिखा)/i.test(n)) {
    return { query: "", clear: true };
  }

  const hasSearchIntent =
    /(?:search|सर्च|खोज|खोजो|ढूंढ|ढूंड|find|filter|निकाल)/i.test(n) ||
    (/(?:naam|name|नाम)/i.test(n) && /(?:search|सर्च|खोज|karo|kero|keri|kari|करो)/i.test(n)) ||
    (/^[\u0900-\u097F]{2,}\s*(?:khojo|खोजो|dikhao|दिखाओ)/i.test(n));

  if (!hasSearchIntent) return null;

  const q = extractVoiceSearchTerm(raw);
  if (isValidSearchQuery(q)) return { query: q, clear: false };

  return null;
}
window.bkParseSearchQuery = parseSearchQuery;

function getActiveSearchInput(preferPanelId) {
  const panelId = preferPanelId || document.querySelector(".panel.active")?.id;
  const byPanel = {
    overviewPanel: "salesSearchInput",
    businessRecordsPanel: "salesSearchInput",
    totalSalesPanel: "salesSearchInput",
    inventoryPanel: "invSearch",
    mediaPanel: "searchInput"
  };
  if (panelId && byPanel[panelId]) {
    const el = document.getElementById(byPanel[panelId]);
    if (el) return el;
  }
  const active = document.querySelector(".panel.active");
  if (active) {
    const inPanel = active.querySelector(
      'input[type="search"], input.panel-search-input, input[id*="Search" i], input[placeholder*="search" i], input[placeholder*="Search" i], input[placeholder*="Naam" i], input[placeholder*="खोज" i]'
    );
    if (inPanel) return inPanel;
  }
  const stateBox = document.getElementById("stateSearchInput");
  if (stateBox && stateBox.offsetParent !== null) return stateBox;
  if (preferPanelId === "totalSalesPanel") return document.getElementById("salesSearchInput");
  if (preferPanelId === "inventoryPanel") return document.getElementById("invSearch");
  if (preferPanelId === "mediaPanel") return document.getElementById("searchInput");
  return null;
}
window.bkGetActiveSearchInput = getActiveSearchInput;

async function applyVoiceSearch(query, opts) {
  const clear = opts?.clear === true || query === "";
  const forcePanel = opts?.panelId;
  const activeId = document.querySelector(".panel.active")?.id;
  const targetPanel = forcePanel || activeId;
  const value = clear ? "" : String(query || "").trim();

  if (targetPanel === "totalSalesPanel" || targetPanel === "businessRecordsPanel" || activeId === "totalSalesPanel" || activeId === "businessRecordsPanel" || forcePanel === "totalSalesPanel" || forcePanel === "businessRecordsPanel") {
    if (activeId !== "businessRecordsPanel" && activeId !== "totalSalesPanel" && typeof openPanel === "function") {
      openPanel("totalSalesPanel");
    } else if (activeId === "overviewPanel" && typeof window.bkOverviewSwitchTab === "function") {
      window.bkOverviewSwitchTab("sales");
    }
    if (typeof window._bkPauseVoiceForTts === "function") window._bkPauseVoiceForTts();
    const inp = document.getElementById("salesSearchInput");
    if (inp) inp.value = value;
    if (typeof window.bkSetSalesSearch === "function") {
      window.bkSetSalesSearch(value);
      showCommand(clear ? "Total Sales search clear." : `Search: ${value}`, { speak: false });
      setTimeout(() => {
        if (typeof window._bkResumeVoiceAfterTts === "function") window._bkResumeVoiceAfterTts();
      }, 1200);
      return true;
    }
  }

  if (forcePanel && forcePanel !== activeId && typeof openPanel === "function") {
    openPanel(forcePanel);
  }
  const input = getActiveSearchInput(forcePanel || activeId);
  if (!input) {
    showCommand("Search box not found. Open Total Sales, Inventory, or Media first.", { speak: true });
    return false;
  }

  setField(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));

  if (input.id === "searchInput") {
    const term = value.toLowerCase();
    document.querySelectorAll("#searchList li").forEach((item) => {
      item.style.display = !term || item.textContent.toLowerCase().includes(term) ? "block" : "none";
    });
  }
  if (input.id === "stateSearchInput" && typeof filterStates === "function") {
    filterStates();
  }

  const label = input.id === "salesSearchInput" ? "Total Sales"
    : input.id === "invSearch" ? "Inventory"
    : input.id === "searchInput" ? "Media"
    : "Search";
  showCommand(clear ? `${label} search clear kar diya.` : `${label} me search: ${value}`, { speak: true });
  return true;
}
window.bkVoiceSearch = applyVoiceSearch;

async function handleSearchSpeech(raw) {
  const parsed = parseSearchQuery(raw);
  if (!parsed) {
    showCommand("What should I search? e.g. search Laxmi, or search name Vikrant.", { speak: true });
    return true;
  }
  const panelId = /total\s*sale|टोटल|बिक्री|sales\s+history/i.test(normalize(raw))
    ? "totalSalesPanel" : undefined;
  await applyVoiceSearch(parsed.clear ? "" : parsed.query, { clear: parsed.clear, panelId });
  return true;
}

function clearActivePanelForm() {
  const activePanel = document.querySelector(".panel.active");
  if (!activePanel) return;
  const activeId = activePanel.id;

  if (activeId === "calcPanel") {
    if (document.getElementById("calcDisplay")) document.getElementById("calcDisplay").value = "";
    showCommand("Calculator cleared.");
    return;
  }
  if (activeId === "projectPanel") {
    ["projectName", "projectCustomer", "projectSite", "projectBudget", "projectNote"].forEach(id => setField(document.getElementById(id), ""));
    if (document.getElementById("projectStatus")) document.getElementById("projectStatus").value = "planning";
    ["expenseTitle", "expenseVendor", "expenseAmount", "expenseProjectLink"].forEach(id => setField(document.getElementById(id), ""));
    showCommand("Project and expense forms cleared.");
    return;
  }
  if (activeId === "invoicePanel") {
    ["customerName", "productName", "productPrice", "productQty"].forEach(id => setField(document.getElementById(id), ""));
    showCommand("Invoice form cleared.");
    return;
  }
  if (activeId === "notesPanel") {
    setField(document.getElementById("notesInput"), "");
    showCommand("Notes cleared.");
    return;
  }
  if (activeId === "qrPanel") {
    setField(document.getElementById("qrInput"), "");
    if (document.getElementById("qrCodeBox")) document.getElementById("qrCodeBox").innerHTML = "";
    showCommand("QR field cleared.");
    return;
  }
  if (activeId === "todoPanel") {
    setField(document.getElementById("todoInput"), "");
    showCommand("Todo input cleared.");
    return;
  }
  if (activeId === "voicePanel") {
    clearVoiceBtn?.click();
    return;
  }
  if (activeId === "converterPanel") {
    setField(document.getElementById("unitInput"), "");
    if (document.getElementById("convertResult")) document.getElementById("convertResult").textContent = "Converted value will appear here.";
    showCommand("Converter cleared.");
    return;
  }
  if (activeId === "totalSalesPanel" || activeId === "overviewPanel") {
    if (typeof window.bkSetSalesSearch === "function") {
      window.bkSetSalesSearch("");
    }
    return;
  }
  if (activeId === "inventoryPanel") {
    applyVoiceSearch("", { clear: true });
    return;
  }
  if (activeId === "mediaPanel") {
    setField(document.getElementById("searchInput"), "");
    document.querySelectorAll("#searchList li").forEach(item => item.style.display = "block");
    showCommand("Media search cleared.");
    return;
  }
  showCommand("Nothing to clear on this panel.");
}

// Text-to-speech — saaf Hindi jawab (voice ON par)
let _lastSpeakText = "";
let _lastSpeakAt = 0;
function speakText(text, forceShort, onDone) {
  try {
    if (!("speechSynthesis" in window) || !text) { onDone?.(); return; }
    let msg = String(text).trim()
      .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, "")
      .replace(/[✅❌📄🧾💼📅🤖🔊⚠️💡📲🖨️]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!msg) { onDone?.(); return; }
    if (msg.length > 200 && !forceShort) msg = msg.slice(0, 197).trim() + "...";
    const now = Date.now();
    if (msg === _lastSpeakText && now - _lastSpeakAt < 8000) { onDone?.(); return; }
    _lastSpeakText = msg;
    _lastSpeakAt = now;
    if (typeof window._bkPauseVoiceForTts === "function") window._bkPauseVoiceForTts();
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(msg);
    utter.lang = localStorage.getItem("bk_voice_lang") || "en-IN";
    utter.rate = 1.02;
    const finish = () => {
      if (typeof window._bkResumeVoiceAfterTts === "function") window._bkResumeVoiceAfterTts();
      onDone?.();
    };
    utter.onend = finish;
    utter.onerror = finish;
    const voices = window.speechSynthesis.getVoices();
    const enVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith("en"));
    if (enVoice) utter.voice = enVoice;
    window.speechSynthesis.speak(utter);
  } catch (e) {
    onDone?.();
  }
}
window.speakText = speakText;

// -------------------------------------------------------------------
// Offline FAQ Knowledge Base — app ke bare me common sawalon ke jawab.
// Koi internet/API ki zaroorat nahi, isliye 100% reliable hai.
// Naya sawal-jawab add karna ho to bas ek naya
// { keywords: [...], answer: "..." } object list me daal do.
// -------------------------------------------------------------------
const APP_FEATURES_OVERVIEW =
  'BolKarigar includes: Overview (sales/expense/profit), Voice AI, Invoice/GST bill, WhatsApp share, Tally sync, Projects, Expenses, Inventory, Credit Ledger, Ledgers, Stock Items, Voucher, Day Book, Total Sales, Gallery, Todo, QR Tool, Calculator, Notes, Media, and Help & Guide. Ask for details on any feature.';

const TODO_MODULE_ANSWER =
  'In Todo: (1) Add a task — type in the Todo tab and click Add, or say e.g. "todo order cement add", (2) Delete a task — Delete on the row, (3) Clear all — Clear All, (4) Open Todo from the sidebar to view tasks. Tasks are saved and persist after refresh.';

const ACCOUNTING_MODULE_ANSWER =
  'Accounting includes: (1) Ledgers — add party ledgers (Sundry Debtor/Creditor, GSTIN, opening balance), (2) Stock Items — manage items, rates and stock, (3) New Voucher — Sales, Purchase, Receipt, Payment, Journal, (4) Day Book — view daily entries. Sales can post to ledgers automatically and sync to Tally Prime.';

function isInformationalQuestion(text) {
  const norm = normalizeFaqText(text);
  if (!norm) return false;
  if (window.bkVoiceController?.isSaleSentence?.(norm)) return false;
  if (/\b(liya|liye|kharida|khareeda|bill banao|add karo|add kar|save karo|invoice kholo|kholo|jodo)\b/.test(norm)) return false;
  if (norm.includes('?')) return true;

  const questionMarkers = [
    /\bkya\b/, /\bkaise\b/, /\bkese\b/, /\bkesi\b/, /\bkesey\b/, /\bkesa\b/,
    /\bwhat\b/, /\bhow\b/, /\bwhy\b/, /\bwhen\b/, /\bwhere\b/,
    /\bbatao\b/, /\bbatado\b/, /\bbataiye\b/, /\bbata\b/, /\bexplain\b/,
    /\bkar sakte\b/, /\bker skte\b/, /\bkar skte\b/, /\bker sakte\b/,
    /\bkar sakta\b/, /\bker sakta\b/, /\bkier skte\b/, /\bkier sakte\b/,
    /\bkam kese\b/, /\bkaam kaise\b/, /\bkya kya\b/, /\bkonsa\b/, /\bkaun sa\b/,
    /\bmatlab\b/, /\bsamjha\b/, /\bsmjha\b/, /\bsamjhao\b/, /\bsikte\b/, /\bsakte\b/,
    /\bjankari\b/, /\bjaankari\b/, /\bdetail\b/
  ];
  if (questionMarkers.some(p => p.test(norm))) return true;

  if (/\b(keregi|karega|karenge|karta|karti|karte|hoti|hota|hote|hai|hain|ho)\b/.test(norm) &&
      /\b(kya|kaise|kese|konsa|kitna|kitne)\b/.test(norm)) {
    return true;
  }
  return false;
}

function matchModuleFaq(rawText) {
  if (!isInformationalQuestion(rawText)) return null;
  const norm = normalizeFaqText(rawText);
  if (/\bledger\b|खाता|voucher\b|वाउचर|day book|stock item|accounting\b/.test(norm)) return ACCOUNTING_MODULE_ANSWER;
  if (/\btodo\b|टूडू|\btask\b|टास्क/.test(norm)) return TODO_MODULE_ANSWER;
  return null;
}

const APP_FAQ = [
  { keywords: ["tum kaun", "who are you", "aap kaun", "tumhara naam", "your name", "kya ho tum", "what are you"],
    answer: "I am BolKarigar AI — your in-app assistant. I can answer questions and help with tasks like adding todos or creating invoices." },
  { keywords: ["kya kya kar sakte", "kya kar sakte ho", "features", "help", "madad", "kya kaam", "kya kaam kar sakte", "kya kaam kar sakti", "what can you do", "poori list", "kya kya kaam", "ker skte", "kya kya ker", "kar skte", "kya kya kr skte", "ho skta", "ho sakta", "ho skte", "iss app", "is app", "app m kya", "app me kya", "kitne model", "kitne module"],
    answer: APP_FEATURES_OVERVIEW },
  { keywords: ["free hai", "paisa lagega", "cost kitni", "kitna paisa", "paid hai kya", "is this free", "billing lagegi"],
    answer: "The assistant runs in your browser. Plan pricing is shown under My Plan after your free trial." },
  { keywords: ["namaste", "hello", "hi", "hey", "kaise ho", "kese ho", "kaisa hai", "kya haal", "good morning", "good evening"],
    answer: "Hello! How can I help? Ask about the app or tell me what to do." },
  { keywords: ["thanks", "thank you", "shukriya", "dhanyawad"],
    answer: "You're welcome! Let me know if you need anything else." },
  { keywords: ["bolkarigar kya hai", "yeh app kya hai", "app kis liye", "what is this app", "app ke bare me batao", "kya hai iss app", "kya hai is app", "app m kya", "app me kya", "kya kya hai iss app", "kya kya hai is app"],
    answer: "BolKarigar is a voice-friendly business app for shops and contractors — invoices, projects, expenses, credit ledger, inventory, and more by voice or keyboard." },
  { keywords: ["logout kaise", "log out kaise", "sign out"],
    answer: "Click Logout in the top-right header to return to the login page." },
  { keywords: ["password bhool", "forgot password", "password reset"],
    answer: "On the login page, use Forgot Password to reset your password." },
  { keywords: ["voice kaise", "voice kaam", "how does voice", "voice on kaise", "voice off kaise"],
    answer: "Click Voice: OFF in the header to turn continuous voice mode on, then say commands like open gallery or open invoice." },
  { keywords: ["dark mode", "light mode", "theme kaise"],
    answer: "Use the Light/Dark button in the header, or say dark mode on or dark mode off." },
  { keywords: ["todo kaise", "task kaise", "how to todo", "todo add kaise", "todo m kya", "todo me kya", "todo kya kya", "todo kam kese", "todo kese", "task kese"],
    answer: TODO_MODULE_ANSWER },
  { keywords: ["project kaise", "how to project", "project add kaise", "naya project"],
    answer: "In Projects, fill Project Name, Customer, Budget and Note, then Add Project — or say e.g. project Mandir work customer Aslam budget 50000." },
  { keywords: ["expense kaise", "kharcha kaise", "how to expense"],
    answer: "In Projects → Quick Expense Entry, enter Title, Vendor and Amount — or say e.g. vendor Sharma Timber amount 4200." },
  { keywords: ["invoice kaise", "bill kaise", "invoice banaye", "invoice banao kaise", "how to invoice", "bill banaye", "invoice bnaye", "invoice kese"],
    answer: "Open Invoice, enter Customer, Product, Price and Quantity, then Add Item — or say e.g. customer Ramesh product plywood price 2500 quantity 2." },
  { keywords: ["gst", "gst kya", "gst rate", "what is gst"],
    answer: "Select a GST rate (5%, 12%, 18%, etc.) on the invoice — tax and total are calculated automatically." },
  { keywords: ["invoice download", "bill download", "invoice pdf"],
    answer: "Use Download above the invoice table to print or save as PDF." },
  { keywords: ["whatsapp share", "whatsapp pe bhejo", "whatsapp invoice"],
    answer: "Click WhatsApp Share to send the invoice to your customer." },
  { keywords: ["eway bill", "e way bill", "vehicle number", "transport details"],
    answer: "Optional E-Way Bill & Transport Details on the invoice — E-Way number, vehicle and distance." },
  { keywords: ["accounting mode", "tally prime kya", "bolkarigar khata kya"],
    answer: "Choose Accounting Mode on the invoice — BolKarigar Khata (in-house) or Tally Prime (sync with Tally)." },
  { keywords: ["business profile", "company profile", "profile save", "firm ka naam", "gstin kaise dalu"],
    answer: "In Business Profile, enter Company Name, GSTIN, Phone and Address, then Save — this unlocks the invoice generator." },
  { keywords: ["udhar khata", "udhar kaise", "khata kya", "credit customer"],
    answer: "Credit Ledger tracks customer credit — who owes how much." },
  { keywords: ["inventory kya", "stock kaise"],
    answer: "Inventory is a smart stock tracker — HSN, GST%, rates, godown, batch, low-stock alerts; sales reduce stock automatically." },
  { keywords: ["gallery kya", "gallery kaise"],
    answer: "Gallery stores and displays your work photos." },
  { keywords: ["qr", "qr code", "qr tool"],
    answer: "QR Tool builds a QR code from text or a link." },
  { keywords: ["calculator", "calculate kaise"],
    answer: "Use the Calculator tab, or say e.g. 25 plus 30." },
  { keywords: ["notes kaise", "note kaise"],
    answer: "Write notes in the Notes tab and download them if needed." },
  { keywords: ["tally", "tally sync", "tally prime"],
    answer: "Download Tally Sync Agent from the sidebar, run it on your PC, select Tally Prime mode on the invoice, then sync." },
  { keywords: ["profit loss", "financial summary", "report kaise", "kamai dikaho"],
    answer: "Overview shows total sales, expenses and profit in the dashboard cards." },
  { keywords: ["ledger m kya", "ledger me kya", "accounting m kya", "accounting me kya", "voucher kaise", "day book kya", "khata pro m kya", "khata pro me kya"],
    answer: ACCOUNTING_MODULE_ANSWER },
  { keywords: ["help panel", "guide kaha", "manual kaha"],
    answer: "Open ❓ Help & Guide in the sidebar for module-by-module instructions." },
  { keywords: ["bye", "alvida", "phir milenge", "chalta hoon", "goodbye"],
    answer: "Goodbye! Tap the AI button whenever you need help — I am here." }
];

function looksLikeKhataCommand(text) {
  return /\bledger\b|खाता|party\b|voucher\b|वाउचर|receipt\b|payment\b|रसीद|भुगतान|day book|डे बुक/.test(text);
}

function looksLikeInventoryCommand(text) {
  return /\binventory\b|stock\b|स्टॉक|इन्वेंटरी|saman\b|सामान/.test(text) && !text.includes("open");
}

function handleButtonVoiceCommand(text) {
  const map = [
    { phrases: ["add ledger", "ledger add", "ledger banao", "ledger save", "ledger jodo"], id: "addLedgerBtn" },
    { phrases: ["add item", "item add", "item jodo", "stock add"], id: "addItemBtn" },
    { phrases: ["save voucher", "voucher save", "voucher jodo"], id: "saveVoucherBtn" },
    { phrases: ["add invoice", "invoice add", "item add karo", "bill add"], id: "addInvoiceBtn" },
    { phrases: ["add project", "project save", "project jodo", "add karo", "add kar do", "add kero", "add ker do", "save karo", "project add karo", "ऐड करो", "ऐड कर दो", "जोड़ दो", "जोड़ो"], id: "addProjectBtn" },
    { phrases: ["add expense", "expense save", "kharcha jodo"], id: "addExpenseBtn" },
    { phrases: ["add todo", "todo add", "task add"], id: "addTodoBtn" },
    { phrases: ["add stock", "inventory add", "stock jodo"], id: "invSaveBtn" },
    { phrases: ["sync tally", "tally sync", "tally me bhejo", "टैली सिंक"], id: "tallySyncBtn" },
    { phrases: ["whatsapp share", "whatsapp bhejo"], id: "whatsappShareBtn" },
    { phrases: ["print bill", "print invoice", "bill print"], id: "printInvoiceBtn" },
    { phrases: ["save profile", "profile save"], id: "saveProfileBtn" }
  ];
  for (const entry of map) {
    if (entry.phrases.some(p => text.includes(p))) {
      const btn = document.getElementById(entry.id);
      if (btn && btn.offsetParent !== null) {
        btn.click();
        showCommand("Button click: " + entry.phrases[0]);
        return true;
      }
    }
  }
  return false;
}

async function handleKhataSpeech(raw) {
  const text = normalize(raw);
  openPanel("khataLedgersPanel");

  const ledgerNameMatch = raw.match(/(?:ledger|party|naam|name)\s+([a-zA-Z\u0900-\u097F][a-zA-Z\u0900-\u097F\s]{1,40})/i);
  const addressMatch = raw.match(/(?:address|pata|adda)\s+(.+?)(?:\s+(?:gst|opening|amount)|$)/i);
  const amountMatch = raw.match(/(?:amount|raashi|rashi|राशि)\s+(\d+(?:\.\d+)?)/i);
  const openingMatch = raw.match(/(?:opening|shuru)\s+(\d+(?:\.\d+)?)/i);

  if (ledgerNameMatch) setField(document.getElementById("ledgerNameInput"), ledgerNameMatch[1].trim());
  if (addressMatch) setField(document.getElementById("ledgerAddressInput"), addressMatch[1].trim());
  if (openingMatch) setField(document.getElementById("ledgerOpeningInput"), openingMatch[1]);
  if (amountMatch) setField(document.getElementById("voucherAmountInput"), amountMatch[1]);

  if (text.includes("receipt") || text.includes("रसीद")) {
    openPanel("receiptVoucherPanel");
  } else if (text.includes("payment") || text.includes("भुगतान")) {
    openPanel("paymentVoucherPanel");
  } else if (text.includes("purchase") || text.includes("खरीद")) {
    openPanel("purchasePanel");
  } else if (text.includes("day book")) {
    openPanel("khataDaybookPanel");
  } else if (text.includes("modification") || text.includes("modify") || text.includes("संशोधन")) {
    openPanel("modifyPanel");
  } else if (text.includes("item") || text.includes("stock")) {
    openPanel("khataItemsPanel");
  } else if (text.includes("voucher")) {
    openPanel("khataVoucherPanel");
  }

  if (isAddCommand(text)) {
    if (text.includes("ledger") || text.includes("party") || document.getElementById("ledgerNameInput")?.value.trim()) {
      document.getElementById("addLedgerBtn")?.click();
      showCommand("Ledger save karne ki koshish ki.");
    } else if (text.includes("voucher") || amountMatch) {
      document.getElementById("saveVoucherBtn")?.click();
      showCommand("Voucher save karne ki koshish ki.");
    } else {
      document.getElementById("addItemBtn")?.click();
      showCommand("Item save karne ki koshish ki.");
    }
  } else {
    showCommand("Accounting form filled. Say add to save.");
  }
  return true;
}

async function handleInventorySpeech(raw) {
  const text = normalize(raw);
  openPanel("inventoryPanel");
  const nameMatch = raw.match(/(?:item|saman|product)\s+([a-zA-Z\u0900-\u097F][a-zA-Z\u0900-\u097F\s]{1,30})/i);
  const qtyMatch = raw.match(/(?:qty|quantity|matra)\s+(\d+(?:\.\d+)?)/i);
  const priceMatch = raw.match(/(?:price|rate|daam)\s+(\d+(?:\.\d+)?)/i);
  if (nameMatch) setField(document.getElementById("invItemName"), nameMatch[1].trim());
  if (qtyMatch) setField(document.getElementById("invOpening"), qtyMatch[1]);
  if (priceMatch) setField(document.getElementById("invSelling"), priceMatch[1]);
  if (isAddCommand(text)) {
    document.getElementById("invSaveBtn")?.click();
    showCommand("Inventory me item add karne ki koshish ki.");
  } else {
    showCommand("Inventory form filled. Say add to save.");
  }
  return true;
}

function normalizeFaqText(text) {
  return String(text || '').toLowerCase()
    .replace(/[^\w\s\u0900-\u097F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreFaqMatch(text, keywords) {
  const norm = normalizeFaqText(text);
  let score = 0;
  for (const k of keywords) {
    const kn = k.toLowerCase();
    if (norm.includes(kn)) score += kn.length;
  }
  if (/app|bolkarigar|isme|yahan|iss|is/.test(norm) && /kya|kaise|what|help|feature|ho skt|ho sak|kar sak|kitne|model|module/.test(norm)) {
    score += 8;
  }
  return score;
}

function matchFaqSmart(rawText, faqList, minScore = 4) {
  let best = null;
  let bestScore = 0;
  for (const item of faqList) {
    const s = scoreFaqMatch(rawText, item.keywords);
    if (s > bestScore) {
      bestScore = s;
      best = item;
    }
  }
  return bestScore >= minScore ? best.answer : null;
}

function matchAppFaq(rawText) {
  const moduleFaq = matchModuleFaq(rawText);
  if (moduleFaq) return moduleFaq;
  const smart = matchFaqSmart(rawText, APP_FAQ);
  if (smart) return smart;
  const norm = normalizeFaqText(rawText);
  if (/kya|kaise|what|how|batao|help|feature|app|bolkarigar|ho skt|ho sak|kitne/.test(norm)) {
    return APP_FEATURES_OVERVIEW;
  }
  return null;
}
window.matchAppFaq = matchAppFaq;
window.isInformationalQuestion = isInformationalQuestion;

// Smart AI Speech Handler
// Pehle app ki apni (bahut detailed) command-samajhne wali engine try karta hai —
// project, expense, invoice, todo, qr, note, converter, calculator, gallery,
// search, clear, aur panel-navigation/dark-mode (parseCommands). Sirf jab
// KUCH BHI match na ho, tab hi Gemini AI ko free-form sawal ke liye call
// karta hai. Isse app ke commands bhi kaam karte hain aur Gemini ka free
// quota bhi bahut kam use hota hai.
async function handleSpeech(rawText) {
  if (!rawText || !rawText.trim()) return;
  if (voicePausedForInput || voiceRecPausedForTts || voiceProcessingLock) return;

  const raw = rawText.trim();
  const dedupeKey = normalize(raw);
  const now = Date.now();
  if (dedupeKey.length < 4) return;
  if (dedupeKey === lastVoiceHandled.key && now - lastVoiceHandled.at < 3000) return;

  voiceProcessingLock = true;
  lastActivityTime = Date.now();
  let voiceCommandSucceeded = false;

  const text = normalize(raw);
  console.log("Processing Input:", text);

  try {
    if (window.bkVoiceController?.processVoice) {
      const voiceHandled = await window.bkVoiceController.processVoice(raw);
      if (voiceHandled) { voiceCommandSucceeded = true; return; }
    } else if (window.bkVoiceController?.tryFastAction) {
      const fastHandled = await window.bkVoiceController.tryFastAction(raw);
      if (fastHandled) { voiceCommandSucceeded = true; return; }
    }

    if (isInformationalQuestion(raw)) {
      const faqReply = matchAppFaq(raw);
      if (faqReply) {
        showCommand(faqReply, { speak: true });
        if (document.getElementById("aiReplyBox")) document.getElementById("aiReplyBox").innerText = faqReply;
        return;
      }
    }

    // 1. Expense
    if (looksLikeExpenseCommand(text) || window.bkVoiceController?.looksLikeExpenseUtterance?.(raw)) {
      await handleExpenseSpeech(raw);
      voiceCommandSucceeded = true;
      return;
    }

    // 2. Invoice — project se pehle (sale/bill sentences)
    const invoiceData = extractInvoiceData(raw);
    if (looksLikeInvoiceCommand(text, invoiceData) || text.includes("tally") || text.includes("टैली") ||
        text.includes("whatsapp") || text.includes("व्हाट्सएप")) {
      await handleInvoiceSpeech(raw);
      voiceCommandSucceeded = true;
      return;
    }

    // 3. Project — sirf clear project intent par
    if (!window.bkVoiceController?.looksLikeProjectUtterance?.(raw)) {
      const projectData = extractProjectData(raw);
      if (looksLikeProjectCommand(text, projectData)) {
        await handleProjectSpeech(raw, projectData);
        return;
      }
    }

    // 4. Todo
    if (looksLikeTodoCommand(text)) {
      handleTodoSpeech(raw);
      return;
    }

    // 5. QR code
    if (looksLikeQrCommand(text)) {
      handleQrSpeech(raw);
      return;
    }

    // 6. Notes (write / save)
    if (looksLikeNoteWriteCommand(text) || defineNoteSaveCommand(text)) {
      if (handleNoteSpeech(raw)) return;
    }

    // 7. Calculator
    const cleanExpr = extractCalcExpression(text);
    if (looksLikeCalculation(text, cleanExpr)) {
      handleCalculatorSpeech(raw, cleanExpr);
      return;
    }

    // 9. Gallery navigation (next/previous photo)
    if (looksLikeGalleryNavCommand(text)) {
      if (handleGallerySpeech(raw)) return;
    }

    if (looksLikeSearchCommand(text) || window.bkVoiceController?.looksLikeSearchUtterance?.(raw)) {
      await handleSearchSpeech(raw);
      voiceCommandSucceeded = true;
      return;
    }

    // 11. Clear current panel's form
    if (isClearCommand(text)) {
      clearActivePanelForm();
      return;
    }

    // 12. Khata Pro / Ledger voice commands
    if (looksLikeKhataCommand(text)) {
      await handleKhataSpeech(raw);
      return;
    }

    // 13. Inventory voice commands
    if (looksLikeInventoryCommand(text)) {
      await handleInventorySpeech(raw);
      return;
    }

    // 14. Active panel button click by voice
    if (handleButtonVoiceCommand(text)) {
      return;
    }

    // 15. Panel navigation, dark/light mode, stop listening, etc.
    const matched = parseCommands(raw);
    if (matched) return;

    // 13. Agar koi local command match nahi hua -> Gemini AI Server se poocho
    showCommand("AI Soch raha hai...");

    try {
      // Step A: Gemini API Server Call
      const history = typeof window.bkGetChatHistory === "function" ? window.bkGetChatHistory() : [];
      if (typeof window.bkPushChatHistory === "function") window.bkPushChatHistory("user", raw);

      const response = await fetch(`${API_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ message: raw, history })
      });

      const data = await response.json();

      if (data && data.reply) {
        const reply = data.reply;
        if (typeof window.bkPushChatHistory === "function") window.bkPushChatHistory("assistant", reply);
        showCommand(reply);
        if (document.getElementById("aiReplyBox")) {
          document.getElementById("aiReplyBox").innerText = reply;
        }
        speakText(reply, true);
        voiceCommandSucceeded = true;
        return;
      }

      throw new Error("Empty response from AI server");

    } catch (apiErr) {
      console.warn("AI API Fallback to Local FAQ:", apiErr);

      // Step C: Fallback (Offline FAQ) agar API down ho ya internet na ho
      const faqAnswer = matchAppFaq(raw);
      const reply = faqAnswer || "I did not understand. Try: open invoice, or create a bill for Ram laptop 25000.";
      showCommand(reply, { speak: true });
      if (document.getElementById("aiReplyBox")) {
        document.getElementById("aiReplyBox").innerText = reply;
      }
      speakText(reply, true);
    }

  } catch (err) {
    console.error("handleSpeech error:", err);
    showCommand("Something went wrong. Please try again.");
  } finally {
    if (voiceCommandSucceeded) {
      lastVoiceHandled = { key: dedupeKey, at: Date.now() };
    }
    voiceProcessingLock = false;
  }
}
function setStatus(msg) {
  if (typeof window.bkEnMsg === "function") msg = window.bkEnMsg(msg);
  if (voiceStatus) voiceStatus.textContent = msg;
}

function createRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    setStatus("Speech recognition is not supported in this browser.");
    if (voiceToggle) voiceToggle.disabled = true;
    if (startVoiceBtn) startVoiceBtn.disabled = true;
    return null;
  }

  const rec = new SpeechRecognition();
  rec.lang = localStorage.getItem("bk_voice_lang") || "hi-IN";
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  rec.onstart = () => {
    lastActivityTime = Date.now();
    consecutiveFailures = 0;
    setStatus("Listening...");
    if (voiceToggle) {
      voiceToggle.textContent = bkVoiceBtnLabel(true);
      voiceToggle.classList.add("voice-active");
    }
    if (startVoiceBtn) startVoiceBtn.textContent = "Listening...";
  };

  rec.onresult = (event) => {
    if (voiceRecPausedForTts || voiceProcessingLock) return;
    lastActivityTime = Date.now();
    consecutiveFailures = 0;
    let interim = "";
    let finalText = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const piece = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalText += piece + " ";
      else interim += piece;
    }
    const shown = (finalText || interim).trim();
    if (shown && voiceTranscript) voiceTranscript.value = shown;

    if (finalText.trim()) {
      clearTimeout(interimStableTimer);
      lastInterimText = "";
      voiceUtteranceBuffer += (voiceUtteranceBuffer ? " " : "") + finalText.trim();
      if (voiceTranscript) voiceTranscript.value = voiceUtteranceBuffer;
      const hint = document.getElementById("voiceBufferHint");
      if (hint) hint.textContent = "Listening… speak fully, " + (VOICE_FLUSH_MS / 1000) + " s pause to process";
      setStatus("Listening: " + voiceUtteranceBuffer.slice(0, 70) + (voiceUtteranceBuffer.length > 70 ? "…" : ""));
      clearTimeout(voiceUtteranceFlushTimer);
      voiceUtteranceFlushTimer = setTimeout(flushVoiceBuffer, VOICE_FLUSH_MS);
    } else if (interim.trim()) {
      const calcPanelActive = document.getElementById("calcPanel")?.classList.contains("active");
      const cleanExpr = extractCalcExpression(interim.trim());
      if (calcPanelActive && cleanExpr && document.getElementById("calcDisplay")) {
        document.getElementById("calcDisplay").value = cleanExpr;
      }
      setStatus("Listening: " + interim.trim().slice(0, 60) + (interim.length > 60 ? "…" : ""));
    }
  };

  rec.onerror = (event) => {
    if (FATAL_ERRORS.includes(event.error)) {
      voiceOn = false;
      stopWatchdog();
      clearTimeout(restartTimer);
      isRestarting = false;
      if (voiceToggle) {
        voiceToggle.textContent = bkVoiceBtnLabel(false);
        voiceToggle.classList.remove("voice-active");
      }
      if (startVoiceBtn) startVoiceBtn.textContent = "Start Listening";
      setStatus("Microphone stopped (" + event.error + "). Check microphone permission in your browser.");
      return;
    }

    const quiet = event.error === "no-speech" || event.error === "aborted";
    if (!quiet) {
      consecutiveFailures++;
      setStatus("Voice error: " + event.error + " — retrying...");
    }
    if (voiceOn && !voiceRecPausedForTts && !voiceProcessingLock) {
      restartRecognition(quiet ? 200 : undefined);
    }
  };

  rec.onend = () => {
    if (!voiceOn) {
      if (voiceToggle) {
        voiceToggle.textContent = bkVoiceBtnLabel(false);
        voiceToggle.classList.remove("voice-active");
      }
      if (startVoiceBtn) startVoiceBtn.textContent = "Start Listening";
      setStatus("Voice stopped.");
      return;
    }
    if (!voiceRecPausedForTts && !voiceProcessingLock) {
      restartRecognition();
    }
  };

  return rec;
}

function startVoice() {
  voiceOn = true;
  localStorage.setItem("bk_voice_auto", "1");
  recognition = createRecognition();
  if (!recognition) return;
  if (voiceToggle) {
    voiceToggle.textContent = bkVoiceBtnLabel(true);
    voiceToggle.classList.add("voice-active");
  }
  if (startVoiceBtn) startVoiceBtn.textContent = "Listening...";
  setStatus("Voice ON — speak a full sentence; processing starts after a 1.5 s pause.");
  consecutiveFailures = 0;
  isRestarting = false;
  try {
    recognition.start();
    lastActivityTime = Date.now();
  } catch {}
  startWatchdog();
}

function stopVoice() {
  voiceOn = false;
  localStorage.setItem("bk_voice_auto", "0");
  isRestarting = false;
  consecutiveFailures = 0;
  clearTimeout(restartTimer);
  clearTimeout(voiceUtteranceFlushTimer);
  voiceUtteranceBuffer = "";
  stopWatchdog();
  if (recognition) {
    try { recognition.stop(); } catch {}
  }
  if (voiceToggle) {
    voiceToggle.textContent = bkVoiceBtnLabel(false);
    voiceToggle.classList.remove("voice-active");
  }
  if (startVoiceBtn) startVoiceBtn.textContent = "Start Listening";
  setStatus("Voice stopped.");
}

voiceToggle?.addEventListener("click", () => voiceOn ? stopVoice() : startVoice());
startVoiceBtn?.addEventListener("click", startVoice);
stopVoiceBtn?.addEventListener("click", stopVoice);

clearVoiceBtn?.addEventListener("click", () => {
  if (voiceTranscript) voiceTranscript.value = "";
  if (voiceResult) voiceResult.textContent = "Parsed voice data will appear here.";
  if (voiceStatus) voiceStatus.textContent = "Voice data cleared.";
});

sampleInvoiceCmdBtn?.addEventListener("click", () => handleSpeech("customer Ramesh product plywood sheet price 2500 quantity 2"));
sampleProjectCmdBtn?.addEventListener("click", () => handleSpeech("project Mandir work customer Aslam budget 50000"));
sampleExpenseCmdBtn?.addEventListener("click", () => handleSpeech("vendor Sharma Timber amount 4200 project Hall Panel"));

fillVoiceToInvoiceBtn?.addEventListener("click", () => {
  if (customerName) customerName.value = document.getElementById("voiceCustomer")?.value || "";
  if (productName) productName.value = document.getElementById("voiceProduct")?.value || "";
  if (productPrice) productPrice.value = document.getElementById("voicePrice")?.value || "";
  if (productQty) productQty.value = document.getElementById("voiceQty")?.value || 1;
  const statusEl = document.getElementById("invoiceStatus");
  if (statusEl) statusEl.textContent = "Voice data copied to invoice form.";
});

fillVoiceToProjectBtn?.addEventListener("click", () => {
  if (projectName) projectName.value = document.getElementById("voiceProject")?.value || document.getElementById("voiceProduct")?.value || "";
  if (projectCustomer) projectCustomer.value = document.getElementById("voiceCustomer")?.value || "";
  if (projectBudget) projectBudget.value = document.getElementById("voicePrice")?.value || "";
  if (projectNote) projectNote.value = document.getElementById("voiceVendor")?.value || document.getElementById("voiceProduct")?.value || "";
  const statusEl = document.getElementById("projectStatusText");
  if (statusEl) statusEl.textContent = "Voice data copied to project form.";
});

fillVoiceToExpenseBtn?.addEventListener("click", () => {
  if (expenseTitle) expenseTitle.value = document.getElementById("voiceProduct")?.value || document.getElementById("voiceProject")?.value || "";
  if (expenseVendor) expenseVendor.value = document.getElementById("voiceVendor")?.value || document.getElementById("voiceCustomer")?.value || "";
  if (expenseAmount) expenseAmount.value = document.getElementById("voicePrice")?.value || "";
  if (expenseProjectLink) expenseProjectLink.value = document.getElementById("voiceProject")?.value || "";
});

document.getElementById("generateQrBtn")?.addEventListener("click", () => {
  const value = document.getElementById("qrInput")?.value.trim();
  const box = document.getElementById("qrCodeBox");
  if (!value || !box) return;
  box.innerHTML = "";
  if (typeof QRCode !== "undefined") new QRCode(box, { text: value, width: 180, height: 180 });
  else box.textContent = "QR library not loaded.";
});

document.getElementById("clearQrBtn")?.addEventListener("click", () => {
  if (document.getElementById("qrInput")) document.getElementById("qrInput").value = "";
  if (document.getElementById("qrCodeBox")) document.getElementById("qrCodeBox").innerHTML = "";
});

// ==========================================================================
// 🟢 GALLERY (asli) — user ki apni upload ki hui photos backend se load
// hoti hain, ab koi fake random stock photo nahi dikhti.
// ==========================================================================
const galleryMain = document.getElementById("mainGalleryImage");
const galleryThumbsBox = document.getElementById("galleryThumbs");

// Gallery photos ab server ke GridFS se stream hoti hain (seedha base64 nahi
// aata list API mein) — <img> tag Authorization header nahi bhej sakta,
// isliye token ko query param mein bhejte hain (server isse accept karta hai).
function galleryImageUrl(fileId) {
  const api = typeof window.bkGetApiUrl === 'function' ? window.bkGetApiUrl() : API_URL;
  return `${api}/api/gallery/image/${fileId}?token=${encodeURIComponent(getToken())}`;
}
const galleryStatusText = document.getElementById("galleryStatusText");
const galleryUploadBtn = document.getElementById("galleryUploadBtn");
const galleryFileInput = document.getElementById("galleryFileInput");

function renderGalleryThumbs(photos) {
  if (!galleryThumbsBox) return;
  galleryThumbsBox.innerHTML = "";

  if (!photos.length) {
    if (galleryStatusText) galleryStatusText.textContent = "No photos uploaded yet — click Upload Photo.";
    if (galleryMain) galleryMain.style.display = "none";
    return;
  }

  photos.forEach((photo, idx) => {
    const card = document.createElement("div");
    card.className = "gallery-thumb-card" + (idx === 0 ? " active-thumb" : "");
    card.dataset.photoId = photo._id;

    const img = document.createElement("img");
    img.className = "thumb";
    img.src = galleryImageUrl(photo.fileId);
    img.crossOrigin = 'anonymous';
    img.loading = 'lazy';
    img.onerror = function () {
      this.alt = 'Photo failed to load — check your connection';
      this.style.opacity = '0.5';
    };
    img.alt = photo.caption || "Product photo";
    img.loading = "lazy";

    const delBtn = document.createElement("button");
    delBtn.textContent = "✕";
    delBtn.title = "Delete photo";
    delBtn.type = "button";
    delBtn.className = "gallery-delete-btn";
    delBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm("Delete this photo?")) return;
      await deleteGalleryPhoto(photo._id);
    });

    card.addEventListener("click", () => {
      if (galleryMain) {
        galleryMain.src = galleryImageUrl(photo.fileId);
        galleryMain.style.display = "block";
      }
      document.querySelectorAll(".gallery-thumb-card").forEach((t) => t.classList.remove("active-thumb"));
      card.classList.add("active-thumb");
    });

    card.appendChild(img);
    card.appendChild(delBtn);
    galleryThumbsBox.appendChild(card);
  });

  if (galleryMain) { galleryMain.src = galleryImageUrl(photos[0].fileId); galleryMain.style.display = "block"; }
  if (galleryStatusText) galleryStatusText.textContent = `${photos.length} photo(s) uploaded.`;
}
window.bkRenderGalleryThumbs = renderGalleryThumbs;
window.loadGalleryPhotos = loadGalleryPhotos;

async function loadGalleryPhotos() {
  try {
    const token = getToken();
    const res = await fetch(`${API_URL}/api/gallery`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.success) renderGalleryThumbs(data.photos);
  } catch (err) {
    console.error("Gallery load error:", err);
    if (galleryStatusText) galleryStatusText.textContent = "Could not load photos.";
  }
}

async function deleteGalleryPhoto(photoId) {
  try {
    const token = getToken();
    await fetch(`${API_URL}/api/gallery/${photoId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    loadGalleryPhotos();
  } catch (err) {
    console.error("Gallery delete error:", err);
  }
}

galleryUploadBtn?.addEventListener("click", () => galleryFileInput?.click());

galleryFileInput?.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) { alert("Please select an image file only."); return; }
  if (file.size > 5 * 1024 * 1024) { alert("Image is larger than 5MB — please choose a smaller photo."); return; }

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      if (galleryStatusText) galleryStatusText.textContent = "Uploading...";
      const token = getToken();
      const res = await fetch(`${API_URL}/api/gallery/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageData: reader.result })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload fail hua");
      loadGalleryPhotos();
      window.BolKarigarTeamGallery?.loadTeamGallery?.();
    } catch (err) {
      console.error("Gallery upload error:", err);
      alert("❌ Upload failed: " + err.message);
    }
  };
  reader.readAsDataURL(file);
  galleryFileInput.value = "";
});

// Gallery panel khulte hi photos load karo
document.querySelector('.tab-btn[data-tab="galleryPanel"]')?.addEventListener("click", () => {
  if (typeof window.BolKarigarTeamGallery?.loadTeamGallery === "function") {
    window.BolKarigarTeamGallery.loadTeamGallery();
  } else loadGalleryPhotos();
});
if (document.getElementById("galleryPanel")?.classList.contains("active")) {
  if (typeof window.BolKarigarTeamGallery?.loadTeamGallery === "function") window.BolKarigarTeamGallery.loadTeamGallery();
  else loadGalleryPhotos();
}

const searchInput = document.getElementById("searchInput");
const searchList = document.querySelectorAll("#searchList li");
searchInput?.addEventListener("input", () => {
  const term = searchInput.value.toLowerCase();
  searchList.forEach(item => item.style.display = item.textContent.toLowerCase().includes(term) ? "block" : "none");
});

document.querySelectorAll(".calc-btn").forEach(button => {
  if (button.id === "calcEquals" || button.id === "calcClear") return;
  button.addEventListener("click", () => {
    const display = document.getElementById("calcDisplay");
    if (display) display.value += button.textContent;
  });
});

document.getElementById("calcEquals")?.addEventListener("click", () => {
  const display = document.getElementById("calcDisplay");
  if (!display) return;
  try {
    const expr = display.value || "0";
    if (!/^[0-9+\-*/().\s]+$/.test(expr)) throw new Error();
    display.value = Function(`return ${expr}`)();
  } catch { display.value = "Error"; }
});

document.getElementById("calcClear")?.addEventListener("click", () => {
  if (document.getElementById("calcDisplay")) document.getElementById("calcDisplay").value = "";
});

function populateUnits() {
  const unitType = document.getElementById("unitType");
  const fromUnit = document.getElementById("fromUnit");
  const toUnit = document.getElementById("toUnit");
  if (!unitType || !fromUnit || !toUnit) return;

  const unitOptions = {
    length: ["meter", "kilometer", "mile", "feet"],
    weight: ["kilogram", "gram", "pound"],
    temperature: ["celsius", "fahrenheit", "kelvin"]
  };
  const opts = unitOptions[unitType.value] || [];
  fromUnit.innerHTML = "";
  toUnit.innerHTML = "";
  opts.forEach(unit => {
    fromUnit.innerHTML += `<option value="${unit}">${unit}</option>`;
    toUnit.innerHTML += `<option value="${unit}">${unit}</option>`;
  });
  if (opts[1]) toUnit.value = opts[1];
}
document.getElementById("unitType")?.addEventListener("change", populateUnits);

document.getElementById("convertBtn")?.addEventListener("click", () => {
  const type = document.getElementById("unitType").value;
  const value = parseFloat(document.getElementById("unitInput").value);
  const from = document.getElementById("fromUnit").value;
  const to = document.getElementById("toUnit").value;
  const output = document.getElementById("convertResult");
  if (!output) return;
  if (Number.isNaN(value)) { output.textContent = "Please enter a valid number."; return; }
  let result = value;
  if (type === "length") {
    const map = { meter: 1, kilometer: 1000, mile: 1609.34, feet: 0.3048 };
    result = value * (map[from] || 1) / (map[to] || 1);
  } else if (type === "weight") {
    const map = { kilogram: 1, gram: 0.001, pound: 0.453592 };
    result = value * (map[from] || 1) / (map[to] || 1);
  } else {
    let celsius = value;
    if (from === "fahrenheit") celsius = (value - 32) * 5 / 9;
    if (from === "kelvin") celsius = value - 273.15;
    if (to === "fahrenheit") result = celsius * 9 / 5 + 32;
    else if (to === "kelvin") result = celsius + 273.15;
    else result = celsius;
  }
  output.textContent = `${value} ${from} = ${result.toFixed(2)} ${to}`;
});

document.getElementById("saveNotesBtn")?.addEventListener("click", () => {
  const content = document.getElementById("notesInput")?.value.trim();
  if (!content) return;
  const blob = new Blob([content], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "notes.txt";
  link.click();
  const status = document.getElementById("notesStatus");
  if (status) status.textContent = "Notes downloaded successfully.";
});

document.getElementById("clearNotesBtn")?.addEventListener("click", () => {
  if (document.getElementById("notesInput")) document.getElementById("notesInput").value = "";
  const status = document.getElementById("notesStatus");
  if (status) status.textContent = "Notes cleared.";
});

// Single Session Guard — desktop par duplicate tab; mobile/PWA par band (phone par bahut tabs hoti hain)
const BK_SESSION_CHANNEL = 'bolkarigar_session_hub';
const BK_SESSION_LS = 'bolkarigar_session_leader';
const BK_HEARTBEAT_LS = 'bolkarigar_session_heartbeat';
const BK_HEARTBEAT_INTERVAL = 4000;
const BK_SESSION_STALE_MS = 20000;
const sessionChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(BK_SESSION_CHANNEL) : null;
const _sessionUrlParams = new URLSearchParams(window.location.search);
const canClaimSession = _sessionUrlParams.get('openPanel') === 'myPlanPanel'
  || _sessionUrlParams.get('bkTakeover') === '1';
const bkTabId = `bk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
let bkSessionBlocked = false;
let bkHeartbeatTimer = null;

function isMobileOrStandaloneApp() {
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
  if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) return true;
  if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches && navigator.maxTouchPoints > 0) return true;
  return false;
}

function readSessionLeader() {
  try {
    return JSON.parse(localStorage.getItem(BK_SESSION_LS) || 'null');
  } catch {
    return null;
  }
}

function readHeartbeat() {
  return Number(localStorage.getItem(BK_HEARTBEAT_LS) || 0);
}

function isSessionStale() {
  return Date.now() - readHeartbeat() > BK_SESSION_STALE_MS;
}

function claimSessionLeadership() {
  localStorage.setItem(BK_SESSION_LS, JSON.stringify({ tabId: bkTabId, at: Date.now() }));
  localStorage.setItem(BK_HEARTBEAT_LS, String(Date.now()));
  if (sessionChannel) sessionChannel.postMessage({ type: 'CLAIM_SESSION', tabId: bkTabId });
}

function startSessionHeartbeat() {
  if (bkHeartbeatTimer) clearInterval(bkHeartbeatTimer);
  const beat = () => {
    if (bkSessionBlocked) return;
    const leader = readSessionLeader();
    if (!leader || leader.tabId === bkTabId) {
      localStorage.setItem(BK_SESSION_LS, JSON.stringify({ tabId: bkTabId, at: Date.now() }));
      localStorage.setItem(BK_HEARTBEAT_LS, String(Date.now()));
    }
  };
  beat();
  bkHeartbeatTimer = setInterval(beat, BK_HEARTBEAT_INTERVAL);
  window.addEventListener('beforeunload', () => {
    const leader = readSessionLeader();
    if (leader && leader.tabId === bkTabId) {
      localStorage.removeItem(BK_SESSION_LS);
      localStorage.removeItem(BK_HEARTBEAT_LS);
    }
  });
}

function blockDuplicateSession() {
  if (bkSessionBlocked) return;
  bkSessionBlocked = true;
  if (bkHeartbeatTimer) clearInterval(bkHeartbeatTimer);
  document.body.innerHTML = `
    <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh; background:#111; color:#fff; font-family:sans-serif; text-align:center; padding:20px;">
      <h2 style="color:#ef4444;">Access Denied (Ek hi Session Allowed Hai)</h2>
      <p style="margin-top:10px; color:#aaa;">BolKarigar is already open in another tab.</p>
      <p style="color:#666; font-size:14px;">Click <strong>Continue here</strong> below — the other tab will close automatically.</p>
      <button onclick="window.location.href='bolkarigar.html?bkTakeover=1'" style="margin-top:20px; padding:12px 22px; background:#22c55e; color:#fff; border:none; border-radius:8px; cursor:pointer; font-weight:700;">✅ Continue here</button>
      <button onclick="window.location.href='bolkarigar.html?openPanel=myPlanPanel&bkTakeover=1'" style="margin-top:10px; padding:10px 20px; background:#16a34a; color:#fff; border:none; border-radius:6px; cursor:pointer;">💳 Open My Plan</button>
      <button onclick="window.location.reload()" style="margin-top:10px; padding:10px 20px; background:#3b82f6; color:#fff; border:none; border-radius:6px; cursor:pointer;">Try again</button>
    </div>
  `;
  if (recognition) { try { recognition.stop(); } catch (e) {} }
}

function handlePlanPaymentRequest(plan) {
  if (typeof openPanel === 'function') openPanel('myPlanPanel');
  const startPayment = () => {
    if (typeof window.buyBolKarigarPlan === 'function' && (plan === 'pro' || plan === 'business')) {
      window.buyBolKarigarPlan(plan);
    }
  };
  if (window._bkAccountInfo || !getToken()) startPayment();
  else setTimeout(startPayment, 800);
}

sessionChannel && (sessionChannel.onmessage = (event) => {
  const data = event.data || {};

  if (data.type === 'OPEN_PLAN_PAYMENT') {
    sessionChannel.postMessage({ type: 'PLAN_PAYMENT_ACK', tabId: data.tabId });
    handlePlanPaymentRequest(data.plan);
    return;
  }

  if (data.type === 'CLAIM_SESSION' && data.tabId !== bkTabId) {
    if (!isMobileOrStandaloneApp()) blockDuplicateSession();
    return;
  }

  if (data.type === 'NEW_TAB_OPENED' && !bkSessionBlocked) {
    sessionChannel.postMessage({ type: 'ALREADY_ACTIVE', fromTab: bkTabId });
  }

  if (data.type === 'ALREADY_ACTIVE' && !canClaimSession && !isMobileOrStandaloneApp()) {
    if (!isSessionStale()) blockDuplicateSession();
  }
});

function initSessionGuard() {
  if (isMobileOrStandaloneApp()) {
    claimSessionLeadership();
    startSessionHeartbeat();
    return;
  }
  if (canClaimSession || isSessionStale() || !readSessionLeader()) {
    claimSessionLeadership();
    startSessionHeartbeat();
    return;
  }
  const leader = readSessionLeader();
  if (leader && leader.tabId !== bkTabId && !isSessionStale()) {
    if (sessionChannel) sessionChannel.postMessage({ type: 'NEW_TAB_OPENED' });
    setTimeout(() => {
      if (!bkSessionBlocked && !isSessionStale() && readSessionLeader()?.tabId !== bkTabId) {
        blockDuplicateSession();
      }
    }, 600);
    return;
  }
  claimSessionLeadership();
  startSessionHeartbeat();
}

initSessionGuard();

window.bkHandlePlanPaymentRequest = handlePlanPaymentRequest;

function triggerWhatsAppShare() {
  const currentCust = (document.getElementById("customerName")?.value || "").trim();

  if (!currentCust) {
    showCommand("Enter Customer Name on the invoice form before WhatsApp share.");
    alert("Please enter the customer name first!");
    return;
  }

  const customerItems = invoiceLineItems.filter(item =>
    item.customer && item.customer.toLowerCase().includes(currentCust.toLowerCase())
  );

  const prof = JSON.parse(localStorage.getItem("bolkarigar_company_profile") || "{}");
  const shopName = prof.name || "";
  const shopPhone = prof.phone || "";
  const today = new Date().toLocaleDateString('en-IN');

  // 🟢 Padding helper — monospace table ke liye columns align karne ke liye
  const pad = (str, len) => {
    str = String(str ?? "");
    return str.length >= len ? str.slice(0, len) : str + " ".repeat(len - str.length);
  };
  const padLeft = (str, len) => {
    str = String(str ?? "");
    return str.length >= len ? str.slice(0, len) : " ".repeat(len - str.length) + str;
  };

  let items = [];
  let total = 0;

  if (customerItems.length > 0) {
    customerItems.forEach(item => {
      const price = Number(item.price || 0);
      const qty = Number(item.qty || 1);
      const sub = price * qty;
      total += sub;
      items.push({ ...item, sub });
    });
  } else {
    const pName = (document.getElementById("productName")?.value || "").trim() || "Item";
    const pPrice = parseFloat(document.getElementById("productPrice")?.value || "0");
    const pQty = parseFloat(document.getElementById("productQty")?.value || "1");
    const pGst = parseFloat(document.getElementById("productGst")?.value || "0");

    if (pPrice <= 0 || Number.isNaN(pPrice)) {
      alert("Please enter a valid price or add an item first!");
      return;
    }

    const sub = pPrice * pQty;
    total = sub;
    items.push({ product: pName, price: pPrice, qty: pQty, gstRate: pGst, sub });
  }

  let textMsg = "";
  if (shopName) textMsg += `*${shopName}*\n`;
  if (shopPhone) textMsg += `मो. ${shopPhone}\n`;
  textMsg += `Date: ${today}\n`;
  textMsg += `Customer: ${currentCust}\n\n`;

  // 🟢 Table format (jo tumhare form mein already fields hain — Item,
  // Qty, Price, GST, Amount — usi se ye monospace table banta hai)
  textMsg += "```\n";
  textMsg += `${pad("Item", 16)}${padLeft("Qty", 5)}${padLeft("Price", 10)}${padLeft("GST%", 6)}${padLeft("Amount", 10)}\n`;
  textMsg += `${"-".repeat(47)}\n`;
  items.forEach(it => {
    const gstStr = it.gstRate ? `${it.gstRate}%` : "-";
    textMsg += `${pad(it.product, 16)}${padLeft(it.qty, 5)}${padLeft(Number(it.price).toFixed(2), 10)}${padLeft(gstStr, 6)}${padLeft(it.sub.toFixed(2), 10)}\n`;
  });
  textMsg += `${"-".repeat(47)}\n`;
  textMsg += `${pad("Grand Total", 37)}${padLeft("₹" + total.toFixed(2), 10)}\n`;
  textMsg += "```\n";

  if (prof.upiId) textMsg += `UPI: ${prof.upiId}\n`;
  textMsg += `\nBolKarigar se bheja gaya bill.\nDhanyavaad!`;

  const encodedMsg = encodeURIComponent(textMsg);
  window.open(`https://api.whatsapp.com/send?text=${encodedMsg}`, '_blank');
  showCommand(`${currentCust} ka bill WhatsApp par bheja ja raha hai.`);
}

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  voiceOn = false;
  if (recognition) {
    try {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
    } catch(e) {}
  }
  logoutUser();
});

// ================= TALLY INTEGRATION =================
async function checkTallyHttpStatus(opts = {}) {
  const token = getToken();
  if (!token) return { httpReady: false, message: "Login required.", steps: [] };
  try {
    const q = opts.silent ? "?silent=1" : "";
    const res = await fetch(`${API_URL}/api/tally/http-status${q}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json().catch(() => ({}));
    return {
      httpReady: !!data.httpReady,
      agentConnected: !!data.agentConnected,
      odbcOnly: !!data.odbcOnly,
      companyRequired: !!data.companyRequired,
      canTrySync: !!data.canTrySync,
      probeSnippet: data.probeSnippet || "",
      message: data.message || data.error || "Could not check Tally HTTP.",
      steps: data.steps || [],
      portOpen: data.portOpen,
      tallyRunning: data.tallyRunning,
      agentVersion: data.agentVersion || ""
    };
  } catch {
    return { httpReady: false, message: "Network error checking Tally HTTP.", steps: [] };
  }
}

async function ensureTallyHttpBeforeSync() {
  const status = await checkTallyHttpStatus();
  if (status.httpReady) return true;
  if (status.canTrySync || status.portOpen) {
    const warn = status.message || "Port 9000 open — trying sync. Company must be open in Tally Day Book.";
    if (typeof showToast === "function") showToast(warn, "info");
    return true;
  }
  const steps = (status.steps || []).map((s, i) => `${i + 1}. ${s}`).join("\n");
  const msg =
    "⚠️ Tally port 9000 is closed — sync is not available.\n\n" +
    (status.message || "") +
    (steps ? `\n\n${steps}` : "") +
    "\n\nIn Tally: F1 → Connectivity → Both + ODBC Yes, Port 9000. Select company, then Sync Tally.";
  if (typeof showToast === "function") showToast(msg, "error");
  else alert(msg);
  openTallyAgentSidebar();
  return false;
}

async function checkTallyAgentReady() {
  const token = getToken();
  if (!token) return { canSync: false, reason: "Please log in first." };
  try {
    const res = await fetch(`${API_URL}/api/tally/agent-status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { canSync: false, reason: data.error || "Could not check Desktop Agent status." };
    }
    if (data.canSync) return { canSync: true, agentConnected: data.agentConnected, localSetup: data.localSetup };
    return {
      canSync: false,
      reason: "Agent window is closed. Double-click BolKarigar-Connect-Agent.bat again (token already saved — no need to paste again)."
    };
  } catch (e) {
    return { canSync: false, reason: "Network error while checking Desktop Agent." };
  }
}

function openTallyAgentSidebar(opts = {}) {
  const expand = opts.expand !== false;
  const card = document.querySelector(".sidebar-tally-card");
  if (!card) return;
  if (expand) card.open = true;
  if (opts.scroll) {
    card.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

let tallySyncInProgress = false;
let tallySyncStartedAt = 0;
const TALLY_SYNC_STALE_MS = 120000;

async function sendInvoiceToTally(customer, product, price, qty, gstRate, customerGstin, customerState) {
  const tallyBtn = document.getElementById("tallySyncBtn");
  if (tallyBtn && tallyBtn.disabled) {
    const st = window._bkTallyHttpStatus || {};
    const msg = st.agentConnected
      ? "Tally HTTP is not ready. F1 → Connectivity → Client/Server → HTTP Server = Yes, Port 9000. Sync enables when Test is green. Use BolKarigar Khata for now."
      : "Agent is offline. Run Connect Agent.bat, or save bills with BolKarigar Khata.";
    if (typeof showToast === "function") showToast(msg, "error");
    else alert(msg);
    openTallyAgentSidebar({ scroll: true });
    return false;
  }

  if (tallySyncInProgress) {
    const elapsed = Date.now() - tallySyncStartedAt;
    if (elapsed < TALLY_SYNC_STALE_MS) {
      if (typeof showToast === "function") showToast("Sync already in progress — please wait...", "info");
      return false;
    }
    tallySyncInProgress = false;
  }
  tallySyncInProgress = true;
  tallySyncStartedAt = Date.now();
  try {
    const token = getToken();
    const ready = await checkTallyAgentReady();
    if (!ready.canSync) {
      openTallyAgentSidebar({ scroll: true });
      const msg =
        "Agent window is not running.\n\n" +
        "Token is already saved — just double-click BolKarigar-Connect-Agent.bat again.\n" +
        "No need to paste token again.\n\n" +
        "Then Sync Tally for Aman / any customer.";
      if (typeof showToast === "function") showToast(msg, "error");
      else alert(msg);
      if (typeof showCommand === "function") showCommand("Desktop Agent offline — download Agent from sidebar.");
      return false;
    }

    if (ready.agentConnected) {
      try {
        const ctrl = new AbortController();
        const verTimer = setTimeout(() => ctrl.abort(), 8000);
        const verRes = await fetch(`${API_URL}/api/tally/http-status?silent=1`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: ctrl.signal
        });
        clearTimeout(verTimer);
        const http = await verRes.json().catch(() => ({}));
        const ver = String(http.agentVersion || "");
        if (ver && !ver.includes("http4") && !ver.includes("http5")) {
          openTallyAgentSidebar({ scroll: true });
          const oldAgentMsg =
            "Old Agent is running (" + ver + "). Download Agent vhttp5 from the sidebar, stop the old one, and run Connect Agent again.";
          if (typeof showToast === "function") showToast(oldAgentMsg, "error");
          else alert(oldAgentMsg);
          return false;
        }
      } catch (_) { /* skip version check on timeout */ }
    }

    const ewayDetails = getEWayBillDetails();

    if (typeof showCommand === 'function') {
      showCommand(ready.agentConnected
        ? "⌛ Syncing to Tally (Agent will open Tally once if needed)…"
        : "⌛ Syncing invoice to Tally Prime…");
    }

    if (ready.agentConnected) {
      try {
        await fetch(`${API_URL}/api/tally/open`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        await new Promise((r) => setTimeout(r, 4000));
      } catch (e) {
        console.log("Open Tally trigger:", e.message);
      }
    }

    const baseAmount = price * qty;
    const gstAmount = (baseAmount * (gstRate || 0)) / 100;
    const totalAmount = baseAmount + gstAmount;
    const taxMode = resolveGstTaxMode(
      getCompanyProfile(),
      customerState,
      document.getElementById('buyerPincode')?.value?.trim() || ''
    );

    const response = await fetch(`${API_URL}/api/tally/sync-invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        customer, 
        product, 
        price, 
        qty, 
        gstRate: gstRate || 0,
        gstAmount: gstAmount,
        totalAmount: totalAmount,
        cgst: taxMode.isIntraState ? gstAmount / 2 : 0,
        sgst: taxMode.isIntraState ? gstAmount / 2 : 0,
        customerGstin: customerGstin || "",
        customerState: taxMode.buyerState || customerState || "",
        invoiceDate: document.getElementById("invoiceDateInput")?.value || new Date().toISOString().slice(0, 10),
        paymentType: document.getElementById("invoicePaymentType")?.value || "Cash",
        tallyEdu: true,
        ewayBillNo: ewayDetails.ewayBillNo,
        vehicleNo: ewayDetails.vehicleNo,
        distanceKm: ewayDetails.distanceKm
      })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Sync failed");

    const msg = result.message || "✅ Bill synced to Tally successfully!";
    const nextTip = " Next bill? Add customer + items → Sync Tally again (no token needed).";
    if (typeof showToast === "function") showToast(msg + nextTip, "success");
    else alert(msg + nextTip);
    if (typeof showCommand === "function") showCommand(msg + nextTip);
    try { localStorage.setItem("bk_agent_setup_done", "1"); } catch (_) {}
    return true;

  } catch (err) {
    console.error("Sync Error:", err);
    const errMsg = err.message || "Tally sync failed.";
    if (typeof showToast === "function") showToast("❌ " + errMsg, "error");
    else alert("❌ Error: " + errMsg);
    if (/agent/i.test(errMsg)) openTallyAgentSidebar();
    return false;
  } finally {
    tallySyncInProgress = false;
  }
}

function getInvoiceItemsForTallySync() {
  const cust = (document.getElementById("customerName")?.value || "").trim();
  const all = invoiceLineItems || [];
  if (!all.length) return [];
  if (!cust) return all;
  const matched = all.filter((i) =>
    String(i.customer || "General Customer").toLowerCase() === cust.toLowerCase()
  );
  return matched.length ? matched : all;
}

function combineInvoiceItemsForTally(items) {
  const product = items.map((i) => i.product).filter(Boolean).join(", ");
  const totalBase = items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 1), 0);
  const totalGst = items.reduce((s, i) => {
    const base = (Number(i.price) || 0) * (Number(i.qty) || 1);
    return s + (base * (Number(i.gstRate) || 0)) / 100;
  }, 0);
  const grandTotal = totalBase + totalGst;
  const gstRate = totalBase > 0 ? Math.round((totalGst / totalBase) * 10000) / 100 : 0;
  const customer = (document.getElementById("customerName")?.value || items[0]?.customer || "").trim();
  return { customer, product, price: totalBase, qty: 1, gstRate, grandTotal };
}

async function handleTallyVoiceCommand() {
  if (getAccountingMode() !== "tally") {
    const tallyRadio = document.querySelector('input[name="accMode"][value="tally"]');
    if (tallyRadio) {
      tallyRadio.checked = true;
      if (typeof toggleTallyBtn === "function") toggleTallyBtn(true);
    }
  }

  const tableItems = getInvoiceItemsForTallySync();
  let cust, prod, price, qty, gstRate, grandTotal;

  if (tableItems.length) {
    const combined = combineInvoiceItemsForTally(tableItems);
    cust = combined.customer;
    prod = combined.product;
    price = combined.price;
    qty = combined.qty;
    gstRate = combined.gstRate;
    grandTotal = combined.grandTotal;
  } else {
    cust = (document.getElementById("customerName")?.value || "").trim();
    prod = (document.getElementById("productName")?.value || "").trim();
    price = parseFloat(document.getElementById("productPrice")?.value || "0");
    qty = parseFloat(document.getElementById("productQty")?.value || "1");
    gstRate = isInvoiceGstEnabled()
      ? parseFloat(document.getElementById("productGst")?.value || "0")
      : 0;
    const baseTotal = price * qty;
    grandTotal = baseTotal + (baseTotal * gstRate) / 100;
  }

  const custGstin = (document.getElementById("customerGstin")?.value || "").trim();
  const custState = (document.getElementById("buyerState")?.value || "").trim();

  if (!cust || !prod || price <= 0) {
    showCommand("Add at least one item with Add Item (F2), then enter customer name.");
    alert("Please add invoice items to the table and enter customer name before syncing to Tally.");
    return;
  }

  if (typeof showCommand === "function") {
    showCommand(`Syncing ₹${grandTotal.toFixed(2)} bill for ${cust} to Tally…`);
  }
  await sendInvoiceToTally(cust, prod, price, qty, gstRate, custGstin, custState);
}

// 🟢 GSTIN LIVE VALIDATION HINT — jaise hi user GSTIN type kare, turant chhota
// sa hint dikha do (sahi/galat), Tally sync try karne se pehle hi pata chal jaye.
(function setupGstinHint() {
  const gstinInput = document.getElementById("customerGstin");
  const hintEl = document.getElementById("gstinHint");
  if (!gstinInput || !hintEl) return;

  const gstinPattern = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/i;

  function updateHint() {
    const val = gstinInput.value.trim();
    if (!val) {
      hintEl.textContent = "";
      return;
    }
    if (gstinPattern.test(val)) {
      hintEl.textContent = "✅ GSTIN format looks valid";
      hintEl.style.color = "#22c55e";
    } else {
      hintEl.textContent = "⚠️ Invalid format (leave blank for unregistered customer)";
      hintEl.style.color = "#f59e0b";
    }
  }

  gstinInput.addEventListener("input", updateHint);
})();

// ================= FINANCIALS & LEDGER =================
/** Invoice line ka bill amount — GST ke saath (customer ne jo pay kiya) */
function getInvoiceLineGrandTotal(item) {
  if (!item) return 0;
  if (item.totalAmount != null && !Number.isNaN(parseFloat(item.totalAmount))) {
    return parseFloat(item.totalAmount) || 0;
  }
  const base = (parseFloat(item.price) || 0) * (parseFloat(item.qty) || 1);
  let gstRate = parseFloat(item.gstRate);
  if (Number.isNaN(gstRate)) gstRate = 18;
  return base + (base * gstRate) / 100;
}

/** Permanent Sales History se Overview Total Sales — GST included totalAmount */
async function refreshOverviewSalesFromHistory() {
  const token = getToken();
  if (!token) return null;
  try {
    let total = 0;
    let page = 1;
    let totalPages = 1;
    do {
      const res = await fetch(`${API_URL}/api/sales?limit=100&page=${page}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) break;
      (data.records || []).forEach((r) => {
        total += parseFloat(r.totalAmount) ||
          (parseFloat(r.price) || 0) * (parseFloat(r.qty) || 1);
      });
      totalPages = data.totalPages || 1;
      page += 1;
    } while (page <= totalPages);

    const expenses = (state.expenses || []).reduce(
      (a, e) => a + (parseFloat(e.amount) || 0), 0
    );
    const salesEl = document.getElementById("totalSalesVal");
    if (salesEl) salesEl.textContent = `₹${total.toFixed(2)}`;
    const ovSalesEl = document.getElementById("ovTotalSalesAmt");
    if (ovSalesEl) ovSalesEl.textContent = `₹${total.toFixed(2)}`;
    const netEl = document.getElementById("netProfitVal");
    if (netEl) netEl.textContent = `₹${(total - expenses).toFixed(2)}`;
    return total;
  } catch (e) {
    console.warn("Overview sales refresh:", e);
    return null;
  }
}
window.refreshOverviewSalesFromHistory = refreshOverviewSalesFromHistory;

function calculateFinancials(salesList = [], expenseList = []) {
  let totalSales = 0;
  let totalExpenses = 0;
  let customerLedger = {};

  salesList.forEach(item => {
    const amount = getInvoiceLineGrandTotal(item);
    totalSales += amount;

    const cust = item.customer || "General Customer";
    if (!customerLedger[cust]) {
      customerLedger[cust] = { billed: 0, paid: 0, pending: 0 };
    }
    customerLedger[cust].billed += amount;
    const isCredit = isCreditSale(item);
    const paidAmount = isCredit ? 0 : (parseFloat(item.paidAmount) || amount);
    customerLedger[cust].paid += paidAmount;
    customerLedger[cust].pending = customerLedger[cust].billed - customerLedger[cust].paid;
  });

  expenseList.forEach(exp => {
    totalExpenses += (parseFloat(exp.amount) || 0);
  });

  const netProfit = totalSales - totalExpenses;

  // Overview Cards Update
  if(document.getElementById("totalSalesVal")) 
    document.getElementById("totalSalesVal").innerText = `₹${totalSales.toFixed(2)}`;
  
  if(document.getElementById("totalExpenseVal")) 
    document.getElementById("totalExpenseVal").innerText = `₹${totalExpenses.toFixed(2)}`;

  if(document.getElementById("netProfitVal"))
    document.getElementById("netProfitVal").innerText = `₹${netProfit.toFixed(2)}`;

  refreshUdharKhata(customerLedger);
}

async function refreshUdharKhata(localFallback = {}) {
  const ledgerBody = document.getElementById("ledgerBody");
  if (!ledgerBody) return;

  let udharAllRows = [];

  function paintUdharPage() {
    const pag = window.bkUdharPaginator || (window.bkUdharPaginator = window.bkCreatePaginator("ledgerUdhar", paintUdharPage));
    const rows = pag.slice(udharAllRows);
    ledgerBody.innerHTML = "";
    let totalUdhar = 0;
    let totalRefundDue = 0;
    udharAllRows.forEach((row) => {
      const p = Number(row.pending ?? row.netBalance ?? row.ledgerBalance ?? 0) || 0;
      if (p > 0.01) totalUdhar += p;
      else if (p < -0.01) totalRefundDue += Math.abs(p);
    });
    if (!rows.length) {
      ledgerBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No Udhar Records Found.</td></tr>`;
      if (document.getElementById("totalUdharVal")) document.getElementById("totalUdharVal").innerText = "₹0.00";
      window.bkSetTableAmountTotal(ledgerBody, { hide: true });
      return;
    }
    let pageBilled = 0, pagePaid = 0, pagePending = 0;
    rows.forEach(row => {
      const pending = Number(row.pending ?? row.netBalance ?? row.ledgerBalance ?? 0) || 0;
      const cust = row.partyName || row.customer;
      const billed = row.billed ?? (pending > 0 ? pending : 0);
      const paid = row.paid ?? 0;
      pageBilled += Number(billed) || 0;
      pagePaid += Number(paid) || 0;
      pagePending += pending;
      const fmt = typeof bkFormatDebtorNet === "function" ? bkFormatDebtorNet(pending) : null;
      const pendingColor = pending < -0.01 ? "#0ea5e9" : (pending > 0.01 ? "#f59e0b" : "#22c55e");
      const pendingText = pending < -0.01
        ? `−₹${Math.abs(pending).toFixed(2)}`
        : `₹${pending.toFixed(2)}`;
      const tr = document.createElement("tr");
      tr.innerHTML = `
          <td>${escapeHtml(cust)}</td>
          <td>₹${Number(billed).toFixed(2)}</td>
          <td>₹${Number(paid).toFixed(2)}</td>
          <td style="color: ${pendingColor}; font-weight: bold;" title="${escapeHtml(fmt?.label || "")}">${pendingText}${pending < -0.01 ? " <small>(Refund)</small>" : ""}</td>
          <td class="udhar-actions"></td>`;
      const actions = tr.querySelector(".udhar-actions");
      const viewBtn = document.createElement("button");
      viewBtn.type = "button";
      viewBtn.className = "udhar-view-btn";
      viewBtn.textContent = "View";
      viewBtn.dataset.customer = cust;
      viewBtn.style.cssText = "padding:4px 8px;font-size:12px;border-radius:4px;background:#3b82f6;color:#fff;border:none;cursor:pointer;margin-right:4px;";
      const payBtn = document.createElement("button");
      payBtn.type = "button";
      payBtn.className = "udhar-pay-btn";
      if (pending < -0.01) {
        payBtn.textContent = "Refund Due";
        payBtn.disabled = true;
        payBtn.title = `Refund ₹${Math.abs(pending).toFixed(2)} to customer — use a Payment voucher`;
        payBtn.style.cssText = "padding:4px 8px;font-size:12px;border-radius:4px;background:#0ea5e9;color:#fff;border:none;cursor:not-allowed;opacity:.85;";
      } else {
        payBtn.textContent = "Pay";
        payBtn.dataset.customer = cust;
        payBtn.style.cssText = "padding:4px 8px;font-size:12px;border-radius:4px;background:#22c55e;color:#fff;border:none;cursor:pointer;";
      }
      actions.appendChild(viewBtn);
      actions.appendChild(payBtn);
      ledgerBody.appendChild(tr);
    });
    if (document.getElementById("totalUdharVal")) {
      const totalText = totalRefundDue > 0.01
        ? `Udhar ₹${totalUdhar.toFixed(2)} | Refund −₹${totalRefundDue.toFixed(2)}`
        : `₹${totalUdhar.toFixed(2)}`;
      document.getElementById("totalUdharVal").innerText = totalText;
    }
    let allBilled = 0, allPaid = 0, allPending = 0;
    udharAllRows.forEach((row) => {
      allBilled += Number(row.billed ?? row.pending ?? row.ledgerBalance ?? 0) || 0;
      allPaid += Number(row.paid ?? 0) || 0;
      allPending += Number(row.pending ?? row.ledgerBalance ?? 0) || 0;
    });
    window.bkSetTableAmountTotal(ledgerBody, {
      lines: [
        { label: "Page Billed", amount: pageBilled, color: "#38bdf8" },
        { label: "Page Paid", amount: pagePaid, color: "#22c55e" },
        { label: "Page Pending", amount: pagePending, color: "#f59e0b" }
      ],
      rows: rows.length,
      grand: udharAllRows.length > rows.length ? allPending : null
    });
  }

  function renderUdharRows(rows) {
    udharAllRows = rows.filter((row) => {
      const pending = Number(row.pending ?? row.netBalance ?? row.ledgerBalance ?? 0) || 0;
      return Math.abs(pending) > 0.01;
    });
    if (window.bkUdharPaginator) window.bkUdharPaginator.reset();
    paintUdharPage();
  }

  try {
    const res = await fetch(`${API_URL}/api/reports/outstanding`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.rows?.length) {
        const rows = data.rows.filter((r) => Math.abs(Number(r.pending ?? r.netBalance ?? 0) || 0) > 0.01);
        if (rows.length) return renderUdharRows(rows);
      }
    }
  } catch (e) { /* server se nahi mila to local fallback */ }

  const localRows = Object.keys(localFallback).map(cust => ({
    partyName: cust,
    billed: localFallback[cust].billed,
    paid: localFallback[cust].paid,
    pending: localFallback[cust].pending
  })).filter((r) => Math.abs(Number(r.pending) || 0) > 0.01);
  renderUdharRows(localRows);
}
window.refreshUdharKhata = refreshUdharKhata;
window.calculateFinancials = calculateFinancials;

function bkFormatDetailQtyNum(qty) {
  const n = Number(qty);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.abs(n - Math.round(n)) < 0.001 ? String(Math.round(n)) : n.toFixed(2);
}

function bkParseQtyFromText(text) {
  const t = String(text || "");
  let m = t.match(/\bx(\d+(?:\.\d+)?)\b/i);
  if (m) return bkFormatDetailQtyNum(m[1]);
  m = t.match(/(?:qty|quantity)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i);
  if (m) return bkFormatDetailQtyNum(m[1]);
  m = t.match(/\|\s*[^|]*?\sx(\d+(?:\.\d+)?)\b/i);
  if (m) return bkFormatDetailQtyNum(m[1]);
  return null;
}

function bkCustomerDetailQty(h) {
  if (h.qty != null && h.qty !== "" && h.qty !== "—") return String(h.qty);
  const parsed = bkParseQtyFromText(h.note || h.product || h.label || "");
  if (parsed) return parsed;
  const vt = String(h.voucherType || "");
  const st = String(h.status || "");
  if (vt === "Payment" || st === "Received") return "—";
  if (vt === "Sale" || vt === "Sales") return "1";
  return "—";
}

async function showUdharDetail(customerName) {
  const modal = document.getElementById("udharDetailModal");
  const title = document.getElementById("udharDetailTitle");
  const body = document.getElementById("udharDetailBody");
  if (!modal || !body) {
    showToast("View modal failed to load — press Ctrl+Shift+R to refresh the page.", "error");
    return;
  }

  modal.classList.remove("hidden");
  if (title) title.textContent = `📖 ${customerName} — loading...`;
  body.innerHTML = `<tr><td colspan="5" style="text-align:center;">Loading...</td></tr>`;

  let rows = [];
  let totalBilled = 0;
  let totalPaid = 0;
  let totalReturns = 0;
  let pending = 0;

  try {
    const token = getToken();
    const hdrs = { Authorization: `Bearer ${token}` };
    const ledRes = await fetch(`${API_URL}/api/ledgers`, { headers: hdrs });
    const ledData = await ledRes.json();
    const ledger = (ledData.ledgers || []).find(
      (l) => String(l.partyName || "").trim().toLowerCase() === String(customerName || "").trim().toLowerCase()
    );

    if (ledger?._id && ledger.ledgerGroup === "Sundry Debtor") {
      const stRes = await fetch(`${API_URL}/api/ledger-statement/${ledger._id}`, { headers: hdrs });
      const stData = await stRes.json();
      if (stData.success) {
        pending = Number(stData.netBalance ?? stData.pendingUdhar ?? stData.currentBalance ?? 0) || 0;
        (stData.history || []).forEach((h) => {
          const amt = Number(h.amount) || 0;
          const effect = Number(h.udharEffect) || 0;
          const typeLabel = typeof bkVoucherTypeLabel === "function"
            ? bkVoucherTypeLabel(h.voucherType)
            : h.voucherType;
          const isReturn = h.voucherType === "Credit Note" || h.status === "Returned";
          const isPayment = h.status === "Received" || h.voucherType === "Payment";
          const isCashSale = h.voucherType === "Sale" && h.status === "Paid";

          if (h.voucherType === "Sale" || h.voucherType === "Sales") {
            totalBilled += amt;
            if (isCashSale) totalPaid += amt;
          } else if (isReturn) {
            totalReturns += amt;
          } else if (isPayment) {
            totalPaid += amt;
          }

          rows.push({
            label: `${new Date(h.date).toLocaleDateString("en-IN")} — ${typeLabel}${h.note && h.note !== "-" ? ` (${h.note})` : ""}`,
            qty: bkCustomerDetailQty(h),
            amt: isReturn ? 0 : amt,
            paid: isPayment || isCashSale ? amt : (isReturn ? amt : 0),
            pending: effect,
            isPayment,
            isReturn,
            runningBalance: h.runningBalance
          });
        });
      }
    }

    if (!rows.length) {
      const [salesRes, payRes] = await Promise.all([
        fetch(`${API_URL}/api/sales?search=${encodeURIComponent(customerName)}&limit=100`, { headers: hdrs }),
        fetch(`${API_URL}/api/payments?customer=${encodeURIComponent(customerName)}`, { headers: hdrs })
      ]);
      const salesData = await salesRes.json();
      const payData = await payRes.json();

      if (salesData.records?.length) {
        salesData.records.forEach((r) => {
          const amt = r.totalAmount || (parseFloat(r.price) || 0) * (parseFloat(r.qty) || 1);
          const isCredit = isCreditSale(r);
          const paid = isCredit ? 0 : amt;
          totalBilled += amt;
          totalPaid += paid;
          rows.push({
            label: `${new Date(r.date).toLocaleDateString()} — ${r.product || "Sale"}`,
            qty: bkFormatDetailQtyNum(r.qty) || bkParseQtyFromText(r.product) || "1",
            amt, paid, pending: isCredit ? amt : 0
          });
        });
      }

      if (payData.payments?.length) {
        payData.payments.forEach((p) => {
          totalPaid += p.amount;
          rows.push({
            label: `${new Date(p.date).toLocaleDateString()} — Payment (${p.paymentMode || "Cash"})`,
            qty: "—",
            amt: 0, paid: p.amount, pending: -p.amount,
            isPayment: true
          });
        });
      }
      pending = Math.round((totalBilled - totalReturns - totalPaid) * 100) / 100;
    }
  } catch (e) {
    console.warn("Udhar detail API:", e);
  }

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="5" style="text-align:center;">No transactions found.</td></tr>`;
    window.bkSetTableAmountTotal(body, { hide: true });
  } else {
    body.innerHTML = rows.map((r) => {
      const rowStyle = r.isPayment
        ? "background:rgba(34,197,94,.08)"
        : (r.isReturn ? "background:rgba(251,191,36,.08)" : "");
      const fmtSigned = (n) => {
        const v = Number(n) || 0;
        if (Math.abs(v) <= 0.01) return "₹0.00";
        return v < 0 ? `−₹${Math.abs(v).toFixed(2)}` : `₹${v.toFixed(2)}`;
      };
      const pendingCell = r.runningBalance != null
        ? fmtSigned(r.runningBalance)
        : (r.pending !== 0 ? fmtSigned(r.pending) : "—");
      return `
      <tr style="${rowStyle}">
        <td>${escapeHtml(r.label)}</td>
        <td>${escapeHtml(String(r.qty ?? "—"))}</td>
        <td>${r.amt ? "₹" + r.amt.toFixed(2) : "—"}</td>
        <td>${r.paid ? (r.isReturn ? "−₹" + r.paid.toFixed(2) : "₹" + r.paid.toFixed(2)) : "—"}</td>
        <td>${pendingCell}</td>
      </tr>`;
    }).join("");
  }

  if (rows.length) {
    const summaryLines = [
      { label: "Total Billed", amount: totalBilled, color: "#38bdf8" }
    ];
    if (totalReturns > 0) {
      summaryLines.push({ label: "Sales Return", amount: totalReturns, color: "#fbbf24" });
    }
    const pendingLabel = pending < -0.01 ? "Refund Due (Net)" : "Net Udhar";
    const pendingColor = pending < -0.01 ? "#0ea5e9" : (pending > 0.01 ? "#f59e0b" : "#22c55e");
    summaryLines.push(
      { label: "Total Paid", amount: totalPaid, color: "#22c55e" },
      { label: pendingLabel, amount: Math.abs(pending), color: pendingColor, signed: pending }
    );
    window.bkSetTableAmountTotal(body, { lines: summaryLines, rows: rows.length });
  }
  const titleFmt = typeof bkFormatDebtorNet === "function" ? bkFormatDebtorNet(pending) : null;
  if (title) {
    title.textContent = titleFmt && !titleFmt.clear
      ? `📖 ${customerName} — ${titleFmt.label}`
      : `📖 ${customerName} — Paid / Clear`;
  }

  modal.dataset.customer = customerName;
}
window.showUdharDetail = showUdharDetail;

function printUdharDetail() {
  const modal = document.getElementById("udharDetailModal");
  if (!modal || modal.classList.contains("hidden")) {
    showToast("Open a customer detail view first.", "info");
    return;
  }
  const titleText = document.getElementById("udharDetailTitle")?.textContent?.replace(/^📖\s*/, "") || "Customer Detail";
  const table = modal.querySelector("#udharDetailBody")?.closest("table");
  const bar = modal.querySelector(".table-amount-total-bar:not(.hidden)");
  if (!table) {
    showToast("Nothing to print.", "info");
    return;
  }
  let company = "BolKarigar";
  try {
    const prof = JSON.parse(localStorage.getItem("bolkarigar_company_profile") || localStorage.getItem("company_profile") || localStorage.getItem("business_profile") || "{}");
    company = prof.companyName || prof.name || company;
  } catch (_) { /* ignore */ }
  const printedAt = new Date().toLocaleString("en-IN");
  const tableClone = table.cloneNode(true);
  tableClone.querySelectorAll("script, style").forEach((el) => el.remove());
  const tableHtml = tableClone.outerHTML;
  let barHtml = "";
  if (bar) {
    barHtml = `<div class="print-totals">${bar.innerHTML}</div>`;
  }
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${escapeHtml(titleText)}</title>
<style>
  body{font-family:Segoe UI,system-ui,sans-serif;margin:24px;color:#0f172a;background:#fff;}
  h1{font-size:18px;margin:0 0 4px;}
  .meta{font-size:12px;color:#64748b;margin-bottom:16px;}
  table{width:100%;border-collapse:collapse;font-size:13px;}
  th,td{border:1px solid #cbd5e1;padding:8px 10px;text-align:left;}
  th{background:#f1f5f9;font-weight:700;}
  .print-totals{margin-top:14px;padding:12px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;}
  .print-totals .table-total-row{display:flex;justify-content:space-between;margin:4px 0;gap:12px;}
  .print-totals strong{color:#0f172a!important;}
  @media print{body{margin:12px;}}
</style></head><body>
  <h1>${escapeHtml(titleText)}</h1>
  <p class="meta">${escapeHtml(company)} · Printed ${escapeHtml(printedAt)}</p>
  ${tableHtml}
  ${barHtml}
</body></html>`;

  const openPrintWindow = () => {
    const w = window.open("", "_blank");
    if (!w) return null;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    return w;
  };

  let printWin = openPrintWindow();
  if (!printWin) {
    try {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      printWin = window.open(url, "_blank");
      if (printWin) {
        setTimeout(() => URL.revokeObjectURL(url), 120000);
      }
    } catch (_) { /* fallback failed */ }
  }
  if (!printWin) {
    showToast("Please allow pop-ups to print.", "error");
    return;
  }
  const triggerPrint = () => {
    try {
      printWin.focus();
      printWin.print();
    } catch (e) {
      showToast("Could not open print dialog. Use browser menu → Print on the new tab.", "info");
    }
  };
  if (printWin.document?.readyState === "complete") {
    setTimeout(triggerPrint, 300);
  } else {
    printWin.onload = () => setTimeout(triggerPrint, 200);
    setTimeout(triggerPrint, 800);
  }
}
window.printUdharDetail = printUdharDetail;

function setupUdharLedgerClicks() {
  const ledgerBody = document.getElementById("ledgerBody");
  if (!ledgerBody || ledgerBody.dataset.clickBound) return;
  ledgerBody.dataset.clickBound = "1";
  ledgerBody.addEventListener("click", (e) => {
    const viewBtn = e.target.closest(".udhar-view-btn");
    const payBtn = e.target.closest(".udhar-pay-btn");
    if (viewBtn?.dataset.customer) {
      e.preventDefault();
      showUdharDetail(viewBtn.dataset.customer);
    }
    if (payBtn?.dataset.customer && typeof window.openUdharPayment === "function") {
      e.preventDefault();
      window.openUdharPayment(payBtn.dataset.customer);
    }
  });
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupUdharLedgerClicks);
} else {
  setupUdharLedgerClicks();
}

document.addEventListener("DOMContentLoaded", () => {
  // 🟢 NAYA: Business Profile modal open/close — Invoice tab se nikal ke
  // ab topbar ke "🏢 Business Profile" button se khulta hai.
  document.getElementById("businessProfileBtn")?.addEventListener("click", () => {
    document.getElementById("businessProfileModal")?.classList.remove("hidden");
  });
  document.getElementById("closeBusinessProfileModal")?.addEventListener("click", () => {
    document.getElementById("businessProfileModal")?.classList.add("hidden");
  });
  document.getElementById("businessProfileModal")?.addEventListener("click", (e) => {
    if (e.target.id === "businessProfileModal") e.target.classList.add("hidden");
  });

  document.getElementById("udharDetailPrintBtn")?.addEventListener("click", () => {
    if (typeof printUdharDetail === "function") printUdharDetail();
  });
  document.getElementById("closeUdharDetailBtn")?.addEventListener("click", () => {
    document.getElementById("udharDetailModal")?.classList.add("hidden");
  });
  document.getElementById("udharDetailModal")?.addEventListener("click", (e) => {
    if (e.target.id === "udharDetailModal") e.target.classList.add("hidden");
  });
  document.getElementById("udharPaymentModal")?.addEventListener("click", (e) => {
    if (e.target.id === "udharPaymentModal") e.target.classList.add("hidden");
  });
});
// ================= TALLY STYLE PRINT ENGINE =================
// ================= EXACT TALLY PRIME STYLE PRINT ENGINE =================

// ==========================================================================
// 🟢 PROFESSIONAL TAX INVOICE (e-Invoice style print) — matches Tally
// Prime/GST e-Invoice layout: IRN block, QR code, Consignee+Buyer sections,
// HSN-wise tax summary, amount in words.
//
// ⚠️ IMPORTANT (padhna zaroori hai): Asli e-Invoice ka IRN/QR/Ack No.
// sirf Government ke official GST e-Invoice Portal (IRP) se milta hai,
// jab business GSP/API ke through invoice register karaata hai. Yeh app
// koi government portal se connected NAHI hai, isliye neeche wala
// IRN/Ack No./QR sirf ek LOCAL REFERENCE NUMBER hai (visually professional
// dikhne ke liye) — yeh ek legally-valid, government-verified e-Invoice
// NAHI hai. Print pe ek chhota "Reference Copy" note isliye laga hai.
// Agar business turnover GST e-Invoicing ke liye mandatory range me hai,
// asli IRN ke liye apne GSP (jaise ClearTax, Zoho, waghera) se register
// karna hoga.
// ==========================================================================

function generateRandomIRN() {
  // 64 hex characters — asli IRN jaisa DIKHTA hai, lekin yeh sirf ek local
  // random reference hai, government portal se generate/verify nahi hua.
  const bytes = new Uint8Array(32);
  (window.crypto || window.msCrypto).getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

function generateAckNo() {
  // 12-digit random reference acknowledgement number (local only)
  let num = "";
  for (let i = 0; i < 12; i++) num += Math.floor(Math.random() * 10);
  return num;
}

async function getNextInvoiceNumber(companyName) {
  try {
    const res = await fetch(`${API_URL}/api/invoices/next-number`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.invoiceNo) return data.invoiceNo;
    }
  } catch (e) {
    console.warn('Server invoice number fallback:', e);
  }
  const key = "bolkarigar_invoice_counter_" + (companyName || "default").replace(/\s+/g, "_");
  let counter = parseInt(localStorage.getItem(key) || "0", 10) + 1;
  localStorage.setItem(key, counter.toString());
  const prefix = (companyName || "INV").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 4) || "INV";
  const year = new Date().getFullYear().toString().slice(-2);
  return `${prefix}/${counter}/${year}`;
}

function bkFormatBusyInvoiceDate(value) {
  const dt = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(dt.getTime())) return "-";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${dt.getFullYear()}`;
}

function bkAmountInWordsRupees(num) {
  const n = Math.round(parseFloat(num) || 0);
  if (!n) return "Rupees Zero Only";
  const a = ["", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ", "Ten ",
    "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen "];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function inWords(x) {
    const numStr = Math.floor(x).toString();
    if (numStr.length > 9) return "Amount Too Large";
    const nArray = ("000000000" + numStr).slice(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!nArray) return "";
    let str = "";
    str += (nArray[1] != 0) ? (a[Number(nArray[1])] || b[nArray[1][0]] + " " + a[nArray[1][1]]) + "Crore " : "";
    str += (nArray[2] != 0) ? (a[Number(nArray[2])] || b[nArray[2][0]] + " " + a[nArray[2][1]]) + "Lakh " : "";
    str += (nArray[3] != 0) ? (a[Number(nArray[3])] || b[nArray[3][0]] + " " + a[nArray[3][1]]) + "Thousand " : "";
    str += (nArray[4] != 0) ? (a[Number(nArray[4])] || b[nArray[4][0]] + " " + a[nArray[4][1]]) + "Hundred " : "";
    str += (nArray[5] != 0) ? ((str !== "") ? "and " : "") + (a[Number(nArray[5])] || b[nArray[5][0]] + " " + a[nArray[5][1]]) : "";
    return str.trim();
  }
  return "Rupees " + (inWords(n) || "Zero") + " Only";
}

function bkBusyMoney(n) {
  return Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function bkBusyPlaceOfSupply(profile) {
  const state = deriveCompanyStateFromProfile(profile || {});
  const code = String(profile?.gstin || "").trim().slice(0, 2);
  if (state && code) return `${state} (${code})`;
  return state || code || "-";
}

function bkComputeBusyInvoiceLines(rawItems, opts) {
  const gstOn = !!opts?.gstOn;
  const isIntraState = opts?.isIntraState !== false;
  const lines = [];
  const rateSummary = {};
  let totalQty = 0;
  let grandTotal = 0;

  rawItems.forEach((item, index) => {
    const qty = parseFloat(item.qty) || 1;
    const price = parseFloat(item.price) || 0;
    const unit = item.unit || "Pcs";
    const gstRate = gstOn ? (parseFloat(item.gstRate) || 0) : 0;
    const base = price * qty;
    let cgstRate = 0;
    let sgstRate = 0;
    let cgstAmt = 0;
    let sgstAmt = 0;
    let igstAmt = 0;

    if (gstRate > 0 && isIntraState) {
      cgstRate = gstRate / 2;
      sgstRate = gstRate / 2;
      cgstAmt = (base * cgstRate) / 100;
      sgstAmt = (base * sgstRate) / 100;
    } else if (gstRate > 0) {
      igstAmt = (base * gstRate) / 100;
    }

    const lineTotal = parseFloat(item.totalAmount) || base + cgstAmt + sgstAmt + igstAmt;
    totalQty += qty;
    grandTotal += lineTotal;

    lines.push({
      sn: index + 1,
      product: item.product || "Sales Account",
      hsn: item.hsn || "-",
      qty,
      unit,
      price,
      base,
      cgstRate,
      cgstAmt,
      sgstRate,
      sgstAmt,
      igstRate: gstRate,
      igstAmt,
      lineTotal,
      gstRate
    });

    if (gstRate > 0) {
      const key = String(gstRate);
      if (!rateSummary[key]) rateSummary[key] = { rate: gstRate, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
      rateSummary[key].taxable += base;
      rateSummary[key].cgst += cgstAmt;
      rateSummary[key].sgst += sgstAmt;
      rateSummary[key].igst += igstAmt;
    }
  });

  return { lines, rateSummary, totalQty, grandTotal };
}

function bkBuildBusyInvoicePayload(opts) {
  const profile = opts.profile || {};
  const buyer = opts.buyer || {};
  const gstOn = opts.gstOn !== false;
  const taxMode = resolveGstTaxMode(profile, buyer.state, buyer.pincode);
  const isIntraState = gstOn ? (opts.isIntraState ?? taxMode.isIntraState) : true;
  const computed = bkComputeBusyInvoiceLines(opts.items || [], { gstOn, isIntraState });
  const companyState = deriveCompanyStateFromProfile(profile);
  const totalTax = computed.lines.reduce((s, l) => s + l.cgstAmt + l.sgstAmt + l.igstAmt, 0);

  return {
    companyName: profile.name || "Your Company Name",
    companyCity: (companyState || "").toUpperCase(),
    companyGstin: profile.gstin || "",
    companyAddress: profile.address || "",
    buyerName: buyer.name || "Customer",
    buyerGstin: buyer.gstin || "",
    buyerAddress: buyer.address || "",
    invoiceNo: opts.invoiceNo || "-",
    invoiceDate: bkFormatBusyInvoiceDate(opts.invoiceDate || new Date()),
    placeOfSupply: opts.placeOfSupply || bkBusyPlaceOfSupply(profile),
    reverseCharge: "N",
    paymentType: opts.paymentType || "",
    copyLabel: opts.copyLabel || "Original Copy",
    gstOn,
    isIntraState,
    jurisdiction: companyState || "Local",
    ...computed,
    totalTax,
    amountWords: bkAmountInWordsRupees(computed.grandTotal)
  };
}

function bkRenderBusyTaxInvoiceHtml(p) {
  const esc = (v) => escapeHtml(String(v ?? ""));
  const itemRows = p.lines.map((line) => {
    if (p.gstOn && !p.isIntraState) {
      return `<tr>
        <td class="c">${line.sn}</td>
        <td>${esc(line.product)}</td>
        <td class="c">${esc(line.hsn)}</td>
        <td class="r">${bkBusyMoney(line.qty)}</td>
        <td class="c">${esc(line.unit)}</td>
        <td class="r">${bkBusyMoney(line.price)}</td>
        <td class="c">${line.igstRate ? line.igstRate + "%" : ""}</td>
        <td class="r">${line.igstAmt ? bkBusyMoney(line.igstAmt) : ""}</td>
        <td class="r b">${bkBusyMoney(line.lineTotal)}</td>
      </tr>`;
    }
    return `<tr>
      <td class="c">${line.sn}</td>
      <td>${esc(line.product)}</td>
      <td class="c">${esc(line.hsn)}</td>
      <td class="r">${bkBusyMoney(line.qty)}</td>
      <td class="c">${esc(line.unit)}</td>
      <td class="r">${bkBusyMoney(line.price)}</td>
      <td class="c">${p.gstOn && line.cgstRate ? line.cgstRate + "%" : ""}</td>
      <td class="r">${p.gstOn && line.cgstAmt ? bkBusyMoney(line.cgstAmt) : ""}</td>
      <td class="c">${p.gstOn && line.sgstRate ? line.sgstRate + "%" : ""}</td>
      <td class="r">${p.gstOn && line.sgstAmt ? bkBusyMoney(line.sgstAmt) : ""}</td>
      <td class="r b">${bkBusyMoney(line.lineTotal)}</td>
    </tr>`;
  }).join("");

  const itemHead = (p.gstOn && !p.isIntraState)
    ? `<tr>
        <th>S.N.</th><th>Description of Goods</th><th>HSN/SAC<br>Code</th><th>Qty</th><th>Unit</th><th>Price</th>
        <th colspan="2">IGST</th><th>Amount</th>
      </tr>
      <tr><th></th><th></th><th></th><th></th><th></th><th></th><th>Rate</th><th>Amount</th><th></th></tr>`
    : `<tr>
        <th>S.N.</th><th>Description of Goods</th><th>HSN/SAC<br>Code</th><th>Qty</th><th>Unit</th><th>Price</th>
        <th colspan="2">CGST</th><th colspan="2">SGST</th><th>Amount</th>
      </tr>
      <tr><th></th><th></th><th></th><th></th><th></th><th></th><th>Rate</th><th>Amount</th><th>Rate</th><th>Amount</th><th></th></tr>`;

  const totalCols = (p.gstOn && !p.isIntraState) ? 9 : 11;
  const gstSummaryRows = Object.keys(p.rateSummary).sort((a, b) => parseFloat(a) - parseFloat(b)).map((key) => {
    const row = p.rateSummary[key];
    const totalTax = row.cgst + row.sgst + row.igst;
    if (p.gstOn && !p.isIntraState) {
      return `<tr>
        <td class="c">${row.rate}%</td>
        <td class="r">${bkBusyMoney(row.taxable)}</td>
        <td class="r">${bkBusyMoney(row.igst)}</td>
        <td class="r">${bkBusyMoney(totalTax)}</td>
      </tr>`;
    }
    return `<tr>
      <td class="c">${row.rate}%</td>
      <td class="r">${bkBusyMoney(row.taxable)}</td>
      <td class="r">${bkBusyMoney(row.cgst)}</td>
      <td class="r">${bkBusyMoney(row.sgst)}</td>
      <td class="r">${bkBusyMoney(totalTax)}</td>
    </tr>`;
  }).join("");

  const gstSummaryHead = (p.gstOn && !p.isIntraState)
    ? `<tr><th>Tax Rate</th><th>Taxable Amt.</th><th>IGST Amt.</th><th>Total Tax</th></tr>`
    : `<tr><th>Tax Rate</th><th>Taxable Amt.</th><th>CGST Amt.</th><th>SGST Amt.</th><th>Total Tax</th></tr>`;

  const gstSummaryBlock = p.gstOn && gstSummaryRows
    ? `<table class="busy tbl gst-sum">
        <caption>GST Summary</caption>
        <thead>${gstSummaryHead}</thead>
        <tbody>${gstSummaryRows}</tbody>
      </table>`
    : "";

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Tax Invoice - ${esc(p.invoiceNo)}</title>
<style>
  @page { size: A4; margin: 8mm; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 10px; font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #000; background: #fff; }
  .busy-wrap { position: relative; max-width: 210mm; margin: 0 auto; border: 1px solid #000; padding: 8px 10px 12px; }
  .busy-wrap::before {
    content: "BolKarigar"; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    font-size: 52px; font-weight: 700; color: rgba(0,0,0,0.04); transform: rotate(-32deg); pointer-events: none; z-index: 0;
  }
  .busy-wrap > * { position: relative; z-index: 1; }
  .busy-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
  .busy-title { text-align: center; font-size: 14px; font-weight: 700; letter-spacing: 0.5px; margin: 2px 0; }
  .busy-company { text-align: center; font-size: 13px; font-weight: 700; margin-top: 2px; text-transform: uppercase; }
  .busy-city { text-align: center; font-size: 11px; font-weight: 700; margin-bottom: 6px; text-transform: uppercase; }
  .busy.tbl { width: 100%; border-collapse: collapse; margin-top: 4px; }
  .busy.tbl th, .busy.tbl td { border: 1px solid #000; padding: 3px 4px; vertical-align: top; }
  .busy.tbl th { font-weight: 700; text-align: center; background: #fff; }
  .busy.tbl caption { caption-side: top; text-align: left; font-weight: 700; padding: 2px 0; }
  .c { text-align: center; } .r { text-align: right; } .b { font-weight: 700; }
  .party td { width: 50%; height: 48px; }
  .words { margin-top: 6px; font-weight: 700; }
  .terms { margin-top: 8px; font-size: 9px; line-height: 1.45; }
  .sign { display: flex; justify-content: space-between; margin-top: 18px; min-height: 70px; align-items: flex-end; }
  .sign-right { text-align: right; }
  .total-row td { font-weight: 700; }
</style></head>
<body onload="window.print()">
  <div class="busy-wrap">
    <div class="busy-top">
      <div><strong>GSTIN :</strong> ${esc(p.companyGstin) || "&nbsp;"}</div>
      <div><strong>${esc(p.copyLabel)}</strong></div>
    </div>
    <div class="busy-title">TAX INVOICE</div>
    <div class="busy-company">${esc(p.companyName)}</div>
    <div class="busy-city">${esc(p.companyCity)}</div>

    <table class="busy tbl meta">
      <tr>
        <td><strong>Invoice No. :</strong> ${esc(p.invoiceNo)}</td>
        <td><strong>Dated :</strong> ${esc(p.invoiceDate)}</td>
        <td><strong>Place of Supply :</strong> ${esc(p.placeOfSupply)}</td>
        <td><strong>Reverse Charge :</strong> ${esc(p.reverseCharge)}</td>
      </tr>
    </table>

    <table class="busy tbl party">
      <tr>
        <td><strong>Billed to :</strong><br>${esc(p.buyerName)}<br>${esc(p.buyerAddress)}<br><strong>GSTIN / UIN :</strong> ${esc(p.buyerGstin) || ""}</td>
        <td><strong>Shipped to :</strong><br>${esc(p.buyerName)}<br>${esc(p.buyerAddress)}<br><strong>GSTIN / UIN :</strong> ${esc(p.buyerGstin) || ""}</td>
      </tr>
    </table>

    <table class="busy tbl items">
      <thead>${itemHead}</thead>
      <tbody>
        ${itemRows}
        <tr class="total-row">
          <td colspan="3" class="r">Total</td>
          <td class="r">${bkBusyMoney(p.totalQty)}</td>
          <td colspan="${totalCols - 5}" class="r"></td>
          <td class="r">${bkBusyMoney(p.grandTotal)}</td>
        </tr>
      </tbody>
    </table>

    ${gstSummaryBlock}

    <div class="words">${esc(p.amountWords)}</div>

    <div class="terms">
      <strong>Terms &amp; Conditions</strong><br>
      1. Goods once sold will not be taken back.<br>
      2. Interest @ 18% p.a. will be charged if the payment is not made within the stipulated time.<br>
      3. All disputes are subject to '${esc(p.jurisdiction)}' Jurisdiction only.<br>
      4. Any discrepancy whatsoever must be intimated in writing within 7 days.<br>
      5. E. &amp; O.E.
    </div>

    <div class="sign">
      <div><em>Receiver's Signature</em></div>
      <div class="sign-right">
        <div>for <strong>${esc(p.companyName)}</strong></div>
        <br><br>
        <div><em>Authorised Signatory</em></div>
      </div>
    </div>
  </div>
</body></html>`;
}

function bkOpenTaxInvoicePrint(html, title) {
  const w = window.open("", "_blank");
  if (!w) {
    alert("Please allow pop-ups in your browser to print the invoice!");
    return false;
  }
  w.document.write(html);
  w.document.close();
  return true;
}

async function printTallyBill(ev) {
  const printBtn = ev?.currentTarget || document.getElementById("savePrintInvoiceBtn");

  // 1. LocalStorage se saved company profile data fetch karein
  let savedProfile = {};
  try {
    savedProfile = JSON.parse(localStorage.getItem("bolkarigar_company_profile")) || {};
  } catch (e) {
    savedProfile = {};
  }

  const companyName = savedProfile.name || (typeof state !== 'undefined' && state.company?.name) || "Your Company Name";
  const companyAddress = savedProfile.address || (typeof state !== 'undefined' && state.company?.address) || "";
  const companyStateDisplay = deriveCompanyStateFromProfile(savedProfile);
  const companyPincodeDisplay = savedProfile.state || extractPincode(savedProfile.address) || "";
  const companyGstin = savedProfile.gstin || (typeof state !== 'undefined' && state.company?.gstin) || "";
  const companyPhone = savedProfile.phone || (typeof state !== 'undefined' && state.company?.phone) || "";
  const companyUpi = savedProfile.upiId || savedProfile.upi || (typeof state !== 'undefined' && state.company?.upiId) || "";

  const customer = document.getElementById("customerName")?.value.trim() || "Customer Name";
  const customerGstin = document.getElementById("customerGstin")?.value.trim() || "";
  const customerAddress = document.getElementById("customerAddress")?.value.trim() || "";
  const customerState = document.getElementById("buyerState")?.value.trim() || "";
  const customerPincode = document.getElementById("buyerPincode")?.value.trim() || "";

  const taxMode = resolveGstTaxMode(savedProfile, customerState, customerPincode);
  const gstOnBill = isInvoiceGstEnabled();

  if (gstOnBill) {
    if (!customerState && !extractPincode(customerPincode)) {
      alert("⚠️ Please enter buyer State and 6-digit Pincode for correct CGST+SGST or IGST.\n\nOr turn GST OFF to print a tax-free bill.");
      return;
    }
    if (!taxMode.companyState) {
      alert("⚠️ Please update state/address in Business Profile (e.g. BMG Mall Rewari, Haryana).");
      return;
    }
  }

  const statusEl = document.getElementById("invoiceStatus");
  if (statusEl) {
    statusEl.textContent = "⏳ Saving & preparing print...";
    statusEl.style.color = "#fbbf24";
  }

  return window.bkWithSaveLock(printBtn, async () => {
  let invoiceNo = getInvoiceDraftNumber();
  if (!_invoiceNoUserEdited || !invoiceNo) {
    invoiceNo = await getNextInvoiceNumber(companyName);
  }

  if (!invoiceLineItems.length) {
    alert("At least one item is required in the invoice to print.");
    return;
  }

  const defaultUnit = document.getElementById("productUnitTag")?.textContent?.trim() || "Pcs";
  const printItems = invoiceLineItems.map((item) => ({
    product: item.product,
    hsn: item.hsn,
    qty: item.qty,
    price: item.price,
    gstRate: getInvoiceLineGstRate(item.gstRate),
    unit: item.unit || defaultUnit
  }));

  const payload = bkBuildBusyInvoicePayload({
    profile: {
      name: companyName,
      address: companyAddress,
      gstin: companyGstin,
      phone: companyPhone,
      state: companyPincodeDisplay
    },
    buyer: {
      name: customer,
      gstin: customerGstin,
      address: customerAddress,
      state: customerState,
      pincode: customerPincode
    },
    items: printItems,
    invoiceNo,
    invoiceDate: getInvoiceSelectedDate(),
    gstOn: gstOnBill,
    isIntraState: taxMode.isIntraState,
    paymentType: document.getElementById("invoicePaymentType")?.value || "Cash"
  });

  bkOpenTaxInvoicePrint(bkRenderBusyTaxInvoiceHtml(payload), `Tax Invoice - ${invoiceNo}`);
  }, {
    alsoLock: ["saveInvoiceBtn"],
    loadingText: "⏳ Saving...",
    minLockMs: 1000
  });
}

window.printTallyBill = printTallyBill;

async function downloadInvoiceBill() {
  if (!invoiceLineItems.length) {
    if (typeof showToast === "function") showToast("Please add at least one item first.", "error");
    else alert("At least one item is required in the invoice to download.");
    return;
  }
  await printTallyBill();
  if (typeof showToast === "function") {
    showToast("In the print dialog, choose 'Save as PDF' to download the invoice.", "info");
  }
}

window.downloadInvoiceBill = downloadInvoiceBill;

async function printThermalBill() {
  let savedProfile = {};
  try { savedProfile = JSON.parse(localStorage.getItem("bolkarigar_company_profile")) || {}; } catch { /* */ }
  const companyName = savedProfile.name || "Shop";
  const customer = document.getElementById("customerName")?.value.trim() || "Customer";
  const grandTotal = document.getElementById("grandTotal")?.textContent || "0.00";
  let invoiceNo = getInvoiceDraftNumber();
  if (!invoiceNo) invoiceNo = await getNextInvoiceNumber(companyName);
  const date = getInvoiceSelectedDate().toLocaleDateString("en-IN");
  let lines = "";
  invoiceLineItems.forEach((item) => {
    const sub = (item.price || 0) * (item.qty || 1);
    lines += `<tr><td>${item.product}</td><td style="text-align:right">${item.qty}</td><td style="text-align:right">₹${sub.toFixed(2)}</td></tr>`;
  });
  const upi = savedProfile.upiId || "";
  const w = window.open("", "_blank", "width=320,height=600");
  if (!w) { alert("Please allow pop-ups for thermal printing."); return; }
  w.document.write(`<!DOCTYPE html><html><head><title>Thermal Bill</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
    <style>@page{size:58mm auto;margin:2mm;}body{width:58mm;font-family:monospace;font-size:11px;margin:0;padding:4px;}
    table{width:100%;border-collapse:collapse;}td{padding:2px 0;}hr{border:none;border-top:1px dashed #000;margin:6px 0;}
    .c{text-align:center;}.r{text-align:right;}</style></head>
    <body onload="${upi ? `new QRCode(document.getElementById('tq'),{text:'upi://pay?pa=${encodeURIComponent(upi)}&am=${parseFloat(grandTotal.replace(/,/g,''))||0}&cu=INR',width:80,height:80});` : ''}window.print();">
    <div class="c"><strong>${companyName}</strong><br>${date}<br>Bill: ${invoiceNo}</div><hr>
    <div>Customer: ${customer}</div><hr>
    <table>${lines || '<tr><td>Item</td><td></td><td class="r">₹'+grandTotal+'</td></tr>'}</table><hr>
    <div class="r"><strong>TOTAL: ₹${grandTotal}</strong></div>
    ${upi ? `<div class="c"><div id="tq"></div><small>UPI: ${upi}</small></div>` : ''}
    <div class="c"><small>BolKarigar</small></div></body></html>`);
  w.document.close();
}
window.printThermalBill = printThermalBill;

async function printSavedSaleBill(saleId) {
  if (!saleId) return;
  try {
    if (typeof showToast === "function") showToast("Preparing bill for print...", "info");
    const hdrs = { Authorization: `Bearer ${getToken()}` };
    const res = await fetch(`${API_URL}/api/sales/${saleId}`, { headers: hdrs });
    const data = await res.json();
    if (!data.success || !data.record) throw new Error(data.error || "Sale record not found.");

    const anchor = data.record;
    let items = [anchor];
    if (anchor.invoiceNo) {
      const listRes = await fetch(
        `${API_URL}/api/sales?search=${encodeURIComponent(anchor.invoiceNo)}&limit=100`,
        { headers: hdrs }
      );
      const listData = await listRes.json();
      const matched = (listData.records || []).filter(
        (r) => String(r.invoiceNo || "") === String(anchor.invoiceNo)
      );
      if (matched.length) items = matched;
    }

    let savedProfile = {};
    try { savedProfile = JSON.parse(localStorage.getItem("bolkarigar_company_profile") || "{}"); } catch { /* */ }

    const gstOn = items.some((item) => (parseFloat(item.gstRate) || 0) > 0);
    const printItems = items.map((item) => ({
      product: item.product,
      hsn: item.hsn,
      qty: item.qty,
      price: item.price,
      gstRate: item.gstRate,
      totalAmount: item.totalAmount,
      unit: item.unit || "Pcs"
    }));

    const payload = bkBuildBusyInvoicePayload({
      profile: savedProfile,
      buyer: {
        name: anchor.customer || "Customer",
        gstin: "",
        address: "",
        state: "",
        pincode: ""
      },
      items: printItems,
      invoiceNo: anchor.invoiceNo || "-",
      invoiceDate: anchor.date,
      gstOn,
      paymentType: anchor.paymentType || "Cash",
      copyLabel: "Duplicate Copy"
    });

    if (!bkOpenTaxInvoicePrint(
      bkRenderBusyTaxInvoiceHtml(payload),
      `Tax Invoice - ${anchor.invoiceNo || saleId}`
    )) {
      throw new Error("Pop-up blocked. Allow pop-ups to print the bill.");
    }
  } catch (err) {
    console.error("printSavedSaleBill:", err);
    if (typeof showToast === "function") showToast(err.message || "Could not print bill.", "error");
    else alert(err.message || "Could not print bill.");
  }
}
window.printSavedSaleBill = printSavedSaleBill;
window.bkBuildBusyInvoicePayload = bkBuildBusyInvoicePayload;
window.bkRenderBusyTaxInvoiceHtml = bkRenderBusyTaxInvoiceHtml;
window.bkOpenTaxInvoicePrint = bkOpenTaxInvoicePrint;





// 1. App start hote hi saved profile load karna


// printTallyBill function ke andar yeh variables automatic work karenge:
const companyName = state.company?.name || "Your Business Name";
const companyAddress = state.company?.address || "Address Not Available";
const companyGstin = state.company?.gstin || "N/A";
const companyPhone = state.company?.phone || "";

function applyProfileToForm(savedProfile) {
  if (!savedProfile) return;
  if (document.getElementById("setupCompanyName")) document.getElementById("setupCompanyName").value = savedProfile.name || "";
  if (document.getElementById("setupCompanyGstin")) document.getElementById("setupCompanyGstin").value = savedProfile.gstin || "";
  if (document.getElementById("setupCompanyPhone")) document.getElementById("setupCompanyPhone").value = savedProfile.phone || "";
  if (document.getElementById("setupCompanyUpi")) document.getElementById("setupCompanyUpi").value = savedProfile.upiId || savedProfile.upi || "";
  if (document.getElementById("setupCompanyState")) document.getElementById("setupCompanyState").value = savedProfile.state || "";
  if (document.getElementById("setupCompanyAddress")) document.getElementById("setupCompanyAddress").value = savedProfile.address || "";
  if (typeof state !== 'undefined') state.company = savedProfile;
  setProfileLockState(true);
}

async function loadCompanyProfile() {
  let savedProfile = null;
  try {
    const token = getToken();
    if (token) {
      const res = await fetch(`${API_URL}/api/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const p = await res.json();
        if (p && p.companyName) {
          savedProfile = {
            name: p.companyName,
            gstin: p.gstin || '',
            phone: p.phone || '',
            upiId: p.upiId || '',
            state: p.statePincode || '',
            address: p.fullAddress || ''
          };
          localStorage.setItem("bolkarigar_company_profile", JSON.stringify(savedProfile));
        }
      }
    }
  } catch (e) {
    console.warn('Profile server load:', e);
  }

  if (!savedProfile) {
    try {
      const savedProfileStr = localStorage.getItem("bolkarigar_company_profile");
      if (savedProfileStr) savedProfile = JSON.parse(savedProfileStr);
    } catch { /* ignore */ }
  }

  if (savedProfile) {
    applyProfileToForm(savedProfile);
  } else {
    setProfileLockState(false);
  }
}

// 2. Profile save karne ka function
// 2. Profile save karne ka function
async function saveCompanyProfile(event) {
  if (event) event.preventDefault();
  if (!bkHasPerm(window._bkAccountInfo, "profile.edit")) {
    alert("Only the owner can edit the company profile.");
    return;
  }

  const nameInput = document.getElementById("setupCompanyName");
  const gstinInput = document.getElementById("setupCompanyGstin");
  const addressInput = document.getElementById("setupCompanyAddress");
  const phoneInput = document.getElementById("setupCompanyPhone");
  const upiInput = document.getElementById("setupCompanyUpi");
  const stateInput = document.getElementById("setupCompanyState");

  const name = nameInput?.value.trim();
  const gstin = gstinInput?.value.trim();
  const address = addressInput?.value.trim();

  if (!name || !gstin || !address) {
    alert("⚠️ Please enter Company Name, GSTIN and Address.");
    return;
  }

  const companyData = {
    companyName: name,
    gstin: gstin,
    phone: phoneInput?.value.trim() || "",
    upiId: upiInput?.value.trim() || "",
    statePincode: stateInput?.value.trim() || "",
    fullAddress: address
  };

  const token = getToken();
  const saveBtn = document.getElementById("btnSaveProfile");

  return window.bkWithSaveLock(saveBtn, async () => {
  try {
    const response = await fetch(`${API_URL}/api/profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token ? `Bearer ${token}` : ""
      },
      body: JSON.stringify(companyData)
    });

    const result = await response.json();

    if (response.ok && result.success) {
      alert("✅ Profile saved successfully!");

      // Local cache update karo taaki page reload pe bhi profile yaad rahe
      const profileForStorage = {
        name: name,
        gstin: gstin,
        phone: companyData.phone,
        upiId: companyData.upiId,
        state: companyData.statePincode,
        address: address
      };
      localStorage.setItem("bolkarigar_company_profile", JSON.stringify(profileForStorage));

      // Global state sync karo
      if (typeof state !== 'undefined') {
        state.company = profileForStorage;
      }

      // Profile lock karo & Invoice Generator unlock karo
      setProfileLockState(true);
    } else {
      alert("❌ Error: " + (result.error || "Could not save"));
    }
  } catch (error) {
    console.error("Exact Error:", error);
    alert("❌ Network error: check the console (F12).");
  }
  });
}
// 4. Edit Button Handler
function toggleEditProfile() {
  // Profile unlock kar do taaki user changes kar sake
  setProfileLockState(false);
}

// Window load bindings
window.saveCompanyProfile = saveCompanyProfile;
window.toggleEditProfile = toggleEditProfile;

// Run automatically on page load
document.addEventListener("DOMContentLoaded", () => {
  loadCompanyProfile();
  wireDistanceKmValidation();
  document.getElementById('buyerPincode')?.addEventListener('input', () => {
    if (typeof renderInvoice === 'function') renderInvoice();
    updateGstModeHint();
  });
});

// Call on app initialization
loadCompanyProfile();


// 1. Lock/Unlock Helper Function
function setProfileLockState(isSaved) {
  const profileInputs = document.querySelectorAll("#businessProfileModal .form-input");
  const btnSave = document.getElementById("btnSaveProfile");
  const btnEdit = document.getElementById("btnEditProfile");
  const invoiceContainer = document.getElementById("invoiceGeneratorSection");

  if (isSaved) {
    // 1. PROFILE LOCK KARO
    profileInputs.forEach(input => {
      input.disabled = true;
      input.style.opacity = "0.7";
      input.style.cursor = "not-allowed";
    });
    if (btnSave) btnSave.style.display = "none";
    if (btnEdit) btnEdit.style.display = "inline-block";

    // 2. INVOICE GENERATOR UNLOCK KARO
    if (invoiceContainer) {
      invoiceContainer.classList.remove("blocked-invoice");
      // Saare inputs aur buttons enable karo
      const invoiceElements = invoiceContainer.querySelectorAll("input, select, button:not(.inv-btn-quit), textarea");
      invoiceElements.forEach(el => el.disabled = false);
    }

  } else {
    // 1. PROFILE UNLOCK KARO (Editing Mode)
    profileInputs.forEach(input => {
      input.disabled = false;
      input.style.opacity = "1";
      input.style.cursor = "text";
    });
    if (btnSave) btnSave.style.display = "inline-flex";
    if (btnEdit) btnEdit.style.display = "none";

    // 2. INVOICE GENERATOR COMPLETE BLOCK KARO
    if (invoiceContainer) {
      invoiceContainer.classList.add("blocked-invoice");
      // Saare inputs aur buttons disable karo
      const invoiceElements = invoiceContainer.querySelectorAll("input, select, button:not(.inv-btn-quit), textarea");
      invoiceElements.forEach(el => el.disabled = true);
    }
  }
}

function clampDistanceKmInput() {
  const el = document.getElementById("distanceKm");
  if (!el) return "";
  const raw = String(el.value || "").trim();
  if (raw === "") return "";
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n < 0) {
    el.value = "0";
    return "0";
  }
  const whole = String(Math.floor(n));
  el.value = whole;
  return whole;
}

function wireDistanceKmValidation() {
  const el = document.getElementById("distanceKm");
  if (!el || el.dataset.kmBound === "1") return;
  el.dataset.kmBound = "1";
  el.addEventListener("input", clampDistanceKmInput);
  el.addEventListener("blur", clampDistanceKmInput);
  el.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });
}

function getEWayBillDetails() {
  const distanceKm = clampDistanceKmInput();
  return {
    ewayBillNo: document.getElementById("ewayBillNo")?.value.trim() || "",
    vehicleNo: document.getElementById("vehicleNo")?.value.trim() || "",
    distanceKm
  };
}

// ==========================================================================
// 🟢 INVENTORY — inventory-ui.js (Smart Inventory Tracker)
// ==========================================================================

// ==========================================================================
// 🟢 LIVE AI — BolKarigar Smart AI Assistant — START
// Yeh Block header ke "🤖 AI Assistant" button se chat window kholta hai.
// Sawaal direct Gemini API ko bheje jaate hain — app commands nahi, sirf
// baatcheet/sawal. Isliye handleSpeech() se bypass karta hai aur direct
// fetch /api/ai/chat karta hai. API down ho to offline FAQ fallback.
// ==========================================================================

(function () {
  const widget = document.getElementById("liveAiWidget");
  const toggleBtn = document.getElementById("liveAiToggle");
  const closeBtn = document.getElementById("liveAiCloseBtn");
  const clearBtn = document.getElementById("liveAiClearBtn");
  const messagesBox = document.getElementById("liveAiMessages");
  const typingIndicator = document.getElementById("liveAiTyping");
  const input = document.getElementById("liveAiInput");
  const sendBtn = document.getElementById("liveAiSendBtn");
  const micBtn = document.getElementById("liveAiMicBtn");
  const statusDot = document.getElementById("liveAiStatusDot");
  const modelBadge = document.getElementById("liveAiModelBadge");
  const liveBtn = document.getElementById("liveAiLiveBtn");

  if (!widget || !toggleBtn) return;

  const chatHistory = [];
  let liveConvMode = false;
  let liveMicBuffer = "";
  let liveMicFlushTimer = null;
  const LIVE_MIC_FLUSH_MS = 1200;

  function pushHistory(role, content) {
    const text = String(content || "").trim();
    if (!text) return;
    chatHistory.push({ role: role === "user" ? "user" : "assistant", content: text.slice(0, 2000) });
    if (chatHistory.length > 24) chatHistory.splice(0, chatHistory.length - 24);
  }

  window.bkGetChatHistory = () => chatHistory.slice();
  window.bkClearChatHistory = () => { chatHistory.length = 0; };
  window.bkPushChatHistory = pushHistory;

  function updateModelBadge(source, model) {
    if (!modelBadge) return;
    if (!source || source === "offline") {
      modelBadge.textContent = "";
      return;
    }
    const label = source === "openai" ? (model || "GPT-4o") : (model || "Gemini");
    modelBadge.textContent = label;
  }

  function addBubble(text, kind) {
    if (typeof window.bkEnMsg === "function") text = window.bkEnMsg(text);
    const div = document.createElement("div");
    div.className = "live-ai-msg " + (kind === "user" ? "live-ai-msg-user" : kind === "action" ? "live-ai-msg-action" : "live-ai-msg-bot");
    div.textContent = text;
    messagesBox.appendChild(div);
    messagesBox.scrollTop = messagesBox.scrollHeight;
    return div;
  }

  function speakAiReply(text, onDone) {
    const done = () => {
      if (liveConvMode && !aiListening) setTimeout(startLiveMic, 500);
      if (typeof onDone === "function") onDone();
    };
    if (typeof window.speakText === "function") {
      window.speakText(text, true, done);
      return;
    }
    done();
  }

  function startLiveMic() {
    if (!liveConvMode || aiListening) return;
    if (typingIndicator && !typingIndicator.classList.contains("hidden")) return;
    micBtn?.click();
  }

  // --- Mic button: single-shot speech recognition (app ke continuous voice se alag) ---
  let aiRecognition = null;
  let aiListening = false;

  function setTyping(isTyping) {
    if (typingIndicator) typingIndicator.classList.toggle("hidden", !isTyping);
  }

  function openWidget() { widget.classList.remove("hidden"); input?.focus(); }
  function closeWidget() { widget.classList.add("hidden"); }

  toggleBtn.addEventListener("click", () => {
    widget.classList.contains("hidden") ? openWidget() : closeWidget();
  });
  closeBtn?.addEventListener("click", closeWidget);

  clearBtn?.addEventListener("click", () => {
    messagesBox.innerHTML = "";
    chatHistory.length = 0;
    liveMicBuffer = "";
    clearTimeout(liveMicFlushTimer);
    updateModelBadge();
    addBubble("Chat cleared. How can I help you?", "bot");
  });

  document.getElementById("liveAiSuggestions")?.addEventListener("click", (e) => {
    const chip = e.target.closest(".live-ai-chip");
    if (!chip?.dataset.prompt) return;
    sendUserMessage(chip.dataset.prompt);
  });

  liveBtn?.addEventListener("click", () => {
    liveConvMode = !liveConvMode;
    liveBtn.classList.toggle("active", liveConvMode);
    liveBtn.title = liveConvMode ? "Live mode ON — mic auto chalega" : "Turn on live conversation";
    if (liveConvMode) {
      addBubble("🎙️ Live mode ON — speak in English or Hindi; I will reply after you pause.", "bot");
      startLiveMic();
    } else {
      aiRecognition?.stop();
      liveMicBuffer = "";
      clearTimeout(liveMicFlushTimer);
    }
  });

  // Offline FAQ — uses APP_FAQ (English answers).
  const LIVE_FAQ = APP_FAQ;

  function matchLiveFaq(rawText) {
    const moduleFaq = matchModuleFaq(rawText);
    if (moduleFaq) return moduleFaq;
    const smart = matchFaqSmart(rawText, APP_FAQ);
    if (smart) return smart;
    const norm = normalizeFaqText(rawText);
    if (/kya|kaise|what|how|batao|help|feature|app|bolkarigar|ho skt|ho sak|kitne|model/.test(norm)) {
      return APP_FEATURES_OVERVIEW;
    }
    return null;
  }

  async function tryAppCommandFromChat(rawText) {
    if (isInformationalQuestion(rawText)) return null;
    const text = normalize(rawText);
    if (!text) return null;
    const prev = voiceResult?.textContent || "";
    try {
      if (looksLikeExpenseCommand(text)) { await handleExpenseSpeech(rawText); return voiceResult?.textContent || prev; }
      const invoiceData = extractInvoiceData(rawText);
      if (looksLikeInvoiceCommand(text, invoiceData) || text.includes("tally") || text.includes("whatsapp")) {
        await handleInvoiceSpeech(rawText);
        return voiceResult?.textContent || prev;
      }
      const projectData = extractProjectData(rawText);
      if (looksLikeProjectCommand(text, projectData)) { await handleProjectSpeech(rawText); return voiceResult?.textContent || prev; }
      if (looksLikeTodoCommand(text)) { handleTodoSpeech(rawText); return voiceResult?.textContent || prev; }
      if (looksLikeQrCommand(text)) { handleQrSpeech(rawText); return voiceResult?.textContent || prev; }
      if (looksLikeNoteWriteCommand(text) || defineNoteSaveCommand(text)) {
        if (handleNoteSpeech(rawText)) return voiceResult?.textContent || prev;
      }
      const cleanExpr = extractCalcExpression(text);
      if (looksLikeCalculation(text, cleanExpr)) { handleCalculatorSpeech(rawText, cleanExpr); return voiceResult?.textContent || prev; }
      if (looksLikeGalleryNavCommand(text) && handleGallerySpeech(rawText)) return voiceResult?.textContent || prev;
      if (looksLikeSearchCommand(text)) { handleSearchSpeech(rawText); return voiceResult?.textContent || prev; }
      if (isClearCommand(text)) { clearActivePanelForm(); return "Form clear kar diya."; }
      if (looksLikeKhataCommand(text)) { await handleKhataSpeech(rawText); return voiceResult?.textContent || prev; }
      if (looksLikeInventoryCommand(text)) { await handleInventorySpeech(rawText); return voiceResult?.textContent || prev; }
      if (handleButtonVoiceCommand(text)) return voiceResult?.textContent || prev;
      if (parseCommands(rawText)) return voiceResult?.textContent || prev;
    } catch (e) {
      console.error("Chat app command error:", e);
    }
    return null;
  }

  function finishBotReply(reply, kind, source, model) {
    pushHistory("assistant", reply);
    addBubble(reply, kind || "bot");
    updateModelBadge(source, model);
    speakAiReply(reply);
  }

  async function fetchLiveChat(rawText) {
    const token = localStorage.getItem("bk_token") || localStorage.getItem("token") || "";
    const response = await fetch(`${API_URL}/api/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ message: rawText, history: chatHistory.slice(0, -1) })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(data?.error || data?.reply || "Server error");
      err.status = response.status;
      throw err;
    }
    return data;
  }

  async function processMessage(rawText) {
    pushHistory("user", rawText);
    const informational = isInformationalQuestion(rawText);

    if (!informational) {
      if (window.bkVoiceController?.looksLikeInvoiceUtterance?.(rawText) && window.bkVoiceController?.fillAndAddInvoice) {
        const prev = voiceResult?.textContent || "";
        openPanel("invoicePanel");
        const ok = await window.bkVoiceController.fillAndAddInvoice(rawText);
        if (ok) {
          finishBotReply(voiceResult?.textContent || prev || "Invoice updated.", "action");
          return;
        }
      }
      if (window.bkVoiceController?.tryFastAction) {
        const prev = voiceResult?.textContent || "";
        const acted = await window.bkVoiceController.tryFastAction(rawText);
        if (acted) {
          const msg = voiceResult?.textContent || prev || "Ho gaya.";
          finishBotReply(msg, "action");
          return;
        }
      }
      const cmdMsg = await tryAppCommandFromChat(rawText);
      if (cmdMsg) {
        finishBotReply(cmdMsg, "action");
        return;
      }
    }

    if (informational) {
      const faq = matchLiveFaq(rawText);
      if (faq) {
        finishBotReply(faq, "bot", "offline");
        return;
      }
    } else {
      const faq = matchLiveFaq(rawText);
      if (faq) {
        finishBotReply(faq, "bot", "offline");
        return;
      }
    }

    setTyping(true);
    try {
      const data = await fetchLiveChat(rawText);
      setTyping(false);

      if (data?.reply) {
        if (data.hint && data.source === "offline") {
          addBubble("💡 Tip: " + data.hint, "bot");
        }
        finishBotReply(data.reply, "bot", data.source, data.model);
      } else {
        const fallback = matchLiveFaq(rawText) || APP_FEATURES_OVERVIEW;
        finishBotReply(fallback, "bot", "offline");
      }
    } catch (err) {
      setTyping(false);
      console.error("LIVE AI API Error:", err);
      const fallback = matchLiveFaq(rawText) || APP_FEATURES_OVERVIEW;
      finishBotReply(fallback, "bot", "offline");
    }
  }

  async function sendUserMessage(text) {
    const trimmed = (text || "").trim();
    if (!trimmed) return;
    addBubble(trimmed, "user");
    if (input) input.value = "";
    await processMessage(trimmed);
  }

  sendBtn?.addEventListener("click", () => sendUserMessage(input?.value));
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendUserMessage(input.value);
  });

  let liveInterimEl = null;

  function showLiveInterim(text) {
    if (!text) {
      liveInterimEl?.remove();
      liveInterimEl = null;
      return;
    }
    if (!liveInterimEl) {
      liveInterimEl = document.createElement("div");
      liveInterimEl.className = "live-ai-msg-interim";
      messagesBox?.appendChild(liveInterimEl);
    }
    liveInterimEl.textContent = "🎤 " + text;
    if (messagesBox) messagesBox.scrollTop = messagesBox.scrollHeight;
  }

  function flushLiveMicBuffer() {
    liveMicFlushTimer = null;
    const text = liveMicBuffer.trim();
    liveMicBuffer = "";
    showLiveInterim("");
    if (text) sendUserMessage(text);
  }

  function createAiRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    const rec = new SpeechRecognition();
    rec.lang = localStorage.getItem("bk_voice_lang") || "hi-IN";
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    rec.continuous = liveConvMode;
    return rec;
  }

  micBtn?.addEventListener("click", () => {
    if (aiListening) {
      aiRecognition?.stop();
      liveMicBuffer = "";
      clearTimeout(liveMicFlushTimer);
      showLiveInterim("");
      return;
    }
    aiRecognition = createAiRecognition();
    if (!aiRecognition) {
      addBubble("⚠️ Voice input is not supported in this browser. Try Chrome or Edge.", "bot");
      return;
    }
    aiListening = true;
    micBtn.classList.add("listening");
    statusDot?.classList.add("listening");

    aiRecognition.onresult = (event) => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += piece + " ";
        else interim += piece;
      }
      if (liveConvMode) {
        if (finalText.trim()) {
          liveMicBuffer += (liveMicBuffer ? " " : "") + finalText.trim();
          showLiveInterim(liveMicBuffer);
          clearTimeout(liveMicFlushTimer);
          liveMicFlushTimer = setTimeout(flushLiveMicBuffer, LIVE_MIC_FLUSH_MS);
        } else if (interim.trim()) {
          showLiveInterim(liveMicBuffer ? liveMicBuffer + " " + interim.trim() : interim.trim());
        }
      } else if (finalText.trim()) {
        showLiveInterim("");
        sendUserMessage(finalText.trim());
        aiRecognition.stop();
      } else if (interim.trim()) {
        showLiveInterim(interim.trim());
      }
    };

    aiRecognition.onerror = (ev) => {
      const quiet = ev.error === "no-speech" || ev.error === "aborted";
      if (!quiet && ev.error !== "not-allowed") {
        addBubble("Mic error: " + ev.error + " — please try again.", "bot");
      }
      aiListening = false;
      micBtn.classList.remove("listening");
      statusDot?.classList.remove("listening");
      showLiveInterim("");
    };

    aiRecognition.onend = () => {
      aiListening = false;
      micBtn.classList.remove("listening");
      statusDot?.classList.remove("listening");
      if (liveConvMode && (!typingIndicator || typingIndicator.classList.contains("hidden"))) {
        setTimeout(() => {
          if (liveConvMode && !aiListening) micBtn?.click();
        }, 350);
      }
    };

    try { aiRecognition.start(); } catch (e) { aiListening = false; }
  });

  document.addEventListener("bk:langchange", () => {
    if (aiRecognition) aiRecognition.lang = localStorage.getItem("bk_voice_lang") || "hi-IN";
  });
})();
// ==========================================================================
// 🟢 LIVE AI — BolKarigar Smart AI Assistant — END
// ==========================================================================

// ==========================================================================
// 🟢 ACCOUNTING — Ledgers, Stock/Items, Vouchers, Day Book
// ==========================================================================
(function () {
  if (!document.getElementById("khataLedgersBody")) return;

  const panelLoaders = {
    khataLedgersPanel: () => loadKhataLedgers(),
    khataItemsPanel: () => loadKhataItems(),
    khataVoucherPanel: () => {
      loadLedgerDropdowns(); loadItemDropdown(); loadVcnItemDropdown(); loadJournalLedgerDropdown();
      renderVcnItems(); renderJournalLines(); updateVoucherFormUI();
    },
    purchasePanel: () => { if (typeof window.refreshPurchasePanel === "function") window.refreshPurchasePanel(); },
    paymentVoucherPanel: () => { if (typeof window.refreshPaymentVoucherPanel === "function") window.refreshPaymentVoucherPanel(); },
    receiptVoucherPanel: () => { if (typeof window.refreshReceiptVoucherPanel === "function") window.refreshReceiptVoucherPanel(); },
    modifyPanel: () => { if (typeof window.refreshModifyPanel === "function") window.refreshModifyPanel(); },
    khataDaybookPanel: () => loadKhataDaybook()
  };

  document.querySelectorAll(".tab-btn[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const loader = panelLoaders[btn.dataset.tab];
      if (loader) loader();
    });
  });

  function khataHeaders() {
    return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` };
  }

  const khataPag = {
    ledgers: { page: 1, size: 10, data: [] },
    items: { page: 1, size: 10, data: [] },
    daybook: { page: 1, size: 10, data: [] }
  };

  const khataPagConfig = {
    ledgers: { prefix: "khataLedgers", bodyId: "khataLedgersBody", cols: 5 },
    items: { prefix: "khataItems", bodyId: "khataItemsBody", cols: 6 },
    daybook: { prefix: "khataDaybook", bodyId: "khataDaybookBody", cols: 6 }
  };

  function updateKhataPaginationUI(key) {
    const state = khataPag[key];
    const cfg = khataPagConfig[key];
    const totalRows = state.data.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / state.size) || 1);
    if (state.page > totalPages) state.page = totalPages;

    const start = totalRows === 0 ? 0 : (state.page - 1) * state.size + 1;
    const end = Math.min(state.page * state.size, totalRows);
    const info = document.getElementById(`${cfg.prefix}PaginationInfo`);
    const indicator = document.getElementById(`${cfg.prefix}PageIndicator`);
    const prev = document.getElementById(`${cfg.prefix}PrevBtn`);
    const next = document.getElementById(`${cfg.prefix}NextBtn`);

    if (info) info.textContent = totalRows ? `Showing ${start}–${end} of ${totalRows}` : "";
    if (indicator) indicator.textContent = `Page ${state.page} of ${totalPages}`;
    if (prev) prev.disabled = state.page <= 1;
    if (next) next.disabled = state.page >= totalPages || totalRows === 0;
  }

  function getKhataPageSlice(key) {
    const state = khataPag[key];
    const start = (state.page - 1) * state.size;
    return state.data.slice(start, start + state.size);
  }

  function initKhataPagination(key) {
    const cfg = khataPagConfig[key];
    const sizeSel = document.getElementById(`${cfg.prefix}PageSize`);
    const prev = document.getElementById(`${cfg.prefix}PrevBtn`);
    const next = document.getElementById(`${cfg.prefix}NextBtn`);

    if (sizeSel) {
      khataPag[key].size = parseInt(sizeSel.value, 10) || 10;
      sizeSel.addEventListener("change", () => {
        khataPag[key].size = parseInt(sizeSel.value, 10) || 10;
        khataPag[key].page = 1;
        renderKhataTable(key);
      });
    }
    prev?.addEventListener("click", () => {
      if (khataPag[key].page > 1) {
        khataPag[key].page--;
        renderKhataTable(key);
      }
    });
    next?.addEventListener("click", () => {
      const totalPages = Math.max(1, Math.ceil(khataPag[key].data.length / khataPag[key].size));
      if (khataPag[key].page < totalPages) {
        khataPag[key].page++;
        renderKhataTable(key);
      }
    });
  }

  Object.keys(khataPagConfig).forEach(initKhataPagination);

  function renderKhataTable(key) {
    const cfg = khataPagConfig[key];
    const body = document.getElementById(cfg.bodyId);
    if (!body) return;

    if (key === "ledgers") renderKhataLedgersTable(body);
    else if (key === "items") renderKhataItemsTable(body);
    else if (key === "daybook") renderKhataDaybookTable(body);

    updateKhataPaginationUI(key);
  }

  function formatKhataLedgerBalance(l) {
    const isDebtor = l.ledgerGroup === "Sundry Debtor" || l.partyType === "Debtor";
    if (isDebtor) {
      const fmt = typeof bkFormatDebtorNet === "function"
        ? bkFormatDebtorNet(l.netBalance ?? l.pendingUdhar ?? l.currentBalance ?? 0)
        : { clear: true, label: "Paid / Clear", badgeClass: "khata-badge-clear" };
      if (fmt.clear || l.udharClear) {
        return `<span class="khata-badge-clear">Paid / Clear</span>`;
      }
      return `<span class="${fmt.badgeClass}">${escapeHtml(fmt.label)}</span>`;
    }
    const bal = Number(l.currentBalance) || 0;
    return `<span class="${bal >= 0 ? "khata-badge-debit" : "khata-badge-credit"}">₹${Math.abs(bal).toFixed(2)} ${bal >= 0 ? "Dr" : "Cr"}</span>`;
  }

  function renderKhataLedgersTable(body) {
    const rows = getKhataPageSlice("ledgers");
    if (!khataPag.ledgers.data.length) {
      body.innerHTML = `<tr><td colspan='5'>No ledgers yet.</td></tr>`;
      return;
    }
    body.innerHTML = rows.map(l => `
      <tr>
        <td>${escapeHtml(l.partyName)}</td>
        <td>${escapeHtml(l.ledgerGroup) || escapeHtml(l.partyType)}</td>
        <td>${escapeHtml((l.address || l.mobile || "").trim()) || "-"}</td>
        <td>${formatKhataLedgerBalance(l)}</td>
        <td class="khata-act-group">
          <button type="button" class="khata-act-btn" title="Edit account" aria-label="Edit account" onclick="typeof openModifyPanel==='function'&&openModifyPanel('account','${l._id}')">✏️ Edit</button>
          <button type="button" class="khata-act-btn" title="Ledger Statement dekho — saari transactions / खाता विवरण" aria-label="View ledger statement" onclick="viewKhataLedgerStatement('${l._id}')">📄 Statement</button>
          <button type="button" class="khata-act-btn" title="Sync to Tally Prime" aria-label="Sync to Tally" onclick="syncKhataLedgerToTally('${l._id}')">📊 Tally</button>
          <button type="button" class="khata-act-btn danger" title="Delete ledger" aria-label="Delete ledger" onclick="deleteKhataLedger('${l._id}')">🗑️ Delete</button>
        </td>
      </tr>`).join("");
  }

  function renderKhataItemsTable(body) {
    const rows = getKhataPageSlice("items");
    if (!khataPag.items.data.length) {
      body.innerHTML = `<tr><td colspan='6'>No items yet.</td></tr>`;
      return;
    }
    body.innerHTML = rows.map(i => `
      <tr>
        <td>${escapeHtml(i.itemName)}</td>
        <td>${escapeHtml(i.unit)}</td>
        <td>₹${i.purchasePrice}</td>
        <td>₹${i.sellingPrice}</td>
        <td>${i.stockQty}</td>
        <td><button type="button" class="khata-act-btn" title="Item edit" onclick="typeof openModifyPanel==='function'&&openModifyPanel('item','${i._id}')">✏️</button>
          <button type="button" class="khata-act-btn danger" title="Delete item" aria-label="Delete item" onclick="deleteKhataItem('${i._id}')">🗑️</button></td>
      </tr>`).join("");
  }

  function renderKhataDaybookTable(body) {
    const rows = getKhataPageSlice("daybook");
    if (!khataPag.daybook.data.length) {
      body.innerHTML = `<tr><td colspan='6'>No vouchers yet.</td></tr>`;
      window.bkSetTableAmountTotal(body, { hide: true });
      return;
    }
    const pageSum = rows.reduce((s, v) => s + (parseFloat(v.amount) || 0), 0);
    const grandSum = khataPag.daybook.data.reduce((s, v) => s + (parseFloat(v.amount) || 0), 0);
    body.innerHTML = rows.map(v => {
      let partyCol = escapeHtml(v.partyId?.partyName) || "-";
      if (v.voucherType === "Journal" && v.journalEntries?.length) {
        partyCol = v.journalEntries.map((e) => `${escapeHtml(e.ledgerName || "")} ${e.drCr}`).join(", ");
      }
      return `
      <tr>
        <td>${new Date(v.date).toLocaleDateString("en-IN")}</td>
        <td>${escapeHtml(typeof bkVoucherTypeLabel === "function" ? bkVoucherTypeLabel(v.voucherType) : v.voucherType)}</td>
        <td>${partyCol}</td>
        <td>₹${v.amount.toFixed(2)}</td>
        <td>${escapeHtml(v.note) || "-"}</td>
        <td class="khata-act-group">
          <button type="button" class="khata-act-btn" title="Voucher edit" onclick="typeof openModifyVoucherFromDaybook==='function'&&openModifyVoucherFromDaybook('${v._id}','${escapeHtml(v.voucherType || '')}')">✏️ Edit</button>
          ${v.syncedToTally ? "✅" : `<button type="button" onclick="syncKhataVoucherToTally('${v._id}')">📊 Sync</button>`}
        </td>
      </tr>`;
    }).join("");
    window.bkSetTableAmountTotal(body, {
      label: "Page Total",
      amount: pageSum,
      rows: rows.length,
      grand: khataPag.daybook.data.length > rows.length ? grandSum : null
    });
  }

  // ---------- LEDGERS ----------
  async function loadKhataLedgers() {
    const body = document.getElementById("khataLedgersBody");
    if (!body) return;
    body.innerHTML = "<tr><td colspan='5'>Loading...</td></tr>";
    try {
      const res = await fetch(`${API_URL}/api/ledgers`, { headers: khataHeaders() });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      khataPag.ledgers.data = data.ledgers || [];
      khataPag.ledgers.page = 1;
      renderKhataTable("ledgers");
    } catch (err) {
      body.innerHTML = `<tr><td colspan='5'>Error: ${err.message}</td></tr>`;
      updateKhataPaginationUI("ledgers");
    }
  }

  window.deleteKhataLedger = async function (id) {
    const row = khataPag.ledgers.data.find((l) => String(l._id) === String(id));
    const name = row?.partyName || "this ledger";
    if (!confirm(
      `Delete "${name}" and ALL linked transactions?\n\n`
      + "This removes sales, vouchers, payments and udhar entries for this party. Cannot be undone."
    )) return;
    try {
      const res = await fetch(`${API_URL}/api/ledgers/${id}`, { method: "DELETE", headers: khataHeaders() });
      const data = await res.json();
      if (!res.ok || !data.success) { showToast("❌ " + (data.error || "Delete failed"), "error"); return; }
      showToast("✅ " + (data.message || "Ledger deleted."));
      loadKhataLedgers();
      if (typeof refreshUdharKhata === "function") refreshUdharKhata();
    } catch (err) { showToast("❌ " + err.message, "error"); }
  };

  window.syncKhataLedgerToTally = async function (id) {
    try {
      showToast("⌛ Syncing ledger to Tally...");
      const res = await fetch(`${API_URL}/api/tally/sync-ledger/${id}`, { method: "POST", headers: khataHeaders(), body: "{}" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Sync fail");
      showToast("✅ " + data.message);
    } catch (err) { showToast("❌ Tally sync: " + err.message, "error"); }
  };

  window.viewKhataLedgerStatement = async function (id) {
    const modal = document.getElementById("ledgerStatementModal");
    const title = document.getElementById("ledgerStatementTitle");
    const meta = document.getElementById("ledgerStatementMeta");
    const body = document.getElementById("ledgerStatementBody");
    if (!modal || !body) {
      showToast("Ledger statement window failed to load. Please refresh the page.", "error");
      return;
    }
    body.innerHTML = "<tr><td colspan='7'>Loading...</td></tr>";
    if (meta) meta.textContent = "";
    modal.classList.remove("hidden");
    try {
      const res = await fetch(`${API_URL}/api/ledger-statement/${id}`, { headers: khataHeaders() });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      if (title) title.textContent = `📄 ${data.partyName} — Ledger Statement`;
      if (meta) {
        if (data.isDebtorStatement) {
          const net = Number(data.netBalance ?? data.pendingUdhar ?? data.currentBalance ?? 0) || 0;
          const fmt = typeof bkFormatDebtorNet === "function" ? bkFormatDebtorNet(net) : { label: "Paid / Clear", clear: true };
          const netText = net < -0.01 ? `−₹${Math.abs(net).toFixed(2)}` : `₹${net.toFixed(2)}`;
          meta.textContent = fmt.clear
            ? `Opening: ₹${Number(data.openingBalance || 0).toFixed(2)} | Net Balance: ₹0.00 | Paid / Clear`
            : `Opening: ₹${Number(data.openingBalance || 0).toFixed(2)} | Net Balance: ${netText} | ${fmt.label}`;
        } else {
          meta.textContent = `Opening Balance: ₹${Number(data.openingBalance || 0).toFixed(2)} | Current Balance: ₹${Number(data.currentBalance || 0).toFixed(2)}`;
        }
      }
      if (!data.history?.length) {
        body.innerHTML = `<tr><td colspan='7' style="text-align:center;">No transactions yet — opening balance only.</td></tr>`;
        return;
      }
      if (data.isDebtorStatement) {
        body.innerHTML = data.history.map(v => {
          const statusClass = v.status === "Udhar" ? "khata-badge-udhar"
            : (v.status === "Paid" ? "khata-badge-clear"
              : (v.status === "Returned" ? "khata-badge-return"
                : (Number(v.runningBalance) < -0.01 ? "khata-badge-refund" : "khata-badge-neutral")));
          return `
        <tr>
          <td>${new Date(v.date).toLocaleDateString("en-IN")}</td>
          <td>${escapeHtml(typeof bkVoucherTypeLabel === "function" ? bkVoucherTypeLabel(v.voucherType) : v.voucherType)}</td>
          <td>₹${Number(v.amount || 0).toFixed(2)}</td>
          <td>${escapeHtml(v.paymentMode || "—")}</td>
          <td><span class="${statusClass}">${escapeHtml(v.status || "-")}</span></td>
          <td>${Number(v.runningBalance ?? 0) < -0.01
            ? `−₹${Math.abs(Number(v.runningBalance)).toFixed(2)}`
            : `₹${Number(v.runningBalance ?? 0).toFixed(2)}`}</td>
          <td>${escapeHtml(v.note) || "-"}</td>
        </tr>`;
        }).join("");
        return;
      }
      body.innerHTML = data.history.map(v => `
        <tr>
          <td>${new Date(v.date).toLocaleDateString("en-IN")}</td>
          <td>${escapeHtml(typeof bkVoucherTypeLabel === "function" ? bkVoucherTypeLabel(v.voucherType) : v.voucherType)}</td>
          <td>₹${Number(v.amount || 0).toFixed(2)}</td>
          <td>—</td>
          <td>—</td>
          <td>—</td>
          <td>${escapeHtml(v.note) || "-"}</td>
        </tr>`).join("");
    } catch (err) {
      body.innerHTML = `<tr><td colspan='7'>Error: ${escapeHtml(err.message)}</td></tr>`;
      showToast("❌ " + err.message, "error");
    }
  };

  document.getElementById("closeLedgerStatementBtn")?.addEventListener("click", () => {
    document.getElementById("ledgerStatementModal")?.classList.add("hidden");
  });
  document.getElementById("ledgerStatementModal")?.addEventListener("click", (e) => {
    if (e.target.id === "ledgerStatementModal") e.target.classList.add("hidden");
  });

  window.refreshKhataPro = function () {
    loadKhataLedgers();
    loadKhataItems();
    loadKhataDaybook();
  };

  document.getElementById("addLedgerBtn")?.addEventListener("click", async () => {
    const partyName = document.getElementById("ledgerNameInput").value.trim();
    if (!partyName) { alert("Please enter a ledger name."); return; }
    const payload = {
      partyName,
      ledgerGroup: document.getElementById("ledgerGroupInput").value,
      address: document.getElementById("ledgerAddressInput").value.trim(),
      gstin: document.getElementById("ledgerGstinInput").value.trim(),
      openingBalance: parseFloat(document.getElementById("ledgerOpeningInput").value) || 0
    };
    try {
      const res = await fetch(`${API_URL}/api/ledgers`, { method: "POST", headers: khataHeaders(), body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Save fail hua");
      document.getElementById("ledgerNameInput").value = "";
      document.getElementById("ledgerAddressInput").value = "";
      document.getElementById("ledgerGstinInput").value = "";
      document.getElementById("ledgerOpeningInput").value = "";
      showToast("✅ Ledger '" + partyName + "' created!");
      loadKhataLedgers();
    } catch (err) { showToast("❌ " + err.message, "error"); }
  });

  // ---------- ITEMS / STOCK ----------
  async function loadKhataItems() {
    const body = document.getElementById("khataItemsBody");
    if (!body) return;
    body.innerHTML = "<tr><td colspan='6'>Loading...</td></tr>";
    try {
      const res = await fetch(`${API_URL}/api/items`, { headers: khataHeaders() });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      khataPag.items.data = data.items || [];
      khataPag.items.page = 1;
      renderKhataTable("items");
    } catch (err) {
      body.innerHTML = `<tr><td colspan='6'>Error: ${err.message}</td></tr>`;
      updateKhataPaginationUI("items");
    }
  }

  window.deleteKhataItem = async function (id) {
    if (!confirm("Delete this item?")) return;
    try {
      await fetch(`${API_URL}/api/items/${id}`, { method: "DELETE", headers: khataHeaders() });
      loadKhataItems();
    } catch (err) { alert("❌ " + err.message); }
  };

  document.getElementById("addItemBtn")?.addEventListener("click", async () => {
    const itemName = document.getElementById("itemNameInput").value.trim();
    if (!itemName) { alert("Please enter an item name."); return; }
    const payload = {
      itemName,
      unit: document.getElementById("itemUnitInput").value.trim() || "Pcs",
      hsnCode: document.getElementById("itemHsnInput").value.trim(),
      gstRate: parseFloat(document.getElementById("itemGstRateInput").value) || 0,
      purchasePrice: parseFloat(document.getElementById("itemPurchasePriceInput").value) || 0,
      sellingPrice: parseFloat(document.getElementById("itemSellingPriceInput").value) || 0,
      openingStock: parseFloat(document.getElementById("itemOpeningStockInput").value) || 0,
      godown: document.getElementById("itemGodownInput")?.value.trim() || "Main Godown",
      batchNo: document.getElementById("itemBatchInput")?.value.trim() || ""
    };
    try {
      const res = await fetch(`${API_URL}/api/items`, { method: "POST", headers: khataHeaders(), body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Save fail hua");
      ["itemNameInput", "itemUnitInput", "itemHsnInput", "itemGstRateInput", "itemPurchasePriceInput", "itemSellingPriceInput", "itemOpeningStockInput"]
        .forEach(id => { document.getElementById(id).value = ""; });
      loadKhataItems();
    } catch (err) { alert("❌ " + err.message); }
  });

  // ---------- VOUCHER ENTRY ----------
  let vcnLineItems = [];
  let vcnEditingIndex = -1;

  function vcnLineTotal(line) {
    const rate = parseFloat(line.rate) || 0;
    const qty = parseFloat(line.qty) || 0;
    const gstRate = parseFloat(line.gstRate) || 0;
    const taxable = rate * qty;
    return taxable + (taxable * gstRate / 100);
  }

  function renderVcnItems() {
    const body = document.getElementById("vcnItemsBody");
    const grandEl = document.getElementById("vcnGrandTotal");
    if (!body) return;

    body.innerHTML = "";
    let grand = 0;
    if (vcnLineItems.length) {
      vcnLineItems.forEach((line, index) => {
        const lineTotal = vcnLineTotal(line);
        grand += lineTotal;
        const row = document.createElement("tr");
        row.innerHTML = `
          <td class="col-sn">${index + 1}</td>
          <td class="col-item">${escapeHtml(line.itemName)}${line.gstRate > 0 ? `<br><small style="color:#666">GST ${line.gstRate}%</small>` : ""}</td>
          <td class="col-qty">${line.qty}</td>
          <td class="col-unit">${escapeHtml(line.unit || "Pcs")}</td>
          <td class="col-price">₹${(parseFloat(line.rate) || 0).toFixed(2)}</td>
          <td class="inv-amt-cell">₹${lineTotal.toFixed(2)}</td>
          <td>
            <div class="inv-row-actions">
              <button type="button" class="inv-row-edit" onclick="editVcnItem(${index})">Edit</button>
              <button type="button" class="inv-row-del" onclick="deleteVcnItem(${index})">Del</button>
            </div>
          </td>`;
        body.appendChild(row);
      });
    } else {
      body.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:12px;">Add items to show what is being adjusted.</td></tr>`;
    }
    if (grandEl) grandEl.textContent = grand.toFixed(2);
    updateVoucherEffectSummary();
  }

  function clearVcnEntryFields() {
    const itemSel = document.getElementById("vcnItemInput");
    if (itemSel) itemSel.value = "";
    const qtyEl = document.getElementById("vcnQtyInput");
    if (qtyEl) qtyEl.value = "1";
    const rateEl = document.getElementById("vcnRateInput");
    if (rateEl) rateEl.value = "";
    const gstEl = document.getElementById("vcnGstInput");
    if (gstEl) gstEl.value = "18";
  }

  function addVcnLineItem() {
    const itemSel = document.getElementById("vcnItemInput");
    const itemId = itemSel?.value || "";
    const opt = itemSel?.selectedOptions[0];
    const qty = parseFloat(document.getElementById("vcnQtyInput")?.value) || 0;
    let rate = parseFloat(document.getElementById("vcnRateInput")?.value);
    const gstRate = parseFloat(document.getElementById("vcnGstInput")?.value) || 0;
    if (!itemId) { alert("Please select an item."); return false; }
    if (!qty || qty <= 0) { alert("Please enter quantity."); return false; }
    if (Number.isNaN(rate) || rate <= 0) rate = parseFloat(opt?.dataset.sale) || parseFloat(opt?.dataset.purchase) || 0;
    if (!rate || rate <= 0) { alert("Please enter rate."); return false; }
    const itemName = (opt?.textContent || "").split(" (Stock:")[0].trim();
    const line = { itemId, itemName, unit: opt?.dataset.unit || "Pcs", qty, rate, gstRate };
    if (vcnEditingIndex > -1) {
      vcnLineItems[vcnEditingIndex] = line;
      vcnEditingIndex = -1;
      const addBtn = document.getElementById("addVcnItemBtn");
      if (addBtn) addBtn.textContent = "Add Item";
    } else {
      vcnLineItems.push(line);
    }
    clearVcnEntryFields();
    renderVcnItems();
    return true;
  }

  window.editVcnItem = function (index) {
    const line = vcnLineItems[index];
    if (!line) return;
    const itemSel = document.getElementById("vcnItemInput");
    if (itemSel) itemSel.value = line.itemId;
    document.getElementById("vcnQtyInput").value = line.qty;
    document.getElementById("vcnRateInput").value = line.rate;
    document.getElementById("vcnGstInput").value = line.gstRate;
    vcnEditingIndex = index;
    const addBtn = document.getElementById("addVcnItemBtn");
    if (addBtn) addBtn.textContent = "Update Item";
  };

  window.deleteVcnItem = function (index) {
    if (vcnLineItems[index] === undefined) return;
    vcnLineItems.splice(index, 1);
    if (vcnEditingIndex === index) {
      vcnEditingIndex = -1;
      const addBtn = document.getElementById("addVcnItemBtn");
      if (addBtn) addBtn.textContent = "Add Item";
      clearVcnEntryFields();
    } else if (vcnEditingIndex > index) vcnEditingIndex -= 1;
    renderVcnItems();
  };

  async function loadVcnItemDropdown() {
    try {
      const res = await fetch(`${API_URL}/api/items`, { headers: khataHeaders() });
      const data = await res.json();
      if (!data.success) return;
      const sel = document.getElementById("vcnItemInput");
      if (sel) {
        sel.innerHTML = '<option value="">-- Select Item --</option>' +
          (data.items || []).map(i =>
            `<option value="${i._id}" data-purchase="${i.purchasePrice || 0}" data-sale="${i.sellingPrice || 0}" data-unit="${escapeHtml(i.unit || 'Pcs')}">${escapeHtml(i.itemName)} (Stock: ${i.stockQty})</option>`
          ).join("");
      }
    } catch (err) { console.error("VCN item load:", err); }
  }

  function getVcnGrandTotal() {
    return vcnLineItems.reduce((sum, line) => sum + vcnLineTotal(line), 0);
  }

  // ---------- MULTI-LINE JOURNAL (Tally style Dr / Cr) ----------
  let journalLineItems = [];
  let journalEditingIndex = -1;

  function sumJournalSide(lines, side) {
    return lines
      .filter((line) => line.drCr === side)
      .reduce((sum, line) => sum + (parseFloat(line.amount) || 0), 0);
  }

  function renderJournalLines() {
    const body = document.getElementById("jnLinesBody");
    const drEl = document.getElementById("jnTotalDr");
    const crEl = document.getElementById("jnTotalCr");
    const statusEl = document.getElementById("jnBalanceStatus");
    if (!body) return;

    body.innerHTML = "";
    if (journalLineItems.length) {
      journalLineItems.forEach((line, index) => {
        const amt = parseFloat(line.amount) || 0;
        const row = document.createElement("tr");
        row.innerHTML = `
          <td class="col-sn">${index + 1}</td>
          <td class="col-item">${escapeHtml(line.ledgerName)}</td>
          <td class="inv-amt-cell">${line.drCr === "Dr" ? "₹" + amt.toFixed(2) : "—"}</td>
          <td class="inv-amt-cell">${line.drCr === "Cr" ? "₹" + amt.toFixed(2) : "—"}</td>
          <td>
            <div class="inv-row-actions">
              <button type="button" class="inv-row-edit" onclick="editJournalLine(${index})">Edit</button>
              <button type="button" class="inv-row-del" onclick="deleteJournalLine(${index})">Remove</button>
            </div>
          </td>`;
        body.appendChild(row);
      });
    } else {
      body.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:14px;color:var(--muted);">No entries yet — use the blue Debit box or green Credit box above.</td></tr>`;
    }

    const totalDr = sumJournalSide(journalLineItems, "Dr");
    const totalCr = sumJournalSide(journalLineItems, "Cr");
    const diff = Math.abs(totalDr - totalCr);
    const hasDr = journalLineItems.some((l) => l.drCr === "Dr");
    const hasCr = journalLineItems.some((l) => l.drCr === "Cr");
    const balanced = hasDr && hasCr && diff < 0.009 && totalDr > 0;

    if (drEl) drEl.textContent = totalDr.toFixed(2);
    if (crEl) crEl.textContent = totalCr.toFixed(2);
    if (statusEl) {
      statusEl.classList.remove("balanced", "unbalanced");
      if (balanced) {
        statusEl.textContent = "✅ Balanced — ready to save!";
        statusEl.classList.add("balanced");
      } else if (!journalLineItems.length) {
        statusEl.textContent = "Add debit and credit entries below";
      } else if (!hasDr || !hasCr) {
        statusEl.textContent = "⚠️ Need at least 1 debit AND 1 credit";
        statusEl.classList.add("unbalanced");
      } else {
        statusEl.textContent = `⚠️ Difference ₹${diff.toFixed(2)} — totals must match`;
        statusEl.classList.add("unbalanced");
      }
    }
    updateVoucherEffectSummary();
  }

  function clearJournalSideFields(side) {
    if (side === "Dr" || !side) {
      const drSel = document.getElementById("jnDrLedgerInput");
      if (drSel) drSel.value = "";
      const drAmt = document.getElementById("jnDrAmountInput");
      if (drAmt) drAmt.value = "";
    }
    if (side === "Cr" || !side) {
      const crSel = document.getElementById("jnCrLedgerInput");
      if (crSel) crSel.value = "";
      const crAmt = document.getElementById("jnCrAmountInput");
      if (crAmt) crAmt.value = "";
    }
  }

  function addJournalLineFromSide(drCr) {
    const isDr = drCr === "Dr";
    const ledgerSel = document.getElementById(isDr ? "jnDrLedgerInput" : "jnCrLedgerInput");
    const amountEl = document.getElementById(isDr ? "jnDrAmountInput" : "jnCrAmountInput");
    const ledgerId = ledgerSel?.value || "";
    const opt = ledgerSel?.selectedOptions[0];
    const amount = parseFloat(amountEl?.value) || 0;
    if (!ledgerId) {
      alert(isDr ? "Please choose an account for Debit." : "Please choose an account for Credit.");
      return false;
    }
    if (!amount || amount <= 0) {
      alert("Please enter amount.");
      return false;
    }
    const ledgerName = (opt?.textContent || "").split(" (")[0].trim();
    const line = { ledgerId, ledgerName, drCr, amount };

    if (journalEditingIndex > -1) {
      journalLineItems[journalEditingIndex] = line;
      journalEditingIndex = -1;
      document.getElementById("addJnDebitBtn").textContent = "+ Add Debit";
      document.getElementById("addJnCreditBtn").textContent = "+ Add Credit";
    } else {
      journalLineItems.push(line);
    }
    clearJournalSideFields(isDr ? "Dr" : "Cr");
    renderJournalLines();
    return true;
  }

  window.editJournalLine = function (index) {
    const line = journalLineItems[index];
    if (!line) return;
    clearJournalSideFields();
    if (line.drCr === "Dr") {
      const drSel = document.getElementById("jnDrLedgerInput");
      if (drSel) drSel.value = line.ledgerId;
      document.getElementById("jnDrAmountInput").value = line.amount;
      document.getElementById("addJnDebitBtn").textContent = "Update Debit";
    } else {
      const crSel = document.getElementById("jnCrLedgerInput");
      if (crSel) crSel.value = line.ledgerId;
      document.getElementById("jnCrAmountInput").value = line.amount;
      document.getElementById("addJnCreditBtn").textContent = "Update Credit";
    }
    journalEditingIndex = index;
    document.getElementById("voucherJournalSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  window.deleteJournalLine = function (index) {
    if (journalLineItems[index] === undefined) return;
    journalLineItems.splice(index, 1);
    if (journalEditingIndex === index) {
      journalEditingIndex = -1;
      document.getElementById("addJnDebitBtn").textContent = "+ Add Debit";
      document.getElementById("addJnCreditBtn").textContent = "+ Add Credit";
      clearJournalSideFields();
    } else if (journalEditingIndex > index) journalEditingIndex -= 1;
    renderJournalLines();
  };

  async function loadJournalLedgerDropdown() {
    try {
      const res = await fetch(`${API_URL}/api/ledgers`, { headers: khataHeaders() });
      const data = await res.json();
      if (!data.success) return;
      invoiceLedgerCache = data.ledgers || [];
      const options = '<option value="">Choose account...</option>' +
        (data.ledgers || []).map(l =>
          `<option value="${l._id}">${escapeHtml(l.partyName)} (${escapeHtml(l.ledgerGroup || "")})</option>`
        ).join("");
      ["jnDrLedgerInput", "jnCrLedgerInput"].forEach((id) => {
        const sel = document.getElementById(id);
        if (sel) sel.innerHTML = options;
      });
    } catch (err) { console.error("Journal ledger load:", err); }
  }

  function updateVoucherEffectSummary() {
    const type = document.getElementById("voucherTypeInput")?.value || "";
    const box = document.getElementById("voucherEffectSummary");
    if (!box) return;
    const isAdjust = ["Debit Note", "Credit Note", "Journal", "Contra"].includes(type);
    if (!isAdjust) { box.classList.add("hidden"); return; }

    const isDebitCredit = type === "Debit Note" || type === "Credit Note";
    const isJournal = type === "Journal";
    const amount = isDebitCredit
      ? getVcnGrandTotal()
      : isJournal
        ? sumJournalSide(journalLineItems, "Dr")
        : (parseFloat(document.getElementById("voucherAdjAmountInput")?.value) || 0);
    const partyName = document.getElementById("voucherPartySearch")?.value?.trim() || "—";
    const secSel = document.getElementById("voucherSecondaryInput");
    const secName = secSel?.selectedOptions[0]?.textContent?.split(" (")[0] || "—";
    const itemCount = vcnLineItems.length;
    const jnCount = journalLineItems.length;
    const totalDr = sumJournalSide(journalLineItems, "Dr");
    const totalCr = sumJournalSide(journalLineItems, "Cr");
    if (!amount && !itemCount && !jnCount) { box.classList.add("hidden"); return; }

    let html = "";
    if (type === "Debit Note") {
      html = `<strong>Purchase Return effect:</strong> Customer <strong>${escapeHtml(partyName)}</strong> balance will <strong>increase by ₹${amount.toFixed(2)}</strong> (additional charge).${itemCount ? ` Items: ${itemCount} line(s). Stock will decrease.` : ""}`;
    } else if (type === "Credit Note") {
      html = `<strong>Sales Return effect:</strong> Customer <strong>${escapeHtml(partyName)}</strong> balance will <strong>decrease by ₹${amount.toFixed(2)}</strong> (return / discount).${itemCount ? ` Items: ${itemCount} line(s). Stock will increase.` : ""}`;
    } else if (type === "Journal") {
      box.classList.add("hidden");
      return;
    } else if (type === "Contra") {
      html = `<strong>Contra transfer:</strong> <strong>${escapeHtml(partyName)}</strong> → <strong>${escapeHtml(secName)}</strong> for ₹${amount.toFixed(2)} (Cash ↔ Bank).`;
    }
    box.innerHTML = html;
    box.classList.remove("hidden");
  }

  function updateVoucherFormUI() {
    const type = document.getElementById("voucherTypeInput")?.value || "Sales";
    const purchaseBox = document.getElementById("voucherPurchaseFields");
    const stockBox = document.getElementById("voucherStockFields");
    const payReceiptBox = document.getElementById("voucherPayReceiptFields");
    const adjustBox = document.getElementById("voucherAdjustFields");
    const dnCnSection = document.getElementById("voucherDnCnItemSection");
    const journalSection = document.getElementById("voucherJournalSection");
    const partyField = document.getElementById("voucherPartyField");
    const secondaryWrap = document.getElementById("voucherSecondaryWrap");
    const partyLabel = document.getElementById("voucherPartyLabel");
    const rateLabel = document.getElementById("voucherRateLabel");
    const gstField = document.getElementById("voucherGstField");
    const payReceiptTitle = document.getElementById("voucherPayReceiptTitle");
    const adjustTitle = document.getElementById("voucherAdjustTitle");
    const adjustHint = document.getElementById("voucherAdjustHint");
    const reasonWrap = document.getElementById("voucherReasonWrap");
    const refWrap = document.getElementById("voucherRefWrap");
    const adjAmountWrap = document.getElementById("voucherAdjAmountWrap");
    const secLabel = document.querySelector("#voucherSecondaryWrap .voucher-label");

    const isPurchase = type === "Purchase";
    const isSales = type === "Sales";
    const isPayment = type === "Payment";
    const isReceipt = type === "Receipt";
    const isPayReceipt = isPayment || isReceipt;
    const isStock = isPurchase || isSales;
    const isDebitNote = type === "Debit Note";
    const isCreditNote = type === "Credit Note";
    const isDebitCredit = isDebitNote || isCreditNote;
    const isJournal = type === "Journal";
    const isContra = type === "Contra";
    const isJournalContra = isJournal || isContra;
    const isAdjust = isDebitCredit || isJournalContra;

    purchaseBox?.classList.toggle("hidden", !isPurchase);
    stockBox?.classList.toggle("hidden", !isStock);
    payReceiptBox?.classList.toggle("hidden", !isPayReceipt);
    adjustBox?.classList.toggle("hidden", !isAdjust || isJournal);
    dnCnSection?.classList.toggle("hidden", !isDebitCredit);
    journalSection?.classList.toggle("hidden", !isJournal);
    partyField?.classList.toggle("hidden", isJournal);
    secondaryWrap?.classList.toggle("hidden", !isContra);
    gstField?.classList.toggle("hidden", !isStock);
    reasonWrap?.classList.toggle("hidden", !isDebitCredit);
    refWrap?.classList.toggle("hidden", !isDebitCredit);
    adjAmountWrap?.classList.toggle("hidden", isDebitCredit || isJournal);

    if (partyLabel) {
      partyLabel.textContent = isPurchase
        ? "Supplier / Party (Sundry Creditor) *"
        : isPayment
          ? "Paid To (Party / Ledger) *"
          : isReceipt
            ? "Received From (Party / Ledger) *"
            : isDebitNote
              ? "Customer / Party (Sundry Debtor) *"
              : isCreditNote
                ? "Customer / Party (Sundry Debtor) *"
                : isJournal
                  ? "Debit Ledger (Dr) *"
                  : isContra
                    ? "From Ledger (Cash / Bank) *"
                    : "Party / Ledger *";
    }
    if (secLabel) {
      secLabel.textContent = isContra ? "To Ledger (Cash / Bank) *" : "Credit Ledger (Cr) *";
    }
    if (payReceiptTitle) {
      payReceiptTitle.textContent = isPayment ? "💸 Payment Details" : "💰 Receipt Details";
    }
    if (adjustTitle) {
      adjustTitle.textContent = isDebitNote
        ? "📋 Purchase Return Details"
        : isCreditNote
          ? "📋 Sales Return Details"
          : isJournal
            ? "📒 Journal Entry"
            : "🔄 Contra Entry";
    }
    if (adjustHint) {
      adjustHint.textContent = isDebitNote
        ? "Purchase return — additional charge to customer, increases receivable balance."
        : isCreditNote
          ? "Sales return or discount — reduces what customer owes."
          : isJournal
            ? ""
            : isContra
              ? "Cash ↔ Bank transfer between two ledgers."
              : "";
    }
    if (rateLabel) {
      rateLabel.textContent = isPurchase ? "Purchase Rate ₹" : "Sale Rate ₹";
    }

    const dateInput = document.getElementById("voucherDateInput");
    const prDateInput = document.getElementById("voucherPrDateInput");
    const adjDateInput = document.getElementById("voucherAdjDateInput");
    const jnDateInput = document.getElementById("voucherJnDateInput");
    const today = new Date().toISOString().slice(0, 10);
    if (dateInput && !dateInput.value) dateInput.value = today;
    if (prDateInput && !prDateInput.value) prDateInput.value = today;
    if (adjDateInput && !adjDateInput.value) adjDateInput.value = today;
    if (jnDateInput && !jnDateInput.value) jnDateInput.value = today;
    if (isDebitCredit) loadVcnItemDropdown();
    if (isJournal) loadJournalLedgerDropdown();
    updateVoucherEffectSummary();
  }

  document.getElementById("voucherTypeInput")?.addEventListener("change", updateVoucherFormUI);
  document.getElementById("addVcnItemBtn")?.addEventListener("click", addVcnLineItem);
  document.getElementById("addJnDebitBtn")?.addEventListener("click", () => addJournalLineFromSide("Dr"));
  document.getElementById("addJnCreditBtn")?.addEventListener("click", () => addJournalLineFromSide("Cr"));
  document.getElementById("voucherAdjAmountInput")?.addEventListener("input", updateVoucherEffectSummary);
  document.getElementById("voucherPartySearch")?.addEventListener("input", updateVoucherEffectSummary);
  document.getElementById("voucherSecondaryInput")?.addEventListener("change", updateVoucherEffectSummary);
  document.getElementById("vcnItemInput")?.addEventListener("change", () => {
    const opt = document.getElementById("vcnItemInput")?.selectedOptions[0];
    const rate = parseFloat(opt?.dataset.sale) || parseFloat(opt?.dataset.purchase) || 0;
    const rateEl = document.getElementById("vcnRateInput");
    if (rateEl && rate > 0) rateEl.value = rate;
  });

  function calcVoucherAmountFromItem() {
    const type = document.getElementById("voucherTypeInput")?.value;
    if (type !== "Sales" && type !== "Purchase") return;
    const itemSel = document.getElementById("voucherItemInput");
    const qty = parseFloat(document.getElementById("voucherQtyInput")?.value) || 0;
    const rateManual = parseFloat(document.getElementById("voucherRateInput")?.value);
    const gst = parseFloat(document.getElementById("voucherGstInput")?.value) || 0;
    const amountEl = document.getElementById("voucherAmountInput");
    if (!itemSel || !amountEl || !qty) return;

    let rate = rateManual;
    if (!rate && itemSel.value) {
      const opt = itemSel.selectedOptions[0];
      rate = type === "Purchase"
        ? parseFloat(opt?.dataset.purchase) || 0
        : parseFloat(opt?.dataset.sale) || 0;
      if (rate && document.getElementById("voucherRateInput")) {
        document.getElementById("voucherRateInput").value = rate;
      }
    }
    if (!rate) return;
    const taxable = rate * qty;
    const total = taxable + (taxable * gst / 100);
    amountEl.value = total.toFixed(2);
  }

  ["voucherQtyInput", "voucherRateInput", "voucherGstInput"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", calcVoucherAmountFromItem);
  });
  document.getElementById("voucherItemInput")?.addEventListener("change", () => {
    document.getElementById("voucherRateInput").value = "";
    calcVoucherAmountFromItem();
  });

  async function loadLedgerDropdowns() {
    try {
      const res = await fetch(`${API_URL}/api/ledgers`, { headers: khataHeaders() });
      const data = await res.json();
      if (!data.success) return;
      invoiceLedgerCache = data.ledgers || [];
      const secSel = document.getElementById("voucherSecondaryInput");
      if (secSel) secSel.innerHTML = '<option value="">-- Select Second Ledger --</option>' +
        data.ledgers.map(l => `<option value="${l._id}">${escapeHtml(l.partyName)} (${escapeHtml(l.ledgerGroup)})</option>`).join("");
    } catch (err) { console.error("Ledger dropdown load error:", err); }
  }

  async function loadItemDropdown() {
    try {
      const res = await fetch(`${API_URL}/api/items`, { headers: khataHeaders() });
      const data = await res.json();
      if (!data.success) return;
      const sel = document.getElementById("voucherItemInput");
      if (sel) sel.innerHTML = '<option value="">-- Select Item --</option>' +
        data.items.map(i => `<option value="${i._id}" data-purchase="${i.purchasePrice || 0}" data-sale="${i.sellingPrice || 0}">${escapeHtml(i.itemName)} (Stock: ${i.stockQty})</option>`).join("");
    } catch (err) { console.error("Item dropdown load error:", err); }
  }

  document.getElementById("saveVoucherBtn")?.addEventListener("click", async () => {
    const voucherType = document.getElementById("voucherTypeInput").value;
    const partyId = document.getElementById("voucherPartyInput").value;
    const secondaryLedgerId = document.getElementById("voucherSecondaryInput")?.value || "";
    const itemId = document.getElementById("voucherItemInput").value;
    const qty = parseFloat(document.getElementById("voucherQtyInput").value) || 0;
    const rate = parseFloat(document.getElementById("voucherRateInput")?.value) || 0;
    const gstRate = parseFloat(document.getElementById("voucherGstInput")?.value) || 0;
    let amount = parseFloat(document.getElementById("voucherAmountInput").value) || 0;
    const note = document.getElementById("voucherNoteInput").value.trim();
    const supplierInvoiceNo = document.getElementById("voucherBillNoInput")?.value.trim() || "";
    const supplierGstin = document.getElementById("voucherSupplierGstinInput")?.value.trim() || "";
    let paymentMode = document.getElementById("voucherPaymentModeInput")?.value || "";
    let voucherDate = document.getElementById("voucherDateInput")?.value || "";
    const statusText = document.getElementById("voucherStatusText");

    const isDebitCredit = voucherType === "Debit Note" || voucherType === "Credit Note";
    const isJournalContra = voucherType === "Journal" || voucherType === "Contra";

    if (voucherType === "Payment" || voucherType === "Receipt") {
      amount = parseFloat(document.getElementById("voucherPrAmountInput")?.value) || 0;
      paymentMode = document.getElementById("voucherPrModeInput")?.value || "Cash";
      voucherDate = document.getElementById("voucherPrDateInput")?.value || voucherDate;
    } else if (voucherType === "Contra") {
      amount = parseFloat(document.getElementById("voucherAdjAmountInput")?.value) || 0;
      voucherDate = document.getElementById("voucherAdjDateInput")?.value || voucherDate;
    } else if (voucherType === "Journal") {
      voucherDate = document.getElementById("voucherJnDateInput")?.value
        || document.getElementById("voucherAdjDateInput")?.value
        || voucherDate;
    } else if (isDebitCredit) {
      voucherDate = document.getElementById("voucherAdjDateInput")?.value || voucherDate;
    }

    if (voucherType !== "Journal" && !partyId) {
      alert("Please select a party / ledger from the list."); return;
    }
    if (voucherType === "Purchase" && !supplierInvoiceNo) {
      alert("Please enter Supplier Invoice No. for the purchase bill."); return;
    }
    if (voucherType === "Contra" && !secondaryLedgerId) {
      alert("Please select the second ledger for Contra."); return;
    }
    let items = [];
    let journalEntries = [];
    if (voucherType === "Journal") {
      if (journalLineItems.length < 2) {
        alert("Add at least two journal lines (Dr and Cr).");
        return;
      }
      const totalDr = sumJournalSide(journalLineItems, "Dr");
      const totalCr = sumJournalSide(journalLineItems, "Cr");
      if (Math.abs(totalDr - totalCr) >= 0.009) {
        alert("Journal not balanced — total Dr must equal total Cr.");
        return;
      }
      if (totalDr <= 0) {
        alert("Journal amount must be greater than zero.");
        return;
      }
      journalEntries = journalLineItems.map((line) => ({
        ledgerId: line.ledgerId,
        drCr: line.drCr,
        amount: line.amount
      }));
      amount = totalDr;
    } else if (isDebitCredit) {
      if (!vcnLineItems.length) {
        alert("Please add at least one item line in the table.");
        return;
      }
      items = vcnLineItems.map((line) => ({
        itemId: line.itemId, qty: line.qty, rate: line.rate, gstRate: line.gstRate
      }));
      amount = getVcnGrandTotal();
    } else if ((voucherType === "Sales" || voucherType === "Purchase") && itemId) {
      const itemSel = document.getElementById("voucherItemInput");
      const useRate = rate || parseFloat(
        voucherType === "Purchase"
          ? itemSel.selectedOptions[0]?.dataset.purchase
          : itemSel.selectedOptions[0]?.dataset.sale
      ) || 0;
      if (!amount && useRate && qty) {
        const taxable = useRate * qty;
        amount = taxable + (taxable * gstRate / 100);
      }
      items.push({ itemId, qty, rate: useRate, gstRate });
    }

    if (!amount || amount <= 0) {
      alert(voucherType === "Payment" || voucherType === "Receipt"
        ? "Please enter payment / receipt amount."
        : voucherType === "Contra"
          ? "Please enter the contra amount."
          : isDebitCredit
            ? "Please add at least one item line in the table."
            : "Enter amount (or let Item + Qty + Rate calculate it automatically).");
      return;
    }

    const refNo = document.getElementById("voucherRefNoInput")?.value.trim() || "";
    const reason = document.getElementById("voucherReasonInput")?.value || "";
    const noteParts = [note];
    if (refNo) noteParts.unshift(`Ref: ${refNo}`);
    if (reason) noteParts.unshift(`Reason: ${reason}`);
    const fullNote = noteParts.filter(Boolean).join(" | ");
    const voucherSaveBtn = document.getElementById("saveVoucherBtn");

    await window.bkWithSaveLock(voucherSaveBtn, async () => {
    try {
      const res = await fetch(`${API_URL}/api/vouchers`, {
        method: "POST", headers: khataHeaders(),
        body: JSON.stringify({
          voucherType,
          partyId: voucherType === "Journal" ? undefined : partyId,
          secondaryLedgerId: voucherType === "Contra" ? (secondaryLedgerId || undefined) : undefined,
          amount,
          items,
          journalEntries: journalEntries.length ? journalEntries : undefined,
          note: fullNote,
          supplierInvoiceNo: refNo || supplierInvoiceNo,
          supplierGstin,
          paymentMode,
          voucherDate
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Save fail hua");

      if (statusText) { statusText.textContent = "✅ " + data.message; statusText.style.color = "#22c55e"; }
      document.getElementById("voucherAmountInput").value = "";
      document.getElementById("voucherQtyInput").value = "";
      document.getElementById("voucherRateInput").value = "";
      document.getElementById("voucherNoteInput").value = "";
      document.getElementById("voucherAdjAmountInput").value = "";
      document.getElementById("voucherRefNoInput").value = "";
      document.getElementById("voucherReasonInput").value = "";
      document.getElementById("voucherPrAmountInput").value = "";
      vcnLineItems = [];
      vcnEditingIndex = -1;
      renderVcnItems();
      clearVcnEntryFields();
      journalLineItems = [];
      journalEditingIndex = -1;
      renderJournalLines();
      clearJournalSideFields();
      document.getElementById("addJnDebitBtn").textContent = "+ Add Debit";
      document.getElementById("addJnCreditBtn").textContent = "+ Add Credit";
      if (typeof clearLedgerPartyAutocomplete === "function") {
        clearLedgerPartyAutocomplete("voucherPartyInput", "voucherPartySearch", "voucherPartySuggest");
      }
      if (voucherType === "Purchase") {
        document.getElementById("voucherBillNoInput").value = "";
        document.getElementById("voucherSupplierGstinInput").value = "";
      }
      updateVoucherEffectSummary();
      if (typeof loadKhataLedgers === "function") loadKhataLedgers();
      if (typeof refreshUdharKhata === "function") refreshUdharKhata();
    } catch (err) {
      if (statusText) { statusText.textContent = "❌ " + err.message; statusText.style.color = "#ef4444"; }
    }
    });
  });

  updateVoucherFormUI();
  renderJournalLines();

  // ---------- PURCHASE PANEL (sidebar — Invoice jaisa multi-item table) ----------
  let purchaseLineItems = [];
  let purchaseEditingIndex = -1;
  let purchaseStockItemsCache = [];

  function findPurchaseStockItem(name) {
    const q = String(name || "").trim().toLowerCase();
    if (!q) return null;
    return purchaseStockItemsCache.find(i => String(i.itemName || "").trim().toLowerCase() === q) || null;
  }

  function applyPurchaseStockItemToFields(name) {
    const match = findPurchaseStockItem(name);
    const hiddenId = document.getElementById("pvItemInput");
    const hsnEl = document.getElementById("pvHsnDisplay");
    const unitTag = document.getElementById("pvUnitTag");
    const gstEl = document.getElementById("pvGstInput");
    const rateEl = document.getElementById("pvRateInput");
    if (!match) {
      if (hiddenId) hiddenId.value = "";
      return false;
    }
    if (hiddenId) hiddenId.value = match._id;
    if (hsnEl) hsnEl.value = match.hsnCode || "";
    if (unitTag) unitTag.textContent = match.unit || "Pcs";
    if (gstEl && match.gstRate != null) gstEl.value = String(match.gstRate);
    const rate = parseFloat(match.purchasePrice) || 0;
    if (rateEl && rate > 0) rateEl.value = rate;
    return true;
  }

  function purchaseLineTotal(line) {
    const rate = parseFloat(line.rate) || 0;
    const qty = parseFloat(line.qty) || 0;
    const gstRate = parseFloat(line.gstRate) || 0;
    const taxable = rate * qty;
    return taxable + (taxable * gstRate / 100);
  }

  function updatePurchaseTaxSummary() {
    const taxBody = document.getElementById("pvTaxSummaryBody");
    const taxDesc = document.getElementById("pvTaxTypeDesc");
    const billInfo = document.getElementById("pvBillInfo");
    if (!taxBody) return;

    const buckets = {};
    let grand = 0;
    purchaseLineItems.forEach((line) => {
      const gst = parseFloat(line.gstRate) || 0;
      const taxable = (parseFloat(line.rate) || 0) * (parseFloat(line.qty) || 0);
      const tax = taxable * gst / 100;
      grand += taxable + tax;
      if (!buckets[gst]) buckets[gst] = { taxable: 0, tax: 0 };
      buckets[gst].taxable += taxable;
      buckets[gst].tax += tax;
    });

    const rates = Object.keys(buckets).map(Number).sort((a, b) => a - b);
    if (!rates.length) {
      taxBody.innerHTML = "<tr><td colspan=\"3\">Add items to see tax breakup</td></tr>";
      if (taxDesc) taxDesc.textContent = "Add items to see GST breakup.";
    } else {
      taxBody.innerHTML = rates.map((r) =>
        `<tr><td>${r}%</td><td>₹${buckets[r].taxable.toFixed(2)}</td><td>₹${buckets[r].tax.toFixed(2)}</td></tr>`
      ).join("");
      if (taxDesc) taxDesc.textContent = `Purchase total incl. GST: ₹${grand.toFixed(2)}`;
    }

    if (billInfo) {
      const party = document.getElementById("pvPartySearch")?.value.trim() || "—";
      const billNo = document.getElementById("pvBillNoInput")?.value.trim() || "—";
      billInfo.textContent = `Supplier: ${party} · Bill No: ${billNo} · Lines: ${purchaseLineItems.length}`;
    }
  }

  function syncPurchaseItemMetaFromSelect() {
    const name = document.getElementById("pvItemNameInput")?.value.trim() || "";
    applyPurchaseStockItemToFields(name);
  }

  function renderPurchaseItems() {
    const body = document.getElementById("pvItemsBody");
    const grandEl = document.getElementById("pvGrandTotal");
    if (!body) return;

    body.innerHTML = "";
    let grand = 0;

    if (purchaseLineItems.length) {
      purchaseLineItems.forEach((line, index) => {
        const lineTotal = purchaseLineTotal(line);
        grand += lineTotal;
        const hsnLine = line.hsn ? `<br><small style="color:#666">HSN: ${escapeHtml(line.hsn)}</small>` : "";
        const gstSmall = line.gstRate > 0 ? `<br><small style="color:#666">GST ${line.gstRate}%</small>` : "";
        const row = document.createElement("tr");
        row.innerHTML = `
          <td class="col-sn">${index + 1}</td>
          <td class="col-item">${escapeHtml(line.itemName) || "-"}${hsnLine}${gstSmall}</td>
          <td class="col-qty">${line.qty}</td>
          <td class="col-unit">${escapeHtml(line.unit || "Pcs")}</td>
          <td class="col-price">₹${(parseFloat(line.rate) || 0).toFixed(2)}</td>
          <td class="inv-amt-cell">₹${lineTotal.toFixed(2)}</td>
          <td>
            <div class="inv-row-actions">
              <button type="button" class="inv-row-edit" onclick="editPurchaseItem(${index})">Edit</button>
              <button type="button" class="inv-row-del" onclick="deletePurchaseItem(${index})">Del</button>
            </div>
          </td>`;
        body.appendChild(row);
      });
    } else {
      body.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:12px;">Select supplier, add items with Add Item (F2).</td></tr>`;
    }

    if (grandEl) grandEl.textContent = grand.toFixed(2);
    updatePurchaseTaxSummary();
  }

  function clearPurchaseEntryFields() {
    const nameEl = document.getElementById("pvItemNameInput");
    if (nameEl) nameEl.value = "";
    const hiddenId = document.getElementById("pvItemInput");
    if (hiddenId) hiddenId.value = "";
    const hsnEl = document.getElementById("pvHsnDisplay");
    if (hsnEl) hsnEl.value = "";
    const unitTag = document.getElementById("pvUnitTag");
    if (unitTag) unitTag.textContent = "Pcs";
    const qtyEl = document.getElementById("pvQtyInput");
    if (qtyEl) qtyEl.value = "1";
    const rateEl = document.getElementById("pvRateInput");
    if (rateEl) rateEl.value = "";
    const gstEl = document.getElementById("pvGstInput");
    if (gstEl) gstEl.value = "18";
  }

  function executePurchaseAdd() {
    const itemName = document.getElementById("pvItemNameInput")?.value.trim() || "";
    let itemId = document.getElementById("pvItemInput")?.value || "";
    const stockMatch = findPurchaseStockItem(itemName);
    if (stockMatch) itemId = String(stockMatch._id);
    const qty = parseFloat(document.getElementById("pvQtyInput")?.value) || 0;
    let rate = parseFloat(document.getElementById("pvRateInput")?.value);
    const gstRate = parseFloat(document.getElementById("pvGstInput")?.value) || 0;
    const statusText = document.getElementById("pvStatusText");
    const hsn = document.getElementById("pvHsnDisplay")?.value.trim() || "";
    const unit = document.getElementById("pvUnitTag")?.textContent.trim() || "Pcs";

    if (!itemName) {
      if (typeof showToast === "function") showToast("Enter item name to add.", "error");
      else alert("Please enter item name.");
      return false;
    }
    if (!qty || qty <= 0) { alert("Please enter quantity."); return false; }
    if (Number.isNaN(rate) || rate <= 0) {
      rate = parseFloat(stockMatch?.purchasePrice) || 0;
    }
    if (!rate || rate <= 0) { alert("Please enter purchase rate."); return false; }

    const line = {
      itemId: itemId || null,
      itemName,
      unit: stockMatch?.unit || unit,
      hsn: stockMatch?.hsnCode || hsn,
      qty,
      rate,
      gstRate
    };

    if (purchaseEditingIndex > -1) {
      purchaseLineItems[purchaseEditingIndex] = line;
      purchaseEditingIndex = -1;
      const addBtn = document.getElementById("addPurchaseItemBtn");
      if (addBtn) addBtn.textContent = "Add Item (F2)";
    } else {
      purchaseLineItems.push(line);
    }

    clearPurchaseEntryFields();
    if (statusText) statusText.textContent = "";
    renderPurchaseItems();
    return true;
  }

  window.executePurchaseAdd = executePurchaseAdd;

  window.editPurchaseItem = function (index) {
    const line = purchaseLineItems[index];
    if (!line) return;
    const nameEl = document.getElementById("pvItemNameInput");
    if (nameEl) nameEl.value = line.itemName || "";
    const hiddenId = document.getElementById("pvItemInput");
    if (hiddenId) hiddenId.value = line.itemId || "";
    const hsnEl = document.getElementById("pvHsnDisplay");
    if (hsnEl) hsnEl.value = line.hsn || "";
    const unitTag = document.getElementById("pvUnitTag");
    if (unitTag) unitTag.textContent = line.unit || "Pcs";
    const qtyEl = document.getElementById("pvQtyInput");
    if (qtyEl) qtyEl.value = line.qty;
    const rateEl = document.getElementById("pvRateInput");
    if (rateEl) rateEl.value = line.rate;
    const gstEl = document.getElementById("pvGstInput");
    if (gstEl) gstEl.value = line.gstRate;
    purchaseEditingIndex = index;
    const addBtn = document.getElementById("addPurchaseItemBtn");
    if (addBtn) addBtn.textContent = "Update Item (F2)";
    const statusText = document.getElementById("pvStatusText");
    if (statusText) statusText.textContent = "✏️ Editing row #" + (index + 1) + ". Change and click Update Item.";
  };

  window.deletePurchaseItem = function (index) {
    if (purchaseLineItems[index] === undefined) return;
    purchaseLineItems.splice(index, 1);
    if (purchaseEditingIndex === index) {
      purchaseEditingIndex = -1;
      const addBtn = document.getElementById("addPurchaseItemBtn");
      if (addBtn) addBtn.textContent = "Add Item (F2)";
      clearPurchaseEntryFields();
    } else if (purchaseEditingIndex > index) {
      purchaseEditingIndex -= 1;
    }
    renderPurchaseItems();
  };

  function updatePurchaseDateDisplay() {
    const display = document.getElementById("pvDateDisplay");
    if (!display) return;
    const raw = document.getElementById("pvDateInput")?.value;
    display.textContent = formatVoucherDateChip(raw);
  }

  async function loadPurchasePanelDropdowns() {
    try {
      const [ledRes, itemRes] = await Promise.all([
        fetch(`${API_URL}/api/ledgers`, { headers: khataHeaders() }),
        fetch(`${API_URL}/api/items`, { headers: khataHeaders() })
      ]);
      const ledData = await ledRes.json();
      const itemData = await itemRes.json();
      if (ledData.success) invoiceLedgerCache = ledData.ledgers || [];
      if (itemData.success) {
        purchaseStockItemsCache = itemData.items || [];
        const dl = document.getElementById("pvStockList");
        if (dl) {
          dl.innerHTML = purchaseStockItemsCache.map(i =>
            `<option value="${escapeHtml(i.itemName)}"></option>`
          ).join("");
        }
      }
    } catch (err) {
      console.error("Purchase modal dropdown load:", err);
    }
  }

  function refreshPurchasePanel() {
    const dateEl = document.getElementById("pvDateInput");
    if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().slice(0, 10);
    updatePurchaseDateDisplay();
    loadPurchasePanelDropdowns();
    renderPurchaseItems();
  }

  window.refreshPurchasePanel = refreshPurchasePanel;
  window.openPurchaseVoucherModal = function () {
    if (typeof openPanel === "function") openPanel("purchasePanel");
  };

  document.getElementById("pvDateInput")?.addEventListener("change", updatePurchaseDateDisplay);
  document.getElementById("pvDateInput")?.addEventListener("input", updatePurchaseDateDisplay);

  document.getElementById("pvItemNameInput")?.addEventListener("input", (e) => {
    applyPurchaseStockItemToFields(e.target.value);
  });
  document.getElementById("pvItemNameInput")?.addEventListener("change", (e) => {
    applyPurchaseStockItemToFields(e.target.value);
  });
  ["pvPartySearch", "pvBillNoInput"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", updatePurchaseTaxSummary);
  });

  document.getElementById("addPurchaseItemBtn")?.addEventListener("click", executePurchaseAdd);

  document.getElementById("savePurchaseVoucherBtn")?.addEventListener("click", async () => {
    const partyId = document.getElementById("pvPartyInput")?.value || "";
    const note = document.getElementById("pvNoteInput")?.value.trim() || "";
    const supplierInvoiceNo = document.getElementById("pvBillNoInput")?.value.trim() || "";
    const supplierGstin = document.getElementById("pvSupplierGstinInput")?.value.trim() || "";
    const paymentMode = document.getElementById("pvPaymentModeInput")?.value || "";
    const voucherDate = document.getElementById("pvDateInput")?.value || "";
    const statusText = document.getElementById("pvStatusText");

    if (!partyId) { alert("Please select a supplier / party from the list."); return; }
    if (!supplierInvoiceNo) { alert("Please enter Supplier Invoice No. for the purchase bill."); return; }
    if (!purchaseLineItems.length) {
      alert("Please add at least one item with Add Item (F2).");
      return;
    }

    const items = purchaseLineItems.map((line) => ({
      itemId: line.itemId || undefined,
      itemName: line.itemName,
      qty: line.qty,
      rate: line.rate,
      gstRate: line.gstRate
    }));
    const amount = purchaseLineItems.reduce((sum, line) => sum + purchaseLineTotal(line), 0);

    if (!amount || amount <= 0) {
      alert("Total amount invalid — check item qty and rate.");
      return;
    }

    const purchaseSaveBtn = document.getElementById("savePurchaseVoucherBtn");
    await window.bkWithSaveLock(purchaseSaveBtn, async () => {
    try {
      const res = await fetch(`${API_URL}/api/vouchers`, {
        method: "POST", headers: khataHeaders(),
        body: JSON.stringify({
          voucherType: "Purchase", partyId, amount, items, note,
          supplierInvoiceNo, supplierGstin, paymentMode, voucherDate
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Save fail hua");
      if (statusText) { statusText.textContent = "✅ " + data.message; statusText.style.color = "#22c55e"; }
      showToast("✅ Purchase bill saved!");
      if (typeof loadKhataLedgers === "function") loadKhataLedgers();
      if (typeof refreshUdharKhata === "function") refreshUdharKhata();
      purchaseLineItems = [];
      purchaseEditingIndex = -1;
      renderPurchaseItems();
      ["pvBillNoInput", "pvSupplierGstinInput", "pvNoteInput"]
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
      clearPurchaseEntryFields();
      const addBtn = document.getElementById("addPurchaseItemBtn");
      if (addBtn) addBtn.textContent = "Add Item (F2)";
      if (typeof clearLedgerPartyAutocomplete === "function") {
        clearLedgerPartyAutocomplete("pvPartyInput", "pvPartySearch", "pvPartySuggest");
      }
    } catch (err) {
      if (statusText) { statusText.textContent = "❌ " + err.message; statusText.style.color = "#ef4444"; }
      showToast("❌ " + err.message, "error");
    }
    });
  });

  window.refreshKhataVoucherPanel = () => {
    loadLedgerDropdowns();
    loadItemDropdown();
    loadVcnItemDropdown();
    loadJournalLedgerDropdown();
    renderVcnItems();
    renderJournalLines();
    updateVoucherFormUI();
  };

  // ---------- PAYMENT & RECEIPT VOUCHER PANELS (Main section) ----------
  async function ensurePayReceiptLedgerCache() {
    if (invoiceLedgerCache.length) return;
    try {
      const res = await fetch(`${API_URL}/api/ledgers`, { headers: khataHeaders() });
      const data = await res.json();
      if (data.success) invoiceLedgerCache = data.ledgers || [];
    } catch (err) {
      console.error("Pay/Receipt ledger load:", err);
    }
  }

  function updatePaymentDateDisplay() {
    const display = document.getElementById("pmvDateDisplay");
    const raw = document.getElementById("pmvDateInput")?.value;
    if (display) display.textContent = formatVoucherDateChip(raw);
  }

  function updateReceiptDateDisplay() {
    const display = document.getElementById("rcvDateDisplay");
    const raw = document.getElementById("rcvDateInput")?.value;
    if (display) display.textContent = formatVoucherDateChip(raw);
  }

  function refreshPaymentVoucherPanel() {
    const dateEl = document.getElementById("pmvDateInput");
    if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().slice(0, 10);
    updatePaymentDateDisplay();
    ensurePayReceiptLedgerCache();
  }

  function refreshReceiptVoucherPanel() {
    const dateEl = document.getElementById("rcvDateInput");
    if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().slice(0, 10);
    updateReceiptDateDisplay();
    ensurePayReceiptLedgerCache();
  }

  window.refreshPaymentVoucherPanel = refreshPaymentVoucherPanel;
  window.refreshReceiptVoucherPanel = refreshReceiptVoucherPanel;

  document.getElementById("pmvDateInput")?.addEventListener("change", updatePaymentDateDisplay);
  document.getElementById("pmvDateInput")?.addEventListener("input", updatePaymentDateDisplay);
  document.getElementById("rcvDateInput")?.addEventListener("change", updateReceiptDateDisplay);
  document.getElementById("rcvDateInput")?.addEventListener("input", updateReceiptDateDisplay);

  setupClickableDateChip("pvDateDisplay", "pvDateInput", updatePurchaseDateDisplay);
  setupClickableDateChip("pmvDateDisplay", "pmvDateInput", updatePaymentDateDisplay);
  setupClickableDateChip("rcvDateDisplay", "rcvDateInput", updateReceiptDateDisplay);

  async function saveSimpleVoucher(voucherType, fields, saveBtn) {
    const { partyId, amount, paymentMode, voucherDate, note, statusId, clearIds, partyHiddenId, partySearchId, partySuggestId } = fields;
    const statusText = document.getElementById(statusId);
    if (!partyId) { alert("Please select a party / ledger from the list."); return; }
    if (!amount || amount <= 0) { alert("Please enter amount."); return; }
    await window.bkWithSaveLock(saveBtn, async () => {
    try {
      const res = await fetch(`${API_URL}/api/vouchers`, {
        method: "POST", headers: khataHeaders(),
        body: JSON.stringify({
          voucherType, partyId, amount, items: [], note,
          paymentMode: paymentMode || "Cash", voucherDate
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Save failed");
      if (statusText) { statusText.textContent = "✅ " + data.message; statusText.style.color = "#22c55e"; }
      showToast(`✅ ${voucherType} voucher saved!`);
      clearIds.forEach((id) => { const el = document.getElementById(id); if (el) el.value = ""; });
      if (partyHiddenId && partySearchId && typeof clearLedgerPartyAutocomplete === "function") {
        clearLedgerPartyAutocomplete(partyHiddenId, partySearchId, partySuggestId);
      }
    } catch (err) {
      if (statusText) { statusText.textContent = "❌ " + err.message; statusText.style.color = "#ef4444"; }
      showToast("❌ " + err.message, "error");
    }
    });
  }

  document.getElementById("savePaymentVoucherBtn")?.addEventListener("click", () => {
    saveSimpleVoucher("Payment", {
      partyId: document.getElementById("pmvPartyInput")?.value || "",
      amount: parseFloat(document.getElementById("pmvAmountInput")?.value) || 0,
      paymentMode: document.getElementById("pmvPaymentModeInput")?.value || "Cash",
      voucherDate: document.getElementById("pmvDateInput")?.value || "",
      note: document.getElementById("pmvNoteInput")?.value.trim() || "",
      statusId: "pmvStatusText",
      partyHiddenId: "pmvPartyInput",
      partySearchId: "pmvPartySearch",
      partySuggestId: "pmvPartySuggest",
      clearIds: ["pmvAmountInput", "pmvNoteInput"]
    }, document.getElementById("savePaymentVoucherBtn"));
  });

  document.getElementById("saveReceiptVoucherBtn")?.addEventListener("click", () => {
    saveSimpleVoucher("Receipt", {
      partyId: document.getElementById("rcvPartyInput")?.value || "",
      amount: parseFloat(document.getElementById("rcvAmountInput")?.value) || 0,
      paymentMode: document.getElementById("rcvPaymentModeInput")?.value || "Cash",
      voucherDate: document.getElementById("rcvDateInput")?.value || "",
      note: document.getElementById("rcvNoteInput")?.value.trim() || "",
      statusId: "rcvStatusText",
      partyHiddenId: "rcvPartyInput",
      partySearchId: "rcvPartySearch",
      partySuggestId: "rcvPartySuggest",
      clearIds: ["rcvAmountInput", "rcvNoteInput"]
    }, document.getElementById("saveReceiptVoucherBtn"));
  });

  window.openPaymentVoucherPanel = function () {
    if (typeof openPanel === "function") openPanel("paymentVoucherPanel");
  };
  window.openReceiptVoucherPanel = function () {
    if (typeof openPanel === "function") openPanel("receiptVoucherPanel");
  };

  if (typeof setupVoucherPartyAutocompletes === "function") setupVoucherPartyAutocompletes();

  // ---------- DAY BOOK ----------
  async function loadKhataDaybook() {
    const body = document.getElementById("khataDaybookBody");
    if (!body) return;
    body.innerHTML = "<tr><td colspan='6'>Loading...</td></tr>";
    try {
      const res = await fetch(`${API_URL}/api/vouchers`, { headers: khataHeaders() });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      khataPag.daybook.data = data.vouchers || [];
      khataPag.daybook.page = 1;
      renderKhataTable("daybook");
    } catch (err) {
      body.innerHTML = `<tr><td colspan='6'>Error: ${err.message}</td></tr>`;
      updateKhataPaginationUI("daybook");
    }
  }

  window.syncKhataVoucherToTally = async function (id) {
    try {
      showToast("⌛ Syncing voucher to Tally...");
      const res = await fetch(`${API_URL}/api/tally/sync-voucher/${id}`, { method: "POST", headers: khataHeaders(), body: "{}" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Sync fail");
      showToast("✅ " + data.message);
      loadKhataDaybook();
    } catch (err) { showToast("❌ Tally sync: " + err.message, "error"); }
  };

})();
// ==========================================================================
// 🟢 ACCOUNTING — END
// ==========================================================================

// ==========================================================================
// 🟢 TOTAL SALES HISTORY (permanent record) — Invoice draft table se
// bilkul alag store se data leta hai. Draft se item delete karne se yeh
// history kabhi affect nahi hoti.
// ==========================================================================
(function () {
  const salesPanel = document.getElementById("overviewTabSales");
  if (!salesPanel) return;

  let currentPage = 1;
  let currentPageSize = 10;
  let currentSearch = "";
  let currentFromDate = "";
  let currentToDate = "";
  let currentQuickRange = "";
  let currentTotalPages = 1;
  let salesLoadToken = 0;
  let salesAbort = null;
  let salesLoading = false;
  let salesSearchTimer = null;

  function toInputDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function getQuickRangeDates(range) {
    const now = new Date();
    if (range === "thisMonth") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toInputDate(start), to: toInputDate(now) };
    }
    if (range === "lastMonth") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toInputDate(start), to: toInputDate(end) };
    }
    if (range === "thisYear") {
      const start = new Date(now.getFullYear(), 0, 1);
      return { from: toInputDate(start), to: toInputDate(now) };
    }
    return { from: "", to: "" };
  }

  function syncDateInputs() {
    const fromEl = document.getElementById("salesFromDate");
    const toEl = document.getElementById("salesToDate");
    if (fromEl) fromEl.value = currentFromDate;
    if (toEl) toEl.value = currentToDate;
  }

  function updateDateFilterLabel() {
    const label = document.getElementById("salesDateFilterLabel");
    if (!label) return;
    if (!currentFromDate && !currentToDate) {
      label.classList.add("hidden");
      label.textContent = "";
      return;
    }
    const fmt = (s) => {
      if (!s) return "—";
      const [y, m, d] = s.split("-");
      return `${d}/${m}/${y}`;
    };
    label.textContent = `Filtered: ${fmt(currentFromDate)} to ${fmt(currentToDate)}`;
    label.classList.remove("hidden");
  }

  function setQuickRangeActive(range) {
    currentQuickRange = range || "";
    document.querySelectorAll(".sales-quick-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.range === currentQuickRange);
    });
  }

  function applyDateFilter(from, to, quickRange) {
    currentFromDate = from || "";
    currentToDate = to || "";
    currentQuickRange = quickRange || "";
    syncDateInputs();
    setQuickRangeActive(currentQuickRange);
    updateDateFilterLabel();
    currentPage = 1;
    loadSalesHistory();
  }

  async function loadSalesHistory() {
    const body = document.getElementById("salesHistoryBody");
    if (!body) return;
    const token = ++salesLoadToken;
    if (salesAbort) {
      try { salesAbort.abort(); } catch { /* */ }
    }
    salesAbort = new AbortController();
    const signal = salesAbort.signal;
    salesLoading = true;
    if (!body.rows.length || body.textContent.includes("Loading")) {
      body.innerHTML = "<tr><td colspan='9' style='text-align:center;'>Loading...</td></tr>";
    }
    try {
      const params = new URLSearchParams({ page: currentPage, limit: currentPageSize });
      if (currentSearch) params.set("search", currentSearch);
      if (currentFromDate) params.set("fromDate", currentFromDate);
      if (currentToDate) params.set("toDate", currentToDate);

      const res = await fetch(`${API_URL}/api/sales?${params.toString()}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
        signal
      });
      const data = await res.json();
      if (token !== salesLoadToken) return;
      if (!data.success) throw new Error(data.error || "Load fail hua");

      currentTotalPages = data.totalPages || 1;

      if (!data.records.length) {
        const emptyMsg = currentSearch || currentFromDate || currentToDate
          ? "No records match this filter."
          : "No sales records yet.";
        body.innerHTML = `<tr><td colspan='9' style='text-align:center;'>${emptyMsg}</td></tr>`;
        window.bkSetTableAmountTotal(body, { hide: true });
      } else {
        const pageSum = data.records.reduce((s, r) => s + (parseFloat(r.totalAmount) || 0), 0);
        body.innerHTML = data.records.map(r => `
          <tr>
            <td>${new Date(r.date).toLocaleDateString("en-IN")}</td>
            <td style="color:var(--accent);font-weight:700;">${escapeHtml(r.invoiceNo) || "-"}</td>
            <td>${escapeHtml(r.customer)}</td>
            <td>${escapeHtml(r.product)}</td>
            <td>${r.qty}</td>
            <td style="color:#22c55e;font-weight:700;">₹${(r.totalAmount || 0).toFixed(2)}</td>
            <td>${r.paymentType || "Cash"}</td>
            <td><span style="background:#22c55e22;color:#22c55e;padding:3px 10px;border-radius:20px;font-weight:700;font-size:12px;">${r.status || "Paid"}</span></td>
            <td><button type="button" class="secondary sales-bill-btn" data-sale-id="${escapeHtml(r._id)}" title="Print / download bill">🖨 Bill</button></td>
          </tr>`).join("");
        window.bkSetTableAmountTotal(body, {
          label: "Page Total",
          amount: pageSum,
          rows: data.records.length,
          grand: (data.totalPages || 1) > 1 ? null : pageSum
        });
      }

      const total = data.total || 0;
      const start = total === 0 ? 0 : (data.page - 1) * currentPageSize + 1;
      const end = Math.min(data.page * currentPageSize, total);
      const info = document.getElementById("salesPaginationInfo");
      if (info) {
        info.textContent = total
          ? `Showing ${start}–${end} of ${total}`
          : "No entries";
      }
      const pageIndicator = document.getElementById("salesPageIndicator");
      if (pageIndicator) pageIndicator.textContent = `Page ${data.page} of ${data.totalPages}`;
      const prevBtn = document.getElementById("salesPrevBtn");
      const nextBtn = document.getElementById("salesNextBtn");
      if (prevBtn) prevBtn.disabled = data.page <= 1;
      if (nextBtn) nextBtn.disabled = data.page >= data.totalPages || total === 0;
      body.dataset.loaded = "1";
      if (typeof window.enhanceMobileTables === "function") {
        requestAnimationFrame(() => window.enhanceMobileTables(salesPanel));
      }
    } catch (err) {
      if (token !== salesLoadToken) return;
      if (err?.name === "AbortError") return;
      body.innerHTML = `<tr><td colspan='9' style='text-align:center;'>Error: ${err.message}</td></tr>`;
      window.bkSetTableAmountTotal(body, { hide: true });
    } finally {
      if (token === salesLoadToken) salesLoading = false;
    }
  }

  window.bkRefreshSalesPanel = function (opts) {
    if (opts?.resetPage) currentPage = 1;
    if (opts?.syncFromInput) {
      currentSearch = document.getElementById("salesSearchInput")?.value?.trim() || "";
      currentFromDate = document.getElementById("salesFromDate")?.value || "";
      currentToDate = document.getElementById("salesToDate")?.value || "";
      updateDateFilterLabel();
    }
    if (opts?.search != null) {
      currentSearch = String(opts.search).trim();
      const inp = document.getElementById("salesSearchInput");
      if (inp) inp.value = currentSearch;
    }
    return loadSalesHistory();
  };

  window.bkSetSalesSearch = function (query) {
    const next = String(query || "").trim();
    const inp = document.getElementById("salesSearchInput");
    if (inp) inp.value = next;
    if (next === currentSearch && !salesLoading) return true;
    currentSearch = next;
    currentPage = 1;
    clearTimeout(salesSearchTimer);
    salesSearchTimer = setTimeout(() => { loadSalesHistory(); }, 80);
    return true;
  };

  document.getElementById("salesHistoryBody")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".sales-bill-btn");
    const saleId = btn?.dataset?.saleId;
    if (saleId && typeof window.printSavedSaleBill === "function") {
      window.printSavedSaleBill(saleId);
    }
  });

  document.getElementById("salesApplyDateBtn")?.addEventListener("click", () => {
    const from = document.getElementById("salesFromDate")?.value || "";
    const to = document.getElementById("salesToDate")?.value || "";
    if (from && to && from > to) {
      if (typeof showToast === "function") showToast("From date must be before To date.", "error");
      return;
    }
    applyDateFilter(from, to, "");
  });

  document.getElementById("salesClearDateBtn")?.addEventListener("click", () => {
    applyDateFilter("", "", "");
  });

  document.querySelectorAll(".sales-quick-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const range = btn.dataset.range;
      const { from, to } = getQuickRangeDates(range);
      applyDateFilter(from, to, range);
    });
  });

  ["salesFromDate", "salesToDate"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => {
      setQuickRangeActive("");
    });
  });

  let searchTimer = null;
  document.getElementById("salesSearchInput")?.addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      currentSearch = e.target.value.trim();
      currentPage = 1;
      loadSalesHistory();
    }, 350);
  });

  const salesPageSizeSel = document.getElementById("salesPageSize");
  if (salesPageSizeSel) {
    currentPageSize = parseInt(salesPageSizeSel.value, 10) || 10;
    salesPageSizeSel.addEventListener("change", () => {
      currentPageSize = parseInt(salesPageSizeSel.value, 10) || 10;
      currentPage = 1;
      loadSalesHistory();
    });
  }

  document.getElementById("salesPrevBtn")?.addEventListener("click", () => {
    if (currentPage > 1) { currentPage--; loadSalesHistory(); }
  });
  document.getElementById("salesNextBtn")?.addEventListener("click", () => {
    if (currentPage < currentTotalPages) { currentPage++; loadSalesHistory(); }
  });
})();

// ==========================================================================
// 🟢 OVERVIEW — Business Records (Sales, Purchase, Payment, Receipt, Customer)
// ==========================================================================
(function () {
  const recordsPanel = document.getElementById("businessRecordsPanel");
  if (!recordsPanel) return;

  let activeOvTab = null;
  const voucherCache = { Purchase: [], Payment: [], Receipt: [] };
  const voucherDates = {
    Purchase: { from: "", to: "", quick: "" },
    Payment: { from: "", to: "", quick: "" },
    Receipt: { from: "", to: "", quick: "" },
    Customer: { from: "", to: "", quick: "" }
  };
  const VOUCHER_TYPE_META = {
    Purchase: { prefix: "ovPurchase" },
    Payment: { prefix: "ovPayment" },
    Receipt: { prefix: "ovReceipt" },
    Customer: { prefix: "ovCustomer" }
  };

  function toInputDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function getVoucherQuickRangeDates(range) {
    const now = new Date();
    if (range === "thisMonth") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toInputDate(start), to: toInputDate(now) };
    }
    if (range === "lastMonth") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toInputDate(start), to: toInputDate(end) };
    }
    if (range === "thisYear") {
      const start = new Date(now.getFullYear(), 0, 1);
      return { from: toInputDate(start), to: toInputDate(now) };
    }
    return { from: "", to: "" };
  }

  function fmtDisplayInputDate(s) {
    if (!s) return "—";
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  }

  function syncVoucherDateInputs(type) {
    const meta = VOUCHER_TYPE_META[type];
    if (!meta) return;
    const st = voucherDates[type];
    const fromEl = document.getElementById(`${meta.prefix}FromDate`);
    const toEl = document.getElementById(`${meta.prefix}ToDate`);
    if (fromEl) fromEl.value = st.from;
    if (toEl) toEl.value = st.to;
  }

  function updateVoucherDateLabel(type) {
    const meta = VOUCHER_TYPE_META[type];
    if (!meta) return;
    const label = document.getElementById(`${meta.prefix}DateFilterLabel`);
    if (!label) return;
    const st = voucherDates[type];
    if (!st.from && !st.to) {
      label.classList.add("hidden");
      label.textContent = "";
      return;
    }
    label.textContent = `Filtered: ${fmtDisplayInputDate(st.from)} to ${fmtDisplayInputDate(st.to)}`;
    label.classList.remove("hidden");
  }

  function setVoucherQuickRangeActive(type, range) {
    document.querySelectorAll(`.voucher-quick-btn[data-voucher-type="${type}"]`).forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.range === range);
    });
  }

  function isInDateRange(value, from, to) {
    if (!from && !to) return true;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return true;
    if (from) {
      const start = new Date(from);
      start.setHours(0, 0, 0, 0);
      if (d < start) return false;
    }
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      if (d > end) return false;
    }
    return true;
  }

  function applyVoucherDateFilter(type, from, to, quick) {
    if (!voucherDates[type]) return;
    voucherDates[type] = { from: from || "", to: to || "", quick: quick || "" };
    syncVoucherDateInputs(type);
    updateVoucherDateLabel(type);
    setVoucherQuickRangeActive(type, quick || "");
    if (type === "Customer") {
      const name = document.getElementById("ovCustomerSearch")?.value?.trim();
      if (name) showCustomerQuickSummary(name);
      return;
    }
    loadVoucherTab(type);
  }
  const RECORD_TYPES = [
    { id: "sales", icon: "📊", label: "Total Sales", desc: "Sales list, search & date filter", amountId: "ovTotalSalesAmt" },
    { id: "purchase", icon: "📥", label: "Total Purchase", desc: "Supplier bills, search & date filter", amountId: "ovTotalPurchaseAmt" },
    { id: "payment", icon: "💸", label: "Total Payment", desc: "Payments list, search & date filter", amountId: "ovTotalPaymentAmt" },
    { id: "receipt", icon: "💰", label: "Total Receipt", desc: "Receipts list, search & date filter", amountId: "ovTotalReceiptAmt" },
    { id: "customer", icon: "👤", label: "Customer Detail", desc: "Customer account with date filter", amountId: null }
  ];

  function fmtMoney(n) {
    return `₹${(parseFloat(n) || 0).toFixed(2)}`;
  }

  function fmtDate(d) {
    try { return new Date(d).toLocaleDateString("en-IN"); } catch { return "—"; }
  }

  function esc(s) {
    return typeof escapeHtml === "function" ? escapeHtml(s) : String(s || "");
  }

  function renderTypeGrid() {
    const grid = document.getElementById("overviewTypeGrid");
    if (!grid) return;
    grid.innerHTML = RECORD_TYPES.map((t) => `
        <button type="button" class="modify-type-card${activeOvTab === t.id ? " selected" : ""}" data-ov-type="${t.id}">
          <span class="modify-type-icon">${t.icon}</span>
          <span class="modify-type-label">${esc(t.label)}</span>
          <span class="modify-type-desc">${esc(t.desc)}</span>
        </button>`).join("");
    grid.querySelectorAll("[data-ov-type]").forEach((btn) => {
      btn.addEventListener("click", () => window.bkOverviewSwitchTab(btn.dataset.ovType));
    });
  }

  function updateRecordsTitle(label) {
    const title = document.getElementById("businessRecordsTitle");
    if (title) title.textContent = label || "Records";
  }

  function showPane(tabId) {
    recordsPanel.querySelectorAll(".overview-rec-pane").forEach((pane) => {
      const on = pane.dataset.ovPane === tabId;
      pane.hidden = !on;
      pane.classList.toggle("active", on);
    });
  }

  function loadActiveTabData() {
    if (!activeOvTab) return;
    if (activeOvTab === "sales" && typeof window.bkRefreshSalesPanel === "function") {
      window.bkRefreshSalesPanel({ resetPage: true });
    } else if (activeOvTab === "customer") {
      loadCustomerList();
    } else if (["purchase", "payment", "receipt"].includes(activeOvTab)) {
      const typeMap = { purchase: "Purchase", payment: "Payment", receipt: "Receipt" };
      loadVoucherTab(typeMap[activeOvTab]);
    }
  }

  window.bkOverviewResetView = function () {
    activeOvTab = null;
    recordsPanel.querySelectorAll(".overview-rec-pane").forEach((pane) => {
      pane.hidden = true;
      pane.classList.remove("active");
    });
    renderTypeGrid();
    updateRecordsTitle("Records");
  };

  window.bkOverviewApplyTab = function (tab, label) {
    const nextTab = tab || "sales";
    const meta = RECORD_TYPES.find((t) => t.id === nextTab);
    activeOvTab = nextTab;
    const displayLabel = label || meta?.label || nextTab;
    showPane(nextTab);
    updateRecordsTitle(displayLabel);
    renderTypeGrid();
    loadActiveTabData();
  };

  window.bkOverviewRefreshActiveTab = function () {
    if (!activeOvTab) return;
    loadActiveTabData();
  };

  window.bkOverviewSwitchTab = function (tab, label) {
    window.bkOverviewApplyTab(tab, label);
    if (typeof openPanel === "function") openPanel("businessRecordsPanel");
  };

  document.getElementById("overviewRecBackBtn")?.addEventListener("click", () => {
    window.bkOverviewResetView();
    if (typeof openPanel === "function") openPanel("overviewPanel");
  });

  async function loadVoucherTab(type) {
    const key = type;
    const bodyId = type === "Purchase" ? "ovPurchaseBody" : type === "Payment" ? "ovPaymentBody" : "ovReceiptBody";
    const searchId = type === "Purchase" ? "ovPurchaseSearch" : type === "Payment" ? "ovPaymentSearch" : "ovReceiptSearch";
    const body = document.getElementById(bodyId);
    if (!body) return;
    const cols = type === "Purchase" ? 6 : 5;
    body.innerHTML = `<tr><td colspan="${cols}" style="text-align:center;">Loading...</td></tr>`;
    try {
      const st = voucherDates[type] || { from: "", to: "" };
      const params = new URLSearchParams({ type });
      if (st.from) params.set("fromDate", st.from);
      if (st.to) params.set("toDate", st.to);
      const res = await fetch(`${API_URL}/api/vouchers?${params.toString()}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Load failed");
      voucherCache[key] = data.vouchers || [];
      renderVoucherTab(type);
    } catch (err) {
      const cols = type === "Purchase" ? 6 : 5;
      body.innerHTML = `<tr><td colspan="${cols}" style="text-align:center;">Error: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function renderVoucherTab(type) {
    const key = type;
    const bodyId = type === "Purchase" ? "ovPurchaseBody" : type === "Payment" ? "ovPaymentBody" : "ovReceiptBody";
    const searchId = type === "Purchase" ? "ovPurchaseSearch" : type === "Payment" ? "ovPaymentSearch" : "ovReceiptSearch";
    const body = document.getElementById(bodyId);
    if (!body) return;
    const q = (document.getElementById(searchId)?.value || "").trim().toLowerCase();
    let rows = voucherCache[key] || [];
    if (q) {
      rows = rows.filter((v) => {
        const party = (v.partyId?.partyName || "").toLowerCase();
        const note = (v.note || "").toLowerCase();
        const bill = (v.supplierInvoiceNo || "").toLowerCase();
        return party.includes(q) || note.includes(q) || bill.includes(q);
      });
    }
    if (!rows.length) {
      const cols = type === "Purchase" ? 6 : 5;
      const st = voucherDates[type] || { from: "", to: "" };
      const emptyMsg = q || st.from || st.to ? "No records found for this filter." : "No records found.";
      body.innerHTML = `<tr><td colspan="${cols}" style="text-align:center;">${emptyMsg}</td></tr>`;
      window.bkSetTableAmountTotal(body, { hide: true });
      return;
    }
    const pageSum = rows.reduce((s, v) => s + (parseFloat(v.amount) || 0), 0);
    const allRows = voucherCache[key] || [];
    const grandSum = allRows.reduce((s, v) => s + (parseFloat(v.amount) || 0), 0);
    if (type === "Purchase") {
      body.innerHTML = rows.map((v) => `
        <tr>
          <td>${fmtDate(v.date)}</td>
          <td>${escapeHtml(v.partyId?.partyName || "—")}</td>
          <td>${escapeHtml(v.supplierInvoiceNo || "—")}</td>
          <td style="color:#f59e0b;font-weight:700;">${fmtMoney(v.amount)}</td>
          <td>${escapeHtml(v.paymentMode || "—")}</td>
          <td>${escapeHtml(v.note || "—")}</td>
        </tr>`).join("");
    } else {
      body.innerHTML = rows.map((v) => `
        <tr>
          <td>${fmtDate(v.date)}</td>
          <td>${escapeHtml(v.partyId?.partyName || "—")}</td>
          <td style="color:#${type === "Receipt" ? "22c55e" : "ef4444"};font-weight:700;">${fmtMoney(v.amount)}</td>
          <td>${escapeHtml(v.paymentMode || "—")}</td>
          <td>${escapeHtml(v.note || "—")}</td>
        </tr>`).join("");
    }
    window.bkSetTableAmountTotal(body, {
      label: rows.length < allRows.length ? "Filtered Total" : "Total Amount",
      amount: pageSum,
      rows: rows.length,
      grand: rows.length < allRows.length ? grandSum : null,
      color: type === "Receipt" ? "#22c55e" : type === "Payment" ? "#ef4444" : "#f59e0b"
    });
    if (typeof window.enhanceMobileTables === "function") {
      requestAnimationFrame(() => window.enhanceMobileTables(document.getElementById(`overviewTab${type}`)));
    }
  }

  async function loadOverviewTotals() {
    try {
      const hdrs = { Authorization: `Bearer ${getToken()}` };
      const [salesRes, purRes, payRes, recRes] = await Promise.all([
        fetch(`${API_URL}/api/sales?limit=100&page=1`, { headers: hdrs }),
        fetch(`${API_URL}/api/vouchers?type=Purchase`, { headers: hdrs }),
        fetch(`${API_URL}/api/vouchers?type=Payment`, { headers: hdrs }),
        fetch(`${API_URL}/api/vouchers?type=Receipt`, { headers: hdrs })
      ]);
      const salesData = await salesRes.json();
      let salesTotal = 0;
      if (salesData.success) {
        salesTotal = (salesData.records || []).reduce((s, r) => s + (parseFloat(r.totalAmount) || 0), 0);
        if ((salesData.totalPages || 1) > 1 && typeof window.refreshOverviewSalesFromHistory === "function") {
          const full = await window.refreshOverviewSalesFromHistory();
          if (full != null) salesTotal = full;
        }
      }
      const purData = await purRes.json();
      const payData = await payRes.json();
      const recData = await recRes.json();
      const sumV = (list) => (list || []).reduce((s, v) => s + (parseFloat(v.amount) || 0), 0);
      const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = fmtMoney(val); };
      el("ovTotalSalesAmt", salesTotal);
      el("totalSalesVal", salesTotal);
      el("ovTotalPurchaseAmt", purData.success ? sumV(purData.vouchers) : 0);
      el("ovTotalPaymentAmt", payData.success ? sumV(payData.vouchers) : 0);
      el("ovTotalReceiptAmt", recData.success ? sumV(recData.vouchers) : 0);
      renderTypeGrid();
    } catch (e) {
      console.warn("Overview totals:", e);
    }
  }

  async function loadCustomerList() {
    const dl = document.getElementById("ovCustomerList");
    if (!dl) return;
    try {
      const res = await fetch(`${API_URL}/api/ledgers`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (!data.success) return;
      dl.innerHTML = (data.ledgers || [])
        .map((l) => `<option value="${escapeHtml(l.partyName)}"></option>`)
        .join("");
    } catch (_) { /* optional */ }
  }

  async function showCustomerQuickSummary(name) {
    const box = document.getElementById("ovCustomerQuickSummary");
    if (!box || !name) return;
    box.classList.remove("hidden");
    box.innerHTML = "Loading customer summary...";
    try {
      const hdrs = { Authorization: `Bearer ${getToken()}` };
      const st = voucherDates.Customer || { from: "", to: "" };
      let billed = 0;
      let paid = 0;
      let pending = 0;
      let returnsNote = "";

      const ledRes = await fetch(`${API_URL}/api/ledgers`, { headers: hdrs });
      const ledData = await ledRes.json();
      const ledger = (ledData.ledgers || []).find(
        (l) => String(l.partyName || "").trim().toLowerCase() === String(name || "").trim().toLowerCase()
      );
      if (ledger?.ledgerGroup === "Sundry Debtor") {
        billed = Number(ledger.billedAmount ?? ledger.grossBilled ?? 0) || 0;
        paid = Number(ledger.paidAmount ?? 0) || 0;
        pending = Number(ledger.netBalance ?? ledger.pendingUdhar ?? ledger.currentBalance ?? 0) || 0;
        if (ledger.returns > 0) returnsNote = ` &nbsp;|&nbsp; Returns: ${fmtMoney(ledger.returns)}`;
        if (pending < -0.01) returnsNote += ` &nbsp;|&nbsp; <span style="color:#0ea5e9">Refund Due: ${fmtMoney(Math.abs(pending))}</span>`;
      } else {
        const salesParams = new URLSearchParams({ search: name, limit: "100" });
        if (st.from) salesParams.set("fromDate", st.from);
        if (st.to) salesParams.set("toDate", st.to);
        const [salesRes, payRes] = await Promise.all([
          fetch(`${API_URL}/api/sales?${salesParams.toString()}`, { headers: hdrs }),
          fetch(`${API_URL}/api/payments?customer=${encodeURIComponent(name)}`, { headers: hdrs })
        ]);
        const salesData = await salesRes.json();
        const payData = await payRes.json();
        (salesData.records || []).forEach((r) => {
          const amt = parseFloat(r.totalAmount) || (parseFloat(r.price) || 0) * (parseFloat(r.qty) || 1);
          billed += amt;
          const isCredit = isCreditSale(r);
          if (!isCredit) paid += amt;
        });
        (payData.payments || [])
          .filter((p) => isInDateRange(p.date, st.from, st.to))
          .forEach((p) => { paid += parseFloat(p.amount) || 0; });
        pending = Math.max(0, billed - paid);
      }
      const dateNote = st.from || st.to
        ? `<br><span style="color:#94a3b8;font-size:12px;">Filtered: ${fmtDisplayInputDate(st.from)} to ${fmtDisplayInputDate(st.to)}</span>`
        : "";
      const pendingLabel = pending < -0.01
        ? `<span style="color:#0ea5e9">Refund Due: ${fmtMoney(Math.abs(pending))} (−${fmtMoney(Math.abs(pending))})</span>`
        : `<span style="color:${pending > 0.01 ? "#f59e0b" : "#22c55e"}">Net Udhar: ${fmtMoney(pending)}</span>`;
      box.innerHTML = `<strong>${escapeHtml(name)}</strong><br>
        Total Billed: ${fmtMoney(billed)}${returnsNote} &nbsp;|&nbsp; Paid: ${fmtMoney(paid)} &nbsp;|&nbsp;
        ${pendingLabel}
        ${dateNote}
        <br><span class="overview-customer-hint" style="font-size:12px;">Click <strong>View Customer Detail</strong> for the full transaction list, or use <strong>Print</strong> in the detail window.</span>`;
    } catch (err) {
      box.textContent = "Could not load summary: " + err.message;
    }
  }

  window.bkRefreshOverviewTotals = function () {
    loadOverviewTotals();
  };

  window.bkRefreshOverviewRecords = function () {
    loadOverviewTotals();
    if (!activeOvTab) return;
    if (activeOvTab === "sales" && typeof window.bkRefreshSalesPanel === "function") {
      window.bkRefreshSalesPanel({ resetPage: true, syncFromInput: true });
    } else if (activeOvTab === "customer") {
      loadCustomerList();
      const name = document.getElementById("ovCustomerSearch")?.value?.trim();
      if (name) showCustomerQuickSummary(name);
    } else {
      const typeMap = { purchase: "Purchase", payment: "Payment", receipt: "Receipt" };
      if (typeMap[activeOvTab]) loadVoucherTab(typeMap[activeOvTab]);
    }
  };

  document.getElementById("overviewRecordsRefreshBtn")?.addEventListener("click", () => {
    window.bkRefreshOverviewRecords();
    if (typeof showToast === "function") showToast("Records refreshed.", "success");
  });

  ["ovPurchaseSearch", "ovPaymentSearch", "ovReceiptSearch"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", () => {
      const map = { ovPurchaseSearch: "Purchase", ovPaymentSearch: "Payment", ovReceiptSearch: "Receipt" };
      renderVoucherTab(map[id]);
    });
  });

  document.getElementById("ovPurchaseRefreshBtn")?.addEventListener("click", () => loadVoucherTab("Purchase"));
  document.getElementById("ovPaymentRefreshBtn")?.addEventListener("click", () => loadVoucherTab("Payment"));
  document.getElementById("ovReceiptRefreshBtn")?.addEventListener("click", () => loadVoucherTab("Receipt"));

  ["Purchase", "Payment", "Receipt", "Customer"].forEach((type) => {
    const meta = VOUCHER_TYPE_META[type];
    if (!meta) return;
    document.getElementById(`${meta.prefix}ApplyDateBtn`)?.addEventListener("click", () => {
      const from = document.getElementById(`${meta.prefix}FromDate`)?.value || "";
      const to = document.getElementById(`${meta.prefix}ToDate`)?.value || "";
      if (from && to && from > to) {
        if (typeof showToast === "function") showToast("From date must be before To date.", "error");
        return;
      }
      applyVoucherDateFilter(type, from, to, "");
    });
    document.getElementById(`${meta.prefix}ClearDateBtn`)?.addEventListener("click", () => {
      applyVoucherDateFilter(type, "", "", "");
    });
    [`${meta.prefix}FromDate`, `${meta.prefix}ToDate`].forEach((id) => {
      document.getElementById(id)?.addEventListener("change", () => setVoucherQuickRangeActive(type, ""));
    });
  });

  document.querySelectorAll(".voucher-quick-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.voucherType;
      const range = btn.dataset.range;
      if (!type || !VOUCHER_TYPE_META[type]) return;
      const { from, to } = getVoucherQuickRangeDates(range);
      applyVoucherDateFilter(type, from, to, range);
    });
  });

  document.getElementById("ovCustomerViewBtn")?.addEventListener("click", () => {
    const name = document.getElementById("ovCustomerSearch")?.value?.trim();
    if (!name) {
      if (typeof showToast === "function") showToast("Enter customer name first.", "error");
      return;
    }
    if (typeof showUdharDetail === "function") showUdharDetail(name);
    else if (typeof showToast === "function") showToast("Customer detail modal not ready — refresh page.", "error");
  });

  document.getElementById("ovCustomerSearch")?.addEventListener("change", (e) => {
    const name = e.target.value?.trim();
    if (name) showCustomerQuickSummary(name);
  });

  renderTypeGrid();
  if (document.getElementById("overviewPanel")?.classList.contains("active")) {
    loadOverviewTotals();
  }
})();

// ==========================================================================
// 🟢 TOTAL SALES HISTORY — END
// ==========================================================================
// 🟢 ALL INDIAN STATES & UTs LIST
const indianStatesList = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
  "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka",
  "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim",
  "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
];

// Initialize State List on Load
function initSearchableStateDropdown() {
  const optionsList = document.getElementById("stateOptionsList");
  if (!optionsList) return;

  optionsList.innerHTML = "";
  indianStatesList.forEach(state => {
    const li = document.createElement("li");
    li.textContent = state;
    li.onclick = () => selectState(state);
    optionsList.appendChild(li);
  });
}

// Toggle Dropdown Visibility
function toggleStateDropdown() {
  const wrapper = document.querySelector(".custom-select-wrapper");
  wrapper.classList.toggle("open");
  if (wrapper.classList.contains("open")) {
    document.getElementById("stateSearchInput").focus();
  }
}

// Filter States on Search Type
function filterStates() {
  const input = document.getElementById("stateSearchInput").value.toLowerCase();
  const options = document.querySelectorAll("#stateOptionsList li");
  let hasMatch = false;

  options.forEach(option => {
    const text = option.textContent.toLowerCase();
    if (text.includes(input)) {
      option.style.display = "block";
      hasMatch = true;
    } else {
      option.style.display = "none";
    }
  });

  // Handle No Results
  let noResLi = document.getElementById("noStateResult");
  if (!hasMatch) {
    if (!noResLi) {
      noResLi = document.createElement("li");
      noResLi.id = "noStateResult";
      noResLi.className = "no-result";
      noResLi.textContent = "No State Found";
      document.getElementById("stateOptionsList").appendChild(noResLi);
    }
    noResLi.style.display = "block";
  } else if (noResLi) {
    noResLi.style.display = "none";
  }
}

// Select State Action
function selectState(stateName) {
  document.getElementById("selectedStateText").textContent = stateName;
  document.getElementById("buyerState").value = stateName;
  
  // Highlight active
  document.querySelectorAll("#stateOptionsList li").forEach(li => {
    li.classList.toggle("selected", li.textContent === stateName);
  });

  // Close Dropdown
  document.querySelector(".custom-select-wrapper").classList.remove("open");

  // Reset Search
  document.getElementById("stateSearchInput").value = "";
  filterStates();

  if (typeof renderInvoice === 'function') renderInvoice();
  updateGstModeHint();
}

function updateGstModeHint() {
  const el = document.getElementById('gstModeHint');
  if (!el) return;
  const mode = getCurrentGstTaxMode();
  if (!mode.buyerState && mode.method !== 'pincode') {
    el.textContent = '';
    return;
  }
  el.textContent = mode.isIntraState
    ? `✅ Same State (${mode.companyState}) → CGST + SGST`
    : `🔄 Inter-State (${mode.companyState} → ${mode.buyerState}) → IGST`;
}

// Close Dropdown if clicked outside
document.addEventListener("click", function(event) {
  const wrapper = document.querySelector(".custom-select-wrapper");
  if (wrapper && !wrapper.contains(event.target)) {
    wrapper.classList.remove("open");
  }
});

// Run Init
document.addEventListener("DOMContentLoaded", initSearchableStateDropdown);

// ================= DESKTOP AGENT PAIRING TOKEN =================
window._bkTallyHttpStatus = { httpReady: false, canTrySync: false, agentConnected: false, message: "" };

function updateTallySyncButtonState() {
  const tallyBtn = document.getElementById("tallySyncBtn");
  const khataHint = document.getElementById("tallyKhataHint");
  const tallyHint = document.getElementById("tallyModeHint");
  const gate = document.getElementById("tallyHttpGateBanner");
  const showTally = document.querySelector('input[name="accMode"][value="tally"]')?.checked;
  const st = window._bkTallyHttpStatus || {};

  if (khataHint) khataHint.classList.toggle("hidden", !!showTally);
  if (tallyHint) tallyHint.classList.toggle("hidden", !showTally);
  if (gate) gate.classList.toggle("hidden", !showTally);

  if (!tallyBtn) return;
  if (!showTally) {
    tallyBtn.style.display = "none";
    tallyBtn.disabled = true;
    return;
  }

  tallyBtn.style.display = "inline-block";

  if (!st.agentConnected && !window._bkTallyAgentConnected) {
    tallyBtn.disabled = true;
    tallyBtn.textContent = "📊 Sync Tally (agent offline)";
    tallyBtn.title = "Run Connect Agent.bat first — Sync enables when HTTP test is green.";
    if (gate) {
      gate.className = "tally-http-gate";
      gate.innerHTML = "🔴 <strong>Agent offline.</strong> Sidebar → Connect Agent. Daily work can run on <strong>BolKarigar Khata</strong>.";
    }
    return;
  }

  if (st.httpReady) {
    tallyBtn.disabled = false;
    tallyBtn.textContent = "📊 Sync Tally";
    tallyBtn.title = "Send invoice to Tally Prime";
    if (gate) {
      gate.className = "tally-http-gate tally-http-gate--ready";
      gate.textContent = "✅ Tally HTTP ready — Sync button enabled.";
    }
    return;
  }

  if (st.canTrySync) {
    tallyBtn.disabled = false;
    tallyBtn.textContent = "📊 Sync Tally (try)";
    tallyBtn.title = "Port 9000 open — try if company is open in Day Book";
    if (gate) {
      gate.className = "tally-http-gate tally-http-gate--try";
      gate.innerHTML = "🟡 Port open — try Sync if company is open in Day Book. Best: make Test Tally HTTP green first.";
    }
    return;
  }

  tallyBtn.disabled = true;
  tallyBtn.textContent = "📊 Sync Tally (HTTP setup pending)";
  tallyBtn.title = "Sync enables when HTTP is ready";
  if (gate) {
    gate.className = "tally-http-gate";
    gate.innerHTML =
      "⚠️ <strong>Sync is disabled</strong> — In Tally: F1 → Settings → <strong>Connectivity → Client/Server</strong> " +
      "(not Timeout Configuration). Acts as = Server/Both, <strong>HTTP Server = Yes</strong>, Port 9000 → Accept → restart. " +
      "Open company Day Book → Test Tally HTTP from sidebar. <em>EDU: voucher on 1st/2nd/last date of month.</em>";
  }
}

window.updateTallySyncButtonState = updateTallySyncButtonState;
window.toggleTallyBtn = function (showTally) {
  updateTallySyncButtonState();
};

function setTallySetupPill(kind, text) {
  const pill = document.getElementById("tallySetupStatusPill");
  if (!pill) return;
  pill.className = "tally-setup-pill tally-setup-pill--" + (kind || "checking");
  pill.textContent = text || "";
}

function setAgentTokenUi(value, isError) {
  const el = document.getElementById("agentTokenDisplay");
  const hint = document.getElementById("agentTokenHint");
  if (!el) return;
  const clean = String(value || "").trim().replace(/\s+/g, "");
  if (clean && !isError && clean.length >= 16) {
    el.dataset.token = clean;
    el.value = clean;
    el.classList.remove("tally-token-error");
    if (hint) hint.textContent = "Token ready. Click Connect Agent — it saves to agent-config.json on your PC.";
    return;
  }
  el.dataset.token = "";
  el.value = value || "";
  el.classList.toggle("tally-token-error", !!isError);
  if (hint && isError) hint.textContent = "Could not load token. Click Reload Token or refresh the page (Ctrl+Shift+R).";
}

async function fetchAgentPairingTokenFromServer(force) {
  const auth = getToken();
  if (!auth) throw new Error("Login required");
  const res = await fetch(`${API_URL}/api/tally/agent-token`, {
    headers: { Authorization: `Bearer ${auth}` },
    cache: "no-store"
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 403) {
    throw new Error(data.error || "Business plan (₹299) required for Tally sync.");
  }
  if (res.status === 402) {
    throw new Error(data.error || "Plan expired — renew from My Plan.");
  }
  if (res.status === 404) {
    throw new Error("Server update pending — hard refresh (Ctrl+Shift+R) and try again.");
  }
  if (!res.ok) {
    throw new Error(data.error || `Token error (${res.status})`);
  }
  const pairing = String(data.agentToken || "").trim().replace(/\s+/g, "");
  if (!pairing) throw new Error("Server returned empty token — click Reload Token.");
  setAgentTokenUi(pairing, false);
  return pairing;
}

async function loadAgentToken(retries = 4) {
  const el = document.getElementById("agentTokenDisplay");
  if (!el) return "";
  if (!getToken()) {
    setAgentTokenUi("Login required", true);
    return "";
  }
  const cached = getAgentPairingToken();
  if (cached && cached.length >= 16) return cached;

  setAgentTokenUi("", false);
  el.placeholder = "Loading token…";

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchAgentPairingTokenFromServer(false);
    } catch (err) {
      if (attempt >= retries) {
        setAgentTokenUi(err.message || "Could not load token", true);
        return "";
      }
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  return "";
}

async function refreshTallyAgentStatus() {
  const chip = document.getElementById("tallyAgentStatusChip");
  const sidebar = document.getElementById("tallyAgentSidebarStatus");
  const token = getToken();
  if (!token) {
    if (chip) { chip.textContent = "Login required"; chip.className = "tally-status-chip tally-status-offline"; }
    if (sidebar) sidebar.textContent = "Log in to use Tally sync.";
    setTallySetupPill("offline", "Login required");
    window._bkTallyAgentConnected = false;
    return;
  }
  try {
    const res = await fetch(`${API_URL}/api/tally/agent-status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json().catch(() => ({}));
    const online = !!(data.agentConnected || data.localSetup);
    window._bkTallyAgentConnected = !!data.agentConnected;
    const label = data.agentConnected
      ? "🟢 Agent connected"
      : data.localSetup
        ? "🟡 Local Tally mode"
        : "🔴 Agent offline";
    let detail = data.agentConnected
      ? "✅ Connected — click Sync Tally for each new invoice."
      : data.localSetup
        ? "Local mode — direct sync available."
        : "Agent offline. Click Step 2: Connect Agent, then keep the window minimized.";
    let pillKind = data.agentConnected ? "ready" : (data.localSetup ? "warn" : "offline");
    let pillText = data.agentConnected ? "Agent online" : (data.localSetup ? "Local mode" : "Agent offline — setup needed");
    let chipLabel = label;

    if (!data.agentConnected && !getAgentPairingToken()) {
      loadAgentToken();
    }

    window._bkTallyHttpStatus = {
      httpReady: false,
      canTrySync: false,
      agentConnected: !!data.agentConnected,
      message: detail
    };

    if (data.agentConnected) {
      try {
        const http = await checkTallyHttpStatus({ silent: true });
        window._bkTallyHttpStatus = {
          httpReady: !!http.httpReady,
          canTrySync: !!http.canTrySync || !!http.portOpen,
          agentConnected: true,
          message: http.message || ""
        };
        if (http.agentVersion && !String(http.agentVersion).includes('http4') && !String(http.agentVersion).includes('http5')) {
          detail = `⚠️ Old Agent running (${http.agentVersion}). Download Agent vhttp5 from the sidebar.`;
          pillKind = "warn";
          pillText = "Update Agent vhttp5";
          chipLabel = "🟡 Old agent";
        } else if (http.httpReady) {
          detail = "✅ Agent + Tally HTTP OK — you can Sync Tally now.";
          pillKind = "ready";
          pillText = "Ready to sync";
          chipLabel = "🟢 Tally ready";
        } else if (http.canTrySync || http.portOpen) {
          detail = http.companyRequired
            ? "🟡 Port 9000 open — open company in Tally Day Book, then tap Sync Tally."
            : "🟡 Port 9000 open — Sync Tally try kar sakte ho (company Day Book mein khuli ho).";
          pillKind = "warn";
          pillText = "Port open — try Sync";
          chipLabel = "🟡 Port 9000 open";
        } else if (http.tallyRunning) {
          detail = "⚠️ Tally open but port 9000 closed — F1 → Connectivity → Both + ODBC Yes, Port 9000, restart Tally.";
          pillKind = "warn";
          pillText = "Enable port 9000";
          chipLabel = "🟡 Port closed";
        } else {
          detail = "⚠️ Agent OK — open Tally, select company, enable HTTP port 9000, then Test Tally HTTP.";
          pillKind = "warn";
          pillText = "Open Tally + HTTP 9000";
          chipLabel = "🟡 Setup Tally";
        }
      } catch (_) { /* keep default detail */ }
    }
    setTallySetupPill(pillKind, pillText);
    if (chip) {
      chip.textContent = chipLabel;
      chip.className = "tally-status-chip " + (online ? "tally-status-online" : "tally-status-offline");
    }
    if (sidebar) sidebar.textContent = detail;
    updateTallySyncButtonState();
  } catch (_) {
    setTallySetupPill("offline", "Status unknown");
    if (chip) { chip.textContent = "Status unknown"; chip.className = "tally-status-chip tally-status-unknown"; }
    if (sidebar) sidebar.textContent = "Could not check agent status — refresh page.";
    updateTallySyncButtonState();
  }
}

function getAgentPairingToken() {
  const el = document.getElementById("agentTokenDisplay");
  if (!el) return "";
  const raw = el.dataset.token || el.value || "";
  const clean = raw.trim().replace(/\s+/g, "");
  if (!clean || clean.length < 16 || /required|error|login|loading|pending/i.test(clean)) return "";
  return clean;
}

async function downloadAgentConnectBat() {
  let pairingToken = getAgentPairingToken();
  if (!pairingToken) {
    const btn = document.getElementById("connectAgentBtn");
    if (btn) btn.disabled = true;
    try {
      pairingToken = await loadAgentToken(5);
    } catch (_) { /* loadAgentToken sets UI */ }
    if (btn) btn.disabled = false;
  }
  const token = pairingToken || getAgentPairingToken();
  if (!token) {
    alert("Pairing token could not load.\n\n1. Hard refresh: Ctrl+Shift+R\n2. Click Reload Token in sidebar\n3. Ensure Business plan is active (My Plan)");
    openTallyAgentSidebar();
    return;
  }
  const backendUrl = (API_URL || window.location.origin).replace(/\/+$/, "");
  const lines = [
    "@echo off",
    "title BolKarigar Agent vhttp5 - Keep Open",
    "chcp 65001 >nul",
    "cd /d \"%~dp0\"",
    "if not exist BolKarigarTallyAgent.exe if not exist BolKarigarTallyAgent.js (",
    "  echo ERROR: BolKarigarTallyAgent.exe not found in this folder!",
    "  echo Download vhttp4 .exe from BolKarigar sidebar and put in same folder.",
    "  pause",
    "  exit /b 1",
    ")",
    "echo Saving pairing token to agent-config.json...",
    "(",
    "  echo {",
    `  echo   \"backendUrl\": \"${backendUrl}\",`,
    `  echo   \"agentToken\": \"${token}\"`,
    "  echo }",
    ") > agent-config.json",
    "echo.",
    "echo ==========================================",
    "echo  BolKarigar Agent vhttp5 - UNLIMITED BILLS",
    "echo  Minimize this window - DO NOT CLOSE",
    "echo  Vikrant, Aman, sab bills - Sync Tally dabao",
    "echo ==========================================",
    "echo.",
    "if exist BolKarigarTallyAgent.exe (",
    "  BolKarigarTallyAgent.exe",
    ") else (",
    "  echo Running latest agent via Node.js...",
    "  node BolKarigarTallyAgent.js",
    ")",
    "echo.",
    "echo Agent closed. Double-click this file again to reconnect.",
    "pause"
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "application/octet-stream" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "BolKarigar-Connect-Agent.bat";
  a.click();
  URL.revokeObjectURL(a.href);
  openTallyAgentSidebar();
  if (typeof showToast === "function") {
    showToast("Double-click .bat — token saves forever in agent-config.json. No daily key needed.", "info");
  }
}

document.getElementById("testTallyHttpBtn")?.addEventListener("click", async () => {
  const btn = document.getElementById("testTallyHttpBtn");
  if (btn) btn.textContent = "Testing…";
  const status = await checkTallyHttpStatus();
  if (btn) btn.textContent = "🔌 Test Tally HTTP (port 9000)";
  if (status.httpReady) {
    const okMsg = "✅ Tally HTTP port 9000 is ON — click Sync to Tally now.";
    if (typeof showToast === "function") showToast(okMsg, "success");
    else alert(okMsg);
  } else if (status.canTrySync || status.portOpen) {
    const tryMsg = "🟡 Port 9000 open — Sync Tally try kar sakte ho. Company Day Book mein khuli honi chahiye.";
    if (typeof showToast === "function") showToast(tryMsg, "info");
    else alert(`${tryMsg}\n\n${status.message || ""}`);
  } else {
    const failMsg = status.message || "Tally HTTP not ready.";
    if (typeof showToast === "function") showToast("❌ " + failMsg, "error");
    else alert("❌ " + failMsg);
  }
  refreshTallyAgentStatus();
  updateTallySyncButtonState();
});

document.getElementById("connectAgentBtn")?.addEventListener("click", () => { downloadAgentConnectBat(); });
document.getElementById("reloadAgentTokenBtn")?.addEventListener("click", async () => {
  const btn = document.getElementById("reloadAgentTokenBtn");
  if (btn) btn.textContent = "Loading…";
  try {
    await fetchAgentPairingTokenFromServer(true);
    if (typeof showToast === "function") showToast("Pairing token loaded.", "success");
  } catch (err) {
    setAgentTokenUi(err.message || "Could not load token", true);
    if (typeof showToast === "function") showToast(err.message || "Token load failed", "error");
  }
  if (btn) btn.textContent = "↻ Reload Token";
});

document.getElementById("copyAgentTokenBtn")?.addEventListener("click", () => {
  const token = getAgentPairingToken();
  if (!token) return;
  navigator.clipboard.writeText(token).then(() => {
    const btn = document.getElementById("copyAgentTokenBtn");
    const original = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => { btn.textContent = original; }, 1500);
  });
});

document.getElementById("regenerateAgentTokenBtn")?.addEventListener("click", async () => {
  if (!confirm("A new token will be created — the old token will stop working immediately and the Agent must be paired again. Continue?")) return;
  try {
    const res = await fetch(`${API_URL}/api/tally/agent-token/regenerate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const data = await res.json();
    if (data.success) {
      setAgentTokenUi(String(data.agentToken).trim().replace(/\s+/g, ""), false);
      alert("New token created! Click Step 2: Connect Agent again to update your PC.");
    }
  } catch (err) {
    alert("There was a problem resetting the token.");
  }
});

function initTallyAgentUi() {
  const inbuiltRadio = document.querySelector('input[name="accMode"][value="inbuilt"]');
  if (inbuiltRadio && !document.querySelector('input[name="accMode"]:checked')) {
    inbuiltRadio.checked = true;
  }
  updateTallySyncButtonState();
  if (getToken()) {
    if (typeof loadAgentToken === "function") loadAgentToken();
    if (typeof refreshTallyAgentStatus === "function") refreshTallyAgentStatus();
  }
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTallyAgentUi);
} else {
  initTallyAgentUi();
}
setInterval(() => {
  if (getToken() && typeof refreshTallyAgentStatus === "function") refreshTallyAgentStatus();
}, 60000);

function speakCardText(cardId, buttonElem) {
  const SUNO_LABEL = "🔊 Suno / सुनो";
  const RUKO_LABEL = "⏹️ Ruko / रुको";
  if (!('speechSynthesis' in window)) {
    alert("Your browser does not support text-to-speech.");
    return;
  }

  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    document.querySelectorAll('.speak-card-btn').forEach(btn => {
      btn.innerText = SUNO_LABEL;
      btn.style.background = "#2563eb";
    });

    if (buttonElem.dataset.isSpeaking === "true") {
      buttonElem.dataset.isSpeaking = "false";
      return;
    }
  }

  const cardElement = document.getElementById(cardId);
  if (!cardElement) return;

  const cardText = cardElement.querySelector('.card-text');
  const helpLang = localStorage.getItem('bk_help_lang') || 'both';
  let cleanText = '';
  if (cardText?.querySelector('.help-text-en') && helpLang === 'en') {
    cleanText = cardText.querySelector('.help-text-en')?.innerText || '';
  } else if (cardText?.querySelector('.help-text-hi') && helpLang === 'hi') {
    cleanText = cardText.querySelector('.help-text-hi')?.innerText || '';
  } else {
    cleanText = cardText?.innerText || '';
  }
  cleanText = cleanText
    .replace(/हिंदी:/g, "हिंदी में:")
    .replace(/English:/gi, "")
    .replace(/Step-by-step guide/gi, "")
    .replace(/•/g, "")
    .trim();

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = helpLang === 'en' ? 'en-IN' : 'hi-IN';
  utterance.rate = 0.9;

  utterance.onstart = () => {
    buttonElem.innerText = RUKO_LABEL;
    buttonElem.style.background = "#ef4444";
    buttonElem.dataset.isSpeaking = "true";
  };

  utterance.onend = utterance.onerror = () => {
    buttonElem.innerText = SUNO_LABEL;
    buttonElem.style.background = "#2563eb";
    buttonElem.dataset.isSpeaking = "false";
  };

  window.speechSynthesis.speak(utterance);
}