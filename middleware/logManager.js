const format = require('date-fns/format');
const { v4: uuid } = require('uuid');
const fs = require('fs');
const path = require('path');
const fsPromises = require('fs/promises');

/**
 * Takes in a ***message*** string that can be one or more hard-written values, or comma separated template strings and writes it to file ***logTitle***. Creates ***logTitle*** if it does not already exist in 'logs' directory.
 * @param {*} message Information that will be logged to the file.
 * @param {string} logTitle Title of the log: e.g. 'reqLog.txt'.
 */
async function logEvents(message, logTitle) {
    const timestamp = `${format(new Date(), 'yyyy-MM-dd\tHH:mm:ss')}`;
    const logItem = `${timestamp}\t${uuid()}\t${message}\n`;

    try {
        if (!fs.existsSync(path.join(__dirname, '..', 'logs'))) {
           await fsPromises.mkdir(path.join(__dirname, '..', 'logs'));
        }
       await fsPromises.appendFile(path.join(__dirname, '..', 'logs', logTitle), logItem);
    } catch (error) {
       console.error(error);
    }
}

module.exports = logEvents;