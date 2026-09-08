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
    totalExercisesCompleted: 0,
    updatedAt: new Date().toISOString(),
  };
}

async function getProgress(userId) {
  const existing = await drive.readJson("progress", `${userId}_progress.json`);
  return existing || emptyProgress(userId);
}

async function saveProgress(progress) {
  progress.updatedAt = new Date().toISOString();
  await drive.writeJson("progress", `${progress.userId}_progress.json`, progress);
  return progress;
}

/**
 * Registra el resultado de un ejercicio: actualiza progreso por tema,
 * debilidades detectadas, XP y racha del usuario.
 */
async function recordExerciseResult({ userId, exercise, validation, hintsUsed = 0 }) {
  const progress = await getProgress(userId);

  const topics = exercise.topics && exercise.topics.length ? exercise.topics : ["General"];
  for (const topic of topics) {
    if (!progress.topics[topic]) {
      progress.topics[topic] = { completed: 0, correct: 0, errors: 0, percent: 0 };
    }
    const t = progress.topics[topic];
    t.completed += 1;
    if (validation.passed) t.correct += 1;
    else t.errors += 1;
    t.percent = Math.round((t.correct / t.completed) * 100);
  }

  if (!validation.passed) {
    // Registrar conceptos fallidos como debilidades para recomendaciones futuras.
    const failedConcepts =
      (exercise.requiredConcepts || [])
        .map((c) => c.name)
        .filter((name) => name && !validation.matchedConcepts.includes(name)) || [];
    const conceptsToTrack = failedConcepts.length ? failedConcepts : topics;
    for (const concept of conceptsToTrack) {
      progress.weaknesses[concept] = (progress.weaknesses[concept] || 0) + 1;
    }
  }

  progress.totalExercisesCompleted += validation.passed ? 1 : 0;
  await saveProgress(progress);

  // Actualizar XP / nivel / racha del usuario.
  const usersService = require("./usersService");
  let xpGained = 0;
  let user = null;
  if (validation.passed) {
    const baseXp = xpForDifficulty(exercise.difficulty);
    const penalty = Math.min(hintsUsed * HINT_PENALTY_PER_HINT, 0.45);
    xpGained = Math.round(baseXp * (1 - penalty));
    user = await usersService.addXp(userId, xpGained);
    user = await usersService.touchStreak(userId);
  }

  return { progress, xpGained, user };
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
  topWeaknesses,
  xpForDifficulty,
  levelForXp,
  LEVELS,
};
