const express = require('express');
const router = express.Router();
const handleLogout = require('../controllers/logoutController');

router.route('/')
    .get((req, res) => {
        res.render('./logout')
    })
    .post(handleLogout);

module.exports = router;