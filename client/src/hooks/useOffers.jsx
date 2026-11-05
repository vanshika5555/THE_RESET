import { useEffect, useState } from 'react';
import { cachedGet } from '../utils/fetchCache';
import { parsePrice } from '../utils/price';
import { bestOffer, nextOffer } from '../utils/offers';

// Today's automatic offers, and what they do for this bag.
export default function useOffers(cart) {
  const [offers, setOffers] = useState([]);
  useEffect(() => {
    let on = true;
    cachedGet('/api/offers/active').then((d) => { if (on) setOffers(Array.isArray(d) ? d : []); }).catch(() => {});
    return () => { on = false; };
  }, []);
  const lines = (cart || []).map((i) => ({ price: parsePrice(i.price), qty: i.qty, category: i.category }));
  return { offers, best: bestOffer(offers, lines), next: nextOffer(offers, lines) };
}
