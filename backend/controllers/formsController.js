const { getDB } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const DEFAULT_FIELDS = [
  { label: 'Full Name', field_type: 'text', required: 1, options: '', sort_order: 0 },
  { label: 'Email Address', field_type: 'email', required: 1, options: '', sort_order: 1 },
  { label: 'Brand / Business Name', field_type: 'text', required: 1, options: '', sort_order: 2 },
  { label: 'Service Interested In', field_type: 'select', required: 1, options: 'Brand Identity,Packaging Design,Web Design,Full Suite', sort_order: 3 },
  { label: 'Tell me about your project', field_type: 'textarea', required: 1, options: '', sort_order: 4 },
  { label: 'Project Budget', field_type: 'select', required: 0, options: '£1,500–£3,000,£3,000–£5,000,£5,000+', sort_order: 5 },
];

function resolveUserId(req) {
  return req.user?.id || req.publicUserId;
}

function loadFields(userId) {
  const fields = getDB().prepare('SELECT * FROM form_fields WHERE user_id = ? ORDER BY sort_order').all(userId);
  return fields.length ? fields : DEFAULT_FIELDS;
}

const getFields = (req, res, next) => {
  try {
    const userId = resolveUserId(req);
    res.json(loadFields(userId));
  } catch (e) {
    next(e);
  }
};

const saveFields = (req, res, next) => {
  try {
    const { fields = [] } = req.body;
    const db = getDB();
    db.prepare('DELETE FROM form_fields WHERE user_id = ?').run(req.user.id);
    const insertField = db.prepare('INSERT INTO form_fields (id,user_id,label,field_type,required,options,sort_order) VALUES (?,?,?,?,?,?,?)');
    fields.forEach((field, index) => {
      insertField.run(
        uuidv4(),
        req.user.id,
        field.label,
        field.field_type,
        field.required ? 1 : 0,
        Array.isArray(field.options) ? field.options.join(',') : field.options || '',
        index
      );
    });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};

const submit = (req, res, next) => {
  try {
    const userId = resolveUserId(req);
    const payload = { ...(req.body || {}) };
    delete payload.user_id;

    const hasValues = Object.values(payload).some((value) => `${value ?? ''}`.trim() !== '');
    if (!hasValues) {
      return res.status(400).json({ error: 'Submission data is required' });
    }

    const id = uuidv4();
    getDB().prepare('INSERT INTO form_submissions (id,user_id,data) VALUES (?,?,?)').run(id, userId, JSON.stringify(payload));
    res.status(201).json({ success: true, id });
  } catch (e) {
    next(e);
  }
};

const submissions = (req, res, next) => {
  try {
    const rows = getDB().prepare('SELECT * FROM form_submissions WHERE user_id = ? ORDER BY submitted_at DESC').all(req.user.id);
    res.json(rows.map((row) => ({ ...row, data: JSON.parse(row.data) })));
  } catch (e) {
    next(e);
  }
};

module.exports = { getFields, saveFields, submit, submissions };
