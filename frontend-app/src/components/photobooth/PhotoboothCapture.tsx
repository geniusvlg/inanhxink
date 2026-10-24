import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FILTERS,
  blobToDataUrl,
  captureVideoFrame,
  encodeFramesGif,
  fileToDataUrl,
  filterCss,
  recordMotionFrames,
  type PhotoboothLayout,
} from '../../utils/photobooth';
import { preloadHeartsAr, startHeartsAr } from '../../utils/photobooth-hearts-ar';

interface PhotoboothCaptureProps {
  layout: PhotoboothLayout;
  initialPhotos: string[];
  initialMotion?: string[][];
  initialGifs?: string[];
  onBack: () => void;
  onDone: (photos: string[], motionFrames: string[][]) => void;
}

export default function PhotoboothCapture({
  layout,
  initialPhotos,
  initialMotion = [],
  initialGifs = [],
  onBack,
  onDone,
}: PhotoboothCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const arCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const shootingRef = useRef(false);
  const [photos, setPhotos] = useState<string[]>(initialPhotos.slice(0, layout.poses));
  const [motionFrames, setMotionFrames] = useState<string[][]>(initialMotion.slice(0, layout.poses));
  const [gifs, setGifs] = useState<string[]>(initialGifs.slice(0, layout.poses));
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState('');
  const [timer, setTimer] = useState(3);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [filter, setFilter] = useState(layout.defaultFilter || 'normal');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterToast, setFilterToast] = useState('');
  const [mirror, setMirror] = useState(true);
  const [flash, setFlash] = useState(true);
  const [flashOn, setFlashOn] = useState(false);
  const [status, setStatus] = useState('Đang xin quyền camera…');
  const [arStatus, setArStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [videoLive, setVideoLive] = useState(false);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const motionRef = useRef(motionFrames);
  motionRef.current = motionFrames;
  const gifsRef = useRef(gifs);
  gifsRef.current = gifs;
  const mirrorRef = useRef(mirror);
  mirrorRef.current = mirror;
  const useHeartsAr = layout.theme === 'hearts';

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const startCamera = useCallback(async (deviceId?: string) => {
    stopStream();
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('Trình duyệt không hỗ trợ camera. Hãy tải ảnh lên.');
      return;
    }
    try {
      setStatus('Đang mở camera…');
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setVideoLive(true);
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      setCameras(devices.filter(d => d.kind === 'videoinput'));
      const used = stream.getVideoTracks()[0]?.getSettings().deviceId;
      if (used) setCameraId(used);
      setStatus('Nhấn BẮT ĐẦU hoặc phím Space để chụp');
    } catch {
      setStatus('Không mở được camera. Kiểm tra quyền truy cập hoặc tải ảnh lên.');
    }
  }, []);

  useEffect(() => {
    void startCamera();
    return () => stopStream();
  }, [startCamera]);

  useEffect(() => {
    if (!useHeartsAr) return;
    preloadHeartsAr();
    if (!videoLive) return;
    const video = videoRef.current;
    const canvas = arCanvasRef.current;
    if (!video || !canvas) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    void startHeartsAr({
      video,
      canvas,
      getMirror: () => mirrorRef.current,
      onStatus: text => {
        setArStatus(text);
        if (text === 'AR sẵn sàng') {
          window.setTimeout(() => setArStatus(prev => (prev === text ? '' : prev)), 2000);
        }
      },
    }).then(s => {
      if (cancelled) s();
      else stop = s;
    }).catch(() => {
      if (!cancelled) setArStatus('AR lỗi');
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [useHeartsAr, videoLive]);

  const snapOne = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;
    setStatus('Đang quay GIF…');
    if (flash) {
      setFlashOn(true);
      await new Promise(r => setTimeout(r, 80));
      setFlashOn(false);
    }
    const overlay = useHeartsAr ? arCanvasRef.current : null;
    const frames = await recordMotionFrames(video, mirror, filter, { overlay });
    const still = captureVideoFrame(video, mirror, filter, 0, overlay) || frames[Math.floor(frames.length / 2)] || '';
    if (!frames.length || !still) return null;
    const gif = await blobToDataUrl(await encodeFramesGif([frames]));
    return { still, frames, gif };
  }, [flash, mirror, filter, useHeartsAr]);

  const runCountdown = async () => {
    for (let n = timer; n > 0; n--) {
      setCountdown(n);
      await new Promise(r => setTimeout(r, 1000));
    }
    setCountdown(null);
  };

  const startShoot = async () => {
    if (shootingRef.current || busy) return;
    const remaining = layout.poses - photosRef.current.length;
    if (remaining <= 0) {
      setPhotos([]);
    }
    const toTake = remaining <= 0 ? layout.poses : remaining;
    if (!videoRef.current || videoRef.current.readyState < 2) {
      setStatus('Camera chưa sẵn sàng. Hãy tải ảnh hoặc thử lại.');
      return;
    }
    shootingRef.current = true;
    setBusy(true);
    const next = remaining <= 0 ? [] : [...photosRef.current];
    const nextMotion = remaining <= 0 ? [] : [...motionRef.current];
    const nextGifs = remaining <= 0 ? [] : [...gifsRef.current];
    if (remaining <= 0) {
      setMotionFrames([]);
      setGifs([]);
    }
    try {
      for (let i = 0; i < toTake; i++) {
        await runCountdown();
        const shot = await snapOne();
        if (shot) {
          next.push(shot.still);
          nextMotion.push(shot.frames);
          nextGifs.push(shot.gif);
        }
        setPhotos([...next]);
        setMotionFrames([...nextMotion]);
        setGifs([...nextGifs]);
        if (i < toTake - 1) await new Promise(r => setTimeout(r, 400));
      }
      if (next.length >= layout.poses) {
        setStatus('Đang mở trang trí…');
        stopStream();
        onDone(next, nextMotion);
        return;
      }
      setStatus('Tiếp tục chụp hoặc tải thêm ảnh');
    } finally {
      shootingRef.current = false;
      setBusy(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        void startShoot();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = layout.poses - photos.length;
    if (room <= 0) {
      if (!confirm('Đã đủ ảnh. Tải lên sẽ thay toàn bộ. Tiếp tục?')) return;
      setPhotos([]);
    }
    const slots = room <= 0 ? layout.poses : room;
    const picked = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, slots);
    const urls = await Promise.all(picked.map(fileToDataUrl));
    setPhotos(prev => {
      const base = prev.length >= layout.poses ? [] : prev;
      return [...base, ...urls].slice(0, layout.poses);
    });
    setMotionFrames(prev => {
      const base = photos.length >= layout.poses ? [] : prev;
      return [...base, ...urls.map(src => [src])].slice(0, layout.poses);
    });
    setGifs(prev => {
      const base = photos.length >= layout.poses ? [] : prev;
      return [...base, ...urls].slice(0, layout.poses);
    });
  };

  const pickFilter = (id: string) => {
    setFilter(id);
    const label = FILTERS.find(f => f.id === id)?.label ?? id;
    setFilterToast(label);
    window.setTimeout(() => setFilterToast(prev => (prev === label ? '' : prev)), 1000);
  };

  const full = photos.length >= layout.poses;

  return (
    <section className="pb-capture">
      <div className="pb-capture-top">
        <button type="button" className="pb-text-btn" onClick={onBack}>← Mẫu</button>
        <p className="pb-counter">{photos.length}/{layout.poses}</p>
        <div className="pb-capture-tools">
          <select
            className="pb-select"
            value={cameraId}
            onChange={e => {
              setCameraId(e.target.value);
              void startCamera(e.target.value);
            }}
            aria-label="Chọn camera"
          >
            {cameras.length === 0 && <option value="">Đang tìm camera…</option>}
            {cameras.map((c, i) => (
              <option key={c.deviceId || i} value={c.deviceId}>{c.label || `Camera ${i + 1}`}</option>
            ))}
          </select>
          <label className="pb-upload-btn">
            Tải ảnh
            <input type="file" accept="image/*" multiple hidden onChange={e => void onUpload(e.target.files)} />
          </label>
          <select className="pb-select" value={timer} onChange={e => setTimer(Number(e.target.value))} aria-label="Hẹn giờ">
            <option value={3}>3s</option>
            <option value={5}>5s</option>
            <option value={10}>10s</option>
          </select>
        </div>
      </div>

      <div className="pb-capture-stage">
        <div className="pb-viewfinder">
          <video
            ref={videoRef}
            className="pb-video"
            playsInline
            muted
            style={{
              transform: mirror ? 'scaleX(-1)' : 'none',
              filter: filterCss(filter),
            }}
          />
          {useHeartsAr && <canvas ref={arCanvasRef} className="pb-ar-canvas" />}
          {useHeartsAr && arStatus && <p className="pb-ar-status">{arStatus}</p>}
          {flashOn && <div className="pb-flash" />}
          {countdown !== null && <div className="pb-countdown">{countdown}</div>}
          {filterToast && <p className="pb-filter-toast">{filterToast}</p>}
          <p className="pb-status">{status}</p>
        </div>
        <div className="pb-thumbs" aria-label="Ảnh đã chụp">
          {Array.from({ length: layout.poses }, (_, i) => (
            photos[i]
              ? <img key={i} src={gifs[i] || photos[i]} alt={`Ảnh ${i + 1}`} />
              : <span key={i} className="pb-thumb-slot" />
          ))}
        </div>
      </div>

      <div className="pb-filter-bar">
        <div className="pb-filter-orbs">
          {FILTERS.filter(f => f.toolbar).map(f => (
            <button
              key={f.id}
              type="button"
              title={f.label}
              aria-label={f.label}
              className={`pb-filter-orb${filter === f.id ? ' active' : ''}`}
              onClick={() => pickFilter(f.id)}
            >
              <span className="pb-filter-orb-img" style={f.icon ? { backgroundImage: `url(${f.icon})` } : undefined} />
            </button>
          ))}
          <button type="button" className="pb-filter-more" aria-label="Thêm filter" onClick={() => setFilterOpen(true)}>
            <span /><span /><span />
          </button>
        </div>
      </div>

      <div className="pb-capture-actions">
        <button type="button" className={`pb-chip${mirror ? ' active' : ''}`} onClick={() => setMirror(v => !v)}>
          Gương: {mirror ? 'Bật' : 'Tắt'}
        </button>
        <button type="button" className="pb-start-btn pb-start-btn--sm" onClick={() => void startShoot()} disabled={busy}>
          {full ? 'Chụp lại' : 'BẮT ĐẦU'}
        </button>
        <button type="button" className={`pb-chip${flash ? ' active' : ''}`} onClick={() => setFlash(v => !v)}>
          Đèn flash: {flash ? 'Bật' : 'Tắt'}
        </button>
        {full && (
          <button type="button" className="pb-done-btn" onClick={() => onDone(photos, motionFrames)}>XONG</button>
        )}
      </div>

      {filterOpen && (
        <div className="pb-filter-popup-scrim" onClick={() => setFilterOpen(false)}>
          <div className="pb-filter-popup" onClick={e => e.stopPropagation()}>
            <button type="button" className="pb-filter-popup-close" aria-label="Đóng" onClick={() => setFilterOpen(false)}>×</button>
            <h2 className="pb-filter-popup-title">Chọn filter</h2>
            <div className="pb-filter-popup-body">
              <div className="pb-filter-grid">
                {FILTERS.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    className={`pb-filter-option${filter === f.id ? ' active' : ''}`}
                    onClick={() => {
                      pickFilter(f.id);
                      setFilterOpen(false);
                    }}
                  >
                    <span className="pb-filter-preview" style={{ background: f.preview }} />
                    <span className="pb-filter-label">{f.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
