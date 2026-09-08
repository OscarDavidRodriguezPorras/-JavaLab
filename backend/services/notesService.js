const drive = require("./googleDrive");
const { generateId } = require("../utils/id");

function fileName(id) {
  return `${id}.json`;
}

async function listNotes({ userId, category, search } = {}) {
  let notes = await drive.listJson("notes");
  if (userId) notes = notes.filter((n) => n.userId === userId);
  if (category) notes = notes.filter((n) => n.category?.toLowerCase() === category.toLowerCase());
  if (search) {
    const q = search.toLowerCase();
    notes = notes.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
  }
  return notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

async function getNote(id) {
  return drive.readJson("notes", fileName(id));
}

async function createNote({ userId, title, category, content, images = [] }) {
  const note = {
    id: generateId("note"),
    userId,
    title,
    category: category || "General",
    content: content || "",
    images,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await drive.writeJson("notes", fileName(note.id), note);
  return note;
}

async function updateNote(id, patch) {
  const note = await getNote(id);
  if (!note) return null;
  const updated = { ...note, ...patch, id: note.id, updatedAt: new Date().toISOString() };
  await drive.writeJson("notes", fileName(id), updated);
  return updated;
}

async function deleteNote(id) {
  return drive.deleteJson("notes", fileName(id));
}

/** Devuelve la lista de conceptos/temas que el usuario ya ha apuntado, usada para generar ejercicios acordes a su nivel. */
async function conceptsForUser(userId) {
  const notes = await listNotes({ userId });
  const categories = new Set(notes.map((n) => n.category).filter(Boolean));
  return Array.from(categories);
}

module.exports = { listNotes, getNote, createNote, updateNote, deleteNote, conceptsForUser };
