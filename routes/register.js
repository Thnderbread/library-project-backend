const express = require('express');
const router = express.Router();
const handleNewUser = require('../controllers/registerController');

router.route('/')
    .get((req, res) => {
        res.render('./register')
    })
    .post(handleNewUser)

module.exports = router;