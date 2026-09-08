let allNotes = [];
let pendingImageFile = null;

(async function main() {
  await initPage("notes");
  await refreshNotes();

  document.getElementById("new-note-btn").addEventListener("click", () => openNoteModal());
  document.getElementById("note-modal-close").addEventListener("click", closeNoteModal);
  document.getElementById("note-form").addEventListener("submit", saveNote);
  document.getElementById("delete-note-btn").addEventListener("click", deleteCurrentNote);
  document.getElementById("search-input").addEventListener("input", renderNotes);
  document.getElementById("category-filter").addEventListener("change", renderNotes);
  document.getElementById("note-image").addEventListener("change", (e) => {
    pendingImageFile = e.target.files[0] || null;
  });

  const params = new URLSearchParams(location.search);
  const openId = params.get("open");
  if (openId) {
    const note = allNotes.find((n) => n.id === openId);
    if (note) openNoteModal(note);
  }
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
    const matchesSearch = !search || n.title.toLowerCase().includes(search) || n.content.toLowerCase().includes(search);
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
    <div class="card note-card" data-id="${n.id}" style="cursor:pointer;">
      <span class="chip">${n.category}</span>
      <h3 style="margin: 10px 0 6px; font-size: 15px;">${escapeHtml(n.title)}</h3>
      <p style="color:var(--text-muted); font-size:12.5px; margin:0 0 10px; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical;">
        ${escapeHtml(n.content).slice(0, 160)}
      </p>
      ${n.images && n.images.length ? `<div class="chip" style="color:var(--accent-cyan);">🖼️ ${n.images.length} imagen(es)</div>` : ""}
    </div>`
    )
    .join("");

  list.querySelectorAll(".note-card").forEach((card) => {
    card.addEventListener("click", () => {
      const note = allNotes.find((n) => n.id === card.dataset.id);
      openNoteModal(note);
    });
  });
}

function openNoteModal(note = null) {
  const modal = document.getElementById("note-modal");
  document.getElementById("note-modal-title").textContent = note ? "Editar apunte" : "Nuevo apunte";
  document.getElementById("note-id").value = note ? note.id : "";
  document.getElementById("note-title").value = note ? note.title : "";
  document.getElementById("note-category").value = note ? note.category : "";
  document.getElementById("note-content").value = note ? note.content : "";
  document.getElementById("delete-note-btn").classList.toggle("hidden", !note);
  pendingImageFile = null;
  document.getElementById("note-image").value = "";
  renderImagePreview(note);
  modal.classList.remove("hidden");
}

function renderImagePreview(note) {
  const el = document.getElementById("note-images-preview");
  if (!note || !note.images || note.images.length === 0) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = note.images
    .map((img) => `<img src="${img.thumbnail || img.url}" style="width:64px; height:64px; object-fit:cover; border-radius:8px; border:1px solid var(--border-subtle);" />`)
    .join("");
}

function closeNoteModal() {
  document.getElementById("note-modal").classList.add("hidden");
}

async function saveNote(e) {
  e.preventDefault();
  const id = document.getElementById("note-id").value;
  const payload = {
    userId: JavaLab.user.id,
    title: document.getElementById("note-title").value.trim(),
    category: document.getElementById("note-category").value.trim() || "General",
    content: document.getElementById("note-content").value,
  };
  if (!payload.title) return;

  try {
    let note;
    if (id) {
      note = await api.notes.update(id, payload);
    } else {
      note = await api.notes.create(payload);
    }

    if (pendingImageFile) {
      const base64 = await fileToBase64(pendingImageFile);
      note = await api.notes.uploadImage(note.id, {
        fileName: pendingImageFile.name,
        mimeType: pendingImageFile.type,
        dataBase64: base64,
      });
    }

    showToast("Apunte guardado ✅", "success");
    closeNoteModal();
    await refreshNotes();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deleteCurrentNote() {
  const id = document.getElementById("note-id").value;
  if (!id || !confirm("¿Eliminar este apunte? Esta acción no se puede deshacer.")) return;
  try {
    await api.notes.remove(id);
    showToast("Apunte eliminado", "success");
    closeNoteModal();
    await refreshNotes();
  } catch (err) {
    showToast(err.message, "error");
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
