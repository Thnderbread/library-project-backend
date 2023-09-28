const express = require('express');
const router = express.Router();
const handleForgotPassword = require('../controllers/forgotController');

router.route('/')
    .get((req, res) => {
    res.render('./forgot')
    })
    .post(handleForgotPassword);

module.exports = router;