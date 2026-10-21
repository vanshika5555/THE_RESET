import { useState } from 'react';
import { cachedGet } from '../utils/fetchCache';
import { useCart } from '../context/CartContext';

/*
  "Buy again": puts an earlier order's pieces back in the bag — same sizes,
  today's prices — leaving out anything that's sold out or no longer sold.
  Returns [buyAgain(order), busy, message].
*/
const left = (p, size) => {
  if (!p || p.inStock === false) return 0;
  if (!p.stock || !p.stock.length) return Infinity;
  const e = p.stock.find((s) => s.size === size);
  return e ? e.qty : 0;
};

export default function useBuyAgain() {
  const { addManyToCart } = useCart();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const buyAgain = async (order) => {
    setBusy(true); setMessage('');
    const lines = [];
    const missed = [];
    for (const item of order.items || []) {
      const id = item.product?._id || item.product;
      let p = null;
      try { p = await cachedGet(`/api/products/${id}`); } catch { p = null; }
      const qty = Math.min(Number(item.qty) || 1, left(p, item.size));
      if (!p || qty <= 0 || (p.sizes && !p.sizes.includes(item.size))) { missed.push(`${item.name} (${item.size})`); continue; }
      lines.push({ product: p, size: item.size, qty });
      if (qty < (Number(item.qty) || 1)) missed.push(`${(Number(item.qty) || 1) - qty} × ${item.name} (${item.size})`);
    }
    addManyToCart(lines);
    if (!lines.length) setMessage('Everything from this order is sold out right now.');
    else if (missed.length) setMessage(`Added to your bag. Sold out now, so left out: ${missed.join(', ')}.`);
    setBusy(false);
  };

  return [buyAgain, busy, message];
}
