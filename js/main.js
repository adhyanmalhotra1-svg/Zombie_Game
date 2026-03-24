/**
 * Entry: audio, navigation, game binding.
 */

import { appState } from "./state.js";
import {
  showScreen,
  initLoadingPixelBg,
  buildLevelSelect,
  stepLevelPage,
  buildCharacterGrid,
  stepCharacterCarousel,
  rerenderCharacterCarousel,
  refreshPointsDisplay,
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

  document.getElementById("btn-start-battle")?.addEventListener("click", () => {
    ensureAudio();
    uiSound();
    stopLoadingMusic();
    showScreen("game");
    gameApi?.resize();
    gameApi?.start({
      level: appState.selectedLevel,
      characterId: appState.selectedCharacterId,
    });
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
    onVictory: () => {
      stopLoadingMusic();
      showScreen("level-select");
      startLoadingMusic();
      refreshPointsDisplay();
    },
  });

  window.addEventListener("resize", () => gameApi?.resize());

  const left = document.getElementById("btn-left");
  const right = document.getElementById("btn-right");
  const shoot = document.getElementById("btn-shoot");

  const bindHold = (el, down, up) => {
    el?.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      down();
    });
    el?.addEventListener("pointerup", up);
    el?.addEventListener("pointerleave", up);
    el?.addEventListener("pointercancel", up);
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
  shoot?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    gameApi?.fire();
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

  window.addEventListener("keydown", (e) => {
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
