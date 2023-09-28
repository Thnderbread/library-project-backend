// require('dotenv').config();
const bcrypt = require('bcrypt');
const { getUser, createUser } = require('../helpers/userHelpers');
const validateUserDetails = require('../helpers/validateUserDetails');

// function to handle a new user.
async function handleNewUser(req, res) {
    const { username, email, password, matchPassword } = req.body;
    if (!username || !email || !password || !matchPassword) return res.status(400).json({ 'error': 'All fields are required.' });
    // use regex to ensure alphanumeric chars only are passed. can have _.!?$

    /*
        * If the user already exists in our database, return a 409 conflict error.
        * The getUser function returns an error if something goes wrong OR if
        * the user is not found. If an error occurs, we return a 500 server status.
        * If no error occurs, that means the user was not found, and we can create one.
    */

    try {
        const userEmail = await getUser(email, 'email');
        const userExists = await getUser(username, 'username');

        if (userExists) return res.status(409).json({ 'error': 'User already exists.' });
        if (userEmail) return res.status(409).json({ 'error': 'Email in use.' });
    } catch (error) {
        if (error) return res.sendStatus(500);
    }

    try {
        validateUserDetails({
            username: username,
            email: email,
            password: password,
            matchPassword: matchPassword
        });
    } catch (error) {
        if (error.message === 'Invalid parameter: An object is expected.'
            || error.message === 'Missing one or more expected values.') {
            return res.status(400).json({ 'error': 'Missing some values. Double check your entries and try again.' });
        }
        return res.status(400).json({ 'error': error.message });
    }
    // create user
    const hashedPassword = await bcrypt.hash(password, 10);

    // let accessToken;
    // let refreshToken;

    try {
        // const userId = 
        await createUser([username.toLowerCase(), hashedPassword, email.toLowerCase()]);
    } catch (error) {
        return res.sendStatus(500);
    }

    return res.sendStatus(201) //.json({ accessToken });
    // res.cookie('jwt', refreshToken, { httpOnly: true, sameSite: 'None', secure: true, maxAge: 60 * 20_000 }); // FIXME: Change to 7d in prod
}

module.exports = handleNewUser;