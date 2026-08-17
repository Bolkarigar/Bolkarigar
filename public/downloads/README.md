# BolKarigar Tally Sync Agent

## Run (Node.js required on Windows PC)

1. Install Node.js from https://nodejs.org
2. Open PowerShell in this folder
3. Run: `node BolKarigarTallyAgent.js`
4. Enter your cloud server URL (e.g. `https://app.bolkarigar.in`)
5. Paste pairing token from BolKarigar sidebar → Tally Sync Agent

## Requirements

- Tally Prime running with HTTP Server ON (port 9000)
- Company selected in Tally
- BolKarigar server reachable from this PC

## Build .exe (optional)

```bash
npm install -g pkg
pkg BolKarigarTallyAgent.js --targets node18-win-x64 --output BolKarigarTallyAgent.exe
```

Copy `BolKarigarTallyAgent.exe` to this folder for download link to work.
