/*
  "Invite a friend" links look like /?ref=RIYA-7K2P. The code is kept on this
  device for 30 days so it still counts if they sign up later.
*/
const KEY = 'theresetRef';
const DAYS = 30;

export function captureInvite() {
  try {
    const code = new URLSearchParams(window.location.search).get('ref');
    if (!code) return;
    const clean = code.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20);
    if (clean) localStorage.setItem(KEY, JSON.stringify({ code: clean, at: Date.now() }));
  } catch { /* private mode */ }
}

export function inviteCode() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (!v?.code || Date.now() - v.at > DAYS * 864e5) return '';
    return v.code;
  } catch { return ''; }
}

export function forgetInvite() {
  try { localStorage.removeItem(KEY); } catch { /* fine */ }
}
