import { useEffect, useRef, useState } from 'react';
import { extractMusic } from '../services/api';
import { resolveAssetUrl } from '../utils/assetUrl';
import './MusicOption.css';

interface MusicOptionProps {
  musicAdded: boolean;
  onMusicToggle: (added: boolean) => void;
  musicLink: string;
  onMusicLinkChange: (link: string) => void;
  qrName?: string;
  musicPrice?: number;
  previewLocked?: boolean;
}

type ExtractState = 'idle' | 'loading' | 'success' | 'error';

function MusicOption({ musicAdded, onMusicToggle, musicLink, onMusicLinkChange, qrName, musicPrice = 10000, previewLocked = false }: MusicOptionProps) {
  const [showInput, setShowInput] = useState(musicAdded);
  const [rawUrl, setRawUrl] = useState(musicLink || '');
  const [extractState, setExtractState] = useState<ExtractState>(musicLink ? 'success' : 'idle');
  const [errorMsg, setErrorMsg] = useState('');
  // TikTok's anti-bot challenge can make this take 10+ seconds (server-side
  // retries with backoff) — stage the "please wait" copy so it doesn't look
  // stuck on a plain spinner the whole time.
  const [loadingStage, setLoadingStage] = useState<0 | 1 | 2>(0);
  const [playingPreview, setPlayingPreview] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const loadingTimers = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      loadingTimers.current.forEach((id) => window.clearTimeout(id));
      previewAudioRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    setShowInput(musicAdded);
    if (!musicAdded) {
      setRawUrl('');
      setExtractState('idle');
      setErrorMsg('');
      setPlayingPreview(false);
    } else if (musicLink) {
      setRawUrl(musicLink);
      setExtractState('success');
    }
  }, [musicAdded, musicLink]);

  useEffect(() => {
    if (!previewLocked) return;
    previewAudioRef.current?.pause();
    setPlayingPreview(false);
  }, [previewLocked]);

  const handleToggle = (checked: boolean) => {
    onMusicToggle(checked);
    setShowInput(checked);
    if (!checked) {
      onMusicLinkChange('');
      setRawUrl('');
      setExtractState('idle');
      setErrorMsg('');
      setPlayingPreview(false);
    }
  };

  const handleExtract = async () => {
    if (!rawUrl.trim()) return;
    setExtractState('loading');
    setErrorMsg('');
    setLoadingStage(0);
    loadingTimers.current.forEach((id) => window.clearTimeout(id));
    loadingTimers.current = [
      window.setTimeout(() => setLoadingStage(1), 5000),
      window.setTimeout(() => setLoadingStage(2), 12000),
    ];
    try {
      const extracted = await extractMusic(rawUrl.trim(), qrName);
      onMusicLinkChange(extracted.url);
      setExtractState('success');
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      setErrorMsg(e.response?.data?.error || 'Không trích xuất được nhạc');
      setExtractState('error');
      onMusicLinkChange('');
    } finally {
      loadingTimers.current.forEach((id) => window.clearTimeout(id));
      loadingTimers.current = [];
      setLoadingStage(0);
    }
  };

  const handleUrlChange = (value: string) => {
    setRawUrl(value);
    if (extractState !== 'idle') {
      setExtractState('idle');
      setErrorMsg('');
      onMusicLinkChange('');
      setPlayingPreview(false);
    }
  };

  const stopPreview = () => {
    const audio = previewAudioRef.current;
    audio?.pause();
    try { if (audio) audio.currentTime = 0; } catch { /* ignore */ }
    setPlayingPreview(false);
  };

  const handlePreviewToggle = async () => {
    if (playingPreview) {
      stopPreview();
      return;
    }
    const audio = previewAudioRef.current;
    if (!audio) return;
    document.querySelectorAll('audio').forEach(other => {
      if (other !== audio) other.pause();
    });
    try {
      try { audio.currentTime = 0; } catch { /* ignore */ }
      await audio.play();
      setPlayingPreview(true);
    } catch {
      stopPreview();
    }
  };

  return (
    <div className="music-option">
      <label className="music-checkbox-label">
        <input
          type="checkbox"
          checked={musicAdded}
          onChange={(e) => handleToggle(e.target.checked)}
        />
        <span className="music-label-text">
          Thêm nhạc nền (TikTok)
        </span>
        <span className="music-price">+{musicPrice.toLocaleString('vi-VN')}đ</span>
      </label>

      {showInput && (
        <>
        <div className="music-guide">
          <p className="music-guide-heading">🎵 Lấy link nhạc từ TikTok</p>
          <ol className="music-guide-list">
            <li>Mở app hoặc web TikTok, tìm video có bài nhạc bạn muốn.</li>
            <li>Nhấn nút <strong>Chia sẻ</strong> (mũi tên) → <strong>Sao chép liên kết</strong>.</li>
            <li>Dán link vào ô bên dưới rồi nhấn <strong>Kiểm tra</strong>.</li>
          </ol>
          <p className="music-guide-note">
            Lưu ý: hiện chỉ hỗ trợ link TikTok. Video phải ở chế độ công khai (không phải tài khoản
            riêng tư), và nhạc không quá 15MB (khoảng 10 phút). Khi hiện{' '}
            <strong>“Nhạc đã sẵn sàng!”</strong> là đã tải nhạc thành công.
          </p>
        </div>

        <div className="music-link-input">
          <input
            type="text"
            value={rawUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="Dán link TikTok"
            className={`music-input ${extractState === 'success' ? 'music-input--success' : ''} ${extractState === 'error' ? 'music-input--error' : ''}`}
            disabled={extractState === 'loading'}
          />
          <button
            className="music-extract-button"
            onClick={handleExtract}
            disabled={!rawUrl.trim() || !qrName?.trim() || extractState === 'loading' || extractState === 'success'}
          >
            {extractState === 'loading' ? <span className="music-spinner" /> : extractState === 'success' ? '✓' : 'Kiểm tra'}
          </button>
        </div>
        </>
      )}

      {extractState === 'loading' && loadingStage > 0 && (
        <p className="music-feedback music-feedback--pending">
          {loadingStage === 1
            ? 'TikTok đang xử lý, có thể mất 10–15 giây. Vui lòng đợi thêm chút nhé...'
            : 'Vẫn đang thử tải nhạc, xin đừng tắt trang hoặc bấm lại — sắp xong rồi...'}
        </p>
      )}
      {extractState === 'success' && (
        <>
          <p className="music-feedback music-feedback--success">Nhạc đã sẵn sàng!</p>
          <div className="music-player">
            <audio
              ref={previewAudioRef}
              src={resolveAssetUrl(musicLink)}
              preload="metadata"
              playsInline
              onEnded={stopPreview}
              onPause={() => setPlayingPreview(false)}
            />
            <button
              type="button"
              className="music-player-play"
              onClick={handlePreviewToggle}
              disabled={previewLocked}
            >
              {previewLocked ? 'Đang ghi âm — nhạc đã tắt' : playingPreview ? 'Dừng' : 'Nghe thử nhạc nền'}
            </button>
          </div>
        </>
      )}
      {extractState === 'error' && (
        <p className="music-feedback music-feedback--error">{errorMsg}</p>
      )}
      {!qrName?.trim() && showInput && (
        <p className="music-feedback music-feedback--error">Vui lòng nhập và kiểm tra tên QR ở đầu trang trước khi tải nhạc.</p>
      )}
    </div>
  );
}

export default MusicOption;
