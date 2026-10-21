/**
 * Loads Razorpay's checkout window (once) and opens it for an order.
 * Resolves with Razorpay's payment details, or rejects with
 * { dismissed: true } when the shopper closes the window.
 */
let loading = null;

function loadScript() {
  if (window.Razorpay) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { loading = null; reject(new Error('The payment window could not load. Check your connection and try again.')); };
      document.body.appendChild(s);
    });
  }
  return loading;
}

export async function payWithRazorpay({ razorpay, prefill, description }) {
  await loadScript();
  return new Promise((resolve, reject) => {
    const rz = new window.Razorpay({
      key: razorpay.key,
      order_id: razorpay.orderId,
      amount: razorpay.amount,
      currency: razorpay.currency || 'INR',
      name: 'THE RESET',
      description,
      prefill,
      theme: { color: '#000000' },
      handler: (response) => resolve(response),
      modal: { ondismiss: () => reject({ dismissed: true }), confirm_close: true },
    });
    rz.on('payment.failed', () => { /* Razorpay shows the reason and lets them retry inside the window */ });
    rz.open();
  });
}
