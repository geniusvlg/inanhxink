import stickerLayouts from './photobooth-stickers.json';

export type PhotoboothStep = 'landing' | 'layout' | 'capture' | 'crop' | 'customize';

export type CropAspect = 'free' | '1:1' | '4:3' | '3:4' | '2:3' | '1:4';

export const CROP_ASPECTS: { id: CropAspect; label: string; ratio: number | null }[] = [
  { id: 'free', label: 'Tự do', ratio: null },
  { id: '1:1', label: '1:1 Vuông', ratio: 1 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '3:4', label: '3:4', ratio: 3 / 4 },
  { id: '2:3', label: '2:3', ratio: 2 / 3 },
  { id: '1:4', label: '1:4 Dải', ratio: 1 / 4 },
];

export interface PhotoAdjust {
  rotation: number;
  aspect: CropAspect;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function defaultPhotoAdjust(): PhotoAdjust {
  return { rotation: 0, aspect: 'free', x: 0.04, y: 0.04, w: 0.92, h: 0.92 };
}

export function fitAdjustToAspect(adj: PhotoAdjust): PhotoAdjust {
  const ratio = CROP_ASPECTS.find(a => a.id === adj.aspect)?.ratio;
  if (!ratio) return adj;
  if (ratio >= 1) {
    const h = Math.min(1, 1 / ratio);
    return { ...adj, x: 0, y: (1 - h) / 2, w: 1, h };
  }
  const w = Math.min(1, ratio);
  return { ...adj, x: (1 - w) / 2, y: 0, w, h: 1 };
}

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
  sizeLabel: 'Khổ 6 x 2',
  poseLabel: '4 ảnh',
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
  { id: 'a', name: 'Mẫu A', poses: 3, columns: 1, sizeLabel: 'Khổ 6 x 2', poseLabel: '3 ảnh', theme: 'plain', badge: 'try', defaultFrame: 'white', defaultShape: 'none', defaultFilter: 'normal', defaultSticker: 'none', defaultLogo: 'brand' },
  { id: 'b', name: 'Mẫu B', poses: 4, columns: 1, sizeLabel: 'Khổ 6 x 2', poseLabel: '4 ảnh', theme: 'plain', badge: 'try', defaultFrame: 'white', defaultShape: 'none', defaultFilter: 'normal', defaultSticker: 'none', defaultLogo: 'brand' },
  { id: 'idcard', name: 'Thẻ sinh viên', poses: 1, columns: 1, sizeLabel: 'Thẻ ngang', poseLabel: '1 ảnh', theme: 'idcard', badge: 'new', defaultFrame: 'white', defaultShape: 'soft', defaultFilter: 'normal', defaultSticker: 'none', defaultLogo: 'none' },
  strip4('hearts', 'Mẫu trái tim', 'hearts', 'new', { defaultSticker: 'lotsheart' }),
  strip4('dog', 'Mẫu cún', 'dog', 'new'),
  strip4('vintage', 'Mẫu vintage', 'vintage', 'new', { defaultFrame: 'black' }),
  strip4('solace', 'Mẫu Solace', 'solace', 'new', { defaultFrame: 'red', defaultLogo: 'none' }),
  strip4('classic', 'Mẫu cổ điển', 'classic', 'try', { defaultFrame: 'black', defaultSticker: 'classic' }),
  strip4('love', 'Mẫu yêu thương', 'love', 'template', { defaultFrame: 'pink', defaultShape: 'heart', defaultSticker: 'sparkle', defaultLogo: 'heart' }),
  strip4('holidays', 'Mẫu lễ hội', 'holidays', 'holiday', { defaultFrame: 'pink', defaultLogo: 'heart' }),
  { id: 'c', name: 'Mẫu C', poses: 2, columns: 1, sizeLabel: 'Khổ 6 x 2', poseLabel: '2 ảnh', theme: 'plain', badge: 'try', defaultFrame: 'white', defaultShape: 'none', defaultFilter: 'normal', defaultSticker: 'none', defaultLogo: 'brand' },
  { id: 'd', name: 'Mẫu D', poses: 6, columns: 2, sizeLabel: 'Khổ 6 x 4', poseLabel: '6 ảnh', theme: 'plain', badge: 'try', defaultFrame: 'white', defaultShape: 'none', defaultFilter: 'normal', defaultSticker: 'none', defaultLogo: 'brand' },
  { id: 'e', name: 'Mẫu E', poses: 4, columns: 2, sizeLabel: 'Khổ 6 x 4', poseLabel: '4 ảnh', theme: 'plain', badge: 'try', defaultFrame: 'white', defaultShape: 'none', defaultFilter: 'normal', defaultSticker: 'none', defaultLogo: 'brand' },
];

export function layoutById(id: LayoutId): PhotoboothLayout {
  return LAYOUTS.find(l => l.id === id) ?? LAYOUTS[1];
}

export interface FilterDef {
  id: string;
  label: string;
  css: string;
  toolbar?: boolean;
  icon?: string;
  preview: string;
}

/** Filters + assets from photobooth-io.cc/canvas.html */
export const FILTERS: FilterDef[] = [
  { id: 'normal', label: 'Normal', css: 'none', toolbar: true, icon: '/photobooth/filters/normal-icon.webp', preview: 'linear-gradient(135deg, #fa1172 0%, #ff85a1 100%)' },
  { id: 'vintage', label: 'Vintage', css: 'sepia(1) contrast(1.1)', toolbar: true, icon: '/photobooth/filters/vintage-icon.webp', preview: 'linear-gradient(135deg, #d4a574 0%, #f26a8d 50%, #ff85a1 100%)' },
  { id: 'gray', label: 'Grayscale', css: 'grayscale(1) brightness(1.1) contrast(1.2) blur(0.7px)', toolbar: true, icon: '/photobooth/filters/gray-icon.webp', preview: 'linear-gradient(135deg, #a0a0a0 0%, #d4d4d4 100%)' },
  { id: 'smooth', label: 'Smooth', css: 'brightness(1.05) contrast(1.3) blur(0.9px)', toolbar: true, icon: '/photobooth/filters/smooth-icon.webp', preview: 'linear-gradient(135deg, #ffb3d9 0%, #ffc5e0 100%)' },
  { id: 'grayscale', label: 'B&W', css: 'grayscale(1) contrast(1.5)', toolbar: true, icon: '/photobooth/filters/bnw-icon.webp', preview: 'linear-gradient(135deg, #1a1a1a 0%, #5a5a5a 100%)' },
  { id: 'sepia', label: 'Sepia', css: 'sepia(0.7) brightness(1.25) contrast(1.15) saturate(1.1)', toolbar: true, icon: '/photobooth/filters/sepia-icon.webp', preview: 'linear-gradient(135deg, #c9a570 0%, #e8d4b8 100%)' },
  { id: 'bittersweet', label: 'Bittersweet', css: 'brightness(1.1) contrast(0.85) saturate(1.15) sepia(0.2) blur(1px)', preview: 'center / cover url(/photobooth/filters/bittersweet.webp)' },
  { id: 'ogvintage', label: 'OG Vintage', css: 'sepia(0.35) contrast(0.9) brightness(1.05) saturate(0.9) hue-rotate(-5deg)', preview: 'center / cover url(/photobooth/filters/ogvintage.webp)' },
  { id: 'fresh', label: 'Fresh', css: 'contrast(1.25) brightness(1.05) saturate(1.2)', preview: 'center / cover url(/photobooth/filters/fresh.webp)' },
  { id: 'citrus', label: 'Citrus', css: 'sepia(0.55) saturate(1.4) brightness(1.05) contrast(1.15) hue-rotate(-10deg)', preview: 'center / cover url(/photobooth/filters/citrus.webp)' },
  { id: 'twenty-fifteen', label: '2015', css: 'contrast(1.9) brightness(1.05) saturate(1.1) hue-rotate(-45deg) sepia(0.25)', preview: 'center / cover url(/photobooth/filters/twenty-fifteen.webp)' },
  { id: 'focus', label: 'Focus', css: 'contrast(1.3) brightness(0.95) saturate(1.2) hue-rotate(-8deg)', preview: 'center / cover url(/photobooth/filters/focus.webp)' },
  { id: 'candy', label: 'Candy', css: 'saturate(1.4) hue-rotate(-30deg) brightness(1.05) contrast(1.1)', preview: 'center / cover url(/photobooth/filters/candy.webp)' },
  { id: 'eighties', label: '80s', css: 'brightness(1.1) contrast(1.2) saturate(1.25) hue-rotate(-10deg) sepia(1)', preview: 'center / cover url(/photobooth/filters/eighties.webp)' },
  { id: 'nostalgia', label: 'Nostalgia', css: 'brightness(1.05) contrast(0.85) sepia(0.3) saturate(0.9) hue-rotate(-10deg)', preview: 'center / cover url(/photobooth/filters/nostalgia.webp)' },
];

export function filterCss(id: string): string {
  return FILTERS.find(f => f.id === id)?.css ?? 'none';
}

export interface FrameDef {
  id: string;
  label: string;
  kind: 'solid' | 'image';
  fill: string;
  src?: string;
}

const solid = (id: string, label: string, fill: string): FrameDef => ({ id, label, kind: 'solid', fill });
const tex = (id: string, label: string, file: string, fill = '#f6f1ea'): FrameDef => ({
  id, label, kind: 'image', fill, src: `/photobooth/frames/${file}`,
});

export const FRAMES: FrameDef[] = [
  solid('custom', 'Tự chọn', '#ffffff'),
  solid('pink', 'Hồng', '#ffc2d1'),
  solid('blue', 'Xanh', '#caf0f8'),
  solid('yellow', 'Vàng', '#fff8a5'),
  solid('matcha', 'Matcha', '#90a955'),
  solid('purple', 'Tím', '#c19ee0'),
  solid('brown', 'Nâu', '#ddbea9'),
  solid('red', 'Đỏ', '#780000'),
  solid('white', 'Trắng', '#ffffff'),
  solid('black', 'Đen', '#000000'),
  tex('pink-glitter', 'Kim tuyến hồng', 'pink-glitter.jpg'),
  tex('pink-plaid', 'Plaid hồng', 'pink-plaid.jpg'),
  tex('blue-plaid', 'Plaid xanh', 'blue-plaid.jpg'),
  tex('black-cq', 'Coquette đen', 'black-couqutte.jpg'),
  tex('white-cq', 'Coquette trắng', 'white-couquette.jpg'),
  tex('pink-leather', 'Da hồng', 'pink-diamond-leather.jpg'),
  tex('brown-knit', 'Len nâu', 'brown-knitted.jpg'),
  tex('hotpink-knit', 'Len hồng đậm', 'hot-pink-knitted.jpg'),
  tex('red-knit', 'Len đỏ', 'red-knitted.jpg'),
  tex('pink-knit', 'Len hồng', 'pink-knitted.jpg'),
  tex('red-stripes', 'Sọc đỏ', 'red-stripes.jpg'),
  tex('green-stripes', 'Sọc xanh lá', 'green-stripes.jpg'),
  tex('blue-stripes', 'Sọc xanh', 'blue-stripes.jpg'),
  tex('vs-pink', 'VS hồng', 'vs-pink.jpg'),
  tex('vs-yellow', 'VS vàng', 'vs-yellow.jpg'),
  tex('blue-yellow-sq', 'Ô xanh vàng', 'blue-yellow-squares.jpg'),
  tex('blue-white-sq', 'Ô xanh trắng', 'blue-white-squares.jpg'),
  tex('leopard', 'Beo', 'brown-leopard.jpg'),
  tex('cow', 'Bò sữa', 'cow-print.jpg'),
  tex('red-leather', 'Da đỏ', 'red-leather.jpg'),
  tex('gumamela', 'Dâm bụt', 'pink-gumamela.jpg'),
  tex('lilies', 'Lily hồng', 'pink-lilies.jpg'),
  tex('white-knit', 'Len trắng', 'white-knitted-cloth.jpg'),
  tex('ribbon-sweater', 'Nơ áo len', 'ribbon-sweater.jpg'),
  tex('ribbon-denim', 'Nơ denim', 'ribbon-denim.jpg'),
  tex('black-pink-ribbon', 'Nơ đen hồng', 'black-pink-ribbon.jpg'),
  tex('lockers', 'Tủ locker', '4-lockers.jpg'),
  tex('grid-paper', 'Giấy ô', 'grid-paper.jpg'),
  tex('crumpled', 'Giấy nhăn', 'crumpled-paper.jpg'),
  tex('rough', 'Vân thô', 'rough-texture.jpg'),
  tex('blue-backdrop', 'Phông xanh', 'blue-backdrop.jpg'),
  tex('green-hills', 'Đồi xanh', 'green-hills.jpg'),
  tex('sand-shells', 'Cát sò', 'sand-shells.jpg'),
  tex('water', 'Nước', 'water.jpg'),
  tex('coco-trees', 'Dừa', 'coco-trees.jpg'),
  tex('stardust', 'Bụi sao', 'stardust.jpg'),
  tex('rose-card', 'Thiệp hồng', 'rose-card.jpg'),
  tex('princess', 'Vintage', 'princess-vintage.jpg'),
  tex('red-roses', 'Họa tiết hồng', 'red-roses-paint.jpg'),
  tex('gray-trash', 'Giấy xám', 'gray-trash.jpg'),
  tex('black-trash', 'Giấy đen', 'black-trash.jpg'),
  tex('white-trash', 'Giấy trắng', 'white-trash.jpg'),
  tex('party-drape', 'Rèm tiệc', 'party-drape.jpg'),
  tex('party-dots', 'Chấm tiệc', 'party-dots.jpg'),
  tex('bling-denim', 'Denim bling', 'bling-denim.jpg'),
];

export const SHAPES: { id: ShapeId; label: string; icon: string }[] = [
  { id: 'none', label: 'Không', icon: '/photobooth/shapes/noneShape.png' },
  { id: 'soft', label: 'Bo góc', icon: '/photobooth/shapes/squareShape.png' },
  { id: 'circle', label: 'Tròn', icon: '/photobooth/shapes/circleShape.png' },
  { id: 'heart', label: 'Tim', icon: '/photobooth/shapes/heartShape.png' },
];

export type StickerBadge = 'new' | 'special';

export const STICKERS: { id: string; label: string; icon: string; badge?: StickerBadge }[] = [
  { id: 'none', label: 'Không', icon: '/photobooth/shapes/noneShape.png' },
  { id: 'bunny', label: 'Thỏ', icon: '/photobooth/stickers/bunny1.png' },
  { id: 'lucky', label: 'Lucky', icon: '/photobooth/stickers/lucky1.png', badge: 'new' },
  { id: 'kiss', label: 'Hôn', icon: '/photobooth/stickers/kiss1.png' },
  { id: 'sweet', label: 'Sweet', icon: '/photobooth/stickers/sweet1.png' },
  { id: 'ribbon', label: 'Nơ', icon: '/photobooth/stickers/ribbon1.png' },
  { id: 'sparkle', label: 'Lấp lánh', icon: '/photobooth/stickers/sparkle2.png' },
  { id: 'pearl', label: 'Ngọc', icon: '/photobooth/stickers/pearl2.png' },
  { id: 'soft', label: 'Soft', icon: '/photobooth/stickers/soft5.png' },
  { id: 'confetti', label: 'Hoa giấy', icon: '/photobooth/stickers/confetti/confetti.png' },
  { id: 'ribboncoquette', label: 'Nơ coquette', icon: '/photobooth/stickers/ribboncq4.png' },
  { id: 'blueribboncoquette', label: 'Nơ xanh', icon: '/photobooth/stickers/blueRibbon2.png' },
  { id: 'blackstar', label: 'Sao đen', icon: '/photobooth/stickers/blackStar5.png' },
  { id: 'yellowchicken', label: 'Gà con', icon: '/photobooth/stickers/yellowChicken1.png' },
  { id: 'brownbear', label: 'Gấu', icon: '/photobooth/stickers/brownyBear6.png' },
  { id: 'lotsheart', label: 'Tim 3D', icon: '/photobooth/stickers/lotsHeart8.png' },
  { id: 'tabbycat', label: 'Mèo', icon: '/photobooth/stickers/tabbyCat6.png' },
  { id: 'ballerinacp', label: 'Mèo trắng', icon: '/photobooth/stickers/ballerinaCappuccino/balerinaCappuccino3.png' },
  { id: 'doggywhite', label: 'Cún trắng', icon: '/photobooth/stickers/doggyWhite/doggyWhite1.png' },
  { id: 'sakurablossom', label: 'Sakura', icon: '/photobooth/stickers/sakuraBlossom/sakuraBlossom6.png' },
  { id: 'mygirls', label: 'Bạn gái', icon: '/photobooth/stickers/myGirls/myGirls12.png' },
  { id: 'classic', label: 'Cổ điển', icon: '/photobooth/stickers/classic1.png' },
  { id: 'classicB', label: 'Cổ điển trắng', icon: '/photobooth/stickers/classic4.png' },
  { id: 'birthday', label: 'Sinh nhật', icon: '/photobooth/stickers/happyBirthday/birthday1.png', badge: 'new' },
  { id: 'pinkdate', label: 'Bó hoa', icon: '/photobooth/stickers/pinkDate/pinkDate6.png', badge: 'new' },
  { id: 'strawberry', label: 'Dâu', icon: '/photobooth/stickers/strawberry/strawberry1.png', badge: 'new' },
  { id: 'peach', label: 'Đào', icon: '/photobooth/stickers/peach/peach.png', badge: 'new' },
  { id: 'miffy', label: 'Miffy', icon: '/photobooth/stickers/miffy/miffy1.png', badge: 'new' },
  { id: 'gumamela', label: 'Dâm bụt', icon: '/photobooth/stickers/gumamela/gumamela1.png', badge: 'new' },
  { id: 'koi', label: 'Koi', icon: '/photobooth/stickers/koi/koi5.png', badge: 'new' },
  { id: 'money', label: 'Tiền', icon: '/photobooth/stickers/money/money1.png', badge: 'new' },
  { id: 'swag', label: 'Swag', icon: '/photobooth/stickers/swag/swag4.png', badge: 'new' },
  { id: 'matcha', label: 'Matcha', icon: '/photobooth/stickers/matcha/matcha2.png', badge: 'new' },
  { id: 'vsangel', label: 'Angel', icon: '/photobooth/stickers/vsangel/angel1.png', badge: 'new' },
  { id: 'mario', label: 'Mario', icon: '/photobooth/stickers/mario/mario3.png', badge: 'new' },
  { id: 'gem1', label: 'Đá hồng', icon: '/photobooth/stickers/gem/gem1.png', badge: 'new' },
  { id: 'gem2', label: 'Đá xanh', icon: '/photobooth/stickers/gem/gem4.png', badge: 'new' },
  { id: 'holidays1', label: 'Lễ hội', icon: '/photobooth/stickers/holidays1/holidays12.png', badge: 'special' },
  { id: 'holidays2', label: 'Noel', icon: '/photobooth/stickers/holidays2/holidays22.png', badge: 'special' },
  { id: 'grinch', label: 'Grinch', icon: '/photobooth/stickers/grinch/grinch1.png', badge: 'special' },
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
  customFill?: string;
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  const hit = imageCache.get(src);
  if (hit) return hit;
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      imageCache.delete(src);
      reject(new Error('Không tải được ảnh'));
    };
    img.src = src;
  });
  imageCache.set(src, pending);
  return pending;
}

export async function applyPhotoAdjust(src: string, adj: PhotoAdjust): Promise<string> {
  const img = await loadImage(src);
  const rad = (adj.rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const rw = Math.max(1, Math.ceil(img.width * cos + img.height * sin));
  const rh = Math.max(1, Math.ceil(img.width * sin + img.height * cos));
  const rot = document.createElement('canvas');
  rot.width = rw;
  rot.height = rh;
  const rctx = rot.getContext('2d');
  if (!rctx) throw new Error('Canvas không khả dụng');
  rctx.translate(rw / 2, rh / 2);
  rctx.rotate(rad);
  rctx.drawImage(img, -img.width / 2, -img.height / 2);

  const sx = Math.max(0, adj.x * rw);
  const sy = Math.max(0, adj.y * rh);
  const sw = Math.max(1, Math.min(rw - sx, adj.w * rw));
  const sh = Math.max(1, Math.min(rh - sy, adj.h * rh));
  const out = document.createElement('canvas');
  out.width = Math.round(sw);
  out.height = Math.round(sh);
  const octx = out.getContext('2d');
  if (!octx) throw new Error('Canvas không khả dụng');
  octx.drawImage(rot, sx, sy, sw, sh, 0, 0, out.width, out.height);
  return out.toDataURL('image/jpeg', 0.92);
}

async function fillFrame(
  ctx: CanvasRenderingContext2D,
  frame: FrameDef,
  w: number,
  h: number,
  customFill?: string,
) {
  if (frame.id === 'custom') {
    ctx.fillStyle = customFill || frame.fill;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  if (frame.kind === 'image' && frame.src) {
    try {
      const img = await loadImage(frame.src);
      const scale = Math.max(w / img.width, h / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      return;
    } catch {
      /* fall through to solid */
    }
  }
  ctx.fillStyle = frame.fill;
  ctx.fillRect(0, 0, w, h);
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

async function drawStickers(ctx: CanvasRenderingContext2D, id: string, w: number, h: number) {
  if (!id || id === 'none') return;
  const pieces = (stickerLayouts as Record<string, { src: string; xr: number; yr: number; sr: number }[]>)[id];
  if (!pieces?.length) return;
  await Promise.all(pieces.map(async piece => {
    try {
      const img = await loadImage(`/photobooth/stickers/${piece.src}`);
      const size = piece.sr * w;
      ctx.drawImage(img, piece.xr * w, piece.yr * h, size, size);
    } catch {
      /* skip missing piece */
    }
  }));
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
  const frame = FRAMES.find(f => f.id === opts.frameId) ?? FRAMES[8];
  const m = stripMetrics(opts.layout);
  const canvas = document.createElement('canvas');
  canvas.width = m.width;
  canvas.height = m.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas không khả dụng');

  await fillFrame(ctx, frame, m.width, m.height, opts.customFill);
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
    if (opts.layout.theme === 'classic') {
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 8;
      ctx.strokeRect(x, y, m.photoW, m.photoH);
    }
  });

  await drawStickers(ctx, opts.stickerId, m.width, m.height);
  drawThemeFooter(ctx, opts.layout, m, opts.logo, opts.addDate, opts.addTime);
  return canvas;
}

export function captureVideoFrame(
  video: HTMLVideoElement,
  mirror: boolean,
  filter: string,
  maxWidth = 0,
  overlay?: HTMLCanvasElement | null,
): string {
  const srcW = video.videoWidth || 1280;
  const srcH = video.videoHeight || 960;
  const scale = maxWidth > 0 && srcW > maxWidth ? maxWidth / srcW : 1;
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);
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
  if (overlay && overlay.width && overlay.height) ctx.drawImage(overlay, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.92);
}

export const MOTION_FRAME_COUNT = 10;
export const MOTION_INTERVAL_MS = 90;
export const MOTION_MAX_WIDTH = 640;

export async function recordMotionFrames(
  video: HTMLVideoElement,
  mirror: boolean,
  filter: string,
  opts?: { count?: number; intervalMs?: number; maxWidth?: number; overlay?: HTMLCanvasElement | null },
): Promise<string[]> {
  const count = opts?.count ?? MOTION_FRAME_COUNT;
  const intervalMs = opts?.intervalMs ?? MOTION_INTERVAL_MS;
  const maxWidth = opts?.maxWidth ?? MOTION_MAX_WIDTH;
  const frames: string[] = [];
  for (let i = 0; i < count; i++) {
    const frame = captureVideoFrame(video, mirror, filter, maxWidth, opts?.overlay);
    if (frame) frames.push(frame);
    if (i < count - 1) await new Promise(r => setTimeout(r, intervalMs));
  }
  return frames;
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Không đọc được file'));
    reader.readAsDataURL(blob);
  });
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Không đọc được file'));
    reader.readAsDataURL(file);
  });
}

function medianCutPalette(frames: ImageData[], maxColors = 256, maxSamples = 16000): Uint8Array {
  const samples: { r: number; g: number; b: number }[] = [];
  const total = frames.reduce((n, f) => n + f.width * f.height, 0);
  const step = Math.max(1, Math.floor(total / maxSamples));
  let seen = 0;
  for (const frame of frames) {
    const d = frame.data;
    for (let i = 0; i < d.length; i += 4) {
      if (seen++ % step !== 0) continue;
      samples.push({ r: d[i], g: d[i + 1], b: d[i + 2] });
      if (samples.length >= maxSamples) break;
    }
    if (samples.length >= maxSamples) break;
  }
  if (!samples.length) samples.push({ r: 0, g: 0, b: 0 });

  const boxes = [samples];
  while (boxes.length < maxColors) {
    let best = -1;
    let bestRange = 0;
    let bestCh: 'r' | 'g' | 'b' = 'r';
    boxes.forEach((pixels, i) => {
      if (pixels.length < 2) return;
      let r0 = 255, r1 = 0, g0 = 255, g1 = 0, b0 = 255, b1 = 0;
      for (const p of pixels) {
        if (p.r < r0) r0 = p.r;
        if (p.r > r1) r1 = p.r;
        if (p.g < g0) g0 = p.g;
        if (p.g > g1) g1 = p.g;
        if (p.b < b0) b0 = p.b;
        if (p.b > b1) b1 = p.b;
      }
      const ranges = { r: r1 - r0, g: g1 - g0, b: b1 - b0 };
      const ch = ranges.r >= ranges.g && ranges.r >= ranges.b ? 'r' : ranges.g >= ranges.b ? 'g' : 'b';
      if (ranges[ch] > bestRange) {
        best = i;
        bestRange = ranges[ch];
        bestCh = ch;
      }
    });
    if (best < 0 || bestRange === 0) break;
    const pixels = boxes[best];
    pixels.sort((a, b) => a[bestCh] - b[bestCh]);
    const mid = pixels.length >> 1;
    boxes.splice(best, 1, pixels.slice(0, mid), pixels.slice(mid));
  }

  const pal = new Uint8Array(256 * 3);
  boxes.forEach((pixels, i) => {
    let r = 0, g = 0, b = 0;
    for (const p of pixels) {
      r += p.r;
      g += p.g;
      b += p.b;
    }
    const n = pixels.length || 1;
    pal[i * 3] = Math.round(r / n);
    pal[i * 3 + 1] = Math.round(g / n);
    pal[i * 3 + 2] = Math.round(b / n);
  });
  for (let i = boxes.length; i < 256; i++) {
    pal[i * 3] = pal[(boxes.length - 1) * 3];
    pal[i * 3 + 1] = pal[(boxes.length - 1) * 3 + 1];
    pal[i * 3 + 2] = pal[(boxes.length - 1) * 3 + 2];
  }
  return pal;
}

function nearestColorLut(pal: Uint8Array): Uint8Array {
  const lut = new Uint8Array(32 * 32 * 32);
  for (let r = 0; r < 32; r++) {
    for (let g = 0; g < 32; g++) {
      for (let b = 0; b < 32; b++) {
        const R = r * 8 + 4;
        const G = g * 8 + 4;
        const B = b * 8 + 4;
        let best = 0;
        let bestD = 1e9;
        for (let i = 0; i < 256; i++) {
          const dr = R - pal[i * 3];
          const dg = G - pal[i * 3 + 1];
          const db = B - pal[i * 3 + 2];
          const d = dr * dr + dg * dg + db * db;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
        lut[(r << 10) | (g << 5) | b] = best;
      }
    }
  }
  return lut;
}

function ditherIndex(data: Uint8ClampedArray, w: number, h: number, pal: Uint8Array, lut: Uint8Array): Uint8Array {
  const rgb = new Int16Array(w * h * 3);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 3) {
    rgb[p] = data[i];
    rgb[p + 1] = data[i + 1];
    rgb[p + 2] = data[i + 2];
  }
  const out = new Uint8Array(w * h);
  const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
  const spread = (x: number, y: number, er: number, eg: number, eb: number, f: number) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const j = (y * w + x) * 3;
    rgb[j] += er * f / 16;
    rgb[j + 1] += eg * f / 16;
    rgb[j + 2] += eb * f / 16;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      const r = clamp(rgb[i]);
      const g = clamp(rgb[i + 1]);
      const b = clamp(rgb[i + 2]);
      const idx = lut[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)];
      out[y * w + x] = idx;
      const er = r - pal[idx * 3];
      const eg = g - pal[idx * 3 + 1];
      const eb = b - pal[idx * 3 + 2];
      spread(x + 1, y, er, eg, eb, 7);
      spread(x - 1, y + 1, er, eg, eb, 3);
      spread(x, y + 1, er, eg, eb, 5);
      spread(x + 1, y + 1, er, eg, eb, 1);
    }
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

export async function encodeFramesGif(
  groups: string[][],
  opts?: { delayCs?: number; holdCs?: number; framed?: boolean },
): Promise<Blob> {
  const clips = groups.filter(g => g.length);
  if (!clips.length) throw new Error('Không có khung hình để tạo GIF');
  const framed = opts?.framed ?? false;
  const delayCs = opts?.delayCs ?? (framed ? 80 : 10);
  const holdCs = opts?.holdCs ?? (framed ? delayCs : 40);
  const images = await Promise.all(clips.map(clip => Promise.all(clip.map(loadImage))));

  const photoW = framed ? 540 : 640;
  const first = images[0][0];
  const photoH = framed ? 405 : Math.max(1, Math.round(photoW * (first.height / first.width)));
  const padX = framed ? 28 : 0;
  const padTop = framed ? 24 : 0;
  const footer = framed ? 80 : 0;
  const w = photoW + padX * 2;
  const h = padTop + photoH + footer;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas không khả dụng');

  const now = new Date();
  const stamp = `${now.toLocaleDateString('en-US')} ${now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })}`;

  const frames: ImageData[] = [];
  for (const clip of images) {
    for (const img of clip) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      drawCover(ctx, img, padX, padTop, photoW, photoH);
      if (framed) {
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 26px "Be Vietnam Pro", sans-serif';
        ctx.fillText('inanhxink', w / 2, padTop + photoH + 28);
        ctx.font = '500 14px "Be Vietnam Pro", sans-serif';
        ctx.fillText(stamp, w / 2, padTop + photoH + 54);
      }
      frames.push(ctx.getImageData(0, 0, w, h));
    }
  }

  const pal = medianCutPalette(frames);
  const lut = nearestColorLut(pal);
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

  let frameIndex = 0;
  for (const clip of images) {
    clip.forEach((_, i) => {
      const pixels = frames[frameIndex++];
      const index = ditherIndex(pixels.data, w, h, pal, lut);
      const lzw = lzwEncode(index);
      const blocks = packGifBlocks(lzw);
      push(0x21, 0xf9, 4, 0x04);
      push16(i === clip.length - 1 ? holdCs : delayCs);
      push(0, 0);
      push(0x2c, 0, 0, 0, 0);
      push16(w);
      push16(h);
      push(0, 8);
      for (let b = 0; b < blocks.length; b++) bytes.push(blocks[b]);
    });
  }
  push(0x3b);
  return new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
}

export async function encodePoseGif(photos: string[], delayCs = 80): Promise<Blob> {
  return encodeFramesGif(photos.map(src => [src]), { delayCs, framed: true });
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
