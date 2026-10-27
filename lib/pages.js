// صفحة مشاركة بسيطة للعميل (تُفتح من رابط واتساب)
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICON = { image: '🖼️', video: '🎬', pdf: '📄', sheet: '📊', doc: '📝', audio: '🎧', link: '📍', other: '📎' };
const fmtSize = (n) => (!n ? '' : n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1048576).toFixed(1) + ' MB');

function sharePage({ siteName, title, groups }) {
  const body = groups.filter((g) => g.items.length).map((g) => `
    <section><h2>${esc(g.label)}</h2>
    ${g.items.map((it) => `<a class="row" href="${esc(it.href)}" target="_blank" rel="noopener">
      <span class="ic">${ICON[it.category] || ICON.other}</span>
      <span class="nm">${esc(it.name)}</span><span class="sz">${esc(fmtSize(it.size))}</span></a>`).join('')}
    </section>`).join('') || '<p class="empty">لا توجد ملفات هنا بعد.</p>';
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>${esc(title)} — ${esc(siteName)}</title>
<style>
:root{--ink:#10202f;--mut:#5b6b7b;--line:#d5dce3;--bg:#eef1f4;--ac:#1f5c8b}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 "Noto Sans Arabic",system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif}
header{background:var(--ink);color:#fff;padding:22px 18px}header small{opacity:.7;display:block}header h1{margin:2px 0 0;font-size:24px}
main{max-width:720px;margin:0 auto;padding:16px}section{background:#fff;border:1px solid var(--line);border-radius:14px;margin:0 0 14px;overflow:hidden}
h2{margin:0;padding:12px 16px;font-size:15px;background:#f7f9fb;border-bottom:1px solid var(--line)}
.row{display:flex;align-items:center;gap:12px;padding:13px 16px;color:inherit;text-decoration:none;border-bottom:1px solid var(--line)}
.row:last-child{border-bottom:0}.row:active,.row:hover{background:#f3f7fb}.ic{font-size:22px}.nm{flex:1;word-break:break-word}.sz{color:var(--mut);font-size:13px}
.empty{text-align:center;color:var(--mut);padding:40px 0}
</style></head><body><header><small>${esc(siteName)}</small><h1>${esc(title)}</h1></header><main>${body}</main></body></html>`;
}
module.exports = { sharePage, esc };
