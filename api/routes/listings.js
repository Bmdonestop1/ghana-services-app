// Listing routes: browse (public), create / edit / delete (repairer only).
const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

// Shared SELECT: listing + repairer public info + average rating.
// Ratings come from an aggregate subquery (no GROUP BY needed), so this
// works on any Postgres without relying on functional-dependency rules.
const LISTING_SELECT = `
  select l.*,
    u.name as repairer_name, u.phone as repairer_phone,
    u.whatsapp as repairer_whatsapp,
    coalesce(agg.avg_rating, 0)::float as avg_rating,
    coalesce(agg.review_count, 0)::int as review_count
  from listings l
  join users u on u.id = l.repairer_id
  left join (
    select listing_id, avg(rating) as avg_rating, count(*)::int as review_count
    from reviews group by listing_id
  ) agg on agg.listing_id = l.id
`;

function groupListing(row) {
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
    repairer_name: row.repairer_name,
    repairer_phone: row.repairer_phone,
    repairer_whatsapp: row.repairer_whatsapp || row.repairer_phone,
    avg_rating: Number(row.avg_rating || 0),
    review_count: Number(row.review_count || 0)
  };
}

// GET /api/listings?serviceType=&region=&city=&search=  (public)
router.get('/', async (req, res) => {
  try {
    const { serviceType, region, city, search } = req.query;
    const where = [];
    const params = [];

    if (serviceType) { params.push(serviceType); where.push(`l.service_type = $${params.length}`); }
    if (region)      { params.push(region);      where.push(`l.region = $${params.length}`); }
    if (city)        { params.push(`%${city}%`); where.push(`l.city ilike $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(l.title ilike $${params.length} or l.description ilike $${params.length} or u.name ilike $${params.length})`);
    }

    const sql = LISTING_SELECT +
      (where.length ? ' where ' + where.join(' and ') : '') +
      ' order by l.created_at desc';
    const { rows } = await db.query(sql, params);
    res.json({ listings: rows.map(groupListing) });
  } catch (err) {
    console.error('listings error:', err.message);
    res.status(500).json({ error: 'Could not load services.' });
  }
});

// GET /api/listings/mine  (repairer: my own listings)
router.get('/mine', requireAuth, requireRole('repairer'), async (req, res) => {
  try {
    const { rows } = await db.query(
      LISTING_SELECT + ' where l.repairer_id = $1 order by l.created_at desc',
      [req.user.id]
    );
    res.json({ listings: rows.map(groupListing) });
  } catch (err) {
    console.error('my listings error:', err.message);
    res.status(500).json({ error: 'Could not load your services.' });
  }
});

// GET /api/listings/:id  (public, with reviews)
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      LISTING_SELECT + ' where l.id = $1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Service not found.' });
    const listing = groupListing(rows[0]);
    const { rows: reviews } = await db.query(
      `select r.*, u.name as customer_name from reviews r
       join users u on u.id = r.customer_id
       where r.listing_id = $1 order by r.created_at desc`,
      [req.params.id]
    );
    listing.reviews = reviews.map((r) => ({
      id: r.id, rating: r.rating, comment: r.comment,
      customer_name: r.customer_name, created_at: r.created_at
    }));
    res.json({ listing });
  } catch (err) {
    console.error('listing detail error:', err.message);
    res.status(500).json({ error: 'Could not load this service.' });
  }
});

// POST /api/listings  (repairer only)
router.post('/', requireAuth, requireRole('repairer'), async (req, res) => {
  try {
    const { service_type, title, description, price, region, city } = req.body || {};
    if (!service_type || !title || price === undefined || !region || !city) {
      return res.status(400).json({ error: 'Service type, title, price, region and city are required.' });
    }
    const amount = Number(price);
    if (Number.isNaN(amount) || amount < 0) {
      return res.status(400).json({ error: 'Price must be a number in Ghana cedis (GH₵).' });
    }
    const { rows } = await db.query(
      `insert into listings (repairer_id, service_type, title, description, price, region, city)
       values ($1, $2, $3, $4, $5, $6, $7) returning *`,
      [req.user.id, service_type, String(title).trim(), (description || '').trim(), amount, region, city]
    );
    res.status(201).json({ listing: rows[0] });
  } catch (err) {
    console.error('create listing error:', err.message);
    res.status(500).json({ error: 'Could not create this service.' });
  }
});

// PUT /api/listings/:id  (own listing only)
router.put('/:id', requireAuth, requireRole('repairer'), async (req, res) => {
  try {
    const { service_type, title, description, price, region, city } = req.body || {};
    const { rows } = await db.query(
      'select id from listings where id = $1 and repairer_id = $2',
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Service not found or not yours.' });
    const amount = Number(price);
    if (price !== undefined && (Number.isNaN(amount) || amount < 0)) {
      return res.status(400).json({ error: 'Price must be a number in Ghana cedis (GH₵).' });
    }
    const { rows: updated } = await db.query(
      `update listings set
         service_type = coalesce($2, service_type),
         title = coalesce($3, title),
         description = coalesce($4, description),
         price = coalesce($5, price),
         region = coalesce($6, region),
         city = coalesce($7, city),
         updated_at = now()
       where id = $1 returning *`,
      [req.params.id, service_type || null, title || null, description ?? null,
       price === undefined ? null : amount, region || null, city || null]
    );
    res.json({ listing: updated[0] });
  } catch (err) {
    console.error('update listing error:', err.message);
    res.status(500).json({ error: 'Could not update this service.' });
  }
});

// DELETE /api/listings/:id  (own listing only)
router.delete('/:id', requireAuth, requireRole('repairer'), async (req, res) => {
  try {
    const { rows } = await db.query(
      'delete from listings where id = $1 and repairer_id = $2 returning id',
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Service not found or not yours.' });
    res.json({ ok: true });
  } catch (err) {
    console.error('delete listing error:', err.message);
    res.status(500).json({ error: 'Could not delete this service.' });
  }
});

module.exports = router;
