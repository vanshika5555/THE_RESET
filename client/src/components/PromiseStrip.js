import React from 'react';
import { Link } from 'react-router-dom';
import './PromiseStrip.css';

/**
 * The three things a first-time visitor wants to know before they trust
 * a shop they have not heard of. Kept in step with the real policies in
 * server/utils/shipping.js and the Help page.
 */
const PROMISES = [
  {
    title: 'Free delivery over ₹1,999',
    text: 'Flat ₹99 below that. Dispatched within 2 working days.',
    to: '/help#shipping',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
        <rect x="1" y="6" width="15" height="12" rx="1"/>
        <path d="M16 10h4l3 3v5h-7z"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>
      </svg>
    ),
  },
  {
    title: '7 day returns',
    text: 'Not right? Tell us within 7 days of delivery.',
    to: '/help#returns',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>
      </svg>
    ),
  },
  {
    title: 'Find your size',
    text: 'Measurements for every piece, so you order once.',
    to: '/help#faq',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M2 9h20v6H2z"/><path d="M6 9v3M10 9v4M14 9v3M18 9v4"/>
      </svg>
    ),
  },
];

export default function PromiseStrip() {
  return (
    <section className="ps-section">
      {PROMISES.map(p => (
        <Link key={p.title} to={p.to} className="ps-item">
          <span className="ps-icon">{p.icon}</span>
          <span className="ps-text">
            <span className="ps-title">{p.title}</span>
            <span className="ps-sub">{p.text}</span>
          </span>
        </Link>
      ))}
    </section>
  );
}