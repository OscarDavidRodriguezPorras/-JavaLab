const projectsService = require("../services/projectsService");
const { HttpError } = require("../middleware/errorHandler");

async function listProjects(req, res) {
  res.json(await projectsService.listProjects());
}

async function getProject(req, res) {
  const project = await projectsService.getProject(req.params.id);
  if (!project) throw new HttpError(404, `Proyecto ${req.params.id} no encontrado`, "PROJECT_NOT_FOUND");
  res.json(project);
}

module.exports = { listProjects, getProject };
