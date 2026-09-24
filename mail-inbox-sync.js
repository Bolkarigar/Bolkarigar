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

function isInfernixEmail(email) {
  return /@(infernix\.com|infernix\.net)$/i.test(String(email || '').trim());
}

function normalizeImapHost(email, preferredHost) {
  const domain = String(email || '').split('@')[1] || '';
  const pref = String(preferredHost || '').trim().toLowerCase();
  if (isInfernixEmail(email) || /infernix/.test(pref) || /infernix/.test(domain)) {
    return 'dx.infernix.net';
  }
  const wellKnown = {
    'gmail.com': 'imap.gmail.com',
    'googlemail.com': 'imap.gmail.com',
    'outlook.com': 'outlook.office365.com',
    'hotmail.com': 'outlook.office365.com',
    'live.com': 'outlook.office365.com',
    'yahoo.com': 'imap.mail.yahoo.com'
  };
  const locked = wellKnown[domain] || '';
  if (locked) return locked;
  if (pref && !/aspmx|google\.com$/.test(pref)) return pref;
  return '';
}

async function guessImapHosts(email, preferredHost) {
  const locked = normalizeImapHost(email, preferredHost);
  if (locked) return [locked];
  const domain = String(email || '').split('@')[1] || '';
  const candidates = [preferredHost, `imap.${domain}`, `mail.${domain}`].filter(Boolean);
  const live = [];
  for (const h of [...new Set(candidates)]) {
    if (/aspmx|google\.com$/.test(h)) continue;
    if (/^(mail|imap)\.infernix\.com$|^infernix\.com$/i.test(h)) continue;
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

function decodeEntities(s) {
  return String(s || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const c = Number(n);
      return c ? String.fromCharCode(c) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => {
      const c = parseInt(n, 16);
      return c ? String.fromCharCode(c) : _;
    });
}

function decodeQuotedPrintableBits(s) {
  return String(s || '')
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function decodePct(s) {
  return String(s || '').replace(/((?:%[0-9A-F]{2})+)/gi, (enc) => {
    try { return decodeURIComponent(enc); } catch { return enc; }
  });
}

function looksLikeCss(text) {
  const s = String(text || '');
  if (!s) return false;
  const braces = (s.match(/\{[^{}]{0,400}\}/g) || []).length;
  return braces >= 2
    || /#outlook\b/i.test(s)
    || /\bmso-[a-z-]+\s*:/i.test(s)
    || /-webkit-text-size-adjust/i.test(s)
    || /@media\s+(only\s+)?screen/i.test(s)
    || /mso-table-lspace/i.test(s)
    || /#MessageViewBody/i.test(s);
}

function stripCssBlocks(s) {
  let t = String(s || '');
  t = t.replace(/<head[\s\S]*?<\/head>/gi, ' ');
  t = t.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  t = t.replace(/<!--[\s\S]*?-->/g, ' ');
  t = t.replace(/\/\*[\s\S]*?\*\//g, ' ');
  for (let i = 0; i < 24; i += 1) {
    const next = t.replace(/\{[^{}]*\}/g, (block) => (
      /[a-z-]+\s*:/.test(block) || /!important|px;|pt;|%\s*\}/i.test(block) ? ' ' : block
    ));
    if (next === t) break;
    t = next;
  }
  t = t.replace(/@media[^{;\n]{0,160}/gi, ' ');
  t = t.replace(/\{\s*[.#][^{}]*\}/g, ' ');
  t = t.replace(/\{[^{}]{0,60}\}/g, ' ');
  t = t.replace(/\b(?:mso|moz|webkit|ms)-[a-z-]+\s*:\s*[^;\n{}]+;?/gi, ' ');
  t = t.replace(/\b(?:padding|margin|width|height|max-width|min-width|border(?:-collapse|-radius)?|font-(?:family|size|weight)|line-height|text-(?:decoration|align|size-adjust)|display|background(?:-color)?|vertical-align|outline|letter-spacing)\s*:\s*[^;\n{}]{1,80};?/gi, ' ');
  t = t.replace(/#outlook\b|#MessageViewBody|\.?ExternalClass|\.x\d+/gi, ' ');
  t = t.replace(/^(?:\s*(?:#outlook|body|html|table|td|th|img|span|div|li|a|p|u)\s*,?)+/i, ' ');
  return t;
}

function tidyReadable(s) {
  let t = decodePct(decodeEntities(decodeQuotedPrintableBits(stripCssBlocks(s))));
  t = stripCssBlocks(t);
  t = t.replace(/https?:\/\/[^\s<>"]{70,}/g, '');
  t = t.replace(/https?:\/\/[^\s<>"]*(?:unsubscribe|click|track|pixel|connect\.)[^\s<>"]*/gi, '');
  t = t.replace(/[ \t\f\v]+/g, ' ');
  t = t.replace(/ *\n */g, '\n');
  t = t.replace(/\n{3,}/g, '\n\n');
  t = t.replace(/^[ \t]*[-_=.]{6,}[ \t]*$/gm, '');
  t = t.replace(/[{};]{2,}/g, ' ');
  return t.trim().slice(0, 8000);
}

function htmlToReadable(html) {
  let s = String(html || '');
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<head[\s\S]*?<\/head>/gi, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(p|div|tr|h[1-6]|li|blockquote|table)>/gi, '\n');
  s = s.replace(/<a [^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => {
    const label = inner.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (/unsubscribe|track|pixel|connect\.|click/i.test(href)) return label;
    return label || '';
  });
  s = s.replace(/<[^>]+>/g, '');
  return tidyReadable(s);
}

function looksLikeGarbage(text) {
  const s = String(text || '');
  if (!s) return true;
  if (looksLikeCss(s)) return true;
  const urls = (s.match(/https?:\/\//g) || []).length;
  const pct = (s.match(/%[0-9A-F]{2}/gi) || []).length;
  const words = (s.match(/[A-Za-z\u0900-\u097F]{3,}/g) || []).length;
  return pct > 8 || (urls >= 4 && words < urls * 3);
}

function realWordCount(s) {
  return (String(s || '').match(/[A-Za-z\u0900-\u097F]{3,}/g) || []).length;
}

function cleanEmailBody(parsed) {
  const fromHtml = parsed?.html ? htmlToReadable(parsed.html) : '';
  const fromText = tidyReadable(String(parsed?.text || '').replace(/<[^>]+>/g, ' '));
  if (fromHtml && realWordCount(fromHtml) >= 4) return fromHtml;
  if (fromText && !looksLikeGarbage(fromText)) return fromText;
  return fromHtml || fromText || '';
}

function cleanStoredEmailBody(raw, html) {
  if (html) {
    const fromHtml = htmlToReadable(html);
    if (fromHtml && !looksLikeGarbage(fromHtml)) return fromHtml;
    if (fromHtml) return fromHtml;
  }
  const s = String(raw || '');
  if (!s) return '';
  if (looksLikeGarbage(s) || /<[a-z][\s\S]*>/i.test(s)) return htmlToReadable(s) || tidyReadable(s);
  return tidyReadable(s);
}

async function tryConnect(host, port, user, pass) {
  try { dns.setDefaultResultOrder('ipv4first'); } catch { /* node < 17 */ }
  let connectHost = host;
  try {
    const looked = await dns.lookup(host, { family: 4 });
    if (looked?.address) connectHost = looked.address;
  } catch { /* hostname as-is */ }
  const useStartTls = Number(port) === 143;
  const { ImapFlow } = require('imapflow');
  const client = new ImapFlow({
    host: connectHost,
    port: port || 993,
    secure: !useStartTls,
    auth: { user, pass },
    logger: false,
    connectionTimeout: 25000,
    greetingTimeout: 20000,
    socketTimeout: 35000,
    tls: { servername: host, minVersion: 'TLSv1.2' }
  });
  await client.connect();
  return client;
}

function isGmailAddress(email) {
  return /@(gmail|googlemail)\./i.test(String(email || ''));
}

function loginFailMessage(email, host) {
  if (isGmailAddress(email)) {
    return `Gmail ka login password IMAP pe kaam nahi karta — yeh Google ki rule hai, password galat nahi. Google Account → Security → 2-Step Verification → App passwords → Mail/Other se 16-letter App Password banao aur wahi yahan paste karo. Gmail → Settings → Forwarding and POP/IMAP mein IMAP ON rakho.`;
  }
  return `Login failed for ${email} on ${host}. Mailbox password check karo (eye icon).`;
}

function connectFailMessage(email, host, lastErr) {
  if (/auth|login|invalid|credentials|command failed/i.test(lastErr)) {
    return loginFailMessage(email, host);
  }
  if (isInfernixEmail(email) || /infernix/i.test(host) || /infernix/i.test(lastErr)) {
    return `Infernix mailbox (${email}) connect nahi hua. mail.infernix.com / imap.infernix.com galat host hain — sahi IMAP host dx.infernix.net hai. Password issue nahi. Host box mein dx.infernix.net rakho aur Connect Inbox dabao. Detail: ${lastErr}`;
  }
  return `Inbox connect failed (${lastErr}). IMAP host ${host} try karo.`;
}

async function connectWithGuess({ email, pass, preferredHost, preferredPort }) {
  const hosts = await guessImapHosts(email, preferredHost);
  if (!hosts.length) {
    throw new Error('IMAP host nahi mila. Host box mein sahi IMAP host likho.');
  }
  const cleanPass = String(pass || '').replace(/\s+/g, '');
  let lastErr = 'Could not reach the mailbox IMAP server.';
  let lastRank = 0;
  const rank = (msg) => {
    if (/auth|login|invalid|credentials|command failed/i.test(msg)) return 3;
    if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(msg)) return 1;
    return 2;
  };
  const tryPasswords = [cleanPass];
  const envFb = envFallbackFor(email);
  if (envFb?.pass && envFb.pass !== cleanPass) tryPasswords.push(envFb.pass);

  const ports = isInfernixEmail(email)
    ? [...new Set([preferredPort || 993, 993, 143])]
    : [preferredPort || 993];

  for (const host of hosts.slice(0, 4)) {
    for (const port of ports) {
      for (const pwd of tryPasswords) {
        try {
          const client = await tryConnect(host, port, email, pwd);
          return { client, host, port };
        } catch (e) {
          const msg = errText(e);
          const r = rank(msg);
          if (r >= lastRank) {
            lastRank = r;
            lastErr = `${host}:${port} ${msg}`;
          }
        }
      }
    }
  }
  throw new Error(connectFailMessage(email, hosts[0], lastErr));
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
      const bodyText = cleanEmailBody(parsed);
      const bodyHtml = parsed?.html ? String(parsed.html).slice(0, 40000) : '';
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
        bodyHtml,
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
  const lockedHost = normalizeImapHost(email, host) || host;
  const { client, host: usedHost, port: usedPort } = await connectWithGuess({
    email,
    pass,
    preferredHost: lockedHost,
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
  fetchMailboxEmails,
  cleanEmailBody,
  cleanStoredEmailBody,
  htmlToReadable,
  normalizeImapHost
};
