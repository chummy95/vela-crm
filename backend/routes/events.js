const express = require('express');
const router = express.Router();
const c = require('../controllers/eventsController');
router.get('/', c.list);
router.post('/', c.create);
router.delete('/:id', c.remove);
module.exports = router;
