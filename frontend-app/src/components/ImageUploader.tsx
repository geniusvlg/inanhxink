import { useState, useRef, useEffect } from 'react';
import './ImageUploader.css';

const DEFAULT_MAX_IMAGES = 12;

interface ImageUploaderProps {
  images: (File | null)[];
  onImagesChange: (images: (File | null)[]) => void;
  maxImages?: number;
  onImageSelected?: () => void;
  initialPreviews?: string[];
  onPreviewsChange?: (previews: string[]) => void;
  /** Called with newly added files so the parent can start background uploads */
  onNewFiles?: (files: { index: number; file: File }[]) => void;
  /** Called when a slot is cleared so the parent can cancel any pending upload */
  onFileRemoved?: (index: number) => void;
  /** Per-slot upload state for showing progress indicators */
  uploadStates?: Record<number, 'uploading' | 'done' | 'error'>;
}

function ImageUploader({
  images,
  onImagesChange,
  maxImages = DEFAULT_MAX_IMAGES,
  onImageSelected,
  initialPreviews,
  onPreviewsChange,
  onNewFiles,
  onFileRemoved,
  uploadStates = {},
}: ImageUploaderProps) {
  const [previews, setPreviews] = useState<string[]>(initialPreviews || []);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Keep local previews synced when parent provides new slices
  useEffect(() => {
    setPreviews(initialPreviews || []);
  }, [initialPreviews]);

  useEffect(() => {
    const hasImages = images.some(img => img !== null);
    if (hasImages && onImageSelected) {
      setTimeout(() => {
        onImageSelected();
      }, 100);
    }
  }, [images, onImageSelected]);

  const handleFileChange = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file ảnh');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Kích thước ảnh không được vượt quá 5MB');
      return;
    }

    const newImages: (File | null)[] = [...images];
    while (newImages.length <= index) {
      newImages.push(null);
    }
    newImages[index] = file;

    const reader = new FileReader();
    reader.onloadend = () => {
      const newPreviews = [...previews];
      while (newPreviews.length <= index) {
        newPreviews.push('');
      }
      newPreviews[index] = reader.result as string;
      setPreviews(newPreviews);
      onPreviewsChange?.(newPreviews);
    };
    reader.readAsDataURL(file);

    onImagesChange(newImages);
    onNewFiles?.([{ index, file }]);

    if (onImageSelected) {
      setTimeout(() => {
        onImageSelected();
      }, 300);
    }
  };

  const handleRemoveImage = (index: number) => {
    const newImages: (File | null)[] = [...images];
    newImages[index] = null;

    const newPreviews = [...previews];
    newPreviews[index] = '';

    setPreviews(newPreviews);
    onPreviewsChange?.(newPreviews);
    onImagesChange(newImages);
    onFileRemoved?.(index);
    if (fileInputRefs.current[index]) {
      fileInputRefs.current[index]!.value = '';
    }

    if (previews[index] && previews[index].startsWith('blob:')) {
      URL.revokeObjectURL(previews[index]);
    }
  };

  const handleBatchUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const emptySlots: number[] = [];
    for (let i = 0; i < maxImages; i++) {
      if (!images[i]) {
        emptySlots.push(i);
      }
    }

    const slotsToFill = Math.min(files.length, emptySlots.length);
    const filesToAdd = files.slice(0, slotsToFill);

    if (files.length > slotsToFill) {
      alert(`Chỉ có thể upload tối đa ${maxImages} ảnh. Đã thêm ${slotsToFill} ảnh đầu tiên.`);
    }

    const newImages: (File | null)[] = [...images];
    const newPreviews: string[] = [...previews];

    let loadedCount = 0;
    filesToAdd.forEach((file, fileIndex) => {
      const slotIndex = emptySlots[fileIndex];
      newImages[slotIndex] = file;

      const reader = new FileReader();
      reader.onloadend = () => {
        newPreviews[slotIndex] = reader.result as string;
        loadedCount++;
        if (loadedCount === filesToAdd.length) {
          setPreviews(newPreviews);
          onPreviewsChange?.(newPreviews);
        }
      };
      reader.readAsDataURL(file);
    });

    onImagesChange(newImages);
    onNewFiles?.(filesToAdd.map((file, fileIndex) => ({ index: emptySlots[fileIndex], file })));

    if (onImageSelected && filesToAdd.length > 0) {
      setTimeout(() => {
        onImageSelected();
      }, 500);
    }
  };

  return (
    <div className="image-uploader">
      <div className="image-uploader-header">
        <span>Upload ảnh (tùy chọn):</span>
      </div>
      <label className="batch-upload-label">
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleBatchUpload}
          style={{ display: 'none' }}
          disabled={images.filter(img => img !== null).length >= maxImages}
        />
        <span className="batch-upload-button">
          Chọn tối đa {maxImages} ảnh một lần
        </span>
      </label>

      <div className="image-upload-grid">
        {Array.from({ length: maxImages }).map((_, index) => (
          <div key={index} className="image-upload-item">
            <label className="image-upload-label">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(index, e)}
                ref={(el) => {
                  fileInputRefs.current[index] = el;
                }}
                style={{ display: 'none' }}
              />
              {images[index] ? (
                <div className="image-preview-container">
                  <img
                    src={previews[index] || (images[index] ? URL.createObjectURL(images[index]) : '')}
                    alt={`Ảnh ${index + 1}`}
                    className="image-preview"
                  />
                  {uploadStates[index] === 'uploading' && (
                    <div className="image-upload-status uploading">⏳</div>
                  )}
                  {uploadStates[index] === 'done' && (
                    <div className="image-upload-status done">✓</div>
                  )}
                  {uploadStates[index] === 'error' && (
                    <div className="image-upload-status error">!</div>
                  )}
                  <button
                    type="button"
                    className="remove-image-button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleRemoveImage(index);
                    }}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="image-upload-placeholder">
                  <span className="image-number">Ảnh {index + 1}</span>
                </div>
              )}
            </label>
          </div>
        ))}
      </div>

      <p className="image-upload-note">
        Ảnh không bắt buộc. Bạn có thể upload từ 0 đến {maxImages} ảnh tùy ý.
      </p>
    </div>
  );
}

export default ImageUploader;
