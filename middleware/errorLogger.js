const logEvents = require('./logManager')

function errorLogger(error, req, res, next) {
    logEvents(`${error.name}: ${error.message} AT /${req.path}`, 'errLog.txt');
    console.error(error.stack);
    next();
}

module.exports = errorLogger;