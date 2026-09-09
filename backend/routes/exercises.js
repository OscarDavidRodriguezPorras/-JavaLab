const express = require("express");
const router = express.Router();
const controller = require("../controllers/exercisesController");
const { asyncHandler } = require("../middleware/errorHandler");

router.get("/", asyncHandler(controller.listExercises));
router.get("/daily/today", asyncHandler(controller.getTodayChallenge));
router.get("/:id", asyncHandler(controller.getExercise));
router.post("/:id/run", asyncHandler(controller.runCode));
router.post("/:id/submit", asyncHandler(controller.submit));
router.post("/:id/reset-submission", asyncHandler(controller.resetSubmission));

module.exports = router;