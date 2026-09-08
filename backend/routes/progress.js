const express = require("express");
const router = express.Router();
const controller = require("../controllers/progressController");
const { asyncHandler } = require("../middleware/errorHandler");

router.get("/", asyncHandler(controller.getProgress));

module.exports = router;
