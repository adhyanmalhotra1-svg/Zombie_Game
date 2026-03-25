/**
 * Web Audio: rap-style loop, UI blips, game SFX.
 */

let ctx = null;
let loadingLoopTimer = null;
let loadingGain = null;

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export async function resumeAudio() {
  const c = getCtx();
  if (c && c.state === "suspended") await c.resume();
}

function beep(freq, dur, type = "square", vol = 0.08) {
  const c = getCtx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(c.currentTime);
  o.stop(c.currentTime + dur + 0.02);
}

export function playUiClick() {
  resumeAudio();
  beep(880, 0.04, "square", 0.06);
  setTimeout(() => beep(1320, 0.03, "square", 0.04), 20);
}

/** Whoosh when the bomb leaves the throw arc. */
export function playBombThrowLaunch() {
  resumeAudio();
  beep(120, 0.06, "square", 0.06);
  setTimeout(() => beep(200, 0.08, "sawtooth", 0.07), 30);
  setTimeout(() => beep(90, 0.12, "triangle", 0.06), 70);
}

/** Heavy impact for bomb clearing the field. */
export function playBombExplosion() {
  resumeAudio();
  beep(90, 0.22, "sawtooth", 0.14);
  setTimeout(() => beep(55, 0.18, "square", 0.1), 40);
  setTimeout(() => beep(140, 0.1, "square", 0.08), 120);
  setTimeout(() => beep(70, 0.15, "sawtooth", 0.1), 200);
}

export function playShoot() {
  const c = getCtx();
  if (!c) return;
  resumeAudio();
  const t = c.currentTime;
  const noise = c.createBufferSource();
  const buf = c.createBuffer(1, c.sampleRate * 0.08, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
  noise.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1800;
  const g = c.createGain();
  g.gain.setValueAtTime(0.15, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  noise.connect(bp);
  bp.connect(g);
  g.connect(c.destination);
  noise.start(t);
  noise.stop(t + 0.09);
}

export function playPlasmaShoot() {
  const c = getCtx();
  if (!c) return;
  resumeAudio();
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(400, t);
  o.frequency.exponentialRampToValueAtTime(2400, t + 0.06);
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  const o2 = c.createOscillator();
  o2.type = "square";
  o2.frequency.setValueAtTime(1200, t);
  o2.connect(g);
  o.connect(g);
  g.connect(c.destination);
  o.start(t);
  o2.start(t);
  o.stop(t + 0.13);
  o2.stop(t + 0.13);
}

/** Toxor: quick high chirp + short hiss for small toxic orbs. */
export function playToxicPlasmaShoot() {
  const c = getCtx();
  if (!c) return;
  resumeAudio();
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(900, t);
  o.frequency.exponentialRampToValueAtTime(3200, t + 0.04);
  g.gain.setValueAtTime(0.09, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  o.connect(g);
  g.connect(c.destination);
  o.start(t);
  o.stop(t + 0.09);
  const o2 = c.createOscillator();
  const g2 = c.createGain();
  o2.type = "square";
  o2.frequency.setValueAtTime(2100, t);
  g2.gain.setValueAtTime(0.05, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  o2.connect(g2);
  g2.connect(c.destination);
  o2.start(t);
  o2.stop(t + 0.07);
  const noise = c.createBufferSource();
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * 0.05), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.25;
  noise.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2400;
  const gn = c.createGain();
  gn.gain.setValueAtTime(0.06, t);
  gn.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  noise.connect(bp);
  bp.connect(gn);
  gn.connect(c.destination);
  noise.start(t);
  noise.stop(t + 0.06);
}

export function playGroan() {
  const c = getCtx();
  if (!c) return;
  resumeAudio();
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(180, t);
  o.frequency.linearRampToValueAtTime(90, t + 0.25);
  g.gain.setValueAtTime(0.1, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  o.connect(g);
  g.connect(c.destination);
  o.start(t);
  o.stop(t + 0.3);
}

/** Short harsh shriek for wall-breach chaos (layered with groans). */
function playZombieShriek() {
  const c = getCtx();
  if (!c) return;
  resumeAudio();
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sawtooth";
  const hi = 360 + Math.random() * 100;
  o.frequency.setValueAtTime(hi, t);
  o.frequency.exponentialRampToValueAtTime(95 + Math.random() * 40, t + 0.18);
  g.gain.setValueAtTime(0.1, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  o.connect(g);
  g.connect(c.destination);
  o.start(t);
  o.stop(t + 0.24);
  const noise = c.createBufferSource();
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * 0.12), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.35;
  noise.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 900 + Math.random() * 400;
  const gn = c.createGain();
  gn.gain.setValueAtTime(0.06, t);
  gn.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  noise.connect(bp);
  bp.connect(gn);
  gn.connect(c.destination);
  noise.start(t);
  noise.stop(t + 0.13);
}

function playBreachGroanLoud() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(200, t);
  o.frequency.linearRampToValueAtTime(85, t + 0.22);
  g.gain.setValueAtTime(0.34, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o.connect(g);
  g.connect(c.destination);
  o.start(t);
  o.stop(t + 0.32);
}

function playBreachShriekLoud() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sawtooth";
  const hi = 420 + Math.random() * 140;
  o.frequency.setValueAtTime(hi, t);
  o.frequency.exponentialRampToValueAtTime(88, t + 0.2);
  g.gain.setValueAtTime(0.32, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
  o.connect(g);
  g.connect(c.destination);
  o.start(t);
  o.stop(t + 0.28);
  const noise = c.createBufferSource();
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * 0.14), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
  noise.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1100 + Math.random() * 500;
  const gn = c.createGain();
  gn.gain.setValueAtTime(0.18, t);
  gn.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  noise.connect(bp);
  bp.connect(gn);
  gn.connect(c.destination);
  noise.start(t);
  noise.stop(t + 0.15);
}

/**
 * Overlapping groans and shrieks for the ~500ms beat after the wall breaks.
 * Waits for AudioContext resume (browser autoplay rules) then plays loud SFX.
 */
export function playWallBreachChorus() {
  resumeAudio().then(() => {
    const c = getCtx();
    if (!c) return;
    const pattern = [
      { ms: 0, fn: "groan" },
      { ms: 80, fn: "shriek" },
      { ms: 165, fn: "groan" },
      { ms: 248, fn: "shriek" },
      { ms: 330, fn: "groan" },
      { ms: 410, fn: "shriek" },
    ];
    for (const step of pattern) {
      setTimeout(() => {
        if (step.fn === "groan") playBreachGroanLoud();
        else playBreachShriekLoud();
      }, step.ms);
    }
  });
}

export function playBossSting() {
  const c = getCtx();
  if (!c) return;
  resumeAudio();
  const t = c.currentTime;
  [110, 146, 174].forEach((f, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "triangle";
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t + i * 0.08);
    g.gain.linearRampToValueAtTime(0.12, t + i * 0.08 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.35);
    o.connect(g);
    g.connect(c.destination);
    o.start(t + i * 0.08);
    o.stop(t + i * 0.08 + 0.4);
  });
}

function scheduleKick(c, t) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.08);
  g.gain.setValueAtTime(0.35, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  o.connect(g);
  g.connect(loadingGain);
  o.start(t);
  o.stop(t + 0.15);
}

function scheduleHat(c, t) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "square";
  o.frequency.value = 8000;
  g.gain.setValueAtTime(0.04, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  o.connect(g);
  g.connect(loadingGain);
  o.start(t);
  o.stop(t + 0.04);
}

function scheduleSnare(c, t) {
  const buf = c.createBuffer(1, c.sampleRate * 0.1, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / 400);
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  src.connect(g);
  g.connect(loadingGain);
  src.start(t);
  src.stop(t + 0.11);
}

const STEP = 0.25;
const BAR = STEP * 16;

export function startLoadingMusic() {
  const c = getCtx();
  if (!c) return;
  if (loadingLoopTimer) return;
  resumeAudio();
  if (!loadingGain) {
    loadingGain = c.createGain();
    loadingGain.gain.value = 0.22;
    loadingGain.connect(c.destination);
  }
  let beat = 0;
  const loop = () => {
    const c2 = getCtx();
    if (!c2 || !loadingGain) return;
    const t = c2.currentTime + 0.05;
    const offset = beat % 16;
    scheduleKick(c2, t);
    if (offset % 4 === 2) scheduleSnare(c2, t);
    if (offset % 2 === 0) scheduleHat(c2, t);
    if (offset % 2 === 1) scheduleHat(c2, t + STEP / 2);
    const bass = c2.createOscillator();
    const bg = c2.createGain();
    bass.type = "triangle";
    const notes = [55, 55, 73, 55, 55, 65, 55, 73];
    bass.frequency.value = notes[offset % 8];
    bg.gain.setValueAtTime(0.08, t);
    bg.gain.exponentialRampToValueAtTime(0.001, t + STEP * 0.9);
    bass.connect(bg);
    bg.connect(loadingGain);
    bass.start(t);
    bass.stop(t + STEP);
    beat++;
    loadingLoopTimer = window.setTimeout(loop, STEP * 1000);
  };
  loop();
}

export function stopLoadingMusic() {
  if (loadingLoopTimer) {
    clearTimeout(loadingLoopTimer);
    loadingLoopTimer = null;
  }
}

export function speakBossFight() {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance("Boss fight!");
  u.rate = 0.85;
  u.pitch = 0.6;
  const voices = window.speechSynthesis.getVoices();
  const male = voices.find((v) => /male|david|daniel|google uk english/i.test(v.name)) || voices[0];
  if (male) u.voice = male;
  window.speechSynthesis.speak(u);
}
