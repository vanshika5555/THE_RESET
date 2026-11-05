import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import WishCard from '../components/WishCard';
import './WishlistPage.css';

const linkFor = (code) => `${window.location.origin}/w/${code}`;

export default function WishlistPage() {
  const { wishlist, toggleWishlist } = useWishlist();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Sharing: a link friends can open to see (and buy from) this list.
  const [share, setShare] = useState({ shared: false, code: '' });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  useEffect(() => {
    if (!user) return;
    axios.get('/api/auth/wishlist/share').then((r) => setShare(r.data)).catch(() => {});
  }, [user]);

  const copy = async (url) => {
    try { await navigator.clipboard.writeText(url); setNote('Link copied.'); }
    catch { setNote('Copy the link above to send it.'); }
  };

  const startSharing = async () => {
    setNote('');
    if (!user) { navigate('/login', { state: { from: '/wishlist' } }); return; }
    setBusy(true);
    try {
      const { data } = await axios.post('/api/auth/wishlist/share', { wishlist: wishlist.map((p) => p._id) });
      setShare(data);
      const url = linkFor(data.code);
      // Phones: the share sheet (WhatsApp, Messages…). Elsewhere: copy.
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
        try { await navigator.share({ title: 'My THE RESET wishlist', text: 'A few things I’d love:', url }); }
        catch { /* closed the sheet — the link is still shown */ }
      } else {
        await copy(url);
      }
    } catch (err) {
      setNote(err.response?.data?.message || 'Could not share right now. Please try again.');
    }
    setBusy(false);
  };

  const stopSharing = async () => {
    setBusy(true);
    try { const { data } = await axios.delete('/api/auth/wishlist/share'); setShare(data); setNote('Sharing stopped — the link won’t open until you share again.'); }
    catch { setNote('Could not stop sharing. Please try again.'); }
    setBusy(false);
  };

  return (
    <div className="wl-page">
      <div className="wl-header">
        <h1 className="wl-title">Wishlist</h1>
        <p className="wl-count">{wishlist.length} item{wishlist.length !== 1 ? 's' : ''}</p>
        {wishlist.length > 0 && !share.shared && (
          <button type="button" className="wl-share-btn" onClick={startSharing} disabled={busy}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            {busy ? 'Sharing…' : 'Share wishlist'}
          </button>
        )}
      </div>

      {share.shared && (
        <div className="wl-shared" role="region" aria-label="Your shared wishlist link">
          <p className="wl-shared-title">Your wishlist is shared</p>
          <p className="wl-shared-text">Anyone with this link sees the pieces you’ve saved — handy for birthdays. It shows your first name only, never your email or address.</p>
          <div className="wl-shared-row">
            <input readOnly value={linkFor(share.code)} aria-label="Wishlist link" onFocus={(e) => e.target.select()} />
            <button type="button" onClick={() => (navigator.share && window.matchMedia('(pointer: coarse)').matches
              ? navigator.share({ title: 'My THE RESET wishlist', url: linkFor(share.code) }).catch(() => {})
              : copy(linkFor(share.code)))}
            >Share link</button>
          </div>
          <button type="button" className="wl-shared-stop" onClick={stopSharing} disabled={busy}>Stop sharing</button>
        </div>
      )}
      {note && <p className="wl-note" role="status">{note}</p>}

      {wishlist.length === 0 ? (
        <div className="wl-empty">
          <p>Your wishlist is empty.</p>
          <p className="wl-empty-hint">Tap the heart on any piece to save it here.</p>
          <div className="wl-empty-actions">
            <Link to="/men" className="wl-shop-btn">Shop Men</Link>
            <Link to="/women" className="wl-shop-btn wl-shop-btn--fill">Shop Women</Link>
          </div>
        </div>
      ) : (
        <div className="wl-grid">
          {wishlist.map((product) => (
            <WishCard key={product._id} product={product} onRemove={toggleWishlist} />
          ))}
        </div>
      )}
    </div>
  );
}
