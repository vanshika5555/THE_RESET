import React, { useState, useEffect, useRef } from "react";
import heroBg from "../assets/hero-bg.jpg";
import "./Hero.css";

const slides = [
  {
    id: "01",
    label: "Limited Drops, Maximum Impact",
    headline: ["DRESSED", "IN SILENCE."],
    sub: "A curated edit of black and white essentials — for those who let the clothes do the talking.",
    cta: "Shop Now",
  },
  {
    id: "02",
    label: "Built for the Streets",
    headline: ["SHARP.", "PRECISE."],
    sub: "Every silhouette crafted with intention. No excess. No noise. Just form.",
    cta: "Shop Men",
  },
  {
    id: "03",
    label: "Art Meets Attitude",
    headline: ["THE NEW", "MONOCHROME."],
    sub: "Black and white isn't a limitation — it's the ultimate creative freedom.",
    cta: "Explore",
  },
  {
    id: "04",
    label: "Future-Ready Fashion",
    headline: ["WEAR THE", "RESET."],
    sub: "Timeless pieces for the woman who moves through the world on her own terms.",
    cta: "Shop Women",
  },
  {
    id: "05",
    label: "Community-Driven Culture",
    headline: ["STYLE IS", "A STATEMENT."],
    sub: "More than a brand — a movement connecting those who dress with purpose and precision.",
    cta: "Discover",
  },
];

export default function Hero() {
  const [active, setActive] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const heroRef = useRef(null);
  const timerRef = useRef(null);

  const goTo = (index) => {
    if (animating || index === active) return;
    setAnimating(true);
    setTimeout(() => {
      setActive(index);
      setAnimating(false);
    }, 500);
  };

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setActive((prev) => (prev + 1) % slides.length);
        setAnimating(false);
      }, 500);
    }, 5000);
    return () => clearInterval(timerRef.current);
  }, []);

  const handleMouseMove = (e) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 20;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 20;
    setMousePos({ x, y });
  };

  const slide = slides[active];

  return (
    <section className="hero" ref={heroRef} onMouseMove={handleMouseMove} style={{"--hero-bg-image": `url(${heroBg})`}}>

      {/* Parallax background layer */}
      <div
        className="hero-bg"
        style={{ transform: `translate(${mousePos.x * 0.4}px, ${mousePos.y * 0.4}px) scale(1.08)` }}
      />

      {/* Grain overlay */}
      <div className="hero-grain" />

      {/* Vignette */}
      <div className="hero-vignette" />

      {/* Floating geometric accent */}
      <div
        className="hero-geo"
        style={{ transform: `translate(${mousePos.x * 0.8}px, ${mousePos.y * 0.8}px)` }}
      />

      {/* Content */}
      <div className={`hero-content ${animating ? "hero-content--exit" : "hero-content--enter"}`}>

        <div className="hero-eyebrow">
          <span className="hero-eyebrow-line" />
          <span className="hero-eyebrow-text">THE RESET — {slide.id}</span>
        </div>

        <h1 className="hero-headline">
          <span className="hero-headline-line">{slide.headline[0]}</span>
          <span className="hero-headline-line hero-headline-line--outline">{slide.headline[1]}</span>
        </h1>

        <p className="hero-sub">{slide.sub}</p>

        <button className="hero-cta">
          <span>{slide.cta}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>

      </div>

      {/* Bottom slide navigation */}
      <div className="hero-nav">
        {slides.map((s, i) => (
          <button
            key={s.id}
            className={`hero-nav-item ${i === active ? "hero-nav-item--active" : ""}`}
            onClick={() => goTo(i)}
          >
            <span className="hero-nav-num">{s.id}</span>
            <span className="hero-nav-label">{s.label}</span>
            <span className="hero-nav-bar" />
          </button>
        ))}
      </div>

    </section>
  );
}