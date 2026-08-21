# BolKarigar — Play Store Android App (Hindi Guide)

Tumhari web app ab **real Android app** ban chuki hai (Capacitor). Play Store pe dalne ke liye ye steps follow karo.

**Live server (already set):** `https://bolkarigar.onrender.com`  
**App ID:** `com.bolkarigar.app`  
**App name:** BolKarigar

---

## Ye app kaise kaam karti hai?

```
Phone pe BolKarigar APK install
        ↓
App khulti hai → Live server se connect (Render)
        ↓
Login, invoice, voice — sab cloud pe save
        ↓
Dusre phone/laptop se bhi same account = same data
```

App **browser shortcut nahi** — ye Play Store wali **proper Android app** hai.

---

## Step 1 — Software install karo (ek baar)

1. **Node.js** — already hai tumhare PC pe
2. **Android Studio** — download: https://developer.android.com/studio (free, ~2 GB)
3. Android Studio kholo → SDK download hone do (pehli baar 15–20 min)

---

## Step 2 — Project sync karo

PowerShell mein project folder kholo:

```powershell
cd "c:\Users\Dell\Downloads\bolkarigar_upgraded (5)\bolkarigar"
npm install
npm run android:sync
```

---

## Step 3 — Android Studio mein kholo

```powershell
npm run android:open
```

Gradle sync complete hone do (pehli baar 5–10 min).

---

## Step 4 — Phone pe test karo

1. Phone: **Settings → About → Build Number** pe 7 baar tap (Developer mode)
2. **Developer Options → USB Debugging** ON
3. USB se PC connect karo
4. Android Studio mein apna phone select karo → **▶ Run** (green button)
5. App install ho jayegi — login karo aur test karo

**Voice test:** Mic permission allow karo jab app pooche.

---

## Step 5 — Signed `.aab` file banao (Play Store ke liye)

Play Store sirf **signed AAB** accept karta hai:

1. Android Studio: **Build → Generate Signed Bundle / APK**
2. **Android App Bundle (.aab)** select karo
3. **Create new keystore** (pehli baar):
   - File path: jahan save karna hai (e.g. `bolkarigar-release.jks`)
   - Password: strong password (**HAMESHA safe rakho — khoya to update nahi kar paoge!**)
   - Alias: `bolkarigar`
4. Build variant: **release**
5. Finish — file milegi: `android/app/release/app-release.aab`

---

## Step 6 — Google Play Console

1. https://play.google.com/console — account banao (**$25 one-time fee**)
2. **Create app** → naam: BolKarigar
3. **Privacy policy URL** (zaroori):
   ```
   https://bolkarigar.onrender.com/privacy.html
   ```
4. App category: Business / Productivity
5. Screenshots: phone se 2–4 screenshot lo (login, dashboard, invoice)
6. **Production** ya pehle **Closed testing** track pe `.aab` upload karo

### 2026 rule (important)

Naye personal developer accounts ke liye Google chahta hai:
- Pehle **Closed testing** — kam se kam **12 testers**, **14 din** continuous testing
- Uske baad hi **Production** release

Apne 12 doston/ko-workers ko tester invite karo.

---

## Step 7 — Backend deploy (zaroori)

App live server use karti hai. Agar `public/` mein kuch change kiya (jaise `capacitor-app.js`), to GitHub push karo taaki Render pe deploy ho:

```powershell
git add .
git commit -m "Android app ready for Play Store"
git push
```

Render auto-redeploy karega.

---

## App icon badalna ho to

Apna logo `resources/icon.png` (1024×1024) mein rakho, fir:

```powershell
npx capacitor-assets generate --android
npm run android:sync
```

---

## Useful commands

| Command | Kaam |
|---------|------|
| `npm run android:sync` | Web changes → Android project update |
| `npm run android:open` | Android Studio kholo |
| `npx cap sync android` | Same as android:sync |

---

## FAQ

**Q: Internet bina chalegi?**  
A: Nahi — login, sync, voice sab ke liye internet chahiye.

**Q: Web update ke baad Play Store pe dubara upload?**  
A: Zyada tar changes server pe hain — **naya APK zaroori nahi**. Sirf Android permissions/icon change pe naya build chahiye.

**Q: iPhone App Store?**  
A: Abhi sirf Android ready hai. iPhone ke liye alag Apple Developer account ($99/year) chahiye.

---

**Support:** Agar build error aaye to Android Studio ka error message bhejo — fix kar denge.
