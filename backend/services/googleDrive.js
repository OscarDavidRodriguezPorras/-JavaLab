/**
 * services/googleDrive.js
 *
 * Único punto de contacto con Google Drive en todo el backend.
 * Nada fuera de este archivo debe llamar directamente a la API de Google.
 *
 * Google Drive se usa como "base de datos": cada entidad (usuario, apunte,
 * ejercicio, progreso, proyecto) es un archivo JSON dentro de una carpeta
 * bajo JavaLab/. Las imágenes se guardan como binarios dentro de images/.
 *
 * Estructura creada automáticamente en Drive:
 *
 *   JavaLab/
 *     users/
 *     notes/
 *     exercises/
 *     progress/
 *     projects/
 *     images/
 *     configuration/
 */

const { google } = require("googleapis");
const env = require("../config/env");

const JSON_MIME = "application/json";
const FOLDER_MIME = "application/vnd.google-apps.folder";

const TOP_LEVEL_FOLDERS = [
  "users",
  "notes",
  "exercises",
  "progress",
  "projects",
  "images",
  "configuration",
];

class GoogleDriveService {
  constructor() {
    this._drive = null;
    this._rootFolderId = env.google.rootFolderId || null;
    // folderName -> folderId (solo carpetas de primer nivel dentro de JavaLab/)
    this._folderCache = new Map();
    // "folderName/fileName" -> fileId (cache corta para reducir llamadas)
    this._fileCache = new Map();
    this._ready = null;
  }

  isConfigured() {
    return env.isGoogleConfigured();
  }

  /** Devuelve el cliente drive autenticado, creándolo si hace falta. */
  _client() {
    if (this._drive) return this._drive;

    if (!this.isConfigured()) {
      throw new Error(
        "Google Drive no está configurado. Define GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET " +
          "y GOOGLE_REFRESH_TOKEN en tu .env (ver README, sección 'Configurar Google Drive')."
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      env.google.clientId,
      env.google.clientSecret,
      env.google.redirectUri
    );
    oauth2Client.setCredentials({ refresh_token: env.google.refreshToken });

    this._drive = google.drive({ version: "v3", auth: oauth2Client });
    return this._drive;
  }

  /**
   * Se asegura de que exista JavaLab/ y todas sus subcarpetas.
   * Idempotente: se puede llamar en cada arranque del servidor sin duplicar carpetas.
   */
  async init() {
    if (this._ready) return this._ready;

    this._ready = (async () => {
      const drive = this._client();

      if (!this._rootFolderId) {
        this._rootFolderId = await this._findOrCreateFolder("JavaLab", "root");
        console.log(
          `[googleDrive] Carpeta raíz creada. Guarda este ID en GOOGLE_DRIVE_ROOT_FOLDER_ID: ${this._rootFolderId}`
        );
      } else {
        // Verifica que el ID configurado siga existiendo.
        await drive.files.get({ fileId: this._rootFolderId, fields: "id, name" });
      }

      for (const name of TOP_LEVEL_FOLDERS) {
        const id = await this._findOrCreateFolder(name, this._rootFolderId);
        this._folderCache.set(name, id);
      }

      return true;
    })();

    return this._ready;
  }

  async _findOrCreateFolder(name, parentId) {
    const drive = this._client();
    const q = [
      `name = '${name.replace(/'/g, "\\'")}'`,
      `mimeType = '${FOLDER_MIME}'`,
      `'${parentId}' in parents`,
      "trashed = false",
    ].join(" and ");

    const res = await drive.files.list({ q, fields: "files(id, name)", spaces: "drive" });
    if (res.data.files && res.data.files.length > 0) {
      return res.data.files[0].id;
    }

    const created = await drive.files.create({
      requestBody: {
        name,
        mimeType: FOLDER_MIME,
        parents: parentId === "root" ? undefined : [parentId],
      },
      fields: "id",
    });
    return created.data.id;
  }

  _folderId(folderName) {
    const id = this._folderCache.get(folderName);
    if (!id) {
      throw new Error(
        `Carpeta '${folderName}' no reconocida o Drive aún no inicializado. Carpetas válidas: ${TOP_LEVEL_FOLDERS.join(", ")}`
      );
    }
    return id;
  }

  async _findFileId(folderName, fileName) {
    const cacheKey = `${folderName}/${fileName}`;
    if (this._fileCache.has(cacheKey)) return this._fileCache.get(cacheKey);

    const drive = this._client();
    const folderId = this._folderId(folderName);
    const q = [
      `name = '${fileName.replace(/'/g, "\\'")}'`,
      `'${folderId}' in parents`,
      "trashed = false",
    ].join(" and ");

    const res = await drive.files.list({ q, fields: "files(id, name)", spaces: "drive" });
    const fileId = res.data.files && res.data.files[0] ? res.data.files[0].id : null;
    if (fileId) this._fileCache.set(cacheKey, fileId);
    return fileId;
  }

  // ---------- JSON files (users, notes, exercises, progress, projects) ----------

  /** Crea (o sobrescribe si ya existe) un archivo JSON dentro de folderName/. */
  async writeJson(folderName, fileName, data) {
    await this.init();
    const drive = this._client();
    const folderId = this._folderId(folderName);
    const body = JSON.stringify(data, null, 2);
    const existingId = await this._findFileId(folderName, fileName);

    const media = { mimeType: JSON_MIME, body };

    if (existingId) {
      await drive.files.update({ fileId: existingId, media });
      return existingId;
    }

    const created = await drive.files.create({
      requestBody: { name: fileName, parents: [folderId], mimeType: JSON_MIME },
      media,
      fields: "id",
    });
    this._fileCache.set(`${folderName}/${fileName}`, created.data.id);
    return created.data.id;
  }

  /** Lee un archivo JSON. Devuelve null si no existe. */
  async readJson(folderName, fileName) {
    await this.init();
    const drive = this._client();
    const fileId = await this._findFileId(folderName, fileName);
    if (!fileId) return null;

    const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "text" });
    try {
      return typeof res.data === "string" ? JSON.parse(res.data) : res.data;
    } catch (err) {
      throw new Error(`El archivo ${folderName}/${fileName} no contiene JSON válido: ${err.message}`);
    }
  }

  /** Lista y lee todos los archivos JSON de una carpeta. */
  async listJson(folderName) {
    await this.init();
    const drive = this._client();
    const folderId = this._folderId(folderName);

    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "files(id, name)",
      spaces: "drive",
      pageSize: 1000,
    });

    const files = res.data.files || [];
    const results = [];
    for (const f of files) {
      this._fileCache.set(`${folderName}/${f.name}`, f.id);
      try {
        const contentRes = await drive.files.get({ fileId: f.id, alt: "media" }, { responseType: "text" });
        const parsed = typeof contentRes.data === "string" ? JSON.parse(contentRes.data) : contentRes.data;
        results.push(parsed);
      } catch (err) {
        console.warn(`[googleDrive] No se pudo leer ${folderName}/${f.name}: ${err.message}`);
      }
    }
    return results;
  }

  async deleteJson(folderName, fileName) {
    await this.init();
    const drive = this._client();
    const fileId = await this._findFileId(folderName, fileName);
    if (!fileId) return false;
    await drive.files.delete({ fileId });
    this._fileCache.delete(`${folderName}/${fileName}`);
    return true;
  }

  /** Elimina un archivo de Drive directamente por su id (usado para borrar imágenes). */
  async deleteFileById(fileId) {
    await this.init();
    const drive = this._client();
    await drive.files.delete({ fileId });
    return true;
  }

  // ---------- Imágenes ----------

  /**
   * Sube una imagen dentro de images/<subfolder>/.
   * subfolder normalmente es el id del apunte (note_001) para agrupar sus imágenes.
   */
  async uploadImage(subfolder, fileName, buffer, mimeType) {
    await this.init();
    const drive = this._client();
    const imagesFolderId = this._folderId("images");
    const targetFolderId = await this._findOrCreateFolder(subfolder, imagesFolderId);

    const created = await drive.files.create({
      requestBody: { name: fileName, parents: [targetFolderId] },
      media: { mimeType, body: bufferToStream(buffer) },
      fields: "id, webViewLink, webContentLink",
    });

    // Hace el archivo legible por link para poder mostrarlo en el frontend.
    await drive.permissions.create({
      fileId: created.data.id,
      requestBody: { role: "reader", type: "anyone" },
    });

    const file = await drive.files.get({
      fileId: created.data.id,
      fields: "id, webViewLink, webContentLink, thumbnailLink",
    });

    return file.data;
  }

  /**
   * Descarga los bytes de una imagen directamente desde Drive, usando la misma
   * conexión autenticada del backend (no depende de que Google permita "hotlinking").
   * Devuelve { stream, mimeType } para que el controlador la reenvíe al navegador.
   */
  async getImageStream(fileId) {
    await this.init();
    const drive = this._client();
    const meta = await drive.files.get({ fileId, fields: "mimeType" });
    const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "stream" });
    return { stream: res.data, mimeType: meta.data.mimeType || "application/octet-stream" };
  }
}

function bufferToStream(buffer) {
  const { Readable } = require("stream");
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

module.exports = new GoogleDriveService();