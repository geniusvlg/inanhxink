import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProducts, getCategories, type Product } from '../services/api';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import ProductFilter, { DEFAULT_FILTERS, type FilterState } from '../components/ProductFilter';
import ProductPageBanner from '../components/ProductPageBanner';
import PageLoader from '../components/PageLoader';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';
import PriceTag from '../components/PriceTag';
import './InAnhPage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const CDN_URL      = import.meta.env.VITE_CDN_URL || '';
const S3_ORIGIN    = `https://s3-north1.viettelidc.com.vn/${import.meta.env.VITE_S3_BUCKET || 'inanhxink-prod'}`;
const resolveUrl   = (url: string) => {
  if (CDN_URL && url.startsWith(S3_ORIGIN)) return CDN_URL + url.slice(S3_ORIGIN.length);
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
};

export default function InAnhPage() {
  const { products_page_size } = useFeatureFlags();
  const [products,     setProducts]     = useState<Product[]>([]);
  const [total,        setTotal]        = useState(0);
  const [page,         setPage]         = useState(1);
  const [categories,   setCategories]   = useState<{ id: number; name: string }[]>([]);
  const [filters,      setFilters]      = useState<FilterState>(DEFAULT_FILTERS);
  const [loading,      setLoading]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [error,        setError]        = useState('');

  useEffect(() => {
    getCategories('in_anh').then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const isFirstPage = page === 1;
    if (isFirstPage) { setLoading(true); setProducts([]); }
    else             { setLoadingMore(true); }
    setError('');

    const t = setTimeout(() => {
      getProducts({
        type: 'in_anh',
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

  const handleFilterChange = (newFilters: FilterState) => {
    setPage(1);
    setFilters(newFilters);
  };

  return (
    <div className="in-anh-page">
      <SiteHeader activePage="in-anh" />

      <section className="in-anh-hero">
        <ProductPageBanner page="in_anh" />
        <h1 className="in-anh-hero-title">In <span>Ảnh</span></h1>
        <p className="in-anh-hero-desc">Dịch vụ in ảnh theo yêu cầu — sắc nét, bền màu, lưu giữ kỷ niệm đẹp.</p>
      </section>

      <div className="products-layout">
        <ProductFilter
          categories={categories}
          filters={filters}
          onChange={handleFilterChange}
          resultCount={total}
          accentColor="#f97316"
        />

        <div className="products-grid-area">
          <div className="pf-result-bar">Đang hiển thị {products.length} / {total} sản phẩm</div>
          {loading && <PageLoader />}
          {error   && <div className="in-anh-error">{error}</div>}

          {!loading && !error && (
            <div className="in-anh-grid">
              {products.length === 0 && (
                <div className="in-anh-empty">
                  <p>Không tìm thấy sản phẩm phù hợp.</p>
                  <button className="in-anh-reset-btn" onClick={() => handleFilterChange(DEFAULT_FILTERS)}>
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
                    <div className="product-card-price"><PriceTag product={p} /></div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {!loading && !error && products.length < total && (
            <div className="load-more-wrap">
              {loadingMore ? (
                <img src="/load_more.gif" alt="Đang tải" className="load-more-icon" />
              ) : (
                <button
                  className="load-more-btn"
                  onClick={() => setPage(p => p + 1)}
                >
                  Tải thêm ↓
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
