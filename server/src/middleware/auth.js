const jwt = require("jsonwebtoken");

function authenticate(req, res, next) {
  const authorization = req.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
      errors: [],
    });
  }
  if (!process.env.JWT_SECRET) {
    return next(new Error("JWT_SECRET must be configured before authenticating requests."));
  }
  try {
    req.user = jwt.verify(match[1], process.env.JWT_SECRET, {
      algorithms: ["HS256"],
      maxAge: process.env.JWT_EXPIRES_IN || "8h",
    });
    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired access token.",
        errors: [],
      });
    }
    return next(error);
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action.",
        errors: [],
      });
    }
    return next();
  };
}

module.exports = {
  authenticate,
  authorize,
  requireAuth: authenticate,
  requireRole: authorize,
};
