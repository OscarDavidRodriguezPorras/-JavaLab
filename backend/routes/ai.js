const express = require("express");
const router = express.Router();
const exercisesController = require("../controllers/exercisesController");
const aiController = require("../controllers/aiController");
const { asyncHandler } = require("../middleware/errorHandler");

router.post("/generate-exercises", asyncHandler(exercisesController.generate));
router.post("/explain-error", asyncHandler(aiController.explainError));
router.post("/hint", asyncHandler(aiController.hint));
router.post("/tutor", asyncHandler(aiController.tutor));

module.exports = router;
