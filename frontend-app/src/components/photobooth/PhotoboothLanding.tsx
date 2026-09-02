import { useEffect, useState } from 'react';

interface PhotoboothLandingProps {
  onStart: () => void;
}

const ESTABLISHED = new Date('2025-02-09T00:00:00');

function elapsedParts(from: Date, now: Date) {
  let ms = Math.max(0, now.getTime() - from.getTime());
  const days = Math.floor(ms / 86_400_000);
  ms -= days * 86_400_000;
  const hours = Math.floor(ms / 3_600_000);
  ms -= hours * 3_600_000;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms - mins * 60_000) / 1000);
  return { days, hours, mins, secs };
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function PhotoStrip({ side }: { side: 'left' | 'right' }) {
  return (
    <img
      className={`pb-photo-strip pb-photo-strip--${side}`}
      src={`/photobooth/strip-${side}.svg`}
      alt=""
      aria-hidden
    />
  );
}

export default function PhotoboothLanding({ onStart }: PhotoboothLandingProps) {
  const [now, setNow] = useState(() => new Date());
  const [guide, setGuide] = useState(false);
  const t = elapsedParts(ESTABLISHED, now);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="pb-hero">
      <PhotoStrip side="left" />
      <PhotoStrip side="right" />

      <div className="pb-timer">
        <div className="pb-timer-star" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#fa1172" stroke="#fa1172" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="pb-timer-copy">
          <p className="pb-timer-label">Est. February 9, 2025</p>
          <div className="pb-timer-row">
            <span><strong>{t.days}</strong><em>days</em></span>
            <i>:</i>
            <span><strong>{pad(t.hours)}</strong><em>hours</em></span>
            <i>:</i>
            <span><strong>{pad(t.mins)}</strong><em>mins</em></span>
            <i>:</i>
            <span><strong>{pad(t.secs)}</strong><em>secs</em></span>
          </div>
        </div>
      </div>

      <div className="pb-heading">
        <div className="pb-hero-glow" />
        <h1 className="pb-hero-title">
          <span className="pb-hero-side">EST</span>
          <span className="pb-hero-name">inanhxink</span>
          <span className="pb-hero-side">2025</span>
        </h1>
        <p className="pb-hero-tag">
          Capture the moment, cherish the magic,<br />
          relive the love
        </p>
      </div>

      <div className="pb-cta-wrap">
        <button type="button" className="pb-cta" onClick={onStart}>
          START
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </button>
      </div>

      <button type="button" className="pb-help-fab" aria-label="Website guide" onClick={() => setGuide(true)}>
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.7" />
          <path d="M9.6 9.2c.35-1.15 1.35-1.85 2.55-1.85 1.4 0 2.45.9 2.45 2.2 0 1.15-.7 1.75-1.7 2.3-.9.5-1.2.85-1.2 1.55v.35" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="12" cy="16.6" r="1" fill="currentColor" />
        </svg>
      </button>

      {guide && (
        <div className="pb-modal" onClick={() => setGuide(false)}>
          <div className="pb-modal-card pb-modal-card--light" onClick={e => e.stopPropagation()}>
            <div className="pb-modal-head">
              <h2>Website Guide</h2>
              <button type="button" className="pb-text-btn" onClick={() => setGuide(false)}>close</button>
            </div>
            <ol className="pb-guide-list">
              <li>Choose a layout — that sets how many poses you take.</li>
              <li>Use the camera or upload photos, pick a filter, then press DONE.</li>
              <li>Customize the strip and download PNG or GIF.</li>
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}
