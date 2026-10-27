const b64u = (s) => Buffer.from(String(s), 'utf8').toString('base64url');
const unb64u = (s) => Buffer.from(String(s), 'base64url').toString('utf8');
const collator = new Intl.Collator(['ar', 'en'], { numeric: true, sensitivity: 'base' });
const naturalSort = (a, b) => collator.compare(a, b);

function cleanName(n, max = 120) {
  return String(n || '')
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, max)
    .trim();
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const EXT_MIME = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', heic: 'image/heic', mp4: 'video/mp4', m4v: 'video/mp4',
  mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska', avi: 'video/x-msvideo',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip', txt: 'text/plain', csv: 'text/csv', kml: 'application/vnd.google-earth.kml+xml',
  kmz: 'application/vnd.google-earth.kmz', dwg: 'application/acad', html: 'text/html', json: 'application/json',
};
const extOf = (n) => (String(n).match(/\.([A-Za-z0-9]+)$/) || [, ''])[1].toLowerCase();
const mimeFromName = (n) => EXT_MIME[extOf(n)] || 'application/octet-stream';

function categoryOf(mime, name = '') {
  mime = mime || '';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf' || mime === 'application/vnd.google-apps.document') return 'pdf';
  if (/spreadsheet|excel|csv/.test(mime)) return 'sheet';
  if (/word|presentation|powerpoint/.test(mime)) return 'doc';
  return 'other';
}

// أنواع قد تنفّذ سكربتات إن عُرضت داخل موقعنا: تُنزَّل ولا تُعرض
const RISKY = /^(text\/html|application\/xhtml|image\/svg|text\/xml|application\/xml|application\/javascript|text\/javascript)/i;

module.exports = { b64u, unb64u, naturalSort, cleanName, HttpError, mimeFromName, extOf, categoryOf, RISKY };
