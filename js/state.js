const KEYS = {
  points: "zs_points_v1",
  unlocked: "zs_unlocked_v1",
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

export const appState = {
  screen: "loading",
  selectedLevel: 1,
  selectedCharacterId: "bob",
};
