import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import CheckoutPage from '../components/CheckoutPage';
import OrderConfirm from '../components/OrderConfirm';

export default function CheckoutRoute() {
  const { cart, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orderId, setOrderId] = useState(null);

  if (!user) { navigate('/login'); return null; }
  if (cart.length === 0 && !orderId) { navigate('/'); return null; }

  if (orderId) return <OrderConfirm orderId={orderId} />;

  return (
    <CheckoutPage
      cart={cart}
      onOrderSuccess={(id) => { setOrderId(id); clearCart(); }}
    />
  );
}