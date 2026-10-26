class AppError extends Error {
  constructor(status, message, errors = []) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

function notFound(req, res) {
  return res.status(404).json({
    success: false,
    message: "Route not found.",
    errors: [],
  });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      message: "Request body must contain valid JSON.",
      errors: [],
    });
  }
  if (error.name === "ValidationError" || error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "The request contains invalid data.",
      errors: Object.values(error.errors || {}).map((item) => ({
        field: item.path,
        message: item.message,
      })),
    });
  }
  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "A record with that unique value already exists.",
      errors: [],
    });
  }

  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) console.error("Unhandled request error:", error);
  return res.status(status).json({
    success: false,
    message: status >= 500 ? "Internal server error." : error.message,
    errors: error.errors || [],
  });
}

module.exports = { AppError, notFound, errorHandler };
