import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProducts, getCategories, type Product } from '../services/api';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import ProductFilter, { DEFAULT_FILTERS, type FilterState } from '../components/ProductFilter';
import PageLoader from '../components/PageLoader';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';
import './ThiepPage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const CDN_URL      = import.meta.env.VITE_CDN_URL || '';
const S3_ORIGIN    = 'https://s3-north1.viettelidc.com.vn/inanhxink-prod';
const resolveUrl   = (url: string) => {
  if (CDN_URL && url.startsWith(S3_ORIGIN)) return CDN_URL + url.slice(S3_ORIGIN.length);
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
};

function formatPrice(price: number): string {
  return Math.round(price).toLocaleString('en') + 'đ';
}

export default function ThiepPage() {
  const { products_page_size } = useFeatureFlags();
  const [products,     setProducts]     = useState<Product[]>([]);
  const [total,        setTotal]        = useState(0);
  const [page,         setPage]         = useState(1);
  const [categories,   setCategories]   = useState<{ id: number; name: string }[]>([]);
  const [filters,      setFilters]      = useState<FilterState>(DEFAULT_FILTERS);
  const [loading,      setLoading]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [error,        setError]        = useState('');

  // Load categories once
  useEffect(() => {
    getCategories('thiep').then(setCategories).catch(() => setCategories([]));
  }, []);

  // Fetch whenever filters or page changes
  useEffect(() => {
    const isFirstPage = page === 1;
    if (isFirstPage) { setLoading(true); setProducts([]); }
    else             { setLoadingMore(true); }
    setError('');

    const t = setTimeout(() => {
      getProducts({
        type: 'thiep',
        sort: filters.sort,
        category_ids: filters.category_ids.length > 0 ? filters.category_ids.join(',') : undefined,
        min_price: filters.min_price ? Number(filters.min_price) : undefined,
        max_price: filters.max_price ? Number(filters.max_price) : undefined,
        page,
        limit: products_page_size,
      })
        .then(data => {
          setTotal(data.total);
          setProducts(prev => isFirstPage ? data.products : [...prev, ...data.products]);
        })
        .catch(() => setError('Không thể tải danh sách sản phẩm'))
        .finally(() => { setLoading(false); setLoadingMore(false); });
    }, 350);

    return () => clearTimeout(t);
  }, [filters, page, products_page_size]);

  // Reset to page 1 when filters change
  const handleFilterChange = (newFilters: FilterState) => {
    setPage(1);
    setFilters(newFilters);
  };

  return (
    <div className="thiep-page">
      <SiteHeader activePage="thiep" />

      <section className="thiep-hero">
        <h1 className="thiep-hero-title">Thiệp <span>Của Bạn</span></h1>
        <p className="thiep-hero-desc">Tạo thiệp cá nhân độc đáo, gửi trao yêu thương đến người thân.</p>
      </section>

      <div className="products-layout">
        <ProductFilter
          categories={categories}
          filters={filters}
          onChange={handleFilterChange}
          resultCount={total}
          accentColor="#fe2c56"
        />

        <div className="products-grid-area">
          <div className="pf-result-bar">Đang hiển thị {products.length} / {total} sản phẩm</div>
          {loading && <PageLoader />}
          {error   && <div className="thiep-error">{error}</div>}

          {!loading && !error && (
            <div className="thiep-grid">
              {products.length === 0 && (
                <div className="thiep-empty">
                  <p>Không tìm thấy sản phẩm phù hợp.</p>
                  <button className="thiep-reset-btn" onClick={() => handleFilterChange(DEFAULT_FILTERS)}>
                    Đặt lại bộ lọc
                  </button>
                </div>
              )}
              {products.map(p => (
                <Link key={p.id} to={`/product/${p.id}`} className="product-card product-card--link">
                  <div className="product-card-img-wrap">
                    <img
                      className="product-card-img"
                      src={p.images?.[0] ? resolveUrl(p.images[0]) : '/placeholder.png'}
                      alt={p.name}
                    />
                    {p.is_best_seller && (
                      <img
                        className="product-card-best-seller-badge"
                        src="/assets/images/feature/bestseller.png"
                        alt="Best Seller"
                      />
                    )}
                  </div>
                  <div className="product-card-info">
                    <div className="product-card-name">{p.name}</div>
                    <div className="product-card-price">{formatPrice(p.price)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {!loading && !error && products.length < total && (
            <div className="load-more-wrap">
              <button
                className="load-more-btn"
                onClick={() => setPage(p => p + 1)}
                disabled={loadingMore}
              >
                {loadingMore ? 'Đang tải...' : 'Tải thêm ↓'}
              </button>
            </div>
          )}
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
