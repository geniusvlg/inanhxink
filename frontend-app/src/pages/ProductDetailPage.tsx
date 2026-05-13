import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  getProductById,
  getProductReviews,
  createProductReview,
  type Product,
  type ProductReview,
  type ProductVariant,
} from '../services/api';
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

function formatReviewDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** Label for "Phân loại" on PDP: API text, else resolve variant id from current product. */
function resolveReviewVariantLabel(rv: ProductReview, product: Product): string {
  const byName = rv.variant_name != null ? String(rv.variant_name).trim() : '';
  if (byName) return byName;
  const raw = rv.variant_id;
  const vid = typeof raw === 'number' && Number.isFinite(raw) ? raw : raw != null ? Number(raw) : NaN;
  if (!Number.isFinite(vid) || !product.variants?.length) return '';
  const row = product.variants.find((x) => x.id === vid);
  return row?.name?.trim() ?? '';
}

function StarDisplay({ rating, compact }: { rating: number; compact?: boolean }) {
  const rounded = Math.min(5, Math.max(0, Math.round(rating)));
  return (
    <span
      className={`pd-star-display${compact ? ' pd-star-display--sm' : ''}`}
      aria-hidden
    >
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < rounded ? 'pd-star pd-star--on' : 'pd-star'}>★</span>
      ))}
    </span>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="pd-star-picker" role="group" aria-label="Chọn số sao">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`pd-star-pick${n <= value ? ' pd-star-pick--active' : ''}`}
          onClick={() => onChange(n)}
          aria-label={`${n} sao`}
          aria-pressed={n <= value}
        >
          ★
        </button>
      ))}
    </div>
  );
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

  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [invoiceInput, setInvoiceInput] = useState('');
  const [ratingPick, setRatingPick] = useState(5);
  const [commentInput, setCommentInput] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewFormError, setReviewFormError] = useState('');
  const [reviewFormSuccess, setReviewFormSuccess] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getProductById(Number(id))
      .then((p) => { setProduct(p); setActiveImg(0); setSelectedVariant(null); })
      .catch(() => setError('Không thể tải sản phẩm'))
      .finally(() => setLoading(false));
  }, [id]);

  const productIdNum = id ? Number(id) : 0;

  const loadReviewsFirstPage = useCallback(() => {
    if (!productIdNum || Number.isNaN(productIdNum)) return;
    setReviewsLoading(true);
    getProductReviews(productIdNum, { page: 1, limit: 10 })
      .then((data) => {
        setReviews(data.reviews);
        setReviewTotal(data.total);
        setReviewPage(1);
      })
      .catch(() => {
        setReviews([]);
        setReviewTotal(0);
      })
      .finally(() => setReviewsLoading(false));
  }, [productIdNum]);

  useEffect(() => {
    if (!productIdNum || Number.isNaN(productIdNum)) return;
    loadReviewsFirstPage();
  }, [productIdNum, loadReviewsFirstPage]);

  const loadMoreReviews = () => {
    if (!productIdNum || Number.isNaN(productIdNum)) return;
    if (reviews.length >= reviewTotal) return;
    const nextPage = reviewPage + 1;
    setReviewsLoading(true);
    getProductReviews(productIdNum, { page: nextPage, limit: 10 })
      .then((data) => {
        setReviewTotal(data.total);
        setReviews((prev) => [...prev, ...data.reviews]);
        setReviewPage(nextPage);
      })
      .catch(() => {})
      .finally(() => setReviewsLoading(false));
  };

  const refreshProductAndReviews = () => {
    if (!productIdNum || Number.isNaN(productIdNum)) return;
    getProductById(productIdNum).then(setProduct).catch(() => {});
    loadReviewsFirstPage();
  };

  const handleSubmitReview = async (e: FormEvent) => {
    e.preventDefault();
    if (!productIdNum || Number.isNaN(productIdNum)) return;
    setReviewFormError('');
    setReviewFormSuccess(false);
    const inv = invoiceInput.trim();
    const com = commentInput.trim();
    if (!inv) {
      setReviewFormError('Vui lòng nhập mã hóa đơn (mã tra cứu đơn hàng).');
      return;
    }
    if (!com) {
      setReviewFormError('Vui lòng nhập nội dung đánh giá.');
      return;
    }
    setReviewSubmitting(true);
    try {
      await createProductReview(productIdNum, {
        invoice_number: inv,
        rating: ratingPick,
        comment: com,
      });
      setReviewFormSuccess(true);
      setInvoiceInput('');
      setCommentInput('');
      setRatingPick(5);
      refreshProductAndReviews();
    } catch (err) {
      setReviewFormError(err instanceof Error ? err.message : 'Không gửi được đánh giá');
    } finally {
      setReviewSubmitting(false);
    }
  };

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

  const multiVariant = (product?.variants?.length ?? 0) >= 2;

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
            {(product.review_count ?? 0) > 0 && product.average_rating != null && (
              <div className="pd-rating-summary">
                <StarDisplay rating={Number(product.average_rating)} />
                <span className="pd-rating-num">
                  {Number(product.average_rating).toFixed(1)}/5
                </span>
                <span className="pd-rating-count">
                  ({product.review_count} đánh giá đã mua)
                </span>
              </div>
            )}

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

        <section className="pd-reviews" aria-labelledby="pd-reviews-heading">
          <h2 id="pd-reviews-heading" className="pd-reviews-title">Đánh giá từ khách đã mua</h2>
          <p className="pd-reviews-hint">
            Mỗi mã hóa đơn chỉ gửi được một đánh giá cho sản phẩm này. Vui lòng nhập đúng mã trên hóa đơn / email xác nhận sau khi thanh toán.
          </p>

          <form className="pd-review-form" onSubmit={handleSubmitReview}>
            <label className="pd-review-label">
              Mã hóa đơn
              <input
                type="text"
                className="pd-review-input"
                value={invoiceInput}
                onChange={(ev) => setInvoiceInput(ev.target.value)}
                placeholder="VD: INXK37PRMDZ"
                autoComplete="off"
                disabled={reviewSubmitting}
              />
            </label>
            <div className="pd-review-field">
              <span className="pd-review-label-text">Số sao</span>
              <StarPicker value={ratingPick} onChange={setRatingPick} />
            </div>
            <label className="pd-review-label">
              Nhận xét
              <textarea
                className="pd-review-textarea"
                rows={4}
                value={commentInput}
                onChange={(ev) => setCommentInput(ev.target.value)}
                placeholder="Chia sẻ trải nghiệm của bạn…"
                maxLength={2000}
                disabled={reviewSubmitting}
              />
            </label>
            {reviewFormError && <p className="pd-review-msg pd-review-msg--err">{reviewFormError}</p>}
            {reviewFormSuccess && (
              <p className="pd-review-msg pd-review-msg--ok">Cảm ơn bạn! Đánh giá đã được ghi nhận.</p>
            )}
            <button type="submit" className="pd-review-submit" disabled={reviewSubmitting}>
              {reviewSubmitting ? 'Đang gửi…' : 'Gửi đánh giá'}
            </button>
          </form>

          <div className="pd-reviews-list-wrap">
            {reviewsLoading && reviewPage === 1 && reviews.length === 0 ? (
              <p className="pd-reviews-empty">Đang tải đánh giá…</p>
            ) : reviews.length === 0 ? (
              <p className="pd-reviews-empty">Chưa có đánh giá nào — bạn có thể là người đầu tiên!</p>
            ) : (
              <ul className="pd-reviews-list">
                {reviews.map((rv) => (
                  <li key={rv.id} className="pd-review-card">
                    <div className="pd-review-card-head">
                      <div className="pd-review-card-main">
                        <div className="pd-review-name-row">
                          <span className="pd-review-customer">{rv.customer_name || 'Khách hàng'}</span>
                          <StarDisplay rating={rv.rating} compact />
                        </div>
                        <div className="pd-review-meta">
                          <span className="pd-review-inv">
                            Mã Đơn Hàng: <code className="pd-review-inv-code">{rv.invoice_number}</code>
                          </span>
                          {multiVariant && (() => {
                            const phanLoai = resolveReviewVariantLabel(rv, product);
                            return phanLoai ? (
                              <span className="pd-review-ordered pd-review-phan-loai">
                                Phân loại: {phanLoai}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </div>
                      <time className="pd-review-time" dateTime={rv.created_at}>
                        {formatReviewDate(rv.created_at)}
                      </time>
                    </div>
                    <p className="pd-review-comment">{rv.comment}</p>
                  </li>
                ))}
              </ul>
            )}
            {reviews.length > 0 && reviews.length < reviewTotal && (
              <button
                type="button"
                className="pd-reviews-more"
                disabled={reviewsLoading}
                onClick={loadMoreReviews}
              >
                {reviewsLoading ? 'Đang tải…' : `Xem thêm (${reviewTotal - reviews.length} còn lại)`}
              </button>
            )}
          </div>
        </section>
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
