const usersService = require("../services/usersService");
const { HttpError } = require("../middleware/errorHandler");
 
async function getUser(req, res) {
  const user = await usersService.getUser(req.params.id);
  if (!user) throw new HttpError(404, `Usuario ${req.params.id} no encontrado`, "USER_NOT_FOUND");
  res.json(user);
}
 
async function updateUser(req, res) {
  const user = await usersService.updateUser(req.params.id, req.body);
  if (!user) throw new HttpError(404, `Usuario ${req.params.id} no encontrado`, "USER_NOT_FOUND");
  res.json(user);
}
 
module.exports = { getUser, updateUser };
