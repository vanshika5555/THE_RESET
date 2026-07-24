import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './StyleAnalyser.css';

const SKIN_TONES = ['Fair', 'Wheatish', 'Medium', 'Olive', 'Dark'];
const EYE_COLORS = ['Black', 'Brown', 'Hazel', 'Green', 'Blue'];
const HAIR_COLORS = ['Black', 'Dark Brown', 'Brown', 'Blonde', 'Red', 'Grey', 'White'];
const BODY_TYPES  = ['Slim', 'Athletic', 'Regular', 'Plus Size'];
const OCCASIONS   = ['Everyday Casual', 'Office / Work', 'Formal Event', 'Party / Night Out', 'Date Night'];
const GENDERS     = ['Men', 'Women'];

// ─── Rule-based recommendation engine ───────────────────
const SKIN_DATA = {
  Fair: {
    bestShades: 'Jet black and pure white both look stunning on your complexion. Avoid off-white as it can clash — go for crisp, bright whites instead.',
    contrast: 'high contrast',
    tip: 'Your fair skin creates a dramatic contrast with black — use this to your advantage with bold monochrome looks.',
  },
  Wheatish: {
    bestShades: 'Off-white, cream and ivory suit you beautifully. For black, go for deep charcoal or jet black — both work perfectly.',
    contrast: 'warm contrast',
    tip: 'Warm off-whites complement your golden undertones far better than stark white.',
  },
  Medium: {
    bestShades: 'You have the most versatile complexion — all shades of black and white work for you. Experiment freely!',
    contrast: 'balanced contrast',
    tip: 'Your medium skin tone is the sweet spot — you can pull off everything from crisp white to deep charcoal effortlessly.',
  },
  Olive: {
    bestShades: 'Pure white creates a beautiful glow against your olive skin. For black, charcoal and soft black tones are your best bet.',
    contrast: 'warm glow',
    tip: 'White near your face will make your features pop. Try a white shirt with black trousers for a classic look.',
  },
  Dark: {
    bestShades: 'Bright white and stark black are your power colours — the contrast is striking and sophisticated. Own it.',
    contrast: 'striking contrast',
    tip: 'Your skin tone makes white look absolutely radiant. Don\'t shy away from all-white looks — they were made for you.',
  },
};

const BODY_DATA = {
  Men: {
    Slim: {
      silhouettes: ['Relaxed fit shirts to add volume', 'Layered looks — shirt over tee', 'Wide-leg or straight trousers', 'Structured blazers with shoulder definition'],
      avoid: 'Very tight or body-hugging fits that emphasise narrowness',
    },
    Athletic: {
      silhouettes: ['Slim-fit shirts that follow your shape', 'Tapered trousers', 'Clean crew-neck tees', 'Fitted blazers'],
      avoid: 'Overly baggy fits that hide your physique',
    },
    Regular: {
      silhouettes: ['Classic straight-fit trousers', 'Button-down shirts', 'Chinos with a relaxed shirt', 'Structured jackets'],
      avoid: 'Very tight fits or extremely oversized pieces',
    },
    'Plus Size': {
      silhouettes: ['Dark monochrome head-to-toe for a sleek line', 'Vertical stripe details', 'Well-fitted blazers', 'Straight-leg trousers'],
      avoid: 'Horizontal patterns or overly bulky layers',
    },
  },
  Women: {
    Slim: {
      silhouettes: ['Flowy midi dresses', 'Wide-leg trousers', 'Ruffled or draped tops', 'A-line skirts'],
      avoid: 'Very fitted bodycon styles that emphasise thinness',
    },
    Athletic: {
      silhouettes: ['Fitted blazers to define the waist', 'Wrap dresses', 'High-waisted trousers', 'Tailored co-ords'],
      avoid: 'Boxy or shapeless silhouettes',
    },
    Regular: {
      silhouettes: ['Wrap dresses and tops', 'High-waisted skirts', 'Straight-cut trousers', 'Fitted shirts tucked in'],
      avoid: 'Shapeless or overly baggy fits',
    },
    'Plus Size': {
      silhouettes: ['Empire waist dresses', 'V-neck tops', 'Dark monochrome outfits', 'Flowy wide-leg trousers'],
      avoid: 'Overly tight or overly baggy clothing — fitted but comfortable is the goal',
    },
  },
};

const OCCASION_DATA = {
  'Everyday Casual': {
    Men: {
      outfit: 'White oversized tee + black straight-fit jeans + white sneakers',
      tip: 'Keep it relaxed. A simple white tee tucked slightly into black jeans looks effortlessly put-together.',
    },
    Women: {
      outfit: 'White cotton co-ord set + black slider sandals + minimal gold jewellery',
      tip: 'An all-white co-ord is the easiest casual look. Add a black bag to ground the outfit.',
    },
  },
  'Office / Work': {
    Men: {
      outfit: 'White formal shirt + black slim trousers + black Oxford shoes',
      tip: 'Keep it crisp. Iron your white shirt and tuck it neatly. This is the most powerful work look.',
    },
    Women: {
      outfit: 'Black blazer + white fitted blouse + black tailored trousers + pointed flats',
      tip: 'A black blazer over white is the ultimate power move at work. Add minimal jewellery.',
    },
  },
  'Formal Event': {
    Men: {
      outfit: 'White dress shirt + black formal trousers + black waistcoat + black dress shoes',
      tip: 'A classic black and white formal look is timeless. Focus on fit — everything should be tailored.',
    },
    Women: {
      outfit: 'White structured midi dress + black strappy heels + black clutch',
      tip: 'Let the white dress be the statement. Keep accessories minimal and elegant.',
    },
  },
  'Party / Night Out': {
    Men: {
      outfit: 'Black slim shirt + black trousers + white sneakers for contrast',
      tip: 'All black is your best friend for a night out. Add white sneakers or accessories for a modern edge.',
    },
    Women: {
      outfit: 'Black wrap dress + black heels + white minimal earrings',
      tip: 'An all-black outfit is effortlessly chic for nights out. Let your confidence be the accessory.',
    },
  },
  'Date Night': {
    Men: {
      outfit: 'White linen shirt (slightly open collar) + black slim chinos + clean white sneakers',
      tip: 'Relaxed but polished. Roll the sleeves, leave one button open, and keep it effortless.',
    },
    Women: {
      outfit: 'White off-shoulder top + black wide-leg trousers + black block heels',
      tip: 'The contrast of white on top, black on bottom is romantic and chic. Add delicate gold jewellery.',
    },
  },
};

function generateResult(form) {
  const skin    = SKIN_DATA[form.skinTone];
  const body    = BODY_DATA[form.gender]?.[form.bodyType];
  const occ     = OCCASION_DATA[form.occasion]?.[form.gender];

  return {
    whyBW: `With your ${form.skinTone.toLowerCase()} skin tone and ${form.eyeColor.toLowerCase()} eyes, you have ${skin.contrast} — which is exactly what makes monochrome black and white so powerful on you. ${skin.tip}`,
    bestShades: skin.bestShades,
    silhouettes: body?.silhouettes || [],
    stylingTips: [
      `For your ${form.hairColor.toLowerCase()} hair: wear white near your face to brighten your features, or go all-black when you want a dramatic, high-fashion look.`,
      `The ${form.occasion} setting calls for ${occ?.tip}`,
      `Always ensure your fit is right — in black and white, fit is everything. A perfectly fitted white shirt beats any complicated outfit.`,
    ],
    outfit: occ?.outfit || 'White top + black trousers — a timeless combination that works for any occasion.',
    avoid: body?.avoid || 'Ill-fitting clothes — proportion is key in monochrome dressing.',
  };
}


/**
 * Pick pieces from the catalogue that suit the advice we just gave.
 *
 * Each product is scored on how well its subcategory, name and tags match
 * the recommended silhouettes and the chosen occasion. Anything sold out
 * is dropped, and if nothing scores we simply show the newest arrivals so
 * the customer is never left with an empty shelf.
 */
const OCCASION_WORDS = {
  'Everyday Casual':   ['t-shirt', 'tee', 'shirt', 'denim', 'chino', 'short', 'co-ord', 'top'],
  'Office / Work':     ['formal', 'shirt', 'trouser', 'blazer', 'chino', 'skirt'],
  'Formal Event':      ['blazer', 'formal', 'dress', 'trouser', 'coat'],
  'Party / Night Out': ['dress', 'top', 'shirt', 'skirt', 'co-ord'],
  'Date Night':        ['shirt', 'dress', 'top', 'chino', 'trouser'],
};

function isSoldOut(p) {
  if (!p.inStock) return true;
  if (!p.stock || p.stock.length === 0) return false;
  return (p.sizes || []).every(size => {
    const entry = p.stock.find(e => e.size === size);
    return !entry || entry.qty <= 0;
  });
}

function matchProducts(products, form, result) {
  const available = products.filter(p => !isSoldOut(p));

  const words = [
    ...(result?.silhouettes || []).join(' ').toLowerCase().split(/[^a-z]+/),
    ...(OCCASION_WORDS[form.occasion] || []),
  ].filter(w => w.length > 3);

  const scored = available.map(p => {
    const haystack = [p.subcategory, p.name, p.tag, p.description]
      .filter(Boolean).join(' ').toLowerCase();
    const score = words.reduce((n, w) => (haystack.includes(w) ? n + 1 : n), 0);
    return { p, score };
  });

  const good = scored.filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.p);

  return (good.length >= 2 ? good : available).slice(0, 4);
}

// ────────────────────────────────────────────────────────

export default function StyleAnalyser({ onClose }) {
  const [step, setStep]   = useState(1);
  const [form, setForm]   = useState({ gender: '', skinTone: '', eyeColor: '', hairColor: '', bodyType: '', occasion: '' });
  const [result, setResult] = useState(null);
  const [picks, setPicks] = useState([]);
  const [picksLoading, setPicksLoading] = useState(false);
  const navigate = useNavigate();

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const isFormValid = form.gender && form.skinTone && form.eyeColor && form.hairColor && form.bodyType && form.occasion;

  const analyse = () => {
    setStep(2);
    const generated = generateResult(form);

    // Use the pause to actually fetch something useful.
    setPicksLoading(true);
    axios.get(`/api/products?category=${form.gender}`)
      .then(res => setPicks(matchProducts(res.data || [], form, generated)))
      .catch(() => setPicks([]))
      .finally(() => setPicksLoading(false));

    setTimeout(() => {
      setResult(generated);
      setStep(3);
    }, 1800);
  };

  const reset = () => {
    setStep(1);
    setResult(null);
    setPicks([]);
    setForm({ gender: '', skinTone: '', eyeColor: '', hairColor: '', bodyType: '', occasion: '' });
  };

  return (
    <>
      <div className="sa-overlay" onClick={onClose} />
      <div className="sa-panel">

        {/* Header */}
        <div className="sa-header">
          <div>
            <p className="sa-eyebrow">THE RESET</p>
            <h2 className="sa-title">Style Analyser</h2>
          </div>
          <button className="sa-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Step 1 — Form */}
        {step === 1 && (
          <div className="sa-body">
            <p className="sa-intro">Tell us about yourself and we'll recommend the perfect black & white styles for you.</p>

            <div className="sa-field">
              <label className="sa-label">I'm shopping for</label>
              <div className="sa-pills">
                {GENDERS.map(g => (
                  <button key={g} className={`sa-pill ${form.gender === g ? 'sa-pill--active' : ''}`} onClick={() => set('gender', g)}>{g}</button>
                ))}
              </div>
            </div>

            <div className="sa-field">
              <label className="sa-label">Skin Tone</label>
              <div className="sa-pills">
                {SKIN_TONES.map(s => (
                  <button key={s} className={`sa-pill ${form.skinTone === s ? 'sa-pill--active' : ''}`} onClick={() => set('skinTone', s)}>{s}</button>
                ))}
              </div>
            </div>

            <div className="sa-field">
              <label className="sa-label">Eye Color</label>
              <div className="sa-pills">
                {EYE_COLORS.map(e => (
                  <button key={e} className={`sa-pill ${form.eyeColor === e ? 'sa-pill--active' : ''}`} onClick={() => set('eyeColor', e)}>{e}</button>
                ))}
              </div>
            </div>

            <div className="sa-field">
              <label className="sa-label">Hair Color</label>
              <div className="sa-pills">
                {HAIR_COLORS.map(h => (
                  <button key={h} className={`sa-pill ${form.hairColor === h ? 'sa-pill--active' : ''}`} onClick={() => set('hairColor', h)}>{h}</button>
                ))}
              </div>
            </div>

            <div className="sa-field">
              <label className="sa-label">Body Type</label>
              <div className="sa-pills">
                {BODY_TYPES.map(b => (
                  <button key={b} className={`sa-pill ${form.bodyType === b ? 'sa-pill--active' : ''}`} onClick={() => set('bodyType', b)}>{b}</button>
                ))}
              </div>
            </div>

            <div className="sa-field">
              <label className="sa-label">Occasion</label>
              <div className="sa-pills">
                {OCCASIONS.map(o => (
                  <button key={o} className={`sa-pill ${form.occasion === o ? 'sa-pill--active' : ''}`} onClick={() => set('occasion', o)}>{o}</button>
                ))}
              </div>
            </div>

            <button className="sa-submit" onClick={analyse} disabled={!isFormValid}>
              Analyse My Style ✦
            </button>
          </div>
        )}

        {/* Step 2 — Loading */}
        {step === 2 && (
          <div className="sa-loading">
            <div className="sa-spinner" />
            <p className="sa-loading-text">Analysing your style...</p>
            <p className="sa-loading-sub">Curating your personal style profile</p>
          </div>
        )}

        {/* Step 3 — Result */}
        {step === 3 && result && (
          <div className="sa-body">
            <div className="sa-result-header">
              <div className="sa-result-badge">✦ Your Style Profile</div>
              <div className="sa-result-tags">
                <span>{form.gender}</span>
                <span>{form.skinTone} Skin</span>
                <span>{form.occasion}</span>
              </div>
            </div>

            <div className="sa-result-content">

              <div className="sa-result-block">
                <h4 className="sa-result-heading">Why Black & White Works For You</h4>
                <p className="sa-result-line">{result.whyBW}</p>
              </div>

              <div className="sa-result-block">
                <h4 className="sa-result-heading">Best Shades For You</h4>
                <p className="sa-result-line">{result.bestShades}</p>
              </div>

              <div className="sa-result-block">
                <h4 className="sa-result-heading">Recommended Silhouettes</h4>
                <ul className="sa-result-list">
                  {result.silhouettes.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>

              <div className="sa-result-block">
                <h4 className="sa-result-heading">Styling Tips</h4>
                <ul className="sa-result-list">
                  {result.stylingTips.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>

              <div className="sa-result-block sa-result-block--outfit">
                <h4 className="sa-result-heading">Your Complete Outfit</h4>
                <p className="sa-outfit-text">{result.outfit}</p>
              </div>

              <div className="sa-result-block">
                <h4 className="sa-result-heading">What to Avoid</h4>
                <p className="sa-result-line sa-avoid">{result.avoid}</p>
              </div>

            </div>

            {(picksLoading || picks.length > 0) && (
              <div className="sa-picks">
                <h4 className="sa-result-heading">Pieces For You</h4>

                {picksLoading ? (
                  <p className="sa-picks-loading">Finding pieces from the collection...</p>
                ) : (
                  <div className="sa-picks-grid">
                    {picks.map(p => {
                      const img = (p.images && p.images[0]) || p.image;
                      return (
                        <button
                          type="button"
                          key={p._id}
                          className="sa-pick"
                          onClick={() => { onClose(); navigate(`/product/${p._id}`); }}
                        >
                          <span className="sa-pick-img" style={{ background: p.color || '#f0f0f0' }}>
                            {img && <img src={img} alt={p.name} />}
                          </span>
                          <span className="sa-pick-sub">{p.subcategory}</span>
                          <span className="sa-pick-name">{p.name}</span>
                          <span className="sa-pick-price">{p.price}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="sa-result-actions">
              <button className="sa-btn-outline" onClick={reset}>← Try Again</button>
              <button
                className="sa-btn-fill"
                onClick={() => { onClose(); navigate(form.gender === 'Women' ? '/women' : '/men'); }}
              >
                Shop {form.gender} →
              </button>
            </div>
          </div>
        )}

      </div>
    </>
  );
}