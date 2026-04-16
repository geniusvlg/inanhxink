import { useState } from 'react';
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
          Thêm nhạc nền (TikTok / Instagram)
        </span>
      </label>

      {showInput && (
        <div className="music-link-input">
          <input
            type="text"
            value={rawUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="Dán link TikTok hoặc Instagram"
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
      )}

      {extractState === 'success' && (
        <p className="music-feedback music-feedback--success">Nhạc đã sẵn sàng!</p>
      )}
      {extractState === 'error' && (
        <p className="music-feedback music-feedback--error">{errorMsg}</p>
      )}
      {!qrName?.trim() && showInput && (
        <p className="music-feedback music-feedback--error">Vui lòng nhập và kiểm tra tên QR trước khi tải nhạc.</p>
      )}
    </div>
  );
}

export default MusicOption;
