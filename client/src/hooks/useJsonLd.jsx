import { useEffect } from 'react';

/**
 * Structured data for Google (schema.org JSON-LD). Lets search results show
 * a product's price, stock and star rating right under the link.
 * Pass null to remove it.
 */
export default function useJsonLd(id, data) {
  const json = data ? JSON.stringify(data) : '';
  useEffect(() => {
    if (!json) return undefined;
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('script');
      el.type = 'application/ld+json';
      el.id = id;
      document.head.appendChild(el);
    }
    // "</" can't appear inside a script tag's text.
    el.textContent = json.replace(/</g, '\\u003c');
    return () => { el.remove(); };
  }, [id, json]);
}
