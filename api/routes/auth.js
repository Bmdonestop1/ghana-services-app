// Auth routes: register / login / me. Phone + password.
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, requireAuth, publicUser } = require('../auth');

const router = express.Router();

function cleanPhone(phone) {
  return String(phone || '').trim().replace(/[\s-]/g, '');
}

router.post('/register', async (req, res) => {
  try {
    const { name, phone, password, role, region, city, whatsapp } = req.body || {};
    const clean = cleanPhone(phone);

    if (!name || !clean || !password || !role || !region || !city) {
      return res.status(400).json({ error: 'Name, phone, password, role, region and city are required.' });
    }
    if (!['customer', 'repairer'].includes(role)) {
      return res.status(400).json({ error: 'Role must be customer or repairer.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = await db.query('select id from users where phone = $1', [clean]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'This phone number is already registered. Please log in.' });
    }

    const hash = await bcrypt.hash(String(password), 10);
    const { rows } = await db.query(
      `insert into users (phone, name, role, region, city, whatsapp, password_hash)
       values ($1, $2, $3, $4, $5, $6, $7) returning *`,
      [clean, String(name).trim(), role, region, city, (whatsapp || clean).trim(), hash]
    );
    const user = publicUser(rows[0]);
    res.status(201).json({ user, token: signToken(user) });
  } catch (err) {
    console.error('register error:', err.message);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body || {};
    const clean = cleanPhone(phone);
    if (!clean || !password) {
      return res.status(400).json({ error: 'Phone and password are required.' });
    }

    const { rows } = await db.query('select * from users where phone = $1', [clean]);
    const user = rows[0];
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Wrong phone number or password.' });
    }
    const ok = await bcrypt.compare(String(password), user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Wrong phone number or password.' });
    }
    const pub = publicUser(user);
    res.json({ user: pub, token: signToken(pub) });
  } catch (err) {
    console.error('login error:', err.message);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query('select * from users where id = $1', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Account not found.' });
    res.json({ user: publicUser(rows[0]) });
  } catch (err) {
    console.error('me error:', err.message);
    res.status(500).json({ error: 'Could not load your account.' });
  }
});

module.exports = router;
