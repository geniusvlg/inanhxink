import { useState } from 'react';
import './MusicOption.css';

interface MusicOptionProps {
  musicAdded: boolean;
  onMusicToggle: (added: boolean) => void;
  musicLink: string;
  onMusicLinkChange: (link: string) => void;
}

function MusicOption({ musicAdded, onMusicToggle, musicLink, onMusicLinkChange }: MusicOptionProps) {
  const [showInput, setShowInput] = useState(musicAdded);

  const handleToggle = (checked: boolean) => {
    onMusicToggle(checked);
    setShowInput(checked);
    if (!checked) {
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
          Thêm nhạc (Link video Tiktok)
          <span className="music-price">+10,000đ</span>
        </span>
      </label>
      
      {showInput && (
        <div className="music-link-input">
          <input
            type="text"
            value={musicLink}
            onChange={(e) => onMusicLinkChange(e.target.value)}
            placeholder="Nhập link video TikTok"
            className="music-input"
          />
        </div>
      )}
    </div>
  );
}

export default MusicOption;

