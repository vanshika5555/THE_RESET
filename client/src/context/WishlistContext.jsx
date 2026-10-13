import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import axios from 'axios';

const WishlistContext = createContext();

const STORAGE_KEY = 'thereset_wishlist';

// Load whatever was saved last time, once, when the app starts.
const loadWishlist = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export function WishlistProvider({ children }) {
  const [wishlist, setWishlist] = useState(loadWishlist);
  const firstRun = useRef(true);

  // Save on every change so a refresh never loses it.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(wishlist));
    } catch {
      // storage full or blocked — the list still works for this session
    }

    // Mirror onto the account when signed in. Silent on failure.
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (!axios.defaults.headers.common.Authorization) return;

    const timer = setTimeout(() => {
      axios.put('/api/auth/wishlist', { wishlist: wishlist.map(p => p._id) })
        .catch(() => {});
    }, 800);

    return () => clearTimeout(timer);
  }, [wishlist]);

  const toggleWishlist = (product) => {
    setWishlist(prev =>
      prev.some(p => p._id === product._id)
        ? prev.filter(p => p._id !== product._id)
        : [...prev, product]
    );
  };

  const removeFromWishlist = (id) =>
    setWishlist(prev => prev.filter(p => p._id !== id));

  const clearWishlist = () => setWishlist([]);

  const isWished = (id) => wishlist.some(p => p._id === id);

  return (
    <WishlistContext.Provider value={{
      wishlist, toggleWishlist, removeFromWishlist, clearWishlist, isWished,
      wishCount: wishlist.length,
    }}>
      {children}
    </WishlistContext.Provider>
  );
}

export const useWishlist = () => useContext(WishlistContext);