const express = require("express");
const router = express.Router();
const controller = require("../controllers/projectsController");
const { asyncHandler } = require("../middleware/errorHandler");

router.get("/", asyncHandler(controller.listProjects));
router.get("/:id", asyncHandler(controller.getProject));

module.exports = router;
