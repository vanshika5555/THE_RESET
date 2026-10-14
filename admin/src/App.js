import './App.css';
import { useState, useEffect, lazy, Suspense } from 'react';
import axios from 'axios';
import {
  BrowserRouter as Router, Routes, Route,
  useLocation, useNavigate, matchPath,
} from 'react-router-dom';
import Sidebar from './components/Sidebar';
import AdminLogin from './components/AdminLogin';

// Each page loads only when it is opened, so the first screen downloads less.
const Dashboard   = lazy(() => import('./components/Dashboard'));
const Products    = lazy(() => import('./components/Products'));
const AddProduct  = lazy(() => import('./components/AddProduct'));
const EditProduct = lazy(() => import('./components/EditProduct'));
const AdminOrders = lazy(() => import('./components/AdminOrders'));
const Customers   = lazy(() => import('./components/Customers'));
const Coupons     = lazy(() => import('./components/Coupons'));
const Returns     = lazy(() => import('./components/Returns'));

// After the first screen is up, quietly download the other pages so
// tapping a tab opens instantly instead of flashing "Loading…".
const preloadPages = () => {
  import('./components/Dashboard');
  import('./components/AdminOrders');
  import('./components/Products');
  import('./components/Customers');
  import('./components/Coupons');
  import('./components/Returns');
  import('./components/EditProduct');
  import('./components/AddProduct');
};

const TOKEN_KEY = 'theresetAdminToken';
const NAME_KEY  = 'theresetAdminName';
const SITE_URL  = import.meta.env.REACT_APP_SITE_URL || 'http://localhost:3001';

// Attach the saved token to every request from the moment the app loads.
const savedToken = localStorage.getItem(TOKEN_KEY);
if (savedToken) {
  axios.defaults.headers.common.Authorization = `Bearer ${savedToken}`;
}

// Page title in the top bar (most specific first).
const TITLES = [
  ['/products/add',      'Add product'],
  ['/products/edit/:id', 'Edit product'],
  ['/products',          'Products'],
  ['/orders',            'Orders'],
  ['/customers',         'Customers'],
  ['/coupons',           'Discount codes'],
  ['/returns',           'Returns'],
  ['/',                  'Dashboard'],
];

const titleFor = (pathname) => {
  const hit = TITLES.find(([path]) => matchPath({ path, end: true }, pathname));
  return hit ? hit[1] : 'Admin';
};

function Shell({ name, onLogout }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isForm = pathname.startsWith('/products/add') || pathname.startsWith('/products/edit');

  useEffect(() => {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
    idle(preloadPages);
  }, []);

  // Every screen opens at the top, like an app.
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  useEffect(() => {
    document.title = `${titleFor(pathname)} · THE RESET Admin`;
  }, [pathname]);

  return (
    <div className={`admin-layout ${isForm ? 'admin-layout--form' : ''}`}>
      <Sidebar />

      <main className="admin-main">
        <header className="admin-topbar">
          {isForm && (
            <button
              className="icon-btn admin-topbar-back"
              onClick={() => navigate('/products')}
              aria-label="Back to products"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}

          <h1 className="admin-topbar-title">{titleFor(pathname)}</h1>

          <span className="admin-topbar-user only-desktop">
            {name ? `Signed in as ${name}` : 'Signed in'}
          </span>

          <a
            className="icon-btn"
            href={SITE_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Open the shop"
            title="Open the shop"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>

          <button className="btn btn--secondary btn--sm only-desktop" onClick={onLogout}>
            Log out
          </button>
          <button className="icon-btn only-mobile" onClick={onLogout} aria-label="Log out">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </header>

        <div className="admin-content">
          <Suspense fallback={<div className="loading">Loading…</div>}>
          <Routes>
            <Route path="/" element={<Dashboard name={name} />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/add" element={<AddProduct />} />
            <Route path="/products/edit/:id" element={<EditProduct />} />
            <Route path="/orders" element={<AdminOrders />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/coupons" element={<Coupons />} />
            <Route path="/returns" element={<Returns />} />
          </Routes>
          </Suspense>
        </div>
      </main>
    </div>
  );
}

function App() {
  const [token, setToken] = useState(savedToken || '');
  const [name, setName]   = useState(localStorage.getItem(NAME_KEY) || '');

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(NAME_KEY);
    localStorage.removeItem('theresetDashCache');   // saved dashboard numbers
    delete axios.defaults.headers.common.Authorization;
    setToken('');
    setName('');
  };

  // If the server ever rejects our token, drop straight back to the login screen.
  useEffect(() => {
    const id = axios.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
          handleLogout();
        }
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, []);

  const handleLogin = (newToken, adminName) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(NAME_KEY, adminName || '');
    axios.defaults.headers.common.Authorization = `Bearer ${newToken}`;
    setToken(newToken);
    setName(adminName || '');
  };

  if (!token) return <AdminLogin onLogin={handleLogin} />;

  return (
    <Router>
      <Shell name={name} onLogout={handleLogout} />
    </Router>
  );
}

export default App;
