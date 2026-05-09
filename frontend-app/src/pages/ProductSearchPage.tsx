import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getProducts, type Product } from '../services/api';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import PageLoader from '../components/PageLoader';
import PriceTag from '../components/PriceTag';
import ProductSoldCount from '../components/ProductSoldCount';
import { highlightQueryInText } from '../utils/highlightQuery';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';
import './ProductSearchPage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const CDN_URL = import.meta.env.VITE_CDN_URL || '';
const S3_ORIGIN = `https://s3-north1.viettelidc.com.vn/${import.meta.env.VITE_S3_BUCKET || 'inanhxink-prod'}`;
const resolveUrl = (url: string) => {
  if (CDN_URL && url.startsWith(S3_ORIGIN)) return CDN_URL + url.slice(S3_ORIGIN.length);
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
};

export default function ProductSearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { products_page_size } = useFeatureFlags();
  const qRaw = searchParams.get('q') ?? '';
  const q = qRaw.trim();

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const fetchPage = useCallback(
    async (pageNum: number) =>
      getProducts({
        q,
        page: pageNum,
        limit: products_page_size,
      }),
    [q, products_page_size]
  );

  useEffect(() => {
    if (!q) {
      setProducts([]);
      setTotal(0);
      setPage(1);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setPage(1);
    setLoading(true);
    setError('');
    fetchPage(1)
      .then(data => {
        if (cancelled) return;
        setProducts(data.products);
        setTotal(data.total);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Không thể tải kết quả tìm kiếm');
          setProducts([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [q, fetchPage]);

  const handleLoadMore = async () => {
    if (!q || loadingMore) return;
    const next = page + 1;
    setLoadingMore(true);
    setError('');
    try {
      const data = await fetchPage(next);
      setProducts(prev => [...prev, ...data.products]);
      setPage(next);
    } catch {
      setError('Không thể tải thêm');
    } finally {
      setLoadingMore(false);
    }
  };

  if (!q) {
    return (
      <div className="ps-page">
        <SiteHeader />
        <main className="ps-main ps-main--empty">
          <p>Nhập từ khóa để tìm sản phẩm.</p>
          <button type="button" className="ps-back" onClick={() => navigate('/home')}>
            Về trang chủ
          </button>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="ps-page">
      <SiteHeader />
      <main className="ps-main">
        <h1 className="ps-heading">
          Kết quả cho “{q}” <span className="ps-count">({total})</span>
        </h1>

        {loading && <PageLoader />}
        {error && <div className="ps-error">{error}</div>}

        {!loading && !error && products.length === 0 && (
          <p className="ps-empty">Không tìm thấy sản phẩm nào.</p>
        )}

        {!loading && !error && products.length > 0 && (
          <>
            <div className="thiep-grid">
              {products.map(p => (
                <Link key={p.id} to={`/product/${p.id}`} className="product-card product-card--link">
                  <div className="product-card-img-wrap">
                    <img
                      className="product-card-img"
                      src={p.images?.[0] ? resolveUrl(p.images[0]) : '/placeholder.png'}
                      alt={p.name}
                    />
                    <div className="product-card-action-row">
                      <button
                        type="button"
                        className="product-card-buy-now"
                        aria-label="Mua ngay"
                        onClick={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate(`/product/${p.id}`);
                        }}
                      >
                        Mua ngay
                      </button>
                    </div>
                  </div>
                  <div className="product-card-info">
                    <div className="product-card-name">{highlightQueryInText(p.name, q)}</div>
                    <ProductSoldCount count={p.sold_count} />
                    <div className="product-card-price">
                      <PriceTag product={p} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {products.length < total && (
              <div className="load-more-wrap">
                {loadingMore ? (
                  <img src="/load_more.gif" alt="Đang tải" className="load-more-icon" />
                ) : (
                  <button type="button" className="load-more-btn" onClick={handleLoadMore}>
                    Tải thêm ↓
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
