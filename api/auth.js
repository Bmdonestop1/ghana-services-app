// JWT helpers + middleware for the REST API.
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('ERROR: JWT_SECRET is not set. See ../.env.example');
  process.exit(1);
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, phone: user.phone, role: user.role },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// Attach req.user when a valid Bearer token is present, else 401.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Please log in first.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'This is only for ' + role + 's.' });
    }
    next();
  };
}

// Public shape of a user — never send password_hash to the client.
function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    role: row.role,
    region: row.region,
    city: row.city,
    whatsapp: row.whatsapp || row.phone,
    created_at: row.created_at
  };
}

module.exports = { signToken, requireAuth, requireRole, publicUser };
