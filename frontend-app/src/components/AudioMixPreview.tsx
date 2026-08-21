import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import './AudioMixPreview.css';

interface AudioMixPreviewProps {
  musicUrl: string;
  voiceFile: File | null;
  volume: number;
  onVolumeChange: (volume: number) => void;
  resetToken?: number;
  playLocked?: boolean;
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

function VolumeSlider({
  value,
  labelledBy,
  onChange,
}: {
  value: number;
  labelledBy: string;
  onChange: (volume: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const percent = Math.round(clampVolume(value) * 100);

  const setFromClientX = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    onChange(clampVolume((clientX - rect.left) / rect.width));
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    setFromClientX(event.clientX);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    setFromClientX(event.clientX);
  };

  const stopDragging = () => {
    draggingRef.current = false;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      onChange(clampVolume(value - 0.05));
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      onChange(clampVolume(value + 0.05));
    }
  };

  return (
    <div
      ref={trackRef}
      className="audio-mix-preview-slider"
      role="slider"
      tabIndex={0}
      aria-labelledby={labelledBy}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onKeyDown={handleKeyDown}
    >
      <div className="audio-mix-preview-slider-fill" style={{ width: `${percent}%` }} />
      <div className="audio-mix-preview-slider-thumb" style={{ left: `${percent}%` }} />
    </div>
  );
}

export default function AudioMixPreview({
  musicUrl,
  voiceFile,
  volume,
  onVolumeChange,
  resetToken = 0,
  playLocked = false,
}: AudioMixPreviewProps) {
  const musicRef = useRef<HTMLAudioElement>(null);
  const voiceRef = useRef<HTMLAudioElement>(null);
  const gainRef = useRef<GainNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainFailedRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const volumeRef = useRef(clampVolume(volume));
  const corsAllowedRef = useRef(true);
  const voiceObjectUrl = useMemo(
    () => (voiceFile ? URL.createObjectURL(voiceFile) : ''),
    [voiceFile],
  );

  useEffect(() => {
    volumeRef.current = clampVolume(volume);
  }, [volume]);

  useEffect(() => {
    return () => {
      if (voiceObjectUrl) URL.revokeObjectURL(voiceObjectUrl);
    };
  }, [voiceObjectUrl]);

  const routeMusicThroughGain = () => {
    const music = musicRef.current;
    if (!music || gainRef.current || gainFailedRef.current) return gainRef.current;
    if (!music.crossOrigin) {
      gainFailedRef.current = true;
      return null;
    }
    const Ctor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) {
      gainFailedRef.current = true;
      return null;
    }
    try {
      const ctx = audioCtxRef.current ?? new Ctor();
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') void ctx.resume();
      const source = ctx.createMediaElementSource(music);
      const gain = ctx.createGain();
      source.connect(gain);
      gain.connect(ctx.destination);
      gainRef.current = gain;
      return gain;
    } catch {
      gainFailedRef.current = true;
      return null;
    }
  };

  const applyMusicVolume = () => {
    const music = musicRef.current;
    if (!music) return;
    const next = clampVolume(volumeRef.current);
    const gain = gainRef.current;
    if (gain) {
      gain.gain.value = next;
      try { music.volume = 1; } catch { /* ignore */ }
      return;
    }
    try { music.volume = next; } catch { /* ignore */ }
  };

  const handleMusicError = () => {
    const music = musicRef.current;
    if (!music || !corsAllowedRef.current) return;
    corsAllowedRef.current = false;
    gainFailedRef.current = true;
    music.removeAttribute('crossorigin');
    music.load();
  };

  const stopPlayback = () => {
    const music = musicRef.current;
    const voice = voiceRef.current;
    music?.pause();
    voice?.pause();
    try { if (music) music.currentTime = 0; } catch { /* ignore */ }
    try { if (voice) voice.currentTime = 0; } catch { /* ignore */ }
    applyMusicVolume();
    setPlaying(false);
  };

  useEffect(() => {
    setPlaying(false);
    corsAllowedRef.current = true;
    return () => {
      musicRef.current?.pause();
      voiceRef.current?.pause();
    };
  }, [musicUrl, voiceObjectUrl, resetToken]);

  useEffect(() => {
    applyMusicVolume();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume, playing]);

  useEffect(() => {
    if (!playLocked) return;
    stopPlayback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playLocked]);

  const handlePlayToggle = async () => {
    if (playLocked) return;
    if (playing) {
      stopPlayback();
      return;
    }
    const music = musicRef.current;
    const voice = voiceRef.current;
    document.querySelectorAll('audio').forEach(other => {
      if (other !== music && other !== voice) other.pause();
    });
    try {
      if (music) {
        music.loop = true;
        routeMusicThroughGain();
        applyMusicVolume();
        try { music.currentTime = 0; } catch { /* ignore */ }
        await music.play();
      }
      if (voice) {
        voice.volume = 1;
        try { voice.currentTime = 0; } catch { /* ignore */ }
        await voice.play();
      }
      setPlaying(true);
    } catch {
      stopPlayback();
    }
  };

  const handleVolumeChange = (next: number) => {
    const clamped = clampVolume(next);
    volumeRef.current = clamped;
    applyMusicVolume();
    onVolumeChange(clamped);
  };

  const percent = Math.round(clampVolume(volume) * 100);
  const hasVoice = Boolean(voiceObjectUrl);

  return (
    <div className="audio-mix-preview">
      <audio ref={musicRef} src={musicUrl} preload="auto" playsInline crossOrigin="anonymous" onError={handleMusicError} />
      {voiceObjectUrl && (
        <audio
          ref={voiceRef}
          src={voiceObjectUrl}
          preload="auto"
          playsInline
        />
      )}

      {hasVoice && (
        <p className="audio-mix-preview-hint">
          Nghe thử nhạc nền cùng lời nhắn trước khi thanh toán.
        </p>
      )}

      <div className="audio-mix-preview-volume">
        <span id="audio-mix-volume-label">Âm lượng nhạc nền</span>
        <VolumeSlider
          value={clampVolume(volume)}
          labelledBy="audio-mix-volume-label"
          onChange={handleVolumeChange}
        />
        <strong>{percent}%</strong>
      </div>

      <button
        type="button"
        className="audio-mix-preview-play"
        onClick={handlePlayToggle}
        disabled={playLocked}
      >
        {playLocked ? 'Đang ghi âm' : playing ? 'Dừng' : 'Nghe thử'}
      </button>
    </div>
  );
}
