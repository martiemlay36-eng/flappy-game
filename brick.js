"use strict";

// ============================================================================
// 🧱 TUĞLA KIRICI (BRICK BREAKER / ARKANOID) — 7 Yaş ve Üzeri Heyecanlı Arcade
// - Vektör & Neon 60 FPS Fizik Motoru
// - 10 Tasarımlı Seviye + Sonsuz Dalga Modu
// - 7 Güçlendirme: ⚡ Çoklu Top, 🔫 Lazer Raket, 📏 Geniş Raket, 🔥 Ateş Topu, 🛡️ Zemin Kalkanı, ❤️ Can, 🪙 Altın
// - 1v1 Çevrimiçi Düello, Canlı İzleyici & Oyunlar Arası Kesintisiz Oda Taşıma
// ============================================================================

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const MPC = typeof MPCore !== 'undefined' ? MPCore : null;

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

function roundRect(x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- Ekranlar & DOM ----------
const hud              = $('hud');
const hudCoinsEl       = $('hud-coins');
const hudHpEl          = $('hud-hp');
const hudLevelPill     = $('hud-level-pill');
const hudComboEl       = $('hud-combo');
const powerBadgesEl    = $('power-badges');
const scoreDisplay     = $('score-display');
const pauseBtn         = $('pause-btn');
const laserFireBtn     = $('laser-fire-btn');
const tapHint          = $('tap-hint');

const menuScreen       = $('menu-screen');
const shopScreen       = $('shop-screen');
const lbScreen         = $('leaderboard-screen');
const statsScreen      = $('stats-screen');
const mpScreen         = $('mp-screen');
const mpGameoverScreen = $('mp-gameover-screen');
const gameoverScreen   = $('gameover-screen');
const pauseScreen      = $('pause-screen');

// ---------- 6 Raket Kostümü ----------
const PADDLES = {
  cyber:   { name: 'Siber Mavi',      price: 0,   color1: '#00f5d4', color2: '#00bbf9', glow: '#00f5d4' },
  inferno: { name: 'Ateş Kırmızı',    price: 35,  color1: '#ff3366', color2: '#ff9e00', glow: '#ff3366' },
  emerald: { name: 'Zümrüt Siber',    price: 60,  color1: '#2ec4b6', color2: '#70e000', glow: '#70e000' },
  gold:    { name: 'Altın Şampiyon',  price: 90,  color1: '#ffd700', color2: '#ffb703', glow: '#ffd700' },
  plasma:  { name: 'Plazma Mor',      price: 130, color1: '#b5179e', color2: '#7209b7', glow: '#b5179e' },
  rainbow: { name: 'Prizma Gökkuşağı',price: 180, color1: '#ff70a6', color2: '#00f5d4', glow: '#ffd166', rainbow: true }
};

// ---------- 4 Top Teması ----------
const BALLS = {
  neon:   { name: 'Neon Işık',   price: 0,  core: '#ffffff', glow: '#00f5d4', trail: '#00bbf9' },
  fire:   { name: 'Alev Küresi', price: 40, core: '#fff3b0', glow: '#ff9e00', trail: '#ff3366' },
  plasma: { name: 'Plazma Şimşek',price: 75,core: '#ffffff', glow: '#e0aaff', trail: '#9d4edd' },
  sun:    { name: 'Güneş Çekirdeği',price: 110,core: '#ffffff', glow: '#ffd166', trail: '#ffbe0b' }
};

// ---------- Zorluk & Mod ----------
const DIFFICULTIES = {
  easy:   { label: 'Kolay',  baseSpd: 4.8, speedMax: 8.0, paddleWidthMul: 1.15 },
  normal: { label: 'Normal', baseSpd: 5.5, speedMax: 9.5, paddleWidthMul: 1.00 },
  hard:   { label: 'Hızlı',  baseSpd: 6.4, speedMax: 11.2,paddleWidthMul: 0.90 }
};

// ---------- Kalıcı Veri (oyun-salonu-v2) ----------
const STORAGE_KEY = 'oyun-salonu-v2';

const settings = {
  soundOn: true,
  musicOn: true,
  volume: 0.70,
  sens: 1.35,
  ctrlMode: 'trackpad' // 'trackpad' | 'direct'
};

const BK = {
  bestScore: 0,
  coins: 0,
  paddle: 'cyber',
  ownedPaddles: ['cyber'],
  ball: 'neon',
  ownedBalls: ['neon'],
  diff: 'normal',
  mode: 'levels',
  playerName: '',
  leaderboard: [],
  stats: {
    games: 0,
    bricksHit: 0,
    levelsCleared: 0,
    bestCombo: 0,
    powersCollected: 0,
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
      (root.brick && root.brick.playerName) ||
      (root.flappy && root.flappy.playerName) ||
      (root.snake && root.snake.playerName) ||
      (root.space && root.space.playerName) || '';

    if (root.brick && typeof root.brick === 'object') {
      const b = root.brick;
      BK.bestScore = Number(b.bestScore) || 0;
      BK.coins = Math.max(0, Number(b.coins) || 0);
      if (b.paddle && PADDLES[b.paddle]) BK.paddle = b.paddle;
      if (Array.isArray(b.ownedPaddles)) {
        BK.ownedPaddles = Array.from(new Set(['cyber', ...b.ownedPaddles.filter(k => PADDLES[k])]));
      }
      if (b.ball && BALLS[b.ball]) BK.ball = b.ball;
      if (Array.isArray(b.ownedBalls)) {
        BK.ownedBalls = Array.from(new Set(['neon', ...b.ownedBalls.filter(k => BALLS[k])]));
      }
      if (b.diff && DIFFICULTIES[b.diff]) BK.diff = b.diff;
      if (b.mode === 'levels' || b.mode === 'endless') BK.mode = b.mode;
      if (typeof b.sens === 'number') settings.sens = Math.max(0.6, Math.min(2.2, b.sens));
      if (b.ctrlMode === 'direct' || b.ctrlMode === 'trackpad') settings.ctrlMode = b.ctrlMode;
      if (Array.isArray(b.leaderboard)) BK.leaderboard = b.leaderboard.slice(0, 10);
      if (b.stats && typeof b.stats === 'object') {
        BK.stats.games = Number(b.stats.games) || 0;
        BK.stats.bricksHit = Number(b.stats.bricksHit) || 0;
        BK.stats.levelsCleared = Number(b.stats.levelsCleared) || 0;
        BK.stats.bestCombo = Number(b.stats.bestCombo) || 0;
        BK.stats.powersCollected = Number(b.stats.powersCollected) || 0;
        BK.stats.totalCoins = Number(b.stats.totalCoins) || 0;
      }
    }
    if (inheritedName) BK.playerName = String(inheritedName).slice(0, 12);
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
    root.brick = {
      bestScore: BK.bestScore,
      coins: BK.coins,
      paddle: BK.paddle,
      ownedPaddles: BK.ownedPaddles,
      ball: BK.ball,
      ownedBalls: BK.ownedBalls,
      diff: BK.diff,
      mode: BK.mode,
      sens: settings.sens,
      ctrlMode: settings.ctrlMode,
      playerName: BK.playerName,
      leaderboard: BK.leaderboard.slice(0, 10),
      stats: { ...BK.stats }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
  } catch (e) {}
}

loadStorage();

// ---------- Web Audio API Ses Sentezleyici ----------
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

function tone(freq, dur, type = 'sine', gainMul = 0.22, slideTo = null) {
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

const PENTATONIC_SCALE = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];

const sfx = {
  hitPaddle() {
    tone(280, 0.07, 'triangle', 0.28, 420);
  },
  hitBrick(comboCount) {
    const note = PENTATONIC_SCALE[(comboCount || 0) % PENTATONIC_SCALE.length];
    tone(note, 0.12, 'square', 0.18, note * 1.05);
  },
  bomb() {
    tone(140, 0.25, 'sawtooth', 0.35, 45);
  },
  laser() {
    tone(880, 0.08, 'sawtooth', 0.20, 220);
  },
  powerup() {
    [440, 554.37, 659.25, 880].forEach((n, idx) => {
      setTimeout(() => tone(n, 0.12, 'triangle', 0.22), idx * 45);
    });
  },
  loseLife() {
    tone(320, 0.24, 'sawtooth', 0.25, 110);
  },
  winLevel() {
    [523.25, 659.25, 783.99, 1046.50, 1318.5].forEach((n, idx) => {
      setTimeout(() => tone(n, 0.16, 'triangle', 0.25), idx * 70);
    });
  },
  coin() {
    tone(987.77, 0.08, 'sine', 0.22);
    setTimeout(() => tone(1318.5, 0.12, 'sine', 0.22), 55);
  }
};

let musicTimer = null;
let musicIdx = 0;
const ARCADE_BASS = [110, 110, 146.83, 110, 130.81, 130.81, 164.81, 146.83];
function ensureMusicLoop() {
  if (musicTimer) return;
  musicTimer = setInterval(() => {
    if (!settings.musicOn || settings.volume <= 0.01) return;
    if (state !== STATE.PLAYING && state !== STATE.READY) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    const ac = getAudio();
    if (!ac) return;
    const f = ARCADE_BASS[musicIdx % ARCADE_BASS.length];
    musicIdx++;
    try {
      const t0 = ac.currentTime;
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(Math.max(0.001, settings.volume * 0.045), t0);
      g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.22);
      osc.connect(g);
      g.connect(ac.destination);
      osc.onended = () => {
        try { osc.disconnect(); g.disconnect(); } catch (e) {}
      };
      osc.start(t0);
      osc.stop(t0 + 0.24);
    } catch (e) {}
  }, 260);
  if (musicTimer && typeof musicTimer.unref === 'function') musicTimer.unref();
}

// ---------- Deterministik Tohumlu RNG ----------
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

// ---------- Oyun Değişkenleri ----------
const STATE = { MENU: 0, READY: 1, PLAYING: 2, PAUSED: 3, GAMEOVER: 4 };
let state = STATE.MENU;

let frames = 0;
let runFrames = 0;
let score = 0;
let runCoins = 0;
let level = 1;
let combo = 0;
let comboTimer = 0;
let bestRunCombo = 0;
let mpCountdown = 0;

// Raket
const paddle = {
  x: VIRT_W * 0.5,
  y: VIRT_H - 52,
  baseW: 86,
  w: 86,
  h: 15,
  targetX: VIRT_W * 0.5,
  vx: 0,
  hp: 3,
  laserTimer: 0,
  wideTimer: 0,
  fireballTimer: 0,
  floorShield: false,
  glowTimer: 0
};

// Toplar (Çoklu top için dizi)
let balls = [];

// Tuğlalar
let bricks = [];

// Düşen Güçlendirmeler & Lazer Mermileri
let pickups = [];
let lasers = [];

// Parçacıklar & Uçan Yazılar
let particles = [];
let popups = [];

// ---------- 10 Farklı Bölüm Tasarımı ----------
const LEVEL_LAYOUTS = [
  // 1: Klasik Sıralar (Kolay)
  [
    "RRRRRRRR",
    "OOOOOOOO",
    "YYYYYYYY",
    "GGGGGGGG"
  ],
  // 2: Piramit
  [
    "   BB   ",
    "  YYYY  ",
    " OOOOOO ",
    "RRRRRRRR"
  ],
  // 3: Kale Duvarı & Zırhlı Kuleler
  [
    "M GGGG M",
    "M RRRR M",
    "  BBBB  ",
    "  OOOO  "
  ],
  // 4: Uzay İstilacısı
  [
    "  GGGG  ",
    " GGGGGGGG",
    " GGGGGGGG",
    " G GGG G "
  ],
  // 5: Bomba Zinciri (T = TNT/Bomba)
  [
    "RRTRRRTR",
    "YYYYYYYY",
    "GGTGGTGG",
    "BBBBBBBB"
  ],
  // 6: Elmas Baklava Deseni
  [
    "   YY   ",
    "  GGGG  ",
    " BBBBBB ",
    "  GGGG  ",
    "   YY   "
  ],
  // 7: Zırhlı & Altın Labirent (C = Altın Para Tuğlası)
  [
    "MMMMMMMM",
    "R C  C R",
    "R MMMM R",
    "O C  C O"
  ],
  // 8: İkili Kale & Zikzak
  [
    "T RRRR T",
    "M YYYY M",
    "M GGGG M",
    "T BBBB T"
  ],
  // 9: Şampiyonlar Köprüsü
  [
    "RRTRTRRR",
    "MMMMMMMM",
    "YYYYYYYY",
    "GGGGGGGG"
  ],
  // 10: Mega Karışık Final
  [
    "TRRRRRRT",
    "MMCCCCMM",
    "OOMMMMOO",
    "YYYYYYYY",
    "GGTTTTGG"
  ]
];

const BRICK_COLORS = {
  R: { color: '#ff3366', light: '#ff7597', pts: 20 }, // Kırmızı
  O: { color: '#ff9e00', light: '#ffc15e', pts: 15 }, // Turuncu
  Y: { color: '#ffd166', light: '#ffe29a', pts: 10 }, // Sarı
  G: { color: '#06d6a0', light: '#68edd1', pts: 25 }, // Yeşil
  B: { color: '#118ab2', light: '#64c5e3', pts: 30 }, // Mavi
  P: { color: '#b5179e', light: '#e577d6', pts: 40 }, // Mor
  M: { color: '#7f8fa6', light: '#c8d6e5', pts: 50, hp: 2, metal: true }, // Zırhlı
  T: { color: '#e63946', light: '#ff6b6b', pts: 35, tnt: true }, // Bomba
  C: { color: '#ffd700', light: '#fff3b0', pts: 45, coin: true } // Altın
};

function buildLevelBricks(lvlNum) {
  bricks = [];
  const layout = LEVEL_LAYOUTS[(lvlNum - 1) % LEVEL_LAYOUTS.length];
  const cols = 8;
  const bW = Math.floor((VIRT_W - 24) / cols);
  const bH = 17;
  const startY = 66;

  for (let r = 0; r < layout.length; r++) {
    const rowStr = layout[r];
    for (let c = 0; c < rowStr.length; c++) {
      const ch = rowStr[c];
      if (ch === ' ' || !BRICK_COLORS[ch]) continue;
      const def = BRICK_COLORS[ch];
      const bx = 12 + c * bW;
      const by = startY + r * (bH + 3);
      bricks.push({
        x: bx,
        y: by,
        w: bW - 3,
        h: bH,
        hp: def.hp || 1,
        maxHp: def.hp || 1,
        pts: def.pts,
        color: def.color,
        light: def.light,
        metal: !!def.metal,
        tnt: !!def.tnt,
        coin: !!def.coin
      });
    }
  }
}

function addConfetti(x, y, count = 12, baseColor = '#ffd166') {
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 1.2 + Math.random() * 3.5;
    particles.push({
      x, y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp - 1.0,
      r: 2.2 + Math.random() * 2.5,
      color: baseColor,
      life: 20 + Math.floor(Math.random() * 15),
      maxLife: 35
    });
  }
}

function addPopup(x, y, text, color = '#ffd166') {
  popups.push({
    x: Math.max(30, Math.min(VIRT_W - 30, x)),
    y: Math.max(45, y),
    text,
    color,
    life: 30,
    maxLife: 30
  });
}

function updateHUD() {
  if (scoreDisplay) scoreDisplay.textContent = score;
  if (hudCoinsEl) hudCoinsEl.textContent = BK.coins + runCoins;
  if (hudHpEl) hudHpEl.textContent = '❤️'.repeat(Math.max(0, paddle.hp)) || '💀';
  if (hudLevelPill) hudLevelPill.textContent = BK.mode === 'endless' ? `🌊 Dalga ${level}` : `🧱 Seviye ${level}`;

  if (hudComboEl) {
    if (combo >= 2) {
      hudComboEl.textContent = `🔥 x${Math.min(5, 1 + Math.floor(combo / 4))} (${combo})`;
      show(hudComboEl);
    } else {
      hide(hudComboEl);
    }
  }

  if (laserFireBtn) {
    laserFireBtn.classList.toggle('hidden', !(paddle.laserTimer > 0 && state === STATE.PLAYING && !MP.spectating));
  }

  if (powerBadgesEl) {
    const badges = [];
    if (paddle.laserTimer > 0) badges.push(`<span class="power-badge">🔫 Lazer ${Math.ceil(paddle.laserTimer / 60)}s</span>`);
    if (paddle.wideTimer > 0)  badges.push(`<span class="power-badge">📏 Geniş ${Math.ceil(paddle.wideTimer / 60)}s</span>`);
    if (paddle.fireballTimer > 0) badges.push(`<span class="power-badge">🔥 Ateş Topu ${Math.ceil(paddle.fireballTimer / 60)}s</span>`);
    if (paddle.floorShield)    badges.push(`<span class="power-badge">🛡️ Kalkan</span>`);
    if (balls.length > 1)      badges.push(`<span class="power-badge">⚡ Top x${balls.length}</span>`);
    if (MP.connected)          badges.push(`<span class="power-badge" id="mp-hud-ping">🟢 -- ms</span>`);
    const html = badges.join('');
    if (powerBadgesEl._last !== html) {
      powerBadgesEl.innerHTML = html;
      powerBadgesEl._last = html;
      if (MP.connected && MPC) MPC.updatePingDOM(MP.pingMs);
    }
  }
}

function resetBall(attached = true) {
  const df = DIFFICULTIES[BK.diff] || DIFFICULTIES.normal;
  const sp = df.baseSpd;
  balls = [{
    x: paddle.x,
    y: paddle.y - 12,
    vx: (worldRng() > 0.5 ? 1 : -1) * (sp * 0.65),
    vy: -sp * 0.85,
    r: 6.5,
    speed: sp,
    attached: !!attached,
    trail: []
  }];
}

function resetRun(seedOverride) {
  const seed = (typeof seedOverride === 'number') ? seedOverride : ((Date.now() ^ ((Math.random() * 0xffffffff) >>> 0)) >>> 0);
  worldRng = makeRng(seed);

  runFrames = 0;
  score = 0;
  runCoins = 0;
  level = 1;
  combo = 0;
  comboTimer = 0;
  bestRunCombo = 0;

  paddle.hp = 3;
  paddle.laserTimer = 0;
  paddle.wideTimer = 0;
  paddle.fireballTimer = 0;
  paddle.floorShield = false;
  paddle.glowTimer = 0;
  paddle.x = VIRT_W * 0.5;
  paddle.targetX = VIRT_W * 0.5;
  paddle.vx = 0;

  const df = DIFFICULTIES[BK.diff] || DIFFICULTIES.normal;
  paddle.w = paddle.baseW * df.paddleWidthMul;

  pickups = [];
  lasers = [];
  particles = [];
  popups = [];

  buildLevelBricks(level);
  resetBall(true);
  updateHUD();
}

function startGame() {
  MP.spectating = false;
  mpHideSpectatorBanner();
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
}

function launchBalls() {
  let anyLaunched = false;
  balls.forEach(b => {
    if (b.attached) {
      b.attached = false;
      const df = DIFFICULTIES[BK.diff] || DIFFICULTIES.normal;
      b.speed = df.baseSpd;
      b.vy = -Math.abs(b.vy || b.speed * 0.85);
      anyLaunched = true;
    }
  });
  if (anyLaunched) {
    hide(tapHint);
    sfx.hitPaddle();
  }
}

// ---------- Ateş Açma (Lazer Raket Güçlendirmesi) ----------
function firePaddleLasers() {
  if (paddle.laserTimer <= 0 || state !== STATE.PLAYING || MP.spectating) return;
  sfx.laser();
  const hw = paddle.w * 0.42;
  lasers.push({ x: paddle.x - hw, y: paddle.y - 4, vy: -9.5, r: 3.5, color: '#00f5d4' });
  lasers.push({ x: paddle.x + hw, y: paddle.y - 4, vy: -9.5, r: 3.5, color: '#00f5d4' });
}

// ---------- Güçlendirme Düşürme & Toplama ----------
const POWER_TYPES = ['multi', 'laser', 'wide', 'fire', 'floor', 'heart', 'coin'];

function maybeSpawnPickup(bx, by) {
  if (worldRng() < 0.28) {
    const roll = worldRng();
    let type = 'multi';
    if (roll < 0.25)      type = 'multi';
    else if (roll < 0.44) type = 'laser';
    else if (roll < 0.60) type = 'wide';
    else if (roll < 0.74) type = 'fire';
    else if (roll < 0.86) type = 'floor';
    else if (roll < 0.93) type = 'heart';
    else                  type = 'coin';

    pickups.push({
      x: bx,
      y: by,
      vy: 2.2,
      type,
      w: 22,
      h: 14
    });
  }
}

function applyPickup(p) {
  BK.stats.powersCollected++;
  sfx.powerup();
  addConfetti(p.x, p.y, 14, '#ffd166');

  if (p.type === 'multi') {
    // Top sayısını çoğalt (Mevcut her top için +2 top doğur)
    const newBalls = [];
    balls.forEach(b => {
      for (let k = -1; k <= 1; k += 2) {
        newBalls.push({
          x: b.x,
          y: b.y,
          vx: b.vx * Math.cos(k * 0.4) - b.vy * Math.sin(k * 0.4),
          vy: b.vx * Math.sin(k * 0.4) + b.vy * Math.cos(k * 0.4),
          r: b.r,
          speed: b.speed,
          attached: false,
          trail: []
        });
      }
    });
    balls.push(...newBalls.slice(0, 4));
    addPopup(paddle.x, paddle.y - 25, '⚡ ÇOKLU TOP!', '#00f5d4');
  } else if (p.type === 'laser') {
    paddle.laserTimer = 540; // 9 sn lazer
    addPopup(paddle.x, paddle.y - 25, '🔫 LAZER RAKET!', '#00f5d4');
  } else if (p.type === 'wide') {
    paddle.wideTimer = 600; // 10 sn geniş raket
    addPopup(paddle.x, paddle.y - 25, '📏 GENİŞ RAKET!', '#ff9e00');
  } else if (p.type === 'fire') {
    paddle.fireballTimer = 480; // 8 sn ateş topu
    addPopup(paddle.x, paddle.y - 25, '🔥 ATEŞ TOPU!', '#ff3366');
  } else if (p.type === 'floor') {
    paddle.floorShield = true;
    addPopup(paddle.x, paddle.y - 25, '🛡️ ZEMİN KALKANI!', '#2ec4b6');
  } else if (p.type === 'heart') {
    if (paddle.hp < 5) paddle.hp++;
    addPopup(paddle.x, paddle.y - 25, '❤️ +1 CAN!', '#ff3366');
  } else if (p.type === 'coin') {
    runCoins += 3;
    addPopup(paddle.x, paddle.y - 25, '🪙 +3 ALTIN!', '#ffd700');
  }

  updateHUD();
}

// ---------- Tuğla Yok Etme & Bomba Patlaması ----------
function destroyBrick(index, silent = false) {
  if (index < 0 || index >= bricks.length) return;
  const br = bricks[index];
  bricks.splice(index, 1);

  BK.stats.bricksHit++;
  combo++;
  comboTimer = 90;
  if (combo > bestRunCombo) bestRunCombo = combo;
  if (combo > BK.stats.bestCombo) BK.stats.bestCombo = combo;

  const mult = Math.min(5, 1 + Math.floor(combo / 4));
  const pts = br.pts * mult;
  score += pts;

  if (br.coin) runCoins += 2;
  if (!silent) sfx.hitBrick(combo);

  addConfetti(br.x + br.w * 0.5, br.y + br.h * 0.5, 10, br.color);
  addPopup(br.x + br.w * 0.5, br.y + br.h * 0.5, `+${pts}`, br.color);

  // TNT Bomba Tuğlası: Etrafındaki komşu tuğlaları da patlat!
  if (br.tnt) {
    sfx.bomb();
    addConfetti(br.x + br.w * 0.5, br.y + br.h * 0.5, 24, '#ff3366');
    const cx = br.x + br.w * 0.5;
    const cy = br.y + br.h * 0.5;
    for (let k = bricks.length - 1; k >= 0; k--) {
      const other = bricks[k];
      if (!other) continue;
      const ocx = other.x + other.w * 0.5;
      const ocy = other.y + other.h * 0.5;
      if (Math.hypot(ocx - cx, ocy - cy) < 64) {
        destroyBrick(k, true);
      }
    }
  } else {
    maybeSpawnPickup(br.x + br.w * 0.5, br.y + br.h * 0.5);
  }

  if (MP.connected) mpOnScore();
  updateHUD();

  // Seviye Temizlendi mi?
  if (bricks.length === 0) {
    onLevelCompleted();
  }
}

function onLevelCompleted() {
  BK.stats.levelsCleared++;
  sfx.winLevel();
  score += 150 * level;
  runCoins += 5;
  addPopup(VIRT_W * 0.5, VIRT_H * 0.45, `🎉 SEVİYE ${level} TAMAMLANDI!`, '#ffd700');

  level++;
  buildLevelBricks(level);
  resetBall(true);
  paddle.laserTimer = 0;
  paddle.fireballTimer = 0;
  updateHUD();
}

// ---------- Top Düşmesi & Can Kaybı ----------
function handleBallLost() {
  sfx.loseLife();
  paddle.hp--;
  combo = 0;
  updateHUD();

  if (paddle.hp <= 0) {
    handlePlayerDeath();
  } else {
    resetBall(true);
  }
}

function handlePlayerDeath() {
  if (MP.connected) {
    mpOnDeath();
    return;
  }

  state = STATE.GAMEOVER;
  hide(hud);
  hide(tapHint);

  BK.stats.games++;
  const earned = runCoins + Math.max(1, Math.floor(score / 50));
  BK.coins += earned;
  BK.stats.totalCoins += earned;

  const isNewBest = score > BK.bestScore;
  if (isNewBest) BK.bestScore = score;
  persist();

  if ($('final-score')) $('final-score').textContent = score;
  if ($('final-level')) $('final-level').textContent = level;
  if ($('best-score-go')) $('best-score-go').textContent = BK.bestScore;
  if ($('run-coins-go')) $('run-coins-go').textContent = `🪙 +${earned}`;
  if ($('new-record')) $('new-record').classList.toggle('hidden', !isNewBest);

  const medalEl = $('medal-display');
  if (medalEl) {
    show(medalEl);
    let icon = '🥉', text = 'BRONZ KIRICI';
    if (score >= 2500)      { icon = '👑'; text = 'ALTIN ŞAMPİYON'; }
    else if (score >= 1200) { icon = '🥈'; text = 'GÜMÜŞ KIRICI'; }
    $('medal-icon').textContent = icon;
    $('medal-text').textContent = text;
  }

  if ($('player-name')) $('player-name').value = BK.playerName || '';
  if ($('save-score-btn')) {
    $('save-score-btn').disabled = false;
    $('save-score-btn').textContent = '🏅 Kaydet';
  }

  show(gameoverScreen);
  updateMenuUI();
}

// ---------- Fizik & Dünya Adımı (60 Hz) ----------
const keys = {};

function stepPaddleMovement() {
  if (MP.spectating) return;

  const kbSpd = 7.5;
  if (keys['ArrowLeft'] || keys['KeyA'])  paddle.targetX -= kbSpd;
  if (keys['ArrowRight'] || keys['KeyD']) paddle.targetX += kbSpd;

  const df = DIFFICULTIES[BK.diff] || DIFFICULTIES.normal;
  const currentW = (paddle.baseW * df.paddleWidthMul) * (paddle.wideTimer > 0 ? 1.45 : 1.0);
  paddle.w += (currentW - paddle.w) * 0.2;

  const halfW = paddle.w * 0.5;
  paddle.targetX = Math.max(halfW + 6, Math.min(VIRT_W - halfW - 6, paddle.targetX));

  const dx = paddle.targetX - paddle.x;
  paddle.vx = dx * 0.35;
  paddle.x += paddle.vx;
  paddle.x = Math.max(halfW + 6, Math.min(VIRT_W - halfW - 6, paddle.x));

  if (paddle.glowTimer > 0) paddle.glowTimer--;
  if (paddle.laserTimer > 0) {
    paddle.laserTimer--;
    // Otomatik her 22 karede bir lazer atışı!
    if (paddle.laserTimer % 22 === 0) firePaddleLasers();
  }
  if (paddle.wideTimer > 0) paddle.wideTimer--;
  if (paddle.fireballTimer > 0) paddle.fireballTimer--;
}

function stepWorld() {
  runFrames++;
  if (comboTimer > 0) {
    comboTimer--;
    if (comboTimer === 0) combo = 0;
  }

  stepPaddleMovement();

  const df = DIFFICULTIES[BK.diff] || DIFFICULTIES.normal;

  // Lazer Mermileri
  for (let i = lasers.length - 1; i >= 0; i--) {
    const l = lasers[i];
    l.y += l.vy;
    if (l.y < -10) { lasers.splice(i, 1); continue; }

    let hit = false;
    for (let j = bricks.length - 1; j >= 0; j--) {
      const br = bricks[j];
      if (l.x >= br.x && l.x <= br.x + br.w && l.y >= br.y && l.y <= br.y + br.h) {
        lasers.splice(i, 1);
        hit = true;
        br.hp--;
        if (br.hp <= 0) destroyBrick(j);
        else sfx.hitBrick(0);
        break;
      }
    }
    if (hit) continue;
  }

  // Düşen Güçlendirmeler
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.y += p.vy;
    if (p.y > VIRT_H + 20) { pickups.splice(i, 1); continue; }

    if (!MP.spectating && state === STATE.PLAYING) {
      if (p.y + p.h * 0.5 >= paddle.y - paddle.h * 0.5 && p.y - p.h * 0.5 <= paddle.y + paddle.h * 0.5) {
        if (p.x >= paddle.x - paddle.w * 0.5 && p.x <= paddle.x + paddle.w * 0.5) {
          pickups.splice(i, 1);
          applyPickup(p);
        }
      }
    }
  }

  // Toplar
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    if (b.attached) {
      b.x = paddle.x;
      b.y = paddle.y - paddle.h * 0.5 - b.r - 2;
      continue;
    }

    // Hareket izi (kuyruk)
    b.trail.unshift({ x: b.x, y: b.y });
    if (b.trail.length > 5) b.trail.pop();

    b.x += b.vx;
    b.y += b.vy;

    // Duvar Sekmeleri
    if (b.x - b.r <= 6) {
      b.x = 6 + b.r;
      b.vx = Math.abs(b.vx);
      sfx.hitPaddle();
    } else if (b.x + b.r >= VIRT_W - 6) {
      b.x = VIRT_W - 6 - b.r;
      b.vx = -Math.abs(b.vx);
      sfx.hitPaddle();
    }

    if (b.y - b.r <= 6) {
      b.y = 6 + b.r;
      b.vy = Math.abs(b.vy);
      sfx.hitPaddle();
    }

    // Raket Çarpışması
    if (b.vy > 0 && b.y + b.r >= paddle.y - paddle.h * 0.5 && b.y - b.r <= paddle.y + paddle.h * 0.5) {
      const halfW = paddle.w * 0.5;
      if (b.x >= paddle.x - halfW - 4 && b.x <= paddle.x + halfW + 4) {
        b.y = paddle.y - paddle.h * 0.5 - b.r - 1;

        // Falso Açısı: Vurulan noktanın merkezden uzaklığına göre (-1..+1)
        const hitNorm = Math.max(-1, Math.min(1, (b.x - paddle.x) / halfW));
        const maxAngle = Math.PI * 0.38; // ~68 derece maksimum açı
        const angle = hitNorm * maxAngle;

        // Raket hızıyla falso ivmesi
        b.speed = Math.min(df.speedMax, b.speed + 0.08);
        b.vx = Math.sin(angle) * b.speed + paddle.vx * 0.15;
        b.vy = -Math.cos(angle) * b.speed;

        paddle.glowTimer = 8;
        sfx.hitPaddle();
        addConfetti(b.x, b.y, 6, '#00f5d4');
      }
    }

    // Tuğla Çarpışmaları
    for (let j = bricks.length - 1; j >= 0; j--) {
      const br = bricks[j];
      if (!br) continue;

      if (b.x + b.r >= br.x && b.x - b.r <= br.x + br.w &&
          b.y + b.r >= br.y && b.y - b.r <= br.y + br.h) {

        // Ateş topu değilse sekme fiziği işlet
        if (paddle.fireballTimer <= 0) {
          const overlapLeft   = (b.x + b.r) - br.x;
          const overlapRight  = (br.x + br.w) - (b.x - b.r);
          const overlapTop    = (b.y + b.r) - br.y;
          const overlapBottom = (br.y + br.h) - (b.y - b.r);

          const minOverlapX = Math.min(overlapLeft, overlapRight);
          const minOverlapY = Math.min(overlapTop, overlapBottom);

          if (minOverlapX < minOverlapY) {
            b.vx = overlapLeft < overlapRight ? -Math.abs(b.vx) : Math.abs(b.vx);
          } else {
            b.vy = overlapTop < overlapBottom ? -Math.abs(b.vy) : Math.abs(b.vy);
          }
        }

        br.hp--;
        if (br.hp <= 0) {
          destroyBrick(j);
        } else {
          sfx.hitBrick(0);
          br.color = '#576574'; // Zırhlı tuğla çatladı
          addConfetti(b.x, b.y, 5, '#c8d6e5');
        }
        break;
      }
    }

    // Zemin Kalkanı Bariyeri
    if (paddle.floorShield && b.y + b.r >= VIRT_H - 14) {
      b.y = VIRT_H - 14 - b.r;
      b.vy = -Math.abs(b.vy);
      paddle.floorShield = false;
      sfx.hitPaddle();
      addPopup(b.x, VIRT_H - 30, '🛡️ KURTARILDI!', '#2ec4b6');
      continue;
    }

    // Alt sınırdan düşme
    if (b.y - b.r > VIRT_H + 10) {
      balls.splice(i, 1);
    }
  }

  // Sahada top kalmadıysa can kaybedilir!
  if (balls.length === 0 && state === STATE.PLAYING && !MP.spectating) {
    handleBallLost();
  }

  if (runFrames % 10 === 0) updateHUD();
}

function stepEffects() {
  if (particles.length > 240) particles.splice(0, particles.length - 240);
  for (let i = particles.length - 1; i >= 0; i--) {
    const pt = particles[i];
    pt.x += pt.vx;
    pt.y += pt.vy;
    pt.vx *= 0.96;
    pt.vy *= 0.96;
    pt.life--;
    if (pt.life <= 0) particles.splice(i, 1);
  }
  for (let i = popups.length - 1; i >= 0; i--) {
    const pp = popups[i];
    pp.y -= 0.65;
    pp.life--;
    if (pp.life <= 0) popups.splice(i, 1);
  }
}

// ============================================================================
//            60 FPS NEON & VEKTÖR ÇİZİM MOTORU (BRICK ENGINE)
// ============================================================================
function drawPaddle(vx, vy, w, h, skinKey, isGlow, nameTag, isGhost) {
  const cx = sx(vx), cy = sy(vy);
  const pw = sx(w), ph = sy(h);
  const sk = PADDLES[skinKey] || PADDLES.cyber;

  ctx.save();
  ctx.translate(cx, cy);

  if (!isGhost) {
    ctx.shadowColor = sk.glow;
    ctx.shadowBlur = isGlow ? 18 : 10;
  }

  // Raket Gövdesi (Yuvarlatılmış Neon Kapsül)
  const g = ctx.createLinearGradient(-pw * 0.5, 0, pw * 0.5, 0);
  if (sk.rainbow) {
    g.addColorStop(0, '#ff3366');
    g.addColorStop(0.33, '#ffd166');
    g.addColorStop(0.66, '#06d6a0');
    g.addColorStop(1, '#118ab2');
  } else {
    g.addColorStop(0, sk.color1);
    g.addColorStop(1, sk.color2);
  }
  ctx.fillStyle = g;
  roundRect(-pw * 0.5, -ph * 0.5, pw, ph, sr(7));
  ctx.fill();

  // Parlak üst yansıma
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  roundRect(-pw * 0.5 + 4, -ph * 0.5 + 2, pw - 8, ph * 0.35, sr(4));
  ctx.fill();

  // Lazer Namluları (Lazer güçlendirmesi aktifken)
  if (paddle.laserTimer > 0 && !isGhost) {
    ctx.fillStyle = '#00f5d4';
    ctx.fillRect(-pw * 0.48, -ph * 0.5 - sr(5), sr(6), sr(6));
    ctx.fillRect(pw * 0.48 - sr(6), -ph * 0.5 - sr(5), sr(6), sr(6));
  }

  ctx.restore();

  if (nameTag) {
    ctx.save();
    ctx.font = '800 12px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = isGhost ? '#ffd166' : '#ffffff';
    ctx.fillText(nameTag, cx, cy + sr(26));
    ctx.restore();
  }
}

function drawBall(b) {
  const cx = sx(b.x), cy = sy(b.y), r = sr(b.r);
  const bTheme = BALLS[BK.ball] || BALLS.neon;
  const isFireball = paddle.fireballTimer > 0;

  // Kuyruk
  if (b.trail && b.trail.length > 0) {
    ctx.save();
    for (let k = 0; k < b.trail.length; k++) {
      const pt = b.trail[k];
      const alpha = (1 - (k / b.trail.length)) * 0.45;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = isFireball ? '#ff3366' : bTheme.trail;
      ctx.beginPath();
      ctx.arc(sx(pt.x), sy(pt.y), r * (1 - (k / b.trail.length) * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Top Gövdesi
  ctx.save();
  ctx.shadowColor = isFireball ? '#ff3366' : bTheme.glow;
  ctx.shadowBlur = isFireball ? 20 : 12;
  ctx.fillStyle = isFireball ? '#ffd166' : bTheme.core;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBrick(br) {
  const bx = sx(br.x), by = sy(br.y), bw = sx(br.w), bh = sy(br.h);
  ctx.save();
  ctx.fillStyle = br.color;
  roundRect(bx, by, bw, bh, sr(3.5));
  ctx.fill();

  // 3B Işık Kabartması
  ctx.fillStyle = br.light;
  roundRect(bx + 1, by + 1, bw - 2, bh * 0.35, sr(2));
  ctx.fill();

  // TNT veya Altın Tuğla Sembolü
  if (br.tnt) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.round(bh * 0.75)}px "Segoe UI", Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💣', bx + bw * 0.5, by + bh * 0.55);
  } else if (br.coin) {
    ctx.fillStyle = '#4a2500';
    ctx.font = `900 ${Math.round(bh * 0.75)}px "Segoe UI", Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', bx + bw * 0.5, by + bh * 0.55);
  } else if (br.metal && br.hp > 1) {
    // Zırhlı metal perçin çizgisi
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(bx + 3, by + 3, bw - 6, bh - 6);
  }

  ctx.restore();
}

function drawPickup(p) {
  const px = sx(p.x), py = sy(p.y), pw = sx(p.w), ph = sy(p.h);
  const emojiMap = {
    multi: '⚡', laser: '🔫', wide: '📏', fire: '🔥', floor: '🛡️', heart: '❤️', coin: '🪙'
  };
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.strokeStyle = '#00f5d4';
  ctx.lineWidth = 1.8;
  roundRect(px - pw * 0.5, py - ph * 0.5, pw, ph, sr(5));
  ctx.fill();
  ctx.stroke();

  ctx.font = `${Math.round(ph * 0.9)}px "Segoe UI Emoji", Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emojiMap[p.type] || '★', px, py + 1);
  ctx.restore();
}

function draw() {
  // Arka plan (Derin Uzay & Siber Izgara)
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0a1128');
  g.addColorStop(0.5, '#001f54');
  g.addColorStop(1, '#034078');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Yan duvar sınır çizgileri
  ctx.strokeStyle = 'rgba(0, 245, 212, 0.28)';
  ctx.lineWidth = sx(3);
  ctx.strokeRect(sx(5), sy(5), sx(VIRT_W - 10), sy(VIRT_H));

  // Zemin Kalkanı Bariyeri
  if (paddle.floorShield) {
    ctx.save();
    ctx.strokeStyle = '#00f5d4';
    ctx.lineWidth = sr(4);
    ctx.shadowColor = '#00f5d4';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(sx(8), sy(VIRT_H - 12));
    ctx.lineTo(sx(VIRT_W - 8), sy(VIRT_H - 12));
    ctx.stroke();
    ctx.restore();
  }

  // Tuğlalar
  for (let i = 0; i < bricks.length; i++) {
    drawBrick(bricks[i]);
  }

  // Düşen Güçlendirmeler
  for (let i = 0; i < pickups.length; i++) {
    drawPickup(pickups[i]);
  }

  // Lazer Mermileri
  for (let i = 0; i < lasers.length; i++) {
    const l = lasers[i];
    ctx.save();
    ctx.fillStyle = l.color;
    ctx.shadowColor = l.color;
    ctx.shadowBlur = 8;
    roundRect(sx(l.x - l.r * 0.5), sy(l.y - 6), sx(l.r), sy(12), 2);
    ctx.fill();
    ctx.restore();
  }

  // Çevrimiçi Rakip Raketi (Hayalet)
  if (MP.connected && (state === STATE.PLAYING || state === STATE.READY)) {
    const oppAlpha = MP.spectating ? 1.0 : (MP.oppDead ? 0.35 : 0.65);
    drawPaddle(MP.oppX, VIRT_H - 52, paddle.baseW, paddle.h, MP.oppPaddle || 'inferno', false, `${MP.oppName} (${MP.oppScore})`, !MP.spectating);
  }

  // Oyuncu Raketi
  if (!MP.spectating && (state === STATE.PLAYING || state === STATE.READY || state === STATE.PAUSED || state === STATE.MENU)) {
    const myX = state === STATE.MENU ? (VIRT_W * 0.5 + Math.sin(frames * 0.04) * 60) : paddle.x;
    drawPaddle(myX, paddle.y, paddle.w, paddle.h, BK.paddle, paddle.glowTimer > 0, MP.connected ? MP.myName : '', false);
  }

  // Toplar
  for (let i = 0; i < balls.length; i++) {
    drawBall(balls[i]);
  }

  // Parçacıklar
  for (let i = 0; i < particles.length; i++) {
    const pt = particles[i];
    ctx.save();
    ctx.globalAlpha = pt.life / pt.maxLife;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(sx(pt.x), sy(pt.y), sr(pt.r), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Uçan Yazılar
  for (let i = 0; i < popups.length; i++) {
    const pp = popups[i];
    ctx.save();
    ctx.globalAlpha = Math.min(1, pp.life / pp.maxLife);
    ctx.font = `900 ${Math.round(sr(17))}px "Segoe UI", Arial`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    ctx.strokeText(pp.text, sx(pp.x), sy(pp.y));
    ctx.fillStyle = pp.color;
    ctx.fillText(pp.text, sx(pp.x), sy(pp.y));
    ctx.restore();
  }

  // Çevrimiçi Geri Sayım
  if (state === STATE.READY && MP.connected && mpCountdown > 0) {
    const sec = Math.ceil(mpCountdown / 60);
    ctx.save();
    ctx.fillStyle = 'rgba(10, 20, 40, 0.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.font = `900 ${Math.round(sr(64))}px "Segoe UI", Arial`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00f5d4';
    ctx.fillText(sec > 0 ? String(sec) : 'KIRMAYA BAŞLA!', W * 0.5, H * 0.45);
    ctx.restore();
  }
}

// ---------- Dokunmatik, Fare & Trackpad Kontrolleri ----------
let dragging = false;
let pointerStartX = 0;
let paddleStartX = 0;

function clientToVirtX(clientX) {
  const rect = canvas.getBoundingClientRect();
  const rw = rect.width || W || 420;
  return ((clientX - rect.left) / rw) * VIRT_W;
}

function onPointerStart(clientX) {
  getAudio();
  dragging = true;
  pointerStartX = clientX;
  paddleStartX = paddle.targetX;

  if (settings.ctrlMode === 'direct') {
    paddle.targetX = clientToVirtX(clientX);
  }
  launchBalls();
}

function onPointerMove(clientX) {
  if (!dragging) return;
  if (settings.ctrlMode === 'trackpad') {
    const rect = canvas.getBoundingClientRect();
    const rw = rect.width || W || 420;
    const deltaVirt = ((clientX - pointerStartX) / rw) * VIRT_W * settings.sens;
    paddle.targetX = paddleStartX + deltaVirt;
  } else {
    paddle.targetX = clientToVirtX(clientX);
  }
}

function onPointerEnd() {
  dragging = false;
}

canvas.addEventListener('mousedown', e => onPointerStart(e.clientX));
window.addEventListener('mousemove', e => { if (dragging) onPointerMove(e.clientX); });
window.addEventListener('mouseup', onPointerEnd);

canvas.addEventListener('touchstart', e => {
  if (!e.touches || !e.touches[0]) return;
  e.preventDefault();
  onPointerStart(e.touches[0].clientX);
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  if (!e.touches || !e.touches[0]) return;
  e.preventDefault();
  onPointerMove(e.touches[0].clientX);
}, { passive: false });

canvas.addEventListener('touchend', onPointerEnd);
canvas.addEventListener('touchcancel', onPointerEnd);

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space') {
      e.preventDefault();
      if (state === STATE.PLAYING) {
        launchBalls();
        firePaddleLasers();
      }
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
      if (state === STATE.PLAYING && !MP.connected) togglePause();
      else if (state === STATE.PAUSED) togglePause();
    }
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
}

// ---------- UI Menüleri & Atölye ----------
let currentShopTab = 'paddles';

function updateMenuUI() {
  if ($('menu-coins')) $('menu-coins').textContent = BK.coins;
  if ($('best-score-display')) $('best-score-display').textContent = `🏆 En İyi Skor: ${BK.bestScore}`;
  if ($('sound-btn')) $('sound-btn').textContent = settings.soundOn ? '🔊 Efekt: Açık' : '🔇 Efekt: Kapalı';
  if ($('music-btn')) $('music-btn').textContent = settings.musicOn ? '🎵 Müzik: Açık' : '🔕 Müzik: Kapalı';
  if ($('volume-range')) $('volume-range').value = Math.round(settings.volume * 100);

  const pct = Math.round(settings.sens * 100);
  if ($('sens-label')) $('sens-label').textContent = `📱 Hassasiyet: %${pct}`;
  if ($('sens-range')) $('sens-range').value = pct;
  if ($('ctrl-mode-btn')) {
    $('ctrl-mode-btn').textContent = settings.ctrlMode === 'trackpad' ? '🎯 Kontrol: Trackpad' : '🎯 Kontrol: Doğrudan';
  }

  document.querySelectorAll('#menu-skin-row .skin-btn').forEach(btn => {
    const sk = btn.dataset.skin;
    const owned = BK.ownedPaddles.includes(sk);
    btn.classList.toggle('active', BK.paddle === sk);
    btn.classList.toggle('locked', !owned);
  });

  document.querySelectorAll('#mode-tabs .diff-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === BK.mode);
  });

  document.querySelectorAll('#diff-tabs .diff-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.diff === BK.diff);
  });
}

function renderShop() {
  if ($('shop-coins')) $('shop-coins').textContent = BK.coins;
  const list = $('shop-list');
  if (!list) return;
  list.innerHTML = '';

  const catalog = currentShopTab === 'paddles' ? PADDLES : BALLS;
  const ownedArr = currentShopTab === 'paddles' ? BK.ownedPaddles : BK.ownedBalls;
  const activeKey = currentShopTab === 'paddles' ? BK.paddle : BK.ball;

  Object.keys(catalog).forEach(key => {
    const item = catalog[key];
    const owned = ownedArr.includes(key);
    const selected = activeKey === key;

    const row = document.createElement('div');
    row.className = 'shop-item' + (selected ? ' equipped' : '');
    row.innerHTML = `
      <div class="shop-swatch" style="background:${item.color1 || item.core}; box-shadow:0 0 10px ${item.glow}"></div>
      <div class="shop-info">
        <div class="shop-name">${item.name}</div>
        <div class="shop-desc">${owned ? (selected ? '✅ Seçili' : 'Açık') : '🪙 ' + item.price + ' Altın'}</div>
      </div>
      <button class="small-btn" type="button">${selected ? 'Seçili' : (owned ? 'Seç' : 'Al')}</button>
    `;
    row.querySelector('button').addEventListener('click', () => {
      if (owned) {
        if (currentShopTab === 'paddles') BK.paddle = key;
        else BK.ball = key;
        persist();
        renderShop();
        updateMenuUI();
      } else if (BK.coins >= item.price) {
        BK.coins -= item.price;
        ownedArr.push(key);
        if (currentShopTab === 'paddles') BK.paddle = key;
        else BK.ball = key;
        sfx.powerup();
        persist();
        renderShop();
        updateMenuUI();
      } else {
        if ($('shop-msg')) $('shop-msg').textContent = '🪙 Yeterli altının yok!';
      }
    });
    list.appendChild(row);
  });
}

function renderLeaderboard() {
  const list = $('lb-list');
  if (!list) return;
  if (!BK.leaderboard.length) {
    list.innerHTML = '<div class="lb-empty">Henüz skor kaydedilmemiş 🧱</div>';
    return;
  }
  list.innerHTML = BK.leaderboard.map((row, idx) => {
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
    return `<div class="lb-row"><span>${medal} ${row.name}</span><span>${row.score}</span></div>`;
  }).join('');
}

function renderStats() {
  if ($('st-best'))   $('st-best').textContent = BK.bestScore;
  if ($('st-bricks')) $('st-bricks').textContent = BK.stats.bricksHit;
  if ($('st-levels')) $('st-levels').textContent = BK.stats.levelsCleared;
  if ($('st-combo'))  $('st-combo').textContent = BK.stats.bestCombo;
  if ($('st-powers')) $('st-powers').textContent = BK.stats.powersCollected;
  if ($('st-games'))  $('st-games').textContent = BK.stats.games;
  if ($('st-coins'))  $('st-coins').textContent = BK.stats.totalCoins;
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
//            1v1 ÇEVRİMİÇİ TUĞLA DÜELLOSU (PeerJS + MPCore)
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
  myName: 'Kırıcı 1',
  oppName: 'Rakip',
  myReady: false,
  oppReady: false,
  oppScore: 0,
  oppX: VIRT_W * 0.5,
  oppPaddle: 'inferno',
  oppDead: false,
  meDead: false,
  seriesMe: 0,
  seriesOpp: 0,
  pingMs: 0,
  lobbyDiff: 'normal',
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
  const v = (inp ? inp.value.trim() : '') || BK.playerName;
  if (v) {
    BK.playerName = v.slice(0, 12);
    persist();
    return BK.playerName;
  }
  return MP.isHost ? 'Kaptan' : 'Kırıcı';
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
  if ($('mp-name-input')) $('mp-name-input').value = BK.playerName || '';
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
        <span id="mp-spec-text">Rakip oynuyor...</span>
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
  if ($('mp-spec-text')) $('mp-spec-text').textContent = `👀 ${MP.oppName} izleniyor...`;
  if ($('mp-spec-scores')) $('mp-spec-scores').textContent = `${score} - ${MP.oppScore}`;
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
    gameId: 'brick',
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
        label: 'Zorluk',
        value: MP.lobbyDiff,
        options: [
          { value: 'easy',   label: 'Kolay' },
          { value: 'normal', label: 'Normal' },
          { value: 'hard',   label: 'Hızlı' }
        ],
        onChange: val => {
          MP.lobbyDiff = val;
          MP.myReady = false;
          MP.oppReady = false;
          mpSend({ t: 'lobby_cfg', diff: MP.lobbyDiff, name: MP.myName, paddle: BK.paddle });
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
  mpSend({ t: 'ready', ready: MP.myReady, paddle: BK.paddle, name: MP.myName });
  mpRenderLobby();
  if (MP.isHost && MP.myReady && MP.oppReady) {
    MP.seed = ((Date.now() ^ ((Math.random() * 0xffffffff) >>> 0)) >>> 0) || 44444;
    mpSend({ t: 'start', seed: MP.seed, diff: MP.lobbyDiff });
    mpBeginMatch(MP.seed, MP.lobbyDiff, false);
  }
}

function mpBeginMatch(seed, diff, isGuest) {
  MP.inLobby = false;
  MP.myReady = false;
  MP.oppReady = false;
  MP.meDead = false;
  MP.oppDead = false;
  MP.oppScore = 0;
  MP.spectating = false;
  mpHideSpectatorBanner();

  BK.diff = DIFFICULTIES[diff] ? diff : 'normal';
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

function mpOnDeath() {
  if (MP.meDead) return;
  MP.meDead = true;
  mpSend({ t: 'dead', s: score });
  if (!MP.oppDead) {
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

  if (score > MP.oppScore) MP.seriesMe++;
  else if (MP.oppScore > score) MP.seriesOpp++;

  const earned = runCoins + Math.max(1, Math.floor(score / 50));
  BK.coins += earned;
  if (score > BK.bestScore) BK.bestScore = score;
  persist();

  if ($('mp-series-text')) $('mp-series-text').textContent = `🏅 Seri: ${MP.seriesMe} - ${MP.seriesOpp}`;
  if ($('mp-me-label'))    $('mp-me-label').textContent = MP.myName;
  if ($('mp-opp-label'))   $('mp-opp-label').textContent = MP.oppName;
  if ($('mp-final-me'))    $('mp-final-me').textContent = score;
  if ($('mp-final-opp'))   $('mp-final-opp').textContent = MP.oppScore;

  const resEl = $('mp-result-text');
  if (resEl) {
    if (score > MP.oppScore)      resEl.textContent = '🏆 KAZANDIN!';
    else if (score < MP.oppScore) resEl.textContent = '👏 RAKİP KAZANDI!';
    else                          resEl.textContent = '🤝 BERABERE!';
  }

  if (MPC) {
    MPC.mountGameoverSwitcher(mpGameoverScreen, 'brick', () => MP.isHost, gid => mpSwitchGame(gid));
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
      mpSend({ t: '_resume', name: MP.myName, paddle: BK.paddle, s: score, dead: MP.meDead });
      return;
    }

    MP.inLobby = true;
    MP.myReady = false;
    MP.oppReady = false;
    mpSend({ t: 'hello', name: MP.myName, paddle: BK.paddle, diff: MP.lobbyDiff });
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
      if (d.paddle && PADDLES[d.paddle]) MP.oppPaddle = d.paddle;
      if (typeof d.s === 'number') MP.oppScore = d.s;
      if (d.dead) MP.oppDead = true;
      return;
    }
    if (d.t === 'hello') {
      if (d.name) MP.oppName = String(d.name).slice(0, 12);
      if (d.paddle && PADDLES[d.paddle]) MP.oppPaddle = d.paddle;
      if (!MP.isHost && d.diff && DIFFICULTIES[d.diff]) MP.lobbyDiff = d.diff;
      else mpSend({ t: 'lobby_cfg', diff: MP.lobbyDiff, name: MP.myName, paddle: BK.paddle });
      if (MP.inLobby) mpRenderLobby();
    } else if (d.t === 'lobby_cfg') {
      if (d.name) MP.oppName = String(d.name).slice(0, 12);
      if (d.paddle && PADDLES[d.paddle]) MP.oppPaddle = d.paddle;
      if (!MP.isHost && d.diff && DIFFICULTIES[d.diff]) MP.lobbyDiff = d.diff;
      MP.myReady = false;
      MP.oppReady = false;
      if (MP.inLobby) mpRenderLobby();
    } else if (d.t === 'ready') {
      MP.oppReady = !!d.ready;
      if (d.paddle && PADDLES[d.paddle]) MP.oppPaddle = d.paddle;
      if (d.name) MP.oppName = String(d.name).slice(0, 12);
      if (MP.inLobby) mpRenderLobby();
      if (MP.isHost && MP.myReady && MP.oppReady) {
        MP.seed = ((Date.now() ^ ((Math.random() * 0xffffffff) >>> 0)) >>> 0) || 44444;
        mpSend({ t: 'start', seed: MP.seed, diff: MP.lobbyDiff });
        mpBeginMatch(MP.seed, MP.lobbyDiff, false);
      }
    } else if (d.t === 'start') {
      mpBeginMatch(d.seed || 44444, d.diff || 'normal', true);
    } else if (d.t === 'pos') {
      if (typeof d.nx === 'number') MP.oppX = Math.max(30, Math.min(VIRT_W - 30, d.nx * VIRT_W));
      if (typeof d.s === 'number') MP.oppScore = d.s;
      if (MP.spectating) mpUpdateSpectatorBanner();
    } else if (d.t === 'sc') {
      if (typeof d.s === 'number') MP.oppScore = d.s;
      if (MP.spectating) mpUpdateSpectatorBanner();
    } else if (d.t === 'dead') {
      if (typeof d.s === 'number') MP.oppScore = d.s;
      MP.oppDead = true;
      if (MP.meDead) mpShowFinalResult();
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

  const peer = new Peer('brick-' + MP.roomCode, MPC ? MPC.PEER_OPTS : undefined);
  MP.peer = peer;
  peer.on('open', () => {
    if (MP.peer !== peer) return;
    MP.idRetryCount = 0;
    if (!MP.reconnecting) {
      if ($('mp-room-code')) $('mp-room-code').textContent = MP.roomCode;
      if ($('mp-wait-text')) $('mp-wait-text').textContent = '✅ Oda hazır! Kodu arkadaşına gönder.';
      if (MPC) {
        MPC.mountHostQR($('mp-host-area'), mpInviteUrl());
        MPC.mountHostGamePicker($('mp-host-area'), 'brick', gid => mpSwitchGame(gid));
      }
    }
  });
  peer.on('connection', conn => {
    if (MP.peer !== peer) return;
    if (MPC && MPC.answerProbeIfAny(conn, 'brick', MP.roomCode, MP.connected)) return;
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
  MP.lobbyDiff = BK.diff || 'normal';

  hide($('mp-name-input'));
  hide($('mp-btn-row'));
  show($('mp-host-area'));
  if ($('mp-room-code')) $('mp-room-code').textContent = MP.roomCode;
  if ($('mp-wait-text')) $('mp-wait-text').textContent = 'Sunucuya bağlanılıyor...';
  if (MPC) {
    MPC.mountHostQR($('mp-host-area'), mpInviteUrl());
    MPC.mountHostGamePicker($('mp-host-area'), 'brick', gid => mpSwitchGame(gid));
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
    MP.conn = peer.connect('brick-' + MP.roomCode, { reliable: true });
    mpSetupConn();
  });
  peer.on('error', err => {
    const tp = (err && err.type) || '';
    if (tp === 'peer-unavailable' && !MP.reconnecting && !MP.cancelProbe && MPC) {
      MP.cancelProbe = MPC.probeRoomAcrossGames(Peer, MP.roomCode, 'brick-', foundGame => {
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

function mpPaddleTick() {
  if (!MP.connected) return;
  if (frames % 3 === 0 && !MP.meDead) {
    mpSend({ t: 'pos', nx: Number((paddle.x / VIRT_W).toFixed(4)), s: score });
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
    sub.textContent = `Rakibin bağlantısı yenileniyor (${Math.max(0, Math.ceil(MP.graceFrames / 60))} sn)`;
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
if (laserFireBtn)         laserFireBtn.addEventListener('click', firePaddleLasers);

document.querySelectorAll('#menu-skin-row .skin-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const sk = btn.dataset.skin;
    if (BK.ownedPaddles.includes(sk)) {
      BK.paddle = sk;
      sfx.hitPaddle();
      persist();
      updateMenuUI();
    } else {
      currentShopTab = 'paddles';
      hide(menuScreen);
      renderShop();
      show(shopScreen);
    }
  });
});

document.querySelectorAll('#mode-tabs .diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const md = btn.dataset.mode;
    if (md === 'levels' || md === 'endless') {
      BK.mode = md;
      sfx.hitPaddle();
      persist();
      updateMenuUI();
    }
  });
});

document.querySelectorAll('#diff-tabs .diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const df = btn.dataset.diff;
    if (DIFFICULTIES[df]) {
      BK.diff = df;
      sfx.hitPaddle();
      persist();
      updateMenuUI();
    }
  });
});

if ($('ctrl-mode-btn')) {
  $('ctrl-mode-btn').addEventListener('click', () => {
    settings.ctrlMode = settings.ctrlMode === 'trackpad' ? 'direct' : 'trackpad';
    persist();
    updateMenuUI();
  });
}
if ($('pause-ctrl-btn')) {
  $('pause-ctrl-btn').addEventListener('click', () => {
    settings.ctrlMode = settings.ctrlMode === 'trackpad' ? 'direct' : 'trackpad';
    $('pause-ctrl-btn').textContent = settings.ctrlMode === 'trackpad' ? '🎯 Kontrol: Trackpad' : '🎯 Kontrol: Doğrudan';
    persist();
    updateMenuUI();
  });
}

function onSensInput(val) {
  const pct = Math.max(60, Math.min(220, Number(val)));
  settings.sens = pct / 100;
  if ($('sens-label')) $('sens-label').textContent = `📱 Hassasiyet: %${pct}`;
  if ($('pause-sens-label')) $('pause-sens-label').textContent = `📱 Hassasiyet: %${pct}`;
  if ($('sens-range')) $('sens-range').value = pct;
  if ($('pause-sens-range')) $('pause-sens-range').value = pct;
  persist();
}
if ($('sens-range')) $('sens-range').addEventListener('input', e => onSensInput(e.target.value));
if ($('pause-sens-range')) $('pause-sens-range').addEventListener('input', e => onSensInput(e.target.value));

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
    const nm = (($('player-name') ? $('player-name').value.trim() : '') || 'Kırıcı').slice(0, 12);
    BK.playerName = nm;
    BK.leaderboard.push({ name: nm, score, date: Date.now() });
    BK.leaderboard.sort((a, b) => b.score - a.score);
    BK.leaderboard = BK.leaderboard.slice(0, 10);
    persist();
    $('save-score-btn').disabled = true;
    $('save-score-btn').textContent = '✅ Kaydedildi!';
    sfx.coin();
  });
}

if ($('sound-btn')) {
  $('sound-btn').addEventListener('click', () => {
    settings.soundOn = !settings.soundOn;
    if (settings.soundOn) sfx.hitPaddle();
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
    const text = `🧱 Tuğla Kırıcı düelloma gel! Kod: ${MP.roomCode}`;
    if (navigator.share) { navigator.share({ title: 'Tuğla Kırıcı', text, url }).catch(() => {}); return; }
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

      if (MP.reconnecting) {
        mpGraceTick();
        continue;
      }

      if (state === STATE.READY) {
        stepPaddleMovement();
        if (MP.connected) {
          mpCountdownTick();
          mpPaddleTick();
        } else {
          state = STATE.PLAYING;
        }
        stepEffects();
      } else if (state === STATE.PLAYING) {
        stepWorld();
        if (MP.connected) mpPaddleTick();
        stepEffects();
      } else if (state !== STATE.PAUSED) {
        stepEffects();
      }
    }

    draw();
  } catch (err) {
    if (typeof console !== 'undefined' && console.error) console.error('Brick loop error:', err);
  }
}

// ---------- Başlat ----------
function init() {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  updateMenuUI();
  ensureMusicLoop();
  show(menuScreen);

  // 1) Ortak Parti Oturumundan (sessionStorage) gelindiyse otomatik bağlan!
  const party = MPC ? MPC.loadParty() : null;
  if (party && party.autoConnect && (!party.targetGame || party.targetGame === 'brick')) {
    MPC.saveParty({ ...party, autoConnect: false });
    MP.seriesMe = party.seriesMe || 0;
    MP.seriesOpp = party.seriesOpp || 0;
    if (party.myName) BK.playerName = party.myName;
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
