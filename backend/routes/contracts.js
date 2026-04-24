const express = require('express');
const router = express.Router();
const c = require('../controllers/contractsController');
router.get('/', c.list);
router.post('/', c.create);
router.get('/:id', c.get);
router.put('/:id', c.update);
router.patch('/:id/sign', c.sign);
module.exports = router;
