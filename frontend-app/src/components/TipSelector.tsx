import './TipSelector.css';

const TIP_OPTIONS = [
  { label: '1,000đ', value: 1000 },
  { label: '5,000đ', value: 5000 },
  { label: '10,000đ', value: 10000 },
  { label: '20,000đ', value: 20000 },
  { label: 'Tùy tâm', value: 'custom' },
] as const;

interface TipSelectorProps {
  selectedTip: number | 'custom' | null;
  onSelectTip: (tip: number | 'custom') => void;
  customAmount: number;
  onCustomAmountChange: (amount: number) => void;
}

function TipSelector({ selectedTip, onSelectTip, customAmount, onCustomAmountChange }: TipSelectorProps) {
  const handleTipClick = (value: number | 'custom') => {
    if (value === 'custom') {
      onSelectTip('custom');
    } else {
      onSelectTip(value);
    }
  };

  return (
    <div className="tip-selector">
      <label>Tip thêm yêu thương</label>
      <div className="tip-buttons">
        {TIP_OPTIONS.map((option) => (
          <button
            key={option.value}
            className={`tip-button ${selectedTip === option.value ? 'selected' : ''}`}
            onClick={() => handleTipClick(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {selectedTip === 'custom' && (
        <div className="custom-tip-input">
          <input
            type="number"
            value={customAmount || ''}
            onChange={(e) => onCustomAmountChange(parseInt(e.target.value) || 0)}
            placeholder="Nhập số tiền tip"
            min="0"
          />
          <span>đ</span>
        </div>
      )}
      <p className="tip-note">Không chọn thì không cộng thêm tiền tip.</p>
    </div>
  );
}

export default TipSelector;

