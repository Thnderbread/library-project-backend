const { getCheckouts } = require("../helpers/bookHelpers");

async function getUserCheckouts(req, res) {
    try {
        const checkouts = await getCheckouts(req.user.id);
        return res.status(200).json(checkouts);
    } catch (error) {
        return res.sendStatus(500);
    }
}

module.exports = getUserCheckouts;