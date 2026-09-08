const codeRunner = require("./codeRunner");

/**
 * Mensajes para errores frecuentes de estudiantes de Java. Se buscan por
 * patrón en el código fuente ANTES de ejecutar, para poder dar una pista
 * concreta incluso cuando el error del intérprete es genérico.
 */
const COMMON_MISTAKES = [
  {
    pattern: /\.ParseFloat\s*\(/,
    concept: "parseFloat",
    message: "Encontramos `.ParseFloat()`. Java distingue entre mayúsculas y minúsculas: el método correcto es `parseFloat()`, con 'p' minúscula.",
  },
  {
    pattern: /\.ParseInt\s*\(/,
    concept: "parseInt",
    message: "Encontramos `.ParseInt()`. El método correcto es `parseInt()`, con 'p' minúscula (Java distingue mayúsculas de minúsculas).",
  },
  {
    pattern: /\.ParseDouble\s*\(/,
    concept: "parseDouble",
    message: "Encontramos `.ParseDouble()`. El método correcto es `parseDouble()`, con 'p' minúscula.",
  },
  {
    pattern: /if\s*\(\s*\w+\s*==\s*"/,
    concept: "string-equals",
    message: "Estás comparando un String con `==`. En Java, para comparar el CONTENIDO de dos textos se usa `.equals()`, no `==`.",
  },
  {
    pattern: /System\.out\.println\s*\(.*\)\s*[^;{]\s*$/m,
    concept: "missing-semicolon",
    message: "Revisa que cada instrucción termine en punto y coma `;`.",
  },
];

/**
 * Valida un envío de ejercicio.
 *
 * exercise: { requiredConcepts?: [{pattern, message}], expectedOutput?, testInputs?, requirements: [] }
 * submittedCode: string con el código Java del estudiante
 *
 * Devuelve: { passed, compiled, output, error, issues: [string], matchedConcepts: [string] }
 */
function validate(exercise, submittedCode) {
  const issues = [];
  const matchedConcepts = [];

  // 1. Detección temprana de errores comunes por patrón (da pistas específicas
  //    incluso si el intérprete solo diría "variable no definida").
  for (const mistake of COMMON_MISTAKES) {
    if (mistake.pattern.test(submittedCode)) {
      issues.push(mistake.message);
    }
  }

  // 2. Ejecutar el código en el sandbox.
  const runResult = codeRunner.execute(submittedCode, { inputs: exercise.testInputs || [] });

  if (!runResult.success) {
    issues.push(`El programa no se ejecutó correctamente: ${runResult.error}`);
    return {
      passed: false,
      compiled: false,
      output: runResult.output || "",
      error: runResult.error,
      issues,
      matchedConcepts,
    };
  }

  // 3. Verificar conceptos requeridos (presencia de ciertas construcciones en el código fuente).
  const requiredConcepts = exercise.requiredConcepts || [];
  for (const concept of requiredConcepts) {
    const regex = new RegExp(concept.pattern);
    if (regex.test(submittedCode)) {
      matchedConcepts.push(concept.name || concept.pattern);
    } else {
      issues.push(concept.message || `Tu solución debería usar: ${concept.name || concept.pattern}`);
    }
  }
  const allConceptsMatched = requiredConcepts.every((c) => matchedConcepts.includes(c.name || c.pattern));

  // 4. Verificar salida esperada si el ejercicio la define (ejercicios tipo "¿qué imprime?" o con caso de prueba fijo).
  let outputMatches = true;
  if (typeof exercise.expectedOutput === "string") {
    const normalize = (s) => s.trim().replace(/\r\n/g, "\n").replace(/\s+$/gm, "");
    outputMatches = normalize(runResult.output) === normalize(exercise.expectedOutput);
    if (!outputMatches) {
      issues.push("El programa corrió sin errores, pero la salida no coincide con lo esperado. Revisa el resultado con atención.");
    }
  }

  const passed = allConceptsMatched && outputMatches && issues.length === 0;

  return {
    passed,
    compiled: true,
    output: runResult.output,
    error: null,
    issues,
    matchedConcepts,
  };
}

module.exports = { validate };
