import { Link } from 'react-router-dom';
import React from "react";
import "./About.css";

export default function About() {
  return (
    <div className="about-page">

      {/* ── Hero Banner ── */}
      <section className="about-hero">
        <div className="about-hero-overlay">
          <p className="about-hero-eyebrow">Our Story</p>
          <h1 className="about-hero-title">THE RESET</h1>
          <p className="about-hero-sub">Where minimalism meets mastery.</p>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section className="about-stats">
        <div className="stat-item">
          <span className="stat-num">2</span>
          <span className="stat-label">Collections</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-num">100+</span>
          <span className="stat-label">Curated Pieces</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-num">1</span>
          <span className="stat-label">Vision</span>
        </div>
      </section>

      {/* ── About The Brand ── */}
      <section className="about-brand">
        <div className="about-brand-img-wrap">
          <div className="about-brand-img about-brand-img--1" />
        </div>
        <div className="about-brand-text">
          <p className="section-eyebrow">About The Brand</p>
          <h2 className="section-title">Redefining what it means<br />to dress with intention.</h2>
          <p className="section-body">
            THE RESET is a fashion showcase built around one belief — that great clothing doesn't need to shout. Born as a portfolio project by a developer with a deep love for design, THE RESET presents curated men's and women's collections centered entirely in black and white.
          </p>
          <p className="section-body">
            Every piece in the collection is chosen for its cut, its silence, and its staying power. No seasonal noise. No trend chasing. Just clothing that resets the way you think about getting dressed.
          </p>
        </div>
      </section>

      {/* ── Design Philosophy ── */}
      <section className="about-philosophy">
        <div className="philosophy-text-block">
          <p className="section-eyebrow">Our Design Philosophy</p>
          <h2 className="section-title">Form follows feeling.</h2>
          <p className="section-body">
            At THE RESET, every piece is designed to be versatile, timeless, and effortlessly elegant. We believe a wardrobe built on black and white is not a limitation — it's the ultimate freedom. When colour steps back, silhouette, fabric, and craftsmanship step forward.
          </p>
        </div>
        <div className="philosophy-grid">
          <div className="philosophy-card">
            <div className="philosophy-icon">✦</div>
            <h3>Timeless Over Trendy</h3>
            <p>Pieces chosen to outlast every season and every algorithm.</p>
          </div>
          <div className="philosophy-card">
            <div className="philosophy-icon">◈</div>
            <h3>Monochrome As Identity</h3>
            <p>Black and white isn't a palette — it's a point of view.</p>
          </div>
          <div className="philosophy-card">
            <div className="philosophy-icon">⬡</div>
            <h3>Craft First</h3>
            <p>Fabric, fit, and finish are the only metrics that matter.</p>
          </div>
          <div className="philosophy-card">
            <div className="philosophy-icon">◎</div>
            <h3>Less, Better</h3>
            <p>A curated wardrobe beats a crowded one every time.</p>
          </div>
        </div>
      </section>

      {/* ── About The Creator (split layout like AND's About Anita) ── */}
      <section className="about-creator">
        <div className="creator-img-block">
          <div className="creator-img-placeholder">
            <span>V</span>
          </div>
          <div className="creator-img-accent" />
        </div>
        <div className="creator-text">
          <p className="section-eyebrow">About The Creator</p>
          <h2 className="section-title">Vanshika</h2>
          <p className="section-body">
            THE RESET is a product of Vanshika's vision — a developer and designer who believes that great digital experiences and great clothing share the same DNA: precision, restraint, and purpose.
          </p>
          <p className="section-body">
            Built entirely as a portfolio project, THE RESET demonstrates full-stack product thinking — from UI architecture to brand identity. The site is designed and developed by Vanshika to showcase skills in React development, UX design, and editorial thinking.
          </p>
          <p className="section-body">
            This is not just a website. It's proof of what's possible when a developer thinks like a creative director.
          </p>
          <div className="creator-tags">
            <span>React Developer</span>
            <span>UI/UX Designer</span>
            <span>Brand Thinker</span>
          </div>
        </div>
      </section>

      {/* ── Mission Strip ── */}
      <section className="about-mission">
        <div className="mission-inner">
          <p className="mission-quote">
            "The best wardrobe is the one you never have to think about —<br />
            because every piece already works."
          </p>
          <p className="mission-attr">— The Reset, Est. 2025</p>
        </div>
      </section>

      {/* ── Collections Preview ── */}
      <section className="about-collections">
        <p className="section-eyebrow centered">Explore</p>
        <h2 className="section-title centered">Two Collections. One Language.</h2>
        <div className="collections-grid">
          <div className="collection-card">
            <div className="collection-card-img collection-card-img--men" />
            <div className="collection-card-body">
              <h3>Men</h3>
              <p>Sharp silhouettes. Clean cuts. Built for the man who moves with quiet authority.</p>
              <Link to="/men" className="collection-link">Shop Men →</Link>
            </div>
          </div>
          <div className="collection-card">
            <div className="collection-card-img collection-card-img--women" />
            <div className="collection-card-body">
              <h3>Women</h3>
              <p>Fluid, precise, and unapologetically refined. Dressing as a form of self-expression.</p>
              <Link to="/women" className="collection-link">Shop Women →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer Strip ── */}
      <section className="about-footer-strip">
        <p>A project by Vanshika &nbsp;·&nbsp; Built with React &nbsp;·&nbsp; Designed with intention</p>
      </section>

    </div>
  );
}