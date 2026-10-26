const express = require("express");
const { query } = require("express-validator");
const asyncHandler = require("../middleware/asyncHandler");
const validate = require("../middleware/validate");
const { authenticate, authorize } = require("../middleware/auth");
const controller = require("../controllers/analyticsController");
const modelController = require("../controllers/modelController");

const router = express.Router();
router.use(authenticate, authorize("admin", "analyst"));

router.get("/summary", asyncHandler(controller.summary));
// Keep the previous dashboard route while model metrics also have their own resource URL.
router.get("/metrics", asyncHandler(modelController.metrics));
router.get(
  "/fraud-over-time",
  [
    query("interval").optional().isIn(["hour", "day"]),
    validate,
  ],
  asyncHandler(controller.fraudOverTime)
);
router.get("/risk-distribution", asyncHandler(controller.riskDistribution));
router.get(
  "/top-risky",
  [query("limit").optional().isInt({ min: 1, max: 100 }).toInt(), validate],
  asyncHandler(controller.topRisky)
);

module.exports = router;
