import { useState } from 'react';
import './VoucherInput.css';

interface Voucher {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
}

interface VoucherInputProps {
  onVoucherValidated: (voucher: Voucher | null) => void;
}

function VoucherInput({ onVoucherValidated }: VoucherInputProps) {
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [error, setError] = useState('');

  const handleCheck = () => {
    if (!code.trim()) {
      setError('Vui lòng nhập mã voucher');
      return;
    }

    setChecking(true);
    setError('');
    // Mock validation - for display only
    setTimeout(() => {
      // Mock: accept any code starting with "VIP" or "LOVE"
      if (code.toUpperCase().startsWith('VIP') || code.toUpperCase().startsWith('LOVE')) {
        const mockVoucher: Voucher = {
          code: code.toUpperCase(),
          discountType: 'percentage',
          discountValue: 10,
        };
        setVoucher(mockVoucher);
        onVoucherValidated(mockVoucher);
      } else {
        setError('Mã voucher không hợp lệ');
        setVoucher(null);
        onVoucherValidated(null);
      }
      setChecking(false);
    }, 500);
  };

  const handleRemove = () => {
    setCode('');
    setVoucher(null);
    setError('');
    onVoucherValidated(null);
  };

  return (
    <div className="voucher-input">
      <label>Voucher</label>
      <div className="voucher-input-group">
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError('');
            if (voucher) {
              setVoucher(null);
              onVoucherValidated(null);
            }
          }}
          placeholder="Nhập mã voucher"
          className={error ? 'error' : voucher ? 'success' : ''}
        />
        {voucher ? (
          <button onClick={handleRemove} className="remove-button">
            Xóa
          </button>
        ) : (
          <button
            onClick={handleCheck}
            disabled={checking || !code.trim()}
            className="check-button"
          >
            {checking ? 'Đang kiểm tra...' : 'Kiểm tra'}
          </button>
        )}
      </div>
      {error && <div className="voucher-error">{error}</div>}
      {voucher && (
        <div className="voucher-success">
          ✓ Voucher hợp lệ: Giảm{' '}
          {voucher.discountType === 'percentage'
            ? `${voucher.discountValue}%`
            : `${voucher.discountValue.toLocaleString('vi-VN')}đ`}
        </div>
      )}
    </div>
  );
}

export default VoucherInput;

