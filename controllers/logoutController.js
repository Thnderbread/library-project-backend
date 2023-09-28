const jwt = require('jsonwebtoken');
const { revokeToken } = require('../helpers/tokenHelpers');

async function handleLogout(req, res) {
    try {
        // Get jwt token from cookie
        const cookie = req.cookies?.jwt;

        if (!cookie) {
            return res.status(404).json({ message: 'User data not found.' });
        }

        const userId = jwt.verify(cookie, process.env.REFRESH_TOKEN_SECRET).userId;

        res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true, maxAge: 60 * 1000 });

        await revokeToken(['access', 'refresh'], userId, req.baseUrl);

        req.session.destroy((error) => {
            if (error) {
                res.sendStatus(500);
            } else {
                res.sendStatus(204);
            }
        });
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
}


module.exports = handleLogout;