'use strict';
/* ===== أدوات ===== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const S = { me: null, cfg: null, pub: { siteName: 'مشاريع الشركة', tagline: '' }, projects: null, project: null, q: '' };

const P = (d) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const IC = {
  wa: P('<path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5z"/><path d="M9.2 8.8c.2 2.4 2.6 4.8 5 5l1-1.2-1.7-.9-.7.6c-.7-.3-1.4-1-1.7-1.7l.6-.7-.9-1.7z"/>'),
  open: P('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  video: P('<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m10 9.5 5 2.5-5 2.5z"/>'),
  image: P('<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m4 18 5-5 4 4 3-3 4 4"/>'),
  pdf: P('<path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M9 14h6M9 17h4"/>'),
  sheet: P('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 15h16M10 4v16"/>'),
  doc: P('<path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M9 13h6M9 16h6M9 10h2"/>'),
  audio: P('<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>'),
  link: P('<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.800 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  other: P('<path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/>'),
  upload: P('<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>'),
  plus: P('<path d="M12 5v14M5 12h14"/>'),
  trash: P('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>'),
  back: P('<path d="M9 6l6 6-6 6"/>'),
  search: P('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>'),
  refresh: P('<path d="M20 11a8 8 0 0 0-14.3-4.5L4 9M4 4v5h5M4 13a8 8 0 0 0 14.3 4.5L20 15M20 20v-5h-5"/>'),
  settings: P('<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>'),
  user: P('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.6-3.5 3.4-5.5 7-5.5s6.4 2 7 5.5"/>'),
  out: P('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h10"/>'),
  edit: P('<path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4"/>'),
  image2: P('<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m4 18 5-5 4 4 3-3 4 4"/>'),
  site: P('<path d="M14 50"/><path d="M4 20V10l5-3v13M9 20V4l6 3v13M15 20v-8l5 3v5M2 20h20"/>'),
};
const CAT_IC = { video: IC.video, image: IC.image, pdf: IC.pdf, sheet: IC.sheet, doc: IC.doc, audio: IC.audio, link: IC.link, other: IC.other };

function toast(msg, type = '') {
  const el = document.createElement('div'); el.className = 'toast ' + type; el.textContent = msg;
  $('#toasts').appendChild(el); setTimeout(() => el.remove(), type === 'err' ? 6000 : 3200); return el;
}
function progressToast(text) {
  const el = document.createElement('div'); el.className = 'toast';
  el.innerHTML = `<div class="t"></div><div class="bar"><i></i></div>`; $('#toasts').appendChild(el);
  return { set(t, pct) { $('.t', el).textContent = t; $('i', el).style.width = pct + '%'; }, done() { el.remove(); } };
}
const fmtSize = (n) => (!n ? '' : n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' KB' : n < 1073741824 ? (n / 1048576).toFixed(1) + ' MB' : (n / 1073741824).toFixed(2) + ' GB');
const norm = (s) => String(s || '').toLowerCase().replace(/[ً-ٟـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');

async function api(method, url, body) {
  const opt = { method, headers: {} };
  if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  const res = await fetch(url, opt);
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !url.includes('/login')) { S.me = null; renderLogin(); throw new Error(data.error || 'انتهت الجلسة'); }
  if (!res.ok) throw new Error(data.error || 'حدث خطأ');
  return data;
}

function modal({ title, body, actions = [], wide = false, onClose }) {
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<div class="dlg ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${title ? `<h2>${esc(title)}</h2>` : ''}<div class="mb">${body}</div>${actions.length ? '<div class="ft"></div>' : ''}</div>`;
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); onClose && onClose(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
  ov.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  const ft = $('.ft', ov);
  actions.forEach((a) => {
    const b = document.createElement('button'); b.className = 'btn ' + (a.cls || ''); b.textContent = a.label; b.type = 'button';
    b.onclick = async () => { b.disabled = true; try { const r = await a.run?.(ov); if (r !== false) close(); } catch (e) { toast(e.message, 'err'); } finally { b.disabled = false; } };
    ft.appendChild(b);
  });
  document.body.appendChild(ov);
  const first = $('input,select,textarea', ov); first && first.focus();
  return { el: ov, close };
}

/* ===== واتساب ===== */
const LS = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* */ } } };
function waNumber() {
  const raw = ($('#clientNum') || {}).value || '';
  let d = raw.replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2); else if (d.startsWith('0')) d = (S.cfg.countryCode || '964') + d.slice(1);
  return d;
}
function waUrl(text) {
  const n = waNumber();
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}
function numberOk() {
  const raw = ($('#clientNum') || {}).value || '';
  if (raw.trim() && waNumber().length < 9) { toast('رقم العميل غير مكتمل. اتركه فارغاً لاختيار جهة الاتصال من واتساب.', 'err'); return false; }
  return true;
}
function sendWA(text) { if (!numberOk()) return; window.open(waUrl(text), '_blank', 'noopener'); }
// للإرسال الذي يحتاج جلب بيانات أولاً: نفتح النافذة فوراً كي لا يحظرها المتصفح
async function sendWAAsync(build) {
  if (!numberOk()) return;
  const w = window.open('', '_blank');
  try {
    const text = await build();
    if (!text) { w && w.close(); return; }
    if (w) w.location.href = waUrl(text); else location.href = waUrl(text);
  } catch (e) { w && w.close(); toast(e.message, 'err'); }
}
const L = () => S.cfg.labels;
const secLabel = (k) => (k.startsWith('info_') ? `${L().info} — ${L()[k]}` : L()[k]);
const intro = (p) => (S.cfg.whatsappIntro || '').replace(/\{project\}/g, p.name);
const lines = (items) => items.map((i) => `• ${i.name}\n${i.shareUrl}`).join('\n\n');
const tooLong = (t) => encodeURIComponent(t).length > 3500;

function msgFile(p, it) { return `${intro(p)}\n\n${it.name}\n${it.shareUrl}`; }
function msgSection(p, keys, label, pageUrl) {
  const items = keys.flatMap((k) => p.sections[k]);
  if (!items.length) { toast('لا توجد ملفات في هذا القسم', 'err'); return null; }
  let body = keys.length > 1
    ? keys.filter((k) => p.sections[k].length).map((k) => `*${secLabel(k)}*\n${lines(p.sections[k])}`).join('\n\n')
    : lines(items);
  let t = `${intro(p)}\n\n*${label}*\n\n${body}`;
  if (tooLong(t)) t = `${intro(p)}\n\n*${label}*\n${pageUrl}`;
  return t;
}
function msgProject(p) {
  const keys = Object.keys(p.sections).filter((k) => p.sections[k].length);
  if (!keys.length) { toast('لا توجد ملفات في هذا المشروع بعد', 'err'); return null; }
  let t = `${intro(p)}\n\n` + keys.map((k) => `*${secLabel(k)}*\n${lines(p.sections[k])}`).join('\n\n');
  if (tooLong(t)) t = `${intro(p)}\n${p.shareUrl}`;
  return t;
}


/* ===== إرسال الملف نفسه (نافذة المشاركة في الجهاز) ===== */
const SHARE_MAX = 200 * 1048576;
const shareMode = () => LS.get('sendMode') !== 'link';
function canShareNow(items) {
  try {
    if (!navigator.share || !navigator.canShare) return false;
    const dummy = items.filter((i) => i.kind === 'file').map((i) => new File([''], i.name, { type: i.mime && i.mime !== 'application/octet-stream' ? i.mime : '' }));
    return dummy.length > 0 && navigator.canShare({ files: dummy });
  } catch { return false; }
}
async function fetchAsFile(it, onPct) {
  const res = await fetch(it.openUrl);
  if (!res.ok) throw new Error('تعذّر تحميل ' + it.name);
  const total = +res.headers.get('content-length') || it.size || 0;
  const reader = res.body.getReader(); const chunks = []; let got = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; if (total) onPct(Math.min(1, got / total)); }
  let type = (res.headers.get('content-type') || '').split(';')[0] || it.mime || '';
  if (type === 'application/octet-stream' && it.mime) type = it.mime;
  let name = it.name; if (type === 'application/pdf' && !/\.pdf$/i.test(name)) name += '.pdf';
  return new File(chunks, name, { type });
}
function readyModal(title, note, label, run) {
  modal({ title, body: `<p class="note">${esc(note)}</p>`, actions: [{ label: 'إلغاء' }, { label, cls: 'wa', async run() { await run(); } }] });
}
function fallbackLink(inGesture, fn, why) {
  if (inGesture) { if (why) toast(why); return fn(); }
  readyModal('إرسال كرابط', (why ? why + ' ' : '') + 'اضغط الزر لفتح واتساب برسالة تحوي الرابط.', 'فتح واتساب', async () => fn());
}
// items: ملفات/روابط؛ linkFn: يرسل نسخة الرابط عند عدم دعم المشاركة
async function sendItems(items, title, linkFn, inGesture = true) {
  const files = items.filter((i) => i.kind === 'file'); const links = items.filter((i) => i.kind === 'link');
  if (!items.length) return toast('لا توجد ملفات للإرسال', 'err');
  if (!shareMode()) return linkFn();
  if (!files.length) return linkFn();
  if (!canShareNow(items)) return fallbackLink(inGesture, linkFn, 'هذا الجهاز أو المتصفح لا يدعم إرسال الملفات مباشرة، سيُرسل رابط بدلاً منها.');
  if (files.reduce((n, i) => n + i.size, 0) > SHARE_MAX) return fallbackLink(inGesture, linkFn, 'الملفات كبيرة جداً للإرسال المباشر، سيُرسل رابط بدلاً منها.');
  const pt = progressToast(); const list = [];
  try {
    for (let i = 0; i < files.length; i++) list.push(await fetchAsFile(files[i], (f) => pt.set(`تجهيز الملف ${i + 1} من ${files.length}: ${files[i].name} — ${Math.round(f * 100)}%`, f * 100)));
  } catch (e) { pt.done(); return toast(e.message, 'err'); }
  pt.done();
  const data = { files: list, title };
  if (links.length) data.text = links.map((l) => `${l.name}\n${l.shareUrl}`).join('\n\n');
  if (!navigator.canShare(data)) return fallbackLink(false, linkFn, 'نوع الملف لا يدعمه الجهاز للإرسال المباشر.');
  const go = async () => {
    try { await navigator.share(data); if (links.length) toast('أُرسلت الملفات مع روابط الأقسام التي لا تُرسل كملفات', 'ok'); }
    catch (e) {
      if (e && e.name === 'AbortError') return;
      if (e && e.name === 'NotAllowedError') throw e;
      fallbackLink(false, linkFn, 'تعذّر الإرسال المباشر (ربما الحجم أو العدد كبير).');
    }
  };
  try { await go(); }
  catch { readyModal('الملفات جاهزة', `تم تجهيز ${list.length === 1 ? 'الملف' : list.length + ' ملفات'}. اضغط الزر ثم اختر واتساب والعميل.`, 'إرسال عبر واتساب', async () => { try { await navigator.share(data); } catch (e) { if (!e || e.name !== 'AbortError') fallbackLink(false, linkFn, 'تعذّر الإرسال المباشر.'); } }); }
}

/* ===== الإطار العام ===== */
const modeBtn = () => (shareMode() ? `${IC.upload}<span class="t">إرسال: ملف</span>` : `${IC.link}<span class="t">إرسال: رابط</span>`);
function shell(inner) {
  const s = S.cfg || S.pub; const admin = S.me.role === 'admin';
  $('#app').innerHTML = `
  <header class="top"><div class="top-in">
    <a class="brand" href="#/"><span class="mark">${IC.site}</span><span style="min-width:0"><b>${esc(s.siteName)}</b>${s.tagline ? `<small>${esc(s.tagline)}</small>` : ''}</span></a>
    <div class="top-act">
      <button class="ibtn" data-act="mode" title="طريقة الإرسال" aria-label="طريقة الإرسال">${modeBtn()}</button>
      <button class="ibtn" data-act="refresh" title="تحديث من Drive" aria-label="تحديث">${IC.refresh}</button>
      ${admin ? `<a class="ibtn" href="#/admin" title="لوحة الإدارة">${IC.settings}<span class="t">الإدارة</span></a>` : ''}
      <button class="ibtn" data-act="me" title="حسابي" aria-label="حسابي">${IC.user}<span class="t">${esc(S.me.name)}</span></button>
    </div>
    <label class="client">${IC.wa}<span>رقم العميل (للروابط)</span><input id="clientNum" type="tel" inputmode="tel" autocomplete="off" placeholder="اختياري — مثال 07701234567" value="${esc(LS.get('clientNum') || '')}"></label>
  </div></header>
  <main id="view">${inner}</main>`;
  document.title = s.siteName;
  $('#clientNum').addEventListener('input', (e) => LS.set('clientNum', e.target.value));
}
function setView(html) { const v = $('#view'); if (v) v.innerHTML = html; else shell(html); }

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act;
  try { await actions[act]?.(b, e); } catch (err) { toast(err.message, 'err'); }
});

/* ===== تسجيل الدخول ===== */
function renderLogin() {
  document.title = S.pub.siteName;
  $('#app').innerHTML = `<div class="login"><form id="lf" autocomplete="on">
    <div class="mark">${IC.site}</div><h1>${esc(S.pub.siteName)}</h1><p class="sub">${esc(S.pub.tagline || 'سجّل الدخول للمتابعة')}</p>
    <div id="le"></div>
    <label class="fld"><span>اسم المستخدم</span><input name="username" autocomplete="username" autocapitalize="none" required dir="ltr" style="text-align:right"></label>
    <label class="fld"><span>كلمة المرور</span><input name="password" type="password" autocomplete="current-password" required dir="ltr" style="text-align:right"></label>
    <button class="btn pri" type="submit">دخول</button>
    <p class="note" style="text-align:center;margin:14px 0 0">سيبقى حسابك مسجّلاً على هذا الجهاز.</p></form></div>`;
  $('#lf').onsubmit = async (ev) => {
    ev.preventDefault(); const f = new FormData(ev.target); const btn = $('button', ev.target); btn.disabled = true;
    try { const r = await api('POST', '/api/login', { username: f.get('username'), password: f.get('password') }); S.me = r.user; await start(); }
    catch (err) { $('#le').innerHTML = `<div class="err">${esc(err.message)}</div>`; btn.disabled = false; }
  };
}

/* ===== قائمة المشاريع ===== */
async function viewProjects() {
  setView('<div class="spin"></div>');
  if (!S.projects) S.projects = (await api('GET', '/api/projects')).projects;
  drawProjects();
}
function cover(p, cls = '') {
  return p.coverUrl ? `<span class="cover ${cls}" style="background-image:url('${esc(p.coverUrl)}')" role="img" aria-label="${esc(p.name)}"></span>`
    : `<span class="cover fb ${cls}"><span>${esc([...p.name][0] || '')}</span></span>`;
}
function drawProjects() {
  const q = norm(S.q); const list = S.projects.filter((p) => !q || norm(p.name).includes(q)); const admin = S.me.role === 'admin';
  const cards = list.map((p) => `<article class="pcard"><a class="cover-link" href="#/p/${encodeURIComponent(p.id)}" tabindex="-1" aria-hidden="true">${cover(p)}</a>
    <h2><a href="#/p/${encodeURIComponent(p.id)}">${esc(p.name)}</a></h2>
    <div class="row"><a class="btn sm" href="#/p/${encodeURIComponent(p.id)}">فتح المشروع</a>
    <button class="btn sm wa" data-act="send-project-id" data-id="${esc(p.id)}">${IC.wa}<span>إرسال المشروع</span></button></div></article>`).join('');
  const empty = S.projects.length ? `<div class="empty-state"><b>لا نتائج</b>لا يوجد مشروع بهذا الاسم.</div>`
    : `<div class="empty-state"><b>لا توجد مشاريع بعد</b>${admin ? 'أضف أول مشروع من الزر أعلاه، أو أنشئ مجلداً له داخل Google Drive.' : 'سيضيف المسؤول المشاريع قريباً.'}</div>`;
  setView(`<div class="page-h"><h1>${esc(S.cfg.projectsTitle)}<small>${S.projects.length}</small></h1>
    <label class="search">${IC.search}<input id="q" type="search" placeholder="ابحث عن مشروع" value="${esc(S.q)}" aria-label="بحث"></label>
    ${admin ? `<button class="btn pri" data-act="new-project">${IC.plus}<span>مشروع جديد</span></button>` : ''}</div>
    ${list.length ? `<div class="grid">${cards}</div>` : empty}`);
  const qi = $('#q'); qi.addEventListener('input', () => { S.q = qi.value; const pos = qi.selectionStart; drawProjects(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); });
}

/* ===== صفحة المشروع ===== */
async function viewProject(id) {
  setView('<div class="spin"></div>');
  const { project } = await api('GET', '/api/projects/' + encodeURIComponent(id));
  S.project = project; drawProject();
}
const count = (arr) => (arr.length ? `<span class="cnt">${arr.length}</span>` : '');
function fileRow(it) {
  const admin = S.me.role === 'admin';
  const size = fmtSize(it.size);
  return `<li class="f" data-id="${esc(it.id)}">
    <span class="fi ${it.category}">${CAT_IC[it.category] || IC.other}</span>
    <button class="fn" data-act="open-file" data-id="${esc(it.id)}">${esc(it.name)}${size ? `<small>${size}</small>` : ''}</button>
    <div class="fa"><button class="btn sm" data-act="open-file" data-id="${esc(it.id)}" title="فتح">${IC.open}<span>فتح</span></button>
    <button class="btn sm wa" data-act="send-file" data-id="${esc(it.id)}" title="إرسال عبر واتساب">${IC.wa}<span>إرسال</span></button>
    ${admin ? `<button class="iconb" data-act="del-file" data-id="${esc(it.id)}" title="حذف" aria-label="حذف ${esc(it.name)}">${IC.trash}</button>` : ''}</div></li>`;
}
function adminTools(k) {
  if (S.me.role !== 'admin') return '';
  const lt = k === 'videos' ? 'رابط فيديو' : k === 'location' ? 'رابط موقع' : 'رابط';
  return `<button class="btn sm" data-act="upload" data-sec="${k}">${IC.upload}<span>رفع ملفات</span></button>
    <button class="btn sm" data-act="add-link" data-sec="${k}">${IC.plus}<span>${lt}</span></button>`;
}
function block(k) {
  const items = S.project.sections[k];
  return `<div class="blk" data-sec="${k}"><div class="bh"><h3>${esc(L()[k])}${count(items)}</h3>
    <div class="bact">${adminTools(k)}<button class="btn sm wa" data-act="send-section" data-sec="${k}">${IC.wa}<span>إرسال القسم</span></button></div></div>
    ${items.length ? `<ul class="files">${items.map(fileRow).join('')}</ul>` : `<p class="none">${S.me.role === 'admin' ? 'لا توجد ملفات. ارفع ملفاً أو اسحبه إلى هنا.' : 'لا توجد ملفات في هذا القسم.'}</p>`}</div>`;
}
function drawProject() {
  const p = S.project; const admin = S.me.role === 'admin';
  const infoKeys = ['info_ar', 'info_ku', 'info_en']; const infoCount = infoKeys.reduce((n, k) => n + p.sections[k].length, 0);
  setView(`<a class="crumb" href="#/">${IC.back}<span>${esc(S.cfg.projectsTitle)}</span></a>
  <div class="phead">${cover(p, 'pc')}<h1>${esc(p.name)}</h1>
    <div class="acts"><button class="btn wa" data-act="send-project">${IC.wa}<span>إرسال كل ملفات المشروع</span></button></div></div>
  ${admin ? `<div class="adminbar"><button class="btn sm" data-act="rename-project">${IC.edit}<span>تغيير الاسم</span></button>
    <button class="btn sm" data-act="upload" data-sec="cover">${IC.image2}<span>صورة الغلاف</span></button>
    <button class="btn sm danger" data-act="del-project">${IC.trash}<span>حذف المشروع</span></button></div>` : ''}
  <div class="stack">
    <section class="grp"><div class="bh"><h3>${esc(L().info)}${count({ length: infoCount })}</h3>
      <div class="bact"><button class="btn sm wa" data-act="send-section" data-sec="info">${IC.wa}<span>إرسال القسم</span></button></div></div>
      <div class="sub">${infoKeys.map(block).join('')}</div></section>
    ${['videos', 'maps', 'location', 'prices'].map(block).join('')}
  </div>`);
  if (admin) wireDrop();
}

/* ===== رفع الملفات (للمسؤول) ===== */
function pickFiles(sec) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = sec !== 'cover';
  if (sec === 'cover') inp.accept = 'image/*'; else if (sec === 'videos') inp.accept = 'video/*,application/pdf,image/*';
  inp.onchange = () => inp.files.length && uploadFiles(sec, [...inp.files]);
  inp.click();
}
function putFile(projectId, sec, file, onProgress) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('PUT', `/api/projects/${encodeURIComponent(projectId)}/files?section=${sec}&name=${encodeURIComponent(file.name)}`);
    x.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    x.onload = () => { let d = {}; try { d = JSON.parse(x.responseText); } catch { /* */ } x.status < 300 ? resolve(d) : reject(new Error(d.error || 'فشل الرفع')); };
    x.onerror = () => reject(new Error('انقطع الاتصال أثناء الرفع'));
    x.send(file);
  });
}
async function uploadFiles(sec, files) {
  const pt = progressToast(); let okN = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    try { await putFile(S.project.id, sec, f, (pct) => pt.set(`رفع ${i + 1} من ${files.length}: ${f.name} — ${pct}%`, pct)); okN++; }
    catch (e) { toast(`${f.name}: ${e.message}`, 'err'); }
  }
  pt.done();
  if (okN) { toast(okN === 1 ? 'تم رفع الملف' : `تم رفع ${okN} ملفات`, 'ok'); S.projects = null; await viewProject(S.project.id); }
}
function wireDrop() {
  $$('.blk[data-sec]').forEach((el) => {
    el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drag'); });
    el.addEventListener('dragleave', () => el.classList.remove('drag'));
    el.addEventListener('drop', (e) => { e.preventDefault(); el.classList.remove('drag'); if (e.dataTransfer.files.length) uploadFiles(el.dataset.sec, [...e.dataTransfer.files]); });
  });
}

/* ===== الإجراءات ===== */
const findItem = (id) => Object.values(S.project.sections).flat().find((i) => i.id === id);
const actions = {
  async refresh() { await api('POST', '/api/refresh'); S.projects = null; await route(); toast('تم التحديث من Drive', 'ok'); },
  me() {
    modal({ title: S.me.name, body: `<p class="note">الحساب: ${esc(S.me.username)}</p>
      <label class="fld"><span>كلمة المرور الحالية</span><input id="pw0" type="password" autocomplete="current-password"></label>
      <label class="fld"><span>كلمة المرور الجديدة (6 أحرف على الأقل)</span><input id="pw1" type="password" autocomplete="new-password"></label>`,
      actions: [{ label: 'تسجيل الخروج', cls: 'danger', async run() { await api('POST', '/api/logout'); S.me = null; S.cfg = null; S.projects = null; renderLogin(); } },
        { label: 'تغيير كلمة المرور', cls: 'pri', async run() { await api('POST', '/api/me/password', { current: $('#pw0').value, password: $('#pw1').value }); toast('تم تغيير كلمة المرور', 'ok'); } }] });
  },
  'open-file'(b) {
    const it = findItem(b.dataset.id); if (!it) return;
    if (it.kind === 'link') return window.open(it.openUrl, '_blank', 'noopener');
    if (it.category === 'image') return modal({ wide: true, body: `<div class="viewer"><button class="x" aria-label="إغلاق" data-close>✕</button><img src="${esc(it.openUrl)}" alt="${esc(it.name)}"><div class="cap">${esc(it.name)}</div></div>` });
    if (it.category === 'video') return modal({ wide: true, body: `<div class="viewer"><button class="x" aria-label="إغلاق" data-close>✕</button><video src="${esc(it.openUrl)}" controls playsinline autoplay></video><div class="cap">${esc(it.name)}</div></div>` });
    window.open(it.openUrl, '_blank', 'noopener');
  },
  'send-file'(b) { const it = findItem(b.dataset.id); if (it) return sendItems([it], S.project.name, () => sendWA(msgFile(S.project, it))); },
  'send-section'(b) {
    const k = b.dataset.sec; const p = S.project;
    const keys = k === 'info' ? ['info_ar', 'info_ku', 'info_en'] : [k];
    const items = keys.flatMap((x) => p.sections[x]);
    return sendItems(items, p.name, () => { const t = msgSection(p, keys, k === 'info' ? L().info : secLabel(k), p.sectionShareUrls[k]); if (t) sendWA(t); });
  },
  'send-project'() { const p = S.project; return sendItems(Object.values(p.sections).flat(), p.name, () => { const t = msgProject(p); if (t) sendWA(t); }); },
  async 'send-project-id'(b) {
    const { project } = await api('GET', '/api/projects/' + encodeURIComponent(b.dataset.id));
    return sendItems(Object.values(project.sections).flat(), project.name, () => { const t = msgProject(project); if (t) sendWA(t); }, false);
  },
  mode(b) { LS.set('sendMode', shareMode() ? 'link' : 'file'); b.innerHTML = modeBtn(); toast(shareMode() ? 'سيُرسل الملف نفسه (على الهاتف) ' : 'سيُرسل رابط الملف', 'ok'); },
  upload(b) { pickFiles(b.dataset.sec); },
  'add-link'(b) {
    const sec = b.dataset.sec;
    modal({ title: 'إضافة رابط', body: `<label class="fld"><span>العنوان الذي سيظهر</span><input id="lt" placeholder="${sec === 'videos' ? 'مثال: جولة المشروع على يوتيوب' : sec === 'location' ? 'مثال: الموقع على خرائط Google' : 'عنوان الرابط'}"></label>
      <label class="fld"><span>الرابط</span><input id="lu" type="url" inputmode="url" dir="ltr" placeholder="https://..." style="text-align:right"><span class="hint">انسخ الرابط من يوتيوب أو خرائط Google والصقه هنا.</span></label>`,
      actions: [{ label: 'إلغاء' }, { label: 'إضافة', cls: 'pri', async run() {
        await api('POST', `/api/projects/${encodeURIComponent(S.project.id)}/links`, { section: sec, title: $('#lt').value, url: $('#lu').value });
        toast('تمت إضافة الرابط', 'ok'); await viewProject(S.project.id);
      } }] });
  },
  async 'del-file'(b) {
    const it = findItem(b.dataset.id); if (!it || !confirm(`حذف «${it.name}»؟\n(يذهب إلى سلة المحذوفات ويمكن استرجاعه من Drive)`)) return;
    await api('DELETE', '/api/files/' + encodeURIComponent(it.id)); toast('تم الحذف', 'ok'); S.projects = null; await viewProject(S.project.id);
  },
  'new-project'() {
    modal({ title: 'مشروع جديد', body: `<label class="fld"><span>اسم المشروع</span><input id="pn" maxlength="80"></label><p class="note">ينشئ التطبيق مجلد المشروع وأقسامه داخل Google Drive تلقائياً.</p>`,
      actions: [{ label: 'إلغاء' }, { label: 'إنشاء', cls: 'pri', async run() {
        const r = await api('POST', '/api/projects', { name: $('#pn').value }); S.projects = null; location.hash = '#/p/' + encodeURIComponent(r.project.id);
      } }] });
  },
  'rename-project'() {
    modal({ title: 'تغيير اسم المشروع', body: `<label class="fld"><span>الاسم</span><input id="pn" maxlength="80" value="${esc(S.project.name)}"></label>`,
      actions: [{ label: 'إلغاء' }, { label: 'حفظ', cls: 'pri', async run() {
        const r = await api('PATCH', '/api/projects/' + encodeURIComponent(S.project.id), { name: $('#pn').value }); S.projects = null; location.hash = '#/p/' + encodeURIComponent(r.project.id); await route();
      } }] });
  },
  async 'del-project'() {
    if (!confirm(`حذف مشروع «${S.project.name}» بكل ملفاته؟\n(يذهب إلى سلة Google Drive ويمكن استرجاعه من هناك)`)) return;
    await api('DELETE', '/api/projects/' + encodeURIComponent(S.project.id)); S.projects = null; toast('تم حذف المشروع', 'ok'); location.hash = '#/';
  },
};

/* ===== لوحة المسؤول ===== */
async function viewAdmin(tab = 'users') {
  setView('<div class="spin"></div>');
  const tabs = `<div class="tabs" role="tablist"><a class="tab" role="tab" aria-selected="${tab === 'users'}" href="#/admin/users">المستخدمون</a><a class="tab" role="tab" aria-selected="${tab === 'settings'}" href="#/admin/settings">أسماء وإعدادات الموقع</a></div>`;
  if (tab === 'settings') {
    const { settings: s } = await api('GET', '/api/admin/settings');
    const lab = (k, t) => `<label class="fld"><span>${t}</span><input data-lab="${k}" maxlength="40" value="${esc(s.labels[k])}"></label>`;
    setView(`<a class="crumb" href="#/">${IC.back}<span>${esc(S.cfg.projectsTitle)}</span></a><div class="page-h"><h1>لوحة الإدارة</h1></div>${tabs}
      <div class="panel"><h2>اسم الموقع</h2><div class="cols">
        <label class="fld"><span>اسم الموقع</span><input id="s-name" maxlength="60" value="${esc(s.siteName)}"></label>
        <label class="fld"><span>الوصف تحت الاسم</span><input id="s-tag" maxlength="80" value="${esc(s.tagline)}"></label>
        <label class="fld"><span>عنوان صفحة المشاريع</span><input id="s-pt" maxlength="40" value="${esc(s.projectsTitle)}"></label></div></div>
      <div class="panel"><h2>أسماء الأقسام</h2><div class="cols">
        ${lab('info', 'قسم المعلومات')}${lab('info_ar', 'المعلومات — اللغة الأولى')}${lab('info_ku', 'المعلومات — اللغة الثانية')}${lab('info_en', 'المعلومات — اللغة الثالثة')}
        ${lab('videos', 'الفيديوهات')}${lab('maps', 'الخرائط')}${lab('location', 'موقع المشروع')}${lab('prices', 'الأسعار')}</div></div>
      <div class="panel"><h2>واتساب</h2>
        <label class="fld"><span>مفتاح الدولة للأرقام التي تبدأ بصفر</span><input id="s-cc" inputmode="numeric" dir="ltr" style="text-align:right" maxlength="4" value="${esc(s.countryCode)}"><span class="hint">العراق 964 — يتحول الرقم 07701234567 إلى 9647701234567</span></label>
        <label class="fld"><span>الجملة التي تبدأ بها كل رسالة</span><textarea id="s-in" maxlength="300">${esc(s.whatsappIntro)}</textarea><span class="hint">اكتب {project} ليحلّ مكانه اسم المشروع.</span></label></div>
      <button class="btn pri" id="save-set">حفظ التغييرات</button>`);
    $('#save-set').onclick = async () => {
      const labels = {}; $$('[data-lab]').forEach((i) => { labels[i.dataset.lab] = i.value; });
      try {
        await api('PUT', '/api/admin/settings', { siteName: $('#s-name').value, tagline: $('#s-tag').value, projectsTitle: $('#s-pt').value, countryCode: $('#s-cc').value, whatsappIntro: $('#s-in').value, labels });
        S.cfg = await api('GET', '/api/config'); toast('تم الحفظ', 'ok'); shell('<div class="spin"></div>'); await viewAdmin('settings');
      } catch (e) { toast(e.message, 'err'); }
    };
    return;
  }
  const { users } = await api('GET', '/api/admin/users');
  const rows = users.map((u) => `<div class="urow" data-uid="${esc(u.id)}"><div class="who"><b>${esc(u.name)}<span class="badge ${u.role === 'admin' ? 'adm' : ''}">${u.role === 'admin' ? 'مسؤول' : 'مبيعات'}</span>${u.active ? '' : '<span class="badge off">موقوف</span>'}</b>
    <small dir="ltr">${esc(u.username)}</small>${u.lastLogin ? `<small> · آخر دخول ${new Date(u.lastLogin).toLocaleDateString('en-GB')}</small>` : ''}</div>
    <div class="ua"><button class="btn sm" data-uact="toggle">${u.active ? 'إيقاف' : 'تفعيل'}</button><button class="btn sm" data-uact="pw">كلمة مرور جديدة</button>
    <button class="btn sm" data-uact="role">${u.role === 'admin' ? 'جعله مبيعات' : 'جعله مسؤولاً'}</button><button class="iconb" data-uact="del" aria-label="حذف ${esc(u.name)}">${IC.trash}</button></div></div>`).join('');
  setView(`<a class="crumb" href="#/">${IC.back}<span>${esc(S.cfg.projectsTitle)}</span></a><div class="page-h"><h1>لوحة الإدارة</h1></div>${tabs}
    <div class="panel"><h2>إضافة مستخدم</h2><form id="nu"><div class="cols">
      <label class="fld"><span>الاسم</span><input name="name" required maxlength="60"></label>
      <label class="fld"><span>اسم المستخدم (إنجليزي)</span><input name="username" required dir="ltr" style="text-align:right" autocapitalize="none" pattern="[A-Za-z0-9._\\-]{3,32}"></label>
      <label class="fld"><span>كلمة المرور</span><input name="password" required minlength="6" dir="ltr" style="text-align:right"></label>
      <label class="fld"><span>الصلاحية</span><select name="role"><option value="sales">مبيعات (عرض وإرسال)</option><option value="admin">مسؤول (كل الصلاحيات)</option></select></label></div>
      <button class="btn pri" type="submit">${IC.plus}<span>إضافة</span></button></form></div>
    <div class="panel"><h2>المستخدمون (${users.length})</h2>${rows}</div>`);
  $('#nu').onsubmit = async (ev) => {
    ev.preventDefault(); const f = Object.fromEntries(new FormData(ev.target));
    try { await api('POST', '/api/admin/users', f); toast('تمت إضافة المستخدم', 'ok'); await viewAdmin('users'); } catch (e) { toast(e.message, 'err'); }
  };
  $$('[data-uact]').forEach((b) => b.onclick = async () => {
    const id = b.closest('[data-uid]').dataset.uid; const u = users.find((x) => x.id === id);
    try {
      if (b.dataset.uact === 'toggle') await api('PATCH', '/api/admin/users/' + id, { active: !u.active });
      else if (b.dataset.uact === 'role') await api('PATCH', '/api/admin/users/' + id, { role: u.role === 'admin' ? 'sales' : 'admin' });
      else if (b.dataset.uact === 'del') { if (!confirm(`حذف المستخدم «${u.name}»؟`)) return; await api('DELETE', '/api/admin/users/' + id); }
      else if (b.dataset.uact === 'pw') {
        return modal({ title: `كلمة مرور جديدة لـ ${u.name}`, body: '<label class="fld"><span>كلمة المرور الجديدة</span><input id="np" dir="ltr" style="text-align:right" minlength="6"></label>',
          actions: [{ label: 'إلغاء' }, { label: 'حفظ', cls: 'pri', async run() { await api('PATCH', '/api/admin/users/' + id, { password: $('#np').value }); toast('تم تغيير كلمة المرور', 'ok'); } }] });
      }
      await viewAdmin('users');
    } catch (e) { toast(e.message, 'err'); }
  });
}

/* ===== التوجيه والتشغيل ===== */
async function route() {
  if (!S.me) return;
  const h = location.hash || '#/'; let m;
  try {
    if ((m = /^#\/p\/(.+)$/.exec(h))) await viewProject(decodeURIComponent(m[1]));
    else if ((m = /^#\/admin(?:\/(users|settings))?$/.exec(h)) && S.me.role === 'admin') await viewAdmin(m[1] || 'users');
    else await viewProjects();
  } catch (e) {
    if (!S.me) return;
    setView(`<div class="empty-state"><b>تعذّر فتح الصفحة</b>${esc(e.message)}<br><br><a class="btn" href="#/">العودة للمشاريع</a></div>`);
  }
  window.scrollTo(0, 0);
}
async function start() {
  S.cfg = await api('GET', '/api/config'); S.projects = null;
  shell('<div class="spin"></div>'); await route();
}
window.addEventListener('hashchange', route);
(async function boot() {
  try { S.pub = await (await fetch('/api/public')).json(); } catch { /* */ }
  try { S.me = (await api('GET', '/api/me')).user; await start(); } catch { if (!S.me) renderLogin(); }
})();
