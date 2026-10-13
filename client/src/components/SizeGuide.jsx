import React, { useState, useEffect } from 'react';
import './SizeGuide.css';

/**
 * Size guide shown from the product page.
 *
 * Figures follow common Indian retail sizing (Westside, Torani and similar).
 * They are body measurements — the size that fits that body — not the flat
 * measurement of the garment itself.
 */

// ---- Men, upper body (letter sizes) ----
const MEN_TOPS = {
  note: 'Measure around the fullest part of your chest, keeping the tape level under your arms.',
  columns: ['Size', 'Chest (in)', 'Waist (in)', 'Shoulder (in)'],
  rows: [
    ['XS',  '34–36', '28–30', '16.5'],
    ['S',   '36–38', '30–32', '17'],
    ['M',   '38–40', '32–34', '17.5'],
    ['L',   '40–42', '34–36', '18'],
    ['XL',  '42–44', '36–38', '18.5'],
    ['XXL', '44–46', '38–40', '19'],
  ],
  cmRows: [
    ['XS',  '86–91',  '71–76',  '42'],
    ['S',   '91–96',  '76–81',  '43'],
    ['M',   '96–101', '81–86',  '44'],
    ['L',   '101–106','86–91',  '46'],
    ['XL',  '106–111','91–96',  '47'],
    ['XXL', '111–116','96–101', '48'],
  ],
};

// ---- Men, bottoms (numeric waist sizes) ----
const MEN_BOTTOMS = {
  note: 'The size number is your waist in inches. Measure around your natural waistline, about level with your navel.',
  columns: ['Size', 'Waist (in)', 'Hip (in)', 'Inseam (in)'],
  rows: [
    ['28', '28', '36', '30'],
    ['30', '30', '38', '30'],
    ['32', '32', '40', '30'],
    ['34', '34', '42', '30'],
    ['36', '36', '44', '30'],
    ['38', '38', '46', '30'],
  ],
  cmRows: [
    ['28', '71', '91',  '76'],
    ['30', '76', '96',  '76'],
    ['32', '81', '101', '76'],
    ['34', '86', '106', '76'],
    ['36', '91', '111', '76'],
    ['38', '96', '116', '76'],
  ],
};

// ---- Women, letter sizes ----
const WOMEN_TOPS = {
  note: 'Measure your bust at the fullest point, your waist at its narrowest, and your hips about 8 inches below the waist.',
  columns: ['Size', 'Bust (in)', 'Waist (in)', 'Hip (in)'],
  rows: [
    ['XS',  '32', '26', '35'],
    ['S',   '34', '28', '37'],
    ['M',   '36', '30', '39'],
    ['L',   '38', '32', '41'],
    ['XL',  '40', '34', '43'],
    ['XXL', '42', '36', '45'],
  ],
  cmRows: [
    ['XS',  '81',  '66', '89'],
    ['S',   '86',  '71', '94'],
    ['M',   '91',  '76', '99'],
    ['L',   '96',  '81', '104'],
    ['XL',  '101', '86', '109'],
    ['XXL', '107', '91', '114'],
  ],
};

// ---- Women, numeric (UK) sizes ----
const WOMEN_NUMERIC = {
  note: 'These are UK numeric sizes. Measure your bust at the fullest point and your hips at the widest.',
  columns: ['Size', 'Bust (in)', 'Waist (in)', 'Hip (in)'],
  rows: [
    ['6',  '30', '24', '34'],
    ['8',  '32', '26', '36'],
    ['10', '34', '28', '38'],
    ['12', '36', '30', '40'],
    ['14', '38', '32', '42'],
    ['16', '40', '34', '44'],
  ],
  cmRows: [
    ['6',  '76',  '61', '86'],
    ['8',  '81',  '66', '91'],
    ['10', '86',  '71', '96'],
    ['12', '91',  '76', '101'],
    ['14', '96',  '81', '107'],
    ['16', '101', '86', '112'],
  ],
};

// Which chart this product needs. The product itself says whether it is
// worn on the upper or lower body, so there is no guessing involved.
function pickChart(category, fitType, sizes = []) {
  // Fall back to reading the sizes for products saved before fitType existed.
  const fit = fitType || (sizes.some(s => /^\d+$/.test(s)) ? 'Bottom' : 'Top');

  if (category === 'Women') {
    return fit === 'Bottom' ? WOMEN_NUMERIC : WOMEN_TOPS;
  }
  return fit === 'Bottom' ? MEN_BOTTOMS : MEN_TOPS;
}

export default function SizeGuide({ category, fitType, sizes, availableSizes, onClose }) {
  const [unit, setUnit] = useState('in');
  const chart = pickChart(category, fitType, sizes);

  // close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const rows = unit === 'in' ? chart.rows : chart.cmRows;
  const columns = unit === 'in'
    ? chart.columns
    : chart.columns.map(c => c.replace('(in)', '(cm)'));

  return (
    <div className="sg-backdrop" onClick={onClose}>
      <div className="sg-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Size guide">
        <div className="sg-head">
          <h2 className="sg-title">Size Guide</h2>
          <button className="sg-close" onClick={onClose} aria-label="Close size guide">
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="sg-toolbar">
          <span className="sg-cat">{category} · {chart === MEN_BOTTOMS || chart === WOMEN_NUMERIC ? 'Bottoms' : 'Tops'}</span>
          <div className="sg-units">
            <button
              type="button"
              aria-pressed={unit === 'in'}
              className={unit === 'in' ? 'sg-unit sg-unit--on' : 'sg-unit'}
              onClick={() => setUnit('in')}
            >Inches</button>
            <button
              type="button"
              aria-pressed={unit === 'cm'}
              className={unit === 'cm' ? 'sg-unit sg-unit--on' : 'sg-unit'}
              onClick={() => setUnit('cm')}
            >CM</button>
          </div>
        </div>

        <div className="sg-table-wrap">
          <table className="sg-table">
            <thead>
              <tr>{columns.map(c => <th key={c}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const size = row[0];
                const stocked = !sizes || sizes.includes(size);
                const available = !availableSizes || availableSizes.includes(size);
                return (
                  <tr
                    key={size}
                    className={
                      !stocked ? 'sg-row--other'
                      : !available ? 'sg-row--gone'
                      : ''
                    }
                  >
                    {row.map((cell, i) => (
                      <td key={i} className={i === 0 ? 'sg-size-cell' : ''}>
                        {cell}
                        {i === 0 && stocked && !available && (
                          <span className="sg-gone-tag">sold out</span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="sg-note">{chart.note}</p>

        <div className="sg-tips">
          <p className="sg-tips-title">Getting it right</p>
          <ul>
            <li>Measure over light clothing, with the tape snug but not tight.</li>
            <li>If you fall between two sizes, size up for a relaxed fit.</li>
            <li>These are body measurements, not the garment's own measurements.</li>
          </ul>
        </div>

        <p className="sg-help">
          Still unsure? Measurements can vary slightly between pieces — get in
          touch and we will check the exact garment for you.
        </p>
      </div>
    </div>
  );
}