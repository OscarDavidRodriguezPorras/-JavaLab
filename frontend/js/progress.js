const ACHIEVEMENT_DEFS = [
  { key: "first_exercise", icon: "🏆", label: "Primer ejercicio", check: (p, u) => p.totalExercisesCompleted >= 1 },
  { key: "ten_exercises", icon: "🏆", label: "10 ejercicios", check: (p, u) => p.totalExercisesCompleted >= 10 },
  { key: "thousand_xp", icon: "🏆", label: "1000 XP", check: (p, u) => u.xp >= 1000 },
  { key: "week_streak", icon: "🏆", label: "7 días de racha", check: (p, u) => u.streak >= 7 },
  { key: "no_errors", icon: "🏆", label: "10 ejercicios sin errores", check: (p) => Object.values(p.topics).some((t) => t.correct >= 10 && t.errors === 0) },
];

(async function main() {
  await initPage("progress");
  const user = JavaLab.user;

  try {
    const progress = await api.progress.get(user.id);
    renderTopics(progress);
    renderAchievements(progress, user);
    renderWeaknesses(progress);
  } catch (err) {
    document.getElementById("topics-progress").innerHTML = `<p class="empty-state">${err.message}</p>`;
  }
})();

function renderTopics(progress) {
  const el = document.getElementById("topics-progress");
  const topics = Object.entries(progress.topics || {});
  if (topics.length === 0) {
    el.innerHTML = `<p class="empty-state">Aún no has resuelto ejercicios. <a href="/pages/exercises.html">Empieza aquí →</a></p>`;
    return;
  }
  el.innerHTML = topics
    .map(
      ([name, t]) => `
    <div style="margin-bottom: 16px;">
      <div style="display:flex; justify-content:space-between; font-size:13.5px; margin-bottom:6px;">
        <span>${name}</span>
        <span class="mono" style="color:var(--text-muted);">${t.percent}% · ${t.correct}/${t.completed} correctos</span>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${t.percent}%"></div></div>
    </div>`
    )
    .join("");
}

function renderAchievements(progress, user) {
  const el = document.getElementById("achievements-grid");
  el.innerHTML = ACHIEVEMENT_DEFS.map((a) => {
    const earned = a.check(progress, user);
    return `
      <div class="chip" style="flex-direction:column; align-items:center; padding:12px; gap:4px; width:90px; ${
        earned ? "opacity:1;" : "opacity:0.35;"
      }">
        <span style="font-size:22px;">${a.icon}</span>
        <span style="font-size:10.5px; text-align:center; line-height:1.3;">${a.label}</span>
      </div>`;
  }).join("");
}

function renderWeaknesses(progress) {
  const el = document.getElementById("weaknesses-list");
  const weaknesses = progress.topWeaknesses || [];
  if (weaknesses.length === 0) {
    el.innerHTML = `<p class="empty-state">Sin errores frecuentes registrados todavía. 🎉</p>`;
    return;
  }
  el.innerHTML = weaknesses
    .map(
      (w) => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding: 7px 0; font-size:13px; border-bottom: 1px solid var(--border-subtle);">
      <span style="color:var(--text-secondary);">${w.concept}</span>
      <span class="chip" style="color:var(--accent-coral); border-color: rgba(255,107,122,.3);">${w.count} ${w.count === 1 ? "error" : "errores"}</span>
    </div>`
    )
    .join("");
}
