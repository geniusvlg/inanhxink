import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import PageLoader from '../components/PageLoader';
import ProductSoldCount from '../components/ProductSoldCount';
import PriceTag from '../components/PriceTag';
import { getCategoryById, getProducts, type Category, type Product } from '../services/api';
import { getProductThumbnailUrl } from '../utils/productImage';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';
import './CategoryDetailPage.css';

const TYPE_LABELS: Record<Product['type'], string> = {
  thiep: 'Thiệp',
  khung_anh: 'Khung Ảnh',
  so_scrapbook: 'Sổ & Scrapbook',
  khac: 'Các Sản Phẩm Khác',
  'set-qua-tang': 'Set Quà Tặng',
  in_anh: 'In Ảnh',
};

// Reached only via CategoryRail taps (or a direct link) — there is no hub
// page to breadcrumb back to, so this shows a plain browser-back pill.
export default function CategoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { products_page_size } = useFeatureFlags();

  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const fetchPage = useCallback(
    (pageNum: number) => getProducts({ category_ids: id, page: pageNum, limit: products_page_size }),
    [id, products_page_size]
  );

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setPage(1);

    Promise.all([getCategoryById(id), fetchPage(1)])
      .then(([cat, data]) => {
        if (cancelled) return;
        setCategory(cat);
        setProducts(data.products);
        setTotal(data.total);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Không thể tải danh mục');
          setCategory(null);
          setProducts([]);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [id, fetchPage]);

  const handleLoadMore = async () => {
    if (loadingMore) return;
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

  return (
    <div className="ps-page">
      <SiteHeader />
      <main className="ps-main">
        <button type="button" className="ps-back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M12.5 5L7.5 10L12.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Quay lại
        </button>

        {loading && <PageLoader />}
        {error && <div className="ps-error">{error}</div>}

        {!loading && !error && (
          <>
            <h1 className="ps-heading">
              {category?.name ?? 'Danh mục'} <span className="ps-count">({total})</span>
            </h1>

            {products.length === 0 && (
              <p className="ps-empty">Chưa có sản phẩm nào trong danh mục này.</p>
            )}

            {products.length > 0 && (
              <>
                <div className="thiep-grid">
                  {products.map(p => (
                    <Link key={p.id} to={`/product/${p.id}`} className="product-card product-card--link">
                      <div className="product-card-img-wrap">
                        <img
                          className="product-card-img"
                          src={getProductThumbnailUrl(p) ?? '/placeholder.png'}
                          alt={p.name}
                        />
                        <span className="cd-type-chip">{TYPE_LABELS[p.type] ?? p.type}</span>
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
                        <ProductSoldCount count={p.sold_count} />
                        <div className="product-card-price"><PriceTag product={p} /></div>
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
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
