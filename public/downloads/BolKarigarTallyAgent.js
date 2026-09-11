// ==================================================================================
// BolKarigar Tally Sync — Desktop Agent
// ==================================================================================

const WebSocket = require('ws');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { exec } = require('child_process');
const net = require('net');
const http = require('http');

const AGENT_VERSION = '2026.09.11http5';
const PROBE_POST_TIMEOUT_MS = 5000;
const QUICK_PROBE_CACHE_MS = 12000;
const DEFAULT_BACKEND = 'https://bolkarigar.onrender.com';
const TALLY_HOSTS = ['127.0.0.1', 'localhost'];
const TALLY_PORTS = [9000, 9001, 9002];
let tallyLocalUrl = 'http://127.0.0.1:9000';
const TALLY_EXE_PATHS = [
  'C:\\Program Files\\TallyPrime\\tally.exe',
  'C:\\Program Files (x86)\\TallyPrime\\tally.exe',
  'C:\\Tally.ERP9\\tally.exe',
  'C:\\Program Files\\Tally\\TallyPrime\\tally.exe'
];
const TALLY_PING_XML = '<?xml version="1.0"?><ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>LicenseInfo</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></DESC></BODY></ENVELOPE>';
const TALLY_COMPANIES_XML = '<?xml version="1.0"?><ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>List of Companies</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></DESC></BODY></ENVELOPE>';
const TALLY_COMPANIES_COLLECTION_XML = '<?xml version="1.0"?><ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>List of Companies</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></DESC></BODY></ENVELOPE>';
const TALLY_PROBE_XMLS = [
  TALLY_COMPANIES_COLLECTION_XML,
  TALLY_COMPANIES_XML,
  TALLY_PING_XML,
  '<?xml version="1.0"?><ENVELOPE><HEADER><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>License Info</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></DESC></BODY></ENVELOPE>'
];
const TALLY_HTTP_CONTENT_TYPES = ['UTF-8', 'text/xml; charset=UTF-8', 'text/XML', 'application/xml'];
const TALLY_HTTP_HELP =
  'Tally HTTP Server OFF. ODBC ON is NOT enough. F1 → Settings → Advanced Configuration → HTTP Server = Yes (port 9000). Also Connectivity → acts as Both. Restart Tally, select company, then Sync.';
const TALLY_ODBC_ONLY_HELP =
  'Port 9000 par sirf ODBC ON hai — BolKarigar ko HTTP Server chahiye (XML). F1 → Settings → Advanced Configuration → Enable HTTP Server = Yes. ODBC screen alag hai!';

let lastTallyLaunchAt = 0;
const TALLY_LAUNCH_COOLDOWN_MS = 3 * 60 * 1000;
let tallyHttpKnownDown = false;

function getConfigDir() {
  if (process.pkg) return path.dirname(process.execPath);
  return __dirname;
}

function getConfigPath() {
  return path.join(getConfigDir(), 'agent-config.json');
}

function cleanToken(value) {
  return String(value || '').trim().replace(/\s+/g, '');
}

function launchTallyPrime() {
  if (process.platform !== 'win32') {
    console.log('Auto-launch works on Windows only.');
    return false;
  }
  for (const exePath of TALLY_EXE_PATHS) {
    if (!fs.existsSync(exePath)) continue;
    exec(`"${exePath}"`, { windowsHide: false }, (err) => {
      if (err) console.error(`Tally launch: ${err.message}`);
      else console.log('Tally Prime opening (once per sync)...');
    });
    return true;
  }
  exec('cmd /c start "" tally', { windowsHide: true }, () => {});
  console.warn('tally.exe not found in standard paths — trying Windows start tally...');
  return false;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isTallyProcessRunning() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve(false);
    exec('tasklist /FI "IMAGENAME eq tally.exe" /NH', { windowsHide: true }, (err, stdout) => {
      resolve(!err && /tally\.exe/i.test(String(stdout || '')));
    });
  });
}

function printHttpServerSteps(extra) {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  ⚠️  ODBC ON ≠ HTTP ON');
  console.log('  Aapki screen mein sirf "Enable ODBC = Yes" dikh raha hai.');
  console.log('  BolKarigar ko alag se "Enable HTTP Server = Yes" chahiye.');
  if (extra) console.log(`  ${extra}`);
  console.log('');
  console.log('  METHOD 1 — Connectivity screen (same screen, neeche scroll):');
  console.log('    F1 → Settings → Connectivity → Client/Server');
  console.log('    → TallyPrime acts as = Both');
  console.log('    → Enable ODBC Server = Yes');
  console.log('    → Enable HTTP Server = Yes   ← YEH LINE ALG HAI (ODBC ke neeche)');
  console.log('    → Port = 9000 → Accept (Ctrl+A)');
  console.log('');
  console.log('  METHOD 2 — Advanced Configuration (agar upar HTTP na dikhe):');
  console.log('    F1 → Settings → Advanced Configuration');
  console.log('    → Enable HTTP Server = Yes (port 9000)');
  console.log('    → Accept / Save');
  console.log('');
  console.log('  STEP C — Company + restart (ZAROORI):');
  console.log('    Gateway → company select karein (Lokansh Ltd) → Tally band karke dubara kholo');
  console.log('    BolKarigar → Test Tally HTTP → Sync Tally');
  console.log('  EDU note: voucher Day Book mein 1st / 2nd / last date par dikhega.');
  console.log('══════════════════════════════════════════════════\n');
}

function fetchWithTimeout(url, options, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(url, options)
      .then((res) => { clearTimeout(timer); resolve(res); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

let probeCache = null;
let probeCacheAt = 0;

function isPortOpen(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
    socket.on('error', () => resolve(false));
  });
}

function httpPostNative(host, port, body, timeoutMs, contentType) {
  return new Promise((resolve, reject) => {
    const payload = String(body || '');
    const ct = contentType || 'UTF-8';
    const req = http.request({
      host,
      port,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': ct,
        'Accept': '*/*',
        'Connection': 'close',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: timeoutMs
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode || 0, text: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}

function tallyHttpResponseOk(status, text) {
  if (!status || status < 200 || status >= 500) return false;
  const body = String(text || '');
  if (body.length < 3) return false;
  if (/connection refused|econnrefused/i.test(body)) return false;
  if (body.includes('<ENVELOPE') || body.includes('<RESPONSE') || body.includes('TALLY')) return true;
  if (body.includes('LINEERROR') || body.includes('Unknown Request')) return true;
  if (body.includes('<COMPANY') || body.includes('<COLLECTION')) return true;
  return body.length >= 12 && /xml/i.test(body.slice(0, 120));
}

function looksLikeOdbcOnlyResponse(text) {
  const body = String(text || '').trim();
  if (!body) return false;
  if (body.includes('<ENVELOPE') || body.includes('<RESPONSE') || body.includes('TALLY')) return false;
  return true;
}

async function postTallyXml(host, port, body, timeoutMs = PROBE_POST_TIMEOUT_MS) {
  const url = `http://${host}:${port}`;
  const payloads = String(body || '');
  let last = { status: 0, text: '' };
  for (const ct of TALLY_HTTP_CONTENT_TYPES) {
    try {
      const r = await httpPostNative(host, port, payloads, timeoutMs, ct);
      last = r;
      if (tallyHttpResponseOk(r.status, r.text)) {
        return { status: r.status, text: r.text, url };
      }
    } catch {
      /* try next content-type */
    }
  }
  for (const ct of TALLY_HTTP_CONTENT_TYPES) {
    try {
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': ct, Connection: 'close' },
        body: payloads
      }, timeoutMs);
      const text = await res.text();
      last = { status: res.status, text };
      if (tallyHttpResponseOk(res.status, text)) {
        return { status: res.status, text, url };
      }
    } catch {
      /* try next */
    }
  }
  return { status: last.status, text: last.text, url };
}

async function quickProbeTallyHttp(useCache = true) {
  if (useCache && probeCache && Date.now() - probeCacheAt < QUICK_PROBE_CACHE_MS) {
    return probeCache;
  }
  const port = 9000;
  let host = '127.0.0.1';
  let portOpen = await isPortOpen(host, port);
  if (!portOpen) {
    host = 'localhost';
    portOpen = await isPortOpen(host, port);
  }
  const tallyRunning = await isTallyProcessRunning();

  if (!portOpen) {
    probeCache = {
      httpUp: false,
      portOpen: false,
      odbcOnly: false,
      companyRequired: false,
      canTrySync: false,
      weak: false,
      host: '',
      port: 0,
      tallyRunning
    };
    probeCacheAt = Date.now();
    return probeCache;
  }

  let lastText = '';
  try {
    const r = await httpPostNative(host, port, TALLY_PING_XML, PROBE_POST_TIMEOUT_MS, 'UTF-8');
    lastText = r.text || '';
    if (tallyHttpResponseOk(r.status, lastText)) {
      tallyLocalUrl = `http://${host}:${port}`;
      probeCache = {
        httpUp: true,
        portOpen: true,
        host,
        port,
        weak: false,
        companyRequired: false,
        odbcOnly: false,
        canTrySync: true,
        tallyRunning: true
      };
      probeCacheAt = Date.now();
      return probeCache;
    }
  } catch (err) {
    lastText = String(err.message || '');
  }

  const emptyBody = !lastText || lastText.trim().length < 5;
  const companyRequired = emptyBody || /no company|company not|select company|could not find company|not loaded/i.test(lastText);
  tallyLocalUrl = `http://${host}:${port}`;
  probeCache = {
    httpUp: false,
    portOpen: true,
    host,
    port,
    odbcOnly: !companyRequired && !emptyBody && looksLikeOdbcOnlyResponse(lastText),
    companyRequired,
    canTrySync: true,
    weak: true,
    probeSnippet: String(lastText || 'empty').replace(/\s+/g, ' ').slice(0, 160),
    tallyRunning: tallyRunning || true
  };
  probeCacheAt = Date.now();
  return probeCache;
}

async function probeTallyHttp() {
  const quick = await quickProbeTallyHttp(false);
  if (quick.httpUp || !quick.portOpen) return quick;

  let anyPortOpen = quick.portOpen;
  let openHost = quick.host || '';
  let openPort = quick.port || 0;
  let lastProbe = { status: 0, text: quick.probeSnippet || '', host: openHost, port: openPort };

  for (const port of TALLY_PORTS) {
    for (const host of TALLY_HOSTS) {
      const portOpen = await isPortOpen(host, port);
      if (portOpen) {
        anyPortOpen = true;
        openHost = host;
        openPort = port;
      }
      if (!portOpen) continue;

      for (const body of TALLY_PROBE_XMLS) {
        try {
          const res = await postTallyXml(host, port, body);
          lastProbe = { status: res.status || 0, text: res.text || '', host, port };
          if (tallyHttpResponseOk(res.status, res.text)) {
            tallyLocalUrl = res.url || `http://${host}:${port}`;
            tallyHttpKnownDown = false;
            return {
              httpUp: true,
              portOpen: true,
              host,
              port,
              weak: false,
              companyRequired: false
            };
          }
        } catch (err) {
          lastProbe = { status: 0, text: String(err.message || ''), host, port };
        }
      }

      try {
        const getRes = await fetchWithTimeout(`http://${host}:${port}/`, { method: 'GET' }, 5000);
        const getText = await getRes.text();
        lastProbe = { status: getRes.status || 0, text: getText || '', host, port };
        if (tallyHttpResponseOk(getRes.status, getText)) {
          tallyLocalUrl = `http://${host}:${port}`;
          tallyHttpKnownDown = false;
          return { httpUp: true, portOpen: true, host, port, weak: false, companyRequired: false };
        }
      } catch {
        /* GET optional */
      }
    }
  }

  if (anyPortOpen) {
    tallyLocalUrl = `http://${openHost}:${openPort}`;
    const emptyBody = !lastProbe.text || lastProbe.text.trim().length < 5;
    const companyRequired = emptyBody || /no company|company not|select company|could not find company|not loaded/i.test(lastProbe.text);
    const odbcOnly = !companyRequired && !emptyBody && looksLikeOdbcOnlyResponse(lastProbe.text);
    const canTrySync = true;
    return {
      httpUp: false,
      portOpen: true,
      odbcOnly,
      companyRequired,
      canTrySync,
      weak: canTrySync,
      host: openHost,
      port: openPort,
      probeStatus: lastProbe.status,
      probeSnippet: String(lastProbe.text || lastProbe.status || 'empty').replace(/\s+/g, ' ').slice(0, 160)
    };
  }

  return { httpUp: false, portOpen: false, odbcOnly: false, companyRequired: false, host: '', port: 0, weak: false };
}

async function isPort9000Open() {
  for (const host of TALLY_HOSTS) {
    if (await isPortOpen(host, 9000)) return true;
  }
  return false;
}

async function isTallyHttpUp() {
  const probe = await probeTallyHttp();
  return !!probe.httpUp;
}

function extractTallyLineError(text) {
  const patterns = [
    /<LINEERROR>(.*?)<\/LINEERROR>/gis,
    /<REMOTELINEERROR>(.*?)<\/REMOTELINEERROR>/gis,
    /<ERRORMESSAGE>(.*?)<\/ERRORMESSAGE>/gis
  ];
  for (const re of patterns) {
    for (const m of String(text || '').matchAll(re)) {
      const msg = m[1].replace(/<[^>]+>/g, '').trim();
      if (msg) return msg;
    }
  }
  return '';
}

function isTallyXmlSuccess(text, httpOk) {
  if (!httpOk || !text) return false;
  if (text.includes('Unknown Request')) return false;
  const created = parseInt((text.match(/<CREATED>(\d+)<\/CREATED>/i) || [0, 0])[1], 10);
  const altered = parseInt((text.match(/<ALTERED>(\d+)<\/ALTERED>/i) || [0, 0])[1], 10);
  const imported = parseInt((text.match(/<IMPORTED>(\d+)<\/IMPORTED>/i) || [0, 0])[1], 10);
  const exceptions = parseInt((text.match(/<EXCEPTIONS>(\d+)<\/EXCEPTIONS>/i) || [0, 0])[1], 10);
  if (exceptions > 0) return false;
  if (created >= 1 || altered >= 1 || imported >= 1) return true;
  if (altered >= 1 && /<VOUCHER[\s>]/i.test(text)) return true;
  return false;
}

async function waitForTallyHttp(maxWaitSec, label) {
  const steps = Math.ceil(maxWaitSec / 3);
  for (let attempt = 1; attempt <= steps; attempt++) {
    if (await isTallyHttpUp()) {
      console.log(`✅ Tally HTTP port 9000 ready (${label}, ${attempt * 3}s).`);
      return true;
    }
    if (attempt === 1 || attempt % 4 === 0) {
      console.log(`   Waiting for Tally HTTP... (${attempt * 3}s / ${maxWaitSec}s)`);
    }
    await sleep(3000);
  }
  return false;
}

async function ensureTallyRunning() {
  const probe = await probeTallyHttp();
  if (probe.httpUp) {
    console.log('✅ Tally HTTP port 9000 ready.');
    return true;
  }
  if (probe.portOpen) {
    console.log(`🟡 Port ${probe.port || 9000} open — sync try hoga (company Day Book mein khuli ho).`);
    return true;
  }

  const tallyRunning = await isTallyProcessRunning();
  if (tallyRunning) {
    console.log('\n⚠️  Tally open hai par port 9000 band.');
    printHttpServerSteps();
    return false;
  }

  const now = Date.now();
  if (now - lastTallyLaunchAt < TALLY_LAUNCH_COOLDOWN_MS) {
    console.log('Tally not ready — port 9000 closed. F1 → Connectivity → Both + ODBC Yes.');
    return false;
  }

  lastTallyLaunchAt = now;
  console.log('Tally not running — opening Tally Prime once...');
  launchTallyPrime();
  await sleep(8000);
  const after = await probeTallyHttp();
  return !!(after.httpUp || after.portOpen);
}

function loadConfig() {
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (cfg.agentToken) cfg.agentToken = cleanToken(cfg.agentToken);
      return cfg;
    } catch {
      console.error('Could not read agent-config.json — will create a new one.');
    }
  }
  const pairingPath = path.join(getConfigDir(), 'pairing.txt');
  if (fs.existsSync(pairingPath)) {
    const token = cleanToken(fs.readFileSync(pairingPath, 'utf8'));
    if (token) {
      const cfg = { backendUrl: DEFAULT_BACKEND, agentToken: token };
      saveConfig(cfg);
      try { fs.unlinkSync(pairingPath); } catch {}
      return cfg;
    }
  }
  return null;
}

function saveConfig(config) {
  const configPath = getConfigPath();
  const normalized = {
    backendUrl: String(config.backendUrl || DEFAULT_BACKEND).replace(/\/+$/, ''),
    agentToken: cleanToken(config.agentToken)
  };
  fs.writeFileSync(configPath, JSON.stringify(normalized, null, 2), 'utf8');
  console.log(`Config saved: ${configPath}`);
  return normalized;
}

function parseArgs() {
  const out = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--token=')) out.agentToken = cleanToken(arg.slice(8));
    if (arg.startsWith('--url=')) out.backendUrl = arg.slice(6).replace(/\/+$/, '');
  }
  return out;
}

function askQuestion(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(query, (answer) => { rl.close(); resolve(answer.trim()); }));
}

async function ensureConfig() {
  const args = parseArgs();
  let config = loadConfig();
  if (config && config.backendUrl && config.agentToken) {
    if (args.agentToken) config.agentToken = args.agentToken;
    if (args.backendUrl) config.backendUrl = args.backendUrl;
    console.log(`Token loaded from: ${getConfigPath()}`);
    console.log('(One-time setup done — token will NOT be asked again unless you delete agent-config.json)\n');
    return saveConfig(config);
  }

  console.log('\n=== BolKarigar Desktop Agent — First-time Setup ===\n');
  console.log(`Config folder: ${getConfigDir()}`);
  console.log('Easier way: In BolKarigar sidebar click "Connect Agent.bat" — token saves automatically.\n');

  const backendUrl = args.backendUrl
    || (await askQuestion(`Server URL [Enter = ${DEFAULT_BACKEND}]: `)) || DEFAULT_BACKEND;
  const agentToken = args.agentToken
    || cleanToken(await askQuestion('Paste Pairing Token from BolKarigar sidebar: '));

  if (!agentToken) {
    console.error('Token is required. Copy it from BolKarigar → Tally Sync Agent → Copy.');
    process.exit(1);
  }

  return saveConfig({ backendUrl, agentToken });
}

let ws = null;
let pingTimer = null;
let reconnectDelay = 3000;
const MAX_RECONNECT_DELAY = 30000;
let syncInProgress = false;
let syncStartedAt = 0;
const SYNC_STALE_MS = 120000;

function connect(config) {
  const token = cleanToken(config.agentToken);
  const base = String(config.backendUrl || DEFAULT_BACKEND).replace(/\/+$/, '');
  const wsUrl = base.replace(/^http/i, 'ws') + `/agent-ws?token=${encodeURIComponent(token)}`;

  console.log(`Connecting to ${base} ...`);

  ws = new WebSocket(wsUrl, { perMessageDeflate: false });

  ws.on('open', async () => {
    reconnectDelay = 3000;
    console.log('\n✅ CONNECTED — ready for Sync Tally (keep this window open)\n');
    const probe = await quickProbeTallyHttp(false);
    if (probe.httpUp) {
      console.log(`✅ Tally HTTP port ${probe.port} OK — sync will work.\n`);
    } else if (probe.companyRequired) {
      console.log(`⚠️  Port ${probe.port} open but company select nahi hai!\n`);
      console.log('   Gateway → company select karein → Tally restart → Test dubara.\n');
    } else if (probe.odbcOnly) {
      console.log(`❌ Port ${probe.port} open but sirf ODBC ON hai — HTTP Server OFF!\n`);
      if (probe.probeSnippet) console.log(`   Last response: ${probe.probeSnippet}\n`);
      printHttpServerSteps('Connectivity screen par "Enable HTTP Server = Yes" alag se ON karein.');
    } else if (await isTallyProcessRunning()) {
      console.log('⚠️  Tally open hai but port 9000 closed — HTTP Server ON karein, phir Tally restart.\n');
      printHttpServerSteps('Port 9000 abhi band hai — Advanced Configuration → HTTP Server = Yes.');
    } else {
      console.log('ℹ️  Tally not detected — Sync will open Tally once.\n');
    }
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ type: 'agent_ping', t: Date.now() })); } catch {}
      }
    }, 12000);
  });

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'connected' || msg.type === 'agent_pong') {
      if (msg.type === 'connected') console.log(msg.message || 'Agent registered.');
      return;
    }

    if (msg.type === 'open_tally') {
      console.log('📂 Open Tally signal — launching Tally Prime...');
      lastTallyLaunchAt = Date.now();
      launchTallyPrime();
      return;
    }

    if (msg.type === 'tally_check') {
      const tallyRunning = await isTallyProcessRunning();
      const probe = await quickProbeTallyHttp(!msg.silent);
      const portOpen = !!probe.portOpen;
      const httpUp = !!probe.httpUp;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'tally_check_result',
          requestId: msg.requestId,
          tallyRunning,
          portOpen,
          httpUp,
          odbcOnly: !!probe.odbcOnly,
          companyRequired: !!probe.companyRequired,
          canTrySync: !!probe.canTrySync || !!probe.portOpen,
          weakHttp: !!probe.weak || (!probe.httpUp && !!probe.portOpen),
          tallyPort: probe.port || 9000,
          probeSnippet: probe.probeSnippet || '',
          agentVersion: AGENT_VERSION
        }));
      }
      if (!msg.silent) {
        if (httpUp) {
          console.log(`✅ Test: Tally HTTP port ${probe.port || 9000} OK.`);
        } else if (probe.portOpen) {
          console.log(`🟡 Test: Port ${probe.port || 9000} open — Sync Tally try karein (company Day Book khuli ho).`);
        } else if (probe.companyRequired) {
          console.log('❌ Test: Port open but company not loaded — Gateway → company → Day Book.');
        } else if (tallyRunning) {
          console.log('❌ Test: Tally open but port 9000 closed — F1 → Connectivity → Both + ODBC Yes.');
        } else {
          console.log('❌ Test: Tally not running.');
        }
      }
      return;
    }

    if (msg.type === 'sync_request') {
      if (syncInProgress && Date.now() - syncStartedAt < SYNC_STALE_MS) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'sync_result',
            requestId: msg.requestId,
            ok: false,
            error: 'Previous sync still running — wait 30 seconds and try again.'
          }));
        }
        return;
      }
      syncInProgress = true;
      syncStartedAt = Date.now();
      try {
        tallyHttpKnownDown = false;
        probeCache = null;
        let probe = await quickProbeTallyHttp(false);
        if (!probe.portOpen) {
          console.log('📨 Sync — Tally not on port 9000, opening Tally Prime...');
          lastTallyLaunchAt = Date.now();
          launchTallyPrime();
          await sleep(10000);
          probe = await quickProbeTallyHttp(false);
        }
        if (!probe.portOpen) {
          throw new Error('Tally port 9000 band hai. Tally kholo → F1 → Connectivity → HTTP Server = Yes, Port 9000 → restart.');
        }
        if (!probe.httpUp) {
          console.log(`⚠️  Port ${probe.port || 9000} open — sync try kar rahe hain (company Tally mein khuli honi chahiye)...`);
        }

        let responseText = '';
        let tallyResOk = false;
        let lastSyncErr = null;
        for (const ct of TALLY_HTTP_CONTENT_TYPES) {
          try {
            const r = await httpPostNative(
              probe.host || '127.0.0.1',
              probe.port || 9000,
              msg.xml,
              60000,
              ct
            );
            responseText = r.text || '';
            tallyResOk = r.status >= 200 && r.status < 500;
            if (responseText.length > 3) break;
          } catch (err) {
            lastSyncErr = err;
          }
        }
        if (!responseText && lastSyncErr) {
          try {
            const tallyRes = await fetchWithTimeout(tallyLocalUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'UTF-8', Connection: 'close' },
              body: msg.xml
            }, 60000);
            responseText = await tallyRes.text();
            tallyResOk = tallyRes.ok;
          } catch (err) {
            throw new Error(probe.companyRequired
              ? 'Port 9000 open but company not loaded. Gateway → company select → Day Book kholo → Sync again.'
              : (err.message || TALLY_HTTP_HELP));
          }
        }
        const tallyOk = isTallyXmlSuccess(responseText, tallyResOk);
        const lineErr = extractTallyLineError(responseText);
        if (tallyOk) {
          console.log('✅ Tally accepted data — check Day Book in Tally.');
        } else if (lineErr) {
          console.log(`↩ Tally: ${lineErr}`);
        } else if (!msg.prepareTally) {
          console.log('↩ Trying next format...');
        }
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'sync_result',
            requestId: msg.requestId,
            ok: true,
            responseText,
            tallyOk,
            error: lineErr || undefined
          }));
        }
      } catch (err) {
        console.error(`❌ Sync failed: ${err.message}`);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'sync_result',
            requestId: msg.requestId,
            ok: false,
            error: err.message
          }));
        }
      } finally {
        syncInProgress = false;
      }
    }
  });

  ws.on('close', (code, reason) => {
    if (pingTimer) clearInterval(pingTimer);
    const why = reason ? reason.toString() : '';
    if (code === 4001) {
      console.error('\n❌ Token missing in connection URL.\n');
      process.exit(1);
    }
    if (code === 4003) {
      console.error('\n❌ Invalid pairing token. In BolKarigar: Copy token again → run Connect Agent.bat\n');
      process.exit(1);
    }
    if (code === 4009) {
      console.error('\n⚠️ Token was reset in app. Download new Connect Agent.bat from sidebar.\n');
      process.exit(1);
    }
    console.log(`Disconnected (${code}${why ? ': ' + why : ''}). Retry in ${reconnectDelay / 1000}s...`);
    setTimeout(() => connect(config), reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 1.5, MAX_RECONNECT_DELAY);
  });

  ws.on('error', (err) => {
    console.error(`Connection error: ${err.message}`);
    console.error('Check internet firewall allows WebSocket (wss) to bolkarigar.onrender.com');
  });
}

(async () => {
  console.log(`=== BolKarigar Tally Sync Agent v${AGENT_VERSION} ===\n`);
  const config = await ensureConfig();
  connect(config);
})();
