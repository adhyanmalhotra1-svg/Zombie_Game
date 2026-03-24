/**
 * Canvas gameplay: forest, wall, zombies, projectiles, boss phases.
 */

import { getCharacter, WEAPON } from "./characters.js";
import { addPoints } from "./state.js";
import {
  playShoot,
  playPlasmaShoot,
  playToxicPlasmaShoot,
  playGroan,
  playBossSting,
  speakBossFight,
  playWallBreachChorus,
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
    targetKills: 12 + level * 4,
  };
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

  const ctx = canvas.getContext("2d");

  function resize() {
    const parent = canvas.parentElement;
    const w = parent.clientWidth;
    const h = Math.max(280, Math.floor(window.innerHeight * 0.48));
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

    if (isBossLevel(level)) {
      swarmTarget = 6 + Math.min(level, 6);
      bossPhase = "swarm";
      targetKills = swarmTarget + 1;
    } else {
      targetKills = diff.targetKills;
      bossPhase = "horde";
    }
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

  function drawPlayer() {
    const h = canvas.height;
    const footY = h - 22;
    const c = getCharacter(charId);
    const ph = charId === "lil_tommy" ? 108 : 92;
    drawPlayerWithGear(ctx, playerX, footY, ph, c.weapon, charId);
  }

  function drawZombie(z) {
    if (!drawZombieSprite(ctx, z, playerX)) {
      ctx.fillStyle = z.isBoss ? "#3a5a2a" : "#2d3d2a";
      ctx.fillRect(z.x, z.y, z.w, z.h);
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
      const cap = 12 + level;
      if (
        killsThisRun < targetKills &&
        spawnAcc >= diff.spawnInterval &&
        zombies.length < cap
      ) {
        spawnAcc = 0;
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

    for (let zi = zombies.length - 1; zi >= 0; zi--) {
      const z = zombies[zi];

      if (z.state === "walk") {
        if (!wallCollapsed && z.y + z.h < wy) {
          z.y += z.speed * dt;
        } else if (!wallCollapsed && z.y + z.h >= wy) {
          z.y = wy - z.h;
          z.state = "punch";
          z.hitWall = true;
        } else if (wallCollapsed && breachDelayActive) {
          const capY = wy - z.h;
          if (z.y + z.h < wy) {
            z.y = Math.min(capY, z.y + z.speed * dt);
          } else {
            z.y = capY;
          }
        } else if (wallCollapsed) {
          z.y += z.speed * dt;
        }
      } else if (z.state === "punch") {
        if (wallCollapsed && !breachDelayActive) {
          z.state = "walk";
        } else if (wallCollapsed && breachDelayActive) {
          z.y = wy - z.h;
        } else {
          z.punchT += dt;
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
    drawParticles();
    drawPlayer();
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
    cancelAnimationFrame(raf);
    const bonus = 25 + level * 5;
    addPoints(bonus);
    onVictory?.({ score: score + bonus });
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
    fire: fireWeapon,
  };
}
