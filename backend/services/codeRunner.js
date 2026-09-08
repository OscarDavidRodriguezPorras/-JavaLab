const { runJavaSubset } = require("../sandbox/miniJavaInterpreter");

const WALL_CLOCK_LIMIT_MS = 3000;

/**
 * Ejecuta código Java (subconjunto soportado por el sandbox) con límites de
 * tiempo, pasos y tamaño de salida. Ver sandbox/miniJavaInterpreter.js para
 * el detalle de qué se soporta y el plan de migración a un JDK real en Docker.
 */
function execute(code, { inputs = [] } = {}) {
  if (typeof code !== "string" || !code.trim()) {
    return { success: false, output: "", error: "No hay código para ejecutar." };
  }
  if (code.length > 20000) {
    return { success: false, output: "", error: "El código supera el tamaño máximo permitido (20,000 caracteres)." };
  }

  const start = Date.now();
  const result = runJavaSubset(code, { inputs });

  if (Date.now() - start > WALL_CLOCK_LIMIT_MS) {
    return { success: false, output: result.output, error: "Tiempo máximo de ejecución excedido." };
  }
  return result;
}

module.exports = { execute };
