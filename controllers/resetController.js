const { retrieveToken, revokeToken } = require("../helpers/tokenHelpers");
const { getUser, updatePassword } = require("../helpers/userHelpers");
const jwt = require('jsonwebtoken');
const sendEmail = require("../helpers/emailHelper");

async function handlePasswordReset(req, res) {
    // grab the token id from url string. (Excludes domain name, original url starts at /resetTokenId instead of https://domain/route/resetTokenId)
    const tokenId = req.query.reset;
    const { newPass, confirmNewPass } = req.body;

    // ensure there's a token id in the url and make sure the given passwords match.
    if (!tokenId) return res.sendStatus(404);
    if (!newPass || !confirmNewPass) {
        return res.status(400).json({ 'error': 'Fill all fields.' });
    } else if (newPass !== confirmNewPass) {
        return res.status(400).json({ 'error': 'Passwords do not match.' });
    }
    try {
        // Get the user and the actual token payload
        const user = await getUser(tokenId, 'token');
        
        if (!user) return res.sendStatus(404); // .json({ 'error': 'no user found matching that token. '});
        
        let token;
        try {
            token = await retrieveToken('reset', user.id);
        } catch (error) {
            // token could not be found. user needs to get a new link.
            // actually caused by error in retrieve token function. token[0]['payload'] is being read, when token is undefined or null.
            return res.status(500).json({ 'error': 'Please request new link.' });
        }
        // verify token validity. If invalid, user should request a new token (go to forgot password endpoint again.).
        try {
            jwt.verify(token, process.env.RESET_TOKEN_SECRET);
        } catch (error) {
            await revokeToken(['reset'], user.id, req.baseUrl);
            return res.status(403).json({ 'error': 'Invalid token.' }); // some other error to denote issue with token.
        }

        // send confirmation email. 
        try {
            await sendEmail(user.email, undefined, 'confirm');
            // checks and error handling on 'sent' variable / object
        } catch (error) {
            if (error.message === 'Temporary failure.') {
                return res.sendStatus(500) // random failure. frontend: try again or contact support.
            // } else if (error.message === 'Invalid email.') {
            //     is this necessary? The email is from database. It should always be correct.
            //     return res.status(400).json({ 'error': 'The email is invalid. Please contact support.' }); 
            // } 
            } else if (error.message === 'Connection timed out.') {
                return res.status(408).json({ 'error': 'Connection timed out.' }); // try again
            } else if (error.message === '500-Class error.') {
                return res.status(500).json({ 'error': 'Unexpected error. Try again.' }); // try again
            }
            return res.sendStatus(500); // something else went wrong. try again, contact support.
            // is this detailed error handling necessary here? Maybe should just return a generic 500 status if something is wrong, and leave token intact. Maybe only respond with connection time out if that occurs. Otherwise, we can just tell user to try again?
        }

        // once we know the email has sent and the user doesn't need to reattempt anything, we can finally revoke the token.
        try {
            await revokeToken(['reset'], user.id, req.baseUrl);
        } catch (error) {
            return res.sendStatus(500);
        }

        // hash the password and update the user's password object
        try {
            await updatePassword(user.id, newPass);
        } catch (error) {
            return res.status(500).json({ 'error': 'Password could not be updated.' })
        }

    } catch (error) {
        
        return res.sendStatus(500);
    }
    return res.sendStatus(201);
}

module.exports = handlePasswordReset;