import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { fmtDate, ErrorNote, Empty } from './ui';
import './Team.css';

/*
  Who can open the admin. Staff run orders, returns, products and reviews.
  Only the owner sees customers, discount codes, reports and this page,
  and only the owner can send refunds.
*/
export default function Team() {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '' });
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(null);   // { email, tempPassword }

  const load = () => axios.get('/api/auth/team')
    .then((r) => setPeople(r.data || []))
    .catch(() => setError('Could not load the team.'))
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    setAdding(true); setError(''); setAdded(null);
    try {
      const r = await axios.post('/api/auth/team', form);
      setAdded({ email: r.data.email, tempPassword: r.data.tempPassword });
      setForm({ name: '', email: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not add them.');
    }
    setAdding(false);
  };

  const remove = async (p) => {
    if (!window.confirm(`Remove ${p.name} from the team? They'll be signed out of the admin straight away.`)) return;
    try {
      await axios.delete(`/api/auth/team/${p._id}`);
      setPeople((l) => l.filter((x) => x._id !== p._id));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not remove them.');
    }
  };

  return (
    <div className="team">
      <ErrorNote onClose={() => setError('')}>{error}</ErrorNote>

      <section className="panel team-panel">
        <h2 className="panel-title">Add someone</h2>
        <p className="team-text">
          Staff can handle orders, returns, products and reviews. They can't see customers, discount codes or reports,
          and can't send refunds — those stay with you.
        </p>
        <form className="team-form" onSubmit={add}>
          <label className="field">
            <span className="field-label">Name</span>
            <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Aman" />
          </label>
          <label className="field">
            <span className="field-label">Email</span>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="aman@example.com" required />
          </label>
          <button type="submit" className="btn btn--primary" disabled={adding || !form.email}>{adding ? 'Adding…' : 'Add to team'}</button>
        </form>
        {added && (
          <div className="team-added" role="status">
            <strong>{added.email}</strong> is on the team and has been emailed.
            {added.tempPassword
              ? <> Their first password is <code>{added.tempPassword}</code> — they should change it under Security after signing in.</>
              : ' They already had a shop account, so they sign in with their usual password.'}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head"><h2 className="panel-title">Team</h2></div>
        {loading ? <div className="loading">Loading…</div>
          : people.length === 0 ? <Empty title="Just you for now" text="Add staff above." />
          : people.map((p) => (
            <div key={p._id} className="team-row">
              <span className="team-avatar" aria-hidden="true">{(p.name || '?').charAt(0).toUpperCase()}</span>
              <span className="team-who">
                <strong>{p.name}</strong>
                <span>{p.email}</span>
              </span>
              <span className="team-tags">
                <span className={`team-role team-role--${p.role}`}>{p.role === 'admin' ? 'Owner' : 'Staff'}</span>
                <span className={`team-2fa ${p.twoFactorEnabled ? 'is-on' : ''}`}>{p.twoFactorEnabled ? '2-step on' : '2-step off'}</span>
              </span>
              <span className="team-since">since {fmtDate(p.createdAt)}</span>
              {p.role === 'staff'
                ? <button type="button" className="btn btn--ghost btn--sm team-remove" onClick={() => remove(p)}>Remove</button>
                : <span />}
            </div>
          ))}
      </section>
    </div>
  );
}
