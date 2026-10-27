try { process.loadEnvFile(require('path').join(__dirname, '.env')); } catch { /* لا يوجد .env */ }
const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const cfg = require('./lib/config');
const { GDriveApi } = require('./lib/gdrive');
const { DriveStorage } = require('./lib/drive');
const { LocalStorage } = require('./lib/local');
const { Users } = require('./lib/users');
const { Settings } = require('./lib/settings');
const { sharePage } = require('./lib/pages');
const { SECTION_KEYS, STRUCTURE } = require('./lib/sections');
const { HttpError, categoryOf, RISKY, mimeFromName, cleanName } = require('./lib/util');

let storage; let users; let settings; let secret;

// ---------- أدوات التوقيع والجلسات ----------
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest('base64url');
const shareSig = (kind, key) => hmac(secret + ':share', `${kind}:${key}`).slice(0, 24);
const safeEq = (a, b) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

function makeSession(u) {
  const body = Buffer.from(JSON.stringify({ u: u.id, v: u.tokenVersion, e: Date.now() + cfg.sessionDays * 864e5 })).toString('base64url');
  return body + '.' + hmac(secret + ':session', body);
}
function readSession(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig || !safeEq(sig, hmac(secret + ':session', body))) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); return p.e > Date.now() ? p : null; } catch { return null; }
}
const parseCookies = (h) => Object.fromEntries(String(h || '').split(';').map((c) => c.trim().split(/=(.*)/s).slice(0, 2)).filter((p) => p[0]));

function userFromReq(req) {
  const s = readSession(parseCookies(req.headers.cookie).sp);
  if (!s) return null;
  const u = users.byId(s.u);
  return u && u.active && u.tokenVersion === s.v ? u : null;
}
function isHttps(req) { return req.headers['x-forwarded-proto'] === 'https' || cfg.baseUrl.startsWith('https'); }
function setCookie(res, req, value, maxAge) {
  res.setHeader('Set-Cookie', `sp=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${isHttps(req) ? '; Secure' : ''}`);
}
const origin = (req) => cfg.baseUrl || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers['x-forwarded-host'] || req.headers.host}`;

// ---------- أدوات HTTP ----------
function send(res, status, obj) {
  const b = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(b);
}
function readBody(req, limit = 1e6) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new HttpError(413, 'الطلب كبير جداً')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(new HttpError(400, 'صيغة الطلب غير صالحة')); } });
    req.on('error', reject);
  });
}
function disposition(kind, name) {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name).replace(/['()]/g, escape)}`;
}

async function serveFile(req, res, id, { download = false, cache = 'private, max-age=3600' } = {}) {
  const r = await storage.openFile(id, req.headers.range);
  const risky = RISKY.test(r.mime || '');
  const h = {
    'Content-Type': risky ? 'application/octet-stream' : (r.headers['content-type'] && !r.headers['content-type'].startsWith('application/octet-stream') ? r.headers['content-type'] : r.mime || mimeFromName(r.name)),
    'Accept-Ranges': 'bytes', 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': disposition(download || risky ? 'attachment' : 'inline', r.name),
  };
  if (r.headers['content-length']) h['Content-Length'] = r.headers['content-length'];
  if (r.headers['content-range']) h['Content-Range'] = r.headers['content-range'];
  res.writeHead(r.status, h);
  if (!r.stream || req.method === 'HEAD') { res.end(); if (r.stream) r.stream.destroy(); return; }
  res.on('close', () => r.stream.destroy());
  r.stream.on('error', () => res.destroy());
  r.stream.pipe(res);
}

// ---------- بناء بيانات المشروع للواجهة ----------
function decorate(req, it) {
  const o = origin(req);
  if (it.kind === 'link') return { id: it.id, name: it.name, kind: 'link', category: 'link', size: 0, openUrl: it.url, shareUrl: it.url };
  return {
    id: it.id, name: it.name, kind: 'file', mime: it.mime, size: it.size, category: categoryOf(it.mime),
    openUrl: `/api/file/${it.id}`, downloadUrl: `/api/file/${it.id}?download=1`, shareUrl: `${o}/s/f/${it.id}/${shareSig('f', it.id)}`,
  };
}
function projectView(req, p) {
  const o = origin(req);
  const sections = {}; const shareUrls = {};
  for (const k of SECTION_KEYS) {
    sections[k] = p.sections[k].map((it) => decorate(req, it));
    shareUrls[k] = `${o}/s/c/${p.id}/${k}/${shareSig('c', p.id + '/' + k)}`;
  }
  shareUrls.info = `${o}/s/c/${p.id}/info/${shareSig('c', p.id + '/info')}`; // مجموعة المعلومات (3 لغات)
  return {
    id: p.id, name: p.name, coverUrl: p.coverId ? `/api/file/${p.coverId}` : null,
    shareUrl: `${o}/s/p/${p.id}/${shareSig('p', p.id)}`, sections, sectionShareUrls: shareUrls,
  };
}

// ---------- المسارات ----------
const routes = [];
function route(method, pattern, access, handler) {
  const keys = [...pattern.matchAll(/:(\w+)/g)].map((m) => m[1]);
  routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '([^/]+)') + '$'), keys, access, handler });
}

const attempts = new Map();
function throttle(key) {
  const now = Date.now(); const a = (attempts.get(key) || []).filter((t) => now - t < 15 * 60 * 1000);
  attempts.set(key, a);
  return a;
}

route('GET', '/api/public', 'public', async ({ res }) => {
  const s = settings.get(); send(res, 200, { siteName: s.siteName, tagline: s.tagline });
});

route('POST', '/api/login', 'public', async ({ req, res }) => {
  const b = await readBody(req);
  const key = `${req.socket.remoteAddress}|${String(b.username || '').toLowerCase()}`;
  if (throttle(key).length >= 8) throw new HttpError(429, 'محاولات كثيرة. حاول بعد 15 دقيقة.');
  const u = await users.authenticate(b.username, b.password);
  if (!u) { attempts.get(key).push(Date.now()); throw new HttpError(401, 'اسم المستخدم أو كلمة المرور غير صحيحة'); }
  attempts.delete(key);
  setCookie(res, req, makeSession(u), cfg.sessionDays * 86400);
  send(res, 200, { user: users.view(u) });
});

route('POST', '/api/logout', 'public', async ({ req, res }) => { setCookie(res, req, '', 0); send(res, 200, { ok: true }); });
route('GET', '/api/me', 'auth', async ({ res, user }) => send(res, 200, { user: users.view(user) }));

route('POST', '/api/me/password', 'auth', async ({ req, res, user }) => {
  const b = await readBody(req);
  if (!(await users.authenticate(user.username, b.current))) throw new HttpError(400, 'كلمة المرور الحالية غير صحيحة');
  await users.update(user.id, { password: b.password });
  setCookie(res, req, makeSession(users.byId(user.id)), cfg.sessionDays * 86400);
  send(res, 200, { ok: true });
});

route('GET', '/api/config', 'auth', async ({ res }) => {
  send(res, 200, { ...settings.get(), structure: STRUCTURE });
});

route('GET', '/api/projects', 'auth', async ({ res }) => {
  const list = await storage.listProjects();
  send(res, 200, { projects: list.map((p) => ({ id: p.id, name: p.name, coverUrl: p.coverId ? `/api/file/${p.coverId}` : null })) });
});

route('GET', '/api/projects/:id', 'auth', async ({ req, res, params }) => {
  send(res, 200, { project: projectView(req, await storage.getProject(params.id)) });
});

route('POST', '/api/refresh', 'auth', async ({ res }) => { storage.invalidate(); send(res, 200, { ok: true }); });

route('GET', '/api/file/:id', 'auth', async ({ req, res, params, query }) => {
  await serveFile(req, res, params.id, { download: query.get('download') === '1' });
});

// ----- إدارة المشاريع والملفات (المسؤول) -----
route('POST', '/api/projects', 'admin', async ({ req, res }) => {
  const b = await readBody(req); send(res, 200, { project: await storage.createProject(b.name) });
});
route('PATCH', '/api/projects/:id', 'admin', async ({ req, res, params }) => {
  const b = await readBody(req); send(res, 200, { project: await storage.renameProject(params.id, b.name) });
});
route('DELETE', '/api/projects/:id', 'admin', async ({ res, params }) => { await storage.deleteProject(params.id); send(res, 200, { ok: true }); });

route('POST', '/api/projects/:id/links', 'admin', async ({ req, res, params }) => {
  const b = await readBody(req);
  let url = String(b.url || '').trim();
  if (url && !/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;
  if (!/^https?:\/\/\S+$/i.test(url)) throw new HttpError(400, 'الرابط غير صالح');
  if (!String(b.title || '').trim()) throw new HttpError(400, 'عنوان الرابط مطلوب');
  send(res, 200, await storage.addLink(params.id, b.section, b.title, url));
});

route('PUT', '/api/projects/:id/files', 'admin', async ({ req, res, params, query }) => {
  const section = query.get('section'); const name = query.get('name') || 'file';
  const size = +req.headers['content-length'] || 0;
  const max = cfg.maxUploadMb * 1048576;
  if (size > max) throw new HttpError(413, `الحد الأقصى للرفع ${cfg.maxUploadMb} MB. للملفات الأكبر ارفعها مباشرة في Google Drive.`);
  const tmpPath = path.join(os.tmpdir(), 'sp-' + crypto.randomBytes(8).toString('hex'));
  let got = 0;
  try {
    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(tmpPath);
      req.on('data', (c) => { got += c.length; if (got > max) { reject(new HttpError(413, 'الملف أكبر من الحد المسموح')); req.destroy(); out.destroy(); } });
      req.on('error', reject); out.on('error', reject); out.on('finish', resolve);
      req.pipe(out);
    });
    if (got === 0) throw new HttpError(400, 'الملف فارغ');
    const r = await storage.saveFile(params.id, section, { tmpPath, name, mime: req.headers['content-type'] && req.headers['content-type'] !== 'application/octet-stream' ? req.headers['content-type'] : mimeFromName(name), size: got });
    send(res, 200, r);
  } finally { fsp.unlink(tmpPath).catch(() => {}); }
});

route('DELETE', '/api/files/:id', 'admin', async ({ res, params }) => { await storage.deleteFile(params.id); send(res, 200, { ok: true }); });

// ----- المستخدمون والإعدادات -----
route('GET', '/api/admin/users', 'admin', async ({ res }) => send(res, 200, { users: users.all() }));
route('POST', '/api/admin/users', 'admin', async ({ req, res }) => send(res, 200, { user: await users.create(await readBody(req)) }));
route('PATCH', '/api/admin/users/:uid', 'admin', async ({ req, res, params, user }) => {
  const b = await readBody(req);
  if (params.uid === user.id && (b.active === false || (b.role && b.role !== 'admin'))) throw new HttpError(400, 'لا يمكنك إيقاف حسابك أو تغيير صلاحيتك');
  send(res, 200, { user: await users.update(params.uid, b) });
});
route('DELETE', '/api/admin/users/:uid', 'admin', async ({ res, params, user }) => {
  if (params.uid === user.id) throw new HttpError(400, 'لا يمكنك حذف حسابك');
  await users.remove(params.uid); send(res, 200, { ok: true });
});
route('GET', '/api/admin/settings', 'admin', async ({ res }) => send(res, 200, { settings: settings.get() }));
route('PUT', '/api/admin/settings', 'admin', async ({ req, res }) => send(res, 200, { settings: await settings.update(await readBody(req)) }));

// ----- الروابط العامة للعميل (موقّعة) -----
route('GET', '/s/f/:id/:sig', 'public', async ({ req, res, params }) => {
  if (!safeEq(params.sig, shareSig('f', params.id))) throw new HttpError(404, 'الرابط غير صالح');
  await serveFile(req, res, params.id, { cache: 'public, max-age=3600' });
});

function htmlPage(res, status, html) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
  res.end(html);
}
function groupsFor(req, p, keys) {
  const v = projectView(req, p); const L = settings.get().labels;
  return keys.map((k) => ({
    label: k.startsWith('info_') ? `${L.info} — ${L[k]}` : L[k],
    items: v.sections[k].map((it) => ({ name: it.name, href: it.shareUrl, category: it.category, size: it.size })),
  }));
}
route('GET', '/s/p/:id/:sig', 'public', async ({ req, res, params }) => {
  if (!safeEq(params.sig, shareSig('p', params.id))) throw new HttpError(404, 'الرابط غير صالح');
  const p = await storage.getProject(params.id);
  htmlPage(res, 200, sharePage({ siteName: settings.get().siteName, title: p.name, groups: groupsFor(req, p, SECTION_KEYS) }));
});
route('GET', '/s/c/:id/:section/:sig', 'public', async ({ req, res, params }) => {
  const isGroup = params.section === 'info';
  if (!(isGroup || SECTION_KEYS.includes(params.section)) || !safeEq(params.sig, shareSig('c', params.id + '/' + params.section))) throw new HttpError(404, 'الرابط غير صالح');
  const p = await storage.getProject(params.id);
  const keys = isGroup ? ['info_ar', 'info_ku', 'info_en'] : [params.section];
  htmlPage(res, 200, sharePage({ siteName: settings.get().siteName, title: p.name, groups: groupsFor(req, p, keys) }));
});

// ---------- الملفات الثابتة ----------
const PUBLIC = path.join(__dirname, 'public');
const STATIC_MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.ico': 'image/x-icon' };
async function serveStatic(req, res, pathname) {
  let p = pathname === '/' ? '/index.html' : pathname;
  const full = path.normalize(path.join(PUBLIC, decodeURIComponent(p)));
  if (!full.startsWith(PUBLIC + path.sep)) return false;
  const st = await fsp.stat(full).catch(() => null);
  if (!st || !st.isFile()) return false;
  res.writeHead(200, { 'Content-Type': STATIC_MIME[path.extname(full)] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-cache' });
  if (req.method === 'HEAD') res.end(); else fs.createReadStream(full).pipe(res);
  return true;
}

// ---------- المعالج الرئيسي ----------
async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  const url = new URL(req.url, 'http://x');
  const method = req.method === 'HEAD' ? 'GET' : req.method;
  try {
    for (const r of routes) {
      if (r.method !== method) continue;
      const m = r.re.exec(url.pathname);
      if (!m) continue;
      const params = {}; r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      let user = null;
      if (r.access !== 'public') {
        user = userFromReq(req);
        if (!user) throw new HttpError(401, 'يرجى تسجيل الدخول');
        if (r.access === 'admin' && user.role !== 'admin') throw new HttpError(403, 'هذه العملية للمسؤول فقط');
      }
      return await r.handler({ req, res, params, query: url.searchParams, user });
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      if (await serveStatic(req, res, url.pathname)) return;
    }
    throw new HttpError(404, 'غير موجود');
  } catch (e) {
    if (res.headersSent) { res.destroy(); return; }
    const status = e.status || 500;
    if (status === 500) console.error(e);
    const wantsHtml = url.pathname.startsWith('/s/');
    if (wantsHtml) return htmlPage(res, status, sharePage({ siteName: settings.get().siteName, title: status === 404 ? 'الرابط غير صالح' : 'حدث خطأ', groups: [] }));
    send(res, status, { error: status === 500 ? 'حدث خطأ في الخادم' : e.message });
  }
}

async function init(overrides = {}) {
  const c = { ...cfg, ...overrides };
  if (overrides.storageInstance) storage = overrides.storageInstance;
  else if (c.storage === 'drive') {
    storage = new DriveStorage(new GDriveApi({ ...c.google }), c.driveRootId);
  } else storage = new LocalStorage(c.dataDir);
  await storage.init();
  settings = new Settings(storage); await settings.load();
  users = new Users(storage); await users.load();

  const app = await storage.readJson('app', {});
  secret = c.sessionSecret || app.secret;
  if (!secret) { secret = crypto.randomBytes(32).toString('hex'); app.secret = secret; await storage.writeJson('app', app); }

  if (!users.list.length) {
    const pw = c.adminPassword || crypto.randomBytes(6).toString('base64url');
    await users.create({ username: c.adminUsername, name: 'المسؤول', password: pw, role: 'admin' });
    console.log('\n==============================================');
    console.log(' تم إنشاء حساب المسؤول الأول');
    console.log(` اسم المستخدم: ${c.adminUsername}`);
    if (!c.adminPassword) console.log(` كلمة المرور:  ${pw}   (غيّرها بعد الدخول)`);
    console.log('==============================================\n');
  }
  return http.createServer(handler);
}

module.exports = { init };

if (require.main === module) {
  init().then((srv) => srv.listen(cfg.port, () => console.log(`الموقع يعمل على المنفذ ${cfg.port} — التخزين: ${cfg.storage === 'drive' ? 'Google Drive' : 'محلي (' + cfg.dataDir + ')'}`)))
    .catch((e) => { console.error('فشل التشغيل:', e.message); process.exit(1); });
}
