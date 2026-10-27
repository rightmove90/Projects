// أقسام المشروع. المفتاح = اسم المجلد داخل مجلد المشروع في Drive
const SECTION_KEYS = ['info_ar', 'info_ku', 'info_en', 'videos', 'maps', 'location', 'prices'];
const STRUCTURE = [
  { key: 'info', children: ['info_ar', 'info_ku', 'info_en'] },
  { key: 'videos' },
  { key: 'maps' },
  { key: 'location' },
  { key: 'prices' },
];
module.exports = { SECTION_KEYS, STRUCTURE };
