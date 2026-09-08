const env = require("../config/env");

const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-4-6";

async function callClaude(systemPrompt, userPrompt, { maxTokens = 1200 } = {}) {
  if (!env.isAiConfigured()) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  const res = await fetch(env.ai.apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ai.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic API respondió ${res.status}: ${text}`);
  }

  const data = await res.json();
  const textBlock = (data.content || []).find((b) => b.type === "text");
  return textBlock ? textBlock.text : "";
}

function extractJson(text) {
  const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned);
}

// ---------------------------------------------------------------------------
// Generación de ejercicios
// ---------------------------------------------------------------------------

async function generateExercises({ topics, difficulty, count, userConcepts = [] }) {
  if (env.isAiConfigured()) {
    try {
      const system =
        "Eres un generador de ejercicios de programación en Java para principiantes. " +
        "Respondes ÚNICAMENTE con un array JSON válido, sin texto adicional ni backticks. " +
        "Cada ejercicio debe usar EXCLUSIVAMENTE los conceptos que el estudiante ya conoce " +
        "(los que se listan en 'conceptos ya vistos'); nunca introduzcas temas más avanzados " +
        "(por ejemplo herencia, interfaces, streams o hilos) si el estudiante todavía está " +
        "aprendiendo temas básicos.";
      const userPrompt = `
Genera ${count} ejercicios de Java sobre: ${topics.join(", ")}.
Dificultad: ${difficulty}.
Conceptos ya vistos por el estudiante: ${userConcepts.length ? userConcepts.join(", ") : "(ninguno registrado aún, asume nivel principiante)"}.

Cada ejercicio debe seguir este formato JSON exacto:
[
  {
    "title": "string corto",
    "type": "write_code" | "find_error" | "complete_code" | "what_prints" | "order_code",
    "difficulty": "${difficulty}",
    "topics": ["..."],
    "description": "enunciado del ejercicio",
    "requirements": ["requisito 1", "requisito 2"],
    "hints": ["pista conceptual", "pista específica", "ejemplo similar"],
    "starterCode": "código inicial opcional o cadena vacía",
    "solutionCode": "código Java completo que resuelve el ejercicio correctamente",
    "xp": 10
  }
]`;
      const raw = await callClaude(system, userPrompt, { maxTokens: 2000 });
      return { source: "ai", exercises: extractJson(raw) };
    } catch (err) {
      console.warn(`[aiService] Fallback a generación local (${err.message})`);
    }
  }
  return { source: "local-fallback", exercises: localExerciseTemplates(topics, difficulty, count) };
}

/** Generador local de respaldo: no requiere AI_API_KEY. Cubre los temas más comunes de un curso introductorio de Java. */
function localExerciseTemplates(topics, difficulty, count) {
  const bank = {
    variables: {
      title: "Solicita y muestra la edad",
      type: "write_code",
      description: "Crea un programa que solicite la edad del usuario (como texto) y la muestre convertida a número entero.",
      requirements: ["Usar JOptionPane.showInputDialog", "Usar Integer.parseInt", "Mostrar el resultado con System.out.println"],
      hints: [
        "Piensa en cómo recibir un dato de texto del usuario.",
        "Necesitas convertir ese texto (String) a un número (int).",
        "Busca un método que empiece con 'parse' dentro de la clase Integer.",
      ],
      requiredConcepts: [
        { name: "parseInt", pattern: "Integer\\.parseInt", message: "Tu solución debería usar Integer.parseInt para convertir el texto a número." },
      ],
      starterCode: 'public class Main {\n    public static void main(String[] args) {\n        // Escribe tu código aquí\n    }\n}',
    },
    condicionales: {
      title: "¿Es mayor de edad?",
      type: "write_code",
      description: "Declara una variable entera 'edad' y muestra 'Mayor de edad' si es mayor o igual a 18, o 'Menor de edad' en caso contrario.",
      requirements: ["Usar una variable int", "Usar if / else", "Imprimir el resultado con System.out.println"],
      hints: ["Piensa qué operador compara si un número es mayor o igual a otro.", "La estructura es: if (condición) { ... } else { ... }", "Ejemplo: if (edad >= 18) { ... }"],
      requiredConcepts: [{ name: "if", pattern: "if\\s*\\(", message: "Tu solución debería usar una estructura if/else." }],
      starterCode: 'public class Main {\n    public static void main(String[] args) {\n        int edad = 20;\n        // Escribe tu condición aquí\n    }\n}',
    },
    ciclos: {
      title: "Contar del 1 al 5",
      type: "write_code",
      description: "Usa un ciclo for para imprimir los números del 1 al 5, uno por línea.",
      requirements: ["Usar un ciclo for", "Imprimir cada número con System.out.println"],
      hints: ["Un ciclo for tiene tres partes: inicio, condición y actualización.", "Ejemplo: for (int i = 1; i <= 5; i++)", "Dentro del ciclo, imprime la variable i."],
      requiredConcepts: [{ name: "for", pattern: "for\\s*\\(", message: "Tu solución debería usar un ciclo for." }],
      starterCode: 'public class Main {\n    public static void main(String[] args) {\n        // Escribe tu ciclo aquí\n    }\n}',
    },
  };

  const pool = topics.map((t) => bank[normalizeTopic(t)]).filter(Boolean);
  const chosen = pool.length ? pool : [bank.variables];

  const exercises = [];
  for (let i = 0; i < count; i++) {
    const template = chosen[i % chosen.length];
    exercises.push({
      ...template,
      difficulty,
      topics: topics.length ? topics : ["General"],
      xp: { easy: 10, medium: 25, hard: 50 }[difficulty] || 10,
    });
  }
  return exercises;
}

function normalizeTopic(topic) {
  return topic
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// ---------------------------------------------------------------------------
// Explicación de errores
// ---------------------------------------------------------------------------

async function explainError({ code, error }) {
  if (env.isAiConfigured()) {
    try {
      const system =
        "Eres un tutor de Java paciente. Explicas errores de forma breve, clara y en español, " +
        "sin dar la solución completa de inmediato. Señalas el problema y sugieres cómo pensar en solucionarlo.";
      const prompt = `Código del estudiante:\n\`\`\`java\n${code}\n\`\`\`\n\nError obtenido:\n${error}\n\nExplica qué está mal y cómo podría pensar en solucionarlo, sin dar el código corregido completo.`;
      return { source: "ai", explanation: await callClaude(system, prompt, { maxTokens: 500 }) };
    } catch (err) {
      console.warn(`[aiService] Fallback a explicación local (${err.message})`);
    }
  }
  return { source: "local-fallback", explanation: localExplainError(error) };
}

function localExplainError(error) {
  if (/NumberFormatException/i.test(error)) {
    return "Ese error significa que intentaste convertir un texto a número, pero el texto no tiene el formato de un número válido. Revisa qué valor le estás pasando a parseInt/parseFloat.";
  }
  if (/no está definida/i.test(error)) {
    return "Estás usando una variable antes de declararla, o hay un error de escritura en su nombre. Revisa que el nombre coincida exactamente (Java distingue mayúsculas de minúsculas).";
  }
  if (/by zero/i.test(error)) {
    return "Estás dividiendo entre cero, lo cual no está permitido. Revisa el valor de la variable que usas como divisor.";
  }
  return `No pudimos analizar el error en detalle sin conexión a la IA, pero aquí está el mensaje original para que lo revises: ${error}`;
}

// ---------------------------------------------------------------------------
// Pistas progresivas
// ---------------------------------------------------------------------------

async function getHint({ exercise, hintLevel }) {
  const hints = exercise.hints || [];
  if (hintLevel >= 1 && hintLevel <= hints.length) {
    return { source: "exercise-data", hint: hints[hintLevel - 1], hintLevel };
  }
  return { source: "exercise-data", hint: "No hay más pistas disponibles para este ejercicio. ¡Intenta con lo que tienes o revisa la solución!", hintLevel };
}

// ---------------------------------------------------------------------------
// Tutor IA (metodología socrática, nunca entrega el código directo)
// ---------------------------------------------------------------------------

async function askTutor({ question, code, conversationHistory = [] }) {
  if (env.isAiConfigured()) {
    try {
      const system =
        "Eres el Tutor IA de JavaLab, una plataforma para aprender Java. Sigues SIEMPRE esta metodología: " +
        "1) explica el concepto relevante brevemente, 2) señala dónde podría estar el problema sin decir la solución, " +
        "3) da una pista, 4) haz una pregunta que invite al estudiante a razonar. " +
        "SOLO entregas una solución completa si el estudiante la pide explícitamente y de forma clara " +
        "(por ejemplo 'dame la solución completa'). Respondes en español, en tono cercano y alentador.";
      const historyText = conversationHistory
        .map((m) => `${m.role === "user" ? "Estudiante" : "Tutor"}: ${m.content}`)
        .join("\n");
      const prompt = `${historyText ? historyText + "\n\n" : ""}Estudiante: ${question}${code ? `\n\nCódigo actual:\n\`\`\`java\n${code}\n\`\`\`` : ""}`;
      return { source: "ai", answer: await callClaude(system, prompt, { maxTokens: 600 }) };
    } catch (err) {
      console.warn(`[aiService] Fallback a tutor local (${err.message})`);
    }
  }
  return { source: "local-fallback", answer: localTutorReply(question) };
}

function localTutorReply(question) {
  return (
    "El Tutor IA con IA real no está configurado (falta AI_API_KEY en tu .env), así que te dejo una guía general: " +
    "revisa primero el mensaje de error exacto, verifica que los nombres de métodos y variables estén escritos " +
    "correctamente (Java distingue mayúsculas y minúsculas), y confirma que cada línea termine en punto y coma. " +
    "Si me cuentas específicamente qué línea te da problemas, puedo orientarte mejor incluso en modo local."
  );
}

module.exports = { generateExercises, explainError, getHint, askTutor };
