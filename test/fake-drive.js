// نسخة وهمية من واجهة Google Drive في الذاكرة — لاختبار منطق DriveStorage بدون إنترنت
const crypto = require('crypto');
const fs = require('fs');
const { Readable } = require('stream');
const { HttpError } = require('../lib/util');

class FakeDrive {
  constructor() {
    this.nodes = new Map(); this.calls = 0;
    this.root = this._add({ name: 'ROOT', mimeType: 'application/vnd.google-apps.folder', parents: [] });
    this.mydrive = this.root;
  }
  _add(n) {
    const id = n.id || crypto.randomBytes(6).toString('hex');
    const node = { id, trashed: false, description: '', size: undefined, content: null, modifiedTime: new Date().toISOString(), ...n };
    this.nodes.set(id, node); return id;
  }
  _need(id) { const n = this.nodes.get(id); if (!n) throw new HttpError(404, 'not found'); return n; }
  _pick(n, fields) { return { ...n, size: n.content ? String(n.content.length) : n.size }; }

  _compile(q) {
    const lits = [];
    let s = q.replace(/'((?:[^'\\]|\\.)*)'/g, (_, x) => { lits.push(x.replace(/\\(.)/g, '$1')); return 'S' + (lits.length - 1); });
    s = s.replace(/S(\d+) in parents/g, 'P($1)')
      .replace(/(name|mimeType) contains S(\d+)/g, 'C("$1",$2)')
      .replace(/(name|mimeType)!=S(\d+)/g, '!E("$1",$2)')
      .replace(/(name|mimeType)=S(\d+)/g, 'E("$1",$2)')
      .replace(/trashed=false/g, '!n.trashed').replace(/\band\b/g, '&&').replace(/\bor\b/g, '||');
    const f = new Function('n', 'L', `const P=i=>(n.parents||[]).includes(L[i]);const C=(k,i)=>String(n[k]).toLowerCase().includes(L[i].toLowerCase());const E=(k,i)=>n[k]===L[i];return (${s});`);
    return (n) => f(n, lits);
  }

  async list({ q }) { this.calls++; const t = this._compile(q); return [...this.nodes.values()].filter(t).map((n) => this._pick(n)); }
  async get(id) { this.calls++; return this._pick(this._need(id)); }
  async createFolder(name, parentId) { return { id: this._add({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }), name }; }
  async create(meta) { return { id: this._add({ ...meta }), name: meta.name }; }
  async update(id, body) { Object.assign(this._need(id), body); return { id }; }
  async trash(id) { this._need(id).trashed = true; }
  async readText(id) { return this._need(id).content.toString('utf8'); }
  async updateContent(id, text) { this._need(id).content = Buffer.from(text); }
  async upload({ name, parentId, mime, filePath, description }) {
    return this._add({ name, parents: [parentId], mimeType: mime, content: fs.readFileSync(filePath), description });
  }
  async exportPdf(id) { const n = this._need(id); const b = Buffer.from('%PDF-fake ' + n.name); return { status: 200, headers: { 'content-type': 'application/pdf', 'content-length': String(b.length) }, stream: Readable.from([b]) }; }
  async download(id, range) {
    const b = this._need(id).content || Buffer.alloc(0); const size = b.length;
    const m = range && /^bytes=(\d*)-(\d*)$/.exec(range);
    if (m) {
      const start = parseInt(m[1] || '0', 10); const end = m[2] ? Math.min(size - 1, parseInt(m[2], 10)) : size - 1;
      if (start >= size) return { status: 416, headers: { 'content-range': `bytes */${size}` }, stream: null };
      return { status: 206, headers: { 'content-length': String(end - start + 1), 'content-range': `bytes ${start}-${end}/${size}` }, stream: Readable.from([b.subarray(start, end + 1)]) };
    }
    return { status: 200, headers: { 'content-length': String(size) }, stream: Readable.from([b]) };
  }
}
module.exports = { FakeDrive };
