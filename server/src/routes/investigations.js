const express = require("express");
const { body, param, query } = require("express-validator");
const asyncHandler = require("../middleware/asyncHandler");
const validate = require("../middleware/validate");
const { authenticate, authorize } = require("../middleware/auth");
const { STATUSES } = require("../services/investigationService");
const controller = require("../controllers/investigationController");

const router = express.Router();
router.use(authenticate, authorize("admin", "analyst"));

router.get(
  "/",
  [
    query("status").optional().isIn(STATUSES),
    query("assignedTo").optional().isMongoId(),
    validate,
  ],
  asyncHandler(controller.list)
);
router.post(
  "/",
  [
    body("transactionId").isMongoId(),
    body("notes").optional().isString().trim().isLength({ max: 2000 }),
    validate,
  ],
  asyncHandler(controller.create)
);
router.patch(
  "/:id",
  [
    param("id").isMongoId(),
    body("status").optional().isIn(STATUSES),
    body("assignedTo").optional({ nullable: true }).isMongoId(),
    body().custom(
      (value) =>
        Object.prototype.hasOwnProperty.call(value || {}, "status") ||
        Object.prototype.hasOwnProperty.call(value || {}, "assignedTo")
    )
      .withMessage("Provide a status or assignedTo field."),
    validate,
  ],
  asyncHandler(controller.update)
);
router.post(
  "/:id/notes",
  [
    param("id").isMongoId(),
    body("text").isString().trim().isLength({ min: 1, max: 2000 }),
    validate,
  ],
  asyncHandler(controller.addNote)
);

module.exports = router;
