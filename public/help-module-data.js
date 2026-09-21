/**
 * BolKarigar — Help module catalog (Hindi + English + animated demo steps)
 */
(function () {
  const PRO_MODULES = [
    {
      id: "overviewPanel", panelId: "overviewPanel", plans: ["pro"], color: "#3b82f6",
      title: "📊 Overview (Dashboard)",
      hindi: "Dashboard shows today's sales, expenses, credit due, and profit. Use Business Records tabs for Sales, Purchase, Payment, Receipt and Customer Detail.",
      english: "Dashboard shows today's sales, expenses, credit due, and profit. Use Business Records tabs for Sales, Purchase, Payment, Receipt and Customer Detail.",
      steps: [
        { en: "Open Overview — see KPI cards (Sales, Expense, Credit, Profit)", hi: "Open Overview — see KPI cards (Sales, Expense, Credit, Profit)", visual: { title: "📊 Dashboard", list: ["Sales Today: ₹24,500", "Credit Due: ₹8,200", "Profit: ₹6,100"] } },
        { en: "Switch tabs: Sales / Purchase / Payment / Receipt lists", hi: "Switch tabs: Sales / Purchase / Payment / Receipt lists", visual: { title: "📋 Business Records", lines: [{ label: "Tab", value: "Sales ▾", animate: true }, { label: "Filter", value: "This Month" }], action: "View Records" } },
        { en: "Use date filter for any day or month report", hi: "Use date filter for any day or month report", visual: { title: "📅 Date Filter", lines: [{ label: "From", value: "01-Sep-2026" }, { label: "To", value: "14-Sep-2026" }], action: "Apply Filter" } },
        { en: "Customer Detail — full account with pending credit", hi: "Customer Detail — full account with pending credit", visual: { title: "👤 Customer Detail", lines: [{ label: "Customer", value: "Ramesh Traders" }, { label: "Pending", value: "₹4,500" }], action: "Open Ledger" } }
      ]
    },
    {
      id: "invoicePanel", panelId: "invoicePanel", plans: ["pro"], color: "#06b6d4",
      title: "📑 Invoice (GST Bill)",
      hindi: "Create GST invoices with customer, product, HSN, quantity and tax slabs. Download PDF or share on WhatsApp. Stock updates automatically.",
      english: "Create GST invoices with customer, product, HSN, quantity and tax slabs. Download PDF or share on WhatsApp. Stock updates automatically.",
      steps: [
        { en: "Enter customer name, mobile and billing address", hi: "Enter customer name, mobile and billing address", visual: { title: "🧾 New Invoice", lines: [{ label: "Customer", value: "Ramesh Kumar", animate: true }, { label: "Mobile", value: "98765xxxxx" }] } },
        { en: "Add items — product, rate, qty, GST%", hi: "Add items — product, rate, qty, GST%", visual: { title: "➕ Add Item", lines: [{ label: "Product", value: "Plywood 18mm" }, { label: "Qty", value: "5" }, { label: "GST", value: "18%" }], action: "Add Item" } },
        { en: "Review total, tax breakup and save invoice", hi: "Review total, tax breakup and save invoice", visual: { title: "💰 Invoice Total", lines: [{ label: "Taxable", value: "₹10,000" }, { label: "GST", value: "₹1,800" }, { label: "Grand Total", value: "₹11,800" }], action: "Save Invoice" } },
        { en: "Download PDF or share bill on WhatsApp", hi: "Download PDF or share bill on WhatsApp", visual: { title: "📤 Share", lines: [{ label: "Invoice No", value: "INV-0042" }], action: "WhatsApp Share" } }
      ]
    },
    {
      id: "purchasePanel", panelId: "purchasePanel", plans: ["pro"], color: "#0ea5e9",
      title: "📥 Purchase Bill",
      hindi: "Record purchase bills from suppliers. Enter supplier invoice number, GSTIN and items to increase stock.",
      english: "Record purchase bills from suppliers. Enter supplier invoice number, GSTIN and items to increase stock.",
      steps: [
        { en: "Select or add supplier / party name", hi: "Select or add supplier / party name", visual: { title: "📥 Purchase", lines: [{ label: "Supplier", value: "Sharma Ply", animate: true }] } },
        { en: "Enter supplier invoice no. (required) and date", hi: "Enter supplier invoice no. (required) and date", visual: { title: "📄 Supplier Bill", lines: [{ label: "Inv No", value: "SP-8821", animate: true }, { label: "Date", value: "14-Sep-2026" }] } },
        { en: "Add purchased items with rate and qty", hi: "Add purchased items with rate and qty", visual: { title: "📦 Items", lines: [{ label: "Item", value: "Laminates" }, { label: "Qty", value: "+20" }], action: "Add Row" } },
        { en: "Save — stock increases automatically", hi: "Save — stock increases automatically", visual: { title: "✅ Saved", list: ["Purchase recorded", "Stock +20 Laminates", "Payable updated"] } }
      ]
    },
    {
      id: "paymentVoucherPanel", panelId: "paymentVoucherPanel", plans: ["pro"], color: "#f43f5e",
      title: "💸 Payment Voucher",
      hindi: "Record money paid to supplier or party — amount and payment mode (Cash/UPI/Bank). Creates a payment voucher.",
      english: "Record money paid to supplier or party — amount and payment mode (Cash/UPI/Bank). Creates a payment voucher.",
      steps: [
        { en: "Choose party / supplier you paid", hi: "Choose party / supplier you paid", visual: { title: "💸 Payment", lines: [{ label: "Party", value: "Sharma Ply", animate: true }] } },
        { en: "Enter amount and payment mode", hi: "Enter amount and payment mode", visual: { title: "💰 Amount", lines: [{ label: "Amount", value: "₹15,000", animate: true }, { label: "Mode", value: "UPI" }] } },
        { en: "Add note (optional) and save", hi: "Add note (optional) and save", visual: { title: "📝 Note", lines: [{ label: "Ref", value: "Bill SP-8821" }] } },
        { en: "Ledger and Day Book update automatically", hi: "Ledger and Day Book update automatically", visual: { title: "✅ Done", list: ["Payment voucher created", "Supplier balance reduced", "Day Book entry added"] } }
      ]
    },
    {
      id: "receiptVoucherPanel", panelId: "receiptVoucherPanel", plans: ["pro"], color: "#22c55e",
      title: "💰 Receipt Voucher",
      hindi: "Record money received from customer. Reduces pending credit in the ledger.",
      english: "Record money received from customer. Reduces pending credit in the ledger.",
      steps: [
        { en: "Select customer who paid you", hi: "Select customer who paid you", visual: { title: "💰 Receipt", lines: [{ label: "Customer", value: "Ramesh Traders", animate: true }] } },
        { en: "Enter received amount and mode", hi: "Enter received amount and mode", visual: { title: "💵 Amount", lines: [{ label: "Amount", value: "₹5,000", animate: true }, { label: "Mode", value: "Cash" }] } },
        { en: "Save receipt voucher", hi: "Save receipt voucher", visual: { title: "🧾 Voucher", lines: [{ label: "Voucher", value: "RCP-015" }], action: "Save Receipt" } },
        { en: "Customer pending credit reduces", hi: "Customer pending credit reduces", visual: { title: "📖 Credit Updated", lines: [{ label: "Before", value: "₹9,500" }, { label: "After", value: "₹4,500" }] } }
      ]
    },
    {
      id: "inventoryPanel", panelId: "inventoryPanel", plans: ["pro"], color: "#10b981",
      title: "📦 Inventory (Stock)",
      hindi: "Track shop/warehouse stock — quantity, rate and value. Auto-updates from invoices/purchases with low-stock alerts.",
      english: "Track shop/warehouse stock — quantity, rate and value. Auto-updates from invoices/purchases with low-stock alerts.",
      steps: [
        { en: "View all items with current stock qty", hi: "View all items with current stock qty", visual: { title: "📦 Stock List", list: ["Plywood 18mm — 45 pcs", "Hinges — 8 pcs ⚠️", "Laminates — 120 sqft"] } },
        { en: "Red/low stock items need reorder", hi: "Red/low stock items need reorder", visual: { title: "⚠️ Low Stock", lines: [{ label: "Item", value: "Hinges" }, { label: "Qty Left", value: "8 (min 20)" }], action: "Reorder Alert" } },
        { en: "Manual adjust: + stock in, − stock out", hi: "Manual adjust: + stock in, − stock out", visual: { title: "± Adjust", lines: [{ label: "Change", value: "+10", animate: true }, { label: "Reason", value: "Physical count" }], action: "Update Stock" } },
        { en: "Total inventory value shown at top", hi: "Total inventory value shown at top", visual: { title: "💎 Value", lines: [{ label: "Total Stock Value", value: "₹3,42,000" }] } }
      ]
    },
    {
      id: "ledgerPanel", panelId: "ledgerPanel", plans: ["pro"], color: "#ef4444",
      title: "📖 Credit Ledger (Udhar)",
      hindi: "Track customer credit (udhar), record payments and view full history.",
      english: "Track customer credit (udhar), record payments and view full history.",
      steps: [
        { en: "See list of customers with pending credit", hi: "See list of customers with pending credit", visual: { title: "📖 Udhar List", list: ["Ramesh — ₹4,500", "Suresh — ₹2,100", "Amit — ₹0 ✅"] } },
        { en: "Tap customer for full transaction history", hi: "Tap customer for full transaction history", visual: { title: "👤 Ramesh Traders", lines: [{ label: "Sale", value: "+₹11,800" }, { label: "Receipt", value: "−₹5,000" }] } },
        { en: "Record payment received from customer", hi: "Record payment received from customer", visual: { title: "💰 Record Pay", lines: [{ label: "Amount", value: "₹2,000", animate: true }], action: "Save Payment" } },
        { en: "Pending balance updates instantly", hi: "Pending balance updates instantly", visual: { title: "✅ Updated", lines: [{ label: "Pending Now", value: "₹2,500" }] } }
      ]
    },
    {
      id: "khataLedgersPanel", panelId: "khataLedgersPanel", plans: ["pro"], color: "#f59e0b",
      title: "📒 Ledgers (Party Accounts)",
      hindi: "Party-wise ledger accounts with opening balance, entries and closing balance.",
      english: "Party-wise ledger accounts with opening balance, entries and closing balance.",
      steps: [
        { en: "Create ledger for customer/supplier/bank", hi: "Create ledger for customer/supplier/bank", visual: { title: "📒 New Ledger", lines: [{ label: "Name", value: "HDFC Bank", animate: true }, { label: "Type", value: "Bank" }] } },
        { en: "Set opening balance (Dr or Cr)", hi: "Set opening balance (Dr or Cr)", visual: { title: "⚖️ Opening", lines: [{ label: "Opening", value: "₹50,000 Dr" }] } },
        { en: "All vouchers post entries here automatically", hi: "All vouchers post entries here automatically", visual: { title: "📋 Entries", list: ["Sale INV-0042 — Cr", "Receipt RCP-015 — Dr"] } },
        { en: "View closing balance anytime", hi: "View closing balance anytime", visual: { title: "✅ Closing", lines: [{ label: "Closing Balance", value: "₹62,300 Dr" }] } }
      ]
    },
    {
      id: "khataItemsPanel", panelId: "khataItemsPanel", plans: ["pro"], color: "#84cc16",
      title: "📦 Stock Items (Khata)",
      hindi: "Khata stock items — name, rate, GST, unit and opening qty for use in vouchers.",
      english: "Khata stock items — name, rate, GST, unit and opening qty for use in vouchers.",
      steps: [
        { en: "Add item name, unit and sale rate", hi: "Add item name, unit and sale rate", visual: { title: "📦 New Item", lines: [{ label: "Item", value: "Teak Wood", animate: true }, { label: "Unit", value: "CFT" }] } },
        { en: "Set GST% and HSN if applicable", hi: "Set GST% and HSN if applicable", visual: { title: "🏷️ GST", lines: [{ label: "GST", value: "18%" }, { label: "HSN", value: "4407" }] } },
        { en: "Opening qty for existing stock", hi: "Opening qty for existing stock", visual: { title: "📊 Opening", lines: [{ label: "Opening Qty", value: "120", animate: true }] } },
        { en: "Item ready for Sales/Purchase vouchers", hi: "Item ready for Sales/Purchase vouchers", visual: { title: "✅ Ready", action: "Use in Voucher" } }
      ]
    },
    {
      id: "khataVoucherPanel", panelId: "khataVoucherPanel", plans: ["pro"], color: "#a855f7",
      title: "🧾 New Voucher",
      hindi: "Create Sales, Purchase, Receipt, Payment, Journal, Contra and Debit/Credit Note vouchers.",
      english: "Create Sales, Purchase, Receipt, Payment, Journal, Contra and Debit/Credit Note vouchers.",
      steps: [
        { en: "Pick voucher type from dropdown", hi: "Pick voucher type from dropdown", visual: { title: "🧾 Voucher Type", lines: [{ label: "Type", value: "Sales ▾", animate: true }] } },
        { en: "Fill party, items/accounts, amounts", hi: "Fill party, items/accounts, amounts", visual: { title: "📝 Details", lines: [{ label: "Party", value: "Ramesh" }, { label: "Amount", value: "₹11,800" }] } },
        { en: "Journal: dual Debit/Credit boxes must balance", hi: "Journal: dual Debit/Credit boxes must balance", visual: { title: "📒 Journal", lines: [{ label: "Debit", value: "₹5,000" }, { label: "Credit", value: "₹5,000 ✅" }] } },
        { en: "Save — appears in Day Book & Ledgers", hi: "Save — appears in Day Book & Ledgers", visual: { title: "✅ Posted", list: ["Voucher saved", "Ledgers updated", "Day Book entry"] } }
      ]
    },
    {
      id: "khataDaybookPanel", panelId: "khataDaybookPanel", plans: ["pro"], color: "#6366f1",
      title: "📅 Day Book",
      hindi: "All vouchers for a day in one register — filter by any date.",
      english: "All vouchers for a day in one register — filter by any date.",
      steps: [
        { en: "Select date to view that day's entries", hi: "Select date to view that day's entries", visual: { title: "📅 Day Book", lines: [{ label: "Date", value: "14-Sep-2026", animate: true }] } },
        { en: "See all Sales, Purchase, Receipt, Payment", hi: "See all Sales, Purchase, Receipt, Payment", visual: { title: "📋 Entries", list: ["Sales INV-0042 — ₹11,800", "Receipt RCP-015 — ₹5,000", "Payment PAY-008 — ₹15,000"] } },
        { en: "Search voucher number if needed", hi: "Search voucher number if needed", visual: { title: "🔍 Search", lines: [{ label: "Search", value: "INV-0042", animate: true }] } },
        { en: "Daily total debit/credit summary", hi: "Daily total debit/credit summary", visual: { title: "📊 Summary", lines: [{ label: "Total In", value: "₹16,800" }, { label: "Total Out", value: "₹15,000" }] } }
      ]
    },
    {
      id: "modifyPanel", panelId: "modifyPanel", plans: ["pro"], color: "#eab308",
      title: "✏️ Modification (Edit Vouchers)",
      hindi: "Wrong entry? Choose type, search voucher, edit and save — Tally/Busy style modification.",
      english: "Wrong entry? Choose type, search voucher, edit and save — Tally/Busy style modification.",
      steps: [
        { en: "Select what to edit: Ledger / Sales / Voucher", hi: "Select what to edit: Ledger / Sales / Voucher", visual: { title: "✏️ Modify", lines: [{ label: "Type", value: "Voucher ▾", animate: true }] } },
        { en: "Search by number or name", hi: "Search by number or name", visual: { title: "🔍 Search", lines: [{ label: "Find", value: "INV-0042", animate: true }], action: "Search" } },
        { en: "Edit fields and save changes", hi: "Edit fields and save changes", visual: { title: "📝 Edit", lines: [{ label: "Qty", value: "5 → 6" }], action: "Save Changes" } },
        { en: "Stock and ledgers recalculate", hi: "Stock and ledgers recalculate", visual: { title: "✅ Updated", list: ["Record modified", "Stock adjusted", "Ledger corrected"] } }
      ]
    },
    {
      id: "galleryPanel", panelId: "galleryPanel", plans: ["pro"], color: "#ec4899",
      title: "🖼️ Gallery",
      hindi: "Upload work photos, designs or product catalog to show customers.",
      english: "Upload work photos, designs or product catalog to show customers.",
      steps: [
        { en: "Click upload and choose photos from device", hi: "Click upload and choose photos from device", visual: { title: "🖼️ Gallery", action: "📷 Upload Photo" } },
        { en: "Add title/category for each image", hi: "Add title/category for each image", visual: { title: "🏷️ Details", lines: [{ label: "Title", value: "Modular Kitchen", animate: true }] } },
        { en: "Browse grid of all portfolio images", hi: "Browse grid of all portfolio images", visual: { title: "Grid View", list: ["Kitchen design", "Wardrobe", "Office furniture"] } },
        { en: "Delete old photos when not needed", hi: "Delete old photos when not needed", visual: { title: "🗑️ Manage", action: "Delete Photo" } }
      ]
    },
    {
      id: "todoPanel", panelId: "todoPanel", plans: ["pro"], color: "#8b5cf6",
      title: "✅ Todo (Tasks)",
      hindi: "Daily tasks, site reminders and work assignments — check off when done.",
      english: "Daily tasks, site reminders and work assignments — check off when done.",
      steps: [
        { en: "Add new task with title", hi: "Add new task with title", visual: { title: "✅ Todo", lines: [{ label: "Task", value: "Deliver plywood to site", animate: true }], action: "Add Task" } },
        { en: "Mark complete with checkbox", hi: "Mark complete with checkbox", visual: { title: "Done", list: ["✅ Deliver plywood", "⬜ Call supplier", "⬜ GST filing"] } },
        { en: "Delete finished or old tasks", hi: "Delete finished or old tasks", visual: { title: "🗑️ Clean", action: "Remove Done" } },
        { en: "Use for daily shop/site checklist", hi: "Use for daily shop/site checklist", visual: { title: "📋 Today", lines: [{ label: "Pending", value: "2 tasks" }] } }
      ]
    },
    {
      id: "businessCardPanel", panelId: "businessCardPanel", plans: ["pro"], color: "#3b82f6",
      title: "💼 Business Card",
      hindi: "12 free + 25 premium digital cards — fill details, download PNG or share on WhatsApp.",
      english: "12 free + 25 premium digital cards — fill details, download PNG or share on WhatsApp.",
      steps: [
        { en: "Fill shop name, owner, mobile, GST", hi: "Fill shop name, owner, mobile, GST", visual: { title: "💼 Card Details", lines: [{ label: "Shop", value: "Sharma Ply", animate: true }, { label: "Mobile", value: "98765xxxxx" }] } },
        { en: "Pick free template (12 designs)", hi: "Pick free template (12 designs)", visual: { title: "🆓 Free Templates", action: "Choose Template" } },
        { en: "Business plan unlocks 30 luxury designs", hi: "Business plan unlocks 30 luxury designs", visual: { title: "👑 Premium", action: "Upgrade for Premium" } },
        { en: "Download PNG or share on WhatsApp", hi: "Download PNG or share on WhatsApp", visual: { title: "📤 Share", action: "Download / WhatsApp" } }
      ]
    },
    {
      id: "securityPanel", panelId: "securityPanel", plans: ["pro"], color: "#64748b",
      title: "🔐 Security (App Lock)",
      hindi: "Lock app with PIN so others cannot see your data. Change PIN or turn lock off.",
      english: "Lock app with PIN so others cannot see your data. Change PIN or turn lock off.",
      steps: [
        { en: "Turn ON App Lock and set 4-digit PIN", hi: "Turn ON App Lock and set 4-digit PIN", visual: { title: "🔐 App Lock", lines: [{ label: "PIN", value: "••••", animate: true }], action: "Save PIN" } },
        { en: "PIN required each time app opens", hi: "PIN required each time app opens", visual: { title: "🔒 Locked", action: "Enter PIN to Unlock" } },
        { en: "Change PIN from Security panel", hi: "Change PIN from Security panel", visual: { title: "🔄 Change PIN", action: "Update PIN" } },
        { en: "Turn OFF lock if not needed", hi: "Turn OFF lock if not needed", visual: { title: "Off", lines: [{ label: "App Lock", value: "Disabled" }] } }
      ]
    },
    {
      id: "myPlanPanel", panelId: "myPlanPanel", plans: ["pro"], ownerOnly: true, color: "#22c55e",
      title: "💳 My Plan (Subscription)",
      hindi: "View Pro/Business plan, trial days left, renew or upgrade via Razorpay with Monthly/Yearly toggle.",
      english: "View Pro/Business plan, trial days left, renew or upgrade via Razorpay with Monthly/Yearly toggle.",
      steps: [
        { en: "See current plan, trial or paid status", hi: "See current plan, trial or paid status", visual: { title: "💳 My Plan", lines: [{ label: "Plan", value: "Pro Shop Trial" }, { label: "Days Left", value: "22 days" }] } },
        { en: "Toggle Monthly / Yearly pricing", hi: "Toggle Monthly / Yearly pricing", visual: { title: "🔄 Billing", lines: [{ label: "Pro", value: "₹99/mo or ₹999/yr" }, { label: "Business", value: "₹299/mo or ₹2999/yr" }] } },
        { en: "Pay via Razorpay — UPI / Card / Netbanking", hi: "Pay via Razorpay — UPI / Card / Netbanking", visual: { title: "💳 Pay", action: "Pay — Pro / Business" } },
        { en: "Staff do NOT need separate plan", hi: "Staff do NOT need separate plan", visual: { title: "👥 Staff", list: ["Owner buys once", "Staff use invite code", "No extra payment"] } }
      ]
    }
  ];

  const BUSINESS_MODULES = [
    {
      id: "voicePanel", panelId: "voicePanel", plans: ["business"], color: "#a855f7",
      title: "🎤 Voice AI",
      hindi: "Turn Voice ON from top bar and control app by speech — Open Invoice, Open Credit Ledger, Dark mode on.",
      english: "Turn Voice ON from top bar and control app by speech — Open Invoice, Open Credit Ledger, Dark mode on.",
      steps: [
        { en: "Tap Voice ON button in top bar", hi: "Tap Voice ON button in top bar", visual: { title: "🎤 Voice", action: "Voice ON" } },
        { en: "Speak clearly in Hindi or English", hi: "Speak clearly in Hindi or English", visual: { title: "🗣️ Say", lines: [{ label: "You", value: "Open invoice", animate: true }] } },
        { en: "App opens the correct panel", hi: "App opens the correct panel", visual: { title: "✅ Action", action: "Opening Invoice…" } },
        { en: "Works for navigation, todos, and queries", hi: "Works for navigation, todos, and queries", visual: { title: "Examples", list: ["Open credit ledger", "Add a todo", "Dark mode on"] } }
      ]
    },
    {
      id: "projectPanel", panelId: "projectPanel", plans: ["business"], color: "#eab308",
      title: "📁 Projects (Sites)",
      hindi: "Track client sites separately — location, budget, status and daily expenses.",
      english: "Track client sites separately — location, budget, status and daily expenses.",
      steps: [
        { en: "Create project with name, customer, site", hi: "Create project with name, customer, site", visual: { title: "📁 New Project", lines: [{ label: "Project", value: "Modular Kitchen", animate: true }, { label: "Site", value: "Sector 14" }] } },
        { en: "Set budget and status (Planning/Running/Done)", hi: "Set budget and status (Planning/Running/Done)", visual: { title: "💰 Budget", lines: [{ label: "Budget", value: "₹2,50,000" }, { label: "Status", value: "Running" }] } },
        { en: "Add daily material or labor expenses", hi: "Add daily material or labor expenses", visual: { title: "📝 Expense", lines: [{ label: "Today", value: "₹8,500" }], action: "Add Expense" } },
        { en: "Compare spent vs budget", hi: "Compare spent vs budget", visual: { title: "📊 Progress", lines: [{ label: "Spent", value: "₹1,20,000 / ₹2,50,000" }] } }
      ]
    },
    {
      id: "contractorPanel", panelId: "contractorPanel", plans: ["business"], color: "#d97706",
      title: "👷 Contractor (Labor)",
      hindi: "Manage contractors, labor payments, work details and site assignments.",
      english: "Manage contractors, labor payments, work details and site assignments.",
      steps: [
        { en: "Add contractor name and skill type", hi: "Add contractor name and skill type", visual: { title: "👷 New", lines: [{ label: "Name", value: "Raju Mistri", animate: true }] } },
        { en: "Assign to project/site", hi: "Assign to project/site", visual: { title: "📍 Site", lines: [{ label: "Site", value: "Modular Kitchen" }] } },
        { en: "Record payment for work done", hi: "Record payment for work done", visual: { title: "💸 Pay", lines: [{ label: "Paid", value: "₹3,000" }], action: "Save Payment" } },
        { en: "View pending and paid summary", hi: "View pending and paid summary", visual: { title: "📋 Summary", lines: [{ label: "Pending", value: "₹1,500" }] } }
      ]
    },
    {
      id: "estimatePanel", panelId: "estimatePanel", plans: ["business"], hideForStaff: true, color: "#059669",
      title: "📋 Quotation / Estimate",
      hindi: "Build PDF estimates before work starts; when the client accepts, convert to a tax invoice in one click.",
      english: "Build PDF estimates before work starts; when the client accepts, convert to a tax invoice in one click.",
      steps: [
        { en: "Add client, project/site and line items (work + rate)", hi: "Add client, project/site and line items (work + rate)", visual: { title: "📋 New", lines: [{ label: "Client", value: "Sharma Ji", animate: true }, { label: "Work", value: "Modular kitchen" }] } },
        { en: "Save and PDF / Print — share on WhatsApp", hi: "Save and PDF / Print — share on WhatsApp", visual: { title: "📄 PDF", action: "Save as PDF" } },
        { en: "Mark Sent when shared; Accept when client agrees", hi: "Mark Sent when shared; Accept when client agrees", visual: { title: "✅ Status", lines: [{ label: "Status", value: "Accepted" }] } },
        { en: "Client Accepted → Invoice — new invoice number + sales record", hi: "Client Accepted → Invoice — new invoice number + sales record", visual: { title: "🧾 Invoice", lines: [{ label: "From", value: "EST/12/25 → INV/45/25" }] } }
      ]
    },
    {
      id: "payrollPanel", panelId: "payrollPanel", plans: ["business"], hideForStaff: true, color: "#7c3aed",
      title: "💼 Staff Payroll & Attendance",
      hindi: "Daily staff attendance, auto monthly salary with advances, print/WhatsApp payslips.",
      english: "Daily staff attendance, auto monthly salary with advances, print/WhatsApp payslips.",
      steps: [
        { en: "Add employee with salary and join date", hi: "Add employee with salary and join date", visual: { title: "👤 Employee", lines: [{ label: "Name", value: "Sunil", animate: true }, { label: "Salary", value: "₹12,000/mo" }] } },
        { en: "Mark daily attendance (P/HD/Leave/Absent)", hi: "Mark daily attendance (P/HD/Leave/Absent)", visual: { title: "📅 Today", list: ["Sunil — Present ✅", "Amit — Half Day", "Ravi — Leave"] } },
        { en: "Month-end: auto salary calculation", hi: "Month-end: auto salary calculation", visual: { title: "💰 Salary", lines: [{ label: "Net Pay", value: "₹11,200" }, { label: "Advance", value: "−₹800" }] } },
        { en: "Print or WhatsApp salary slip", hi: "Print or WhatsApp salary slip", visual: { title: "📄 Slip", action: "Print / WhatsApp Slip" } }
      ]
    },
    {
      id: "payrollSelfPanel", panelId: "payrollPanel", plans: ["business"], staffOnly: true, color: "#7c3aed",
      title: "📅 My Attendance",
      hindi: "Staff mark own daily attendance — owner calculates salary at month-end.",
      english: "Staff mark own daily attendance — owner calculates salary at month-end.",
      steps: [
        { en: "Open My Attendance from sidebar", hi: "Open My Attendance from sidebar", visual: { title: "📅 Attendance", action: "Mark Today" } },
        { en: "Select Present / Half-day / Leave / Absent", hi: "Select Present / Half-day / Leave / Absent", visual: { title: "✅ Status", lines: [{ label: "Today", value: "Present", animate: true }] } },
        { en: "Save — owner can see your record", hi: "Save — owner can see your record", visual: { title: "Saved", action: "Submit Attendance" } },
        { en: "Salary calculated by owner at month-end", hi: "Salary calculated by owner at month-end", visual: { title: "💼 Note", list: ["You don't buy a plan", "Owner manages payroll"] } }
      ]
    },
    {
      id: "reportsProPanel", panelId: "reportsProPanel", plans: ["business"], color: "#0284c7",
      title: "📈 Reports Pro (GST/CA)",
      hindi: "GSTR summaries, sales-purchase analysis and CA-ready export reports.",
      english: "GSTR summaries, sales-purchase analysis and CA-ready export reports.",
      steps: [
        { en: "Choose report type and date range", hi: "Choose report type and date range", visual: { title: "📈 Reports", lines: [{ label: "Report", value: "GSTR-1 Summary ▾", animate: true }] } },
        { en: "View sales, purchase, tax breakup", hi: "View sales, purchase, tax breakup", visual: { title: "📊 Data", list: ["Taxable: ₹5,20,000", "CGST: ₹46,800", "SGST: ₹46,800"] } },
        { en: "Export for CA or Excel", hi: "Export for CA or Excel", visual: { title: "📤 Export", action: "Download Report" } },
        { en: "Filter by month/quarter for filing", hi: "Filter by month/quarter for filing", visual: { title: "📅 Period", lines: [{ label: "Quarter", value: "Q2 FY26" }] } }
      ]
    },
    {
      id: "bankReconPanel", panelId: "bankReconPanel", plans: ["business"], color: "#0891b2",
      title: "🏦 Bank Reconciliation",
      hindi: "Match bank statement with app entries — track pending cheques and differences.",
      english: "Match bank statement with app entries — track pending cheques and differences.",
      steps: [
        { en: "Select bank ledger account", hi: "Select bank ledger account", visual: { title: "🏦 Bank", lines: [{ label: "Account", value: "HDFC Current", animate: true }] } },
        { en: "Enter statement balance and date", hi: "Enter statement balance and date", visual: { title: "📄 Statement", lines: [{ label: "Stmt Bal", value: "₹1,25,400" }] } },
        { en: "Tick matched entries, flag pending", hi: "Tick matched entries, flag pending", visual: { title: "✅ Match", list: ["✅ UPI ₹5,000", "⏳ Cheque ₹20,000"] } },
        { en: "See difference until fully reconciled", hi: "See difference until fully reconciled", visual: { title: "⚖️ Diff", lines: [{ label: "Difference", value: "₹20,000" }] } }
      ]
    },
    {
      id: "qrPanel", panelId: "qrPanel", plans: ["business"], color: "#f97316",
      title: "📱 QR Tool (UPI)",
      hindi: "Generate UPI QR code — show customer for instant payment.",
      english: "Generate UPI QR code — show customer for instant payment.",
      steps: [
        { en: "Enter your UPI ID (e.g. shop@paytm)", hi: "Enter your UPI ID (e.g. shop@paytm)", visual: { title: "📱 UPI QR", lines: [{ label: "UPI ID", value: "sharmaply@upi", animate: true }] } },
        { en: "Optional: fixed amount for QR", hi: "Optional: fixed amount for QR", visual: { title: "💰 Amount", lines: [{ label: "Amount", value: "₹1,500" }] } },
        { en: "QR code generates instantly", hi: "QR code generates instantly", visual: { title: "QR", action: "Show QR to Customer" } },
        { en: "Customer scans and pays via any UPI app", hi: "Customer scans and pays via any UPI app", visual: { title: "✅ Paid", lines: [{ label: "Status", value: "Payment received" }] } }
      ]
    },
    {
      id: "calcPanel", panelId: "calcPanel", plans: ["business"], color: "#14b8a6",
      title: "🔢 Calculator",
      hindi: "Quick on-site calculations without leaving the app.",
      english: "Quick on-site calculations without leaving the app.",
      steps: [
        { en: "Open Calculator from Tools menu", hi: "Open Calculator from Tools menu", visual: { title: "🔢 Calc", lines: [{ label: "Input", value: "2500 × 12", animate: true }] } },
        { en: "Standard + − × ÷ operations", hi: "Standard + − × ÷ operations", visual: { title: "=", lines: [{ label: "Result", value: "30,000" }] } },
        { en: "Use for quick estimates on site", hi: "Use for quick estimates on site", visual: { title: "💡 Tip", list: ["Material qty × rate", "Labor days × wage"] } },
        { en: "Clear and recalculate anytime", hi: "Clear and recalculate anytime", visual: { title: "C", action: "Clear" } }
      ]
    },
    {
      id: "notesPanel", panelId: "notesPanel", plans: ["business"], color: "#64748b",
      title: "📝 Notes Saver",
      hindi: "Save site notes, rate lists and quick reminders — download as text.",
      english: "Save site notes, rate lists and quick reminders — download as text.",
      steps: [
        { en: "Type note in text area", hi: "Type note in text area", visual: { title: "📝 Note", lines: [{ label: "Text", value: "Plywood rate ₹85/sqft", animate: true }] } },
        { en: "Save note to browser storage", hi: "Save note to browser storage", visual: { title: "💾 Save", action: "Save Note" } },
        { en: "Download as .txt file", hi: "Download as .txt file", visual: { title: "📥 Download", action: "Download .txt" } },
        { en: "Keep rate lists and site reminders", hi: "Keep rate lists and site reminders", visual: { title: "📋 Saved", list: ["Supplier rates", "Site phone numbers"] } }
      ]
    },
    {
      id: "mediaPanel", panelId: "mediaPanel", plans: ["business"], color: "#475569",
      title: "📷 Media (Receipt Scanner)",
      hindi: "Upload and store photos of purchase receipts and bills.",
      english: "Upload and store photos of purchase receipts and bills.",
      steps: [
        { en: "Open Media panel and upload photo", hi: "Open Media panel and upload photo", visual: { title: "📷 Upload", action: "Choose Receipt Photo" } },
        { en: "Photo saved securely in your account", hi: "Photo saved securely in your account", visual: { title: "☁️ Saved", lines: [{ label: "File", value: "receipt_14sep.jpg" }] } },
        { en: "Browse all uploaded receipts", hi: "Browse all uploaded receipts", visual: { title: "Gallery", list: ["Hardware bill", "Transport bill"] } },
        { en: "Delete when no longer needed", hi: "Delete when no longer needed", visual: { title: "🗑️", action: "Delete Photo" } }
      ]
    },
    {
      id: "staffPanel", panelId: "staffPanel", plans: ["business"], color: "#7c3aed",
      title: "👥 Staff (Invite Team)",
      hindi: "Invite Staff/Manager/Cashier with role-based access — no separate plan purchase.",
      english: "Invite Staff/Manager/Cashier with role-based access — no separate plan purchase.",
      steps: [
        { en: "Choose role: Staff / Manager / Cashier", hi: "Choose role: Staff / Manager / Cashier", visual: { title: "👥 Invite", lines: [{ label: "Role", value: "Cashier ▾", animate: true }] } },
        { en: "Generate invite code", hi: "Generate invite code", visual: { title: "🔑 Code", lines: [{ label: "Code", value: "BK-STAFF-7X2K" }], action: "Generate Code" } },
        { en: "Share code — staff signs up with it", hi: "Share code — staff signs up with it", visual: { title: "📤 Share", action: "WhatsApp Code" } },
        { en: "Staff uses owner's plan automatically", hi: "Staff uses owner's plan automatically", visual: { title: "✅ Linked", list: ["No extra payment", "Role-based tabs only"] } }
      ]
    },
    {
      id: "companiesPanel", panelId: "companiesPanel", plans: ["business"], color: "#1d4ed8",
      title: "🏢 Companies (Multi-Firm)",
      hindi: "Manage multiple companies with separate GSTIN and profiles.",
      english: "Manage multiple companies with separate GSTIN and profiles.",
      steps: [
        { en: "Add new company with GSTIN and name", hi: "Add new company with GSTIN and name", visual: { title: "🏢 New Co.", lines: [{ label: "Name", value: "Sharma Interiors", animate: true }, { label: "GSTIN", value: "06XXXXX" }] } },
        { en: "Switch active company from dropdown", hi: "Switch active company from dropdown", visual: { title: "🔄 Switch", lines: [{ label: "Active", value: "Sharma Ply ▾" }] } },
        { en: "Each company has separate data", hi: "Each company has separate data", visual: { title: "📊 Data", list: ["Company A — 120 invoices", "Company B — 45 invoices"] } },
        { en: "CA export per company", hi: "CA export per company", visual: { title: "📤 Export", action: "Export Active Company" } }
      ]
    },
    {
      id: "tallySync", panelId: null, plans: ["business"], color: "#16a34a",
      title: "🔗 Tally Sync (Optional)",
      hindi: "Use BolKarigar Khata daily. Optional Tally sync needs Desktop Agent and Tally HTTP on port 9000.",
      english: "Use BolKarigar Khata daily. Optional Tally sync needs Desktop Agent and Tally HTTP on port 9000.",
      steps: [
        { en: "Install BolKarigar Desktop Agent on PC", hi: "Install BolKarigar Desktop Agent on PC", visual: { title: "💻 Agent", action: "Download Agent" } },
        { en: "Tally: F1 → Settings → HTTP Server ON, Port 9000", hi: "Tally: F1 → Settings → HTTP Server ON, Port 9000", visual: { title: "⚙️ Tally", list: ["Client/Server mode", "Port 9000", "Company open in Tally"] } },
        { en: "Test connection — green tick", hi: "Test connection — green tick", visual: { title: "🔗 Test", action: "Test Tally Connection" } },
        { en: "Sync vouchers to Tally when needed", hi: "Sync vouchers to Tally when needed", visual: { title: "✅ Sync", action: "Sync to Tally" } }
      ]
    }
  ];

  window.HELP_MODULE_CATALOG = PRO_MODULES;
  window.HELP_BUSINESS_MODULES = BUSINESS_MODULES;
})();
