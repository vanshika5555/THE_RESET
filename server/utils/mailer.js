const nodemailer = require('nodemailer');

/**
 * Sends the shop's emails.
 *
 * Works with any SMTP provider. Set these on Render (Environment tab):
 *
 *   SMTP_HOST   e.g. smtp-relay.brevo.com   (or smtp.gmail.com)
 *   SMTP_PORT   587
 *   SMTP_USER   the SMTP login
 *   SMTP_PASS   the SMTP password / key   (Gmail: an "App password")
 *   MAIL_FROM   "THE RESET <hello@yourdomain.com>"
 *   SHOP_URL    https://the-reset-snowy.vercel.app
 *
 * Until SMTP is set, emails are printed to the server log instead of sent,
 * so everything still works on a laptop.
 *
 * Sending never throws: an email failing must never fail an order.
 */

let transport = null;

function getTransport() {
  if (transport) return transport;
  if (!process.env.SMTP_HOST) return null;

  const port = Number(process.env.SMTP_PORT) || 587;
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transport;
}

const SHOP_URL = () => (process.env.SHOP_URL || 'http://localhost:3001').replace(/\/$/, '');

async function sendMail({ to, subject, html, text }) {
  if (!to) return false;
  const t = getTransport();

  if (!t) {
    console.log(`\n[email not sent — SMTP not configured]\nTo: ${to}\nSubject: ${subject}\n${text || ''}\n`);
    return false;
  }

  try {
    await t.sendMail({
      from: process.env.MAIL_FROM || 'THE RESET <no-reply@thereset.shop>',
      to,
      subject,
      html,
      text,
    });
    return true;
  } catch (err) {
    console.error('Email failed:', subject, '→', to, '-', err.message);
    return false;
  }
}

// Fire and forget, for places where the response must not wait on SMTP.
function sendMailLater(message) {
  setImmediate(() => { sendMail(message).catch(() => {}); });
}

module.exports = { sendMail, sendMailLater, SHOP_URL };
