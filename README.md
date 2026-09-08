# 🚀 JavaLab

Plataforma educativa para aprender Java: apuntes, ejercicios generados con IA, editor de código, verificación, progreso y gamificación. **Google Drive como base de datos**, backend en **Node.js + Express**, frontend en **HTML/CSS/JavaScript vanilla**.

Esta es la **primera versión (MVP)**, tal como se planteó en el brief original: Dashboard, Apuntes, Ejercicios, Editor de Java, Verificación, Progreso, Google Drive y el backend Node + Express. La IA (generación de ejercicios, tutor, pistas), gamificación avanzada, proyectos y retos ya están conectados y funcionando, con un modo de respaldo local cuando no hay `AI_API_KEY` configurada.

---

## 📐 Arquitectura

```
Frontend (HTML/CSS/JS vanilla)
        │  fetch() a /api/*
        ▼
Backend (Node.js + Express)
  ├── routes/        → definición de endpoints REST
  ├── controllers/    → reciben la petición HTTP, llaman a los servicios
  ├── services/        → lógica de negocio (Drive, IA, progreso, sandbox de código)
  ├── sandbox/          → intérprete de Java aislado (ver sección "Ejecución de código")
  └── middleware/         → manejo de errores centralizado
        │  googleapis
        ▼
Google Drive (JavaLab/users, notes, exercises, progress, projects, images, configuration)
```

El frontend **nunca** habla directamente con Google Drive ni tiene credenciales: todo pasa por el backend.

---

## ⚙️ Instalación

### 1. Requisitos

- Node.js 18 o superior
- Una cuenta de Google (para crear la app de Drive)
- (Opcional) una API key de Anthropic para el Tutor IA / generación de ejercicios con IA real

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
```

Completa `.env` siguiendo la siguiente sección.

### 4. Arrancar

```bash
npm start
```

Abre `http://localhost:3000`. El backend sirve el frontend estático directamente, así que no necesitas un servidor aparte.

> La primera vez que abras la app te pedirá tu nombre y correo para crear tu perfil (se guarda como `users/<id>.json` en tu Drive).

---

## 🔑 Configurar Google Drive

JavaLab usa una app OAuth2 "de escritorio" con un **refresh token de larga duración**, para no tener que iniciar sesión cada vez que arranca el servidor.

### Paso 1 — Crear un proyecto y credenciales en Google Cloud

1. Ve a [Google Cloud Console](https://console.cloud.google.com/) y crea un proyecto nuevo (o usa uno existente).
2. Habilita la **Google Drive API**: menú "APIs y servicios" → "Biblioteca" → busca "Google Drive API" → Habilitar.
3. Ve a "APIs y servicios" → "Pantalla de consentimiento OAuth". Configúrala en modo "Externo" (o "Interno" si usas Google Workspace) y agrégate a ti mismo como usuario de prueba.
4. Ve a "Credenciales" → "Crear credenciales" → "ID de cliente de OAuth" → tipo de aplicación **"Aplicación web"**.
   - En "URIs de redirección autorizados" agrega: `http://localhost:3000/api/auth/google/callback`
5. Copia el **Client ID** y **Client Secret** generados a tu `.env`:
   ```env
   GOOGLE_CLIENT_ID=tu-client-id
   GOOGLE_CLIENT_SECRET=tu-client-secret
   ```

### Paso 2 — Obtener un refresh token

La forma más simple es usar el **[OAuth 2.0 Playground](https://developers.google.com/oauthplayground)**:

1. Entra a https://developers.google.com/oauthplayground
2. Haz clic en el ícono ⚙️ (arriba a la derecha) → marca "Use your own OAuth credentials" → pega tu Client ID y Client Secret.
3. En el panel izquierdo, busca "Drive API v3" y selecciona el scope `https://www.googleapis.com/auth/drive`.
4. Haz clic en "Authorize APIs" e inicia sesión con la cuenta de Google donde quieras guardar los datos de JavaLab.
5. Haz clic en "Exchange authorization code for tokens".
6. Copia el **Refresh token** que aparece y pégalo en tu `.env`:
   ```env
   GOOGLE_REFRESH_TOKEN=el-refresh-token-que-copiaste
   ```

### Paso 3 — Primer arranque

Con `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `GOOGLE_REFRESH_TOKEN` configurados, corre `npm start`. En la consola verás algo como:

```
[googleDrive] Carpeta raíz creada. Guarda este ID en GOOGLE_DRIVE_ROOT_FOLDER_ID: 1AbCdEfGhIjKlMnOpQrStUvWxYz
```

Copia ese ID a `GOOGLE_DRIVE_ROOT_FOLDER_ID` en tu `.env` y reinicia el servidor. Esto evita que el backend tenga que buscar la carpeta por nombre en cada arranque. Si lo dejas vacío, JavaLab la busca (o la crea) automáticamente cada vez, así que **no es obligatorio**, solo una optimización.

A partir de aquí, en tu Drive verás la carpeta:

```
JavaLab/
├── users/
├── notes/
├── exercises/
├── progress/
├── projects/
├── images/
└── configuration/
```

---

## 🤖 Configurar la IA (opcional)

Si defines `AI_API_KEY` con una clave de la API de Anthropic, JavaLab usará IA real para:

- Generar ejercicios acordes a los temas y al nivel del estudiante (a partir de sus apuntes).
- Explicar errores.
- El Tutor IA (metodología socrática: explica, señala el problema, da una pista, pregunta — nunca entrega la solución completa a menos que se la pidas explícitamente).

**Sin `AI_API_KEY`**, JavaLab sigue funcionando con generación local de respaldo (plantillas de ejercicios sobre variables/condicionales/ciclos, pistas guardadas en cada ejercicio, y un tutor con respuestas genéricas orientadoras). Esto se indica claramente en la interfaz (toast + campo `source: "local-fallback"` en las respuestas de la API) para que nunca haya sorpresas sobre qué está generando qué.

```env
AI_API_KEY=sk-ant-...
AI_API_URL=https://api.anthropic.com/v1/messages
```

---

## 🧪 Ejecución de código (sección importante)

Ejecutar Java real de forma seguía requiere un compilador y una JVM aisladas (normalmente un contenedor Docker efímero, sin red, con límites estrictos de CPU/memoria). Eso no se puede garantizar corriendo directamente dentro de este proceso de Node.

Para que el MVP tenga un botón "▶ Ejecutar" **realmente funcional y seguro** sin esa infraestructura, `backend/sandbox/miniJavaInterpreter.js` implementa un **intérprete propio de un subconjunto de Java**, escrito a mano (tokenizer + parser + evaluador), sin `eval()`, sin `child_process`, sin acceso a red ni al sistema de archivos:

**Soportado:** variables (`int`, `double`, `float`, `boolean`, `String`, `char`), operadores aritméticos/lógicos/comparación, `if/else`, `for`, `while`, `System.out.print/println`, `JOptionPane.showInputDialog/showMessageDialog` (con entradas simuladas), `Integer.parseInt`, `Float/Double.parseFloat/parseDouble`, `Math.*`, y algunos métodos de `String` (`.length()`, `.equals()`, `.toUpperCase()`, etc).

**No soportado (todavía):** clases propias, POO, arrays multidimensionales complejos, colecciones (`ArrayList`, etc.), hilos, herencia. El intérprete devuelve un error claro y entendible cuando encuentra algo fuera de este subconjunto, en vez de fallar de forma confusa.

Tiene límites de seguridad: máximo de pasos de ejecución, máximo de iteraciones por ciclo, tamaño máximo de código y de salida, y un límite de tiempo de reloj — así que un `while(true)` nunca cuelga el servidor (está probado).

### Migrar a un JDK real más adelante

`backend/services/codeRunner.js` es el único lugar que llama al intérprete. Cuando quieras ejecutar Java real:

1. Levanta un contenedor Docker efímero por ejecución, con imagen `eclipse-temurin:21-jdk`, `--network=none`, `--memory=64m`, `--cpus=0.5`, `--read-only`.
2. Monta el código como `Main.java`, corre `javac Main.java && java Main` con un `timeout`.
3. Captura stdout/stderr con un límite de bytes y destruye el contenedor siempre (`try/finally`).
4. Reemplaza el interior de `codeRunner.execute()` por esa llamada a Docker — las rutas, controladores y el frontend no necesitan cambiar.

---

## 📁 Estructura del proyecto

```
JavaLab/
├── backend/
│   ├── server.js
│   ├── config/env.js
│   ├── routes/            (users, notes, exercises, progress, projects, ai, code)
│   ├── controllers/
│   ├── services/
│   │   ├── googleDrive.js       ← único punto de contacto con Drive
│   │   ├── aiService.js         ← IA real + fallback local
│   │   ├── codeRunner.js
│   │   ├── codeValidator.js
│   │   ├── progressService.js
│   │   ├── usersService.js
│   │   ├── notesService.js
│   │   ├── exercisesService.js
│   │   ├── projectsService.js
│   │   └── dailyChallengeService.js
│   ├── sandbox/miniJavaInterpreter.js
│   └── middleware/errorHandler.js
│
├── frontend/
│   ├── index.html          (Dashboard)
│   ├── pages/
│   │   ├── notes.html
│   │   ├── exercises.html
│   │   ├── editor.html      (Monaco Editor)
│   │   ├── progress.html
│   │   ├── projects.html
│   │   └── tutor.html
│   ├── css/styles.css
│   └── js/
│       ├── api.js           ← cliente HTTP hacia el backend
│       ├── app.js           ← sidebar/topbar + bootstrap de usuario
│       ├── toast.js
│       └── (uno por página)
│
├── .env.example
├── .gitignore
└── package.json
```

---

## 🔌 API REST

```
GET    /api/health

GET    /api/users/:id
POST   /api/users
PUT    /api/users/:id

GET    /api/notes?userId=&category=&search=
POST   /api/notes
GET    /api/notes/:id
PUT    /api/notes/:id
DELETE /api/notes/:id
POST   /api/notes/:id/images        ({ fileName, mimeType, dataBase64 })

GET    /api/exercises?topic=&difficulty=
GET    /api/exercises/daily/today
GET    /api/exercises/:id
POST   /api/exercises/:id/run       ({ code, inputs })
POST   /api/exercises/:id/submit    ({ code, userId, hintsUsed })

GET    /api/progress?userId=

GET    /api/projects
GET    /api/projects/:id

POST   /api/ai/generate-exercises   ({ topics, difficulty, count, userId })
POST   /api/ai/explain-error        ({ code, error })
POST   /api/ai/hint                 ({ exerciseId, hintLevel })
POST   /api/ai/tutor                ({ question, code, conversationHistory })

POST   /api/code/run                ({ code, inputs })  ← ejecución libre, sin ejercicio asociado
```

---

## 🗺️ Qué sigue (fuera del MVP)

Como se pidió en el brief original, esto es un MVP funcional. Quedan preparados para siguientes iteraciones, sin bloquear lo ya construido:

- **Modo Profesor**: subir foto/PDF de apuntes de clase → IA detecta conceptos → genera resumen, ejercicios y mini-examen automáticamente.
- **Ejecución de Java real** vía Docker+JDK (ver sección "Ejecución de código" arriba — la arquitectura ya está separada para hacer este cambio sin tocar rutas ni frontend).
- **Ejercicios tipo "ordenar código"** y "completar código" en el editor (el modelo de datos ya soporta el campo `type`, falta la UI específica para esos dos tipos en `editor.js`).
- **Sesiones de recuperación automáticas** a partir de las debilidades detectadas (ya se calculan y se muestran en Progreso; falta armar la secuencia guiada de ejercicios).
- **Autenticación multiusuario real** (hoy el "login" es un perfil local por navegador vía `localStorage`, apropiado para un MVP de un solo estudiante por instalación).
