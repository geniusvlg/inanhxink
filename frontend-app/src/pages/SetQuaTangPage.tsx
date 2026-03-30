import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getProducts, getCategories, type Product } from '../services/api';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import ProductFilter, { DEFAULT_FILTERS, type FilterState } from '../components/ProductFilter';
import './SetQuaTangPage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const resolveUrl = (url: string) => url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

function formatPrice(price: number): string {
  return Math.round(price).toLocaleString('en') + 'đ';
}

export default function SetQuaTangPage() {
  const [products,   setProducts]   = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [filters,    setFilters]    = useState<FilterState>(DEFAULT_FILTERS);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  // Load categories once
  useEffect(() => {
    getCategories('set-qua-tang').then(setCategories).catch(() => setCategories([]));
  }, []);

  // Debounced fetch whenever filters change
  const fetchProducts = useCallback(() => {
    setLoading(true);
    setError('');
    getProducts({
      type: 'set-qua-tang',
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
          onChange={setFilters}
          resultCount={products.length}
          accentColor="#16a34a"
        />

        <div className="products-grid-area">
          <div className="pf-result-bar">{products.length} sản phẩm</div>
          {loading && <div className="set-qua-tang-loading">Đang tải...</div>}
          {error   && <div className="set-qua-tang-error">{error}</div>}

          {!loading && !error && (
            <div className="set-qua-tang-grid">
              {products.length === 0 && (
                <div className="set-qua-tang-empty">
                  <p>Không tìm thấy sản phẩm phù hợp.</p>
                  <button className="set-qua-tang-reset-btn" onClick={() => setFilters(DEFAULT_FILTERS)}>
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
