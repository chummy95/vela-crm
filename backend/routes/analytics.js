const express = require('express');
const router = express.Router();
const c = require('../controllers/analyticsController');
router.get('/revenue', c.revenue);
router.get('/pipeline', c.pipeline);
module.exports = router;
