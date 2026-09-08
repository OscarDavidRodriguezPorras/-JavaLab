const express = require("express");
const router = express.Router();
const controller = require("../controllers/usersController");
const { asyncHandler } = require("../middleware/errorHandler");

router.get("/:id", asyncHandler(controller.getUser));
router.put("/:id", asyncHandler(controller.updateUser));

module.exports = router;
