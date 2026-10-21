import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

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
  // The piece just added, shown in a small "Added to bag" pop-up.
  const [justAdded, setJustAdded] = useState(null);
  const firstRun = useRef(true);
  const { user } = useAuth();

  // Signed in with an empty bag here (another device, or the reminder email)?
  // Bring back the bag saved on the account.
  useEffect(() => {
    if (!user || !axios.defaults.headers.common.Authorization) return;
    let active = true;
    axios.get('/api/auth/saved')
      .then((res) => {
        const saved = Array.isArray(res.data?.cart) ? res.data.cart : [];
        if (active && saved.length) setCart((now) => (now.length ? now : saved));
      })
      .catch(() => {});
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id || user?.email]);

  // "Back to your bag" links (?bag=open) open the bag drawer.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('bag') === 'open') {
        setCartOpen(true);
        url.searchParams.delete('bag');
        window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      }
    } catch { /* old browser — nothing to do */ }
  }, []);

  // Save the cart every time it changes.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // storage full or blocked - cart still works for this session
    }

    // Mirror it onto the account when signed in, so the bag follows the
    // customer to another device. Skipped on first load, and silent on
    // failure — syncing must never interrupt shopping.
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (!axios.defaults.headers.common.Authorization) return;

    const timer = setTimeout(() => {
      axios.put('/api/auth/cart', { cart }).catch(() => {});
    }, 800);                       // wait for rapid changes to settle

    return () => clearTimeout(timer);
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
    // A small pop-up instead of throwing the whole bag drawer over the page.
    setJustAdded({ product, size, at: Date.now() });
  };

  // Several pieces at once ("Buy again"): [{ product, size, qty }], then open the bag.
  const addManyToCart = (lines) => {
    if (!lines.length) return;
    setCart(prev => {
      const next = [...prev];
      for (const { product, size, qty } of lines) {
        const at = next.findIndex(i => i._id === product._id && i.size === size);
        if (at !== -1) next[at] = { ...next[at], qty: next[at].qty + qty };
        else next.push({ ...product, size, qty });
      }
      return next;
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
      cart, cartOpen, setCartOpen, justAdded, setJustAdded,
      addToCart, addManyToCart, removeFromCart, changeQty, clearCart, cartCount
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);