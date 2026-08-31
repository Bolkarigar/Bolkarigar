/**
 * BolKarigar — English + Hindi (navbar 🌐 toggle)
 * Default: Hindi. localStorage key: bk_ui_lang (en | hi)
 */
(function (global) {
  const STORAGE_KEY = 'bk_ui_lang';
  const SUPPORTED = ['en', 'hi'];
  const VOICE_LANG = { en: 'en-IN', hi: 'hi-IN' };

  const EN = {
    'app.eyebrow': 'Hindi Voice-First Contractor Tool',
    'app.subtitle': 'AI Dashboard',
    'top.liveTime': 'Live time',
    'top.voiceOff': 'Voice: OFF',
    'top.voiceOn': 'Voice: ON',
    'top.businessProfile': 'Business Profile',
    'top.aiAssistant': 'AI Assistant',
    'top.light': 'Light',
    'top.dark': 'Dark',
    'top.logout': 'Logout',
    'top.staffMode': 'Staff Mode',
    'hero.eyebrow': 'Voice + Business Utility',
    'hero.title': 'Speak and finish invoice, expense, project and notes work faster.',
    'hero.desc': 'Turn Voice ON and say: open invoice, create bill, open attendance — you will hear answers and get work done.',
    'hero.badge1': 'Voice Ready',
    'hero.badge2': 'Invoice Tools',
    'hero.badge3': 'Project Tracking',
    'hero.badge4': 'Responsive UI',
    'hero.modules': 'Modules',
    'hero.voiceParse': 'Voice Parsing',
    'hero.autoMic': 'Auto Mic',
    'hero.yes': 'Yes',
    'hero.toggle': 'Toggle',
    'nav.main': 'Main',
    'nav.business': 'Business',
    'nav.hajri': 'Attendance',
    'nav.accounting': 'Accounting',
    'nav.tools': 'Tools',
    'nav.settings': 'Settings',
    'nav.overview': '🏠 Overview',
    'nav.invoice': '🧾 Invoice',
    'nav.purchase': '📥 Purchase',
    'nav.voice': '🎤 Voice AI',
    'nav.projects': '📁 Projects',
    'nav.inventory': '📦 Inventory',
    'nav.totalSales': '📊 Total Sales',
    'nav.contractor': '👷 Contractor',
    'nav.payroll': '💼 Staff Payroll',
    'nav.udhar': '📖 Credit Ledger',
    'nav.ledgers': '📒 Ledgers',
    'nav.stockItems': '📦 Stock Items',
    'nav.voucher': '🧾 New Voucher',
    'nav.daybook': '📅 Day Book',
    'nav.reports': '📈 Reports Pro',
    'nav.bankRecon': '🏦 Bank Recon',
    'nav.gallery': '🖼️ Gallery',
    'nav.todo': '✅ Todo',
    'nav.qr': '📱 QR Tool',
    'nav.calc': '🔢 Calculator',
    'nav.converter': '🔄 Converter',
    'nav.notes': '📝 Notes',
    'nav.media': '📷 Media',
    'nav.businessCard': '💼 Business Card',
    'nav.staff': '👥 Staff',
    'nav.myPlan': '💳 My Plan',
    'nav.companies': '🏢 Companies',
    'nav.security': '🔐 Security',
    'nav.help': '❓ Help',
    'nav.install': '📱 Install App',
    'security.title': '🔐 Security & App Lock',
    'security.subtitle': 'Khatabook style — app opens only after PIN or Face ID',
    'security.appLock': 'App Lock',
    'security.pinHint': 'Set a 4-digit PIN. App will ask PIN when reopened.',
    'security.changePin': '🔑 Change PIN',
    'security.testLock': '🔒 Test Lock',
    'security.biometric': 'Face ID / Fingerprint',
    'security.biometricHint': 'Unlock with biometric on supported devices',
    'security.tipsTitle': '💡 Tips',
    'security.tip1': 'App locks again when sent to background',
    'security.tip2': 'PIN stays on this device only — not sent to server',
    'security.tip3': 'Forgot PIN? Logout and set a new PIN after login',
    'overview.eyebrow': 'Dashboard Summary',
    'overview.title': 'AI Accountant & Business Overview',
    'overview.totalSales': 'Total Sales',
    'overview.totalExpense': 'Total Expense',
    'overview.netProfit': 'Net Profit / Loss',
    'overview.totalUdhar': 'Total Credit Due',
    'overview.dailyTitle': "Today's Summary",
    'overview.aajCash': 'Today Cash',
    'overview.aajUpi': 'Today UPI',
    'overview.aajUdhar': 'Today Credit Sale',
    'overview.aajCollection': 'Today Collection',
    'overview.todayBills': "Today's bills:",
    'overview.refresh': '🔄 Refresh',
    'overview.cardVoiceTitle': 'Voice Command',
    'overview.cardVoiceDesc': 'Open tabs and create bills using mic commands.',
    'overview.cardProjectTitle': 'Project Tracker',
    'overview.cardProjectDesc': 'Save projects with customer, site, budget and status.',
    'overview.cardExpenseTitle': 'Expense + Invoice',
    'overview.cardExpenseDesc': 'Rate, quantity and total calculate automatically.',
    'overview.cardUtilityTitle': 'Utility Pack',
    'overview.cardUtilityDesc': 'Todo, notes, QR, calculator, converter and media tools included.',
    'voice.eyebrow': 'Speech input',
    'voice.title': 'Voice Command Panel',
    'voice.tryTitle': 'Try commands',
    'voice.cmd1': '"Open todo list"',
    'voice.cmd2': '"Open QR tool"',
    'voice.cmd3': '"Dark mode on"',
    'voice.cmd4': '"Overview"',
    'voice.statusTitle': 'Voice status',
    'voice.statusReady': 'Voice system ready.',
    'voice.start': 'Start Listening',
    'voice.stop': 'Stop',
    'voice.sampleInvoice': 'Sample Invoice',
    'voice.sampleProject': 'Sample Project',
    'voice.sampleExpense': 'Sample Expense',
    'voice.transcriptPh': 'Voice transcript will appear here...',
    'todo.eyebrow': 'Task manager',
    'todo.title': 'Todo Manager',
    'todo.placeholder': 'Add a task...',
    'todo.add': 'Add task',
    'todo.clear': 'Clear all',
    'todo.statusEmpty': 'Your tasks will appear below.',
    'todo.statusCount': '{n} task(s) added.',
    'qr.eyebrow': 'QR sharing',
    'qr.title': 'QR Generator',
    'qr.placeholder': 'Enter text or URL...',
    'qr.generate': 'Generate QR',
    'qr.clear': 'Clear',
    'calc.eyebrow': 'Quick math',
    'calc.title': 'Calculator',
    'converter.eyebrow': 'Units',
    'converter.title': 'Unit Converter',
    'converter.length': 'Length',
    'converter.weight': 'Weight',
    'converter.temperature': 'Temperature',
    'converter.placeholder': 'Enter value',
    'converter.convert': 'Convert',
    'converter.result': 'Converted value will appear here.',
    'notes.eyebrow': 'Personal notes',
    'notes.title': 'Notes Saver',
    'notes.placeholder': 'Write your notes here...',
    'notes.download': 'Download notes',
    'notes.clear': 'Clear notes',
    'notes.empty': 'No notes saved yet.',
    'businessCard.eyebrow': 'Digital Visiting Card',
    'businessCard.title': 'Business Card Maker',
    'businessCard.hint': 'Select a card → fill details → Download or share on WhatsApp. 12 free designs, 25 premium luxury cards.',
    'businessCard.freeTab': '🆓 Free Plan — 12 Cards',
    'businessCard.premiumTab': '👑 Business Plan — 25 Premium',
    'businessCard.personalDetails': 'Personal Details',
    'businessCard.yourName': 'Your Name',
    'businessCard.designation': 'Designation',
    'businessCard.mobile': 'Mobile Number',
    'businessCard.businessDetails': 'Business Card Details',
    'businessCard.businessName': 'Business Name',
    'businessCard.shopType': 'Shop or Office?',
    'businessCard.email': 'Business Email',
    'businessCard.category': 'Business Category',
    'businessCard.gst': 'GST Number',
    'businessCard.address': 'Shop / Office Address',
    'businessCard.save': '💾 Save',
    'businessCard.download': '⬇ Download',
    'businessCard.whatsapp': '📲 WhatsApp Share',
    'businessCard.previewHint': 'Preview updates live as you fill details',
    'gallery.eyebrow': 'Products',
    'gallery.title': 'Product Gallery',
    'gallery.status': 'Upload your product photos here.',
    'common.delete': 'Delete',
    'common.close': 'Close',
    'common.copy': 'Copy',
    'login.title': 'BolKarigar AI',
    'login.subtitle': 'Sign in to your account',
    'login.username': 'Username',
    'login.password': 'Password',
    'login.forgot': 'Forgot Password?',
    'login.signIn': 'Sign In',
    'login.error': 'Wrong username or password!',
    'forgot.title': 'Reset Password',
    'forgot.desc': 'Enter your registered email. We will send a 6-digit OTP.',
    'forgot.cancel': 'Cancel',
    'forgot.sendOtp': 'Send OTP',
    'forgot.sending': 'Sending...',
    'forgot.otpTitle': 'Verify OTP',
    'forgot.otpDesc': 'Enter the 6-digit OTP sent to your email.',
    'forgot.otpPlaceholder': '6-digit OTP',
    'forgot.newPass': 'New password',
    'forgot.confirmPass': 'Confirm new password',
    'forgot.setPass': 'Set Password',
    'forgot.resend': 'Did not get OTP? Resend',
    'forgot.notRegistered': 'OTP is sent only to registered signup email. Check spam folder.',
    'forgot.sent': 'If this email is registered, OTP has been sent. Check spam/junk too.',
    'paywall.title': 'Free Trial Ended',
    'paywall.desc': 'Renew Business plan (₹299/month). Pro Dukaan is completely FREE.',
    'paywall.staffNote': 'Staff do not need separate purchase — owner plan covers them.',
    'sub.bannerAction': 'My Plan',
    'menu.open': 'Open menu',
    'menu.close': 'Close menu',
    'tally.summary': '💻 Tally Sync Agent',
    'tally.hint': 'Run Agent on your PC for cloud Tally sync.',
    'tally.download': '📥 Download Agent (.exe)',
    'tally.token': 'Pairing Token:',
    'tally.reset': '⚠️ Reset Token',
    'project.eyebrow': 'Client work',
    'project.title': 'Project Tracker',
    'project.namePh': 'Project name',
    'project.customerPh': 'Customer name',
    'project.sitePh': 'Site / location',
    'project.budgetPh': 'Budget',
    'project.notePh': 'Short note',
    'project.statusPlanning': 'Planning',
    'project.statusRunning': 'Running',
    'project.statusCompleted': 'Completed',
    'project.add': 'Add Project',
    'project.clear': 'Clear Projects',
    'project.statusEmpty': 'Projects will appear below.',
    'project.expenseTitle': 'Quick Expense Entry',
    'project.expenseTitlePh': 'Expense title',
    'project.expenseVendorPh': 'Vendor name',
    'project.expenseAmountPh': 'Amount',
    'project.expenseProjectPh': 'Project reference',
    'project.addExpense': 'Add Expense',
    'project.clearExpense': 'Clear Expenses',
    'invoice.eyebrow': 'Sales helper',
    'invoice.title': 'Invoice Generator',
    'invoice.customerPh': 'Customer / Buyer name *',
    'invoice.status': 'Fill details and add items.',
    'inventory.eyebrow': 'Stock Management',
    'inventory.title': 'Smart Inventory Tracker',
    'inventory.hint': 'Stock auto-updates from invoice/voucher — HSN, GST, godown & low-stock alerts.',
    'ledger.eyebrow': 'Accounts Receivable',
    'ledger.title': '📖 Credit Ledger (Udhar Khata)',
    'sales.eyebrow': 'Permanent Record',
    'sales.title': '📊 Total Sales History (2 Years Archive)',
    'sales.searchPh': '🔍 Name or Invoice No...',
    'sales.fromDate': 'From Date',
    'sales.toDate': 'To Date',
    'sales.applyFilter': 'Apply Filter',
    'sales.clearFilter': 'Clear',
    'sales.thisMonth': 'This Month',
    'sales.lastMonth': 'Last Month',
    'sales.thisYear': 'This Year',
    'reports.eyebrow': 'Professional Reports',
    'reports.title': '📈 Reports Pro',
    'contractor.eyebrow': 'Construction / Contractor',
    'contractor.title': '👷 Contractor Tools',
    'payroll.eyebrow': 'Business Plan — ₹299',
    'payroll.title': '💼 Staff Payroll & Hajri',
    'payroll.hint': 'Monthly salary, daily attendance, half-day, leave and advance — auto calculated.',
    'staff.eyebrow': 'Team Management',
    'staff.title': '👥 Staff & Cashier Login',
    'staff.hint': 'Generate invite codes by role — staff cannot choose their own role.',
    'myplan.eyebrow': 'Subscription',
    'myplan.title': '💳 My Plan',
    'bank.eyebrow': 'Banking',
    'bank.title': '🏦 Bank Reconciliation',
    'companies.eyebrow': 'Multi Business',
    'companies.title': '🏢 Companies',
    'media.eyebrow': 'Preview and search',
    'media.title': 'Media Tools & Bill Scanner',
    'help.eyebrow': 'Master User Guide',
    'help.title': '❓ App Modules & Buttons Manual',
    'help.loading': 'Modules will appear here after your plan loads.',
    'accounting.eyebrow': 'Accounting',
    'accounting.ledgers': '📒 Ledgers',
    'accounting.stockItems': '📦 Stock Items',
    'accounting.voucher': '🧾 New Voucher',
    'accounting.daybook': '📅 Day Book',
    'gallery.upload': '📷 Upload Photo',
    'top.langToEn': 'Switch to English',
    'top.langToHi': 'Switch to Hindi'
  };

  const HI = {
    'app.eyebrow': 'हिंदी वॉइस-फर्स्ट ठेकेदार टूल',
    'app.subtitle': 'AI डैशबोर्ड',
    'top.liveTime': 'लाइव समय',
    'top.voiceOff': 'वॉइस: बंद',
    'top.voiceOn': 'वॉइस: चालू',
    'top.businessProfile': 'बिज़नेस प्रोफाइल',
    'top.aiAssistant': 'AI सहायक',
    'top.light': 'लाइट',
    'top.dark': 'डार्क',
    'top.logout': 'लॉगआउट',
    'top.staffMode': 'स्टाफ मोड',
    'hero.eyebrow': 'वॉइस + बिज़नेस यूटिलिटी',
    'hero.title': 'बोलकर इनवॉइस, खर्चा, प्रोजेक्ट और नोट्स का काम तेज़ करें।',
    'hero.desc': 'वॉइस ON करके बोलें: इनवॉइस खोलो, बिल बनाओ, हाजरी खोलो — जवाब सुनें और काम हो जाएगा।',
    'hero.badge1': 'वॉइस रेडी',
    'hero.badge2': 'इनवॉइस टूल',
    'hero.badge3': 'प्रोजेक्ट ट्रैकिंग',
    'hero.badge4': 'रिस्पॉन्सिव UI',
    'hero.modules': 'मॉड्यूल',
    'hero.voiceParse': 'वॉइस पार्सिंग',
    'hero.autoMic': 'ऑटो माइक',
    'hero.yes': 'हाँ',
    'hero.toggle': 'टॉगल',
    'nav.main': 'मुख्य',
    'nav.business': 'बिज़नेस',
    'nav.hajri': 'हाजरी',
    'nav.accounting': 'लेखा',
    'nav.tools': 'टूल्स',
    'nav.settings': 'सेटिंग्स',
    'nav.overview': '🏠 ओवरव्यू',
    'nav.invoice': '🧾 इनवॉइस',
    'nav.purchase': '📥 खरीद',
    'nav.voice': '🎤 वॉइस AI',
    'nav.projects': '📁 प्रोजेक्ट',
    'nav.inventory': '📦 इन्वेंटरी',
    'nav.totalSales': '📊 कुल बिक्री',
    'nav.contractor': '👷 ठेकेदार',
    'nav.payroll': '💼 स्टाफ पेरोल',
    'nav.udhar': '📖 उधार खाता',
    'nav.ledgers': '📒 लेजर',
    'nav.stockItems': '📦 स्टॉक आइटम',
    'nav.voucher': '🧾 नया वाउचर',
    'nav.daybook': '📅 डे बुक',
    'nav.reports': '📈 रिपोर्ट्स प्रो',
    'nav.bankRecon': '🏦 बैंक रिकॉन',
    'nav.gallery': '🖼️ गैलरी',
    'nav.todo': '✅ टूडू',
    'nav.qr': '📱 QR टूल',
    'nav.calc': '🔢 कैलकुलेटर',
    'nav.converter': '🔄 कन्वर्टर',
    'nav.notes': '📝 नोट्स',
    'nav.media': '📷 मीडिया',
    'nav.businessCard': '💼 बिज़नेस कार्ड',
    'nav.staff': '👥 स्टाफ',
    'nav.myPlan': '💳 मेरा प्लान',
    'nav.companies': '🏢 कंपनियाँ',
    'nav.security': '🔐 सुरक्षा',
    'nav.help': '❓ सहायता',
    'nav.install': '📱 ऐप इंस्टॉल',
    'security.title': '🔐 सुरक्षा और ऐप लॉक',
    'security.subtitle': 'खाताबुक जैसा — ऐप PIN या Face ID के बाद ही खुलेगा',
    'security.appLock': 'ऐप लॉक',
    'security.pinHint': '4 अंकों का PIN सेट करें। ऐप दोबारा खोलने पर PIN मांगेगा।',
    'security.changePin': '🔑 PIN बदलें',
    'security.testLock': '🔒 लॉक टेस्ट',
    'security.biometric': 'Face ID / फिंगरप्रिंट',
    'security.biometricHint': 'सपोर्टेड फोन पर बायोमेट्रिक अनलॉक',
    'security.tipsTitle': '💡 टिप्स',
    'security.tip1': 'ऐप बैकग्राउंड में जाने पर दोबारा लॉक हो जाएगा',
    'security.tip2': 'PIN सिर्फ इस फोन पर रहता है — सर्वर पर नहीं जाता',
    'security.tip3': 'PIN भूल गए? Logout करके नया PIN सेट करें',
    'overview.eyebrow': 'डैशबोर्ड सारांश',
    'overview.title': 'AI अकाउंटेंट और बिज़नेस ओवरव्यू',
    'overview.totalSales': 'कुल बिक्री',
    'overview.totalExpense': 'कुल खर्चा',
    'overview.netProfit': 'मुनाफा / घाटा',
    'overview.totalUdhar': 'कुल बकाया',
    'overview.dailyTitle': 'आज का हिसाब',
    'overview.aajCash': 'आज कैश',
    'overview.aajUpi': 'आज UPI',
    'overview.aajUdhar': 'आज उधार बिक्री',
    'overview.aajCollection': 'आज वसूली',
    'overview.todayBills': 'आज के बिल:',
    'overview.refresh': '🔄 रिफ्रेश',
    'overview.cardVoiceTitle': 'वॉइस कमांड',
    'overview.cardVoiceDesc': 'माइक से कमांड बोलकर टैब खोलें और बिल बनाएं।',
    'overview.cardProjectTitle': 'प्रोजेक्ट ट्रैकर',
    'overview.cardProjectDesc': 'ग्राहक, साइट, बजट और स्टेटस के साथ प्रोजेक्ट सेव करें।',
    'overview.cardExpenseTitle': 'खर्चा + इनवॉइस',
    'overview.cardExpenseDesc': 'रेट, मात्रा और टोटल अपने आप कैलकुलेट होता है।',
    'overview.cardUtilityTitle': 'यूटिलिटी पैक',
    'overview.cardUtilityDesc': 'टूडू, नोट्स, QR, कैलकुलेटर, कन्वर्टर और मीडिया टूल शामिल हैं।',
    'voice.eyebrow': 'स्पीच इनपुट',
    'voice.title': 'वॉइस कमांड पैनल',
    'voice.tryTitle': 'कमांड आज़माएं',
    'voice.cmd1': '"टूडू लिस्ट खोलो"',
    'voice.cmd2': '"QR टूल खोलो"',
    'voice.cmd3': '"डार्क मोड ऑन"',
    'voice.cmd4': '"ओवरव्यू"',
    'voice.statusTitle': 'वॉइस स्टेटस',
    'voice.statusReady': 'वॉइस सिस्टम तैयार है।',
    'voice.start': 'सुनना शुरू करें',
    'voice.stop': 'बंद करें',
    'voice.sampleInvoice': 'सैंपल इनवॉइस',
    'voice.sampleProject': 'सैंपल प्रोजेक्ट',
    'voice.sampleExpense': 'सैंपल खर्चा',
    'voice.transcriptPh': 'वॉइस ट्रांसक्रिप्ट यहाँ दिखेगा...',
    'todo.eyebrow': 'टास्क मैनेजर',
    'todo.title': 'टूडू मैनेजर',
    'todo.placeholder': 'नया काम लिखें...',
    'todo.add': 'काम जोड़ें',
    'todo.clear': 'सब साफ करें',
    'todo.statusEmpty': 'आपके काम नीचे दिखेंगे।',
    'todo.statusCount': '{n} काम जोड़े गए।',
    'qr.eyebrow': 'QR शेयरिंग',
    'qr.title': 'QR जनरेटर',
    'qr.placeholder': 'टेक्स्ट या URL लिखें...',
    'qr.generate': 'QR बनाएं',
    'qr.clear': 'साफ करें',
    'calc.eyebrow': 'जल्दी गणित',
    'calc.title': 'कैलकुलेटर',
    'converter.eyebrow': 'इकाइयाँ',
    'converter.title': 'यूनिट कन्वर्टर',
    'converter.length': 'लंबाई',
    'converter.weight': 'वज़न',
    'converter.temperature': 'तापमान',
    'converter.placeholder': 'मान लिखें',
    'converter.convert': 'कन्वर्ट करें',
    'converter.result': 'कन्वर्टेड मान यहाँ दिखेगा।',
    'notes.eyebrow': 'निजी नोट्स',
    'notes.title': 'नोट्स सेवर',
    'notes.placeholder': 'अपने नोट्स यहाँ लिखें...',
    'notes.download': 'नोट्स डाउनलोड',
    'notes.clear': 'नोट्स साफ करें',
    'notes.empty': 'अभी कोई नोट सेव नहीं।',
    'businessCard.eyebrow': 'डिजिटल विज़िटिंग कार्ड',
    'businessCard.title': 'बिज़नेस कार्ड मेकर',
    'businessCard.hint': 'कार्ड चुनें → details भरें → Download या WhatsApp पर share करें। Free में 12 designs, Premium में 25 luxury cards।',
    'businessCard.freeTab': '🆓 Free Plan — 12 Cards',
    'businessCard.premiumTab': '👑 Business Plan — 25 Premium',
    'businessCard.personalDetails': 'Personal Details',
    'businessCard.yourName': 'आपका नाम',
    'businessCard.designation': 'पद / Designation',
    'businessCard.mobile': 'मोबाइल नंबर',
    'businessCard.businessDetails': 'Business Card Details',
    'businessCard.businessName': 'दुकान / Business का नाम',
    'businessCard.shopType': 'Shop या Office?',
    'businessCard.email': 'Business Email',
    'businessCard.category': 'Business Category',
    'businessCard.gst': 'GST नंबर',
    'businessCard.address': 'दुकान / Office का पता',
    'businessCard.save': '💾 Save',
    'businessCard.download': '⬇ Download',
    'businessCard.whatsapp': '📲 WhatsApp Share',
    'businessCard.previewHint': 'Details भरते ही preview live update होता है',
    'gallery.eyebrow': 'प्रोडक्ट',
    'gallery.title': 'प्रोडक्ट गैलरी',
    'gallery.status': 'अपनी प्रोडक्ट फोटो यहाँ अपलोड करें।',
    'common.delete': 'हटाएं',
    'common.close': 'बंद करें',
    'common.copy': 'कॉपी',
    'login.title': 'BolKarigar AI',
    'login.subtitle': 'अपने अकाउंट में लॉगिन करें',
    'login.username': 'यूज़रनेम',
    'login.password': 'पासवर्ड',
    'login.forgot': 'पासवर्ड भूल गए?',
    'login.signIn': 'साइन इन',
    'login.error': 'गलत यूज़रनेम या पासवर्ड!',
    'forgot.title': 'पासवर्ड रीसेट',
    'forgot.desc': 'अपना रजिस्टर्ड ईमेल डालें। हम 6 अंकों का OTP भेजेंगे।',
    'forgot.cancel': 'रद्द करें',
    'forgot.sendOtp': 'OTP भेजें',
    'forgot.sending': 'भेज रहे हैं...',
    'forgot.otpTitle': 'OTP सत्यापित करें',
    'forgot.otpDesc': 'ईमेल पर भेजा गया 6 अंकों का OTP यहाँ डालें।',
    'forgot.otpPlaceholder': '6 अंकों का OTP',
    'forgot.newPass': 'नया पासवर्ड',
    'forgot.confirmPass': 'नया पासवर्ड दोबारा',
    'forgot.setPass': 'पासवर्ड सेट करें',
    'forgot.resend': 'OTP नहीं मिला? दोबारा भेजें',
    'forgot.notRegistered': 'OTP सिर्फ साइनअप वाली रजिस्टर्ड ईमेल पर आता है। स्पैम फ़ोल्डर भी देखें।',
    'forgot.sent': 'अगर यह ईमेल रजिस्टर्ड है, तो OTP भेज दिया गया है। स्पैम/Junk भी चेक करें।',
    'paywall.title': 'Plan Renew',
    'paywall.desc': 'Business plan (₹299/month) renew karein. Pro Dukaan bilkul FREE hai.',
    'paywall.staffNote': 'स्टाफ को अलग से खरीदने की ज़रूरत नहीं — मालिक का प्लान कवर करता है।',
    'sub.bannerAction': 'मेरा प्लान',
    'menu.open': 'मेनू खोलें',
    'menu.close': 'मेनू बंद करें',
    'tally.summary': '💻 Tally सिंक एजेंट',
    'tally.hint': 'क्लाउड Tally सिंक के लिए अपने PC पर एजेंट चलाएं।',
    'tally.download': '📥 एजेंट डाउनलोड (.exe)',
    'tally.token': 'पेयरिंग टोकन:',
    'tally.reset': '⚠️ टोकन रीसेट',
    'project.eyebrow': 'क्लाइंट काम',
    'project.title': 'प्रोजेक्ट ट्रैकर',
    'project.namePh': 'प्रोजेक्ट का नाम',
    'project.customerPh': 'ग्राहक का नाम',
    'project.sitePh': 'साइट / लोकेशन',
    'project.budgetPh': 'बजट',
    'project.notePh': 'छोटा नोट',
    'project.statusPlanning': 'प्लानिंग',
    'project.statusRunning': 'चल रहा',
    'project.statusCompleted': 'पूरा',
    'project.add': 'प्रोजेक्ट जोड़ें',
    'project.clear': 'प्रोजेक्ट साफ करें',
    'project.statusEmpty': 'प्रोजेक्ट नीचे दिखेंगे।',
    'project.expenseTitle': 'जल्दी खर्चा एंट्री',
    'project.expenseTitlePh': 'खर्चे का शीर्षक',
    'project.expenseVendorPh': 'विक्रेता का नाम',
    'project.expenseAmountPh': 'राशि',
    'project.expenseProjectPh': 'प्रोजेक्ट संदर्भ',
    'project.addExpense': 'खर्चा जोड़ें',
    'project.clearExpense': 'खर्चे साफ करें',
    'invoice.eyebrow': 'बिक्री सहायक',
    'invoice.title': 'इनवॉइस जनरेटर',
    'invoice.customerPh': 'ग्राहक / खरीदार का नाम *',
    'invoice.status': 'विवरण भरें और आइटम जोड़ें।',
    'inventory.eyebrow': 'स्टॉक प्रबंधन',
    'inventory.title': '📦 स्मार्ट इन्वेंटरी ट्रैकर',
    'inventory.hint': 'इनवॉइस/वाउचर से स्टॉक ऑटो अपडेट — HSN, GST, गोदाम और कम स्टॉक अलर्ट।',
    'ledger.eyebrow': 'प्राप्य खाते',
    'ledger.title': '📖 उधार खाता',
    'sales.eyebrow': 'स्थायी रिकॉर्ड',
    'sales.title': '📊 कुल बिक्री इतिहास (2 साल आर्काइव)',
    'sales.searchPh': '🔍 नाम या इनवॉइस नंबर...',
    'sales.fromDate': 'शुरू तारीख',
    'sales.toDate': 'अंत तारीख',
    'sales.applyFilter': 'फ़िल्टर लगाएं',
    'sales.clearFilter': 'हटाएं',
    'sales.thisMonth': 'इस महीने',
    'sales.lastMonth': 'पिछला महीना',
    'sales.thisYear': 'इस साल',
    'reports.eyebrow': 'प्रोफेशनल रिपोर्ट्स',
    'reports.title': '📈 रिपोर्ट्स प्रो',
    'contractor.eyebrow': 'निर्माण / ठेकेदार',
    'contractor.title': '👷 ठेकेदार टूल्स',
    'payroll.eyebrow': 'बिज़नेस प्लान — ₹299',
    'payroll.title': '💼 स्टाफ पेरोल और हाजरी',
    'payroll.hint': 'मासिक वेतन, दैनिक हाजरी, आधा दिन, छुट्टी और एडवांस — ऑटो कैलकुलेट।',
    'staff.eyebrow': 'टीम प्रबंधन',
    'staff.title': '👥 स्टाफ और कैशियर लॉगिन',
    'staff.hint': 'रोल के हिसाब से इनवाइट कोड बनाएं — स्टाफ खुद रोल नहीं चुन सकता।',
    'myplan.eyebrow': 'सब्सक्रिप्शन',
    'myplan.title': '💳 मेरा प्लान',
    'bank.eyebrow': 'बैंकिंग',
    'bank.title': '🏦 बैंक रिकॉन्सिलिएशन',
    'companies.eyebrow': 'मल्टी बिज़नेस',
    'companies.title': '🏢 कंपनियाँ',
    'media.eyebrow': 'प्रीव्यू और खोज',
    'media.title': 'मीडिया टूल और पर्ची स्कैनर',
    'help.eyebrow': 'मास्टर यूज़र गाइड',
    'help.title': '❓ ऐप मॉड्यूल और बटन मैनुअल',
    'help.loading': 'आपका प्लान लोड होने के बाद यहाँ मॉड्यूल दिखेंगे।',
    'accounting.eyebrow': 'लेखा',
    'accounting.ledgers': '📒 लेजर',
    'accounting.stockItems': '📦 स्टॉक आइटम',
    'accounting.voucher': '🧾 नया वाउचर',
    'accounting.daybook': '📅 डे बुक',
    'gallery.upload': '📷 फोटो अपलोड',
    'top.langToEn': 'अंग्रेजी में बदलें',
    'top.langToHi': 'हिंदी में बदलें'
  };

  const STR = { en: EN, hi: HI };

  function bkGetLang() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'en' ? 'en' : 'hi';
  }

  function bkNormalizeLang() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== 'en' && saved !== 'hi') {
      localStorage.setItem(STORAGE_KEY, 'hi');
    }
    return bkGetLang();
  }

  function bkT(key, vars) {
    const L = bkGetLang();
    const pack = STR[L] || STR.en;
    let text = (pack && pack[key]) || STR.en[key] || key;
    if (vars && typeof vars === 'object') {
      Object.keys(vars).forEach((k) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(vars[k]));
      });
    }
    return text;
  }

  function bkSetLang(lang) {
    if (!SUPPORTED.includes(lang)) return;
    localStorage.setItem(STORAGE_KEY, lang);
    localStorage.setItem('bk_voice_lang', VOICE_LANG[lang] || 'hi-IN');
    document.documentElement.lang = lang;
    bkApplyI18n();
    bkUpdateLangButton();
    document.dispatchEvent(new CustomEvent('bk:langchange', { detail: { lang } }));
  }

  function bkToggleLang() {
    bkSetLang(bkGetLang() === 'hi' ? 'en' : 'hi');
  }

  function bkUpdateLangButton() {
    const btn = document.getElementById('bkLangToggleBtn');
    if (!btn) return;
    const L = bkGetLang();
    btn.textContent = L === 'hi' ? '🌐 EN' : '🌐 हिं';
    btn.title = bkT(L === 'hi' ? 'top.langToEn' : 'top.langToHi');
    btn.setAttribute('aria-label', btn.title);
  }

  function bkMountLangToggle() {
    const btn = document.getElementById('bkLangToggleBtn');
    if (!btn || btn.dataset.mounted) return;
    btn.dataset.mounted = '1';
    btn.addEventListener('click', () => bkToggleLang());
    bkUpdateLangButton();
  }

  function bkApplyI18n(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      if (el.closest('#helpPanel')) return;
      const key = el.getAttribute('data-i18n');
      if (!key || el.hasAttribute('data-i18n-placeholder')) return;
      const val = bkT(key);
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.value = val;
      else el.textContent = val;
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      if (el.closest('#helpPanel')) return;
      el.placeholder = bkT(el.getAttribute('data-i18n-placeholder'));
    });
    scope.querySelectorAll('[data-i18n-title]').forEach((el) => {
      if (el.closest('#helpPanel')) return;
      el.title = bkT(el.getAttribute('data-i18n-title'));
    });
    scope.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      if (el.closest('#helpPanel')) return;
      el.setAttribute('aria-label', bkT(el.getAttribute('data-i18n-aria')));
    });
    scope.querySelectorAll('option[data-i18n]').forEach((el) => {
      if (el.closest('#helpPanel')) return;
      el.textContent = bkT(el.getAttribute('data-i18n'));
    });
    const heroYes = document.querySelector('.hero-stats .stat-card:nth-child(2) strong');
    const heroToggle = document.querySelector('.hero-stats .stat-card:nth-child(3) strong');
    if (heroYes) heroYes.textContent = bkT('hero.yes');
    if (heroToggle) heroToggle.textContent = bkT('hero.toggle');
    bkUpdateLangButton();
  }

  function bkInjectLangSelector() { bkMountLangToggle(); }

  global.BK_I18N_SUPPORTED = SUPPORTED;
  global.bkGetLang = bkGetLang;
  global.bkSetLang = bkSetLang;
  global.bkToggleLang = bkToggleLang;
  global.bkT = bkT;
  global.bkApplyI18n = bkApplyI18n;
  global.bkMountLangToggle = bkMountLangToggle;
  global.bkUpdateLangButton = bkUpdateLangButton;
  global.bkInjectLangSelector = bkInjectLangSelector;

  bkNormalizeLang();
  document.documentElement.lang = bkGetLang();
  function bkInitI18n() {
    bkApplyI18n();
    bkMountLangToggle();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bkInitI18n);
  } else {
    bkInitI18n();
  }
})(typeof window !== 'undefined' ? window : global);
