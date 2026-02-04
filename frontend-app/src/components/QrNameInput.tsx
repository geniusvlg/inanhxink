import { useState } from 'react';
import './QrNameInput.css';

interface QrNameInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidation: (isValid: boolean, fullUrl?: string) => void;
}

function QrNameInput({ value, onChange, onValidation }: QrNameInputProps) {
  const [checking, setChecking] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    onChange(newValue);
    setIsValid(null);
    setMessage('');
  };

  const handleCheck = () => {
    if (!value.trim()) {
      setMessage('Vui lòng nhập tên QR');
      setIsValid(false);
      return;
    }

    setChecking(true);
    // Mock validation - always return available for display purposes
    setTimeout(() => {
      setIsValid(true);
      setMessage('Tên QR có sẵn!');
      onValidation(true, `${value}.tokitoki.love`);
      setChecking(false);
    }, 500);
  };

  return (
    <div className="qr-name-input">
      <label>Tên QR (tên.tokitoki.love)</label>
      <div className="qr-name-input-group">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          placeholder="tên viết liền không dấu, vd: anhyeuem, hoainam123, ..."
          className={isValid === false ? 'error' : isValid === true ? 'success' : ''}
        />
        <button 
          onClick={handleCheck} 
          disabled={checking || !value.trim()}
          className="check-button"
        >
          {checking ? 'Đang kiểm tra...' : 'Kiểm tra'}
        </button>
      </div>
      {message && (
        <div className={`qr-name-message ${isValid === false ? 'error' : isValid === true ? 'success' : ''}`}>
          {message}
        </div>
      )}
      {isValid && (
        <div className="qr-name-url">
          URL: <strong>{value}.tokitoki.love</strong>
        </div>
      )}
    </div>
  );
}

export default QrNameInput;

