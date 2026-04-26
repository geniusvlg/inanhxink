const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function resolveAssetUrl(url: string | null | undefined, fallback = '/placeholder.png'): string {
  if (!url) return fallback;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return `${API_BASE_URL}${url}`;
}
