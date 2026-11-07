// Ghana Services App — REST API entry point.
// Run:  npm install && npm start        (needs DATABASE_URL + JWT_SECRET)
// Env:  see ../.env.example
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Allow the frontend origin (set FRONTEND_URL in production, e.g. your
// Cloudflare Pages or Render static-site URL). Defaults to open CORS
// so local development works out of the box.
app.use(cors({ origin: process.env.FRONTEND_URL || true }));
app.use(express.json({ limit: '1mb' }));

// Health check — does not touch the database.
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'ghana-services-api' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/listings', require('./routes/listings'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/reviews', require('./routes/reviews'));

// 404 for unknown API routes.
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// Last-resort error handler — always answer JSON, never crash the process.
app.use((err, req, res, next) => {
  console.error('unhandled error:', err.message);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

app.listen(PORT, () => {
  console.log(`Ghana Services API listening on port ${PORT}`);
});
