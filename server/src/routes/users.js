const express = require("express");
const { body } = require("express-validator");
const asyncHandler = require("../middleware/asyncHandler");
const validate = require("../middleware/validate");
const { authenticate, authorize } = require("../middleware/auth");
const controller = require("../controllers/authController");

const router = express.Router();
router.get(
  "/analysts",
  authenticate,
  authorize("admin", "analyst"),
  asyncHandler(controller.listAnalysts)
);
router.post(
  "/",
  authenticate,
  authorize("admin"),
  [
    body("name").isString().trim().isLength({ min: 1, max: 100 }),
    body("email")
      .isEmail()
      .normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false }),
    body("password").isString().isLength({ min: 12, max: 128 }),
    validate,
  ],
  asyncHandler(controller.createAnalyst)
);

module.exports = router;
