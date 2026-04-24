const express = require('express');
const router = express.Router();
const c = require('../controllers/formsController');
router.get('/fields', c.getFields);
router.put('/fields', c.saveFields);
router.post('/submit', c.submit);
router.get('/submissions', c.submissions);
module.exports = router;
