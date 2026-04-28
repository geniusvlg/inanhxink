import { useState, useEffect } from 'react';
import { getMetadata } from '../services/api';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import PageLoader from '../components/PageLoader';
import './InAnhPage.css';

export default function InAnhPage() {
  const [priceImageUrl, setPriceImageUrl] = useState('');
  const [gallery,       setGallery]       = useState<string[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [lightbox,      setLightbox]      = useState<string | null>(null);

  useEffect(() => {
    getMetadata()
      .then(meta => {
        setPriceImageUrl(meta.in_anh_price_image_url ?? '');
        try {
          const g: string[] = JSON.parse(meta.in_anh_gallery ?? '[]');
          setGallery(Array.isArray(g) ? g : []);
        } catch { setGallery([]); }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox]);

  return (
    <div className="ia-page">
      <SiteHeader activePage="in-anh" />

      <section className="ia-hero">
        <h1 className="ia-hero-title">In <span>Ảnh</span></h1>
        <p className="ia-hero-sub">Chọn size ảnh, xem bảng giá và đặt in nhanh</p>
      </section>

      <div className="ia-content">
        {loading && <PageLoader />}

        {!loading && (
          <>
            {priceImageUrl && (
              <section className="ia-price-section">
                <div className="ia-price-card">
                  <img className="ia-price-img" src={priceImageUrl} alt="Bảng giá in ảnh" />
                </div>
                <p className="ia-price-caption">Bảng giá in ảnh</p>
              </section>
            )}

            {gallery.length > 0 && (
              <section className="ia-gallery-section">
                <div className="ia-masonry">
                  {gallery.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="ia-masonry-card"
                      onClick={() => setLightbox(url)}
                    >
                      <div className="ia-masonry-img-wrap">
                        <img src={url} alt="" loading="lazy" />
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {lightbox && (
        <div className="ia-lightbox" onClick={() => setLightbox(null)}>
          <button type="button" className="ia-lightbox-close" onClick={() => setLightbox(null)}>×</button>
          <img src={lightbox} alt="" onClick={e => e.stopPropagation()} />
        </div>
      )}

      <SiteFooter />
    </div>
  );
}
