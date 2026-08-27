const https = require('https');

function postForgot(email) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ email });
    const req = https.request({
      hostname: 'bolkarigar.onrender.com',
      path: '/api/auth/forgot-password',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data || '{}') }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  for (const email of ['admin', 'test@example.com', 'vkverma3185@gmail.com']) {
    const r = await postForgot(email);
    console.log(email, '=>', r.status, r.data);
  }
})();
