import React, { useState } from "react";
import StyleAnalyser from "./StyleAnalyser";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import CartDrawer from "./CartDrawer";
import "./Navbar.css";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [analyserOpen, setAnalyserOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { cart, cartOpen, setCartOpen, removeFromCart, changeQty, cartCount } = useCart();
  const { wishCount } = useWishlist();

  return (
    <>
      <div className="announcement-bar">
        <span>Discover What's New &nbsp;|&nbsp; <a href="#">Shop Now</a></span>
      </div>

      <nav className="navbar">
        <Link to="/" className="navbar-logo">THE RESET</Link>

        <button
          className={`hamburger ${menuOpen ? "open" : ""}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>

        <ul className={`nav-links ${menuOpen ? "active" : ""}`}>
          <li><Link to="/men"    onClick={() => setMenuOpen(false)}>Men</Link></li>
          <li><Link to="/women"  onClick={() => setMenuOpen(false)}>Women</Link></li>
          <li><Link to="/about"  onClick={() => setMenuOpen(false)}>About</Link></li>
        </ul>

        {/* Style Analyser button */}
        <button className="sa-nav-btn" onClick={() => setAnalyserOpen(true)}>
          ✦ Style Analyser
        </button>

        <div className="navbar-icons">

          {/* Wishlist */}
          <Link to="/wishlist" className="icon-btn navbar-icon-wrap" aria-label="Wishlist">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            {wishCount > 0 && <span className="navbar-badge">{wishCount}</span>}
          </Link>

          {/* Account / Auth */}
          {user ? (
            <div className="navbar-user">
              <span className="navbar-username">{user.name.split(" ")[0]}</span>
              <Link to="/profile" className="icon-btn" title="My Profile">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </Link>
              <button className="icon-btn" onClick={() => { logout(); navigate("/"); }} title="Logout">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          ) : (
            <Link to="/login" className="icon-btn" aria-label="Account">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </Link>
          )}

          {/* Cart */}
          <button className="icon-btn navbar-icon-wrap" aria-label="Cart" onClick={() => setCartOpen(true)}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
            {cartCount > 0 && <span className="navbar-badge">{cartCount}</span>}
          </button>

        </div>
      </nav>

      {/* Global Cart Drawer */}
      {cartOpen && (
        <CartDrawer
          cart={cart}
          onClose={() => setCartOpen(false)}
          onRemove={removeFromCart}
          onQtyChange={changeQty}
          onCheckout={() => setCartOpen(false)}
        />
      )}
      {/* Style Analyser Panel */}
      {analyserOpen && <StyleAnalyser onClose={() => setAnalyserOpen(false)} />}
    </>
  );
}