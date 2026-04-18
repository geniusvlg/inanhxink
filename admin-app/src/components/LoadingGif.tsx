import { useMemo } from 'react';

const gifModules = import.meta.glob<{ default: string }>(
  '../assets/loading-gifs/*.{gif,webp,png,jpg,jpeg,GIF,WEBP,PNG,JPG,JPEG}',
  { eager: true },
);

const GIF_URLS: string[] = Object.values(gifModules).map(m => m.default);

interface Props {
  size?: number;
  label?: string;
  /** Optional seed so re-renders pick the same gif within a session. */
  seed?: string | number;
}

export default function LoadingGif({ size = 72, label = 'Đang tải...', seed }: Props) {
  const gifUrl = useMemo(() => {
    if (GIF_URLS.length === 0) return null;
    if (seed !== undefined) {
      const s = String(seed);
      let hash = 0;
      for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
      return GIF_URLS[Math.abs(hash) % GIF_URLS.length];
    }
    return GIF_URLS[Math.floor(Math.random() * GIF_URLS.length)];
  }, [seed]);

  if (!gifUrl) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 4,
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          fontSize: '0.75rem',
          textAlign: 'center',
          padding: '0 0.25rem',
        }}
      >
        {label}
      </div>
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        background: '#f8fafc',
        position: 'relative',
      }}
      title={label}
      aria-label={label}
    >
      <img
        src={gifUrl}
        alt={label}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  );
}

export const hasLoadingGifs = GIF_URLS.length > 0;
