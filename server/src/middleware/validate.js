const { validationResult } = require("express-validator");

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Invalid request.",
      errors: errors.array().map(({ path, param, msg, location }) => ({
        field: path || param,
        location,
        message: msg,
      })),
    });
  }
  return next();
}

module.exports = validate;
