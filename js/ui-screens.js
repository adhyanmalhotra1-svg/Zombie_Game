/**
 * DOM wiring: loading pixel atmosphere, level line + pages, character cards.
 */

import { CHARACTERS } from "./characters.js";
import {
  appState,
  getPoints,
  addPoints,
  isUnlocked,
  unlockCharacter,
  unlockBomb,
  isBombUnlocked,
  getSelectedBombId,
  setSelectedBombId,
  isLevelUnlocked,
} from "./state.js";
import { BOMB_UPGRADES } from "./bomb-upgrades.js";
import { fillBombArtElement, BOMB_PNG_PATHS } from "./bomb-assets.js";
import {
  getSoldierCanvas,
  drawSoldierSprite,
  drawCharacterCardPreview,
} from "./sprites.js";

let levelSelectPage = 0;
let levelPickCallback = null;

/** Level number (2–10) that should play chain-break when first shown after a win. */
let pendingUnlockAnimLevel = null;

const BOSS_SPOTLIGHT_PREFIX = "zs_boss_spotlight_";

function markBossSpotlight(levelNum) {
  if (levelNum !== 5 && levelNum !== 10) return;
  try {
    sessionStorage.setItem(`${BOSS_SPOTLIGHT_PREFIX}${levelNum}`, "1");
  } catch (_) {
    /* ignore */
  }
}

function hasBossSpotlight(levelNum) {
  if (levelNum !== 5 && levelNum !== 10) return false;
  try {
    return sessionStorage.getItem(`${BOSS_SPOTLIGHT_PREFIX}${levelNum}`) === "1";
  } catch (_) {
    return false;
  }
}

export function setPendingUnlockAnimation(levelNum) {
  pendingUnlockAnimLevel =
    levelNum == null || levelNum < 2 || levelNum > 10 ? null : levelNum;
}

export function ensureLevelPageForUnlock(levelNum) {
  if (levelNum < 1 || levelNum > 10) return;
  levelSelectPage = levelNum <= 5 ? 0 : 1;
}

function buildChainSide(sideClass) {
  const side = document.createElement("div");
  side.className = `level-chain-side ${sideClass}`;
  const tilt = document.createElement("div");
  tilt.className = "level-chain-tilt";
  for (let i = 0; i < 5; i++) {
    const link = document.createElement("span");
    link.className = "level-link" + (i % 2 ? " level-link--alt" : "");
    tilt.appendChild(link);
  }
  side.appendChild(tilt);
  return side;
}

function createLevelChainDecor() {
  const wrap = document.createElement("div");
  wrap.className = "level-chain-wrap";
  wrap.setAttribute("aria-hidden", "true");

  wrap.appendChild(buildChainSide("level-chain-side--left"));
  wrap.appendChild(buildChainSide("level-chain-side--right"));

  const lock = document.createElement("div");
  lock.className = "level-lock-cluster";
  const shackle = document.createElement("span");
  shackle.className = "level-lock-shackle";
  const shackleHole = document.createElement("span");
  shackleHole.className = "level-lock-shackle-hole";
  shackle.appendChild(shackleHole);
  const body = document.createElement("span");
  body.className = "level-lock-body";
  const face = document.createElement("span");
  face.className = "level-lock-face";
  const keyhole = document.createElement("span");
  keyhole.className = "level-lock-keyhole";
  const rivetL = document.createElement("span");
  rivetL.className = "level-lock-rivet level-lock-rivet--l";
  const rivetR = document.createElement("span");
  rivetR.className = "level-lock-rivet level-lock-rivet--r";
  body.appendChild(face);
  body.appendChild(keyhole);
  body.appendChild(rivetL);
  body.appendChild(rivetR);
  lock.appendChild(shackle);
  lock.appendChild(body);

  wrap.insertBefore(lock, wrap.firstChild.nextSibling);
  return wrap;
}

export function showScreen(id) {
  document.querySelectorAll(".screen").forEach((el) => {
    el.hidden = true;
    el.classList.remove("screen-active");
  });
  const target = document.getElementById(`screen-${id}`);
  if (target) {
    target.hidden = false;
    target.classList.add("screen-active");
  }
  if (id === "level-select") {
    renderLevelSelect();
  }
}

export function initLoadingPixelBg() {
  const host = document.getElementById("pixel-bg-loading");
  if (!host) return;
  const c = document.createElement("canvas");
  c.width = 480;
  c.height = 280;
  c.style.width = "100%";
  c.style.height = "100%";
  c.style.objectFit = "cover";
  host.appendChild(c);
  const ctx = c.getContext("2d");
  let t = 0;
  function loop() {
    t += 0.018;
    const w = c.width;
    const h = c.height;
    const soldier = getSoldierCanvas();
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#0a0a14");
    g.addColorStop(0.5, "#06060c");
    g.addColorStop(1, "#030305");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    if (soldier) {
      for (let i = 0; i < 16; i++) {
        const px = ((i * 67 + t * 22) % (w + 120)) - 60;
        const py = 30 + (i % 4) * 62 + Math.sin(t * 0.9 + i * 0.7) * 14;
        const scale = 0.1 + (i % 5) * 0.026;
        const dw = soldier.width * scale;
        const dh = soldier.height * scale;
        const footX = px + dw / 2;
        ctx.save();
        ctx.globalAlpha = 0.18 + (i % 6) * 0.065;
        drawSoldierSprite(ctx, footX, py, dh, i % 3 === 1);
        ctx.restore();
        ctx.globalAlpha = 1;
        if (i % 2 === 0) {
          ctx.fillStyle = "rgba(45, 72, 38, 0.42)";
          ctx.fillRect(px + dw + 4, py - 20, 16, 20);
        }
      }
    }
    requestAnimationFrame(loop);
  }
  loop();
}

function renderLevelSelect() {
  const grid = document.getElementById("level-buttons");
  const hint = document.getElementById("level-page-hint");
  const prevBtn = document.getElementById("btn-level-page-prev");
  const nextBtn = document.getElementById("btn-level-page-next");
  if (!grid) return;
  grid.innerHTML = "";
  const start = levelSelectPage * 5;
  for (let i = 0; i < 5; i++) {
    const levelNum = start + i + 1;
    const isBoss = levelNum === 5 || levelNum === 10;
    const unlocked = isLevelUnlocked(levelNum);
    const slot = document.createElement("div");
    slot.className =
      "level-slot" +
      (isBoss ? " level-slot-boss" : "") +
      (!unlocked ? " level-slot--locked" : "");
    if (isBoss) {
      const skull = document.createElement("span");
      skull.className = "level-boss-skull";
      skull.textContent = "💀";
      skull.setAttribute("aria-hidden", "true");
      const tag = document.createElement("span");
      tag.className = "level-boss-tag";
      tag.textContent = "BOSS FIGHT";
      slot.appendChild(skull);
      slot.appendChild(tag);
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "level-btn level-btn-line" +
      (isBoss ? " level-btn-boss" : "") +
      (!unlocked ? " level-btn--locked" : "");
    btn.textContent = String(levelNum);
    btn.disabled = !unlocked;
    btn.setAttribute("aria-disabled", unlocked ? "false" : "true");
    if (!unlocked) {
      btn.title = "Complete the previous level to unlock";
    }
    btn.addEventListener("click", () => {
      if (!isLevelUnlocked(levelNum)) return;
      levelPickCallback?.(levelNum);
    });
    slot.appendChild(btn);

    if (
      isBoss &&
      unlocked &&
      hasBossSpotlight(levelNum) &&
      !(pendingUnlockAnimLevel != null && pendingUnlockAnimLevel === levelNum)
    ) {
      slot.classList.add("level-slot--boss-revealed");
      btn.classList.add("level-btn--boss-revealed");
    }

    const playUnlock =
      unlocked &&
      pendingUnlockAnimLevel != null &&
      pendingUnlockAnimLevel === levelNum;

    if (!unlocked) {
      slot.appendChild(createLevelChainDecor());
    } else if (playUnlock) {
      slot.classList.add("level-slot--unlocking");
      const decor = createLevelChainDecor();
      slot.appendChild(decor);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          decor.classList.add("level-chain-wrap--break");
        });
      });
      setTimeout(() => {
        decor.remove();
        slot.classList.remove("level-slot--unlocking");
        pendingUnlockAnimLevel = null;
        if (isBoss) {
          markBossSpotlight(levelNum);
          slot.classList.add("level-slot--boss-revealed");
          btn.classList.add("level-btn--boss-revealed");
        }
      }, 1900);
    }

    grid.appendChild(slot);
  }
  if (hint) {
    hint.textContent = levelSelectPage === 0 ? "Levels 1–5" : "Levels 6–10";
  }
  if (prevBtn) prevBtn.disabled = levelSelectPage === 0;
  if (nextBtn) nextBtn.disabled = levelSelectPage === 1;
}

/**
 * Page 0: levels 1–5. Page 1: levels 6–10. Arrows / Arrow keys.
 */
export function stepLevelPage(delta) {
  const next = Math.max(0, Math.min(1, levelSelectPage + delta));
  if (next === levelSelectPage) return;
  levelSelectPage = next;
  renderLevelSelect();
}

export function buildLevelSelect(onPickLevel) {
  levelPickCallback = onPickLevel;
  levelSelectPage = 0;
  renderLevelSelect();
}

const DEFAULT_PREVIEW = { w: 80, h: 64 };
const CAROUSEL_PREVIEW = { w: 120, h: 96 };

function makeCharPreview(card, ch, size = DEFAULT_PREVIEW) {
  const pw = size.w;
  const ph = size.h;
  const prev = document.createElement("div");
  prev.className = "char-preview";
  const rc = document.createElement("canvas");
  rc.width = pw;
  rc.height = ph;
  drawCharacterCardPreview(rc, ch);
  prev.appendChild(rc);
  card.appendChild(prev);
}

export function refreshPointsDisplay() {
  const pts = String(getPoints());
  const el = document.getElementById("points-display");
  if (el) el.textContent = pts;
  const shopPts = document.getElementById("shop-points-display");
  if (shopPts) shopPts.textContent = pts;
}

let carouselIndex = 0;

function tryAutoUnlock(ch) {
  const pts = getPoints();
  if (ch.cost > 0 && pts >= ch.cost && !isUnlocked(ch.id)) {
    unlockCharacter(ch.id);
  }
}

function renderCharacterCarousel(onSelect) {
  const slot = document.getElementById("character-slot");
  const counter = document.getElementById("char-carousel-counter");
  if (!slot) return;

  const ch = CHARACTERS[carouselIndex];
  if (!ch) return;

  tryAutoUnlock(ch);
  const unlocked = ch.cost === 0 || isUnlocked(ch.id);
  if (unlocked) {
    appState.selectedCharacterId = ch.id;
    onSelect?.(ch.id);
  }

  slot.innerHTML = "";
  const card = document.createElement("div");
  card.className = "char-card char-card-single";
  if (!unlocked) card.classList.add("char-locked");
  else card.classList.add("char-selected");

  const name = document.createElement("div");
  name.className = "char-name";
  name.textContent = ch.name;

  const cost = document.createElement("div");
  cost.className = "char-cost";
  if (ch.cost === 0) cost.textContent = "FREE";
  else if (unlocked) cost.textContent = `UNLOCKED (${ch.cost} pts)`;
  else cost.textContent = `LOCKED — ${ch.cost} pts`;

  card.appendChild(name);
  card.appendChild(cost);
  makeCharPreview(card, ch, CAROUSEL_PREVIEW);
  slot.appendChild(card);

  if (counter) {
    counter.textContent = `${carouselIndex + 1} / ${CHARACTERS.length}`;
  }

  const battleBtn = document.getElementById("btn-start-battle");
  if (battleBtn) {
    battleBtn.disabled = !unlocked;
    battleBtn.classList.toggle("btn-disabled", !unlocked);
    battleBtn.setAttribute("aria-disabled", unlocked ? "false" : "true");
  }
}

/**
 * Move carousel by ±1 (wraps). Buttons and ArrowLeft/ArrowRight call this from main while character screen is open.
 */
export function stepCharacterCarousel(delta, onSelect) {
  carouselIndex =
    (carouselIndex + delta + CHARACTERS.length) % CHARACTERS.length;
  renderCharacterCarousel(onSelect);
}

export function buildCharacterGrid(onSelect) {
  const idx = CHARACTERS.findIndex((c) => c.id === appState.selectedCharacterId);
  carouselIndex = idx >= 0 ? idx : 0;
  renderCharacterCarousel(onSelect);
}

/** Re-draw current fighter card (e.g. mech art finished loading). Does not change carousel index. */
export function rerenderCharacterCarousel() {
  renderCharacterCarousel(undefined);
}

/* --- Bomb shop (carousel like character select) --- */

function createShopBombPreviewEl(bombId) {
  const wrap = document.createElement("div");
  wrap.className = "shop-bomb-preview-wrap";
  if (BOMB_PNG_PATHS[bombId]) {
    wrap.classList.add("shop-bomb-preview--asset");
  }
  const art = document.createElement("span");
  art.setAttribute("aria-hidden", "true");
  fillBombArtElement(art, bombId, {
    extraContainerClasses: "shop-bomb-art",
    anniClass: "shop-bomb-art--anni",
    imgClass: "bomb-art-img shop-bomb-sprite-img",
  });
  wrap.appendChild(art);
  return wrap;
}

let shopBombIndex = 0;

export function buildShopBomb() {
  const sel = getSelectedBombId();
  const i = BOMB_UPGRADES.findIndex((b) => b.id === sel);
  shopBombIndex = i >= 0 ? i : 0;
  renderShopBomb();
}

export function stepShopBomb(delta) {
  shopBombIndex =
    (shopBombIndex + delta + BOMB_UPGRADES.length) % BOMB_UPGRADES.length;
  renderShopBomb();
}

export function renderShopBomb() {
  const slot = document.getElementById("shop-bomb-slot");
  const counter = document.getElementById("shop-bomb-counter");
  const ptsEl = document.getElementById("shop-points-display");
  const buyBtn = document.getElementById("btn-shop-buy");
  const equipBtn = document.getElementById("btn-shop-equip");
  if (!slot) return;

  const b = BOMB_UPGRADES[shopBombIndex];
  const pts = getPoints();
  const unlocked = isBombUnlocked(b.id);
  const selected = getSelectedBombId() === b.id;

  if (ptsEl) ptsEl.textContent = String(pts);

  slot.innerHTML = "";
  const card = document.createElement("div");
  card.className = "shop-bomb-card";
  card.appendChild(createShopBombPreviewEl(b.id));
  const title = document.createElement("div");
  title.className = "shop-bomb-name";
  title.textContent = b.name;
  const desc = document.createElement("p");
  desc.className = "shop-bomb-desc";
  desc.textContent = b.desc;
  const cost = document.createElement("div");
  cost.className = "shop-bomb-cost";
  if (b.cost === 0) {
    cost.textContent = "FREE — always available";
  } else if (unlocked) {
    cost.textContent = `OWNED — you spent ${b.cost} pts`;
  } else {
    cost.textContent = `LOCKED — ${b.cost} pts to unlock`;
  }

  card.appendChild(title);
  card.appendChild(desc);
  card.appendChild(cost);
  slot.appendChild(card);

  if (counter) {
    counter.textContent = `${shopBombIndex + 1} / ${BOMB_UPGRADES.length}`;
  }

  if (buyBtn) {
    const canBuy = !unlocked && b.cost > 0 && pts >= b.cost;
    buyBtn.hidden = unlocked || b.cost === 0;
    buyBtn.disabled = !canBuy;
    buyBtn.textContent = unlocked ? "OWNED" : `BUY (${b.cost} pts)`;
  }
  if (equipBtn) {
    equipBtn.hidden = !unlocked;
    equipBtn.disabled = selected;
    equipBtn.textContent = selected ? "EQUIPPED" : "EQUIP";
  }
}

export function tryBuyCurrentBomb() {
  const b = BOMB_UPGRADES[shopBombIndex];
  if (isBombUnlocked(b.id) || b.cost === 0) return false;
  const pts = getPoints();
  if (pts < b.cost) return false;
  addPoints(-b.cost);
  unlockBomb(b.id);
  setSelectedBombId(b.id);
  refreshPointsDisplay();
  renderShopBomb();
  return true;
}

export function tryEquipCurrentBomb() {
  const b = BOMB_UPGRADES[shopBombIndex];
  if (!isBombUnlocked(b.id)) return false;
  setSelectedBombId(b.id);
  renderShopBomb();
  return true;
}
