// Supabase adapter — talks to Supabase directly (PostgREST + Auth).
// Used when config BACKEND is 'supabase' (Cloudflare Pages deployment).
//
// Phone + password login is mapped onto Supabase Auth by deriving an
// email address from the phone number, e.g. 0241234567 becomes
// 233241234567@phone.ghanaservices.app. The profile (name, role, region,
// city, WhatsApp) lives in the public "users" table, keyed by the Auth
// user id. IMPORTANT: in the Supabase dashboard, turn OFF "Confirm email"
// (Authentication -> Providers -> Email), or sign-ups with these
// phone-derived emails can never confirm.
(function () {
  const SUPABASE_JS_CDN =
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';

  let client = null;
  let clientPromise = null;

  function loadSupabaseJs() {
    if (window.supabase) return Promise.resolve();
    if (clientPromise) return clientPromise;
    clientPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SUPABASE_JS_CDN;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Could not load the Supabase library. Check your connection.'));
      document.head.appendChild(s);
    });
    return clientPromise;
  }

  async function getClient() {
    if (client) return client;
    await loadSupabaseJs();
    const cfg = window.APP_CONFIG;
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are not set in frontend/config.js');
    }
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    return client;
  }

  // 0241234567 -> 233241234567@phone.ghanaservices.app
  function phoneToEmail(phone) {
    let digits = String(phone || '').replace(/\D/g, '');
    if (digits.startsWith('0')) digits = '233' + digits.slice(1);
    return digits + '@phone.ghanaservices.app';
  }

  function publicUser(row) {
    if (!row) return null;
    return {
      id: row.id, name: row.name, phone: row.phone, role: row.role,
      region: row.region, city: row.city,
      whatsapp: row.whatsapp || row.phone, created_at: row.created_at
    };
  }

  async function fetchProfile(sb, userId) {
    const { data, error } = await sb.from('users').select('*').eq('id', userId).single();
    if (error) throw new Error('Could not load your profile. Did registration finish?');
    return publicUser(data);
  }

  function mapListing(row) {
    const r = row.users || row.repairer || {};
    const ratings = (row.reviews || []).map((x) => x.rating);
    return {
      id: row.id,
      repairer_id: row.repairer_id,
      service_type: row.service_type,
      title: row.title,
      description: row.description,
      price: Number(row.price),
      region: row.region,
      city: row.city,
      created_at: row.created_at,
      updated_at: row.updated_at,
      repairer_name: r.name || '',
      repairer_phone: r.phone || '',
      repairer_whatsapp: r.whatsapp || r.phone || '',
      avg_rating: ratings.length
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
      review_count: ratings.length
    };
  }

  function mapRequest(row) {
    return {
      id: row.id,
      listing_id: row.listing_id,
      listing_title: (row.listings && row.listings.title) || '',
      service_type: (row.listings && row.listings.service_type) || '',
      customer_id: row.customer_id,
      customer_name: (row.customer && row.customer.name) || '',
      customer_phone: (row.customer && row.customer.phone) || '',
      repairer_id: row.repairer_id,
      repairer_name: (row.repairer && row.repairer.name) || '',
      repairer_phone: (row.repairer && row.repairer.phone) || '',
      status: row.status,
      message: row.message,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  const REQUEST_SELECT =
    '*, listings!service_requests_listing_id_fkey(title, service_type),' +
    ' customer:users!service_requests_customer_id_fkey(name, phone),' +
    ' repairer:users!service_requests_repairer_id_fkey(name, phone)';

  window.SupabaseAdapter = {
    name: 'supabase',

    async signUp(input) {
      const sb = await getClient();
      const email = phoneToEmail(input.phone);
      const { data, error } = await sb.auth.signUp({ email, password: input.password });
      if (error) throw new Error(error.message);
      if (!data.user) throw new Error('Registration failed. Please try again.');

      // If email confirmation is ON in Supabase, there is no session yet
      // and the profile insert below will fail. Turn it off in the
      // dashboard (see the header comment of this file).
      let sessionUser = data.user;
      if (!data.session) {
        const { data: signIn, error: signInErr } =
          await sb.auth.signInWithPassword({ email, password: input.password });
        if (signInErr || !signIn.session) {
          throw new Error(
            'Account created, but Supabase needs "Confirm email" turned OFF ' +
            '(Authentication -> Providers -> Email). Turn it off, then log in.'
          );
        }
        sessionUser = signIn.user;
      }

      const { error: profileErr } = await sb.from('users').insert({
        id: sessionUser.id,
        phone: String(input.phone).trim(),
        name: String(input.name).trim(),
        role: input.role,
        region: input.region,
        city: input.city,
        whatsapp: (input.whatsapp || input.phone).trim()
      });
      if (profileErr) throw new Error(profileErr.message);
      return fetchProfile(sb, sessionUser.id);
    },

    async signIn({ phone, password }) {
      const sb = await getClient();
      const { data, error } = await sb.auth.signInWithPassword({
        email: phoneToEmail(phone), password
      });
      if (error) throw new Error('Wrong phone number or password.');
      return fetchProfile(sb, data.user.id);
    },

    async signOut() {
      const sb = await getClient();
      await sb.auth.signOut();
    },

    async getSession() {
      const sb = await getClient();
      const { data } = await sb.auth.getSession();
      if (!data.session) return null;
      return fetchProfile(sb, data.session.user.id);
    },

    async listListings(filters) {
      const sb = await getClient();
      let q = sb.from('listings')
        .select('*, users!listings_repairer_id_fkey(name, phone, whatsapp), reviews(rating)')
        .order('created_at', { ascending: false });
      if (filters.serviceType) q = q.eq('service_type', filters.serviceType);
      if (filters.region) q = q.eq('region', filters.region);
      if (filters.city) q = q.ilike('city', '%' + filters.city + '%');
      if (filters.search) {
        const s = String(filters.search).replace(/[%*,]/g, '');
        q = q.or('title.ilike.%' + s + '%,description.ilike.%' + s + '%');
      }
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data || []).map(mapListing);
    },

    async getListing(id) {
      const sb = await getClient();
      const { data, error } = await sb.from('listings')
        .select('*, users!listings_repairer_id_fkey(name, phone, whatsapp), reviews(rating)')
        .eq('id', id).single();
      if (error) throw new Error('Service not found.');
      const listing = mapListing(data);
      listing.reviews = await this.listReviews(id);
      return listing;
    },

    async myListings() {
      const sb = await getClient();
      const { data: session } = await sb.auth.getSession();
      if (!session.session) throw new Error('Please log in first.');
      const { data, error } = await sb.from('listings')
        .select('*, users!listings_repairer_id_fkey(name, phone, whatsapp), reviews(rating)')
        .eq('repairer_id', session.session.user.id)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []).map(mapListing);
    },

    async createListing(input) {
      const sb = await getClient();
      const { data: session } = await sb.auth.getSession();
      if (!session.session) throw new Error('Please log in first.');
      const { data, error } = await sb.from('listings').insert({
        repairer_id: session.session.user.id,
        service_type: input.service_type,
        title: String(input.title).trim(),
        description: (input.description || '').trim(),
        price: Number(input.price),
        region: input.region,
        city: input.city
      }).select().single();
      if (error) throw new Error(error.message);
      return data;
    },

    async updateListing(id, input) {
      const sb = await getClient();
      const patch = {};
      if (input.service_type) patch.service_type = input.service_type;
      if (input.title) patch.title = input.title;
      if (input.description !== undefined) patch.description = input.description;
      if (input.price !== undefined) patch.price = Number(input.price);
      if (input.region) patch.region = input.region;
      if (input.city) patch.city = input.city;
      patch.updated_at = new Date().toISOString();
      const { data, error } = await sb.from('listings')
        .update(patch).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      return data;
    },

    async deleteListing(id) {
      const sb = await getClient();
      const { error } = await sb.from('listings').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },

    async createRequest(listingId, message) {
      const sb = await getClient();
      const { data: session } = await sb.auth.getSession();
      if (!session.session) throw new Error('Please log in first.');
      const { data: listing, error: listingErr } = await sb.from('listings')
        .select('repairer_id').eq('id', listingId).single();
      if (listingErr) throw new Error('Service not found.');
      const { data, error } = await sb.from('service_requests').insert({
        listing_id: listingId,
        customer_id: session.session.user.id,
        repairer_id: listing.repairer_id,
        message: (message || '').trim()
      }).select().single();
      if (error) throw new Error(error.message);
      return data;
    },

    async myRequests() {
      const sb = await getClient();
      const { data: session } = await sb.auth.getSession();
      if (!session.session) throw new Error('Please log in first.');
      const uid = session.session.user.id;
      const [asCustomer, asRepairer] = await Promise.all([
        sb.from('service_requests').select(REQUEST_SELECT)
          .eq('customer_id', uid).order('created_at', { ascending: false }),
        sb.from('service_requests').select(REQUEST_SELECT)
          .eq('repairer_id', uid).order('created_at', { ascending: false })
      ]);
      if (asCustomer.error) throw new Error(asCustomer.error.message);
      if (asRepairer.error) throw new Error(asRepairer.error.message);
      // Mark jobs the customer already reviewed, so the review button
      // only shows once.
      const { data: myReviews } = await sb.from('reviews')
        .select('request_id').eq('customer_id', uid);
      const reviewedIds = new Set((myReviews || []).map((r) => r.request_id));
      const mark = (rows) => rows.map((row) => {
        const r = mapRequest(row);
        r.reviewed = reviewedIds.has(r.id);
        return r;
      });
      return {
        asCustomer: mark(asCustomer.data || []),
        asRepairer: mark(asRepairer.data || [])
      };
    },

    async updateRequestStatus(id, status) {
      const sb = await getClient();
      const { data, error } = await sb.from('service_requests')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id).select().single();
      if (error) throw new Error(error.message);
      return data;
    },

    async createReview(requestId, rating, comment) {
      const sb = await getClient();
      const { data: session } = await sb.auth.getSession();
      if (!session.session) throw new Error('Please log in first.');
      const { data: job, error: jobErr } = await sb.from('service_requests')
        .select('*').eq('id', requestId).single();
      if (jobErr) throw new Error('Job not found.');
      if (job.status !== 'completed') {
        throw new Error('You can only review a job after it is completed.');
      }
      const { data, error } = await sb.from('reviews').insert({
        request_id: requestId,
        listing_id: job.listing_id,
        repairer_id: job.repairer_id,
        customer_id: session.session.user.id,
        rating: Number(rating),
        comment: (comment || '').trim()
      }).select().single();
      if (error) throw new Error(error.message);
      return data;
    },

    async listReviews(listingId) {
      const sb = await getClient();
      const { data, error } = await sb.from('reviews')
        .select('*, users!reviews_customer_id_fkey(name)')
        .eq('listing_id', listingId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []).map((r) => ({
        id: r.id, rating: r.rating, comment: r.comment,
        customer_name: (r.users && r.users.name) || 'Customer',
        created_at: r.created_at
      }));
    }
  };
})();
