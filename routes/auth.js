const express = require('express');
const router = express.Router();
const handleLogin = require('../controllers/authController');

router.route('/')
    .get((req, res) => {
        res.render('./index');
        res.end();
    })
    .post(handleLogin);

module.exports = router;