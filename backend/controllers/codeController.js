const codeRunner = require("../services/codeRunner");
const { HttpError } = require("../middleware/errorHandler");

async function run(req, res) {
  const { code, inputs } = req.body;
  if (typeof code !== "string") throw new HttpError(400, "code es requerido", "VALIDATION_ERROR");
  res.json(codeRunner.execute(code, { inputs: inputs || [] }));
}

module.exports = { run };
