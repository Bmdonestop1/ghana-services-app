// REST adapter — talks to the Node API (../api) over HTTP.
// Used when config BACKEND is 'rest' (local dev or Render deployment).
// Session is a JWT stored in localStorage.
(function () {
  const TOKEN_KEY = 'gsa_token';
  const USER_KEY = 'gsa_user';

  function apiUrl() {
    const url = (window.APP_CONFIG.API_URL || '').replace(/\/$/, '');
    if (!url) throw new Error('API_URL is not set in frontend/config.js');
    return url;
  }

  function headers() {
    const h = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) h.Authorization = 'Bearer ' + token;
    return h;
  }

  async function call(path, options) {
    const res = await fetch(apiUrl() + path, {
      headers: headers(),
      ...(options || {})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ('Request failed (' + res.status + ')'));
    return data;
  }

  function saveSession(user, token) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    if (token) localStorage.setItem(TOKEN_KEY, token);
  }

  window.RestAdapter = {
    name: 'rest',

    async signUp(input) {
      const data = await call('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(input)
      });
      saveSession(data.user, data.token);
      return data.user;
    },

    async signIn({ phone, password }) {
      const data = await call('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phone, password })
      });
      saveSession(data.user, data.token);
      return data.user;
    },

    signOut() {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },

    getSession() {
      try {
        const raw = localStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },

    async listListings(filters) {
      const q = new URLSearchParams();
      if (filters.serviceType) q.set('serviceType', filters.serviceType);
      if (filters.region) q.set('region', filters.region);
      if (filters.city) q.set('city', filters.city);
      if (filters.search) q.set('search', filters.search);
      const data = await call('/api/listings?' + q.toString());
      return data.listings;
    },

    async getListing(id) {
      const data = await call('/api/listings/' + encodeURIComponent(id));
      return data.listing;
    },

    async myListings() {
      const data = await call('/api/listings/mine');
      return data.listings;
    },

    async createListing(input) {
      const data = await call('/api/listings', {
        method: 'POST',
        body: JSON.stringify(input)
      });
      return data.listing;
    },

    async updateListing(id, input) {
      const data = await call('/api/listings/' + encodeURIComponent(id), {
        method: 'PUT',
        body: JSON.stringify(input)
      });
      return data.listing;
    },

    async deleteListing(id) {
      await call('/api/listings/' + encodeURIComponent(id), { method: 'DELETE' });
    },

    async createRequest(listingId, message) {
      const data = await call('/api/requests', {
        method: 'POST',
        body: JSON.stringify({ listing_id: listingId, message })
      });
      return data.request;
    },

    async myRequests() {
      const data = await call('/api/requests');
      return { asCustomer: data.asCustomer, asRepairer: data.asRepairer };
    },

    async updateRequestStatus(id, status) {
      const data = await call('/api/requests/' + encodeURIComponent(id), {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      return data.request;
    },

    async createReview(requestId, rating, comment) {
      const data = await call('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({ request_id: requestId, rating, comment })
      });
      return data.review;
    },

    async listReviews(listingId) {
      const data = await call('/api/reviews?listingId=' + encodeURIComponent(listingId));
      return data.reviews;
    }
  };
})();
