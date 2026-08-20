import { useEffect, useMemo, useRef, useState } from 'react';
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

  const applyMusicVolume = () => {
    const music = musicRef.current;
    if (!music) return;
    music.volume = clampVolume(volumeRef.current);
  };

  const handleMusicError = () => {
    const music = musicRef.current;
    if (!music || !corsAllowedRef.current) return;
    corsAllowedRef.current = false;
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

      <label className="audio-mix-preview-volume">
        <span>Âm lượng nhạc nền</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(clampVolume(volume) * 100)}
          onChange={event => onVolumeChange(Number(event.target.value) / 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(clampVolume(volume) * 100)}
        />
        <strong>{Math.round(clampVolume(volume) * 100)}%</strong>
      </label>

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
