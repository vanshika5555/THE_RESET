import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { plural, Badge, Switch, Empty, ErrorNote, Drawer, Thumb } from './ui';
import PhotoDrop from './PhotoDrop';
import './Edits.css';

/*
  Edits: hand-picked sets of pieces ("The Winter Edit") with their own page
  in the shop at /edit/<link>, and optionally a card on the home page.
*/

const SITE_URL = import.meta.env.REACT_APP_SITE_URL || 'http://localhost:3001';
const BLANK = { title: '', blurb: '', image: '', products: [], published: false, showOnHome: true, position: 0, slug: '' };
const isOwner = () => { try { return (localStorage.getItem('theresetAdminRole') || 'admin') === 'admin'; } catch { return true; } };
const label = (p) => `${p.name}${p.colorName ? ` — ${p.colorName}` : ''}`;
const photo = (p) => (p?.images && p.images[0]) || p?.image || '';
const soldOut = (p) => p.inStock === false || ((p.stock || []).length > 0 && !p.stock.some((s) => s.qty > 0));

export default function Edits() {
  const [edits, setEdits] = useState(null);
  const [catalogue, setCatalogue] = useState([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [editId, setEditId] = useState(null);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = () => axios.get('/api/collections/all').then((r) => setEdits(r.data || [])).catch(() => { setEdits([]); setError('Could not load the edits.'); });
  useEffect(() => {
    load();
    axios.get('/api/products').then((r) => setCatalogue(r.data || [])).catch(() => {});
  }, []);

  const byId = useMemo(() => Object.fromEntries(catalogue.map((p) => [p._id, p])), [catalogue]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const start = (c) => {
    setFormError(''); setQuery('');
    if (c) { setEditId(c._id); setForm({ ...BLANK, ...c, products: (c.products || []).map(String) }); }
    else { setEditId(null); setForm({ ...BLANK, position: edits?.length || 0 }); }
    setOpen(true);
  };

  const pieces = form.products.map((id) => byId[id]).filter(Boolean);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return catalogue
      .filter((p) => !form.products.includes(p._id))
      .filter((p) => `${p.name} ${p.colorName || ''} ${p.subcategory} ${p.category}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, catalogue, form.products]);

  const add = (id) => { set('products', [...form.products, id].slice(0, 60)); setQuery(''); };
  const remove = (id) => set('products', form.products.filter((x) => x !== id));
  const move = (i, d) => {
    const list = [...form.products];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    set('products', list);
  };

  const save = async () => {
    setFormError('');
    if (!form.title.trim()) { setFormError('Give the edit a name.'); return; }
    if (form.published && !form.products.length) { setFormError('Add at least one piece before putting the edit live.'); return; }
    setSaving(true);
    try {
      const body = { title: form.title, blurb: form.blurb, image: form.image, products: form.products, published: form.published, showOnHome: form.showOnHome, position: form.position };
      if (editId) await axios.put(`/api/collections/${editId}`, body);
      else await axios.post('/api/collections', body);
      setOpen(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Could not save the edit.');
    }
    setSaving(false);
  };

  const del = async () => {
    if (!window.confirm(`Delete “${form.title}”? Its page in the shop stops working.`)) return;
    try { await axios.delete(`/api/collections/${editId}`); setOpen(false); load(); }
    catch { setFormError('Could not delete the edit.'); }
  };

  const toggle = async (c, key) => {
    const next = !c[key];
    if (key === 'published' && next && !(c.products || []).length) { setError('Add pieces to that edit before putting it live.'); return; }
    setEdits((l) => l.map((x) => (x._id === c._id ? { ...x, [key]: next } : x)));
    try { await axios.put(`/api/collections/${c._id}`, { [key]: next }); }
    catch { setEdits((l) => l.map((x) => (x._id === c._id ? { ...x, [key]: !next } : x))); setError('Could not save that change.'); }
  };

  const cover = (c) => c.image || photo(byId[String((c.products || [])[0])]);

  return (
    <div className="eds">
      <ErrorNote onClose={() => setError('')}>{error}</ErrorNote>
      <div className="toolbar">
        <p className="eds-lede toolbar-grow">Hand-picked sets of pieces, each with its own page in the shop. Live edits marked “Home” appear on the home page.</p>
        <button type="button" className="btn btn--primary" onClick={() => start(null)}>New edit</button>
      </div>

      {!edits ? (
        <div className="panel"><div className="loading">Loading edits…</div></div>
      ) : edits.length === 0 ? (
        <div className="panel">
          <Empty
            title="No edits yet"
            text="Group pieces into a story — “The Winter Edit”, “Wedding guest”, “Under ₹1,999” — and share one link."
            action={<button type="button" className="btn btn--primary" onClick={() => start(null)}>Create the first edit</button>}
          />
        </div>
      ) : (
        <div className="panel eds-list">
          {edits.map((c) => (
            <div key={c._id} className="eds-row">
              <button type="button" className="eds-main" onClick={() => start(c)}>
                <Thumb src={cover(c)} size="md" />
                <span className="eds-text">
                  <span className="eds-title">{c.title}</span>
                  <span className="eds-sub">{plural((c.products || []).length, 'piece')} · /edit/{c.slug}</span>
                  <span className="eds-badges">
                    <Badge tone={c.published ? 'green' : 'grey'}>{c.published ? 'Live' : 'Draft'}</Badge>
                    {c.published && c.showOnHome && <Badge tone="blue">Home</Badge>}
                  </span>
                </span>
              </button>
              <span className="eds-actions">
                <a className="btn btn--ghost btn--sm" href={`${SITE_URL}/edit/${c.slug}${c.published ? '' : '?preview=1'}`} target="_blank" rel="noreferrer">{c.published ? 'View' : 'Preview'}</a>
                <Switch on={c.published} onChange={() => toggle(c, 'published')} label={c.published ? 'Live in the shop' : 'Put live'} />
              </span>
            </div>
          ))}
        </div>
      )}

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        wide
        title={editId ? form.title || 'Edit' : 'New edit'}
        subtitle={editId ? `${SITE_URL.replace(/^https?:\/\//, '')}/edit/${form.slug}` : 'Its link is made from the name.'}
        footer={
          <>
            {editId && isOwner() && <button type="button" className="btn btn--danger btn--lg" onClick={del}>Delete</button>}
            <button type="button" className="btn btn--primary btn--lg" onClick={save} disabled={saving}>{saving ? 'Saving…' : editId ? 'Save changes' : 'Create edit'}</button>
          </>
        }
      >
        <div className="eds-form">
          {formError && <div className="note-error" role="alert"><span>{formError}</span></div>}

          <div className="field">
            <label className="field-label" htmlFor="ed-title">Name <span className="req">*</span></label>
            <input id="ed-title" className="input" maxLength={60} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="The Winter Edit" />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="ed-blurb">A line about it</label>
            <textarea id="ed-blurb" className="textarea" rows={2} maxLength={300} value={form.blurb} onChange={(e) => set('blurb', e.target.value)} placeholder="Heavy knits, long coats and the boots to go with them." />
          </div>

          <div className="field">
            <span className="field-label">Cover photo</span>
            {form.image ? (
              <div className="eds-cover">
                <img src={form.image} alt="" />
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => set('image', '')}>Remove</button>
              </div>
            ) : (
              <>
                <PhotoDrop onUploaded={(url) => set('image', url)} />
                <span className="field-hint">Optional — without one, the first piece’s photo is used.</span>
              </>
            )}
          </div>

          <div className="field">
            <span className="field-label">Pieces <span className="field-opt">{form.products.length ? `${form.products.length} · shown in this order` : ''}</span></span>
            {pieces.length > 0 && (
              <ol className="eds-pieces">
                {pieces.map((p, i) => (
                  <li key={p._id} className="eds-piece">
                    <span className="eds-piece-img" style={{ background: p.color || '#eee' }}>{photo(p) && <img src={photo(p)} alt="" />}</span>
                    <span className="eds-piece-name">{label(p)}<small>{p.category} · {p.subcategory}{soldOut(p) ? ' · sold out' : ''}{p.inStock === false ? ' — hidden, not shown' : ''}</small></span>
                    <span className="eds-piece-btns">
                      <button type="button" className="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                      <button type="button" className="icon-btn" aria-label="Move down" disabled={i === pieces.length - 1} onClick={() => move(i, 1)}>↓</button>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => remove(p._id)}>Remove</button>
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <div className="eds-search">
              <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products to add…" aria-label="Search products to add" />
              {results.length > 0 && (
                <ul className="eds-results" role="listbox">
                  {results.map((p) => (
                    <li key={p._id}>
                      <button type="button" onClick={() => add(p._id)}>
                        <span className="eds-piece-img" style={{ background: p.color || '#eee' }}>{photo(p) && <img src={photo(p)} alt="" />}</span>
                        <span className="eds-piece-name">{label(p)}<small>{p.category} · {p.subcategory}</small></span>
                        <span className="eds-add">Add</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {query.trim() && !results.length && <span className="field-hint">No products match “{query.trim()}”.</span>}
            </div>
          </div>

          <div className="eds-switches">
            <div className="eds-switch">
              <span><strong>Live in the shop</strong><span>Anyone with the link can see it.</span></span>
              <Switch on={form.published} onChange={() => set('published', !form.published)} label="Live in the shop" />
            </div>
            <div className="eds-switch">
              <span><strong>Show on the home page</strong><span>A card under New Arrivals, while it’s live.</span></span>
              <Switch on={form.showOnHome} onChange={() => set('showOnHome', !form.showOnHome)} label="Show on the home page" />
            </div>
            {form.showOnHome && (
              <div className="field eds-pos">
                <label className="field-label" htmlFor="ed-pos">Order on the home page</label>
                <input id="ed-pos" className="input" inputMode="numeric" value={form.position} onChange={(e) => set('position', e.target.value.replace(/\D/g, '').slice(0, 3))} />
                <span className="field-hint">Lowest number first.</span>
              </div>
            )}
          </div>
        </div>
      </Drawer>
    </div>
  );
}
