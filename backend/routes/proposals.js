const express = require('express');
const router = express.Router();
const c = require('../controllers/proposalsController');
router.get('/', c.list);
router.post('/', c.create);
router.get('/:id', c.get);
router.put('/:id', c.update);
module.exports = router;
