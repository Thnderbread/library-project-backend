const handleRefreshToken = require('../controllers/refreshTokenController');
const express = require('express');
const router = express.Router();

router.post('/', handleRefreshToken);

module.exports = router;