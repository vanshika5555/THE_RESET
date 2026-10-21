import axios from 'axios';

/*
  The customer's usual sizes ({ Top: { size, note }, Bottom: … }), fetched
  once per visit and shared by every product page.
*/
let cache = { user: null, promise: null };

export default function mySizes(userId) {
  if (!userId) return Promise.resolve({});
  if (cache.user !== userId || !cache.promise) {
    cache = {
      user: userId,
      promise: axios.get('/api/auth/my-sizes').then((r) => r.data || {}).catch(() => ({})),
    };
  }
  return cache.promise;
}

// After an order is delivered or a return changes things, look again next time.
export function forgetMySizes() { cache = { user: null, promise: null }; }
