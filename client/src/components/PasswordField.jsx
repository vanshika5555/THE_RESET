import React, { useState } from 'react';

/**
 * Password input with a Show / Hide button — on a phone keyboard, being able
 * to check what you typed saves a lot of failed sign-ins.
 */
export default function PasswordField({ label = 'Password', id, hint, ...inputProps }) {
  const [visible, setVisible] = useState(false);
  const inputId = id || inputProps.name || 'password';

  return (
    <div className="auth-field">
      <label htmlFor={inputId}>{label}</label>
      <div className="auth-pw">
        <input id={inputId} type={visible ? 'text' : 'password'} {...inputProps} />
        <button
          type="button"
          className="auth-pw-toggle"
          onClick={() => setVisible(v => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {hint && <p className="auth-hint">{hint}</p>}
    </div>
  );
}

// Same rule as the server: 8+ characters with a letter and a number.
export function passwordProblem(pw) {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Use at least one letter and one number.';
  return '';
}
