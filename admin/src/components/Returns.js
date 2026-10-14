import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { fmtDate, shortId, Badge, Empty, ErrorNote, Drawer, Section, FilterTabs, Thumb } from './ui';
import './Returns.css';

const TONE = {
  Requested: 'amber', Approved: 'blue', Received: 'violet',
  Refunded: 'green', Exchanged: 'green', Rejected: 'red',
};

// The one obvious next step for each status (matches the server's rules).
const NEXT = {
  Requested: [{ to: 'Approved', label: 'Approve' }, { to: 'Rejected', label: 'Reject', danger: true }],
  Approved:  [{ to: 'Received', label: 'Mark pieces received' }, { to: 'Rejected', label: 'Reject', danger: true }],
  Received:  [],   // depends on type — see below
};

const OPEN = ['Requested', 'Approved', 'Received'];

export default function Returns() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('open');
  const [openId, setOpenId] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    axios.get('/api/returns')
      .then(res => setList(res.data || []))
      .catch(() => setError('Returns could not be loaded. Check that the server is running.'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const shown = useMemo(
    () => list.filter(r => (tab === 'open' ? OPEN.includes(r.status) : tab === 'done' ? !OPEN.includes(r.status) : true)),
    [list, tab]
  );
  const openCount = list.filter(r => OPEN.includes(r.status)).length;
  const current = list.find(r => r._id === openId) || null;

  const openRequest = (r) => { setOpenId(r._id); setMessage(r.shopMessage || ''); };

  const update = async (status) => {
    if (!current) return;
    if (status === 'Rejected' && !message.trim()) {
      setError('Add a short note for the customer explaining why, then reject.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await axios.put(`/api/returns/${current._id}`, { status, shopMessage: message });
      setList(l => l.map(x => (x._id === current._id ? { ...x, ...res.data, user: x.user, order: x.order } : x)));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update this request.');
    }
    setBusy(false);
  };

  const saveNote = async () => {
    if (!current) return;
    setBusy(true);
    try {
      await axios.put(`/api/returns/${current._id}`, { shopMessage: message });
      setList(l => l.map(x => (x._id === current._id ? { ...x, shopMessage: message } : x)));
    } catch {
      setError('Could not save the note.');
    }
    setBusy(false);
  };

  const actions = current
    ? current.status === 'Received'
      ? [current.type === 'exchange'
          ? { to: 'Exchanged', label: 'Send the new size' }
          : { to: 'Refunded', label: 'Mark refunded' }]
      : (NEXT[current.status] || [])
    : [];

  return (
    <div className="returns">
      <ErrorNote onClose={() => setError('')}>{error}</ErrorNote>

      <div className="toolbar">
        <p className="rt-intro toolbar-grow">Return and exchange requests from customers. Each step emails them automatically.</p>
      </div>

      <FilterTabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'open', label: 'To do', count: openCount },
          { value: 'done', label: 'Closed' },
          { value: 'all', label: 'All', count: list.length },
        ]}
      />

      <div className="panel">
        {loading ? (
          <div className="loading">Loading returns…</div>
        ) : shown.length === 0 ? (
          <Empty
            title={tab === 'open' ? 'Nothing to do' : 'No requests here'}
            text="Customers can ask for a return or exchange from their order page for 7 days after delivery."
          />
        ) : shown.map(r => (
          <button type="button" key={r._id} className="rt-row" onClick={() => openRequest(r)}>
            <Thumb src={r.items[0]?.image} size="md" />
            <span className="rt-main">
              <span className="rt-line">
                <strong>{r.type === 'exchange' ? 'Exchange' : 'Return'}</strong>
                <Badge tone={TONE[r.status]}>{r.status}</Badge>
              </span>
              <span className="rt-items">
                {r.items.map(i => `${i.name} (${i.size}${i.exchangeSize ? ` → ${i.exchangeSize}` : ''}) ×${i.qty}`).join(', ')}
              </span>
              <span className="rt-meta">{r.user?.name || 'Customer'} · {r.reason} · {fmtDate(r.createdAt)}</span>
            </span>
            <span className="rt-order">Order {shortId(r.order?._id || r.order)}</span>
          </button>
        ))}
      </div>

      <Drawer
        open={!!current}
        onClose={() => setOpenId(null)}
        title={current ? `${current.type === 'exchange' ? 'Exchange' : 'Return'} request` : ''}
        subtitle={current ? `${current.user?.name || ''} · ${current.user?.email || ''}` : ''}
        footer={current && actions.length > 0 && (
          <div className="rt-actions">
            {actions.map(a => (
              <button
                key={a.to}
                type="button"
                className={`btn ${a.danger ? 'btn--danger' : 'btn--primary'} btn--lg`}
                disabled={busy}
                onClick={() => update(a.to)}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      >
        {current && (
          <>
            <Section title="Status" aside={<Badge tone={TONE[current.status]}>{current.status}</Badge>}>
              <p className="rt-help">
                {current.status === 'Requested' && 'Check the reason, then approve to arrange pickup, or reject with a note.'}
                {current.status === 'Approved' && 'Once the pieces reach you and pass the check, mark them received — they go back into stock.'}
                {current.status === 'Received' && (current.type === 'exchange'
                  ? 'Send the new size. Its stock is taken off automatically (it must be in stock).'
                  : 'Refund the customer through your payment provider, then mark it refunded here.')}
                {['Refunded', 'Exchanged', 'Rejected'].includes(current.status) && 'This request is closed.'}
              </p>
            </Section>

            <Section title="Pieces">
              {current.items.map((i, k) => (
                <div key={k} className="rt-piece">
                  <Thumb src={i.image} size="md" />
                  <span>
                    <strong>{i.name}</strong>
                    <span>Size {i.size}{i.exchangeSize ? ` → new size ${i.exchangeSize}` : ''} · Qty {i.qty} · {i.price}</span>
                  </span>
                </div>
              ))}
            </Section>

            <Section title="Customer said">
              <p className="rt-reason"><strong>{current.reason}</strong></p>
              {current.note && <p className="rt-note">“{current.note}”</p>}
              <p className="rt-help">Order {shortId(current.order?._id || current.order)}, placed {current.order?.createdAt ? fmtDate(current.order.createdAt) : '—'}</p>
            </Section>

            <Section title="Note to the customer">
              <textarea
                className="textarea"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. Pickup booked for Friday between 10 and 2"
              />
              <p className="rt-help">Shown on their order page and in the next email.</p>
              {message !== (current.shopMessage || '') && (
                <button type="button" className="btn btn--secondary btn--sm" disabled={busy} onClick={saveNote}>Save note</button>
              )}
            </Section>
          </>
        )}
      </Drawer>
    </div>
  );
}
