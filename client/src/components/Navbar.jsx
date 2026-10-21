import React, { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { getProducts } from "../utils/fetchCache";
import { cdn } from "../utils/img";
// Only downloaded when someone opens it.
const StyleAnalyser = lazy(() => import("./StyleAnalyser"));
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { searchProducts } from '../utils/search';
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import CartDrawer from "./CartDrawer";
import AddedToast from "./AddedToast";
import "./Navbar.css";
import Price from './Price';

const Icon = {
  search: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  heart: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  ),
  user: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  logout: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  bag: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  ),
  close: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  chevron: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24" aria-hidden="true">
      <polyline points="9 6 15 12 9 18"/>
    </svg>
  ),
};

// Facts the shop actually stands behind (see Help page and price.js).
const MARQUEE = [
  'Free delivery over ₹1,999',
  'Dispatched within 2 working days',
  '7-day returns',
  'Only black. Only white.',
  'Size guide on every piece',
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [catalog, setCatalog] = useState([]);       // for search suggestions
  const [hi, setHi] = useState(-1);                 // highlighted suggestion
  const [analyserOpen, setAnalyserOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { cart, cartOpen, setCartOpen, removeFromCart, changeQty, cartCount } = useCart();
  const { wishCount } = useWishlist();

  // Any navigation closes the menu and the search bar.
  useEffect(() => { setMenuOpen(false); setSearchOpen(false); }, [pathname]);

  // While the menu is open: the page behind stays put, and Escape closes it.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  // Load the catalogue once, the first time search opens (shared cache, so
  // it is usually already there from the page behind).
  useEffect(() => {
    if (!searchOpen || catalog.length) return;
    getProducts().then(d => setCatalog(Array.isArray(d) ? d : [])).catch(() => {});
  }, [searchOpen, catalog.length]);

  // Same forgiving search as the results page (spelling slips, plurals, "for women").
  const suggestions = useMemo(() => {
    if (term.trim().length < 2) return [];
    return searchProducts(catalog, term, { limit: 6 }).results;
  }, [term, catalog]);

  useEffect(() => { setHi(-1); }, [term]);

  const openProduct = (p) => {
    setSearchOpen(false);
    setTerm("");
    navigate(`/product/${p._id}`);
  };

  const onSearchKey = (e) => {
    if (e.key === "Escape") { setSearchOpen(false); return; }
    if (!suggestions.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHi(h => (h + 1) % suggestions.length); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setHi(h => (h <= 0 ? suggestions.length - 1 : h - 1)); }
  };

  const submitSearch = (e) => {
    e.preventDefault();
    if (hi >= 0 && suggestions[hi]) { openProduct(suggestions[hi]); return; }
    const q = term.trim();
    if (!q) return;
    setSearchOpen(false);
    setTerm("");
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  const signOut = () => {
    setMenuOpen(false);
    logout();
    navigate("/");
  };

  const firstName = user?.name ? user.name.split(" ")[0] : "";

  return (
    <>
      {/* Store promises, scrolling. Two copies of the strip make the loop seamless. */}
      <div className="announcement-bar" role="region" aria-label="Store information">
        <div className="marquee">
          {[0, 1].map(copy => (
            <ul className="marquee-strip" key={copy} aria-hidden={copy === 1}>
              {MARQUEE.map(t => <li key={t}>{t}</li>)}
            </ul>
          ))}
        </div>
      </div>

      <nav className="navbar" aria-label="Main">
        {/* Phone: menu button on the left */}
        <button
          className="icon-btn nav-menu-btn"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
        >
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24" aria-hidden="true">
            <line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/>
          </svg>
        </button>

        <Link to="/" className="navbar-logo" aria-label="THE RESET home">THE RESET</Link>

        {/* Desktop links */}
        <ul className="nav-links">
          <li><NavLink to="/men">Men</NavLink></li>
          <li><NavLink to="/women">Women</NavLink></li>
          <li><NavLink to="/about">About</NavLink></li>
        </ul>

        <button className="sa-nav-btn" onClick={() => setAnalyserOpen(true)}>
          ✦ Style Analyser
        </button>

        <div className="navbar-icons">
          <button
            className="icon-btn"
            aria-label={searchOpen ? "Close search" : "Search"}
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((o) => !o)}
          >
            {Icon.search}
          </button>

          {/* Wishlist and account move into the menu on a phone */}
          <Link to="/wishlist" className="icon-btn navbar-icon-wrap nav-desktop-only" aria-label={`Wishlist${wishCount ? `, ${wishCount} saved` : ""}`}>
            {Icon.heart}
            {wishCount > 0 && <span className="navbar-badge">{wishCount}</span>}
          </Link>

          {user ? (
            <div className="navbar-user nav-desktop-only">
              <span className="navbar-username">{firstName}</span>
              <Link to="/profile" className="icon-btn" aria-label="My account" title="My account">
                {Icon.user}
              </Link>
              <button className="icon-btn" onClick={signOut} aria-label="Sign out" title="Sign out">
                {Icon.logout}
              </button>
            </div>
          ) : (
            <Link to="/login" className="icon-btn nav-desktop-only" aria-label="Sign in" title="Sign in">
              {Icon.user}
            </Link>
          )}

          <button
            className="icon-btn navbar-icon-wrap"
            aria-label={`Bag${cartCount ? `, ${cartCount} item${cartCount !== 1 ? "s" : ""}` : ""}`}
            onClick={() => setCartOpen(true)}
          >
            {Icon.bag}
            {/* keyed on the count, so the badge replays its little bounce on every add */}
            {cartCount > 0 && <span className="navbar-badge navbar-badge--bump" key={cartCount}>{cartCount}</span>}
          </button>
        </div>
      </nav>

      {/* Search bar — full width so it fits any screen */}
      {searchOpen && (
        <form className="navbar-search" onSubmit={submitSearch} role="search">
          <input
            className="navbar-search-input"
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={onSearchKey}
            placeholder="Search shirts, dresses, blazers…"
            aria-label="Search the collection"
            role="combobox"
            aria-expanded={suggestions.length > 0}
            aria-controls="search-suggest"
            aria-activedescendant={hi >= 0 ? `sugg-${hi}` : undefined}
            autoComplete="off"
            autoFocus
          />
          <button type="submit" className="navbar-search-go">Search</button>
          <button
            type="button"
            className="navbar-search-close"
            aria-label="Close search"
            onClick={() => { setSearchOpen(false); setTerm(""); }}
          >
            {Icon.close}
          </button>

          {term.trim().length >= 2 && (
            <div className="sugg" id="search-suggest" role="listbox" aria-label="Suggestions">
              {suggestions.length === 0 ? (
                <p className="sugg-empty">No pieces match “{term.trim()}”. Try “shirt” or “blazer”.</p>
              ) : (
                <>
                  {suggestions.map((p, i) => {
                    const img = (p.images && p.images[0]) || p.image;
                    return (
                      <button
                        type="button"
                        key={p._id}
                        id={`sugg-${i}`}
                        role="option"
                        aria-selected={hi === i}
                        className={`sugg-item ${hi === i ? "sugg-item--on" : ""}`}
                        onMouseEnter={() => setHi(i)}
                        onClick={() => openProduct(p)}
                      >
                        <span className="sugg-img" style={{ background: p.color || "#f2f2f1" }}>
                          {img && <img src={cdn(img, 96)} alt="" />}
                        </span>
                        <span className="sugg-text">
                          <span className="sugg-name">{p.name}</span>
                          <span className="sugg-meta">{p.category} · {p.subcategory}</span>
                        </span>
                        <span className="sugg-price"><Price value={p.price} mrp={p.mrp} /></span>
                      </button>
                    );
                  })}
                  <button type="submit" className="sugg-all">See all results for “{term.trim()}”</button>
                </>
              )}
            </div>
          )}
        </form>
      )}

      {/* Phone menu — slides in from the left */}
      {menuOpen && (
        <div className="mnav-root">
          <div className="mnav-scrim" onClick={() => setMenuOpen(false)} />
          <aside className="mnav" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="mnav-head">
              <span className="mnav-logo">THE RESET</span>
              <button className="icon-btn" onClick={() => setMenuOpen(false)} aria-label="Close menu">
                {Icon.close}
              </button>
            </div>

            <div className="mnav-body">
              {user ? (
                <Link to="/profile" className="mnav-account">
                  <span className="mnav-avatar">{firstName.charAt(0).toUpperCase()}</span>
                  <span className="mnav-account-text">
                    <strong>Hi, {firstName}</strong>
                    <span>View your account</span>
                  </span>
                  {Icon.chevron}
                </Link>
              ) : (
                <Link to="/login" className="mnav-signin">Sign in or create an account</Link>
              )}

              <nav className="mnav-group" aria-label="Shop">
                <NavLink to="/men" className="mnav-link mnav-link--big">Men {Icon.chevron}</NavLink>
                <NavLink to="/women" className="mnav-link mnav-link--big">Women {Icon.chevron}</NavLink>
                <Link to="/search?q=new" className="mnav-link">New arrivals {Icon.chevron}</Link>
                <button
                  type="button"
                  className="mnav-link"
                  onClick={() => { setMenuOpen(false); setAnalyserOpen(true); }}
                >
                  ✦ Style Analyser {Icon.chevron}
                </button>
              </nav>

              <nav className="mnav-group" aria-label="Your things">
                <Link to="/wishlist" className="mnav-link">
                  <span className="mnav-link-icon">{Icon.heart}</span>
                  Wishlist
                  {wishCount > 0 && <span className="mnav-count">{wishCount}</span>}
                </Link>
                {user && (
                  <Link to="/orders" className="mnav-link">
                    <span className="mnav-link-icon">{Icon.bag}</span>
                    My orders
                  </Link>
                )}
              </nav>

              <nav className="mnav-group mnav-group--quiet" aria-label="About">
                <Link to="/about" className="mnav-link">Our story</Link>
                <Link to="/help" className="mnav-link">Help &amp; delivery</Link>
              </nav>
            </div>

            {user && (
              <button type="button" className="mnav-signout" onClick={signOut}>
                {Icon.logout} Sign out
              </button>
            )}
          </aside>
        </div>
      )}

      <AddedToast />

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
      {analyserOpen && <Suspense fallback={null}><StyleAnalyser onClose={() => setAnalyserOpen(false)} /></Suspense>}
    </>
  );
}
