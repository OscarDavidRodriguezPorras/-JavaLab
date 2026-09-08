let editorInstance = null;
let currentExercise = null;
let hintLevel = 0;

(async function main() {
  await initPage("exercises"); // resalta "Ejercicios" en el sidebar aunque estemos en /editor

  const params = new URLSearchParams(location.search);
  const exerciseId = params.get("exercise");

  if (!exerciseId) {
    document.getElementById("exercise-header").innerHTML = `<p class="empty-state">No se indicó ningún ejercicio. <a href="/pages/exercises.html">Volver a ejercicios →</a></p>`;
    return;
  }

  try {
    currentExercise = await api.exercises.get(exerciseId);
  } catch (err) {
    document.getElementById("exercise-header").innerHTML = `<p class="empty-state">${err.message}</p>`;
    return;
  }

  renderExerciseHeader();
  initMonaco();
  wireButtons();
})();

function renderExerciseHeader() {
  const ex = currentExercise;
  document.getElementById("exercise-header").innerHTML = `
    <div style="display:flex; gap:10px; margin-bottom:10px; flex-wrap:wrap;">
      <span class="chip chip--${ex.difficulty}">${ex.difficulty}</span>
      <span class="chip" style="color:var(--accent-amber); border-color: rgba(255,200,87,.3);">+${ex.xp} XP</span>
      ${(ex.topics || []).map((t) => `<span class="chip">${t}</span>`).join("")}
    </div>
    <h1 style="font-size:20px;">${escapeHtml(ex.title)}</h1>
    <p style="color: var(--text-secondary); max-width: 640px; margin:0;">${escapeHtml(ex.description || "")}</p>
  `;

  document.getElementById("requirements-list").innerHTML = (ex.requirements || [])
    .map((r) => `<li style="margin-bottom:5px;">${escapeHtml(r)}</li>`)
    .join("") || `<li>Sin requisitos específicos registrados.</li>`;
}

function initMonaco() {
  require.config({ paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.49.0/min/vs" } });
  require(["vs/editor/editor.main"], () => {
    const starter =
      currentExercise.starterCode ||
      'public class Main {\n    public static void main(String[] args) {\n        // Escribe tu código aquí\n    }\n}';
    editorInstance = monaco.editor.create(document.getElementById("monaco-container"), {
      value: starter,
      language: "java",
      theme: "vs-dark",
      fontSize: 13.5,
      fontFamily: "'JetBrains Mono', monospace",
      minimap: { enabled: false },
      automaticLayout: true,
      scrollBeyondLastLine: false,
    });
  });
}

function wireButtons() {
  document.getElementById("run-btn").addEventListener("click", runCode);
  document.getElementById("verify-btn").addEventListener("click", verifyCode);
  document.getElementById("reset-btn").addEventListener("click", resetCode);
  document.getElementById("next-hint-btn").addEventListener("click", requestHint);
  document.getElementById("show-solution-btn").addEventListener("click", showSolutionInfo);
}

function getCode() {
  return editorInstance ? editorInstance.getValue() : "";
}

function writeConsole(html) {
  document.getElementById("console").innerHTML = html;
}

async function runCode() {
  const btn = document.getElementById("run-btn");
  btn.disabled = true;
  writeConsole("Ejecutando…");
  try {
    const result = await api.exercises.run(currentExercise.id, { code: getCode(), inputs: currentExercise.testInputs });
    if (result.success) {
      writeConsole(`<span class="ok">✔ Ejecución correcta</span>\n\n${escapeHtml(result.output) || "(sin salida)"}`);
    } else {
      writeConsole(`<span class="err">✖ ${escapeHtml(result.error)}</span>${result.output ? `\n\n${escapeHtml(result.output)}` : ""}`);
    }
  } catch (err) {
    writeConsole(`<span class="err">✖ ${escapeHtml(err.message)}</span>`);
  } finally {
    btn.disabled = false;
  }
}

async function verifyCode() {
  const btn = document.getElementById("verify-btn");
  btn.disabled = true;
  btn.textContent = "Verificando…";
  try {
    const result = await api.exercises.submit(currentExercise.id, {
      code: getCode(),
      userId: JavaLab.user.id,
      hintsUsed: hintLevel,
    });
    renderFeedback(result);
    if (result.validation.output) {
      writeConsole(escapeHtml(result.validation.output));
    }
    if (result.user) {
      JavaLab.user = result.user;
      renderTopbarUser();
    }
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "✓ Verificar";
  }
}

function renderFeedback(result) {
  const card = document.getElementById("feedback-card");
  card.style.display = "block";
  const { validation, xpGained } = result;

  if (validation.passed) {
    card.innerHTML = `
      <h3 style="color: var(--accent-green); font-size:14px; margin-bottom:8px;">✅ ¡Correcto!</h3>
      <p style="font-size:13px; color:var(--text-secondary); margin-bottom:10px;">Tu solución cumple con los requisitos del ejercicio.</p>
      <span class="chip" style="color:var(--accent-amber); border-color: rgba(255,200,87,.3);">+${xpGained} XP ganados</span>
    `;
    showToast(`¡Ejercicio resuelto! +${xpGained} XP`, "success");
  } else {
    card.innerHTML = `
      <h3 style="color: var(--accent-coral); font-size:14px; margin-bottom:8px;">❌ Hay un problema</h3>
      <p style="font-size:13px; color:var(--text-secondary); margin-bottom:8px;">Encontramos lo siguiente:</p>
      <ul style="font-size:13px; color:var(--text-secondary); padding-left:18px; margin:0;">
        ${validation.issues.map((issue) => `<li style="margin-bottom:6px;">${escapeHtml(issue)}</li>`).join("")}
      </ul>
    `;
  }
}

function resetCode() {
  if (!editorInstance) return;
  if (!confirm("¿Reiniciar el código a la versión inicial? Perderás tus cambios.")) return;
  editorInstance.setValue(
    currentExercise.starterCode || 'public class Main {\n    public static void main(String[] args) {\n        \n    }\n}'
  );
  document.getElementById("feedback-card").style.display = "none";
  writeConsole("// La salida de tu programa aparecerá aquí.");
}

async function requestHint() {
  const maxHints = (currentExercise.hints || []).length;
  if (hintLevel >= maxHints) {
    showToast("No hay más pistas para este ejercicio.", "error");
    return;
  }
  hintLevel += 1;
  try {
    const result = await api.ai.hint({ exerciseId: currentExercise.id, hintLevel });
    const container = document.getElementById("hints-container");
    const block = document.createElement("div");
    block.className = "hint-block";
    block.textContent = `💡 Pista ${hintLevel}: ${result.hint}`;
    container.appendChild(block);
    document.getElementById("hint-count").textContent = `${hintLevel}/${maxHints}`;
    if (hintLevel >= maxHints) {
      document.getElementById("show-solution-btn").classList.remove("hidden");
      document.getElementById("next-hint-btn").classList.add("hidden");
    }
  } catch (err) {
    hintLevel -= 1;
    showToast(err.message, "error");
  }
}

function showSolutionInfo() {
  const container = document.getElementById("hints-container");
  const block = document.createElement("div");
  block.className = "hint-block";
  block.style.color = "var(--text-primary)";
  block.innerHTML =
    "Ya usaste las 3 pistas disponibles. JavaLab no muestra soluciones completas automáticamente para fomentar que llegues por tu cuenta — " +
    'pero puedes pedirle ayuda puntual al <a href="/pages/tutor.html">Tutor IA</a> compartiéndole tu código actual.';
  container.appendChild(block);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}
