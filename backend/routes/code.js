const express = require("express");
const router = express.Router();
const controller = require("../controllers/codeController");
const { asyncHandler } = require("../middleware/errorHandler");

router.post("/run", asyncHandler(controller.run));

module.exports = router;
