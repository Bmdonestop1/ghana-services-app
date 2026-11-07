// Review routes: customer leaves a star rating after a completed job;
// anyone can read reviews for a listing or a repairer.
const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

// POST /api/reviews  (customer only, one review per completed request)
router.post('/', requireAuth, requireRole('customer'), async (req, res) => {
  try {
    const { request_id, rating, comment } = req.body || {};
    const stars = Number(rating);
    if (!request_id) return res.status(400).json({ error: 'Which job is this review for?' });
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      return res.status(400).json({ error: 'Rating must be 1 to 5 stars.' });
    }

    const { rows: jobs } = await db.query(
      'select * from service_requests where id = $1', [request_id]
    );
    const job = jobs[0];
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    if (job.customer_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only review your own jobs.' });
    }
    if (job.status !== 'completed') {
      return res.status(400).json({ error: 'You can only review a job after it is completed.' });
    }

    const existing = await db.query(
      'select id from reviews where request_id = $1', [request_id]
    );
    if (existing.rows.length) {
      return res.status(409).json({ error: 'You already reviewed this job.' });
    }

    const { rows } = await db.query(
      `insert into reviews (request_id, listing_id, repairer_id, customer_id, rating, comment)
       values ($1, $2, $3, $4, $5, $6) returning *`,
      [request_id, job.listing_id, job.repairer_id, req.user.id, stars, (comment || '').trim()]
    );
    res.status(201).json({ review: rows[0] });
  } catch (err) {
    console.error('create review error:', err.message);
    res.status(500).json({ error: 'Could not save this review.' });
  }
});

// GET /api/reviews?listingId=&repairerId=  (public)
router.get('/', async (req, res) => {
  try {
    const { listingId, repairerId } = req.query;
    const where = [];
    const params = [];
    if (listingId)  { params.push(listingId);  where.push(`r.listing_id = $${params.length}`); }
    if (repairerId) { params.push(repairerId); where.push(`r.repairer_id = $${params.length}`); }

    const { rows } = await db.query(
      `select r.*, u.name as customer_name from reviews r
       join users u on u.id = r.customer_id
       ${where.length ? 'where ' + where.join(' and ') : ''}
       order by r.created_at desc`,
      params
    );
    res.json({
      reviews: rows.map((r) => ({
        id: r.id, request_id: r.request_id, listing_id: r.listing_id,
        repairer_id: r.repairer_id, rating: r.rating, comment: r.comment,
        customer_name: r.customer_name, created_at: r.created_at
      }))
    });
  } catch (err) {
    console.error('list reviews error:', err.message);
    res.status(500).json({ error: 'Could not load reviews.' });
  }
});

module.exports = router;
