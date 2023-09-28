/**
 * 
 * @param {Object} details - Expects username, email, password, and matchPassword as an object. Checks validity of each via regex. Ensures matchPassword === password. 
 * @returns True if all checks pass.
 * @throws new Error if any field is blank or if any checks fail.
 */

function validateUserDetails(details) {
  
    // Check if the parameter is an object and if no parameter is passed
    if (typeof details !== 'object' || details === null || Array.isArray(details) || typeof details === "undefined") {
      throw new Error('Invalid parameter: An object is expected.');
    }

    const { username, email, password, matchPassword } = details;

    if (typeof username === 'undefined' || typeof password === 'undefined' || typeof email === 'undefined' || typeof matchPassword === 'undefined') {
        throw new Error('Missing one or more expected values.');
    }

    // username should only have alphanumeric characters or underscores, and start with a letter.
    const validUsernameRegex = /^[a-zA-Z][a-zA-Z0-9_]{3,15}$/;
    // ensures email is valid - matches 1 or more characters are not @ or whitespace.
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // ensures password is structurally valid
    const validPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,24}$/;
    
    if (!validUsernameRegex.test(username)) {
        throw new Error('Try a different username.');
        
    } else if (!validPasswordRegex.test(password)) {
        throw new Error('Try a different password.');

    } else if (!emailRegex.test(email)) {
        throw new Error('Try a different email.');

    } else if (matchPassword !== password) {
        throw new Error('Passwords do not match.');
    }

    return true;
}

module.exports = validateUserDetails;