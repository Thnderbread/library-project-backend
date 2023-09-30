require('dotenv').config();
const cors = require('cors');
const cron = require('node-cron');
const express = require('express');
const app = express();
const redis = require('./config/redis');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const verifyJWT = require('./middleware/verifyJWT');
const routeLogger = require('./middleware/routeLogger');
const errorLogger = require('./middleware/errorLogger');
const { allowedOrigins, allowedMethods } = require('./config/allowedOptions');
const { setExpiredTokens, deleteExpiredTokens } = require('./helpers/tokenExpiryManager');
const { closeDbConnection, closeRedisConnection } = require('./helpers/dbCleanupHelpers');

app.use(cors({
    origin: allowedOrigins,
    methods: allowedMethods,
    credentials: true
}));

// route logger
app.use(routeLogger);

app.use(express.urlencoded({ extended: true })); // middleware for parsing url-encoded forms
app.use(cookieParser()); // middleware for parsing cookies
app.use(express.json()); // middleware for parsing json bodies
app.use(session({
    secret: process.env.SESSION_KEY_SECRET,
    resave: false,
    saveUninitialized: false
}));

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/forgot', require('./routes/forgot'));
app.use('/logout', require('./routes/logout'));
app.use('/refresh', require('./routes/refresh'));
app.use('/register', require('./routes/register'));
app.use('/reset-password', require('./routes/reset'));

// books api
app.use('/books', verifyJWT, require('./routes/api/books/books'));

// users api
app.use('/users', verifyJWT, require('./routes/api/users/users'));

// Error logger
app.use(errorLogger);

// unsupported routes
app.all('*', (req, res) => {
    return res.status(404).json({ 'error': 'Requested resource not found.' });
});

cron.schedule('*/5 * * * *', setExpiredTokens); // scrapes db for expired tokens every five minutes.
cron.schedule('30 * * * *', deleteExpiredTokens); // Deletes expired tokens from db every hour and a half.

app.listen(8080, () => console.log('Application now listening on http://localhost:8080'));

process.on('SIGINT', () => {
    closeDbConnection('SIGINT');
    closeRedisConnection('SIGINT');
    process.exit(0);
});

process.on('SIGTERM', () => {
    closeDbConnection('SIGTERM');
    closeRedisConnection('SIGTERM');
    process.exit(0);
});

process.on('beforeExit', () => {
    closeDbConnection();
    closeRedisConnection();
    process.exit(0);
});