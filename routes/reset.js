const express = require('express');
const router = express.Router();
const handlePasswordReset = require('../controllers/resetController');

router.route('/')
    .get((req, res) => {
    res.render('./reset-password')
    })
    .post(handlePasswordReset);

module.exports = router;