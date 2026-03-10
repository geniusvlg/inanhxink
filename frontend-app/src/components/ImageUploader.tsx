import { useState, useRef, useEffect } from 'react';
import './ImageUploader.css';

interface ImageUploaderProps {
  images: (File | null)[];
  onImagesChange: (images: (File | null)[]) => void;
  maxImages?: number;
  onImageSelected?: () => void;
  initialPreviews?: string[];
  onPreviewsChange?: (previews: string[]) => void;
}

// Compress image using Canvas API — resizes + re-encodes as JPEG if > maxSizeMB
const compressImage = (file: File, maxSizeMB = 2, maxDimension = 1920): Promise<File> => {
  return new Promise((resolve) => {
    if (file.size <= maxSizeMB * 1024 * 1024) {
      resolve(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          const compressed = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, '.jpg'),
            { type: 'image/jpeg', lastModified: Date.now() }
          );
          resolve(compressed);
        },
        'image/jpeg',
        0.85
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
};

function ImageUploader({ images, onImagesChange, maxImages = 9, onImageSelected, initialPreviews, onPreviewsChange }: ImageUploaderProps) {
  const [previews, setPreviews] = useState<string[]>(initialPreviews || []);
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

  const handleFileChange = async (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file ảnh');
      return;
    }

    const compressed = await compressImage(file);

    const newImages: (File | null)[] = [...images];
    while (newImages.length <= index) newImages.push(null);
    newImages[index] = compressed;

    // Create preview from compressed file
    const reader = new FileReader();
    reader.onloadend = () => {
      const newPreviews = [...previews];
      while (newPreviews.length <= index) newPreviews.push('');
      newPreviews[index] = reader.result as string;
      setPreviews(newPreviews);
      onPreviewsChange?.(newPreviews);
    };
    reader.readAsDataURL(compressed);

    onImagesChange(newImages);

    if (onImageSelected) {
      setTimeout(() => onImageSelected(), 300);
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
    
    // Clear the file input
    if (fileInputRefs.current[index]) {
      fileInputRefs.current[index]!.value = '';
    }
    
    // Revoke object URL if it was created
    if (previews[index] && previews[index].startsWith('blob:')) {
      URL.revokeObjectURL(previews[index]);
    }
  };

  const handleBatchUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Find empty slots
    const emptySlots: number[] = [];
    for (let i = 0; i < maxImages; i++) {
      if (!images[i]) emptySlots.push(i);
    }

    const slotsToFill = Math.min(files.length, emptySlots.length);
    const filesToAdd = files.slice(0, slotsToFill);

    if (files.length > slotsToFill) {
      alert(`Chỉ có thể upload tối đa ${maxImages} ảnh. Đã thêm ${slotsToFill} ảnh đầu tiên.`);
    }

    // Compress all files in parallel
    const compressedFiles = await Promise.all(filesToAdd.map(f => compressImage(f)));

    const newImages: (File | null)[] = [...images];
    const newPreviews: string[] = [...previews];

    let loadedCount = 0;
    compressedFiles.forEach((compressed, fileIndex) => {
      const slotIndex = emptySlots[fileIndex];
      newImages[slotIndex] = compressed;

      const reader = new FileReader();
      reader.onloadend = () => {
        newPreviews[slotIndex] = reader.result as string;
        loadedCount++;
        if (loadedCount === compressedFiles.length) {
          setPreviews([...newPreviews]);
          onPreviewsChange?.([...newPreviews]);
        }
      };
      reader.readAsDataURL(compressed);
    });

    onImagesChange(newImages);

    if (onImageSelected && filesToAdd.length > 0) {
      setTimeout(() => onImageSelected(), 500);
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

