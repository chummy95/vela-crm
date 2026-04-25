const { getDB } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const list = (req,res,next) => {
  try {
    const rows = getDB().prepare('SELECT i.*, c.name as client_name FROM invoices i LEFT JOIN clients c ON i.client_id=c.id WHERE i.user_id=? ORDER BY i.created_at DESC').all(req.user.id);
    res.json(rows);
  } catch(e){next(e);}
};
const get = (req,res,next) => {
  try {
    const row = getDB().prepare('SELECT i.*, c.name as client_name FROM invoices i LEFT JOIN clients c ON i.client_id=c.id WHERE i.id=? AND i.user_id=?').get(req.params.id, req.user.id);
    if(!row) return res.status(404).json({error:'Not found'});
    res.json(row);
  } catch(e){next(e);}
};
const create = (req,res,next) => {
  try {
    const { client_id, project_id, description, amount, due_date } = req.body;
    const id = 'INV-' + Date.now();
    getDB().prepare('INSERT INTO invoices (id,user_id,client_id,project_id,description,amount,due_date) VALUES (?,?,?,?,?,?,?)').run(id, req.user.id, client_id, project_id, description, amount, due_date);
    res.status(201).json(getDB().prepare('SELECT * FROM invoices WHERE id=?').get(id));
  } catch(e){next(e);}
};
const updateStatus = (req,res,next) => {
  try {
    const { status } = req.body;
    getDB().prepare('UPDATE invoices SET status=? WHERE id=? AND user_id=?').run(status, req.params.id, req.user.id);
    res.json({ success: true, status });
  } catch(e){next(e);}
};
module.exports = { list, get, create, updateStatus };
