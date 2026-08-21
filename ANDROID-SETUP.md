# BolKarigar — Android App Setup Guide (Play Store ke liye)

Ye guide batati hai kaise tumhari web app se real Android `.apk`/`.aab`
file banti hai jo Play Store pe submit ho sake.

**Zaroori samajh lo pehle:** Ye app static website nahi hai — login,
invoices, database sab kuch tumhare **live backend server** (Node.js)
pe depend karta hai. Isliye Android app **tabhi kaam karega jab tumhara
backend deployed/live ho** (Railway/Render pe, jaisa humne pehle discuss
kiya tha).

---

## Step 1 — Pehle backend live karo

Agar abhi tak Railway/Render pe deploy nahi kiya, wo pehle karo.
Deploy hone ke baad tumhe ek URL milega, jaisa:
```
https://bolkarigar-production.up.railway.app
```

---

## Step 2 — `capacitor.config.ts` mein apna live URL daalo

Project folder mein `capacitor.config.ts` file kholo, aur ye line dhoondo:

```ts
url: 'https://bolkarigar.onrender.com',
```

Ise apne asli Railway/Render URL se replace karo:

```ts
url: 'https://bolkarigar.onrender.com',
```

Save karo, fir terminal mein:

```powershell
npx cap sync android
```

(Ye command har baar chalani hai jab bhi `capacitor.config.ts` ya
`public/` folder ke files change karo.)

---

## Step 3 — Android Studio install karo (agar nahi hai)

1. Download karo: **developer.android.com/studio** (free hai)
2. Install karke ek baar khol lo, default settings se setup complete karo
   (SDK download hoga automatically — 15-20 min lag sakte hain)

---

## Step 4 — Android project kholo

Terminal mein project folder ke andar:

```powershell
npx cap open android
```

Ye seedha Android Studio khol dega tumhare project ke saath. Pehli baar
kholne pe Gradle sync hoga (5-10 min lag sakta hai, neeche progress bar
dikhega — bas wait karo).

---

## Step 5 — App ko test karo (phone ya emulator pe)

**Real phone pe test karna sabse aasan hai:**
1. Apne Android phone mein **Settings → About Phone → Build Number** pe
   7 baar tap karo (Developer Mode on ho jayega)
2. **Settings → Developer Options → USB Debugging** on karo
3. Phone ko USB cable se PC se connect karo
4. Android Studio mein upar **device dropdown** mein apna phone dikhega
   → select karo → **▶ Run** button dabao (green play icon)
5. App phone pe install ho jayegi aur khulegi

Agar phone nahi hai, Android Studio ka **built-in emulator** bhi use
kar sakte ho (device dropdown mein "Create Device" se virtual phone
bana sakte ho).

---

## Step 6 — Signed `.aab` file banao (Play Store ke liye zaroori)

Play Store sirf **signed** app accept karta hai. Android Studio mein:

1. Top menu: **Build → Generate Signed Bundle / APK**
2. **Android App Bundle** select karo → Next
3. **Create new...** (keystore) — pehli baar hai to naya banao:
   - Keystore path choose karo (jahan save karna hai)
   - Password set karo (**ye password aur keystore file HAMESHA
     safe rakhna** — agar khoya to future updates publish nahi kar
     paoge!)
   - Apna naam/organization details bharo
4. Next → **release** build variant select karo → Finish

Kuch minute mein `.aab` file ban jayegi (location terminal mein dikhega,
usually `android/app/release/app-release.aab`).

---

## Step 7 — Play Store pe submit karo

1. **play.google.com/console** pe jao
2. Developer account banao (**one-time $25 fee** Google leta hai)
3. "Create app" → app ka naam, description, screenshots, privacy
   policy link waghera bharo
4. `.aab` file upload karo jo Step 6 mein bani
5. Submit karo review ke liye

**⚠️ Important — 2026 ka naya rule:** Naye personal developer accounts
ke liye Google ne rule banaya hai — production release se pehle **kam
se kam 12 testers ke saath 14 continuous din ka closed test** complete
karna zaroori hai. Isliye pehle "Closed Testing" track pe submit karo,
apne 12 logo ko invite karo test karne ke liye, 14 din wait karo, tabhi
production pe release kar paoge.

---

## Icon/Splash screen badalna ho to

Maine abhi ek **placeholder icon** (blue background, "B" letter) laga
diya hai taaki app build ho sake. Agar tumhara koi proper logo/design
hai:

1. Apna logo image `resources/icon.png` (1024x1024, square) aur
   `resources/splash.png` (2732x2732) mein replace karo
2. Terminal mein:
   ```powershell
   npx capacitor-assets generate --android
   npx cap sync android
   ```
3. Android Studio mein dubara build karo

---

## Agar kabhi web app ke code mein change karo

Jab bhi `public/` folder ke andar (HTML/CSS/JS) kuch change karo:

```powershell
npx cap sync android
```

Fir Android Studio mein phir se Run/Build karo. Backend (`server.js`)
mein change karne ke baad sirf Railway/Render pe redeploy karna hota
hai — Android app khud-ba-khud naya backend use karega (kyunki wo live
URL se connect hoti hai, koi local copy nahi).
