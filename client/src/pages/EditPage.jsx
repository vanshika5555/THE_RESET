import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import usePageMeta from '../hooks/usePageMeta';
import Loading from '../components/Loading';
import ProductCard from '../components/ProductCard';
import { cdn } from '../utils/img';
import './EditPage.css';

/* /edit/:slug — a hand-picked set of pieces ("The Winter Edit"). */
export default function EditPage() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const preview = params.get('preview') === '1';
  const [edit, setEdit] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setEdit(null); setError('');
    axios.get(`/api/collections/${encodeURIComponent(slug)}`, { params: preview ? { preview: 1 } : {} })
      .then((r) => { if (active) setEdit(r.data); })
      .catch((err) => { if (active) setError(err.response?.data?.message || 'Could not load this edit.'); });
    return () => { active = false; };
  }, [slug, preview]);

  usePageMeta({
    title: edit ? edit.title : 'The edit',
    description: edit?.blurb || 'A hand-picked edit from THE RESET.',
    image: edit?.image,
  });

  if (!edit && !error) return <Loading label="Loading the edit..." />;
  if (error) {
    return (
      <div className="ed-state">
        <p>{error}</p>
        <div className="ed-state-links"><Link to="/men">Shop Men</Link><Link to="/women">Shop Women</Link></div>
      </div>
    );
  }

  return (
    <div className="ed">
      {!edit.published && <p className="ed-draft">Preview — this edit isn’t live yet.</p>}
      <header className={`ed-hero ${edit.image ? 'ed-hero--img' : ''}`}>
        {edit.image && <img className="ed-hero-img" src={cdn(edit.image, 1600)} alt="" />}
        <div className="ed-hero-text">
          <p className="ed-eyebrow">The edit · {edit.products.length} piece{edit.products.length === 1 ? '' : 's'}</p>
          <h1 className="ed-title">{edit.title}</h1>
          {edit.blurb && <p className="ed-blurb">{edit.blurb}</p>}
        </div>
      </header>
      {edit.products.length === 0 ? (
        <p className="ed-empty">Nothing in this edit right now — check back soon.</p>
      ) : (
        <div className="cp-grid ed-grid">
          {edit.products.map((p) => <ProductCard key={p._id} product={p} all={edit.products} />)}
        </div>
      )}
    </div>
  );
}
