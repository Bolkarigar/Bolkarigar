// backup.js
// Automated MongoDB backup — Railway/Render jaisi PaaS hosting pe disk
// EPHEMERAL hota hai (naya deploy hote hi purana disk wipe ho jaata hai),
// isliye backup ko disk pe rakhna bharosemand nahi hai.
//
// Isliye ye script:
//   1. MONGO_URI se connect hota hai
//   2. Database ke saare collections ko JSON mein export karta hai
//   3. Sabko ek single .zip file mein compress karta hai
//   4. Us zip ko EMAIL attachment ke through bhej deta hai (SMTP se,
//      jo already .env mein configured hai)
//   5. Temp files turant delete kar deta hai
//
// Result: har din tumhare inbox mein "BolKarigar Backup — <date>" email
// aayega ek zip attachment ke saath. Wahi tumhara safe backup hai.
//
// Manual run (testing ke liye):
//   node backup.js
//
// Production mein Railway/Render ka Cron Job feature isse daily chalayega
// — instructions SETUP-BACKUP.md mein hain.

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const os = require('os');
const archiver = require('archiver');
const logger = require('./logger');

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function zipFolder(sourceFolder, outputZipPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputZipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(archive.pointer())); // total bytes
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(sourceFolder, false);
    archive.finalize();
  });
}

async function sendBackupEmail(zipPath, zipSizeBytes, docCount, collectionCount) {
  const { createMailTransporter, isEmailConfigured } = require('./email-service');
  if (!isEmailConfigured()) {
    logger.warn('[Backup] SMTP configured nahi hai — email nahi bhej sakta. Backup zip yahin hai (agla deploy hote hi delete ho jayega!):', { zipPath });
    return false;
  }

  const mail = createMailTransporter();
  if (!mail) {
    logger.warn('[Backup] SMTP transporter create nahi hua.');
    return false;
  }

  const toEmail = process.env.BACKUP_EMAIL_TO || process.env.SMTP_USER;
  const sizeMB = (zipSizeBytes / (1024 * 1024)).toFixed(2);

  await mail.transporter.sendMail({
    from: mail.from,
    to: toEmail,
    subject: `BolKarigar Backup — ${new Date().toLocaleDateString('en-IN')}`,
    text: `Automated daily backup.\n\nCollections: ${collectionCount}\nTotal documents: ${docCount}\nZip size: ${sizeMB} MB\n\nIse kisi safe jagah save karke rakho (Google Drive folder banake use dedicated rakho, taaki daily emails mein khoye na).`,
    attachments: [{ filename: path.basename(zipPath), path: zipPath }]
  });

  logger.info(`[Backup] ✅ Email bhej diya ${toEmail} ko (${sizeMB} MB attachment).`);
  return true;
}

async function runBackup() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    logger.error('[Backup] MONGO_URI .env mein nahi mila. Backup cancel.');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  logger.info('[Backup] MongoDB se connect ho gaya.');

  const runId = timestamp();
  const tempFolder = path.join(os.tmpdir(), `bolkarigar-backup-${runId}`);
  fs.mkdirSync(tempFolder, { recursive: true });

  const collections = await mongoose.connection.db.listCollections().toArray();
  if (collections.length === 0) {
    logger.warn('[Backup] Koi collection nahi mila database mein — kuch backup nahi hua.');
  }

  let totalDocs = 0;
  for (const { name } of collections) {
    const docs = await mongoose.connection.db.collection(name).find({}).toArray();
    fs.writeFileSync(
      path.join(tempFolder, `${name}.json`),
      JSON.stringify(docs, null, 2)
    );
    totalDocs += docs.length;
    logger.info(`[Backup] ✓ ${name} — ${docs.length} documents exported.`);
  }

  const zipPath = path.join(os.tmpdir(), `bolkarigar-backup-${runId}.zip`);
  const zipSize = await zipFolder(tempFolder, zipPath);
  logger.info(`[Backup] ✓ Zip bana — ${(zipSize / (1024 * 1024)).toFixed(2)} MB`);

  const emailSent = await sendBackupEmail(zipPath, zipSize, totalDocs, collections.length);

  fs.rmSync(tempFolder, { recursive: true, force: true });
  if (emailSent) {
    fs.rmSync(zipPath, { force: true });
  } else {
    logger.warn(`[Backup] ⚠️ Zip delete NAHI kiya kyunki email nahi bheja ja saka: ${zipPath}`);
    logger.warn('[Backup] ⚠️ SMTP_HOST/SMTP_USER/SMTP_PASS .env mein set karo taaki backups reliably mile.');
  }

  logger.info(`[Backup] ✅ Backup run complete — ${collections.length} collections, ${totalDocs} documents.`);

  await mongoose.disconnect();
  process.exit(emailSent ? 0 : 1);
}

runBackup().catch((err) => {
  logger.error('[Backup] ❌ Backup fail ho gaya', { err: err.message, stack: err.stack });
  process.exit(1);
});
