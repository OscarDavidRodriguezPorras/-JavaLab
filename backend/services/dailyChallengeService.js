const drive = require("./googleDrive");

const TEMPLATES = [
  {
    title: "Datos personales",
    description: "Crea un programa que solicite el nombre, la edad y la estatura del usuario, y luego muestre los tres datos.",
    requirements: ["Usar JOptionPane.showInputDialog para cada dato", "Mostrar los tres datos con System.out.println"],
    requiredConcepts: [{ name: "JOptionPane", pattern: "JOptionPane\\.showInputDialog", message: "Usa JOptionPane.showInputDialog para pedir los datos." }],
    starterCode:
      'import javax.swing.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        String nombre = JOptionPane.showInputDialog("Nombre:");\n        // Completa: pide edad y estatura, y muestra los tres datos\n    }\n}',
    testInputs: ["Oscar", "20", "1.75"],
    hints: [
      "Necesitas 3 llamadas a JOptionPane.showInputDialog, una por cada dato.",
      "Guarda cada resultado en una variable String antes de mostrarlo.",
      'Ejemplo: System.out.println("Nombre: " + nombre);',
    ],
  },
  {
    title: "Par o impar",
    description: "Solicita un número entero y determina si es par o impar.",
    requirements: ["Convertir el texto ingresado a int con Integer.parseInt", "Usar el operador % para decidir si es par o impar", "Mostrar el resultado"],
    requiredConcepts: [
      { name: "parseInt", pattern: "Integer\\.parseInt", message: "Convierte el texto ingresado a número con Integer.parseInt." },
      { name: "modulo", pattern: "%", message: "Usa el operador % (módulo) para saber si el número es par o impar." },
    ],
    starterCode:
      'import javax.swing.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        String texto = JOptionPane.showInputDialog("Número:");\n        int numero = Integer.parseInt(texto);\n        // Completa: determina si numero es par o impar\n    }\n}',
    testInputs: ["7"],
    hints: [
      "Un número es par si el resto de dividirlo entre 2 es 0.",
      "Usa el operador % así: numero % 2",
      "if (numero % 2 == 0) { ... } else { ... }",
    ],
  },
  {
    title: "Suma de un rango",
    description: "Solicita un número entero n y suma todos los números del 1 al n usando un ciclo.",
    requirements: ["Usar un ciclo for o while", "Acumular la suma en una variable", "Mostrar el resultado final"],
    requiredConcepts: [{ name: "ciclo", pattern: "for\\s*\\(|while\\s*\\(", message: "Usa un ciclo for o while para recorrer del 1 al n." }],
    starterCode:
      'import javax.swing.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        String texto = JOptionPane.showInputDialog("n:");\n        int n = Integer.parseInt(texto);\n        int suma = 0;\n        // Completa el ciclo que acumula la suma\n        System.out.println("Suma: " + suma);\n    }\n}',
    testInputs: ["5"],
    hints: [
      "Necesitas una variable acumuladora que empiece en 0.",
      "Recorre desde 1 hasta n con un ciclo, sumando cada valor a la acumuladora.",
      "for (int i = 1; i <= n; i++) { suma += i; }",
    ],
  },
];

function todayKey() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function pickTemplate() {
  const idx = Number(todayKey()) % TEMPLATES.length;
  return TEMPLATES[idx];
}

/** Devuelve el ejercicio del reto de hoy, creándolo en Drive la primera vez que se pide (idempotente por día). */
async function getTodayChallenge() {
  const id = `daily_${todayKey()}`;
  const existing = await drive.readJson("exercises", `${id}.json`);
  if (existing) return existing;

  const template = pickTemplate();
  const exercise = {
    id,
    title: `🔥 Reto del día: ${template.title}`,
    type: "write_code",
    difficulty: "medium",
    topics: ["Reto diario"],
    description: template.description,
    requirements: template.requirements,
    hints: template.hints,
    requiredConcepts: template.requiredConcepts,
    testInputs: template.testInputs,
    starterCode: template.starterCode,
    xp: 100,
    isDaily: true,
    createdAt: new Date().toISOString(),
  };
  await drive.writeJson("exercises", `${id}.json`, exercise);
  return exercise;
}

module.exports = { getTodayChallenge };
