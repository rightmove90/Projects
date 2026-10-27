// تخزين المشاريع داخل Google Drive.
// البنية:  [المجلد الرئيسي] / [اسم المشروع] / [info_ar | info_ku | info_en | videos | maps | location | prices] / ملفات
const path = require('path');
const { SECTION_KEYS } = require('./sections');
const { HttpError, naturalSort, cleanName, mimeFromName } = require('./util');

const FOLDER = 'application/vnd.google-apps.folder';
const qs = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
const TTL = 30 * 1000;

class DriveStorage {
  constructor(api, rootId) {
    this.api = api; this.rootId = rootId;
    this.projectsCache = null; this.projectCache = new Map();
    this.tree = new Map(); this.metaIds = new Map(); this.queue = Promise.resolve();
  }

  async init() {
    let r;
    try { r = await this.api.get(this.rootId, 'id,name,mimeType'); } catch (e) {
      if (e.status === 404) throw new Error(`لم يجد Google المجلد الذي معرّفه «${this.rootId}». تحقق من DRIVE_ROOT_FOLDER_ID (الجزء الأخير من رابط المجلد)، ومن أنك سجّلت الدخول في drive-auth بنفس الحساب الذي يملك المجلد أو يملك صلاحية عليه.`);
      throw e;
    }
    if (r.mimeType !== FOLDER) throw new Error('DRIVE_ROOT_FOLDER_ID ليس مجلداً');
    this.rootName = r.name;
  }

  invalidate() { this.projectsCache = null; this.projectCache.clear(); }

  // ---------- المشاريع ----------
  async listProjects() {
    if (this.projectsCache && Date.now() - this.projectsCache.at < TTL) return this.projectsCache.data;
    const folders = await this.api.list({
      q: `${qs(this.rootId)} in parents and mimeType='${FOLDER}' and trashed=false`, fields: 'files(id,name)',
    });
    const projects = folders.map((f) => ({ id: f.id, name: f.name, coverId: null }));
    for (let i = 0; i < projects.length; i += 20) {
      const chunk = projects.slice(i, i + 20);
      const files = await this.api.list({
        q: `(${chunk.map((p) => qs(p.id) + ' in parents').join(' or ')}) and mimeType contains 'image/' and name contains 'cover' and trashed=false`,
        fields: 'files(id,name,parents)',
      });
      for (const f of files) {
        if (!/^cover\./i.test(f.name)) continue;
        const p = chunk.find((x) => x.id === (f.parents || [])[0]);
        if (p) p.coverId = f.id;
      }
    }
    projects.sort((a, b) => naturalSort(a.name, b.name));
    this.projectsCache = { at: Date.now(), data: projects };
    return projects;
  }

  async assertProject(id) {
    const hit = this.tree.get('p:' + id);
    if (hit && Date.now() - hit.at < 600000) return hit.name;
    let m;
    try { m = await this.api.get(id, 'id,name,mimeType,parents,trashed'); } catch (e) { throw new HttpError(404, 'المشروع غير موجود'); }
    if (m.trashed || m.mimeType !== FOLDER || !(m.parents || []).includes(this.rootId)) throw new HttpError(404, 'المشروع غير موجود');
    this.tree.set('p:' + id, { at: Date.now(), name: m.name });
    return m.name;
  }

  async getProject(id) {
    const c = this.projectCache.get(id);
    if (c && Date.now() - c.at < TTL) return c.data;
    const name = await this.assertProject(id);
    const subs = await this.api.list({ q: `${qs(id)} in parents and mimeType='${FOLDER}' and trashed=false`, fields: 'files(id,name)' });
    const keyById = {};
    for (const f of subs) if (SECTION_KEYS.includes(f.name)) keyById[f.id] = f.name;
    const ids = Object.keys(keyById);
    const sections = Object.fromEntries(SECTION_KEYS.map((k) => [k, []]));
    if (ids.length) {
      const files = await this.api.list({
        q: `(${ids.map((i) => qs(i) + ' in parents').join(' or ')}) and mimeType!='${FOLDER}' and trashed=false`,
        fields: 'files(id,name,mimeType,size,modifiedTime,description,parents)',
      });
      for (const f of files) {
        const key = keyById[(f.parents || [])[0]];
        if (!key) continue;
        const isLink = /\.link$/i.test(f.name);
        sections[key].push(isLink
          ? { id: f.id, name: f.name.replace(/\.link$/i, ''), kind: 'link', url: (f.description || '').trim(), mime: 'text/uri-list', size: 0, modified: f.modifiedTime }
          : { id: f.id, name: f.name, kind: 'file', mime: f.mimeType, size: +f.size || 0, modified: f.modifiedTime });
      }
      for (const k of SECTION_KEYS) sections[k] = sections[k].filter((x) => x.kind !== 'link' || x.url).sort((a, b) => naturalSort(a.name, b.name));
    }
    const covers = await this.api.list({
      q: `${qs(id)} in parents and mimeType contains 'image/' and name contains 'cover' and trashed=false`, fields: 'files(id,name)',
    });
    const cover = covers.find((f) => /^cover\./i.test(f.name));
    const data = { id, name, coverId: cover ? cover.id : null, sections };
    this.projectCache.set(id, { at: Date.now(), data });
    return data;
  }

  async ensureFolder(parentId, name) {
    const ex = await this.api.list({ q: `${qs(parentId)} in parents and name=${qs(name)} and mimeType='${FOLDER}' and trashed=false`, fields: 'files(id)' });
    if (ex.length) return ex[0].id;
    return (await this.api.createFolder(name, parentId)).id;
  }

  async createProject(rawName) {
    const name = cleanName(rawName, 80);
    if (!name) throw new HttpError(400, 'اسم المشروع مطلوب');
    const dup = await this.api.list({ q: `${qs(this.rootId)} in parents and name=${qs(name)} and mimeType='${FOLDER}' and trashed=false`, fields: 'files(id)' });
    if (dup.length) throw new HttpError(409, 'يوجد مشروع بهذا الاسم');
    const f = await this.api.createFolder(name, this.rootId);
    await Promise.all(SECTION_KEYS.map((k) => this.api.createFolder(k, f.id)));
    this.invalidate();
    return { id: f.id, name };
  }

  async renameProject(id, rawName) {
    await this.assertProject(id);
    const name = cleanName(rawName, 80);
    if (!name) throw new HttpError(400, 'اسم المشروع مطلوب');
    await this.api.update(id, { name });
    this.tree.delete('p:' + id); this.invalidate();
    return { id, name };
  }

  async deleteProject(id) {
    await this.assertProject(id);
    await this.api.trash(id); // يذهب إلى سلة Drive ويمكن استرجاعه
    this.tree.delete('p:' + id); this.invalidate();
  }

  // ---------- الملفات ----------
  async assertFile(id) {
    const hit = this.tree.get('f:' + id);
    if (hit && Date.now() - hit.at < 600000) return hit.meta;
    let m;
    try { m = await this.api.get(id, 'id,name,mimeType,size,parents,trashed'); } catch (e) { throw new HttpError(404, 'الملف غير موجود'); }
    if (m.trashed || m.mimeType === FOLDER) throw new HttpError(404, 'الملف غير موجود');
    let cur = (m.parents || [])[0]; let ok = false;
    for (let i = 0; i < 5 && cur; i++) {
      if (cur === this.rootId) { ok = true; break; }
      const p = await this.api.get(cur, 'id,parents').catch(() => ({}));
      cur = (p.parents || [])[0];
    }
    if (!ok) throw new HttpError(404, 'الملف غير موجود');
    const meta = { id, name: m.name, mime: m.mimeType, size: +m.size || 0, native: m.mimeType.startsWith('application/vnd.google-apps.') };
    this.tree.set('f:' + id, { at: Date.now(), meta });
    return meta;
  }

  async getFileMeta(id) { return this.assertFile(id); }

  async openFile(id, range) {
    const meta = await this.assertFile(id);
    if (meta.native) {
      const r = await this.api.exportPdf(id);
      return { ...r, name: meta.name + '.pdf', mime: 'application/pdf' };
    }
    const r = await this.api.download(id, range);
    return { ...r, name: meta.name, mime: meta.mime };
  }

  async saveFile(projectId, section, { tmpPath, name, mime, size }) {
    await this.assertProject(projectId);
    let parent; let finalName = cleanName(name, 150) || 'file';
    if (section === 'cover') {
      parent = projectId;
      finalName = 'cover' + (path.extname(finalName).toLowerCase() || '.jpg');
      const old = await this.api.list({ q: `${qs(projectId)} in parents and name contains 'cover' and trashed=false`, fields: 'files(id,name)' });
      for (const o of old) if (/^cover\./i.test(o.name)) await this.api.trash(o.id);
    } else {
      if (!SECTION_KEYS.includes(section)) throw new HttpError(400, 'قسم غير صالح');
      parent = await this.ensureFolder(projectId, section);
    }
    const id = await this.api.upload({ name: finalName, parentId: parent, mime: mime || mimeFromName(finalName), filePath: tmpPath, size });
    this.invalidate();
    return { id, name: finalName };
  }

  async addLink(projectId, section, title, url) {
    await this.assertProject(projectId);
    if (!SECTION_KEYS.includes(section)) throw new HttpError(400, 'قسم غير صالح');
    const parent = await this.ensureFolder(projectId, section);
    const name = (cleanName(title, 100) || 'رابط') + '.link';
    const f = await this.api.create({ name, parents: [parent], mimeType: 'text/plain', description: url });
    this.invalidate();
    return { id: f.id, name };
  }

  async deleteFile(id) {
    await this.assertFile(id);
    await this.api.trash(id);
    this.tree.delete('f:' + id); this.invalidate();
  }

  // ---------- بيانات النظام (مستخدمون/إعدادات) كملفات JSON في المجلد الرئيسي ----------
  _metaName(n) { return `_portal_${n}.json`; }

  async readJson(name, def) {
    const fn = this._metaName(name);
    let id = this.metaIds.get(fn);
    if (!id) {
      const r = await this.api.list({ q: `${qs(this.rootId)} in parents and name=${qs(fn)} and trashed=false`, fields: 'files(id)' });
      if (!r.length) return def;
      id = r[0].id; this.metaIds.set(fn, id);
    }
    try { return JSON.parse(await this.api.readText(id)); } catch { return def; }
  }

  writeJson(name, data) {
    const job = this.queue.then(async () => {
      const fn = this._metaName(name);
      let id = this.metaIds.get(fn);
      if (!id) {
        const r = await this.api.list({ q: `${qs(this.rootId)} in parents and name=${qs(fn)} and trashed=false`, fields: 'files(id)' });
        id = r.length ? r[0].id : (await this.api.create({ name: fn, parents: [this.rootId], mimeType: 'application/json' })).id;
        this.metaIds.set(fn, id);
      }
      await this.api.updateContent(id, JSON.stringify(data, null, 2));
    });
    this.queue = job.catch(() => {});
    return job;
  }
}

module.exports = { DriveStorage };
