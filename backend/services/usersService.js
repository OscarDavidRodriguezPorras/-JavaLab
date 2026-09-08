const drive = require("./googleDrive");
const { v4: uuidv4 } = require("uuid");

function fileName(userId) {
  return `${userId}.json`;
}

async function getUser(userId) {
  return drive.readJson("users", fileName(userId));
}

async function createUser({ name, email }) {
  const id = `user_${uuidv4().split("-")[0]}`;
  const user = {
    id,
    name,
    email,
    level: 1,
    xp: 0,
    streak: 0,
    lastStudyDate: null,
    achievements: [],
    createdAt: new Date().toISOString(),
  };
  await drive.writeJson("users", fileName(id), user);
  return user;
}

async function updateUser(userId, patch) {
  const user = await getUser(userId);
  if (!user) return null;
  const updated = { ...user, ...patch, id: user.id };
  await drive.writeJson("users", fileName(userId), updated);
  return updated;
}

async function addXp(userId, amount) {
  const user = await getUser(userId);
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
  const user = await getUser(userId);
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

module.exports = { getUser, createUser, updateUser, addXp, touchStreak };
