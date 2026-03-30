import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import path from 'path';
import sharp from 'sharp';

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
 *  Images are converted to WebP before uploading. */
export async function uploadToS3(
  buffer: Buffer,
  folder: string,
  originalname: string,
  mimetype: string,
): Promise<string> {
  let uploadBuffer = buffer;
  let ext          = path.extname(originalname).toLowerCase();
  let contentType  = mimetype;

  // Convert any image to WebP
  if (IMAGE_MIMES.has(mimetype) && mimetype !== 'image/webp') {
    uploadBuffer = await sharp(buffer).webp({ quality: 90 }).toBuffer();
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
