const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);
const { HttpError } = require('./util');

async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = await scrypt(pw, salt, 64);
  return salt.toString('hex') + ':' + h.toString('hex');
}
async function verifyPassword(pw, stored) {
  const [s, h] = String(stored || '').split(':');
  if (!s || !h) return false;
  const calc = await scrypt(pw, Buffer.from(s, 'hex'), 64);
  const want = Buffer.from(h, 'hex');
  return calc.length === want.length && crypto.timingSafeEqual(calc, want);
}

class Users {
  constructor(store) { this.store = store; this.list = []; }
  async load() { this.list = await this.store.readJson('users', []); }
  save() { return this.store.writeJson('users', this.list); }

  view(u) { return { id: u.id, username: u.username, name: u.name, role: u.role, active: u.active, createdAt: u.createdAt, lastLogin: u.lastLogin || null }; }
  all() { return this.list.map((u) => this.view(u)); }
  byId(id) { return this.list.find((u) => u.id === id); }
  byUsername(n) { return this.list.find((u) => u.username === String(n || '').trim().toLowerCase()); }
  activeAdmins() { return this.list.filter((u) => u.role === 'admin' && u.active); }

  async create({ username, name, password, role }) {
    username = String(username || '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw new HttpError(400, 'اسم المستخدم: 3-32 حرفاً إنجليزياً أو أرقاماً (يسمح بـ . _ -)');
    if (String(password || '').length < 6) throw new HttpError(400, 'كلمة المرور 6 أحرف على الأقل');
    if (this.byUsername(username)) throw new HttpError(409, 'اسم المستخدم مستخدم مسبقاً');
    const u = {
      id: crypto.randomBytes(8).toString('hex'), username, name: String(name || username).trim().slice(0, 60) || username,
      role: role === 'admin' ? 'admin' : 'sales', active: true, passwordHash: await hashPassword(password),
      tokenVersion: 1, createdAt: new Date().toISOString(),
    };
    this.list.push(u); await this.save();
    return this.view(u);
  }

  async authenticate(username, password) {
    const u = this.byUsername(username);
    // نفّذ التحقق دائماً لتقليل الفرق الزمني
    const ok = await verifyPassword(String(password || ''), u ? u.passwordHash : '0:0');
    if (!u || !ok) return null;
    if (!u.active) throw new HttpError(403, 'هذا الحساب موقوف. تواصل مع المسؤول.');
    u.lastLogin = new Date().toISOString(); this.save().catch(() => {});
    return u;
  }

  async update(id, patch) {
    const u = this.byId(id);
    if (!u) throw new HttpError(404, 'المستخدم غير موجود');
    const wasAdmin = u.role === 'admin' && u.active;
    const next = { ...u };
    if (patch.name !== undefined) next.name = String(patch.name).trim().slice(0, 60) || u.username;
    if (patch.role !== undefined) next.role = patch.role === 'admin' ? 'admin' : 'sales';
    if (patch.active !== undefined) next.active = !!patch.active;
    if (patch.password) {
      if (String(patch.password).length < 6) throw new HttpError(400, 'كلمة المرور 6 أحرف على الأقل');
      next.passwordHash = await hashPassword(String(patch.password)); next.tokenVersion = (u.tokenVersion || 1) + 1;
    }
    if (!next.active) next.tokenVersion = (u.tokenVersion || 1) + 1;
    const stillAdmin = next.role === 'admin' && next.active;
    if (wasAdmin && !stillAdmin && this.activeAdmins().length <= 1) throw new HttpError(400, 'لا يمكن إزالة آخر مسؤول فعّال');
    Object.assign(u, next); await this.save();
    return this.view(u);
  }

  async remove(id) {
    const u = this.byId(id);
    if (!u) throw new HttpError(404, 'المستخدم غير موجود');
    if (u.role === 'admin' && u.active && this.activeAdmins().length <= 1) throw new HttpError(400, 'لا يمكن حذف آخر مسؤول فعّال');
    this.list = this.list.filter((x) => x.id !== id); await this.save();
  }
}

module.exports = { Users, hashPassword, verifyPassword };
