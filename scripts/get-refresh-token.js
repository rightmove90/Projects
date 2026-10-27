// يحصل على GOOGLE_REFRESH_TOKEN مرة واحدة. شغّله على حاسوبك:  npm run drive-auth
try { process.loadEnvFile(require('path').join(__dirname, '..', '.env')); } catch { /* */ }
const http = require('http');
const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) { console.error('ضع GOOGLE_CLIENT_ID و GOOGLE_CLIENT_SECRET في ملف .env أولاً (انظر README).'); process.exit(1); }
const PORT = 53682; const redirect = `http://localhost:${PORT}/oauth2callback`;
const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: id, redirect_uri: redirect, response_type: 'code', access_type: 'offline', prompt: 'consent',
  scope: 'https://www.googleapis.com/auth/drive',
});
const srv = http.createServer(async (req, res) => {
  const u = new URL(req.url, redirect);
  if (u.pathname !== '/oauth2callback') { res.end(); return; }
  const code = u.searchParams.get('code');
  if (!code) { res.end('لم يصل رمز التفويض: ' + (u.searchParams.get('error') || '')); return; }
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: redirect, grant_type: 'authorization_code' }),
  });
  const j = await r.json();
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  if (!j.refresh_token) { res.end('<h2>لم يصل refresh_token</h2><pre>' + JSON.stringify(j) + '</pre>'); console.error('فشل:', j); srv.close(); return; }
  res.end('<h2 style="font-family:sans-serif">تم! ارجع إلى الطرفية (Terminal) وانسخ الرمز.</h2>');
  console.log('\nأضف هذا السطر إلى ملف .env (وإلى متغيرات الاستضافة):\n\nGOOGLE_REFRESH_TOKEN=' + j.refresh_token + '\n');
  srv.close();
});
srv.listen(PORT, () => { console.log('افتح هذا الرابط في المتصفح وسجّل الدخول بحساب Google الذي يملك مجلد المشاريع:\n\n' + url + '\n'); });
