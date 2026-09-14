/**
 * BolKarigar — Help module catalog (Hindi + English + animated demo steps)
 */
(function () {
  const PRO_MODULES = [
    {
      id: "overviewPanel", panelId: "overviewPanel", plans: ["pro"], color: "#3b82f6",
      title: "📊 Overview (Dashboard)",
      hindi: "Dashboard par aaj ki sales, kharcha, udhar, profit ek nazar mein. Neeche Business Records tabs se Sales, Purchase, Payment, Receipt aur Customer Detail dekhein.",
      english: "Dashboard shows today's sales, expenses, credit due, and profit. Use Business Records tabs for Sales, Purchase, Payment, Receipt and Customer Detail.",
      steps: [
        { en: "Open Overview — see KPI cards (Sales, Expense, Credit, Profit)", hi: "Overview kholein — Sales, Expense, Udhar, Profit cards dekhein", visual: { title: "📊 Dashboard", list: ["Sales Today: ₹24,500", "Credit Due: ₹8,200", "Profit: ₹6,100"] } },
        { en: "Switch tabs: Sales / Purchase / Payment / Receipt lists", hi: "Tabs badlein: Sales / Purchase / Payment / Receipt lists", visual: { title: "📋 Business Records", lines: [{ label: "Tab", value: "Sales ▾", animate: true }, { label: "Filter", value: "This Month" }], action: "View Records" } },
        { en: "Use date filter for any day or month report", hi: "Kisi bhi din/mahine ka report date filter se dekhein", visual: { title: "📅 Date Filter", lines: [{ label: "From", value: "01-Sep-2026" }, { label: "To", value: "14-Sep-2026" }], action: "Apply Filter" } },
        { en: "Customer Detail — full account with pending credit", hi: "Customer Detail — poora hisaab + pending udhar", visual: { title: "👤 Customer Detail", lines: [{ label: "Customer", value: "Ramesh Traders" }, { label: "Pending", value: "₹4,500" }], action: "Open Ledger" } }
      ]
    },
    {
      id: "invoicePanel", panelId: "invoicePanel", plans: ["pro"], color: "#06b6d4",
      title: "📑 Invoice (GST Bill)",
      hindi: "GST bill banayein — customer, product, HSN, qty, GST slab (0%–28%). PDF download ya WhatsApp share. Stock auto update hota hai.",
      english: "Create GST invoices with customer, product, HSN, quantity and tax slabs. Download PDF or share on WhatsApp. Stock updates automatically.",
      steps: [
        { en: "Enter customer name, mobile and billing address", hi: "Customer naam, mobile aur address bharein", visual: { title: "🧾 New Invoice", lines: [{ label: "Customer", value: "Ramesh Kumar", animate: true }, { label: "Mobile", value: "98765xxxxx" }] } },
        { en: "Add items — product, rate, qty, GST%", hi: "Item add karein — product, rate, qty, GST%", visual: { title: "➕ Add Item", lines: [{ label: "Product", value: "Plywood 18mm" }, { label: "Qty", value: "5" }, { label: "GST", value: "18%" }], action: "Add Item" } },
        { en: "Review total, tax breakup and save invoice", hi: "Total, tax breakup check karke bill save karein", visual: { title: "💰 Invoice Total", lines: [{ label: "Taxable", value: "₹10,000" }, { label: "GST", value: "₹1,800" }, { label: "Grand Total", value: "₹11,800" }], action: "Save Invoice" } },
        { en: "Download PDF or share bill on WhatsApp", hi: "PDF download karein ya WhatsApp par bill bhejein", visual: { title: "📤 Share", lines: [{ label: "Invoice No", value: "INV-0042" }], action: "WhatsApp Share" } }
      ]
    },
    {
      id: "purchasePanel", panelId: "purchasePanel", plans: ["pro"], color: "#0ea5e9",
      title: "📥 Purchase Bill",
      hindi: "Supplier se maal kharidne ka bill record karein. Supplier invoice number, GSTIN aur items daal kar stock badhayein.",
      english: "Record purchase bills from suppliers. Enter supplier invoice number, GSTIN and items to increase stock.",
      steps: [
        { en: "Select or add supplier / party name", hi: "Supplier / party select ya add karein", visual: { title: "📥 Purchase", lines: [{ label: "Supplier", value: "Sharma Ply", animate: true }] } },
        { en: "Enter supplier invoice no. (required) and date", hi: "Supplier invoice no. (zaroori) aur date daalein", visual: { title: "📄 Supplier Bill", lines: [{ label: "Inv No", value: "SP-8821", animate: true }, { label: "Date", value: "14-Sep-2026" }] } },
        { en: "Add purchased items with rate and qty", hi: "Kharida hua saman rate + qty ke saath add karein", visual: { title: "📦 Items", lines: [{ label: "Item", value: "Laminates" }, { label: "Qty", value: "+20" }], action: "Add Row" } },
        { en: "Save — stock increases automatically", hi: "Save karein — stock apne aap badh jata hai", visual: { title: "✅ Saved", list: ["Purchase recorded", "Stock +20 Laminates", "Payable updated"] } }
      ]
    },
    {
      id: "paymentVoucherPanel", panelId: "paymentVoucherPanel", plans: ["pro"], color: "#f43f5e",
      title: "💸 Payment Voucher",
      hindi: "Supplier ya party ko paisa diya — amount, mode (Cash/UPI/Bank) record karein. Payment voucher auto banta hai.",
      english: "Record money paid to supplier or party — amount and payment mode (Cash/UPI/Bank). Creates a payment voucher.",
      steps: [
        { en: "Choose party / supplier you paid", hi: "Jisko payment di — woh party select karein", visual: { title: "💸 Payment", lines: [{ label: "Party", value: "Sharma Ply", animate: true }] } },
        { en: "Enter amount and payment mode", hi: "Rashi aur payment mode (Cash/UPI) daalein", visual: { title: "💰 Amount", lines: [{ label: "Amount", value: "₹15,000", animate: true }, { label: "Mode", value: "UPI" }] } },
        { en: "Add note (optional) and save", hi: "Note (optional) daal kar save karein", visual: { title: "📝 Note", lines: [{ label: "Ref", value: "Bill SP-8821" }] } },
        { en: "Ledger and Day Book update automatically", hi: "Ledger aur Day Book apne aap update ho jate hain", visual: { title: "✅ Done", list: ["Payment voucher created", "Supplier balance reduced", "Day Book entry added"] } }
      ]
    },
    {
      id: "receiptVoucherPanel", panelId: "receiptVoucherPanel", plans: ["pro"], color: "#22c55e",
      title: "💰 Receipt Voucher",
      hindi: "Customer se paisa liya — receipt record karein. Udhar khata se amount kam hoti hai.",
      english: "Record money received from customer. Reduces pending credit in the ledger.",
      steps: [
        { en: "Select customer who paid you", hi: "Customer select karein jisne paisa diya", visual: { title: "💰 Receipt", lines: [{ label: "Customer", value: "Ramesh Traders", animate: true }] } },
        { en: "Enter received amount and mode", hi: "Mili hui rashi aur mode daalein", visual: { title: "💵 Amount", lines: [{ label: "Amount", value: "₹5,000", animate: true }, { label: "Mode", value: "Cash" }] } },
        { en: "Save receipt voucher", hi: "Receipt voucher save karein", visual: { title: "🧾 Voucher", lines: [{ label: "Voucher", value: "RCP-015" }], action: "Save Receipt" } },
        { en: "Customer pending credit reduces", hi: "Customer ka pending udhar kam ho jata hai", visual: { title: "📖 Credit Updated", lines: [{ label: "Before", value: "₹9,500" }, { label: "After", value: "₹4,500" }] } }
      ]
    },
    {
      id: "inventoryPanel", panelId: "inventoryPanel", plans: ["pro"], color: "#10b981",
      title: "📦 Inventory (Stock)",
      hindi: "Dukaan/godam ka stock — qty, rate, value. Invoice/purchase se auto update. Low stock alert bhi milta hai.",
      english: "Track shop/warehouse stock — quantity, rate and value. Auto-updates from invoices/purchases with low-stock alerts.",
      steps: [
        { en: "View all items with current stock qty", hi: "Saare items ki current stock qty dekhein", visual: { title: "📦 Stock List", list: ["Plywood 18mm — 45 pcs", "Hinges — 8 pcs ⚠️", "Laminates — 120 sqft"] } },
        { en: "Red/low stock items need reorder", hi: "Lal/low stock items ka reorder karein", visual: { title: "⚠️ Low Stock", lines: [{ label: "Item", value: "Hinges" }, { label: "Qty Left", value: "8 (min 20)" }], action: "Reorder Alert" } },
        { en: "Manual adjust: + stock in, − stock out", hi: "Manual adjust: + andar, − bahar", visual: { title: "± Adjust", lines: [{ label: "Change", value: "+10", animate: true }, { label: "Reason", value: "Physical count" }], action: "Update Stock" } },
        { en: "Total inventory value shown at top", hi: "Upar total stock value dikhti hai", visual: { title: "💎 Value", lines: [{ label: "Total Stock Value", value: "₹3,42,000" }] } }
      ]
    },
    {
      id: "ledgerPanel", panelId: "ledgerPanel", plans: ["pro"], color: "#ef4444",
      title: "📖 Credit Ledger (Udhar)",
      hindi: "Kis customer ke paas kitna udhar hai — payment record karein, poori history dekhein.",
      english: "Track customer credit (udhar), record payments and view full history.",
      steps: [
        { en: "See list of customers with pending credit", hi: "Pending udhar wale customers ki list", visual: { title: "📖 Udhar List", list: ["Ramesh — ₹4,500", "Suresh — ₹2,100", "Amit — ₹0 ✅"] } },
        { en: "Tap customer for full transaction history", hi: "Customer par click — poori history", visual: { title: "👤 Ramesh Traders", lines: [{ label: "Sale", value: "+₹11,800" }, { label: "Receipt", value: "−₹5,000" }] } },
        { en: "Record payment received from customer", hi: "Customer se payment record karein", visual: { title: "💰 Record Pay", lines: [{ label: "Amount", value: "₹2,000", animate: true }], action: "Save Payment" } },
        { en: "Pending balance updates instantly", hi: "Pending balance turant update", visual: { title: "✅ Updated", lines: [{ label: "Pending Now", value: "₹2,500" }] } }
      ]
    },
    {
      id: "khataLedgersPanel", panelId: "khataLedgersPanel", plans: ["pro"], color: "#f59e0b",
      title: "📒 Ledgers (Party Accounts)",
      hindi: "Har party ka alag ledger — opening balance, debit-credit entries, closing balance (Tally/Vyapar style).",
      english: "Party-wise ledger accounts with opening balance, entries and closing balance.",
      steps: [
        { en: "Create ledger for customer/supplier/bank", hi: "Customer/supplier/bank ka ledger banayein", visual: { title: "📒 New Ledger", lines: [{ label: "Name", value: "HDFC Bank", animate: true }, { label: "Type", value: "Bank" }] } },
        { en: "Set opening balance (Dr or Cr)", hi: "Opening balance set karein (Dr/Cr)", visual: { title: "⚖️ Opening", lines: [{ label: "Opening", value: "₹50,000 Dr" }] } },
        { en: "All vouchers post entries here automatically", hi: "Saare vouchers yahan auto entry karte hain", visual: { title: "📋 Entries", list: ["Sale INV-0042 — Cr", "Receipt RCP-015 — Dr"] } },
        { en: "View closing balance anytime", hi: "Kabhi bhi closing balance dekhein", visual: { title: "✅ Closing", lines: [{ label: "Closing Balance", value: "₹62,300 Dr" }] } }
      ]
    },
    {
      id: "khataItemsPanel", panelId: "khataItemsPanel", plans: ["pro"], color: "#84cc16",
      title: "📦 Stock Items (Khata)",
      hindi: "Khata ke liye items — naam, rate, GST, unit, opening qty. Voucher/invoice mein use hote hain.",
      english: "Khata stock items — name, rate, GST, unit and opening qty for use in vouchers.",
      steps: [
        { en: "Add item name, unit and sale rate", hi: "Item naam, unit aur sale rate daalein", visual: { title: "📦 New Item", lines: [{ label: "Item", value: "Teak Wood", animate: true }, { label: "Unit", value: "CFT" }] } },
        { en: "Set GST% and HSN if applicable", hi: "GST% aur HSN set karein", visual: { title: "🏷️ GST", lines: [{ label: "GST", value: "18%" }, { label: "HSN", value: "4407" }] } },
        { en: "Opening qty for existing stock", hi: "Pehle se stock ho to opening qty", visual: { title: "📊 Opening", lines: [{ label: "Opening Qty", value: "120", animate: true }] } },
        { en: "Item ready for Sales/Purchase vouchers", hi: "Ab Sales/Purchase voucher mein use karein", visual: { title: "✅ Ready", action: "Use in Voucher" } }
      ]
    },
    {
      id: "khataVoucherPanel", panelId: "khataVoucherPanel", plans: ["pro"], color: "#a855f7",
      title: "🧾 New Voucher",
      hindi: "Sales, Purchase, Receipt, Payment, Journal, Contra, Debit/Credit Note — professional accounting vouchers.",
      english: "Create Sales, Purchase, Receipt, Payment, Journal, Contra and Debit/Credit Note vouchers.",
      steps: [
        { en: "Pick voucher type from dropdown", hi: "Dropdown se voucher type chunein", visual: { title: "🧾 Voucher Type", lines: [{ label: "Type", value: "Sales ▾", animate: true }] } },
        { en: "Fill party, items/accounts, amounts", hi: "Party, items/accounts, amount bharein", visual: { title: "📝 Details", lines: [{ label: "Party", value: "Ramesh" }, { label: "Amount", value: "₹11,800" }] } },
        { en: "Journal: dual Debit/Credit boxes must balance", hi: "Journal: Debit/Credit balance hona chahiye", visual: { title: "📒 Journal", lines: [{ label: "Debit", value: "₹5,000" }, { label: "Credit", value: "₹5,000 ✅" }] } },
        { en: "Save — appears in Day Book & Ledgers", hi: "Save — Day Book aur Ledger mein dikhega", visual: { title: "✅ Posted", list: ["Voucher saved", "Ledgers updated", "Day Book entry"] } }
      ]
    },
    {
      id: "khataDaybookPanel", panelId: "khataDaybookPanel", plans: ["pro"], color: "#6366f1",
      title: "📅 Day Book",
      hindi: "Ek din ke saare vouchers/transactions ek jagah — date filter se kisi bhi din ka hisaab.",
      english: "All vouchers for a day in one register — filter by any date.",
      steps: [
        { en: "Select date to view that day's entries", hi: "Date chunein — us din ki entries", visual: { title: "📅 Day Book", lines: [{ label: "Date", value: "14-Sep-2026", animate: true }] } },
        { en: "See all Sales, Purchase, Receipt, Payment", hi: "Saari Sales, Purchase, Receipt, Payment dekhein", visual: { title: "📋 Entries", list: ["Sales INV-0042 — ₹11,800", "Receipt RCP-015 — ₹5,000", "Payment PAY-008 — ₹15,000"] } },
        { en: "Search voucher number if needed", hi: "Zaroorat ho to voucher no. search karein", visual: { title: "🔍 Search", lines: [{ label: "Search", value: "INV-0042", animate: true }] } },
        { en: "Daily total debit/credit summary", hi: "Din ka total debit/credit summary", visual: { title: "📊 Summary", lines: [{ label: "Total In", value: "₹16,800" }, { label: "Total Out", value: "₹15,000" }] } }
      ]
    },
    {
      id: "modifyPanel", panelId: "modifyPanel", plans: ["pro"], color: "#eab308",
      title: "✏️ Modification (Edit Vouchers)",
      hindi: "Galat entry ho gayi? Type chunein → search karein → edit karke save. Tally/Busy style modify.",
      english: "Wrong entry? Choose type, search voucher, edit and save — Tally/Busy style modification.",
      steps: [
        { en: "Select what to edit: Ledger / Sales / Voucher", hi: "Kya edit karna hai chunein: Ledger / Sales / Voucher", visual: { title: "✏️ Modify", lines: [{ label: "Type", value: "Voucher ▾", animate: true }] } },
        { en: "Search by number or name", hi: "Number ya naam se search karein", visual: { title: "🔍 Search", lines: [{ label: "Find", value: "INV-0042", animate: true }], action: "Search" } },
        { en: "Edit fields and save changes", hi: "Fields edit karke save karein", visual: { title: "📝 Edit", lines: [{ label: "Qty", value: "5 → 6" }], action: "Save Changes" } },
        { en: "Stock and ledgers recalculate", hi: "Stock aur ledger dubara calculate hote hain", visual: { title: "✅ Updated", list: ["Record modified", "Stock adjusted", "Ledger corrected"] } }
      ]
    },
    {
      id: "galleryPanel", panelId: "galleryPanel", plans: ["pro"], color: "#ec4899",
      title: "🖼️ Gallery",
      hindi: "Apne kaam ki photos, furniture design ya product catalog upload karein — customers ko dikhayein.",
      english: "Upload work photos, designs or product catalog to show customers.",
      steps: [
        { en: "Click upload and choose photos from device", hi: "Upload dabayein aur photo chunein", visual: { title: "🖼️ Gallery", action: "📷 Upload Photo" } },
        { en: "Add title/category for each image", hi: "Har photo ka title/category daalein", visual: { title: "🏷️ Details", lines: [{ label: "Title", value: "Modular Kitchen", animate: true }] } },
        { en: "Browse grid of all portfolio images", hi: "Saari photos grid mein dekhein", visual: { title: "Grid View", list: ["Kitchen design", "Wardrobe", "Office furniture"] } },
        { en: "Delete old photos when not needed", hi: "Purani photos delete kar sakte hain", visual: { title: "🗑️ Manage", action: "Delete Photo" } }
      ]
    },
    {
      id: "todoPanel", panelId: "todoPanel", plans: ["pro"], color: "#8b5cf6",
      title: "✅ Todo (Tasks)",
      hindi: "Aaj ke kaam, site reminders, workers ko tasks — list banao aur complete mark karein.",
      english: "Daily tasks, site reminders and work assignments — check off when done.",
      steps: [
        { en: "Add new task with title", hi: "Naya task title ke saath add karein", visual: { title: "✅ Todo", lines: [{ label: "Task", value: "Deliver plywood to site", animate: true }], action: "Add Task" } },
        { en: "Mark complete with checkbox", hi: "Checkbox se complete mark karein", visual: { title: "Done", list: ["✅ Deliver plywood", "⬜ Call supplier", "⬜ GST filing"] } },
        { en: "Delete finished or old tasks", hi: "Purane tasks delete karein", visual: { title: "🗑️ Clean", action: "Remove Done" } },
        { en: "Use for daily shop/site checklist", hi: "Roz ki dukaan/site checklist ke liye use karein", visual: { title: "📋 Today", lines: [{ label: "Pending", value: "2 tasks" }] } }
      ]
    },
    {
      id: "businessCardPanel", panelId: "businessCardPanel", plans: ["pro"], color: "#3b82f6",
      title: "💼 Business Card",
      hindi: "12 free + 25 premium digital visiting cards — naam, dukaan, mobile, GST; download PNG ya WhatsApp share.",
      english: "12 free + 25 premium digital cards — fill details, download PNG or share on WhatsApp.",
      steps: [
        { en: "Fill shop name, owner, mobile, GST", hi: "Dukaan, naam, mobile, GST bharein", visual: { title: "💼 Card Details", lines: [{ label: "Shop", value: "Sharma Ply", animate: true }, { label: "Mobile", value: "98765xxxxx" }] } },
        { en: "Pick free template (12 designs)", hi: "Free template chunein (12 designs)", visual: { title: "🆓 Free Templates", action: "Choose Template" } },
        { en: "Business plan unlocks 25 premium designs", hi: "Business plan se 25 premium designs", visual: { title: "👑 Premium", action: "Upgrade for Premium" } },
        { en: "Download PNG or share on WhatsApp", hi: "PNG download ya WhatsApp share", visual: { title: "📤 Share", action: "Download / WhatsApp" } }
      ]
    },
    {
      id: "securityPanel", panelId: "securityPanel", plans: ["pro"], color: "#64748b",
      title: "🔐 Security (App Lock)",
      hindi: "PIN se app lock karein — koi aur aapka data na dekhe. PIN change ya lock band kar sakte hain.",
      english: "Lock app with PIN so others cannot see your data. Change PIN or turn lock off.",
      steps: [
        { en: "Turn ON App Lock and set 4-digit PIN", hi: "App Lock ON karein aur 4-digit PIN set karein", visual: { title: "🔐 App Lock", lines: [{ label: "PIN", value: "••••", animate: true }], action: "Save PIN" } },
        { en: "PIN required each time app opens", hi: "Har baar app khulte waqt PIN maangega", visual: { title: "🔒 Locked", action: "Enter PIN to Unlock" } },
        { en: "Change PIN from Security panel", hi: "Security se PIN change karein", visual: { title: "🔄 Change PIN", action: "Update PIN" } },
        { en: "Turn OFF lock if not needed", hi: "Zaroorat na ho to lock band karein", visual: { title: "Off", lines: [{ label: "App Lock", value: "Disabled" }] } }
      ]
    },
    {
      id: "myPlanPanel", panelId: "myPlanPanel", plans: ["pro"], ownerOnly: true, color: "#22c55e",
      title: "💳 My Plan (Subscription)",
      hindi: "Apna Pro/Business plan, trial days, renew/upgrade — Monthly/Yearly toggle se Razorpay payment.",
      english: "View Pro/Business plan, trial days left, renew or upgrade via Razorpay with Monthly/Yearly toggle.",
      steps: [
        { en: "See current plan, trial or paid status", hi: "Current plan, trial ya paid status dekhein", visual: { title: "💳 My Plan", lines: [{ label: "Plan", value: "Pro Shop Trial" }, { label: "Days Left", value: "22 days" }] } },
        { en: "Toggle Monthly / Yearly pricing", hi: "Monthly / Yearly toggle se price dekhein", visual: { title: "🔄 Billing", lines: [{ label: "Pro", value: "₹99/mo or ₹999/yr" }, { label: "Business", value: "₹299/mo or ₹2999/yr" }] } },
        { en: "Pay via Razorpay — UPI / Card / Netbanking", hi: "Razorpay se pay — UPI / Card / Netbanking", visual: { title: "💳 Pay", action: "Pay — Pro / Business" } },
        { en: "Staff do NOT need separate plan", hi: "Staff ko alag plan ki zaroorat nahi", visual: { title: "👥 Staff", list: ["Owner buys once", "Staff use invite code", "No extra payment"] } }
      ]
    }
  ];

  const BUSINESS_MODULES = [
    {
      id: "voicePanel", panelId: "voicePanel", plans: ["business"], color: "#a855f7",
      title: "🎤 Voice AI",
      hindi: "Top bar se Voice ON karke bina type kiye app control — 'Invoice kholo', 'Udhar khata kholo', 'Dark mode on'.",
      english: "Turn Voice ON from top bar and control app by speech — Open Invoice, Open Credit Ledger, Dark mode on.",
      steps: [
        { en: "Tap Voice ON button in top bar", hi: "Top bar mein Voice ON dabayein", visual: { title: "🎤 Voice", action: "Voice ON" } },
        { en: "Speak clearly in Hindi or English", hi: "Hindi ya English mein clearly bolein", visual: { title: "🗣️ Say", lines: [{ label: "You", value: "Invoice kholo", animate: true }] } },
        { en: "App opens the correct panel", hi: "App sahi panel khol deta hai", visual: { title: "✅ Action", action: "Opening Invoice…" } },
        { en: "Works for navigation, todos, and queries", hi: "Navigation, todo aur sawaal ke liye kaam karta hai", visual: { title: "Examples", list: ["Udhar khata kholo", "Todo add karo", "Dark mode on"] } }
      ]
    },
    {
      id: "projectPanel", panelId: "projectPanel", plans: ["business"], color: "#eab308",
      title: "📁 Projects (Sites)",
      hindi: "Client sites alag track karein — location, budget, status, daily material/labor kharcha.",
      english: "Track client sites separately — location, budget, status and daily expenses.",
      steps: [
        { en: "Create project with name, customer, site", hi: "Project naam, customer, site ke saath banayein", visual: { title: "📁 New Project", lines: [{ label: "Project", value: "Modular Kitchen", animate: true }, { label: "Site", value: "Sector 14" }] } },
        { en: "Set budget and status (Planning/Running/Done)", hi: "Budget aur status set karein", visual: { title: "💰 Budget", lines: [{ label: "Budget", value: "₹2,50,000" }, { label: "Status", value: "Running" }] } },
        { en: "Add daily material or labor expenses", hi: "Roz ka material/labor kharcha add karein", visual: { title: "📝 Expense", lines: [{ label: "Today", value: "₹8,500" }], action: "Add Expense" } },
        { en: "Compare spent vs budget", hi: "Kharcha vs budget compare karein", visual: { title: "📊 Progress", lines: [{ label: "Spent", value: "₹1,20,000 / ₹2,50,000" }] } }
      ]
    },
    {
      id: "contractorPanel", panelId: "contractorPanel", plans: ["business"], color: "#d97706",
      title: "👷 Contractor (Labor)",
      hindi: "Contractors/mazdoor ka record, payment, kaam ki details aur site-wise assignment.",
      english: "Manage contractors, labor payments, work details and site assignments.",
      steps: [
        { en: "Add contractor name and skill type", hi: "Contractor naam aur kaam ka type add karein", visual: { title: "👷 New", lines: [{ label: "Name", value: "Raju Mistri", animate: true }] } },
        { en: "Assign to project/site", hi: "Project/site par assign karein", visual: { title: "📍 Site", lines: [{ label: "Site", value: "Modular Kitchen" }] } },
        { en: "Record payment for work done", hi: "Kaam ka payment record karein", visual: { title: "💸 Pay", lines: [{ label: "Paid", value: "₹3,000" }], action: "Save Payment" } },
        { en: "View pending and paid summary", hi: "Pending aur paid summary dekhein", visual: { title: "📋 Summary", lines: [{ label: "Pending", value: "₹1,500" }] } }
      ]
    },
    {
      id: "payrollPanel", panelId: "payrollPanel", plans: ["business"], hideForStaff: true, color: "#7c3aed",
      title: "💼 Staff Payroll & Attendance",
      hindi: "Staff ki daily hajri — Present/Half-day/Leave. Month-end salary auto, advance minus, salary slip print/WhatsApp.",
      english: "Daily staff attendance, auto monthly salary with advances, print/WhatsApp payslips.",
      steps: [
        { en: "Add employee with salary and join date", hi: "Employee salary aur join date ke saath add karein", visual: { title: "👤 Employee", lines: [{ label: "Name", value: "Sunil", animate: true }, { label: "Salary", value: "₹12,000/mo" }] } },
        { en: "Mark daily attendance (P/HD/Leave/Absent)", hi: "Roz attendance mark karein", visual: { title: "📅 Today", list: ["Sunil — Present ✅", "Amit — Half Day", "Ravi — Leave"] } },
        { en: "Month-end: auto salary calculation", hi: "Month-end: salary auto calculate", visual: { title: "💰 Salary", lines: [{ label: "Net Pay", value: "₹11,200" }, { label: "Advance", value: "−₹800" }] } },
        { en: "Print or WhatsApp salary slip", hi: "Salary slip print ya WhatsApp karein", visual: { title: "📄 Slip", action: "Print / WhatsApp Slip" } }
      ]
    },
    {
      id: "payrollSelfPanel", panelId: "payrollPanel", plans: ["business"], staffOnly: true, color: "#7c3aed",
      title: "📅 My Attendance",
      hindi: "Staff apni daily attendance yahan mark karein — owner month-end par salary nikalta hai.",
      english: "Staff mark own daily attendance — owner calculates salary at month-end.",
      steps: [
        { en: "Open My Attendance from sidebar", hi: "Sidebar se My Attendance kholein", visual: { title: "📅 Attendance", action: "Mark Today" } },
        { en: "Select Present / Half-day / Leave / Absent", hi: "Present / Half-day / Leave / Absent chunein", visual: { title: "✅ Status", lines: [{ label: "Today", value: "Present", animate: true }] } },
        { en: "Save — owner can see your record", hi: "Save — owner aapki hajri dekhega", visual: { title: "Saved", action: "Submit Attendance" } },
        { en: "Salary calculated by owner at month-end", hi: "Month-end par owner salary calculate karega", visual: { title: "💼 Note", list: ["You don't buy a plan", "Owner manages payroll"] } }
      ]
    },
    {
      id: "reportsProPanel", panelId: "reportsProPanel", plans: ["business"], color: "#0284c7",
      title: "📈 Reports Pro (GST/CA)",
      hindi: "GSTR summary, sales-purchase analysis, CA export — professional GST reports.",
      english: "GSTR summaries, sales-purchase analysis and CA-ready export reports.",
      steps: [
        { en: "Choose report type and date range", hi: "Report type aur date range chunein", visual: { title: "📈 Reports", lines: [{ label: "Report", value: "GSTR-1 Summary ▾", animate: true }] } },
        { en: "View sales, purchase, tax breakup", hi: "Sales, purchase, tax breakup dekhein", visual: { title: "📊 Data", list: ["Taxable: ₹5,20,000", "CGST: ₹46,800", "SGST: ₹46,800"] } },
        { en: "Export for CA or Excel", hi: "CA ya Excel ke liye export", visual: { title: "📤 Export", action: "Download Report" } },
        { en: "Filter by month/quarter for filing", hi: "Filing ke liye month/quarter filter", visual: { title: "📅 Period", lines: [{ label: "Quarter", value: "Q2 FY26" }] } }
      ]
    },
    {
      id: "bankReconPanel", panelId: "bankReconPanel", plans: ["business"], color: "#0891b2",
      title: "🏦 Bank Reconciliation",
      hindi: "Bank statement aur app entries match karein — pending cheques aur difference track.",
      english: "Match bank statement with app entries — track pending cheques and differences.",
      steps: [
        { en: "Select bank ledger account", hi: "Bank ledger account chunein", visual: { title: "🏦 Bank", lines: [{ label: "Account", value: "HDFC Current", animate: true }] } },
        { en: "Enter statement balance and date", hi: "Statement balance aur date daalein", visual: { title: "📄 Statement", lines: [{ label: "Stmt Bal", value: "₹1,25,400" }] } },
        { en: "Tick matched entries, flag pending", hi: "Match entries tick karein, pending alag", visual: { title: "✅ Match", list: ["✅ UPI ₹5,000", "⏳ Cheque ₹20,000"] } },
        { en: "See difference until fully reconciled", hi: "Poora match hone tak difference dikhega", visual: { title: "⚖️ Diff", lines: [{ label: "Difference", value: "₹20,000" }] } }
      ]
    },
    {
      id: "qrPanel", panelId: "qrPanel", plans: ["business"], color: "#f97316",
      title: "📱 QR Tool (UPI)",
      hindi: "Apni UPI ID ka QR code banayein — customer ko dikha kar turant payment lein.",
      english: "Generate UPI QR code — show customer for instant payment.",
      steps: [
        { en: "Enter your UPI ID (e.g. shop@paytm)", hi: "Apni UPI ID daalein (jaise shop@paytm)", visual: { title: "📱 UPI QR", lines: [{ label: "UPI ID", value: "sharmaply@upi", animate: true }] } },
        { en: "Optional: fixed amount for QR", hi: "Optional: QR ke liye fixed amount", visual: { title: "💰 Amount", lines: [{ label: "Amount", value: "₹1,500" }] } },
        { en: "QR code generates instantly", hi: "QR code turant ban jata hai", visual: { title: "QR", action: "Show QR to Customer" } },
        { en: "Customer scans and pays via any UPI app", hi: "Customer scan karke kisi bhi UPI app se pay kare", visual: { title: "✅ Paid", lines: [{ label: "Status", value: "Payment received" }] } }
      ]
    },
    {
      id: "calcPanel", panelId: "calcPanel", plans: ["business"], color: "#14b8a6",
      title: "🔢 Calculator",
      hindi: "Site par turant hisaab — bina alag calculator app ke.",
      english: "Quick on-site calculations without leaving the app.",
      steps: [
        { en: "Open Calculator from Tools menu", hi: "Tools se Calculator kholein", visual: { title: "🔢 Calc", lines: [{ label: "Input", value: "2500 × 12", animate: true }] } },
        { en: "Standard + − × ÷ operations", hi: "Standard + − × ÷ operations", visual: { title: "=", lines: [{ label: "Result", value: "30,000" }] } },
        { en: "Use for quick estimates on site", hi: "Site par quick estimate ke liye", visual: { title: "💡 Tip", list: ["Material qty × rate", "Labor days × wage"] } },
        { en: "Clear and recalculate anytime", hi: "Kabhi bhi clear karke dubara calculate", visual: { title: "C", action: "Clear" } }
      ]
    },
    {
      id: "converterPanel", panelId: "converterPanel", plans: ["business"], color: "#2dd4bf",
      title: "🔄 Unit Converter",
      hindi: "Feet-inch, kg, temperature waghera convert — lakdi/steel measurement ke liye.",
      english: "Convert feet-inch, kg, temperature and more for material measurements.",
      steps: [
        { en: "Pick conversion type (length/weight/temp)", hi: "Conversion type chunein", visual: { title: "🔄 Convert", lines: [{ label: "Type", value: "Feet → Meter ▾", animate: true }] } },
        { en: "Enter value to convert", hi: "Value daalein convert karne ke liye", visual: { title: "Input", lines: [{ label: "Feet", value: "10", animate: true }] } },
        { en: "Instant converted result", hi: "Turant converted result", visual: { title: "Output", lines: [{ label: "Meters", value: "3.048 m" }] } },
        { en: "Useful for wood, steel, area estimates", hi: "Lakdi, steel, area estimate ke liye useful", visual: { title: "💡 Use", list: ["Board feet", "Sqft", "Running feet"] } }
      ]
    },
    {
      id: "notesPanel", panelId: "notesPanel", plans: ["business"], color: "#64748b",
      title: "📝 Notes Saver",
      hindi: "Site ki baatein, rate list, quick reminders likh kar save/download karein.",
      english: "Save site notes, rate lists and quick reminders — download as text.",
      steps: [
        { en: "Type note in text area", hi: "Text area mein note likhein", visual: { title: "📝 Note", lines: [{ label: "Text", value: "Plywood rate ₹85/sqft", animate: true }] } },
        { en: "Save note to browser storage", hi: "Note save karein", visual: { title: "💾 Save", action: "Save Note" } },
        { en: "Download as .txt file", hi: ".txt file download karein", visual: { title: "📥 Download", action: "Download .txt" } },
        { en: "Keep rate lists and site reminders", hi: "Rate list aur site reminders rakhein", visual: { title: "📋 Saved", list: ["Supplier rates", "Site phone numbers"] } }
      ]
    },
    {
      id: "mediaPanel", panelId: "mediaPanel", plans: ["business"], color: "#475569",
      title: "📷 Media (Receipt Scanner)",
      hindi: "Kharid ki receipt/parchi ki photo upload karke safe rakhein.",
      english: "Upload and store photos of purchase receipts and bills.",
      steps: [
        { en: "Open Media panel and upload photo", hi: "Media kholein aur photo upload karein", visual: { title: "📷 Upload", action: "Choose Receipt Photo" } },
        { en: "Photo saved securely in your account", hi: "Photo aapke account mein safe save", visual: { title: "☁️ Saved", lines: [{ label: "File", value: "receipt_14sep.jpg" }] } },
        { en: "Browse all uploaded receipts", hi: "Saari uploaded receipts dekhein", visual: { title: "Gallery", list: ["Hardware bill", "Transport bill"] } },
        { en: "Delete when no longer needed", hi: "Zaroorat na ho to delete karein", visual: { title: "🗑️", action: "Delete Photo" } }
      ]
    },
    {
      id: "staffPanel", panelId: "staffPanel", plans: ["business"], color: "#7c3aed",
      title: "👥 Staff (Invite Team)",
      hindi: "Staff/Manager/Cashier ke liye invite code — limited access, alag plan ki zaroorat nahi.",
      english: "Invite Staff/Manager/Cashier with role-based access — no separate plan purchase.",
      steps: [
        { en: "Choose role: Staff / Manager / Cashier", hi: "Role chunein: Staff / Manager / Cashier", visual: { title: "👥 Invite", lines: [{ label: "Role", value: "Cashier ▾", animate: true }] } },
        { en: "Generate invite code", hi: "Invite code generate karein", visual: { title: "🔑 Code", lines: [{ label: "Code", value: "BK-STAFF-7X2K" }], action: "Generate Code" } },
        { en: "Share code — staff signs up with it", hi: "Code share karein — staff signup kare", visual: { title: "📤 Share", action: "WhatsApp Code" } },
        { en: "Staff uses owner's plan automatically", hi: "Staff owner ke plan par auto chalta hai", visual: { title: "✅ Linked", list: ["No extra payment", "Role-based tabs only"] } }
      ]
    },
    {
      id: "companiesPanel", panelId: "companiesPanel", plans: ["business"], color: "#1d4ed8",
      title: "🏢 Companies (Multi-Firm)",
      hindi: "Ek se zyada companies/firms — alag GSTIN, profile har company ke liye.",
      english: "Manage multiple companies with separate GSTIN and profiles.",
      steps: [
        { en: "Add new company with GSTIN and name", hi: "Nayi company GSTIN + naam se add karein", visual: { title: "🏢 New Co.", lines: [{ label: "Name", value: "Sharma Interiors", animate: true }, { label: "GSTIN", value: "06XXXXX" }] } },
        { en: "Switch active company from dropdown", hi: "Dropdown se active company badlein", visual: { title: "🔄 Switch", lines: [{ label: "Active", value: "Sharma Ply ▾" }] } },
        { en: "Each company has separate data", hi: "Har company ka data alag rehta hai", visual: { title: "📊 Data", list: ["Company A — 120 invoices", "Company B — 45 invoices"] } },
        { en: "CA export per company", hi: "Company-wise CA export", visual: { title: "📤 Export", action: "Export Active Company" } }
      ]
    },
    {
      id: "tallySync", panelId: null, plans: ["business"], color: "#16a34a",
      title: "🔗 Tally Sync (Optional)",
      hindi: "Roz ke liye BolKarigar Khata best hai. Tally chahiye ho to Desktop Agent + Tally HTTP port 9000 setup karein.",
      english: "Use BolKarigar Khata daily. Optional Tally sync needs Desktop Agent and Tally HTTP on port 9000.",
      steps: [
        { en: "Install BolKarigar Desktop Agent on PC", hi: "PC par Desktop Agent install karein", visual: { title: "💻 Agent", action: "Download Agent" } },
        { en: "Tally: F1 → Settings → HTTP Server ON, Port 9000", hi: "Tally: F1 → HTTP Server ON, Port 9000", visual: { title: "⚙️ Tally", list: ["Client/Server mode", "Port 9000", "Company open in Tally"] } },
        { en: "Test connection — green tick", hi: "Test connection — green tick aana chahiye", visual: { title: "🔗 Test", action: "Test Tally Connection" } },
        { en: "Sync vouchers to Tally when needed", hi: "Zaroorat par voucher Tally mein sync karein", visual: { title: "✅ Sync", action: "Sync to Tally" } }
      ]
    }
  ];

  window.HELP_MODULE_CATALOG = PRO_MODULES;
  window.HELP_BUSINESS_MODULES = BUSINESS_MODULES;
})();
