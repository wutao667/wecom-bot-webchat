function errorHandler(err, req, res, _next) {
  console.error('[error]', err.stack || err.message || err);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'Invalid JSON in request body' });
  }

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
}

module.exports = errorHandler;
