let currentNote = null;
 
(async function main() {
  await initPage("notes");
 
  const params = new URLSearchParams(location.search);
  const noteId = params.get("id");
  if (!noteId) {
    showToast("No se indicó ningún apunte.", "error");
    window.location.href = "/pages/notes.html";
    return;
  }
 
  try {
    currentNote = await api.notes.get(noteId);
  } catch (err) {
    showToast(err.message, "error");
    window.location.href = "/pages/notes.html";
    return;
  }
 
  document.getElementById("doc-title").value = currentNote.title;
  document.getElementById("doc-category").value = currentNote.category;
  document.getElementById("doc-content").innerHTML = currentNote.content || "";
  renderImages();
 
  wireToolbar();
  document.getElementById("save-btn").addEventListener("click", saveNote);
  document.getElementById("delete-btn").addEventListener("click", deleteNote);
  document.getElementById("image-input").addEventListener("change", uploadImage);
})();
 
function wireToolbar() {
  document.querySelectorAll(".toolbar button[data-cmd]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("doc-content").focus();
      document.execCommand(btn.dataset.cmd, false, btn.dataset.value || null);
    });
  });
 
  document.getElementById("text-color").addEventListener("input", (e) => {
    document.getElementById("doc-content").focus();
    document.execCommand("foreColor", false, e.target.value);
  });
 
  document.getElementById("uppercase-btn").addEventListener("click", () => transformSelection((t) => t.toUpperCase()));
  document.getElementById("lowercase-btn").addEventListener("click", () => transformSelection((t) => t.toLowerCase()));
}
 
/** Transforma solo el texto seleccionado (may/minúsculas), sin tocar el resto del documento. */
function transformSelection(fn) {
  const selection = window.getSelection();
  if (!selection.rangeCount || selection.isCollapsed) {
    showToast("Selecciona el texto que quieres transformar.", "error");
    return;
  }
  const range = selection.getRangeAt(0);
  const text = range.toString();
  range.deleteContents();
  range.insertNode(document.createTextNode(fn(text)));
  selection.removeAllRanges();
}
 
async function saveNote() {
  const title = document.getElementById("doc-title").value.trim();
  const category = document.getElementById("doc-category").value.trim() || "General";
  const content = document.getElementById("doc-content").innerHTML;
  if (!title) {
    showToast("El título no puede estar vacío.", "error");
    return;
  }
  try {
    currentNote = await api.notes.update(currentNote.id, { title, category, content });
    showToast("Apunte guardado ✅", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}
 
async function deleteNote() {
  if (!confirm("¿Eliminar este apunte? Esta acción no se puede deshacer.")) return;
  try {
    await api.notes.remove(currentNote.id);
    showToast("Apunte eliminado", "success");
    window.location.href = "/pages/notes.html";
  } catch (err) {
    showToast(err.message, "error");
  }
}
 
function renderImages() {
  const el = document.getElementById("images-list");
  const images = currentNote.images || [];
  if (images.length === 0) {
    el.innerHTML = `<p class="empty-state" style="padding:10px 0;">Sin imágenes todavía.</p>`;
    return;
  }
  el.innerHTML = images
    .map(
      (img) =>
        `<img class="image-thumb" src="${img.thumbnail || img.url}" title="Clic para insertar en el apunte" data-url="${img.url}" />`
    )
    .join("");
 
  el.querySelectorAll(".image-thumb").forEach((thumb) => {
    thumb.addEventListener("click", () => {
      document.getElementById("doc-content").focus();
      document.execCommand("insertHTML", false, `<img src="${thumb.dataset.url}" style="max-width:100%; border-radius:8px; margin:8px 0;" />`);
    });
  });
}
 
async function uploadImage(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const base64 = await fileToBase64(file);
    currentNote = await api.notes.uploadImage(currentNote.id, {
      fileName: file.name,
      mimeType: file.type,
      dataBase64: base64,
    });
    renderImages();
    showToast("Imagen subida ✅", "success");
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    e.target.value = "";
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