import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getProducts, getCategories, type Product } from '../services/api';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import ProductFilter, { DEFAULT_FILTERS, type FilterState } from '../components/ProductFilter';
import './KhungAnhPage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function formatPrice(price: number): string {
  return Math.round(price).toLocaleString('en') + 'đ';
}

export default function KhungAnhPage() {
  const [products,   setProducts]   = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [filters,    setFilters]    = useState<FilterState>(DEFAULT_FILTERS);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  // Load categories once
  useEffect(() => {
    getCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  // Debounced fetch whenever filters change
  const fetchProducts = useCallback(() => {
    setLoading(true);
    setError('');
    getProducts({
      type: 'khung_anh',
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
    <div className="khuganh-page">
      <SiteHeader activePage="khung-anh" />

      <section className="khuganh-hero">
        <h1 className="khuganh-hero-title">Khung Ảnh <span>Đẹp</span></h1>
        <p className="khuganh-hero-desc">Trang trí ảnh của bạn với những khung ảnh độc đáo và ý nghĩa.</p>
      </section>

      <div className="products-layout">
        <ProductFilter
          categories={categories}
          filters={filters}
          onChange={setFilters}
          resultCount={products.length}
          accentColor="#2563eb"
        />

        <div className="products-grid-area">
          {loading && <div className="khuganh-loading">Đang tải...</div>}
          {error   && <div className="khuganh-error">{error}</div>}

          {!loading && !error && (
            <div className="khuganh-grid">
              {products.length === 0 && (
                <div className="khuganh-empty">
                  <p>Không tìm thấy sản phẩm phù hợp.</p>
                  <button className="khuganh-reset-btn" onClick={() => setFilters(DEFAULT_FILTERS)}>
                    Đặt lại bộ lọc
                  </button>
                </div>
              )}
              {products.map(p => (
                <Link key={p.id} to={`/product/${p.id}`} className="product-card product-card--link">
                  <div className="product-card-img-wrap">
                    <img
                      className="product-card-img"
                      src={p.images?.[0] ? `${API_BASE_URL}${p.images[0]}` : '/placeholder.png'}
                      alt={p.name}
                    />
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
