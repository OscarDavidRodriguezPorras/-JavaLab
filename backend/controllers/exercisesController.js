const exercisesService = require("../services/exercisesService");
const dailyChallengeService = require("../services/dailyChallengeService");
const codeValidator = require("../services/codeValidator");
const codeRunner = require("../services/codeRunner");
const progressService = require("../services/progressService");
const aiService = require("../services/aiService");
const { HttpError } = require("../middleware/errorHandler");

async function listExercises(req, res) {
  const { topic, difficulty } = req.query;
  const exercises = await exercisesService.listExercises({ topic, difficulty });
  res.json(exercises);
}

async function getExercise(req, res) {
  const exercise = await exercisesService.getExercise(req.params.id);
  if (!exercise) throw new HttpError(404, `Ejercicio ${req.params.id} no encontrado`, "EXERCISE_NOT_FOUND");
  res.json(exercise);
}

/** POST /api/exercises/:id/run — solo ejecuta el código y devuelve la salida, sin calificar. */
async function runCode(req, res) {
  const exercise = await exercisesService.getExercise(req.params.id);
  if (!exercise) throw new HttpError(404, `Ejercicio ${req.params.id} no encontrado`, "EXERCISE_NOT_FOUND");

  const { code, inputs } = req.body;
  if (typeof code !== "string") throw new HttpError(400, "code es requerido", "VALIDATION_ERROR");

  const result = codeRunner.execute(code, { inputs: inputs || exercise.testInputs || [] });
  res.json(result);
}

/** POST /api/exercises/:id/submit — ejecuta, valida contra los requisitos y actualiza progreso/XP. */
async function submit(req, res) {
  const exercise = await exercisesService.getExercise(req.params.id);
  if (!exercise) throw new HttpError(404, `Ejercicio ${req.params.id} no encontrado`, "EXERCISE_NOT_FOUND");

  const { code, userId, hintsUsed } = req.body;
  if (typeof code !== "string" || !userId) throw new HttpError(400, "code y userId son requeridos", "VALIDATION_ERROR");

  const validation = codeValidator.validate(exercise, code);
  const { progress, xpGained, user } = await progressService.recordExerciseResult({
    userId,
    exercise,
    validation,
    hintsUsed: Number(hintsUsed) || 0,
  });

  res.json({ validation, xpGained, user, topicsProgress: progress.topics });
}

/** POST /api/ai/generate-exercises */
async function generate(req, res) {
  const { topics, difficulty, count, userId } = req.body;
  if (!topics || !topics.length) throw new HttpError(400, "topics es requerido", "VALIDATION_ERROR");

  const notesService = require("../services/notesService");
  const userConcepts = userId ? await notesService.conceptsForUser(userId) : [];

  const { source, exercises } = await aiService.generateExercises({
    topics,
    difficulty: difficulty || "easy",
    count: Math.min(Number(count) || 5, 10),
    userConcepts,
  });

  const saved = await exercisesService.saveGeneratedExercises(exercises);
  res.status(201).json({ source, exercises: saved });
}

async function getTodayChallenge(req, res) {
  const exercise = await dailyChallengeService.getTodayChallenge();
  res.json(exercise);
}

module.exports = { listExercises, getExercise, runCode, submit, generate, getTodayChallenge };
