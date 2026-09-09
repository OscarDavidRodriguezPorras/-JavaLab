const drive = require("./googleDrive");

const XP_TABLE = { easy: 10, medium: 25, hard: 50, daily: 100, project: 250 };
const HINT_PENALTY_PER_HINT = 0.15; // -15% de XP por cada pista usada, hasta -45%
const LEVELS = [
  { level: 1, name: "Novato", minXp: 0 },
  { level: 2, name: "Aprendiz", minXp: 200 },
  { level: 3, name: "Programador", minXp: 600 },
  { level: 4, name: "Developer", minXp: 1500 },
  { level: 5, name: "Java Master", minXp: 3000 },
];

function xpForDifficulty(difficulty) {
  return XP_TABLE[difficulty] ?? XP_TABLE.easy;
}

function levelForXp(xp) {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (xp >= l.minXp) current = l;
  }
  return current;
}

function emptyProgress(userId) {
  return {
    userId,
    topics: {}, // { "Variables": { completed: 0, correct: 0, errors: 0, percent: 0 } }
    weaknesses: {}, // { "parseInt": 4, "if/else": 2 }
    completedExercises: {}, // { "exercise_abc123": { xp, code, completedAt } } — evita re-ganar XP y guarda la solución
    totalExercisesCompleted: 0,
    updatedAt: new Date().toISOString(),
  };
}

async function getProgress(userId) {
  const existing = await drive.readJson("progress", `${userId}_progress.json`);
  if (!existing) return emptyProgress(userId);
  if (!existing.completedExercises) existing.completedExercises = {};
  return existing;
}

async function saveProgress(progress) {
  progress.updatedAt = new Date().toISOString();
  await drive.writeJson("progress", `${progress.userId}_progress.json`, progress);
  return progress;
}

/** Lee la entrada de completado sin importar si quedó en el formato viejo (solo número) o el nuevo (objeto). */
function readCompletionXp(entry) {
  if (entry == null) return 0;
  return typeof entry === "number" ? entry : entry.xp || 0;
}

/**
 * Registra el resultado de un ejercicio: actualiza progreso por tema,
 * debilidades detectadas, XP y racha del usuario.
 *
 * Si el usuario ya había aprobado este mismo ejercicio antes, NO se vuelve
 * a sumar XP ni a contar en el progreso, sin importar cuántas veces le dé a
 * "Verificar" ni si sale y vuelve a entrar. Solo "Repetir" (undoExerciseCompletion)
 * libera el ejercicio para poder ganar XP de nuevo.
 */
async function recordExerciseResult({ userId, exercise, validation, hintsUsed = 0, code = "" }) {
  const progress = await getProgress(userId);
  const alreadyCompleted = Boolean(validation.passed && progress.completedExercises[exercise.id]);

  const topics = exercise.topics && exercise.topics.length ? exercise.topics : ["General"];
  for (const topic of topics) {
    if (!progress.topics[topic]) {
      progress.topics[topic] = { completed: 0, correct: 0, errors: 0, percent: 0 };
    }
    const t = progress.topics[topic];
    if (validation.passed) {
      if (!alreadyCompleted) {
        t.completed += 1;
        t.correct += 1;
        t.percent = Math.round((t.correct / t.completed) * 100);
      }
    } else {
      t.completed += 1;
      t.errors += 1;
      t.percent = Math.round((t.correct / t.completed) * 100);
    }
  }

  if (!validation.passed) {
    const failedConcepts =
      (exercise.requiredConcepts || [])
        .map((c) => c.name)
        .filter((name) => name && !validation.matchedConcepts.includes(name)) || [];
    const conceptsToTrack = failedConcepts.length ? failedConcepts : topics;
    for (const concept of conceptsToTrack) {
      progress.weaknesses[concept] = (progress.weaknesses[concept] || 0) + 1;
    }
  }

  const usersService = require("./usersService");
  let xpGained = 0;
  let user = null;

  if (validation.passed && !alreadyCompleted) {
    progress.totalExercisesCompleted += 1;
    const baseXp = xpForDifficulty(exercise.difficulty);
    const penalty = Math.min(hintsUsed * HINT_PENALTY_PER_HINT, 0.45);
    xpGained = Math.round(baseXp * (1 - penalty));
    progress.completedExercises[exercise.id] = { xp: xpGained, code, completedAt: new Date().toISOString() };
    user = await usersService.addXp(userId, xpGained);
    user = await usersService.touchStreak(userId);
  } else {
    user = await usersService.getUser(userId);
  }

  await saveProgress(progress);
  return { progress, xpGained, user, alreadyCompleted };
}

/**
 * Deshace la aprobación de un ejercicio: le quita el XP ganado, revierte el
 * conteo de ese tema en el progreso, y libera el ejercicio para poder
 * volver a ganar XP la próxima vez que lo apruebe. Se llama cuando el
 * estudiante le da "Reiniciar" en el editor sobre un ejercicio ya completado.
 */
async function undoExerciseCompletion({ userId, exerciseId }) {
  const usersService = require("./usersService");
  const progress = await getProgress(userId);

  const entry = progress.completedExercises[exerciseId];
  const xpToRemove = readCompletionXp(entry);
  if (!entry || !xpToRemove) {
    return { progress, user: await usersService.getUser(userId), reverted: false, xpRemoved: 0 };
  }

  delete progress.completedExercises[exerciseId];
  progress.totalExercisesCompleted = Math.max(0, (progress.totalExercisesCompleted || 0) - 1);

  const exercisesService = require("./exercisesService");
  const exercise = await exercisesService.getExercise(exerciseId);
  const topics = exercise && exercise.topics && exercise.topics.length ? exercise.topics : ["General"];
  for (const topic of topics) {
    const t = progress.topics[topic];
    if (t) {
      t.completed = Math.max(0, t.completed - 1);
      t.correct = Math.max(0, t.correct - 1);
      t.percent = t.completed > 0 ? Math.round((t.correct / t.completed) * 100) : 0;
    }
  }
  await saveProgress(progress);

  const user = await usersService.getUser(userId);
  const newXp = Math.max(0, (user.xp || 0) - xpToRemove);
  const newLevel = levelForXp(newXp).level;
  const updatedUser = await usersService.updateUser(userId, { xp: newXp, level: newLevel });

  return { progress, user: updatedUser, reverted: true, xpRemoved: xpToRemove };
}

/** Devuelve las 5 debilidades más frecuentes, para la pantalla de recomendaciones. */
function topWeaknesses(progress, limit = 5) {
  return Object.entries(progress.weaknesses)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([concept, count]) => ({ concept, count }));
}

module.exports = {
  getProgress,
  saveProgress,
  recordExerciseResult,
  undoExerciseCompletion,
  topWeaknesses,
  xpForDifficulty,
  levelForXp,
  LEVELS,
};