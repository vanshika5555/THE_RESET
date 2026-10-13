import React from 'react';
import './ErrorBoundary.css';

/**
 * Catches a JavaScript error anywhere below it and shows something useful.
 *
 * Without this, one bad render blanks the whole site — a white page with no
 * explanation, which looks to a customer like the shop has gone down.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Somewhere to hook up error reporting later.
    console.error('Caught by ErrorBoundary:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="eb-page">
        <p className="eb-eyebrow">THE RESET</p>
        <h1 className="eb-title">Something went wrong</h1>
        <p className="eb-text">
          Sorry — that is on us, not you. Reloading usually sorts it. If it
          keeps happening, please let us know.
        </p>

        <div className="eb-actions">
          <button className="eb-btn eb-btn--fill" onClick={() => window.location.reload()}>
            Reload the page
          </button>
          <a className="eb-btn" href="/">Back to home</a>
        </div>
      </div>
    );
  }
}