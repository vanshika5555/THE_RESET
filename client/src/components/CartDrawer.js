import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { cartSubtotal } from "../utils/price";
import "./CartDrawer.css";

export default function CartDrawer({ cart, onClose, onRemove, onQtyChange, onCheckout }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const subtotal = cartSubtotal(cart);

  const handleCheckout = () => {
    onClose();
    if (!user) {
      navigate('/login');
      return;
    }
    navigate('/checkout');
  };

  return (
    <>
      <div className="cd-overlay" onClick={onClose} />
      <div className="cd-drawer">

        <div className="cd-header">
          <h3 className="cd-title">Shopping Bag ({cart.length})</h3>
          <button className="cd-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="cd-items">
          {cart.length === 0 ? (
            <p className="cd-empty">Your bag is empty.</p>
          ) : (
            cart.map((item, i) => (
              <div key={i} className="cd-item">
                <div className="cd-item-img">
                  {item.image ? (
                    <img src={item.image} alt={item.name} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: item.color || '#f0f0f0' }} />
                  )}
                </div>
                <div className="cd-item-info">
                  <p className="cd-item-name">{item.name}</p>
                  <p className="cd-item-price">{item.price}</p>
                  <p className="cd-item-size">Size: {item.size}</p>
                  <div className="cd-item-actions">
                    <div className="cd-qty">
                      <span>Quantity: </span>
                      <select
                        value={item.qty}
                        onChange={(e) => onQtyChange(i, parseInt(e.target.value))}
                        className="cd-qty-select"
                      >
                        {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <button className="cd-remove" onClick={() => onRemove(i)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                    <button className="cd-wish">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="cd-footer">
            <div className="cd-subtotal">
              <span>Subtotal</span>
              <span>₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
            <p className="cd-shipping">Shipping charges calculated at checkout.</p>
            <button className="cd-btn cd-btn--fill" onClick={handleCheckout}>
              {user ? 'Proceed to Checkout' : 'Login to Checkout'}
            </button>
          </div>
        )}

      </div>
    </>
  );
}