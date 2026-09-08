const drive = require("../services/googleDrive");
const { HttpError } = require("../middleware/errorHandler");
 
/** GET /api/images/:fileId — sirve la imagen directamente desde Drive, autenticado por el backend. */
async function serve(req, res) {
  const { fileId } = req.params;
  try {
    const { stream, mimeType } = await drive.getImageStream(fileId);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    stream.on("error", () => res.status(500).end());
    stream.pipe(res);
  } catch (err) {
    throw new HttpError(404, `No se pudo cargar la imagen ${fileId}: ${err.message}`, "IMAGE_NOT_FOUND");
  }
}
 
module.exports = { serve };
 