import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getProductById, type Product, type ProductVariant } from '../services/api';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import PageLoader from '../components/PageLoader';
import PriceTag, { getActiveDiscountPrice } from '../components/PriceTag';
import ProductSoldCount from '../components/ProductSoldCount';
import { startBuyNowCheckout, useCart } from '../contexts/CartContext';
import './ProductDetailPage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const CDN_URL      = import.meta.env.VITE_CDN_URL || '';
const S3_ORIGIN    = `https://s3-north1.viettelidc.com.vn/${import.meta.env.VITE_S3_BUCKET || 'inanhxink-prod'}`;
const resolveUrl   = (url: string) => {
  if (CDN_URL && url.startsWith(S3_ORIGIN)) return CDN_URL + url.slice(S3_ORIGIN.length);
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
};

function formatPrice(price: number): string {
  return Math.round(price).toLocaleString('vi-VN') + 'đ';
}

/** Returns the active discount price for a variant, or null if no active discount. */
function getVariantEffectivePrice(v: ProductVariant): number {
  if (v.discount_price != null) {
    const now = Date.now();
    const from = v.discount_from ? new Date(v.discount_from).getTime() : null;
    const to   = v.discount_to   ? new Date(v.discount_to).getTime()   : null;
    const fromOk = from == null || from <= now;
    const toOk   = to   == null || to   >= now;
    if (fromOk && toOk) return v.discount_price;
  }
  return v.price;
}

interface VariantPriceRange {
  minEffective: number;
  maxEffective: number;
  minOriginal:  number;
  maxOriginal:  number;
  hasDiscount:  boolean;
}

function computeVariantPriceRange(variants: ProductVariant[]): VariantPriceRange {
  const effectives = variants.map(getVariantEffectivePrice);
  const originals  = variants.map(v => v.price);
  return {
    minEffective: Math.min(...effectives),
    maxEffective: Math.max(...effectives),
    minOriginal:  Math.min(...originals),
    maxOriginal:  Math.max(...originals),
    hasDiscount:  variants.some(v => getVariantEffectivePrice(v) < v.price),
  };
}

/** Largest rounded % off among variants (effective vs that variant's Giá gốc). Matches "Giảm tới X%" style. */
function maxVariantDiscountPercent(variants: ProductVariant[]): number {
  let max = 0;
  for (const v of variants) {
    const eff = getVariantEffectivePrice(v);
    if (eff >= v.price) continue;
    const pct = Math.round((1 - eff / v.price) * 100);
    if (pct > max) max = pct;
  }
  return max;
}

const PRODUCT_LIST_CRUMB: Record<
  Product['type'],
  { path: string; label: string }
> = {
  thiep:          { path: '/thiep',             label: 'Thiệp' },
  khung_anh:      { path: '/khung-anh',         label: 'Khung Ảnh' },
  so_scrapbook:   { path: '/so-scrapbook',      label: 'Sổ & Scrapbook' },
  khac:           { path: '/cac-san-pham-khac', label: 'Các Sản Phẩm Khác' },
  'set-qua-tang': { path: '/set-qua-tang',      label: 'Set Quà Tặng' },
  in_anh:         { path: '/in-anh',            label: 'In Ảnh' },
};

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeImg, setActiveImg] = useState(0);
  const [hoveredVariantImg, setHoveredVariantImg] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [cartToastVisible, setCartToastVisible] = useState(false);
  const cartToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { addItem } = useCart();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getProductById(Number(id))
      .then((p) => { setProduct(p); setActiveImg(0); setSelectedVariant(null); })
      .catch(() => setError('Không thể tải sản phẩm'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => () => {
    if (cartToastTimerRef.current !== null) clearTimeout(cartToastTimerRef.current);
  }, []);

  const listCrumb = product ? PRODUCT_LIST_CRUMB[product.type] : PRODUCT_LIST_CRUMB.thiep;
  const backPath = listCrumb.path;
  const backLabel = listCrumb.label;

  const productImages = product?.images?.length
    ? product.images.map(resolveUrl)
    : ['/placeholder.png'];

  const variants: ProductVariant[] = product?.variants ?? [];
  const hasVariants = variants.length > 0;

  // The main displayed image: variant hover > gallery selection
  const displayImg = hoveredVariantImg
    ? resolveUrl(hoveredVariantImg)
    : productImages[activeImg];

  // Effective price: variant effective price if selected, else product discount/base price
  const basePrice = getActiveDiscountPrice(product ?? ({} as Product)) ?? product?.price ?? 0;
  const effectivePrice = selectedVariant ? getVariantEffectivePrice(selectedVariant) : basePrice;

  const buildCartEntry = () => {
    if (!product) return null;
    return {
      product_id:   product.id,
      product_name: product.name,
      variant_id:   selectedVariant?.id ?? null,
      variant_name: selectedVariant?.name ?? null,
      unit_price:   effectivePrice,
      max_upload_images: product.max_upload_images ?? 15,
      thumbnail:    selectedVariant?.image ? resolveUrl(selectedVariant.image) : productImages[0],
    };
  };

  const handleAddToCart = () => {
    if (!product) return;
    if (hasVariants && !selectedVariant) return;
    const entry = buildCartEntry();
    if (!entry) return;
    addItem(entry);
    setCartToastVisible(true);
    if (cartToastTimerRef.current !== null) clearTimeout(cartToastTimerRef.current);
    cartToastTimerRef.current = setTimeout(() => {
      setCartToastVisible(false);
      cartToastTimerRef.current = null;
    }, 2500);
  };

  const handleBuyNow = () => {
    if (!product) return;
    if (hasVariants && !selectedVariant) return;
    const entry = buildCartEntry();
    if (!entry) return;
    startBuyNowCheckout({ ...entry, quantity: 1 });
    navigate('/checkout?mode=buy-now');
  };

  if (loading) {
    return (
      <div className="pd-page">
        <SiteHeader />
        <PageLoader />
        <SiteFooter />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="pd-page">
        <SiteHeader />
        <div className="pd-error">{error || 'Không tìm thấy sản phẩm'}</div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="pd-page">
      <SiteHeader />

      <main className="pd-main">
        {/* Breadcrumb */}
        <nav className="pd-breadcrumb">
          <Link to="/">Trang chủ</Link>
          <span className="pd-breadcrumb-sep">›</span>
          <Link to={backPath}>{backLabel}</Link>
          <span className="pd-breadcrumb-sep">›</span>
          <span>{product.name}</span>
        </nav>

        <div className="pd-body">
          {/* ── Left: image gallery (product images only, NOT variant images) ── */}
          <div className="pd-gallery">
            <div className="pd-thumbnails">
              {productImages.map((src, i) => (
                <button
                  key={i}
                  className={`pd-thumb-btn${activeImg === i && !hoveredVariantImg ? ' active' : ''}`}
                  onClick={() => { setActiveImg(i); setHoveredVariantImg(null); }}
                >
                  <img src={src} alt={`${product.name} ${i + 1}`} />
                </button>
              ))}
            </div>
            <div className="pd-main-img-wrap">
              <img
                className="pd-main-img"
                src={displayImg}
                alt={product.name}
              />
              {productImages.length > 1 && !hoveredVariantImg && (
                <>
                  <button
                    className="pd-arrow pd-arrow--prev"
                    onClick={() => setActiveImg((activeImg - 1 + productImages.length) % productImages.length)}
                    aria-label="Ảnh trước"
                  >‹</button>
                  <button
                    className="pd-arrow pd-arrow--next"
                    onClick={() => setActiveImg((activeImg + 1) % productImages.length)}
                    aria-label="Ảnh sau"
                  >›</button>
                </>
              )}
            </div>
          </div>

          {/* ── Right: info panel ── */}
          <div className="pd-info">
            <h1 className="pd-name">{product.name}</h1>
            <ProductSoldCount count={product.sold_count} className="product-sold-count--detail" />

            {/* Price — range when variants exist and none selected, variant price when selected */}
            {hasVariants && !selectedVariant ? (
              (() => {
                const range = computeVariantPriceRange(variants);
                const singleEffective = range.minEffective === range.maxEffective;
                const singleOriginal  = range.minOriginal  === range.maxOriginal;
                const maxDiscountPct = range.hasDiscount ? maxVariantDiscountPercent(variants) : 0;
                return (
                  <div className="pd-price">
                    <span style={{ color: '#fe2c56' }}>
                      {singleEffective
                        ? formatPrice(range.minEffective)
                        : `${formatPrice(range.minEffective)} - ${formatPrice(range.maxEffective)}`}
                    </span>
                    {range.hasDiscount && (
                      <>
                        <span style={{ color: '#9ca3af', textDecoration: 'line-through', fontSize: '0.85em', marginLeft: '0.5rem', fontWeight: 400 }}>
                          {singleOriginal
                            ? formatPrice(range.minOriginal)
                            : `${formatPrice(range.minOriginal)} - ${formatPrice(range.maxOriginal)}`}
                        </span>
                        {maxDiscountPct > 0 && (
                          <span style={{ background: '#fe2c56', color: '#fff', fontSize: '0.72rem', fontWeight: 700, borderRadius: '0.25rem', padding: '0.1rem 0.4rem', marginLeft: '0.5rem', verticalAlign: 'middle' }}>
                            -{maxDiscountPct}%
                          </span>
                        )}
                      </>
                    )}
                  </div>
                );
              })()
            ) : selectedVariant ? (
              <div className="pd-price">
                {getVariantEffectivePrice(selectedVariant) < selectedVariant.price ? (
                  <>
                    <span style={{ color: '#fe2c56' }}>{formatPrice(getVariantEffectivePrice(selectedVariant))}</span>
                    <span style={{ color: '#9ca3af', textDecoration: 'line-through', fontSize: '0.85em', marginLeft: '0.5rem', fontWeight: 400 }}>{formatPrice(selectedVariant.price)}</span>
                    <span style={{ background: '#fe2c56', color: '#fff', fontSize: '0.72rem', fontWeight: 700, borderRadius: '0.25rem', padding: '0.1rem 0.4rem', marginLeft: '0.5rem', verticalAlign: 'middle' }}>
                      -{Math.round((1 - getVariantEffectivePrice(selectedVariant) / selectedVariant.price) * 100)}%
                    </span>
                  </>
                ) : (
                  <span style={{ color: '#fe2c56' }}>{formatPrice(selectedVariant.price)}</span>
                )}
              </div>
            ) : getActiveDiscountPrice(product) !== null ? (
              <div className="pd-price">
                <span style={{ color: '#fe2c56' }}>{formatPrice(getActiveDiscountPrice(product)!)}</span>
                <span style={{ color: '#9ca3af', textDecoration: 'line-through', fontSize: '0.85em', marginLeft: '0.5rem', fontWeight: 400 }}>{formatPrice(product.price)}</span>
                <span style={{ background: '#fe2c56', color: '#fff', fontSize: '0.72rem', fontWeight: 700, borderRadius: '0.25rem', padding: '0.1rem 0.4rem', marginLeft: '0.5rem', verticalAlign: 'middle' }}>
                  -{Math.round((1 - getActiveDiscountPrice(product)! / product.price) * 100)}%
                </span>
              </div>
            ) : (
              <div className="pd-price"><PriceTag product={product} /></div>
            )}

            {product.description && (
              <p className="pd-desc">{product.description}</p>
            )}

            {/* ── Phân loại (Variants) ── */}
            {hasVariants && (
              <div className="pd-variants">
                <p className="pd-variants-label">
                  Phân loại:{' '}
                  {selectedVariant
                    ? <strong>{selectedVariant.name}</strong>
                    : <span style={{ color: '#ef4444', fontWeight: 400 }}>Vui lòng chọn phân loại</span>
                  }
                </p>
                <div className="pd-variants-list">
                  {variants.map(v => {
                    const isSelected = selectedVariant?.id === v.id;
                    return (
                      <button
                        key={v.id}
                        className={`pd-variant-btn${isSelected ? ' pd-variant-btn--selected' : ''}`}
                        onClick={() => {
                          setSelectedVariant(isSelected ? null : v);
                          if (v.image) setHoveredVariantImg(isSelected ? null : v.image);
                          else setHoveredVariantImg(null);
                        }}
                        onMouseEnter={() => { if (v.image) setHoveredVariantImg(v.image); }}
                        onMouseLeave={() => { if (!isSelected) setHoveredVariantImg(selectedVariant?.image ?? null); }}
                      >
                        {v.image && (
                          <img src={resolveUrl(v.image)} alt={v.name} className="pd-variant-img" />
                        )}
                        <span className="pd-variant-name">{v.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pd-action-row">
              <button
                className="pd-buy-now-btn"
                onClick={handleBuyNow}
                disabled={hasVariants && !selectedVariant}
                title={hasVariants && !selectedVariant ? 'Vui lòng chọn phân loại' : undefined}
              >
                Mua ngay
              </button>

              <button
                className="pd-add-to-cart-btn"
                onClick={handleAddToCart}
                disabled={hasVariants && !selectedVariant}
                title={hasVariants && !selectedVariant ? 'Vui lòng chọn phân loại' : undefined}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <path d="M16 10a4 4 0 01-8 0"/>
                </svg>
                Thêm vào giỏ hàng
              </button>
            </div>

            {(product.tiktok_url || product.instagram_url) && (
              <div className="pd-social-links">
                {product.tiktok_url && (
                  <a
                    className="pd-social-btn pd-social-btn--tiktok"
                    href={product.tiktok_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/>
                    </svg>
                    Xem video sản phẩm trên TikTok
                  </a>
                )}
                {product.instagram_url && (
                  <a
                    className="pd-social-btn pd-social-btn--instagram"
                    href={product.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                    </svg>
                    Xem video sản phẩm trên Instagram
                  </a>
                )}
              </div>
            )}

            <div className="pd-divider" />

            {/* Feature badges */}
            <div className="pd-badges">
              <div className="pd-badge">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fe2c56" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                <span>Thiết kế<br/><strong>Độc Đáo</strong></span>
              </div>
              <div className="pd-badge">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fe2c56" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="3" width="15" height="13" rx="2"/>
                  <path d="M16 8l5 3-5 3V8z"/>
                </svg>
                <span>Giao hàng<br/><strong>Toàn Quốc</strong></span>
              </div>
              <div className="pd-badge">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fe2c56" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                <span>Làm với<br/><strong>Tâm Huyết</strong></span>
              </div>
              <div className="pd-badge">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fe2c56" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <span>Khách hàng<br/><strong>Hài Lòng</strong></span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />

      {cartToastVisible && (
        <div className="pd-cart-toast-layer" role="status" aria-live="polite">
          <div className="pd-cart-toast">
            <div className="pd-cart-toast-icon" aria-hidden>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p className="pd-cart-toast-text">Sản phẩm đã được thêm vào Giỏ hàng</p>
          </div>
        </div>
      )}
    </div>
  );
}
