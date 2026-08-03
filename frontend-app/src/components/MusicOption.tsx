import { useEffect, useState } from 'react';
import { extractMusic } from '../services/api';
import './MusicOption.css';

interface MusicOptionProps {
  musicAdded: boolean;
  onMusicToggle: (added: boolean) => void;
  musicLink: string;
  onMusicLinkChange: (link: string) => void;
  qrName?: string;
  musicPrice?: number;
}

type ExtractState = 'idle' | 'loading' | 'success' | 'error';

function MusicOption({ musicAdded, onMusicToggle, musicLink, onMusicLinkChange, qrName, musicPrice = 10000 }: MusicOptionProps) {
  const [showInput, setShowInput] = useState(musicAdded);
  const [rawUrl, setRawUrl] = useState(musicLink || '');
  const [extractState, setExtractState] = useState<ExtractState>(musicLink ? 'success' : 'idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setShowInput(musicAdded);
    if (!musicAdded) {
      setRawUrl('');
      setExtractState('idle');
      setErrorMsg('');
    } else if (musicLink) {
      setRawUrl(musicLink);
      setExtractState('success');
    }
  }, [musicAdded, musicLink]);

  const handleToggle = (checked: boolean) => {
    onMusicToggle(checked);
    setShowInput(checked);
    if (!checked) {
      onMusicLinkChange('');
      setRawUrl('');
      setExtractState('idle');
      setErrorMsg('');
    }
  };

  const handleExtract = async () => {
    if (!rawUrl.trim()) return;
    setExtractState('loading');
    setErrorMsg('');
    try {
      const resolvedUrl = await extractMusic(rawUrl.trim(), qrName);
      onMusicLinkChange(resolvedUrl);
      setExtractState('success');
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      setErrorMsg(e.response?.data?.error || 'Không trích xuất được nhạc');
      setExtractState('error');
      onMusicLinkChange('');
    }
  };

  const handleUrlChange = (value: string) => {
    setRawUrl(value);
    if (extractState !== 'idle') {
      setExtractState('idle');
      setErrorMsg('');
      onMusicLinkChange('');
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

      {extractState === 'success' && (
        <p className="music-feedback music-feedback--success">Nhạc đã sẵn sàng!</p>
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
