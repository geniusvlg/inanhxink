/**
 * CDN URL rewrite — single source of truth for the project's storage rule:
 *
 *   STORE in DB:   raw S3 origin URL
 *   SERVE via API: rewritten CDN URL
 *
 * Storing the canonical S3 URL keeps admin tooling simple (deletes work, you
 * always know exactly which object backs a row). Serving via CDN keeps
 * customer bandwidth cheap and adds edge caching. The rewrite is therefore
 * applied at *response time* in every public route — never persisted.
 *
 *   S3 (raw):   https://s3.<region>.<provider>/<bucket>/path/to/file.webp
 *   CDN:        https://cdn.inanhxink.com/<bucket>/path/to/file.webp
 *
 * If `CDN_BASE_URL` is unset (e.g. local dev without a CDN), URLs are
 * returned unchanged so dev still works.
 *
 * IMPORTANT for new code:
 *   - Public/customer-facing routes (`backend/routes/*.ts`)         → REWRITE
 *   - Admin routes (`backend/routes/admin/*.ts`)                    → DO NOT
 *     rewrite. Admins need the raw S3 URL so deletes & verifications work.
 *   - Inserts/updates                                                → DO NOT
 *     rewrite. Always persist the raw S3 URL returned by `uploadToS3`.
 */

const S3_ORIGIN = `${process.env.S3_ENDPOINT || ''}/${process.env.S3_BUCKET || 'inanhxink-prod'}`;
const CDN_BASE  = process.env.CDN_BASE_URL || '';

/** Rewrite a single value if it's an S3 URL string; otherwise pass through.
 *  Accepts `unknown` so callers can map over arrays of mixed types without
 *  type-narrowing first (used by the template-injection code). */
export function rewriteS3ToCdn(url: unknown): unknown {
  if (typeof url !== 'string') return url;
  if (CDN_BASE && url.startsWith(S3_ORIGIN)) {
    return CDN_BASE + url.slice(S3_ORIGIN.length);
  }
  return url;
}

/** Convenience overload preserving null/string types — preferred in routes. */
export function cdnUrl(url: string | null | undefined): string | null {
  if (url == null) return null;
  return rewriteS3ToCdn(url) as string;
}

/** Map an array of URL strings (for JSONB columns like `products.images`). */
export function cdnUrlArray(urls: unknown): string[] {
  if (!Array.isArray(urls)) return [];
  return urls.map(u => rewriteS3ToCdn(u)).filter((u): u is string => typeof u === 'string');
}

/** Map specific image-bearing fields on a row in-place. Returns the row for
 *  chaining. Use this in routes that select many rows: cleaner than spreading
 *  per-field rewrites at every call site. */
export function rewriteRowImageFields<T extends Record<string, unknown>>(
  row: T,
  fields: { url?: (keyof T)[]; array?: (keyof T)[] } = {},
): T {
  for (const f of fields.url ?? []) {
    if (typeof row[f] === 'string') (row as Record<string, unknown>)[f as string] = cdnUrl(row[f] as string);
  }
  for (const f of fields.array ?? []) {
    (row as Record<string, unknown>)[f as string] = cdnUrlArray(row[f]);
  }
  return row;
}
