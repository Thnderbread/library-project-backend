const logEvents = require('./logManager')
const routes = require('../config/routes');
// add user id, request headers (?), response status code, possibly message as well.
// add these logs to buffer instead of writing immediately (?)
function routeLogger(req, res, next) {
    // ensure the route is suppported before it is logged.
    if (routes.includes(req.path)) {
        logEvents(`${req.method}\t${req.headers.origin}\t${req.url}`, 'reqLog.txt', );
        console.log(`${req.method} ${req.path}`);
    }
    next();
}

module.exports = routeLogger;