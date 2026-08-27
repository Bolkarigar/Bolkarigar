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
  const el = document.getElementById("appToast");
  if (!el) { if (type === "error") alert(msg); else console.log(msg); return; }
  el.textContent = msg;
  el.className = "app-toast " + type;
  el.classList.remove("hidden");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => el.classList.add("hidden"), 3500);
}

async function recordKhataSaleFromInvoice({ customer, product, hsn, price, qty, gstRate }) {
  if (!customer || !product) return;
  try {
    const res = await fetch(`${API_URL}/api/khata/record-sale`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ customer, product, hsn, price, qty, gstRate })
    });
    const data = await res.json();
    if (data.success) {
      showToast("✅ Ledger + Sales entry save ho gayi.");
      if (typeof window.refreshKhataPro === "function") window.refreshKhataPro();
    } else if (data.error) {
      console.warn("Khata record-sale:", data.error);
    }
  } catch (err) {
    console.error("Khata record-sale error:", err);
  }
}

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

let editingIndex = -1; // -1 means abhi koi item edit nahi ho raha hai

// Session Check
if (!getToken()) {
  window.location.href = "loginpage.html";
}

// Global state cache to minimize server roundtrips (Loaded from LocalStorage if available)
let state = {
  todos: [],
  projects: [],
  expenses: [],
  invoices: JSON.parse(localStorage.getItem("bolkarigar_invoices")) || []
};
window.state = state;

// LocalStorage Helper
function saveInvoicesToStorage() {
  localStorage.setItem("bolkarigar_invoices", JSON.stringify(state.invoices));
}

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
    if (type === 'invoices') saveInvoicesToStorage();
    return true;
  } catch (err) {
    console.error(`Sync failed for ${type}:`, err);
    alert("Server sync issue! Kripya connection check karein.");
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
  if (serverInvoices === 0 && localInvoices > 0) {
    msgs.push(`Server par 0 invoice, lekin browser backup me <b>${localInvoices}</b> invoice mile — wahi dikha rahe hain. Owner account se login karke sync karein.`);
  } else if ((me?.salesCount || 0) === 0 && (me?.invoicesCount || 0) === 0 && localInvoices === 0) {
    msgs.push("Koi saved data nahi mila. Galat account se login to nahi? Owner email se dubara login karein — data delete nahi hua, sirf account alag ho sakta hai.");
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
  if (sub && !sub.fullAccess && Array.isArray(sub.allowedTabs)) {
    if (!sub.allowedTabs.includes(tabId)) return false;
  }
  if (tabId === "payrollPanel") {
    if (!sub?.fullAccess) return false;
    if (!me?.isStaff) return true;
    if (me.payroll?.canViewSalary || me.payroll?.canManage) return true;
    if (me.payroll?.canMarkHajri || me.payroll?.isLinkedEmployee) return true;
    if (me.role === "staff") return true;
    return false;
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
  const khataPanelIds = "#khataLedgersPanel, #khataItemsPanel, #khataVoucherPanel, #khataDaybookPanel";
  document.querySelectorAll(
    `${khataPanelIds} button:not([data-readonly-ok]), #ledgerPanel .udhar-pay-btn, #recordPaymentBtn`
  ).forEach((el) => {
    if (el.id === "importTallyBtn") return;
    if (!khataWrite && el.closest("#khataLedgersPanel, #khataItemsPanel, #khataVoucherPanel, #khataDaybookPanel")) {
      el.disabled = true;
      el.title = "Aapke role me Khata edit allowed nahi";
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
}

window.bkCanAccessTab = bkCanAccessTab;

async function loadServerData() {
  try {
    const token = getToken();
    const meRes = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (meRes.ok) {
      const me = await meRes.json();
      console.log('[BolKarigar] Account:', me.username, '| Sales:', me.salesCount, '| Invoices:', me.invoicesCount);
      if (me.isStaff) showToast(`${me.roleLabel || me.role} login — malik ne invite diya, alag plan nahi chahiye`, "info");
      else if (me.subscription?.isTrial) showToast(`🎉 Pro trial: ${me.subscription.daysLeft} din bache`, "info");
      window._bkAccountInfo = me;
      applyRoleBasedUI(me);

      // Voice auto-start band — user khud Voice ON karega (repeat / mic noise se bachne ke liye)

      if (me.subscription?.isExpired) {
        const paywallText = document.getElementById("subscriptionPaywallText");
        if (paywallText) {
          paywallText.textContent = me.isStaff
            ? "Is dukaan ka plan expire ho gaya. Aapko alag se kuch kharidne ki zaroorat nahi — malik se subscription renew karwain."
            : "Aapke 3 din ka Pro trial khatam ho gaya. App use karne ke liye plan renew karein.";
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
      return;
    }
    
    const data = await response.json();

    state.todos = data.todos || [];
    state.projects = data.projects || [];
    state.expenses = data.expenses || [];
    const savedLocal = JSON.parse(localStorage.getItem("bolkarigar_invoices") || "[]");
    state.invoices = (data.invoices && data.invoices.length) ? data.invoices : savedLocal;

    showDataStatusBanner(window._bkAccountInfo, (data.invoices || []).length, savedLocal.length);

    saveInvoicesToStorage();

    renderTodos();
    renderProjects();
    renderExpenses();
    renderInvoice();

    calculateFinancials(state.invoices, state.expenses);
    await refreshOverviewSalesFromHistory();
    await loadCompanyProfile();
    if (typeof window.enhanceMobileTables === "function") {
      window.enhanceMobileTables();
    }
  } catch (err) {
    console.error("Initial load failed:", err);
    const savedLocal = JSON.parse(localStorage.getItem("bolkarigar_invoices") || "[]");
    if (savedLocal.length) {
      state.invoices = savedLocal;
      renderInvoice();
      calculateFinancials(state.invoices, state.expenses);
      await refreshOverviewSalesFromHistory();
      showToast("Server se load nahi hua — local backup data dikha rahe hain.", "error");
    }
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

  calculateFinancials(state.invoices, state.expenses);
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

// ================= INVOICE SECTION =================
function renderInvoice() {
  const body = document.getElementById("invoiceBody");
  const grandTotalEl = document.getElementById("grandTotal");
  if (!body) return;

  body.innerHTML = "";
  let grand = 0;

  if (state.invoices && state.invoices.length > 0) {
    state.invoices.forEach((item, index) => {
      const price = parseFloat(item.price) || 0;
      const qty = parseFloat(item.qty) || 1;
      const gstRate = parseFloat(item.gstRate) || 0;

      const baseTotal = price * qty;
      const gstAmount = (baseTotal * gstRate) / 100;
      const lineTotal = baseTotal + gstAmount;
      grand += lineTotal;

      const taxMode = getCurrentGstTaxMode();
      const gstLabel = taxMode.isIntraState
        ? `CGST+SGST ${gstRate}% (₹${gstAmount.toFixed(2)})`
        : `IGST ${gstRate}% (₹${gstAmount.toFixed(2)})`;

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(item.customer) || "-"}</td>
        <td>${escapeHtml(item.product) || "-"}</td>
        <td>₹${price.toFixed(2)}</td>
        <td>${qty}</td>
        <td>${gstLabel}</td>
        <td>₹${lineTotal.toFixed(2)}</td>
        <td style="text-align: center; display: flex; gap: 5px; justify-content: center;">
          <button 
            type="button" 
            onclick="editInvoiceItem(${index})"
            style="background: #f59e0b; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">
            ✏️ Edit
          </button>
          <button 
            type="button" 
            onclick="deleteInvoiceItem(${index})"
            style="background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">
            🗑️ Delete
          </button>
        </td>
      `;
      body.appendChild(row);
    });
  } else {
    body.innerHTML = `<tr><td colspan="7" style="text-align:center;">Fill details and add items.</td></tr>`;
  }

  if (grandTotalEl) grandTotalEl.textContent = grand.toFixed(2);

  calculateFinancials(state.invoices, state.expenses);
}

window.editInvoiceItem = function(index) {
  if (!state.invoices || !state.invoices[index]) return;

  const item = state.invoices[index];

  document.getElementById("customerName").value = item.customer || "";
  document.getElementById("productName").value = item.product || "";
  document.getElementById("productPrice").value = item.price || "";
  document.getElementById("productQty").value = item.qty || 1;
  
  if (document.getElementById("productGst")) {
    document.getElementById("productGst").value = item.gstRate !== undefined ? item.gstRate : 18;
  }

  editingIndex = index;

  const addBtn = document.getElementById("addInvoiceBtn");
  if (addBtn) addBtn.textContent = "💾 Update Item";

  const statusEl = document.getElementById("invoiceStatus");
  if (statusEl) statusEl.textContent = "✏️ Editing row #" + (index + 1) + ". Make changes and click 'Update Item'.";
};

async function deleteInvoiceItem(index) {
  if (state.invoices && state.invoices[index] !== undefined) {
    const updatedInvoices = [...state.invoices];
    updatedInvoices.splice(index, 1);

    if (await syncWithBackend('invoices', updatedInvoices)) {
      renderInvoice();
    }
  }
}

async function executeInvoiceAdd() {
  const customer = document.getElementById("customerName").value.trim();
  const product = document.getElementById("productName").value.trim();
  const hsn = document.getElementById("productHsn")?.value.trim() || "";
  const price = parseFloat(document.getElementById("productPrice").value || "0");
  const qty = parseFloat(document.getElementById("productQty").value || "1");
  const gstRate = parseFloat(document.getElementById("productGst")?.value || "0");
  const paymentType = document.getElementById("invoicePaymentType")?.value || "Cash";
  const isCredit = paymentType === "Credit";

  if (!product || Number.isNaN(price) || price <= 0) return false;

  const baseTotal = price * qty;
  const gstAmount = (baseTotal * gstRate) / 100;
  const grandTotal = baseTotal + gstAmount;

  let updated = [...state.invoices];
  const newItem = {
    customer, product, hsn, price, qty, gstRate, paymentType,
    paidAmount: isCredit ? 0 : grandTotal
  };
  const isNewItem = editingIndex === -1;

  if (editingIndex > -1) {
    updated[editingIndex] = newItem;
    editingIndex = -1;
    const addBtn = document.getElementById("addInvoiceBtn");
    if (addBtn) addBtn.textContent = "Add Item";
  } else {
    updated.push(newItem);
  }

  if (await syncWithBackend('invoices', updated)) {
    // 🟢 Permanent Sales History record — sirf NAYE item ke liye (edit
    // karte waqt dobara record nahi hota, taaki duplicate na bane). Yeh
    // draft invoice table se bilkul alag store hai, kabhi delete nahi hota.
    if (isNewItem) {
      recordPermanentSale({ customer, product, hsn, price, qty, gstRate, paymentType });
      // Har nayi sale par Khata Pro me auto ledger + voucher (Tally sync alag se)
      await recordKhataSaleFromInvoice({ customer, product, hsn, price, qty, gstRate });
    }

    document.getElementById("productName").value = "";
    document.getElementById("productHsn").value = "";
    document.getElementById("productPrice").value = "";
    document.getElementById("productQty").value = "1";
    renderInvoice();
    return true;
  }
  return false;
}

// 🟢 Permanent Sales History me record save karta hai (Total Sales panel
// isi se data leta hai — draft invoice table delete hone se yeh kabhi
// affect nahi hota)
async function recordPermanentSale({ customer, product, hsn, price, qty, gstRate, paymentType }) {
  try {
    const baseTotal = price * qty;
    const gstAmount = (baseTotal * gstRate) / 100;
    const totalAmount = baseTotal + gstAmount;
    const isCredit = paymentType === "Credit";
    const invoiceNo = (typeof getNextInvoiceNumber === 'function')
      ? await getNextInvoiceNumber((JSON.parse(localStorage.getItem("bolkarigar_company_profile") || "{}").name) || "INV")
      : ("INV-" + Date.now());

    await fetch(`${API_URL}/api/sales/record`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({
        invoiceNo, customer, product, hsn, qty, price, gstRate, totalAmount,
        paymentType: paymentType || "Cash",
        status: isCredit ? "Pending" : "Paid"
      })
    });
    refreshUdharKhata();
    refreshOverviewSalesFromHistory();
  } catch (err) {
    console.error("Sales history record error:", err);
  }
}

document.getElementById("addInvoiceBtn")?.addEventListener("click", executeInvoiceAdd);

// Window Load setup
window.addEventListener("load", () => {
  recognition = createRecognition();
  loadServerData();

  const urlParams = new URLSearchParams(window.location.search);
  const openPanelId = urlParams.get("openPanel");
  const planFromUrl = urlParams.get("plan");
  if (openPanelId && document.getElementById(openPanelId)) {
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

  const tallyBtn = document.getElementById("tallySyncBtn");
  if (tallyBtn) tallyBtn.addEventListener("click", handleTallyVoiceCommand);
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
      placeholder.textContent = "🔍 Parchi scan ho rahi hai (OCR)... thoda time lagega.";
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
          placeholder.textContent = "⚠️ OCR library load nahi hui (internet check karein). Manually details bhar lein.";
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
            ? `✅ Scan ho gaya! Mila hua amount: ₹${amount}${vendor ? " (" + vendor + ")" : ""} — check karke confirm karein.`
            : "⚠️ Scan hua, par amount clearly nahi mila — manually bhar lein.";
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
          placeholder.textContent = "⚠️ Scan fail hua. Manually details bhar lein.";
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
const VOICE_FLUSH_MS = 2000;

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
      setStatus("Mic dobara start ki ja rahi hai...");
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
themeToggle?.addEventListener("click", () => {
  const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  setTheme(next);
});

document.addEventListener("bk:langchange", () => {
  if (typeof renderTodos === "function") renderTodos();
  if (voiceToggle) voiceToggle.textContent = bkVoiceBtnLabel(voiceOn);
  const mode = root.getAttribute("data-theme") || "dark";
  setTheme(mode);
});

function openPanel(id) {
  const me = window._bkAccountInfo;
  if (me && !bkCanAccessTab(me, id)) {
    showToast("Aapke role me yeh section allowed nahi hai.", "error");
    id = bkStaffFallbackTab(me);
  }
  if (typeof window.BolKarigarPayroll?.closePayrollSlipModal === "function") {
    window.BolKarigarPayroll.closePayrollSlipModal();
  }
  const wasAlreadyActive = document.querySelector(".panel.active")?.id === id;
  panels.forEach(panel => panel.classList.toggle("active", panel.id === id));
  tabButtons.forEach(btn => btn.classList.toggle("active", btn.dataset.tab === id));
  if (id === "ledgerPanel" && typeof refreshUdharKhata === "function") refreshUdharKhata();
  if (id === "khataVoucherPanel" && typeof window.refreshKhataVoucherPanel === "function") {
    window.refreshKhataVoucherPanel();
  }
  if (id === "bankReconPanel" || id === "companiesPanel") {
    showToast("Yeh feature jald aa raha hai — abhi basic entry save hoti hai, auto-match nahi.", "info");
  }
  if (id === "payrollPanel" && typeof window.BolKarigarPayroll?.loadPayrollPanel === "function") {
    window.BolKarigarPayroll.loadPayrollPanel();
  }
  if (id === "totalSalesPanel" && !wasAlreadyActive && typeof window.bkRefreshSalesPanel === "function") {
    window.bkRefreshSalesPanel({ resetPage: true, syncFromInput: true });
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

window.addEventListener("resize", () => {
  if (!isMobileNav()) closeMobileSidebar();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMobileSidebar();
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
    openPanel("todoPanel");
    showCommand("Todo List open ki ja rahi hai.");
    return true;
  }

  if (
    text.includes("voice") || text.includes("voice ai") || text.includes("voiceai") ||
    text.includes("open voice") || text.includes("open voice ai") || text.includes("voice panel") ||
    text.includes("speech") || text.includes("mic") || text.includes("microphone") ||
    text.includes("start voice") || text.includes("वॉइस") || text.includes("वॉइस एआई") ||
    text.includes("वॉइस पैनल") || text.includes("माइक") || text.includes("स्पीच")
  ) {
    return openPanelByVoice("voicePanel", "Voice AI Panel open kiya ja raha hai.");
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
    showCommand("Gallery open ki ja rahi hai.");
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
    showCommand("Invoice Panel open kiya ja raha hai.");
    return true;
  }

  if (
    text.includes("total sales") || text.includes("total sale") || text.includes("sales history") ||
    text.includes("sale history") || text.includes("बिक्री") || text.includes("टोटल सेल्स") ||
    text.includes("कुल बिक्री") || text.includes("सेल्स") || text.includes("sales report")
  ) {
    openPanel("totalSalesPanel");
    showCommand("Total Sales History open ho gayi.", { speak: true });
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
    showCommand("Projects Panel open kiya ja raha hai.");
    return true;
  }
  
  if (
    text.includes("open qr") || text.includes("open qr tool") || text.includes("qr tool") ||
    text.includes("qr") || text.includes("qr code") || text.includes("generate qr") ||
    text.includes("q r") || text.includes("queue are") || text.includes("क्यू आर") ||
    text.includes("क्यूआर") || text.includes("क्यू आर टूल")
  ) {
    openPanel("qrPanel");
    showCommand("QR Tool open kiya ja raha hai.");
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
    showCommand("Overview Panel open kiya ja raha hai.");
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
    showCommand("Notes Panel open kiya ja rahi hai.");
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
    showCommand("Calculator Panel open kiya ja raha hai.");
    return true;
  }
  
  if (
    text.includes("converter") || text.includes("convert") || text.includes("conversion") ||
    text.includes("unit converter") || text.includes("unit conversion") || text.includes("open converter") ||
    text.includes("show converter") || text.includes("converter panel") || text.includes("open unit converter") ||
    text.includes("convert units") || text.includes("unit") || text.includes("length converter") ||
    text.includes("weight converter") || text.includes("temperature converter") || text.includes("कन्वर्टर") ||
    text.includes("कनवर्टर") || text.includes("कन्वर्ट") || text.includes("कन्वर्टर खोलो") ||
    text.includes("यूनिट कन्वर्टर") || text.includes("रूपांतरण") || text.includes("बदलना")
  ) {
    openPanel("converterPanel");
    showCommand("Converter Panel open kiya ja raha hai.");
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
    showCommand("Media Panel open kiya ja raha hai.");
    return true;
  }
  
  if (
    text.includes("dark mode off") || text.includes("light mode") || text.includes("light") ||
    text.includes("लाइट मोड") || text.includes("डार्क मोड ऑफ")
  ) {
    setTheme("light");
    showCommand("Light mode on kiya ja raha hai.");
    return true;
  }

  if (
    text.includes("dark mode on") || text.includes("dark mode") || text.includes("dark") ||
    text.includes("डार्क मोड") || text.includes("डार्क")
  ) {
    setTheme("dark");
    showCommand("Dark mode on kiya ja raha hai.");
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
      showCommand("Ledgers open ho gaye.");
    } else {
      openPanel("ledgerPanel");
      showCommand("Udhar Khata open ho gaya.");
    }
    return true;
  }

  if (
    text.includes("inventory") || text.includes("stock") || text.includes("इन्वेंटरी") ||
    text.includes("स्टॉक") || text.includes("saman")
  ) {
    openPanel("inventoryPanel");
    showCommand("Inventory panel open ho gaya.");
    return true;
  }

  if (
    text.includes("total sales") || text.includes("total sale") || text.includes("sales history") ||
    text.includes("sale history") || text.includes("बिक्री") || text.includes("टोटल सेल्स") ||
    text.includes("कुल बिक्री") || text.includes("सेल्स") || text.includes("sales report")
  ) {
    openPanel("totalSalesPanel");
    showCommand("Total Sales History open ho gayi.", { speak: true });
    return true;
  }

  if (
    text.includes("help") || text.includes("guide") || text.includes("manual") ||
    text.includes("मदद") || text.includes("गाइड")
  ) {
    openPanel("helpPanel");
    showCommand("Help & Guide open ho gaya.");
    return true;
  }

  if (
    text.includes("ledgers") || text.includes("ledger master") || text.includes("खाता प्रो")
  ) {
    openPanel("khataLedgersPanel");
    showCommand("Ledgers open ho gaye.");
    return true;
  }

  if (text.includes("day book") || text.includes("डे बुक")) {
    openPanel("khataDaybookPanel");
    showCommand("Day Book open ho gaya.");
    return true;
  }

  if (text.includes("new voucher") || text.includes("voucher entry")) {
    openPanel("khataVoucherPanel");
    showCommand("New Voucher open ho gaya.");
    return true;
  }

  if (text.includes("stock items") || text.includes("stock item")) {
    openPanel("khataItemsPanel");
    showCommand("Stock Items open ho gaye.");
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
      showCommand("Tally Prime mode ON. Ab Sync to Tally button dikhega.");
    }
    return true;
  }

  if (text.includes("eway bill") || text.includes("e way bill") || text.includes("ई वे बिल") || text.includes("vehicle number") || text.includes("गाड़ी")) {
    openPanel("invoicePanel");
    const ewayMatch = raw.match(/(?:eway bill|eway number|ई वे बिल)\s+([a-zA-Z0-9]+)/i);
    const vehicleMatch = raw.match(/(?:vehicle|gadi number|गाड़ी नंबर)\s+([a-zA-Z0-9]+)/i);
    if (ewayMatch && document.getElementById("ewayBillNo")) setField(document.getElementById("ewayBillNo"), ewayMatch[1].toUpperCase());
    if (vehicleMatch && document.getElementById("vehicleNo")) setField(document.getElementById("vehicleNo"), vehicleMatch[1].toUpperCase());
    showCommand("E-Way Bill details update ho gayi.");
    return true;
  }

  if (text.includes("payroll") || text.includes("hajri") || text.includes("salary") || text.includes("वेतन") || text.includes("हाजरी")) {
    return openPanelByVoice("payrollPanel", "Staff Payroll aur Hajri khol di.");
  }
  if (text.includes("contractor") || text.includes("mazdoor") || text.includes("ठेकेदार") || text.includes("मजदूर")) {
    return openPanelByVoice("contractorPanel", "Contractor panel khol diya.");
  }
  if (text.includes("reports") || text.includes("gstr") || text.includes("रिपोर्ट")) {
    return openPanelByVoice("reportsProPanel", "Reports Pro khol di.");
  }
  if (text.includes("bank recon") || text.includes("bank reconciliation") || text.includes("बैंक मिलान")) {
    return openPanelByVoice("bankReconPanel", "Bank Reconciliation khol di.");
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
    showCommand("Pehle project naam bolo ya form me naam likho.", { speak: true });
    return false;
  }
  if (!document.getElementById("projectCustomer")?.value?.trim()) {
    setField(document.getElementById("projectCustomer"), "N/A");
  }
  const success = await executeProjectAdd();
  const msg = success
    ? `Project save ho gaya: ${nameVal}.`
    : "Project save nahi hua. Internet check karein ya dubara try karein.";
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
        ? `Project save ho gaya. ${data.name || nameVal}, budget ${data.budget || document.getElementById("projectBudget")?.value || "0"} rupaye.`
        : "Project save nahi hua. Dubara try karein.";
      showCommand(msg, { speak: true });
    } else {
      showCommand("Project ka naam bolo, jaise naam Aman rakho.", { speak: true });
    }
  } else if (hasNewFieldData) {
    showCommand(
      `Samjha: ${parts.join(", ")}. Add karo boliye save ke liye.`,
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
    showCommand("Expense add karne ke liye amount bhi bolo.", { speak: true });
    return false;
  }
  const success = await executeExpenseAdd();
  const msg = success
    ? `Expense save ho gaya: ${document.getElementById("expenseTitle")?.value || vendorVal || "Expense"}, ₹${amountVal}.`
    : "Expense save nahi hua. Internet check karein ya dubara try karein.";
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
      if (success) showCommand("Expense save ho gaya. " + summary, { speak: true });
    } else {
      showCommand("Expense add karne ke liye amount bhi bolo.", { speak: true });
    }
  } else {
    showCommand("Expense form bhara: " + summary + ". Bolo 'add karo' save karne ke liye.", { speak: true });
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
    showCommand("Calculator clear kar diya.");
    return true;
  }

  const cleanExpr = precomputedExpr !== undefined ? precomputedExpr : extractCalcExpression(text);

  if (cleanExpr && display) {
    display.value = cleanExpr;
  }

  if (isEqualCommand(text)) {
    document.getElementById("calcEquals")?.click();
    showCommand("Calculate kiya: " + (display ? display.value : ""));
    return true;
  }

  if (cleanExpr) {
    showCommand("Calculator mein daala: " + cleanExpr + ". Bolo 'equal' result ke liye.");
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
      if (success) showCommand("Invoice item add ho gaya. " + summary);
    } else {
      showCommand("Item add karne ke liye product naam aur price bolo.");
    }
  } else {
    showCommand("Invoice form bhara: " + summary + ". Bolo 'add karo' item jodne ke liye.");
  }
  return true;
}

const TODO_STOP_WORDS = ["add", "save", "जोड़ो", "सेव", "list", "लिस्ट", "में", "mein", "task", "टास्क"];

function looksLikeTodoCommand(text) {
  return (/\btask\b|टास्क|\btodo\b|टूडू|\bto do\b/.test(text)) && isAddCommand(text);
}

// ... existing bolkarigar.js code above ...

function handleTodoSpeech(raw) {
  const t = stripSpeechPunctuation(raw);
  let value = extractField(t, "task|todo|to do|टास्क|टूडू", TODO_STOP_WORDS);
  if (!value) {
    value = normalize(t).replace(/\btask\b|टास्क|\btodo\b|टूडू|\badd\b|\bsave\b|जोड़ो|सेव|\bkaro\b|करो/g, " ").trim();
  }
  if (!value) {
    showCommand("Task ka naam bhi bolo, jaise 'task cement mangwana add karo'.");
    return true;
  }
  
  // Add Todo logic
  const todoInputEl = document.getElementById("todoInput");
  if (todoInputEl) {
    todoInputEl.value = value;
    document.getElementById("addTodoBtn")?.click();
    showCommand(`Task add ho gaya: "${value}"`);
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
    showCommand("QR mein daalne ke liye text ya link bhi bolo.");
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
      showCommand("Note mein kya likhna hai, wo bhi bolo.");
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
    showCommand("Convert karne ke liye unit bhi bolo, jaise 'meter' ya 'kilogram'.");
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
  showCommand("Convert kar diya: " + (document.getElementById("convertResult")?.textContent || ""));
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
  showCommand("Photo " + (idx + 1) + " dikha rahe hain.");
  return true;
}

function looksLikeSearchCommand(text) {
  if (window.bkVoiceController?.looksLikeSearchUtterance?.(text)) return true;
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

  if (targetPanel === "totalSalesPanel" || activeId === "totalSalesPanel") {
    if (activeId !== "totalSalesPanel" && typeof openPanel === "function") {
      openPanel("totalSalesPanel");
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
    showCommand("Search box nahi mila. Pehle Total Sales, Inventory ya Media panel kholo.", { speak: true });
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
    showCommand("Kya search karna hai? Jaise: laxmi search karo, ya naam Vikrant search kero.", { speak: true });
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
    showCommand("Calculator clear kar diya.");
    return;
  }
  if (activeId === "projectPanel") {
    ["projectName", "projectCustomer", "projectSite", "projectBudget", "projectNote"].forEach(id => setField(document.getElementById(id), ""));
    if (document.getElementById("projectStatus")) document.getElementById("projectStatus").value = "planning";
    ["expenseTitle", "expenseVendor", "expenseAmount", "expenseProjectLink"].forEach(id => setField(document.getElementById(id), ""));
    showCommand("Project aur expense form clear kar diya.");
    return;
  }
  if (activeId === "invoicePanel") {
    ["customerName", "productName", "productPrice", "productQty"].forEach(id => setField(document.getElementById(id), ""));
    showCommand("Invoice form clear kar diya.");
    return;
  }
  if (activeId === "notesPanel") {
    setField(document.getElementById("notesInput"), "");
    showCommand("Notes clear kar diye.");
    return;
  }
  if (activeId === "qrPanel") {
    setField(document.getElementById("qrInput"), "");
    if (document.getElementById("qrCodeBox")) document.getElementById("qrCodeBox").innerHTML = "";
    showCommand("QR field clear kar diya.");
    return;
  }
  if (activeId === "todoPanel") {
    setField(document.getElementById("todoInput"), "");
    showCommand("Todo input clear kar diya.");
    return;
  }
  if (activeId === "voicePanel") {
    clearVoiceBtn?.click();
    return;
  }
  if (activeId === "converterPanel") {
    setField(document.getElementById("unitInput"), "");
    if (document.getElementById("convertResult")) document.getElementById("convertResult").textContent = "Converted value will appear here.";
    showCommand("Converter clear kar diya.");
    return;
  }
  if (activeId === "totalSalesPanel") {
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
    showCommand("Media search clear kar diya.");
    return;
  }
  showCommand("Is panel mein clear karne ke liye kuch nahi hai.");
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
    utter.lang = localStorage.getItem("bk_voice_lang") || "hi-IN";
    utter.rate = 1.02;
    const finish = () => {
      if (typeof window._bkResumeVoiceAfterTts === "function") window._bkResumeVoiceAfterTts();
      onDone?.();
    };
    utter.onend = finish;
    utter.onerror = finish;
    const voices = window.speechSynthesis.getVoices();
    const hindiVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith("hi"));
    if (hindiVoice) utter.voice = hindiVoice;
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
  'BolKarigar me yeh sab hai: Overview (sales/expense/profit), Voice AI, Invoice/GST bill, WhatsApp share, Tally sync, Projects, Expenses, Inventory, Udhar Khata, Ledgers, Stock Items, Voucher, Day Book, Total Sales, Gallery, Todo, QR Tool, Calculator, Converter, Notes, Media, Help & Guide. Kisi feature ke baare me detail poochhiye!';

const TODO_MODULE_ANSWER =
  'Todo List me yeh sab kar sakte ho: (1) Naya kaam add karna — Todo tab me likh kar Add dabao, ya bol kar "todo cement mangwana add karo", (2) Task delete karna — list me Delete button, (3) Saari list clear karna — Clear All button, (4) Sidebar se Todo tab khol kar apne tasks dekhna. Har task save hota hai aur refresh ke baad bhi rehta hai.';

const ACCOUNTING_MODULE_ANSWER =
  'Accounting me yeh sab hai: (1) Ledgers — party/customer ledger add (Sundry Debtor/Creditor, GSTIN, opening balance), (2) Stock Items — saman, rate aur stock manage, (3) New Voucher — Sales, Purchase, Receipt, Payment, Journal entry, (4) Day Book — din ki saari entries dekhna. Invoice sale par auto ledger entry bhi ban sakti hai aur Tally Prime me sync bhi hota hai.';

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
    answer: "Main BolKarigar AI hoon — is app ka apna assistant. Main aapke sawalon ke jawab de sakta hoon aur app ke andar kaam bhi kar sakta hoon, jaise todo add karna ya invoice banana." },
  { keywords: ["kya kya kar sakte", "kya kar sakte ho", "features", "help", "madad", "kya kaam", "kya kaam kar sakte", "kya kaam kar sakti", "what can you do", "poori list", "kya kya kaam", "ker skte", "kya kya ker", "kar skte", "kya kya kr skte", "ho skta", "ho sakta", "ho skte", "iss app", "is app", "app m kya", "app me kya", "kitne model", "kitne module"],
    answer: APP_FEATURES_OVERVIEW },
  { keywords: ["free hai", "paisa lagega", "cost kitni", "kitna paisa", "paid hai kya", "is this free", "billing lagegi"],
    answer: "Bilkul free hai! Main app ke andar hi (browser me) chalta hoon, koi internet ya paid API ki zaroorat nahi — isliye koi cost nahi lagta." },
  { keywords: ["namaste", "hello", "hi", "hey", "kaise ho", "kese ho", "kaisa hai", "kya haal", "good morning", "good evening"],
    answer: "Namaste! Bataiye, kya madad kar sakta hoon? App ke bare me poochh sakte ho ya seedha koi kaam bol sakte ho." },
  { keywords: ["thanks", "thank you", "shukriya", "dhanyawad"],
    answer: "Koi baat nahi! Aur kuch madad chahiye ho to bataiye." },
  { keywords: ["bolkarigar kya hai", "yeh app kya hai", "app kis liye", "what is this app", "app ke bare me batao", "kya hai iss app", "kya hai is app", "app m kya", "app me kya", "kya kya hai iss app", "kya kya hai is app"],
    answer: "BolKarigar ek Hindi voice-first business app hai — chhote dukandaron aur contractors ke liye. Isme aap invoice banana, project/kharcha track karna, todo list, udhar khata, inventory, aur bahut kuch bol kar ya type karke kar sakte ho." },
  { keywords: ["logout kaise", "log out kaise", "sign out"],
    answer: "Header me upar right side 'Logout' button dabao — aap seedha login page pe chale jaoge." },
  { keywords: ["password bhool", "forgot password", "password reset"],
    answer: "Login page pe 'Forgot Password' link se apna password reset kar sakte ho." },
  { keywords: ["voice kaise", "voice kaam", "how does voice", "voice on kaise", "voice off kaise"],
    answer: "Header me 'Voice: OFF' button dabao — yeh continuous voice mode ON kar deta hai, phir aap bol kar commands de sakte ho jaise 'open gallery' ya 'open invoice'." },
  { keywords: ["dark mode", "light mode", "theme kaise"],
    answer: "Header me 'Light'/'Dark' button se theme badal sakte ho, ya bol do 'dark mode on' ya 'dark mode off'." },
  { keywords: ["todo kaise", "task kaise", "how to todo", "todo add kaise", "todo m kya", "todo me kya", "todo kya kya", "todo kam kese", "todo kese", "task kese"],
    answer: TODO_MODULE_ANSWER },
  { keywords: ["project kaise", "how to project", "project add kaise", "naya project"],
    answer: "'Projects' tab me Project Name, Customer, Budget aur Note bhar ke add kar sakte ho. Ya bol do jaise 'project Mandir work customer Aslam budget 50000'." },
  { keywords: ["expense kaise", "kharcha kaise", "how to expense"],
    answer: "Expense add karne ke liye 'Projects' tab ke 'Quick Expense Entry' me Title, Vendor aur Amount bharo. Ya bol do jaise 'vendor Sharma Timber amount 4200'." },
  { keywords: ["invoice kaise", "bill kaise", "invoice banaye", "invoice banao kaise", "how to invoice", "bill banaye", "invoice bnaye", "invoice kese"],
    answer: "Invoice banane ke liye 'Invoice' tab kholo, phir Customer Name, Product, Price aur Quantity bharo aur 'Add Item' dabao. Aap mujhse bhi bol sakte ho, jaise 'customer Ramesh product plywood price 2500 quantity 2'." },
  { keywords: ["gst", "gst kya", "gst rate", "what is gst"],
    answer: "Invoice banate waqt aap GST rate (jaise 5%, 12%, 18%) dropdown se select kar sakte ho — app automatically GST amount aur total calculate kar deta hai." },
  { keywords: ["invoice download", "bill download", "invoice pdf"],
    answer: "Invoice table ke upar 'Download' button hai — usse invoice download/print kar sakte ho." },
  { keywords: ["whatsapp share", "whatsapp pe bhejo", "whatsapp invoice"],
    answer: "'WhatsApp Share' button dabao — invoice seedha WhatsApp ke through customer ko bhej sakte ho." },
  { keywords: ["eway bill", "e way bill", "vehicle number", "transport details"],
    answer: "Invoice panel me 'E-Way Bill & Transport Details' section hai (optional) — jahan E-Way Bill number, vehicle number aur distance bhar sakte ho." },
  { keywords: ["accounting mode", "tally prime kya", "bolkarigar khata kya"],
    answer: "Invoice panel me 'Accounting Mode' choose kar sakte ho — 'BolKarigar Khata' (in-house) ya 'Tally Prime' (aapke Tally software se sync hota hai)." },
  { keywords: ["business profile", "company profile", "profile save", "firm ka naam", "gstin kaise dalu"],
    answer: "'Business Profile Settings' me apni Company Name, GSTIN, Phone, Address bhar ke 'Save Business Profile' dabao — ek baar save hone ke baad Invoice Generator unlock ho jayega." },
  { keywords: ["udhar khata", "udhar kaise", "khata kya", "credit customer"],
    answer: "'Udhar Khata' tab me aap customers ka udhar (credit) track kar sakte ho — kis customer ne kitna udhar liya hai." },
  { keywords: ["inventory kya", "stock kaise"],
    answer: "'Inventory' tab me Vyapar jaisa Smart Inventory Tracker hai — HSN, GST%, purchase/sale rate, godown, batch, low-stock alert, stock in/out adjust. Invoice se stock auto kam hota hai." },
  { keywords: ["gallery kya", "gallery kaise"],
    answer: "'Gallery' tab me aap apne kaam ki photos store aur dekh sakte ho." },
  { keywords: ["qr", "qr code", "qr tool"],
    answer: "'QR Tool' tab me text ya link daal ke uska QR code bana sakte ho." },
  { keywords: ["calculator", "calculate kaise"],
    answer: "'Calculator' tab me normal calculator hai, ya bol kar bhi calculation kar sakte ho jaise '25 plus 30'." },
  { keywords: ["converter", "unit convert"],
    answer: "'Converter' tab me length, weight aur temperature jaise units convert kar sakte ho." },
  { keywords: ["notes kaise", "note kaise"],
    answer: "'Notes' tab me apne notes likh sakte ho aur 'Download notes' se save bhi kar sakte ho." },
  { keywords: ["tally", "tally sync", "tally prime"],
    answer: "Tally Prime se sync karne ke liye sidebar me diya gaya 'Tally Sync Agent' (.exe) download karke apne PC pe chalao, phir Invoice panel me 'Tally Prime' mode select karke sync kar sakte ho." },
  { keywords: ["profit loss", "financial summary", "report kaise", "kamai dikaho"],
    answer: "'Overview' panel me AI Accountant cards ke through aapko total sales, expenses aur profit ka summary dikhta hai." },
  { keywords: ["ledger m kya", "ledger me kya", "accounting m kya", "accounting me kya", "voucher kaise", "day book kya", "khata pro m kya", "khata pro me kya"],
    answer: ACCOUNTING_MODULE_ANSWER },
  { keywords: ["help panel", "guide kaha", "manual kaha"],
    answer: "Sidebar me '❓ Help & Guide' tab hai — wahan har module ki poori jaankari mil jayegi." }
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
  const mobileMatch = raw.match(/(?:mobile|phone|number)\s+(\d{10})/i);
  const amountMatch = raw.match(/(?:amount|raashi|rashi|राशि)\s+(\d+(?:\.\d+)?)/i);
  const openingMatch = raw.match(/(?:opening|shuru)\s+(\d+(?:\.\d+)?)/i);

  if (ledgerNameMatch) setField(document.getElementById("ledgerNameInput"), ledgerNameMatch[1].trim());
  if (mobileMatch) setField(document.getElementById("ledgerMobileInput"), mobileMatch[1]);
  if (openingMatch) setField(document.getElementById("ledgerOpeningInput"), openingMatch[1]);
  if (amountMatch) setField(document.getElementById("voucherAmountInput"), amountMatch[1]);

  if (text.includes("receipt") || text.includes("रसीद")) {
    const sel = document.getElementById("voucherTypeInput");
    if (sel) { sel.value = "Receipt"; sel.dispatchEvent(new Event("change")); }
    openPanel("khataVoucherPanel");
  } else if (text.includes("payment") || text.includes("भुगतान")) {
    const sel = document.getElementById("voucherTypeInput");
    if (sel) { sel.value = "Payment"; sel.dispatchEvent(new Event("change")); }
    openPanel("khataVoucherPanel");
  } else if (text.includes("purchase") || text.includes("खरीद")) {
    const sel = document.getElementById("voucherTypeInput");
    if (sel) { sel.value = "Purchase"; sel.dispatchEvent(new Event("change")); }
    openPanel("khataVoucherPanel");
  } else if (text.includes("day book")) {
    openPanel("khataDaybookPanel");
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
    showCommand("Accounting form bhara. 'Add karo' bol kar save karein.");
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
    showCommand("Inventory form bhara. 'Add karo' bol kar save karein.");
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

    // 7. Unit Converter
    if (looksLikeConverterCommand(text)) {
      handleConverterSpeech(raw);
      return;
    }

    // 8. Calculator
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
      const response = await fetch(`${API_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ message: raw })
      });

      const data = await response.json();

      // Step B: AI reply milne par display aur speak karo
      if (data && data.reply) {
        const reply = data.reply;
        showCommand(reply);
        if (document.getElementById("aiReplyBox")) {
          document.getElementById("aiReplyBox").innerText = reply;
        }
        speakText(reply);
        return;
      }

      throw new Error("Empty response from AI server");

    } catch (apiErr) {
      console.warn("AI API Fallback to Local FAQ:", apiErr);

      // Step C: Fallback (Offline FAQ) agar API down ho ya internet na ho
      const faqAnswer = matchAppFaq(raw);
      const reply = faqAnswer || "Samjha nahi. Try karein: invoice kholo, ya Ram ne laptop 25000 ka bill banao.";
      showCommand(reply, { speak: true });
      if (document.getElementById("aiReplyBox")) {
        document.getElementById("aiReplyBox").innerText = reply;
      }
      speakText(reply, true);
    }

  } catch (err) {
    console.error("handleSpeech error:", err);
    showCommand("Kuch dikkat aayi, dobara try karo.");
  } finally {
    if (voiceCommandSucceeded) {
      lastVoiceHandled = { key: dedupeKey, at: Date.now() };
    }
    voiceProcessingLock = false;
  }
}
function setStatus(msg) {
  if (voiceStatus) voiceStatus.textContent = msg;
}

function createRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    setStatus("Speech recognition supported nahi hai.");
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
      if (hint) hint.textContent = "Sun raha hoon… poora boliye, " + (VOICE_FLUSH_MS / 1000) + " sec rukne par process hoga";
      setStatus("Sun raha hoon: " + voiceUtteranceBuffer.slice(0, 70) + (voiceUtteranceBuffer.length > 70 ? "…" : ""));
      clearTimeout(voiceUtteranceFlushTimer);
      voiceUtteranceFlushTimer = setTimeout(flushVoiceBuffer, VOICE_FLUSH_MS);
    } else if (interim.trim()) {
      const calcPanelActive = document.getElementById("calcPanel")?.classList.contains("active");
      const cleanExpr = extractCalcExpression(interim.trim());
      if (calcPanelActive && cleanExpr && document.getElementById("calcDisplay")) {
        document.getElementById("calcDisplay").value = cleanExpr;
      }
      setStatus("Sun raha hoon: " + interim.trim().slice(0, 60) + (interim.length > 60 ? "…" : ""));
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
      setStatus("Mic band ho gaya (" + event.error + "). Browser mein mic permission check karo.");
      return;
    }

    const quiet = event.error === "no-speech" || event.error === "aborted";
    if (!quiet) {
      consecutiveFailures++;
      setStatus("Voice error: " + event.error + " — dobara try ho raha hai...");
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
  setStatus("Voice ON — poora sentence ek saath boliye, 1.5 sec rukne par kaam hoga.");
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
    if (galleryStatusText) galleryStatusText.textContent = "Abhi koi photo upload nahi hui — 'Upload Photo' dabao.";
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
      this.alt = 'Photo load nahi hui — internet check karein';
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
      if (!confirm("Yeh photo delete karein?")) return;
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
  if (galleryStatusText) galleryStatusText.textContent = `${photos.length} photo(s) uploaded hain.`;
}

async function loadGalleryPhotos() {
  try {
    const token = getToken();
    const res = await fetch(`${API_URL}/api/gallery`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.success) renderGalleryThumbs(data.photos);
  } catch (err) {
    console.error("Gallery load error:", err);
    if (galleryStatusText) galleryStatusText.textContent = "Photos load nahi ho payi.";
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
  if (!file.type.startsWith("image/")) { alert("Sirf image file chuno."); return; }
  if (file.size > 5 * 1024 * 1024) { alert("Image 5MB se badi hai, chhoti photo chuno."); return; }

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      if (galleryStatusText) galleryStatusText.textContent = "Upload ho raha hai...";
      const token = getToken();
      const res = await fetch(`${API_URL}/api/gallery/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageData: reader.result })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload fail hua");
      loadGalleryPhotos();
    } catch (err) {
      console.error("Gallery upload error:", err);
      alert("❌ Upload nahi ho paya: " + err.message);
    }
  };
  reader.readAsDataURL(file);
  galleryFileInput.value = "";
});

// Gallery panel khulte hi photos load karo
document.querySelector('.tab-btn[data-tab="galleryPanel"]')?.addEventListener("click", loadGalleryPhotos);
if (document.getElementById("galleryPanel")?.classList.contains("active")) loadGalleryPhotos();

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

// Single Session Guard — plan/payment URL naya tab claim kar sakta hai
const BK_SESSION_CHANNEL = 'bolkarigar_session_hub';
const sessionChannel = new BroadcastChannel(BK_SESSION_CHANNEL);
const _sessionUrlParams = new URLSearchParams(window.location.search);
const canClaimSession = _sessionUrlParams.get('openPanel') === 'myPlanPanel'
  || _sessionUrlParams.get('bkTakeover') === '1';
const bkTabId = `bk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
let bkSessionBlocked = false;

function blockDuplicateSession() {
  if (bkSessionBlocked) return;
  bkSessionBlocked = true;
  document.body.innerHTML = `
    <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh; background:#111; color:#fff; font-family:sans-serif; text-align:center; padding:20px;">
      <h2 style="color:#ef4444;">Access Denied (Ek hi Session Allowed Hai)</h2>
      <p style="margin-top:10px; color:#aaa;">BolKarigar AI Dashboard pehle se hi ek doosre tab/window mein open hai.</p>
      <p style="color:#666; font-size:14px;">Plan kharidne ke liye purane tab me <strong>My Plan</strong> kholo, ya purana tab band karke refresh karein.</p>
      <button onclick="window.location.href='bolkarigar.html?openPanel=myPlanPanel&bkTakeover=1'" style="margin-top:20px; padding:10px 20px; background:#22c55e; color:#fff; border:none; border-radius:6px; cursor:pointer;">💳 My Plan Kholo</button>
      <button onclick="window.location.reload()" style="margin-top:10px; padding:10px 20px; background:#3b82f6; color:#fff; border:none; border-radius:6px; cursor:pointer;">Dubara Try Karein</button>
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

sessionChannel.onmessage = (event) => {
  const data = event.data || {};

  if (data.type === 'OPEN_PLAN_PAYMENT') {
    sessionChannel.postMessage({ type: 'PLAN_PAYMENT_ACK', tabId: data.tabId });
    handlePlanPaymentRequest(data.plan);
    return;
  }

  if (data.type === 'CLAIM_SESSION' && data.tabId !== bkTabId) {
    blockDuplicateSession();
    return;
  }

  if (data.type === 'NEW_TAB_OPENED' && !bkSessionBlocked) {
    sessionChannel.postMessage({ type: 'ALREADY_ACTIVE', fromTab: bkTabId });
  }

  if (data.type === 'ALREADY_ACTIVE' && !canClaimSession) {
    blockDuplicateSession();
  }
};

if (canClaimSession) {
  sessionChannel.postMessage({ type: 'CLAIM_SESSION', tabId: bkTabId });
} else {
  sessionChannel.postMessage({ type: 'NEW_TAB_OPENED' });
}

window.bkHandlePlanPaymentRequest = handlePlanPaymentRequest;

function triggerWhatsAppShare() {
  const currentCust = (document.getElementById("customerName")?.value || "").trim();

  if (!currentCust) {
    showCommand("WhatsApp share ke liye Invoice form me Customer Name bharein!");
    alert("Kripya pehle Customer Name bharein!");
    return;
  }

  const customerItems = state.invoices.filter(item =>
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
      alert("Kripya sahi Price bharein ya pehle item Add karein!");
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
async function sendInvoiceToTally(customer, product, price, qty, gstRate, customerGstin, customerState) {
  try {
    const token = getToken();
    const ewayDetails = getEWayBillDetails(); // Fetching E-Way bill details[cite: 2]

    if (typeof showCommand === 'function') {
      showCommand("⌛ Opening Tally & Syncing with GST & E-Way Bill...");
    }

    fetch(`${API_URL}/api/tally/open`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }).catch(e => console.log("Open trigger sent"));

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
        // E-Way Bill Parameters sent to Tally
        ewayBillNo: ewayDetails.ewayBillNo,
        vehicleNo: ewayDetails.vehicleNo,
        distanceKm: ewayDetails.distanceKm
      })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Sync failed");

    alert(result.message || "✅ Bill Tally Mein Sync Ho Gaya!");
    return true;

  } catch (err) {
    console.error("Sync Error:", err);
    alert("❌ Error: " + err.message);
    return false;
  }
}

async function handleTallyVoiceCommand() {
  const cust = (document.getElementById("customerName")?.value || "").trim();
  const prod = (document.getElementById("productName")?.value || "").trim();
  const price = parseFloat(document.getElementById("productPrice")?.value || "0");
  const qty = parseFloat(document.getElementById("productQty")?.value || "1");
  const gstRate = parseFloat(document.getElementById("productGst")?.value || "0");
  const custGstin = (document.getElementById("customerGstin")?.value || "").trim();
  const custState = (document.getElementById("buyerState")?.value || "").trim();

  if (!cust || !prod || price <= 0) {
    showCommand("Tally me bhejne ke liye Customer, Product aur Price hona zaroori hai!");
    alert("Kripya pehle Invoice Form me Customer, Product aur Sahi Price bharein!");
    return;
  }

  const baseTotal = price * qty;
  const gstAmount = (baseTotal * gstRate) / 100;
  const grandTotal = baseTotal + gstAmount;

  const confirmSync = confirm(`Kya aap Tally Prime ko launch karke GST bill sync karna chahte hain?\n\nCustomer: ${cust}\nProduct: ${prod}\nBase Amount: ₹${baseTotal.toFixed(2)}\nGST (${gstRate}%): ₹${gstAmount.toFixed(2)}\nGrand Total: ₹${grandTotal.toFixed(2)}`);
  
  if (confirmSync) {
    await sendInvoiceToTally(cust, prod, price, qty, gstRate, custGstin, custState);
  }
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
      hintEl.textContent = "✅ GSTIN format sahi hai";
      hintEl.style.color = "#22c55e";
    } else {
      hintEl.textContent = "⚠️ Format sahi nahi (khali chhod sakte hain agar Unregistered customer hai)";
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
    const isCredit = item.paymentType === "Credit" || item.status === "Pending";
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

  function renderUdharRows(rows) {
    ledgerBody.innerHTML = "";
    let totalUdhar = 0;
    if (!rows.length) {
      ledgerBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No Udhar Records Found.</td></tr>`;
      if (document.getElementById("totalUdharVal")) document.getElementById("totalUdharVal").innerText = "₹0.00";
      return;
    }
    rows.forEach(row => {
      const pending = row.pending ?? row.ledgerBalance ?? 0;
      if (pending <= 0 && !(row.billed > 0)) return;
      totalUdhar += pending;
      const cust = row.partyName || row.customer;
      const billed = row.billed ?? pending;
      const paid = row.paid ?? 0;
      const tr = document.createElement("tr");
      tr.innerHTML = `
          <td>${escapeHtml(cust)}</td>
          <td>₹${Number(billed).toFixed(2)}</td>
          <td>₹${Number(paid).toFixed(2)}</td>
          <td style="color: #f59e0b; font-weight: bold;">₹${Number(pending).toFixed(2)}</td>
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
      payBtn.textContent = "Pay";
      payBtn.dataset.customer = cust;
      payBtn.style.cssText = "padding:4px 8px;font-size:12px;border-radius:4px;background:#22c55e;color:#fff;border:none;cursor:pointer;";
      actions.appendChild(viewBtn);
      actions.appendChild(payBtn);
      ledgerBody.appendChild(tr);
    });
    if (document.getElementById("totalUdharVal")) {
      document.getElementById("totalUdharVal").innerText = `₹${totalUdhar.toFixed(2)}`;
    }
  }

  try {
    const res = await fetch(`${API_URL}/api/reports/outstanding`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const data = await res.json();
    if (data.success && data.rows?.length) {
      const rows = data.rows.filter(r => (r.pending > 0) || (r.ledgerBalance > 0));
      if (rows.length) return renderUdharRows(rows);
    }
  } catch (e) { /* server se nahi mila to local fallback */ }

  const localRows = Object.keys(localFallback).map(cust => ({
    partyName: cust,
    billed: localFallback[cust].billed,
    paid: localFallback[cust].paid,
    pending: localFallback[cust].pending
  })).filter(r => r.pending > 0);
  renderUdharRows(localRows);
}
window.refreshUdharKhata = refreshUdharKhata;
window.calculateFinancials = calculateFinancials;

async function showUdharDetail(customerName) {
  const modal = document.getElementById("udharDetailModal");
  const title = document.getElementById("udharDetailTitle");
  const body = document.getElementById("udharDetailBody");
  if (!modal || !body) {
    showToast("View modal load nahi hua — Ctrl+Shift+R se page refresh karein.", "error");
    return;
  }

  modal.classList.remove("hidden");
  if (title) title.textContent = `📖 ${customerName} — loading...`;
  body.innerHTML = `<tr><td colspan="5" style="text-align:center;">Loading...</td></tr>`;

  let rows = [];
  let totalBilled = 0, totalPaid = 0;

  try {
    const token = getToken();
    const hdrs = { Authorization: `Bearer ${token}` };
    const [salesRes, payRes] = await Promise.all([
      fetch(`${API_URL}/api/sales?search=${encodeURIComponent(customerName)}&limit=100`, { headers: hdrs }),
      fetch(`${API_URL}/api/payments?customer=${encodeURIComponent(customerName)}`, { headers: hdrs })
    ]);
    const salesData = await salesRes.json();
    const payData = await payRes.json();

    if (salesData.records?.length) {
      salesData.records.forEach(r => {
        const amt = r.totalAmount || (parseFloat(r.price) || 0) * (parseFloat(r.qty) || 1);
        const isCredit = r.status === "Pending" || r.paymentType === "Credit";
        const paid = isCredit ? 0 : amt;
        totalBilled += amt;
        totalPaid += paid;
        rows.push({
          label: `${new Date(r.date).toLocaleDateString()} — ${r.product || "Sale"}`,
          qty: r.qty || 1,
          amt, paid, pending: isCredit ? amt : 0
        });
      });
    }

    if (payData.payments?.length) {
      payData.payments.forEach(p => {
        totalPaid += p.amount;
        rows.push({
          label: `${new Date(p.date).toLocaleDateString()} — Payment (${p.paymentMode || "Cash"})`,
          qty: "—",
          amt: 0, paid: p.amount, pending: -p.amount,
          isPayment: true
        });
      });
    }
  } catch (e) {
    console.warn("Udhar detail API:", e);
  }

  // Local invoice draft fallback
  (state.invoices || []).filter(i => (i.customer || "General Customer") === customerName).forEach(r => {
    const amt = getInvoiceLineGrandTotal(r);
    const p = parseFloat(r.paidAmount) || 0;
    const already = rows.some(x => x.label.includes(r.product));
    if (!already) {
      totalBilled += amt;
      totalPaid += p;
      rows.push({ label: `Draft — ${r.product}`, qty: r.qty, amt, paid: p, pending: amt - p });
    }
  });

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="5" style="text-align:center;">Koi transaction nahi mila.</td></tr>`;
  } else {
    body.innerHTML = rows.map(r => `
      <tr style="${r.isPayment ? 'background:rgba(34,197,94,.08)' : ''}">
        <td>${escapeHtml(r.label)}</td>
        <td>${r.qty}</td>
        <td>${r.amt ? '₹' + r.amt.toFixed(2) : '—'}</td>
        <td>${r.paid ? '₹' + r.paid.toFixed(2) : '—'}</td>
        <td>${r.pending > 0 ? '₹' + r.pending.toFixed(2) : (r.pending < 0 ? '' : '—')}</td>
      </tr>`).join("");
  }

  const pending = Math.max(0, totalBilled - totalPaid);
  if (title) title.textContent = `📖 ${customerName} — Pending: ₹${pending.toFixed(2)}`;

  const payBtn = document.getElementById("udharDetailPayBtn");
  if (payBtn) {
    payBtn.onclick = () => {
      modal.classList.add("hidden");
      if (typeof window.openUdharPayment === "function") window.openUdharPayment(customerName);
    };
  }
  modal.dataset.customer = customerName;
}
window.showUdharDetail = showUdharDetail;

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

async function printTallyBill() {
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

  if (!customerState && !extractPincode(customerPincode)) {
    alert("⚠️ Buyer State ya 6-digit Pincode zaroor bharein — tabhi sahi CGST+SGST ya IGST calculate hoga.");
    return;
  }
  if (!taxMode.companyState) {
    alert("⚠️ Business Profile me state/address update karein (jaise: bmg mall rewari, Haryana).");
    return;
  }

  const isIntraState = taxMode.isIntraState;

  const grandTotalStr = document.getElementById("grandTotal")?.textContent || "0.00";
  const grandTotalNum = parseFloat(grandTotalStr.replace(/,/g, '')) || 0;

  const invoiceDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-');
  const invoiceNo = await getNextInvoiceNumber(companyName);

  // Auto-generated reference IRN/Ack (LOCAL ONLY — see disclaimer above)
  const irn = generateRandomIRN();
  const ackNo = generateAckNo();
  const ackDate = invoiceDate;

  const ewayBillNo = document.getElementById("ewayBillNo")?.value?.trim() || "";
  const vehicleNo = document.getElementById("vehicleNo")?.value?.trim() || "";
  const distanceKm = clampDistanceKmInput();

  let itemsRows = "";
  let totalBase = 0;
  let totalTax = 0;
  let totalQty = 0; // Quantity ka sum, Total row me dikhane ke liye
  const hsnSummary = {}; // HSN-wise tax summary ke liye

  if (typeof state !== 'undefined' && state.invoices && state.invoices.length > 0) {
    state.invoices.forEach((item, index) => {
      const price = parseFloat(item.price) || 0;
      const qty = parseFloat(item.qty) || 1;
      const gstRate = parseFloat(item.gstRate) || 18;
      const hsn = item.hsn || "-";

      const baseTotal = price * qty;
      totalBase += baseTotal;
      totalQty += qty;

      let taxRows = "";
      if (isIntraState) {
        const cgstAmt = (baseTotal * (gstRate / 2)) / 100;
        const sgstAmt = (baseTotal * (gstRate / 2)) / 100;
        totalTax += cgstAmt + sgstAmt;
        taxRows = `
          <tr class="item-row tax-row">
            <td></td><td style="padding-left: 20px;"><em>CGST (${(gstRate / 2)}%)</em></td><td></td><td></td><td></td><td></td>
            <td style="text-align:right;">${cgstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr class="item-row tax-row">
            <td></td><td style="padding-left: 20px;"><em>SGST (${(gstRate / 2)}%)</em></td><td></td><td></td><td></td><td></td>
            <td style="text-align:right;">${sgstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          </tr>`;
        if (!hsnSummary[hsn]) hsnSummary[hsn] = { taxable: 0, cgstRate: gstRate / 2, cgstAmt: 0, sgstRate: gstRate / 2, sgstAmt: 0, igstAmt: 0 };
        hsnSummary[hsn].taxable += baseTotal;
        hsnSummary[hsn].cgstAmt += cgstAmt;
        hsnSummary[hsn].sgstAmt += sgstAmt;
      } else {
        const igstAmt = (baseTotal * gstRate) / 100;
        totalTax += igstAmt;
        taxRows = `
          <tr class="item-row tax-row">
            <td></td><td style="padding-left: 20px;"><em>IGST (${gstRate}%)</em></td><td></td><td></td><td></td><td></td>
            <td style="text-align:right;">${igstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          </tr>`;
        if (!hsnSummary[hsn]) hsnSummary[hsn] = { taxable: 0, igstRate: gstRate, igstAmt: 0 };
        hsnSummary[hsn].taxable += baseTotal;
        hsnSummary[hsn].igstAmt += igstAmt;
      }

      itemsRows += `
        <tr class="item-row">
          <td class="col-sl" style="text-align:center;">${index + 1}</td>
          <td class="col-desc"><strong>${item.product || "Sales Account"}</strong></td>
          <td style="text-align:center;">${hsn}</td>
          <td class="col-qty" style="text-align:center;">${qty} No</td>
          <td class="col-rate" style="text-align:right;">${price.toFixed(2)}</td>
          <td class="col-per" style="text-align:center;">No</td>
          <td class="col-amt" style="text-align:right;">${baseTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
        ${taxRows}`;
    });
  } else {
    alert("Print karne ke liye invoice mein kam se kam 1 item hona zaroori hai!");
    return;
  }

  function numberToWords(num) {
    if (!num || isNaN(num) || num === 0) return "INR Zero Only";
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    function inWords(n) {
      let numStr = Math.floor(n).toString();
      if (numStr.length > 9) return 'Amount Too Large';
      let n_array = ('000000000' + numStr).slice(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
      if (!n_array) return '';
      let str = '';
      str += (n_array[1] != 0) ? (a[Number(n_array[1])] || b[n_array[1][0]] + ' ' + a[n_array[1][1]]) + 'Crore ' : '';
      str += (n_array[2] != 0) ? (a[Number(n_array[2])] || b[n_array[2][0]] + ' ' + a[n_array[2][1]]) + 'Lakh ' : '';
      str += (n_array[3] != 0) ? (a[Number(n_array[3])] || b[n_array[3][0]] + ' ' + a[n_array[3][1]]) + 'Thousand ' : '';
      str += (n_array[4] != 0) ? (a[Number(n_array[4])] || b[n_array[4][0]] + ' ' + a[n_array[4][1]]) + 'Hundred ' : '';
      str += (n_array[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n_array[5])] || b[n_array[5][0]] + ' ' + a[n_array[5][1]]) : '';
      return str;
    }
    return "INR " + (inWords(num) || "Zero") + " Only";
  }

  const amountInWords = numberToWords(grandTotalNum);
  const taxInWords = numberToWords(totalTax);

  // HSN summary table rows banao
  let hsnRows = "";
  let hsnTotalTaxable = 0, hsnTotalCgst = 0, hsnTotalSgst = 0, hsnTotalTax = 0;
  Object.keys(hsnSummary).forEach(hsn => {
    const row = hsnSummary[hsn];
    hsnTotalTaxable += row.taxable;
    if (isIntraState) {
      hsnTotalCgst += row.cgstAmt;
      hsnTotalSgst += row.sgstAmt;
      const rowTotalTax = row.cgstAmt + row.sgstAmt;
      hsnTotalTax += rowTotalTax;
      hsnRows += `
        <tr>
          <td>${hsn}</td>
          <td style="text-align:right;">${row.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td style="text-align:center;">${row.cgstRate}%</td>
          <td style="text-align:right;">${row.cgstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td style="text-align:center;">${row.sgstRate}%</td>
          <td style="text-align:right;">${row.sgstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td style="text-align:right;">${rowTotalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>`;
    } else {
      hsnTotalTax += row.igstAmt;
      hsnRows += `
        <tr>
          <td>${hsn}</td>
          <td style="text-align:right;">${row.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td colspan="2" style="text-align:center;">IGST ${row.igstRate}%</td>
          <td style="text-align:right;" colspan="2">${row.igstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td style="text-align:right;">${row.igstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>`;
    }
  });

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow pop-ups in your browser to print the invoice!");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Tax Invoice - ${invoiceNo}</title>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
      <style>
        * { box-sizing: border-box; font-family: 'Arial', sans-serif; font-size: 11px; }
        body { margin: 0; padding: 15px; background: #fff; color: #000; }
        .tally-container { width: 210mm; min-height: 297mm; margin: auto; border: 1.5px solid #000; padding: 10px; }
        .title-row { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #000; padding-bottom: 6px; margin-bottom: 6px; }
        .title { font-weight: bold; font-size: 15px; }
        .einv-label { font-weight: bold; font-size: 11px; text-align: right; }
        #qrBox { width: 90px; height: 90px; margin-left: auto; margin-top: 4px; }
        .irn-block { font-size: 10px; border-bottom: 1px solid #000; padding: 6px 0; margin-bottom: 6px; }
        .irn-block div { margin-bottom: 2px; word-break: break-all; }
        .demo-note { font-size: 8.5px; color: #b45309; font-style: italic; margin-top: 3px; }

        .grid-header { display: flex; border-bottom: 1px solid #000; }
        .col-left { width: 50%; border-right: 1px solid #000; padding: 5px; }
        .col-right { width: 50%; }
        .company-name { font-weight: bold; font-size: 12px; margin-bottom: 3px; text-transform: uppercase; }
        .party-block { padding: 5px; border-bottom: 1px solid #000; }
        .party-label { font-size: 9.5px; color: #444; }
        .party-name { font-weight: bold; font-size: 11.5px; margin: 2px 0; }

        .sub-table { width: 100%; border-collapse: collapse; }
        .sub-table td { border-bottom: 1px solid #000; border-right: 1px solid #000; padding: 3px 5px; vertical-align: top; font-size: 10px; }
        .sub-table tr td:last-child { border-right: none; }
        .sub-table tr:last-child td { border-bottom: none; }

        .items-table, .hsn-table { width: 100%; border-collapse: collapse; margin-top: 4px; }
        .items-table th, .hsn-table th { border: 1px solid #000; padding: 4px; font-weight: bold; font-size: 10px; }
        .item-row td { border-right: 1px solid #000; padding: 3px 5px; border-bottom: none; }
        .item-row td:last-child { border-right: none; }
        .total-row td { border-top: 1px solid #000; border-bottom: 1px solid #000; border-right: 1px solid #000; padding: 4px; font-weight: bold; }
        .total-row td:last-child { border-right: none; }
        .hsn-table td { border: 1px solid #000; padding: 4px; font-size: 10px; }

        .footer-section { padding: 5px; border-bottom: 1px solid #000; margin-top: 6px; }
        .sign-section { display: flex; justify-content: space-between; padding: 10px 5px; align-items: flex-end; }
        .declaration { font-size: 9.5px; border-bottom: 1px solid #000; padding: 6px 5px; }
      </style>
    </head>
    <body onload="(function(){if(window.QRCode){new QRCode(document.getElementById('qrBox'),{text:'IRN:${irn}',width:90,height:90});var upi='${(companyUpi || '').replace(/'/g, '')}';if(upi&&document.getElementById('upiQrBox')){var amt=${Math.round(grandTotalNum)};new QRCode(document.getElementById('upiQrBox'),{text:'upi://pay?pa='+encodeURIComponent(upi)+'&pn='+encodeURIComponent('${companyName.replace(/'/g, '')}')+'&am='+amt+'&cu=INR',width:90,height:90});}}}());window.print();">
      <div class="tally-container">
        <div class="title-row">
          <div class="title">Tax Invoice</div>
          <div>
            <div class="einv-label">Tax Invoice (Reference Copy — Not Government e-Invoice)</div>
            <div id="qrBox"></div>
          </div>
        </div>

        <div class="irn-block">
          <div><strong>IRN</strong> &nbsp;: &nbsp;${irn}</div>
          <div><strong>Ack No.</strong> &nbsp;: &nbsp;${ackNo}</div>
          <div><strong>Ack Date</strong> &nbsp;: &nbsp;${ackDate}</div>
          <div class="demo-note" style="background:#fef3c7;border:1px solid #f59e0b;padding:8px;margin:8px 0;border-radius:4px;font-weight:600;">⚠️ REFERENCE BILL ONLY — Yeh government e-Invoice NAHI hai. Asli IRN ke liye GSP portal integration chahiye. BolKarigar par yeh sirf billing/print ke liye hai.</div>
        </div>

        <div class="grid-header">
          <div class="col-left">
            <div class="company-name">${companyName}</div>
            <div>${companyAddress}</div>
            <div>State Name: ${companyStateDisplay}${companyPincodeDisplay ? ` - ${companyPincodeDisplay}` : ''}</div>
            <div>GSTIN/UIN: ${companyGstin}</div>
            <div>Contact: ${companyPhone}</div>
          </div>
          <div class="col-right">
            <table class="sub-table">
              <tr><td><strong>Invoice No.</strong><br>${invoiceNo}</td><td><strong>Dated</strong><br>${invoiceDate}</td></tr>
              <tr><td><strong>Delivery Note</strong><br>&nbsp;</td><td><strong>Mode/Terms of Payment</strong><br>&nbsp;</td></tr>
              <tr><td><strong>Reference No. &amp; Date</strong><br>&nbsp;</td><td><strong>Other References</strong><br>&nbsp;</td></tr>
              <tr><td><strong>Buyer's Order No.</strong><br>&nbsp;</td><td><strong>Dated</strong><br>&nbsp;</td></tr>
              <tr><td><strong>E-Way Bill No.</strong><br>${ewayBillNo || "&nbsp;"}</td><td><strong>Vehicle No.</strong><br>${vehicleNo || "&nbsp;"}</td></tr>
            </table>
          </div>
        </div>

        <div class="party-block">
          <div class="party-label">Consignee (Ship to)</div>
          <div class="party-name">${customer}</div>
          <div>${customerAddress}</div>
          <div>GSTIN/UIN: ${customerGstin || "-"}</div>
          <div>State Name: ${customerState}</div>
        </div>
        <div class="party-block">
          <div class="party-label">Buyer (Bill to)</div>
          <div class="party-name">${customer}</div>
          <div>${customerAddress}</div>
          <div>GSTIN/UIN: ${customerGstin || "-"}</div>
          <div>State Name: ${customerState}</div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 5%;">Sl</th>
              <th style="width: 33%;">Description of Goods</th>
              <th style="width: 10%;">HSN/SAC</th>
              <th style="width: 10%;">Quantity</th>
              <th style="width: 12%;">Rate</th>
              <th style="width: 8%;">per</th>
              <th style="width: 22%;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
            <tr class="total-row">
              <td colspan="2" style="text-align: right;">Total</td>
              <td></td>
              <td style="text-align: center;">${totalQty} No</td>
              <td></td><td></td>
              <td style="text-align: right;">₹${grandTotalNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        <div class="footer-section">
          <div><strong>Amount Chargeable (in words):</strong></div>
          <div style="font-weight: bold; margin-top: 3px;">${amountInWords}</div>
        </div>

        <table class="hsn-table">
          <thead>
            <tr>
              <th rowspan="2">HSN/SAC</th>
              <th rowspan="2">Taxable Value</th>
              <th colspan="2">Central Tax</th>
              <th colspan="2">State Tax</th>
              <th rowspan="2">Total Tax Amount</th>
            </tr>
            <tr><th>Rate</th><th>Amount</th><th>Rate</th><th>Amount</th></tr>
          </thead>
          <tbody>
            ${hsnRows}
            <tr class="total-row">
              <td>Total</td>
              <td style="text-align:right;">${hsnTotalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              ${isIntraState ? `
              <td></td>
              <td style="text-align:right;">${hsnTotalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td></td>
              <td style="text-align:right;">${hsnTotalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              ` : `
              <td colspan="2" style="text-align:center;">IGST</td>
              <td colspan="2" style="text-align:right;">${hsnTotalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              `}
              <td style="text-align:right;">${hsnTotalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        <div class="footer-section">
          <div><strong>Tax Amount (in words):</strong> ${taxInWords}</div>
        </div>

        <div class="declaration">
          <strong>Declaration</strong><br>
          We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
        </div>

        <div class="sign-section">
          <div><em>Customer's Seal and Signature</em></div>
          <div style="text-align: right;">
            ${companyUpi ? `<div style="font-size:10px;margin-bottom:6px;">Scan to Pay UPI: ${companyUpi}<div id="upiQrBox" style="margin:6px 0 0 auto;width:90px;height:90px;"></div></div>` : ''}
            <div>for <strong>${companyName}</strong></div>
            <br><br>
            <div>Authorised Signatory</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
}

window.printTallyBill = printTallyBill;

async function printThermalBill() {
  let savedProfile = {};
  try { savedProfile = JSON.parse(localStorage.getItem("bolkarigar_company_profile")) || {}; } catch { /* */ }
  const companyName = savedProfile.name || "Shop";
  const customer = document.getElementById("customerName")?.value.trim() || "Customer";
  const grandTotal = document.getElementById("grandTotal")?.textContent || "0.00";
  const invoiceNo = await getNextInvoiceNumber(companyName);
  const date = new Date().toLocaleDateString("en-IN");
  let lines = "";
  (state.invoices || []).forEach((item) => {
    const sub = (item.price || 0) * (item.qty || 1);
    lines += `<tr><td>${item.product}</td><td style="text-align:right">${item.qty}</td><td style="text-align:right">₹${sub.toFixed(2)}</td></tr>`;
  });
  const upi = savedProfile.upiId || "";
  const w = window.open("", "_blank", "width=320,height=600");
  if (!w) { alert("Pop-up allow karein thermal print ke liye."); return; }
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
    alert("Sirf owner company profile edit kar sakta hai.");
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
    alert("⚠️ Kripya Company Name, GSTIN aur Address zaroor bharein!");
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
      alert("✅ Profile successfully save ho gayi!");

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
      alert("❌ Error: " + (result.error || "Save nahi ho paya"));
    }
  } catch (error) {
    console.error("Exact Error:", error);
    alert("❌ Network Error: Console (F12) check karein!");
  }
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
      const invoiceElements = invoiceContainer.querySelectorAll("input, select, button, textarea");
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
      const invoiceElements = invoiceContainer.querySelectorAll("input, select, button, textarea");
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

  function pushHistory(role, content) {
    const text = String(content || "").trim();
    if (!text) return;
    chatHistory.push({ role: role === "user" ? "user" : "assistant", content: text.slice(0, 2000) });
    if (chatHistory.length > 20) chatHistory.splice(0, chatHistory.length - 20);
  }

  window.bkGetChatHistory = () => chatHistory.slice();
  window.bkClearChatHistory = () => { chatHistory.length = 0; };

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
    const div = document.createElement("div");
    div.className = "live-ai-msg " + (kind === "user" ? "live-ai-msg-user" : kind === "action" ? "live-ai-msg-action" : "live-ai-msg-bot");
    div.textContent = text;
    messagesBox.appendChild(div);
    messagesBox.scrollTop = messagesBox.scrollHeight;
    return div;
  }

  function speakText(text, onDone) {
    try {
      if (!("speechSynthesis" in window) || !text) {
        if (typeof onDone === "function") onDone();
        return;
      }
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "hi-IN";
      utter.rate = 1;
      const voices = window.speechSynthesis.getVoices();
      const hindiVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith("hi"));
      if (hindiVoice) utter.voice = hindiVoice;
      utter.onend = utter.onerror = () => { if (typeof onDone === "function") onDone(); };
      window.speechSynthesis.speak(utter);
    } catch (e) {
      if (typeof onDone === "function") onDone();
    }
  }

  function startLiveMic() {
    if (!liveConvMode || aiListening || !micBtn) return;
    micBtn.click();
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
    updateModelBadge();
    addBubble("Chat clear kar diya. Bolo, kya madad chahiye?", "bot");
  });

  liveBtn?.addEventListener("click", () => {
    liveConvMode = !liveConvMode;
    liveBtn.classList.toggle("active", liveConvMode);
    liveBtn.title = liveConvMode ? "Live mode ON — mic auto chalega" : "Live baatcheet ON karo";
    if (liveConvMode) {
      addBubble("🎙️ Live mode ON — boliye, main sun raha hoon.", "bot");
      startLiveMic();
    }
  });

  // -------------------------------------------------------------------
  // Offline FAQ — direct keyword matching for common questions.
  // Jab Gemini API down ho tab bhi yeh basic sawalon ke jawab dega.
  // -------------------------------------------------------------------
  const LIVE_FAQ = [
    { keywords: ["namaste", "hello", "hi", "hey", "kaise ho", "kese ho", "kaisa hai", "kya haal", "good morning", "good evening", "hlo", "helo", "hii"],
      answer: "Namaste! Bataiye, kya madad kar sakta hoon? App ke bare me poochh sakte ho ya seedha koi kaam bol sakte ho." },
    { keywords: ["thanks", "thank you", "shukriya", "dhanyawad", "thanku"],
      answer: "Koi baat nahi! Aur kuch madad chahiye ho to bataiye." },
    { keywords: ["bye", "alvida", "phir milenge", "chalta hoon", "goodbye"],
      answer: "Theek hai, jab bhi zaroorat ho, AI button dabana — main yahin hoon!" },
    { keywords: ["tum kaun", "who are you", "aap kaun", "tumhara naam", "your name", "kya ho tum", "what are you", "aap kon", "kaun ho"],
      answer: "Main BolKarigar AI hoon — is app ka apna assistant. Main aapke sawalon ke jawab de sakta hoon aur app ke andar kaam bhi kar sakta hoon." },
  { keywords: ["kya kya kar sakte", "kya kar sakte ho", "features", "help", "madad", "kya kaam", "what can you do", "kya kya kaam", "ker skte", "kar skte", "kya kr skte", "kya kya smjte", "kya smjte", "kya jante", "kya kya jante", "app k bare m kya jante", "app k bare m kya pta", "app k baare m kya jaante", "kya jaante ho", "ho skta", "ho sakta", "ho skte", "ho sakte", "iss app m", "is app me", "app me kya", "kitne model", "kitne module", "modules"],
    answer: APP_FEATURES_OVERVIEW },
    { keywords: ["free hai", "paisa lagega", "cost kitni", "kitna paisa", "paid hai kya", "is this free", "billing lagegi", "free", "cost"],
      answer: "Bilkul free hai! Main app ke andar hi browser me chalta hoon, koi internet ya paid API ki zaroorat nahi — isliye koi cost nahi lagta." },
    { keywords: ["bolkarigar kya hai", "yeh app kya hai", "app kis liye", "what is this app", "app ke bare me batao", "kya hai iss app", "kya hai is app", "app m kya", "app me kya", "kya kya hai iss app", "kya kya hai is app"],
      answer: "BolKarigar ek Hindi voice-first business app hai — chhote dukandaron aur contractors ke liye. Isme aap invoice banana, project aur kharcha track karna, todo list, udhar khata, inventory, aur bahut kuch bol kar ya type karke kar sakte ho." },
    { keywords: ["invoice kaise", "bill kaise", "invoice banaye", "invoice banao", "how to invoice", "bill banaye", "invoice bnaye", "invoice kese", "invoice kese bnaye", "invoice kese banaye", "invoice bnao", "bill bnao"],
      answer: "Invoice banane ke liye Invoice tab kholo, phir Customer Name, Product, Price aur Quantity bharo aur Add Item dabao. Aap mujhse bhi bol sakte ho, jaise 'customer Ramesh product plywood price 2500 quantity 2'." },
    { keywords: ["project kaise", "how to project", "project add kaise", "naya project", "project kese", "project kese add kre"],
      answer: "Projects tab me Project Name, Customer, Budget aur Note bhar ke Add Project dabao. Ya bol do jaise 'project Mandir work customer Aslam budget 50000'." },
    { keywords: ["expense kaise", "kharcha kaise", "how to expense", "expense kese", "kharcha kese"],
      answer: "Expense add karne ke liye Projects tab ke Quick Expense Entry me Title, Vendor aur Amount bharo. Ya bol do jaise 'vendor Sharma Timber amount 4200'." },
    { keywords: ["todo kaise", "task kaise", "how to todo", "todo add kaise", "todo kese", "task kese", "todo m kya", "todo me kya", "todo kya kya", "todo kam kese"],
      answer: TODO_MODULE_ANSWER },
    { keywords: ["gst", "gst kya", "gst rate", "what is gst", "gst kya hai"],
      answer: "Invoice banate waqt aap GST rate 5%, 12%, 18% ya 28% dropdown se select kar sakte ho — app automatically GST amount aur total calculate kar deta hai." },
    { keywords: ["whatsapp share", "whatsapp pe bhejo", "whatsapp invoice", "whatsapp bill"],
      answer: "WhatsApp Share button dabao — invoice seedha WhatsApp ke through customer ko bhej sakte ho." },
    { keywords: ["tally", "tally sync", "tally prime", "tally kya", "tally kaise"],
      answer: "Tally Prime se sync karne ke liye sidebar me diya gaya Tally Sync Agent .exe download karke apne PC pe chalao, phir Invoice panel me Tally Prime mode select karke Sync to Tally dabao." },
    { keywords: ["udhar khata", "udhar kaise", "khata kya", "credit customer", "udhar kya", "udhar kya hai"],
      answer: "Udhar Khata tab me aap customers ka udhar (credit) track kar sakte ho — kis customer ne kitna udhar liya hai." },
    { keywords: ["inventory kya", "stock kaise", "inventory", "stock"],
      answer: "Inventory tab me aap apna stock aur saman track kar sakte ho." },
    { keywords: ["qr", "qr code", "qr tool", "qr kya"],
      answer: "QR Tool tab me text ya link daal ke uska QR code bana sakte ho." },
    { keywords: ["calculator", "calculate kaise", "calc"],
      answer: "Calculator tab me normal calculator hai, ya bol kar bhi calculation kar sakte ho jaise '25 plus 30'." },
    { keywords: ["converter", "unit convert", "convert kaise"],
      answer: "Converter tab me length, weight aur temperature jaise units convert kar sakte ho." },
    { keywords: ["notes kaise", "note kaise", "notes", "note"],
      answer: "Notes tab me apne notes likh sakte ho aur Download notes se save bhi kar sakte ho." },
    { keywords: ["dark mode", "light mode", "theme kaise", "dark", "light"],
      answer: "Header me Light/Dark button se theme badal sakte ho, ya bol do 'dark mode on' ya 'dark mode off'." },
    { keywords: ["voice kaise", "voice kaam", "how does voice", "voice on kaise", "voice off kaise"],
      answer: "Header me Voice OFF button dabao — yeh continuous voice mode ON kar deta hai, phir aap bol kar commands de sakte ho." },
    { keywords: ["gallery kya", "gallery kaise", "gallery"],
      answer: "Gallery tab me aap apne kaam ki photos store aur dekh sakte ho." },
    { keywords: ["logout kaise", "log out kaise", "sign out", "logout"],
      answer: "Header me upar right side Logout button dabao — aap seedha login page pe chale jaoge." },
    { keywords: ["password bhool", "forgot password", "password reset", "password bhool gya", "password bhool gaye"],
      answer: "Login page pe Forgot Password link se apna password reset kar sakte ho." },
    { keywords: ["business profile", "company profile", "profile save", "firm ka naam", "gstin kaise dalu", "profile"],
      answer: "Business Profile Settings me apni Company Name, GSTIN, Phone, Address bhar ke Save Business Profile dabao — ek baar save hone ke baad Invoice Generator unlock ho jayega." },
    { keywords: ["eway bill", "e way bill", "vehicle number", "transport details"],
      answer: "Invoice panel me E-Way Bill aur Transport Details section hai (optional) — jahan E-Way Bill number, vehicle number aur distance bhar sakte ho." },
    { keywords: ["profit loss", "financial summary", "report kaise", "kamai dikhao", "profit", "loss", "financial"],
      answer: "Overview panel me AI Accountant cards ke through aapko total sales, expenses aur profit ka summary dikhta hai." },
    { keywords: ["help panel", "guide kaha", "manual kaha", "help", "guide"],
      answer: "Sidebar me Help and Guide tab hai — wahan har module ki poori jaankari mil jayegi." },
    { keywords: ["accounting mode", "tally prime kya", "bolkarigar khata kya"],
      answer: "Invoice panel me Accounting Mode choose kar sakte ho — BolKarigar Khata (in-house) ya Tally Prime (aapke Tally software se sync hota hai)." },
    { keywords: ["todo m kya", "todo me kya", "todo kya kya", "todo kam kese", "todo kaam", "todo list kya", "todo ker skte", "todo kar sakte", "todo kese kaam"],
      answer: TODO_MODULE_ANSWER },
    { keywords: ["ledger m kya", "ledger me kya", "accounting m kya", "accounting me kya", "voucher kaise", "day book kya"],
      answer: ACCOUNTING_MODULE_ANSWER }
  ];

  function matchLiveFaq(rawText) {
    const moduleFaq = matchModuleFaq(rawText);
    if (moduleFaq) return moduleFaq;
    const smart = matchFaqSmart(rawText, LIVE_FAQ);
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
      if (looksLikeConverterCommand(text)) { handleConverterSpeech(rawText); return voiceResult?.textContent || prev; }
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
    speakText(reply, () => { if (liveConvMode) setTimeout(startLiveMic, 400); });
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
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.reply || data?.error || "Server error");
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
          finishBotReply(voiceResult?.textContent || prev || "Invoice update ho gaya.", "action");
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

  // --- Mic button: single-shot speech recognition (app ke continuous voice se alag) ---

  function createAiRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    const rec = new SpeechRecognition();
    rec.lang = "hi-IN";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    return rec;
  }

  micBtn?.addEventListener("click", () => {
    if (aiListening) {
      aiRecognition?.stop();
      return;
    }
    aiRecognition = createAiRecognition();
    if (!aiRecognition) {
      addBubble("⚠️ Is browser me voice input support nahi hai.", "bot");
      return;
    }
    aiListening = true;
    micBtn.classList.add("listening");
    statusDot?.classList.add("listening");

    aiRecognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      sendUserMessage(transcript);
    };
    aiRecognition.onerror = () => {
      aiListening = false;
      micBtn.classList.remove("listening");
      statusDot?.classList.remove("listening");
    };
    aiRecognition.onend = () => {
      aiListening = false;
      micBtn.classList.remove("listening");
      statusDot?.classList.remove("listening");
    };

    try { aiRecognition.start(); } catch (e) { aiListening = false; }
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
    khataVoucherPanel: () => { loadLedgerDropdowns(); loadItemDropdown(); updateVoucherFormUI(); },
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

  function renderKhataLedgersTable(body) {
    const rows = getKhataPageSlice("ledgers");
    if (!khataPag.ledgers.data.length) {
      body.innerHTML = `<tr><td colspan='5'>Koi ledger nahi bana abhi.</td></tr>`;
      return;
    }
    body.innerHTML = rows.map(l => `
      <tr>
        <td>${escapeHtml(l.partyName)}</td>
        <td>${escapeHtml(l.ledgerGroup) || escapeHtml(l.partyType)}</td>
        <td>${escapeHtml(l.mobile) || "-"}</td>
        <td class="${l.currentBalance >= 0 ? 'khata-badge-debit' : 'khata-badge-credit'}">₹${Math.abs(l.currentBalance).toFixed(2)} ${l.currentBalance >= 0 ? "Dr" : "Cr"}</td>
        <td class="khata-act-group">
          <button type="button" class="khata-act-btn" title="Ledger Statement dekho — saari transactions / खाता विवरण" aria-label="View ledger statement" onclick="viewKhataLedgerStatement('${l._id}')">📄 Statement</button>
          <button type="button" class="khata-act-btn" title="Tally Prime me sync karo / टैली में भेजें" aria-label="Sync to Tally" onclick="syncKhataLedgerToTally('${l._id}')">📊 Tally</button>
          <button type="button" class="khata-act-btn danger" title="Ledger delete karo / हटाएं" aria-label="Delete ledger" onclick="deleteKhataLedger('${l._id}')">🗑️ Delete</button>
        </td>
      </tr>`).join("");
  }

  function renderKhataItemsTable(body) {
    const rows = getKhataPageSlice("items");
    if (!khataPag.items.data.length) {
      body.innerHTML = `<tr><td colspan='6'>Koi item nahi bana abhi.</td></tr>`;
      return;
    }
    body.innerHTML = rows.map(i => `
      <tr>
        <td>${escapeHtml(i.itemName)}</td>
        <td>${escapeHtml(i.unit)}</td>
        <td>₹${i.purchasePrice}</td>
        <td>₹${i.sellingPrice}</td>
        <td>${i.stockQty}</td>
        <td><button type="button" onclick="deleteKhataItem('${i._id}')">🗑️</button></td>
      </tr>`).join("");
  }

  function renderKhataDaybookTable(body) {
    const rows = getKhataPageSlice("daybook");
    if (!khataPag.daybook.data.length) {
      body.innerHTML = `<tr><td colspan='6'>Abhi koi voucher nahi bana.</td></tr>`;
      return;
    }
    body.innerHTML = rows.map(v => `
      <tr>
        <td>${new Date(v.date).toLocaleDateString("en-IN")}</td>
        <td>${v.voucherType}</td>
        <td>${escapeHtml(v.partyId?.partyName) || "-"}</td>
        <td>₹${v.amount.toFixed(2)}</td>
        <td>${escapeHtml(v.note) || "-"}</td>
        <td>${v.syncedToTally ? "✅" : `<button type="button" onclick="syncKhataVoucherToTally('${v._id}')">📊 Sync</button>`}</td>
      </tr>`).join("");
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
    if (!confirm("Yeh ledger delete karein?")) return;
    try {
      const res = await fetch(`${API_URL}/api/ledgers/${id}`, { method: "DELETE", headers: khataHeaders() });
      const data = await res.json();
      if (!res.ok) { showToast("❌ " + data.error, "error"); return; }
      showToast("Ledger delete ho gaya.");
      loadKhataLedgers();
    } catch (err) { showToast("❌ " + err.message, "error"); }
  };

  window.syncKhataLedgerToTally = async function (id) {
    try {
      showToast("⌛ Tally me ledger sync ho raha hai...");
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
      showToast("Ledger statement window load nahi hui. Page refresh karein.", "error");
      return;
    }
    body.innerHTML = "<tr><td colspan='4'>Loading...</td></tr>";
    if (meta) meta.textContent = "";
    modal.classList.remove("hidden");
    try {
      const res = await fetch(`${API_URL}/api/ledger-statement/${id}`, { headers: khataHeaders() });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      if (title) title.textContent = `📄 ${data.partyName} — Ledger Statement`;
      if (meta) {
        meta.textContent = `Opening Balance: ₹${Number(data.openingBalance || 0).toFixed(2)} | Current Balance: ₹${Number(data.currentBalance || 0).toFixed(2)}`;
      }
      if (!data.history?.length) {
        body.innerHTML = `<tr><td colspan='4' style="text-align:center;">Abhi koi transaction nahi. Sirf opening balance hai.</td></tr>`;
        return;
      }
      body.innerHTML = data.history.map(v => `
        <tr>
          <td>${new Date(v.date).toLocaleDateString("en-IN")}</td>
          <td>${escapeHtml(v.voucherType)}</td>
          <td>₹${Number(v.amount || 0).toFixed(2)}</td>
          <td>${escapeHtml(v.note) || "-"}</td>
        </tr>`).join("");
    } catch (err) {
      body.innerHTML = `<tr><td colspan='4'>Error: ${escapeHtml(err.message)}</td></tr>`;
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
    if (!partyName) { alert("Ledger naam daalein."); return; }
    const payload = {
      partyName,
      ledgerGroup: document.getElementById("ledgerGroupInput").value,
      mobile: document.getElementById("ledgerMobileInput").value.trim(),
      gstin: document.getElementById("ledgerGstinInput").value.trim(),
      openingBalance: parseFloat(document.getElementById("ledgerOpeningInput").value) || 0
    };
    try {
      const res = await fetch(`${API_URL}/api/ledgers`, { method: "POST", headers: khataHeaders(), body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Save fail hua");
      document.getElementById("ledgerNameInput").value = "";
      document.getElementById("ledgerMobileInput").value = "";
      document.getElementById("ledgerGstinInput").value = "";
      document.getElementById("ledgerOpeningInput").value = "";
      showToast("✅ Ledger '" + partyName + "' ban gaya!");
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
    if (!confirm("Yeh item delete karein?")) return;
    try {
      await fetch(`${API_URL}/api/items/${id}`, { method: "DELETE", headers: khataHeaders() });
      loadKhataItems();
    } catch (err) { alert("❌ " + err.message); }
  };

  document.getElementById("addItemBtn")?.addEventListener("click", async () => {
    const itemName = document.getElementById("itemNameInput").value.trim();
    if (!itemName) { alert("Item naam daalein."); return; }
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
  function updateVoucherFormUI() {
    const type = document.getElementById("voucherTypeInput")?.value || "Sales";
    const purchaseBox = document.getElementById("voucherPurchaseFields");
    const stockBox = document.getElementById("voucherStockFields");
    const secondaryWrap = document.getElementById("voucherSecondaryWrap");
    const partyLabel = document.getElementById("voucherPartyLabel");
    const rateLabel = document.getElementById("voucherRateLabel");
    const gstField = document.getElementById("voucherGstField");

    const isPurchase = type === "Purchase";
    const isSales = type === "Sales";
    const isStock = isPurchase || isSales;
    const isJournalContra = type === "Journal" || type === "Contra";

    purchaseBox?.classList.toggle("hidden", !isPurchase);
    stockBox?.classList.toggle("hidden", !isStock);
    secondaryWrap?.classList.toggle("hidden", !isJournalContra);
    gstField?.classList.toggle("hidden", !isStock);

    if (partyLabel) {
      partyLabel.textContent = isPurchase
        ? "Supplier / Party (Sundry Creditor) *"
        : isJournalContra
          ? "First Ledger *"
          : "Party / Ledger *";
    }
    if (rateLabel) {
      rateLabel.textContent = isPurchase ? "Purchase Rate ₹" : "Sale Rate ₹";
    }

    const dateInput = document.getElementById("voucherDateInput");
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().slice(0, 10);
    }
  }

  document.getElementById("voucherTypeInput")?.addEventListener("change", updateVoucherFormUI);

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
      const options = '<option value="">-- Select Party / Ledger --</option>' +
        data.ledgers.map(l => `<option value="${l._id}">${escapeHtml(l.partyName)} (${escapeHtml(l.ledgerGroup)})</option>`).join("");
      const partySel = document.getElementById("voucherPartyInput");
      const secSel = document.getElementById("voucherSecondaryInput");
      if (partySel) partySel.innerHTML = options;
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
    const paymentMode = document.getElementById("voucherPaymentModeInput")?.value || "";
    const voucherDate = document.getElementById("voucherDateInput")?.value || "";
    const statusText = document.getElementById("voucherStatusText");

    if (!partyId) { alert("Party / Ledger select karein."); return; }
    if (voucherType === "Purchase" && !supplierInvoiceNo) {
      alert("Purchase bill ke liye Supplier Invoice No. daalein."); return;
    }
    if ((voucherType === "Journal" || voucherType === "Contra") && !secondaryLedgerId) {
      alert("Journal/Contra ke liye doosra ledger bhi select karein."); return;
    }

    const items = [];
    if ((voucherType === "Sales" || voucherType === "Purchase") && itemId) {
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

    if (!amount || amount <= 0) { alert("Amount daalein (ya Item + Qty + Rate se auto calculate hone dein)."); return; }

    try {
      const res = await fetch(`${API_URL}/api/vouchers`, {
        method: "POST", headers: khataHeaders(),
        body: JSON.stringify({
          voucherType, partyId, secondaryLedgerId, amount, items, note,
          supplierInvoiceNo, supplierGstin, paymentMode, voucherDate
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Save fail hua");

      if (statusText) { statusText.textContent = "✅ " + data.message; statusText.style.color = "#22c55e"; }
      document.getElementById("voucherAmountInput").value = "";
      document.getElementById("voucherQtyInput").value = "";
      document.getElementById("voucherRateInput").value = "";
      document.getElementById("voucherNoteInput").value = "";
      if (voucherType === "Purchase") {
        document.getElementById("voucherBillNoInput").value = "";
        document.getElementById("voucherSupplierGstinInput").value = "";
      }
    } catch (err) {
      if (statusText) { statusText.textContent = "❌ " + err.message; statusText.style.color = "#ef4444"; }
    }
  });

  updateVoucherFormUI();

  window.refreshKhataVoucherPanel = () => {
    loadLedgerDropdowns();
    loadItemDropdown();
    updateVoucherFormUI();
  };

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
      showToast("⌛ Tally me voucher sync ho raha hai...");
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
  const salesPanel = document.getElementById("totalSalesPanel");
  if (!salesPanel) return;

  let currentPage = 1;
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
    label.textContent = `Filtered: ${fmt(currentFromDate)} se ${fmt(currentToDate)} tak`;
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
      body.innerHTML = "<tr><td colspan='8' style='text-align:center;'>Loading...</td></tr>";
    }
    try {
      const params = new URLSearchParams({ page: currentPage, limit: 15 });
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
          ? "Is filter me koi record nahi mila."
          : "Abhi koi sale record nahi hai.";
        body.innerHTML = `<tr><td colspan='8' style='text-align:center;'>${emptyMsg}</td></tr>`;
      } else {
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
          </tr>`).join("");
      }

      const info = document.getElementById("salesPaginationInfo");
      if (info) info.textContent = `Showing page ${data.page} of ${data.totalPages} (${data.total} total entries)`;
      const pageIndicator = document.getElementById("salesPageIndicator");
      if (pageIndicator) pageIndicator.textContent = String(data.page);
      if (typeof window.enhanceMobileTables === "function") {
        requestAnimationFrame(() => window.enhanceMobileTables(salesPanel));
      }
    } catch (err) {
      if (token !== salesLoadToken) return;
      if (err?.name === "AbortError") return;
      body.innerHTML = `<tr><td colspan='8' style='text-align:center;'>Error: ${err.message}</td></tr>`;
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

  document.querySelector('.tab-btn[data-tab="totalSalesPanel"]')?.addEventListener("click", () => {
    currentPage = 1;
    loadSalesHistory();
  });

  document.getElementById("salesApplyDateBtn")?.addEventListener("click", () => {
    const from = document.getElementById("salesFromDate")?.value || "";
    const to = document.getElementById("salesToDate")?.value || "";
    if (from && to && from > to) {
      if (typeof showToast === "function") showToast("From date, To date se pehle honi chahiye.", "error");
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

  document.getElementById("salesPrevBtn")?.addEventListener("click", () => {
    if (currentPage > 1) { currentPage--; loadSalesHistory(); }
  });
  document.getElementById("salesNextBtn")?.addEventListener("click", () => {
    if (currentPage < currentTotalPages) { currentPage++; loadSalesHistory(); }
  });
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
async function loadAgentToken() {
  const el = document.getElementById("agentTokenDisplay");
  if (!el) return;
  try {
    const res = await fetch(`${API_URL}/api/tally/agent-token`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const data = await res.json();
    if (data.success) {
      el.textContent = data.agentToken;
    } else {
      el.textContent = "Error — dobara try karein";
    }
  } catch (err) {
    el.textContent = "Load nahi ho paya";
  }
}

document.getElementById("copyAgentTokenBtn")?.addEventListener("click", () => {
  const el = document.getElementById("agentTokenDisplay");
  if (!el || !el.textContent || el.textContent === "Loading...") return;
  navigator.clipboard.writeText(el.textContent).then(() => {
    const btn = document.getElementById("copyAgentTokenBtn");
    const original = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => { btn.textContent = original; }, 1500);
  });
});

document.getElementById("regenerateAgentTokenBtn")?.addEventListener("click", async () => {
  if (!confirm("Naya token banayenge — purana token turant kaam karna band kar dega, aur Agent ko dobara pair karna hoga. Continue karein?")) return;
  try {
    const res = await fetch(`${API_URL}/api/tally/agent-token/regenerate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById("agentTokenDisplay").textContent = data.agentToken;
      alert("Naya token ban gaya! Apne Desktop Agent ke 'agent-config.json' mein isse update karein (ya file delete karke Agent dobara chalayein).");
    }
  } catch (err) {
    alert("Token reset karne mein dikkat aayi.");
  }
});

loadAgentToken();


function speakCardText(cardId, buttonElem) {
  const SUNO_LABEL = "🔊 Suno / सुनो";
  const RUKO_LABEL = "⏹️ Ruko / रुको";
  if (!('speechSynthesis' in window)) {
    alert("Aapka browser Text-to-Speech support nahi karta.");
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

  let cleanText = cardElement.querySelector('.card-text').innerText;
  cleanText = cleanText
    .replace(/हिंदी:/g, "हिंदी में:")
    .replace(/English:/gi, "")
    .replace(/•/g, "")
    .trim();

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'hi-IN';
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