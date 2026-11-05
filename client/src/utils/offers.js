/*
  Automatic offers — the same maths as server/utils/offers.js (the server's
  copy decides what an order really gets; this one shows it while shopping).
*/
export const live = (o, now = new Date()) => o.active !== false
  && (!o.startsAt || new Date(o.startsAt) <= now)
  && (!o.endsAt || new Date(o.endsAt) >= now);

function eligible(offer, lines) {
  const list = (lines || []).filter((l) => !offer.category || l.category === offer.category);
  return {
    qty: list.reduce((n, l) => n + (Number(l.qty) || 0), 0),
    spend: list.reduce((n, l) => n + (Number(l.price) || 0) * (Number(l.qty) || 0), 0),
  };
}

// What this offer takes off this bag (0 if the bag doesn't qualify).
export function discountFor(offer, lines) {
  const { qty, spend } = eligible(offer, lines);
  const met = offer.condition.type === 'qty' ? qty >= offer.condition.value : spend >= offer.condition.value;
  if (!met || spend <= 0) return 0;
  let d = offer.reward.type === 'percent' ? Math.round((spend * offer.reward.value) / 100) : offer.reward.value;
  if (offer.reward.type === 'percent' && offer.maxDiscount > 0) d = Math.min(d, offer.maxDiscount);
  return Math.max(0, Math.min(d, spend));
}

// The offer that saves the most right now: { offer, discount } or null.
export function bestOffer(offers, lines, now = new Date()) {
  let best = null;
  for (const o of offers || []) {
    if (!live(o, now)) continue;
    const discount = discountFor(o, lines);
    if (discount > 0 && (!best || discount > best.discount)) best = { offer: o, discount };
  }
  return best;
}

// The nearest offer not reached yet, for "Add 1 more piece for 10% off".
export function nextOffer(offers, lines, now = new Date()) {
  const current = bestOffer(offers, lines, now)?.discount || 0;
  let pick = null;
  for (const o of offers || []) {
    if (!live(o, now) || discountFor(o, lines) > 0) continue;
    const { qty, spend } = eligible(o, lines);
    const gap = o.condition.type === 'qty' ? o.condition.value - qty : o.condition.value - spend;
    if (gap <= 0) continue;
    // Roughly what it would save once reached — only nudge towards something better.
    const pretend = o.reward.type === 'percent'
      ? Math.round(((o.condition.type === 'spend' ? Math.max(spend, o.condition.value) : spend * (o.condition.value / Math.max(qty, 1))) * o.reward.value) / 100)
      : o.reward.value;
    if (pretend <= current) continue;
    const score = o.condition.type === 'qty' ? gap * 1000 : gap;   // a piece away beats ₹s away
    if (!pick || score < pick.score) pick = { offer: o, gap, kind: o.condition.type, score };
  }
  return pick;
}


// "Add 1 more piece for Buy 2, get 10% off" / "Add ₹450 more for …"
export function nudgeText(next, inr) {
  if (!next) return '';
  const what = next.kind === 'qty' ? `${next.gap} more piece${next.gap === 1 ? '' : 's'}` : `${inr(next.gap)} more`;
  return `Add ${what}${next.offer.category ? ` from ${next.offer.category}` : ''} for “${next.offer.name}”`;
}
