import React from "react";
import { Link } from "react-router-dom";
import EGwomen from "../assets/EGwomen.jpg";
import EGmen from "../assets/EGmen.jpg";
import "./EditorialGrid.css";

export default function EditorialGrid() {
  return (
    <section className="eg-section">

      {/* Top row */}
      <div className="eg-row eg-row--top">

        {/* Large image block — left */}
        <div className="eg-block eg-block--img-light">
          <img src={EGwomen} alt="Women Collection" className="eg-real-img" />
          <div className="eg-block-text eg-block-text--over-light">
            <p className="eg-eyebrow">New Season</p>
            <h2 className="eg-heading">Dressed in<br />Daylight.</h2>
            <p className="eg-body">Effortless whites and soft neutrals for the woman who moves with grace.</p>
            <Link to="/women" className="eg-link eg-link--dark">Shop Women →</Link>
          </div>
        </div>

        {/* Dark card — right */}
        <div className="eg-block eg-block--dark">
          <div className="eg-img-placeholder eg-img--dark" />
          <div className="eg-block-text">
            <p className="eg-eyebrow eg-eyebrow--light">The Edit</p>
            <h2 className="eg-heading eg-heading--light">Built by the<br />streets, made<br />for you.</h2>
            <p className="eg-body eg-body--light">Your wardrobe is a statement. Our curation is all about self-expression and intention. Join the movement.</p>
            <Link to="/about" className="eg-cta-btn">
              Read our story
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </Link>
          </div>
        </div>

      </div>

      {/* Bottom row */}
      <div className="eg-row eg-row--bottom">

        {/* Wide image — left bottom */}
        <div className="eg-block eg-block--wide">
          <img src={EGmen} alt="Men Collection" className="eg-real-img" />
          <div className="eg-block-text eg-block-text--bottom">
            <p className="eg-eyebrow">Men's Edit</p>
            <h2 className="eg-heading">Elevate your<br />everyday game.</h2>
            <p className="eg-body">From crisp shirts to precision-cut trousers — the reset starts here.</p>
            <Link to="/men" className="eg-link eg-link--dark">Shop Men →</Link>
          </div>
        </div>

        {/* Stats / text block — right bottom */}
        <div className="eg-block eg-block--stat">
          <div className="eg-stat-inner">
            <p className="eg-stat-eyebrow">Why THE RESET</p>
            <div className="eg-stat-item">
              <span className="eg-stat-num">100+</span>
              <span className="eg-stat-label">Curated pieces across men's & women's</span>
            </div>
            <div className="eg-stat-divider" />
            <div className="eg-stat-item">
              <span className="eg-stat-num">2</span>
              <span className="eg-stat-label">Collections. Zero compromise.</span>
            </div>
            <div className="eg-stat-divider" />
            <div className="eg-stat-item">
              <span className="eg-stat-num">1</span>
              <span className="eg-stat-label">Singular vision — black, white, refined.</span>
            </div>
            <Link to="/about" className="eg-link eg-link--dark" style={{marginTop: '32px', display:'inline-block'}}>Our Story →</Link>
          </div>
        </div>

      </div>

    </section>
  );
}