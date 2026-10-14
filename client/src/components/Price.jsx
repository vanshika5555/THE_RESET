import React from 'react';
import { parsePrice, formatPrice } from '../utils/price';

/**
 * A product price. When an original price (mrp) is set and higher, it shows
 *   ₹2,990  ₹3,490  −14%
 * with the old price struck through. Accepts numbers or older "₹2,990" text.
 */
export default function Price({ value, mrp, className = '' }) {
  const now = parsePrice(value);
  const was = parsePrice(mrp);
  const onSale = was > now && now > 0;
  const off = onSale ? Math.round(((was - now) / was) * 100) : 0;

  return (
    <span className={`price ${onSale ? 'price--sale' : ''} ${className}`}>
      <span className="price-now">{formatPrice(now)}</span>
      {onSale && (
        <>
          <s className="price-was" aria-label={`was ${formatPrice(was)}`}>{formatPrice(was)}</s>
          <span className="price-off">−{off}%</span>
        </>
      )}
    </span>
  );
}
