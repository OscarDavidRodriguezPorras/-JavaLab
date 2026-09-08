/** Envuelve un controlador async para que sus errores lleguen al errorHandler central. */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/** Middleware final: convierte cualquier error en una respuesta HTTP consistente. */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(`[error] ${req.method} ${req.originalUrl} ->`, err.message);

  if (err.message && err.message.includes("Google Drive no está configurado")) {
    return res.status(503).json({
      error: "GOOGLE_DRIVE_NOT_CONFIGURED",
      message: err.message,
    });
  }

  const status = err.status || 500;
  res.status(status).json({
    error: err.code || "INTERNAL_ERROR",
    message: err.message || "Ocurrió un error inesperado.",
  });
}

function notFound(req, res) {
  res.status(404).json({ error: "NOT_FOUND", message: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

module.exports = { asyncHandler, errorHandler, notFound, HttpError };
