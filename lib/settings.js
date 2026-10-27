const DEFAULTS = {
  siteName: 'مشاريع الشركة',
  tagline: 'مكتبة فريق المبيعات',
  projectsTitle: 'المشاريع',
  countryCode: '964',
  whatsappIntro: 'مرحباً، هذه تفاصيل مشروع {project}:',
  labels: {
    info: 'معلومات المشروع', info_ar: 'العربية', info_ku: 'کوردی', info_en: 'English',
    videos: 'الفيديوهات', maps: 'الخرائط', location: 'موقع المشروع', prices: 'الأسعار',
  },
};
const str = (v, max) => String(v).trim().slice(0, max);

class Settings {
  constructor(store) { this.store = store; this.data = JSON.parse(JSON.stringify(DEFAULTS)); }
  async load() {
    const s = await this.store.readJson('settings', {});
    this.data = { ...DEFAULTS, ...s, labels: { ...DEFAULTS.labels, ...(s.labels || {}) } };
  }
  get() { return this.data; }
  async update(p) {
    const d = this.data;
    if (p.siteName !== undefined && str(p.siteName, 60)) d.siteName = str(p.siteName, 60);
    if (p.tagline !== undefined) d.tagline = str(p.tagline, 80);
    if (p.projectsTitle !== undefined && str(p.projectsTitle, 40)) d.projectsTitle = str(p.projectsTitle, 40);
    if (p.countryCode !== undefined) d.countryCode = String(p.countryCode).replace(/\D/g, '').slice(0, 4) || DEFAULTS.countryCode;
    if (p.whatsappIntro !== undefined) d.whatsappIntro = str(p.whatsappIntro, 300);
    if (p.labels && typeof p.labels === 'object') {
      for (const k of Object.keys(DEFAULTS.labels)) if (p.labels[k] !== undefined && str(p.labels[k], 40)) d.labels[k] = str(p.labels[k], 40);
    }
    await this.store.writeJson('settings', d);
    return d;
  }
}
module.exports = { Settings, DEFAULTS };
