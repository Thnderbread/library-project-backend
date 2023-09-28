const express = require('express');
const router = express.Router();
const getUserWaitlist = require('../../../controllers/userWaitlistController');
const getUserCheckouts = require('../../../controllers/userCheckoutsController');

router
    .get('/waitlist', getUserWaitlist)
    .get('/checkouts', getUserCheckouts);

module.exports = router;