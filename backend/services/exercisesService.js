const drive = require("./googleDrive");
const { generateId } = require("../utils/id");

function fileName(id) {
  return `${id}.json`;
}

async function listExercises({ topic, difficulty } = {}) {
  let exercises = await drive.listJson("exercises");
  if (topic) exercises = exercises.filter((e) => (e.topics || []).some((t) => t.toLowerCase() === topic.toLowerCase()));
  if (difficulty) exercises = exercises.filter((e) => e.difficulty === difficulty);
  return exercises.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getExercise(id) {
  return drive.readJson("exercises", fileName(id));
}

async function saveGeneratedExercises(exercisesData) {
  const saved = [];
  for (const data of exercisesData) {
    const exercise = {
      id: generateId("exercise"),
      title: data.title,
      type: data.type || "write_code",
      difficulty: data.difficulty || "easy",
      topics: data.topics || [],
      description: data.description,
      requirements: data.requirements || [],
      hints: data.hints || [],
      requiredConcepts: data.requiredConcepts || [],
      expectedOutput: data.expectedOutput,
      testInputs: data.testInputs || [],
      starterCode: data.starterCode || "",
      xp: data.xp || 10,
      createdAt: new Date().toISOString(),
    };
    await drive.writeJson("exercises", fileName(exercise.id), exercise);
    saved.push(exercise);
  }
  return saved;
}

async function deleteExercise(id) {
  return drive.deleteJson("exercises", fileName(id));
}

module.exports = { listExercises, getExercise, saveGeneratedExercises, deleteExercise };
