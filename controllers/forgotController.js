const sendEmail = require("../helpers/emailHelper");
const { generateToken, revokeToken } = require("../helpers/tokenHelpers");
const { getUser } = require("../helpers/userHelpers");
// const logEvents = require("../middleware/logManager");

async function handleForgotPassword(req, res) {
    const { field } = req.body

    if (!field) return res.status(400).json({ 'error': 'Enter username or email.' });

    // find the user
    const searchParam = field.includes('@') ? 'email' : 'username';
    const user = await getUser(field, searchParam);
    
    // make sure the user exists before proceeding
    if (!user) return res.status(400).json({ 'error': 'Invalid username or email given. Check entry and try again.' });

    // revoke any previous token the user may have had
    try {
        await revokeToken('reset', user.id, req.baseUrl);
    } catch (error) {
        return res.sendStatus(500);
    }
    
    // create a new token for the user, store it and log its creation
    let resetTokenId
    try {
        resetTokenId = await generateToken('reset', user.id, req.baseUrl, undefined, false, true) // expiry time is 30 minutes
    } catch (error) {
        return res.sendStatus(500);
    }
    
    // send email with token inside link to the user
    const link = `https://localhost:8080/reset-password?reset=${resetTokenId}`;
    
    try {
        await sendEmail(user.email, link, 'reset');
    } catch (error) {
        if (error.message === 'Temporary failure.') {
            return res.sendStatus(500); // random failure; try again or contact support.
        } else if (error.message === 'Connection timed out.') {
            return res.status(408).json({ 'error': 'Connection timed out.' }); // try again - 408 denotes request time out
        } else if (error.message === '500-Class error.') {
            return res.status(500).json({ 'error': 'Unexpected error. Try again.' }); // try again
        }
        return res.sendStatus(500);
    }
    
    // obfuscate email and return it to frontend
    const [emailPrefix, emailDomain] = user.email.split('@');

    const obfuscatedEmailPrefix = emailPrefix[0] + emailPrefix.slice(1).replace(/\w/g, '*');
    const obfuscatedEmail = obfuscatedEmailPrefix + '@' + emailDomain;
    
    return res.json({ 'email': obfuscatedEmail });
}

module.exports = handleForgotPassword;