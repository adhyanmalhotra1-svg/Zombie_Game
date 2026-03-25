/**
 * Canvas gameplay: forest, wall, zombies, projectiles, boss phases.
 */

import { getCharacter, WEAPON } from "./characters.js";
import { addPoints, getSelectedBombId } from "./state.js";
import {
  playShoot,
  playPlasmaShoot,
  playToxicPlasmaShoot,
  playGroan,
  playBossSting,
  speakBossFight,
  playWallBreachChorus,
  playBombExplosion,
  playBombThrowLaunch,
} from "./audio.js";
import {
  drawPlayerWithGear,
  drawZombieSprite,
  drawForestGameBackground,
} from "./sprites.js";

let lastGroan = 0;

const ZOMBIE_HP_NORMAL = 100;
const ZOMBIE_HP_BOSS = 800;

/** Walk speed at level 10 (= 100%). Level n uses n×10% of this (level 1 = 10%, etc.). */
const ZOMBIE_SPEED_FULL = 260;

/** Global slowdown applied to all zombies (0.9 = 10% slower). */
const ZOMBIE_SPEED_SCALE = 0.9;

function zombieBaseSpeed(level) {
  const pct = Math.min(level, 10) / 10;
  return ZOMBIE_SPEED_FULL * pct * ZOMBIE_SPEED_SCALE;
}

function levelDifficulty(level) {
  const t = level - 1;
  return {
    spawnInterval: Math.max(0.55, 1.35 - t * 0.06),
  };
}

/** Total normal zombies to clear in horde levels (not boss). */
function getHordeTargetKills(level) {
  if (level >= 1 && level <= 4) {
    return 10 + (level - 1) * 5;
  }
  if (level >= 6 && level <= 9) {
    return 20 + (level - 6) * 5;
  }
  return 15;
}

function isBossLevel(level) {
  return level === 5 || level === 10;
}

export function createGame(deps) {
  const {
    canvas,
    wallHpEl,
    killsEl,
    levelNumEl,
    bossBannerEl,
    gameOverEl,
    gameOverTextEl,
    onGameOver,
    onVictory,
  } = deps;

  let raf = 0;
  let running = false;
  let level = 1;
  let charId = "bob";
  let wallMax = 100;
  let wallHp = 100;
  let wallCollapsed = false;
  let score = 0;
  let zombies = [];
  let projectiles = [];
  let particles = [];
  let playerX = 0;
  let lastShot = 0;
  let spawnAcc = 0;
  let spawnCount = 0;
  /** Horde mode only: how many zombies have been spawned this run (caps at targetKills). */
  let hordeSpawnedCount = 0;
  let bossPhase = "normal";
  let swarmTarget = 0;
  let bossIntroDone = false;
  let matchEnded = false;
  let bossAlive = false;
  let targetKills = 0;
  let killsThisRun = 0;
  let keys = { left: false, right: false };
  let punchFlash = 0;
  /** Wall just broke; GAME OVER runs after 500ms. */
  let pendingGameOverId = 0;
  let carryingBomb = false;
  /** `performance.now()` when bomb cooldown ends (1 min after throw). */
  let bombCooldownEnd = 0;
  /** Wind-up → arc → burst; null when idle. */
  let bombAnim = null;
  /** Defer victory until explosion burst finishes (visual). */
  let pendingVictoryAfterBomb = false;
  /** Time Portal: global slow for all zombies (performance.now() end). */
  let globalSlowUntil = 0;

  const ctx = canvas.getContext("2d");

  function resize() {
    const parent = canvas.parentElement;
    const w = parent.clientWidth;
    let h = canvas.clientHeight || canvas.offsetHeight;
    if (!h || h < 120) {
      h = Math.max(280, Math.floor(window.innerHeight * 0.48));
    }
    h = Math.max(200, Math.floor(h));
    canvas.width = w;
    canvas.height = h;
    playerX = w / 2;
  }

  function resetRun() {
    const diff = levelDifficulty(level);
    wallMax = 100 + (level - 1) * 15;
    wallHp = wallMax;
    wallCollapsed = false;
    zombies = [];
    projectiles = [];
    particles = [];
    spawnAcc = 0;
    spawnCount = 0;
    hordeSpawnedCount = 0;
    bossIntroDone = false;
    matchEnded = false;
    bossAlive = false;
    bossPhase = "normal";
    lastGroan = 0;
    punchFlash = 0;
    if (pendingGameOverId) {
      clearTimeout(pendingGameOverId);
      pendingGameOverId = 0;
    }
    carryingBomb = false;
    bombCooldownEnd = 0;
    bombAnim = null;
    pendingVictoryAfterBomb = false;
    globalSlowUntil = 0;

    if (isBossLevel(level)) {
      swarmTarget = 5;
      bossPhase = "swarm";
      targetKills = swarmTarget + 1;
    } else {
      targetKills = getHordeTargetKills(level);
      bossPhase = "horde";
    }
  }

  function pickBomb() {
    if (matchEnded || !running) return false;
    if (bombAnim) return false;
    if (carryingBomb) return false;
    if (performance.now() < bombCooldownEnd) return false;
    carryingBomb = true;
    return true;
  }

  function getBombHandPosition() {
    const h = canvas.height;
    const footY = h - 22;
    const ph = charId === "lil_tommy" ? 108 : 92;
    return {
      bx: playerX + (charId === "lil_tommy" ? 24 : 14),
      by: footY - ph * 0.38,
    };
  }

  function getBombBlastRadius() {
    return Math.min(canvas.width, canvas.height) * 0.2 + 40;
  }

  /** Squared distance from point to closest point on zombie rect (hit test for circular blast). */
  function distSqPointToZombie(px, py, z) {
    const cx = Math.max(z.x, Math.min(px, z.x + z.w));
    const cy = Math.max(z.y, Math.min(py, z.y + z.h));
    const dx = px - cx;
    const dy = py - cy;
    return dx * dx + dy * dy;
  }

  /**
   * Aim where the blast will hit the most zombies: try each zombie’s center as a candidate
   * blast origin, pick the one with the largest hit count, then nudge to the centroid of that cluster.
   */
  function computeBombTarget() {
    const w = canvas.width;
    const h = canvas.height;
    const wy = wallY();
    const rSq = getBombBlastRadius() ** 2;

    if (zombies.length === 0) {
      return {
        ex: Math.max(48, Math.min(w - 48, w * 0.5)),
        ey: Math.max(36, Math.min(wy - 48, h * 0.28)),
      };
    }

    let bestCx = zombies[0].x + zombies[0].w / 2;
    let bestCy = zombies[0].y + zombies[0].h / 2;
    let bestCount = -1;
    let bestTie = Infinity;

    for (const cand of zombies) {
      const cx = cand.x + cand.w / 2;
      const cy = cand.y + cand.h / 2;
      let cnt = 0;
      let sumDistSq = 0;
      for (const z of zombies) {
        if (distSqPointToZombie(cx, cy, z) > rSq) continue;
        cnt++;
        const zx = z.x + z.w / 2;
        const zy = z.y + z.h / 2;
        const ddx = zx - cx;
        const ddy = zy - cy;
        sumDistSq += ddx * ddx + ddy * ddy;
      }
      if (cnt > bestCount || (cnt === bestCount && sumDistSq < bestTie)) {
        bestCount = cnt;
        bestTie = sumDistSq;
        bestCx = cx;
        bestCy = cy;
      }
    }

    let sx = 0;
    let sy = 0;
    let n = 0;
    for (const z of zombies) {
      if (distSqPointToZombie(bestCx, bestCy, z) > rSq) continue;
      sx += z.x + z.w / 2;
      sy += z.y + z.h / 2;
      n++;
    }
    if (n > 0) {
      bestCx = sx / n;
      bestCy = sy / n;
    }

    const ex = Math.max(48, Math.min(w - 48, bestCx));
    const ey = Math.max(36, Math.min(wy - 48, bestCy));
    return { ex, ey };
  }

  function spawnMassiveExplosionParticles(ex, ey) {
    const w = canvas.width;
    const h = canvas.height;
    for (let i = 0; i < 95; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 90 + Math.random() * 420;
      const isFire = Math.random() > 0.35;
      particles.push({
        x: ex + (Math.random() - 0.5) * 28,
        y: ey + (Math.random() - 0.5) * 28,
        t: 0.55 + Math.random() * 0.45,
        life: 0.85,
        kind: isFire ? "fireSpark" : "smokePuff",
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
      });
    }
    for (let i = 0; i < 45; i++) {
      particles.push({
        x: ex,
        y: ey,
        t: 0.35 + Math.random() * 0.35,
        life: 0.55,
        kind: "fireSpark",
        vx: (Math.random() - 0.5) * 620,
        vy: (Math.random() - 0.5) * 620,
      });
    }
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2;
      particles.push({
        x: ex + Math.cos(ang) * 8,
        y: ey + Math.sin(ang) * 8,
        t: 0.4 + Math.random() * 0.2,
        life: 0.55,
        kind: "fireTrail",
        vx: Math.cos(ang) * (180 + Math.random() * 120),
        vy: Math.sin(ang) * (180 + Math.random() * 120),
      });
    }
  }

  function killZombieAt(zi) {
    const z = zombies[zi];
    const pts = z.isBoss ? 100 : 10;
    addPoints(pts);
    score += pts;
    killsThisRun++;
    if (z.isBoss) bossAlive = false;
    zombies.splice(zi, 1);
  }

  function checkBombWaveOutcome() {
    killsEl.textContent = String(score);
    if (bossPhase === "boss" && !bossAlive && zombies.length === 0) {
      pendingVictoryAfterBomb = true;
      return;
    }
    if (bossPhase === "horde" && killsThisRun >= targetKills && zombies.length === 0) {
      pendingVictoryAfterBomb = true;
      return;
    }
    if (
      bossPhase === "swarm" &&
      spawnCount >= swarmTarget &&
      zombies.length === 0 &&
      !bossIntroDone
    ) {
      bossIntroDone = true;
      triggerBossIntro();
    }
  }

  /**
   * Bomb effect depends on equipped upgrade (shop).
   */
  function applyBombEffect(cx, cy) {
    const rSq = getBombBlastRadius() ** 2;
    const id = getSelectedBombId();
    const now = performance.now();

    if (id === "annihilator") {
      const mid = canvas.width * 0.5;
      const bombLeft = cx < mid;
      for (let zi = zombies.length - 1; zi >= 0; zi--) {
        const z = zombies[zi];
        const zx = z.x + z.w * 0.5;
        const zLeft = zx < mid;
        if (zLeft !== bombLeft) continue;
        killZombieAt(zi);
      }
      checkBombWaveOutcome();
      return;
    }

    if (id === "time_portal") {
      globalSlowUntil = now + 10_000;
      checkBombWaveOutcome();
      return;
    }

    if (id === "freezer") {
      const until = now + 30_000;
      for (const z of zombies) {
        if (distSqPointToZombie(cx, cy, z) <= rSq) {
          z.frozenUntil = until;
        }
      }
      checkBombWaveOutcome();
      return;
    }

    if (id === "normal") {
      for (let zi = zombies.length - 1; zi >= 0; zi--) {
        const z = zombies[zi];
        if (distSqPointToZombie(cx, cy, z) > rSq) continue;
        z.hp = Math.max(0, z.hp - z.maxHp * 0.5);
        if (z.hp <= 0) {
          killZombieAt(zi);
        }
      }
      checkBombWaveOutcome();
      return;
    }

    /* tnt — destroy in blast radius */
    for (let zi = zombies.length - 1; zi >= 0; zi--) {
      const z = zombies[zi];
      if (distSqPointToZombie(cx, cy, z) > rSq) continue;
      killZombieAt(zi);
    }
    checkBombWaveOutcome();
  }

  function startBombThrow() {
    if (matchEnded || !running || !carryingBomb || bombAnim) return;
    carryingBomb = false;
    projectiles.length = 0;
    playBombThrowLaunch();
    const { bx, by } = getBombHandPosition();
    const { ex, ey } = computeBombTarget();
    const arcH = Math.min(140, Math.abs(by - ey) * 0.45 + 90);
    bombAnim = {
      phase: "windup",
      t: 0,
      sx: bx,
      sy: by,
      ex,
      ey,
      arcH,
      burstX: ex,
      burstY: ey,
    };
  }

  function updateBombAnim(dt) {
    if (!bombAnim) return;
    const b = bombAnim;
    b.t += dt;

    if (b.phase === "windup") {
      if (b.t >= 0.14) {
        b.phase = "arc";
        b.t = 0;
      }
      return;
    }

    if (b.phase === "arc") {
      const dur = 0.74;
      const p = Math.min(1, b.t / dur);
      const px = b.sx + (b.ex - b.sx) * p;
      const py =
        b.sy +
        (b.ey - b.sy) * p -
        Math.sin(p * Math.PI) * b.arcH;
      if (Math.random() < 0.65 * dt * 60) {
        particles.push({
          x: px + (Math.random() - 0.5) * 8,
          y: py + (Math.random() - 0.5) * 8,
          t: 0.2 + Math.random() * 0.15,
          life: 0.28,
          kind: "fireTrail",
          vx: (Math.random() - 0.5) * 40,
          vy: 30 + Math.random() * 50,
        });
      }
      if (b.t >= dur) {
        b.phase = "burst";
        b.t = 0;
        b.burstX = b.ex;
        b.burstY = b.ey;
        spawnMassiveExplosionParticles(b.ex, b.ey);
        playBombExplosion();
        bombCooldownEnd = performance.now() + 60_000;
        applyBombEffect(b.ex, b.ey);
      }
      return;
    }

    if (b.phase === "burst") {
      if (b.t >= 0.7) {
        bombAnim = null;
        if (pendingVictoryAfterBomb) {
          pendingVictoryAfterBomb = false;
          endVictory();
        }
      }
    }
  }

  function drawBombWorldSprite(x, y, rot, scale) {
    const r = 14 * scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.strokeStyle = "#2a2a2a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -r - 6);
    ctx.lineTo(3, -r);
    ctx.stroke();
    ctx.fillStyle = "#444";
    ctx.beginPath();
    ctx.arc(1, -r - 2, 3, 0, Math.PI * 2);
    ctx.fill();
    const grd = ctx.createRadialGradient(-4, -4, 2, 0, 0, r);
    grd.addColorStop(0, "#666");
    grd.addColorStop(0.5, "#2a2a2a");
    grd.addColorStop(1, "#0a0a0a");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 200, 80, 0.9)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-6, 2);
    ctx.lineTo(3, -4);
    ctx.lineTo(8, 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawBombThrowLayer() {
    if (!bombAnim) return;
    const b = bombAnim;
    if (b.phase === "windup") {
      const w = Math.min(1, b.t / 0.14);
      const rot = -0.75 * Math.sin(w * Math.PI * 0.5);
      drawBombWorldSprite(b.sx, b.sy, rot, 1);
      return;
    }
    if (b.phase === "arc") {
      const dur = 0.74;
      const p = Math.min(1, b.t / dur);
      const x = b.sx + (b.ex - b.sx) * p;
      const y =
        b.sy +
        (b.ey - b.sy) * p -
        Math.sin(p * Math.PI) * b.arcH;
      const rot = p * Math.PI * 2.4;
      drawBombWorldSprite(x, y, rot, 1);
    }
  }

  function drawBombExplosionFX() {
    if (!bombAnim || bombAnim.phase !== "burst") return;
    const bx = bombAnim.burstX;
    const by = bombAnim.burstY;
    const pr = Math.min(1, bombAnim.t / 0.7);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 7; i++) {
      const rMax = 35 + i * 52;
      const r = rMax * (0.15 + pr * 0.92);
      const a = Math.max(0, (1 - pr * 0.85) * (0.5 - i * 0.06));
      ctx.strokeStyle = `rgba(255, ${200 - i * 22}, ${60 + i * 8}, ${a})`;
      ctx.lineWidth = 5 - i * 0.45;
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(255, 200, 80, ${0.35 * (1 - pr)})`;
    ctx.beginPath();
    ctx.arc(bx, by, 25 + pr * 180, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBombFlashOverlay() {
    if (!bombAnim || bombAnim.phase !== "burst") return;
    const pr = Math.min(1, bombAnim.t / 0.7);
    ctx.save();
    ctx.fillStyle = `rgba(255, 248, 220, ${0.2 * (1 - pr * 0.92)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function throwBomb() {
    startBombThrow();
  }

  function fireOrThrow() {
    if (bombAnim) return;
    if (carryingBomb) {
      throwBomb();
      return;
    }
    fireWeapon();
  }

  function fireWeapon() {
    const c = getCharacter(charId);
    const now = performance.now();
    if (now - lastShot < 220) return;
    lastShot = now;
    const lifeFraction = c.shotLifeFraction ?? 0.1;
    const footY = canvas.height - 22;
    let muzzleY = footY - 52;
    let gunX = playerX - 3;
    if (charId === "lil_tommy") {
      muzzleY = footY - 68;
      gunX = playerX + 20;
    }
    if (c.weapon === WEAPON.PLASMA) {
      playPlasmaShoot();
      projectiles.push({
        x: playerX - 6,
        y: muzzleY,
        w: 12,
        h: 22,
        dy: -520,
        lifeFraction,
        kind: "plasma",
      });
      projectiles.push({
        x: playerX + 2,
        y: muzzleY,
        w: 12,
        h: 22,
        dy: -520,
        lifeFraction,
        kind: "plasma",
      });
    } else if (c.weapon === WEAPON.TOXIC_PLASMA) {
      playToxicPlasmaShoot();
      const s = 6;
      const spd = -600;
      projectiles.push({
        x: playerX - 4,
        y: muzzleY - 2,
        w: s,
        h: s,
        dy: spd,
        lifeFraction,
        kind: "toxic",
      });
      projectiles.push({
        x: playerX + 2,
        y: muzzleY - 1,
        w: s,
        h: s,
        dy: spd,
        lifeFraction,
        kind: "toxic",
      });
    } else if (charId === "shadow") {
      playShoot();
      const spd = -640;
      const wRocket = 10;
      const hRocket = 20;
      projectiles.push({
        x: playerX - 10,
        y: muzzleY - 2,
        w: wRocket,
        h: hRocket,
        dy: spd,
        lifeFraction,
        kind: "fire",
      });
      projectiles.push({
        x: playerX + 2,
        y: muzzleY - 2,
        w: wRocket,
        h: hRocket,
        dy: spd,
        lifeFraction,
        kind: "fire",
      });
    } else {
      if (c.weapon === WEAPON.MECHA_GUN) playShoot();
      else playShoot();
      projectiles.push({
        x: gunX,
        y: muzzleY,
        w: 6,
        h: 14,
        dy: -640,
        lifeFraction,
        kind: c.weapon === WEAPON.MECHA_GUN ? "mecha" : "bullet",
      });
    }
  }

  function spawnZombie(isBoss = false) {
    const w = canvas.width;
    const margin = 40;
    const x = margin + Math.random() * (w - margin * 2);
    const zw = isBoss ? 72 : 38 + Math.random() * 10;
    const zh = isBoss ? 92 : 48 + Math.random() * 8;
    const maxHp = isBoss ? ZOMBIE_HP_BOSS : ZOMBIE_HP_NORMAL;
    const hp = maxHp;
    const base = zombieBaseSpeed(level);
    const speed = isBoss
      ? base * 0.55
      : bossPhase === "swarm"
        ? base * (1.35 + Math.random() * 0.35)
        : base * (0.85 + Math.random() * 0.3);

    zombies.push({
      x,
      y: -zh - 5,
      w: zw,
      h: zh,
      hp,
      maxHp,
      speed,
      isBoss,
      state: "walk",
      punchT: 0,
      hitWall: false,
      frozenUntil: 0,
    });

    const now = performance.now();
    if (now - lastGroan > 900) {
      lastGroan = now;
      playGroan();
    }
  }

  function triggerBossIntro() {
    bossPhase = "boss_intro";
    bossBannerEl.hidden = false;
    playBossSting();
    speakBossFight();
    setTimeout(() => {
      bossBannerEl.hidden = true;
      bossPhase = "boss";
      bossAlive = true;
      spawnZombie(true);
    }, 2200);
  }

  function drawForest() {
    const w = canvas.width;
    const h = canvas.height;
    if (drawForestGameBackground(ctx, w, h)) {
      return;
    }
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#060808");
    g.addColorStop(0.4, "#0f1812");
    g.addColorStop(1, "#020403");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(15, 25, 18, 0.5)";
    for (let i = 0; i < 18; i++) {
      const tx = ((i * 97) % w) + 10;
      const th = 80 + (i % 5) * 25;
      ctx.beginPath();
      ctx.moveTo(tx, h);
      ctx.lineTo(tx + 12, h - th);
      ctx.lineTo(tx + 24, h);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(30, 40, 35, 0.25)";
    ctx.fillRect(0, h * 0.35, w, h * 0.65);
  }

  function wallY() {
    return canvas.height * 0.38;
  }

  function drawWall() {
    const wy = wallY();
    const w = canvas.width;
    const thick = 14;

    if (wallHp <= 0) {
      ctx.fillStyle = "rgba(40, 35, 30, 0.6)";
      ctx.fillRect(0, wy, w, thick * 2);
      ctx.fillStyle = "rgba(20, 15, 12, 0.9)";
      for (let i = 0; i < 12; i++) {
        ctx.fillRect((i * w) / 12 + 2, wy + 4 + (i % 3) * 2, w / 12 - 6, 8);
      }
      return;
    }

    const pct = wallHp / wallMax;
    ctx.fillStyle = "#2a2a32";
    ctx.fillRect(0, wy, w, thick);
    ctx.fillStyle = `rgba(120, 110, 90, ${0.5 + pct * 0.5})`;
    ctx.fillRect(0, wy, w * pct, thick);
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 2;
    for (let x = 0; x < w; x += 36) {
      ctx.strokeRect(x, wy, 34, thick);
    }
    if (punchFlash > 0) {
      ctx.fillStyle = `rgba(255, 200, 100, ${punchFlash * 0.4})`;
      ctx.fillRect(0, wy, w, thick);
      punchFlash *= 0.85;
    }
  }

  function drawCarriedBomb() {
    if (!carryingBomb) return;
    const h = canvas.height;
    const footY = h - 22;
    const ph = charId === "lil_tommy" ? 108 : 92;
    const bx = playerX + (charId === "lil_tommy" ? 24 : 14);
    const by = footY - ph * 0.38;
    const r = 14;
    ctx.save();
    ctx.strokeStyle = "#2a2a2a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx, by - r - 6);
    ctx.lineTo(bx + 3, by - r);
    ctx.stroke();
    ctx.fillStyle = "#444";
    ctx.beginPath();
    ctx.arc(bx + 1, by - r - 2, 3, 0, Math.PI * 2);
    ctx.fill();
    const grd = ctx.createRadialGradient(bx - 4, by - 4, 2, bx, by, r);
    grd.addColorStop(0, "#666");
    grd.addColorStop(0.5, "#2a2a2a");
    grd.addColorStop(1, "#0a0a0a");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 200, 80, 0.9)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx - 6, by + 2);
    ctx.lineTo(bx + 3, by - 4);
    ctx.lineTo(bx + 8, by + 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawPlayer() {
    const h = canvas.height;
    const footY = h - 22;
    const c = getCharacter(charId);
    const ph = charId === "lil_tommy" ? 108 : 92;
    drawPlayerWithGear(ctx, playerX, footY, ph, c.weapon, charId);
    drawCarriedBomb();
  }

  function drawZombie(z) {
    if (!drawZombieSprite(ctx, z, playerX)) {
      ctx.fillStyle = z.isBoss ? "#3a5a2a" : "#2d3d2a";
      ctx.fillRect(z.x, z.y, z.w, z.h);
    }
    const now = performance.now();
    if (z.frozenUntil && now < z.frozenUntil) {
      ctx.save();
      ctx.fillStyle = "rgba(130, 210, 255, 0.38)";
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeStyle = "rgba(200, 245, 255, 0.85)";
      ctx.lineWidth = 2;
      ctx.strokeRect(z.x + 1, z.y + 1, z.w - 2, z.h - 2);
      ctx.restore();
    }
    const hpw = (z.hp / z.maxHp) * z.w;
    ctx.fillStyle = "#800";
    ctx.fillRect(z.x, z.y - 6, z.w, 4);
    ctx.fillStyle = "#0f0";
    ctx.fillRect(z.x, z.y - 6, hpw, 4);
  }

  function simulateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t -= dt;
      if (p.vx != null) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      if (p.t <= 0) particles.splice(i, 1);
    }
  }

  function spawnFireTrailBehind(p) {
    const n = 2 + Math.floor(Math.random() * 2);
    for (let k = 0; k < n; k++) {
      const life = 0.18 + Math.random() * 0.14;
      particles.push({
        x: p.x + p.w * 0.5 + (Math.random() - 0.5) * 6,
        y: p.y + p.h + 2 + Math.random() * 6,
        t: life,
        life,
        kind: "fireTrail",
        vx: (Math.random() - 0.5) * 90,
        vy: 40 + Math.random() * 100,
      });
    }
  }

  function update(dt) {
    updateBombAnim(dt);
    if (matchEnded) return;
    simulateParticles(dt);
    const wy = wallY();
    const w = canvas.width;
    const h = canvas.height;
    const diff = levelDifficulty(level);
    /* While waiting for GAME OVER, keep zombies at the wall — no rushing through. */
    const breachDelayActive = pendingGameOverId !== 0;

    if (keys.left) playerX = Math.max(28, playerX - 220 * dt);
    if (keys.right) playerX = Math.min(w - 28, playerX + 220 * dt);

    spawnAcc += dt;

    if (bossPhase === "horde") {
      const maxOnScreen = Math.min(6 + Math.floor(level / 2), 11);
      if (
        hordeSpawnedCount < targetKills &&
        spawnAcc >= diff.spawnInterval &&
        zombies.length < maxOnScreen
      ) {
        spawnAcc = 0;
        hordeSpawnedCount++;
        spawnZombie(false);
      }
    } else if (bossPhase === "swarm") {
      if (spawnCount < swarmTarget && spawnAcc >= diff.spawnInterval * 0.85) {
        spawnAcc = 0;
        spawnCount++;
        spawnZombie(false);
      }
      if (
        spawnCount >= swarmTarget &&
        zombies.length === 0 &&
        !bossIntroDone
      ) {
        bossIntroDone = true;
        triggerBossIntro();
      }
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.y += p.dy * dt;
      if (p.kind === "fire") {
        spawnFireTrailBehind(p);
      }
      if (p.y < -20) projectiles.splice(i, 1);
    }

    const now = performance.now();
    const slowMul = now < globalSlowUntil ? 0.25 : 1;

    for (let zi = zombies.length - 1; zi >= 0; zi--) {
      const z = zombies[zi];

      const frozen = z.frozenUntil && now < z.frozenUntil;

      if (!frozen) {
      if (z.state === "walk") {
        if (!wallCollapsed && z.y + z.h < wy) {
          z.y += z.speed * slowMul * dt;
        } else if (!wallCollapsed && z.y + z.h >= wy) {
          z.y = wy - z.h;
          z.state = "punch";
          z.hitWall = true;
        } else if (wallCollapsed && breachDelayActive) {
          const capY = wy - z.h;
          if (z.y + z.h < wy) {
            z.y = Math.min(capY, z.y + z.speed * slowMul * dt);
          } else {
            z.y = capY;
          }
        } else if (wallCollapsed) {
          z.y += z.speed * slowMul * dt;
        }
      } else if (z.state === "punch") {
        if (wallCollapsed && !breachDelayActive) {
          z.state = "walk";
        } else if (wallCollapsed && breachDelayActive) {
          z.y = wy - z.h;
        } else {
          z.punchT += dt * slowMul;
          if (z.punchT > 0.45) {
            z.punchT = 0;
            const dmg = z.isBoss ? 2 : 1;
            if (wallHp > 0) {
              wallHp = Math.max(0, wallHp - dmg);
              punchFlash = 1;
              wallHpEl.textContent = String(Math.ceil(wallHp));
              if (wallHp <= 0) {
                wallCollapsed = true;
                if (!pendingGameOverId) {
                  playWallBreachChorus();
                  pendingGameOverId = setTimeout(() => {
                    pendingGameOverId = 0;
                    beginGameOver();
                  }, 500);
                }
                return;
              }
            }
          }
        }
      }
      }

      let zombieRemoved = false;
      for (let pi = projectiles.length - 1; pi >= 0; pi--) {
        const p = projectiles[pi];
        if (
          p.x < z.x + z.w &&
          p.x + p.w > z.x &&
          p.y < z.y + z.h &&
          p.y + p.h > z.y
        ) {
          const frac = p.lifeFraction ?? 0.1;
          z.hp = Math.max(0, z.hp - z.maxHp * frac);
          projectiles.splice(pi, 1);
          if (p.kind === "fire") {
            const cx = p.x + p.w / 2;
            const cy = p.y + p.h / 2;
            for (let s = 0; s < 8; s++) {
              const life = 0.12 + Math.random() * 0.14;
              particles.push({
                x: cx,
                y: cy,
                t: life,
                life,
                kind: "fireSpark",
                vx: (Math.random() - 0.5) * 320,
                vy: (Math.random() - 0.5) * 320,
              });
            }
          } else {
            particles.push({ x: p.x, y: p.y, t: 0.2, kind: p.kind });
          }
          if (z.hp <= 0) {
            const pts = z.isBoss ? 100 : 10;
            addPoints(pts);
            score += pts;
            killsThisRun++;
            killsEl.textContent = String(score);
            if (z.isBoss) bossAlive = false;
            zombies.splice(zi, 1);
            zombieRemoved = true;
            if (bossPhase === "boss" && !bossAlive && zombies.length === 0) {
              endVictory();
            }
          }
          break;
        }
      }
      if (zombieRemoved) continue;
    }

    if (
      bossPhase === "horde" &&
      killsThisRun >= targetKills &&
      zombies.length === 0
    ) {
      endVictory();
    }
  }

  function drawParticles() {
    for (const p of particles) {
      if (p.kind === "fireTrail" || p.kind === "fireSpark") {
        const life = p.life ?? 0.25;
        const a = Math.min(1, p.t / life);
        const r = p.kind === "fireSpark" ? 3 + 2 * (1 - a) : 4 + 3 * (1 - a);
        ctx.save();
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        grd.addColorStop(0, `rgba(255, 255, 230, ${a * 0.95})`);
        grd.addColorStop(0.35, `rgba(255, 180, 60, ${a * 0.85})`);
        grd.addColorStop(0.7, `rgba(255, 80, 20, ${a * 0.5})`);
        grd.addColorStop(1, "rgba(80, 20, 0, 0)");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (p.kind === "smokePuff") {
        const life = p.life ?? 0.55;
        const a = Math.min(1, p.t / life);
        const r = 10 + 22 * (1 - a);
        ctx.save();
        ctx.globalAlpha = a * 0.65;
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        grd.addColorStop(0, "rgba(70, 70, 78, 0.85)");
        grd.addColorStop(0.5, "rgba(40, 40, 48, 0.45)");
        grd.addColorStop(1, "rgba(20, 20, 24, 0)");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle =
          p.kind === "plasma"
            ? "#7f3"
            : p.kind === "toxic"
              ? "#4f8"
              : "#fc8";
        ctx.fillRect(p.x, p.y, 6, 6);
      }
    }
  }

  function drawProjectiles() {
    for (const p of projectiles) {
      if (p.kind === "plasma") {
        ctx.fillStyle = "#4f8";
        ctx.shadowColor = "#8f8";
        ctx.shadowBlur = 8;
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.shadowBlur = 0;
      } else if (p.kind === "toxic") {
        const cx = p.x + p.w / 2;
        const cy = p.y + p.h / 2;
        const r = p.w / 2;
        ctx.save();
        ctx.shadowColor = "rgba(0, 255, 120, 0.9)";
        ctx.shadowBlur = 9;
        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grd.addColorStop(0, "#e8ffc4");
        grd.addColorStop(0.45, "#39ff14");
        grd.addColorStop(1, "#0d5c0d");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(180, 255, 140, 0.85)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      } else if (p.kind === "fire") {
        ctx.save();
        const cx = p.x + p.w / 2;
        const cy = p.y + p.h / 2;
        ctx.shadowColor = "rgba(255, 120, 30, 0.9)";
        ctx.shadowBlur = 14;
        const grd = ctx.createLinearGradient(p.x, p.y + p.h, p.x, p.y);
        grd.addColorStop(0, "#ff3300");
        grd.addColorStop(0.45, "#ffaa33");
        grd.addColorStop(1, "#ffffcc");
        ctx.fillStyle = grd;
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255, 255, 240, 0.95)";
        ctx.fillRect(p.x + p.w * 0.35, p.y + 2, p.w * 0.3, p.h * 0.35);
        ctx.restore();
      } else {
        ctx.fillStyle = p.kind === "mecha" ? "#fa8" : "#ff0";
        ctx.fillRect(p.x, p.y, p.w, p.h);
      }
    }
  }

  let lastT = 0;
  function frame(t) {
    if (!running) return;
    const dt = Math.min(0.05, (t - lastT) / 1000) || 0.016;
    lastT = t;
    drawForest();
    drawWall();
    for (const z of zombies) drawZombie(z);
    drawProjectiles();
    drawPlayer();
    drawBombThrowLayer();
    drawBombExplosionFX();
    drawParticles();
    drawBombFlashOverlay();
    update(dt);
    raf = requestAnimationFrame(frame);
  }

  let gameOverRunning = false;

  function beginGameOver() {
    if (gameOverRunning || matchEnded) return;
    if (pendingGameOverId) {
      clearTimeout(pendingGameOverId);
      pendingGameOverId = 0;
    }
    matchEnded = true;
    gameOverRunning = true;
    running = false;
    carryingBomb = false;
    bombAnim = null;
    pendingVictoryAfterBomb = false;
    globalSlowUntil = 0;
    cancelAnimationFrame(raf);
    gameOverEl.hidden = false;
    gameOverEl.classList.add("visible");
    gameOverTextEl.style.opacity = "0";
    gameOverTextEl.textContent = "GAME OVER";
    document.body.style.background = "#000";
    setTimeout(() => {
      gameOverTextEl.style.transition = "opacity 0.45s ease";
      gameOverTextEl.style.opacity = "1";
    }, 0);
    setTimeout(() => {
      gameOverEl.classList.remove("visible");
      gameOverTextEl.style.opacity = "0";
      setTimeout(() => {
        gameOverEl.hidden = true;
        document.body.style.background = "";
        onGameOver?.();
        gameOverRunning = false;
      }, 500);
    }, 3200);
  }

  function endVictory() {
    if (matchEnded) return;
    if (pendingGameOverId) {
      clearTimeout(pendingGameOverId);
      pendingGameOverId = 0;
    }
    matchEnded = true;
    running = false;
    carryingBomb = false;
    bombAnim = null;
    pendingVictoryAfterBomb = false;
    globalSlowUntil = 0;
    cancelAnimationFrame(raf);
    const bonus = 25 + level * 5;
    addPoints(bonus);
    onVictory?.({ score: score + bonus, level });
  }

  return {
    start(opts) {
      if (pendingGameOverId) {
        clearTimeout(pendingGameOverId);
        pendingGameOverId = 0;
      }
      level = opts.level;
      charId = opts.characterId;
      resize();
      resetRun();
      score = 0;
      killsThisRun = 0;
      killsEl.textContent = "0";
      wallHpEl.textContent = String(Math.ceil(wallHp));
      levelNumEl.textContent = String(level);
      bossBannerEl.hidden = true;
      gameOverEl.hidden = true;
      gameOverEl.classList.remove("visible");
      if (gameOverTextEl) {
        gameOverTextEl.style.opacity = "";
        gameOverTextEl.style.transition = "";
      }
      lastT = performance.now();
      running = true;
      lastShot = 0;
      raf = requestAnimationFrame(frame);
    },
    pickBomb,
    getBombState() {
      const cd = Math.max(0, bombCooldownEnd - performance.now());
      return {
        carryingBomb,
        cooldownRemainingMs: cd,
      };
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      if (pendingGameOverId) {
        clearTimeout(pendingGameOverId);
        pendingGameOverId = 0;
      }
    },
    resize,
    setLeft(v) {
      keys.left = v;
    },
    setRight(v) {
      keys.right = v;
    },
    fire: fireOrThrow,
  };
}
