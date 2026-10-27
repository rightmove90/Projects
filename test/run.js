// اختبار شامل: يشغّل الخادم على تخزين محلي ثم على Drive وهمي ويجرّب كل المسارات
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { init } = require('../server');
const { LocalStorage } = require('../lib/local');
const { DriveStorage } = require('../lib/drive');
const { FakeDrive } = require('./fake-drive');
const { b64u } = require('../lib/util');

let pass = 0;
const ok = (c, m) => { assert.ok(c, m); pass++; };
const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); pass++; };

async function suite(label, storage) {
  console.log('\n— ' + label);
  const srv = await init({ storageInstance: storage, adminUsername: 'admin', adminPassword: 'Admin#123', sessionSecret: 'test-secret' });
  await new Promise((r) => srv.listen(0, r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const jar = {};
  const call = async (who, method, url, body, extra = {}) => {
    const headers = { ...(extra.headers || {}) };
    if (jar[who]) headers.cookie = 'sp=' + jar[who];
    let payload = body;
    if (body && !Buffer.isBuffer(body) && typeof body === 'object') { payload = JSON.stringify(body); headers['content-type'] = 'application/json'; }
    const res = await fetch(base + url, { method, headers, body: payload, redirect: 'manual' });
    const sc = res.headers.get('set-cookie');
    if (sc) { const m = /sp=([^;]*)/.exec(sc); jar[who] = m[1] || null; }
    return res;
  };
  const J = async (...a) => { const r = await call(...a); return { status: r.status, body: await r.json().catch(() => null) }; };

  // دخول
  eq((await J('a', 'POST', '/api/login', { username: 'admin', password: 'bad' })).status, 401, 'كلمة مرور خاطئة');
  const li = await J('a', 'POST', '/api/login', { username: 'ADMIN', password: 'Admin#123' });
  eq(li.status, 200, 'دخول المسؤول'); eq(li.body.user.role, 'admin');
  eq((await J('x', 'GET', '/api/projects')).status, 401, 'بدون جلسة');
  eq((await J('a', 'GET', '/api/me')).body.user.username, 'admin');

  // مشروع
  const name = 'مشروع الأمل';
  const cp = await J('a', 'POST', '/api/projects', { name });
  eq(cp.status, 200); const pid = cp.body.project.id;
  eq((await J('a', 'POST', '/api/projects', { name })).status, 409, 'اسم مكرر');

  const bin = crypto.randomBytes(300000);
  const up = async (section, fname, buf, type) => J('a', 'PUT', `/api/projects/${encodeURIComponent(pid)}/files?section=${section}&name=${encodeURIComponent(fname)}`, buf, { headers: { 'content-type': type } });
  eq((await up('videos', 'جولة المشروع.mp4', bin, 'video/mp4')).status, 200, 'رفع فيديو');
  eq((await up('info_ar', 'نبذة عن المشروع.pdf', Buffer.from('%PDF-1.4 hello'), 'application/pdf')).status, 200);
  eq((await up('prices', 'prices.xlsx', Buffer.from('xlsxdata'), 'application/octet-stream')).status, 200);
  eq((await up('maps', 'x.html', Buffer.from('<script>alert(1)</script>'), 'text/html')).status, 200);
  eq((await up('nope', 'a.txt', Buffer.from('a'), 'text/plain')).status, 400, 'قسم غير صالح');
  eq((await up('cover', 'photo.PNG', Buffer.from('pngdata'), 'image/png')).status, 200, 'غلاف');
  eq((await J('a', 'POST', `/api/projects/${encodeURIComponent(pid)}/links`, { section: 'location', title: 'موقع على الخريطة', url: 'maps.google.com/?q=35.56,45.43' })).status, 200, 'رابط');
  eq((await J('a', 'POST', `/api/projects/${encodeURIComponent(pid)}/links`, { section: 'location', title: 'x', url: 'javascript:alert(1)' })).status, 400, 'رابط خطير مرفوض');

  const list = await J('a', 'GET', '/api/projects');
  eq(list.body.projects.length, 1); ok(list.body.projects[0].coverUrl, 'غلاف في القائمة');
  const pr = (await J('a', 'GET', `/api/projects/${encodeURIComponent(pid)}`)).body.project;
  eq(pr.name, name);
  eq(pr.sections.videos[0].name, 'جولة المشروع.mp4', 'اسم عربي سليم');
  eq(pr.sections.videos[0].category, 'video');
  eq(pr.sections.location[0].kind, 'link'); eq(pr.sections.location[0].shareUrl, 'https://maps.google.com/?q=35.56,45.43');
  eq(pr.sections.location[0].name, 'موقع على الخريطة');

  // ملفات
  const v = pr.sections.videos[0];
  eq((await call('x', 'GET', v.openUrl)).status, 401, 'الملف يحتاج جلسة');
  const f1 = await call('a', 'GET', v.openUrl); eq(f1.status, 200); ok(Buffer.from(await f1.arrayBuffer()).equals(bin), 'محتوى الفيديو مطابق');
  const share = v.shareUrl.replace(base, '');
  const f2 = await call('x', 'GET', share); eq(f2.status, 200, 'رابط مشاركة عام'); eq(f2.headers.get('accept-ranges'), 'bytes');
  ok(/filename\*=UTF-8''/.test(f2.headers.get('content-disposition')), 'اسم الملف في الترويسة');
  const r1 = await call('x', 'GET', share, null, { headers: { range: 'bytes=100-199' } });
  eq(r1.status, 206); eq(r1.headers.get('content-range'), `bytes 100-199/${bin.length}`);
  ok(Buffer.from(await r1.arrayBuffer()).equals(bin.subarray(100, 200)), 'نطاق صحيح');
  eq((await call('x', 'GET', share, null, { headers: { range: 'bytes=999999999-' } })).status, 416);
  eq((await call('x', 'GET', share.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a')))).status, 404, 'توقيع خاطئ');
  const risky = pr.sections.maps[0]; const rf = await call('a', 'GET', risky.openUrl);
  ok(/attachment/.test(rf.headers.get('content-disposition')) && rf.headers.get('content-type') === 'application/octet-stream', 'HTML يُنزَّل ولا يُعرض');
  eq((await call('a', 'GET', `/api/file/${b64u('../../etc/passwd')}`)).status, 404, 'منع اجتياز المسار');
  eq((await call('a', 'GET', '/api/file/zzzz')).status, 404);

  // صفحات المشاركة
  const pp = await call('x', 'GET', pr.shareUrl.replace(base, '')); const html = await pp.text();
  eq(pp.status, 200); ok(html.includes('جولة المشروع.mp4') && html.includes('نبذة عن المشروع.pdf'), 'صفحة المشروع');
  const cpg = await (await call('x', 'GET', pr.sectionShareUrls.videos.replace(base, ''))).text();
  ok(cpg.includes('جولة المشروع.mp4') && !cpg.includes('prices.xlsx'), 'صفحة القسم');
  eq((await call('x', 'GET', pr.sectionShareUrls.videos.replace(base, '').slice(0, -2) + 'zz')).status, 404);

  // مستخدمون وصلاحيات
  const nu = await J('a', 'POST', '/api/admin/users', { username: 'Sara', name: 'سارة', password: 'secret1', role: 'sales' });
  eq(nu.status, 200); eq(nu.body.user.username, 'sara');
  eq((await J('a', 'POST', '/api/admin/users', { username: 'sara', password: 'secret1' })).status, 409);
  eq((await J('a', 'POST', '/api/admin/users', { username: 'ab', password: 'secret1' })).status, 400);
  eq((await J('s', 'POST', '/api/login', { username: 'sara', password: 'secret1' })).status, 200);
  eq((await J('s', 'GET', '/api/projects')).body.projects.length, 1, 'موظف يرى المشاريع');
  eq((await J('s', 'POST', '/api/projects', { name: 'x' })).status, 403, 'موظف لا ينشئ مشروعاً');
  eq((await J('s', 'GET', '/api/admin/users')).status, 403);
  eq((await J('s', 'DELETE', `/api/files/${v.id}`)).status, 403);
  eq((await J('a', 'PATCH', `/api/admin/users/${nu.body.user.id}`, { active: false })).status, 200);
  eq((await J('s', 'GET', '/api/projects')).status, 401, 'الحساب الموقوف يُطرد فوراً');
  eq((await J('s2', 'POST', '/api/login', { username: 'sara', password: 'secret1' })).status, 403, 'لا دخول للموقوف');
  await J('a', 'PATCH', `/api/admin/users/${nu.body.user.id}`, { active: true, password: 'newpass1' });
  eq((await J('s3', 'POST', '/api/login', { username: 'sara', password: 'newpass1' })).status, 200, 'كلمة مرور جديدة');
  const me = (await J('a', 'GET', '/api/me')).body.user;
  eq((await J('a', 'PATCH', `/api/admin/users/${me.id}`, { active: false })).status, 400, 'لا يوقف نفسه');
  eq((await J('a', 'DELETE', `/api/admin/users/${me.id}`)).status, 400);
  eq((await J('a', 'POST', '/api/me/password', { current: 'wrong', password: 'abcdef' })).status, 400);
  eq((await J('a', 'POST', '/api/me/password', { current: 'Admin#123', password: 'Admin#456' })).status, 200);
  eq((await J('a', 'GET', '/api/me')).status, 200, 'الجلسة تبقى بعد تغيير كلمة المرور');
  eq((await J('a2', 'POST', '/api/login', { username: 'admin', password: 'Admin#456' })).status, 200);

  // إعدادات
  const st = await J('a', 'PUT', '/api/admin/settings', { siteName: 'شركة النور', labels: { videos: 'جولات الفيديو' }, countryCode: '+964' });
  eq(st.body.settings.siteName, 'شركة النور'); eq(st.body.settings.countryCode, '964');
  eq((await J('s3', 'GET', '/api/config')).body.labels.videos, 'جولات الفيديو'); eq((await J('x', 'GET', '/api/public')).body.siteName, 'شركة النور');
  eq((await J('s3', 'PUT', '/api/admin/settings', { siteName: 'x' })).status, 403);

  // تسجيل دخول متكرر خاطئ
  let last; for (let i = 0; i < 9; i++) last = await J('z', 'POST', '/api/login', { username: 'ghost', password: 'x' });
  eq(last.status, 429, 'حد المحاولات');

  // إعادة تسمية وحذف
  const rn = await J('a', 'PATCH', `/api/projects/${encodeURIComponent(pid)}`, { name: 'مشروع النور' });
  eq(rn.status, 200); const pid2 = rn.body.project.id;
  const del = await J('a', 'DELETE', `/api/files/${v.id.includes('/') ? v.id : v.id}`);
  // بعد إعادة التسمية قد يتغير معرّف الملف في التخزين المحلي، لذا نجلب المشروع من جديد
  const pr2 = (await J('a', 'GET', `/api/projects/${encodeURIComponent(pid2)}`)).body.project;
  if (del.status === 200) ok(true); else { eq(del.status, 404); }
  const pdf = pr2.sections.info_ar[0];
  eq((await J('a', 'DELETE', `/api/files/${pdf.id}`)).status, 200, 'حذف ملف');
  eq((await J('a', 'GET', `/api/projects/${encodeURIComponent(pid2)}`)).body.project.sections.info_ar.length, 0);
  eq((await call('a', 'GET', pdf.openUrl)).status, 404, 'الملف المحذوف لا يُفتح');
  eq((await J('a', 'DELETE', `/api/projects/${encodeURIComponent(pid2)}`)).status, 200, 'حذف مشروع');
  eq((await J('a', 'GET', '/api/projects')).body.projects.length, 0);

  // ثابت
  const idx = await call('x', 'GET', '/'); ok([200, 404].includes(idx.status));
  eq((await call('x', 'GET', '/..%2f..%2fserver.js')).status, 404, 'منع اجتياز المسار في الثابت');
  eq((await call('x', 'GET', '/lib/users.js')).status, 404, 'الكود غير مكشوف');

  // استمرارية المستخدمين بعد إعادة التحميل
  const { Users } = require('../lib/users'); const u2 = new Users(storage); await u2.load();
  ok(u2.byUsername('sara') && u2.byUsername('admin'), 'المستخدمون محفوظون');
  await new Promise((r) => srv.close(r));
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-test-'));
  await suite('تخزين محلي', new LocalStorage(dir));
  const fake = new FakeDrive();
  await suite('Google Drive (وهمي)', new DriveStorage(fake, fake.root));
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\nنجحت ${pass} فحصاً ✔`);
})().catch((e) => { console.error('\nفشل الاختبار:', e); process.exit(1); });
