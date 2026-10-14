const Counter = require('../models/Counter');
const Order = require('../models/Order');
const { parsePrice } = require('./price');

/**
 * Invoices for shipped orders.
 *
 * Prices in the shop already include GST, so the tax is worked backwards
 * out of what the customer paid. Readymade garments are taxed at 5% when a
 * piece sells for ₹2,500 or less and 18% above that (GST rates from
 * 22 Sept 2025) — check with your CA before relying on it for filing.
 *
 * Seller details come from the server's environment:
 *   SHOP_LEGAL_NAME  SHOP_ADDRESS  SHOP_STATE  SHOP_GSTIN  SHOP_EMAIL
 * Without SHOP_GSTIN the document is a plain invoice with no tax lines.
 */

const LOW_RATE = 5;
const HIGH_RATE = 18;
const RATE_LIMIT = 2500;

const seller = () => ({
  name:    process.env.SHOP_LEGAL_NAME || 'THE RESET',
  address: process.env.SHOP_ADDRESS || '',
  state:   process.env.SHOP_STATE || '',
  gstin:   (process.env.SHOP_GSTIN || '').toUpperCase(),
  email:   process.env.SHOP_EMAIL || process.env.MAIL_FROM_ADDRESS || '',
});

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const money = (n) => `₹${(Math.round((Number(n) || 0) * 100) / 100)
  .toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const round2 = (n) => Math.round(n * 100) / 100;

const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
});

// Indian financial year label for a date: Apr 2026 – Mar 2027 → "26-27"
function fyLabel(date = new Date()) {
  const d = new Date(new Date(date).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${String(start).slice(2)}-${String(start + 1).slice(2)}`;
}

/**
 * Gives the order an invoice number the first time one is asked for.
 * Numbers run TR/26-27/0001, TR/26-27/0002 … and restart each April.
 */
async function ensureInvoiceNumber(order) {
  if (order.invoice && order.invoice.number) return order;
  const date = order.shipment?.shippedAt || new Date();
  const fy = fyLabel(date);
  const seq = await Counter.next(`invoice-${fy}`);
  const number = `TR/${fy}/${String(seq).padStart(4, '0')}`;

  // Only set it if nobody else did in the meantime (two tabs at once).
  await Order.updateOne(
    { _id: order._id, $or: [{ 'invoice.number': '' }, { 'invoice.number': null }, { 'invoice.number': { $exists: false } }] },
    { $set: { 'invoice.number': number, 'invoice.date': date } }
  );
  return Order.findById(order._id).populate('user', 'name email');
}

/**
 * Works out every line, the tax split and the totals.
 * The order's discount is shared across the items in proportion to price.
 */
function computeInvoice(order) {
  const s = seller();
  const buyerState = String(order.shippingAddress?.state || '').trim().toLowerCase();
  const sameState = !s.state || !buyerState || s.state.trim().toLowerCase() === buyerState;
  const withTax = Boolean(s.gstin);

  const lines = order.items.map((it) => {
    const unit = parsePrice(it.price);
    const qty = Number(it.qty) || 1;
    return { name: it.name, size: it.size, qty, unit, gross: unit * qty };
  });
  const itemsTotal = lines.reduce((n, l) => n + l.gross, 0);
  const discount = Math.min(Number(order.discount) || 0, itemsTotal);

  lines.forEach((l) => {
    const share = itemsTotal ? (l.gross / itemsTotal) * discount : 0;
    l.net = l.gross - share;                       // what was actually paid for this line
    l.rate = (l.net / l.qty) <= RATE_LIMIT ? LOW_RATE : HIGH_RATE;
    l.taxable = round2(l.net / (1 + l.rate / 100));
    l.tax = round2(l.net - l.taxable);
  });

  // Delivery follows the main item's rate (it's part of the same supply).
  const delivery = Number(order.delivery) || 0;
  const mainRate = lines.reduce((best, l) => (l.net > best.net ? l : best), lines[0] || { rate: LOW_RATE, net: 0 }).rate;
  const deliveryTaxable = round2(delivery / (1 + mainRate / 100));
  const deliveryTax = round2(delivery - deliveryTaxable);

  // Tax summary, one row per rate.
  const byRate = {};
  lines.forEach((l) => {
    byRate[l.rate] = byRate[l.rate] || { rate: l.rate, taxable: 0, tax: 0 };
    byRate[l.rate].taxable += l.taxable;
    byRate[l.rate].tax += l.tax;
  });
  if (delivery) {
    byRate[mainRate] = byRate[mainRate] || { rate: mainRate, taxable: 0, tax: 0 };
    byRate[mainRate].taxable += deliveryTaxable;
    byRate[mainRate].tax += deliveryTax;
  }
  const taxRows = Object.values(byRate).sort((a, b) => a.rate - b.rate).map((r) => ({
    rate: r.rate,
    taxable: round2(r.taxable),
    tax: round2(r.tax),
    cgst: sameState ? round2(r.tax / 2) : 0,
    sgst: sameState ? round2(r.tax - round2(r.tax / 2)) : 0,
    igst: sameState ? 0 : round2(r.tax),
  }));

  const total = Number(order.total) || round2(itemsTotal - discount + delivery);
  return {
    seller: s, withTax, sameState, lines, itemsTotal, discount, delivery,
    taxRows, taxTotal: round2(taxRows.reduce((n, r) => n + r.tax, 0)), total,
  };
}

// Rupees in words, Indian style: "One Thousand Two Hundred Ninety Rupees Only"
function inWords(amount) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (n) => (n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`);
  const three = (n) => {
    const h = Math.floor(n / 100), r = n % 100;
    return [h ? `${ones[h]} Hundred` : '', r ? two(r) : ''].filter(Boolean).join(' ');
  };
  let n = Math.floor(amount);
  const paise = Math.round((amount - n) * 100);
  if (n === 0 && !paise) return 'Zero Rupees Only';
  const parts = [];
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  if (crore) parts.push(`${two(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (n) parts.push(three(n));
  const rupees = parts.length ? `${parts.join(' ')} Rupees` : '';
  return `${[rupees, paise ? `${two(paise)} Paise` : ''].filter(Boolean).join(' and ')} Only`;
}

function renderInvoice(order) {
  const inv = computeInvoice(order);
  const s = inv.seller;
  const a = order.shippingAddress || {};
  const buyer = a.fullName || order.user?.name || order.guest?.name || 'Customer';
  const email = order.user?.email || order.guest?.email || '';
  const addr = [a.houseNo, a.address, a.landmark, a.city, a.state].filter(Boolean).join(', ');
  const orderNo = String(order._id).slice(-8).toUpperCase();
  const title = inv.withTax ? 'Tax Invoice' : 'Invoice';

  const itemRows = inv.lines.map((l, i) => `
    <tr>
      <td class="n">${i + 1}</td>
      <td>${esc(l.name)}<div class="sub">Size ${esc(l.size || '—')}${inv.withTax ? ` · GST ${l.rate}%` : ''}</div></td>
      <td class="r">${l.qty}</td>
      <td class="r">${money(l.unit)}</td>
      <td class="r">${money(l.gross)}</td>
    </tr>`).join('');

  const taxTable = inv.withTax ? `
    <table class="tax">
      <thead><tr>
        <th>GST rate</th><th class="r">Taxable value</th>
        ${inv.sameState ? '<th class="r">CGST</th><th class="r">SGST</th>' : '<th class="r">IGST</th>'}
        <th class="r">Total tax</th>
      </tr></thead>
      <tbody>${inv.taxRows.map((r) => `
        <tr>
          <td>${r.rate}%</td><td class="r">${money(r.taxable)}</td>
          ${inv.sameState
            ? `<td class="r">${money(r.cgst)}</td><td class="r">${money(r.sgst)}</td>`
            : `<td class="r">${money(r.igst)}</td>`}
          <td class="r">${money(r.tax)}</td>
        </tr>`).join('')}
      </tbody>
    </table>` : '';

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} ${esc(order.invoice?.number || orderNo)} — THE RESET</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f2f2f1; color: #111; font: 13px/1.5 "Helvetica Neue", Helvetica, Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .bar { position: sticky; top: 0; display: flex; justify-content: center; gap: 10px; padding: 12px; background: #000; }
  .bar button { height: 42px; padding: 0 22px; border: 1px solid #fff; background: #fff; color: #000; font-family: inherit; font-size: 12px; font-weight: 600; line-height: 1; letter-spacing: .1em; text-transform: uppercase; cursor: pointer; }
  .bar button + button { background: none; color: #fff; }
  .page { max-width: 820px; margin: 24px auto; padding: 44px 48px; background: #fff; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding-bottom: 22px; border-bottom: 2px solid #000; }
  .brand { font-size: 30px; font-weight: 800; letter-spacing: -.01em; line-height: 1; font-stretch: condensed; }
  .doc { text-align: right; }
  .doc h1 { margin: 0 0 6px; font-size: 13px; letter-spacing: .18em; text-transform: uppercase; }
  .doc p { margin: 0; color: #555; }
  .doc strong { color: #111; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; padding: 22px 0; }
  .label { margin: 0 0 6px; font-size: 10.5px; letter-spacing: .16em; text-transform: uppercase; color: #888; }
  .parties p { margin: 0; color: #444; }
  .parties .who { color: #111; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; }
  .items th, .tax th { padding: 9px 8px; font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase; color: #666; text-align: left; border-bottom: 1px solid #111; }
  .items td, .tax td { padding: 11px 8px; border-bottom: 1px solid #e7e7e5; vertical-align: top; }
  .items .n { width: 28px; color: #999; }
  .sub { font-size: 11.5px; color: #888; }
  .r, .items th.r, .tax th.r { text-align: right; white-space: nowrap; }
  .sum { display: flex; justify-content: flex-end; margin-top: 14px; }
  .sum table { width: 340px; }
  .sum td { padding: 5px 8px; }
  .sum .total td { padding-top: 10px; border-top: 2px solid #000; font-size: 16px; font-weight: 700; }
  .words { margin: 14px 0 0; padding: 10px 12px; background: #f6f6f4; color: #444; }
  .tax { margin-top: 22px; }
  .foot { display: flex; justify-content: space-between; gap: 24px; margin-top: 34px; padding-top: 16px; border-top: 1px solid #e7e7e5; font-size: 11.5px; color: #888; }
  @media (max-width: 640px) {
    .page { margin: 0; padding: 24px 18px; }
    .top, .parties { grid-template-columns: 1fr; flex-direction: column; }
    .doc { text-align: left; }
    .sum table { width: 100%; }
    .foot { flex-direction: column; }
    .items th, .items td, .tax th, .tax td { padding-left: 4px; padding-right: 4px; }
    .tax th, .tax td { font-size: 11.5px; }
  }
  @media print {
    body { background: #fff; }
    .bar { display: none; }
    .page { margin: 0; padding: 0; max-width: none; }
  }
</style>
</head><body>
<div class="bar">
  <button type="button" onclick="window.print()">Print / Save as PDF</button>
  <button type="button" onclick="window.close()">Close</button>
</div>
<main class="page">
  <section class="top">
    <div>
      <div class="brand">THE RESET</div>
      <p style="margin:8px 0 0;color:#555">${esc(s.name !== 'THE RESET' ? s.name : 'Considered essentials')}</p>
    </div>
    <div class="doc">
      <h1>${title}</h1>
      <p>Invoice no. <strong>${esc(order.invoice?.number || '—')}</strong></p>
      <p>Invoice date <strong>${fmtDate(order.invoice?.date || order.createdAt)}</strong></p>
      <p>Order <strong>#${orderNo}</strong> · ${fmtDate(order.createdAt)}</p>
    </div>
  </section>

  <section class="parties">
    <div>
      <p class="label">Sold by</p>
      <p class="who">${esc(s.name)}</p>
      ${s.address ? `<p>${esc(s.address)}</p>` : ''}
      ${s.gstin ? `<p>GSTIN ${esc(s.gstin)}</p>` : ''}
      ${s.email ? `<p>${esc(s.email)}</p>` : ''}
    </div>
    <div>
      <p class="label">Bill &amp; ship to</p>
      <p class="who">${esc(buyer)}</p>
      ${addr ? `<p>${esc(addr)}${a.pincode ? ` – ${esc(a.pincode)}` : ''}</p>` : ''}
      ${a.phone ? `<p>+91 ${esc(a.phone)}</p>` : ''}
      ${email ? `<p>${esc(email)}</p>` : ''}
      ${inv.withTax && a.state ? `<p>Place of supply: ${esc(a.state)}</p>` : ''}
    </div>
  </section>

  <table class="items">
    <thead><tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Amount</th></tr></thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="sum"><table>
    <tr><td>Items</td><td class="r">${money(inv.itemsTotal)}</td></tr>
    ${inv.discount ? `<tr><td>Discount${order.couponCode ? ` (${esc(order.couponCode)})` : ''}</td><td class="r">− ${money(inv.discount)}</td></tr>` : ''}
    <tr><td>Delivery</td><td class="r">${inv.delivery ? money(inv.delivery) : 'Free'}</td></tr>
    ${inv.withTax ? `<tr><td style="color:#888">Includes GST</td><td class="r" style="color:#888">${money(inv.taxTotal)}</td></tr>` : ''}
    <tr class="total"><td>Total paid</td><td class="r">${money(inv.total)}</td></tr>
  </table></div>

  <p class="words">Amount in words: <strong>${esc(inWords(inv.total))}</strong></p>

  <div style="overflow-x:auto">${taxTable}</div>

  <footer class="foot">
    <span>Prices include GST where applicable. This is a computer-generated invoice and needs no signature.</span>
    <span>Questions? Reply to your order email.</span>
  </footer>
</main>
</body></html>`;
}

module.exports = { ensureInvoiceNumber, computeInvoice, renderInvoice, inWords, fyLabel };
