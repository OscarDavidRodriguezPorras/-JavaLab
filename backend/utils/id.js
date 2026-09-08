const { v4: uuidv4 } = require("uuid");

/** Genera un id legible tipo "note_a1b2c3d4". */
function generateId(prefix) {
  return `${prefix}_${uuidv4().split("-")[0]}`;
}

module.exports = { generateId };
