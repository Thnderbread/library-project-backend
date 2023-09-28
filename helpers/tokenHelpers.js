require('dotenv').config();
const { v4: uuid } = require('uuid');
const format = require('date-fns/format');
const db = require('../config/connection');
const { cacheToken, retrieveCachedToken, removeCachedToken } = require('./redisTokenHelpers');
const logEvents = require('../middleware/logManager');
const { calculateTokenExpiryDate } = require('./tokenExpiryManager');

/**
 * Creates a token of type ***tokenType*** for the user. 
 * ***Expiry*** expects a value in seconds to set the expiry time
 * for the token. Otherwise uses a predefined value of 600 seconds
 * for access tokens, 1200 seconds for refresh tokens, and 1800 for reset tokens.
 * If ***cache*** is supplied as true, the created token will be cached into the redis database. If ***returnId*** is set to true, returns the id of the token. If ommitted or set to false, returns the token's payload. ***Endpoint*** is supplied for logging purposes. If not given, defaults to null.
 * @async
 * @param {string} tokenType - The type of token to be generated. Can be type 'access', type 'refresh', or type 'reset. 
 * @param {number} userId
 * @param {string} endpoint - The endpoint the function is being called at. Used for logging purposes. Defaults to NULL.
 * @param {number | undefined} expiresIn- Value in seconds for when the token should expire. Defaults to 600 , 1200, and 1800 for access, refresh, and reset tokens respectively.
 * @param {boolean} cache - Whether or not to store the token in redis cache. Defaults to false.
 * @param {boolean} returnTokenId - Boolean representing what will be returned. If set to true, the token's id will be returned. If ommitted or set to false, the token payload will be returned.
 * @returns - The generated token's payload upon completion, or its id.
 * @throws - An error if an issue occurs during database or redis operation.
 */
async function generateToken(tokenType, userId, endpoint, expiresIn, cache, returnTokenId) {
    if (!tokenType || !userId) throw new Error('Missing parameters. Include token type and user id.');
    const jwt = require('jsonwebtoken');

    // Generate token id, new date, and object with token properties
    const tokenId = uuid();
    const type = tokenType.toUpperCase();
    endpoint = endpoint ? endpoint.toUpperCase() : null;
    const date = format(new Date(), 'yyyy-MM-dd\tHH:mm:ss');

    const tokenProperties = {
        'REFRESH': { "expireTime": 1200, "secret": process.env.REFRESH_TOKEN_SECRET }, // expireTime is in seconds for consistency when given as a paramater for jwt.
        'ACCESS': { "expireTime": 600, "secret": process.env.ACCESS_TOKEN_SECRET }, // expireTime is in seconds for consistency when given as a paramater for jwt.
        'RESET': { "expireTime": 1800, "secret": process.env.RESET_TOKEN_SECRET } // expireTime is in seconds for consistency when given as a paramater for jwt.
    };

    // ensure a valid type of token was passed
    if (!tokenProperties[type]) {
        throw new Error('Invalid token type given. Only supports refresh, access, and reset tokens.');
    }

    expiresIn = expiresIn || tokenProperties[type]['expireTime']; // if expiresIn was passed, leave it as is. Otherwise, set default expire time.
    const expireDate = calculateTokenExpiryDate(expiresIn / 60) // find the expire time in minutes.

    // generate and sign the token payload
    const tokenPayload = jwt.sign(
        { "userId": userId },
        tokenProperties[type]['secret'],
        { expiresIn: expiresIn }
    );

    try {
        await db.execute(
            `INSERT INTO tokens 
            (id, user_id, payload, token_type, token_created_date, token_expired_date, expired) 
            VALUES (?, ?, ?, ?, ?, ?, 0)`,
            [tokenId, userId, tokenPayload, type, date, expireDate]
        );

        // If issuing a new refresh token, we need to update the refresh token id in the users table
        if (type === 'REFRESH') {
            await db.execute(`UPDATE users SET refresh_token_id = ? WHERE id = ?`, [tokenId, userId]);
        }

        if (cache) await cacheToken(userId, tokenPayload, tokenType, expiresIn); // If cache was passed as true, cache token in redis
        logEvents(`${type}, ${userId}, ${endpoint.toLowerCase()}, CREATE, SUCCESS`, 'tokenLog.txt'); // log successful token creation

        if (returnTokenId) return tokenId;
        return tokenPayload;

    } catch (error) {
        // using return error here will return an error object instead of causing this specific error to propogate up the call stack and properly trigger a try catch block that the function is called inside of. using throw new Error will create a new error object with a new stack trace instead of throwing the original error object containing what went wrong.
        logEvents(`${type}, ${userId}, ${endpoint.toLowerCase()}, CREATE, ERROR`, 'tokenLog.txt');
        throw error
    }
}

/**
 * Retrieves a token of type ***tokenType*** for the user. 
 * Checks redis cache and then Mysql database if necessary.
 * @async
 * @param {String} tokenType - The type of token to retrieve.
 * @param {number} userId - User's id, used to find their corresponding token. 
 * @returns The found token or null if it does not exist.
 */
async function retrieveToken(tokenType, userId) {
    if (!userId || !tokenType) throw new Error('Missing parameters. Include user id and token type.');

    try {
        let token = await retrieveCachedToken(tokenType, userId);
        if (token) return token;

        [token] = await db.execute(
            `SELECT * FROM tokens WHERE user_id = ?
            AND token_type = ? 
            AND expired = 0`,
            [userId, tokenType.toUpperCase()]
        );
        return token.length > 0 ? token[0]['payload'] : null;

    } catch (error) {
        throw error
    }
}

/**
 * For each token passed into ***tokens***, update the expiry date and status in database. 
 * Also removes the token from the redis cache. ***Endpoint*** is supplied for logging purposes. If not given, defaults to null.
 * @async
 * @param {String[]} tokens - An array of tokens to be processed. All supplied tokens will be revoked iteratively. 
 * @param {number} userId - User's id, used to find the tokens to revoke.
 * @param {string} endpoint - The endpoint the function is being called at. Used for logging purposes. Defaults to NULL.
 */
async function revokeToken(tokens, userId, endpoint) {
    if (!tokens || !userId) throw new Error('Missing parameters: token(s) and user id expected.');
    if (tokens.length > 3) throw new Error('Too many tokens to process.'); // can process access, refresh, and reset tokens.
    if (tokens.length < 1) return null;

    // if an endpoint was passed, capitalize it. otherwise set it to null
    endpoint = endpoint ? endpoint.toUpperCase() : null;
    const date = format(new Date(), 'yyyy-MM-dd\tHH:mm:ss');

    // Loop through tokens array and revoke each
    for (const token of tokens) {
        // Ensnure the user's refresh token is nullified, since 
        // that is the only one stored in users table
        if (token.toLowerCase() == 'refresh') {
            await db.execute(
                `UPDATE users 
                SET refresh_token_id = NULL 
                WHERE id = ?`,
                [userId]
            );
        }

        try {
            await db.execute(
                `UPDATE tokens SET token_expired_date = ?,
                expired = 1 
                WHERE user_id = ? AND token_type = ? AND expired = 0`,
                [date, userId, token]
            );

            // if token is cached, remove it
            await removeCachedToken(token, userId);
            logEvents(`${token}, ${userId}, ${endpoint.toLowerCase()}, REVOKE, SUCCESS`, 'tokenLog.txt');
        } catch (error) {
            logEvents(`${token}, ${userId}, ${endpoint.toLowerCase()}, REVOKE, ERROR`, 'tokenLog.txt');
            console.error('Error revoking token:', error);
            throw new Error("Couldn't revoke the token(s).");
        }
    }
}

module.exports = {
    revokeToken,
    generateToken,
    retrieveToken,
};