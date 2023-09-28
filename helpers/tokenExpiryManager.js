
/**
 * Calculates when a token will expire. 
 * @param {number} minutes - The amount of time in minutes to add to the current time to get the future expiry date.
 * @returns - A new date object representing the future expiry date.
*/
function calculateTokenExpiryDate(minutes) {
    const currentTime = new Date().getTime();
    return new Date(currentTime + minutes * 60_000); // 60,000 milliseconds in one minute.
}

/**
 * @async
 * Sets tokens as expired in mysql database if the expire date is past the current time. Logs how many tokens were invalidated.
 * @returns undefined
*/
async function setExpiredTokens() {
    const db = require('../config/connection');
    const logEvents = require('../middleware/logManager');
    console.log('Beginning token invalidation...')

    const currentTime = new Date();

    const query = `UPDATE tokens 
        SET expired = 1 
        WHERE token_expired_date <= ? 
        AND expired = 0`;

    try {
        const [results] = await db.execute(query, [currentTime]);
        logEvents(`Invalidated ${results.affectedRows} tokens.`, 'databaseLogs.txt');
        console.log(`Finished. ${results.affectedRows} tokens invalidated.`);
        return;
    } catch (error) {
        throw error;
    }
}

/**
 * @async
 * deletes expired tokens in database. combined with scheduler, runs every hour and a half.
 * @returns undefined
 */
async function deleteExpiredTokens() {
    const db = require('../config/connection');
    const logEvents = require('../middleware/logManager');
    console.log('Deleting expired tokens...')

    const query = `DELETE FROM tokens WHERE expired = 1`;

    try {
        const [results] = await db.execute(query);
        logEvents(`Deleted ${results.affectedRows} expired tokens.`, 'databaseLogs.txt');
        console.log(`Finished. ${results.affectedRows} expired tokens deleted.`);
        return;
    } catch (error) {
        throw error;
    }
}

module.exports = {
    setExpiredTokens,
    deleteExpiredTokens,
    calculateTokenExpiryDate,
}