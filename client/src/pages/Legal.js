import React from 'react';
import { useLocation } from 'react-router-dom';
import './Help.css';
import usePageMeta from '../hooks/usePageMeta';

/**
 * Privacy Policy and Terms of Use.
 *
 * These are plain-language starting points, not legal advice. Have someone
 * qualified review them before you take real orders at any scale.
 */

const PRIVACY = {
  title: 'Privacy Policy',
  intro: 'This explains what we collect when you shop with us, and what we do with it.',
  sections: [
    {
      h: 'What we collect',
      p: 'When you create an account we store your name and email address. When you place an order we store your delivery address and phone number, and the details of what you ordered. Your password is stored in an encrypted form that nobody can read, including us.',
    },
    {
      h: 'How we use it',
      p: 'We use your details to process and deliver your orders, to let you see your order history, and to contact you about an order if we need to. We do not sell your information to anyone.',
    },
    {
      h: 'Payment details',
      p: 'Card and payment details are handled by our payment provider. We do not store them on our servers.',
    },
    {
      h: 'Your choices',
      p: 'You can update your saved addresses at any time in your profile. If you would like your account and its data removed, email us and we will take care of it.',
    },
    {
      h: 'Cookies',
      p: 'We use browser storage to keep you signed in and to remember your bag between visits. Clearing your browser data will remove these.',
    },
  ],
};

const TERMS = {
  title: 'Terms of Use',
  intro: 'The basics of using this website and buying from us.',
  sections: [
    {
      h: 'Using the site',
      p: 'You are welcome to browse and shop. Please do not attempt to disrupt the site, access other people\u2019s accounts, or copy our images and text for commercial use.',
    },
    {
      h: 'Your account',
      p: 'You are responsible for keeping your password private and for activity on your account. Tell us straight away if you think someone else has access to it.',
    },
    {
      h: 'Products and prices',
      p: 'We do our best to show colours, sizing and prices accurately. Screens vary, so slight colour differences are possible. If a price is listed incorrectly, we will contact you before processing the order rather than simply charging you.',
    },
    {
      h: 'Orders',
      p: 'Placing an order is an offer to buy. We confirm it once the order is accepted and dispatched. We may decline an order if an item is unavailable or if we cannot deliver to the address given.',
    },
    {
      h: 'Returns',
      p: 'Returns and exchanges are covered on our Help page.',
    },
    {
      h: 'Changes',
      p: 'We may update these terms as the store grows. The current version is always the one shown on this page.',
    },
  ],
};

export default function Legal() {
  const { pathname } = useLocation();
  const doc = pathname.includes('terms') ? TERMS : PRIVACY;

  usePageMeta({ title: doc.title, description: doc.intro });

  return (
    <div className="help-page">
      <div className="help-hero">
        <p className="help-eyebrow">THE RESET</p>
        <h1 className="help-title">{doc.title}</h1>
        <p className="help-sub">{doc.intro}</p>
      </div>

      {doc.sections.map((s, i) => (
        <section key={i} className="help-section">
          <h2 className="help-h2">{s.h}</h2>
          <p>{s.p}</p>
        </section>
      ))}

      <p className="help-note help-updated">Last updated: July 2026</p>
    </div>
  );
}