/**
 * Delivery date estimate from a pincode — no courier API, just the shop's
 * own promise: packed within 2 working days, then 3–5 days to metro cities,
 * 5–8 elsewhere, longer for far-off regions. Sundays don't count.
 * Keep in step with the "on its way" email in server/utils/emails.js.
 */

const METRO = ['11', '12', '20', '38', '40', '41', '50', '56', '60', '70'];   // Delhi NCR, Ahmedabad, Mumbai, Pune, Hyderabad, Bengaluru, Chennai, Kolkata
const REMOTE = ['18', '19', '78', '79', '744', '68255'];   // J&K, Ladakh, North-East, Andaman, Lakshadweep

export const validPin = (pin) => /^[1-9][0-9]{5}$/.test(String(pin || '').trim());

export function zoneFor(pin) {
  const p = String(pin).trim();
  if (REMOTE.some((r) => p.startsWith(r))) return { name: 'remote', min: 7, max: 10 };
  if (METRO.some((m) => p.startsWith(m))) return { name: 'metro', min: 3, max: 5 };
  return { name: 'standard', min: 5, max: 8 };
}

function addWorkdays(from, days) {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) left -= 1;   // skip Sundays
  }
  return d;
}

const fmt = (d) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

export function estimate(pin, now = new Date()) {
  if (!validPin(pin)) return null;
  const z = zoneFor(pin);
  const early = addWorkdays(now, 1 + z.min);
  const late = addWorkdays(now, 2 + z.max);
  return { zone: z.name, from: early, to: late, label: `${fmt(early)} – ${fmt(late)}` };
}
