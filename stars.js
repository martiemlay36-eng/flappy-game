"use strict";

// ============================================================================
// ⭐ YILDIZ YAKALAMA & 🎈 BALON PATLATMA — Çocuklar İçin Neşeli Macera
// - 3 Yaş-Dostu Mod: 🌈 Minik (Yanmasız), ⭐ Neşeli (5 Kalp), 🎉 Parti (60 sn)
// - Çift Etkileşim: Sepetle yıldız/şeker yakala + 🎈 Uçan balonlara dokun patlat!
// - Ksilofon Müzik Notaları: Her yıldızda Do-Re-Mi-Fa-Sol-La-Si-Do çalar!
// - 6 Sevimli Dost (🧸🐱🐰🐼🦊🦄) + 4 Masalsı Gökyüzü + 1v1 Çevrimiçi Yarış!
// ============================================================================

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const MPC = typeof MPCore !== 'undefined' ? MPCore : null;

// Sanal çözünürlük (tüm telefon, tablet ve bilgisayarlarda %100 adil alan)
const VIRT_W = 420;
const VIRT_H = 700;

let W = 420, H = 700, DPR = 1;
function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = rect.width || 420;
  H = rect.height || 700;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
function sx(vx) { return (vx / VIRT_W) * W; }
function sy(vy) { return (vy / VIRT_H) * H; }
function sr(vr) { return vr * Math.min(W / VIRT_W, H / VIRT_H); }

function $(id) { return document.getElementById(id); }
function show(el) { if (el) el.classList.remove('hidden'); }
function hide(el) { if (el) el.classList.add('hidden'); }

// ---------- Ekran Elemanları ----------
const hud             = $('hud');
const hudCoinsEl      = $('hud-coins');
const hudHpEl         = $('hud-hp');
const hudComboEl      = $('hud-combo');
const powerBadgesEl   = $('power-badges');
const scoreDisplay    = $('score-display');
const pauseBtn        = $('pause-btn');
const finishKidsBtn   = $('finish-kids-btn');
const rainbowBtn      = $('rainbow-btn');
const tapHint         = $('tap-hint');

const menuScreen      = $('menu-screen');
const shopScreen      = $('shop-screen');
const lbScreen        = $('leaderboard-screen');
const statsScreen     = $('stats-screen');
const mpScreen        = $('mp-screen');
const mpGameoverScreen= $('mp-gameover-screen');
const gameoverScreen  = $('gameover-screen');
const pauseScreen     = $('pause-screen');

// ---------- 6 Sevimli Karakter (Vektör Çizim) ----------
const PETS = {
  bear:    { name: 'Sevimli Ayıcık',    icon: '🧸', price: 0,   fur: '#d98a4e', ear: '#a8602c', cheek: '#ff8fab', basket: '#f4a261' },
  cat:     { name: 'Şeker Kedi',        icon: '🐱', price: 25,  fur: '#ffafcc', ear: '#ff7096', cheek: '#ff4d6d', basket: '#ffd166' },
  bunny:   { name: 'Pamuk Tavşan',      icon: '🐰', price: 40,  fur: '#ffffff', ear: '#ffc8dd', cheek: '#ff8fab', basket: '#a2d2ff' },
  panda:   { name: 'Neşeli Panda',      icon: '🐼', price: 60,  fur: '#f8f9fa', ear: '#2b2d42', cheek: '#ff8fab', basket: '#80ed99' },
  fox:     { name: 'Yıldız Tilki',      icon: '🦊', price: 85,  fur: '#ff7b00', ear: '#c84b00', cheek: '#ffd6a5', basket: '#ffd166' },
  unicorn: { name: 'Gökkuşağı Unicorn', icon: '🦄', price: 120, fur: '#f3e8ff', ear: '#cdb4db', cheek: '#ff85a1', basket: '#ff99c8' }
};

// ---------- 4 Masalsı Gökyüzü Teması ----------
const SKIES = {
  meadow: { name: 'Gökkuşağı Çayırı', icon: '🌈', price: 0,  top: '#56ccf2', mid: '#9be7ff', bot: '#dff9fb', hill1: '#7bed9f', hill2: '#2ed573', night: false },
  candy:  { name: 'Şeker Diyarı',     icon: '🍭', price: 40, top: '#ff9a9e', mid: '#fecfef', bot: '#fff0f6', hill1: '#ffccd5', hill2: '#ff8fab', night: false },
  dream:  { name: 'Uyku Masalı',      icon: '🌙', price: 65, top: '#1e3c72', mid: '#2a5298', bot: '#6dd5ed', hill1: '#487eb0', hill2: '#273c75', night: true  },
  galaxy: { name: 'Uzay Masalı',      icon: '🪐', price: 95, top: '#3c1053', mid: '#7b2cbf', bot: '#c77dff', hill1: '#9d4edd', hill2: '#5a189a', night: true  }
};

// ---------- 3 Yaş-Dostu Oyun Modu ----------
const MODES = {
  kids:  { label: '🌈 Minik',      fallSpd: 1.85, spawnInt: 36, cloudChance: 0.00, timedSec: 0,  basketMul: 1.25 },
  happy: { label: '⭐ Neşeli',     fallSpd: 2.35, spawnInt: 30, cloudChance: 0.14, timedSec: 0,  basketMul: 1.05 },
  party: { label: '🎉 Parti (60s)', fallSpd: 2.65, spawnInt: 24, cloudChance: 0.08, timedSec: 60, basketMul: 1.10 }
};

const BALLOON_COLORS = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#ff70a6', '#b5179e', '#00bbf9'];
const CHEERS = ['HARİKA! 🌟', 'SÜPERSİN! 🎉', 'AFERİN! 🌈', 'MÜKEMMEL! 🏆', 'ÇOK İYİ! ✨', 'BRAVO! 🥳'];

// ---------- Kalıcı Veri (oyun-salonu-v2) ----------
const STORAGE_KEY = 'oyun-salonu-v2';

const settings = {
  soundOn: true,
  musicOn: true,
  volume: 0.70
};

const ST = {
  bestScore: 0,
  coins: 0,
  pet: 'bear',
  ownedPets: ['bear'],
  sky: 'meadow',
  ownedSkies: ['meadow'],
  mode: 'kids',
  playerName: '',
  leaderboard: [],
  stats: {
    games: 0,
    starsCaught: 0,
    balloonsPopped: 0,
    giftsOpened: 0,
    bestCombo: 0,
    totalCoins: 0
  }
};

function loadStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const root = JSON.parse(raw);
    if (!root || typeof root !== 'object') return;

    if (typeof root.soundOn === 'boolean') settings.soundOn = root.soundOn;
    if (typeof root.musicOn === 'boolean') settings.musicOn = root.musicOn;
    if (typeof root.volume === 'number') settings.volume = Math.max(0, Math.min(1, root.volume));

    const inheritedName =
      (root.stars && root.stars.playerName) ||
      (root.flappy && root.flappy.playerName) ||
      (root.snake && root.snake.playerName) ||
      (root.space && root.space.playerName) || '';

    if (root.stars && typeof root.stars === 'object') {
      const sv = root.stars;
      ST.bestScore = Number(sv.bestScore) || 0;
      ST.coins = Math.max(0, Number(sv.coins) || 0);
      if (sv.pet && PETS[sv.pet]) ST.pet = sv.pet;
      if (Array.isArray(sv.ownedPets)) {
        ST.ownedPets = Array.from(new Set(['bear', ...sv.ownedPets.filter(k => PETS[k])]));
      }
      if (sv.sky && SKIES[sv.sky]) ST.sky = sv.sky;
      if (Array.isArray(sv.ownedSkies)) {
        ST.ownedSkies = Array.from(new Set(['meadow', ...sv.ownedSkies.filter(k => SKIES[k])]));
      }
      if (sv.mode && MODES[sv.mode]) ST.mode = sv.mode;
      if (Array.isArray(sv.leaderboard)) ST.leaderboard = sv.leaderboard.slice(0, 10);
      if (sv.stats && typeof sv.stats === 'object') {
        ST.stats.games = Number(sv.stats.games) || 0;
        ST.stats.starsCaught = Number(sv.stats.starsCaught) || 0;
        ST.stats.balloonsPopped = Number(sv.stats.balloonsPopped) || 0;
        ST.stats.giftsOpened = Number(sv.stats.giftsOpened) || 0;
        ST.stats.bestCombo = Number(sv.stats.bestCombo) || 0;
        ST.stats.totalCoins = Number(sv.stats.totalCoins) || 0;
      }
    }
    if (inheritedName) ST.playerName = String(inheritedName).slice(0, 12);
  } catch (e) {}
}

function persist() {
  try {
    let root = {};
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) root = JSON.parse(raw) || {};
    root.soundOn = settings.soundOn;
    root.musicOn = settings.musicOn;
    root.volume = settings.volume;
    root.stars = {
      bestScore: ST.bestScore,
      coins: ST.coins,
      pet: ST.pet,
      ownedPets: ST.ownedPets,
      sky: ST.sky,
      ownedSkies: ST.ownedSkies,
      mode: ST.mode,
      playerName: ST.playerName,
      leaderboard: ST.leaderboard.slice(0, 10),
      stats: { ...ST.stats }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
  } catch (e) {}
}

loadStorage();

// ---------- Neşeli Ksilofon & Oyuncak Kutusu Ses Sentezleyici ----------
let audioCtx = null;
function getAudio() {
  if (!settings.soundOn && !settings.musicOn) return null;
  if (!audioCtx && typeof window !== 'undefined') {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      try { audioCtx = new AC(); } catch (e) { audioCtx = null; }
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    try { audioCtx.resume(); } catch (e) {}
  }
  return audioCtx;
}

function chime(freq, dur, type = 'sine', gainMul = 0.22, slideTo = null) {
  if (!settings.soundOn || settings.volume <= 0.01) return;
  const ac = getAudio();
  if (!ac) return;
  try {
    const t0 = ac.currentTime;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
    const peak = Math.max(0.001, settings.volume * gainMul);
    g.gain.setValueAtTime(peak, t0);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    osc.connect(g);
    g.connect(ac.destination);
    osc.onended = () => {
      try { osc.disconnect(); g.disconnect(); } catch (e) {}
    };
    osc.start(t0);
    osc.stop(t0 + dur + 0.015);
  } catch (e) {}
}

// Do-Re-Mi-Fa-Sol-La-Si-Do (C5 -> C6) ksilofon dizisi
const SCALE_NOTES = [523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77, 1046.50];
let scaleStep = 0;

const sfx = {
  star() {
    const f = SCALE_NOTES[scaleStep % SCALE_NOTES.length];
    scaleStep++;
    chime(f, 0.16, 'triangle', 0.26, f * 1.02);
    setTimeout(() => chime(f * 2, 0.10, 'sine', 0.10), 25);
  },
  superStar() {
    [523.25, 659.25, 783.99, 1046.50].forEach((n, idx) => {
      setTimeout(() => chime(n, 0.14, 'triangle', 0.24), idx * 45);
    });
  },
  pop() {
    // Tatlı balon "Bup-Pop!" sesi
    chime(320, 0.08, 'sine', 0.28, 780);
  },
  gift() {
    [523.25, 659.25, 783.99, 1046.50, 1318.5].forEach((n, idx) => {
      setTimeout(() => chime(n, 0.16, 'triangle', 0.24), idx * 55);
    });
  },
  coin() {
    chime(987.77, 0.08, 'sine', 0.20);
    setTimeout(() => chime(1318.5, 0.13, 'sine', 0.20), 55);
  },
  power() {
    [440, 554.37, 659.25, 880].forEach((n, idx) => {
      setTimeout(() => chime(n, 0.12, 'triangle', 0.22), idx * 50);
    });
  },
  rainbow() {
    SCALE_NOTES.forEach((n, idx) => {
      setTimeout(() => chime(n, 0.15, 'triangle', 0.22), idx * 42);
    });
  },
  rain() {
    // Korkutmayan yumuşak yağmur damlası sesi ("pıt-pıt")
    chime(420, 0.09, 'sine', 0.16, 260);
  },
  celebrate() {
    [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50].forEach((n, idx) => {
      setTimeout(() => chime(n, 0.18, 'triangle', 0.24), idx * 95);
    });
  }
};

// Neşeli Oyuncak Kutusu Arka Plan Melodisi (Twinkle / Marimba esintili)
let musicTimer = null;
let musicIdx = 0;
const LULLABY_NOTES = [
  523.25, 523.25, 783.99, 783.99, 880.00, 880.00, 783.99, 0,
  698.46, 698.46, 659.25, 659.25, 587.33, 587.33, 523.25, 0
];
function ensureMusicLoop() {
  if (musicTimer) return;
  musicTimer = setInterval(() => {
    if (!settings.musicOn || settings.volume <= 0.01) return;
    if (state !== STATE.PLAYING && state !== STATE.READY) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    const ac = getAudio();
    if (!ac) return;
    const f = LULLABY_NOTES[musicIdx % LULLABY_NOTES.length];
    musicIdx++;
    if (!f) return;
    try {
      const t0 = ac.currentTime;
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(Math.max(0.001, settings.volume * 0.055), t0);
      g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.28);
      osc.connect(g);
      g.connect(ac.destination);
      osc.onended = () => {
        try { osc.disconnect(); g.disconnect(); } catch (e) {}
      };
      osc.start(t0);
      osc.stop(t0 + 0.30);
    } catch (e) {}
  }, 340);
  if (musicTimer && typeof musicTimer.unref === 'function') musicTimer.unref();
}

// ---------- Deterministik Tohumlu RNG (Çevrimiçi %100 Adil Yıldız & Balon) ----------
function makeRng(seed) {
  let s = (seed >>> 0) || 0x51a7cafe;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let worldRng = makeRng(Date.now());

// ---------- Oyun Durumu ----------
const STATE = { MENU: 0, READY: 1, PLAYING: 2, PAUSED: 3, GAMEOVER: 4 };
let state = STATE.MENU;

let frames = 0;
let runFrames = 0;
let score = 0;
let runCoins = 0;
let runStars = 0;
let combo = 0;
let comboTimer = 0;
let bestRunCombo = 0;
let rainbowCharge = 0; // 0..100 -> 100 olunca 🌈 Gökkuşağı Yağmuru hazır!
let currentMode = ST.mode || 'kids';
let currentSky = ST.sky || 'meadow';
let timeLeftFrames = 0; // Süreli Parti modunda (60 * 60 = 3600 kare)
let mpCountdown = 0;

const catcher = {
  x: VIRT_W * 0.5,
  y: VIRT_H - 76,
  targetX: VIRT_W * 0.5,
  vx: 0,
  tilt: 0,
  baseR: 34,
  hp: 5,
  maxHp: 5,
  invuln: 0,
  magnetTimer: 0,
  giantTimer: 0,
  partyTimer: 0,
  bounceAnim: 0
};

let items = [];      // Gökten süzülen yıldızlar, şekerler, güçlendirmeler, yağmur bulutları
let balloons = [];   // Aşağıdan yukarı süzülen dokunup patlatmalık balonlar
let confetti = [];   // Rengarenk konfeti & yıldız tozu parçacıkları
let popups = [];     // "+10 ⭐", "HARİKA! 🌟" uçan yazıları
let bgClouds = [];
let bgTwinkles = [];

function initSkyDecor() {
  bgClouds = [];
  for (let i = 0; i < 5; i++) {
    bgClouds.push({
      x: (i * 95 + 30) % VIRT_W,
      y: 65 + (i % 3) * 58,
      s: 0.65 + (i % 3) * 0.22,
      sp: 0.22 + (i % 2) * 0.12
    });
  }
  bgTwinkles = [];
  for (let i = 0; i < 36; i++) {
    bgTwinkles.push({
      x: (i * 53 + 17) % VIRT_W,
      y: (i * 79 + 25) % (VIRT_H * 0.68),
      r: 1.0 + (i % 3) * 0.8,
      ph: i * 0.7
    });
  }
}

function addConfetti(x, y, count = 14, baseColor = null) {
  for (let i = 0; i < count; i++) {
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const sp = 1.4 + Math.random() * 3.8;
    confetti.push({
      x, y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp - 1.2,
      r: 3 + Math.random() * 3.5,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.25,
      color: baseColor || BALLOON_COLORS[i % BALLOON_COLORS.length],
      life: 26 + Math.floor(Math.random() * 18),
      maxLife: 44
    });
  }
}

function addPopup(x, y, text, color = '#ffd166', big = false) {
  popups.push({
    x: Math.max(48, Math.min(VIRT_W - 48, x)),
    y: Math.max(54, y),
    text,
    color,
    big,
    life: big ? 48 : 34,
    maxLife: big ? 48 : 34
  });
}

// ---------- HUD Güncelleme ----------
function updateHUD() {
  if (scoreDisplay) scoreDisplay.textContent = score;
  if (hudCoinsEl) hudCoinsEl.textContent = ST.coins + runCoins;

  if (hudHpEl) {
    if (currentMode === 'kids') {
      hudHpEl.textContent = '🌈 Sonsuz';
    } else if (currentMode === 'party') {
      const secs = Math.max(0, Math.ceil(timeLeftFrames / 60));
      hudHpEl.textContent = `⏱️ ${secs} sn`;
    } else {
      hudHpEl.textContent = '❤️'.repeat(Math.max(0, catcher.hp)) || '💫';
    }
  }

  if (finishKidsBtn) {
    finishKidsBtn.classList.toggle('hidden', !(currentMode === 'kids' && !MP.connected && state === STATE.PLAYING));
  }

  if (hudComboEl) {
    if (combo >= 3) {
      hudComboEl.textContent = `🌟 x${Math.min(5, 1 + Math.floor(combo / 5))} (${combo})`;
      show(hudComboEl);
    } else {
      hide(hudComboEl);
    }
  }

  if (powerBadgesEl) {
    const badges = [];
    if (catcher.magnetTimer > 0) badges.push(`<span class="power-badge">🌈 ${Math.ceil(catcher.magnetTimer / 60)}s</span>`);
    if (catcher.giantTimer > 0)  badges.push(`<span class="power-badge">🧺 Dev ${Math.ceil(catcher.giantTimer / 60)}s</span>`);
    if (catcher.partyTimer > 0)  badges.push(`<span class="power-badge">🎉 x2 ${Math.ceil(catcher.partyTimer / 60)}s</span>`);
    if (MP.connected)            badges.push(`<span class="power-badge" id="mp-hud-ping">🟢 -- ms</span>`);
    const html = badges.join('');
    if (powerBadgesEl._last !== html) {
      powerBadgesEl.innerHTML = html;
      powerBadgesEl._last = html;
      if (MP.connected && MPC) MPC.updatePingDOM(MP.pingMs);
    }
  }

  if (rainbowBtn) {
    const pct = Math.min(100, Math.floor(rainbowCharge));
    rainbowBtn.classList.toggle('ready', pct >= 100 && !MP.spectating);
    rainbowBtn.textContent = pct >= 100 ? '🌈' : `${pct}%`;
  }
}

// ---------- Yeni Oyun Hazırlığı ----------
function resetRun(seedOverride) {
  const seed = (typeof seedOverride === 'number') ? seedOverride : ((Date.now() ^ ((Math.random() * 0xffffffff) >>> 0)) >>> 0);
  worldRng = makeRng(seed);

  runFrames = 0;
  score = 0;
  runCoins = 0;
  runStars = 0;
  combo = 0;
  comboTimer = 0;
  bestRunCombo = 0;
  rainbowCharge = 40; // Çocuklar ilk gökkuşağı yağmurunu çabucak açabilsin!
  scaleStep = 0;

  const md = MODES[currentMode] || MODES.kids;
  timeLeftFrames = md.timedSec > 0 ? md.timedSec * 60 : 0;

  catcher.x = VIRT_W * 0.5;
  catcher.y = VIRT_H - 76;
  catcher.targetX = VIRT_W * 0.5;
  catcher.vx = 0;
  catcher.tilt = 0;
  catcher.hp = 5;
  catcher.maxHp = 5;
  catcher.invuln = 0;
  catcher.magnetTimer = 0;
  catcher.giantTimer = 0;
  catcher.partyTimer = 0;
  catcher.bounceAnim = 0;

  items = [];
  balloons = [];
  confetti = [];
  popups = [];
  updateHUD();
}

function startGame() {
  MP.spectating = false;
  mpHideSpectatorBanner();
  currentMode = ST.mode || 'kids';
  currentSky = ST.sky || 'meadow';
  resetRun();
  hide(menuScreen);
  hide(shopScreen);
  hide(lbScreen);
  hide(statsScreen);
  hide(mpScreen);
  hide(mpGameoverScreen);
  hide(gameoverScreen);
  hide(pauseScreen);
  show(hud);
  show(tapHint);
  state = STATE.PLAYING;
  getAudio();
  ensureMusicLoop();
  addPopup(VIRT_W * 0.5, VIRT_H * 0.42, 'BAŞLAYALIM! 🌟', '#ffd166', true);
}

// ---------- 🌈 Gökkuşağı Yağmuru Süper Gücü ----------
function triggerRainbowShower() {
  if (state !== STATE.PLAYING || MP.spectating) return;
  if (rainbowCharge < 100) return;
  rainbowCharge = 0;
  sfx.rainbow();
  catcher.magnetTimer = Math.max(catcher.magnetTimer, 240);

  // Varsa yağmur bulutlarını şekere dönüştür!
  for (let i = 0; i < items.length; i++) {
    if (items[i] && items[i].kind === 'cloud') {
      items[i].kind = 'star';
      items[i].color = '#ffd166';
      addConfetti(items[i].x, items[i].y, 8, '#ffd166');
    }
  }

  // Gökyüzünden 10 adet altın yıldız ve şeker yağdır!
  for (let k = 0; k < 10; k++) {
    items.push({
      kind: k % 3 === 0 ? 'superstar' : 'star',
      x: 36 + ((k * 38) % (VIRT_W - 72)),
      y: -15 - (k % 4) * 28,
      vx: (k % 2 === 0 ? 1 : -1) * 0.4,
      vy: 2.1 + (k % 3) * 0.25,
      r: k % 3 === 0 ? 20 : 17,
      rot: k * 0.5,
      sway: k * 0.8,
      color: k % 3 === 0 ? '#ff9f1c' : '#ffd166'
    });
  }

  addConfetti(VIRT_W * 0.5, VIRT_H * 0.35, 28);
  addPopup(VIRT_W * 0.5, VIRT_H * 0.34, '🌈 GÖKKUŞAĞI YAĞMURU!', '#ffffff', true);
  updateHUD();
}

// ---------- Balona Parmakla Dokunup Patlatma! ----------
function popBalloon(b, index) {
  if (!b) return;
  if (index >= 0 && index < balloons.length) balloons.splice(index, 1);

  ST.stats.balloonsPopped++;
  const mult = (catcher.partyTimer > 0 ? 2 : 1);

  if (b.isGift) {
    // 🎁 Sürpriz Hediye Balonu: etrafa 6 yıldız & şeker saçar!
    ST.stats.giftsOpened++;
    sfx.gift();
    const pts = 40 * mult;
    score += pts;
    runCoins += 3;
    rainbowCharge = Math.min(100, rainbowCharge + 25);
    addConfetti(b.x, b.y, 24);
    addPopup(b.x, b.y, `🎁 SÜRPRİZ +${pts}!`, '#ff70a6', true);
    for (let k = 0; k < 6; k++) {
      const ang = (Math.PI * 2 * k) / 6;
      items.push({
        kind: k % 2 === 0 ? 'star' : 'candy',
        x: Math.max(28, Math.min(VIRT_W - 28, b.x + Math.cos(ang) * 24)),
        y: Math.max(20, b.y + Math.sin(ang) * 18),
        vx: Math.cos(ang) * 1.8,
        vy: -1.4 + Math.sin(ang) * 0.8,
        r: 16,
        rot: 0,
        sway: k,
        color: BALLOON_COLORS[k % BALLOON_COLORS.length]
      });
    }
  } else {
    sfx.pop();
    const pts = 15 * mult;
    score += pts;
    runCoins += 1;
    rainbowCharge = Math.min(100, rainbowCharge + 12);
    addConfetti(b.x, b.y, 14, b.color);
    addPopup(b.x, b.y, `🎈 +${pts}`, b.color, false);
    // Balonun içinden sevimli bir yıldız düşsün!
    items.push({
      kind: 'star',
      x: b.x,
      y: b.y,
      vx: 0,
      vy: 1.5,
      r: 15,
      rot: 0,
      sway: 0,
      color: '#ffd166'
    });
  }

  if (MP.connected) mpOnScore();
  updateHUD();
}

function tryPopBalloonAt(virtX, virtY) {
  if (state !== STATE.PLAYING || MP.spectating) return false;
  // Küçük parmaklar için ekstra geniş (+20px) dokunma alanı!
  for (let i = balloons.length - 1; i >= 0; i--) {
    const b = balloons[i];
    if (!b) continue;
    if (Math.hypot(virtX - b.x, virtY - b.y) <= b.r + 22) {
      popBalloon(b, i);
      return true;
    }
  }
  return false;
}

// ---------- Yıldız & Hediye Yakalama ----------
function collectItem(it) {
  if (!it) return;
  if (it.kind === 'cloud') {
    if (currentMode === 'kids' || catcher.invuln > 0) return;
    sfx.rain();
    catcher.invuln = 95;
    combo = 0;
    addConfetti(catcher.x, catcher.y - 18, 10, '#74b9ff');
    if (currentMode === 'happy') {
      catcher.hp = Math.max(0, catcher.hp - 1);
      addPopup(catcher.x, catcher.y - 36, '🌧️ Islak Bulut!', '#a2d2ff', false);
      // Yakındaki diğer bulutları temizle ki üst üste gelmesin
      for (let k = items.length - 1; k >= 0; k--) {
        if (items[k] && items[k].kind === 'cloud' && Math.hypot(items[k].x - catcher.x, items[k].y - catcher.y) < 160) {
          items.splice(k, 1);
        }
      }
      updateHUD();
      if (catcher.hp <= 0) finishCelebration();
    } else {
      // Süreli Parti modunda bulut sadece hafifçe ıslatır, yanma yok!
      addPopup(catcher.x, catcher.y - 36, '🌧️ Pıt Pıt!', '#a2d2ff', false);
      updateHUD();
    }
    return;
  }

  // Pozitif ödüller!
  catcher.bounceAnim = 1.0;
  combo++;
  comboTimer = 180;
  if (combo > bestRunCombo) bestRunCombo = combo;
  if (combo > ST.stats.bestCombo) ST.stats.bestCombo = combo;

  const comboMul = Math.min(4, 1 + Math.floor(combo / 6));
  const partyMul = catcher.partyTimer > 0 ? 2 : 1;
  const mult = comboMul * partyMul;

  if (it.kind === 'star') {
    sfx.star();
    const pts = 10 * mult;
    score += pts;
    runStars++;
    ST.stats.starsCaught++;
    if (runStars % 4 === 0) runCoins += 1;
    rainbowCharge = Math.min(100, rainbowCharge + 10);
    addConfetti(it.x, it.y, 9, '#ffd166');
    addPopup(it.x, it.y - 10, `⭐ +${pts}`, '#ffd166', false);
  } else if (it.kind === 'superstar') {
    sfx.superStar();
    const pts = 30 * mult;
    score += pts;
    runStars += 2;
    ST.stats.starsCaught += 2;
    runCoins += 2;
    rainbowCharge = Math.min(100, rainbowCharge + 22);
    addConfetti(it.x, it.y, 18);
    addPopup(it.x, it.y - 14, `🌟 SÜPER +${pts}!`, '#ff9f1c', true);
  } else if (it.kind === 'candy') {
    sfx.star();
    const pts = 15 * mult;
    score += pts;
    runCoins += 1;
    rainbowCharge = Math.min(100, rainbowCharge + 12);
    addConfetti(it.x, it.y, 10, '#ff70a6');
    addPopup(it.x, it.y - 10, `🍬 +${pts}`, '#ff70a6', false);
  } else if (it.kind === 'coin') {
    sfx.coin();
    score += 5 * mult;
    runCoins += 2;
    rainbowCharge = Math.min(100, rainbowCharge + 8);
    addConfetti(it.x, it.y, 8, '#ffd700');
    addPopup(it.x, it.y - 10, '🪙 +2 Altın!', '#ffd700', false);
  } else if (it.kind === 'rainbow') {
    sfx.power();
    catcher.magnetTimer = 420; // 7 sn gökkuşağı mıknatısı
    score += 20;
    addConfetti(it.x, it.y, 16);
    addPopup(catcher.x, catcher.y - 42, '🌈 Mıknatıs Açıldı!', '#80ffdb', true);
  } else if (it.kind === 'giant') {
    sfx.power();
    catcher.giantTimer = 480; // 8 sn dev sepet
    score += 20;
    addConfetti(it.x, it.y, 16, '#8ac926');
    addPopup(catcher.x, catcher.y - 42, '🧺 Kocaman Sepet!', '#8ac926', true);
  } else if (it.kind === 'party') {
    sfx.power();
    catcher.partyTimer = 420; // 7 sn x2 puan partisi
    score += 20;
    addConfetti(it.x, it.y, 20);
    addPopup(catcher.x, catcher.y - 42, '🎉 Yıldız Partisi x2!', '#ff70a6', true);
  } else if (it.kind === 'heart') {
    sfx.power();
    if (catcher.hp < catcher.maxHp) {
      catcher.hp++;
      addPopup(catcher.x, catcher.y - 42, '❤️ +1 Kalp!', '#ff595e', true);
    } else {
      score += 25 * mult;
      addPopup(catcher.x, catcher.y - 42, `❤️ +${25 * mult}!`, '#ff595e', true);
    }
    addConfetti(it.x, it.y, 12, '#ff595e');
  }

  // Her 10 kombo serisinde neşeli Türkçe tebrik!
  if (combo > 0 && combo % 8 === 0) {
    const msg = CHEERS[(combo / 8 - 1) % CHEERS.length];
    addPopup(VIRT_W * 0.5, VIRT_H * 0.30, msg, '#ffffff', true);
  }

  if (MP.connected) mpOnScore();
  updateHUD();
}

// ---------- Yıldız & Balon Doğuş Motoru ----------
function spawnStep() {
  const md = MODES[currentMode] || MODES.kids;

  // Son 10 saniyede (Parti modu) ekstra Yıldız Yağmuru!
  const isFever = currentMode === 'party' && timeLeftFrames > 0 && timeLeftFrames <= 600;
  const interval = isFever ? Math.max(13, Math.floor(md.spawnInt * 0.58)) : md.spawnInt;

  if (runFrames % interval === 0) {
    const r = worldRng();
    const x = 32 + worldRng() * (VIRT_W - 64);
    let kind = 'star';
    let rad = 17;
    let color = '#ffd166';
    let spdMul = 1.0;

    if (r < md.cloudChance && !isFever) {
      kind = 'cloud';
      rad = 18;
      color = '#7f8fa6';
      spdMul = 0.88;
    } else if (r < md.cloudChance + 0.13) {
      kind = 'superstar';
      rad = 21;
      color = '#ff9f1c';
      spdMul = 1.08;
    } else if (r < md.cloudChance + 0.30) {
      kind = 'candy';
      rad = 16;
      color = '#ff70a6';
    } else if (r < md.cloudChance + 0.40) {
      kind = 'coin';
      rad = 15;
      color = '#ffd700';
    } else if (r < md.cloudChance + 0.52) {
      // Büyülü çocuk güçlendirmeleri!
      const pRoll = worldRng();
      if (pRoll < 0.30)      { kind = 'rainbow'; color = '#4cc9f0'; }
      else if (pRoll < 0.58) { kind = 'giant';   color = '#8ac926'; }
      else if (pRoll < 0.82) { kind = 'party';   color = '#ff70a6'; }
      else                   { kind = 'heart';   color = '#ff595e'; }
      rad = 18;
      spdMul = 0.90;
    }

    items.push({
      kind,
      x,
      y: -24,
      vx: (worldRng() - 0.5) * 0.45,
      vy: md.fallSpd * spdMul * (0.9 + worldRng() * 0.25),
      r: rad,
      rot: worldRng() * Math.PI * 2,
      sway: worldRng() * Math.PI * 2,
      color
    });
  }

  // Her ~85 karede bir aşağıdan yukarı süzülen rengarenk uçan balon!
  if (runFrames % 85 === 35 && balloons.length < 5) {
    const bx = 42 + worldRng() * (VIRT_W - 84);
    const isGift = worldRng() < 0.22;
    const col = BALLOON_COLORS[Math.floor(worldRng() * BALLOON_COLORS.length)];
    balloons.push({
      x: bx,
      y: VIRT_H + 34,
      vy: -(1.15 + worldRng() * 0.65),
      r: isGift ? 25 : 22,
      sway: worldRng() * Math.PI * 2,
      color: col,
      isGift
    });
  }
}

// ---------- Kutlama / Oyun Bitişi ----------
function finishCelebration() {
  if (MP.connected) {
    mpOnFinish();
    return;
  }

  state = STATE.GAMEOVER;
  sfx.celebrate();
  hide(hud);
  hide(tapHint);

  ST.stats.games++;
  const bonusCoins = Math.max(1, Math.floor(score / 60));
  const totalEarned = runCoins + bonusCoins;
  ST.coins += totalEarned;
  ST.stats.totalCoins += totalEarned;

  const isNewBest = score > ST.bestScore;
  if (isNewBest) ST.bestScore = score;
  persist();

  if ($('celebrate-title')) {
    $('celebrate-title').textContent = score >= 150 ? '🎉 SÜPER ŞAMPİYON!' : '🎉 HARİKA OYNADIN!';
  }
  if ($('final-score')) $('final-score').textContent = score;
  if ($('final-stars')) $('final-stars').textContent = `⭐ ${runStars}`;
  if ($('best-score-go')) $('best-score-go').textContent = ST.bestScore;
  if ($('run-coins-go')) $('run-coins-go').textContent = `🪙 +${totalEarned}`;
  if ($('new-record')) $('new-record').classList.toggle('hidden', !isNewBest);

  const medalEl = $('medal-display');
  if (medalEl) {
    show(medalEl);
    let icon = '⭐', text = 'PARLAK YILDIZ';
    if (score >= 500)      { icon = '👑'; text = 'GÖKKUŞAĞI KRALI'; }
    else if (score >= 280) { icon = '🏆'; text = 'ALTIN ŞAMPİYON'; }
    else if (score >= 120) { icon = '🌟'; text = 'SÜPER YILDIZ'; }
    $('medal-icon').textContent = icon;
    $('medal-text').textContent = text;
  }

  if ($('player-name')) $('player-name').value = ST.playerName || '';
  if ($('save-score-btn')) {
    $('save-score-btn').disabled = false;
    $('save-score-btn').textContent = '🏅 Kaydet';
  }

  addConfetti(VIRT_W * 0.5, VIRT_H * 0.35, 36);
  show(gameoverScreen);
  updateMenuUI();
}

// ---------- Fizik & Dünya Adımı (60 Hz) ----------
const keys = {};

function stepCatcherMovement() {
  if (MP.spectating) return;

  const kbSpd = 6.2;
  if (keys['ArrowLeft'] || keys['KeyA'])  catcher.targetX -= kbSpd;
  if (keys['ArrowRight'] || keys['KeyD']) catcher.targetX += kbSpd;

  catcher.targetX = Math.max(34, Math.min(VIRT_W - 34, catcher.targetX));
  const dx = catcher.targetX - catcher.x;
  catcher.vx = dx * 0.28;
  catcher.x += catcher.vx;
  catcher.x = Math.max(34, Math.min(VIRT_W - 34, catcher.x));
  catcher.tilt += (Math.max(-1, Math.min(1, catcher.vx / 6)) - catcher.tilt) * 0.22;

  if (catcher.bounceAnim > 0) catcher.bounceAnim = Math.max(0, catcher.bounceAnim - 0.08);
}

function stepBackground() {
  for (let i = 0; i < bgClouds.length; i++) {
    const c = bgClouds[i];
    c.x += c.sp;
    if (c.x > VIRT_W + 70) c.x = -70;
  }
}

function stepWorld() {
  runFrames++;
  if (runFrames === 120) hide(tapHint);

  if (catcher.invuln > 0) catcher.invuln--;
  if (catcher.magnetTimer > 0) catcher.magnetTimer--;
  if (catcher.giantTimer > 0) catcher.giantTimer--;
  if (catcher.partyTimer > 0) catcher.partyTimer--;

  if (comboTimer > 0) {
    comboTimer--;
    if (comboTimer === 0) combo = 0;
  }

  // Süreli Parti modu geri sayımı
  if (currentMode === 'party' && timeLeftFrames > 0) {
    timeLeftFrames--;
    if (timeLeftFrames === 600) {
      addPopup(VIRT_W * 0.5, VIRT_H * 0.34, '🌟 SON 10 SN: YILDIZ YAĞMURU!', '#ffd166', true);
      sfx.superStar();
    }
    if (timeLeftFrames <= 0 && !MP.spectating) {
      updateHUD();
      finishCelebration();
      return;
    }
  }

  stepCatcherMovement();
  spawnStep();

  const md = MODES[currentMode] || MODES.kids;
  const catchRadius = catcher.baseR * md.basketMul * (catcher.giantTimer > 0 ? 1.42 : 1.0);

  // Düşen yıldızlar, şekerler & bulutlar (indeks korumalı!)
  for (let i = items.length - 1; i >= 0; i--) {
    if (i >= items.length) i = items.length - 1;
    if (i < 0) break;
    const it = items[i];
    if (!it) continue;

    it.sway += 0.06;
    it.rot += 0.04;

    // 🌈 Gökkuşağı mıknatısı açıksa tüm iyi nesneleri sepete çek!
    if (!MP.spectating && catcher.magnetTimer > 0 && it.kind !== 'cloud') {
      const dx = catcher.x - it.x;
      const dy = (catcher.y - 12) - it.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 270) {
        it.vx += (dx / d) * 0.85;
        it.vy += (dy / d) * 0.85;
      }
    } else {
      it.x += Math.sin(it.sway) * 0.55;
    }

    it.x += it.vx;
    it.y += it.vy;
    it.vx *= 0.95;
    if (it.vy < 1.2) it.vy += 0.08;
    it.x = Math.max(22, Math.min(VIRT_W - 22, it.x));

    if (it.y > VIRT_H + 36) {
      items.splice(i, 1);
      continue;
    }

    if (!MP.spectating && state === STATE.PLAYING) {
      const hitDist = it.kind === 'cloud' ? (it.r + 18) : (it.r + catchRadius);
      if (Math.hypot(it.x - catcher.x, it.y - (catcher.y - 10)) < hitDist) {
        items.splice(i, 1);
        collectItem(it);
        if (state !== STATE.PLAYING && !MP.spectating) return;
      }
    }
  }

  // Uçan balonlar (ister parmakla dokun, ister karakterle değ!)
  for (let i = balloons.length - 1; i >= 0; i--) {
    if (i >= balloons.length) i = balloons.length - 1;
    if (i < 0) break;
    const b = balloons[i];
    if (!b) continue;

    b.sway += 0.05;
    b.x += Math.sin(b.sway) * 0.7;
    b.y += b.vy;

    if (b.y < -45) {
      balloons.splice(i, 1);
      continue;
    }

    if (!MP.spectating && state === STATE.PLAYING) {
      if (Math.hypot(b.x - catcher.x, b.y - (catcher.y - 12)) < b.r + catchRadius * 0.85) {
        popBalloon(b, i);
      }
    }
  }

  if (runFrames % 10 === 0) updateHUD();
}

function stepEffects() {
  if (confetti.length > 260) {
    confetti.splice(0, confetti.length - 260);
  }
  for (let i = confetti.length - 1; i >= 0; i--) {
    const pt = confetti[i];
    if (!pt) continue;
    pt.x += pt.vx;
    pt.y += pt.vy;
    pt.vy += 0.08;
    pt.vx *= 0.97;
    pt.rot += pt.vrot;
    pt.life--;
    if (pt.life <= 0) confetti.splice(i, 1);
  }
  for (let i = popups.length - 1; i >= 0; i--) {
    const pp = popups[i];
    if (!pp) continue;
    pp.y -= 0.75;
    pp.life--;
    if (pp.life <= 0) popups.splice(i, 1);
  }
}

// ============================================================================
//              60 FPS NEŞELİ ÇOCUK ÇİZİM MOTORU (VEKTÖR SANAT)
// ============================================================================
function drawStarShape(cx, cy, spikes, outerR, innerR, rot) {
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = (i % 2 === 0) ? outerR : innerR;
    const a = rot + (i * Math.PI) / spikes - Math.PI * 0.5;
    if (i === 0) ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    else ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
}

function drawFluffyCloud(vx, vy, scale, color = '#ffffff', happyFace = false) {
  const cx = sx(vx), cy = sy(vy), s = sr(scale);
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx - 18 * s, cy + 4 * s, 15 * s, 0, Math.PI * 2);
  ctx.arc(cx, cy - 6 * s, 20 * s, 0, Math.PI * 2);
  ctx.arc(cx + 20 * s, cy + 4 * s, 15 * s, 0, Math.PI * 2);
  ctx.arc(cx, cy + 8 * s, 16 * s, 0, Math.PI * 2);
  ctx.fill();

  if (happyFace) {
    ctx.fillStyle = '#3d5a80';
    ctx.beginPath();
    ctx.arc(cx - 6 * s, cy, 2.2 * s, 0, Math.PI * 2);
    ctx.arc(cx + 6 * s, cy, 2.2 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3d5a80';
    ctx.lineWidth = Math.max(1.5, 2 * s);
    ctx.beginPath();
    ctx.arc(cx, cy + 2 * s, 5 * s, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSkyWorld() {
  const sk = SKIES[currentSky] || SKIES.meadow;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, sk.top);
  g.addColorStop(0.58, sk.mid);
  g.addColorStop(1, sk.bot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (!sk.night) {
    // Büyük Pastel Gökkuşağı Kemeri
    const rainbowCols = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'];
    ctx.save();
    ctx.globalAlpha = catcher.magnetTimer > 0 ? 0.55 : 0.25;
    for (let k = 0; k < rainbowCols.length; k++) {
      ctx.strokeStyle = rainbowCols[k];
      ctx.lineWidth = sr(9);
      ctx.beginPath();
      ctx.arc(sx(VIRT_W * 0.5), sy(VIRT_H * 0.62), sr(195 - k * 9), Math.PI, 0);
      ctx.stroke();
    }
    ctx.restore();

    // Gülen Güneş ve dönen ışınlar
    const sunX = sx(VIRT_W - 68), sunY = sy(86), sunR = sr(28);
    ctx.save();
    ctx.translate(sunX, sunY);
    ctx.rotate(frames * 0.008);
    ctx.strokeStyle = 'rgba(255, 224, 102, 0.75)';
    ctx.lineWidth = sr(4);
    for (let k = 0; k < 10; k++) {
      const a = (Math.PI * 2 * k) / 10;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (sunR + sr(5)), Math.sin(a) * (sunR + sr(5)));
      ctx.lineTo(Math.cos(a) * (sunR + sr(14)), Math.sin(a) * (sunR + sr(14)));
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = '#ffe066';
    ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2); ctx.fill();
    // Güneşin gülen yüzü
    ctx.fillStyle = '#b3541e';
    ctx.beginPath();
    ctx.arc(sunX - sr(7), sunY - sr(3), sr(2.6), 0, Math.PI * 2);
    ctx.arc(sunX + sr(7), sunY - sr(3), sr(2.6), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b3541e';
    ctx.lineWidth = sr(2.2);
    ctx.beginPath();
    ctx.arc(sunX, sunY + sr(1), sr(7.5), 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else {
    // Gece Masalı: Parıldayan yıldızlar & Gülen Ay Dede / Halkalı Gezegen
    for (let i = 0; i < bgTwinkles.length; i++) {
      const st = bgTwinkles[i];
      const al = 0.35 + 0.55 * Math.abs(Math.sin(frames * 0.04 + st.ph));
      ctx.fillStyle = `rgba(255, 248, 214, ${al.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(sx(st.x), sy(st.y), sr(st.r), 0, Math.PI * 2);
      ctx.fill();
    }
    const mx = sx(VIRT_W - 72), my = sy(88), mr = sr(26);
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
    if (currentSky === 'galaxy') {
      ctx.strokeStyle = 'rgba(255, 209, 102, 0.75)';
      ctx.lineWidth = sr(5);
      ctx.beginPath();
      ctx.ellipse(mx, my, mr * 1.65, mr * 0.45, -0.25, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Yumuşak gülümseyen arka plan bulutları
  for (let i = 0; i < bgClouds.length; i++) {
    const c = bgClouds[i];
    drawFluffyCloud(c.x, c.y, c.s, sk.night ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.88)', !sk.night && i === 0);
  }

  // Alt Masal Tepeleri & Çiçekler
  ctx.fillStyle = sk.hill1;
  ctx.beginPath();
  ctx.ellipse(sx(VIRT_W * 0.25), sy(VIRT_H + 10), sr(210), sr(78), 0, Math.PI, 0);
  ctx.fill();

  ctx.fillStyle = sk.hill2;
  ctx.beginPath();
  ctx.ellipse(sx(VIRT_W * 0.78), sy(VIRT_H + 12), sr(220), sr(84), 0, Math.PI, 0);
  ctx.fill();
}

function drawPetCatcher(vx, vy, petKey, tilt, scaleMul, alpha, nameTag, isGhost) {
  const pet = PETS[petKey] || PETS.bear;
  const cx = sx(vx), cy = sy(vy);
  const sc = Math.min(W / VIRT_W, H / VIRT_H) * scaleMul;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.rotate(tilt * 0.14);
  ctx.scale(sc, sc);

  // Kulaklar
  if (petKey === 'bunny') {
    // Uzun tavşan kulakları
    [-12, 12].forEach(ex => {
      ctx.fillStyle = pet.fur;
      ctx.beginPath(); ctx.ellipse(ex, -42, 6.5, 16, ex < 0 ? -0.12 : 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pet.ear;
      ctx.beginPath(); ctx.ellipse(ex, -42, 3.5, 11, ex < 0 ? -0.12 : 0.12, 0, Math.PI * 2); ctx.fill();
    });
  } else if (petKey === 'cat' || petKey === 'fox') {
    // Sivri kedi / tilki kulakları
    [-15, 15].forEach(ex => {
      ctx.fillStyle = pet.fur;
      ctx.beginPath();
      ctx.moveTo(ex - 8, -22);
      ctx.lineTo(ex, -42);
      ctx.lineTo(ex + 8, -22);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = pet.ear;
      ctx.beginPath();
      ctx.moveTo(ex - 4, -24);
      ctx.lineTo(ex, -37);
      ctx.lineTo(ex + 4, -24);
      ctx.closePath();
      ctx.fill();
    });
  } else {
    // Yuvarlak ayıcık / panda / unicorn kulakları
    [-16, 16].forEach(ex => {
      ctx.fillStyle = petKey === 'panda' ? pet.ear : pet.fur;
      ctx.beginPath(); ctx.arc(ex, -32, 8.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pet.ear;
      ctx.beginPath(); ctx.arc(ex, -32, 4.5, 0, Math.PI * 2); ctx.fill();
    });
  }

  // Unicorn altın boynuzu
  if (petKey === 'unicorn') {
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(-5, -34);
    ctx.lineTo(0, -52);
    ctx.lineTo(5, -34);
    ctx.closePath();
    ctx.fill();
  }

  // Sevimli Kafa
  ctx.fillStyle = pet.fur;
  ctx.beginPath();
  ctx.arc(0, -18, 21, 0, Math.PI * 2);
  ctx.fill();

  // Panda göz yamaları
  if (petKey === 'panda') {
    ctx.fillStyle = '#2b2d42';
    ctx.beginPath();
    ctx.ellipse(-7.5, -20, 5, 4, -0.2, 0, Math.PI * 2);
    ctx.ellipse(7.5, -20, 5, 4, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Gözler (arada sevimli göz kırpma!)
  const blinking = (frames % 190) > 183;
  ctx.fillStyle = petKey === 'panda' ? '#ffffff' : '#2b2d42';
  if (blinking) {
    ctx.strokeStyle = '#2b2d42';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-10, -20); ctx.lineTo(-4, -20);
    ctx.moveTo(4, -20);   ctx.lineTo(10, -20);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(-7.5, -20, 2.8, 0, Math.PI * 2);
    ctx.arc(7.5, -20, 2.8, 0, Math.PI * 2);
    ctx.fill();
    // Göz parıltısı
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-8.3, -21, 1.0, 0, Math.PI * 2);
    ctx.arc(6.7, -21, 1.0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pembe Yanaklar & Gülümseme
  ctx.fillStyle = pet.cheek;
  ctx.globalAlpha = alpha * 0.65;
  ctx.beginPath();
  ctx.arc(-13, -14, 4.2, 0, Math.PI * 2);
  ctx.arc(13, -14, 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = alpha;

  ctx.strokeStyle = '#4a2500';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -14, 5, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  // Önde Tutulan Yıldız Sepeti
  ctx.fillStyle = pet.basket;
  ctx.strokeStyle = '#8d5524';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-30, -4);
  ctx.lineTo(30, -4);
  ctx.lineTo(23, 20);
  ctx.lineTo(-23, 20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Sepet üzerindeki parlayan küçük yıldız arması
  ctx.fillStyle = '#fff3b0';
  drawStarShape(0, 8, 5, 7.5, 3.6, 0);
  ctx.fill();

  // Gökkuşağı Mıknatıs Halesi
  if (!isGhost && catcher.magnetTimer > 0) {
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(0, -6, 42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();

  if (nameTag) {
    ctx.save();
    ctx.font = '800 12px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = isGhost ? '#ffe066' : '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 4;
    ctx.fillText(nameTag, cx, cy + sr(34 * scaleMul));
    ctx.restore();
  }
}

function drawFallingItem(it) {
  const cx = sx(it.x), cy = sy(it.y), r = sr(it.r);
  ctx.save();
  ctx.translate(cx, cy);

  if (it.kind === 'star' || it.kind === 'superstar') {
    ctx.rotate(it.rot * 0.5);
    ctx.shadowColor = it.kind === 'superstar' ? '#ff9f1c' : '#ffd166';
    ctx.shadowBlur = it.kind === 'superstar' ? 16 : 10;
    ctx.fillStyle = it.kind === 'superstar' ? '#ffbe0b' : '#ffd166';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    drawStarShape(0, 0, 5, r * 1.12, r * 0.52, 0);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Yıldızın sevimli gözleri!
    ctx.fillStyle = '#5c3d00';
    ctx.beginPath();
    ctx.arc(-r * 0.22, -r * 0.05, Math.max(1.5, r * 0.11), 0, Math.PI * 2);
    ctx.arc(r * 0.22, -r * 0.05, Math.max(1.5, r * 0.11), 0, Math.PI * 2);
    ctx.fill();
  } else if (it.kind === 'candy') {
    ctx.rotate(it.rot * 0.6);
    // Paketli çilekli şeker
    ctx.fillStyle = '#ff70a6';
    ctx.beginPath();
    ctx.moveTo(-r * 1.2, -r * 0.5); ctx.lineTo(-r * 0.5, 0); ctx.lineTo(-r * 1.2, r * 0.5); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 1.2, -r * 0.5);  ctx.lineTo(r * 0.5, 0);  ctx.lineTo(r * 1.2, r * 0.5);  ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff477e';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, Math.PI); ctx.stroke();
  } else if (it.kind === 'coin') {
    ctx.fillStyle = '#ffd700';
    ctx.strokeStyle = '#fff3b0';
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#b36b00';
    ctx.font = `900 ${Math.round(r * 0.95)}px "Segoe UI", Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', 0, 1);
  } else if (it.kind === 'cloud') {
    // Gri yağmur bulutu + küçük mavi damlalar
    ctx.fillStyle = '#8395a7';
    ctx.beginPath();
    ctx.arc(-r * 0.55, 2, r * 0.55, 0, Math.PI * 2);
    ctx.arc(0, -r * 0.2, r * 0.72, 0, Math.PI * 2);
    ctx.arc(r * 0.55, 2, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#48dbfb';
    [-r * 0.35, 0, r * 0.35].forEach(dx => {
      ctx.beginPath();
      ctx.arc(dx, r * 0.72, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
    });
  } else {
    // Güçlendirme Baloncuğu (🌈, 🧺, 🎉, ❤️)
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.strokeStyle = it.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const emojiMap = { rainbow: '🌈', giant: '🧺', party: '🎉', heart: '❤️' };
    ctx.font = `${Math.round(r * 1.15)}px "Segoe UI Emoji", Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emojiMap[it.kind] || '✨', 0, 1);
  }

  ctx.restore();
}

function drawBalloon(b) {
  const cx = sx(b.x), cy = sy(b.y), r = sr(b.r);
  ctx.save();
  ctx.translate(cx, cy);

  // Sallanan balon ipi
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(0, r * 1.08);
  ctx.quadraticCurveTo(Math.sin(b.sway * 2) * 8, r * 1.55, 0, r * 2.0);
  ctx.stroke();

  // Balon gövdesi
  ctx.fillStyle = b.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.92, r * 1.10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Parlak ışık yansıması
  ctx.fillStyle = 'rgba(255,255,255,0.42)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.32, -r * 0.35, r * 0.20, r * 0.36, -0.35, 0, Math.PI * 2);
  ctx.fill();

  if (b.isGift) {
    ctx.font = `${Math.round(r * 1.05)}px "Segoe UI Emoji", Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎁', 0, 2);
  }

  ctx.restore();
}

function draw() {
  drawSkyWorld();

  // Uçan balonlar
  for (let i = 0; i < balloons.length; i++) {
    if (balloons[i]) drawBalloon(balloons[i]);
  }

  // Düşen yıldızlar & şekerler
  for (let i = 0; i < items.length; i++) {
    if (items[i]) drawFallingItem(items[i]);
  }

  // Çevrimiçi Arkadaşın Sevimli Karakteri
  if (MP.connected && (state === STATE.PLAYING || state === STATE.READY)) {
    const oppAlpha = MP.spectating ? 1.0 : (MP.oppDone ? 0.35 : 0.65);
    drawPetCatcher(MP.oppX, VIRT_H - 76, MP.oppPet || 'cat', 0, 1.0, oppAlpha, `${MP.oppName} (${MP.oppScore})`, !MP.spectating);
  }

  // Oyuncunun Karakteri & Sepeti
  if (!MP.spectating && (state === STATE.PLAYING || state === STATE.READY || state === STATE.PAUSED || state === STATE.MENU)) {
    const md = MODES[currentMode] || MODES.kids;
    const grow = (catcher.giantTimer > 0 ? 1.38 : 1.0) * (1 + catcher.bounceAnim * 0.14) * (md.basketMul > 1.15 ? 1.12 : 1.0);
    const blinkAlpha = (catcher.invuln > 0 && Math.floor(frames / 5) % 2 === 0) ? 0.55 : 1.0;
    const myX = state === STATE.MENU ? (VIRT_W * 0.5 + Math.sin(frames * 0.03) * 55) : catcher.x;
    drawPetCatcher(myX, VIRT_H - 76, ST.pet, catcher.tilt, grow, blinkAlpha, MP.connected ? MP.myName : '', false);
  }

  // Konfetiler
  for (let i = 0; i < confetti.length; i++) {
    const pt = confetti[i];
    if (!pt) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.translate(sx(pt.x), sy(pt.y));
    ctx.rotate(pt.rot);
    ctx.fillStyle = pt.color;
    const cr = sr(pt.r);
    ctx.fillRect(-cr, -cr * 0.6, cr * 2, cr * 1.2);
    ctx.restore();
  }

  // Uçan Tebrik Yazıları
  for (let i = 0; i < popups.length; i++) {
    const pp = popups[i];
    if (!pp) continue;
    ctx.save();
    ctx.globalAlpha = Math.min(1, (pp.life / pp.maxLife) * 1.4);
    ctx.font = `900 ${pp.big ? Math.round(sr(21)) : Math.round(sr(16))}px "Segoe UI", Arial`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 4;
    ctx.strokeText(pp.text, sx(pp.x), sy(pp.y));
    ctx.fillStyle = pp.color;
    ctx.fillText(pp.text, sx(pp.x), sy(pp.y));
    ctx.restore();
  }

  // Çevrimiçi Geri Sayım (3 - 2 - 1 - BAŞLA!)
  if (state === STATE.READY && MP.connected && mpCountdown > 0) {
    const sec = Math.ceil(mpCountdown / 60);
    ctx.save();
    ctx.fillStyle = 'rgba(10, 25, 50, 0.35)';
    ctx.fillRect(0, 0, W, H);
    ctx.font = `900 ${Math.round(sr(68))}px "Segoe UI", Arial`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd166';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 14;
    ctx.fillText(sec > 0 ? String(sec) : 'BAŞLA! 🌟', W * 0.5, H * 0.45);
    ctx.restore();
  }
}

// ---------- Dokunmatik, Fare ve Klavye Kontrolleri ----------
let dragging = false;

function clientToVirt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const rw = rect.width || W || 420;
  const rh = rect.height || H || 700;
  return {
    vx: ((clientX - rect.left) / rw) * VIRT_W,
    vy: ((clientY - rect.top) / rh) * VIRT_H
  };
}

function onPointerDown(clientX, clientY) {
  getAudio();
  const { vx, vy } = clientToVirt(clientX, clientY);
  // Önce dokunulan yerde balon varsa patlat!
  tryPopBalloonAt(vx, vy);
  dragging = true;
  if (state === STATE.PLAYING || state === STATE.READY) {
    catcher.targetX = vx;
  }
}

function onPointerMove(clientX, clientY) {
  if (!dragging && state !== STATE.PLAYING) return;
  const { vx, vy } = clientToVirt(clientX, clientY);
  if (dragging) {
    // Parmağı balonların üzerinden kaydırırken de patlatsın!
    tryPopBalloonAt(vx, vy);
    catcher.targetX = vx;
  }
}

function onPointerUp() {
  dragging = false;
}

canvas.addEventListener('mousedown', e => onPointerDown(e.clientX, e.clientY));
window.addEventListener('mousemove', e => { if (dragging) onPointerMove(e.clientX, e.clientY); });
window.addEventListener('mouseup', onPointerUp);

canvas.addEventListener('touchstart', e => {
  if (!e.touches || !e.touches[0]) return;
  e.preventDefault();
  onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  if (!e.touches || !e.touches[0]) return;
  e.preventDefault();
  onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });

canvas.addEventListener('touchend', onPointerUp);
canvas.addEventListener('touchcancel', onPointerUp);

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space' && state === STATE.PLAYING) {
      e.preventDefault();
      triggerRainbowShower();
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
      if (state === STATE.PLAYING && !MP.connected) togglePause();
      else if (state === STATE.PAUSED) togglePause();
    }
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
}

// ---------- Menü, Oyuncak Dükkânı, Skor Tablosu & İstatistik UI ----------
let currentShopTab = 'pets';

function updateMenuUI() {
  if ($('menu-coins')) $('menu-coins').textContent = ST.coins;
  if ($('best-score-display')) $('best-score-display').textContent = `🏆 En Çok Yıldız: ${ST.bestScore}`;
  if ($('sound-btn')) $('sound-btn').textContent = settings.soundOn ? '🔊 Ses: Açık' : '🔇 Ses: Kapalı';
  if ($('music-btn')) $('music-btn').textContent = settings.musicOn ? '🎵 Müzik: Açık' : '🔕 Müzik: Kapalı';
  if ($('volume-range')) $('volume-range').value = Math.round(settings.volume * 100);

  document.querySelectorAll('#menu-skin-row .skin-btn').forEach(btn => {
    const sk = btn.dataset.skin;
    const owned = ST.ownedPets.includes(sk);
    btn.classList.toggle('active', ST.pet === sk);
    btn.classList.toggle('locked', !owned);
  });

  document.querySelectorAll('#diff-tabs .diff-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.diff === ST.mode);
  });
}

function renderShop() {
  if ($('shop-coins')) $('shop-coins').textContent = ST.coins;
  const list = $('shop-list');
  if (!list) return;
  list.innerHTML = '';

  const catalog = currentShopTab === 'pets' ? PETS : SKIES;
  const ownedArr = currentShopTab === 'pets' ? ST.ownedPets : ST.ownedSkies;
  const activeKey = currentShopTab === 'pets' ? ST.pet : ST.sky;

  Object.keys(catalog).forEach(key => {
    const item = catalog[key];
    const owned = ownedArr.includes(key);
    const selected = activeKey === key;

    const row = document.createElement('div');
    row.className = 'shop-item' + (selected ? ' selected' : '');
    row.innerHTML = `
      <div class="shop-item-left">
        <span class="shop-emoji">${item.icon}</span>
        <div>
          <div class="shop-name">${item.name}</div>
          <div class="shop-sub">${owned ? (selected ? '✅ Seçili' : 'Sahipsin') : '🪙 ' + item.price + ' Altın'}</div>
        </div>
      </div>
      <button class="shop-buy-btn" type="button">${selected ? 'Seçili' : (owned ? 'Seç' : 'Al 🪙' + item.price)}</button>
    `;
    row.querySelector('button').addEventListener('click', () => {
      if (owned) {
        if (currentShopTab === 'pets') ST.pet = key;
        else { ST.sky = key; currentSky = key; }
        sfx.star();
        persist();
        renderShop();
        updateMenuUI();
      } else if (ST.coins >= item.price) {
        ST.coins -= item.price;
        ownedArr.push(key);
        if (currentShopTab === 'pets') ST.pet = key;
        else { ST.sky = key; currentSky = key; }
        sfx.gift();
        if ($('shop-msg')) $('shop-msg').textContent = `🎉 ${item.name} açıldı!`;
        persist();
        renderShop();
        updateMenuUI();
      } else {
        sfx.rain();
        if ($('shop-msg')) $('shop-msg').textContent = '🪙 Biraz daha yıldız ve altın toplayalım!';
      }
    });
    list.appendChild(row);
  });
}

function renderLeaderboard() {
  const list = $('lb-list');
  if (!list) return;
  if (!ST.leaderboard.length) {
    list.innerHTML = '<div class="lb-empty">Henüz kayıtlı şampiyon yok 🌟</div>';
    return;
  }
  list.innerHTML = ST.leaderboard.map((row, idx) => {
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
    return `<div class="lb-row"><span>${medal} ${row.name}</span><span>⭐ ${row.score}</span></div>`;
  }).join('');
}

function renderStats() {
  if ($('st-best'))     $('st-best').textContent = ST.bestScore;
  if ($('st-stars'))    $('st-stars').textContent = ST.stats.starsCaught;
  if ($('st-balloons')) $('st-balloons').textContent = ST.stats.balloonsPopped;
  if ($('st-gifts'))    $('st-gifts').textContent = ST.stats.giftsOpened;
  if ($('st-combo'))    $('st-combo').textContent = ST.stats.bestCombo;
  if ($('st-games'))    $('st-games').textContent = ST.stats.games;
  if ($('st-coins'))    $('st-coins').textContent = ST.stats.totalCoins;
}

function togglePause() {
  if (state === STATE.PLAYING) {
    state = STATE.PAUSED;
    show(pauseScreen);
  } else if (state === STATE.PAUSED) {
    state = STATE.PLAYING;
    hide(pauseScreen);
  }
}

// ============================================================================
//        1v1 ÇEVRİMİÇİ ARKADAŞ / KARDEŞ YILDIZ YARIŞI (PeerJS + MPCore)
// ============================================================================
const MP = {
  peer: null,
  conn: null,
  isHost: false,
  connected: false,
  waiting: false,
  inLobby: false,
  spectating: false,
  reconnecting: false,
  graceFrames: 0,
  switching: false,
  targetSwitchFile: '',
  roomCode: '',
  myName: 'Oyuncu 1',
  oppName: 'Arkadaş',
  myReady: false,
  oppReady: false,
  oppScore: 0,
  oppX: VIRT_W * 0.5,
  oppPet: 'cat',
  oppDone: false,
  meDone: false,
  seriesMe: 0,
  seriesOpp: 0,
  pingMs: 0,
  lobbyMode: 'party',
  lobbySky: 'meadow',
  seed: 12345,
  joinTries: 0,
  idRetryCount: 0,
  timer: null,
  switchTimer: null,
  cancelProbe: null
};

function mpSend(d) {
  if (MP.conn && (MP.connected || MP.conn.open)) {
    try { MP.conn.send(d); } catch (e) {}
  }
}

function mpMakeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function mpInviteUrl() {
  try {
    if (typeof location !== 'undefined' && location.origin && location.pathname) {
      return location.origin + location.pathname + '?room=' + MP.roomCode;
    }
  } catch (e) {}
  return '?room=' + MP.roomCode;
}

function mpGetMyName() {
  const inp = $('mp-name-input');
  const v = (inp ? inp.value.trim() : '') || ST.playerName;
  if (v) {
    ST.playerName = v.slice(0, 12);
    persist();
    return ST.playerName;
  }
  return MP.isHost ? 'Kaptan' : 'Yıldızcı';
}

function mpCleanup() {
  MP.waiting = false;
  MP.inLobby = false;
  MP.spectating = false;
  MP.reconnecting = false;
  mpHideSpectatorBanner();
  const gb = $('mp-grace-banner');
  if (gb) hide(gb);
  if (MP.cancelProbe) { MP.cancelProbe(); MP.cancelProbe = null; }
  if (MP.timer) { clearTimeout(MP.timer); MP.timer = null; }
  if (MP.switchTimer) { clearTimeout(MP.switchTimer); MP.switchTimer = null; }
  if (MP.conn) { try { MP.conn.close(); } catch (e) {} }
  if (MP.peer) { try { MP.peer.destroy(); } catch (e) {} }
  MP.conn = null;
  MP.peer = null;
  MP.connected = false;
}

function mpOpenUI() {
  hide(menuScreen);
  hide(gameoverScreen);
  hide(mpGameoverScreen);
  show(mpScreen);
  show($('mp-name-input'));
  show($('mp-btn-row'));
  hide($('mp-host-area'));
  hide($('mp-join-area'));
  const ra = $('mp-ready-area');
  if (ra) hide(ra);
  if ($('mp-error')) $('mp-error').textContent = '';
  if ($('mp-join-status')) $('mp-join-status').textContent = '';
  if ($('mp-name-input')) $('mp-name-input').value = ST.playerName || '';
}

function mpEnsureSpectatorBanner() {
  let el = $('mp-spectator-banner');
  if (!el && canvas.parentElement && typeof document !== 'undefined') {
    el = document.createElement('div');
    el.id = 'mp-spectator-banner';
    el.className = 'mp-spectator-banner hidden';
    el.innerHTML = `
      <div class="mp-spec-left">
        <span class="mp-live-dot"></span>
        <span id="mp-spec-text">Arkadaşın yıldız topluyor...</span>
      </div>
      <span class="mp-spec-scores" id="mp-spec-scores">0 - 0</span>
      <button type="button" class="mp-spec-exit" id="mp-spec-exit-btn">Çık</button>
    `;
    canvas.parentElement.appendChild(el);
    const ex = $('mp-spec-exit-btn');
    if (ex) ex.addEventListener('click', () => {
      mpSend({ t: '_leave' });
      if (MPC) MPC.clearParty();
      mpCleanup();
      hide(hud);
      state = STATE.MENU;
      show(menuScreen);
    });
  }
  return el;
}

function mpUpdateSpectatorBanner() {
  const el = mpEnsureSpectatorBanner();
  if (!el) return;
  if (!MP.spectating) { hide(el); return; }
  show(el);
  if ($('mp-spec-text')) $('mp-spec-text').textContent = `👀 ${MP.oppName} oynuyor...`;
  if ($('mp-spec-scores')) $('mp-spec-scores').textContent = `⭐ ${score} - ${MP.oppScore}`;
}

function mpHideSpectatorBanner() {
  const el = $('mp-spectator-banner');
  if (el) hide(el);
}

function mpFinishSwitchNavigate() {
  const dest = MP.targetSwitchFile;
  if (!dest) return;
  MP.targetSwitchFile = '';
  if (MP.switchTimer) { clearTimeout(MP.switchTimer); MP.switchTimer = null; }
  mpCleanup();
  location.href = dest;
}

function mpSwitchGame(gid) {
  if (!MPC || !MPC.GAMES[gid] || MP.switching) return;
  if (!MP.isHost) return;
  MP.myName = MP.myName || mpGetMyName();

  if (!MP.connected) {
    const code = MP.roomCode || mpMakeCode();
    MPC.saveParty({
      roomCode: code,
      role: 'host',
      myName: MP.myName,
      oppName: '',
      targetGame: gid,
      seriesMe: MP.seriesMe,
      seriesOpp: MP.seriesOpp,
      autoConnect: true
    });
    mpCleanup();
    location.href = MPC.GAMES[gid].file;
    return;
  }

  MP.switching = true;
  MP.targetSwitchFile = MPC.GAMES[gid].file;
  MPC.saveParty({
    roomCode: MP.roomCode,
    role: 'host',
    myName: MP.myName,
    oppName: MP.oppName,
    targetGame: gid,
    seriesMe: MP.seriesMe,
    seriesOpp: MP.seriesOpp,
    autoConnect: true
  });
  const pkt = { t: '_switch_game', game: gid, roomCode: MP.roomCode };
  mpSend(pkt);
  setTimeout(() => { if (MP.switching) mpSend(pkt); }, 90);
  MP.switchTimer = setTimeout(mpFinishSwitchNavigate, 380);
}

function mpRenderLobby() {
  if (!MPC) return;
  const lobbyEl = $('mp-lobby');
  const area = MPC.mountReadyRoom(lobbyEl, {
    gameId: 'stars',
    onToggleReady: () => mpSetReady(!MP.myReady),
    onSwitchGame: gid => mpSwitchGame(gid)
  });
  if (!area) return;
  hide($('mp-name-input'));
  hide($('mp-btn-row'));
  hide($('mp-host-area'));
  hide($('mp-join-area'));
  show(area);

  MPC.renderReadyState({
    roomCode: MP.roomCode,
    isHost: MP.isHost,
    myName: MP.myName,
    oppName: MP.oppName,
    myReady: MP.myReady,
    oppReady: MP.oppReady,
    settingsRows: [
      {
        label: 'Mod',
        value: MP.lobbyMode,
        options: [
          { value: 'party', label: '🎉 Parti (60sn)' },
          { value: 'happy', label: '⭐ 5 Kalp' }
        ],
        onChange: val => {
          MP.lobbyMode = val;
          MP.myReady = false;
          MP.oppReady = false;
          mpSend({ t: 'lobby_cfg', mode: MP.lobbyMode, sky: MP.lobbySky, name: MP.myName, pet: ST.pet });
          mpRenderLobby();
        }
      },
      {
        label: 'Gökyüzü',
        value: MP.lobbySky,
        options: [
          { value: 'meadow', label: '🌈 Çayır' },
          { value: 'candy',  label: '🍭 Şeker' },
          { value: 'dream',  label: '🌙 Masal' },
          { value: 'galaxy', label: '🪐 Uzay' }
        ],
        onChange: val => {
          MP.lobbySky = val;
          MP.myReady = false;
          MP.oppReady = false;
          mpSend({ t: 'lobby_cfg', mode: MP.lobbyMode, sky: MP.lobbySky, name: MP.myName, pet: ST.pet });
          mpRenderLobby();
        }
      }
    ]
  });
  MPC.updatePingDOM(MP.pingMs);
}

function mpSetReady(val) {
  if (!MP.connected || !MP.inLobby) return;
  MP.myReady = !!val;
  mpSend({ t: 'ready', ready: MP.myReady, pet: ST.pet, name: MP.myName });
  mpRenderLobby();
  if (MP.isHost && MP.myReady && MP.oppReady) {
    MP.seed = ((Date.now() ^ ((Math.random() * 0xffffffff) >>> 0)) >>> 0) || 77777;
    mpSend({ t: 'start', seed: MP.seed, mode: MP.lobbyMode, sky: MP.lobbySky });
    mpBeginMatch(MP.seed, MP.lobbyMode, MP.lobbySky, false);
  }
}

function mpBeginMatch(seed, mode, sky, isGuest) {
  MP.inLobby = false;
  MP.myReady = false;
  MP.oppReady = false;
  MP.meDone = false;
  MP.oppDone = false;
  MP.oppScore = 0;
  MP.spectating = false;
  mpHideSpectatorBanner();

  currentMode = MODES[mode] ? mode : 'party';
  currentSky = SKIES[sky] ? sky : 'meadow';
  resetRun(seed);

  hide(mpScreen);
  hide(mpGameoverScreen);
  hide(menuScreen);
  show(hud);
  show(tapHint);

  mpCountdown = (isGuest && MPC) ? MPC.compensatedCountdownFrames(180, MP.pingMs) : 180;
  state = STATE.READY;
  ensureMusicLoop();
}

function mpOnScore() {
  if (!MP.connected) return;
  mpSend({ t: 'sc', s: score });
  if (MP.spectating) mpUpdateSpectatorBanner();
}

function mpOnFinish() {
  if (MP.meDone) return;
  MP.meDone = true;
  mpSend({ t: 'done', s: score });
  if (!MP.oppDone) {
    MP.spectating = true;
    mpUpdateSpectatorBanner();
  } else {
    mpShowFinalResult();
  }
}

function mpShowFinalResult() {
  MP.spectating = false;
  mpHideSpectatorBanner();
  state = STATE.GAMEOVER;
  hide(hud);
  hide(tapHint);
  sfx.celebrate();

  if (score > MP.oppScore) MP.seriesMe++;
  else if (MP.oppScore > score) MP.seriesOpp++;

  const earned = runCoins + Math.max(1, Math.floor(score / 60));
  ST.coins += earned;
  if (score > ST.bestScore) ST.bestScore = score;
  persist();

  if ($('mp-series-text')) $('mp-series-text').textContent = `🏅 Seri: ${MP.seriesMe} - ${MP.seriesOpp}`;
  if ($('mp-me-label'))    $('mp-me-label').textContent = MP.myName;
  if ($('mp-opp-label'))   $('mp-opp-label').textContent = MP.oppName;
  if ($('mp-final-me'))    $('mp-final-me').textContent = `⭐ ${score}`;
  if ($('mp-final-opp'))   $('mp-final-opp').textContent = `⭐ ${MP.oppScore}`;

  const resEl = $('mp-result-text');
  if (resEl) {
    if (score > MP.oppScore)      resEl.textContent = '🏆 TEBRİKLER, KAZANDIN! 🎉';
    else if (score < MP.oppScore) resEl.textContent = `👏 ${MP.oppName} Kazandı! Harika yarıştınız!`;
    else                          resEl.textContent = '🤝 DOSTLUK KAZANDI (BERABERE)!';
  }

  if (MPC) {
    MPC.mountGameoverSwitcher(mpGameoverScreen, 'stars', () => MP.isHost, gid => mpSwitchGame(gid));
  }
  show(mpGameoverScreen);
}

function mpEnterGraceReconnect() {
  if (MP.reconnecting || state === STATE.GAMEOVER || state === STATE.MENU) return;
  MP.reconnecting = true;
  MP.connected = false;
  MP.graceFrames = 12 * 60;
  if (MPC && canvas.parentElement) {
    const gb = MPC.ensureGraceBanner(canvas.parentElement, () => {
      if (MPC) MPC.clearParty();
      mpCleanup();
      hide(hud);
      state = STATE.MENU;
      show(menuScreen);
    });
    if (gb) show(gb);
  }
  if (MP.isHost) mpEnsureHostAlive(true);
  else mpAttemptJoin();
}

function mpSetupConn() {
  const conn = MP.conn;
  if (!conn) return;
  let opened = false;
  const onOpen = () => {
    if (opened || MP.conn !== conn) return;
    opened = true;
    MP.waiting = false;
    MP.connected = true;
    if (MP.cancelProbe) { MP.cancelProbe(); MP.cancelProbe = null; }
    if (MP.timer) { clearTimeout(MP.timer); MP.timer = null; }

    if (MP.reconnecting) {
      MP.reconnecting = false;
      const gb = $('mp-grace-banner');
      if (gb) hide(gb);
      mpSend({ t: '_resume', name: MP.myName, pet: ST.pet, s: score, done: MP.meDone });
      return;
    }

    MP.inLobby = true;
    MP.myReady = false;
    MP.oppReady = false;
    mpSend({ t: 'hello', name: MP.myName, pet: ST.pet, mode: MP.lobbyMode, sky: MP.lobbySky });
    mpRenderLobby();
  };

  if (conn.open) onOpen();
  else conn.on('open', onOpen);

  conn.on('data', d => {
    if (!d || !d.t) return;
    if (d.t === '_ping') { mpSend({ t: '_pong', ts: d.ts }); return; }
    if (d.t === '_pong') {
      const rtt = Math.max(1, performance.now() - (d.ts || 0));
      MP.pingMs = MP.pingMs > 0 ? MP.pingMs * 0.65 + rtt * 0.35 : rtt;
      if (MPC) MPC.updatePingDOM(MP.pingMs);
      return;
    }
    if (d.t === '_switch_ack') {
      if (MP.switching && MP.isHost) mpFinishSwitchNavigate();
      return;
    }
    if (d.t === '_switch_game' && MPC && MPC.GAMES[d.game]) {
      if (MP.switching) return;
      MP.switching = true;
      MP.targetSwitchFile = MPC.GAMES[d.game].file;
      MPC.saveParty({
        roomCode: d.roomCode || MP.roomCode,
        role: 'guest',
        myName: MP.myName,
        oppName: MP.oppName,
        targetGame: d.game,
        seriesMe: MP.seriesMe,
        seriesOpp: MP.seriesOpp,
        autoConnect: true
      });
      mpSend({ t: '_switch_ack', game: d.game });
      MP.switchTimer = setTimeout(mpFinishSwitchNavigate, 80);
      return;
    }
    if (d.t === '_resume') {
      MP.reconnecting = false;
      const gb = $('mp-grace-banner');
      if (gb) hide(gb);
      if (d.name) MP.oppName = String(d.name).slice(0, 12);
      if (d.pet && PETS[d.pet]) MP.oppPet = d.pet;
      if (typeof d.s === 'number') MP.oppScore = d.s;
      if (d.done) MP.oppDone = true;
      return;
    }
    if (d.t === 'hello') {
      if (d.name) MP.oppName = String(d.name).slice(0, 12);
      if (d.pet && PETS[d.pet]) MP.oppPet = d.pet;
      if (!MP.isHost) {
        if (d.mode && MODES[d.mode]) MP.lobbyMode = d.mode;
        if (d.sky && SKIES[d.sky]) MP.lobbySky = d.sky;
      } else {
        mpSend({ t: 'lobby_cfg', mode: MP.lobbyMode, sky: MP.lobbySky, name: MP.myName, pet: ST.pet });
      }
      if (MP.inLobby) mpRenderLobby();
    } else if (d.t === 'lobby_cfg') {
      if (d.name) MP.oppName = String(d.name).slice(0, 12);
      if (d.pet && PETS[d.pet]) MP.oppPet = d.pet;
      if (!MP.isHost) {
        if (d.mode && MODES[d.mode]) MP.lobbyMode = d.mode;
        if (d.sky && SKIES[d.sky]) MP.lobbySky = d.sky;
      }
      MP.myReady = false;
      MP.oppReady = false;
      if (MP.inLobby) mpRenderLobby();
    } else if (d.t === 'ready') {
      MP.oppReady = !!d.ready;
      if (d.pet && PETS[d.pet]) MP.oppPet = d.pet;
      if (d.name) MP.oppName = String(d.name).slice(0, 12);
      if (MP.inLobby) mpRenderLobby();
      if (MP.isHost && MP.myReady && MP.oppReady) {
        MP.seed = ((Date.now() ^ ((Math.random() * 0xffffffff) >>> 0)) >>> 0) || 77777;
        mpSend({ t: 'start', seed: MP.seed, mode: MP.lobbyMode, sky: MP.lobbySky });
        mpBeginMatch(MP.seed, MP.lobbyMode, MP.lobbySky, false);
      }
    } else if (d.t === 'start') {
      mpBeginMatch(d.seed || 77777, d.mode || 'party', d.sky || 'meadow', true);
    } else if (d.t === 'pos') {
      if (typeof d.nx === 'number') MP.oppX = Math.max(30, Math.min(VIRT_W - 30, d.nx * VIRT_W));
      if (typeof d.s === 'number') MP.oppScore = d.s;
      if (MP.spectating) mpUpdateSpectatorBanner();
    } else if (d.t === 'sc') {
      if (typeof d.s === 'number') MP.oppScore = d.s;
      if (MP.spectating) mpUpdateSpectatorBanner();
    } else if (d.t === 'done') {
      if (typeof d.s === 'number') MP.oppScore = d.s;
      MP.oppDone = true;
      if (MP.meDone) mpShowFinalResult();
    } else if (d.t === 'rematch') {
      hide(mpGameoverScreen);
      show(mpScreen);
      MP.inLobby = true;
      MP.myReady = false;
      MP.oppReady = false;
      mpRenderLobby();
    } else if (d.t === '_leave') {
      MP.switching = true;
      if (MPC) MPC.clearParty();
      mpCleanup();
      hide(hud);
      hide(mpGameoverScreen);
      state = STATE.MENU;
      mpOpenUI();
      if ($('mp-error')) $('mp-error').textContent = 'Arkadaşın odadan ayrıldı.';
    }
  });

  conn.on('close', () => {
    if (MP.switching) {
      if (MP.targetSwitchFile) mpFinishSwitchNavigate();
      return;
    }
    if (state === STATE.PLAYING || state === STATE.READY) {
      mpEnterGraceReconnect();
      return;
    }
    if (!MP.connected) return;
    mpCleanup();
    mpOpenUI();
    if ($('mp-error')) $('mp-error').textContent = 'Bağlantı kapandı.';
  });
}

function mpEnsureHostAlive(forceRecreate) {
  if ((!MP.waiting && !MP.reconnecting) || MP.connected || !MP.roomCode) return;
  if (typeof Peer === 'undefined') return;
  if (!forceRecreate && MP.peer && !MP.peer.destroyed && !MP.peer.disconnected) return;
  if (MP.timer) { clearTimeout(MP.timer); MP.timer = null; }
  if (MP.peer) {
    try {
      if (MP.peer.disconnected && !MP.peer.destroyed && !forceRecreate) {
        MP.peer.reconnect();
        return;
      }
      MP.peer.destroy();
    } catch (e) {}
    MP.peer = null;
  }

  const peer = new Peer('stars-' + MP.roomCode, MPC ? MPC.PEER_OPTS : undefined);
  MP.peer = peer;
  peer.on('open', () => {
    if (MP.peer !== peer) return;
    MP.idRetryCount = 0;
    if (!MP.reconnecting) {
      if ($('mp-room-code')) $('mp-room-code').textContent = MP.roomCode;
      if ($('mp-wait-text')) $('mp-wait-text').textContent = '✅ Oda hazır! Kodu arkadaşına gönder.';
      if (MPC) {
        MPC.mountHostQR($('mp-host-area'), mpInviteUrl());
        MPC.mountHostGamePicker($('mp-host-area'), 'stars', gid => mpSwitchGame(gid));
      }
    }
  });
  peer.on('connection', conn => {
    if (MP.peer !== peer) return;
    if (MPC && MPC.answerProbeIfAny(conn, 'stars', MP.roomCode, MP.connected)) return;
    if (MP.conn && MP.connected) { try { conn.close(); } catch (e) {} return; }
    if (MP.conn) { try { MP.conn.close(); } catch (e) {} }
    MP.conn = conn;
    mpSetupConn();
  });
  peer.on('disconnected', () => {
    if (MP.peer !== peer || (!MP.waiting && !MP.reconnecting) || MP.connected) return;
    MP.timer = setTimeout(() => mpEnsureHostAlive(true), 600);
  });
  peer.on('error', err => {
    if (MP.peer !== peer || (!MP.waiting && !MP.reconnecting) || MP.connected) return;
    const tp = (err && err.type) || '';
    if (tp === 'unavailable-id') {
      MP.idRetryCount++;
      if (MP.idRetryCount <= 6) {
        MP.timer = setTimeout(() => mpEnsureHostAlive(true), 1200);
        return;
      }
      if (!MP.reconnecting) {
        MP.idRetryCount = 0;
        MP.roomCode = mpMakeCode();
        if ($('mp-room-code')) $('mp-room-code').textContent = MP.roomCode;
      }
    }
    MP.timer = setTimeout(() => mpEnsureHostAlive(true), 1200);
  });
}

function mpHost(existingCode) {
  if (typeof Peer === 'undefined') {
    if ($('mp-error')) $('mp-error').textContent = 'Çevrimiçi kütüphane yüklenemedi.';
    return;
  }
  const keep = (typeof existingCode === 'string' && existingCode.length === 5) ? existingCode.toUpperCase() : '';
  mpCleanup();
  MP.isHost = true;
  MP.myName = mpGetMyName();
  MP.roomCode = keep || mpMakeCode();
  MP.waiting = true;
  MP.idRetryCount = 0;
  MP.lobbyMode = 'party';
  MP.lobbySky = ST.sky || 'meadow';

  hide($('mp-name-input'));
  hide($('mp-btn-row'));
  show($('mp-host-area'));
  if ($('mp-room-code')) $('mp-room-code').textContent = MP.roomCode;
  if ($('mp-wait-text')) $('mp-wait-text').textContent = 'Sunucuya bağlanılıyor...';
  if (MPC) {
    MPC.mountHostQR($('mp-host-area'), mpInviteUrl());
    MPC.mountHostGamePicker($('mp-host-area'), 'stars', gid => mpSwitchGame(gid));
  }
  mpEnsureHostAlive(true);
}

function mpJoin() {
  MP.myName = mpGetMyName();
  hide($('mp-name-input'));
  hide($('mp-btn-row'));
  show($('mp-join-area'));
}

function mpAttemptJoin() {
  if (MP.connected || MP.isHost || !MP.roomCode) return;
  if (typeof Peer === 'undefined') return;
  if (MP.timer) { clearTimeout(MP.timer); MP.timer = null; }
  if (MP.peer) { try { MP.peer.destroy(); } catch (e) {} MP.peer = null; }

  MP.joinTries++;
  if (!MP.reconnecting && $('mp-join-status')) {
    $('mp-join-status').textContent = MP.joinTries === 1 ? 'Bağlanılıyor...' : `⏳ Oda aranıyor... (${MP.joinTries}/10)`;
  }

  const peer = new Peer(null, MPC ? MPC.PEER_OPTS : undefined);
  MP.peer = peer;
  const retry = msg => {
    if (MP.peer !== peer || MP.connected || MP.switching) return;
    if (MP.joinTries < 10) MP.timer = setTimeout(mpAttemptJoin, 1800);
    else if ($('mp-join-status')) $('mp-join-status').textContent = msg || 'Oda bulunamadı!';
  };
  MP.timer = setTimeout(() => retry('Oda yanıt vermedi.'), 3600);

  peer.on('open', () => {
    if (MP.peer !== peer || MP.connected) return;
    MP.conn = peer.connect('stars-' + MP.roomCode, { reliable: true });
    mpSetupConn();
  });
  peer.on('error', err => {
    const tp = (err && err.type) || '';
    if (tp === 'peer-unavailable' && !MP.reconnecting && !MP.cancelProbe && MPC) {
      MP.cancelProbe = MPC.probeRoomAcrossGames(Peer, MP.roomCode, 'stars-', foundGame => {
        if (MP.connected || MP.switching) return;
        const destFile = foundGame === 'hub' ? 'index.html' : (MPC.GAMES[foundGame] && MPC.GAMES[foundGame].file);
        if (!destFile) return;
        MP.switching = true;
        MPC.saveParty({
          roomCode: MP.roomCode,
          role: 'guest',
          myName: MP.myName,
          oppName: 'Ev Sahibi',
          targetGame: foundGame,
          autoConnect: true
        });
        mpCleanup();
        location.href = destFile;
      });
    }
    retry('Oda bulunamadı, kodu kontrol et!');
  });
}

function mpJoinConfirm() {
  const inp = $('mp-code-input');
  const code = (inp ? inp.value.trim() : '').toUpperCase();
  if (code.length !== 5) {
    if ($('mp-join-status')) $('mp-join-status').textContent = '5 haneli kod gir!';
    return;
  }
  mpCleanup();
  MP.isHost = false;
  MP.myName = mpGetMyName();
  MP.roomCode = code;
  MP.joinTries = 0;
  mpAttemptJoin();
}

function mpCountdownTick() {
  if (mpCountdown > 0) {
    mpCountdown--;
    if (mpCountdown === 0) state = STATE.PLAYING;
  }
}

function mpPetTick() {
  if (!MP.connected) return;
  if (frames % 3 === 0 && !MP.meDone) {
    mpSend({ t: 'pos', nx: Number((catcher.x / VIRT_W).toFixed(4)), s: score });
  }
}

function mpBgTick() {
  if (MP.connected && frames % 60 === 0) {
    mpSend({ t: '_ping', ts: Math.round(performance.now()) });
  }
}

function mpGraceTick() {
  if (!MP.reconnecting) return;
  MP.graceFrames--;
  const sub = $('mp-grace-sub');
  if (sub && frames % 15 === 0) {
    sub.textContent = `Arkadaşının bağlantısı yenileniyor (${Math.max(0, Math.ceil(MP.graceFrames / 60))} sn)`;
  }
  if (MP.graceFrames <= 0) {
    MP.reconnecting = false;
    const gb = $('mp-grace-banner');
    if (gb) hide(gb);
    mpCleanup();
    hide(hud);
    state = STATE.MENU;
    show(menuScreen);
  }
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && MP.waiting && !MP.connected && MP.isHost) mpEnsureHostAlive(false);
});
if (typeof window !== 'undefined') {
  window.addEventListener('focus', () => {
    if (MP.waiting && !MP.connected && MP.isHost) mpEnsureHostAlive(false);
  });
  window.addEventListener('online', () => {
    if (MP.waiting && !MP.connected && MP.isHost) mpEnsureHostAlive(true);
  });
}

// ---------- Buton Bağlantıları ----------
if ($('back-to-hub-btn')) $('back-to-hub-btn').addEventListener('click', () => { location.href = 'index.html'; });
if ($('start-btn'))       $('start-btn').addEventListener('click', startGame);
if ($('retry-btn'))       $('retry-btn').addEventListener('click', startGame);
if ($('home-btn'))        $('home-btn').addEventListener('click', () => { hide(gameoverScreen); state = STATE.MENU; show(menuScreen); });
if (pauseBtn)             pauseBtn.addEventListener('click', () => { if (!MP.connected) togglePause(); });
if ($('resume-btn'))      $('resume-btn').addEventListener('click', togglePause);
if ($('quit-btn'))        $('quit-btn').addEventListener('click', () => { hide(pauseScreen); hide(hud); state = STATE.MENU; show(menuScreen); });
if (finishKidsBtn)        finishKidsBtn.addEventListener('click', finishCelebration);
if (rainbowBtn)           rainbowBtn.addEventListener('click', e => { e.stopPropagation(); triggerRainbowShower(); });

document.querySelectorAll('#menu-skin-row .skin-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const sk = btn.dataset.skin;
    if (ST.ownedPets.includes(sk)) {
      ST.pet = sk;
      sfx.star();
      persist();
      updateMenuUI();
    } else {
      currentShopTab = 'pets';
      hide(menuScreen);
      renderShop();
      show(shopScreen);
    }
  });
});

document.querySelectorAll('#diff-tabs .diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const md = btn.dataset.diff;
    if (MODES[md]) {
      ST.mode = md;
      currentMode = md;
      sfx.star();
      persist();
      updateMenuUI();
    }
  });
});

if ($('shop-btn'))        $('shop-btn').addEventListener('click', () => { hide(menuScreen); renderShop(); show(shopScreen); });
if ($('menu-coin-pill'))  $('menu-coin-pill').addEventListener('click', () => { hide(menuScreen); renderShop(); show(shopScreen); });
if ($('shop-close-btn'))  $('shop-close-btn').addEventListener('click', () => { hide(shopScreen); show(menuScreen); });
document.querySelectorAll('#shop-tabs .shop-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentShopTab = btn.dataset.tab;
    document.querySelectorAll('#shop-tabs .shop-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderShop();
  });
});

if ($('lb-btn'))          $('lb-btn').addEventListener('click', () => { hide(menuScreen); renderLeaderboard(); show(lbScreen); });
if ($('lb-close-btn'))    $('lb-close-btn').addEventListener('click', () => { hide(lbScreen); show(menuScreen); });
if ($('stats-btn'))       $('stats-btn').addEventListener('click', () => { hide(menuScreen); renderStats(); show(statsScreen); });
if ($('stats-close-btn')) $('stats-close-btn').addEventListener('click', () => { hide(statsScreen); show(menuScreen); });

if ($('save-score-btn')) {
  $('save-score-btn').addEventListener('click', () => {
    const nm = (($('player-name') ? $('player-name').value.trim() : '') || 'Yıldızcı').slice(0, 12);
    ST.playerName = nm;
    ST.leaderboard.push({ name: nm, score, date: Date.now() });
    ST.leaderboard.sort((a, b) => b.score - a.score);
    ST.leaderboard = ST.leaderboard.slice(0, 10);
    persist();
    $('save-score-btn').disabled = true;
    $('save-score-btn').textContent = '✅ Kaydedildi!';
    sfx.coin();
  });
}

if ($('sound-btn')) {
  $('sound-btn').addEventListener('click', () => {
    settings.soundOn = !settings.soundOn;
    if (settings.soundOn) sfx.star();
    persist();
    updateMenuUI();
  });
}
if ($('music-btn')) {
  $('music-btn').addEventListener('click', () => {
    settings.musicOn = !settings.musicOn;
    persist();
    updateMenuUI();
  });
}
if ($('volume-range')) {
  $('volume-range').addEventListener('input', e => {
    settings.volume = Math.max(0, Math.min(1, Number(e.target.value) / 100));
    persist();
  });
}

// Çevrimiçi Lobi Butonları
if ($('mp-btn'))          $('mp-btn').addEventListener('click', mpOpenUI);
if ($('mp-host-btn'))     $('mp-host-btn').addEventListener('click', () => mpHost());
if ($('mp-join-btn'))     $('mp-join-btn').addEventListener('click', mpJoin);
if ($('mp-join-confirm')) $('mp-join-confirm').addEventListener('click', mpJoinConfirm);
if ($('mp-code-input')) {
  $('mp-code-input').addEventListener('keydown', e => { if (e.key === 'Enter') mpJoinConfirm(); });
}
if ($('mp-copy-btn')) {
  $('mp-copy-btn').addEventListener('click', () => {
    if (!MP.roomCode || !navigator.clipboard) return;
    navigator.clipboard.writeText(MP.roomCode).then(() => {
      $('mp-copy-btn').textContent = '✅ Kopyalandı!';
      setTimeout(() => { $('mp-copy-btn').textContent = '📋 Kodu Kopyala'; }, 1600);
    }).catch(() => {});
  });
}
if ($('mp-share-btn')) {
  $('mp-share-btn').addEventListener('click', () => {
    if (!MP.roomCode) return;
    const url = mpInviteUrl();
    const text = `⭐ Yıldız Yakalama odama gel! Kod: ${MP.roomCode}`;
    if (navigator.share) { navigator.share({ title: 'Yıldız Yakalama', text, url }).catch(() => {}); return; }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text + ' ' + url).then(() => {
        $('mp-share-btn').textContent = '✅ Link Kopyalandı!';
        setTimeout(() => { $('mp-share-btn').textContent = '📤 Davet Gönder'; }, 1600);
      }).catch(() => {});
    }
  });
}
if ($('mp-rematch-btn')) {
  $('mp-rematch-btn').addEventListener('click', () => {
    if (!MP.connected) { mpOpenUI(); return; }
    mpSend({ t: 'rematch' });
    hide(mpGameoverScreen);
    show(mpScreen);
    MP.inLobby = true;
    MP.myReady = false;
    MP.oppReady = false;
    mpRenderLobby();
  });
}
if ($('mp-leave-btn')) {
  $('mp-leave-btn').addEventListener('click', () => {
    mpSend({ t: '_leave' });
    if (MPC) MPC.clearParty();
    mpCleanup();
    hide(mpGameoverScreen);
    state = STATE.MENU;
    show(menuScreen);
  });
}
if ($('mp-quit-btn')) {
  $('mp-quit-btn').addEventListener('click', () => {
    mpSend({ t: '_leave' });
    if (MPC) MPC.clearParty();
    mpCleanup();
    hide(mpScreen);
    state = STATE.MENU;
    show(menuScreen);
  });
}

// ---------- Kırılmaz Ana Oyun Döngüsü (Sabit 60 Hz) ----------
const STEP_MS = 1000 / 60;
let acc = 0, lastT = performance.now();

function loop(now) {
  requestAnimationFrame(loop);
  try {
    const dt = Math.max(0, Math.min(now - lastT, 100));
    lastT = now;
    acc += dt;
    if (acc > 200) acc = STEP_MS;

    while (acc >= STEP_MS) {
      acc -= STEP_MS;
      frames++;
      mpBgTick();
      stepBackground();

      if (MP.reconnecting) {
        mpGraceTick();
        continue;
      }

      if (state === STATE.READY) {
        stepCatcherMovement();
        if (MP.connected) {
          mpCountdownTick();
          mpPetTick();
        } else {
          state = STATE.PLAYING;
        }
        stepEffects();
      } else if (state === STATE.PLAYING) {
        stepWorld();
        if (MP.connected) mpPetTick();
        stepEffects();
      } else if (state !== STATE.PAUSED) {
        stepEffects();
      }
    }

    draw();
  } catch (err) {
    if (typeof console !== 'undefined' && console.error) console.error('Stars loop error:', err);
  }
}

// ---------- Başlat ----------
function init() {
  initSkyDecor();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  updateMenuUI();
  ensureMusicLoop();
  show(menuScreen);

  // 1) Ortak Parti Oturumundan (sessionStorage) gelindiyse otomatik bağlan!
  const party = MPC ? MPC.loadParty() : null;
  if (party && party.autoConnect && (!party.targetGame || party.targetGame === 'stars')) {
    MPC.saveParty({ ...party, autoConnect: false });
    MP.seriesMe = party.seriesMe || 0;
    MP.seriesOpp = party.seriesOpp || 0;
    if (party.myName) ST.playerName = party.myName;
    if (party.oppName) MP.oppName = party.oppName;
    mpOpenUI();
    if ($('mp-name-input') && party.myName) $('mp-name-input').value = party.myName;
    if (party.role === 'host') {
      mpHost(party.roomCode);
    } else {
      mpJoin();
      if ($('mp-code-input')) $('mp-code-input').value = party.roomCode;
      mpJoinConfirm();
    }
  } else {
    // 2) ?room=XXXXX davet linkinden gelindiyse otomatik odaya katıl!
    try {
      if (typeof location !== 'undefined' && location.search) {
        const m = location.search.match(/[?&]room=([A-Za-z0-9]{5})/);
        if (m && m[1]) {
          const autoCode = m[1].toUpperCase();
          if (typeof history !== 'undefined' && history.replaceState) {
            history.replaceState(null, '', location.pathname);
          }
          mpOpenUI();
          mpJoin();
          if ($('mp-code-input')) $('mp-code-input').value = autoCode;
          mpJoinConfirm();
        }
      }
    } catch (e) {}
  }

  requestAnimationFrame(loop);
}

init();
