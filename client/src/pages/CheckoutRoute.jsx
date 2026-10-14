import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import CheckoutPage from '../components/CheckoutPage';
import OrderConfirm from '../components/OrderConfirm';

export default function CheckoutRoute() {
  const { cart, clearCart } = useCart();
  const { user } = useAuth();
  // The placed order itself (CheckoutPage hands over the full order).
  const [placed, setPlaced] = useState(null);

  // Checked first: by this point the cart is empty, and that emptiness must
  // not bounce someone away from their own receipt.
  if (placed) return <OrderConfirm orderId={placed._id} order={placed} />;

  // An account is required to buy. Passing `from` means signing in returns
  // them here rather than dropping them on the homepage.
  if (!user) return <Navigate to="/login" replace state={{ from: '/checkout' }} />;

  if (cart.length === 0) return <Navigate to="/" replace />;

  return (
    <CheckoutPage
      cart={cart}
      onOrderSuccess={(order) => { setPlaced(order); clearCart(); window.scrollTo(0, 0); }}
    />
  );
}