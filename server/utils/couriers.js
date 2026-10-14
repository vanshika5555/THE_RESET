/**
 * Couriers the admin can pick when shipping an order, and how to build a
 * "Track package" link from a tracking (AWB) number.
 *
 * If a courier changes its tracking page, the admin can paste the link by
 * hand; anything not listed falls back to AfterShip, which detects the
 * courier from the number itself.
 */

const COURIERS = {
  'Delhivery':    (n) => `https://www.delhivery.com/track-v2/package/${n}`,
  'Blue Dart':    (n) => `https://www.bluedart.com/web/guest/trackdartresultthirdparty?trackFor=0&trackNo=${n}`,
  'DTDC':         (n) => `https://www.aftership.com/track/dtdc/${n}`,
  'Xpressbees':   (n) => `https://www.aftership.com/track/xpressbees/${n}`,
  'Ecom Express': (n) => `https://www.aftership.com/track/ecom-express/${n}`,
  'Shadowfax':    (n) => `https://www.aftership.com/track/shadowfax/${n}`,
  'Shiprocket':   (n) => `https://shiprocket.co/tracking/${n}`,
  'India Post':   (n) => `https://www.aftership.com/track/india-post/${n}`,
};

const COURIER_NAMES = Object.keys(COURIERS);

const clean = (s, max) => String(s ?? '').trim().slice(0, max);

/**
 * Turns what the admin typed into a safe shipment record, or returns
 * { error } explaining what's wrong.
 */
function buildShipment(input = {}) {
  const courier = clean(input.courier, 40);
  const trackingNumber = clean(input.trackingNumber, 40).replace(/\s+/g, '');
  let trackingUrl = clean(input.trackingUrl, 500);

  if (!courier && !trackingNumber && !trackingUrl) return { shipment: null };
  if (!courier) return { error: 'Pick the courier.' };
  if (!trackingNumber) return { error: 'Enter the tracking number.' };
  if (!/^[A-Za-z0-9-]{4,40}$/.test(trackingNumber)) {
    return { error: 'The tracking number should be letters and numbers only.' };
  }

  if (trackingUrl) {
    try {
      const u = new URL(trackingUrl);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('bad');
    } catch {
      return { error: 'The tracking link must start with https://' };
    }
  } else {
    const make = COURIERS[courier];
    const n = encodeURIComponent(trackingNumber);
    trackingUrl = make ? make(n) : `https://www.aftership.com/track/${n}`;
  }

  return { shipment: { courier, trackingNumber, trackingUrl } };
}

module.exports = { COURIER_NAMES, buildShipment };
