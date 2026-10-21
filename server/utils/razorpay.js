const crypto = require('crypto');

/**
 * Razorpay — online payments (UPI, cards, net banking, wallets).
 *
 * Switched on only when RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set on
 * the server. Use the "Test mode" keys from the Razorpay dashboard first —
 * no real money moves — then swap in the live keys.
 *
 * Talks to Razorpay's REST API directly, so there's no extra package.
 */

const API = () => (process.env.RAZORPAY_API_BASE || 'https://api.razorpay.com/v1').replace(/\/$/, '');
const keyId = () => process.env.RAZORPAY_KEY_ID || '';
const secret = () => process.env.RAZORPAY_KEY_SECRET || '';

const enabled = () => Boolean(keyId() && secret());

async function call(method, path, body) {
  const res = await fetch(`${API()}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId()}:${secret()}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.description || `Razorpay error ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Amounts go to Razorpay in paise.
const paise = (rupees) => Math.round((Number(rupees) || 0) * 100);

function createOrder({ amount, receipt, notes }) {
  return call('POST', '/orders', { amount: paise(amount), currency: 'INR', receipt: String(receipt).slice(0, 40), notes });
}

function fetchPayment(paymentId) {
  return call('GET', `/payments/${encodeURIComponent(paymentId)}`);
}

function orderPayments(orderId) {
  return call('GET', `/orders/${encodeURIComponent(orderId)}/payments`);
}

function refund(paymentId, amount) {
  return call('POST', `/payments/${encodeURIComponent(paymentId)}/refund`, amount ? { amount: paise(amount) } : {});
}

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// The checkout hands back a signature over "order_id|payment_id".
function validCheckoutSignature(orderId, paymentId, signature) {
  const expected = crypto.createHmac('sha256', secret()).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqual(expected, signature);
}

// Webhooks are signed over the raw request body with the webhook secret.
function validWebhookSignature(rawBody, signature) {
  const s = process.env.RAZORPAY_WEBHOOK_SECRET || '';
  if (!s) return false;
  const expected = crypto.createHmac('sha256', s).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}

module.exports = { enabled, keyId, createOrder, fetchPayment, orderPayments, refund, validCheckoutSignature, validWebhookSignature, paise };
