import { useState } from 'react';
import './ProductFilter.css';

export interface FilterState {
  category_ids: number[];
  min_price: string;
  max_price: string;
  sort: 'newest' | 'price_asc' | 'price_desc';
}

export const DEFAULT_FILTERS: FilterState = {
  category_ids: [],
  min_price: '',
  max_price: '',
  sort: 'newest',
};

interface Props {
  categories: { id: number; name: string }[];
  filters: FilterState;
  onChange: (f: FilterState) => void;
  resultCount: number;
  accentColor?: string; // e.g. '#fe2c56' for thiep, '#2563eb' for khung anh
}

const SORT_OPTIONS: { value: FilterState['sort']; label: string }[] = [
  { value: 'newest',     label: 'Mới nhất' },
  { value: 'price_asc',  label: 'Giá tăng dần' },
  { value: 'price_desc', label: 'Giá giảm dần' },
];

export default function ProductFilter({ categories, filters, onChange, resultCount, accentColor = '#fe2c56' }: Props) {
  const [open, setOpen] = useState(false);

  const activeCount =
    filters.category_ids.length +
    (filters.min_price ? 1 : 0) +
    (filters.max_price ? 1 : 0) +
    (filters.sort !== 'newest' ? 1 : 0);

  const toggleCategory = (id: number) => {
    const ids = filters.category_ids.includes(id)
      ? filters.category_ids.filter(x => x !== id)
      : [...filters.category_ids, id];
    onChange({ ...filters, category_ids: ids });
  };

  const reset = () => onChange(DEFAULT_FILTERS);

  const filterSections = (
    <>
      {/* Sort */}
      <div className="pf-section">
        <div className="pf-section-title">Sắp xếp</div>
        <div className="pf-sort-group">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`pf-sort-btn${filters.sort === opt.value ? ' pf-sort-btn--active' : ''}`}
              style={filters.sort === opt.value ? { borderColor: accentColor, color: accentColor } : undefined}
              onClick={() => onChange({ ...filters, sort: opt.value })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Categories */}
      {categories.length > 0 && (
        <div className="pf-section">
          <div className="pf-section-title">Danh mục</div>
          <div className="pf-categories">
            {categories.map(c => (
              <label key={c.id} className="pf-check-label">
                <input
                  type="checkbox"
                  className="pf-check"
                  checked={filters.category_ids.includes(c.id)}
                  onChange={() => toggleCategory(c.id)}
                  style={{ accentColor }}
                />
                <span className="pf-check-text">{c.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Price */}
      <div className="pf-section">
        <div className="pf-section-title">Giá (đ)</div>
        <div className="pf-price-row">
          <input
            className="pf-price-input"
            type="number"
            placeholder="Từ"
            value={filters.min_price}
            min={0}
            onChange={e => onChange({ ...filters, min_price: e.target.value })}
          />
          <span className="pf-price-dash">—</span>
          <input
            className="pf-price-input"
            type="number"
            placeholder="Đến"
            value={filters.max_price}
            min={0}
            onChange={e => onChange({ ...filters, max_price: e.target.value })}
          />
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────── */}
      <aside className="pf-sidebar">
        <div className="pf-sidebar-head">
          <span className="pf-sidebar-title">Bộ lọc</span>
          {activeCount > 0 && (
            <button className="pf-reset-link" onClick={reset}>Đặt lại</button>
          )}
        </div>
        {filterSections}
      </aside>

      {/* ── Mobile bar (always visible) ─────────────────────── */}
      <div className="pf-mobile-bar">
        <button
          className={`pf-mobile-btn${activeCount > 0 ? ' pf-mobile-btn--active' : ''}`}
          style={activeCount > 0 ? { borderColor: accentColor, color: accentColor } : undefined}
          onClick={() => setOpen(true)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="4" y1="6"  x2="20" y2="6"/>
            <line x1="8" y1="12" x2="20" y2="12"/>
            <line x1="12" y1="18" x2="20" y2="18"/>
          </svg>
          Bộ lọc{activeCount > 0 && <span className="pf-badge">{activeCount}</span>}
        </button>
        <span className="pf-result-count">{resultCount} sản phẩm</span>
      </div>

      {/* ── Mobile bottom sheet ──────────────────────────────── */}
      {open && (
        <div className="pf-overlay" onClick={() => setOpen(false)}>
          <div className="pf-sheet" onClick={e => e.stopPropagation()}>
            <div className="pf-sheet-handle" />
            <div className="pf-sheet-header">
              <span className="pf-sheet-title">Bộ lọc &amp; Sắp xếp</span>
              <button className="pf-sheet-close" onClick={() => setOpen(false)} aria-label="Đóng">✕</button>
            </div>
            <div className="pf-sheet-body">
              {filterSections}
            </div>
            <div className="pf-sheet-footer">
              {activeCount > 0 && (
                <button className="pf-sheet-reset" onClick={reset}>Đặt lại</button>
              )}
              <button
                className="pf-sheet-apply"
                style={{ background: accentColor }}
                onClick={() => setOpen(false)}
              >
                Xem {resultCount} sản phẩm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
