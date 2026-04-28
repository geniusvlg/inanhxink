import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

const WATERMARK_PATH   = path.join(__dirname, '..', 'public', 'watermark.png');
const WATERMARK_RATIO  = 0.3;
const WATERMARK_MARGIN_RATIO = 0.03; // margin is 3% of image width

// Cache watermark buffer so it's only read from disk once
let _watermarkBuffer: Buffer | null = null;
function getWatermarkBuffer(): Buffer {
  if (!_watermarkBuffer) {
    _watermarkBuffer = fs.readFileSync(WATERMARK_PATH);
  }
  return _watermarkBuffer;
}

const ENDPOINT   = process.env.S3_ENDPOINT   || '';
const REGION     = process.env.S3_REGION     || 'north1';
const BUCKET     = process.env.S3_BUCKET     || 'inanhxink-prod';
const ACCESS_KEY = process.env.S3_ACCESS_KEY || '';
const SECRET_KEY = process.env.S3_SECRET_KEY || '';

if (!ENDPOINT || !ACCESS_KEY || !SECRET_KEY) {
  throw new Error('Missing S3 configuration: S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY are required');
}

const s3 = new S3Client({
  endpoint: ENDPOINT,
  region: REGION,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
  forcePathStyle: true,
});

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff']);

/** Returns the public URL for a given S3 key */
export function getPublicUrl(key: string): string {
  return `${ENDPOINT}/${BUCKET}/${key}`;
}

/** Upload a single file buffer to S3, returns the public URL.
 *  Images are converted to WebP. If watermark=true, a watermark is
 *  composited at the bottom-right before uploading. */
export async function uploadToS3(
  buffer: Buffer,
  folder: string,
  originalname: string,
  mimetype: string,
  watermark = false,
): Promise<string> {
  let uploadBuffer = buffer;
  let ext          = path.extname(originalname).toLowerCase();
  let contentType  = mimetype;

  if (IMAGE_MIMES.has(mimetype)) {
    let pipeline = sharp(buffer);

    if (watermark) {
      const { width = 800, height = 600 } = await sharp(buffer).metadata();
      const wmWidth   = Math.round(width * WATERMARK_RATIO);
      const margin    = Math.round(width * WATERMARK_MARGIN_RATIO);
      const wmResized = await sharp(getWatermarkBuffer()).trim().resize(wmWidth).toBuffer();
      const wmMeta    = await sharp(wmResized).metadata();
      const wmHeight  = wmMeta.height ?? 0;
      const left      = width  - wmWidth  - margin;
      const top       = height - wmHeight - margin;
      pipeline = sharp(await pipeline.toBuffer()).composite([{ input: wmResized, left, top }]);
    }

    uploadBuffer = await pipeline.webp({ quality: 90 }).toBuffer();
    ext          = '.webp';
    contentType  = 'image/webp';
  }

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const key      = folder ? `${folder}/${filename}` : filename;

  await s3.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        uploadBuffer,
    ContentType: contentType,
    ACL:         'public-read',
  }));

  return getPublicUrl(key);
}

/** Delete all objects under a given prefix except the provided keys */
export async function pruneS3Folder(
  prefix: string,
  keepKeys: Set<string>,
): Promise<void> {
  const list = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix + '/' }));
  if (!list.Contents) return;
  for (const obj of list.Contents) {
    if (obj.Key && !keepKeys.has(obj.Key)) {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: obj.Key }));
    }
  }
}

/** Convert a public URL produced by `getPublicUrl` back to its S3 key.
 *  Returns null if the URL doesn't belong to this bucket. */
export function extractKeyFromUrl(url: string): string | null {
  if (typeof url !== 'string') return null;
  const prefix = `${ENDPOINT}/${BUCKET}/`;
  if (!url.startsWith(prefix)) return null;
  const key = url.slice(prefix.length);
  return key.length > 0 ? key : null;
}

/** Delete a single S3 object by its public URL. Returns true if a delete
 *  request was issued. Silently no-ops for URLs outside this bucket so the
 *  caller can safely pass any image_url. */
export async function deleteFromS3(url: string): Promise<boolean> {
  const key = extractKeyFromUrl(url);
  if (!key) return false;
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  return true;
}
