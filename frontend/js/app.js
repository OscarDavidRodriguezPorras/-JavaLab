/**
 * js/app.js
 * Bootstrap compartido por todas las páginas: pinta el sidebar/topbar y
 * resuelve quién es el usuario actual (se guarda su id en localStorage;
 * el registro en sí vive en Google Drive vía el backend).
 */

const NAV_ITEMS = [
  { key: "dashboard", href: "/index.html", icon: "🏠", label: "Inicio" },
  { key: "notes", href: "/pages/notes.html", icon: "📚", label: "Apuntes" },
  { key: "exercises", href: "/pages/exercises.html", icon: "💻", label: "Ejercicios" },
  { key: "progress", href: "/pages/progress.html", icon: "📊", label: "Progreso" },
  { key: "projects", href: "/pages/projects.html", icon: "🚀", label: "Proyectos" },
  { key: "tutor", href: "/pages/tutor.html", icon: "🤖", label: "Tutor IA" },
];

const JavaLab = {
  user: null,
  ready: null,
};

function renderLayout(activeKey) {
  const sidebarRoot = document.getElementById("sidebar-root");
  const topbarRoot = document.getElementById("topbar-root");
  if (!sidebarRoot) return;

  sidebarRoot.innerHTML = `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar__brand">
        <img class="sidebar__brand-mark" src="/assets/logo.png" alt="JavaLab" />
        <div class="sidebar__brand-name">JavaLab</div>
      </div>
      <nav class="sidebar__nav">
        ${NAV_ITEMS.map(
          (item) => `
          <a class="nav-item ${item.key === activeKey ? "is-active" : ""}" href="${item.href}">
            <span class="nav-item__icon">${item.icon}</span> ${item.label}
          </a>`
        ).join("")}
      </nav>
      <div class="sidebar__footer">
        <a class="nav-item" href="#" id="reset-profile-link">
          <span class="nav-item__icon">🚪</span> Cerrar sesión
        </a>
        <p class="sidebar__credit">
          Desarrollado por
          <a href="https://oscardavidrodriguezporras.github.io/portafolio/" target="_blank" rel="noopener noreferrer">Oscar David Rodríguez Porras</a>
        </p>
      </div>
    </aside>
  `;

  if (topbarRoot) {
    topbarRoot.innerHTML = `
      <div class="topbar">
        <button class="sidebar__mobile-toggle" id="mobile-toggle" aria-label="Abrir menú">☰</button>
        <div class="topbar__search">🔎 <span>Buscar apuntes, ejercicios...</span></div>
        <div class="topbar__user" id="topbar-user"></div>
      </div>
    `;
  }

  const toggle = document.getElementById("mobile-toggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      document.getElementById("sidebar").classList.toggle("is-open");
    });
  }

  const resetLink = document.getElementById("reset-profile-link");
  if (resetLink) {
    resetLink.addEventListener("click", (e) => {
      e.preventDefault();
      if (confirm("¿Cerrar sesión? Tendrás que volver a ingresar tu correo y contraseña la próxima vez.")) {
        localStorage.removeItem("javalab_user_id");
        location.reload();
      }
    });
  }
}

function renderTopbarUser() {
  const el = document.getElementById("topbar-user");
  if (!el || !JavaLab.user) return;
  const initials = JavaLab.user.name.slice(0, 2).toUpperCase();
  el.innerHTML = `
    <span class="chip">🔥 ${JavaLab.user.streak || 0} días</span>
    <span class="chip">⭐ ${JavaLab.user.xp || 0} XP</span>
    <div class="avatar" title="${JavaLab.user.name}">${initials}</div>
  `;
}

function showAuthModal() {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal__header"><h2>¡Bienvenido a JavaLab! 👋</h2></div>

        <div style="display:flex; gap:8px; margin-bottom:18px;">
          <button type="button" class="btn btn--ghost btn--sm is-active" id="tab-login" style="flex:1;">Iniciar sesión</button>
          <button type="button" class="btn btn--ghost btn--sm" id="tab-register" style="flex:1;">Crear cuenta</button>
        </div>

        <form id="login-form">
          <div class="field">
            <label for="login-email">Correo</label>
            <input class="input" id="login-email" type="email" required placeholder="tú@correo.com" />
          </div>
          <div class="field">
            <label for="login-password">Contraseña</label>
            <input class="input" id="login-password" type="password" required placeholder="••••••••" />
          </div>
          <button type="submit" class="btn btn--primary btn--block">Entrar</button>
        </form>

        <form id="register-form" class="hidden">
          <div class="field">
            <label for="reg-name">Nombre</label>
            <input class="input" id="reg-name" required placeholder="Ej. Oscar David" />
          </div>
          <div class="field">
            <label for="reg-email">Correo</label>
            <input class="input" id="reg-email" type="email" required placeholder="tú@correo.com" />
          </div>
          <div class="field">
            <label for="reg-password">Contraseña</label>
            <input class="input" id="reg-password" type="password" required minlength="6" placeholder="Mínimo 6 caracteres" />
          </div>
          <button type="submit" class="btn btn--primary btn--block">Crear cuenta</button>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);

    const loginForm = overlay.querySelector("#login-form");
    const registerForm = overlay.querySelector("#register-form");
    const tabLogin = overlay.querySelector("#tab-login");
    const tabRegister = overlay.querySelector("#tab-register");

    function showTab(tab) {
      loginForm.classList.toggle("hidden", tab !== "login");
      registerForm.classList.toggle("hidden", tab !== "register");
      tabLogin.classList.toggle("is-active", tab === "login");
      tabRegister.classList.toggle("is-active", tab === "register");
    }
    tabLogin.addEventListener("click", () => showTab("login"));
    tabRegister.addEventListener("click", () => showTab("register"));

    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = overlay.querySelector("#login-email").value.trim();
      const password = overlay.querySelector("#login-password").value;
      try {
        const user = await api.auth.login({ email, password });
        localStorage.setItem("javalab_user_id", user.id);
        overlay.remove();
        resolve(user);
      } catch (err) {
        showToast(err.message, "error");
      }
    });

    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = overlay.querySelector("#reg-name").value.trim();
      const email = overlay.querySelector("#reg-email").value.trim();
      const password = overlay.querySelector("#reg-password").value;
      try {
        const user = await api.auth.register({ name, email, password });
        localStorage.setItem("javalab_user_id", user.id);
        overlay.remove();
        resolve(user);
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  });
}

async function bootstrapUser() {
  const storedId = localStorage.getItem("javalab_user_id");
  if (storedId) {
    try {
      const user = await api.users.get(storedId);
      JavaLab.user = user;
      return user;
    } catch {
      localStorage.removeItem("javalab_user_id");
    }
  }
  const user = await showAuthModal();
  JavaLab.user = user;
  return user;
}

function initPage(activeKey) {
  renderLayout(activeKey);
  JavaLab.ready = (async () => {
    try {
      const health = await api.health();
      if (!health.googleDriveConfigured) {
        showToast(
          "Google Drive no está configurado en el backend todavía. Revisa el README para conectar tu cuenta.",
          "error",
          7000
        );
      }
    } catch {
      showToast("No se pudo contactar al backend. ¿Está corriendo 'npm start'?", "error", 7000);
    }
    await bootstrapUser();
    renderTopbarUser();
    return JavaLab.user;
  })();
  return JavaLab.ready;
}