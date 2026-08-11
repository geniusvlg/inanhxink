import { useRef } from 'react';
import './FarewellStagesEditor.css';

export type FarewellUploadState = 'uploading' | 'done' | 'error';

interface FarewellStagesEditorProps {
  stageCount: number;
  messages: string[];
  images: (File | null)[];
  previews: string[];
  uploadStates: Record<number, FarewellUploadState>;
  disabled?: boolean;
  disabledReason?: string;
  onStageCountChange: (count: number) => void;
  onMessageChange: (index: number, message: string) => void;
  onImageSelected: (index: number, file: File, preview: string) => void;
  onImageRemoved: (index: number) => void;
  onRetry: (index: number) => void;
}

const MIN_STAGES = 1;
const MAX_STAGES = 8;

function FarewellStagesEditor({
  stageCount,
  messages,
  images,
  previews,
  uploadStates,
  disabled = false,
  disabledReason,
  onStageCountChange,
  onMessageChange,
  onImageSelected,
  onImageRemoved,
  onRetry,
}: FarewellStagesEditorProps) {
  const fileInputs = useRef<(HTMLInputElement | null)[]>([]);

  const handleFile = (index: number, file?: File) => {
    if (!file || disabled) return;
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file ảnh');
      return;
    }
    if (file.size > 7 * 1024 * 1024) {
      alert('Kích thước ảnh không được vượt quá 7MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      onImageSelected(index, file, reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <section className="farewell-stages">
      <div className="farewell-stages__heading">
        <div>
          <h3>Các chặng kỷ niệm</h3>
          <p>Mỗi chặng có một ảnh và một lời nhắn; cả hai đều không bắt buộc.</p>
        </div>
        <label>
          <span>Số chặng</span>
          <select
            value={stageCount}
            onChange={(event) => onStageCountChange(Number(event.target.value))}
          >
            {Array.from({ length: MAX_STAGES - MIN_STAGES + 1 }, (_, index) => index + MIN_STAGES)
              .map((count) => <option key={count} value={count}>{count}</option>)}
          </select>
        </label>
      </div>

      {disabled && disabledReason && (
        <p className="farewell-stages__disabled">{disabledReason}</p>
      )}

      <div className="farewell-stages__list">
        {Array.from({ length: stageCount }, (_, index) => {
          const file = images[index];
          const preview = previews[index];
          const state = uploadStates[index];

          return (
            <article className="farewell-stage-card" key={index}>
              <div className="farewell-stage-card__number">
                <span>Chặng</span>
                <strong>{String(index + 1).padStart(2, '0')}</strong>
              </div>

              <div className="farewell-stage-card__content">
                <div className="farewell-stage-card__image">
                  <input
                    ref={(element) => { fileInputs.current[index] = element; }}
                    type="file"
                    accept="image/*"
                    disabled={disabled}
                    onChange={(event) => {
                      handleFile(index, event.target.files?.[0]);
                      event.target.value = '';
                    }}
                  />

                  {file && preview ? (
                    <>
                      <img src={preview} alt={`Ảnh chặng ${index + 1}`} />
                      <div className="farewell-stage-card__image-actions">
                        <button
                          type="button"
                          onClick={() => fileInputs.current[index]?.click()}
                          disabled={disabled}
                        >
                          Đổi ảnh
                        </button>
                        <button
                          type="button"
                          onClick={() => onImageRemoved(index)}
                          disabled={disabled}
                        >
                          Xóa
                        </button>
                      </div>
                      {state === 'uploading' && <span className="farewell-stage-card__upload">Đang tải…</span>}
                      {state === 'done' && <span className="farewell-stage-card__upload is-done">Đã tải</span>}
                      {state === 'error' && (
                        <button
                          type="button"
                          className="farewell-stage-card__retry"
                          onClick={() => onRetry(index)}
                        >
                          Tải lại
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      className="farewell-stage-card__pick"
                      onClick={() => fileInputs.current[index]?.click()}
                      disabled={disabled}
                    >
                      <span aria-hidden="true">＋</span>
                      Chọn ảnh
                    </button>
                  )}
                </div>

                <label className="farewell-stage-card__message">
                  <span>Lời nhắn cho chặng này</span>
                  <textarea
                    rows={3}
                    maxLength={140}
                    value={messages[index] || ''}
                    onChange={(event) => onMessageChange(index, event.target.value)}
                    placeholder="Ví dụ: Chuyến đi mà tụi mình vẫn nhắc mãi…"
                  />
                  <small>{(messages[index] || '').length}/140</small>
                </label>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default FarewellStagesEditor;
