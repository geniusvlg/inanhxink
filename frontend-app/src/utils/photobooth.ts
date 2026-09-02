export type PhotoboothStep = 'landing' | 'layout' | 'capture' | 'customize';

export type LayoutId =
  | 'a' | 'b' | 'idcard' | 'hearts' | 'dog' | 'vintage' | 'solace' | 'classic'
  | 'love' | 'holidays' | 'c' | 'd' | 'e';
export type LayoutTheme =
  | 'plain' | 'idcard' | 'hearts' | 'dog' | 'vintage' | 'solace' | 'classic'
  | 'love' | 'holidays';
export type LayoutBadge = 'try' | 'new' | 'template' | 'holiday';
export type ShapeId = 'none' | 'soft' | 'circle' | 'heart';
export type LogoId = 'none' | 'brand' | 'heart';

export interface PhotoboothLayout {
  id: LayoutId;
  name: string;
  poses: number;
  columns: 1 | 2;
  sizeLabel: string;
  poseLabel: string;
  theme: LayoutTheme;
  badge?: LayoutBadge;
  defaultFrame: string;
  defaultShape: ShapeId;
  defaultFilter: string;
  defaultSticker: string;
  defaultLogo: LogoId;
}

const strip4 = (
  id: LayoutId,
  name: string,
  theme: LayoutTheme,
  badge: LayoutBadge | undefined,
  extras: Partial<PhotoboothLayout> = {},
): PhotoboothLayout => ({
  id,
  name,
  poses: 4,
  columns: 1,
  sizeLabel: '6 x 2 Strip',
  poseLabel: '4 Pose',
  theme,
  badge,
  defaultFrame: 'white',
  defaultShape: 'none',
  defaultFilter: 'normal',
  defaultSticker: 'none',
  defaultLogo: 'brand',
  ...extras,
});

export const LAYOUTS: PhotoboothLayout[] = [
  { id: 'a', name: 'layout A', poses: 3, columns: 1, sizeLabel: '6 x 2 Strip', poseLabel: '3 Pose', theme: 'plain', badge: 'try', defaultFrame: 'white', defaultShape: 'none', defaultFilter: 'normal', defaultSticker: 'none', defaultLogo: 'brand' },
  { id: 'b', name: 'layout B', poses: 4, columns: 1, sizeLabel: '6 x 2 Strip', poseLabel: '4 Pose', theme: 'plain', badge: 'try', defaultFrame: 'white', defaultShape: 'none', defaultFilter: 'normal', defaultSticker: 'none', defaultLogo: 'brand' },
  { id: 'idcard', name: 'Student ID Card', poses: 1, columns: 1, sizeLabel: 'Landscape Card', poseLabel: '1 Pose', theme: 'idcard', badge: 'new', defaultFrame: 'white', defaultShape: 'soft', defaultFilter: 'normal', defaultSticker: 'none', defaultLogo: 'none' },
  strip4('hearts', 'Hearts Filter Layout', 'hearts', 'new', { defaultFilter: 'candy', defaultSticker: 'hearts' }),
  strip4('dog', 'Dog Filter Layout', 'dog', 'new', { defaultFilter: 'fresh' }),
  strip4('vintage', 'Vintage Layout', 'vintage', 'new', { defaultFrame: 'black', defaultFilter: 'ogvintage' }),
  strip4('solace', 'solace Layout', 'solace', 'new', { defaultFrame: 'maroon', defaultLogo: 'none', defaultFilter: 'nostalgia' }),
  strip4('classic', 'Classic Layout', 'classic', 'try', { defaultFrame: 'black', defaultSticker: 'classic' }),
  strip4('love', 'With Love Layout', 'love', 'template', { defaultFrame: 'pink', defaultShape: 'heart', defaultSticker: 'sparkle', defaultLogo: 'heart' }),
  strip4('holidays', 'Holidays Layout', 'holidays', 'holiday', { defaultFrame: 'pink', defaultFilter: 'candy', defaultLogo: 'heart' }),
  { id: 'c', name: 'layout C', poses: 2, columns: 1, sizeLabel: '6 x 2 Strip', poseLabel: '2 Pose', theme: 'plain', badge: 'try', defaultFrame: 'white', defaultShape: 'none', defaultFilter: 'normal', defaultSticker: 'none', defaultLogo: 'brand' },
  { id: 'd', name: 'layout D', poses: 6, columns: 2, sizeLabel: '6 x 4 Strip', poseLabel: '6 Pose', theme: 'plain', badge: 'try', defaultFrame: 'white', defaultShape: 'none', defaultFilter: 'normal', defaultSticker: 'none', defaultLogo: 'brand' },
  { id: 'e', name: 'layout E', poses: 4, columns: 2, sizeLabel: '6 x 4 Strip', poseLabel: '4 Pose', theme: 'plain', badge: 'try', defaultFrame: 'white', defaultShape: 'none', defaultFilter: 'normal', defaultSticker: 'none', defaultLogo: 'brand' },
];

export function layoutById(id: LayoutId): PhotoboothLayout {
  return LAYOUTS.find(l => l.id === id) ?? LAYOUTS[1];
}

export interface FilterDef {
  id: string;
  label: string;
  css: string;
  toolbar?: boolean;
}

export const FILTERS: FilterDef[] = [
  { id: 'normal', label: 'Normal', css: 'none', toolbar: true },
  { id: 'vintage', label: 'Vintage', css: 'sepia(100%) contrast(1)', toolbar: true },
  { id: 'gray', label: 'Gray', css: 'grayscale(80%) brightness(1) contrast(1.2) blur(0.4px)', toolbar: true },
  { id: 'smooth', label: 'Smooth', css: 'brightness(1.05) contrast(1.25) blur(0.5px)', toolbar: true },
  { id: 'bnw', label: 'B&W', css: 'grayscale(100%) contrast(1.45)', toolbar: true },
  { id: 'sepia', label: 'Sepia', css: 'sepia(70%) hue-rotate(-15deg) brightness(1.15) contrast(1.25) saturate(1.5)', toolbar: true },
  { id: 'bittersweet', label: 'Bittersweet', css: 'sepia(40%) saturate(1.4) contrast(1.15) hue-rotate(-8deg)' },
  { id: 'ogvintage', label: 'OG Vintage', css: 'sepia(55%) contrast(1.2) brightness(0.95) saturate(0.85)' },
  { id: 'fresh', label: 'Fresh', css: 'saturate(1.35) contrast(1.1) brightness(1.08)' },
  { id: 'citrus', label: 'Citrus', css: 'saturate(1.5) hue-rotate(12deg) contrast(1.12)' },
  { id: 'twentyfifteen', label: '2015', css: 'contrast(1.2) saturate(1.25) brightness(1.05) hue-rotate(-6deg)' },
  { id: 'focus', label: 'Focus', css: 'contrast(1.35) saturate(0.9) brightness(1.02)' },
  { id: 'candy', label: 'Candy', css: 'saturate(1.6) contrast(1.08) hue-rotate(-12deg) brightness(1.08)' },
  { id: 'eighties', label: '80s', css: 'sepia(20%) saturate(1.7) contrast(1.2) hue-rotate(320deg)' },
  { id: 'nostalgia', label: 'Nostalgia', css: 'sepia(35%) contrast(0.95) brightness(1.05) saturate(0.8)' },
];

export function filterCss(id: string): string {
  return FILTERS.find(f => f.id === id)?.css ?? 'none';
}

export interface FrameDef {
  id: string;
  label: string;
  kind: 'solid' | 'pattern';
  fill: string;
  pattern?: 'stripes' | 'plaid' | 'dots' | 'knit' | 'stars' | 'trash' | 'gingham';
  accent?: string;
}

export const FRAMES: FrameDef[] = [
  { id: 'pink', label: 'Hồng', kind: 'solid', fill: '#f7c6d4' },
  { id: 'blue', label: 'Xanh', kind: 'solid', fill: '#b7d4f0' },
  { id: 'yellow', label: 'Vàng', kind: 'solid', fill: '#f6e58a' },
  { id: 'matcha', label: 'Matcha', kind: 'solid', fill: '#c8d9b8' },
  { id: 'purple', label: 'Tím', kind: 'solid', fill: '#d4c2f0' },
  { id: 'brown', label: 'Nâu', kind: 'solid', fill: '#cbb8a6' },
  { id: 'red', label: 'Đỏ', kind: 'solid', fill: '#e07a7a' },
  { id: 'maroon', label: 'Đỏ rượu', kind: 'solid', fill: '#7a1f2b' },
  { id: 'white', label: 'Trắng', kind: 'solid', fill: '#f6f1ea' },
  { id: 'black', label: 'Đen', kind: 'solid', fill: '#1f1a17' },
  { id: 'stripes-red', label: 'Sọc đỏ', kind: 'pattern', fill: '#f8e9e6', pattern: 'stripes', accent: '#d94a4a' },
  { id: 'stripes-blue', label: 'Sọc xanh', kind: 'pattern', fill: '#e8f1f8', pattern: 'stripes', accent: '#3d7ab5' },
  { id: 'plaid-pink', label: 'Plaid hồng', kind: 'pattern', fill: '#fde8ef', pattern: 'plaid', accent: '#e58aa8' },
  { id: 'gingham-blue', label: 'Gingham', kind: 'pattern', fill: '#eef4fb', pattern: 'gingham', accent: '#6ea0d4' },
  { id: 'dots-gold', label: 'Chấm bi', kind: 'pattern', fill: '#fff6d8', pattern: 'dots', accent: '#e0b13a' },
  { id: 'knit-cream', label: 'Len kem', kind: 'pattern', fill: '#f3e6d4', pattern: 'knit', accent: '#d8c0a2' },
  { id: 'stars-navy', label: 'Sao', kind: 'pattern', fill: '#1d2740', pattern: 'stars', accent: '#f4e3a3' },
  { id: 'trash-white', label: 'Giấy nhăn', kind: 'pattern', fill: '#f4f0ea', pattern: 'trash', accent: '#d8d2c8' },
];

export const SHAPES: { id: ShapeId; label: string }[] = [
  { id: 'none', label: 'Vuông' },
  { id: 'soft', label: 'Bo góc' },
  { id: 'circle', label: 'Tròn' },
  { id: 'heart', label: 'Tim' },
];

export const STICKERS: { id: string; label: string }[] = [
  { id: 'none', label: 'Không' },
  { id: 'hearts', label: 'Tim' },
  { id: 'stars', label: 'Sao' },
  { id: 'sparkle', label: 'Lấp lánh' },
  { id: 'confetti', label: 'Confetti' },
  { id: 'flowers', label: 'Hoa' },
  { id: 'bows', label: 'Nơ' },
  { id: 'kisses', label: 'Hôn' },
  { id: 'classic', label: 'Classic' },
];

export const LOGOS: { id: LogoId; label: string }[] = [
  { id: 'brand', label: 'Inanhxink' },
  { id: 'heart', label: '♡' },
  { id: 'none', label: 'Ẩn' },
];

export interface StripOptions {
  photos: string[];
  layout: PhotoboothLayout;
  frameId: string;
  shape: ShapeId;
  stickerId: string;
  logo: LogoId;
  addDate: boolean;
  addTime: boolean;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Không tải được ảnh'));
    img.src = src;
  });
}

function fillPattern(ctx: CanvasRenderingContext2D, frame: FrameDef, w: number, h: number) {
  ctx.fillStyle = frame.fill;
  ctx.fillRect(0, 0, w, h);
  const accent = frame.accent ?? '#000';
  if (frame.pattern === 'stripes') {
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 10;
    ctx.globalAlpha = 0.35;
    for (let x = -h; x < w + h; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + h, h);
      ctx.stroke();
    }
    ctx.restore();
  } else if (frame.pattern === 'plaid' || frame.pattern === 'gingham') {
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.lineWidth = frame.pattern === 'plaid' ? 8 : 14;
    ctx.globalAlpha = 0.28;
    for (let x = 0; x < w; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();
  } else if (frame.pattern === 'dots') {
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.35;
    for (let y = 14; y < h; y += 28) {
      for (let x = 14; x < w; x += 28) {
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  } else if (frame.pattern === 'knit') {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.4;
    for (let y = 0; y < h; y += 10) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const yy = y + ((x / 8) % 2 === 0 ? 3 : -3);
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (frame.pattern === 'stars') {
    ctx.fillStyle = accent;
    for (let y = 18; y < h; y += 42) {
      for (let x = 18; x < w; x += 42) {
        drawStar(ctx, x + ((y / 42) % 2) * 10, y, 4, 5, 2);
      }
    }
  } else if (frame.pattern === 'trash') {
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.moveTo((i * 47) % w, (i * 73) % h);
      ctx.quadraticCurveTo((i * 31) % w, (i * 59) % h, (i * 89) % w, (i * 41) % h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, spikes: number, outer: number, inner: number) {
  let rot = Math.PI / 2 * 3;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(x, y - outer);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(x + Math.cos(rot) * outer, y + Math.sin(rot) * outer);
    rot += step;
    ctx.lineTo(x + Math.cos(rot) * inner, y + Math.sin(rot) * inner);
    rot += step;
  }
  ctx.closePath();
  ctx.fill();
}

function clipPhoto(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, shape: ShapeId) {
  ctx.beginPath();
  if (shape === 'circle') {
    const r = Math.min(w, h) / 2;
    ctx.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2);
  } else if (shape === 'soft') {
    const r = Math.min(w, h) * 0.12;
    roundRect(ctx, x, y, w, h, r);
  } else if (shape === 'heart') {
    heartPath(ctx, x, y, w, h);
  } else {
    ctx.rect(x, y, w, h);
  }
  ctx.clip();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function heartPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const top = y + h * 0.32;
  ctx.moveTo(x + w / 2, y + h * 0.92);
  ctx.bezierCurveTo(x - w * 0.08, y + h * 0.58, x + w * 0.02, top - h * 0.12, x + w / 2, top);
  ctx.bezierCurveTo(x + w * 0.98, top - h * 0.12, x + w * 1.08, y + h * 0.58, x + w / 2, y + h * 0.92);
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ir = img.width / img.height;
  const r = w / h;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;
  if (ir > r) {
    sw = img.height * r;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / r;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawStickers(ctx: CanvasRenderingContext2D, id: string, w: number, h: number) {
  if (id === 'none') return;
  ctx.save();
  if (id === 'hearts') {
    ctx.fillStyle = '#f43f6e';
    [[28, 36, 8], [w - 34, 48, 7], [40, h - 70, 9], [w - 42, h - 90, 6], [w / 2, 22, 5]].forEach(([x, y, s]) => {
      ctx.beginPath();
      heartPath(ctx, x - s, y - s, s * 2, s * 2);
      ctx.fill();
    });
  } else if (id === 'stars') {
    ctx.fillStyle = '#f4c430';
    [[30, 30], [w - 36, 40], [w / 2, 24], [40, h - 80], [w - 44, h - 100]].forEach(([x, y]) => drawStar(ctx, x, y, 5, 7, 3));
  } else if (id === 'sparkle') {
    ctx.fillStyle = '#fff6b0';
    ctx.strokeStyle = '#f0d36a';
    [[36, 44], [w - 40, 60], [52, h - 88], [w - 50, h - 120]].forEach(([x, y]) => {
      drawStar(ctx, x, y, 4, 8, 2.5);
    });
  } else if (id === 'confetti') {
    const colors = ['#f43f6e', '#60a5fa', '#facc15', '#34d399', '#c084fc'];
    for (let i = 0; i < 28; i++) {
      ctx.fillStyle = colors[i % colors.length];
      ctx.save();
      ctx.translate((i * 67) % (w - 20) + 10, (i * 97) % (h - 40) + 16);
      ctx.rotate((i * 25) * Math.PI / 180);
      ctx.fillRect(-4, -1.5, 8, 3);
      ctx.restore();
    }
  } else if (id === 'flowers') {
    ctx.fillStyle = '#fb7185';
    [[32, 40], [w - 38, 50], [36, h - 86]].forEach(([x, y]) => {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * 6, y + Math.sin(a) * 6, 5, 3.2, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fb7185';
    });
  } else if (id === 'bows') {
    ctx.fillStyle = '#f472b6';
    [[28, 28], [w - 28, 28]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.ellipse(x - 8, y, 8, 5, -0.4, 0, Math.PI * 2);
      ctx.ellipse(x + 8, y, 8, 5, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (id === 'kisses') {
    ctx.fillStyle = '#e11d48';
    [[34, 42], [w - 40, 56], [w / 2 + 20, h - 78]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.ellipse(x, y - 2, 7, 3.4, 0, 0, Math.PI * 2);
      ctx.ellipse(x, y + 2, 7, 3.4, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (id === 'classic') {
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    const marks = [[18, 18], [w - 18, 18], [18, h - 18], [w - 18, h - 18]];
    marks.forEach(([x, y], i) => {
      const dx = i % 2 === 0 ? 16 : -16;
      const dy = i < 2 ? 16 : -16;
      ctx.beginPath();
      ctx.moveTo(x, y + dy);
      ctx.lineTo(x, y);
      ctx.lineTo(x + dx, y);
      ctx.stroke();
    });
  }
  ctx.restore();
}

export function stripMetrics(layout: PhotoboothLayout) {
  if (layout.theme === 'idcard') {
    return { columns: 1, rows: 1, photoW: 340, photoH: 420, padX: 36, padTop: 48, gap: 0, footer: 36, header: 0, width: 900, height: 540 };
  }
  const columns = layout.columns;
  const rows = Math.ceil(layout.poses / columns);
  const photoW = columns === 1 ? 420 : 400;
  const photoH = columns === 1 ? 315 : 300;
  const thick = layout.theme === 'classic' || layout.theme === 'vintage';
  const padX = thick ? 22 : columns === 1 ? 30 : 32;
  const header = layout.theme === 'solace' ? 120 : 0;
  const padTop = (thick ? 18 : 28) + header;
  const gap = layout.theme === 'vintage' ? 6 : thick ? 10 : 16;
  const footer = layout.theme === 'love' || layout.theme === 'holidays' ? 120 : 88;
  const width = padX * 2 + columns * photoW + (columns - 1) * gap;
  const height = padTop + rows * photoH + (rows - 1) * gap + footer;
  return { columns, rows, photoW, photoH, padX, padTop, gap, footer, header, width, height };
}

function drawThemeChrome(
  ctx: CanvasRenderingContext2D,
  layout: PhotoboothLayout,
  m: ReturnType<typeof stripMetrics>,
) {
  const now = new Date();
  const date = now.toLocaleDateString('en-GB').replace(/\//g, '.');
  if (layout.theme === 'solace') {
    ctx.fillStyle = '#7a1f2b';
    ctx.fillRect(0, 0, m.width, m.header);
    ctx.fillStyle = '#fffaf6';
    ctx.textAlign = 'center';
    ctx.font = 'italic 54px "Dancing Script", cursive';
    ctx.fillText('solace', m.width / 2, m.header * 0.52);
    ctx.font = '500 14px "Be Vietnam Pro", sans-serif';
    ctx.fillText(date, m.width / 2, m.header * 0.78);
  }
  if (layout.theme === 'holidays') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    for (let y = 18; y < m.height; y += 28) {
      for (let x = 14; x < m.width; x += 28) {
        ctx.beginPath();
        ctx.arc(x + (y % 56 === 18 ? 8 : 0), y, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  if (layout.theme === 'classic' || layout.theme === 'vintage') {
    ctx.strokeStyle = '#111';
    ctx.lineWidth = layout.theme === 'classic' ? 18 : 6;
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, m.width - ctx.lineWidth, m.height - ctx.lineWidth);
  }
}

function drawThemeFooter(
  ctx: CanvasRenderingContext2D,
  layout: PhotoboothLayout,
  m: ReturnType<typeof stripMetrics>,
  logo: LogoId,
  addDate: boolean,
  addTime: boolean,
) {
  const now = new Date();
  const date = now.toLocaleDateString('en-GB').replace(/\//g, '.');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const footerY = m.height - m.footer / 2 - 4;

  if (layout.theme === 'love') {
    ctx.fillStyle = '#fff';
    ctx.font = 'italic 42px "Dancing Script", cursive';
    ctx.fillText('with love', m.width / 2, footerY - 10);
    ctx.font = '500 14px "Be Vietnam Pro", sans-serif';
    ctx.fillText(date, m.width / 2, footerY + 22);
    return;
  }
  if (layout.theme === 'holidays') {
    ctx.fillStyle = '#c45c7a';
    ctx.font = 'italic 36px "Dancing Script", cursive';
    ctx.fillText('holiday season', m.width / 2, footerY - 8);
    ctx.font = '500 13px "Be Vietnam Pro", sans-serif';
    ctx.fillText(date, m.width / 2, footerY + 22);
    return;
  }
  if (layout.theme === 'idcard') return;

  const darkFrame = layout.theme === 'classic' || layout.theme === 'vintage' || layout.defaultFrame === 'black';
  ctx.fillStyle = darkFrame ? '#f6f1ea' : '#2a211c';
  if (logo === 'brand') {
    ctx.font = '700 22px "Be Vietnam Pro", sans-serif';
    ctx.fillText('inanhxink', m.width / 2, footerY - 10);
  } else if (logo === 'heart') {
    ctx.font = '700 22px "Be Vietnam Pro", sans-serif';
    ctx.fillText('♡ inanhxink ♡', m.width / 2, footerY - 10);
  }
  const parts: string[] = [];
  if (addDate) parts.push(now.toLocaleDateString('vi-VN'));
  if (addTime) parts.push(now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
  if (parts.length) {
    ctx.font = '500 13px "Be Vietnam Pro", sans-serif';
    ctx.globalAlpha = 0.8;
    ctx.fillText(parts.join('  ·  '), m.width / 2, footerY + (logo === 'none' ? 0 : 16));
    ctx.globalAlpha = 1;
  }
}

export function drawFaceOverlay(ctx: CanvasRenderingContext2D, theme: LayoutTheme, w: number, h: number) {
  if (theme === 'hearts') {
    ctx.save();
    ctx.fillStyle = '#f43f6e';
    const crowns = [[w * 0.28, h * 0.12, 28], [w * 0.5, h * 0.06, 34], [w * 0.72, h * 0.12, 28]];
    crowns.forEach(([x, y, s]) => {
      ctx.beginPath();
      heartPath(ctx, x - s / 2, y, s, s);
      ctx.fill();
    });
    ctx.restore();
  }
  if (theme === 'dog') {
    ctx.save();
    ctx.fillStyle = '#6b3a1f';
    ctx.beginPath();
    ctx.ellipse(w * 0.22, h * 0.12, w * 0.12, h * 0.16, -0.4, 0, Math.PI * 2);
    ctx.ellipse(w * 0.78, h * 0.12, w * 0.12, h * 0.16, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2b8c8';
    ctx.beginPath();
    ctx.ellipse(w * 0.22, h * 0.14, w * 0.06, h * 0.08, -0.4, 0, Math.PI * 2);
    ctx.ellipse(w * 0.78, h * 0.14, w * 0.06, h * 0.08, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a1810';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.62, w * 0.07, h * 0.045, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawIdCard(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = '#8ec5e8';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, w - 20, h - 20);
  ctx.setLineDash([]);
  ctx.fillStyle = '#1e4d7b';
  ctx.fillRect(10, 10, w - 20, 56);
  ctx.fillStyle = '#fff';
  ctx.font = '700 22px "Be Vietnam Pro", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('STUDENT ID', w / 2, 44);
  const px = 40;
  const py = 90;
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, px, py, 340, 380, 10);
  ctx.clip();
  drawCover(ctx, img, px, py, 340, 380);
  ctx.restore();
  ctx.fillStyle = '#1a1a1a';
  ctx.textAlign = 'left';
  const tx = 420;
  const lines = [['NAME', 'Your Name'], ['ID NO.', '000000'], ['DATE', new Date().toLocaleDateString('en-GB')]];
  lines.forEach(([label, value], i) => {
    const y = 150 + i * 88;
    ctx.font = '600 12px "Be Vietnam Pro", sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.fillText(label, tx, y);
    ctx.font = '700 22px "Be Vietnam Pro", sans-serif';
    ctx.fillStyle = '#111';
    ctx.fillText(value, tx, y + 28);
    ctx.strokeStyle = '#d1d5db';
    ctx.beginPath();
    ctx.moveTo(tx, y + 38);
    ctx.lineTo(w - 48, y + 38);
    ctx.stroke();
  });
  ctx.fillStyle = '#111';
  for (let i = 0; i < 28; i++) {
    ctx.fillRect(tx + i * 10, h - 92, (i % 3 === 0 ? 6 : 3), 36);
  }
}

export async function renderPhotoStrip(opts: StripOptions): Promise<HTMLCanvasElement> {
  const frame = FRAMES.find(f => f.id === opts.frameId) ?? FRAMES[7];
  const m = stripMetrics(opts.layout);
  const canvas = document.createElement('canvas');
  canvas.width = m.width;
  canvas.height = m.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas không khả dụng');

  fillPattern(ctx, frame, m.width, m.height);
  const images = await Promise.all(opts.photos.slice(0, opts.layout.poses).map(loadImage));

  if (opts.layout.theme === 'idcard' && images[0]) {
    drawIdCard(ctx, images[0], m.width, m.height);
    return canvas;
  }

  drawThemeChrome(ctx, opts.layout, m);

  images.forEach((img, i) => {
    const col = i % m.columns;
    const row = Math.floor(i / m.columns);
    const x = m.padX + col * (m.photoW + m.gap);
    const y = m.padTop + row * (m.photoH + m.gap);
    ctx.save();
    clipPhoto(ctx, x, y, m.photoW, m.photoH, opts.shape);
    drawCover(ctx, img, x, y, m.photoW, m.photoH);
    ctx.restore();
    if (opts.layout.theme === 'hearts' || opts.layout.theme === 'dog') {
      ctx.save();
      clipPhoto(ctx, x, y, m.photoW, m.photoH, opts.shape);
      ctx.translate(x, y);
      drawFaceOverlay(ctx, opts.layout.theme, m.photoW, m.photoH);
      ctx.restore();
    }
    if (opts.layout.theme === 'classic') {
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 8;
      ctx.strokeRect(x, y, m.photoW, m.photoH);
    }
  });

  drawStickers(ctx, opts.stickerId, m.width, m.height);
  drawThemeFooter(ctx, opts.layout, m, opts.logo, opts.addDate, opts.addTime);
  return canvas;
}

export function captureVideoFrame(
  video: HTMLVideoElement,
  mirror: boolean,
  filter: string,
  theme: LayoutTheme = 'plain',
): string {
  const w = video.videoWidth || 1280;
  const h = video.videoHeight || 960;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.filter = filterCss(filter);
  if (mirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, w, h);
  if (mirror) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  ctx.filter = 'none';
  drawFaceOverlay(ctx, theme, w, h);
  return canvas.toDataURL('image/jpeg', 0.92);
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Không đọc được file'));
    reader.readAsDataURL(file);
  });
}

function palette332(): Uint8Array {
  const pal = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    pal[i * 3] = Math.round(((i >> 5) & 7) * 255 / 7);
    pal[i * 3 + 1] = Math.round(((i >> 2) & 7) * 255 / 7);
    pal[i * 3 + 2] = Math.round((i & 3) * 255 / 3);
  }
  return pal;
}

function index332(data: Uint8ClampedArray): Uint8Array {
  const out = new Uint8Array(data.length / 4);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    out[j] = ((data[i] >> 5) << 5) | ((data[i + 1] >> 5) << 2) | (data[i + 2] >> 6);
  }
  return out;
}

function lzwEncode(index: Uint8Array): Uint8Array {
  const minCode = 8;
  const clear = 1 << minCode;
  const eoi = clear + 1;
  const chunks: number[] = [];
  let codeSize = minCode + 1;
  let next = eoi + 1;
  let buf = 0;
  let bits = 0;
  const table = new Map<string, number>();

  const emit = (code: number) => {
    buf |= code << bits;
    bits += codeSize;
    while (bits >= 8) {
      chunks.push(buf & 255);
      buf >>= 8;
      bits -= 8;
    }
  };

  const reset = () => {
    table.clear();
    codeSize = minCode + 1;
    next = eoi + 1;
  };

  emit(clear);
  let prefix = String.fromCharCode(index[0]);
  for (let i = 1; i < index.length; i++) {
    const k = String.fromCharCode(index[i]);
    const combined = prefix + k;
    if (table.has(combined)) {
      prefix = combined;
      continue;
    }
    const code = prefix.length === 1 ? prefix.charCodeAt(0) : table.get(prefix)!;
    emit(code);
    if (next < 4096) {
      table.set(combined, next);
      if (next === 1 << codeSize && codeSize < 12) codeSize += 1;
      next += 1;
    } else {
      emit(clear);
      reset();
    }
    prefix = k;
  }
  emit(prefix.length === 1 ? prefix.charCodeAt(0) : table.get(prefix)!);
  emit(eoi);
  if (bits > 0) chunks.push(buf & 255);
  return Uint8Array.from(chunks);
}

function packGifBlocks(data: Uint8Array): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < data.length; i += 255) {
    const n = Math.min(255, data.length - i);
    out.push(n);
    for (let j = 0; j < n; j++) out.push(data[i + j]);
  }
  out.push(0);
  return Uint8Array.from(out);
}

export async function encodePoseGif(photos: string[], delayCs = 80): Promise<Blob> {
  const images = await Promise.all(photos.map(loadImage));
  const w = 360;
  const h = 270;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas không khả dụng');

  const pal = palette332();
  const bytes: number[] = [];
  const push = (...vals: number[]) => vals.forEach(v => bytes.push(v & 255));
  const push16 = (n: number) => {
    push(n & 255, (n >> 8) & 255);
  };

  push(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);
  push16(w);
  push16(h);
  push(0xf7, 0, 0);
  for (let i = 0; i < pal.length; i++) bytes.push(pal[i]);
  push(0x21, 0xff, 11);
  'NETSCAPE2.0'.split('').forEach(c => bytes.push(c.charCodeAt(0)));
  push(3, 1, 0, 0, 0);

  for (const img of images) {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, w, h);
    drawCover(ctx, img, 0, 0, w, h);
    const pixels = ctx.getImageData(0, 0, w, h).data;
    const index = index332(pixels);
    const lzw = lzwEncode(index);
    const blocks = packGifBlocks(lzw);
    push(0x21, 0xf9, 4, 0x04);
    push16(delayCs);
    push(0, 0);
    push(0x2c, 0, 0, 0, 0);
    push16(w);
    push16(h);
    push(0, 8);
    for (let i = 0; i < blocks.length; i++) bytes.push(blocks[i]);
  }
  push(0x3b);
  return new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Không xuất được ảnh'));
    }, type);
  });
}
