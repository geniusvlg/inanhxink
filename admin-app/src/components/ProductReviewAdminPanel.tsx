import { useState, useEffect, useCallback } from 'react';
import { productsApi } from '../services/api';
import type { AdminProductReview } from '../types';
import { captureException } from '../utils/sentry';

interface Props {
  productId: number;
}

export default function ProductReviewAdminPanel({ productId }: Props) {
  const [adminReviews, setAdminReviews] = useState<AdminProductReview[]>([]);
  const [adminReviewsLoading, setAdminReviewsLoading] = useState(false);
  const [fakeReview, setFakeReview] = useState({
    customer_name: '',
    invoice_number: '',
    ordered_product_label: '',
    rating: 5,
    comment: '',
  });
  const [fakeReviewSubmitting, setFakeReviewSubmitting] = useState(false);

  const loadAdminReviews = useCallback((id: number) => {
    setAdminReviewsLoading(true);
    productsApi
      .listReviews(id, { page: 1, limit: 100 })
      .then((res) => setAdminReviews(res.data.reviews ?? []))
      .catch((err) => {
        captureException(err);
        setAdminReviews([]);
      })
      .finally(() => setAdminReviewsLoading(false));
  }, []);

  useEffect(() => {
    if (!productId) return;
    loadAdminReviews(productId);
  }, [productId, loadAdminReviews]);

  const handleFakeReviewSubmit = async () => {
    setFakeReviewSubmitting(true);
    try {
      await productsApi.createReview(productId, {
        rating: fakeReview.rating,
        comment: fakeReview.comment.trim(),
        customer_name: fakeReview.customer_name.trim(),
        invoice_number: fakeReview.invoice_number.trim(),
        ordered_product_label: fakeReview.ordered_product_label.trim(),
      });
      setFakeReview({ customer_name: '', invoice_number: '', ordered_product_label: '', rating: 5, comment: '' });
      loadAdminReviews(productId);
    } catch (err) {
      captureException(err);
      window.alert('Không thêm được đánh giá.');
    } finally {
      setFakeReviewSubmitting(false);
    }
  };

  const handleDeleteReview = async (reviewId: number) => {
    if (!window.confirm('Xoá đánh giá này? Điểm trung bình trên trang sản phẩm sẽ được cập nhật lại.')) return;
    try {
      await productsApi.deleteReview(productId, reviewId);
      loadAdminReviews(productId);
    } catch (err) {
      captureException(err);
      window.alert('Không xoá được.');
    }
  };

  return (
    <div className="form-group" style={{ marginTop: 0 }}>
      <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 1rem', lineHeight: 1.45 }}>
        Thêm đánh giá mẫu (không cần đơn thật) hoặc xoá bất kỳ đánh giá nào — điểm trung bình sản phẩm cập nhật theo DB.
      </p>

      <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <div>
            <label className="form-label" style={{ fontSize: '0.78rem' }}>Tên hiển thị *</label>
            <input
              className="form-input"
              value={fakeReview.customer_name}
              onChange={(e) => setFakeReview((f) => ({ ...f, customer_name: e.target.value }))}
              placeholder="Khách A."
              disabled={fakeReviewSubmitting}
            />
          </div>
          <div>
            <label className="form-label" style={{ fontSize: '0.78rem' }}>Mã đơn hàng (hiển thị) *</label>
            <input
              className="form-input"
              value={fakeReview.invoice_number}
              onChange={(e) => setFakeReview((f) => ({ ...f, invoice_number: e.target.value }))}
              placeholder="VD: DEMO-001"
              disabled={fakeReviewSubmitting}
            />
          </div>
        </div>
        <div style={{ marginBottom: '0.5rem' }}>
          <label className="form-label" style={{ fontSize: '0.78rem' }}>Dòng sản phẩm (hiển thị) *</label>
          <input
            className="form-input"
            value={fakeReview.ordered_product_label}
            onChange={(e) => setFakeReview((f) => ({ ...f, ordered_product_label: e.target.value }))}
            placeholder="Tên SP — Phân loại"
            disabled={fakeReviewSubmitting}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '0.5rem', alignItems: 'end', marginBottom: '0.5rem' }}>
          <div>
            <label className="form-label" style={{ fontSize: '0.78rem' }}>Sao *</label>
            <select
              className="form-input"
              value={fakeReview.rating}
              onChange={(e) => setFakeReview((f) => ({ ...f, rating: Number(e.target.value) }))}
              disabled={fakeReviewSubmitting}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="form-label" style={{ fontSize: '0.78rem' }}>Nội dung *</label>
            <textarea
              className="form-textarea"
              rows={2}
              value={fakeReview.comment}
              onChange={(e) => setFakeReview((f) => ({ ...f, comment: e.target.value }))}
              placeholder="Nội dung đánh giá…"
              disabled={fakeReviewSubmitting}
            />
          </div>
        </div>
        <button type="button" className="btn-secondary" disabled={fakeReviewSubmitting} onClick={() => { void handleFakeReviewSubmit(); }}>
          {fakeReviewSubmitting ? 'Đang thêm…' : '+ Thêm đánh giá mẫu'}
        </button>
      </div>

      {adminReviewsLoading ? (
        <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Đang tải đánh giá…</p>
      ) : adminReviews.length === 0 ? (
        <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Chưa có đánh giá.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '0.35rem 0.25rem' }}>Sao</th>
                <th style={{ padding: '0.35rem 0.25rem' }}>Khách</th>
                <th style={{ padding: '0.35rem 0.25rem' }}>Mã</th>
                <th style={{ padding: '0.35rem 0.25rem' }}>SP</th>
                <th style={{ padding: '0.35rem 0.25rem' }}>Nội dung</th>
                <th style={{ padding: '0.35rem 0.25rem' }} />
              </tr>
            </thead>
            <tbody>
              {adminReviews.map((rv) => (
                <tr key={rv.id} style={{ borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' }}>
                  <td style={{ padding: '0.4rem 0.25rem', whiteSpace: 'nowrap' }}>{rv.rating}★</td>
                  <td style={{ padding: '0.4rem 0.25rem', maxWidth: '100px', wordBreak: 'break-word' }}>{rv.customer_name}</td>
                  <td style={{ padding: '0.4rem 0.25rem', fontFamily: 'monospace', fontSize: '0.72rem' }}>{rv.invoice_number}</td>
                  <td style={{ padding: '0.4rem 0.25rem', maxWidth: '120px', wordBreak: 'break-word' }}>{rv.ordered_product_label}</td>
                  <td style={{ padding: '0.4rem 0.25rem', maxWidth: '200px', wordBreak: 'break-word' }}>{rv.comment}</td>
                  <td style={{ padding: '0.4rem 0.25rem', whiteSpace: 'nowrap' }}>
                    {rv.is_admin_entry && (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          background: '#fef3c7',
                          color: '#92400e',
                          padding: '0.1rem 0.3rem',
                          borderRadius: '4px',
                          marginRight: '0.25rem',
                        }}
                      >
                        Mẫu
                      </span>
                    )}
                    <button type="button" className="btn-danger" style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }} onClick={() => handleDeleteReview(rv.id)}>
                      Xoá
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
