import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Men from './pages/Men';
import Women from './pages/Women';
import About from './pages/About';
import AuthPage from './pages/AuthPage';
import MyOrders from './pages/MyOrders';
import WishlistPage from './pages/WishlistPage';
import CheckoutRoute from './pages/CheckoutRoute';
import Profile from './pages/Profile';
import ProductDetail from './pages/ProductDetail';
import SearchPage from './pages/SearchPage';
import Help from './pages/Help';
import Legal from './pages/Legal';
import NotFound from './pages/NotFound';
import OrderDetail from './pages/OrderDetail';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <WishlistProvider>
          <Router>
            <ScrollToTop />
            <div className="App">
              <Navbar />
              <ErrorBoundary>
              <Routes>
                <Route path="/"          element={<Home />} />
                <Route path="/men"       element={<Men />} />
                <Route path="/women"     element={<Women />} />
                <Route path="/about"     element={<About />} />
                <Route path="/login"     element={<AuthPage />} />
                <Route path="/orders"    element={<MyOrders />} />
                <Route path="/wishlist"  element={<WishlistPage />} />
                <Route path="/checkout"  element={<CheckoutRoute />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/help" element={<Help />} />
                <Route path="/privacy" element={<Legal />} />
                <Route path="/terms" element={<Legal />} />
                <Route path="/profile/*" element={<Profile />} />

                <Route path="/orders/:id" element={<OrderDetail />} />

                {/* anything else */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              </ErrorBoundary>
              <Footer />
            </div>
          </Router>
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;