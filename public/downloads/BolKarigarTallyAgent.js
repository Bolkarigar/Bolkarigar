// ==================================================================================
// BolKarigar Tally Sync — Desktop Agent
// ==================================================================================

const WebSocket = require('ws');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { exec } = require('child_process');

const AGENT_VERSION = '2026.09.10';
const DEFAULT_BACKEND = 'https://bolkarigar.onrender.com';
const TALLY_URL_CANDIDATES = ['http://localhost:9000', 'http://127.0.0.1:9000'];
let tallyLocalUrl = TALLY_URL_CANDIDATES[0];
const TALLY_EXE_PATHS = [
  'C:\\Program Files\\TallyPrime\\tally.exe',
  'C:\\Program Files (x86)\\TallyPrime\\tally.exe',
  'C:\\Tally.ERP9\\tally.exe',
  'C:\\Program Files\\Tally\\TallyPrime\\tally.exe'
];
const TALLY_PING_XML = '<?xml version="1.0"?><ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>LicenseInfo</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></DESC></BODY></ENVELOPE>';
const TALLY_HTTP_HELP =
  'Tally HTTP Server OFF. Fix once: open Tally → select company → press F12 → F1 → Connectivity → HTTP Server = Yes, Port = 9000 → Accept. Then click Sync Tally again (do NOT close Agent).';

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

async function isTallyHttpUp() {
  for (const url of TALLY_URL_CANDIDATES) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: TALLY_PING_XML,
        timeout: 4000
      });
      const text = await res.text();
      if (res.ok && text && (text.includes('<ENVELOPE') || text.includes('TALLY'))) {
        tallyLocalUrl = url;
        tallyHttpKnownDown = false;
        return true;
      }
    } catch {
      /* try next host */
    }
  }
  return false;
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
  if (text.includes('<LASTVCHID>')) return true;
  return false;
}

async function ensureTallyRunning() {
  if (await isTallyHttpUp()) return true;

  const now = Date.now();
  if (now - lastTallyLaunchAt < TALLY_LAUNCH_COOLDOWN_MS) {
    for (let attempt = 1; attempt <= 4; attempt++) {
      await new Promise((r) => setTimeout(r, 1500));
      if (await isTallyHttpUp()) {
        console.log(`Tally HTTP ready (${attempt}/4).`);
        return true;
      }
    }
    tallyHttpKnownDown = true;
    console.warn(TALLY_HTTP_HELP);
    return false;
  }

  lastTallyLaunchAt = now;
  console.log('Tally not on port 9000 — opening Tally Prime once...');
  launchTallyPrime();
  for (let attempt = 1; attempt <= 12; attempt++) {
    await new Promise((r) => setTimeout(r, 2000));
    if (await isTallyHttpUp()) {
      console.log(`Tally HTTP ready (${attempt}/12).`);
      return true;
    }
  }
  tallyHttpKnownDown = true;
  console.warn(TALLY_HTTP_HELP);
  return false;
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

function connect(config) {
  const token = cleanToken(config.agentToken);
  const base = String(config.backendUrl || DEFAULT_BACKEND).replace(/\/+$/, '');
  const wsUrl = base.replace(/^http/i, 'ws') + `/agent-ws?token=${encodeURIComponent(token)}`;

  console.log(`Connecting to ${base} ...`);

  ws = new WebSocket(wsUrl, { perMessageDeflate: false });

  ws.on('open', () => {
    reconnectDelay = 3000;
    console.log('\n✅ CONNECTED — ready for Sync Tally (keep this window open)\n');
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
      if (Date.now() - lastTallyLaunchAt > 60000) {
        ensureTallyRunning().catch(() => {});
      }
      return;
    }

    if (msg.type === 'sync_request') {
      if (syncInProgress) {
        console.log('⏳ Sync already running — please wait...');
      }
      syncInProgress = true;
      try {
        let tallyUp;
        if (msg.prepareTally) {
          console.log('📨 Sync bill to Tally — preparing Tally (once)...');
          tallyUp = await ensureTallyRunning();
        } else if (tallyHttpKnownDown) {
          tallyUp = false;
        } else {
          tallyUp = await isTallyHttpUp();
        }

        if (!tallyUp) {
          throw new Error(TALLY_HTTP_HELP);
        }

        const tallyRes = await fetch(tallyLocalUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/xml' },
          body: msg.xml,
          timeout: 45000
        });
        const responseText = await tallyRes.text();
        const tallyOk = isTallyXmlSuccess(responseText, tallyRes.ok);
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
