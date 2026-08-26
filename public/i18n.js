/**
 * BolKarigar — UI translations (English, Hindi, Marathi, Punjabi, Bengali, Gujarati)
 */
(function (global) {
  const STORAGE_KEY = 'bk_ui_lang';
  const SUPPORTED = ['en', 'hi', 'mr', 'pa', 'bn', 'gu'];

  const VOICE_LANG = {
    en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN', pa: 'pa-IN', bn: 'bn-IN', gu: 'gu-IN'
  };

  const LABELS = {
    en: 'English', hi: 'हिंदी', mr: 'मराठी', pa: 'ਪੰਜਾਬੀ', bn: 'বাংলা', gu: 'ગુજરાતી'
  };

  const STR = {
    en: {
      'app.eyebrow': 'Hindi Voice-First Contractor Tool',
      'app.title': 'BolKarigar',
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
      'top.language': 'Language',
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
      'nav.main': 'Main',
      'nav.business': 'Business',
      'nav.hajri': 'Attendance',
      'nav.accounting': 'Accounting',
      'nav.tools': 'Tools',
      'nav.settings': 'Settings',
      'nav.overview': '🏠 Overview',
      'nav.invoice': '🧾 Invoice',
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
      'nav.staff': '👥 Staff',
      'nav.myPlan': '💳 My Plan',
      'nav.companies': '🏢 Companies',
      'nav.help': '❓ Help',
      'nav.install': '📱 Install App',
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
      'overview.lowStock': 'Low Stock',
      'login.title': 'BolKarigar AI',
      'login.subtitle': 'Sign in to your account',
      'login.username': 'Username',
      'login.password': 'Password',
      'login.forgot': 'Forgot Password?',
      'login.signIn': 'Sign In',
      'login.error': 'Wrong username or password!',
      'login.signup': 'Create new account?',
      'login.signupLink': 'Sign Up',
      'login.pricing': 'Pricing',
      'login.staff': 'Staff/Cashier?',
      'login.staffLink': 'Create staff account (Invite Code)',
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
      'paywall.desc': 'Your 3-day Pro trial ended. Renew plan to continue.',
      'paywall.staffNote': 'Staff do not need separate purchase — owner plan covers them.',
      'sub.bannerAction': 'My Plan',
      'menu.open': 'Open menu',
      'menu.close': 'Close menu'
    },
    hi: {
      'app.eyebrow': 'हिंदी वॉइस-फर्स्ट ठेकेदार टूल',
      'app.title': 'BolKarigar',
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
      'top.language': 'भाषा',
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
      'nav.main': 'मुख्य',
      'nav.business': 'बिज़नेस',
      'nav.hajri': 'हाजरी',
      'nav.accounting': 'लेखा',
      'nav.tools': 'टूल्स',
      'nav.settings': 'सेटिंग्स',
      'nav.overview': '🏠 ओवरव्यू',
      'nav.invoice': '🧾 इनवॉइस',
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
      'nav.staff': '👥 स्टाफ',
      'nav.myPlan': '💳 मेरा प्लान',
      'nav.companies': '🏢 कंपनियाँ',
      'nav.help': '❓ सहायता',
      'nav.install': '📱 ऐप इंस्टॉल',
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
      'overview.lowStock': 'कम स्टॉक',
      'login.title': 'BolKarigar AI',
      'login.subtitle': 'अपने अकाउंट में लॉगिन करें',
      'login.username': 'यूज़रनेम',
      'login.password': 'पासवर्ड',
      'login.forgot': 'पासवर्ड भूल गए?',
      'login.signIn': 'साइन इन',
      'login.error': 'गलत यूज़रनेम या पासवर्ड!',
      'login.signup': 'नया अकाउंट बनाना है?',
      'login.signupLink': 'साइन अप करें',
      'login.pricing': 'प्राइसिंग',
      'login.staff': 'स्टाफ/कैशियर हो?',
      'login.staffLink': 'स्टाफ अकाउंट बनाएं (इनवाइट कोड)',
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
      'paywall.title': 'फ्री ट्रायल खत्म',
      'paywall.desc': 'आपका 3 दिन का Pro ट्रायल खत्म हो गया। जारी रखने के लिए प्लान लें।',
      'paywall.staffNote': 'स्टाफ को अलग से खरीदने की ज़रूरत नहीं — मालिक का प्लान कवर करता है।',
      'sub.bannerAction': 'मेरा प्लान',
      'menu.open': 'मेनू खोलें',
      'menu.close': 'मेनू बंद करें'
    },
    mr: {
      'app.eyebrow': 'हिंदी व्हॉइस-फर्स्ट ठेकेदार साधन',
      'app.subtitle': 'AI डॅशबोर्ड',
      'top.liveTime': 'थेट वेळ',
      'top.voiceOff': 'व्हॉइस: बंद',
      'top.voiceOn': 'व्हॉइस: चालू',
      'top.businessProfile': 'व्यवसाय प्रोफाइल',
      'top.aiAssistant': 'AI सहाय्यक',
      'top.light': 'लाइट',
      'top.dark': 'डार्क',
      'top.logout': 'लॉगआउट',
      'top.language': 'भाषा',
      'nav.main': 'मुख्य', 'nav.business': 'व्यवसाय', 'nav.hajri': 'हजेरी', 'nav.accounting': 'लेखा',
      'nav.tools': 'साधने', 'nav.settings': 'सेटिंग्ज',
      'nav.overview': '🏠 आढावा', 'nav.invoice': '🧾 इनव्हॉइस', 'nav.voice': '🎤 व्हॉइस AI',
      'nav.projects': '📁 प्रकल्प', 'nav.inventory': '📦 इन्व्हेंटरी', 'nav.totalSales': '📊 एकूण विक्री',
      'nav.contractor': '👷 ठेकेदार', 'nav.payroll': '💼 कर्मचारी पगार', 'nav.udhar': '📖 उधार खाते',
      'nav.ledgers': '📒 लेजर', 'nav.stockItems': '📦 स्टॉक', 'nav.voucher': '🧾 नवीन व्हाउचर',
      'nav.daybook': '📅 डे बुक', 'nav.reports': '📈 अहवाल', 'nav.bankRecon': '🏦 बँक रिकॉन',
      'nav.gallery': '🖼️ गॅलरी', 'nav.todo': '✅ टूडू', 'nav.qr': '📱 QR', 'nav.calc': '🔢 कॅल्क्युलेटर',
      'nav.converter': '🔄 कन्व्हर्टर', 'nav.notes': '📝 नोट्स', 'nav.media': '📷 मीडिया',
      'nav.staff': '👥 कर्मचारी', 'nav.myPlan': '💳 माझा प्लान', 'nav.companies': '🏢 कंपन्या',
      'nav.help': '❓ मदत', 'nav.install': '📱 अॅप इंस्टॉल',
      'overview.eyebrow': 'डॅशबोर्ड सारांश', 'overview.title': 'AI अकाउंटंट आणि व्यवसाय आढावा',
      'overview.totalSales': 'एकूण विक्री', 'overview.totalExpense': 'एकूण खर्च',
      'overview.netProfit': 'नफा / तोटा', 'overview.totalUdhar': 'एकूण बाकी',
      'overview.dailyTitle': 'आजचा हिशेब', 'overview.aajCash': 'आज रोख', 'overview.aajUpi': 'आज UPI',
      'overview.aajUdhar': 'आज उधार विक्री', 'overview.aajCollection': 'आज वसुली', 'overview.lowStock': 'कमी स्टॉक',
      'login.subtitle': 'तुमच्या खात्यात लॉगिन करा', 'login.username': 'यूजरनेम', 'login.password': 'पासवर्ड',
      'login.forgot': 'पासवर्ड विसरलात?', 'login.signIn': 'साइन इन', 'login.error': 'चुकीचे यूजरनेम किंवा पासवर्ड!',
      'forgot.title': 'पासवर्ड रीसेट', 'forgot.sendOtp': 'OTP पाठवा', 'forgot.cancel': 'रद्द करा',
      'forgot.notRegistered': 'OTP फक्त नोंदणीकृत ईमेलवर येतो. स्पॅम फोल्डर तपासा.'
    },
    pa: {
      'app.eyebrow': 'ਹਿੰਦੀ ਵੌਇਸ-ਫਸਟ ਠੇਕੇਦਾਰ ਟੂਲ',
      'app.subtitle': 'AI ਡੈਸ਼ਬੋਰਡ',
      'top.liveTime': 'ਲਾਈਵ ਸਮਾਂ', 'top.voiceOff': 'ਵੌਇਸ: ਬੰਦ', 'top.voiceOn': 'ਵੌਇਸ: ਚਾਲੂ',
      'top.businessProfile': 'ਵਪਾਰ ਪ੍ਰੋਫਾਈਲ', 'top.aiAssistant': 'AI ਸਹਾਇਕ',
      'top.light': 'ਲਾਈਟ', 'top.dark': 'ਡਾਰਕ', 'top.logout': 'ਲੌਗਆਉਟ', 'top.language': 'ਭਾਸ਼ਾ',
      'nav.main': 'ਮੁੱਖ', 'nav.business': 'ਵਪਾਰ', 'nav.hajri': 'ਹਾਜ਼ਰੀ', 'nav.accounting': 'ਲੇਖਾ',
      'nav.tools': 'ਟੂਲ', 'nav.settings': 'ਸੈਟਿੰਗਾਂ',
      'nav.overview': '🏠 ਝਲਕ', 'nav.invoice': '🧾 ਇਨਵੌਇਸ', 'nav.voice': '🎤 ਵੌਇਸ AI',
      'nav.projects': '📁 ਪ੍ਰੋਜੈਕਟ', 'nav.inventory': '📦 ਇਨਵੈਂਟਰੀ', 'nav.totalSales': '📊 ਕੁੱਲ ਵਿਕਰੀ',
      'nav.contractor': '👷 ਠੇਕੇਦਾਰ', 'nav.payroll': '💼 ਸਟਾਫ ਪੇਰੋਲ', 'nav.udhar': '📖 ਉਧਾਰ ਖਾਤਾ',
      'nav.ledgers': '📒 ਲੇਜਰ', 'nav.stockItems': '📦 ਸਟਾਕ', 'nav.voucher': '🧾 ਨਵਾਂ ਵਾਊਚਰ',
      'nav.daybook': '📅 ਡੇ ਬੁੱਕ', 'nav.reports': '📈 ਰਿਪੋਰਟਾਂ', 'nav.bankRecon': '🏦 ਬੈਂਕ ਰੀਕੌਨ',
      'nav.gallery': '🖼️ ਗੈਲਰੀ', 'nav.todo': '✅ ਟੂਡੂ', 'nav.qr': '📱 QR', 'nav.calc': '🔢 ਕੈਲਕੁਲੇਟਰ',
      'nav.converter': '🔄 ਕਨਵਰਟਰ', 'nav.notes': '📝 ਨੋਟਸ', 'nav.media': '📷 ਮੀਡੀਆ',
      'nav.staff': '👥 ਸਟਾਫ', 'nav.myPlan': '💳 ਮੇਰਾ ਪਲਾਨ', 'nav.companies': '🏢 ਕੰਪਨੀਆਂ',
      'nav.help': '❓ ਮਦਦ', 'nav.install': '📱 ਐਪ ਇੰਸਟਾਲ',
      'overview.totalSales': 'ਕੁੱਲ ਵਿਕਰੀ', 'overview.totalExpense': 'ਕੁੱਲ ਖਰਚਾ',
      'overview.netProfit': 'ਮੁਨਾਫਾ / ਘਾਟਾ', 'overview.totalUdhar': 'ਕੁੱਲ ਬਕਾਇਆ',
      'overview.dailyTitle': 'ਅੱਜ ਦਾ ਹਿਸਾਬ', 'overview.aajCash': 'ਅੱਜ ਕੈਸ਼', 'overview.aajUpi': 'ਅੱਜ UPI',
      'login.subtitle': 'ਆਪਣੇ ਖਾਤੇ ਵਿੱਚ ਲੌਗਇਨ ਕਰੋ', 'login.username': 'ਯੂਜ਼ਰਨੇਮ', 'login.password': 'ਪਾਸਵਰਡ',
      'login.forgot': 'ਪਾਸਵਰਡ ਭੁੱਲ ਗਏ?', 'login.signIn': 'ਸਾਈਨ ਇਨ', 'login.error': 'ਗਲਤ ਯੂਜ਼ਰਨੇਮ ਜਾਂ ਪਾਸਵਰਡ!',
      'forgot.title': 'ਪਾਸਵਰਡ ਰੀਸੈਟ', 'forgot.sendOtp': 'OTP ਭੇਜੋ', 'forgot.cancel': 'ਰੱਦ ਕਰੋ',
      'forgot.notRegistered': 'OTP ਸਿਰਫ਼ ਰਜਿਸਟਰਡ ਈਮੇਲ ਤੇ ਆਉਂਦਾ ਹੈ। ਸਪੈਮ ਫੋਲਡਰ ਵੀ ਦੇਖੋ।'
    },
    bn: {
      'app.eyebrow': 'হিন্দি ভয়েস-ফার্স্ট ঠিকাদার টুল',
      'app.subtitle': 'AI ড্যাশবোর্ড',
      'top.liveTime': 'লাইভ সময়', 'top.voiceOff': 'ভয়েস: বন্ধ', 'top.voiceOn': 'ভয়েস: চালু',
      'top.businessProfile': 'ব্যবসায় প্রোফাইল', 'top.aiAssistant': 'AI সহায়ক',
      'top.light': 'লাইট', 'top.dark': 'ডার্ক', 'top.logout': 'লগআউট', 'top.language': 'ভাষা',
      'nav.main': 'মূল', 'nav.business': 'ব্যবসা', 'nav.hajri': 'হাজিরা', 'nav.accounting': 'হিসাব',
      'nav.tools': 'টুল', 'nav.settings': 'সেটিংস',
      'nav.overview': '🏠 ওভারভিউ', 'nav.invoice': '🧾 ইনভয়েস', 'nav.voice': '🎤 ভয়েস AI',
      'nav.projects': '📁 প্রজেক্ট', 'nav.inventory': '📦 ইনভেন্টরি', 'nav.totalSales': '📊 মোট বিক্রি',
      'nav.udhar': '📖 ধার খাতা', 'nav.payroll': '💼 স্টাফ পে-রোল',
      'nav.gallery': '🖼️ গ্যালারি', 'nav.todo': '✅ টুডু', 'nav.help': '❓ সাহায্য',
      'overview.totalSales': 'মোট বিক্রি', 'overview.totalExpense': 'মোট খরচ',
      'overview.netProfit': 'লাভ / ক্ষতি', 'overview.dailyTitle': 'আজকের হিসাব',
      'login.subtitle': 'আপনার অ্যাকাউন্টে লগইন করুন', 'login.username': 'ইউজারনেম', 'login.password': 'পাসওয়ার্ড',
      'login.forgot': 'পাসওয়ার্ড ভুলে গেছেন?', 'login.signIn': 'সাইন ইন',
      'forgot.title': 'পাসওয়ার্ড রিসেট', 'forgot.sendOtp': 'OTP পাঠান', 'forgot.cancel': 'বাতিল',
      'forgot.notRegistered': 'OTP শুধু নিবন্ধিত ইমেইলে যায়। স্প্যাম ফোল্ডার দেখুন।'
    },
    gu: {
      'app.eyebrow': 'હિંદી વૉઇસ-ફર્સ્ટ ઠેકેદાર ટૂલ',
      'app.subtitle': 'AI ડેશબોર્ડ',
      'top.liveTime': 'લાઇવ સમય', 'top.voiceOff': 'વૉઇસ: બંધ', 'top.voiceOn': 'વૉઇસ: ચાલુ',
      'top.businessProfile': 'બિઝનેસ પ્રોફાઇલ', 'top.aiAssistant': 'AI સહાયક',
      'top.light': 'લાઇટ', 'top.dark': 'ડાર્ક', 'top.logout': 'લૉગઆઉટ', 'top.language': 'ભાષા',
      'nav.main': 'મુખ્ય', 'nav.business': 'વ્યવસાય', 'nav.hajri': 'હાજરી', 'nav.accounting': 'હિસાબ',
      'nav.tools': 'ટૂલ', 'nav.settings': 'સેટિંગ્સ',
      'nav.overview': '🏠 ઓવરવ્યૂ', 'nav.invoice': '🧾 ઇન્વૉઇસ', 'nav.voice': '🎤 વૉઇસ AI',
      'nav.projects': '📁 પ્રોજેક્ટ', 'nav.inventory': '📦 ઇન્વેન્ટરી', 'nav.totalSales': '📊 કુલ વેચાણ',
      'nav.udhar': '📖 ઉધાર ખાતું', 'nav.payroll': '💼 સ્ટાફ પગાર',
      'nav.gallery': '🖼️ ગેલેરી', 'nav.todo': '✅ ટુડૂ', 'nav.help': '❓ મદદ',
      'overview.totalSales': 'કુલ વેચાણ', 'overview.totalExpense': 'કુલ ખર્ચ',
      'overview.netProfit': 'નફો / નુકસાન', 'overview.dailyTitle': 'આજનો હિસાબ',
      'login.subtitle': 'તમારા એકાઉન્ટમાં લૉગિન કરો', 'login.username': 'યુઝરનેમ', 'login.password': 'પાસવર્ડ',
      'login.forgot': 'પાસવર્ડ ભૂલી ગયા?', 'login.signIn': 'સાઇન ઇન',
      'forgot.title': 'પાસવર્ડ રીસેટ', 'forgot.sendOtp': 'OTP મોકલો', 'forgot.cancel': 'રદ કરો',
      'forgot.notRegistered': 'OTP ફક્ત નોંધાયેલ ઇમેઇલ પર આવે છે. સ્પામ ફોલ્ડર જુઓ.'
    }
  };

  function bkGetLang() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED.includes(saved)) return saved;
    return 'hi';
  }

  function bkT(key, lang) {
    const L = lang || bkGetLang();
    const chain = [L, 'hi', 'en'];
    for (let i = 0; i < chain.length; i++) {
      const pack = STR[chain[i]];
      if (pack && pack[key]) return pack[key];
    }
    return key;
  }

  function bkSetLang(lang) {
    if (!SUPPORTED.includes(lang)) return;
    localStorage.setItem(STORAGE_KEY, lang);
    localStorage.setItem('bk_voice_lang', VOICE_LANG[lang] || 'hi-IN');
    document.documentElement.lang = lang === 'en' ? 'en' : lang;
    bkApplyI18n();
    document.dispatchEvent(new CustomEvent('bk:langchange', { detail: { lang } }));
  }

  function bkApplyI18n(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      const val = bkT(key);
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        if (el.hasAttribute('data-i18n-placeholder')) el.placeholder = val;
        else el.value = val;
      } else {
        el.textContent = val;
      }
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.placeholder = bkT(el.getAttribute('data-i18n-placeholder'));
    });
    scope.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.title = bkT(el.getAttribute('data-i18n-title'));
    });
    scope.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      el.setAttribute('aria-label', bkT(el.getAttribute('data-i18n-aria')));
    });
    const sel = document.getElementById('bkLangSelect');
    if (sel && sel.value !== bkGetLang()) sel.value = bkGetLang();
  }

  function bkInjectLangSelector(containerId) {
    const host = document.getElementById(containerId);
    if (!host || document.getElementById('bkLangSelect')) return;
    const wrap = document.createElement('div');
    wrap.className = 'bk-lang-wrap';
    wrap.innerHTML = '<label class="bk-lang-label" for="bkLangSelect" data-i18n="top.language">Language</label>';
    const sel = document.createElement('select');
    sel.id = 'bkLangSelect';
    sel.className = 'bk-lang-select theme-btn';
    sel.setAttribute('aria-label', 'Language');
    SUPPORTED.forEach((code) => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = LABELS[code];
      sel.appendChild(opt);
    });
    sel.value = bkGetLang();
    sel.addEventListener('change', () => bkSetLang(sel.value));
    wrap.appendChild(sel);
    host.appendChild(wrap);
    bkApplyI18n(wrap);
  }

  global.BK_I18N_SUPPORTED = SUPPORTED;
  global.bkGetLang = bkGetLang;
  global.bkSetLang = bkSetLang;
  global.bkT = bkT;
  global.bkApplyI18n = bkApplyI18n;
  global.bkInjectLangSelector = bkInjectLangSelector;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.lang = bkGetLang();
      bkApplyI18n();
    });
  } else {
    document.documentElement.lang = bkGetLang();
    bkApplyI18n();
  }
})(typeof window !== 'undefined' ? window : global);
