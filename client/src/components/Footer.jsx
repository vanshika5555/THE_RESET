import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./Footer.css";

// EDIT THIS: add your real profile links. Anything left empty is hidden.
const SOCIAL = [
  { label: 'Instagram',   url: '' },
  { label: 'Pinterest',   url: '' },
  { label: 'Twitter / X', url: '' },
  { label: 'YouTube',     url: '' },
];

// The newsletter box is hidden until there is a backend to save emails.
// Switch to true once /api/newsletter (or a mail service) is wired up.
const NEWSLETTER_ON = false;

export default function Footer() {
  const [email, setEmail] = useState("");

  return (
    <footer className="footer">

      {/* Top strip */}
      <div className="footer-top">
        <div className="footer-brand">
          <span className="footer-logo">THE RESET</span>
          <p className="footer-tagline">Dressed in silence. Built with intention.</p>
        </div>
        {NEWSLETTER_ON && (
          <form className="footer-newsletter" onSubmit={(e) => e.preventDefault()}>
            <label className="footer-nl-label" htmlFor="footer-email">Stay in the loop</label>
            <div className="footer-nl-form">
              <input
                id="footer-email"
                type="email"
                required
                autoComplete="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="footer-nl-input"
              />
              <button type="submit" className="footer-nl-btn">Subscribe</button>
            </div>
          </form>
        )}
      </div>

      {/* Divider */}
      <div className="footer-divider" />

      {/* Main links grid */}
      <div className="footer-grid">

        <div className="footer-col">
          <h4 className="footer-col-title">Shop</h4>
          <ul className="footer-links">
            <li><Link to="/men">Men</Link></li>
            <li><Link to="/women">Women</Link></li>
            <li><Link to="/search?q=new">New Arrivals</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4 className="footer-col-title">Company</h4>
          <ul className="footer-links">
            <li><Link to="/about">Our Story</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4 className="footer-col-title">Help</h4>
          <ul className="footer-links">
            <li><Link to="/help#faq">FAQ</Link></li>
            <li><Link to="/help#shipping">Shipping</Link></li>
            <li><Link to="/help#returns">Returns &amp; Exchanges</Link></li>
            <li><Link to="/help#contact">Contact Us</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4 className="footer-col-title">Follow</h4>
          <ul className="footer-links">
            {SOCIAL.filter(s => s.url).map(s => (
              <li key={s.label}>
                <a href={s.url} target="_blank" rel="noreferrer">{s.label}</a>
              </li>
            ))}
            {SOCIAL.every(s => !s.url) && (
              <li className="footer-soon">Coming soon</li>
            )}
          </ul>
        </div>

      </div>

      {/* Divider */}
      <div className="footer-divider" />

      {/* Bottom bar */}
      <div className="footer-bottom">
        <p className="footer-copy">© 2026 The Reset. All rights reserved. Built by Vanshika.</p>
        <div className="footer-legal">
          <Link to="/privacy">Privacy Policy</Link>
          <span>·</span>
          <Link to="/terms">Terms of Use</Link>
        </div>
      </div>

    </footer>
  );
}