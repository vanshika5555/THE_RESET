import React, { useEffect, useState } from 'react';
import axios from 'axios';
import QRCode from 'qrcode';
import { ErrorNote } from './ui';
import { download } from '../utils/csv';
import './Security.css';

/*
  2-step verification for the admin account: after the password, a 6-digit
  code from an authenticator app on your phone. Someone who learns the
  password still can't get in.
*/

const TOKEN_KEY = 'theresetAdminToken';

// The server signs other devices out when this changes; keep this one signed in.
function keepSession(token) {
  if (!token) return;
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* fine */ }
  axios.defaults.headers.common.Authorization = `Bearer ${token}`;
}

const groups = (s) => String(s).replace(/(.{4})/g, '$1 ').trim();

export default function Security() {
  const [status, setStatus] = useState(null);       // { enabled, backupLeft }
  const [setup, setSetup] = useState(null);         // { secret, otpauth, qr }
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState(null);         // backup codes, shown once
  const [off, setOff] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [digest, setDigest] = useState(null);         // { on, hour }

  const load = () => axios.get('/api/auth/2fa').then((r) => setStatus(r.data)).catch(() => setError('Could not load your security settings.'));
  useEffect(() => {
    load();
    axios.get('/api/auth/digest').then((r) => setDigest(r.data)).catch(() => {});
  }, []);

  const toggleDigest = async () => {
    const on = !digest.on;
    setDigest((d) => ({ ...d, on }));
    try {
      await axios.put('/api/auth/digest', { on });
    } catch {
      setDigest((d) => ({ ...d, on: !on }));
      setError('Could not change the morning email. Try again.');
    }
  };

  // Today's email, opened in a new tab (inside the tap, so phones allow it).
  const previewDigest = async () => {
    const tab = window.open('', '_blank');
    if (tab) tab.document.write('<p style="font:15px Helvetica,Arial,sans-serif;padding:24px">Preparing the preview…</p>');
    try {
      const r = await axios.get('/api/auth/digest/preview', { responseType: 'text' });
      if (!tab) { window.location.href = URL.createObjectURL(new Blob([r.data], { type: 'text/html' })); return; }
      tab.document.open(); tab.document.write(r.data); tab.document.close();
    } catch {
      if (tab) tab.close();
      setError('Could not open the preview. Try again.');
    }
  };

  const hourLabel = (h) => `${((h + 11) % 12) + 1} ${h < 12 ? 'am' : 'pm'}`;

  const start = async () => {
    setBusy(true); setError('');
    try {
      const r = await axios.post('/api/auth/2fa/setup');
      const qr = await QRCode.toDataURL(r.data.otpauth, { margin: 1, width: 220, color: { dark: '#000000', light: '#ffffff' } });
      setSetup({ ...r.data, qr });
      setCode('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not start the setup.');
    }
    setBusy(false);
  };

  const enable = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await axios.post('/api/auth/2fa/enable', { code });
      keepSession(r.data.token);
      setCodes(r.data.backupCodes);
      setSetup(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'That code didn’t work.');
    }
    setBusy(false);
  };

  const disable = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await axios.post('/api/auth/2fa/disable', { password, code });
      setOff(false); setPassword(''); setCode('');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not turn it off.');
    }
    setBusy(false);
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwMsg(''); setError('');
    if (pw.next !== pw.confirm) { setError('The new passwords don’t match.'); return; }
    setBusy(true);
    try {
      const r = await axios.put('/api/auth/changepassword', { currentPassword: pw.current, newPassword: pw.next });
      keepSession(r.data?.token);
      setPw({ current: '', next: '', confirm: '' });
      setPwMsg('Password changed. Other devices have been signed out.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not change the password.');
    }
    setBusy(false);
  };

  const saveCodes = () => download('the-reset-admin-backup-codes.txt',
    `THE RESET — admin backup codes\nEach code works once, if you can't use your authenticator app.\n\n${codes.join('\n')}\n`, 'text/plain;charset=utf-8');

  return (
    <div className="sec">
      <ErrorNote onClose={() => setError('')}>{error}</ErrorNote>

      <section className="panel sec-panel">
        <div className="sec-head">
          <div>
            <h2 className="panel-title">2-step verification</h2>
            <p className="sec-text">
              After your password, the admin asks for a 6-digit code from an app on your phone
              (Google Authenticator, Microsoft Authenticator, 1Password…). A stolen password alone can't get in.
            </p>
          </div>
          {status && (
            <span className={`sec-badge ${status.enabled ? 'sec-badge--on' : ''}`}>{status.enabled ? 'On' : 'Off'}</span>
          )}
        </div>

        {/* Backup codes — shown once, straight after turning it on */}
        {codes && (
          <div className="sec-codes">
            <p className="sec-step">Save your backup codes</p>
            <p className="sec-text">If you lose your phone, each of these lets you in once. Keep them somewhere safe — they won't be shown again.</p>
            <ul className="sec-code-list">{codes.map((c) => <li key={c}>{c}</li>)}</ul>
            <div className="sec-actions">
              <button type="button" className="btn btn--secondary" onClick={saveCodes}>Download</button>
              <button type="button" className="btn btn--secondary" onClick={() => navigator.clipboard?.writeText(codes.join('\n'))}>Copy</button>
              <button type="button" className="btn btn--primary" onClick={() => setCodes(null)}>I've saved them</button>
            </div>
          </div>
        )}

        {status && !status.enabled && !setup && !codes && (
          <div className="sec-actions">
            <button type="button" className="btn btn--primary" onClick={start} disabled={busy}>Turn on</button>
          </div>
        )}

        {setup && (
          <form className="sec-setup" onSubmit={enable}>
            <div className="sec-qr">
              <img src={setup.qr} alt="QR code to add THE RESET to your authenticator app" width="220" height="220" />
            </div>
            <div className="sec-steps">
              <p className="sec-step">1. Scan this with your authenticator app</p>
              <p className="sec-text">
                On this phone? <a href={setup.otpauth}>Open in the app</a>. Can't scan? Choose "enter a setup key" and type:
              </p>
              <code className="sec-key">{groups(setup.secret)}</code>
              <p className="sec-step">2. Enter the 6-digit code it shows</p>
              <div className="sec-confirm">
                <input
                  className="input sec-code-input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={7}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  aria-label="6-digit code"
                />
                <button type="submit" className="btn btn--primary" disabled={busy || code.replace(/\s/g, '').length !== 6}>Turn on</button>
              </div>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSetup(null)}>Cancel</button>
            </div>
          </form>
        )}

        {status?.enabled && !codes && (
          <>
            <p className="sec-text sec-left">
              {status.backupLeft} backup code{status.backupLeft === 1 ? '' : 's'} left.
              {status.backupLeft <= 2 && ' Turn it off and on again to get a fresh set.'}
            </p>
            {!off ? (
              <div className="sec-actions">
                <button type="button" className="btn btn--secondary" onClick={() => { setOff(true); setCode(''); }}>Turn off</button>
              </div>
            ) : (
              <form className="sec-off" onSubmit={disable}>
                <label className="field">
                  <span className="field-label">Password</span>
                  <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </label>
                <label className="field">
                  <span className="field-label">Code from your app (or a backup code)</span>
                  <input className="input" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
                </label>
                <div className="sec-actions">
                  <button type="button" className="btn btn--secondary" onClick={() => setOff(false)}>Keep it on</button>
                  <button type="submit" className="btn btn--danger" disabled={busy || !password || !code}>Turn off</button>
                </div>
              </form>
            )}
          </>
        )}
      </section>

      {digest && (
        <section className="panel sec-panel">
          <div className="sec-head">
            <div>
              <h2 className="panel-title">Morning email</h2>
              <p className="sec-text">
                Every day at {hourLabel(digest.hour)}: orders to confirm and ship, returns waiting and sizes running out
                {digest.owner ? ', plus yesterday’s sales' : ''}.
                Skipped on days with nothing to report.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={digest.on}
              aria-label="Morning email"
              className={`sec-switch ${digest.on ? 'sec-switch--on' : ''}`}
              onClick={toggleDigest}
            >
              <span className="sec-switch-knob" />
            </button>
          </div>
          <div className="sec-actions">
            <button type="button" className="btn btn--secondary" onClick={previewDigest}>See today’s email</button>
          </div>
        </section>
      )}

      <section className="panel sec-panel">
        <h2 className="panel-title">Password</h2>
        {pwMsg && <p className="sec-ok" role="status">{pwMsg}</p>}
        <form className="sec-off" onSubmit={changePassword}>
          <label className="field">
            <span className="field-label">Current password</span>
            <input className="input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} />
          </label>
          <label className="field">
            <span className="field-label">New password</span>
            <input className="input" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} placeholder="8+ characters, a letter and a number" />
          </label>
          <label className="field">
            <span className="field-label">New password again</span>
            <input className="input" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} />
          </label>
          <div className="sec-actions">
            <button type="submit" className="btn btn--primary" disabled={busy || !pw.current || !pw.next}>Change password</button>
          </div>
        </form>
      </section>
    </div>
  );
}
