require("dotenv").config();
const { createTransport } = require("nodemailer");

class EmailError extends Error {
  constructor(message) {
    super(message);
    this.name = "EmailError";
  }
}

const transporter = createTransport({
  host: "smtp.gmail.com",
  port: 587,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  secure: false,
  requireTLS: true,
});

/**
 * Sends different types of email to a recipient.
 * @param {string} recipient - The recipient's email address.
 * @param {string} link - The link for password reset (required for 'reset' emailType).
 * @param {string} emailType - The type of email to be sent ('reset' or 'confirm').
 * @returns {Promise<number|string>} - Returns 250 for success, error messages for failures.
 */
async function sendEmail(recipient, link, emailType) {
  emailType = emailType.toLowerCase();
  const supportedTypes = ["reset", "confirm"];

  // Check parameter validity
  if (!recipient || !emailType || !recipient.includes("@")) {
    throw new Error(
      "Invalid parameters. Please provide recipient email and type."
    );
  } else if (emailType === "reset" && !link) {
    throw new Error("Link is required for reset emailType.");
  } else if (!supportedTypes.includes(emailType)) {
    throw new Error(`Supported types: ${supportedTypes}. Maybe a typo?`);
  }

  // Define email content based on type. Using an object here to avoid If-else.
  const emailBody = {
    reset: {
      body: `We received a request for you to reset your password. If you didn't request this, you can ignore this email. Otherwise, Click the below link:\n\n\t\t\t${link}`,
      subject: "Your Requested Password Reset Link",
    },
    confirm: {
      body: `Your password was just reset. If you did not initiate this, please contact support.`,
      subject: "Your Password Was Reset",
    },
  }; 

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: recipient,
    subject: emailBody[emailType]['subject'],
    text: emailBody[emailType]['body'],
  };

  try {
    await transporter.sendMail(mailOptions);
    return 250;
  } catch (error) {
    if (error.response.startsWith("4")) {
      // return 'Temporary failure.';
      throw new EmailError("Temporary failure.");
    } else if (error.response.startsWith("5")) {
      if (error.rejected) {
        // return 'Invalid email.';
        throw new EmailError("Invalid email.");
      } else if (error.code === "ETIMEDOUT") {
        // return 'Connection timed out.';
        throw new EmailError("Connection timed out.");
      } else {
        // return '500 class error.';
        throw new EmailError("500-Class error.");
      }
    }
  } 
}

module.exports = sendEmail;
