import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWishlist } from "../context/WishlistContext";
import { cartSubtotal, amountToFreeDelivery } from "../utils/price";
import "./CartDrawer.css";

const MAX_QTY = 5;

export default function CartDrawer({ cart, onClose, onRemove, onQtyChange, onCheckout }) {
  const { user } = useAuth();
  const { toggleWishlist, isWished } = useWishlist();
  const navigate = useNavigate();

  const subtotal = cartSubtotal(cart);
  const toFree = amountToFreeDelivery(subtotal);
  const count = cart.reduce((s, i) => s + i.qty, 0);

  // Escape closes; the page behind does not scroll while the bag is open.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const handleCheckout = () => {
    onClose();
    if (!user) {
      // Remember where they were headed so login does not dead-end at home.
      navigate('/login', { state: { from: '/checkout' } });
      return;
    }
    navigate('/checkout');
  };

  // Move a piece out of the bag and onto the wishlist.
  const saveForLater = (item, i) => {
    // eslint-disable-next-line no-unused-vars
    const { size, qty, ...product } = item;
    if (!isWished(product._id)) toggleWishlist(product);
    onRemove(i);
  };

  const openProduct = (item) => {
    onClose();
    navigate(`/product/${item._id}`);
  };

  return (
    <>
      <div className="cd-overlay" onClick={onClose} />
      <div className="cd-drawer" role="dialog" aria-modal="true" aria-label="Shopping bag">

        <div className="cd-header">
          <h3 className="cd-title">
            Shopping Bag {count > 0 && <span className="cd-title-count">({count})</span>}
          </h3>
          <button className="cd-close" onClick={onClose} aria-label="Close bag">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {cart.length > 0 && (
          <div className="cd-progress">
            {toFree > 0
              ? <p>Add <strong>₹{toFree.toLocaleString('en-IN')}</strong> more for free delivery.</p>
              : <p><strong>Free delivery</strong> on this order.</p>}
          </div>
        )}

        <div className="cd-items">
          {cart.length === 0 ? (
            <div className="cd-empty">
              <p>Your bag is empty.</p>
              <div className="cd-empty-actions">
                <button className="cd-btn cd-btn--outline" onClick={() => { onClose(); navigate('/men'); }}>Shop Men</button>
                <button className="cd-btn cd-btn--fill" onClick={() => { onClose(); navigate('/women'); }}>Shop Women</button>
              </div>
            </div>
          ) : (
            cart.map((item, i) => (
              <div key={`${item._id}-${item.size}-${i}`} className="cd-item">
                <button type="button" className="cd-item-img" onClick={() => openProduct(item)} aria-label={`View ${item.name}`}>
                  {item.image || (item.images && item.images[0]) ? (
                    <img src={item.image || item.images[0]} alt="" />
                  ) : (
                    <span style={{ display: 'block', width: '100%', height: '100%', background: item.color || '#f0f0f0' }} />
                  )}
                </button>

                <div className="cd-item-info">
                  <div className="cd-item-top">
                    <p className="cd-item-name">{item.name}</p>
                    <button className="cd-remove" onClick={() => onRemove(i)} aria-label={`Remove ${item.name} from bag`}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  </div>
                  <p className="cd-item-price">{item.price}</p>
                  <p className="cd-item-size">Size {item.size}</p>

                  <div className="cd-item-actions">
                    <div className="cd-stepper" role="group" aria-label={`Quantity of ${item.name}`}>
                      <button
                        type="button"
                        onClick={() => (item.qty <= 1 ? onRemove(i) : onQtyChange(i, item.qty - 1))}
                        aria-label={item.qty <= 1 ? 'Remove' : 'One less'}
                      >−</button>
                      <span aria-live="polite">{item.qty}</span>
                      <button
                        type="button"
                        onClick={() => onQtyChange(i, item.qty + 1)}
                        disabled={item.qty >= MAX_QTY}
                        aria-label="One more"
                      >+</button>
                    </div>

                    <button className="cd-wish" onClick={() => saveForLater(item, i)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                      </svg>
                      Save for later
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
            <p className="cd-shipping">Delivery and any coupon are worked out at checkout.</p>
            <button className="cd-btn cd-btn--fill" onClick={handleCheckout}>
              {user ? 'Proceed to Checkout' : 'Sign In to Checkout'}
            </button>
          </div>
        )}

      </div>
    </>
  );
}
