import axios from 'axios';

/**
 * Opens an order's invoice in a new tab, ready to print or save as PDF.
 *
 * The tab is opened straight away (inside the tap) so phone browsers don't
 * block it as a pop-up, then filled once the invoice arrives. The request
 * carries the sign-in token, which a plain link could not.
 */
export default async function openInvoice(orderId) {
  const tab = window.open('', '_blank');
  if (tab) {
    tab.document.write('<p style="font:15px Helvetica,Arial,sans-serif;padding:24px">Preparing your invoice…</p>');
  }
  try {
    const res = await axios.get(`/api/orders/${orderId}/invoice`, { responseType: 'text' });
    if (!tab) {
      // Pop-ups blocked: show it in this tab instead.
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/html' }));
      window.location.href = url;
      return;
    }
    tab.document.open();
    tab.document.write(res.data);
    tab.document.close();
  } catch (err) {
    // Asked for text, so an error's JSON arrives as a string.
    let msg = 'The invoice could not be opened. Try again.';
    try {
      const data = typeof err.response?.data === 'string' ? JSON.parse(err.response.data) : err.response?.data;
      if (data?.message) msg = data.message;
    } catch { /* keep the default */ }
    if (tab) tab.close();
    throw new Error(msg);
  }
}
