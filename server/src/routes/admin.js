const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { authenticate, authorize } = require("../middleware/auth");
const controller = require("../controllers/authController");

const router = express.Router();

router.get("/users", authenticate, authorize("admin"), asyncHandler(controller.listUsers));

module.exports = router;
