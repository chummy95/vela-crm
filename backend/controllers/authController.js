const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

async function login(req, res, next) {
  try {
    const email = req.body?.email?.trim();
    const password = req.body?.password;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const db = getDB();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken(user);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, studio_name: user.studio_name } });
  } catch (e) {
    next(e);
  }
}

async function register(req, res, next) {
  try {
    const email = req.body?.email?.trim();
    const password = req.body?.password;
    const name = req.body?.name?.trim();
    const studio_name = req.body?.studio_name?.trim() || '';

    if (!email || !password || !name) return res.status(400).json({ error: 'Name, email, and password are required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const db = getDB();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const id = uuidv4();
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (id,email,password,name,studio_name) VALUES (?,?,?,?,?)').run(id, email, hash, name, studio_name);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    const token = signToken(user);
    res.status(201).json({ token, user: { id, email, name, studio_name } });
  } catch (e) {
    next(e);
  }
}

async function me(req, res, next) {
  try {
    const db = getDB();
    const user = db.prepare('SELECT id,email,name,studio_name,studio_tagline,website,instagram,location,currency FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) {
    next(e);
  }
}

module.exports = { login, register, me };
