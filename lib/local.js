// تخزين محلي على القرص — للتجربة قبل ربط Google Drive (نفس بنية المجلدات)
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { SECTION_KEYS } = require('./sections');
const { HttpError, naturalSort, cleanName, mimeFromName, b64u, unb64u } = require('./util');

const bad = (n) => !n || n === '.' || n === '..' || n.startsWith('.') || /[\\/]/.test(n);

class LocalStorage {
  constructor(dir) {
    this.dir = dir; this.lib = path.join(dir, 'library'); this.metaDir = path.join(dir, 'meta'); this.trashDir = path.join(dir, 'trash');
    this.queue = Promise.resolve();
  }

  async init() { for (const d of [this.lib, this.metaDir, this.trashDir]) await fsp.mkdir(d, { recursive: true }); }
  invalidate() {}

  _proj(id) {
    const name = unb64u(id);
    if (bad(name)) throw new HttpError(404, 'المشروع غير موجود');
    return { name, full: path.join(this.lib, name) };
  }

  async _projectExists(id) {
    const p = this._proj(id);
    const st = await fsp.stat(p.full).catch(() => null);
    if (!st || !st.isDirectory()) throw new HttpError(404, 'المشروع غير موجود');
    return p;
  }

  _file(id) {
    const parts = unb64u(id).split('/');
    if (parts.length < 2 || parts.length > 3 || parts.some(bad)) throw new HttpError(404, 'الملف غير موجود');
    if (parts.length === 3 && !SECTION_KEYS.includes(parts[1])) throw new HttpError(404, 'الملف غير موجود');
    return { parts, full: path.join(this.lib, ...parts) };
  }

  async _cover(projName) {
    const files = await fsp.readdir(path.join(this.lib, projName)).catch(() => []);
    const c = files.find((f) => /^cover\.(jpe?g|png|webp|gif)$/i.test(f));
    return c ? b64u(`${projName}/${c}`) : null;
  }

  async listProjects() {
    const ents = await fsp.readdir(this.lib, { withFileTypes: true });
    const out = [];
    for (const e of ents) if (e.isDirectory() && !e.name.startsWith('.')) out.push({ id: b64u(e.name), name: e.name, coverId: await this._cover(e.name) });
    return out.sort((a, b) => naturalSort(a.name, b.name));
  }

  async getProject(id) {
    const { name, full } = await this._projectExists(id);
    const sections = {};
    for (const key of SECTION_KEYS) {
      sections[key] = [];
      const dir = path.join(full, key);
      const files = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const f of files) {
        if (!f.isFile() || f.name.startsWith('.')) continue;
        const p = path.join(dir, f.name); const st = await fsp.stat(p);
        const fid = b64u(`${name}/${key}/${f.name}`);
        if (/\.link$/i.test(f.name)) {
          const url = (await fsp.readFile(p, 'utf8')).trim().split(/\r?\n/)[0];
          if (url) sections[key].push({ id: fid, name: f.name.replace(/\.link$/i, ''), kind: 'link', url, mime: 'text/uri-list', size: 0, modified: st.mtime });
        } else sections[key].push({ id: fid, name: f.name, kind: 'file', mime: mimeFromName(f.name), size: st.size, modified: st.mtime });
      }
      sections[key].sort((a, b) => naturalSort(a.name, b.name));
    }
    return { id, name, coverId: await this._cover(name), sections };
  }

  async createProject(rawName) {
    const name = cleanName(rawName, 80);
    if (!name) throw new HttpError(400, 'اسم المشروع مطلوب');
    const full = path.join(this.lib, name);
    if (await fsp.stat(full).catch(() => null)) throw new HttpError(409, 'يوجد مشروع بهذا الاسم');
    for (const k of SECTION_KEYS) await fsp.mkdir(path.join(full, k), { recursive: true });
    return { id: b64u(name), name };
  }

  async renameProject(id, rawName) {
    const p = await this._projectExists(id);
    const name = cleanName(rawName, 80);
    if (!name) throw new HttpError(400, 'اسم المشروع مطلوب');
    if (name !== p.name) {
      if (await fsp.stat(path.join(this.lib, name)).catch(() => null)) throw new HttpError(409, 'يوجد مشروع بهذا الاسم');
      await fsp.rename(p.full, path.join(this.lib, name));
    }
    return { id: b64u(name), name };
  }

  async _toTrash(full) {
    await fsp.rename(full, path.join(this.trashDir, `${Date.now()}-${path.basename(full)}`));
  }

  async deleteProject(id) { const p = await this._projectExists(id); await this._toTrash(p.full); }

  async getFileMeta(id) {
    const { full, parts } = this._file(id);
    const st = await fsp.stat(full).catch(() => null);
    if (!st || !st.isFile()) throw new HttpError(404, 'الملف غير موجود');
    const name = parts[parts.length - 1];
    return { id, name, mime: mimeFromName(name), size: st.size, native: false };
  }

  async openFile(id, range) {
    const meta = await this.getFileMeta(id);
    const { full } = this._file(id);
    const size = meta.size; let start = 0; let end = size - 1; let status = 200;
    const m = range && size > 0 ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
    if (m && (m[1] !== '' || m[2] !== '')) {
      if (m[1] === '') start = Math.max(0, size - parseInt(m[2], 10));
      else { start = parseInt(m[1], 10); if (m[2] !== '') end = Math.min(end, parseInt(m[2], 10)); }
      if (start > end || start >= size) return { status: 416, headers: { 'content-range': `bytes */${size}` }, stream: null, name: meta.name, mime: meta.mime };
      status = 206;
    }
    const headers = { 'content-type': meta.mime, 'content-length': String(size ? end - start + 1 : 0) };
    if (status === 206) headers['content-range'] = `bytes ${start}-${end}/${size}`;
    return { status, headers, stream: size ? fs.createReadStream(full, { start, end }) : require('stream').Readable.from([]), name: meta.name, mime: meta.mime };
  }

  async _uniquePath(dir, name) {
    const ext = path.extname(name); const base = path.basename(name, ext);
    let p = path.join(dir, name); let i = 2;
    while (await fsp.stat(p).catch(() => null)) p = path.join(dir, `${base} (${i++})${ext}`);
    return p;
  }

  async _moveIn(tmp, dest) {
    try { await fsp.rename(tmp, dest); } catch { await fsp.copyFile(tmp, dest); await fsp.unlink(tmp).catch(() => {}); }
  }

  async saveFile(projectId, section, { tmpPath, name }) {
    const p = await this._projectExists(projectId);
    let finalName = cleanName(name, 150) || 'file'; let dest;
    if (section === 'cover') {
      finalName = 'cover' + (path.extname(finalName).toLowerCase() || '.jpg');
      for (const f of await fsp.readdir(p.full)) if (/^cover\./i.test(f)) await fsp.unlink(path.join(p.full, f));
      dest = path.join(p.full, finalName);
    } else {
      if (!SECTION_KEYS.includes(section)) throw new HttpError(400, 'قسم غير صالح');
      const dir = path.join(p.full, section); await fsp.mkdir(dir, { recursive: true });
      dest = await this._uniquePath(dir, finalName);
    }
    await this._moveIn(tmpPath, dest);
    return { id: b64u(path.relative(this.lib, dest).split(path.sep).join('/')), name: path.basename(dest) };
  }

  async addLink(projectId, section, title, url) {
    const p = await this._projectExists(projectId);
    if (!SECTION_KEYS.includes(section)) throw new HttpError(400, 'قسم غير صالح');
    const dir = path.join(p.full, section); await fsp.mkdir(dir, { recursive: true });
    const dest = await this._uniquePath(dir, (cleanName(title, 100) || 'رابط') + '.link');
    await fsp.writeFile(dest, url + '\n');
    return { id: b64u(path.relative(this.lib, dest).split(path.sep).join('/')), name: path.basename(dest) };
  }

  async deleteFile(id) {
    const { full } = this._file(id);
    if (!(await fsp.stat(full).catch(() => null))) throw new HttpError(404, 'الملف غير موجود');
    await this._toTrash(full);
  }

  async readJson(name, def) {
    try { return JSON.parse(await fsp.readFile(path.join(this.metaDir, name + '.json'), 'utf8')); } catch { return def; }
  }

  writeJson(name, data) {
    const job = this.queue.then(async () => {
      const f = path.join(this.metaDir, name + '.json'); const tmp = f + '.tmp';
      await fsp.writeFile(tmp, JSON.stringify(data, null, 2)); await fsp.rename(tmp, f);
    });
    this.queue = job.catch(() => {});
    return job;
  }
}

module.exports = { LocalStorage };
