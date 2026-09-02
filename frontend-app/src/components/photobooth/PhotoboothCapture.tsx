import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FILTERS,
  captureVideoFrame,
  fileToDataUrl,
  filterCss,
  type PhotoboothLayout,
} from '../../utils/photobooth';

interface PhotoboothCaptureProps {
  layout: PhotoboothLayout;
  initialPhotos: string[];
  onBack: () => void;
  onDone: (photos: string[]) => void;
}

export default function PhotoboothCapture({ layout, initialPhotos, onBack, onDone }: PhotoboothCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const shootingRef = useRef(false);
  const [photos, setPhotos] = useState<string[]>(initialPhotos.slice(0, layout.poses));
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState('');
  const [timer, setTimer] = useState(3);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [filter, setFilter] = useState(layout.defaultFilter);
  const [filterOpen, setFilterOpen] = useState(false);
  const [mirror, setMirror] = useState(false);
  const [flash, setFlash] = useState(true);
  const [flashOn, setFlashOn] = useState(false);
  const [status, setStatus] = useState('Đang xin quyền camera…');
  const [busy, setBusy] = useState(false);
  const photosRef = useRef(photos);
  photosRef.current = photos;

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
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      setCameras(devices.filter(d => d.kind === 'videoinput'));
      const used = stream.getVideoTracks()[0]?.getSettings().deviceId;
      if (used) setCameraId(used);
      setStatus('Nhấn START hoặc phím Space để chụp');
    } catch {
      setStatus('Không mở được camera. Kiểm tra quyền truy cập hoặc tải ảnh lên.');
    }
  }, []);

  useEffect(() => {
    void startCamera();
    return () => stopStream();
  }, [startCamera]);

  const snapOne = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return '';
    if (flash) {
      setFlashOn(true);
      await new Promise(r => setTimeout(r, 90));
    }
    const data = captureVideoFrame(video, mirror, filter, layout.theme);
    setFlashOn(false);
    return data;
  }, [flash, mirror, filter, layout.theme]);

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
    try {
      for (let i = 0; i < toTake; i++) {
        await runCountdown();
        const shot = await snapOne();
        if (shot) next.push(shot);
        setPhotos([...next]);
        if (i < toTake - 1) await new Promise(r => setTimeout(r, 400));
      }
      setStatus(next.length >= layout.poses ? 'Xong rồi — nhấn DONE để trang trí' : 'Tiếp tục chụp hoặc tải thêm ảnh');
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
  };

  const full = photos.length >= layout.poses;

  return (
    <section className="pb-capture">
      <div className="pb-capture-top">
        <button type="button" className="pb-text-btn" onClick={onBack}>← Layout</button>
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
        {(layout.theme === 'hearts' || layout.theme === 'dog') && (
          <div className={`pb-live-overlay pb-live-overlay--${layout.theme}`} aria-hidden />
        )}
        {flashOn && <div className="pb-flash" />}
        {countdown !== null && <div className="pb-countdown">{countdown}</div>}
        <p className="pb-status">{status}</p>
        <div className="pb-thumbs">
          {photos.map((src, i) => <img key={i} src={src} alt="" />)}
        </div>
      </div>

      <div className="pb-filters">
        {FILTERS.filter(f => f.toolbar).map(f => (
          <button
            key={f.id}
            type="button"
            className={`pb-filter${filter === f.id ? ' active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
        <button type="button" className="pb-filter" onClick={() => setFilterOpen(true)}>Thêm</button>
      </div>

      <div className="pb-capture-actions">
        <button type="button" className={`pb-chip${mirror ? ' active' : ''}`} onClick={() => setMirror(v => !v)}>
          Mirror: {mirror ? 'On' : 'Off'}
        </button>
        <button type="button" className="pb-start-btn pb-start-btn--sm" onClick={() => void startShoot()} disabled={busy}>
          {full ? 'Retake' : 'START'}
        </button>
        <button type="button" className={`pb-chip${flash ? ' active' : ''}`} onClick={() => setFlash(v => !v)}>
          Flash: {flash ? 'On' : 'Off'}
        </button>
        {full && (
          <button type="button" className="pb-done-btn" onClick={() => onDone(photos)}>DONE</button>
        )}
      </div>

      {filterOpen && (
        <div className="pb-modal" onClick={() => setFilterOpen(false)}>
          <div className="pb-modal-card" onClick={e => e.stopPropagation()}>
            <div className="pb-modal-head">
              <h2>Chọn filter</h2>
              <button type="button" className="pb-text-btn" onClick={() => setFilterOpen(false)}>Đóng</button>
            </div>
            <div className="pb-filter-grid">
              {FILTERS.map(f => (
                <button
                  key={f.id}
                  type="button"
                  className={`pb-filter-tile${filter === f.id ? ' active' : ''}`}
                  onClick={() => {
                    setFilter(f.id);
                    setFilterOpen(false);
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
