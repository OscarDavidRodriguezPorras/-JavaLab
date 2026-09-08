const notesService = require("../services/notesService");
const drive = require("../services/googleDrive");
const { HttpError } = require("../middleware/errorHandler");

async function listNotes(req, res) {
  const { userId, category, search } = req.query;
  const notes = await notesService.listNotes({ userId, category, search });
  res.json(notes);
}

async function getNote(req, res) {
  const note = await notesService.getNote(req.params.id);
  if (!note) throw new HttpError(404, `Apunte ${req.params.id} no encontrado`, "NOTE_NOT_FOUND");
  res.json(note);
}

async function createNote(req, res) {
  const { userId, title, category, content } = req.body;
  if (!userId || !title) throw new HttpError(400, "userId y title son requeridos", "VALIDATION_ERROR");
  const note = await notesService.createNote({ userId, title, category, content });
  res.status(201).json(note);
}

async function updateNote(req, res) {
  const note = await notesService.updateNote(req.params.id, req.body);
  if (!note) throw new HttpError(404, `Apunte ${req.params.id} no encontrado`, "NOTE_NOT_FOUND");
  res.json(note);
}

async function deleteNote(req, res) {
  const deleted = await notesService.deleteNote(req.params.id);
  if (!deleted) throw new HttpError(404, `Apunte ${req.params.id} no encontrado`, "NOTE_NOT_FOUND");
  res.status(204).send();
}

/** Sube una imagen (base64) y la asocia al apunte. Espera { fileName, mimeType, dataBase64 } en el body. */
async function uploadImage(req, res) {
  const note = await notesService.getNote(req.params.id);
  if (!note) throw new HttpError(404, `Apunte ${req.params.id} no encontrado`, "NOTE_NOT_FOUND");

  const { fileName, mimeType, dataBase64 } = req.body;
  if (!fileName || !mimeType || !dataBase64) {
    throw new HttpError(400, "fileName, mimeType y dataBase64 son requeridos", "VALIDATION_ERROR");
  }
  if (!mimeType.startsWith("image/")) {
    throw new HttpError(400, "Solo se permiten archivos de imagen", "VALIDATION_ERROR");
  }

  const buffer = Buffer.from(dataBase64, "base64");
  if (buffer.length > 8 * 1024 * 1024) {
    throw new HttpError(400, "La imagen supera el tamaño máximo (8MB)", "VALIDATION_ERROR");
  }

  const uploaded = await drive.uploadImage(note.id, fileName, buffer, mimeType);
  const image = { fileId: uploaded.id, url: uploaded.webViewLink, thumbnail: uploaded.thumbnailLink };

  const updated = await notesService.updateNote(note.id, { images: [...(note.images || []), image] });
  res.status(201).json(updated);
}

module.exports = { listNotes, getNote, createNote, updateNote, deleteNote, uploadImage };
