require('dotenv').config();
const jwt = require('jsonwebtoken');
const { getUser } = require('../helpers/userHelpers');
const { retrieveToken, generateToken, revokeToken } = require('../helpers/tokenHelpers')

/**
 * Checks for user's refresh token and issues new refresh-access pair. 
 * @param {*} req 
 * @param {*} res 
 * @returns The refresh token as a cookie and the access token as a json response. 
 * if there's no refresh token, return a 403 forbidden status.
 */
async function handleRefreshToken(req, res) {
    const cookies = req.cookies;
    if (!cookies?.jwt) return res.sendStatus(403);
    const refreshTokenClient = cookies.jwt;

    try {
        jwt.verify(refreshTokenClient, process.env.REFRESH_TOKEN_SECRET, async (error, decoded) => {
            // redirect to logout controller here. Regardless of suspicious or expired token, user should be logged out.
            if (error) return res.status(403).json({ 'message': 'Invalid refresh token. You will be logged out.' });
            // if (error) return res.sendStatus(403);

            let userRefreshToken;
            if (decoded) {
                // Make sure user has a valid refresh token from db
                try {
                    userRefreshToken = await retrieveToken('refresh', decoded.userId);
                } catch (error) {
                    return res.status(500).json({ 'error': 'no token.' })
                }

                // Ensure token is valid and exists / isn't expired
                if (!userRefreshToken || refreshTokenClient !== userRefreshToken) return res.sendStatus(403);
                /**
                 * Revoke old tokens and issue new tokens to user.
                 * In order to keep user logged in and still issue new
                 * refresh token, we get remaining time from the old token 
                 * and create a new token with an expiry of the old token.
                 */

                // Revoke old tokens
                try {
                    await revokeToken(['access', 'refresh'], decoded.userId, req.baseUrl);
                } catch (error) {
                    return res.sendStatus(500);
                }

                // in tokens table in db, update expire time
                const currentTime = Math.floor(Date.now() / 1000);
                const timeRemaining = decoded.exp - currentTime;
                console.log(`Expires in: ${decoded.exp}, Remaining time: ${timeRemaining}`);

                // ? Set time in prod to be about 15 minutes, same as access token
                // 900 seconds is 15 minutes, expiry  time of access tokens
                // no point in giving a refresh token that expires before access token
                if (timeRemaining < 900) return res.sendStatus(403);

                // Generate new tokens
                let accessToken;
                let refreshToken;

                try {
                    accessToken = await generateToken('access', decoded.userId, req.baseUrl, undefined, true);
                } catch (error) {
                    return res.sendStatus(500);
                }

                try {
                    refreshToken = await generateToken('refresh', decoded.userId, req.baseUrl, timeRemaining, true);
                } catch (error) {
                    return res.sendStatus(500);
                }

                res.cookie('jwt', refreshToken, { httpOnly: true, sameSite: 'None', secure: true, maxAge: timeRemaining * 1_000 });
                return res.json({ accessToken });
            }
        })
    } catch (error) {
        console.error(error)

        return res.sendStatus(500);
    }
}

module.exports = handleRefreshToken;