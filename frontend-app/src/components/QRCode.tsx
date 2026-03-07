import { useState, useEffect, useRef } from 'react';
import QRCodeLib from 'qrcode';

interface QRTemplateConfig {
  color: string;
  qrX: number;      // QR top-left X in px
  qrY: number;      // QR top-left Y in px
  qrSize: number;   // QR width/height in px
  canvasW: number;   // canvas width in px
  canvasH: number;   // canvas height in px
}

const TEMPLATES: Record<string, QRTemplateConfig> = {
  heart: {
    color: '#545353',
    qrX: 355,
    qrY: 726,
    qrSize: 395,
    canvasW: 1090,
    canvasH: 1920,
  },
  banhdeo: {
    color: '#eeebe2',
    qrX: 340,
    qrY: 727,
    qrSize: 402,
    canvasW: 1090,
    canvasH: 1920,
  },
  capturedmoments: {
    color: '#5C4A2F',
    qrX: 355,
    qrY: 726,
    qrSize: 395,
    canvasW: 1090,
    canvasH: 1920,
  },
};

interface StyledQRCodeProps {
  url: string;
  template?: string;
}

function StyledQRCode({ url, template = 'heart' }: StyledQRCodeProps) {
  const [imgSrc, setImgSrc] = useState('');
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const generate = async () => {
      const config = TEMPLATES[template] || TEMPLATES.heart;

      // Generate QR matrix
      const qrData = QRCodeLib.create(url, { errorCorrectionLevel: 'H' });
      const modules = qrData.modules;
      const moduleCount = modules.size;
      const qrMatrix: boolean[][] = [];

      for (let row = 0; row < moduleCount; row++) {
        qrMatrix[row] = [];
        for (let col = 0; col < moduleCount; col++) {
          qrMatrix[row][col] = modules.get(row, col) === 1;
        }
      }

      // Load background image
      const bgImg = new Image();
      bgImg.src = `/qr-template/${template}.png`;

      const bgLoaded = await new Promise<boolean>((resolve) => {
        bgImg.onload = () => resolve(true);
        bgImg.onerror = () => resolve(false);
      });

      // Use offscreen canvas (no dpr scaling — render at exact image resolution)
      if (!offscreenRef.current) {
        offscreenRef.current = document.createElement('canvas');
      }
      const canvas = offscreenRef.current;
      canvas.width = config.canvasW;
      canvas.height = config.canvasH;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, config.canvasW, config.canvasH);

      // --- Layer 1: Background image ---
      if (bgLoaded) {
        ctx.drawImage(bgImg, 0, 0, config.canvasW, config.canvasH);
      }

      // --- Layer 2: QR code ---
      const moduleSize = config.qrSize / moduleCount;

      ctx.fillStyle = config.color;

      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
          if (!qrMatrix[row][col]) continue;
          ctx.fillRect(
            config.qrX + col * moduleSize,
            config.qrY + row * moduleSize,
            moduleSize,
            moduleSize,
          );
        }
      }

      // Convert to data URL and set as img src
      setImgSrc(canvas.toDataURL('image/png'));
    };

    generate();
  }, [url, template]);

  if (!imgSrc) return null;

  return (
    <img
      src={imgSrc}
      alt="QR Code"
      style={{
        display: 'block',
        margin: '0 auto',
        maxWidth: '380px',
        maxHeight: '70vh',
        borderRadius: '16px',
        boxShadow: 'rgba(0, 0, 0, 0.1) 0px 4px 24px',
      }}
    />
  );
}

export default StyledQRCode;
