import { useState, useRef, useEffect } from 'react';
import './ImageUploader.css';

interface ImageUploaderProps {
  images: (File | null)[];
  onImagesChange: (images: (File | null)[]) => void;
  maxImages?: number;
  onImageSelected?: () => void;
}

function ImageUploader({ images, onImagesChange, maxImages = 9, onImageSelected }: ImageUploaderProps) {
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Scroll to next section when image is selected
  useEffect(() => {
    const hasImages = images.some(img => img !== null);
    if (hasImages && onImageSelected) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        onImageSelected();
      }, 100);
    }
  }, [images, onImageSelected]);

  const handleFileChange = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file ảnh');
      return;
    }

    // Validate file size (max 5MB per image)
    if (file.size > 5 * 1024 * 1024) {
      alert('Kích thước ảnh không được vượt quá 5MB');
      return;
    }

    const newImages: (File | null)[] = [...images];
    // Ensure array is long enough, fill with null slots if needed
    while (newImages.length <= index) {
      newImages.push(null);
    }
    newImages[index] = file;

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      const newPreviews = [...previews];
      while (newPreviews.length <= index) {
        newPreviews.push('');
      }
      newPreviews[index] = reader.result as string;
      setPreviews(newPreviews);
    };
    reader.readAsDataURL(file);

    onImagesChange(newImages);
    
    // Scroll to next section after image is selected
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
    onImagesChange(newImages);
    
    // Clear the file input
    if (fileInputRefs.current[index]) {
      fileInputRefs.current[index]!.value = '';
    }
    
    // Revoke object URL if it was created
    if (previews[index] && previews[index].startsWith('blob:')) {
      URL.revokeObjectURL(previews[index]);
    }
  };

  const handleBatchUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Find empty slots
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

    // Create previews for all new images
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
        }
      };
      reader.readAsDataURL(file);
    });

    onImagesChange(newImages);
    
    // Scroll to next section after batch upload
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
                    onLoad={(e) => {
                      // Clean up object URL after image loads if it was created
                      const img = e.target as HTMLImageElement;
                      if (img.src.startsWith('blob:') && previews[index]) {
                        // Keep the preview, don't revoke yet
                      }
                    }}
                  />
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

