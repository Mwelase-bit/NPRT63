const AppError = require('../utils/AppError');

const handleSQLiteConstraintError = (err) => {
    // Determine the type of constraint failed
    if (err.message.includes('UNIQUE constraint failed: users.email')) {
        return new AppError('An account with this email already exists.', 409);
    }
    return new AppError('Database constraint failed', 400);
};

const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    let error = { ...err, name: err.name, message: err.message };

    // SQLite Errors
    if (error.name === 'SqliteError' && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        error = handleSQLiteConstraintError(error);
    }

    // JWT Errors
    if (error.name === 'JsonWebTokenError') {
        error = new AppError('Invalid token. Please log in again.', 401);
    }
    if (error.name === 'TokenExpiredError') {
        error = new AppError('Your token has expired. Please log in again.', 401);
    }

    if (error.isOperational) {
        return res.status(error.statusCode).json({
            status: error.status,
            error: error.message
        });
    }

    // Programming or other unknown errors
    console.error('ERROR 💥', err);
    res.status(500).json({
        status: 'error',
        error: 'Something went very wrong!'
    });
};

module.exports = errorHandler;
