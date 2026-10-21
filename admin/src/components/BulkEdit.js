import React, { useRef, useState } from 'react';
import axios from 'axios';
import { Drawer, inr, plural } from './ui';
import { toCsv, parseCsv, download } from '../utils/csv';
import './BulkEdit.css';

/*
  Edit prices, stock and visibility for many products at once:
  download the sheet, change it in Excel or Google Sheets, upload it back,
  check the list of changes, apply. Each save goes through the normal product
  update, so back-in-stock and price-drop emails still go out.
*/

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '6', '8', '10', '12', '14', '16', '26', '28', '30', '32', '34', '36', '38', '40'];
const BASE = ['ID', 'Name', 'Colour', 'Department', 'Subcategory', 'Price', 'Original price', 'Listed'];

const sortSizes = (sizes) => [...sizes].sort((a, b) =>
  ((SIZE_ORDER.indexOf(a) + 1) || 99) - ((SIZE_ORDER.indexOf(b) + 1) || 99) || String(a).localeCompare(String(b), undefined, { numeric: true }));
const qtyOf = (p, size) => {
  const e = (p.stock || []).find((s) => s.size === size);
  return e ? Number(e.qty) || 0 : 0;
};
// Prices are numbers now; older data may still be text like "₹2,990".
const money = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^0-9.]/g, '')) || 0);
const yes = (v) => /^(yes|y|true|1|listed|show)$/i.test(String(v).trim());
const no = (v) => /^(no|n|false|0|hidden|hide)$/i.test(String(v).trim());
const num = (v) => {
  const s = String(v ?? '').replace(/[₹,\s]/g, '');
  if (s === '') return null;
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
};

export function exportProducts(products) {
  const sizes = sortSizes([...new Set(products.flatMap((p) => p.sizes || []))]);
  const rows = [
    [...BASE, ...sizes.map((s) => `Stock ${s}`)],
    ...products.map((p) => [
      p._id, p.name, p.colorName || '', p.category, p.subcategory,
      money(p.price), money(p.mrp) || '', p.inStock === false ? 'no' : 'yes',
      ...sizes.map((s) => ((p.sizes || []).includes(s) ? qtyOf(p, s) : '')),
    ]),
  ];
  download(`the-reset-products-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
}

// Compare the uploaded sheet with the live products. Returns { changes, problems }.
function readSheet(text, products) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { changes: [], problems: ['The file is empty.'] };
  const head = rows[0].map((h) => String(h).trim());
  const col = (name) => head.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const iId = col('ID');
  if (iId === -1) return { changes: [], problems: ['There is no ID column. Start from the downloaded sheet.'] };
  const iPrice = col('Price');
  const iMrp = col('Original price');
  const iListed = col('Listed');
  const stockCols = head.map((h, i) => [h, i]).filter(([h]) => /^stock\s+/i.test(h)).map(([h, i]) => [h.replace(/^stock\s+/i, '').trim(), i]);

  const byId = Object.fromEntries(products.map((p) => [String(p._id), p]));
  const changes = [];
  const problems = [];

  rows.slice(1).forEach((r, n) => {
    const line = n + 2;
    const id = String(r[iId] || '').trim();
    if (!id) return;
    const p = byId[id];
    if (!p) { problems.push(`Row ${line}: no product with ID ${id} (deleted?). Skipped.`); return; }
    const label = `${p.name}${p.colorName ? ` — ${p.colorName}` : ''}`;
    const body = {};
    const notes = [];

    let price = money(p.price);
    if (iPrice !== -1) {
      const v = num(r[iPrice]);
      if (Number.isNaN(v) || v === 0) { problems.push(`Row ${line} (${label}): price "${r[iPrice]}" isn't a number. Skipped.`); return; }
      if (v !== null && v !== price) { notes.push(`Price ${inr(price)} → ${inr(v)}`); body.price = v; price = v; }
    }
    if (iMrp !== -1) {
      const v = num(r[iMrp]);
      if (Number.isNaN(v)) { problems.push(`Row ${line} (${label}): original price "${r[iMrp]}" isn't a number. Skipped.`); return; }
      const next = v || 0;
      if (next && next <= price) { problems.push(`Row ${line} (${label}): original price must be higher than the price, or empty. Skipped.`); return; }
      if (next !== money(p.mrp)) { notes.push(next ? `Original price → ${inr(next)}` : 'Sale ended (original price removed)'); body.mrp = next; }
    }
    if (iListed !== -1 && String(r[iListed]).trim() !== '') {
      const v = r[iListed];
      if (!yes(v) && !no(v)) { problems.push(`Row ${line} (${label}): Listed should be yes or no. Skipped.`); return; }
      const listed = yes(v);
      if (listed !== (p.inStock !== false)) { notes.push(listed ? 'Shown in the shop' : 'Hidden from the shop'); body.inStock = listed; }
    }

    let stockChanged = false;
    const stock = (p.sizes || []).map((size) => ({ size, qty: qtyOf(p, size) }));
    for (const [size, i] of stockCols) {
      const raw = String(r[i] ?? '').trim();
      if (raw === '') continue;
      if (!(p.sizes || []).includes(size)) continue;          // not sold in this size — ignore
      const v = num(raw);
      if (Number.isNaN(v) || !Number.isInteger(v)) { problems.push(`Row ${line} (${label}): stock for ${size} "${raw}" isn't a whole number. Skipped.`); return; }
      const entry = stock.find((s) => s.size === size);
      if (entry.qty !== v) { notes.push(`${size}: ${entry.qty} → ${v}`); entry.qty = v; stockChanged = true; }
    }
    if (stockChanged) body.stock = stock;

    if (Object.keys(body).length) changes.push({ id, label, image: p.image, body, notes });
  });

  return { changes, problems };
}

export default function BulkEdit({ products, onDone }) {
  const fileRef = useRef(null);
  const [plan, setPlan] = useState(null);       // { changes, problems, fileName }
  const [progress, setProgress] = useState(null); // { done, failed: [] }
  const [running, setRunning] = useState(false);

  const pick = () => fileRef.current && fileRef.current.click();

  const onFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = readSheet(String(reader.result || ''), products);
      setPlan({ ...res, fileName: file.name });
      setProgress(null);
    };
    reader.readAsText(file);
  };

  const apply = async () => {
    setRunning(true);
    const failed = [];
    let done = 0;
    for (const c of plan.changes) {
      try {
        await axios.put(`/api/products/${c.id}`, c.body);
        done += 1;
      } catch (err) {
        failed.push(`${c.label}: ${err.response?.data?.message || 'not saved'}`);
      }
      setProgress({ done, failed: [...failed] });
    }
    setRunning(false);
    onDone && onDone();
  };

  const close = () => { if (!running) { setPlan(null); setProgress(null); } };
  const finished = progress && !running;

  return (
    <>
      <div className="bulk-btns">
        <button type="button" className="btn btn--secondary" onClick={() => exportProducts(products)} disabled={!products.length}>
          Download sheet
        </button>
        <button type="button" className="btn btn--secondary" onClick={pick}>
          Upload changes
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onFile} />
      </div>

      <Drawer
        open={!!plan}
        onClose={close}
        title="Upload changes"
        subtitle={plan?.fileName}
        footer={plan && (
          finished ? (
            <button type="button" className="btn btn--primary btn--lg" onClick={close}>Done</button>
          ) : (
            <>
              <button type="button" className="btn btn--secondary btn--lg" onClick={close} disabled={running}>Cancel</button>
              <button type="button" className="btn btn--primary btn--lg" onClick={apply} disabled={running || !plan.changes.length}>
                {running ? `Saving ${progress ? progress.done + progress.failed.length : 0} of ${plan.changes.length}…`
                  : plan.changes.length ? `Apply ${plural(plan.changes.length, 'change')}` : 'Nothing to change'}
              </button>
            </>
          )
        )}
      >
        {plan && (
          <div className="bulk">
            {finished && (
              <div className={`bulk-result ${progress.failed.length ? 'bulk-result--warn' : ''}`} role="status">
                {plural(progress.done, 'product')} updated.
                {progress.failed.length > 0 && ` ${progress.failed.length} could not be saved:`}
                {progress.failed.length > 0 && <ul>{progress.failed.map((f) => <li key={f}>{f}</li>)}</ul>}
              </div>
            )}

            {!finished && (
              <p className="bulk-intro">
                {plan.changes.length
                  ? `${plural(plan.changes.length, 'product')} will change. Check the list, then apply.`
                  : 'Nothing in this sheet differs from the shop right now.'}
                {' '}Shoppers waiting for a restock or watching a price are emailed as usual.
              </p>
            )}

            {plan.problems.length > 0 && (
              <div className="bulk-problems">
                <p className="bulk-problems-title">{plural(plan.problems.length, 'row')} skipped</p>
                <ul>{plan.problems.slice(0, 20).map((p) => <li key={p}>{p}</li>)}</ul>
                {plan.problems.length > 20 && <p>…and {plan.problems.length - 20} more.</p>}
              </div>
            )}

            <ul className="bulk-list">
              {plan.changes.map((c) => (
                <li key={c.id} className="bulk-item">
                  <span className="bulk-name">{c.label}</span>
                  <span className="bulk-notes">
                    {c.notes.map((n) => <span key={n} className="bulk-note">{n}</span>)}
                  </span>
                </li>
              ))}
            </ul>

            {!finished && (
              <details className="bulk-help">
                <summary>How the sheet works</summary>
                <p>Change <strong>Price</strong>, <strong>Original price</strong> (leave empty when it isn't on sale), <strong>Listed</strong> (yes / no) and the <strong>Stock</strong> columns. Name, colour and department are there to help you find rows — changing them does nothing. An empty Original price means not on sale; any other empty cell leaves that value as it is.</p>
              </details>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}
