const db = require('../config/connection');
/**
 * Finds a book in database via its ID.
 * @async
 * @param {number} bookISBN - Book's isbn-13 value.
 * @returns The book information as an object if it was found, undefined if it was not.
 */
async function getBook(bookISBN) {
    if (bookISBN === undefined) throw Error('getBook function missing book id.');
    let book;

    try {
        [book] = await db.execute(
            `SELECT ISBN13 AS isbn,
                title,
                author,
                published_year,
                image_url,
                description
                FROM books
            WHERE isbn13 = ?`,
            [bookISBN]
        );
        const published_year = book[0]["published_year"]
        book[0]["published_year"] = new Date(published_year).toLocaleDateString();
        return book[0];
    } catch (error) {
        console.error('Something went wrong in the getBook function:', error);
        throw new Error('Something went wrong while retrieving the book.')
    }
}

/**
 * Gets a user's current checkouts from database.
 * @async
 * @param {number} userId 
 * @returns An array of objects that hold book information. Can return an empty array.
 */
async function getCheckouts(userId) {
    if (!userId) throw new Error('getCheckouts function missing user id.')
    // Is select distinct necessary for prod? User cannot have multiple
    // of the same book in this table.
    const query =
        `SELECT DISTINCT
            b.isbn13 AS isbn,
            b.title, 
            b.author,
            b.published_year,
            b.image_url,
            b.description
        FROM
            book_checkout_entries c
        JOIN 
            books b ON c.book_isbn13 = b.isbn13
        WHERE
            c.user_id = ?`

    try {
        const [checkouts] = await db.execute(query, [userId]);
        return checkouts
    } catch (error) {
        console.error('Something went wrong in the getCheckouts function:', error);
        throw new Error('Something went wrong while finding the checkouts.');
    }
}

/**
 * Gets a user's current waitlist from database.
 * @param {number} userId 
 * @returns An array of objects that hold book information. Can return an empty array.
 */
async function getWaitlist(userId) {
    if (!userId) throw new Error('getWaitlist function missing user id.')

    // Is select distinct necessary for prod? User cannot have multiple
    // of the same book in this table.
    const query =
        `SELECT DISTINCT
            b.isbn13 AS isbn,
            b.title, 
            b.author,
            b.published_year,
            b.image_url,
            b.description
        FROM
            book_waitlist_entries w
        JOIN 
            books b ON w.book_isbn13 = b.isbn13
        WHERE
            w.user_id = ?`

    try {
        const [waitlist] = await db.execute(query, [userId]);
        return waitlist
    } catch (error) {
        console.error('Something went wrong in the getWaitlist function:', error);
        throw new Error('Something went wrong while finding the waitlist.');
    }
}

/**
 * @async
 * @param {string[]} params - Expects bookISBN (ISBN-13) and userId in that order. 
 * @returns ***undefined***
 */
async function removeBookFromWaitlist(params) {
    if (params.length < 2) throw new Error(`Missing params. User id and book isbn-13 required.`);

    try {
        await db.execute(
            `DELETE FROM book_waitlist_entries WHERE book_isbn13 = ? AND user_id = ?`,
            [...params]
        );
        return;
    } catch (error) {
        console.error('Something went wrong in the removeBookFromWaitlist function:', error);
        throw new Error('Something went wrong while removing a book from the waitlist.');
    }
}

module.exports = {
    getBook,
    getWaitlist,
    getCheckouts,
    removeBookFromWaitlist
};