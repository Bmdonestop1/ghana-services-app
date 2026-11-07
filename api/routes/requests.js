// Service-request routes: customer sends a job request; the repairer
// accepts / declines / completes it; the customer can cancel it.
const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

// Allowed status moves, by who is acting.
const REPAIRER_MOVES = {
  pending: ['accepted', 'declined'],
  accepted: ['completed']
};
const CUSTOMER_MOVES = {
  pending: ['cancelled'],
  accepted: ['cancelled']
};

function shapeRequest(r) {
  return {
    id: r.id,
    listing_id: r.listing_id,
    listing_title: r.listing_title,
    service_type: r.service_type,
    customer_id: r.customer_id,
    customer_name: r.customer_name,
    customer_phone: r.customer_phone,
    repairer_id: r.repairer_id,
    repairer_name: r.repairer_name,
    repairer_phone: r.repairer_phone,
    status: r.status,
    message: r.message,
    reviewed: !!r.reviewed,
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

const REQUEST_SELECT = `
  select sr.*,
    l.title as listing_title, l.service_type,
    c.name as customer_name, c.phone as customer_phone,
    rp.name as repairer_name, rp.phone as repairer_phone,
    (rv.request_id is not null) as reviewed
  from service_requests sr
  join listings l on l.id = sr.listing_id
  join users c on c.id = sr.customer_id
  join users rp on rp.id = sr.repairer_id
  left join (select distinct request_id from reviews) rv
    on rv.request_id = sr.id
`;

// POST /api/requests  (customer only) — send a request for a listing.
router.post('/', requireAuth, requireRole('customer'), async (req, res) => {
  try {
    const { listing_id, message } = req.body || {};
    if (!listing_id) return res.status(400).json({ error: 'Which service is this request for?' });

    const { rows: listings } = await db.query(
      'select id, repairer_id from listings where id = $1', [listing_id]
    );
    if (!listings.length) return res.status(404).json({ error: 'Service not found.' });
    if (listings[0].repairer_id === req.user.id) {
      return res.status(400).json({ error: 'You cannot request your own service.' });
    }

    const { rows } = await db.query(
      `insert into service_requests (listing_id, customer_id, repairer_id, message)
       values ($1, $2, $3, $4) returning *`,
      [listing_id, req.user.id, listings[0].repairer_id, (message || '').trim()]
    );
    res.status(201).json({ request: rows[0] });
  } catch (err) {
    console.error('create request error:', err.message);
    res.status(500).json({ error: 'Could not send this request.' });
  }
});

// GET /api/requests  — jobs for the logged-in user, both sides.
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      REQUEST_SELECT +
      ' where sr.customer_id = $1 or sr.repairer_id = $1 order by sr.created_at desc',
      [req.user.id]
    );
    const all = rows.map(shapeRequest);
    res.json({
      requests: all,
      asCustomer: all.filter((r) => r.customer_id === req.user.id),
      asRepairer: all.filter((r) => r.repairer_id === req.user.id)
    });
  } catch (err) {
    console.error('my requests error:', err.message);
    res.status(500).json({ error: 'Could not load your jobs.' });
  }
});

// PATCH /api/requests/:id  — change status (rules depend on who acts).
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { status } = req.body || {};
    const { rows } = await db.query(
      'select * from service_requests where id = $1', [req.params.id]
    );
    const job = rows[0];
    if (!job) return res.status(404).json({ error: 'Job not found.' });

    const isRepairer = job.repairer_id === req.user.id;
    const isCustomer = job.customer_id === req.user.id;
    if (!isRepairer && !isCustomer) {
      return res.status(403).json({ error: 'This job is not yours.' });
    }

    const allowed = isRepairer
      ? (REPAIRER_MOVES[job.status] || [])
      : (CUSTOMER_MOVES[job.status] || []);
    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: `You cannot move this job from "${job.status}" to "${status || ''}".`
      });
    }

    const { rows: updated } = await db.query(
      'update service_requests set status = $2, updated_at = now() where id = $1 returning *',
      [req.params.id, status]
    );
    res.json({ request: updated[0] });
  } catch (err) {
    console.error('update request error:', err.message);
    res.status(500).json({ error: 'Could not update this job.' });
  }
});

module.exports = router;
