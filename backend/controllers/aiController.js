const aiService = require("../services/aiService");
const exercisesService = require("../services/exercisesService");
const { HttpError } = require("../middleware/errorHandler");

async function explainError(req, res) {
  const { code, error } = req.body;
  if (!code || !error) throw new HttpError(400, "code y error son requeridos", "VALIDATION_ERROR");
  res.json(await aiService.explainError({ code, error }));
}

async function hint(req, res) {
  const { exerciseId, hintLevel } = req.body;
  if (!exerciseId || !hintLevel) throw new HttpError(400, "exerciseId y hintLevel son requeridos", "VALIDATION_ERROR");
  const exercise = await exercisesService.getExercise(exerciseId);
  if (!exercise) throw new HttpError(404, `Ejercicio ${exerciseId} no encontrado`, "EXERCISE_NOT_FOUND");
  res.json(await aiService.getHint({ exercise, hintLevel: Number(hintLevel) }));
}

async function tutor(req, res) {
  const { question, code, conversationHistory } = req.body;
  if (!question) throw new HttpError(400, "question es requerido", "VALIDATION_ERROR");
  res.json(await aiService.askTutor({ question, code, conversationHistory }));
}

module.exports = { explainError, hint, tutor };
