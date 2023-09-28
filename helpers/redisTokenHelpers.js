const redis = require('../config/redis');

/**
 * Caches a jwt token of type ***tokenType*** into redis cache. Expects 
 * expiry time in seconds.
 * @async
 * @param {number} userId 
 * @param {jwt} token 
 * @param {String} tokenType 
 * @param {number} expiresIn
 * @throws {Error} If params are missing or if some other error occurred.  
 */
async function cacheToken(userId, token, tokenType, expiresIn) {
    if (!userId || !token || !expiresIn) {
        throw new Error('Missing parameters. Supply user id, token, token type, and expiry time in seconds.');
    }

    try {
        await redis.connect()
        await redis.set(`${tokenType}token:${userId}`, token, 'EX', expiresIn);
    } catch (error) {
        throw new Error(`Error storing ${tokenType} token:`, error.message);
    } finally {
        redis.disconnect();
    }
}

/**
 * Retrieves a token of type ***tokenType*** from redis cache.
 * @async
 * @param {String} tokenType 
 * @param {number} userId 
 * @returns The found token or an error if something occurs.
 */

async function retrieveCachedToken(tokenType, userId) {
    if (!userId || !tokenType) throw new Error('Missing parameters. Include token type and user id.')

    try {
        await redis.connect()
        const token = await redis.get(`${tokenType}token:${userId}`);
        return token
    } catch (error) {
        throw new Error(`Error getting ${tokenType} token:`, error);
    } finally {
        redis.disconnect();
    }
}

/**
 * Removes a token of type ***tokenType*** from redis cache.
 * @async
 * @param {String} tokenType 
 * @param {number} userId 
 */
async function removeCachedToken(tokenType, userId) {
    if (!userId || !tokenType) throw new Error('Missing parameters. Include token type and user id.')

    try {
        await redis.connect()
        await redis.del(`${tokenType}token:${userId}`);
    } catch (error) {
        throw new Error(`Error deleting ${tokenType} token:`, error.message)
    } finally {
        redis.disconnect();
    }
}

module.exports = {
    cacheToken,
    removeCachedToken,
    retrieveCachedToken,
}