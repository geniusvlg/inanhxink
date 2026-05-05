import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import './CartDrawer.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

function fmt(n: number) {
  return new Intl.NumberFormat('vi-VN').format(n) + 'đ';
}

export default function CartDrawer({ open, onClose }: Props) {
  const { items, subtotal, updateQty, removeItem } = useCart();
  const navigate = useNavigate();

  const handleCheckout = () => {
    onClose();
    navigate('/checkout');
  };

  return (
    <>
      <div
        className={`cart-overlay${open ? ' cart-overlay--open' : ''}`}
        onClick={onClose}
        aria-hidden
      />
      <aside className={`cart-drawer${open ? ' cart-drawer--open' : ''}`} aria-label="Giỏ hàng">
        <div className="cart-drawer-header">
          <h2 className="cart-drawer-title">Giỏ hàng</h2>
          <button className="cart-drawer-close" onClick={onClose} aria-label="Đóng">✕</button>
        </div>

        <div className="cart-drawer-body">
          {items.length === 0 ? (
            <p className="cart-empty">Giỏ hàng trống</p>
          ) : (
            <ul className="cart-list">
              {items.map(item => (
                <li key={item.product_id} className="cart-item">
                  {item.thumbnail && (
                    <img src={item.thumbnail} alt={item.product_name} className="cart-item-img" />
                  )}
                  <div className="cart-item-info">
                    <span className="cart-item-name">{item.product_name}</span>
                    <span className="cart-item-price">{fmt(item.unit_price)}</span>
                    <div className="cart-item-qty">
                      <button
                        onClick={() => updateQty(item.product_id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                      >−</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateQty(item.product_id, item.quantity + 1)}>+</button>
                    </div>
                  </div>
                  <button
                    className="cart-item-remove"
                    onClick={() => removeItem(item.product_id)}
                    aria-label="Xoá"
                  >✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="cart-drawer-footer">
            <div className="cart-subtotal">
              <span>Tạm tính</span>
              <strong>{fmt(subtotal)}</strong>
            </div>
            <button className="cart-checkout-btn" onClick={handleCheckout}>
              Thanh toán
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
