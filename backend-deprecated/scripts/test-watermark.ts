/* Standalone test that mirrors the watermark logic in backend/config/s3.ts
 * Usage: npx ts-node backend/scripts/test-watermark.ts <input> <output>
 * Defaults: input = backend/public/templates/loveletter/loveletter.jpg
 *           output = /tmp/watermark-test.webp
 */
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

const WATERMARK_PATH = path.join(__dirname, '..', 'public', 'watermark.png');
const WATERMARK_RATIO = 0.3;
const WATERMARK_MARGIN_RATIO = 0.03;

async function main() {
  const input = process.argv[2] || path.join(__dirname, '..', 'public', 'templates', 'loveletter', 'loveletter.jpg');
  const output = process.argv[3] || '/tmp/watermark-test.webp';

  console.log('Watermark file:', WATERMARK_PATH, fs.existsSync(WATERMARK_PATH) ? '✓' : '✗ MISSING');
  console.log('Input image:   ', input, fs.existsSync(input) ? '✓' : '✗ MISSING');

  const buffer = fs.readFileSync(input);
  const wmBuffer = fs.readFileSync(WATERMARK_PATH);

  const meta = await sharp(buffer).metadata();
  const width = meta.width ?? 800;
  const height = meta.height ?? 600;
  console.log(`Input size:     ${width}×${height} (${meta.format}, ${(buffer.length / 1024).toFixed(1)} KB)`);

  const wmWidth = Math.round(width * WATERMARK_RATIO);
  const margin = Math.round(width * WATERMARK_MARGIN_RATIO);
  const wmResized = await sharp(wmBuffer).trim().resize(wmWidth).toBuffer();
  const wmMeta = await sharp(wmResized).metadata();
  const wmHeight = wmMeta.height ?? 0;
  const left = width - wmWidth - margin;
  const top = height - wmHeight - margin;

  console.log(`Watermark:      ${wmWidth}×${wmHeight} placed at (${left}, ${top}), margin=${margin}px`);

  if (left < 0 || top < 0) {
    console.error('⚠️  Watermark would overflow image bounds — sharp will throw.');
  }

  const outBuffer = await sharp(buffer)
    .composite([{ input: wmResized, left, top }])
    .webp({ quality: 90 })
    .toBuffer();

  fs.writeFileSync(output, outBuffer);
  console.log(`Output:         ${output} (${(outBuffer.length / 1024).toFixed(1)} KB) ✓`);
}

main().catch(err => {
  console.error('❌ Watermark pipeline FAILED:', err);
  process.exit(1);
});
