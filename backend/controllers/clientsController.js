const { getDB } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

function getOwnedClient(id, userId) {
  return getDB().prepare('SELECT * FROM clients WHERE id = ? AND user_id = ?').get(id, userId);
}

const list = (req, res, next) => {
  try {
    const clients = getDB().prepare('SELECT * FROM clients WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    res.json(clients);
  } catch (e) {
    next(e);
  }
};

const get = (req, res, next) => {
  try {
    const client = getOwnedClient(req.params.id, req.user.id);
    if (!client) return res.status(404).json({ error: 'Not found' });
    res.json(client);
  } catch (e) {
    next(e);
  }
};

const create = (req, res, next) => {
  try {
    const { name, contact, email, location, industry, color } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

    const id = uuidv4();
    getDB()
      .prepare('INSERT INTO clients (id,user_id,name,contact,email,location,industry,color) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, req.user.id, name.trim(), contact, email, location, industry, color || '#1B2B4B');

    res.status(201).json(getOwnedClient(id, req.user.id));
  } catch (e) {
    next(e);
  }
};

const update = (req, res, next) => {
  try {
    const { name, contact, email, location, industry, color } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

    const result = getDB()
      .prepare('UPDATE clients SET name=?,contact=?,email=?,location=?,industry=?,color=? WHERE id=? AND user_id=?')
      .run(name.trim(), contact, email, location, industry, color, req.params.id, req.user.id);

    if (!result.changes) return res.status(404).json({ error: 'Not found' });
    res.json(getOwnedClient(req.params.id, req.user.id));
  } catch (e) {
    next(e);
  }
};

const remove = (req, res, next) => {
  try {
    const result = getDB().prepare('DELETE FROM clients WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
    if (!result.changes) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};

module.exports = { list, get, create, update, remove };
