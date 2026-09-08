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
  wirePasteAndDrop();
  document.getElementById("save-btn").addEventListener("click", saveNote);
  document.getElementById("delete-btn").addEventListener("click", deleteNote);
  document.getElementById("image-input").addEventListener("change", uploadImage);
  document.getElementById("lightbox-close").addEventListener("click", closeLightbox);
  document.getElementById("lightbox-overlay").addEventListener("click", (e) => {
    if (e.target.id === "lightbox-overlay") closeLightbox();
  });
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
    el.innerHTML = `<p class="empty-state" style="padding:10px 0;">Sin imágenes todavía. Pega una con Ctrl+V o usa "Seleccionar archivo".</p>`;
    return;
  }
  el.innerHTML = images
    .map((img) => `<img class="image-thumb" src="${img.thumbnail || img.url}" data-url="${img.url}" title="Clic para ver en grande" />`)
    .join("");
 
  el.querySelectorAll(".image-thumb").forEach((thumb) => {
    thumb.addEventListener("click", () => openLightbox(thumb.dataset.url));
  });
}
 
function openLightbox(url) {
  document.getElementById("lightbox-img").src = url;
  document.getElementById("lightbox-overlay").classList.remove("hidden");
}
 
function closeLightbox() {
  document.getElementById("lightbox-overlay").classList.add("hidden");
  document.getElementById("lightbox-img").src = "";
}
 
async function uploadImage(e) {
  const file = e.target.files[0];
  if (!file) return;
  await handleImageFile(file);
  e.target.value = "";
}
 
/** Sube un archivo de imagen (venga de <input file>, arrastrar o pegar) y refresca la lista. */
async function handleImageFile(file) {
  if (!file.type.startsWith("image/")) {
    showToast("Ese archivo no es una imagen.", "error");
    return;
  }
  try {
    const base64 = await fileToBase64(file);
    currentNote = await api.notes.uploadImage(currentNote.id, {
      fileName: file.name || `pegada-${Date.now()}.png`,
      mimeType: file.type,
      dataBase64: base64,
    });
    renderImages();
    showToast("Imagen agregada ✅", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}
 
/** Escucha Ctrl+V en toda la página: si el portapapeles trae una imagen (captura, copiada de otra web, etc.), la sube. */
function wirePasteAndDrop() {
  document.addEventListener("paste", (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (!imageItem) return; // deja que el pegado normal de texto siga funcionando en el editor
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (file) handleImageFile(file);
  });
 
  const dropZone = document.getElementById("doc-content");
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("is-drag-over");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("is-drag-over"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("is-drag-over");
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  });
}
 
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}