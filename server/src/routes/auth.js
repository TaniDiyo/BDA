const express = require("express");
const { body } = require("express-validator");
const rateLimit = require("express-rate-limit");
const asyncHandler = require("../middleware/asyncHandler");
const validate = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const controller = require("../controllers/authController");

const router = express.Router();
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler(req, res) {
    return res.status(429).json({
      success: false,
      message: "Too many login attempts. Try again later.",
      errors: [],
    });
  },
});
const signupRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler(req, res) {
    return res.status(429).json({
      success: false,
      message: "Too many signup attempts. Try again later.",
      errors: [],
    });
  },
});

const emailNormalizationOptions = {
  gmail_remove_dots: false,
  gmail_remove_subaddress: false,
};

router.post(
  "/login",
  loginRateLimit,
  [
    body("email")
      .isEmail()
      .withMessage("Enter a valid email address.")
      .normalizeEmail(emailNormalizationOptions),
    body("password").isString().isLength({ min: 1 }).withMessage("Password is required."),
    validate,
  ],
  asyncHandler(controller.login)
);
router.post(
  "/signup",
  signupRateLimit,
  [
    body("name").isString().trim().isLength({ min: 1, max: 100 }),
    body("email")
      .isEmail()
      .withMessage("Enter a valid email address.")
      .normalizeEmail(emailNormalizationOptions),
    body("password").isString().isLength({ min: 12, max: 128 }),
    validate,
  ],
  asyncHandler(controller.signup)
);
router.get("/me", authenticate, asyncHandler(controller.me));

module.exports = router;
