const db = require('../config/connection');
const redis = require('../config/redis');

function closeDbConnection(signal) {
    if (signal) {
        console.log(`Terminating database connection due to ${signal} signal.`);
    } else {
        console.log('Closing database connection...');
    }
    db.pool.end((error) => {
        if (error) {
            return error
        } else {
            return 'Database connection pool closed successfully.'
        }
    });
}

function closeRedisConnection(signal) {
    if (signal) {
        console.log(`Terminating redis connection due to ${signal} signal.`);
    } else {
        console.log('Closing redis connection...');
    }
    redis.disconnect();
    console.log('Redis connection closed successfully.');
}

module.exports = { closeDbConnection, closeRedisConnection };