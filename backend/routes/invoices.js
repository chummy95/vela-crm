const express = require('express');
const router = express.Router();
const c = require('../controllers/invoicesController');
router.get('/', c.list);
router.post('/', c.create);
router.get('/:id', c.get);
router.patch('/:id/status', c.updateStatus);
module.exports = router;
