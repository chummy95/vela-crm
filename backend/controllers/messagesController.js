const { getDB } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

function getOwnedClient(clientId, userId) {
  return getDB().prepare('SELECT id, name, color FROM clients WHERE id = ? AND user_id = ?').get(clientId, userId);
}

const list = (req, res, next) => {
  try {
    const clients = getDB()
      .prepare('SELECT DISTINCT m.client_id, c.name as client_name, c.color FROM messages m LEFT JOIN clients c ON m.client_id = c.id WHERE m.user_id = ?')
      .all(req.user.id);
    res.json(clients);
  } catch (e) {
    next(e);
  }
};

const thread = (req, res, next) => {
  try {
    const client = getOwnedClient(req.params.client_id, req.user.id);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    const messages = getDB().prepare('SELECT * FROM messages WHERE user_id = ? AND client_id = ? ORDER BY sent_at').all(req.user.id, req.params.client_id);
    res.json(messages);
  } catch (e) {
    next(e);
  }
};

const send = (req, res, next) => {
  try {
    const { client_id, text } = req.body;
    if (!client_id || !text?.trim()) return res.status(400).json({ error: 'Client and text are required' });

    const client = getOwnedClient(client_id, req.user.id);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const id = uuidv4();
    const cleanText = text.trim();
    getDB().prepare('INSERT INTO messages (id,user_id,client_id,text,outbound) VALUES (?,?,?,?,1)').run(id, req.user.id, client_id, cleanText);
    res.status(201).json({ id, client_id, text: cleanText, outbound: true, sent_at: new Date().toISOString() });
  } catch (e) {
    next(e);
  }
};

module.exports = { list, thread, send };
