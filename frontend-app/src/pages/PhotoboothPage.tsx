import { useState } from 'react';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import PhotoboothLanding from '../components/photobooth/PhotoboothLanding';
import PhotoboothLayouts from '../components/photobooth/PhotoboothLayouts';
import PhotoboothCapture from '../components/photobooth/PhotoboothCapture';
import PhotoboothCropReview from '../components/photobooth/PhotoboothCropReview';
import PhotoboothCustomize from '../components/photobooth/PhotoboothCustomize';
import { LAYOUTS, type PhotoboothLayout, type PhotoboothStep } from '../utils/photobooth';
import './PhotoboothPage.css';

export default function PhotoboothPage() {
  const preview = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get('preview')
    : null;
  const previewPhotos = ['a', 'b', 'c', 'd'].map(id => `/photobooth/layouts/${id}.webp`);
  const startStep: PhotoboothStep = preview === 'customize' || preview === 'crop' ? preview : 'landing';
  const [step, setStep] = useState<PhotoboothStep>(startStep);
  const [layout, setLayout] = useState<PhotoboothLayout>(LAYOUTS[1]);
  const [photos, setPhotos] = useState<string[]>(startStep === 'landing' ? [] : previewPhotos);
  const [motionFrames, setMotionFrames] = useState<string[][]>([]);

  return (
    <div className="pb-page">
      <SiteHeader activePage="photobooth" />
      <main className={`pb-main${step === 'landing' ? ' pb-main--hero' : ''}${step === 'layout' ? ' pb-main--layouts' : ''}${step === 'customize' ? ' pb-main--customize' : ''}${step === 'crop' ? ' pb-main--crop' : ''}`}>
        {step === 'landing' && (
          <PhotoboothLanding onStart={() => setStep('layout')} />
        )}
        {step === 'layout' && (
          <PhotoboothLayouts
            onPick={next => {
              setLayout(next);
              setPhotos([]);
              setMotionFrames([]);
              setStep('capture');
            }}
          />
        )}
        {step === 'capture' && (
          <PhotoboothCapture
            layout={layout}
            initialPhotos={photos}
            initialMotion={motionFrames}
            onBack={() => setStep('layout')}
            onDone={(next, clips) => {
              setPhotos(next);
              setMotionFrames(clips);
              setStep('crop');
            }}
          />
        )}
        {step === 'crop' && (
          <PhotoboothCropReview
            photos={photos}
            onCancel={() => setStep('capture')}
            onConfirm={next => {
              setPhotos(next);
              setStep('customize');
            }}
          />
        )}
        {step === 'customize' && (
          <PhotoboothCustomize
            layout={layout}
            photos={photos}
            motionFrames={motionFrames}
            onRetake={() => setStep('capture')}
          />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
