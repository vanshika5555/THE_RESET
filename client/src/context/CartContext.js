import React, { createContext, useState, useContext, useEffect } from 'react';

const CartContext = createContext();

const STORAGE_KEY = 'thereset_cart';

// Read the saved cart once, when the app first loads.
const loadCart = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export function CartProvider({ children }) {
  const [cart, setCart] = useState(loadCart);
  const [cartOpen, setCartOpen] = useState(false);

  // Save the cart every time it changes.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // storage full or blocked - cart still works for this session
    }
  }, [cart]);

  const addToCart = (product, size) => {
    setCart(prev => {
      const existing = prev.findIndex(i => i._id === product._id && i.size === size);
      if (existing !== -1) {
        return prev.map((item, idx) =>
          idx === existing ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { ...product, size, qty: 1 }];
    });
    setCartOpen(true);
  };

  const removeFromCart = (i) => setCart(prev => prev.filter((_, idx) => idx !== i));

  const changeQty = (i, qty) =>
    setCart(prev => prev.map((item, idx) => (idx === i ? { ...item, qty } : item)));

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