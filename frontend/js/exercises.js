let allExercises = [];

const TYPE_LABELS = {
  write_code: "✍️ Escribir código",
  find_error: "🔍 Detectar errores",
  complete_code: "🧩 Completar código",
  what_prints: "🖨️ ¿Qué imprime?",
  order_code: "🔀 Ordenar código",
};

(async function main() {
  await initPage("exercises");

  const params = new URLSearchParams(location.search);
  const topicParam = params.get("topic");

  await refreshExercises();
  if (topicParam) {
    document.getElementById("topic-filter").value = topicParam;
    renderExercises();
  }

  document.getElementById("topic-filter").addEventListener("change", renderExercises);
  document.getElementById("difficulty-filter").addEventListener("change", renderExercises);
  document.getElementById("generate-btn").addEventListener("click", () => {
    document.getElementById("generate-modal").classList.remove("hidden");
  });
  document.getElementById("generate-modal-close").addEventListener("click", () => {
    document.getElementById("generate-modal").classList.add("hidden");
  });
  document.getElementById("generate-form").addEventListener("submit", generateExercises);
})();

async function refreshExercises() {
  const list = document.getElementById("exercises-list");
  list.innerHTML = `<p class="empty-state">Cargando ejercicios…</p>`;
  try {
    allExercises = await api.exercises.list();
    populateTopicFilter();
    renderExercises();
  } catch (err) {
    list.innerHTML = `<p class="empty-state">${err.message}</p>`;
  }
}

function populateTopicFilter() {
  const select = document.getElementById("topic-filter");
  const current = select.value;
  const topics = Array.from(new Set(allExercises.flatMap((e) => e.topics || [])));
  select.innerHTML = `<option value="">Todos los temas</option>` + topics.map((t) => `<option value="${t}">${t}</option>`).join("");
  select.value = current;
}

function renderExercises() {
  const list = document.getElementById("exercises-list");
  const topic = document.getElementById("topic-filter").value;
  const difficulty = document.getElementById("difficulty-filter").value;

  const filtered = allExercises.filter((e) => {
    const matchesTopic = !topic || (e.topics || []).includes(topic);
    const matchesDifficulty = !difficulty || e.difficulty === difficulty;
    return matchesTopic && matchesDifficulty;
  });

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;">No hay ejercicios todavía. Usa "🤖 Generar ejercicios" para crear tus primeros.</div>`;
    return;
  }

  list.innerHTML = filtered
    .map(
      (ex) => `
    <a class="card" href="/pages/editor.html?exercise=${ex.id}" style="display:block;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
        <span class="chip chip--${ex.difficulty}">${ex.difficulty}</span>
        <span class="chip" style="color:var(--accent-amber); border-color: rgba(255,200,87,.3);">+${ex.xp} XP</span>
      </div>
      <h3 style="font-size: 15px; margin-bottom: 6px;">${escapeHtml(ex.title)}</h3>
      <p style="color:var(--text-muted); font-size:12px; margin: 0 0 8px;">${TYPE_LABELS[ex.type] || ex.type}</p>
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        ${(ex.topics || []).map((t) => `<span class="chip">${t}</span>`).join("")}
      </div>
    </a>`
    )
    .join("");
}

async function generateExercises(e) {
  e.preventDefault();
  const topics = document
    .getElementById("gen-topics")
    .value.split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const difficulty = document.getElementById("gen-difficulty").value;
  const count = Number(document.getElementById("gen-count").value) || 5;

  const btn = document.getElementById("generate-submit-btn");
  btn.disabled = true;
  btn.textContent = "Generando...";

  try {
    const result = await api.ai.generateExercises({ topics, difficulty, count, userId: JavaLab.user.id });
    showToast(
      result.source === "ai"
        ? `${result.exercises.length} ejercicios generados con IA ✨`
        : `${result.exercises.length} ejercicios generados (modo local, sin AI_API_KEY configurada)`,
      "success"
    );
    document.getElementById("generate-modal").classList.add("hidden");
    await refreshExercises();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Generar";
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
