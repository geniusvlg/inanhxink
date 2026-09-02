import { useEffect, useState } from 'react';
import {
  FRAMES,
  LOGOS,
  SHAPES,
  STICKERS,
  canvasToBlob,
  downloadBlob,
  encodePoseGif,
  renderPhotoStrip,
  type LogoId,
  type PhotoboothLayout,
  type ShapeId,
} from '../../utils/photobooth';

interface PhotoboothCustomizeProps {
  layout: PhotoboothLayout;
  photos: string[];
  onRetake: () => void;
}

export default function PhotoboothCustomize({ layout, photos, onRetake }: PhotoboothCustomizeProps) {
  const [frameId, setFrameId] = useState(layout.defaultFrame);
  const [shape, setShape] = useState<ShapeId>(layout.defaultShape);
  const [stickerId, setStickerId] = useState(layout.defaultSticker);
  const [logo, setLogo] = useState<LogoId>(layout.defaultLogo);
  const [addDate, setAddDate] = useState(false);
  const [addTime, setAddTime] = useState(false);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    let cancelled = false;
    setBusy('Đang ghép ảnh…');
    renderPhotoStrip({ photos, layout, frameId, shape, stickerId, logo, addDate, addTime })
      .then(canvas => {
        if (!cancelled) setPreview(canvas.toDataURL('image/png'));
      })
      .catch(() => {
        if (!cancelled) setPreview('');
      })
      .finally(() => {
        if (!cancelled) setBusy('');
      });
    return () => {
      cancelled = true;
    };
  }, [photos, layout, frameId, shape, stickerId, logo, addDate, addTime]);

  const buildCanvas = () =>
    renderPhotoStrip({ photos, layout, frameId, shape, stickerId, logo, addDate, addTime });

  const onDownload = async () => {
    setBusy('Đang tải…');
    try {
      const canvas = await buildCanvas();
      const blob = await canvasToBlob(canvas);
      downloadBlob(blob, `photobooth-${layout.id}.png`);
    } finally {
      setBusy('');
    }
  };

  const onGif = async () => {
    setBusy('Đang tạo GIF…');
    try {
      const blob = await encodePoseGif(photos);
      downloadBlob(blob, `photobooth-${layout.id}.gif`);
    } finally {
      setBusy('');
    }
  };

  const onPrint = async () => {
    const canvas = await buildCanvas();
    const url = canvas.toDataURL('image/png');
    const win = window.open('', '_blank');
    if (!win) return;
    const img = win.document.createElement('img');
    img.src = url;
    img.style.maxWidth = '100%';
    win.document.body.appendChild(img);
    img.onload = () => win.print();
  };

  const onShare = async () => {
    const canvas = await buildCanvas();
    const blob = await canvasToBlob(canvas);
    const file = new File([blob], `photobooth-${layout.id}.png`, { type: 'image/png' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Photobooth Inanhxink' });
      return;
    }
    downloadBlob(blob, `photobooth-${layout.id}.png`);
  };

  return (
    <section className="pb-customize">
      <h1 className="pb-section-title">Trang trí photo strip</h1>
      <div className="pb-customize-grid">
        <div className="pb-preview-wrap">
          {preview ? <img className="pb-preview" src={preview} alt="Photo strip" /> : <p className="pb-status">{busy || 'Đang tải…'}</p>}
        </div>
        <div className="pb-customize-panel">
          <h3>Màu khung</h3>
          <div className="pb-swatches">
            {FRAMES.map(f => (
              <button
                key={f.id}
                type="button"
                title={f.label}
                className={`pb-swatch${frameId === f.id ? ' active' : ''}`}
                style={{ background: f.fill }}
                onClick={() => setFrameId(f.id)}
              />
            ))}
          </div>

          <h3>Hình ảnh</h3>
          <div className="pb-choice-row">
            {SHAPES.map(s => (
              <button
                key={s.id}
                type="button"
                className={`pb-chip${shape === s.id ? ' active' : ''}`}
                onClick={() => setShape(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <h3>Sticker</h3>
          <div className="pb-choice-row">
            {STICKERS.map(s => (
              <button
                key={s.id}
                type="button"
                className={`pb-chip${stickerId === s.id ? ' active' : ''}`}
                onClick={() => setStickerId(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <h3>Logo</h3>
          <div className="pb-choice-row">
            {LOGOS.map(l => (
              <button
                key={l.id}
                type="button"
                className={`pb-chip${logo === l.id ? ' active' : ''}`}
                onClick={() => setLogo(l.id)}
              >
                {l.label}
              </button>
            ))}
          </div>

          <label className="pb-check">
            <input type="checkbox" checked={addDate} onChange={e => setAddDate(e.target.checked)} />
            Thêm ngày
          </label>
          <label className="pb-check">
            <input type="checkbox" checked={addTime} onChange={e => setAddTime(e.target.checked)} />
            Thêm giờ
          </label>

          <div className="pb-customize-actions">
            <button type="button" className="pb-chip" onClick={onRetake}>Retake</button>
            <button type="button" className="pb-chip" onClick={() => void onPrint()}>In</button>
            <button type="button" className="pb-chip" onClick={() => void onShare()}>Chia sẻ</button>
            <button type="button" className="pb-done-btn" onClick={() => void onDownload()} disabled={!!busy}>Tải PNG</button>
            <button type="button" className="pb-done-btn" onClick={() => void onGif()} disabled={!!busy}>Tải GIF</button>
          </div>
          {busy && <p className="pb-status">{busy}</p>}
        </div>
      </div>
    </section>
  );
}
