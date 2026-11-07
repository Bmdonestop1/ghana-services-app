// Ghana Services App — frontend UI.
// Works with either data adapter (see adapters/): the adapter is chosen
// by BACKEND in config.js. This file never talks to a backend directly.
(function () {
  'use strict';

  var SERVICE_TYPES = [
    'Phone Repair', 'Laptop / Computer Repair', 'TV Repair',
    'Fridge / AC Repair', 'Plumbing', 'Electrical', 'Mechanic',
    'Beauty', 'Tailoring', 'Other'
  ];
  var REGIONS = [
    'Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern',
    'Greater Accra', 'North East', 'Northern', 'Oti', 'Savannah',
    'Upper East', 'Upper West', 'Volta', 'Western', 'Western North'
  ];

  var DB = null;
  var currentUser = null;
  var filters = { serviceType: '', region: '', city: '', search: '' };
  var currentListingId = null;
  var editingListingId = null;
  var reviewOpenFor = null;

  var viewEl = document.getElementById('view');
  var navEl = document.getElementById('bottomnav');
  var toastEl = document.getElementById('toast');

  // ---------------------------------------------------------------- helpers
  function $(sel, root) { return (root || document).querySelector(sel); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function money(n) {
    var v = Number(n);
    return 'GH₵ ' + (Number.isInteger(v) ? String(v) : v.toFixed(2));
  }
  function waNumber(phone) {
    var d = String(phone || '').replace(/\D/g, '');
    if (d.charAt(0) === '0') d = '233' + d.slice(1);
    return d;
  }
  function stars(n) {
    var out = '';
    for (var i = 1; i <= 5; i++) out += i <= Math.round(n) ? '★' : '☆';
    return out;
  }
  function showToast(msg, isError) {
    toastEl.textContent = msg;
    toastEl.className = 'toast show' + (isError ? ' error' : '');
    setTimeout(function () { toastEl.className = 'toast'; }, 3500);
  }
  function options(list, selected, placeholder) {
    var html = placeholder ? '<option value="">' + esc(placeholder) + '</option>' : '';
    list.forEach(function (item) {
      html += '<option value="' + esc(item) + '"' +
        (item === selected ? ' selected' : '') + '>' + esc(item) + '</option>';
    });
    return html;
  }
  function contactButtons(listing) {
    var phone = listing.repairer_phone || '';
    var wa = listing.repairer_whatsapp || phone;
    return '<div class="contact-row">' +
      '<a class="btn btn-call" href="tel:' + esc(phone) + '">📞 Call</a>' +
      '<a class="btn btn-wa" target="_blank" rel="noopener" href="https://wa.me/' +
        esc(waNumber(wa)) + '">💬 WhatsApp</a></div>';
  }

  // ---------------------------------------------------------------- adapter
  function pickAdapter() {
    var backend = (window.APP_CONFIG && window.APP_CONFIG.BACKEND) || 'rest';
    if (backend === 'supabase') {
      if (!window.SupabaseAdapter) throw new Error('Supabase adapter failed to load.');
      return window.SupabaseAdapter;
    }
    if (!window.RestAdapter) throw new Error('REST adapter failed to load.');
    return window.RestAdapter;
  }

  // ---------------------------------------------------------------- navigation
  function renderNav() {
    var items = [
      { action: 'nav-home', label: '🏠 Home' },
      { action: 'nav-jobs', label: '🧾 My Jobs' }
    ];
    if (currentUser && currentUser.role === 'repairer') {
      items.push({ action: 'nav-services', label: '🔧 My Services' });
    }
    items.push({
      action: 'nav-account',
      label: currentUser ? '👤 ' + esc(currentUser.name.split(' ')[0]) : '👤 Account'
    });
    navEl.innerHTML = items.map(function (it) {
      return '<button class="nav-btn" data-action="' + it.action + '">' + it.label + '</button>';
    }).join('');
  }

  // ---------------------------------------------------------------- home
  function listingCard(l) {
    return '<article class="card listing" data-action="open-listing" data-id="' + esc(l.id) + '">' +
      '<div class="card-top"><span class="tag">' + esc(l.service_type) + '</span>' +
      '<span class="price">' + money(l.price) + '</span></div>' +
      '<h3>' + esc(l.title) + '</h3>' +
      '<p class="muted">' + esc(l.repairer_name) + ' · ' + esc(l.city) + ', ' + esc(l.region) + '</p>' +
      '<p class="rating">' + stars(l.avg_rating || 0) +
      ' <span class="muted">(' + (l.review_count || 0) + ')</span></p>' +
      '<div class="card-actions" data-stop>' + contactButtons(l) +
      '<button class="btn btn-primary" data-action="open-listing" data-id="' + esc(l.id) + '">View &amp; Request</button></div>' +
      '</article>';
  }

  async function renderHome() {
    viewEl.innerHTML =
      '<section class="hero"><h1>Find trusted repairers in Ghana</h1>' +
      '<p>Phone, laptop, TV, fridge, plumbing, electrical and more — near you.</p></section>' +
      '<form id="search-form" class="filters">' +
      '<input type="search" name="search" placeholder="Search a service or repairer…" value="' + esc(filters.search) + '">' +
      '<div class="chips">' +
      '<button type="button" class="chip' + (!filters.serviceType ? ' active' : '') + '" data-action="chip" data-service="">All</button>' +
      SERVICE_TYPES.map(function (t) {
        return '<button type="button" class="chip' + (filters.serviceType === t ? ' active' : '') +
          '" data-action="chip" data-service="' + esc(t) + '">' + esc(t) + '</button>';
      }).join('') + '</div>' +
      '<div class="filter-row">' +
      '<select name="region">' + options(REGIONS, filters.region, 'All regions') + '</select>' +
      '<input type="text" name="city" placeholder="City (e.g. Accra)" value="' + esc(filters.city) + '">' +
      '<button class="btn btn-primary" type="submit">Search</button>' +
      '</div></form>' +
      '<div id="results"><p class="muted">Loading services…</p></div>';

    try {
      var listings = await DB.listListings(filters);
      var box = $('#results');
      if (!listings.length) {
        box.innerHTML = '<p class="empty">No services match your search yet. ' +
          'Try a different service or region — or be the first repairer to list one.</p>';
      } else {
        box.innerHTML = '<p class="muted">' + listings.length + ' service(s) found</p>' +
          listings.map(listingCard).join('');
      }
    } catch (err) {
      $('#results').innerHTML = '<p class="error-box">' + esc(err.message) + '</p>';
    }
  }

  // ---------------------------------------------------------------- listing detail
  async function renderListing(id) {
    currentListingId = id;
    viewEl.innerHTML = '<p class="muted">Loading…</p>';
    try {
      var l = await DB.getListing(id);
      var reviews = l.reviews || [];
      var canRequest = currentUser && currentUser.role === 'customer';
      var html =
        '<button class="link-btn" data-action="nav-home">← Back to services</button>' +
        '<article class="card detail">' +
        '<span class="tag">' + esc(l.service_type) + '</span>' +
        '<h2>' + esc(l.title) + '</h2>' +
        '<p class="price big">' + money(l.price) + '</p>' +
        '<p>' + esc(l.description || 'No description given.') + '</p>' +
        '<p class="muted">📍 ' + esc(l.city) + ', ' + esc(l.region) + '</p>' +
        '<p><strong>' + esc(l.repairer_name) + '</strong> · ' +
        '<span class="rating">' + stars(l.avg_rating || 0) + ' (' + (l.review_count || 0) + ' reviews)</span></p>' +
        contactButtons(l) +
        '</article>';

      if (canRequest) {
        html += '<form id="request-form" class="card"><h3>Request this service</h3>' +
          '<textarea name="message" rows="3" placeholder="Describe the problem (e.g. My phone screen is cracked…)"></textarea>' +
          '<button class="btn btn-primary" type="submit">Send request</button></form>';
      } else if (!currentUser) {
        html += '<div class="card"><p><a href="#" data-action="nav-account">Log in</a> as a customer to request this service.</p></div>';
      } else {
        html += '<div class="card"><p class="muted">You are logged in as a repairer. Customers request your services from here.</p></div>';
      }

      html += '<section class="card"><h3>Reviews</h3>';
      if (!reviews.length) {
        html += '<p class="muted">No reviews yet.</p>';
      } else {
        html += reviews.map(function (r) {
          return '<div class="review"><p class="rating">' + stars(r.rating) + '</p>' +
            '<p>' + esc(r.comment || '') + '</p>' +
            '<p class="muted">— ' + esc(r.customer_name) + '</p></div>';
        }).join('');
      }
      html += '</section>';
      viewEl.innerHTML = html;
    } catch (err) {
      viewEl.innerHTML = '<p class="error-box">' + esc(err.message) + '</p>' +
        '<button class="btn" data-action="nav-home">Back to services</button>';
    }
  }

  // ---------------------------------------------------------------- auth
  function renderAuth(mode) {
    mode = mode || 'login';
    var isLogin = mode === 'login';
    viewEl.innerHTML =
      '<div class="card auth"><h2>' + (isLogin ? 'Log in' : 'Create account') + '</h2>' +
      '<div class="tabs">' +
      '<button class="tab' + (isLogin ? ' active' : '') + '" data-action="auth-tab" data-mode="login">Log in</button>' +
      '<button class="tab' + (!isLogin ? ' active' : '') + '" data-action="auth-tab" data-mode="register">Register</button>' +
      '</div>' +
      (isLogin
        ? '<form id="login-form">' +
          '<label>Phone number<input type="tel" name="phone" placeholder="024 123 4567" required></label>' +
          '<label>Password<input type="password" name="password" required></label>' +
          '<button class="btn btn-primary" type="submit">Log in</button></form>'
        : '<form id="register-form">' +
          '<label>Full name<input type="text" name="name" required></label>' +
          '<label>Phone number<input type="tel" name="phone" placeholder="024 123 4567" required></label>' +
          '<label>WhatsApp number (optional)<input type="tel" name="whatsapp" placeholder="Same as phone if blank"></label>' +
          '<label>Password (min 6 characters)<input type="password" name="password" minlength="6" required></label>' +
          '<label>I am a<select name="role"><option value="customer">Customer — I need repairs</option>' +
          '<option value="repairer">Repairer — I offer repairs</option></select></label>' +
          '<label>Region<select name="region" required>' + options(REGIONS, '', 'Choose your region') + '</select></label>' +
          '<label>City / Town<input type="text" name="city" placeholder="e.g. Accra" required></label>' +
          '<button class="btn btn-primary" type="submit">Create account</button></form>') +
      '</div>';
  }

  // ---------------------------------------------------------------- my listings (repairer)
  function listingForm(l) {
    l = l || {};
    return '<form id="listing-form" class="card"><h3>' + (l.id ? 'Edit service' : 'Post a new service') + '</h3>' +
      '<label>Service type<select name="service_type" required>' +
      options(SERVICE_TYPES, l.service_type || '', 'Choose a service') + '</select></label>' +
      '<label>Title<input type="text" name="title" required value="' + esc(l.title || '') + '" placeholder="e.g. Phone screen replacement"></label>' +
      '<label>Description<textarea name="description" rows="3">' + esc(l.description || '') + '</textarea></label>' +
      '<label>Price (GH₵)<input type="number" name="price" min="0" step="0.01" required value="' + (l.price != null ? esc(l.price) : '') + '"></label>' +
      '<label>Region<select name="region" required>' + options(REGIONS, l.region || '', 'Choose a region') + '</select></label>' +
      '<label>City / Town<input type="text" name="city" required value="' + esc(l.city || '') + '"></label>' +
      '<button class="btn btn-primary" type="submit">' + (l.id ? 'Save changes' : 'Post service') + '</button>' +
      (l.id ? ' <button class="btn" type="button" data-action="cancel-edit">Cancel</button>' : '') +
      '</form>';
  }

  async function renderMyListings() {
    if (!currentUser) { renderAuth('login'); return; }
    if (currentUser.role !== 'repairer') {
      viewEl.innerHTML = '<div class="card"><p>Only repairers can post services. ' +
        'Register a repairer account to list your services.</p></div>';
      return;
    }
    viewEl.innerHTML = '<h2>My Services</h2><div id="listing-form-wrap"></div><div id="my-listings"><p class="muted">Loading…</p></div>';
    $('#listing-form-wrap').innerHTML = listingForm(editingListingId ? currentEditing : null);
    try {
      var mine = await DB.myListings();
      var box = $('#my-listings');
      if (!mine.length) {
        box.innerHTML = '<p class="empty">You have no services listed yet. Post your first one above.</p>';
      } else {
        box.innerHTML = mine.map(function (l) {
          return '<article class="card"><span class="tag">' + esc(l.service_type) + '</span>' +
            '<h3>' + esc(l.title) + '</h3>' +
            '<p class="price">' + money(l.price) + ' · ' + esc(l.city) + ', ' + esc(l.region) + '</p>' +
            '<p class="rating">' + stars(l.avg_rating || 0) + ' (' + (l.review_count || 0) + ')</p>' +
            '<div class="row-btns">' +
            '<button class="btn" data-action="edit-listing" data-id="' + esc(l.id) + '">Edit</button>' +
            '<button class="btn btn-danger" data-action="delete-listing" data-id="' + esc(l.id) + '">Delete</button>' +
            '</div></article>';
        }).join('');
      }
    } catch (err) {
      $('#my-listings').innerHTML = '<p class="error-box">' + esc(err.message) + '</p>';
    }
  }
  var currentEditing = null;

  // ---------------------------------------------------------------- my jobs
  function jobCard(r, side) {
    var statusClass = 'status-' + r.status;
    var html = '<article class="card"><div class="card-top"><span class="tag">' + esc(r.service_type || '') + '</span>' +
      '<span class="status ' + statusClass + '">' + esc(r.status) + '</span></div>' +
      '<h3>' + esc(r.listing_title || 'Service') + '</h3>' +
      '<p class="muted">' + (side === 'customer'
        ? 'Repairer: ' + esc(r.repairer_name) + ' · ' + esc(r.repairer_phone || '')
        : 'Customer: ' + esc(r.customer_name) + ' · ' + esc(r.customer_phone || '')) + '</p>' +
      (r.message ? '<p>“' + esc(r.message) + '”</p>' : '') +
      '<p class="muted">' + new Date(r.created_at).toLocaleString() + '</p>';

    if (side === 'repairer' && r.status === 'pending') {
      html += '<div class="row-btns"><button class="btn btn-primary" data-action="accept-job" data-id="' + esc(r.id) + '">Accept</button>' +
        '<button class="btn btn-danger" data-action="decline-job" data-id="' + esc(r.id) + '">Decline</button></div>';
    }
    if (side === 'repairer' && r.status === 'accepted') {
      html += '<button class="btn btn-primary" data-action="complete-job" data-id="' + esc(r.id) + '">Mark completed</button>';
    }
    if (side === 'customer' && (r.status === 'pending' || r.status === 'accepted')) {
      html += '<button class="btn btn-danger" data-action="cancel-job" data-id="' + esc(r.id) + '">Cancel request</button>';
    }
    if (side === 'customer' && r.status === 'completed' && !r.reviewed) {
      if (reviewOpenFor === r.id) {
        html += '<form class="review-form" data-request-id="' + esc(r.id) + '">' +
          '<label>Your rating<select name="rating">' +
          '<option value="5">★★★★★ (5)</option><option value="4">★★★★ (4)</option>' +
          '<option value="3">★★★ (3)</option><option value="2">★★ (2)</option>' +
          '<option value="1">★ (1)</option></select></label>' +
          '<textarea name="comment" rows="2" placeholder="How was the work?"></textarea>' +
          '<button class="btn btn-primary" type="submit">Submit review</button></form>';
      } else {
        html += '<button class="btn btn-primary" data-action="review-toggle" data-id="' + esc(r.id) + '">⭐ Leave a review</button>';
      }
    }
    if (side === 'customer' && r.status === 'completed' && r.reviewed) {
      html += '<p class="muted">✓ You reviewed this job.</p>';
    }
    return html + '</article>';
  }

  async function renderMyJobs() {
    if (!currentUser) { renderAuth('login'); return; }
    viewEl.innerHTML = '<h2>My Jobs</h2><div id="jobs"><p class="muted">Loading…</p></div>';
    try {
      var jobs = await DB.myRequests();
      var box = $('#jobs');
      var html = '';
      if (jobs.asCustomer.length) {
        html += '<h3>Jobs I requested</h3>' + jobs.asCustomer.map(function (r) { return jobCard(r, 'customer'); }).join('');
      }
      if (jobs.asRepairer.length) {
        html += '<h3>Jobs for me</h3>' + jobs.asRepairer.map(function (r) { return jobCard(r, 'repairer'); }).join('');
      }
      if (!html) html = '<p class="empty">No jobs yet. Browse services and send your first request.</p>';
      box.innerHTML = html;
    } catch (err) {
      $('#jobs').innerHTML = '<p class="error-box">' + esc(err.message) + '</p>';
    }
  }

  // ---------------------------------------------------------------- profile
  function renderProfile() {
    if (!currentUser) { renderAuth('login'); return; }
    var u = currentUser;
    viewEl.innerHTML = '<div class="card"><h2>' + esc(u.name) + '</h2>' +
      '<p><span class="tag">' + esc(u.role) + '</span></p>' +
      '<p>📞 ' + esc(u.phone) + '</p>' +
      '<p>💬 WhatsApp: ' + esc(u.whatsapp || u.phone) + '</p>' +
      '<p>📍 ' + esc(u.city) + ', ' + esc(u.region) + '</p>' +
      '<button class="btn btn-danger" data-action="logout">Log out</button></div>';
  }

  // ---------------------------------------------------------------- events
  document.addEventListener('click', async function (e) {
    var el = e.target.closest('[data-action]');
    var stop = e.target.closest('[data-stop]');
    // A click inside a [data-stop] zone (e.g. the Call / WhatsApp buttons
    // on a listing card) must not trigger the card's own data-action.
    // Buttons inside the zone carry their own data-action and still work.
    if (el && stop && el.contains(stop)) return;
    if (!el) return;
    var action = el.getAttribute('data-action');
    var id = el.getAttribute('data-id');

    try {
      if (action === 'nav-home') { editingListingId = null; currentEditing = null; await renderHome(); }
      else if (action === 'nav-jobs') { await renderMyJobs(); }
      else if (action === 'nav-services') { editingListingId = null; currentEditing = null; await renderMyListings(); }
      else if (action === 'nav-account') { renderProfile(); }
      else if (action === 'auth-tab') { renderAuth(el.getAttribute('data-mode')); }
      else if (action === 'chip') {
        filters.serviceType = el.getAttribute('data-service') || '';
        await renderHome();
      }
      else if (action === 'open-listing') { await renderListing(id); }
      else if (action === 'cancel-edit') { editingListingId = null; currentEditing = null; await renderMyListings(); }
      else if (action === 'edit-listing') {
        var mine = await DB.myListings();
        currentEditing = mine.find(function (l) { return l.id === id; });
        editingListingId = id;
        await renderMyListings();
        window.scrollTo(0, 0);
      }
      else if (action === 'delete-listing') {
        if (confirm('Delete this service?')) {
          await DB.deleteListing(id);
          showToast('Service deleted.');
          await renderMyListings();
        }
      }
      else if (action === 'accept-job' || action === 'decline-job' || action === 'complete-job' || action === 'cancel-job') {
        var status = action === 'accept-job' ? 'accepted'
          : action === 'decline-job' ? 'declined'
          : action === 'complete-job' ? 'completed' : 'cancelled';
        await DB.updateRequestStatus(id, status);
        showToast('Job ' + status + '.');
        await renderMyJobs();
      }
      else if (action === 'review-toggle') { reviewOpenFor = id; await renderMyJobs(); }
      else if (action === 'logout') {
        DB.signOut();
        currentUser = null;
        renderNav();
        await renderHome();
        showToast('Logged out.');
      }
    } catch (err) {
      showToast(err.message || 'Something went wrong.', true);
    }
  });

  document.addEventListener('submit', async function (e) {
    e.preventDefault();
    var form = e.target;
    var data = {};
    new FormData(form).forEach(function (v, k) { data[k] = v; });

    try {
      if (form.id === 'search-form') {
        filters.search = (data.search || '').trim();
        filters.region = data.region || '';
        filters.city = (data.city || '').trim();
        await renderHome();
      } else if (form.id === 'login-form') {
        currentUser = await DB.signIn({ phone: data.phone, password: data.password });
        renderNav();
        showToast('Welcome back, ' + currentUser.name.split(' ')[0] + '!');
        await renderHome();
      } else if (form.id === 'register-form') {
        currentUser = await DB.signUp({
          name: data.name, phone: data.phone, whatsapp: data.whatsapp,
          password: data.password, role: data.role,
          region: data.region, city: data.city
        });
        renderNav();
        showToast('Account created. Welcome, ' + currentUser.name.split(' ')[0] + '!');
        await renderHome();
      } else if (form.id === 'listing-form') {
        var input = {
          service_type: data.service_type, title: data.title,
          description: data.description, price: data.price,
          region: data.region, city: data.city
        };
        if (editingListingId) {
          await DB.updateListing(editingListingId, input);
          showToast('Service updated.');
        } else {
          await DB.createListing(input);
          showToast('Service posted.');
        }
        editingListingId = null;
        currentEditing = null;
        await renderMyListings();
      } else if (form.id === 'request-form') {
        if (!currentUser) { renderAuth('login'); return; }
        await DB.createRequest(currentListingId, data.message);
        showToast('Request sent to the repairer.');
        await renderMyJobs();
      } else if (form.classList.contains('review-form')) {
        await DB.createReview(form.getAttribute('data-request-id'), Number(data.rating), data.comment);
        reviewOpenFor = null;
        showToast('Thanks for your review!');
        await renderMyJobs();
      }
    } catch (err) {
      showToast(err.message || 'Something went wrong.', true);
    }
  });

  // ---------------------------------------------------------------- boot
  (async function init() {
    try {
      DB = pickAdapter();
      currentUser = await DB.getSession().catch(function () { return null; });
    } catch (err) {
      viewEl.innerHTML = '<p class="error-box">' + esc(err.message) + '</p>';
      return;
    }
    renderNav();
    await renderHome();
  })();
})();
