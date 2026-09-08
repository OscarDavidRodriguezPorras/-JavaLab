const progressService = require("../services/progressService");
const { HttpError } = require("../middleware/errorHandler");

async function getProgress(req, res) {
  const { userId } = req.query;
  if (!userId) throw new HttpError(400, "userId es requerido", "VALIDATION_ERROR");
  const progress = await progressService.getProgress(userId);
  const weaknesses = progressService.topWeaknesses(progress);
  res.json({ ...progress, topWeaknesses: weaknesses });
}

module.exports = { getProgress };
