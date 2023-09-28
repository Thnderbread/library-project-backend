const db = require('../config/connection');

/**
 * Creates a user in Mysql database. Expects username, email, and password as strings. 
 * @async 
 * @param {string[]} userDetails 
 * @returns The insertion id from the databse operation that will be used as user's id.
 * @throws An error upon database insertion failure.
 */
async function createUser(userDetails) {
    const query = `INSERT INTO users (username, password, email) VALUES (?, ?, ?)`;
    /** `INSERT INTO users 
    // (username, password, email, refresh_token, token_created_date)
    // VALUES (?, ?, ?, ?, ?)`;
    // `INSERT INTO users (username, password, email) VALUES (?, ?, ?)`
    */

    try {
        const [rows] = await db.execute(query, [...userDetails]);
        return rows.insertId;
    } catch (error) {
        console.error('Error in createUser function:', error);
        throw new Error('Could not create the user.');
    }
}

/**
 * Finds a user in the database based on the identifier passed. Automatically converts ***user*** and ***identifier*** to lowercase.
 * @async
 * @param {string | int} user An int that can represent the user's id, or a string that can represent the user's username, email, or token id.
 * @param {string} identifier A string representing what is being passed as ***user***. Can be 'id', 'email', 'username', or 'token'. 
 * @returns An empty array if the user is not found, otherwise an object of user's details.
 * @throws An error if the identifier given is not supported.
 */
async function getUser(user, identifier) {
    const identifiers = ['email', 'username', 'id', 'token'];

    // set the column that we will use for searching the database
    const column = identifiers.find(id => id === identifier.toLowerCase());

    if (column == undefined || !user || typeof identifier !== 'string') {
        throw new Error('Invalid parameters. Ensure both user and identifier are provided correctly.');
    }

    let query = identifier.toLowerCase() === 'token'
    // Query for searching via token.
        ? `SELECT 
                u.id, 
                u.username, 
                u.password, 
                u.email 
            FROM 
                users u 
            JOIN 
                tokens t ON t.user_id = u.id 
            WHERE
                t.id = ?`
    // Otherwise, search based on desired column.
        : `SELECT 
                u.id, 
                u.username, 
                u.password, 
                u.email 
            FROM 
                users u
            WHERE 
                u.${column} = ?`;

    // search database case insensitevely if not searching by id or token id
    // the convention for uuidv4 is that the generated string only uses lowercase letters.
    // since this is true, we can turn whatever is passed into the user variable to lowercase
    user = typeof user === 'string' ? user.toLowerCase() : user;
    
    try {
        const [rows] = await db.execute(query, [user]);
        return rows[0] || null; // if user was found, return object containing their data, otherwise return null
    } catch (error) {
        console.error('Error in getUser function:', error)
        throw new Error('Error while fetching user data.');
    }
}

/**
 * Takes a password, hashes it, and updates the value in database to be the new hashed value.
 * @async
 * @param {*} userId
 * @param {*} newPassword - User's new plaintext password. Function will hash password internally.
 * @throws - Error if any parameters are missing, or something fails while hashing.
 */
async function updatePassword(userId, newPassword) {
    if (!userId || !newPassword) throw new Error('Missing parameters. Supply user id and new password to replace old password.')
    
    const bcrypt = require('bcrypt');

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    try {
        await  db.execute(`UPDATE users SET password = ? WHERE id = ?`, [hashedPassword, userId]);
    } catch (error) {
        throw error
    }

}

module.exports = {
    getUser,
    createUser,
    updatePassword
}