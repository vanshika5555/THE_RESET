import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './CustomerTags.css';

/*
  The shop's private labels and note about a customer. Customers never see
  these. Shown in the customer drawer (editable) and on their orders.
*/

export const PRESET_TAGS = ['VIP', 'Wholesale', 'Influencer', 'Returns often', 'No cash on delivery', 'Prefers WhatsApp'];
const tone = (t) => ({ VIP: 'vip', 'Returns often': 'warn', 'No cash on delivery': 'bad' }[t] || 'plain');

export function TagList({ tags = [], small }) {
  if (!tags.length) return null;
  return (
    <span className={`ct-tags ${small ? 'ct-tags--sm' : ''}`}>
      {tags.map((t) => <span key={t} className={`ct-tag ct-tag--${tone(t)}`}>{t}</span>)}
    </span>
  );
}

export default function CustomerTags({ user, onSaved }) {
  const [tags, setTags] = useState(user.shopTags || []);
  const [note, setNote] = useState(user.shopNote || '');
  const [custom, setCustom] = useState('');
  const [state, setState] = useState('');   // '', 'saving', 'saved', 'error'

  useEffect(() => { setTags(user.shopTags || []); setNote(user.shopNote || ''); setState(''); }, [user._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (nextTags = tags, nextNote = note) => {
    setState('saving');
    try {
      const { data } = await axios.put(`/api/auth/users/${user._id}/notes`, { tags: nextTags, note: nextNote });
      setTags(data.shopTags); setNote(data.shopNote);
      onSaved && onSaved(data);
      setState('saved');
    } catch {
      setState('error');
    }
  };

  const toggle = (t) => {
    const next = tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t].slice(0, 8);
    setTags(next);
    save(next, note);
  };
  const addCustom = (e) => {
    e.preventDefault();
    const t = custom.replace(/\s+/g, ' ').trim().slice(0, 24);
    if (!t || tags.includes(t)) { setCustom(''); return; }
    const next = [...tags, t].slice(0, 8);
    setTags(next); setCustom('');
    save(next, note);
  };

  const extras = tags.filter((t) => !PRESET_TAGS.includes(t));
  const dirty = note.trim() !== (user.shopNote || '').trim() && state !== 'saved';

  return (
    <div className="ct">
      <p className="ct-hint">Only the team sees these. They show on this customer’s orders too.</p>
      <div className="ct-chips" role="group" aria-label="Tags">
        {[...PRESET_TAGS, ...extras].map((t) => (
          <button key={t} type="button" aria-pressed={tags.includes(t)} className={`ct-chip ${tags.includes(t) ? `is-on ct-chip--${tone(t)}` : ''}`} onClick={() => toggle(t)}>
            {tags.includes(t) ? '✓ ' : '+ '}{t}
          </button>
        ))}
      </div>
      <form className="ct-add" onSubmit={addCustom}>
        <input className="input" value={custom} maxLength={24} onChange={(e) => setCustom(e.target.value)} placeholder="Add your own tag" aria-label="Add your own tag" />
        <button type="submit" className="btn btn--secondary" disabled={!custom.trim() || tags.length >= 8}>Add</button>
      </form>
      <textarea
        className="textarea"
        rows={3}
        maxLength={1000}
        value={note}
        onChange={(e) => { setNote(e.target.value); setState(''); }}
        onBlur={() => { if (note.trim() !== (user.shopNote || '').trim()) save(tags, note); }}
        placeholder="e.g. Always orders size M. Call before delivery — works nights."
        aria-label="Private note about this customer"
      />
      <p className={`ct-state ct-state--${state || 'idle'}`} role="status">
        {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : state === 'error' ? 'Could not save — try again.' : dirty ? 'Saves when you click away.' : ''}
      </p>
    </div>
  );
}
