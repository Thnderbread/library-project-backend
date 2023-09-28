require('dotenv').config();
const jwt = require('jsonwebtoken');
/**
 * Verifies the user's access token before proceeding to next route.
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 * @returns 403 status if token is invalid, absent, or expired
 */
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader) return res.sendStatus(403); // absent token.
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, token) => {
        if (error) {
            return res.sendStatus(403); // forbidden access, expired or malformed token
        }
        req.user = { id: token.userId }
        next();
    })
}

module.exports = verifyJWT;