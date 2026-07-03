const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * socket.io authentication middleware.
 * Validates JWT from socket handshake auth.token.
 */
function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    socket.userId = decoded.userId;
    socket.username = decoded.username;
    next();
  } catch (err) {
    next(new Error('Invalid or expired token'));
  }
}

module.exports = socketAuthMiddleware;
