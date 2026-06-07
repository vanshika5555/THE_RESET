import React, { createContext, useState, useContext } from 'react';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);

  const addToCart = (product, size) => {
    setCart(prev => {
      const existing = prev.findIndex(i => i._id === product._id && i.size === size);
      if (existing !== -1) {
        const updated = [...prev];
        updated[existing].qty += 1;
        return updated;
      }
      return [...prev, { ...product, size, qty: 1 }];
    });
    setCartOpen(true);
  };

  const removeFromCart = (i) => setCart(prev => prev.filter((_, idx) => idx !== i));

  const changeQty = (i, qty) => setCart(prev => {
    const u = [...prev]; u[i].qty = qty; return u;
  });

  const clearCart = () => setCart([]);

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  return (
    <CartContext.Provider value={{
      cart, cartOpen, setCartOpen,
      addToCart, removeFromCart, changeQty, clearCart, cartCount
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);