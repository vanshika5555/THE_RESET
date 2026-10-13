import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Sends the window back to the top whenever the route changes.
 *
 * Without this, React keeps the old scroll position: scroll halfway down a
 * collection, open a product, and you land halfway down that page instead
 * of at the photo.
 *
 * Anchor links (/help#shipping) are left alone so they still jump to their
 * section rather than being yanked to the top.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      // let the target render, then jump to it
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [pathname, hash]);

  return null;
}