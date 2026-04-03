import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProducts, getCategories, type Product } from '../services/api';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import ProductFilter, { DEFAULT_FILTERS, type FilterState } from '../components/ProductFilter';
import PageLoader from '../components/PageLoader';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';
import './SetQuaTangPage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const resolveUrl = (url: string) => url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

function formatPrice(price: number): string {
  return Math.round(price).toLocaleString('en') + 'đ';
}

export default function SetQuaTangPage() {
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
    getCategories('set-qua-tang').then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const isFirstPage = page === 1;
    if (isFirstPage) { setLoading(true); setProducts([]); }
    else             { setLoadingMore(true); }
    setError('');

    const t = setTimeout(() => {
      getProducts({
        type: 'set-qua-tang',
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
    <div className="set-qua-tang-page">
      <SiteHeader activePage="set-qua-tang" />

      <section className="set-qua-tang-hero">
        <h1 className="set-qua-tang-hero-title">Set Quà <span>Tặng</span></h1>
        <p className="set-qua-tang-hero-desc">Những bộ quà tặng tinh tế, ý nghĩa — gói trọn yêu thương gửi đến người đặc biệt.</p>
      </section>

      <div className="products-layout">
        <ProductFilter
          categories={categories}
          filters={filters}
          onChange={handleFilterChange}
          resultCount={total}
          accentColor="#16a34a"
        />

        <div className="products-grid-area">
          <div className="pf-result-bar">Đang hiển thị {products.length} / {total} sản phẩm</div>
          {loading && <PageLoader />}
          {error   && <div className="set-qua-tang-error">{error}</div>}

          {!loading && !error && (
            <div className="set-qua-tang-grid">
              {products.length === 0 && (
                <div className="set-qua-tang-empty">
                  <p>Không tìm thấy sản phẩm phù hợp.</p>
                  <button className="set-qua-tang-reset-btn" onClick={() => handleFilterChange(DEFAULT_FILTERS)}>
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
