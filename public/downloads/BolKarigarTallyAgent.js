// ==================================================================================
// BolKarigar Tally Sync — Desktop Agent
// ==================================================================================

const WebSocket = require('ws');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { exec } = require('child_process');

const DEFAULT_BACKEND = 'https://bolkarigar.onrender.com';
const TALLY_LOCAL_URL = 'http://localhost:9000';
const TALLY_EXE_PATHS = [
  'C:\\Program Files\\TallyPrime\\tally.exe',
  'C:\\Program Files (x86)\\TallyPrime\\tally.exe',
  'C:\\Tally.ERP9\\tally.exe',
  'C:\\Program Files\\Tally\\TallyPrime\\tally.exe'
];
const TALLY_PING_XML = '<?xml version="1.0"?><ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>LicenseInfo</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></DESC></BODY></ENVELOPE>';

function getConfigDir() {
  // pkg .exe: config must live next to the .exe (snapshot folder is read-only)
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
      else console.log('Tally Prime opening...');
    });
    return true;
  }
  exec('cmd /c start "" tally', { windowsHide: true }, () => {});
  console.warn('tally.exe not found in standard paths — trying Windows start tally...');
  return false;
}

async function isTallyHttpUp() {
  try {
    const res = await fetch(TALLY_LOCAL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: TALLY_PING_XML,
      timeout: 3000
    });
    return res.ok;
  } catch {
    return false;
  }
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
  console.log('Tally not responding — opening Tally Prime...');
  launchTallyPrime();
  for (let attempt = 1; attempt <= 6; attempt++) {
    await new Promise((r) => setTimeout(r, 1500));
    if (await isTallyHttpUp()) {
      console.log(`Tally ready (${attempt}/6).`);
      return true;
    }
  }
  console.warn('Tally HTTP port 9000 not ready — confirm HTTP Server is ON in Tally.');
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
    return saveConfig(config);
  }

  console.log('\n=== BolKarigar Desktop Agent — Setup ===\n');
  console.log(`Config folder: ${getConfigDir()}`);
  console.log('Tip: In BolKarigar sidebar click "Connect Agent" to auto-create config.\n');

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

function connect(config) {
  const token = cleanToken(config.agentToken);
  const base = String(config.backendUrl || DEFAULT_BACKEND).replace(/\/+$/, '');
  const wsUrl = base.replace(/^http/i, 'ws') + `/agent-ws?token=${encodeURIComponent(token)}`;

  console.log(`Connecting to ${base} ...`);
  console.log(`Config file: ${getConfigPath()}`);

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
      console.log('Opening Tally Prime...');
      ensureTallyRunning().catch(() => {});
      return;
    }

    if (msg.type === 'sync_request') {
      console.log(`📨 Sync bill to Tally (${msg.requestId})...`);
      try {
        const tallyUp = await ensureTallyRunning();
        if (!tallyUp) {
          throw new Error('Tally HTTP Server not responding on port 9000');
        }
        const tallyRes = await fetch(TALLY_LOCAL_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/xml' },
          body: msg.xml,
          timeout: 45000
        });
        const responseText = await tallyRes.text();
        const ok = isTallyXmlSuccess(responseText, tallyRes.ok);
        if (ok) {
          console.log('✅ Tally accepted data.');
        } else {
          const errLine = (responseText.match(/<LINEERROR>(.*?)<\/LINEERROR>/i) || [])[1] || 'Tally rejected voucher (check company selected)';
          console.error('❌ Tally error:', errLine.replace(/<[^>]+>/g, '').trim());
        }
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'sync_result',
            requestId: msg.requestId,
            ok,
            responseText,
            error: ok ? undefined : 'Tally did not create voucher — select company in Tally Gateway'
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
  console.log('=== BolKarigar Tally Sync Agent ===');
  const config = await ensureConfig();
  connect(config);
})();
