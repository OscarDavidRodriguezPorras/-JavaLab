const drive = require("./googleDrive");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

function fileName(userId) {
  return `${userId}.json`;
}

/** Nunca dejamos salir el hash de la contraseña hacia el frontend. */
function sanitize(user) {
  if (!user) return user;
  const { passwordHash, ...safe } = user;
  return safe;
}

/** Lectura interna, CON passwordHash. Solo debe usarse dentro de este archivo. */
async function getUserRaw(userId) {
  return drive.readJson("users", fileName(userId));
}

/** Lectura pública, sin passwordHash. Es la que deben usar controladores y otros servicios. */
async function getUser(userId) {
  return sanitize(await getUserRaw(userId));
}

async function findByEmailRaw(email) {
  const all = await drive.listJson("users");
  const normalized = email.trim().toLowerCase();
  return all.find((u) => (u.email || "").trim().toLowerCase() === normalized) || null;
}

/** Crea una cuenta nueva. Lanza un error con code "EMAIL_TAKEN" si el correo ya existe. */
async function register({ name, email, password }) {
  const existing = await findByEmailRaw(email);
  if (existing) {
    const err = new Error("Ya existe una cuenta con ese correo.");
    err.code = "EMAIL_TAKEN";
    throw err;
  }

  const id = `user_${uuidv4().split("-")[0]}`;
  const passwordHash = bcrypt.hashSync(password, 10);
  const user = {
    id,
    name,
    email,
    passwordHash,
    level: 1,
    xp: 0,
    streak: 0,
    lastStudyDate: null,
    achievements: [],
    createdAt: new Date().toISOString(),
  };
  await drive.writeJson("users", fileName(id), user);
  return sanitize(user);
}

/** Verifica correo + contraseña. Devuelve el usuario (sin hash) si son correctos, o null si no. */
async function login({ email, password }) {
  const user = await findByEmailRaw(email);
  if (!user) return null;
  const valid = bcrypt.compareSync(password, user.passwordHash || "");
  if (!valid) return null;
  return sanitize(user);
}

async function updateUser(userId, patch) {
  const user = await getUserRaw(userId);
  if (!user) return null;
  // Nunca permitir que un patch externo pise el id o la contraseña por accidente.
  const { passwordHash, id, ...safePatch } = patch;
  const updated = { ...user, ...safePatch, id: user.id };
  await drive.writeJson("users", fileName(userId), updated);
  return sanitize(updated);
}

async function addXp(userId, amount) {
  const user = await getUserRaw(userId);
  if (!user) return null;
  const { levelForXp } = require("./progressService");
  const newXp = user.xp + amount;
  const newLevel = levelForXp(newXp).level;
  const leveledUp = newLevel > user.level;
  const updated = await updateUser(userId, { xp: newXp, level: newLevel });
  updated.leveledUp = leveledUp;
  return updated;
}

async function touchStreak(userId) {
  const user = await getUserRaw(userId);
  if (!user) return null;

  const today = new Date().toISOString().slice(0, 10);
  const last = user.lastStudyDate ? user.lastStudyDate.slice(0, 10) : null;

  let streak = user.streak || 0;
  if (last === today) {
    // ya contaba hoy, no cambia
  } else if (isYesterday(last, today)) {
    streak += 1;
  } else {
    streak = 1;
  }

  return updateUser(userId, { streak, lastStudyDate: new Date().toISOString() });
}

function isYesterday(lastDateStr, todayStr) {
  if (!lastDateStr) return false;
  const last = new Date(lastDateStr);
  const today = new Date(todayStr);
  const diffDays = Math.round((today - last) / (1000 * 60 * 60 * 24));
  return diffDays === 1;
}

module.exports = { getUser, register, login, updateUser, addXp, touchStreak, findByEmailRaw };