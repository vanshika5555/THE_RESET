import React from 'react';
import { Link } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import './NotFound.css';

export default function NotFound() {
  usePageMeta({
    title: 'Page not found',
    description: 'That page does not exist. Browse the collection instead.',
  });

  return (
    <div className="nf-page">
      <p className="nf-code">404</p>
      <h1 className="nf-title">This page doesn&rsquo;t exist</h1>
      <p className="nf-text">
        The link may be out of date, or the piece you were looking for is no
        longer in the collection.
      </p>

      <div className="nf-actions">
        <Link to="/men" className="nf-btn">Shop Men</Link>
        <Link to="/women" className="nf-btn">Shop Women</Link>
        <Link to="/" className="nf-btn nf-btn--fill">Back to Home</Link>
      </div>

      <p className="nf-help">
        Looking for something specific? Try{' '}
        <Link to="/search" className="nf-link">search</Link>, or{' '}
        <Link to="/help#contact" className="nf-link">get in touch</Link>.
      </p>
    </div>
  );
}