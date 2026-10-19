// Centralized error handler. Any route that calls next(err) lands here.
function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status || 500;
  const message = status === 500 ? 'Something went wrong on our end. Please try again.' : err.message;
  res.status(status).json({ error: message });
}

function notFound(req, res) {
  res.status(404).json({ error: 'Not found.' });
}

module.exports = { errorHandler, notFound };
