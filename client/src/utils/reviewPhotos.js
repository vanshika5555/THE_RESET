import axios from 'axios';

/**
 * Review photos go straight from the phone to Cloudinary, with a one-off
 * signature from our API (only shoppers who received the piece get one).
 * XHR rather than axios so the sign-in token is never sent to Cloudinary.
 */
export const MAX_PHOTOS = 3;
export const MAX_MB = 10;

export async function reviewSignature(productId) {
  const res = await axios.get('/api/uploads/review-signature', { params: { product: productId } });
  return res.data;
}

export function uploadReviewPhoto(file, sig, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) { reject(new Error(`${file.name} isn't a photo.`)); return; }
    if (file.size > MAX_MB * 1024 * 1024) { reject(new Error(`${file.name} is over ${MAX_MB} MB.`)); return; }
    const body = new FormData();
    body.append('file', file);
    body.append('api_key', sig.apiKey);
    body.append('timestamp', sig.timestamp);
    body.append('folder', sig.folder);
    body.append('allowed_formats', sig.allowed_formats);
    body.append('signature', sig.signature);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) resolve(data.secure_url);
      else reject(new Error(data?.error?.message || 'The photo didn’t upload. Try again.'));
    };
    xhr.onerror = () => reject(new Error('Network problem — check your connection and try again.'));
    xhr.send(body);
  });
}
