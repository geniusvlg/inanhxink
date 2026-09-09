import { useEffect, useState } from 'react';
import {
  FRAMES,
  LOGOS,
  SHAPES,
  STICKERS,
  canvasToBlob,
  downloadBlob,
  encodeFramesGif,
  renderPhotoStrip,
  type LogoId,
  type PhotoboothLayout,
  type ShapeId,
} from '../../utils/photobooth';

interface PhotoboothCustomizeProps {
  layout: PhotoboothLayout;
  photos: string[];
  motionFrames?: string[][];
  onRetake: () => void;
}

export default function PhotoboothCustomize({ layout, photos, onRetake }: PhotoboothCustomizeProps) {
  const [frameId, setFrameId] = useState(layout.defaultFrame);
  const [customFill, setCustomFill] = useState('#ffffff');
  const [shape, setShape] = useState<ShapeId>(layout.defaultShape);
  const [stickerId, setStickerId] = useState(layout.defaultSticker);
  const [logo, setLogo] = useState<LogoId>(layout.defaultLogo);
  const [addDate, setAddDate] = useState(false);
  const [addTime, setAddTime] = useState(false);
  const [preview, setPreview] = useState('');
  const [gifUrl, setGifUrl] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    let cancelled = false;
    setBusy('Đang ghép ảnh…');
    renderPhotoStrip({ photos, layout, frameId, shape, stickerId, logo, addDate, addTime, customFill })
      .then(canvas => {
        if (!cancelled) setPreview(canvas.toDataURL('image/png'));
      })
      .catch(err => {
        if (!cancelled) {
          setPreview('');
          setBusy(err instanceof Error ? err.message : 'Không ghép được ảnh');
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(prev => (prev === 'Đang ghép ảnh…' ? '' : prev));
      });
    return () => {
      cancelled = true;
    };
  }, [photos, layout, frameId, shape, stickerId, logo, addDate, addTime, customFill]);

  useEffect(() => {
    let url = '';
    let cancelled = false;
    if (!photos.length) {
      setGifUrl('');
      return;
    }
    encodeFramesGif([photos], { delayCs: 80 })
      .then(blob => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setGifUrl(url);
      })
      .catch(() => {
        if (!cancelled) setGifUrl('');
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [photos]);

  const buildCanvas = () =>
    renderPhotoStrip({ photos, layout, frameId, shape, stickerId, logo, addDate, addTime, customFill });

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
      const blob = await encodeFramesGif([photos], { delayCs: 80 });
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
      <div className="pb-custom-main">
        <div className="pb-preview-wrap">
          {preview ? <img className="pb-preview" src={preview} alt="Dải ảnh" /> : <p className="pb-status">{busy || 'Đang tải…'}</p>}
        </div>
        <div className="pb-customize-panel">
          <h1 className="pb-custom-heading">trang trí ảnh</h1>

          <h3 className="pb-options-label">Màu khung</h3>
          <div className="pb-swatches">
            {FRAMES.map(f => {
              const active = frameId === f.id;
              if (f.id === 'custom') {
                return (
                  <label
                    key={f.id}
                    title={f.label}
                    className={`pb-swatch pb-swatch--picker${active ? ' active' : ''}`}
                  >
                    <input
                      type="color"
                      value={customFill}
                      aria-label={f.label}
                      onChange={e => {
                        setCustomFill(e.target.value);
                        setFrameId('custom');
                      }}
                      onClick={() => setFrameId('custom')}
                    />
                  </label>
                );
              }
              return (
                <button
                  key={f.id}
                  type="button"
                  title={f.label}
                  className={`pb-swatch${f.id === 'white' ? ' pb-swatch--white' : ''}${active ? ' active' : ''}`}
                  style={f.src ? { backgroundImage: `url(${f.src})` } : { backgroundColor: f.fill }}
                  onClick={() => setFrameId(f.id)}
                />
              );
            })}
          </div>

          <h3 className="pb-options-label">Hình ảnh</h3>
          <div className="pb-icon-row">
            {SHAPES.map(s => (
              <button
                key={s.id}
                type="button"
                title={s.label}
                className={`pb-icon-btn${shape === s.id ? ' active' : ''}`}
                onClick={() => setShape(s.id)}
              >
                <img src={s.icon} alt="" />
              </button>
            ))}
          </div>

          <h3 className="pb-options-label">Hình dán</h3>
          <div className="pb-sticker-block">
            <div className="pb-icon-row">
              {STICKERS.map(s => (
                <button
                  key={s.id}
                  type="button"
                  title={s.label}
                  className={`pb-icon-btn${s.badge ? ` pb-icon-btn--${s.badge}` : ''}${stickerId === s.id ? ' active' : ''}`}
                  onClick={() => setStickerId(s.id)}
                >
                  <img src={s.icon} alt="" />
                </button>
              ))}
            </div>
            <div className="pb-gif-preview">
              {gifUrl
                ? <img src={gifUrl} alt="GIF tất cả ảnh" />
                : <p className="pb-status">Đang tạo GIF…</p>}
              <p>GIF</p>
            </div>
          </div>

          <h3 className="pb-options-label">Logo</h3>
          <div className="pb-logo-row">
            {LOGOS.map(l => (
              <button
                key={l.id}
                type="button"
                className={`pb-logo-btn${logo === l.id ? ' active' : ''}`}
                onClick={() => setLogo(l.id)}
              >
                {l.label}
              </button>
            ))}
          </div>

          <div className="pb-check-row">
            <label className="pb-check">
              <input type="checkbox" checked={addDate} onChange={e => setAddDate(e.target.checked)} />
              Thêm ngày
            </label>
            <label className="pb-check">
              <input type="checkbox" checked={addTime} onChange={e => setAddTime(e.target.checked)} />
              Thêm giờ
            </label>
          </div>

          <div className="pb-customize-actions">
            <button type="button" className="pb-custom-btn" onClick={onRetake}>Chụp lại</button>
            <button type="button" className="pb-custom-btn" onClick={() => void onPrint()}>In</button>
            <button type="button" className="pb-custom-btn" onClick={() => void onShare()}>Chia sẻ</button>
            <button type="button" className="pb-custom-btn" onClick={() => void onDownload()} disabled={!!busy}>Tải về</button>
            <button type="button" className="pb-custom-btn" onClick={() => void onGif()} disabled={!!busy}>Tải GIF</button>
          </div>
          {busy && <p className="pb-status">{busy}</p>}
        </div>
      </div>
    </section>
  );
}
