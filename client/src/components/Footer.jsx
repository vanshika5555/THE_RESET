import React, { useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import "./Footer.css";

// EDIT THIS: add your real profile links. Anything left empty is hidden.
const SOCIAL = [
  { label: 'Instagram',   url: '' },
  { label: 'Pinterest',   url: '' },
  { label: 'Twitter / X', url: '' },
  { label: 'YouTube',     url: '' },
];

// Newsletter: signing up emails a one-use first-order code (server/routes/newsletter.js).
const NEWSLETTER_ON = true;

export default function Footer() {
  const [email, setEmail] = useState("");
  const [nlMsg, setNlMsg] = useState("");
  const [nlErr, setNlErr] = useState("");
  const [nlBusy, setNlBusy] = useState(false);

  const subscribe = async (e) => {
    e.preventDefault();
    setNlErr("");
    setNlBusy(true);
    try {
      const res = await axios.post("/api/newsletter", { email: email.trim() });
      setNlMsg(res.data?.message || "Check your inbox for your code.");
      setEmail("");
    } catch (err) {
      setNlErr(err.response?.data?.message || "Could not sign you up just now. Please try again.");
    }
    setNlBusy(false);
  };

  return (
    <footer className="footer">

      {/* Top strip */}
      <div className="footer-top">
        <div className="footer-brand">
          <span className="footer-logo">THE RESET</span>
          <p className="footer-tagline">Dressed in silence. Built with intention.</p>
        </div>
        {NEWSLETTER_ON && (
          <form className="footer-newsletter" onSubmit={subscribe}>
            <label className="footer-nl-label" htmlFor="footer-email">10% off your first order</label>
            <p className="footer-nl-sub">Join the list for new pieces and restocks. Your code arrives by email.</p>
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
              <button type="submit" className="footer-nl-btn" disabled={nlBusy}>{nlBusy ? "Joining…" : "Get my code"}</button>
            </div>
            {nlMsg && <p className="footer-nl-ok" role="status">{nlMsg}</p>}
            {nlErr && <p className="footer-nl-err" role="alert">{nlErr}</p>}
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