const { SHOP_URL } = require('./mailer');

/**
 * Email templates. Plain tables and inline styles, because that is the only
 * thing every inbox (Gmail, Outlook, Apple Mail) renders the same way.
 * Every template returns { subject, html, text }.
 */

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const inr = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;
const shortId = (id) => String(id).slice(-8).toUpperCase();
const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';

function layout({ preheader = '', heading, body, cta }) {
  const button = cta
    ? `<tr><td style="padding:8px 0 28px">
         <a href="${esc(cta.href)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;
            font:500 13px/1 Helvetica,Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;padding:16px 28px">
           ${esc(cta.label)}
         </a>
       </td></tr>`
    : '';

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f3f0">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3f0;padding:32px 12px">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff">
    <tr><td style="background:#111;padding:22px 32px;font:600 18px/1 Georgia,serif;letter-spacing:.28em;color:#fff">THE RESET</td></tr>
    <tr><td style="padding:36px 32px 8px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="font:400 26px/1.25 Georgia,serif;color:#111;padding-bottom:16px">${heading}</td></tr>
        <tr><td style="font:400 15px/1.65 Helvetica,Arial,sans-serif;color:#444;padding-bottom:20px">${body}</td></tr>
        ${button}
      </table>
    </td></tr>
    <tr><td style="padding:20px 32px 28px;border-top:1px solid #eee;font:400 12px/1.6 Helvetica,Arial,sans-serif;color:#999">
      Questions? Just reply to this email or visit <a href="${SHOP_URL()}/help" style="color:#666">our help page</a>.<br>
      THE RESET · Dressed in silence. Built with intention.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

function itemsTable(items) {
  const rows = items.map(i => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font:400 14px/1.4 Helvetica,Arial,sans-serif;color:#111">
        ${esc(i.name)}<br><span style="color:#999;font-size:12px">Size ${esc(i.size)} · Qty ${Number(i.qty) || 1}</span>
      </td>
      <td align="right" style="padding:10px 0;border-bottom:1px solid #f0f0f0;font:400 14px Helvetica,Arial,sans-serif;color:#111;white-space:nowrap">
        ${esc(i.price)}
      </td>
    </tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
}

function totalsTable(order) {
  const line = (label, value, strong) => `
    <tr>
      <td style="padding:4px 0;font:${strong ? 600 : 400} 14px Helvetica,Arial,sans-serif;color:${strong ? '#111' : '#666'}">${label}</td>
      <td align="right" style="padding:4px 0;font:${strong ? 600 : 400} 14px Helvetica,Arial,sans-serif;color:${strong ? '#111' : '#666'}">${value}</td>
    </tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">
    ${line('Subtotal', inr(order.subtotal))}
    ${order.discount > 0 ? line(`Discount${order.couponCode ? ` (${esc(order.couponCode)})` : ''}`, `− ${inr(order.discount)}`) : ''}
    ${line('Delivery', order.delivery > 0 ? inr(order.delivery) : 'Free')}
    ${order.payment && order.payment.codFee > 0 ? line('Cash on delivery fee', inr(order.payment.codFee)) : ''}
    ${line('Total', inr(order.total || order.subtotal), true)}
  </table>`;
}

// "Pay ₹X when it arrives" — for cash on delivery orders still to be paid.
function payLine(order) {
  if (!order.payment || order.payment.method !== 'cod' || order.payment.status !== 'Pending') return '';
  return `<p style="margin:16px 0 0;padding:12px 14px;border:1.5px solid #111;font:400 14px/1.5 Helvetica,Arial,sans-serif;color:#111">
    <strong>Cash on delivery:</strong> please keep <strong>${inr(order.total || order.subtotal)}</strong> ready — pay the courier in cash or by UPI when it arrives.</p>`;
}

function addressBlock(a = {}) {
  const parts = [a.houseNo, a.address, a.landmark, a.city, a.state].filter(Boolean).map(esc).join(', ');
  return `<p style="margin:20px 0 0;padding:14px 16px;background:#f7f7f5;font:400 13px/1.6 Helvetica,Arial,sans-serif;color:#555">
    <strong style="color:#111">Delivering to</strong><br>
    ${esc(a.fullName)}${a.phone ? ` · +91 ${esc(a.phone)}` : ''}<br>${parts}${a.pincode ? ` – ${esc(a.pincode)}` : ''}
  </p>`;
}

// ---------- templates ----------

function passwordReset({ name, link }) {
  const subject = 'Reset your THE RESET password';
  const text = `Hi ${firstName(name)},\n\nUse this link to choose a new password. It works once and expires in 30 minutes:\n${link}\n\nIf you did not ask for this, ignore this email — your password will not change.`;
  const html = layout({
    preheader: 'This link expires in 30 minutes.',
    heading: 'Choose a new password',
    body: `Hi ${esc(firstName(name))},<br><br>Someone (hopefully you) asked to reset the password for this account.
      The button below works once and expires in <strong>30 minutes</strong>.<br><br>
      <span style="color:#888;font-size:13px">If you didn't ask for this, you can ignore this email — your password stays the same.</span>`,
    cta: { href: link, label: 'Reset password' },
  });
  return { subject, html, text };
}

function passwordChanged({ name }) {
  const subject = 'Your THE RESET password was changed';
  const text = `Hi ${firstName(name)},\n\nYour password was just changed and you have been signed out on other devices.\nIf this wasn't you, reset your password now: ${SHOP_URL()}/forgot-password`;
  const html = layout({
    preheader: 'You were signed out on other devices.',
    heading: 'Password changed',
    body: `Hi ${esc(firstName(name))},<br><br>Your password was just changed, and every other device has been signed out.<br><br>
      <strong>Wasn't you?</strong> Reset it straight away.`,
    cta: { href: `${SHOP_URL()}/forgot-password`, label: 'Secure my account' },
  });
  return { subject, html, text };
}

function welcome({ name }) {
  const subject = 'Welcome to THE RESET';
  const text = `Hi ${firstName(name)},\n\nYour account is ready. Start here: ${SHOP_URL()}`;
  const html = layout({
    preheader: 'Your account is ready.',
    heading: `Welcome, ${esc(firstName(name))}.`,
    body: `Your account is ready. Save pieces to your wishlist, check out faster with saved addresses,
      and follow every order from your profile.`,
    cta: { href: SHOP_URL(), label: 'Start shopping' },
  });
  return { subject, html, text };
}

function giftLine(order) {
  if (!order.gift || !order.gift.isGift) return '';
  return `<p style="margin:0 0 16px;padding:12px 14px;background:#f7f7f5;color:#444;font-size:13px">
    🎁 Sent as a gift${order.gift.to ? ` to ${esc(order.gift.to)}` : ''} — the parcel has your note and no prices.</p>`;
}

function orderPlaced({ name, order }) {
  const id = shortId(order._id);
  const subject = `Order #${id} confirmed`;
  const text = `Hi ${firstName(name)},\n\nThanks for your order #${id}.\n`
    + order.items.map(i => `- ${i.name} (size ${i.size}) x${i.qty} — ${i.price}`).join('\n')
    + `\nTotal: ${inr(order.total || order.subtotal)}`
    + (order.payment && order.payment.method === 'cod' && order.payment.status === 'Pending'
      ? `\nCash on delivery: keep ${inr(order.total || order.subtotal)} ready — pay the courier in cash or by UPI.` : '')
    + `\n\nTrack it: ${SHOP_URL()}/orders/${order._id}`;
  const html = layout({
    preheader: `We've got it. Total ${inr(order.total || order.subtotal)}.`,
    heading: `Thank you, ${esc(firstName(name))}.`,
    body: `Your order <strong>#${id}</strong> is in. We'll email you again when it ships — usually within 2 working days.
      ${giftLine(order)}${itemsTable(order.items)}${totalsTable(order)}${payLine(order)}${addressBlock(order.shippingAddress)}`,
    cta: { href: `${SHOP_URL()}/orders/${order._id}`, label: 'View order' },
  });
  return { subject, html, text };
}

const STATUS_COPY = {
  Confirmed: { subject: 'is confirmed',      heading: 'Being packed',  line: 'Your order is confirmed and we are packing it now.' },
  Shipped:   { subject: 'is on its way',     heading: 'On its way',    line: 'Good news — your order has left us. Expect it in 3–5 working days in metro cities, 5–8 elsewhere.' },
  Delivered: { subject: 'was delivered',     heading: 'Delivered',     line: 'Your order has been delivered. We hope you love it — a quick review on the product page helps us a lot.' },
  Cancelled: { subject: 'was cancelled',     heading: 'Order cancelled', line: 'Your order has been cancelled. If you paid online, any amount charged will be refunded to the original method within 5–7 working days.' },
};

function orderStatus({ name, order }) {
  const copy = STATUS_COPY[order.status];
  if (!copy) return null;
  const id = shortId(order._id);
  const subject = `Order #${id} ${copy.subject}`;
  const orderUrl = `${SHOP_URL()}/orders/${order._id}`;
  // Shipped with tracking: show the courier and make "Track package" the button.
  const ship = order.status === 'Shipped' && order.shipment && order.shipment.trackingNumber
    ? order.shipment : null;
  const shipText = ship
    ? `\n\n${ship.courier} tracking number: ${ship.trackingNumber}\nTrack it: ${ship.trackingUrl}` : '';
  const shipHtml = ship
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background:#f7f7f5;width:100%">
         <tr><td style="padding:14px 16px;font:400 13px/1.6 Helvetica,Arial,sans-serif;color:#666">
           Courier<br><strong style="font-size:15px;color:#111">${esc(ship.courier)}</strong>
         </td><td style="padding:14px 16px;font:400 13px/1.6 Helvetica,Arial,sans-serif;color:#666">
           Tracking number<br><strong style="font-size:15px;color:#111;letter-spacing:.04em">${esc(ship.trackingNumber)}</strong>
         </td></tr>
       </table>` : '';
  const text = `Hi ${firstName(name)},\n\n${copy.line}${shipText}\n\nOrder #${id}: ${orderUrl}`;
  const html = layout({
    preheader: copy.line,
    heading: copy.heading,
    body: `Hi ${esc(firstName(name))},<br><br>${copy.line}<br><br>${shipHtml}${itemsTable(order.items)}${order.status === 'Shipped' ? payLine(order) : ''}`,
    cta: ship
      ? { href: ship.trackingUrl, label: 'Track package' }
      : { href: orderUrl, label: 'View order' },
  });
  return { subject, html, text };
}

function backInStock({ product, size }) {
  const url = `${SHOP_URL()}/product/${product._id}`;
  const img = (product.images && product.images[0]) || product.image;
  const subject = `${product.name} is back in size ${size}`;
  const text = `Good news — ${product.name} is back in size ${size}. Stock is limited: ${url}`;
  const html = layout({
    preheader: `Size ${size} is back. Stock is limited.`,
    heading: 'It\'s back.',
    body: `${img ? `<img src="${esc(img)}" alt="" width="200" style="display:block;width:200px;max-width:100%;margin:0 0 18px">` : ''}
      <strong style="color:#111">${esc(product.name)}</strong> is back in size <strong style="color:#111">${esc(size)}</strong>.
      You asked us to tell you first — there's only a little, so it may not last.`,
    cta: { href: url, label: 'Shop it now' },
  });
  return { subject, html, text };
}

const RETURN_COPY = {
  Requested: { subject: 'request received', heading: 'Request received', line: "We've got your request and will reply within 1 working day." },
  Approved:  { subject: 'approved',         heading: 'Approved',         line: "Your request is approved. We'll arrange a pickup — keep the pieces unworn with tags on." },
  Rejected:  { subject: 'update',           heading: 'We can\'t accept this one', line: "We're not able to accept this request." },
  Received:  { subject: 'pieces received',  heading: 'Back with us',     line: "The pieces have reached us and passed our check." },
  Refunded:  { subject: 'refunded',         heading: 'Refund on its way', line: 'Your refund has been issued. It usually shows up in 5–7 working days.' },
  Exchanged: { subject: 'new size on its way', heading: 'New size on its way', line: "Your exchange has been sent. You'll get it in 3–8 working days." },
};

function returnUpdate({ name, request }) {
  const copy = RETURN_COPY[request.status];
  if (!copy) return null;
  const kind = request.type === 'exchange' ? 'Exchange' : 'Return';
  const id = shortId(request._id);
  const lines = request.items.map(i =>
    `${esc(i.name)} — size ${esc(i.size)}${i.exchangeSize ? ` → ${esc(i.exchangeSize)}` : ''} × ${Number(i.qty) || 1}`).join('<br>');
  const subject = `${kind} #${id} ${copy.subject}`;
  const text = `Hi ${firstName(name)},\n\n${copy.line}${request.shopMessage ? `\n\nNote from us: ${request.shopMessage}` : ''}`;
  const html = layout({
    preheader: copy.line,
    heading: copy.heading,
    body: `Hi ${esc(firstName(name))},<br><br>${copy.line}
      ${request.shopMessage ? `<p style="margin:16px 0 0;padding:12px 14px;background:#f7f7f5;color:#333"><strong>Note from us:</strong> ${esc(request.shopMessage)}</p>` : ''}
      <p style="margin:18px 0 0;color:#555;font-size:14px">${kind} #${id}<br>${lines}</p>`,
    cta: { href: `${SHOP_URL()}/orders/${request.order}`, label: 'View order' },
  });
  return { subject, html, text };
}

function welcomeCode({ code, percent, minOrder, maxOff, days, unsubscribe }) {
  const subject = `${percent}% off your first order`;
  const text = `Welcome to THE RESET. Your code: ${code} — ${percent}% off orders over ₹${minOrder} (up to ₹${maxOff}), valid ${days} days, one use.\nShop: ${SHOP_URL()}\nUnsubscribe: ${unsubscribe}`;
  const html = layout({
    preheader: `Your code: ${code}`,
    heading: "You're in.",
    body: `Here's ${percent}% off your first order. Use it at checkout:
      <p style="margin:18px 0;padding:18px;border:2px dashed #111;text-align:center;font:700 26px/1 Helvetica,Arial,sans-serif;letter-spacing:.12em;color:#111">${esc(code)}</p>
      <span style="color:#888;font-size:13px">On orders over ₹${minOrder.toLocaleString('en-IN')}, up to ₹${maxOff.toLocaleString('en-IN')} off. One use, valid for ${days} days.</span>
      <br><br><span style="color:#aaa;font-size:12px">Don't want these emails? <a href="${esc(unsubscribe)}" style="color:#888">Unsubscribe</a>.</span>`,
    cta: { href: SHOP_URL(), label: 'Start shopping' },
  });
  return { subject, html, text };
}

function bagReminder({ name, items, stopUrl }) {
  const first = items[0];
  const subject = items.length === 1 ? `Still thinking about the ${first.name}?` : 'Still in your bag';
  const bagUrl = `${SHOP_URL()}/?bag=open`;
  const rows = items.slice(0, 4).map((i) => `
    <tr>
      <td width="76" style="padding:12px 14px 12px 0;border-bottom:1px solid #f0f0f0;vertical-align:top">
        ${i.image ? `<a href="${SHOP_URL()}/product/${i.id}"><img src="${esc(i.image)}" alt="" width="64" style="display:block;width:64px;height:80px;object-fit:cover;background:#f2f2f1"></a>` : ''}
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;font:400 14px/1.45 Helvetica,Arial,sans-serif;color:#111;vertical-align:top">
        <a href="${SHOP_URL()}/product/${i.id}" style="color:#111;text-decoration:none">${esc(i.name)}</a><br>
        <span style="color:#888;font-size:12px">Size ${esc(i.size)}${i.qty > 1 ? ` · Qty ${i.qty}` : ''}</span>
        ${i.fewLeft ? `<br><span style="color:#8a4b06;font-size:12px">Only ${i.fewLeft} left in ${esc(i.size)}</span>` : ''}
      </td>
      <td align="right" style="padding:12px 0;border-bottom:1px solid #f0f0f0;font:600 14px Helvetica,Arial,sans-serif;color:#111;white-space:nowrap;vertical-align:top">
        ${inr(i.price)}${i.mrp > i.price ? `<br><span style="font-weight:400;color:#999;text-decoration:line-through;font-size:12px">${inr(i.mrp)}</span>` : ''}
      </td>
    </tr>`).join('');
  const extra = items.length > 4 ? `<p style="margin:10px 0 0;color:#888;font-size:13px">+ ${items.length - 4} more in your bag</p>` : '';
  const text = `Hi ${firstName(name)},\n\nYou left ${items.length === 1 ? 'something' : 'a few things'} in your bag:\n${items.map((i) => `- ${i.name} (size ${i.size}) ${inr(i.price)}`).join('\n')}\n\nYour bag: ${bagUrl}\n\nStop these reminders: ${stopUrl}`;
  const html = layout({
    preheader: 'Your picks are saved — but stock moves.',
    heading: 'Still in your bag.',
    body: `Hi ${esc(firstName(name))}, you left ${items.length === 1 ? 'this' : 'these'} behind. We've kept ${items.length === 1 ? 'it' : 'them'} saved for you.
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px">${rows}</table>${extra}
      <br><span style="color:#aaa;font-size:12px">One reminder per bag. <a href="${esc(stopUrl)}" style="color:#888">Stop these emails</a>.</span>`,
    cta: { href: bagUrl, label: 'Back to your bag' },
  });
  return { subject, html, text };
}

function priceDrop({ name, product, stopUrl }) {
  const url = `${SHOP_URL()}/product/${product._id}`;
  const img = (product.images && product.images[0]) || product.image;
  const title = product.colorName ? `${product.name} — ${product.colorName}` : product.name;
  const off = product.wasPrice > product.price ? Math.round((1 - product.price / product.wasPrice) * 100) : 0;
  const subject = `Price drop: ${title} is now ${inr(product.price)}`;
  const text = `Hi ${firstName(name)},\n\n${title} from your wishlist is now ${inr(product.price)}${off ? ` (was ${inr(product.wasPrice)}, ${off}% off)` : ''}.\n${url}\n\nStop these emails: ${stopUrl}`;
  const html = layout({
    preheader: `Now ${inr(product.price)}${off ? ` — ${off}% off` : ''}. From your wishlist.`,
    heading: 'It just got cheaper.',
    body: `Hi ${esc(firstName(name))}, something on your wishlist dropped in price.
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px"><tr>
        ${img ? `<td width="120" style="padding-right:16px;vertical-align:top"><a href="${url}"><img src="${esc(img)}" alt="" width="120" style="display:block;width:120px;height:150px;object-fit:cover;background:#f2f2f1"></a></td>` : ''}
        <td style="vertical-align:top;font:400 15px/1.5 Helvetica,Arial,sans-serif;color:#111">
          <a href="${url}" style="color:#111;text-decoration:none;font-weight:600">${esc(title)}</a><br>
          <span style="font-size:22px;font-weight:700">${inr(product.price)}</span>
          ${off ? `<span style="color:#999;text-decoration:line-through;margin-left:6px">${inr(product.wasPrice)}</span><br><span style="color:#8a4b06;font-size:13px;font-weight:600">${off}% off</span>` : ''}
        </td>
      </tr></table>
      <br><span style="color:#aaa;font-size:12px">You saved this to your wishlist. <a href="${esc(stopUrl)}" style="color:#888">Stop these emails</a>.</span>`,
    cta: { href: url, label: 'Shop it now' },
  });
  return { subject, html, text };
}

module.exports = { priceDrop, bagReminder, passwordReset, passwordChanged, welcome, orderPlaced, orderStatus, backInStock, returnUpdate, welcomeCode, esc };
