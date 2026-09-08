/**
 * sandbox/miniJavaInterpreter.js
 *
 * NOTA IMPORTANTE SOBRE ALCANCE (ver sección 9 del spec original):
 * Ejecutar Java real de forma segura requiere un compilador/JVM aislado
 * (normalmente un contenedor Docker efímero, sin red, con límites de CPU/RAM).
 * Eso no se puede garantizar dentro de este backend Node tal cual.
 *
 * Para que el MVP tenga una experiencia de "Ejecutar" real y útil sin
 * arriesgar el servidor, este módulo implementa un intérprete propio de un
 * SUBCONJUNTO de Java (variables, tipos primitivos, operadores, if/else,
 * for/while, System.out.print/println, JOptionPane.showInputDialog,
 * Integer.parseInt/Float.parseFloat/Double.parseDouble).
 *
 * Es 100% seguro: no usa eval(), no usa child_process, no toca el sistema
 * de archivos ni la red. Es un parser + evaluador escrito a mano sobre un
 * AST propio, con límites estrictos de pasos, tiempo y tamaño de salida.
 *
 * MIGRACIÓN FUTURA A JAVA REAL (dejar preparado, no implementado aquí):
 *   1. Contenedor Docker con imagen "eclipse-temurin:21-jdk" sin red.
 *   2. Montar el código como Main.java en un volumen temporal de solo ese contenedor.
 *   3. Ejecutar `javac Main.java && java -Xmx64m -Xss8m Main` con `timeout 5s`.
 *   4. Limitar CPU/memoria con `--memory=64m --cpus=0.5 --network=none --read-only`.
 *   5. Capturar stdout/stderr con límite de bytes y destruir el contenedor siempre (try/finally).
 *   backend/services/codeRunner.js ya está separado para que ese cambio no
 *   toque rutas ni controladores: solo se reemplaza su interior.
 */

const MAX_STEPS = 200000;
const MAX_OUTPUT_CHARS = 8000;
const MAX_LOOP_ITERATIONS = 100000;

class JavaRuntimeError extends Error {}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

const TOKEN_SPEC = [
  ["WHITESPACE", /^\s+/],
  ["COMMENT_LINE", /^\/\/[^\n]*/],
  ["COMMENT_BLOCK", /^\/\*[\s\S]*?\*\//],
  ["STRING", /^"(?:\\.|[^"\\])*"/],
  ["CHAR", /^'(?:\\.|[^'\\])'/],
  ["NUMBER", /^\d+\.\d+[fFdD]?|^\d+[lL]?/],
  ["IDENT", /^[A-Za-z_][A-Za-z0-9_]*/],
  ["OP", /^(==|!=|<=|>=|&&|\|\||\+\+|--|\+=|-=|\*=|\/=|[+\-*/%=<>!(){}\[\];,.])/],
];

function tokenize(source) {
  let pos = 0;
  const tokens = [];
  while (pos < source.length) {
    const chunk = source.slice(pos);
    let matched = false;
    for (const [type, regex] of TOKEN_SPEC) {
      const m = regex.exec(chunk);
      if (m) {
        matched = true;
        pos += m[0].length;
        if (type !== "WHITESPACE" && type !== "COMMENT_LINE" && type !== "COMMENT_BLOCK") {
          tokens.push({ type, value: m[0] });
        }
        break;
      }
    }
    if (!matched) {
      throw new JavaRuntimeError(`Carácter inesperado en el código: '${chunk[0]}'`);
    }
  }
  tokens.push({ type: "EOF", value: null });
  return tokens;
}

// ---------------------------------------------------------------------------
// Parser -> AST (recursive descent). Soporta un subconjunto deliberadamente
// pequeño: es suficiente para ejercicios de variables, condicionales, ciclos
// y operaciones con System.out / JOptionPane / parseo de números.
// ---------------------------------------------------------------------------

const TYPE_KEYWORDS = new Set(["int", "double", "float", "boolean", "String", "char", "long", "short", "byte", "var"]);

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.i = 0;
  }

  peek(offset = 0) {
    return this.tokens[this.i + offset];
  }
  next() {
    return this.tokens[this.i++];
  }
  check(type, value) {
    const t = this.peek();
    if (t.type !== type) return false;
    if (value !== undefined && t.value !== value) return false;
    return true;
  }
  expect(type, value) {
    if (!this.check(type, value)) {
      const t = this.peek();
      throw new JavaRuntimeError(
        `Se esperaba ${value ? `'${value}'` : type} pero se encontró '${t.value ?? "fin de archivo"}'`
      );
    }
    return this.next();
  }

  parseProgram() {
    // Ignora deliberadamente 'import ...;', 'public class X {' y el '}' final,
    // y localiza el cuerpo de 'public static void main(String[] args) { ... }'.
    // Esto deja al estudiante escribir código con la forma real de un archivo
    // Main.java, aunque el intérprete solo ejecute lo que hay dentro de main().
    const src = this.tokens;
    // Busca el primer bloque { ... } que venga después de "main".
    let idx = this.tokens.findIndex((t) => t.type === "IDENT" && t.value === "main");
    if (idx === -1) {
      // Si no hay método main explícito, se interpreta el archivo completo
      // como una secuencia de sentencias sueltas (modo "script").
      this.i = 0;
      return this.parseStatementsUntilEOF();
    }
    // Avanza hasta la primera '{' después de 'main'
    let j = idx;
    while (j < this.tokens.length && this.tokens[j].value !== "{") j++;
    this.i = j + 1;
    const body = this.parseBlockStatements();
    return body;
  }

  parseStatementsUntilEOF() {
    const stmts = [];
    while (!this.check("EOF")) stmts.push(this.parseStatement());
    return stmts;
  }

  parseBlockStatements() {
    const stmts = [];
    let depth = 1;
    while (depth > 0 && !this.check("EOF")) {
      if (this.check("OP", "}")) {
        depth--;
        this.next();
        if (depth === 0) break;
        continue;
      }
      stmts.push(this.parseStatement());
    }
    return stmts;
  }

  parseBlock() {
    this.expect("OP", "{");
    return this.parseBlockStatements();
  }

  parseStatement() {
    // Declaración de variable: tipo nombre [= expr];
    if (this.check("IDENT") && TYPE_KEYWORDS.has(this.peek().value) && this.peek(1).type === "IDENT") {
      const type = this.next().value;
      const name = this.expect("IDENT").value;
      let init = null;
      if (this.check("OP", "=")) {
        this.next();
        init = this.parseExpression();
      }
      this.expect("OP", ";");
      return { kind: "VarDecl", varType: type, name, init };
    }

    if (this.check("IDENT", "if")) return this.parseIf();
    if (this.check("IDENT", "for")) return this.parseFor();
    if (this.check("IDENT", "while")) return this.parseWhile();

    if (this.check("OP", "{")) return { kind: "Block", body: this.parseBlock() };

    // Expresión suelta (asignación, llamada, ++/--) terminada en ';'
    const expr = this.parseExpression();
    this.expect("OP", ";");
    return { kind: "ExprStatement", expr };
  }

  parseIf() {
    this.expect("IDENT", "if");
    this.expect("OP", "(");
    const cond = this.parseExpression();
    this.expect("OP", ")");
    const thenBranch = this.check("OP", "{") ? this.parseBlock() : [this.parseStatement()];
    let elseBranch = null;
    if (this.check("IDENT", "else")) {
      this.next();
      elseBranch = this.check("IDENT", "if") ? [this.parseIf()] : this.check("OP", "{") ? this.parseBlock() : [this.parseStatement()];
    }
    return { kind: "If", cond, thenBranch, elseBranch };
  }

  parseFor() {
    this.expect("IDENT", "for");
    this.expect("OP", "(");
    const init = this.check("OP", ";") ? null : this.parseForInit();
    this.expect("OP", ";");
    const cond = this.check("OP", ";") ? null : this.parseExpression();
    this.expect("OP", ";");
    const update = this.check("OP", ")") ? null : this.parseExpression();
    this.expect("OP", ")");
    const body = this.check("OP", "{") ? this.parseBlock() : [this.parseStatement()];
    return { kind: "For", init, cond, update, body };
  }

  parseForInit() {
    if (this.check("IDENT") && TYPE_KEYWORDS.has(this.peek().value)) {
      const type = this.next().value;
      const name = this.expect("IDENT").value;
      this.expect("OP", "=");
      const init = this.parseExpression();
      return { kind: "VarDecl", varType: type, name, init };
    }
    return { kind: "ExprStatement", expr: this.parseExpression() };
  }

  parseWhile() {
    this.expect("IDENT", "while");
    this.expect("OP", "(");
    const cond = this.parseExpression();
    this.expect("OP", ")");
    const body = this.check("OP", "{") ? this.parseBlock() : [this.parseStatement()];
    return { kind: "While", cond, body };
  }

  // ---- Expresiones (precedencia ascendente) ----

  parseExpression() {
    return this.parseAssignment();
  }

  parseAssignment() {
    const left = this.parseLogicalOr();
    if (this.check("OP") && ["=", "+=", "-=", "*=", "/="].includes(this.peek().value)) {
      const op = this.next().value;
      const right = this.parseAssignment();
      return { kind: "Assign", op, target: left, value: right };
    }
    return left;
  }

  parseLogicalOr() {
    let left = this.parseLogicalAnd();
    while (this.check("OP", "||")) {
      this.next();
      left = { kind: "Logical", op: "||", left, right: this.parseLogicalAnd() };
    }
    return left;
  }

  parseLogicalAnd() {
    let left = this.parseEquality();
    while (this.check("OP", "&&")) {
      this.next();
      left = { kind: "Logical", op: "&&", left, right: this.parseEquality() };
    }
    return left;
  }

  parseEquality() {
    let left = this.parseComparison();
    while (this.check("OP") && ["==", "!="].includes(this.peek().value)) {
      const op = this.next().value;
      left = { kind: "Binary", op, left, right: this.parseComparison() };
    }
    return left;
  }

  parseComparison() {
    let left = this.parseAdditive();
    while (this.check("OP") && ["<", ">", "<=", ">="].includes(this.peek().value)) {
      const op = this.next().value;
      left = { kind: "Binary", op, left, right: this.parseAdditive() };
    }
    return left;
  }

  parseAdditive() {
    let left = this.parseMultiplicative();
    while (this.check("OP") && ["+", "-"].includes(this.peek().value)) {
      const op = this.next().value;
      left = { kind: "Binary", op, left, right: this.parseMultiplicative() };
    }
    return left;
  }

  parseMultiplicative() {
    let left = this.parseUnary();
    while (this.check("OP") && ["*", "/", "%"].includes(this.peek().value)) {
      const op = this.next().value;
      left = { kind: "Binary", op, left, right: this.parseUnary() };
    }
    return left;
  }

  parseUnary() {
    if (this.check("OP") && ["!", "-", "+"].includes(this.peek().value)) {
      const op = this.next().value;
      return { kind: "Unary", op, expr: this.parseUnary() };
    }
    if (this.check("OP", "++") || this.check("OP", "--")) {
      const op = this.next().value;
      const target = this.parseUnary();
      return { kind: "PreIncDec", op, target };
    }
    return this.parsePostfix();
  }

  parsePostfix() {
    let expr = this.parsePrimary();
    for (;;) {
      if (this.check("OP", ".")) {
        this.next();
        const prop = this.expect("IDENT").value;
        expr = { kind: "Member", object: expr, property: prop };
      } else if (this.check("OP", "(")) {
        this.next();
        const args = [];
        if (!this.check("OP", ")")) {
          args.push(this.parseExpression());
          while (this.check("OP", ",")) {
            this.next();
            args.push(this.parseExpression());
          }
        }
        this.expect("OP", ")");
        expr = { kind: "Call", callee: expr, args };
      } else if (this.check("OP", "++") || this.check("OP", "--")) {
        const op = this.next().value;
        expr = { kind: "PostIncDec", op, target: expr };
      } else {
        break;
      }
    }
    return expr;
  }

  parsePrimary() {
    const t = this.peek();
    if (t.type === "NUMBER") {
      this.next();
      const isFloat = /[.fFdD]/.test(t.value);
      const clean = t.value.replace(/[fFdDlL]$/, "");
      return { kind: "Literal", value: isFloat ? parseFloat(clean) : parseInt(clean, 10), isFloat };
    }
    if (t.type === "STRING") {
      this.next();
      return { kind: "Literal", value: JSON.parse(t.value), isString: true };
    }
    if (t.type === "CHAR") {
      this.next();
      return { kind: "Literal", value: t.value.slice(1, -1), isString: true };
    }
    if (t.type === "IDENT" && (t.value === "true" || t.value === "false")) {
      this.next();
      return { kind: "Literal", value: t.value === "true" };
    }
    if (t.type === "IDENT") {
      this.next();
      return { kind: "Ident", name: t.value };
    }
    if (this.check("OP", "(")) {
      this.next();
      const expr = this.parseExpression();
      this.expect("OP", ")");
      return expr;
    }
    throw new JavaRuntimeError(`Expresión inválida cerca de '${t.value ?? "fin de archivo"}'`);
  }
}

// ---------------------------------------------------------------------------
// Interpreter
// ---------------------------------------------------------------------------

class Interpreter {
  constructor({ inputs = [] } = {}) {
    this.output = [];
    this.steps = 0;
    this.inputIndex = 0;
    this.inputs = inputs;
    this.scopes = [new Map()];
  }

  tick() {
    this.steps++;
    if (this.steps > MAX_STEPS) {
      throw new JavaRuntimeError("Se excedió el número máximo de operaciones. ¿Hay un ciclo infinito?");
    }
    if (this.output.join("").length > MAX_OUTPUT_CHARS) {
      throw new JavaRuntimeError("La salida es demasiado grande (límite de seguridad alcanzado).");
    }
  }

  push() {
    this.scopes.push(new Map());
  }
  pop() {
    this.scopes.pop();
  }
  declare(name, value) {
    this.scopes[this.scopes.length - 1].set(name, value);
  }
  find(name) {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (this.scopes[i].has(name)) return this.scopes[i];
    }
    return null;
  }
  get(name) {
    const scope = this.find(name);
    if (!scope) throw new JavaRuntimeError(`Variable no definida: '${name}'`);
    return scope.get(name);
  }
  set(name, value) {
    const scope = this.find(name) || this.scopes[this.scopes.length - 1];
    scope.set(name, value);
  }

  run(statements) {
    for (const stmt of statements) this.execStatement(stmt);
    return this.output.join("");
  }

  execStatement(stmt) {
    this.tick();
    switch (stmt.kind) {
      case "VarDecl": {
        const value = stmt.init ? this.evalExpr(stmt.init) : defaultForType(stmt.varType);
        this.declare(stmt.name, value);
        return;
      }
      case "ExprStatement":
        this.evalExpr(stmt.expr);
        return;
      case "Block":
        this.push();
        for (const s of stmt.body) this.execStatement(s);
        this.pop();
        return;
      case "If": {
        if (truthy(this.evalExpr(stmt.cond))) {
          this.push();
          for (const s of stmt.thenBranch) this.execStatement(s);
          this.pop();
        } else if (stmt.elseBranch) {
          this.push();
          for (const s of stmt.elseBranch) this.execStatement(s);
          this.pop();
        }
        return;
      }
      case "For": {
        this.push();
        if (stmt.init) this.execStatement(stmt.init);
        let iterations = 0;
        while (stmt.cond ? truthy(this.evalExpr(stmt.cond)) : true) {
          iterations++;
          if (iterations > MAX_LOOP_ITERATIONS) {
            throw new JavaRuntimeError("El ciclo 'for' superó el máximo de iteraciones permitidas.");
          }
          this.push();
          for (const s of stmt.body) this.execStatement(s);
          this.pop();
          if (stmt.update) this.evalExpr(stmt.update);
          this.tick();
        }
        this.pop();
        return;
      }
      case "While": {
        let iterations = 0;
        while (truthy(this.evalExpr(stmt.cond))) {
          iterations++;
          if (iterations > MAX_LOOP_ITERATIONS) {
            throw new JavaRuntimeError("El ciclo 'while' superó el máximo de iteraciones permitidas.");
          }
          this.push();
          for (const s of stmt.body) this.execStatement(s);
          this.pop();
          this.tick();
        }
        return;
      }
      default:
        throw new JavaRuntimeError(`Sentencia no soportada en este subconjunto: ${stmt.kind}`);
    }
  }

  evalExpr(expr) {
    this.tick();
    switch (expr.kind) {
      case "Literal":
        return expr.value;
      case "Ident":
        return this.get(expr.name);
      case "Assign": {
        const value = this.computeAssignValue(expr);
        if (expr.target.kind !== "Ident") {
          throw new JavaRuntimeError("Solo se pueden asignar variables simples en este subconjunto.");
        }
        this.set(expr.target.name, value);
        return value;
      }
      case "PreIncDec":
      case "PostIncDec": {
        if (expr.target.kind !== "Ident") throw new JavaRuntimeError("++/-- solo soportado sobre variables.");
        const old = this.get(expr.target.name);
        const updated = expr.op === "++" ? old + 1 : old - 1;
        this.set(expr.target.name, updated);
        return expr.kind === "PreIncDec" ? updated : old;
      }
      case "Unary": {
        const v = this.evalExpr(expr.expr);
        if (expr.op === "-") return -v;
        if (expr.op === "+") return +v;
        if (expr.op === "!") return !truthy(v);
        break;
      }
      case "Logical": {
        const left = this.evalExpr(expr.left);
        if (expr.op === "&&") return truthy(left) ? truthy(this.evalExpr(expr.right)) : false;
        return truthy(left) ? true : truthy(this.evalExpr(expr.right));
      }
      case "Binary":
        return this.evalBinary(expr);
      case "Member": {
        // Solo se reconocen rutas conocidas: System.out, Integer, Double, Float, Math
        if (expr.object.kind === "Ident") {
          return { __namespace: expr.object.name, __member: expr.property };
        }
        if (expr.object.kind === "Member") {
          const inner = this.evalExpr(expr.object);
          return { __namespace: `${inner.__namespace}.${inner.__member}`, __member: expr.property };
        }
        throw new JavaRuntimeError("Acceso a miembro no soportado.");
      }
      case "Call":
        return this.evalCall(expr);
      default:
        throw new JavaRuntimeError(`Expresión no soportada: ${expr.kind}`);
    }
  }

  computeAssignValue(expr) {
    if (expr.op === "=") return this.evalExpr(expr.value);
    const current = this.get(expr.target.name);
    const rhs = this.evalExpr(expr.value);
    switch (expr.op) {
      case "+=":
        return typeof current === "string" ? current + rhs : current + rhs;
      case "-=":
        return current - rhs;
      case "*=":
        return current * rhs;
      case "/=":
        return current / rhs;
      default:
        throw new JavaRuntimeError(`Operador de asignación no soportado: ${expr.op}`);
    }
  }

  evalBinary(expr) {
    const left = this.evalExpr(expr.left);
    const right = this.evalExpr(expr.right);
    switch (expr.op) {
      case "+":
        return typeof left === "string" || typeof right === "string"
          ? `${javaToString(left)}${javaToString(right)}`
          : left + right;
      case "-":
        return left - right;
      case "*":
        return left * right;
      case "/":
        if (Number.isInteger(left) && Number.isInteger(right)) {
          if (right === 0) throw new JavaRuntimeError("ArithmeticException: / by zero");
          return Math.trunc(left / right);
        }
        return left / right;
      case "%":
        return left % right;
      case "<":
        return left < right;
      case ">":
        return left > right;
      case "<=":
        return left <= right;
      case ">=":
        return left >= right;
      case "==":
        return left === right;
      case "!=":
        return left !== right;
      default:
        throw new JavaRuntimeError(`Operador no soportado: ${expr.op}`);
    }
  }

  evalCall(expr) {
    const callee = expr.callee;
    const args = expr.args.map((a) => this.evalExpr(a));

    if (callee.kind === "Member") {
      const obj = callee.object;
      // System.out.println / print
      if (obj.kind === "Member" && obj.object.kind === "Ident" && obj.object.name === "System" && obj.property === "out") {
        if (callee.property === "println") {
          this.output.push(`${args.map(javaToString).join(" ")}\n`);
          return null;
        }
        if (callee.property === "print") {
          this.output.push(args.map(javaToString).join(" "));
          return null;
        }
      }
      // JOptionPane.showInputDialog / showMessageDialog
      if (obj.kind === "Ident" && obj.name === "JOptionPane") {
        if (callee.property === "showInputDialog") {
          const value = this.inputs[this.inputIndex] !== undefined ? String(this.inputs[this.inputIndex]) : "";
          this.inputIndex++;
          return value;
        }
        if (callee.property === "showMessageDialog") {
          this.output.push(`${javaToString(args[args.length - 1])}\n`);
          return null;
        }
      }
      // Integer / Float / Double parsing
      if (obj.kind === "Ident" && ["Integer", "Float", "Double", "Long", "Short", "Byte"].includes(obj.name)) {
        if (callee.property === "parseInt") return parseJavaInt(args[0]);
        if (callee.property === "parseFloat" || callee.property === "parseDouble") return parseJavaFloat(args[0]);
        if (callee.property === "toString") return javaToString(args[0]);
        if (callee.property === "valueOf") return args[0];
      }
      if (obj.kind === "Ident" && obj.name === "Math") {
        const fn = callee.property;
        if (fn === "abs") return Math.abs(args[0]);
        if (fn === "max") return Math.max(args[0], args[1]);
        if (fn === "min") return Math.min(args[0], args[1]);
        if (fn === "pow") return Math.pow(args[0], args[1]);
        if (fn === "sqrt") return Math.sqrt(args[0]);
        if (fn === "round") return Math.round(args[0]);
        if (fn === "random") return Math.random();
      }
      if (callee.property === "length" && typeof this.tryEvalReceiver(obj) === "string") {
        return this.tryEvalReceiver(obj).length;
      }
      if (callee.property === "equals") {
        const receiver = this.evalExpr(obj);
        return receiver === args[0];
      }
      if (callee.property === "toUpperCase") return String(this.evalExpr(obj)).toUpperCase();
      if (callee.property === "toLowerCase") return String(this.evalExpr(obj)).toLowerCase();
      if (callee.property === "trim") return String(this.evalExpr(obj)).trim();
    }

    throw new JavaRuntimeError(
      "Esta versión del editor soporta un subconjunto de Java (variables, if/for/while, System.out, JOptionPane, " +
        "Integer/Float/Double parse, Math). El resto llegará cuando se conecte un sandbox con JDK real."
    );
  }

  tryEvalReceiver(obj) {
    try {
      return this.evalExpr(obj);
    } catch {
      return undefined;
    }
  }
}

function defaultForType(type) {
  if (type === "int" || type === "long" || type === "short" || type === "byte") return 0;
  if (type === "double" || type === "float") return 0.0;
  if (type === "boolean") return false;
  return null;
}

function truthy(v) {
  return Boolean(v);
}

function javaToString(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

function parseJavaInt(v) {
  const n = parseInt(String(v).trim(), 10);
  if (Number.isNaN(n)) throw new JavaRuntimeError(`NumberFormatException: For input string: "${v}"`);
  return n;
}

function parseJavaFloat(v) {
  const n = parseFloat(String(v).trim());
  if (Number.isNaN(n)) throw new JavaRuntimeError(`NumberFormatException: For input string: "${v}"`);
  return n;
}

/**
 * Ejecuta código Java (subconjunto soportado) y devuelve { success, output, error }.
 * Nunca lanza: cualquier error de parseo/ejecución se captura y se devuelve como texto,
 * imitando lo que vería el estudiante en una consola real.
 */
function runJavaSubset(code, { inputs = [] } = {}) {
  const startedAt = Date.now();
  try {
    const tokens = tokenize(code);
    const ast = new Parser(tokens).parseProgram();
    const interpreter = new Interpreter({ inputs });
    const output = interpreter.run(ast);
    return { success: true, output, error: null, durationMs: Date.now() - startedAt };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: err instanceof JavaRuntimeError ? err.message : `Error interno: ${err.message}`,
      durationMs: Date.now() - startedAt,
    };
  }
}

module.exports = { runJavaSubset, JavaRuntimeError };
