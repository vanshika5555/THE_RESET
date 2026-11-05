import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import usePageMeta from '../hooks/usePageMeta';
import Loading from '../components/Loading';
import WishCard from '../components/WishCard';
import './WishlistPage.css';

/*
  /w/:code — someone's shared wishlist. Pick a size and add to your own bag;
  tick "This is a gift" at checkout to send it straight to them.
*/
export default function SharedWishlist() {
  const { code } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setData(null); setError('');
    axios.get(`/api/auth/wishlist/shared/${encodeURIComponent(code)}`)
      .then((r) => { if (active) setData(r.data); })
      .catch((err) => { if (active) setError(err.response?.data?.message || 'Could not load this wishlist.'); });
    return () => { active = false; };
  }, [code]);

  usePageMeta({
    title: data ? `${data.name}’s wishlist` : 'Wishlist',
    description: 'Pieces saved on THE RESET.',
  });

  if (!data && !error) return <Loading label="Loading wishlist..." />;

  if (error) {
    return (
      <div className="wl-page">
        <div className="wl-empty">
          <p>{error}</p>
          <p className="wl-empty-hint">Ask them to send the link again, or have a look around.</p>
          <div className="wl-empty-actions">
            <Link to="/men" className="wl-shop-btn">Shop Men</Link>
            <Link to="/women" className="wl-shop-btn wl-shop-btn--fill">Shop Women</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wl-page">
      <div className="wl-header wl-header--shared">
        <p className="wl-eyebrow">Shared wishlist</p>
        <h1 className="wl-title">{data.name}’s wishlist</h1>
        <p className="wl-count">{data.items.length} piece{data.items.length !== 1 ? 's' : ''}</p>
      </div>

      {data.items.length > 0 && (
        <p className="wl-gift-tip">
          Buying for {data.name}? Add a piece in their size, then tick <strong>This is a gift</strong> at checkout —
          we’ll leave the prices off the parcel and tuck in your note. Not sure of the size? A <Link to="/gift-cards">gift card</Link> lets them choose.
        </p>
      )}

      {data.items.length === 0 ? (
        <div className="wl-empty">
          <p>Nothing on this list right now.</p>
          <div className="wl-empty-actions">
            <Link to="/gift-cards" className="wl-shop-btn wl-shop-btn--fill">Send a gift card</Link>
          </div>
        </div>
      ) : (
        <div className="wl-grid">
          {data.items.map((product) => <WishCard key={product._id} product={product} />)}
        </div>
      )}
    </div>
  );
}
