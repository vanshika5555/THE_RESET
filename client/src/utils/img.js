/**
 * Right-sized photos.
 *
 * Photos uploaded through the admin live on Cloudinary, which can resize and
 * re-encode on the fly from the URL alone. A product card asks for a 600px
 * copy in WebP/AVIF instead of the 4000px original — often 20x smaller.
 *
 * Links from anywhere else are returned unchanged.
 */
const CLOUDINARY = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(?![a-z]{1,3}_)/;

export function cdn(url, width) {
  if (!url || typeof url !== 'string') return url;
  if (!CLOUDINARY.test(url)) return url;
  const w = Math.round(width * (typeof window !== 'undefined' && window.devicePixelRatio > 1 ? 2 : 1));
  return url.replace(CLOUDINARY, `$1f_auto,q_auto,c_limit,w_${Math.min(w, 2400)}/`);
}

export default cdn;
