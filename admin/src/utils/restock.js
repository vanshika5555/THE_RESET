/*
  Restock maths. For one size: how fast it sells, when it runs out, and how
  many to order so it lasts `cover` days.
*/

export function plan(row, cover = 30) {
  const perDay = row.sold / Math.max(1, row.activeDays || 1);
  const daysLeft = perDay > 0 ? row.left / perDay : null;
  let order = perDay > 0 ? Math.max(0, Math.ceil(perDay * cover - row.left)) : 0;
  // Sold out with nothing sold lately, but people are asking: order at least that many.
  if (row.left === 0 && row.waiting > order) order = row.waiting;

  let status = 'ok';
  if (row.left === 0 && (row.sold > 0 || row.waiting > 0)) status = 'out';
  else if (daysLeft !== null && daysLeft <= 14) status = 'soon';
  else if (row.sold === 0 && row.left > 0) status = 'slow';
  else if (row.left === 0) status = 'empty';   // nothing left, nobody asking

  return { ...row, perDay, daysLeft, order, status };
}

export const daysText = (p) => {
  if (p.status === 'out') return 'Sold out';
  if (p.daysLeft === null) return p.left ? '—' : 'None left';
  if (p.daysLeft < 1) return 'Today';
  const d = Math.round(p.daysLeft);
  return d > 365 ? '1 year +' : `${d} day${d === 1 ? '' : 's'}`;
};
