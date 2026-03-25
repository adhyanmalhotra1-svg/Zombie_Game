const KEYS = {
  points: "zs_points_v1",
  unlocked: "zs_unlocked_v1",
  bombUnlocked: "zs_bomb_unlocked_v1",
  bombSelected: "zs_bomb_selected_v1",
  maxLevelCleared: "zs_max_level_cleared_v1",
};

function parseUnlocked(raw) {
  try {
    const a = JSON.parse(raw);
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

export function getPoints() {
  const n = parseInt(localStorage.getItem(KEYS.points) || "0", 10);
  return Number.isFinite(n) ? n : 0;
}

export function addPoints(delta) {
  const next = Math.max(0, getPoints() + delta);
  localStorage.setItem(KEYS.points, String(next));
  return next;
}

export function setPoints(n) {
  localStorage.setItem(KEYS.points, String(Math.max(0, n | 0)));
}

export function getUnlockedIds() {
  const defaults = ["bob", "marcus", "taylor"];
  const extra = parseUnlocked(localStorage.getItem(KEYS.unlocked)).map((id) => {
    if (id === "blaze") return "toxor";
    if (id === "iron_v") return "shadow";
    return id;
  });
  return [...new Set([...defaults, ...extra])];
}

export function unlockCharacter(id) {
  const ids = new Set(getUnlockedIds());
  ids.add(id);
  localStorage.setItem(KEYS.unlocked, JSON.stringify([...ids]));
}

export function isUnlocked(id) {
  return getUnlockedIds().includes(id);
}

export function getBombUnlockedIds() {
  try {
    const a = JSON.parse(localStorage.getItem(KEYS.bombUnlocked) || '["normal"]');
    return Array.isArray(a) && a.length ? a : ["normal"];
  } catch {
    return ["normal"];
  }
}

export function unlockBomb(id) {
  const s = new Set(getBombUnlockedIds());
  s.add(id);
  localStorage.setItem(KEYS.bombUnlocked, JSON.stringify([...s]));
}

export function isBombUnlocked(id) {
  return getBombUnlockedIds().includes(id);
}

export function getSelectedBombId() {
  const unlocked = getBombUnlockedIds();
  const raw = localStorage.getItem(KEYS.bombSelected);
  if (raw && unlocked.includes(raw)) return raw;
  return unlocked.includes("normal") ? "normal" : unlocked[0];
}

export function setSelectedBombId(id) {
  if (!isBombUnlocked(id)) return false;
  localStorage.setItem(KEYS.bombSelected, id);
  return true;
}

/** Highest level number the player has cleared (won). 0 = none yet. */
export function getMaxLevelCleared() {
  const n = parseInt(localStorage.getItem(KEYS.maxLevelCleared) || "0", 10);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(10, n));
}

/** Level L is playable iff L ≤ maxCleared + 1 (level 1 always first). */
export function isLevelUnlocked(level) {
  if (level < 1 || level > 10) return false;
  return level <= getMaxLevelCleared() + 1;
}

export function recordLevelCompleted(level) {
  if (level < 1 || level > 10) return;
  const cur = getMaxLevelCleared();
  if (level > cur) {
    localStorage.setItem(KEYS.maxLevelCleared, String(level));
  }
}

export const appState = {
  screen: "loading",
  selectedLevel: 1,
  selectedCharacterId: "bob",
};
