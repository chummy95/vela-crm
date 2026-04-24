const express = require('express');
const router = express.Router();
const c = require('../controllers/messagesController');
router.get('/', c.list);
router.get('/:client_id', c.thread);
router.post('/', c.send);
module.exports = router;
