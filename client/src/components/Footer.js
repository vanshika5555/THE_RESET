import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./Footer.css";

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
        <div className="footer-newsletter">
          <p className="footer-nl-label">Stay in the loop</p>
          <div className="footer-nl-form">
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="footer-nl-input"
            />
            <button className="footer-nl-btn">Subscribe</button>
          </div>
        </div>
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
            <li><a href="#">New Arrivals</a></li>
            <li><a href="#">Bestsellers</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4 className="footer-col-title">Company</h4>
          <ul className="footer-links">
            <li><Link to="/about">Our Story</Link></li>
            <li><a href="#">Sustainability</a></li>
            <li><a href="#">Careers</a></li>
            <li><a href="#">Press</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4 className="footer-col-title">Help</h4>
          <ul className="footer-links">
            <li><a href="#">FAQ</a></li>
            <li><a href="#">Shipping Policy</a></li>
            <li><a href="#">Returns & Exchanges</a></li>
            <li><a href="#">Contact Us</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4 className="footer-col-title">Follow</h4>
          <ul className="footer-links">
            <li><a href="#" target="_blank" rel="noreferrer">Instagram</a></li>
            <li><a href="#" target="_blank" rel="noreferrer">Pinterest</a></li>
            <li><a href="#" target="_blank" rel="noreferrer">Twitter / X</a></li>
            <li><a href="#" target="_blank" rel="noreferrer">YouTube</a></li>
          </ul>
        </div>

      </div>

      {/* Divider */}
      <div className="footer-divider" />

      {/* Bottom bar */}
      <div className="footer-bottom">
        <p className="footer-copy">© 2026 The Reset. All rights reserved. Built by Vanshika.</p>
        <div className="footer-legal">
          <a href="#">Privacy Policy</a>
          <span>·</span>
          <a href="#">Terms of Use</a>
        </div>
      </div>

    </footer>
  );
}