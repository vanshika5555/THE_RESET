import { useEffect } from 'react';

/**
 * Sets the page title and the tags search engines and messaging apps read.
 *
 * React only ever renders one HTML page, so without this every route shares
 * a single title — which is why the site was showing up as "React App".
 */

const SITE_NAME = 'THE RESET';
const DEFAULT_DESCRIPTION =
  'Considered essentials for men and women. Clean lines, honest fabric, nothing excess.';

// Create the tag if it is missing, then set its content.
function setMeta(selector, attr, key, content) {
  if (!content) return;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(url) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
}

export default function usePageMeta({ title, description, image } = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
    const desc = description || DEFAULT_DESCRIPTION;
    const url = window.location.href;

    document.title = fullTitle;

    setMeta('meta[name="description"]', 'name', 'description', desc);

    // Shared links (WhatsApp, Instagram, Facebook)
    setMeta('meta[property="og:title"]', 'property', 'og:title', fullTitle);
    setMeta('meta[property="og:description"]', 'property', 'og:description', desc);
    setMeta('meta[property="og:type"]', 'property', 'og:type', 'website');
    setMeta('meta[property="og:site_name"]', 'property', 'og:site_name', SITE_NAME);
    setMeta('meta[property="og:url"]', 'property', 'og:url', url);
    if (image) {
      setMeta('meta[property="og:image"]', 'property', 'og:image', image);
    }

    setMeta('meta[name="twitter:card"]', 'name', 'twitter:card',
      image ? 'summary_large_image' : 'summary');
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', fullTitle);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', desc);
    if (image) {
      setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', image);
    }

    setCanonical(url);
  }, [title, description, image]);
}