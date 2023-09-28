const express = require('express');
const router = express.Router();
const booksController = require('../../../controllers/booksController');

router
    .get('/search', booksController.searchBooks)
    .post('/waitlist', booksController.waitlistBook)
    .post('/checkout', booksController.checkoutBook)
    .delete('/waitlist', booksController.unWaitlist)
    .delete('/checkout', booksController.checkinBook);

module.exports = router;

// route('/')
//     .get(booksController.searchBooks)
//     .delete(booksController.unWaitlist)
//     .post(booksController.waitlistBook)
//     .post(booksController.checkoutBook)
//     .delete(booksController.checkinBook);
