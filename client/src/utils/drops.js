// Drops: a piece on show with a countdown that can't be bought until its moment.
// The same rule as the server's utils/drops.js.

export const DROP = 'DROP';

export const isUpcoming = (p, now = Date.now()) => !!(p && p.dropAt && new Date(p.dropAt).getTime() > now);

// "Fri, 13 Nov, 7 pm" in India time.
export function dropWhen(at) {
  const d = new Date(at);
  const day = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
    .replace(':00', '').replace(/\s?([ap])\.?m\.?/i, (m, x) => ` ${x.toLowerCase()}m`);
  return `${day}, ${time}`;
}

// Short form for a card badge: "Drops 13 Nov".
export function dropBadge(at) {
  const d = new Date(at);
  const ms = d.getTime() - Date.now();
  if (ms < 24 * 60 * 60 * 1000) return 'Drops today';
  return `Drops ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}`;
}

export function timeLeft(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(t / 86400), h: Math.floor((t % 86400) / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
}
