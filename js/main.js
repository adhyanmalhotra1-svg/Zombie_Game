/**
 * Entry: audio, navigation, game binding.
 */

import { appState, getSelectedBombId, recordLevelCompleted } from "./state.js";
import { fillBombArtElement } from "./bomb-assets.js";
import {
  showScreen,
  initLoadingPixelBg,
  buildLevelSelect,
  stepLevelPage,
  buildCharacterGrid,
  stepCharacterCarousel,
  rerenderCharacterCarousel,
  refreshPointsDisplay,
  buildShopBomb,
  stepShopBomb,
  tryBuyCurrentBomb,
  tryEquipCurrentBomb,
  setPendingUnlockAnimation,
  ensureLevelPageForUnlock,
} from "./ui-screens.js";
import {
  resumeAudio,
  startLoadingMusic,
  stopLoadingMusic,
  playUiClick,
} from "./audio.js";
import { createGame } from "./game.js";
import {
  loadSoldierSprite,
  loadHoodedSprites,
  loadLilTommySprite,
  loadZombieSprite,
  loadForestBackgroundImage,
  loadToxorSprite,
  loadShadowSprite,
} from "./sprites.js";

let audioStarted = false;
let gameApi = null;

function uiSound() {
  playUiClick();
}

function ensureAudio() {
  if (!audioStarted) {
    audioStarted = true;
    resumeAudio();
    startLoadingMusic();
  }
}

function goBlackThen(fn, ms = 2500) {
  const el = document.getElementById("overlay-black");
  el.hidden = false;
  setTimeout(() => {
    el.hidden = true;
    fn();
  }, ms);
}

function showLevelLoadingThenSelect() {
  showScreen("level-loading");
  const bar = document.getElementById("level-load-bar");
  if (bar) {
    bar.style.animation = "none";
    void bar.offsetWidth;
    bar.style.animation = "loadBar 1.8s ease-out forwards";
  }
  setTimeout(() => {
    showScreen("level-select");
    playUiClick();
  }, 2000);
}

function init() {
  initLoadingPixelBg();

  const btnStart = document.getElementById("btn-start");
  btnStart?.addEventListener("click", () => {
    ensureAudio();
    uiSound();
    goBlackThen(showLevelLoadingThenSelect, 2500);
  });

  buildLevelSelect((level) => {
    ensureAudio();
    uiSound();
    appState.selectedLevel = level;
    refreshPointsDisplay();
    buildCharacterGrid();
    showScreen("character");
  });

  document.getElementById("btn-level-back")?.addEventListener("click", () => {
    ensureAudio();
    uiSound();
    showScreen("loading");
  });

  document.getElementById("btn-shop-open")?.addEventListener("click", () => {
    ensureAudio();
    uiSound();
    refreshPointsDisplay();
    buildShopBomb();
    showScreen("shop");
  });

  document.getElementById("btn-shop-back")?.addEventListener("click", () => {
    ensureAudio();
    uiSound();
    showScreen("level-select");
  });

  document.getElementById("btn-shop-prev")?.addEventListener("click", () => {
    ensureAudio();
    uiSound();
    stepShopBomb(-1);
  });
  document.getElementById("btn-shop-next")?.addEventListener("click", () => {
    ensureAudio();
    uiSound();
    stepShopBomb(1);
  });

  document.getElementById("btn-shop-buy")?.addEventListener("click", () => {
    ensureAudio();
    if (tryBuyCurrentBomb()) playUiClick();
  });
  document.getElementById("btn-shop-equip")?.addEventListener("click", () => {
    ensureAudio();
    if (tryEquipCurrentBomb()) playUiClick();
  });

  document.getElementById("btn-level-page-prev")?.addEventListener("click", () => {
    ensureAudio();
    uiSound();
    stepLevelPage(-1);
  });
  document.getElementById("btn-level-page-next")?.addEventListener("click", () => {
    ensureAudio();
    uiSound();
    stepLevelPage(1);
  });

  document.getElementById("btn-char-back")?.addEventListener("click", () => {
    ensureAudio();
    uiSound();
    showScreen("level-select");
  });

  document.getElementById("btn-char-prev")?.addEventListener("click", () => {
    ensureAudio();
    uiSound();
    stepCharacterCarousel(-1);
  });
  document.getElementById("btn-char-next")?.addEventListener("click", () => {
    ensureAudio();
    uiSound();
    stepCharacterCarousel(1);
  });

  const canvas = document.getElementById("game-canvas");
  gameApi = createGame({
    canvas,
    wallHpEl: document.getElementById("wall-hp"),
    killsEl: document.getElementById("hud-kills"),
    levelNumEl: document.getElementById("hud-level-num"),
    bossBannerEl: document.getElementById("boss-banner"),
    gameOverEl: document.getElementById("game-over-overlay"),
    gameOverTextEl: document.querySelector(".game-over-text"),
    onGameOver: () => {
      stopLoadingMusic();
      showScreen("level-select");
      startLoadingMusic();
      refreshPointsDisplay();
    },
    onVictory: (payload) => {
      stopLoadingMusic();
      const wonLevel = payload?.level ?? appState.selectedLevel;
      const prevMax = getMaxLevelCleared();
      recordLevelCompleted(wonLevel);
      const newMax = getMaxLevelCleared();
      if (newMax > prevMax) {
        const nextOpen = newMax + 1;
        if (nextOpen <= 10) {
          setPendingUnlockAnimation(nextOpen);
          ensureLevelPageForUnlock(nextOpen);
        } else {
          setPendingUnlockAnimation(null);
        }
      } else {
        setPendingUnlockAnimation(null);
      }
      const vo = document.getElementById("victory-overlay");
      if (vo) vo.hidden = false;
      setTimeout(() => {
        if (vo) vo.hidden = true;
        showScreen("level-select");
        startLoadingMusic();
        refreshPointsDisplay();
      }, 2200);
    },
  });

  window.addEventListener("resize", () => gameApi?.resize());

  const left = document.getElementById("btn-left");
  const right = document.getElementById("btn-right");
  const shoot = document.getElementById("btn-shoot");

  const bindHold = (el, down, up) => {
    if (!el) return;
    const safeUp = () => up();
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      try {
        el.setPointerCapture(e.pointerId);
      } catch (_) {
        /* ignore */
      }
      down();
    });
    el.addEventListener("pointerup", safeUp);
    el.addEventListener("pointercancel", safeUp);
    el.addEventListener("lostpointercapture", safeUp);
  };

  bindHold(
    left,
    () => gameApi?.setLeft(true),
    () => gameApi?.setLeft(false)
  );
  bindHold(
    right,
    () => gameApi?.setRight(true),
    () => gameApi?.setRight(false)
  );
  shoot?.addEventListener(
    "pointerdown",
    (e) => {
      e.preventDefault();
      gameApi?.fire();
      refreshBombUI();
    },
    { passive: false }
  );

  function syncGameBombHudVisual() {
    const bombBtn = document.getElementById("btn-bomb");
    if (!bombBtn) return;
    const id = getSelectedBombId();
    if (bombBtn.dataset.bombHudId === id) return;
    bombBtn.dataset.bombHudId = id;
    const art = bombBtn.querySelector(".bomb-art");
    if (art) fillBombArtElement(art, id);
  }

  function refreshBombUI() {
    const bombBtn = document.getElementById("btn-bomb");
    const timerEl = document.getElementById("bomb-timer");
    const shootBtn = document.getElementById("btn-shoot");
    if (!bombBtn || !shootBtn) return;
    syncGameBombHudVisual();
    if (!gameApi?.getBombState) return;
    const st = gameApi.getBombState();
    const cd = st.cooldownRemainingMs;

    if (cd > 0) {
      bombBtn.classList.add("btn-bomb--cooldown");
      bombBtn.classList.remove("btn-bomb--armed");
      bombBtn.disabled = true;
      if (timerEl) {
        timerEl.hidden = false;
        const sec = Math.ceil(cd / 1000);
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        timerEl.textContent = `${m}:${String(s).padStart(2, "0")}`;
      }
    } else {
      bombBtn.classList.remove("btn-bomb--cooldown");
      if (timerEl) timerEl.hidden = true;
      if (st.carryingBomb) {
        bombBtn.disabled = true;
        bombBtn.classList.add("btn-bomb--armed");
      } else {
        bombBtn.disabled = false;
        bombBtn.classList.remove("btn-bomb--armed");
      }
    }

    if (st.carryingBomb) {
      shootBtn.textContent = "THROW";
      shootBtn.setAttribute("aria-label", "Throw bomb");
      shootBtn.classList.add("btn-throw");
    } else {
      shootBtn.textContent = "FIRE";
      shootBtn.setAttribute("aria-label", "Shoot");
      shootBtn.classList.remove("btn-throw");
    }
  }

  document.getElementById("btn-bomb")?.addEventListener(
    "pointerdown",
    (e) => {
      e.preventDefault();
      const sg = document.getElementById("screen-game");
      if (!sg || sg.hidden) return;
      if (gameApi?.pickBomb?.()) {
        playUiClick();
        refreshBombUI();
      }
    },
    { passive: false }
  );

  setInterval(() => {
    const g = document.getElementById("screen-game");
    if (g && !g.hidden && gameApi) refreshBombUI();
  }, 300);

  document.getElementById("btn-start-battle")?.addEventListener("click", () => {
    ensureAudio();
    uiSound();
    stopLoadingMusic();
    showScreen("game");
    requestAnimationFrame(() => {
      gameApi?.start({
        level: appState.selectedLevel,
        characterId: appState.selectedCharacterId,
      });
      refreshBombUI();
      requestAnimationFrame(() => gameApi?.resize());
    });
  });

  function isGameScreenActive() {
    const el = document.getElementById("screen-game");
    return el && !el.hidden;
  }

  function isCharacterScreenActive() {
    const el = document.getElementById("screen-character");
    return el && !el.hidden;
  }

  function isLevelSelectScreenActive() {
    const el = document.getElementById("screen-level-select");
    return el && !el.hidden;
  }

  function isShopScreenActive() {
    const el = document.getElementById("screen-shop");
    return el && !el.hidden;
  }

  window.addEventListener("keydown", (e) => {
    if (isShopScreenActive()) {
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        ensureAudio();
        uiSound();
        stepShopBomb(-1);
        return;
      }
      if (e.code === "ArrowRight") {
        e.preventDefault();
        ensureAudio();
        uiSound();
        stepShopBomb(1);
        return;
      }
    }
    if (isCharacterScreenActive()) {
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        ensureAudio();
        uiSound();
        stepCharacterCarousel(-1);
        return;
      }
      if (e.code === "ArrowRight") {
        e.preventDefault();
        ensureAudio();
        uiSound();
        stepCharacterCarousel(1);
        return;
      }
    }
    if (isLevelSelectScreenActive()) {
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        ensureAudio();
        uiSound();
        stepLevelPage(-1);
        return;
      }
      if (e.code === "ArrowRight") {
        e.preventDefault();
        ensureAudio();
        uiSound();
        stepLevelPage(1);
        return;
      }
    }
    if (!isGameScreenActive()) return;
    if (e.code === "ArrowLeft") {
      e.preventDefault();
      gameApi?.setLeft(true);
    } else if (e.code === "ArrowRight") {
      e.preventDefault();
      gameApi?.setRight(true);
    } else if (e.code === "Space") {
      e.preventDefault();
      gameApi?.fire();
      refreshBombUI();
    }
  });

  window.addEventListener("keyup", (e) => {
    if (!isGameScreenActive()) return;
    if (e.code === "ArrowLeft") {
      e.preventDefault();
      gameApi?.setLeft(false);
    } else if (e.code === "ArrowRight") {
      e.preventDefault();
      gameApi?.setRight(false);
    }
  });

  window.addEventListener("blur", () => {
    gameApi?.setLeft(false);
    gameApi?.setRight(false);
  });

  document.body.addEventListener(
    "pointerdown",
    () => {
      ensureAudio();
    },
    { once: true }
  );

  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener("voiceschanged", () => {
      window.speechSynthesis.getVoices();
    });
  }

  window.addEventListener("adhyan-liltommy-ready", () => {
    const el = document.getElementById("screen-character");
    if (el && !el.hidden) rerenderCharacterCarousel();
  });
  window.addEventListener("adhyan-shadow-ready", () => {
    const el = document.getElementById("screen-character");
    if (el && !el.hidden) rerenderCharacterCarousel();
  });
}

(async function boot() {
  try {
    await Promise.all([
      loadSoldierSprite(),
      loadHoodedSprites(),
      loadLilTommySprite(),
      loadZombieSprite(),
      loadToxorSprite(),
      loadShadowSprite(),
      loadForestBackgroundImage(),
    ]);
  } catch (e) {
    console.warn("Sprite load:", e);
  }
  init();
})();
