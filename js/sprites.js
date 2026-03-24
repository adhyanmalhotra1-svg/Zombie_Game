/**
 * Muscular soldier (tinted for Bob/Marcus/Taylor) + Rox-only hooded sword sprite.
 */

import { WEAPON } from "./characters.js";

const SPRITE_URL = "assets/soldier-sprite.png";
const HOODED_URL = "assets/rox-hooded-base.png";
const TOMMY_MECHA_URL = "assets/lil-tommy-mecha.png";
const ZOMBIE_URL = "assets/zombie-sprite.png";
const TOXOR_URL = "assets/toxor-sprite.png";
const SHADOW_URL = "assets/shadow-sprite.png";
const FOREST_BG_URL = "assets/scary-forest-path.jpg";

/** Only Rox uses the red-cloak / big-sword art. */
export const HOODED_CHARACTER_IDS = ["rox"];

let processedCanvas = null;
let loadPromise = null;

/** Bob / Marcus / Taylor: same soldier pose, different multiply tints. */
const soldierTintCache = {};

const hoodedCache = {};
let hoodedPromise = null;

let lilTommyCanvas = null;
let lilTommyPromise = null;

let zombieCanvas = null;
let zombiePromise = null;

let toxorCanvas = null;
let toxorPromise = null;

let shadowCanvas = null;
let shadowPromise = null;

let forestBgImg = null;
let forestPromise = null;

function removeWhiteBackground(source) {
  const w = source.naturalWidth || source.width;
  const h = source.naturalHeight || source.height;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.drawImage(source, 0, 0);
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const thr = 248;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    if (r > thr && g > thr && b > thr) {
      d[i + 3] = 0;
    } else if (r > 235 && g > 235 && b > 235) {
      d[i + 3] = Math.floor((255 - (r + g + b) / 3) * 2.2);
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return c;
}

function removeBlackBackground(source) {
  const w = source.naturalWidth || source.width;
  const h = source.naturalHeight || source.height;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.drawImage(source, 0, 0);
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    if (r < 15 && g < 15 && b < 15) {
      d[i + 3] = 0;
    } else if (r < 42 && g < 42 && b < 42) {
      const edge = (r + g + b) / 3;
      d[i + 3] = Math.min(255, Math.floor(edge * 4.5));
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return c;
}

function cloneCanvas(c) {
  const n = document.createElement("canvas");
  n.width = c.width;
  n.height = c.height;
  n.getContext("2d").drawImage(c, 0, 0);
  return n;
}

function multiplyTint(source, rgb, alpha) {
  const c = cloneCanvas(source);
  const ctx = c.getContext("2d");
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  ctx.globalAlpha = alpha;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.restore();
  return c;
}

function buildFreeSoldierTints() {
  if (!processedCanvas) return;
  soldierTintCache.bob = multiplyTint(processedCanvas, [72, 118, 255], 0.38);
  soldierTintCache.marcus = multiplyTint(processedCanvas, [88, 200, 108], 0.36);
  soldierTintCache.taylor = multiplyTint(processedCanvas, [178, 88, 228], 0.36);
}

export function loadSoldierSprite() {
  if (processedCanvas) return Promise.resolve(processedCanvas);
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => {
      try {
        processedCanvas = removeWhiteBackground(im);
        buildFreeSoldierTints();
        resolve(processedCanvas);
      } catch (e) {
        reject(e);
      }
    };
    im.onerror = () => reject(new Error("soldier-sprite failed to load"));
    im.src = SPRITE_URL;
  });
  return loadPromise;
}

export function loadLilTommySprite() {
  if (lilTommyCanvas) return Promise.resolve(lilTommyCanvas);
  if (lilTommyPromise) return lilTommyPromise;
  lilTommyPromise = new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => {
      try {
        lilTommyCanvas = removeWhiteBackground(im);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("adhyan-liltommy-ready"));
        }
        resolve(lilTommyCanvas);
      } catch (e) {
        reject(e);
      }
    };
    im.onerror = () => reject(new Error("lil-tommy-mecha failed to load"));
    im.src = TOMMY_MECHA_URL;
  });
  return lilTommyPromise;
}

export function loadToxorSprite() {
  if (toxorCanvas) return Promise.resolve(toxorCanvas);
  if (toxorPromise) return toxorPromise;
  toxorPromise = new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => {
      try {
        toxorCanvas = removeWhiteBackground(im);
        resolve(toxorCanvas);
      } catch (e) {
        reject(e);
      }
    };
    im.onerror = () => reject(new Error("toxor-sprite failed to load"));
    im.src = TOXOR_URL;
  });
  return toxorPromise;
}

export function loadShadowSprite() {
  if (shadowCanvas) return Promise.resolve(shadowCanvas);
  if (shadowPromise) return shadowPromise;
  shadowPromise = new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => {
      try {
        shadowCanvas = removeWhiteBackground(im);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("adhyan-shadow-ready"));
        }
        resolve(shadowCanvas);
      } catch (e) {
        reject(e);
      }
    };
    im.onerror = () => reject(new Error("shadow-sprite failed to load"));
    im.src = SHADOW_URL;
  });
  return shadowPromise;
}

export function loadZombieSprite() {
  if (zombieCanvas) return Promise.resolve(zombieCanvas);
  if (zombiePromise) return zombiePromise;
  zombiePromise = new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => {
      try {
        zombieCanvas = removeWhiteBackground(im);
        resolve(zombieCanvas);
      } catch (e) {
        reject(e);
      }
    };
    im.onerror = () => reject(new Error("zombie-sprite failed to load"));
    im.src = ZOMBIE_URL;
  });
  return zombiePromise;
}

export function getZombieCanvas() {
  return zombieCanvas;
}

export function loadForestBackgroundImage() {
  if (forestBgImg?.complete && forestBgImg.naturalWidth > 0) {
    return Promise.resolve(forestBgImg);
  }
  if (forestPromise) return forestPromise;
  forestPromise = new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => {
      forestBgImg = im;
      resolve(im);
    };
    im.onerror = () => reject(new Error("scary-forest-path.jpg failed to load"));
    im.src = FOREST_BG_URL;
  });
  return forestPromise;
}

/**
 * Full-canvas forest path for gameplay. Rotates portrait art 90° so the path runs
 * horizontally, lining up with the stone wall band across the screen.
 */
export function drawForestGameBackground(ctx, w, h) {
  if (!forestBgImg?.naturalWidth) return false;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(Math.PI / 2);
  const iw = forestBgImg.naturalWidth;
  const ih = forestBgImg.naturalHeight;
  const scale = Math.max(h / iw, w / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(forestBgImg, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
  ctx.fillStyle = "rgba(0, 0, 0, 0.48)";
  ctx.fillRect(0, 0, w, h);
  return true;
}

/**
 * Draw walking zombie in hitbox z; faces toward playerX. Returns false if not loaded.
 */
export function drawZombieSprite(ctx, z, playerX) {
  const zc = zombieCanvas;
  if (!zc) return false;
  const ar = zc.width / zc.height;
  let dw = z.w;
  let dh = z.h;
  const boxAr = z.w / z.h;
  if (boxAr > ar) {
    dw = z.h * ar;
  } else {
    dh = z.w / ar;
  }
  const ox = z.x + (z.w - dw) / 2;
  const oy = z.y + (z.h - dh) / 2;
  const faceRight = z.x + z.w / 2 < playerX;
  ctx.save();
  if (faceRight) {
    ctx.translate(ox + dw, oy);
    ctx.scale(-1, 1);
    ctx.drawImage(zc, 0, 0, dw, dh);
  } else {
    ctx.drawImage(zc, ox, oy, dw, dh);
  }
  ctx.restore();
  return true;
}

export function loadHoodedSprites() {
  if (hoodedCache.rox) return Promise.resolve(hoodedCache);
  if (hoodedPromise) return hoodedPromise;
  hoodedPromise = new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => {
      try {
        hoodedCache.rox = removeBlackBackground(im);
        resolve(hoodedCache);
      } catch (e) {
        reject(e);
      }
    };
    im.onerror = () => reject(new Error("rox-hooded-base failed to load"));
    im.src = HOODED_URL;
  });
  return hoodedPromise;
}

export function getSoldierCanvas() {
  return processedCanvas;
}

export function getCharacterCanvas(characterId) {
  let id = characterId === "blaze" ? "toxor" : characterId;
  if (id === "iron_v") id = "shadow";
  /* Never fall back to the soldier sprite for Tommy — only the mech art. */
  if (characterId === "lil_tommy") return lilTommyCanvas;
  if (id === "toxor") return toxorCanvas;
  if (id === "shadow") return shadowCanvas;
  if (characterId === "rox" && hoodedCache.rox) return hoodedCache.rox;
  if (characterId === "bob" && soldierTintCache.bob) return soldierTintCache.bob;
  if (characterId === "marcus" && soldierTintCache.marcus) {
    return soldierTintCache.marcus;
  }
  if (characterId === "taylor" && soldierTintCache.taylor) {
    return soldierTintCache.taylor;
  }
  return processedCanvas;
}

/**
 * Draw character with feet near (centerX, bottomY). Faces right unless flipX.
 */
export function drawCharacterSprite(
  ctx,
  centerX,
  bottomY,
  maxHeight,
  flipX,
  characterId
) {
  const sc = getCharacterCanvas(characterId);
  if (!sc) return false;
  const scale = maxHeight / sc.height;
  const dw = sc.width * scale;
  const dh = sc.height * scale;
  ctx.save();
  if (flipX) {
    ctx.translate(centerX, bottomY);
    ctx.scale(-1, 1);
    ctx.drawImage(sc, -dw / 2, -dh, dw, dh);
  } else {
    ctx.drawImage(sc, centerX - dw / 2, bottomY - dh, dw, dh);
  }
  ctx.restore();
  return true;
}

export function drawPlayerWithGear(
  ctx,
  centerX,
  bottomY,
  maxHeight,
  weapon,
  characterId
) {
  const ok = drawCharacterSprite(
    ctx,
    centerX,
    bottomY,
    maxHeight,
    false,
    characterId
  );
  if (!ok) {
    ctx.fillStyle = "#2a3a2a";
    ctx.fillRect(centerX - 18, bottomY - maxHeight, 36, maxHeight);
    return;
  }

  const sc = getCharacterCanvas(characterId);
  const scale = maxHeight / sc.height;
  const dw = sc.width * scale;
  const isRoxHooded = characterId === "rox";

  if (weapon === WEAPON.MECHA_GUN && characterId !== "lil_tommy") {
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = "rgba(130, 180, 255, 0.55)";
    ctx.fillRect(centerX - dw / 2, bottomY - maxHeight, dw, maxHeight * 0.68);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = "rgba(220, 235, 255, 0.95)";
    ctx.lineWidth = 2;
    const hx = centerX + dw * 0.12;
    const hy = bottomY - maxHeight * 0.42;
    ctx.strokeRect(hx - 10, hy - 8, 20, 20);
    ctx.strokeRect(hx + 6, hy - 8, 20, 20);
    ctx.restore();
  }

  if (weapon === WEAPON.PLASMA && !isRoxHooded) {
    ctx.save();
    ctx.strokeStyle = "#aaf";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(centerX + dw * 0.08, bottomY - maxHeight * 0.52);
    ctx.lineTo(centerX + dw * 0.08, bottomY - maxHeight * 1.12);
    ctx.stroke();
    ctx.fillStyle = "#88f";
    ctx.fillRect(centerX + dw * 0.08 - 4, bottomY - maxHeight * 1.2, 8, 12);
    ctx.restore();
  }

  if (weapon === WEAPON.PLASMA && isRoxHooded) {
    ctx.save();
    ctx.strokeStyle = "rgba(80, 255, 160, 0.85)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#4f8";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(centerX + dw * 0.42, bottomY - maxHeight * 0.72);
    ctx.lineTo(centerX + dw * 0.62, bottomY - maxHeight * 0.95);
    ctx.stroke();
    ctx.restore();
  }

  if (weapon === WEAPON.TOXIC_PLASMA) {
    ctx.save();
    const glow = (gx, gy) => {
      const grd = ctx.createRadialGradient(gx, gy, 0, gx, gy, 5);
      grd.addColorStop(0, "rgba(200, 255, 120, 0.95)");
      grd.addColorStop(0.6, "rgba(40, 255, 0, 0.55)");
      grd.addColorStop(1, "rgba(0, 80, 0, 0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(gx, gy, 5, 0, Math.PI * 2);
      ctx.fill();
    };
    glow(centerX - dw * 0.22, bottomY - maxHeight * 0.52);
    glow(centerX + dw * 0.08, bottomY - maxHeight * 0.5);
    ctx.restore();
  }
}

/**
 * Mini preview for character cards (80x64 default).
 */
export function drawCharacterCardPreview(canvas, ch) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = "#070a08";
  ctx.fillRect(0, 0, w, h);
  const sc = getCharacterCanvas(ch.id);
  if (!sc) return;
  const maxH = h - 4;
  const scale = maxH / sc.height;
  const dw = sc.width * scale;
  const dh = sc.height * scale;
  const cx = w / 2;
  const bottom = h - 2;

  ctx.drawImage(sc, cx - dw / 2, bottom - dh, dw, dh);

  const isRoxHooded = ch.id === "rox";

  if (ch.weapon === WEAPON.PLASMA && !isRoxHooded) {
    ctx.strokeStyle = "#aaf";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + 6, bottom - dh * 0.5);
    ctx.lineTo(cx + 6, 4);
    ctx.stroke();
    ctx.fillStyle = "#88f";
    ctx.fillRect(cx + 2, 2, 8, 10);
  } else if (ch.weapon === WEAPON.MECHA_GUN && ch.id !== "lil_tommy") {
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = "rgba(140, 190, 255, 0.45)";
    ctx.fillRect(cx - dw / 2, bottom - dh, dw, dh * 0.65);
    ctx.restore();
  } else if (ch.weapon === WEAPON.TOXIC_PLASMA) {
    ctx.save();
    ctx.fillStyle = "rgba(80, 255, 60, 0.75)";
    ctx.shadowColor = "#4f8";
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(cx - 10, bottom - dh * 0.55, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 6, bottom - dh * 0.52, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** Loading screen: muscular soldier silhouettes only. */
export function drawSoldierSprite(ctx, centerX, bottomY, maxHeight, flipX) {
  const sc = processedCanvas;
  if (!sc) return false;
  const scale = maxHeight / sc.height;
  const dw = sc.width * scale;
  const dh = sc.height * scale;
  ctx.save();
  if (flipX) {
    ctx.translate(centerX, bottomY);
    ctx.scale(-1, 1);
    ctx.drawImage(sc, -dw / 2, -dh, dw, dh);
  } else {
    ctx.drawImage(sc, centerX - dw / 2, bottomY - dh, dw, dh);
  }
  ctx.restore();
  return true;
}
