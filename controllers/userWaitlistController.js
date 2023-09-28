const { getWaitlist } = require("../helpers/bookHelpers");

async function getUserWaitlist(req, res) {
    try {
        const waitlist = await getWaitlist(req.user.id);
        return res.status(200).json(waitlist);
    } catch (error) {
        return res.sendStatus(500);
    }
}

module.exports = getUserWaitlist;