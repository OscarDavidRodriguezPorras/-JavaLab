const express = require("express");
const router = express.Router();
const controller = require("../controllers/imagesController");
const { asyncHandler } = require("../middleware/errorHandler");
 
router.get("/:fileId", asyncHandler(controller.serve));
 
module.exports = router;