(async function main() {
  await initPage("projects");
  const list = document.getElementById("projects-list");
  try {
    const projects = await api.projects.list();
    list.innerHTML = projects
      .map(
        (p) => `
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
          <span style="font-size:22px;">${p.emoji || "🛠️"}</span>
          <span class="chip chip--${p.difficulty}">${p.difficulty}</span>
        </div>
        <h3 style="font-size:15px; margin-bottom:6px;">${escapeHtml(p.title)}</h3>
        <p style="color:var(--text-secondary); font-size:13px; margin: 0 0 12px;">${escapeHtml(p.description)}</p>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;">
          ${(p.topics || []).map((t) => `<span class="chip">${t}</span>`).join("")}
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--text-muted);">
          <span>⏱️ ${p.estimatedTime}</span>
        </div>
      </div>`
      )
      .join("");
  } catch (err) {
    list.innerHTML = `<p class="empty-state">${err.message}</p>`;
  }
})();

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
