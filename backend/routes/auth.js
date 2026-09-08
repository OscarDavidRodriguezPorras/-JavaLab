const express = require("express");
const router = express.Router();
const controller = require("../controllers/authController");
const { asyncHandler } = require("../middleware/errorHandler");

router.post("/register", asyncHandler(controller.register));
router.post("/login", asyncHandler(controller.login));

module.exports = router;