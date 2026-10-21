import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import './InstallApp.css';

/*
  "Get the app" card for phones. The shop is installable (manifest + service
  worker), so Android Chrome can add it to the home screen in one tap; on
  iPhone, Safari needs Share → Add to Home Screen, so the card shows how.

  Only shown to people who come back (second visit, or a few pages in), never
  on the product page (its Add to Bag bar sits at the bottom), checkout or
  sign-in, and not again for a month once closed.
*/

const SEEN_KEY = 'theresetInstallDismissed';
const VISITS_KEY = 'theresetVisits';
const HIDE_ON = [/^\/product\//, /^\/checkout/, /^\/login/, /^\/reset-password/, /^\/forgot-password/];
const MONTH = 30 * 24 * 60 * 60 * 1000;

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

// Chrome may offer the install before React has drawn anything — keep it.
let deferredPrompt = null;
const listeners = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    listeners.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    store.set(SEEN_KEY, String(Date.now() + 100 * 12 * MONTH)); // never again
    listeners.forEach((fn) => fn());
  });
}

const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIosSafari = () => {
  const ua = window.navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|Instagram|FBAN|FBAV/.test(ua);
};

// Count visits once per browser session.
function countVisit() {
  try {
    if (sessionStorage.getItem('theresetVisitCounted')) return Number(store.get(VISITS_KEY)) || 1;
    sessionStorage.setItem('theresetVisitCounted', '1');
  } catch { /* fine */ }
  const n = (Number(store.get(VISITS_KEY)) || 0) + 1;
  store.set(VISITS_KEY, String(n));
  return n;
}

export default function InstallApp() {
  const { pathname } = useLocation();
  const [, rerender] = useState(0);
  const [visits] = useState(countVisit);
  const [pages, setPages] = useState(0);
  const [closed, setClosed] = useState(() => Number(store.get(SEEN_KEY)) > Date.now());
  const [showHow, setShowHow] = useState(false);

  useEffect(() => {
    const fn = () => rerender((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  useEffect(() => { setPages((n) => n + 1); }, [pathname]);

  if (closed || isStandalone()) return null;
  if (HIDE_ON.some((re) => re.test(pathname))) return null;
  if (visits < 2 && pages < 3) return null;
  const ios = isIosSafari();
  if (!deferredPrompt && !ios) return null;

  const close = () => {
    store.set(SEEN_KEY, String(Date.now() + MONTH));
    setClosed(true);
  };

  const install = async () => {
    if (ios) { setShowHow((v) => !v); return; }
    const prompt = deferredPrompt;
    if (!prompt) return;
    prompt.prompt();
    const choice = await prompt.userChoice.catch(() => null);
    deferredPrompt = null;
    if (choice?.outcome === 'accepted') setClosed(true);
    else close();
  };

  return (
    <aside className="ia" role="complementary" aria-label="Get the app">
      <div className="ia-row">
        <img className="ia-icon" src="/icon-192.png" alt="" width="44" height="44" />
        <div className="ia-copy">
          <p className="ia-title">Get THE RESET app</p>
          <p className="ia-sub">Full screen, one tap from your home screen. No app store, nothing to update.</p>
        </div>
        <button type="button" className="ia-close" onClick={close} aria-label="Not now">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      {ios && showHow ? (
        <ol className="ia-how">
          <li>
            Tap
            <svg className="ia-share" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-label="Share">
              <path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
            </svg>
            <strong>Share</strong> in Safari’s bar
          </li>
          <li>Choose <strong>Add to Home Screen</strong></li>
          <li>Tap <strong>Add</strong></li>
        </ol>
      ) : (
        <button type="button" className="ia-btn" onClick={install}>
          {ios ? 'Show me how' : 'Install'}
        </button>
      )}
    </aside>
  );
}
