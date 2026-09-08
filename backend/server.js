const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");

const env = require("./config/env");
const drive = require("./services/googleDrive");
const { errorHandler, notFound } = require("./middleware/errorHandler");

const usersRoutes = require("./routes/users");
const notesRoutes = require("./routes/notes");
const exercisesRoutes = require("./routes/exercises");
const progressRoutes = require("./routes/progress");
const projectsRoutes = require("./routes/projects");
const aiRoutes = require("./routes/ai");
const codeRoutes = require("./routes/code");
const imagesRoutes = require("./routes/images");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" })); // límite generoso para imágenes en base64
app.use(morgan("dev"));

// Sirve el frontend estático (HTML/CSS/JS vanilla) directamente desde Express.
app.use(express.static(path.join(__dirname, "..", "frontend")));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    googleDriveConfigured: drive.isConfigured(),
    aiConfigured: env.isAiConfigured(),
  });
});

app.use("/api/users", usersRoutes);
app.use("/api/notes", notesRoutes);
app.use("/api/exercises", exercisesRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/code", codeRoutes);
app.use("/api/images", imagesRoutes);

app.use("/api", notFound);
app.use(errorHandler);

async function start() {
  if (drive.isConfigured()) {
    try {
      await drive.init();
      console.log("[JavaLab] Conectado a Google Drive correctamente.");
    } catch (err) {
      console.error("[JavaLab] No se pudo inicializar Google Drive:", err.message);
      console.error("[JavaLab] El servidor seguirá arrancando, pero las rutas que usan Drive fallarán hasta que corrijas la configuración.");
    }
  } else {
    console.warn(
      "[JavaLab] Google Drive NO está configurado (faltan variables en .env). " +
        "El servidor arranca igual, pero notas/ejercicios/progreso no funcionarán hasta configurarlo. " +
        "Ver README, sección 'Configurar Google Drive'."
    );
  }

  app.listen(env.port, () => {
    console.log(`[JavaLab] Backend escuchando en http://localhost:${env.port}`);
    console.log(`[JavaLab] IA ${env.isAiConfigured() ? "configurada (Anthropic API)" : "en modo local (sin AI_API_KEY, usando generación de respaldo)"}`);
  });
}

start();

module.exports = app;