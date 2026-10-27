// عميل Google Drive v3 عبر REST مباشرة (بدون أي حزم خارجية)
const crypto = require('crypto');
const fs = require('fs');
const { Readable } = require('stream');
const { HttpError } = require('./util');

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const SCOPE = 'https://www.googleapis.com/auth/drive';
const ALL = 'supportsAllDrives=true';

class GDriveApi {
  constructor({ clientId, clientSecret, refreshToken, serviceAccountJson, serviceAccountFile }) {
    this.o = { clientId, clientSecret, refreshToken };
    if (serviceAccountJson || serviceAccountFile) {
      const raw = serviceAccountJson || fs.readFileSync(serviceAccountFile, 'utf8');
      this.sa = JSON.parse(raw);
    }
    if (!refreshToken && !this.sa) throw new Error('لم تُضبط بيانات اعتماد Google (GOOGLE_REFRESH_TOKEN أو GOOGLE_SERVICE_ACCOUNT_JSON)');
    this._tok = null; this._exp = 0;
  }

  async token() {
    if (this._tok && Date.now() < this._exp - 60000) return this._tok;
    let res;
    if (this.o.refreshToken) {
      res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.o.clientId, client_secret: this.o.clientSecret,
          refresh_token: this.o.refreshToken, grant_type: 'refresh_token',
        }),
      });
    } else {
      const now = Math.floor(Date.now() / 1000);
      const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
      const unsigned = b({ alg: 'RS256', typ: 'JWT' }) + '.' + b({
        iss: this.sa.client_email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
      });
      const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(this.sa.private_key).toString('base64url');
      res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + sig }),
      });
    }
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.access_token) throw new Error('فشل تسجيل الدخول إلى Google: ' + (j.error_description || j.error || res.status));
    this._tok = j.access_token; this._exp = Date.now() + (j.expires_in || 3600) * 1000;
    return this._tok;
  }

  async req(url, opts = {}) {
    const t = await this.token();
    const res = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + t, ...(opts.headers || {}) } });
    if (!res.ok && !(opts.okStatuses || []).includes(res.status)) {
      const txt = await res.text().catch(() => '');
      if (res.status === 404) throw new HttpError(404, 'غير موجود في Drive');
      throw new Error(`Drive ${res.status}: ${txt.slice(0, 300)}`);
    }
    return res;
  }

  async list({ q, fields, orderBy }) {
    const out = []; let pageToken = '';
    do {
      const p = new URLSearchParams({
        q, fields: `nextPageToken,${fields}`, pageSize: '1000', corpora: 'allDrives',
        includeItemsFromAllDrives: 'true', supportsAllDrives: 'true',
      });
      if (orderBy) p.set('orderBy', orderBy);
      if (pageToken) p.set('pageToken', pageToken);
      const j = await (await this.req(`${API}/files?${p}`)).json();
      out.push(...(j.files || [])); pageToken = j.nextPageToken || '';
    } while (pageToken);
    return out;
  }

  async get(id, fields) {
    return (await this.req(`${API}/files/${encodeURIComponent(id)}?${ALL}&fields=${encodeURIComponent(fields)}`)).json();
  }

  async createFolder(name, parentId) {
    return this.create({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] });
  }

  async create(meta) {
    return (await this.req(`${API}/files?${ALL}&fields=id,name`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(meta),
    })).json();
  }

  async update(id, body) {
    return (await this.req(`${API}/files/${encodeURIComponent(id)}?${ALL}&fields=id,name`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })).json();
  }

  async trash(id) { return this.update(id, { trashed: true }); }

  async download(id, range) {
    const res = await this.req(`${API}/files/${encodeURIComponent(id)}?alt=media&${ALL}`, {
      headers: range ? { Range: range } : {}, okStatuses: [416],
    });
    return this._wrap(res);
  }

  async exportPdf(id) {
    const res = await this.req(`${API}/files/${encodeURIComponent(id)}/export?mimeType=application%2Fpdf`);
    return this._wrap(res);
  }

  _wrap(res) {
    const h = {};
    for (const k of ['content-type', 'content-length', 'content-range']) if (res.headers.get(k)) h[k] = res.headers.get(k);
    return { status: res.status, headers: h, stream: res.body && res.status !== 416 ? Readable.fromWeb(res.body) : null };
  }

  async readText(id) {
    return (await this.req(`${API}/files/${encodeURIComponent(id)}?alt=media&${ALL}`)).text();
  }

  async updateContent(id, text) {
    await this.req(`${UPLOAD}/files/${encodeURIComponent(id)}?uploadType=media&${ALL}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: text,
    });
  }

  // رفع ملف من القرص (resumable)
  async upload({ name, parentId, mime, filePath, size, description }) {
    const meta = { name, parents: [parentId] };
    if (description) meta.description = description;
    const init = await this.req(`${UPLOAD}/files?uploadType=resumable&${ALL}&fields=id,name`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mime || 'application/octet-stream',
        'X-Upload-Content-Length': String(size),
      },
      body: JSON.stringify(meta),
    });
    const loc = init.headers.get('location');
    if (!loc) throw new Error('Drive لم يُرجع رابط الرفع');
    const put = await fetch(loc, {
      method: 'PUT',
      headers: { 'Content-Length': String(size), 'Content-Type': mime || 'application/octet-stream' },
      body: size ? Readable.toWeb(fs.createReadStream(filePath)) : undefined,
      duplex: 'half',
    });
    if (!put.ok) throw new Error(`فشل رفع الملف إلى Drive (${put.status}): ${(await put.text()).slice(0, 200)}`);
    return (await put.json()).id;
  }
}

module.exports = { GDriveApi };
