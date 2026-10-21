import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Sidebar.css';

// Where the customer-facing shop lives. Set REACT_APP_SITE_URL in Vercel.
const SITE_URL = import.meta.env.REACT_APP_SITE_URL || 'http://localhost:3001';

const icons = {
  dashboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  orders: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="2"/><line x1="9" y1="12" x2="15" y2="12"/>
      <line x1="9" y1="16" x2="13" y2="16"/>
    </svg>
  ),
  customers: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  discounts: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M20 12a2 2 0 0 1 2-2V7a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v3a2 2 0 0 1 0 4v3a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-3a2 2 0 0 1-2-2z"/>
      <path d="M9 9l6 6M9.5 9.5h.01M14.5 14.5h.01"/>
    </svg>
  ),
  products: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  ),
  returns: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <polyline points="9 14 4 9 9 4"/>
      <path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
    </svg>
  ),
  reports: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx="1"/>
      <rect x="12" y="8" width="3" height="10" rx="1"/><rect x="17" y="5" width="3" height="13" rx="1"/>
    </svg>
  ),
  reviews: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/>
    </svg>
  ),
  team: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18.5 14.5A6.5 6.5 0 0 1 21.5 20"/>
    </svg>
  ),
  gift: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="8" width="18" height="13" rx="1.5"/><path d="M3 12h18"/><path d="M12 8v13"/><path d="M12 8c-1.5-3.5-5.5-4-5.5-1.5S10 8 12 8zM12 8c1.5-3.5 5.5-4 5.5-1.5S14 8 12 8z"/>
    </svg>
  ),
  security: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>
    </svg>
  ),
  add: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="16"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  ),
};

// Desktop sidebar
const LINKS = [
  { to: '/',             label: 'Dashboard',   icon: icons.dashboard },
  { to: '/orders',       label: 'Orders',      icon: icons.orders },
  { to: '/returns',      label: 'Returns',     icon: icons.returns },
  { to: '/reports',      label: 'Reports',     icon: icons.reports, owner: true },
  { to: '/customers',    label: 'Customers',   icon: icons.customers, owner: true },
  { to: '/reviews',      label: 'Reviews',     icon: icons.reviews },
  { to: '/coupons',      label: 'Discount codes', icon: icons.discounts, owner: true },
  { to: '/gift-cards',   label: 'Gift cards',  icon: icons.gift, owner: true },
  { to: '/products',     label: 'Products',    icon: icons.products },
  { to: '/products/add', label: 'Add product', icon: icons.add },
  { to: '/team',         label: 'Team',        icon: icons.team, owner: true },
  { to: '/security',     label: 'Security',    icon: icons.security },
];

// Phone bottom tab bar — five tabs, thumb-reachable. "Add Product" lives
// as a floating button on the Products tab instead.
const TABS = [
  { to: '/',          label: 'Home',      icon: icons.dashboard },
  { to: '/orders',    label: 'Orders',    icon: icons.orders },
  { to: '/products',  label: 'Products',  icon: icons.products },
  { to: '/customers', label: 'Customers', icon: icons.customers, owner: true },
  { to: '/returns',   label: 'Returns',   icon: icons.returns },
  { to: '/coupons',   label: 'Discounts', icon: icons.discounts, owner: true },
  { to: '/reviews',   label: 'Reviews',   icon: icons.reviews, staffOnly: true },
];

const isActive = (pathname, to) => {
  if (to === '/') return pathname === '/';
  if (to === '/products') return pathname === '/products' || pathname.startsWith('/products/edit');
  return pathname === to;
};

export default function Sidebar({ role = 'admin' }) {
  const { pathname } = useLocation();
  // Staff don't see the owner's pages (customers, discounts, reports, team).
  const owner = role === 'admin';
  const links = LINKS.filter((l) => owner || !l.owner);
  const tabs = TABS.filter((t) => (owner ? !t.staffOnly : !t.owner));

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-logo">THE RESET</span>
          <span className="sidebar-sub">Shop admin</span>
        </div>

        <nav className="sidebar-nav">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`sidebar-link ${isActive(pathname, l.to) ? 'sidebar-link--active' : ''}`}
            >
              {l.icon}
              <span>{l.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <a href={SITE_URL} target="_blank" rel="noreferrer" className="sidebar-view-site">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Open the shop
          </a>
        </div>
      </aside>

      <nav className="bottom-nav" aria-label="Main">
        {tabs.map((t) => {
          const active = isActive(pathname, t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`bottom-nav-item ${active ? 'bottom-nav-item--active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              {t.icon}
              <span>{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}