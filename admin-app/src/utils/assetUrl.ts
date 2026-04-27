const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const CDN_URL = import.meta.env.VITE_CDN_URL || 'https://cdn.inanhxink.com/inanhxink-prod';
const S3_ENDPOINT = import.meta.env.VITE_S3_ENDPOINT || 'https://s3-north1.viettelidc.com.vn';
const S3_BUCKET = import.meta.env.VITE_S3_BUCKET || 'inanhxink-prod';
const S3_ORIGIN = `${S3_ENDPOINT}/${S3_BUCKET}`;

export function resolveAssetUrl(url: string | null | undefined, fallback = ''): string {
  if (!url) return fallback;
  if (/^(data:|blob:)/i.test(url)) return url;
  if (CDN_URL && url.startsWith(S3_ORIGIN)) return CDN_URL + url.slice(S3_ORIGIN.length);
  if (/^https?:/i.test(url)) return url;
  return `${API_BASE_URL}${url}`;
}
