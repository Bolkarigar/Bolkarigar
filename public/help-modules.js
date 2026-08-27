/**
 * BolKarigar — Help panel modules
 * Sirf wahi modules dikhte hain jo sidebar mein visible hain (bkCanAccessTab).
 */
(function () {
  const HELP_MODULE_CATALOG = [
    {
      id: "overviewPanel",
      panelId: "overviewPanel",
      plans: ["pro"],
      color: "#3b82f6",
      title: "📊 Overview (Dashboard / डैशबोर्ड)",
      hindi: "Yeh aapka AI Accountant dashboard hai. Total Sales, Expenses, Pending Udhar aur Net Profit ek nazar mein dikhte hain.",
      english: "Real-time business dashboard showing Total Sales, Expenses, Net Profit, and Outstanding Balance."
    },
    {
      id: "invoicePanel",
      panelId: "invoicePanel",
      plans: ["pro"],
      color: "#06b6d4",
      title: "📑 Invoice Generator (GST Bill / बिलिंग)",
      hindi: "GST bill banayein, PDF download karein, WhatsApp share karein. Customer, product, HSN, qty aur GST slab (0%-28%) daal kar Add Item dabayein.",
      english: "Create GST invoices, download PDF, share via WhatsApp. Add items with HSN, quantity and tax slabs."
    },
    {
      id: "inventoryPanel",
      panelId: "inventoryPanel",
      plans: ["pro"],
      color: "#10b981",
      title: "📦 Inventory (Stock / स्टॉक)",
      hindi: "Dukaan ya godam mein kitna saman bacha hai, unit price aur total stock value track karein. Low stock alert bhi milta hai.",
      english: "Track product stock quantities, unit prices, and total inventory value with low-stock alerts."
    },
    {
      id: "totalSalesPanel",
      panelId: "totalSalesPanel",
      plans: ["pro"],
      color: "#0ea5e9",
      title: "📊 Total Sales (Bikri Report / कुल बिक्री)",
      hindi: "Saari sales ki list, date-wise filter, customer/product search aur total revenue summary yahan dekhein.",
      english: "View all sales records with date filters, search, and revenue summaries."
    },
    {
      id: "ledgerPanel",
      panelId: "ledgerPanel",
      plans: ["pro"],
      color: "#ef4444",
      title: "📖 Udhar Khata (ग्राहक उधार)",
      hindi: "Kis customer ke paas kitna paisa pending hai, payment record karein aur poori udhar history dekhein.",
      english: "Customer credit ledger — pending amounts, payment recording, and full transaction history."
    },
    {
      id: "khataLedgersPanel",
      panelId: "khataLedgersPanel",
      plans: ["pro"],
      color: "#f59e0b",
      title: "📒 Ledgers (खाता बही / Party Ledger)",
      hindi: "Har party/customer/supplier ka alag ledger account — opening balance, debit-credit entries aur closing balance.",
      english: "Party-wise ledger accounts with opening balance, entries, and closing balance."
    },
    {
      id: "khataItemsPanel",
      panelId: "khataItemsPanel",
      plans: ["pro"],
      color: "#84cc16",
      title: "📦 Stock Items (सामान की सूची)",
      hindi: "Khata ke liye stock items add karein — item name, rate, GST, unit aur opening qty set karein.",
      english: "Manage stock items for Khata — name, rate, GST, unit, and opening quantity."
    },
    {
      id: "khataVoucherPanel",
      panelId: "khataVoucherPanel",
      plans: ["pro"],
      color: "#a855f7",
      title: "🧾 New Voucher (वाउचर / Purchase-Sales Entry)",
      hindi: "Sales, Purchase, Receipt, Payment aur Journal voucher banayein. Purchase mein supplier invoice, GSTIN aur payment mode bhi hai.",
      english: "Create Sales, Purchase, Receipt, Payment and Journal vouchers with GST purchase fields."
    },
    {
      id: "khataDaybookPanel",
      panelId: "khataDaybookPanel",
      plans: ["pro"],
      color: "#6366f1",
      title: "📅 Day Book (दैनिक लेनदेन)",
      hindi: "Aaj ke saare vouchers aur transactions ek jagah — date filter se kisi bhi din ka hisaab dekhein.",
      english: "Daily transaction register — all vouchers for a selected date in one view."
    },
    {
      id: "galleryPanel",
      panelId: "galleryPanel",
      plans: ["pro"],
      color: "#ec4899",
      title: "🖼️ Gallery (Portfolio / कैटलॉग)",
      hindi: "Apne kaam ki photos, furniture design ya product catalog customers ko dikhane ke liye upload karein.",
      english: "Digital portfolio to showcase work photos and product catalogs to clients."
    },
    {
      id: "todoPanel",
      panelId: "todoPanel",
      plans: ["pro"],
      color: "#8b5cf6",
      title: "✅ Todo (Task Manager / काम की लिस्ट)",
      hindi: "Aaj ke zaroori kaam, site reminders ya workers ko diye tasks ki list banao aur complete mark karein.",
      english: "Daily task checklists, site reminders, and work-assignment lists."
    },
    {
      id: "myPlanPanel",
      panelId: "myPlanPanel",
      plans: ["pro"],
      ownerOnly: true,
      color: "#22c55e",
      title: "💳 My Plan (Subscription / प्लान)",
      hindi: "Apna Pro ya Business plan dekhein, trial days bache hain ya nahi, aur Razorpay se upgrade/renew karein.",
      english: "View subscription status, trial days left, and upgrade or renew via Razorpay."
    },
  ];

  const BUSINESS_ONLY_MODULES = [
    {
      id: "voicePanel",
      panelId: "voicePanel",
      plans: ["business"],
      color: "#a855f7",
      title: "🎤 Voice AI (बोलकर चलाएं)",
      hindi: "Top bar se Voice ON karke bina type kiye app control karein — jaise 'Invoice kholo', 'Udhar Khata kholo', 'Dark mode on'.",
      english: "Control the app with speech commands like Open Invoice, Open Udhar Khata, or Dark Mode On."
    },
    {
      id: "projectPanel",
      panelId: "projectPanel",
      plans: ["business"],
      color: "#eab308",
      title: "📁 Projects (साइट / ठेकेदारी)",
      hindi: "Alag-alag client sites, location, budget aur daily material/labor kharcha alag track karein.",
      english: "Manage client site projects, budgets, and daily vendor or material expenses."
    },
    {
      id: "contractorPanel",
      panelId: "contractorPanel",
      plans: ["business"],
      color: "#d97706",
      title: "👷 Contractor (ठेकेदार / मजदूर)",
      hindi: "Contractors aur mazdooron ka record, payment, kaam ki details aur site-wise assignment manage karein.",
      english: "Manage contractors, labor payments, work details, and site-wise assignments."
    },
    {
      id: "payrollPanel",
      panelId: "payrollPanel",
      plans: ["business"],
      hideForStaff: true,
      color: "#7c3aed",
      title: "💼 Staff Payroll & Hajri (वेतन / हाजरी)",
      hindi: "Dukaan staff ki daily hajri mark karein — Present, Half-day, Paid/Unpaid leave. Month-end par salary auto calculate, advance minus, salary slip print/WhatsApp.",
      english: "Mark daily staff attendance, auto-calculate monthly salary with leaves and advances, print payslips."
    },
    {
      id: "payrollSelfPanel",
      panelId: "payrollPanel",
      plans: ["business"],
      staffOnly: true,
      color: "#7c3aed",
      title: "📅 Meri Hajri (मेरी हाजरी)",
      hindi: "Apni daily attendance yahan mark karein — Present, Half-day, Paid Leave, Unpaid Leave ya Absent. Month-end par owner salary calculate karega.",
      english: "Mark your own daily attendance — present, half-day, leave, or absent. Owner calculates salary at month-end."
    },
    {
      id: "reportsProPanel",
      panelId: "reportsProPanel",
      plans: ["business"],
      color: "#0284c7",
      title: "📈 Reports Pro (GSTR / CA Reports)",
      hindi: "Advanced GST reports, GSTR summary, sales-purchase analysis aur CA ke liye export-ready reports.",
      english: "Advanced GST reports, GSTR summaries, and CA-ready export reports."
    },
    {
      id: "bankReconPanel",
      panelId: "bankReconPanel",
      plans: ["business"],
      color: "#0891b2",
      title: "🏦 Bank Reconciliation (बैंक मिलान)",
      hindi: "Bank statement aur app entries match karein — pending cheques aur difference track karein.",
      english: "Reconcile bank statements with app entries and track pending cheques."
    },
    {
      id: "qrPanel",
      panelId: "qrPanel",
      plans: ["business"],
      color: "#f97316",
      title: "📱 QR Tool (UPI QR / पेमेंट QR)",
      hindi: "Apni UPI ID ka instant QR code banayein aur customer ko dikha kar turant payment lein.",
      english: "Generate UPI payment QR codes or custom link QR codes for instant collections."
    },
    {
      id: "calcPanel",
      panelId: "calcPanel",
      plans: ["business"],
      color: "#14b8a6",
      title: "🔢 Calculator (हिसाब)",
      hindi: "Site par turant ganitiya hisaab ke liye built-in calculator — bina phone calculator ke.",
      english: "On-site financial calculator for quick estimations."
    },
    {
      id: "converterPanel",
      panelId: "converterPanel",
      plans: ["business"],
      color: "#2dd4bf",
      title: "🔄 Unit Converter (नाप-तौल)",
      hindi: "Feet-inch, kg, temperature aur doosre units convert karein — lakdi/steel measurement ke liye.",
      english: "Convert length, weight, temperature and other units for quick estimations."
    },
    {
      id: "notesPanel",
      panelId: "notesPanel",
      plans: ["business"],
      color: "#64748b",
      title: "📝 Notes (नोट्स सेवर)",
      hindi: "Site ki baatein, rate list ya quick reminders likh kar save/download karein.",
      english: "Save quick text notes, site reminders, and rate lists."
    },
    {
      id: "mediaPanel",
      panelId: "mediaPanel",
      plans: ["business"],
      color: "#475569",
      title: "📷 Media (Receipt Scanner / पर्ची स्कैन)",
      hindi: "Kharide saman ki receipt ya parchi ki photo scan/upload karke safe rakhein.",
      english: "Scan and store material purchase receipt images securely."
    },
    {
      id: "staffPanel",
      panelId: "staffPanel",
      plans: ["business"],
      color: "#7c3aed",
      title: "👥 Staff (कर्मचारी / Cashier)",
      hindi: "Staff, Manager ya Cashier invite code banao — unhe limited access do, alag plan ki zaroorat nahi.",
      english: "Invite staff, managers, or cashiers with role-based limited access."
    },
    {
      id: "companiesPanel",
      panelId: "companiesPanel",
      plans: ["business"],
      color: "#1d4ed8",
      title: "🏢 Companies (कई फर्म / Multi-Company)",
      hindi: "Ek se zyada companies/firms manage karein — alag GSTIN aur profile har company ke liye.",
      english: "Manage multiple companies with separate GSTIN and business profiles."
    },
    {
      id: "tallySync",
      panelId: null,
      plans: ["business"],
      color: "#16a34a",
      title: "🔗 Tally Sync (Tally Prime कनेक्ट)",
      hindi: "Desktop Agent download karein, Tally Prime me HTTP Server ON karein, phir invoice se Sync to Tally dabayein — sales voucher seedha Tally mein.",
      english: "Connect Tally Prime via Desktop Agent and sync sales vouchers from Invoice with one click."
    }
  ];

  const ALL_MODULES = [...HELP_MODULE_CATALOG, ...BUSINESS_ONLY_MODULES];

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

  function renderHelpModules(me) {
    const container = document.getElementById("helpModulesList");
    const badge = document.getElementById("helpPlanBadge");
    if (!container) return;

    const sub = me?.subscription || {};
    const isBusiness = !!sub.fullAccess;
    const modules = ALL_MODULES.filter((m) => moduleVisibleForUser(m, me));

    if (badge) {
      const isBusiness = !!sub.fullAccess;
      const isStaffRole = me?.isStaff && me?.role === "staff";
      let planLabel = isBusiness ? "Business Plan (₹699)" : "Pro Plan (₹349)";
      if (isStaffRole) planLabel = "Staff Mode";
      badge.textContent = `${isBusiness ? "🏢" : isStaffRole ? "👤" : "⭐"} ${planLabel} — ${modules.length} modules (sidebar jaisa)`;
      badge.className = isBusiness ? "help-plan-badge business" : "help-plan-badge pro";
    }

    container.innerHTML = modules.map((mod, idx) => {
      const cardId = `help-card-${mod.id}`;
      const num = idx + 1;
      return `
        <div class="manual-card mini-card help-module-card" id="${cardId}" data-panel="${mod.panelId || ""}" style="border-left: 4px solid ${mod.color};">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
            <h4 style="color: ${mod.color}; margin: 0;">${num}. ${escapeHtml(mod.title)}</h4>
            <div style="display:flex;gap:8px;align-items:center;">
              ${mod.panelId ? `<button type="button" class="secondary help-open-tab-btn" data-open-tab="${mod.panelId}" style="padding:4px 10px;font-size:12px;">↗ Open / खोलें</button>` : ""}
              <button type="button" class="speak-card-btn" onclick="speakCardText('${cardId}', this)">🔊 Suno / सुनो</button>
            </div>
          </div>
          <div class="card-text">
            <p style="margin-bottom: 5px;"><b>हिंदी:</b> ${escapeHtml(mod.hindi)}</p>
            <p><b>English:</b> ${escapeHtml(mod.english)}</p>
          </div>
        </div>`;
    }).join("");

    container.querySelectorAll(".help-open-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.openTab;
        if (tab && typeof window.openPanel === "function") window.openPanel(tab);
      });
    });
  }

  function escapeHtml(value) {
    if (value == null) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  window.HELP_MODULE_CATALOG = ALL_MODULES;
  window.renderHelpModules = renderHelpModules;

  document.addEventListener('bk:langchange', () => {
    if (window._bkAccountInfo) renderHelpModules(window._bkAccountInfo);
  });
})();
