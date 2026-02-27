import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import dotenv from 'dotenv';
import db from './config/database';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3001;
const DOMAIN = process.env.DOMAIN || 'inanhxink.com';

const isLocalDev = (host: string) =>
  host.startsWith('localhost') || host.startsWith('127.0.0.1');

function getSubdomain(req: Request): string | null {
  const host = req.headers.host || '';
  if (isLocalDev(host)) {
    // 1. Query param on the request itself (direct page load)
    const param = (req.query.preview || req.query.sub) as string | undefined;
    if (param) return param;

    // 2. Referer header — browsers send this on asset requests from the template page.
    //    e.g. Referer: http://localhost:3001/?preview=anhle
    const referer = req.headers.referer || '';
    if (referer) {
      try {
        const refUrl = new URL(referer);
        const refParam = refUrl.searchParams.get('preview') || refUrl.searchParams.get('sub');
        if (refParam) return refParam;
      } catch {
        // invalid URL — ignore
      }
    }

    return null;
  }
  // Production: subdomain is the first label of the Host header
  const parts = host.split('.');
  const sub = parts[0];
  if (!sub || sub === 'order' || sub === 'www') return null;
  return sub;
}

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: (_origin, cb) => cb(null, true), credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── File upload (multer) ─────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and audio files are allowed'));
    }
  },
});

// ── Static files ─────────────────────────────────────────────────────────────
app.use('/uploads', express.static(uploadsDir));
app.use('/static', express.static(path.join(__dirname, 'public')));
// Serve template thumbnail JPGs (used by the frontend order site)
app.use('/templates', express.static(path.join(__dirname, 'public', 'templates')));

// ── File upload endpoint ─────────────────────────────────────────────────────
app.post('/api/upload', upload.array('files', 20), (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }
    const urls = files.map(f => `/uploads/${f.filename}`);
    return res.json({ success: true, urls });
  } catch (err) {
    const e = err as Error;
    return res.status(500).json({ success: false, error: e.message });
  }
});

// ── Health / DB check ────────────────────────────────────────────────────────
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.get('/api/test-db', async (_req: Request, res: Response) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({ status: 'ok', timestamp: result.rows[0].now });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// ── API: site data (subdomain routing) ───────────────────────────────────────
app.get('/api/site-data', async (req: Request, res: Response) => {
  try {
    const subdomain = getSubdomain(req);
    if (!subdomain) {
      return res.status(400).json({
        error: 'No subdomain detected. On localhost use ?sub=NAME or ?preview=NAME.',
      });
    }

    const result = await db.query(
      'SELECT template_type, template_data FROM qr_codes WHERE qr_name = $1',
      [subdomain]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Site '${subdomain}' not found` });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    const err = error as Error;
    return res.status(500).json({ error: err.message });
  }
});

// ── Named API routes ─────────────────────────────────────────────────────────
import templatesRouter from './routes/templates';
import vouchersRouter from './routes/vouchers';
import ordersRouter from './routes/orders';
import qrcodesRouter from './routes/qrcodes';

app.use('/api/templates', templatesRouter);
app.use('/api/vouchers', vouchersRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/qrcodes', qrcodesRouter);

// ── Template serving helpers ─────────────────────────────────────────────────
const templatesRoot = path.join(__dirname, 'public', 'templates');

// Inject window.__SUBDOMAIN__ and window.dataFromSubdomain before </head>
// so template JS can use the data without an extra /api/site-data round-trip.
function injectScripts(
  html: string,
  subdomain: string,
  templateType: string,
  templateData: Record<string, unknown> | null,
): string {
  const dataPayload = JSON.stringify({ template: templateType, data: templateData ?? {} });
  const tag =
    `<script>` +
    `window.__SUBDOMAIN__=${JSON.stringify(subdomain)};` +
    `window.dataFromSubdomain=${dataPayload};` +
    `</script>`;
  return html.replace('</head>', `${tag}\n</head>`);
}

// ── Catch-all: serve template for *.inanhxink.com (or ?preview= on localhost) ──
// Note: app.use() instead of app.get('*') — Express 5 dropped bare wildcard support
app.use(async (req: Request, res: Response, next: NextFunction) => {
  const subdomain = getSubdomain(req);

  // No subdomain resolved — skip (plain localhost root, API routes already handled, etc.)
  if (!subdomain) return next();

  const urlPath = req.path;

  try {
    const result = await db.query(
      'SELECT template_type, template_data FROM qr_codes WHERE qr_name = $1',
      [subdomain]
    );

    if (result.rows.length === 0) {
      return res.status(404).send(`<h1>404 – '${subdomain}' not found</h1>`);
    }

    const { template_type, template_data } = result.rows[0];
    const templateDir = path.join(templatesRoot, template_type);

    // For non-root paths, serve the static asset directly from the template folder
    if (urlPath !== '/' && urlPath !== '') {
      const assetPath = path.join(templateDir, urlPath);
      if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
        return res.sendFile(assetPath);
      }
    }

    // Serve index.html with injected globals
    const indexPath = path.join(templateDir, 'index.html');
    const html = fs.readFileSync(indexPath, 'utf-8');
    res.setHeader('Content-Type', 'text/html');
    return res.send(injectScripts(html, subdomain, template_type, template_data));
  } catch (error) {
    return next(error);
  }
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Domain: ${DOMAIN}`);
  console.log(`Template preview (local): http://localhost:${PORT}/?preview=<qrName>`);
});
