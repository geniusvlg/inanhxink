import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getProducts, getCategories, type Product } from '../services/api';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import ProductFilter, { DEFAULT_FILTERS, type FilterState } from '../components/ProductFilter';
import PageLoader from '../components/PageLoader';
import './KhacPage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const resolveUrl = (url: string) => url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

function formatPrice(price: number): string {
  return Math.round(price).toLocaleString('en') + 'đ';
}

export default function KhacPage() {
  const [products,   setProducts]   = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [filters,    setFilters]    = useState<FilterState>(DEFAULT_FILTERS);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  useEffect(() => {
    getCategories('khac').then(setCategories).catch(() => setCategories([]));
  }, []);

  const fetchProducts = useCallback(() => {
    setLoading(true);
    setError('');
    getProducts({
      type: 'khac',
      sort: filters.sort,
      category_ids: filters.category_ids.length > 0 ? filters.category_ids.join(',') : undefined,
      min_price: filters.min_price ? Number(filters.min_price) : undefined,
      max_price: filters.max_price ? Number(filters.max_price) : undefined,
    })
      .then(setProducts)
      .catch(() => setError('Không thể tải danh sách sản phẩm'))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    const t = setTimeout(fetchProducts, 350);
    return () => clearTimeout(t);
  }, [fetchProducts]);

  return (
    <div className="khac-page">
      <SiteHeader activePage="cac-san-pham-khac" />

      <section className="khac-hero">
        <h1 className="khac-hero-title">Các Sản Phẩm <span>Khác</span></h1>
        <p className="khac-hero-desc">Khám phá thêm nhiều sản phẩm độc đáo và ý nghĩa khác.</p>
      </section>

      <div className="products-layout">
        <ProductFilter
          categories={categories}
          filters={filters}
          onChange={setFilters}
          resultCount={products.length}
          accentColor="#f97316"
        />

        <div className="products-grid-area">
          <div className="pf-result-bar">{products.length} sản phẩm</div>
          {loading && <PageLoader />}
          {error   && <div className="khac-error">{error}</div>}

          {!loading && !error && (
            <div className="khac-grid">
              {products.length === 0 && (
                <div className="khac-empty">
                  <p>Không tìm thấy sản phẩm phù hợp.</p>
                  <button className="khac-reset-btn" onClick={() => setFilters(DEFAULT_FILTERS)}>
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
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
