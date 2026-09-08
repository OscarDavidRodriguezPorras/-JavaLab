const drive = require("./googleDrive");
const { generateId } = require("../utils/id");

const DEFAULT_PROJECTS = [
  {
    title: "Calculadora",
    emoji: "🟢",
    difficulty: "easy",
    topics: ["variables", "operadores", "condicionales"],
    description: "Construye una calculadora de consola que sume, reste, multiplique y divida dos números.",
    estimatedTime: "1-2 horas",
  },
  {
    title: "Sistema de notas",
    emoji: "🟡",
    difficulty: "medium",
    topics: ["arrays", "ciclos", "metodos"],
    description: "Registra las notas de varios estudiantes en un arreglo y calcula promedios y el mejor puntaje.",
    estimatedTime: "3-4 horas",
  },
  {
    title: "Sistema de biblioteca",
    emoji: "🔴",
    difficulty: "hard",
    topics: ["poo", "clases", "objetos", "arraylist"],
    description: "Modela libros y usuarios con clases, y gestiona préstamos y devoluciones con un ArrayList.",
    estimatedTime: "5-8 horas",
  },
];

async function ensureSeeded() {
  const existing = await drive.listJson("projects");
  if (existing.length > 0) return;
  for (const p of DEFAULT_PROJECTS) {
    const project = { id: generateId("project"), ...p, createdAt: new Date().toISOString() };
    await drive.writeJson("projects", `${project.id}.json`, project);
  }
}

async function listProjects() {
  await ensureSeeded();
  return drive.listJson("projects");
}

async function getProject(id) {
  return drive.readJson("projects", `${id}.json`);
}

module.exports = { listProjects, getProject };
