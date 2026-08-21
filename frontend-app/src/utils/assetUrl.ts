const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const CDN_URL = (import.meta.env.VITE_CDN_URL as string | undefined) || 'https://cdn.inanhxink.com';
const S3_HOSTS = [
  'https://hcm04.vstorage.vngcloud.vn/',
  'https://s3-north1.viettelidc.com.vn/',
];

/** Rewrite stored S3 URLs to the CDN so the browser can play them (S3 has no CORS). */
export function toCdnUrl(url: string): string {
  if (!url) return url;
  for (const origin of S3_HOSTS) {
    if (url.startsWith(origin)) {
      const cdn = CDN_URL.replace(/\/$/, '');
      const rest = url.slice(origin.length);
      if (cdn.endsWith('/inanhxink-prod') && rest.startsWith('inanhxink-prod/')) {
        return `${cdn}${rest.slice('inanhxink-prod'.length)}`;
      }
      if (cdn.endsWith('/inanhxink-dev') && rest.startsWith('inanhxink-dev/')) {
        return `${cdn}${rest.slice('inanhxink-dev'.length)}`;
      }
      return `${cdn.replace(/\/inanhxink-(prod|dev)$/, '')}/${rest}`;
    }
  }
  return url;
}

export function resolveAssetUrl(url: string | null | undefined, fallback = '/placeholder.png'): string {
  if (!url) return fallback;
  if (/^(https?:|data:|blob:)/i.test(url)) return toCdnUrl(url);
  return `${API_BASE_URL}${url}`;
}
