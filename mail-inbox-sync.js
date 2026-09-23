/**
 * Owner ke selected business email se IMAP inbox/sent pull.
 * Password profile mein AES-256-GCM se encrypted rehta hai — API response mein nahi jata.
 */
const crypto = require('crypto');
const dns = require('dns').promises;

function encKey() {
  return crypto.createHash('sha256').update(String(process.env.JWT_SECRET || 'ao-mail-key')).digest();
}

function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}.${cipher.getAuthTag().toString('hex')}.${enc.toString('hex')}`;
}

function decryptSecret(packed) {
  const [ivH, tagH, dataH] = String(packed || '').split('.');
  if (!ivH || !tagH || !dataH) return '';
  const decipher = crypto.createDecipheriv('aes-256-gcm', encKey(), Buffer.from(ivH, 'hex'));
  decipher.setAuthTag(Buffer.from(tagH, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataH, 'hex')), decipher.final()]).toString('utf8');
}

function envFallbackFor(email) {
  const user = String(email || '').trim().toLowerCase();
  const imapUser = String(process.env.IMAP_USER || '').trim().toLowerCase();
  const smtpUser = String(process.env.SMTP_USER || '').trim().toLowerCase();
  if (user && imapUser && user === imapUser && process.env.IMAP_PASS) {
    return {
      host: process.env.IMAP_HOST || '',
      port: Number(process.env.IMAP_PORT) || 993,
      user,
      pass: process.env.IMAP_PASS
    };
  }
  if (user && smtpUser && user === smtpUser && process.env.SMTP_PASS) {
    return {
      host: process.env.IMAP_HOST || '',
      port: Number(process.env.IMAP_PORT) || 993,
      user,
      pass: String(process.env.SMTP_PASS).replace(/\s+/g, '')
    };
  }
  return null;
}

async function hostResolves(host) {
  try {
    await dns.lookup(host);
    return true;
  } catch {
    return false;
  }
}

function errText(e) {
  if (!e) return 'unknown error';
  const parts = [e.message];
  if (Array.isArray(e.errors)) {
    for (const x of e.errors) if (x?.message) parts.push(x.message);
  }
  if (e.cause?.message) parts.push(e.cause.message);
  return [...new Set(parts.filter(Boolean))].join(' — ');
}

function normalizeImapHost(email, preferredHost) {
  const domain = String(email || '').split('@')[1] || '';
  const pref = String(preferredHost || '').trim().toLowerCase();
  if (domain === 'infernix.com' || domain === 'infernix.net' || /infernix/.test(pref)) {
    return 'dx.infernix.net';
  }
  if (pref && !/aspmx|google\.com$/.test(pref)) return pref;
  const wellKnown = {
    'gmail.com': 'imap.gmail.com',
    'googlemail.com': 'imap.gmail.com',
    'outlook.com': 'outlook.office365.com',
    'hotmail.com': 'outlook.office365.com',
    'live.com': 'outlook.office365.com',
    'yahoo.com': 'imap.mail.yahoo.com'
  };
  return wellKnown[domain] || '';
}

async function guessImapHosts(email, preferredHost) {
  const locked = normalizeImapHost(email, preferredHost);
  if (locked) return [locked];
  const domain = String(email || '').split('@')[1] || '';
  const candidates = [preferredHost, `imap.${domain}`, `mail.${domain}`].filter(Boolean);
  const live = [];
  for (const h of [...new Set(candidates)]) {
    if (/aspmx|google\.com$/.test(h)) continue;
    if (await hostResolves(h)) live.push(h);
  }
  return live;
}

function addrList(list) {
  if (!list || !list.length) return '';
  return list.map((a) => {
    const e = a.address || a.value || '';
    const n = a.name ? `${a.name} ` : '';
    return e ? `${n}<${e}>`.trim() : String(n || e);
  }).filter(Boolean).join(', ');
}

function firstEmail(list) {
  if (!list || !list.length) return '';
  return String(list[0].address || '').trim().toLowerCase();
}

async function tryConnect(host, port, user, pass) {
  try { dns.setDefaultResultOrder('ipv4first'); } catch { /* node < 17 */ }
  const { ImapFlow } = require('imapflow');
  const client = new ImapFlow({
    host,
    port: port || 993,
    secure: true,
    auth: { user, pass },
    logger: false,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 25000,
    tls: { servername: host, minVersion: 'TLSv1.2' }
  });
  await client.connect();
  return client;
}

async function connectWithGuess({ email, pass, preferredHost, preferredPort }) {
  const hosts = await guessImapHosts(email, preferredHost);
  if (!hosts.length) {
    throw new Error('IMAP host nahi mila. Host box mein dx.infernix.net likho.');
  }
  let lastErr = 'Could not reach the mailbox IMAP server.';
  let lastRank = 0;
  const rank = (msg) => {
    if (/auth|login|invalid|credentials|command failed/i.test(msg)) return 3;
    if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(msg)) return 1;
    return 2;
  };
  for (const host of hosts.slice(0, 4)) {
    try {
      const client = await tryConnect(host, preferredPort || 993, email, pass);
      return { client, host, port: preferredPort || 993 };
    } catch (e) {
      const msg = errText(e);
      const r = rank(msg);
      if (r >= lastRank) {
        lastRank = r;
        lastErr = `${host}: ${msg}`;
      }
    }
  }
  throw new Error(
    /auth|login|invalid|credentials|command failed/i.test(lastErr)
      ? `Login failed for ${email} on ${hosts[0]}. Password galat ho sakta hai — eye icon se check karo.`
      : `Inbox connect failed (${lastErr}). IMAP host ${hosts[0]} try karo.`
  );
}

async function readMailbox(client, mailbox, limit, folderHint) {
  const rows = [];
  let lock;
  try {
    lock = await client.getMailboxLock(mailbox);
  } catch {
    return rows;
  }
  try {
    const exists = Number(client.mailbox.exists || 0);
    if (!exists) return rows;
    const from = Math.max(1, exists - limit + 1);
    const { simpleParser } = require('mailparser');
    for await (const msg of client.fetch(`${from}:${exists}`, { envelope: true, source: true, uid: true })) {
      let parsed = null;
      try {
        parsed = await simpleParser(msg.source || '');
      } catch {
        parsed = null;
      }
      const env = msg.envelope || {};
      const messageId = String(parsed?.messageId || env.messageId || '').trim();
      const fromAddr = firstEmail(parsed?.from?.value || env.from) || addrList(env.from);
      const toAddr = firstEmail(parsed?.to?.value || env.to) || addrList(env.to);
      const subject = String(parsed?.subject || env.subject || '(No subject)');
      const bodyText = String(parsed?.text || parsed?.html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000);
      const date = parsed?.date || env.date || new Date();
      rows.push({
        folderHint,
        mailbox,
        uid: msg.uid,
        messageId,
        from: fromAddr,
        to: toAddr,
        subject,
        bodyText,
        date,
        providerMessageId: messageId || `imap:${mailbox}:${msg.uid}`
      });
    }
  } finally {
    lock.release();
  }
  return rows;
}

async function fetchMailboxEmails({ email, pass, host, port, limit = 40 }) {
  const { client, host: usedHost, port: usedPort } = await connectWithGuess({
    email,
    pass,
    preferredHost: host,
    preferredPort: port
  });
  try {
    const boxes = ['INBOX', 'Sent', 'Sent Items', '[Gmail]/Sent Mail', 'INBOX.Sent'];
    const seen = new Set();
    const all = [];
    for (const box of boxes) {
      const hint = /^inbox$/i.test(box) ? 'inbound' : 'outbound';
      const rows = await readMailbox(client, box, limit, hint);
      for (const row of rows) {
        const key = row.providerMessageId;
        if (seen.has(key)) continue;
        seen.add(key);
        all.push(row);
      }
    }
    return { host: usedHost, port: usedPort, messages: all };
  } finally {
    try { await client.logout(); } catch { /* ignore */ }
  }
}

module.exports = {
  encryptSecret,
  decryptSecret,
  envFallbackFor,
  fetchMailboxEmails
};
