const db = require('../config/connection');
const { getBook, removeBookFromWaitlist, getCheckouts, getWaitlist } = require('../helpers/bookHelpers');

/**
 * Update various tables to mark a book as waitlisted in the database.
 * @async
 * @param {*} req 
 * @param {*} res 
 * @returns User's updated waitlist array as a json response if successful.
 */
async function waitlistBook(req, res) {
    // Should there be a check in my database to ensure a user can't get an extra book?
    // FIXME: Duplicate insertions allowed.
    let book;
    let waitlist;
    let checkouts;
    const userId = req.user.id;
    const bookISBN = decodeURIComponent(req.query.book);

    // make sure we have book id, user id, and that user has not already waitlisted book
    if (bookISBN === undefined) {
        return res.status(400).json({ 'error': 'Book id required.' });
    } else if (!userId) {
        return res.sendStatus(401); // unauthorized api access
    }

    try {
        waitlist = await getWaitlist(userId);
        checkouts = await getCheckouts(userId);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ 'error': "Couldn't get user data." })
    }

    if (waitlist.find(book => book.isbn == bookISBN)) {
        return res.status(409).json({ 'error': 'Item already in waitlist!' });
    } else if (checkouts.find(book => book.isbn == bookISBN)) {
        return res.status(409).json({ 'error': 'User has already checked out this book!' })
    }

    // check database to make sure book is not waitlisted already
    //? could implement via trigger
    try {
        const [waitlisted] = await db.execute(
            'SELECT * FROM book_waitlist_entries WHERE book_isbn13 = ? AND user_id = ?',
            [bookISBN, userId]);

        if (waitlisted.length > 0) {
            return res.status(409).json({ 'error': 'Item already in waitlist!' });
        }
    } catch (error) {
        return res.sendStatus(500);
    }

    // at this point, go ahead and insert into waitlist entries table.
    try {
        await db.execute(
            `INSERT INTO book_waitlist_entries (book_isbn13, user_id, timestamp) VALUES (?, ?, NOW())`,
            [bookISBN, userId]
        );

    } catch (error) {
        if (error.sqlState == 45000) { // too many people are waiting for this book.
            return res.status(409).json({ 'error': 'Waitlist limit reached for this book.' });
        } else if (error.sqlState == 45100) { // user is on too many waitlists
            return res.status(409).json({ 'error': 'User waitlist limit reached.' })
        } else if (error.sqlState == 23000) { // Key constraint failed - book id not found in books table.
            return res.status(404).json({ 'error': 'Book does not exist in database.' });
        }
        return res.sendStatus(500);
    }

    // update waitlist history table
    try {
        await db.execute(
            `INSERT INTO book_waitlist_history (book_isbn13, user_id, timestamp) VALUES (?, ?, NOW())`,
            [bookISBN, userId]
        );
    } catch (error) { // if something goes wrong, revert the waitlisting.
        await db.execute(
            `DELETE FROM book_waitlist_entries WHERE book_isbn13 = ? AND user_id = ?`, [bookISBN, userId]
        );
        return res.sendStatus(500)
    }


    // we get the book information and push it into the user's waitlist.
    try {
        book = await getBook(bookISBN)
        waitlist.push(book);
    } catch (error) {
        return res.sendStatus(500); // different error code? everything technically succeeded here.
    }


    res.json({ waitlist });
}

/**
 * Updates various tables to remove a book from a user's waitlist.
 * @async
 * @param {*} req 
 * @param {*} res 
 * @returns User's updated waitlist array as a json response. 
 */
async function unWaitlist(req, res) {
    // remove from user's waitlist
    let waitlist;
    const userId = req.user.id;
    const bookISBN = decodeURIComponent(req.query.book);

    // ensure everything we need is present. preventing any unnecessary db operations.
    if (bookISBN === undefined) {
        return res.status(400).json({ 'error': 'Book id required.' });
    } else if (!userId) {
        return res.sendStatus(401); // unauthorized
    }

    try {
        waitlist = await getWaitlist(userId);
    } catch (error) {
        return res.status(500).json({ 'error': "Couldn't get user data." })
    }

    if (waitlist.length === 0 || !waitlist.find(book => book.isbn == bookISBN)) {
        return res.status(404).json({ 'error': 'Item not in waitlist!' });
    }

    //? could implement via trigger
    try {
        const [waitlisted] = await db.execute(
            'SELECT * FROM book_waitlist_entries WHERE book_isbn13 = ? AND user_id = ?',
            [bookISBN, userId]);
        if (waitlisted.length === 0) return res.status(404).json({ 'error': 'Item not in waitlist!' })
    } catch (error) {
        return res.sendStatus(500);
    }

    // this query will only handle one book. If a user wants to unwaitlist multiple books
    // I will have to make sure multiple ids are sent. we can turn bookISBN into an array, 
    // and iterate over it. for each entry, we can += a ' AND book_isbn13 = ?' statement to the query. 
    // finally, we can add the user_id part of the query at the end. 
    // can pass [...bookISBNArray, userId] to query statement.

    try {
        await removeBookFromWaitlist([bookISBN, userId])
    } catch (error) {
        return res.sendStatus(500);
    }

    return res.status(200).json({ waitlist: waitlist.filter(book => book.isbn != bookISBN) });
}

/**
 * Updates various tables to mark a book as checked in by a user.
 * @async
 * @param {*} req 
 * @param {*} res 
 * @returns User's updated checkouts array as a json response.
 */
async function checkinBook(req, res) {
    // check in a book
    const bookISBN = decodeURIComponent(req.query.book);
    const userId = req.user.id;
    let checkouts;

    if (bookISBN === undefined) {
        return res.status(400).json({ 'error': 'Book id required.' });
    } else if (!userId) {
        return res.sendStatus(401); // unauthorized
    }

    try {
        checkouts = await getCheckouts(userId)
    } catch (error) {
        console.error(error);
        res.status(500).json({ "error": "Couldn't get user data." })
    }

    if (checkouts.length === 0 || !checkouts.find(book => book.isbn == bookISBN)) {
        return res.status(404).json({ 'error': 'User has not checked out this book.' });
    }

    //? could implement via trigger
    // double check database to see if book has been checked out
    try {
        const [checkedOut] = await db.execute(
            'SELECT * FROM book_checkout_entries WHERE book_isbn13 = ? AND user_id = ?',
            [bookISBN, userId]);
        if (checkedOut.length === 0) return res.status(404).json({ 'error': 'User has not checked out this book.' });
    } catch (error) {
        return res.sendStatus(500);
    }

    try {
        // delete entry from checkout entries table
        await db.execute(
            `DELETE FROM book_checkout_entries WHERE book_isbn13 = ? AND user_id = ?`,
            [bookISBN, userId]
        );
        // set checkin date in history table. Check for NULL checkin date to ensure we don't overwrite previous
        // entries in history table if user has checked out the book more than once.
        // probably should've done this as a trigger. hindsight is 20/20.
        await db.execute(
            `UPDATE book_checkout_history SET checkin_date = NOW() WHERE book_isbn13 = ? AND user_id = ? AND checkin_date = NULL`,
            [bookISBN, userId]
        );
    } catch (error) {
        return res.sendStatus(500);
    }

    return res.status(200).json({ checkouts: checkouts.filter(book => book.isbn != bookISBN) });
}

/**
 * Updates various tables to mark a book as checked out by a user.
 * @async
 * @param {*} req 
 * @param {*} res 
 * @returns User's updated checkouts array as a json response.
 */
async function checkoutBook(req, res) {
    let waitlist;
    let checkouts;
    const userId = req.user.id;
    const bookISBN = decodeURIComponent(req.query.book);

    // TODO: Should remove from waitlist if it's there.
    if (bookISBN === undefined) {
        return res.status(400).json({ 'error': 'Book id required.' });
    } else if (!userId) {
        return res.sendStatus(401); // unauthorized
    }

    try {
        waitlist = await getWaitlist(userId);
        checkouts = await getCheckouts(userId);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ 'error': "Couldn't get user data." })
    }

    if (checkouts.find(book => book.isbn == bookISBN)) { // found the book in user's current checkouts array
        return res.status(409).json({ 'error': 'User has already checked out this book.' });
    }

    // ensure book is not marked as checked out in database
    // probably don't need db check here, since checkouts arr is from db.
    try {
        const [checkedOut] = await db.execute(
            'SELECT * FROM book_checkout_entries WHERE book_isbn13 = ? AND user_id = ?',
            [bookISBN, userId]);
        // If we get results from this query, this means there are books marked as checked out by this user in db.
        if (checkedOut.length > 0) return res.status(400).json({ 'error': 'User has already checked out this book.' });
    } catch (error) {
        return res.sendStatus(500);
    }

    // Mark book as checked out - insert into entries table
    try {
        await db.execute(
            `INSERT INTO book_checkout_entries (checkout_date, book_isbn13, user_id) VALUES (NOW(), ?, ?)`,
            [bookISBN, userId]
        );
    } catch (error) {
        if (error.sqlState == 45000) { // denotes a checkout limit on book due to custom trigger.
            return res.status(409).json({ 'error': 'Checkout limit reached for this book' });
        } else if (error.sqlState == 45100) { // denotes a user checkout limit due to custom trigger
            return res.status(409).json({ 'error': 'User checkout limit reached.' })
        } else if (error.sqlState == 23000) { // denotes failure of foreign key constraint - book doesn't exist..
            return res.status(404).json({ 'error': 'Book not found in database.' });
        }
        console.log(error);
        return res.sendStatus(500);
    }

    // update checkouts history table
    try {
        await db.execute(
            `INSERT INTO book_checkout_history (checkout_date, book_isbn13, user_id) VALUES(NOW(), ?, ?)`,
            [bookISBN, userId]
        );
        // revert the entry insertion
    } catch (error) {
        await db.execute(
            `DELETE FROM book_checkout_entries WHERE book_isbn13 = ? AND user_id = ?`,
            [bookISBN, userId]
        );
        return res.status(500);
    }

    // if the book is in the user's waitlist, remove it
    // ? Revert entry insertion here?
    try {
        const [waitlisted] = await db.execute(
            'SELECT * FROM book_waitlist_entries WHERE book_isbn13 = ? AND user_id = ?',
            [bookISBN, userId]);
        if (waitlisted.length > 0) {
            await removeBookFromWaitlist([bookISBN, userId]);
        }
        waitlist = waitlist.filter(book => book.isbn != bookISBN);
    } catch (error) {
        return res.sendStatus(500);
    }

    // update checkouts array
    try {
        const book = await getBook(bookISBN)
        checkouts.push(book);

    } catch (error) {
        return res.sendStatus(500);
    }

    return res.json({ waitlist, checkouts });
}

/**
 * Searches database for books based on title, author, and / or publication year.
 * @param {*} req 
 * @param {*} res 
 * @returns An array of all results.
 */
async function searchBooks(req, res) {
    const decoded = {};

    for (const key in req.query) {
        if (req.query.hasOwnProperty(key)) {
            decoded[key] = decodeURIComponent(req.query[key]).trim()
        }
    }

    const { title, author, year, page } = decoded;

    let results;
    const queryParams = [];
    const resultsLimit = '10';
    let query = 'SELECT isbn13 AS isbn, title, author, image_url, description, published_year FROM books WHERE 1';

    // % signs enclose keyword when using LIKE searches
    if (title) {
        query += ' AND title LIKE ?';
        queryParams.push(`%${title.toLowerCase()}%`)
    }
    if (author) {
        query += ' AND author LIKE ?';
        queryParams.push(`%${author.toLowerCase()}%`);
    }
    if (year) {
        query += ' AND published_year = ?';
        queryParams.push(Number(year));
    }

    // make sure the value of page is a valid number. Defaults to 0.
    // calculate and add the offset value to query params to take advantage of 
    // sql input sanitization with question marks
    // on frontend, pages are one-indexed, make sure to subtract
    // one for proper results since db is 0 indexed
    const offset = page > 0 ? (Number(page) - 1) * 10 : 0

    // if no params were given, get a random assortment of books
    if (!title && !author && !year) {
        query += ' ORDER BY RAND()'
    }

    queryParams.push(resultsLimit, `${offset}`);
    query += ' LIMIT ? OFFSET ?'

    try {
        [results] = await db.execute(query, queryParams);

        return res.json({ results });
    } catch (error) {
        console.log(error);
        return res.sendStatus(500);
    }
}

module.exports = {
    checkoutBook,
    waitlistBook,
    checkinBook,
    searchBooks,
    unWaitlist
};
