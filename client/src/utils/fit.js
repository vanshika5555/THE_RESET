// How a piece fits, from buyers' reviews. Same verdict rule as the server's fitSummary.
export const FIT_OPTIONS = [
  { value: 'small', label: 'Runs small' },
  { value: 'true', label: 'True to size' },
  { value: 'large', label: 'Runs large' },
];
export const fitLabel = (v) => FIT_OPTIONS.find((o) => o.value === v)?.label || '';

export const VERDICT = {
  small: { title: 'Runs small', advice: 'Most buyers suggest one size up.' },
  true:  { title: 'True to size', advice: 'Most buyers say it fits as expected.' },
  large: { title: 'Runs large', advice: 'Most buyers suggest one size down.' },
  mixed: { title: 'Fit varies', advice: 'Buyers are split — check the size guide.' },
};

// Where the marker sits on the small … large scale, 0–100.
export function fitPosition(f) {
  if (!f || !f.votes) return 50;
  const score = (f.large - f.small) / f.votes;   // −1 small … +1 large
  return Math.round(50 + score * 42);
}
