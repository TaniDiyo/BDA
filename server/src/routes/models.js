const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { authenticate, authorize } = require("../middleware/auth");
const controller = require("../controllers/modelController");

const router = express.Router();
router.use(authenticate, authorize("admin", "analyst"));
router.get("/metrics", asyncHandler(controller.metrics));
router.get("/feature-importance", asyncHandler(controller.featureImportance));

module.exports = router;
