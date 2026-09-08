/**
 * js/api.js
 * Cliente HTTP para el backend de JavaLab. El frontend nunca habla
 * directamente con Google Drive: todo pasa por estas rutas /api/*.
 */

const API_BASE = "/api";

async function request(path, { method = "GET", body, params } = {}) {
  let url = `${API_BASE}${path}`;
  if (params) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""))
    ).toString();
    if (qs) url += `?${qs}`;
  }

  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const message = (data && data.message) || `Error ${res.status} en ${path}`;
    const err = new Error(message);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

const api = {
  health: () => request("/health"),

  users: {
    get: (id) => request(`/users/${id}`),
    update: (id, patch) => request(`/users/${id}`, { method: "PUT", body: patch }),
  },

  auth: {
    register: (payload) => request("/auth/register", { method: "POST", body: payload }),
    login: (payload) => request("/auth/login", { method: "POST", body: payload }),
  },

  notes: {
    list: (params) => request("/notes", { params }),
    get: (id) => request(`/notes/${id}`),
    create: (payload) => request("/notes", { method: "POST", body: payload }),
    update: (id, patch) => request(`/notes/${id}`, { method: "PUT", body: patch }),
    remove: (id) => request(`/notes/${id}`, { method: "DELETE" }),
    uploadImage: (id, payload) => request(`/notes/${id}/images`, { method: "POST", body: payload }),
    deleteImage: (id, fileId) => request(`/notes/${id}/images/${fileId}`, { method: "DELETE" }),
  },

  exercises: {
    list: (params) => request("/exercises", { params }),
    get: (id) => request(`/exercises/${id}`),
    today: () => request("/exercises/daily/today"),
    run: (id, payload) => request(`/exercises/${id}/run`, { method: "POST", body: payload }),
    submit: (id, payload) => request(`/exercises/${id}/submit`, { method: "POST", body: payload }),
  },

  progress: {
    get: (userId) => request("/progress", { params: { userId } }),
  },

  projects: {
    list: () => request("/projects"),
    get: (id) => request(`/projects/${id}`),
  },

  ai: {
    generateExercises: (payload) => request("/ai/generate-exercises", { method: "POST", body: payload }),
    explainError: (payload) => request("/ai/explain-error", { method: "POST", body: payload }),
    hint: (payload) => request("/ai/hint", { method: "POST", body: payload }),
    tutor: (payload) => request("/ai/tutor", { method: "POST", body: payload }),
  },
};