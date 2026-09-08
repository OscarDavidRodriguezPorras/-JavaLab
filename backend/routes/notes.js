const express = require("express");
const router = express.Router();
const controller = require("../controllers/notesController");
const { asyncHandler } = require("../middleware/errorHandler");

router.get("/", asyncHandler(controller.listNotes));
router.post("/", asyncHandler(controller.createNote));
router.get("/:id", asyncHandler(controller.getNote));
router.put("/:id", asyncHandler(controller.updateNote));
router.delete("/:id", asyncHandler(controller.deleteNote));
router.post("/:id/images", asyncHandler(controller.uploadImage));
router.delete("/:id/images/:fileId", asyncHandler(controller.deleteImage));

module.exports = router;