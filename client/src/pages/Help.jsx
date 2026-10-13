import React from 'react';
import { Link } from 'react-router-dom';
import './Help.css';
import usePageMeta from '../hooks/usePageMeta';

// ---------------------------------------------------------------
// EDIT THIS: your real contact details and policy timings.
// ---------------------------------------------------------------
const CONTACT = {
  email: 'hello@thereset.com',
  phone: '',                       // leave empty to hide
  hours: 'Monday to Saturday, 10am – 6pm IST',
};

const FAQS = [
  {
    q: 'How long does delivery take?',
    a: 'Orders are dispatched within 2 working days. Most metro addresses receive their parcel in 3–5 working days, and other locations in 5–8 working days.',
  },
  {
    q: 'How do I track my order?',
    a: 'Sign in and open My Orders in your profile. Each order shows its current status, from Pending through to Delivered.',
  },
  {
    q: 'What sizes do you carry?',
    a: 'Sizes vary by piece and are listed on each product page. If you are between sizes, we generally suggest sizing up for a relaxed fit.',
  },
  {
    q: 'Can I change or cancel an order?',
    a: 'Get in touch as soon as possible. If the order has not been dispatched we can usually amend or cancel it.',
  },
  {
    q: 'Do you ship outside India?',
    a: 'Not at the moment. We currently deliver within India only.',
  },
];

export default function Help() {
  usePageMeta({
    title: 'Help & Support',
    description: 'Delivery times, returns, exchanges and how to reach us.',
  });

  return (
    <div className="help-page">
      <div className="help-hero">
        <p className="help-eyebrow">THE RESET</p>
        <h1 className="help-title">Help &amp; Support</h1>
        <p className="help-sub">Everything about ordering, delivery and returns.</p>
      </div>

      <nav className="help-nav">
        <a href="#faq">FAQ</a>
        <a href="#shipping">Shipping</a>
        <a href="#returns">Returns</a>
        <a href="#contact">Contact</a>
      </nav>

      <section id="faq" className="help-section">
        <h2 className="help-h2">Frequently Asked Questions</h2>
        <dl className="help-faq">
          {FAQS.map((f, i) => (
            <div key={i} className="help-faq-item">
              <dt>{f.q}</dt>
              <dd>{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="shipping" className="help-section">
        <h2 className="help-h2">Shipping</h2>
        <p>Orders are packed and dispatched within 2 working days.</p>
        <ul className="help-list">
          <li>Metro cities: 3–5 working days</li>
          <li>Rest of India: 5–8 working days</li>
          <li>Delivery is within India only</li>
        </ul>
        <p>
          Delivery is free on orders of ₹1,999 and above. Below that, a flat
          charge of ₹99 applies, shown at checkout before you confirm.
          You can follow your order under{' '}
          <Link to="/profile/orders" className="help-link">My Orders</Link>.
        </p>
      </section>

      <section id="returns" className="help-section">
        <h2 className="help-h2">Returns &amp; Exchanges</h2>
        <p>
          If something is not right, contact us within 7 days of delivery and we
          will help arrange a return or exchange.
        </p>
        <ul className="help-list">
          <li>Items should be unworn and unwashed, with tags attached</li>
          <li>Keep the original packaging where possible</li>
          <li>Refunds are processed once the piece reaches us and passes a quick check</li>
        </ul>
        <p className="help-note">
          To start a return, email us at{' '}
          <a href={`mailto:${CONTACT.email}`} className="help-link">{CONTACT.email}</a>{' '}
          with your order number.
        </p>
      </section>

      <section id="contact" className="help-section">
        <h2 className="help-h2">Contact Us</h2>
        <p>We read every message and usually reply within one working day.</p>

        <div className="help-contact">
          <div className="help-contact-row">
            <span className="help-contact-label">Email</span>
            <a href={`mailto:${CONTACT.email}`} className="help-link">{CONTACT.email}</a>
          </div>

          {CONTACT.phone && (
            <div className="help-contact-row">
              <span className="help-contact-label">Phone</span>
              <a href={`tel:${CONTACT.phone.replace(/\s/g, '')}`} className="help-link">{CONTACT.phone}</a>
            </div>
          )}

          <div className="help-contact-row">
            <span className="help-contact-label">Hours</span>
            <span>{CONTACT.hours}</span>
          </div>
        </div>

        <p className="help-note">
          Ordering something? Have your order number ready — you can find it under{' '}
          <Link to="/profile/orders" className="help-link">My Orders</Link>.
        </p>
      </section>
    </div>
  );
}