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

async function guessImapHosts(email, preferredHost) {
  const domain = String(email || '').split('@')[1] || '';
  const hosts = [];
  if (preferredHost) hosts.push(preferredHost);
  const wellKnown = {
    'gmail.com': ['imap.gmail.com'],
    'googlemail.com': ['imap.gmail.com'],
    'outlook.com': ['outlook.office365.com'],
    'hotmail.com': ['outlook.office365.com'],
    'live.com': ['outlook.office365.com'],
    'yahoo.com': ['imap.mail.yahoo.com'],
    'rediffmail.com': ['imap.rediffmail.com'],
    'infernix.com': ['dx.infernix.net', 'infernix.com'],
    'infernix.net': ['dx.infernix.net']
  };
  if (wellKnown[domain]) hosts.push(...wellKnown[domain]);
  if (domain) {
    try {
      const mx = await dns.resolveMx(domain);
      mx.sort((a, b) => a.priority - b.priority);
      for (const rec of mx.slice(0, 3)) {
        const ex = String(rec.exchange || '').replace(/\.$/, '').toLowerCase();
        if (ex) hosts.push(ex);
      }
    } catch {
      /* MX optional */
    }
    hosts.push(`imap.${domain}`, `mail.${domain}`, domain);
  }
  const unique = [...new Set(hosts.filter(Boolean))];
  const live = [];
  for (const h of unique) {
    if (await hostResolves(h)) live.push(h);
  }
  return live.length ? live : unique;
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
  const { ImapFlow } = require('imapflow');
  const client = new ImapFlow({
    host,
    port: port || 993,
    secure: true,
    auth: { user, pass },
    logger: false,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 20000
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
    if (/auth|login|invalid|credentials/i.test(msg)) return 3;
    if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(msg)) return 1;
    return 2;
  };
  for (const host of hosts.slice(0, 4)) {
    try {
      const client = await tryConnect(host, preferredPort || 993, email, pass);
      return { client, host, port: preferredPort || 993 };
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      const r = rank(msg);
      if (r >= lastRank) {
        lastRank = r;
        lastErr = `${host}: ${msg}`;
      }
    }
  }
  throw new Error(
    /auth|login|invalid|credentials/i.test(lastErr)
      ? `Login failed for ${email}. Password check karo (eye icon se dekho). Gmail/Workspace ho to App Password use karo.`
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
