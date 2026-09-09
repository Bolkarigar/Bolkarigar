// ==================================================================================
// BolKarigar Tally Sync — Desktop Agent
// ==================================================================================
// Yeh chhota program aapke DUKAAN ke PC par chalta hai (jahan Tally Prime bhi
// khuli hoti hai). Yeh cloud server se connected rehta hai, aur jab bhi aap
// browser se "Sync to Tally" dabate hain, cloud server yahan XML bhejta hai —
// yeh Agent us XML ko seedha aapki isi PC par chal rahi Tally Prime
// (http://localhost:9000) ko bhej deta hai, aur result wapas cloud ko bhej deta hai.
//
// ISKO BAND MAT KARO jab tak aap Tally sync use karna chahte hain — yeh jitni
// der khula rahega, utni der cloud app se sync kaam karega.
// ==================================================================================

const WebSocket = require('ws');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { exec } = require('child_process');

const CONFIG_PATH = path.join(__dirname, 'agent-config.json');
const TALLY_LOCAL_URL = 'http://localhost:9000';
const TALLY_EXE_PATHS = [
  'C:\\Program Files\\TallyPrime\\tally.exe',
  'C:\\Program Files (x86)\\TallyPrime\\tally.exe',
  'C:\\Tally.ERP9\\tally.exe'
];
const TALLY_PING_XML = '<?xml version="1.0"?><ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>LicenseInfo</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></DESC></BODY></ENVELOPE>';

function launchTallyPrime() {
  if (process.platform !== 'win32') {
    console.log('⚠️  Auto-launch works on Windows only — open Tally manually.');
    return false;
  }
  for (const exePath of TALLY_EXE_PATHS) {
    if (!fs.existsSync(exePath)) continue;
    exec(`"${exePath}"`, { windowsHide: false }, (err) => {
      if (err) console.error(`⚠️  Tally launch: ${err.message}`);
      else console.log('✅ Tally Prime open ho rahi hai...');
    });
    return true;
  }
  console.warn('⚠️  tally.exe standard paths mein nahi mila — Tally manually kholo.');
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

async function ensureTallyRunning() {
  if (await isTallyHttpUp()) return true;
  console.log('📂 Tally band lag rahi hai — auto open kar rahe hain...');
  launchTallyPrime();
  for (let attempt = 1; attempt <= 8; attempt++) {
    await new Promise((r) => setTimeout(r, 2000));
    if (await isTallyHttpUp()) {
      console.log(`✅ Tally ready (attempt ${attempt}).`);
      return true;
    }
    console.log(`   ...Tally start ho rahi hai (${attempt}/8)`);
  }
  return false;
}

function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch {
      console.error('⚠️  agent-config.json padhne mein dikkat aayi, naya banayenge.');
    }
  }
  return null;
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

function askQuestion(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(query, (answer) => { rl.close(); resolve(answer.trim()); }));
}

async function ensureConfig() {
  let config = loadConfig();
  if (config && config.backendUrl && config.agentToken) return config;

  console.log('\n=== BolKarigar Desktop Agent — Pehli Baar Setup ===\n');
  console.log('Yeh jaankari aapko BolKarigar app ke andar "Settings → Desktop Agent" section mein milegi.\n');

  const defaultUrl = 'https://bolkarigar.onrender.com';
  const backendUrl = await askQuestion(`Cloud server address [Enter = ${defaultUrl}]: `) || defaultUrl;
  const agentToken = await askQuestion('Aapka Agent Pairing Token: ');

  config = {
    backendUrl: backendUrl.replace(/\/+$/, ''),
    agentToken: agentToken
  };
  saveConfig(config);
  console.log('\n✅ Config save ho gayi (agent-config.json). Agli baar yeh sawaal nahi puchega.\n');
  return config;
}

let ws = null;
let reconnectDelay = 3000;
const MAX_RECONNECT_DELAY = 30000;

function connect(config) {
  const wsUrl = config.backendUrl.replace(/^http/, 'ws') + `/agent-ws?token=${encodeURIComponent(config.agentToken)}`;
  console.log(`🔌 Connect ho raha hai: ${config.backendUrl} ...`);

  ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    reconnectDelay = 3000; // successful connect hone par retry-delay reset karo
    console.log('✅ Cloud server se connected! Ab "Sync to Tally" browser se turant kaam karega.');
    console.log('   (Is window ko khula rakhein jab tak sync chahiye.)\n');
  });

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'connected') {
      console.log(`ℹ️  ${msg.message}`);
      return;
    }

    if (msg.type === 'open_tally') {
      console.log('📂 Sync Tally click — Tally Prime auto open...');
      await ensureTallyRunning();
      return;
    }

    if (msg.type === 'sync_request') {
      console.log(`📨 Naya sync request mila (id: ${msg.requestId}). Tally ko bhej rahe hain...`);
      await ensureTallyRunning();
      try {
        const tallyRes = await fetch(TALLY_LOCAL_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/xml' },
          body: msg.xml,
          timeout: 15000
        });
        const responseText = await tallyRes.text();
        console.log(`✅ Tally se response mila (status ${tallyRes.status}). Cloud ko bhej rahe hain...`);
        ws.send(JSON.stringify({
          type: 'sync_result',
          requestId: msg.requestId,
          ok: tallyRes.ok,
          responseText
        }));
      } catch (err) {
        console.error(`❌ Tally se connect nahi ho paya: ${err.message}`);
        console.error('   Confirm karein Tally Prime khuli hai aur Settings → Connectivity → "TallyPrime acts as: Server/Both", Port 9000 hai.');
        ws.send(JSON.stringify({
          type: 'sync_result',
          requestId: msg.requestId,
          ok: false,
          error: `Agent Tally se connect nahi kar paya: ${err.message}`
        }));
      }
    }
  });

  ws.on('close', (code, reason) => {
    if (code === 4003) {
      console.error('\n❌ Agent Token galat hai. agent-config.json delete karke dobara sahi token daalein.\n');
      process.exit(1);
    }
    if (code === 4009) {
      console.error('\n⚠️  Aapka token app se reset kar diya gaya hai. Naya token lekar agent-config.json update karein.\n');
      process.exit(1);
    }
    console.log(`🔌 Connection cut gaya. ${reconnectDelay / 1000}s mein dobara try karenge...`);
    setTimeout(() => connect(config), reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 1.5, MAX_RECONNECT_DELAY);
  });

  ws.on('error', (err) => {
    console.error(`⚠️  Connection error: ${err.message}`);
  });
}

(async () => {
  console.log('=== BolKarigar Tally Sync — Desktop Agent ===');
  const config = await ensureConfig();
  connect(config);
})();
