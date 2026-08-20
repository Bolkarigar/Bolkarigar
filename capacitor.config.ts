import type { CapacitorConfig } from '@capacitor/cli';

// 🟢 IMPORTANT: Ye app static website NAHI hai — backend (Node.js +
// MongoDB) live server pe deployed hona zaroori hai (Railway/Render),
// taaki login, API calls, sab kaam karein. Neeche 'url' field mein apna
// LIVE deployed URL daalna hoga jab tumhara server live ho jaaye.
//
// Jab tak deploy nahi karte, isse test nahi kar sakte (login fail hoga)
// kyunki koi backend available nahi hoga connect karne ke liye.

const config: CapacitorConfig = {
  appId: 'com.bolkarigar.app',
  appName: 'BolKarigar',
  webDir: 'public',
  server: {
    // 👉 Yahan apna Railway/Render deployment URL daalo, jaise:
    // url: 'https://bolkarigar-production.up.railway.app',
    url: 'https://REPLACE-WITH-YOUR-LIVE-SERVER-URL.com',
    cleartext: false // production mein HTTPS zaroori hai
  }
};

export default config;
