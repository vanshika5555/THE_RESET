import './App.css';
import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';
import InstallApp from './components/InstallApp';
import InviteBanner from './components/InviteBanner';


// After a new version goes live, a page left open may ask for files that no
// longer exist. Reload once to pick up the new version instead of failing.
function lazyPage(load) {
  return lazy(() => load().then((mod) => {
    try { sessionStorage.removeItem('theresetChunkReload'); } catch { /* fine */ }
    return mod;
  }).catch((err) => {
    let tried = true;
    try { tried = sessionStorage.getItem('theresetChunkReload') === '1'; sessionStorage.setItem('theresetChunkReload', '1'); } catch { /* fine */ }
    if (!tried) { window.location.reload(); return new Promise(() => {}); }
    throw err;
  }));
}

// The home page comes with the first download; every other page is fetched
// the first time someone opens it, so phones start much faster.
const Men = lazyPage(() => import('./pages/Men'));
const Women = lazyPage(() => import('./pages/Women'));
const About = lazyPage(() => import('./pages/About'));
const AuthPage = lazyPage(() => import('./pages/AuthPage'));
const MyOrders = lazyPage(() => import('./pages/MyOrders'));
const WishlistPage = lazyPage(() => import('./pages/WishlistPage'));
const CheckoutRoute = lazyPage(() => import('./pages/CheckoutRoute'));
const ForgotPassword = lazyPage(() => import('./pages/ForgotPassword'));
const ResetPassword = lazyPage(() => import('./pages/ResetPassword'));
const Profile = lazyPage(() => import('./pages/Profile'));
const ProductDetail = lazyPage(() => import('./pages/ProductDetail'));
const SearchPage = lazyPage(() => import('./pages/SearchPage'));
const Help = lazyPage(() => import('./pages/Help'));
const Legal = lazyPage(() => import('./pages/Legal'));
const NotFound = lazyPage(() => import('./pages/NotFound'));
const OrderDetail = lazyPage(() => import('./pages/OrderDetail'));
const GiftCards = lazyPage(() => import('./pages/GiftCards'));

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <WishlistProvider>
          <Router>
            <ScrollToTop />
            <div className="App">
              <Navbar />
              <InviteBanner />
              <ErrorBoundary>
              <Suspense fallback={<div className="page-loading" aria-busy="true" />}>
              <Routes>
                <Route path="/"          element={<Home />} />
                <Route path="/men"       element={<Men />} />
                <Route path="/women"     element={<Women />} />
                <Route path="/about"     element={<About />} />
                <Route path="/login"     element={<AuthPage />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />
                <Route path="/orders"    element={<MyOrders />} />
                <Route path="/wishlist"  element={<WishlistPage />} />
                <Route path="/checkout"  element={<CheckoutRoute />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/help" element={<Help />} />
                <Route path="/gift-cards" element={<GiftCards />} />
                <Route path="/privacy" element={<Legal />} />
                <Route path="/terms" element={<Legal />} />
                <Route path="/profile/*" element={<Profile />} />

                <Route path="/orders/:id" element={<OrderDetail />} />

                {/* anything else */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
              </ErrorBoundary>
              <Footer />
              <InstallApp />
            </div>
          </Router>
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;