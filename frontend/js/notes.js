let allNotes = [];
 
(async function main() {
  await initPage("notes");
  await refreshNotes();
 
  document.getElementById("new-note-btn").addEventListener("click", openNoteModal);
  document.getElementById("note-modal-close").addEventListener("click", closeNoteModal);
  document.getElementById("note-form").addEventListener("submit", createNoteAndOpenEditor);
  document.getElementById("search-input").addEventListener("input", renderNotes);
  document.getElementById("category-filter").addEventListener("change", renderNotes);
})();
 
async function refreshNotes() {
  const list = document.getElementById("notes-list");
  list.innerHTML = `<p class="empty-state">Cargando apuntes…</p>`;
  try {
    allNotes = await api.notes.list({ userId: JavaLab.user.id });
    populateCategoryFilter();
    renderNotes();
  } catch (err) {
    list.innerHTML = `<p class="empty-state">${err.message}</p>`;
  }
}
 
function populateCategoryFilter() {
  const select = document.getElementById("category-filter");
  const datalist = document.getElementById("category-options");
  const categories = Array.from(new Set(allNotes.map((n) => n.category).filter(Boolean)));
  select.innerHTML =
    `<option value="">Todas las categorías</option>` + categories.map((c) => `<option value="${c}">${c}</option>`).join("");
  datalist.innerHTML = categories.map((c) => `<option value="${c}"></option>`).join("");
}
 
function renderNotes() {
  const list = document.getElementById("notes-list");
  const search = document.getElementById("search-input").value.toLowerCase();
  const category = document.getElementById("category-filter").value;
 
  const filtered = allNotes.filter((n) => {
    const matchesSearch = !search || n.title.toLowerCase().includes(search) || stripHtml(n.content).toLowerCase().includes(search);
    const matchesCategory = !category || n.category === category;
    return matchesSearch && matchesCategory;
  });
 
  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;">No hay apuntes que coincidan. ¡Crea uno nuevo!</div>`;
    return;
  }
 
  list.innerHTML = filtered
    .map(
      (n) => `
    <a class="card note-card" href="/pages/note-editor.html?id=${n.id}" style="display:block;">
      <span class="chip">${n.category}</span>
      <h3 style="margin: 10px 0 6px; font-size: 15px;">${escapeHtml(n.title)}</h3>
      <p style="color:var(--text-muted); font-size:12.5px; margin:0 0 10px; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical;">
        ${stripHtml(n.content).slice(0, 160)}
      </p>
      ${n.images && n.images.length ? `<div class="chip" style="color:var(--accent-cyan);">🖼️ ${n.images.length} imagen(es)</div>` : ""}
    </a>`
    )
    .join("");
}
 
function openNoteModal() {
  document.getElementById("note-form").reset();
  document.getElementById("note-modal").classList.remove("hidden");
}
 
function closeNoteModal() {
  document.getElementById("note-modal").classList.add("hidden");
}
 
async function createNoteAndOpenEditor(e) {
  e.preventDefault();
  const title = document.getElementById("note-title").value.trim();
  const category = document.getElementById("note-category").value.trim() || "General";
  if (!title) return;
 
  try {
    const note = await api.notes.create({ userId: JavaLab.user.id, title, category, content: "" });
    window.location.href = `/pages/note-editor.html?id=${note.id}`;
  } catch (err) {
    showToast(err.message, "error");
  }
}
 
function stripHtml(html) {
  const div = document.createElement("div");
  div.innerHTML = html || "";
  return div.textContent || "";
}
 
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
