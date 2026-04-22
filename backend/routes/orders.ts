import express, { Router, Request, Response } from 'express';
import { sendError } from '../middleware/sendError';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execFile } from 'child_process';
import db from '../config/database';
import { uploadToS3 } from '../config/s3';

const MAX_MUSIC_BYTES = 15 * 1024 * 1024; // 15 MB
const SOCIAL_MUSIC_URL = /tiktok\.com|instagram\.com/i;

async function downloadMusicFile(tiktokUrl: string, qrName: string): Promise<string> {
  // Download to a temp directory
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `music-${qrName}-`));

  try {
    // Download audio in native format — yt-dlp picks the best available
    await new Promise<void>((resolve, reject) => {
      execFile('yt-dlp', [
        '-x',
        '-o', path.join(tmpDir, 'music.%(ext)s'),
        tiktokUrl,
      ], (err, _stdout, stderr) => {
        if (err) reject(new Error(`yt-dlp error: ${stderr || err.message}`));
        else resolve();
      });
    });

    // Find the downloaded file (e.g. music.m4a, music.webm)
    const musicFile = fs.readdirSync(tmpDir).find(f => f.startsWith('music.'));
    if (!musicFile) throw new Error('Không tìm thấy file nhạc sau khi tải');

    const filePath = path.join(tmpDir, musicFile);
    const buffer = fs.readFileSync(filePath);

    if (buffer.length > MAX_MUSIC_BYTES) {
      throw new Error('File nhạc quá lớn (tối đa 15MB)');
    }

    const ext = path.extname(musicFile).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.webm': 'audio/webm',
      '.ogg': 'audio/ogg', '.opus': 'audio/opus', '.wav': 'audio/wav',
    };
    const mimetype = mimeMap[ext] || 'audio/mpeg';

    // Upload to S3 under uploads/<qrName>/
    const url = await uploadToS3(buffer, `uploads/${qrName}`, musicFile, mimetype);
    return url;
  } finally {
    // Clean up temp directory
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

const router: Router = express.Router();

const DOMAIN = process.env.DOMAIN || 'inanhxink.com';

// Valid template types that we have cloned
const VALID_TEMPLATE_TYPES = ['galaxy', 'loveletter', 'letterinspace', 'lovedays', 'birthday'] as const;
type TemplateType = typeof VALID_TEMPLATE_TYPES[number];

// Map the frontend template_type strings to the actual template folder names
const TEMPLATE_FOLDER_MAP: Record<string, string> = {
  letterinspace: 'galaxy',
  loveletter: 'loveletter',
  galaxy: 'galaxy',
  lovedays: 'lovedays',
  birthday: 'birthday',
};

interface OrderTotal {
  subtotal: number;
  total: number;
  discount: number;
}

function calculateTotal(
  templatePrice: number | string,
  keychainPrice: number | string | null,
  musicPrice: number | string | null,
  tipAmount: number | string,
  voucherDiscount: number | null,
  discountType: string | null
): OrderTotal {
  let subtotal = parseFloat(String(templatePrice)) || 0;
  if (keychainPrice) subtotal += parseFloat(String(keychainPrice));
  if (musicPrice) subtotal += parseFloat(String(musicPrice));
  subtotal += parseFloat(String(tipAmount)) || 0;
  let total = subtotal;
  if (voucherDiscount) {
    if (discountType === 'percentage') {
      total = subtotal * (1 - voucherDiscount / 100);
    } else {
      total = Math.max(0, subtotal - voucherDiscount);
    }
  }
  return {
    subtotal: Math.round(subtotal),
    total: Math.round(total),
    discount: Math.round(subtotal - total),
  };
}

// ── Check if QR name / subdomain is available ────────────────────────────────
router.post('/check-qr-name', async (req: Request, res: Response) => {
  try {
    const { qrName } = req.body as { qrName: string };

    if (!qrName) {
      return res.status(400).json({ success: false, error: 'QR name is required' });
    }

    const validPattern = /^[a-z0-9_-]+$/;
    if (!validPattern.test(qrName)) {
      return res.status(400).json({
        success: false,
        error: 'QR name must be lowercase letters, numbers, dashes, or underscores only',
      });
    }

    const result = await db.query(
      'SELECT id FROM qr_codes WHERE qr_name = $1',
      [qrName.toLowerCase()]
    );

    if (result.rows.length > 0) {
      return res.json({ success: false, available: false, message: 'QR name already taken' });
    }

    return res.json({
      success: true,
      available: true,
      message: 'QR name is available',
      fullUrl: `${qrName.toLowerCase()}.${DOMAIN}`,
    });
  } catch (error) {
    const err = error as Error;
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── Create order ──────────────────────────────────────────────────────────────
interface CreateOrderBody {
  // Identification
  qrName: string;
  templateId: number | string;
  templateType?: string;         // 'galaxy' | 'loveletter'
  // Content varies by template type
  content?: string;              // letter text (loveletter)
  imageUrls?: string[];          // uploaded image URLs (galaxy / loveletter)
  musicUrl?: string;             // music file URL
  // Love Letter specific
  letterTitle?: string;
  letterHint?: string;           // prompt shown on closed letter (e.g. "Em iu ấn vào lá thư đi nè ❤")
  letterSignoff?: string;        // sign-off line above signature (e.g. "Thương em rất nhiều. 💗")
  letterSender?: string;
  letterReceiver?: string;
  // Love Days specific
  loveDaysDate?: string;     // ISO date string e.g. "2025-12-20"
  loveDaysNameFrom?: string;
  loveDaysNameTo?: string;
  loveDaysAvatarFrom?: string; // S3 URL
  loveDaysAvatarTo?: string;   // S3 URL
  loveDaysMessage?: string;    // secret message shown when heart is fully filled
  loveDaysTheme?: 'soft' | 'sunset' | 'night' | 'polaroid';
  loveDaysGalleryImages?: string[];
  loveDaysTimeline?: Array<{ date?: string; text?: string }>;
  // Birthday specific
  birthdayBackgroundText?: string;
  birthdayBackgroundColor?: string;
  birthdayTextColor?: { r: number; g: number; b: number };
  birthdayHeartColor?: { r: number; g: number; b: number };
  birthdayTitle?: string;        // shown as message #1 in countdown (default: Happy Birthday)
  birthdayName?: string;         // shown as message #2 in countdown
  birthdayAge?: string;        // shown as message #4 in countdown
  birthdayDate?: string;       // shown as message #6 in countdown (e.g. "28.03.2006")
  birthdayFinalText?: string;
  // Legacy / extras
  musicLink?: string;
  musicAdded?: boolean;
  keychainPurchased?: boolean;
  tipAmount?: number;
  voucherCode?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}

router.post('/', async (req: Request<object, object, CreateOrderBody>, res: Response) => {
  try {
    const {
      qrName,
      content = '',
      templateId,
      templateType,
      imageUrls = [],
      musicUrl,
      musicLink,
      musicAdded,
      keychainPurchased,
      tipAmount,
      voucherCode,
      customerName,
      customerEmail,
      customerPhone,
      letterTitle,
      letterHint,
      letterSignoff,
      letterSender,
      letterReceiver,
      loveDaysDate,
      loveDaysNameFrom,
      loveDaysNameTo,
      loveDaysAvatarFrom,
      loveDaysAvatarTo,
      loveDaysMessage,
      loveDaysTheme,
      loveDaysGalleryImages = [],
      loveDaysTimeline = [],
      birthdayBackgroundText,
      birthdayBackgroundColor,
      birthdayTextColor,
      birthdayHeartColor,
      birthdayTitle,
      birthdayName,
      birthdayAge,
      birthdayDate,
      birthdayFinalText,
    } = req.body;

    if (!qrName || !templateId) {
      return res.status(400).json({ success: false, error: 'qrName and templateId are required' });
    }

    // Resolve template_type from explicit field or from templateId mapping
    const resolvedTemplateType: TemplateType =
      (templateType && VALID_TEMPLATE_TYPES.includes(templateType as TemplateType)
        ? templateType as TemplateType
        : TEMPLATE_FOLDER_MAP[String(templateType)] || null) as TemplateType;

    if (!resolvedTemplateType) {
      return res.status(400).json({
        success: false,
        error: `Unknown template type. Supported: ${VALID_TEMPLATE_TYPES.join(', ')}`,
      });
    }

    // Birthday: finalText limited to 50 characters
    if (resolvedTemplateType === 'birthday' && birthdayFinalText) {
      if (birthdayFinalText.length > 50) {
        return res.status(400).json({
          success: false,
          error: 'Lời chúc không được quá 50 ký tự',
        });
      }
    }

    // Build template_data JSON based on template type
    const templateData: Record<string, unknown> = { content };
    if (templateType === 'letterinspace' || templateType === 'galaxy') {
      templateData.texts = content.split('\n').map(s => s.trim()).filter(Boolean);
    }
    if (templateType === 'loveletter') {
      templateData.title    = letterTitle    || 'Love Letter';
      templateData.sender   = letterSender   || '';
      templateData.receiver = letterReceiver || '';
      if (letterHint && letterHint.trim()) {
        templateData.hint = letterHint.trim();
      }
      if (letterSignoff && letterSignoff.trim()) {
        templateData.signoff = letterSignoff.trim();
      }
    }
    if (templateType === 'lovedays') {
      templateData.date        = loveDaysDate       || '';
      templateData.nameFrom    = loveDaysNameFrom   || '';
      templateData.nameTo      = loveDaysNameTo     || '';
      templateData.avatarFrom  = loveDaysAvatarFrom || '';
      templateData.avatarTo    = loveDaysAvatarTo   || '';
      templateData.message     = loveDaysMessage    || '';
      templateData.theme       = loveDaysTheme      || 'soft';
      templateData.popupImages = Array.isArray(loveDaysGalleryImages) ? loveDaysGalleryImages : [];
      templateData.timeline    = Array.isArray(loveDaysTimeline)
        ? loveDaysTimeline
            .map((item) => ({
              date: String(item?.date || '').trim(),
              text: String(item?.text || '').trim(),
            }))
            .filter((item) => item.date || item.text)
        : [];

      // Backward-compatible fallback if client still sends a single imageUrls array
      if ((templateData.popupImages as string[]).length === 0 && imageUrls.length > 2) {
        templateData.popupImages = imageUrls.slice(2);
      }
    }
    if (templateType === 'birthday') {
      templateData.backgroundText  = birthdayBackgroundText  || 'I LOVE YOU';
      templateData.backgroundColor = birthdayBackgroundColor || '#ffa3e0';
      templateData.textColor       = birthdayTextColor       || { r: 179, g: 204, b: 255 };
      templateData.heartColor      = birthdayHeartColor      || { r: 255, g: 105, b: 180 };
      templateData.messages        = [
        birthdayTitle  || 'Happy Birthday',
        birthdayName || '',
        birthdayAge  || '',
        birthdayDate ? `${birthdayDate}.${new Date().getFullYear()}` : '',
      ];
      templateData.finalText       = birthdayFinalText || '';
    }
    if (imageUrls.length > 0) templateData.imageUrls = imageUrls;

    // Download music only for raw social URLs (TikTok/Instagram).
    // If client already extracted & uploaded music via /api/music/extract, keep that URL as-is.
    let resolvedMusicUrl = musicUrl || musicLink || undefined;
    if (resolvedMusicUrl && musicAdded && SOCIAL_MUSIC_URL.test(resolvedMusicUrl)) {
      try {
        resolvedMusicUrl = await downloadMusicFile(resolvedMusicUrl, qrName.toLowerCase());
      } catch (e) {
        const err = e as Error;
        return res.status(400).json({ success: false, error: err.message || 'Tải nhạc thất bại' });
      }
    }

    if (resolvedMusicUrl) templateData.musicUrl = resolvedMusicUrl;

    // Get template price
    const templateResult = await db.query('SELECT price FROM templates WHERE id = $1', [templateId]);
    if (templateResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    const templatePrice = templateResult.rows[0].price;

    const metaResult = await db.query(
      `SELECT key, value FROM metadata WHERE key IN ('music_price', 'keychain_price')`
    );
    const meta: Record<string, number> = {};
    for (const row of metaResult.rows) meta[row.key] = parseInt(row.value);
    const MUSIC_PRICE = meta['music_price'] ?? 10000;
    const KEYCHAIN_PRICE = meta['keychain_price'] ?? 35000;
    const musicPrice = musicAdded ? MUSIC_PRICE : 0;
    const keychainPrice = keychainPurchased ? KEYCHAIN_PRICE : 0;

    // Voucher
    let voucherDiscount: number | null = 0;
    let discountType: string | null = null;
    if (voucherCode) {
      const voucherResult = await db.query(
        `SELECT * FROM vouchers
         WHERE code = $1 AND is_active = true
         AND (expires_at IS NULL OR expires_at > NOW())
         AND (max_uses IS NULL OR used_count < max_uses)`,
        [voucherCode.toUpperCase()]
      );
      if (voucherResult.rows.length > 0) {
        const v = voucherResult.rows[0];
        voucherDiscount = parseFloat(v.discount_value);
        discountType = v.discount_type;
        await db.query('UPDATE vouchers SET used_count = used_count + 1 WHERE id = $1', [v.id]);
      }
    }

    const { subtotal, total, discount } = calculateTotal(
      templatePrice, keychainPrice, musicPrice, tipAmount || 0, voucherDiscount, discountType
    );

    const qrNameLower = qrName.toLowerCase();
    const fullUrl = `${qrNameLower}.${DOMAIN}`;

    // Store order (QR code is created later when payment is confirmed)
    try {
      const orderResult = await db.query(
        `INSERT INTO orders (
          customer_name, customer_email, customer_phone,
          template_id, template_type, template_data, qr_name, content, music_link, music_added,
          keychain_purchased, keychain_price, tip_amount, voucher_code, voucher_discount,
          subtotal, total_amount, status, payment_status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
        RETURNING *`,
        [
          customerName || null, customerEmail || null, customerPhone || null,
          templateId, resolvedTemplateType, JSON.stringify(templateData),
          qrNameLower, content, resolvedMusicUrl || null,
          musicAdded || false, keychainPurchased || false, keychainPrice,
          tipAmount || 0, voucherCode || null, discount, subtotal, total, 'pending', 'pending',
        ]
      );

      const order = orderResult.rows[0];

      return res.json({
        success: true,
        order,
        qrCode: {
          qrName: qrNameLower,
          fullUrl,
          templateType: resolvedTemplateType,
        },
      });
    } catch (err) {
      throw err;
    }
  } catch (error) {
    const err = error as Error;
    console.error('Error creating order:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── Get order by ID ───────────────────────────────────────────────────────────
router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT o.*, t.name as template_name, t.image_url as template_image
       FROM orders o LEFT JOIN templates t ON o.template_id = t.id
       WHERE o.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    return res.json({ success: true, order: result.rows[0] });
  } catch (error) {
    const err = error as Error;
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
