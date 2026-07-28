/** Central error handler. Must be registered last. */
export function notFound(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  // Prisma unique-constraint violation
  if (err.code === 'P2002') {
    const field = err.meta?.target?.[0] || 'value';
    return res.status(409).json({ error: `That ${field} is already in use` });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Not found' });
  }
  if (err.name === 'ZodError') {
    return res.status(422).json({
      error: 'Some fields need attention',
      fields: Object.fromEntries(err.issues.map((i) => [i.path.join('.'), i.message])),
    });
  }

  const status = err.status || 500;
  if (status >= 500) console.error('[error]', err);

  res.status(status).json({
    error: status >= 500 ? 'Something went wrong on our side' : err.message,
  });
}

/** Wrap async handlers so a rejected promise reaches errorHandler. */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
