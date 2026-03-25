/**
 * Shared bomb art: PNG paths, background stripping for shop + in-game HUD.
 */

const processedPng = new Map();

function uniformLightBackdrop(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lum = (r + g + b) / 3;
  return lum > 198 && max - min < 30;
}

export function applyBombPngBackgroundRemoval(img, originalSrc) {
  if (processedPng.has(originalSrc)) {
    img.src = processedPng.get(originalSrc);
    return;
  }
  const probe = new Image();
  probe.onload = () => {
    try {
      const w = probe.naturalWidth;
      const h = probe.naturalHeight;
      if (!w || !h) return;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      ctx.drawImage(probe, 0, 0);
      const d = ctx.getImageData(0, 0, w, h);
      const data = d.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (uniformLightBackdrop(r, g, b)) {
          data[i + 3] = 0;
        }
      }
      ctx.putImageData(d, 0, 0);
      const url = c.toDataURL("image/png");
      processedPng.set(originalSrc, url);
      img.src = url;
    } catch (e) {
      img.src = originalSrc;
    }
  };
  probe.onerror = () => {
    img.src = originalSrc;
  };
  probe.src = originalSrc;
}

export const BOMB_PNG_PATHS = {
  freezer: "assets/bomb-freezer.png",
  tnt: "assets/bomb-tnt.png",
  time_portal: "assets/bomb-time-portal.png",
};

const TRANSPARENT_GIF =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/**
 * Fills a container (e.g. span.bomb-art) with CSS bomb or PNG for the given loadout id.
 * @param {object} [options]
 * @param {string} [options.extraContainerClasses] e.g. "shop-bomb-art"
 * @param {string} [options.anniClass] default "bomb-art--anni"; shop uses "shop-bomb-art--anni"
 * @param {string} [options.imgClass] classes for the PNG image
 */
export function fillBombArtElement(container, bombId, options = {}) {
  const {
    extraContainerClasses = "",
    anniClass = "bomb-art--anni",
    imgClass = "bomb-art-img",
  } = options;

  const pngSrc = BOMB_PNG_PATHS[bombId];
  container.textContent = "";
  container.className = `bomb-art ${extraContainerClasses}`.trim();

  if (pngSrc) {
    const img = document.createElement("img");
    img.alt = "";
    img.className = imgClass;
    img.decoding = "async";
    img.src = TRANSPARENT_GIF;
    applyBombPngBackgroundRemoval(img, pngSrc);
    container.appendChild(img);
    return;
  }

  if (bombId === "annihilator") {
    container.classList.add(anniClass);
  }
  container.innerHTML =
    '<span class="bomb-fuse"></span><span class="bomb-body"></span><span class="bomb-band"></span>';
}
