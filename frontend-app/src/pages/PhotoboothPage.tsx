import { useState } from 'react';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import PhotoboothLanding from '../components/photobooth/PhotoboothLanding';
import PhotoboothLayouts from '../components/photobooth/PhotoboothLayouts';
import PhotoboothCapture from '../components/photobooth/PhotoboothCapture';
import PhotoboothCustomize from '../components/photobooth/PhotoboothCustomize';
import { LAYOUTS, type PhotoboothLayout, type PhotoboothStep } from '../utils/photobooth';
import './PhotoboothPage.css';

export default function PhotoboothPage() {
  const [step, setStep] = useState<PhotoboothStep>('landing');
  const [layout, setLayout] = useState<PhotoboothLayout>(LAYOUTS[1]);
  const [photos, setPhotos] = useState<string[]>([]);

  return (
    <div className="pb-page">
      <SiteHeader activePage="photobooth" />
      <main className={`pb-main${step === 'landing' ? ' pb-main--hero' : ''}${step === 'layout' ? ' pb-main--layouts' : ''}`}>
        {step === 'landing' && (
          <PhotoboothLanding onStart={() => setStep('layout')} />
        )}
        {step === 'layout' && (
          <PhotoboothLayouts
            onPick={next => {
              setLayout(next);
              setPhotos([]);
              setStep('capture');
            }}
          />
        )}
        {step === 'capture' && (
          <PhotoboothCapture
            layout={layout}
            initialPhotos={photos}
            onBack={() => setStep('layout')}
            onDone={next => {
              setPhotos(next);
              setStep('customize');
            }}
          />
        )}
        {step === 'customize' && (
          <PhotoboothCustomize
            layout={layout}
            photos={photos}
            onRetake={() => setStep('capture')}
          />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
