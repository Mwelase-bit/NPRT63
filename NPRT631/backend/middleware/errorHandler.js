const AppError = require('../utils/AppError');

const handleDBConstraintError = (err) => {
    if (err.message.includes('users.email') || err.message.includes('users_email_key')) {
        return new AppError('An account with this email already exists.', 409);
    }
    if (err.message.includes('student_no') || err.message.includes('users_student_no_key')) {
        return new AppError('An account with this student number already exists.', 409);
    }
    return new AppError('Database constraint failed', 400);
};

const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    let error = { ...err, name: err.name, message: err.message, code: err.code };

    // DB Constraint Errors (SQLite: SQLITE_CONSTRAINT_UNIQUE, PostgreSQL: 23505)
    if (
        (error.name === 'SqliteError' && error.code === 'SQLITE_CONSTRAINT_UNIQUE') ||
        error.code === '23505'
    ) {
        error = handleDBConstraintError(error);
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
        error: `System Error: ${err.message}`
    });
};

module.exports = errorHandler;
