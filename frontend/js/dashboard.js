(async function main() {
  await initPage("dashboard");
  const user = JavaLab.user;

  document.getElementById("greeting").textContent = `¡Hola, ${user.name.split(" ")[0]}! 👋`;
  document.getElementById("hero-stats").innerHTML = `
    <div class="stat-pill">🔥 <strong>${user.streak || 0}</strong> días de racha</div>
    <div class="stat-pill">⭐ <strong>${user.xp || 0}</strong> XP</div>
    <div class="stat-pill">🏆 Nivel <strong>${user.level || 1}</strong></div>
  `;

  loadDailyChallenge();
  loadProgress(user.id);
  loadRecentNotes(user.id);
})();

async function loadDailyChallenge() {
  const el = document.getElementById("daily-challenge");
  try {
    const exercise = await api.exercises.today();
    el.innerHTML = `
      <h3 style="margin-bottom:10px;">${exercise.title.replace("🔥 Reto del día: ", "")}</h3>
      <ol style="color: var(--text-secondary); font-size: 13.5px; padding-left: 18px; margin: 0 0 16px;">
        ${(exercise.requirements || []).map((s) => `<li style="margin-bottom:4px;">${s}</li>`).join("")}
      </ol>
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <span class="chip" style="color: var(--accent-amber); border-color: rgba(255,200,87,.3);">+${exercise.xp} XP</span>
        <a href="/pages/editor.html?exercise=${exercise.id}" class="btn btn--primary btn--sm">Resolver reto</a>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<p class="empty-state">${err.message}</p>`;
  }
}

async function loadProgress(userId) {
  const el = document.getElementById("progress-overview");
  try {
    const progress = await api.progress.get(userId);
    const topics = Object.entries(progress.topics || {});
    if (topics.length === 0) {
      el.innerHTML = `<p class="empty-state">Aún no tienes ejercicios registrados. ¡Resuelve tu primer ejercicio para ver tu progreso aquí!</p>`;
      return;
    }
    const overallPct = Math.round(topics.reduce((sum, [, t]) => sum + t.percent, 0) / topics.length);
    el.innerHTML = `
      <div style="margin-bottom:14px;">
        <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
          <span style="color:var(--text-secondary);">General</span><span class="mono">${overallPct}%</span>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${overallPct}%"></div></div>
      </div>
      ${topics
        .map(
          ([name, t]) => `
        <div class="topic-row">
          <span class="topic-row__name">${name}</span>
          <div class="progress-track"><div class="progress-fill" style="width:${t.percent}%"></div></div>
          <span class="topic-row__pct">${t.percent}%</span>
        </div>`
        )
        .join("")}
    `;
  } catch (err) {
    el.innerHTML = `<p class="empty-state">No se pudo cargar el progreso: ${err.message}</p>`;
  }
}

async function loadRecentNotes(userId) {
  const el = document.getElementById("recent-notes");
  const recEl = document.getElementById("recommendation");
  try {
    const notes = await api.notes.list({ userId });
    if (notes.length === 0) {
      el.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;">Todavía no has creado apuntes. <a href="/pages/notes.html">Crea el primero →</a></div>`;
    } else {
      el.innerHTML = notes
        .slice(0, 3)
        .map(
          (n) => `
        <a class="card" href="/pages/note-editor.html?id=${n.id}" style="display:block;">
          <span class="chip">${n.category}</span>
          <h3 style="margin: 10px 0 6px; font-size: 15px;">${escapeHtml(n.title)}</h3>
          <p style="color:var(--text-muted); font-size:12.5px; margin:0;">${new Date(n.updatedAt).toLocaleDateString("es")}</p>
        </a>`
        )
        .join("");
    }

    const progress = await api.progress.get(userId);
    const weaknesses = progress.topWeaknesses || [];
    if (weaknesses.length === 0) {
      recEl.innerHTML = `<p class="empty-state">Aún no detectamos áreas débiles. ¡Sigue practicando!</p>`;
    } else {
      const top = weaknesses[0];
      recEl.innerHTML = `
        <p style="margin: 0 0 12px; color: var(--text-secondary); font-size: 13.5px;">
          Parece que necesitas practicar más <strong style="color:var(--text-primary);">${top.concept}</strong>
          (${top.count} ${top.count === 1 ? "error" : "errores"} recientes).
        </p>
        <a class="btn btn--primary btn--sm" href="/pages/exercises.html?topic=${encodeURIComponent(top.concept)}">Practicar ahora</a>
      `;
    }
  } catch (err) {
    el.innerHTML = `<p class="empty-state">${err.message}</p>`;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
