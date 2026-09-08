const usersService = require("../services/usersService");
const { HttpError } = require("../middleware/errorHandler");

function validatePassword(password) {
  if (!password || password.length < 6) {
    throw new HttpError(400, "La contraseña debe tener al menos 6 caracteres.", "VALIDATION_ERROR");
  }
}

async function register(req, res) {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    throw new HttpError(400, "name, email y password son requeridos", "VALIDATION_ERROR");
  }
  validatePassword(password);

  try {
    const user = await usersService.register({ name, email, password });
    res.status(201).json(user);
  } catch (err) {
    if (err.code === "EMAIL_TAKEN") {
      throw new HttpError(409, err.message, "EMAIL_TAKEN");
    }
    throw err;
  }
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new HttpError(400, "email y password son requeridos", "VALIDATION_ERROR");
  }

  const user = await usersService.login({ email, password });
  if (!user) {
    throw new HttpError(401, "Correo o contraseña incorrectos.", "INVALID_CREDENTIALS");
  }
  res.json(user);
}

module.exports = { register, login };