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
          <span class="nav-item__icon">⚙️</span> Reiniciar perfil
        </a>
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
      if (confirm("Esto olvidará tu perfil en este navegador (tus datos siguen en Google Drive). ¿Continuar?")) {
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

function showOnboardingModal() {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal__header"><h2>¡Bienvenido a JavaLab! 👋</h2></div>
        <p style="color:var(--text-secondary); font-size: 13.5px; margin-top:-6px;">
          Cuéntanos cómo te llamas para crear tu perfil. Tus apuntes, ejercicios y progreso
          se guardarán en tu cuenta de Google Drive configurada en el backend.
        </p>
        <form id="onboarding-form">
          <div class="field">
            <label for="ob-name">Nombre</label>
            <input class="input" id="ob-name" required placeholder="Ej. Oscar David" />
          </div>
          <div class="field">
            <label for="ob-email">Correo</label>
            <input class="input" id="ob-email" type="email" required placeholder="tú@correo.com" />
          </div>
          <button type="submit" class="btn btn--primary btn--block">Crear mi perfil</button>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector("#onboarding-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = overlay.querySelector("#ob-name").value.trim();
      const email = overlay.querySelector("#ob-email").value.trim();
      if (!name || !email) return;
      try {
        const user = await api.users.create({ name, email });
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
  const user = await showOnboardingModal();
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
