import { useEffect, useRef, useState } from 'react';
import {
  CROP_ASPECTS,
  applyPhotoAdjust,
  defaultPhotoAdjust,
  fitAdjustToAspect,
  type CropAspect,
  type PhotoAdjust,
} from '../../utils/photobooth';

type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface PhotoboothCropReviewProps {
  photos: string[];
  onCancel: () => void;
  onConfirm: (photos: string[]) => void;
}

const HANDLE_HIT = 14;
const MIN_NORM = 0.08;

export default function PhotoboothCropReview({ photos, onCancel, onConfirm }: PhotoboothCropReviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ handle: Handle; startX: number; startY: number; start: PhotoAdjust } | null>(null);
  const [index, setIndex] = useState(0);
  const [adjusts, setAdjusts] = useState<PhotoAdjust[]>(() => photos.map(() => defaultPhotoAdjust()));
  const [busy, setBusy] = useState('');
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [, setTick] = useState(0);

  const adj = adjusts[index] ?? defaultPhotoAdjust();

  useEffect(() => {
    const src = photos[index];
    if (!src) return;
    const image = new Image();
    image.onload = () => setImg(image);
    image.src = src;
  }, [photos, index]);

  useEffect(() => {
    const onResize = () => setTick(n => n + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * devicePixelRatio;
    canvas.height = h * devicePixelRatio;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, w, h);

    const rad = (adj.rotation * Math.PI) / 180;
    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));
    const bbw = img.width * cos + img.height * sin;
    const bbh = img.width * sin + img.height * cos;
    const scale = Math.min((w * 0.92) / bbw, (h * 0.92) / bbh);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(rad);
    ctx.drawImage(img, -img.width * scale / 2, -img.height * scale / 2, img.width * scale, img.height * scale);
    ctx.restore();

    const boxW = bbw * scale;
    const boxH = bbh * scale;
    const boxX = (w - boxW) / 2;
    const boxY = (h - boxH) / 2;
    const cx = boxX + adj.x * boxW;
    const cy = boxY + adj.y * boxH;
    const cw = adj.w * boxW;
    const ch = adj.h * boxH;

    ctx.fillStyle = 'rgba(20, 16, 18, 0.45)';
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.rect(cx, cy, cw, ch);
    ctx.fill('evenodd');

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx, cy, cw, ch);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + (cw * i) / 3, cy);
      ctx.lineTo(cx + (cw * i) / 3, cy + ch);
      ctx.moveTo(cx, cy + (ch * i) / 3);
      ctx.lineTo(cx + cw, cy + (ch * i) / 3);
      ctx.stroke();
    }

    ctx.fillStyle = '#fff';
    handlePoints(cx, cy, cw, ch).forEach(([hx, hy]) => {
      ctx.fillRect(hx - 5, hy - 5, 10, 10);
      ctx.strokeStyle = '#f26a8d';
      ctx.strokeRect(hx - 5, hy - 5, 10, 10);
    });
  }, [img, adj]);

  const setAdj = (next: PhotoAdjust | ((prev: PhotoAdjust) => PhotoAdjust)) => {
    setAdjusts(prev => prev.map((item, i) => {
      if (i !== index) return item;
      return typeof next === 'function' ? next(item) : next;
    }));
  };

  const hitHandle = (px: number, py: number): Handle | null => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return null;
    const rect = canvas.getBoundingClientRect();
    const box = imageBox(canvas, img, adj.rotation);
    const cx = box.x + adj.x * box.w;
    const cy = box.y + adj.y * box.h;
    const cw = adj.w * box.w;
    const ch = adj.h * box.h;
    const x = px - rect.left;
    const y = py - rect.top;
    const named: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    const pts = handlePoints(cx, cy, cw, ch);
    const found = named.find((name, i) => Math.abs(pts[i][0] - x) <= HANDLE_HIT && Math.abs(pts[i][1] - y) <= HANDLE_HIT);
    if (found) return found;
    if (x >= cx && x <= cx + cw && y >= cy && y <= cy + ch) return 'move';
    return null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const handle = hitHandle(e.clientX, e.clientY);
    if (!handle) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { handle, startX: e.clientX, startY: e.clientY, start: { ...adj } };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || !canvas || !img) {
      canvasRef.current && (canvasRef.current.style.cursor = hitHandle(e.clientX, e.clientY) ? 'move' : 'default');
      return;
    }
    const box = imageBox(canvas, img, drag.start.rotation);
    const dx = (e.clientX - drag.startX) / box.w;
    const dy = (e.clientY - drag.startY) / box.h;
    setAdj(resizeAdjust(drag.start, drag.handle, dx, dy));
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const pickAspect = (aspect: CropAspect) => {
    setAdj(fitAdjustToAspect({ ...adj, aspect }));
  };

  const confirm = async () => {
    setBusy('Đang cắt ảnh…');
    try {
      const next = await Promise.all(photos.map((src, i) => applyPhotoAdjust(src, adjusts[i] ?? defaultPhotoAdjust())));
      onConfirm(next);
    } catch {
      setBusy('Không cắt được ảnh');
    }
  };

  return (
    <section className="pb-crop">
      <header className="pb-crop-head">
        <div>
          <p className="pb-crop-kicker">Xem lại cắt</p>
          <h1>Xem và chỉnh ảnh</h1>
        </div>
        <button type="button" className="pb-crop-close" aria-label="Đóng" onClick={onCancel}>×</button>
      </header>

      <div className="pb-crop-body">
        <aside className="pb-crop-thumbs">
          {photos.map((src, i) => (
            <button
              key={i}
              type="button"
              className={`pb-crop-thumb${i === index ? ' active' : ''}`}
              onClick={() => setIndex(i)}
            >
              <img src={src} alt="" />
              <span>{i + 1}</span>
            </button>
          ))}
          <div className="pb-crop-hint">
            <p className="pb-crop-hint-kicker">Chọn <em>Sẵn sàng</em></p>
            <p>Kéo khung để dịch. Giữ góc hoặc cạnh để đổi kích thước. Tự do để cắt không khóa tỉ lệ. Dùng Trước / Sau để xem hết ảnh.</p>
          </div>
        </aside>

        <div className="pb-crop-stage-col">
          <canvas
            ref={canvasRef}
            className="pb-crop-stage"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
          <div className="pb-crop-ratios">
            {CROP_ASPECTS.map(a => (
              <button
                key={a.id}
                type="button"
                className={`pb-crop-pill${adj.aspect === a.id ? ' active' : ''}`}
                onClick={() => pickAspect(a.id)}
              >
                {a.label}
              </button>
            ))}
            <button type="button" className="pb-crop-pill" disabled={index === 0} onClick={() => setIndex(i => i - 1)}>Trước</button>
            <button type="button" className="pb-crop-pill" disabled={index >= photos.length - 1} onClick={() => setIndex(i => i + 1)}>Sau</button>
          </div>

          <div className="pb-crop-rotate">
            <p>Xoay</p>
            <input
              type="range"
              min={-45}
              max={45}
              step={1}
              value={adj.rotation}
              aria-label="Góc xoay"
              onChange={e => setAdj({ ...adj, rotation: Number(e.target.value) })}
            />
            <strong>{adj.rotation}°</strong>
            <button type="button" className="pb-crop-pill" onClick={() => setAdj({ ...adj, rotation: clampRot(adj.rotation - 15) })}>-15°</button>
            <button type="button" className="pb-crop-pill" onClick={() => setAdj({ ...adj, rotation: 0 })}>Đặt lại</button>
            <button type="button" className="pb-crop-pill" onClick={() => setAdj({ ...adj, rotation: clampRot(adj.rotation + 15) })}>+15°</button>
          </div>
        </div>
      </div>

      <footer className="pb-crop-foot">
        <button type="button" className="pb-crop-ghost" onClick={() => setAdj(defaultPhotoAdjust())}>Đặt lại</button>
        <div className="pb-crop-foot-right">
          <button type="button" className="pb-crop-ghost" onClick={onCancel}>Hủy</button>
          <button type="button" className="pb-crop-confirm" onClick={() => void confirm()} disabled={!!busy}>
            {busy || 'Xong cắt'}
          </button>
        </div>
      </footer>
    </section>
  );
}

function clampRot(n: number) {
  return Math.max(-45, Math.min(45, n));
}

function handlePoints(x: number, y: number, w: number, h: number): [number, number][] {
  return [
    [x, y], [x + w / 2, y], [x + w, y],
    [x + w, y + h / 2],
    [x + w, y + h], [x + w / 2, y + h], [x, y + h],
    [x, y + h / 2],
  ];
}

function imageBox(canvas: HTMLCanvasElement, img: HTMLImageElement, rotation: number) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const rad = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const bbw = img.width * cos + img.height * sin;
  const bbh = img.width * sin + img.height * cos;
  const scale = Math.min((w * 0.92) / bbw, (h * 0.92) / bbh);
  const boxW = bbw * scale;
  const boxH = bbh * scale;
  return { x: (w - boxW) / 2, y: (h - boxH) / 2, w: boxW, h: boxH };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function resizeAdjust(start: PhotoAdjust, handle: Handle, dx: number, dy: number): PhotoAdjust {
  let { x, y, w, h, aspect } = start;
  const ratio = CROP_ASPECTS.find(a => a.id === aspect)?.ratio ?? null;

  if (handle === 'move') {
    x = clamp(start.x + dx, 0, 1 - start.w);
    y = clamp(start.y + dy, 0, 1 - start.h);
    return { ...start, x, y };
  }

  const right = start.x + start.w;
  const bottom = start.y + start.h;
  if (handle.includes('w')) x = clamp(start.x + dx, 0, right - MIN_NORM);
  if (handle.includes('e')) {
    const nextRight = clamp(right + dx, start.x + MIN_NORM, 1);
    w = nextRight - x;
  } else {
    w = right - x;
  }
  if (handle.includes('n')) y = clamp(start.y + dy, 0, bottom - MIN_NORM);
  if (handle.includes('s')) {
    const nextBottom = clamp(bottom + dy, start.y + MIN_NORM, 1);
    h = nextBottom - y;
  } else {
    h = bottom - y;
  }

  if (ratio) {
    if (handle === 'n' || handle === 's') {
      w = clamp(h * ratio, MIN_NORM, 1);
      x = clamp(start.x + (start.w - w) / 2, 0, 1 - w);
    } else {
      h = clamp(w / ratio, MIN_NORM, 1);
      y = clamp(start.y + (start.h - h) / 2, 0, 1 - h);
    }
  }

  w = clamp(w, MIN_NORM, 1 - x);
  h = clamp(h, MIN_NORM, 1 - y);
  return { ...start, x, y, w, h };
}
