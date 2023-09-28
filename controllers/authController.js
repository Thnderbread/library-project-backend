require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../config/connection');
const { getUser } = require('../helpers/userHelpers');
const { getWaitlist, getCheckouts } = require('../helpers/bookHelpers');
const { generateToken, revokeToken } = require('../helpers/tokenHelpers');

async function handleLogin(req, res) {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ 'error': 'Please fill all fields.' });
    // find user in db

    let checkouts;
    let waitlist;
    let user;

    try {
        user = await getUser(username, 'username');
        if (!user) return res.status(400).json({ 'error': 'User not found.' })
        // verify given password
        try {
            const correctPassword = await bcrypt.compare(password, user.password);
            if (!correctPassword) return res.sendStatus(403) // forbidden - Incorrect password.
        } catch (error) {
            console.error(error);
            if (error) return res.sendStatus(500);
        }

        // if user has tokens in database that are not expired, revoke them before issuing new pair
        try {
            await revokeToken(['access', 'refresh'], user.id, req.baseUrl);
        } catch (error) {
            console.error(error);
            return res.sendStatus(500);
        }

        // issue new refresh-access token pair
        let accessToken;
        let refreshToken;

        try {
            accessToken = await generateToken('access', user.id, req.baseUrl, undefined, false);
        } catch (error) {
            console.error(error);
            return res.sendStatus(500);
        }

        try {
            refreshToken = await generateToken('refresh', user.id, req.baseUrl, 3600, true);
        } catch (error) {
            console.error(error);
            return res.sendStatus(500);
        }

        try {
            checkouts = await getCheckouts(user.id);
        } catch (error) {
            console.error(error);
            return res.sendStatus(500);
        }

        try {
            waitlist = await getWaitlist(user.id);
        } catch (error) {
            console.error(error);
            return res.sendStatus(500);
        }

        //FIXME: change maxAge value in prod to 7 days 
        res.cookie('jwt', refreshToken, { httpOnly: true, sameSite: 'None', secure: true, maxAge: 60 * 20_000 });
        return res.json({ accessToken, checkouts, waitlist });

    } catch (error) {
        return res.sendStatus(500); // Database lookup error.
    }
}

module.exports = handleLogin;