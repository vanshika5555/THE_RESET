import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { inviteCode, forgetInvite } from '../utils/invite';
import './InviteBanner.css';

/* "Riya invited you" — shown to signed-out visitors who came from a friend's link. */
export default function InviteBanner() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [invite, setInvite] = useState(null);   // { name, reward, min }
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const code = inviteCode();
    if (!code || user) return;
    axios.get(`/api/auth/referral/${encodeURIComponent(code)}`)
      .then((r) => setInvite(r.data))
      .catch((err) => { if (err.response?.status === 404) forgetInvite(); });
  }, [user]);

  if (!invite || user || closed || pathname.startsWith('/checkout')) return null;
  const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

  return (
    <div className="ib" role="region" aria-label="Your invite">
      <p className="ib-text">
        <strong>{invite.name} invited you.</strong> Create an account and you’ll both get {inr(invite.reward)} store credit
        once your first order{invite.min ? ` of ${inr(invite.min)}+` : ''} arrives.
      </p>
      {pathname !== '/login' && <Link to="/login" state={{ signup: true }} className="ib-btn">Sign up</Link>}
      <button type="button" className="ib-close" aria-label="Close" onClick={() => setClosed(true)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  );
}
