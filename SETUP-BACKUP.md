# Automated Daily Backup — Railway / Render Setup Guide

Railway aur Render dono **ephemeral disk** use karte hain — matlab jab
bhi naya deploy hota hai, purana disk data delete ho jaata hai. Isliye
backup ko disk pe rakhna galat hoga. Iski jagah `backup.js` daily database
export karke tumhare **email pe zip attachment bhej deta hai**.

---

## Step 1 — .env mein ye 2 cheezein set karo

Tumhare paas already SMTP variables hain forgot-password ke liye. Sirf
ek naya optional variable add karo:

```
BACKUP_EMAIL_TO=tumhari-email@gmail.com
```

(Agar ye khali chhodoge, to backup `SMTP_USER` wale hi email pe chala
jayega by default.)

Confirm karo `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` already sahi se set
hain (forgot-password test karke pehle hi verify ho chuka hoga).

---

## Step 2 — Manually ek baar test karo (local pe)

```powershell
node backup.js
```

Agar sab sahi raha to apne inbox mein "BolKarigar Backup — <date>" email
milegi ek `.zip` attachment ke saath. Zip kholke check karo — usme har
collection ka `.json` file hona chahiye (users, items, vouchers, etc).

---

## Step 3 — Railway pe Cron Job set karo

1. Railway dashboard mein apna project kholo
2. **"+ New"** → **"Empty Service"** (alag se, apne main app service se separate)
3. Us naye service ko apne **GitHub repo se connect** karo (same repo jo main app use kar rahi hai)
4. Service ki **Settings** mein jaake:
   - **Start Command:** `node backup.js`
   - **Cron Schedule:** `0 2 * * *` (roz raat 2:00 AM — UTC time hota hai Railway mein, IST se 5:30 ghante peeche, isliye 2 AM IST ke liye `30 20 * * *` daalo)
5. Us service mein bhi **same environment variables** copy karo jo main
   app mein hain (khaaskar `MONGO_URI`, `SMTP_*`, `BACKUP_EMAIL_TO`)
6. Deploy karo — ab ye daily apne aap chalega

---

## Step 3 (Alternative) — Render pe Cron Job set karo

1. Render dashboard mein **"New +"** → **"Cron Job"**
2. Apna GitHub repo connect karo
3. **Command:** `node backup.js`
4. **Schedule:** `30 20 * * *` (raat 2 AM IST — Render bhi UTC use karta hai)
5. **Environment** tab mein saare same variables add karo jo main app mein hain
   (`MONGO_URI`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `BACKUP_EMAIL_TO`)
6. Save & Deploy

---

## Step 4 — Verify karo

Cron job ko manually **"Run Now"** / **"Trigger"** karo (dashboard mein
option milega) — 2 AM tak wait karne ki zaroorat nahi. Fir apna email
inbox check karo.

Agar email nahi aayi, cron job ke **logs** dekho dashboard mein — agar
`SMTP configured nahi hai` jaisa warning dikhe, to environment variables
sahi se copy nahi hue us cron service mein.

---

## Important — email attachments ko organize karo

Daily emails aane lagengi — inbox mein khoye na isliye:
1. Apne email mein ek **filter/label** bana do: `From: <SMTP_FROM address>` `Subject contains "BolKarigar Backup"` → auto-label "DB Backups"
2. Better: Gmail mein "Forward + Archive" rule bana ke saare backup emails ek dedicated Google Drive-synced folder mein forward kar do

Isse tumhare paas hamesha last-30-din ke daily backups mile rahenge,
bina manual kaam kiye.

---

## Agar kabhi restore karna pade

1. Email se relevant date ka `.zip` download karo, extract karo
2. Har `.json` file ek collection hai (jaise `users.json`, `items.json`)
3. MongoDB Atlas dashboard → Collections → us collection mein → **"Insert Document"** (chhote data ke liye) ya `mongoimport` tool se bulk import (bade data ke liye)

Agar kabhi actually restore karna pade, mujhe batana — main us waqt
exact commands ke saath step-by-step guide bana dunga.
