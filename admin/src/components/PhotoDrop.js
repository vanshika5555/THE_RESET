import React, { useRef, useState } from 'react';
import axios from 'axios';

const MAX_MB = 10;
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif'];

/**
 * Upload product photos to Cloudinary.
 *
 * 1. Ask our API for a signature (proves the upload comes from the admin).
 * 2. Send the file straight from the browser to Cloudinary.
 * 3. Hand the resulting https link back to the form.
 *
 * The Cloudinary request deliberately uses XMLHttpRequest, not axios:
 * axios carries our login token on every request, and that must never be
 * sent to another company's server. XHR also gives upload progress.
 */
function uploadOne(file, sig, onProgress) {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.append('file', file);
    body.append('api_key', sig.apiKey);
    body.append('timestamp', sig.timestamp);
    body.append('folder', sig.folder);
    body.append('signature', sig.signature);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) resolve(data.secure_url);
      else reject(new Error(data?.error?.message || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Network problem — check the connection and try again.'));
    xhr.send(body);
  });
}

export default function PhotoDrop({ onUploaded }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  const [jobs, setJobs] = useState([]);       // [{ id, name, progress, error }]
  const [error, setError] = useState('');

  const busy = jobs.some(j => !j.error && j.progress < 100);

  const handleFiles = async (fileList) => {
    setError('');
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const ok = [];
    const skipped = [];
    files.forEach(f => {
      if (!TYPES.includes(f.type) && !/\.(jpe?g|png|webp|avif|heic|heif)$/i.test(f.name)) skipped.push(`${f.name} is not a photo`);
      else if (f.size > MAX_MB * 1024 * 1024) skipped.push(`${f.name} is over ${MAX_MB} MB`);
      else ok.push(f);
    });
    if (skipped.length) setError(skipped.join('. ') + '.');
    if (!ok.length) return;

    let sig;
    try {
      sig = (await axios.get('/api/uploads/signature')).data;
    } catch (err) {
      setError(err.response?.data?.message || 'Could not start the upload. Is the server running?');
      return;
    }

    const batch = ok.map((f, i) => ({ id: `${Date.now()}-${i}`, name: f.name, progress: 0, error: '' }));
    setJobs(j => [...j, ...batch]);
    const update = (id, patch) => setJobs(js => js.map(j => (j.id === id ? { ...j, ...patch } : j)));

    // Upload in order so photos land in the order they were chosen.
    for (let i = 0; i < ok.length; i++) {
      const job = batch[i];
      try {
        const url = await uploadOne(ok[i], sig, (p) => update(job.id, { progress: Math.min(p, 99) }));
        update(job.id, { progress: 100 });
        onUploaded(url);
        setTimeout(() => setJobs(js => js.filter(j => j.id !== job.id)), 1200);
      } catch (err) {
        update(job.id, { error: err.message });
      }
    }
  };

  return (
    <div className="pd-drop-wrap">
      <button
        type="button"
        className={`pd-drop ${over ? 'pd-drop--over' : ''}`}
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); handleFiles(e.dataTransfer.files); }}
        disabled={busy}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <strong>{busy ? 'Uploading…' : 'Upload photos'}</strong>
        <span>Drag them here or click to choose. JPG, PNG or WEBP, up to {MAX_MB} MB each.</span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
      />

      {jobs.length > 0 && (
        <ul className="pd-jobs">
          {jobs.map(j => (
            <li key={j.id} className={j.error ? 'pd-job pd-job--err' : 'pd-job'}>
              <span className="pd-job-name">{j.name}</span>
              {j.error
                ? <span className="pd-job-msg">{j.error}</span>
                : <span className="pd-job-bar"><span style={{ width: `${j.progress}%` }} /></span>}
              {j.error && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setJobs(js => js.filter(x => x.id !== j.id))}>Dismiss</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="pd-drop-error" role="alert">{error}</p>}
    </div>
  );
}
