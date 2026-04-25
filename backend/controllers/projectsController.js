const { getDB } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

function getOwnedProject(id, userId) {
  return getDB().prepare(`
    SELECT p.*, c.name as client_name, c.color as client_color
    FROM projects p
    LEFT JOIN clients c ON p.client_id = c.id
    WHERE p.id = ? AND p.user_id = ?
  `).get(id, userId);
}

function ensureOwnedProject(id, userId) {
  const project = getOwnedProject(id, userId);
  if (!project) {
    const error = new Error('Project not found');
    error.status = 404;
    throw error;
  }
  return project;
}

const list = (req, res, next) => {
  try {
    const projects = getDB().prepare(`
      SELECT p.*, c.name as client_name, c.color as client_color
      FROM projects p LEFT JOIN clients c ON p.client_id = c.id
      WHERE p.user_id = ? ORDER BY p.created_at DESC
    `).all(req.user.id);
    res.json(projects);
  } catch (e) {
    next(e);
  }
};

const get = (req, res, next) => {
  try {
    const db = getDB();
    const project = ensureOwnedProject(req.params.id, req.user.id);
    const files = db.prepare('SELECT * FROM stage_files WHERE project_id = ? ORDER BY uploaded_at DESC').all(req.params.id);
    const signoffs = db.prepare('SELECT stage_index FROM stage_signoffs WHERE project_id = ? ORDER BY stage_index').all(req.params.id);
    res.json({ ...project, files, signoffs: signoffs.map((row) => row.stage_index) });
  } catch (e) {
    next(e);
  }
};

const create = (req, res, next) => {
  try {
    const { client_id, service, value, start_date, timeline, budget } = req.body;
    if (!client_id || !service?.trim()) return res.status(400).json({ error: 'Client and service are required' });

    const client = getDB().prepare('SELECT id FROM clients WHERE id = ? AND user_id = ?').get(client_id, req.user.id);
    if (!client) return res.status(400).json({ error: 'Client not found' });

    const id = uuidv4();
    getDB()
      .prepare('INSERT INTO projects (id,user_id,client_id,service,value,start_date,timeline,budget) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, req.user.id, client_id, service.trim(), value, start_date, timeline, budget);

    res.status(201).json(getOwnedProject(id, req.user.id));
  } catch (e) {
    next(e);
  }
};

const update = (req, res, next) => {
  try {
    const { service, value, start_date, timeline, budget, status } = req.body;
    if (!service?.trim()) return res.status(400).json({ error: 'Service is required' });

    const result = getDB()
      .prepare('UPDATE projects SET service=?,value=?,start_date=?,timeline=?,budget=?,status=? WHERE id=? AND user_id=?')
      .run(service.trim(), value, start_date, timeline, budget, status, req.params.id, req.user.id);

    if (!result.changes) return res.status(404).json({ error: 'Not found' });
    res.json(getOwnedProject(req.params.id, req.user.id));
  } catch (e) {
    next(e);
  }
};

const advanceStage = (req, res, next) => {
  try {
    const { stage } = req.body;
    const result = getDB().prepare('UPDATE projects SET stage = ? WHERE id = ? AND user_id = ?').run(stage, req.params.id, req.user.id);
    if (!result.changes) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, stage });
  } catch (e) {
    next(e);
  }
};

const addFile = (req, res, next) => {
  try {
    const { stage_index, name, file_type } = req.body;
    ensureOwnedProject(req.params.id, req.user.id);
    if (!name?.trim()) return res.status(400).json({ error: 'File name is required' });

    const id = uuidv4();
    getDB().prepare('INSERT INTO stage_files (id,project_id,stage_index,name,file_type) VALUES (?,?,?,?,?)').run(
      id,
      req.params.id,
      stage_index,
      name.trim(),
      file_type
    );

    res.status(201).json({ id, name: name.trim(), file_type, stage_index });
  } catch (e) {
    next(e);
  }
};

const signOff = (req, res, next) => {
  try {
    const { stage_index } = req.body;
    ensureOwnedProject(req.params.id, req.user.id);

    const existing = getDB().prepare('SELECT id FROM stage_signoffs WHERE project_id = ? AND stage_index = ?').get(req.params.id, stage_index);
    if (!existing) {
      getDB().prepare('INSERT INTO stage_signoffs (id,project_id,stage_index) VALUES (?,?,?)').run(uuidv4(), req.params.id, stage_index);
    }

    res.json({ success: true, stage_index });
  } catch (e) {
    next(e);
  }
};

module.exports = { list, get, create, update, advanceStage, addFile, signOff };
