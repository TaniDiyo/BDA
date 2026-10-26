const express = require("express");
const { param, query } = require("express-validator");
const asyncHandler = require("../middleware/asyncHandler");
const validate = require("../middleware/validate");
const { authenticate, authorize } = require("../middleware/auth");
const controller = require("../controllers/transactionController");

const router = express.Router();
const models = ["logistic_regression", "random_forest"];

router.get(
  "/",
  authenticate,
  authorize("admin", "analyst"),
  [
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
    query("model").optional().isIn(models),
    query("predictedLabel").optional().isIn(["0", "1"]),
    query("predictedFraud").optional().isIn(["true", "false"]),
    query("riskScoreMin").optional().isFloat({ min: 0, max: 1 }).toFloat(),
    query("riskScoreMax").optional().isFloat({ min: 0, max: 1 }).toFloat(),
    query("minProbability").optional().isFloat({ min: 0, max: 1 }).toFloat(),
    query("maxProbability").optional().isFloat({ min: 0, max: 1 }).toFloat(),
    query("amountMin").optional().isFloat({ min: 0 }).toFloat(),
    query("amountMax").optional().isFloat({ min: 0 }).toFloat(),
    query("startDate").optional().isISO8601(),
    query("endDate").optional().isISO8601(),
    query("search").optional().isString().trim().isLength({ max: 80 }),
    query("sortBy").optional().isIn(["riskScore", "createdAt", "amount"]),
    query("sortOrder").optional().isIn(["asc", "desc"]),
    validate,
  ],
  asyncHandler(controller.list)
);

router.get(
  "/:id",
  authenticate,
  authorize("admin", "analyst"),
  [param("id").isMongoId(), validate],
  asyncHandler(controller.getById)
);

module.exports = router;
