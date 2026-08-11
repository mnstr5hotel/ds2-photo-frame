import crypto from 'node:crypto';

const SESSION_MAX_AGE_SECONDS = 2 * 60 * 60;
const SECURE_SESSION_COOKIE = '__Host-ds_asset_session';
const LOCAL_SESSION_COOKIE = 'ds_asset_session';
const DEVELOPMENT_SECRET = 'ds2-photo-frame-local-development-only';

function assetSecret() {
  const secret = process.env.DS_ASSET_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV !== 'production') return DEVELOPMENT_SECRET;
  throw new Error('DS_ASSET_SECRET must contain at least 32 characters in production');
}

function sign(value) {
  return crypto.createHmac('sha256', assetSecret()).update(value).digest('base64url');
}

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function parseCookies(header) {
  return new Map((header || '').split(';').map(function(part) {
    const separator = part.indexOf('=');
    if (separator < 0) return ['', ''];
    return [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
  }).filter(function(entry) { return entry[0]; }));
}

export function issueAssetSession(request) {
  const forwardedProtocol = request.headers.get('x-forwarded-proto');
  const secure = forwardedProtocol === 'https' || new URL(request.url).protocol === 'https:';
  const cookieName = secure ? SECURE_SESSION_COOKIE : LOCAL_SESSION_COOKIE;
  const issuedAt = Math.floor(Date.now() / 1000).toString(36);
  const nonce = crypto.randomBytes(18).toString('base64url');
  const payload = issuedAt + '.' + nonce;
  const value = payload + '.' + sign(payload);
  const attributes = [
    cookieName + '=' + value,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=' + SESSION_MAX_AGE_SECONDS,
  ];
  if (secure) attributes.push('Secure');
  return attributes.join('; ');
}

export function hasValidAssetSession(request) {
  const cookies = parseCookies(request.headers.get('cookie'));
  const value = cookies.get(SECURE_SESSION_COOKIE) || cookies.get(LOCAL_SESSION_COOKIE);
  if (!value) return false;
  const parts = value.split('.');
  if (parts.length !== 3) return false;
  const payload = parts[0] + '.' + parts[1];
  if (!timingSafeEqual(sign(payload), parts[2])) return false;
  const issuedAt = Number.parseInt(parts[0], 36);
  const age = Math.floor(Date.now() / 1000) - issuedAt;
  return Number.isFinite(issuedAt) && age >= 0 && age <= SESSION_MAX_AGE_SECONDS;
}

export function mediaToken(kind, relativePath) {
  return sign(kind + ':' + relativePath).slice(0, 32);
}
