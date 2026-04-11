import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execFile } from 'child_process';
import { uploadToS3 } from '../config/s3';

const router = Router();

const MAX_MUSIC_BYTES = 15 * 1024 * 1024; // 15MB

async function downloadAndUploadMusic(url: string, qrName?: string): Promise<string> {
  const safeName = (qrName || 'music').toLowerCase().replace(/[^a-z0-9_-]/g, '-') || 'music';
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `music-check-${safeName}-`));

  try {
    await new Promise<void>((resolve, reject) => {
      execFile('yt-dlp', [
        '-x',
        '-o', path.join(tmpDir, 'music.%(ext)s'),
        url,
      ], (err, _stdout, stderr) => {
        if (err) reject(new Error(`yt-dlp error: ${stderr || err.message}`));
        else resolve();
      });
    });

    const musicFile = fs.readdirSync(tmpDir).find((f) => f.startsWith('music.'));
    if (!musicFile) throw new Error('Không tìm thấy file nhạc sau khi tải');

    const filePath = path.join(tmpDir, musicFile);
    const buffer = fs.readFileSync(filePath);

    if (buffer.length > MAX_MUSIC_BYTES) {
      throw new Error('File nhạc quá lớn (tối đa 15MB)');
    }

    const ext = path.extname(musicFile).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.m4a': 'audio/mp4',
      '.mp3': 'audio/mpeg',
      '.webm': 'audio/webm',
      '.ogg': 'audio/ogg',
      '.opus': 'audio/opus',
      '.wav': 'audio/wav',
    };
    const mimetype = mimeMap[ext] || 'audio/mpeg';

    return await uploadToS3(buffer, `uploads/${safeName}`, musicFile, mimetype);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

router.post('/extract', async (req: Request, res: Response) => {
  const { url, qrName } = req.body as { url: string; qrName?: string };

  if (!url || !String(url).trim()) {
    return res.status(400).json({ success: false, error: 'URL is required' });
  }

  try {
    const uploadedUrl = await downloadAndUploadMusic(String(url).trim(), qrName);
    return res.json({ success: true, url: uploadedUrl });
  } catch (error) {
    const err = error as Error;
    return res.status(400).json({ success: false, error: err.message || 'Không tải được nhạc từ link này' });
  }
});

export default router;
