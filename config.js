const path = require('path');
const e = process.env;
// يقبل المعرّف أو رابط المجلد كاملاً
const rawRoot = String(e.DRIVE_ROOT_FOLDER_ID || '').trim().replace(/^["']|["']$/g, '');
const rootId = (/folders\/([A-Za-z0-9_-]+)/.exec(rawRoot) || /[?&]id=([A-Za-z0-9_-]+)/.exec(rawRoot) || [, rawRoot.split(/[?#\s]/)[0]])[1];
const hasDriveCreds = !!(e.GOOGLE_REFRESH_TOKEN || e.GOOGLE_SERVICE_ACCOUNT_JSON || e.GOOGLE_SERVICE_ACCOUNT_FILE);
module.exports = {
  port: +e.PORT || 3000,
  storage: e.STORAGE || (rootId && hasDriveCreds ? 'drive' : 'local'),
  driveRootId: rootId,
  google: {
    clientId: e.GOOGLE_CLIENT_ID || '',
    clientSecret: e.GOOGLE_CLIENT_SECRET || '',
    refreshToken: e.GOOGLE_REFRESH_TOKEN || '',
    serviceAccountJson: e.GOOGLE_SERVICE_ACCOUNT_JSON || '',
    serviceAccountFile: e.GOOGLE_SERVICE_ACCOUNT_FILE || '',
  },
  dataDir: path.resolve(e.DATA_DIR || path.join(__dirname, '..', 'data')),
  baseUrl: (e.BASE_URL || '').replace(/\/+$/, ''),
  maxUploadMb: +e.MAX_UPLOAD_MB || 1024,
  sessionSecret: e.SESSION_SECRET || '',
  adminUsername: (e.ADMIN_USERNAME || 'admin').toLowerCase(),
  adminPassword: e.ADMIN_PASSWORD || '',
  sessionDays: 365,
};
