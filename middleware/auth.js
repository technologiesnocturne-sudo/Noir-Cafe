const jwt = require('jsonwebtoken');

function getTokenFromHeader(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

/** Blocks the request unless a valid JWT is present. Attaches req.user. */
function authRequired(req, res, next) {
  const token = getTokenFromHeader(req);
  if (!token) return res.status(401).json({ error: 'Please log in to continue.' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Your session has expired. Please log in again.' });
  }
}

/** Use after authRequired. Blocks non-admins. */
function adminRequired(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'You do not have access to this resource.' });
  }
  next();
}

/** Attaches req.user if a valid token is present, but never blocks the request. */
function attachUserIfPresent(req, res, next) {
  const token = getTokenFromHeader(req);
  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      // Invalid/expired token on an optional route — proceed as a guest.
    }
  }
  next();
}

module.exports = { authRequired, adminRequired, attachUserIfPresent };
