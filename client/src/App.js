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

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <WishlistProvider>
          <Router>
            <div className="App">
              <Navbar />
              <Routes>
                <Route path="/"          element={<Home />} />
                <Route path="/men"       element={<Men />} />
                <Route path="/women"     element={<Women />} />
                <Route path="/about"     element={<About />} />
                <Route path="/login"     element={<AuthPage />} />
                <Route path="/orders"    element={<MyOrders />} />
                <Route path="/wishlist"  element={<WishlistPage />} />
                <Route path="/checkout"  element={<CheckoutRoute />} />
                <Route path="/profile/*" element={<Profile />} />
              </Routes>
              <Footer />
            </div>
          </Router>
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;