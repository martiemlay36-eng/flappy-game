"use strict";

/* =====================================================
   YILAN v4 — Oyun Salonu Gelişmiş Sürüm
   - Kritik başlangıç yön/çarpışma hatası düzeltildi
   - 3 Oyun Modu: Klasik, Portal (Duvarsız), Labirent
   - 5 Özel Meyve/Güçlendirme (Altın Elma, Buz, Kısaltma, Hayalet, 2x)
   - Hızlı Yeme Kombo Sistemi & Enerjili ⚡ Turbo (Dash) Hamlesi
   - Altın Ekonomisi: 6 Yılan Kostümü & 4 Saha (Arena) Teması Mağazası
   - Web Audio Synth Müzik, Ses Sürgüsü, İstatistik & Skor Tablosu
   - Kusursuz Sıra Numaralı Yem Senkronu + Ganimet Patlamalı Çevrimiçi Düello
   ===================================================== */

// ---------- Canvas & Tahta Boyutlandırma ----------
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
let W = 420, H = 700, DPR = 1;

const GRID = 17;
let cell = 22, boardX = 10, boardY = 140, boardSize = 380;

function computeBoardLayout() {
  boardSize = Math.max(200, Math.min(W - 22, H * 0.72));
  cell = boardSize / GRID;
  boardX = (W - boardSize) / 2;
  boardY = Math.max(86, (H - boardSize) / 2 + 8);
}

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = rect.width || 420;
  H = rect.height || 700;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  computeBoardLayout();
}

// ---------- DOM ----------
const $ = id => document.getElementById(id);
const hud = $('hud'), scoreDisplay = $('score-display'), powerBadges = $('power-badges');
const hudCoins = $('hud-coins'), hudCombo = $('hud-combo'), turboBtn = $('turbo-btn');
const menuScreen = $('menu-screen'), gameoverScreen = $('gameover-screen'), pauseScreen = $('pause-screen');
const shopScreen = $('shop-screen'), lbScreen = $('leaderboard-screen'), statsScreen = $('stats-screen');
const mpScreen = $('mp-screen'), mpGameoverScreen = $('mp-gameover-screen');
const tapHint = $('tap-hint'), newRecord = $('new-record');
const medalDisplay = $('medal-display'), medalIcon = $('medal-icon'), medalText = $('medal-text');
const soundBtn = $('sound-btn'), musicBtn = $('music-btn');
const volumeRange = $('volume-range'), volumeIcon = $('volume-icon');

function show(el) { if (el) el.classList.remove('hidden'); }
function hide(el) { if (el) el.classList.add('hidden'); }

// ---------- Sabitler, Kostümler, Sahalar & Özel Meyveler ----------
const SPEEDS = { easy: 4.6, normal: 6.2, fast: 8.4 }; // adım/sn (kontrollü, akıcı hızlar)
const DIFF_LABELS = { easy: 'Yavaş', normal: 'Normal', fast: 'Hızlı' };
const MODE_LABELS = { classic: 'Klasik', portal: 'Portal', maze: 'Labirent' };

const SNAKE_SKINS = {
  emerald: { name: 'Zümrüt Yılan',    desc: 'Klasik parlak orman yılanı', cost: 0,  emoji: '🐍', head: '#69F587', c1: [70, 225, 105],  c2: [32, 135, 62],  eye: '#c0392b', swatch: '#43e072' },
  cyber:   { name: 'Neon Siber',      desc: 'Elektrik mavisi ve mor iz',  cost: 25, emoji: '⚡', head: '#40E0FF', c1: [0, 229, 255],   c2: [138, 43, 226], eye: '#ffeb3b', swatch: '#00d4ff' },
  dragon:  { name: 'Kızıl Ejder',     desc: 'Altın boynuzlu ateş ejderi', cost: 45, emoji: '🐉', head: '#FF7043', c1: [255, 87, 34],   c2: [183, 28, 28],  eye: '#ffd700', swatch: '#ff5722', special: 'dragon' },
  frost:   { name: 'Buz Yılanı',      desc: 'Kutup kristali soğukluğu',   cost: 50, emoji: '❄️', head: '#E0F7FA', c1: [128, 222, 234], c2: [2, 119, 189],  eye: '#01579b', swatch: '#80deea' },
  cobra:   { name: 'Altın Kobra',     desc: 'Kraliyet başlığı ve altın',  cost: 65, emoji: '👑', head: '#FFE066', c1: [255, 213, 79],  c2: [198, 124, 0],  eye: '#b71c1c', swatch: '#ffd54f', special: 'cobra' },
  prism:   { name: 'Gökkuşağı Prizma', desc: 'Canlı renk değiştiren pul', cost: 85, emoji: '🌈', head: '#FF80AB', c1: [255, 64, 129],  c2: [124, 77, 255], eye: '#111111', swatch: '#e040fb', special: 'prism' }
};

const ARENAS = {
  space:  { name: 'Uzay Neonu',  desc: 'Derin uzay ve siber ızgara',     cost: 0,  emoji: '🌌', bg0: '#0a1626', bg1: '#152e47', fld0: 'rgba(16,40,58,0.95)',  fld1: 'rgba(10,26,40,0.95)',  grid: 'rgba(0,191,255,0.08)', border: '#00bfff', swatch: '#12324d' },
  meadow: { name: 'Yeşil Çayır', desc: 'Doğal çim dama tahtası bahçesi', cost: 30, emoji: '🌿', bg0: '#142b18', bg1: '#234a28', fld0: 'rgba(34,78,40,0.96)',  fld1: 'rgba(24,58,30,0.96)',  grid: 'rgba(160,240,140,0.09)', border: '#8bc34a', swatch: '#388e3c', checker: 'rgba(120,210,95,0.06)' },
  retro:  { name: 'Retro LCD',   desc: 'Klasik cep telefonu ekranı',     cost: 40, emoji: '📟', bg0: '#1e2912', bg1: '#2f401b', fld0: 'rgba(139,172,15,0.92)', fld1: 'rgba(120,152,12,0.92)', grid: 'rgba(15,56,15,0.14)',    border: '#306230', swatch: '#8bac0f', retro: true },
  lava:   { name: 'Kızıl Lav',   desc: 'Volkanik obsidyen ve kor ateş',  cost: 60, emoji: '🌋', bg0: '#240b09', bg1: '#42140e', fld0: 'rgba(36,14,12,0.95)',  fld1: 'rgba(22,8,8,0.95)',    grid: 'rgba(255,87,34,0.11)',   border: '#ff5722', swatch: '#d84315' }
};

const BONUS_TYPES = {
  gold:  { icon: '🌟', label: 'Altın Elma', color: '#FFD700' },
  ice:   { icon: '❄️', label: 'Buz Yavaş',  color: '#40C4FF' },
  trim:  { icon: '✂️', label: 'Kısaltma',   color: '#FF80AB' },
  ghost: { icon: '👻', label: 'Hayalet',    color: '#64FFDA' },
  x2:    { icon: '💎', label: '2x Kristal', color: '#E040FB' }
};
const BONUS_KEYS = Object.keys(BONUS_TYPES);

// ---------- Kalıcı Veri (oyun-salonu-v2 ile tam uyumlu) ----------
const STORAGE_KEY = 'oyun-salonu-v2';

function defaultSnakeSaved() {
  return {
    difficulty: 'normal',
    mode: 'classic',
    skin: 'emerald',
    arena: 'space',
    unlockedSkins: ['emerald'],
    unlockedArenas: ['space'],
    coins: 0,
    totalCoins: 0,
    bestScore: 0,
    bestLen: 3,
    bestCombo: 0,
    games: 0,
    apples: 0,
    scoreboard: [],
    playerName: ''
  };
}

let audioSettings = { soundOn: true, musicOn: true, volume: 0.7 };

function loadSaved() {
  const d = defaultSnakeSaved();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const root = JSON.parse(raw);
      if (typeof root.soundOn === 'boolean') audioSettings.soundOn = root.soundOn;
      if (typeof root.musicOn === 'boolean') audioSettings.musicOn = root.musicOn;
      if (typeof root.volume === 'number') audioSettings.volume = Math.max(0, Math.min(1, root.volume));
      if (!d.playerName && root.flappy && root.flappy.playerName) {
        d.playerName = root.flappy.playerName;
      }
      if (root.snake && typeof root.snake === 'object') {
        Object.keys(d).forEach(k => {
          if (root.snake[k] !== undefined) d[k] = root.snake[k];
        });
      }
    }
  } catch (e) {}
  if (!Array.isArray(d.unlockedSkins) || !d.unlockedSkins.length) d.unlockedSkins = ['emerald'];
  if (!Array.isArray(d.unlockedArenas) || !d.unlockedArenas.length) d.unlockedArenas = ['space'];
  if (!SNAKE_SKINS[d.skin] || !d.unlockedSkins.includes(d.skin)) d.skin = 'emerald';
  if (!ARENAS[d.arena] || !d.unlockedArenas.includes(d.arena)) d.arena = 'space';
  if (!MODE_LABELS[d.mode]) d.mode = 'classic';
  if (!SPEEDS[d.difficulty]) d.difficulty = 'normal';
  return d;
}

let saved = loadSaved();
const S = saved;

function persist() {
  try {
    let root = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) root = JSON.parse(raw) || {};
    } catch (e) {}
    root.soundOn = audioSettings.soundOn;
    root.musicOn = audioSettings.musicOn;
    root.volume = audioSettings.volume;
    if (typeof root.snake !== 'object' || !root.snake) root.snake = {};
    Object.assign(root.snake, saved);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
  } catch (e) {}
}

// ---------- Ses Motoru & Arcade Müzik ----------
let audioCtx = null;
function getAC() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    try { audioCtx.resume(); } catch (e) {}
  }
  return audioCtx;
}

function beep(freq, dur, type = 'sine', vol = 0.12, slide = 0) {
  if (!audioSettings.soundOn || audioSettings.volume <= 0.005) return;
  const ac = getAC();
  if (!ac) return;
  const v = Math.max(0.001, vol * audioSettings.volume);
  const osc = ac.createOscillator(), gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  if (slide && osc.frequency.exponentialRampToValueAtTime) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ac.currentTime + dur);
  }
  gain.gain.setValueAtTime(v, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0008, ac.currentTime + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + dur);
}

const sfx = {
  eat:     () => { beep(660, 0.07, 'sine', 0.14); setTimeout(() => beep(990, 0.09, 'sine', 0.12), 55); },
  combo:   () => { [784, 988, 1318].forEach((f, i) => setTimeout(() => beep(f, 0.08, 'triangle', 0.13), i * 45)); },
  bonus:   () => { [587, 880, 1174, 1568].forEach((f, i) => setTimeout(() => beep(f, 0.08, 'sine', 0.14), i * 45)); },
  die:     () => { beep(220, 0.28, 'sawtooth', 0.20, -90); setTimeout(() => beep(140, 0.36, 'triangle', 0.16, -50), 150); },
  buy:     () => { [659, 880, 1318].forEach((f, i) => setTimeout(() => beep(f, 0.10, 'sine', 0.15), i * 65)); },
  medal:   () => { [660, 880, 1100, 1320].forEach((f, i) => setTimeout(() => beep(f, 0.13, 'sine', 0.13), i * 100)); },
  turn:    () => beep(420, 0.025, 'triangle', 0.045),
  click:   () => beep(700, 0.05, 'sine', 0.09)
};

// Synth Bass + Arpeggio Arka Plan Müziği
const SNAKE_MELODY = [329.63, 392.00, 493.88, 659.25, 587.33, 493.88, 392.00, 493.88, 349.23, 440.00, 523.25, 698.46, 659.25, 523.25, 493.88, 392.00];
const SNAKE_BASS   = [164.81, 0, 164.81, 0, 146.83, 0, 146.83, 0, 174.61, 0, 174.61, 0, 196.00, 0, 146.83, 0];
let musicStep = 0, musicTimer = null;

function playMusicTone(freq, dur, type, baseVol) {
  if (!freq || !audioCtx || audioCtx.state !== 'running') return;
  const v = baseVol * audioSettings.volume;
  if (v <= 0.001) return;
  const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(v, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0005, audioCtx.currentTime + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + dur);
}

function tickMusic() {
  if (!audioSettings.musicOn || audioSettings.volume <= 0.005) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  if (!audioCtx || audioCtx.state !== 'running') return;
  const isSpec = MP.connected && MP.spectating;
  if (state === STATE.PAUSED || (state === STATE.GAMEOVER && !isSpec)) return;

  const idx = musicStep % 16;
  musicStep++;
  if (state === STATE.PLAYING || state === STATE.READY || isSpec) {
    playMusicTone(SNAKE_MELODY[idx], 0.14, 'triangle', 0.038);
    if (SNAKE_BASS[idx]) playMusicTone(SNAKE_BASS[idx], 0.22, 'sine', 0.045);
  } else if (idx % 2 === 0) {
    playMusicTone(SNAKE_MELODY[idx] * 0.5, 0.20, 'sine', 0.025);
  }
}

function ensureMusicLoop() {
  if (musicTimer) clearInterval(musicTimer);
  if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
    musicTimer = setInterval(tickMusic, 185);
  }
}

// ---------- Durum & Oyun Değişkenleri ----------
const STATE = { MENU: 0, READY: 1, PLAYING: 2, GAMEOVER: 3, PAUSED: 4 };
let state = STATE.MENU;

let currentDiff = 'normal';
let currentMode = 'classic';

let snake = [];
let prevSnake = null;
let dir = { x: 1, y: 0 };
let nextDir = { x: 1, y: 0 };
let dirQueue = [];
const MAX_QUEUE = 2;

let obstacles = [];    // Labirent duvar blokları {x, y}
let food = null;       // Ana elma {x, y}
let bonusItem = null;  // Süreli özel meyve {x, y, type, ttl, maxTtl}
let lootApples = [];   // MP rakip ölünce saçılan ganimet elmalar {x, y}

let score = 0;
let runApples = 0;
let runCoins = 0;
let combo = 0;
let comboTimer = 0;
const COMBO_MAX_FRAMES = 260;

// Güçlendirme & Turbo durumları
let slowFrames = 0;
let ghostFrames = 0;
let x2Left = 0;
let stamina = 100;     // 0..100 Turbo enerjisi
let turboHeld = false;
let turboActive = false;
let lastBadgeSig = '';
let scoreSavedThisRun = false;

let stepAcc = 0;
let moveProgress = 0;
let frames = 0;
let foodPulse = 0;
let tongueT = 0;
let flashAlpha = 0;
let shakeT = 0;
let popParticles = [];
let popups = [];
let bgStars = [];

function initBgStars() {
  bgStars = [];
  for (let i = 0; i < 60; i++) {
    bgStars.push({
      x: Math.random(), y: Math.random(),
      r: 0.5 + Math.random() * 1.3,
      tw: Math.random() * Math.PI * 2,
      tws: 0.01 + Math.random() * 0.04
    });
  }
}

// ---------- Labirent Haritası (Simetrik & Adil) ----------
function buildMazeObstacles() {
  if (currentMode !== 'maze') return [];
  const obs = [
    // 4 köşe L-bariyer
    { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 3, y: 4 },
    { x: 13, y: 3 }, { x: 12, y: 3 }, { x: 13, y: 4 },
    { x: 3, y: 13 }, { x: 4, y: 13 }, { x: 3, y: 12 },
    { x: 13, y: 13 }, { x: 12, y: 13 }, { x: 13, y: 12 },
    // Üst ve alt orta kapılar (y=8 başlangıç koridoru tamamen açık!)
    { x: 7, y: 5 }, { x: 8, y: 5 }, { x: 9, y: 5 },
    { x: 7, y: 11 }, { x: 8, y: 11 }, { x: 9, y: 11 }
  ];
  return obs;
}

function isObstacle(x, y) {
  for (let i = 0; i < obstacles.length; i++) {
    if (obstacles[i].x === x && obstacles[i].y === y) return true;
  }
  return false;
}

function isCellOccupied(x, y) {
  if (isObstacle(x, y)) return true;
  if (snake.some(s => s.x === x && s.y === y)) return true;
  if (MP.connected && MP.oppAlive && MP.oppSnake && MP.oppSnake.some(([ox, oy]) => ox === x && oy === y)) return true;
  if (food && food.x === x && food.y === y) return true;
  if (bonusItem && bonusItem.x === x && bonusItem.y === y) return true;
  return false;
}

// ---------- Deterministik RNG & Sıralı Yem Senkronu ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

let foodRng = Math.random;
let bonusRng = Math.random;
let foodSeq = 0;

function pickNextFoodFromRng() {
  let tries = 0;
  while (tries++ < 400) {
    const fx = Math.floor(foodRng() * GRID);
    const fy = Math.floor(foodRng() * GRID);
    if (isObstacle(fx, fy)) continue;
    // MP modunda iki oyuncunun yılan gövdeleri farklı olabileceği için sadece engel kontrolü yapılır,
    // tek kişilik modda yılanın üstüne düşmemesi sağlanır:
    if (!MP.connected && snake.some(s => s.x === fx && s.y === fy)) continue;
    // MP başlangıç koridorunda ilk yemin yılanların üstüne düşmemesi için:
    if (MP.connected && foodSeq === 0 && fy === Math.floor(GRID / 2)) continue;
    return { x: fx, y: fy };
  }
  return { x: Math.floor(GRID / 2), y: Math.floor(GRID / 2) };
}

function spawnFood() {
  food = pickNextFoodFromRng();
}

function advanceFoodToSeq(targetSeq) {
  while (foodSeq < targetSeq) {
    foodSeq++;
    food = pickNextFoodFromRng();
  }
}

function maybeSpawnBonus() {
  if (bonusItem) return;
  const r = bonusRng();
  const type = BONUS_KEYS[Math.floor(bonusRng() * BONUS_KEYS.length) % BONUS_KEYS.length];
  if (r > 0.65) return;
  let tries = 0;
  while (tries++ < 200) {
    const bx = Math.floor(bonusRng() * GRID);
    const by = Math.floor(bonusRng() * GRID);
    if (!isCellOccupied(bx, by)) {
      bonusItem = { x: bx, y: by, type, ttl: 540, maxTtl: 540 };
      return;
    }
  }
}

// ---------- Hız Hesabı ----------
function currentStepMs() {
  const base = 1000 / (SPEEDS[currentDiff] || SPEEDS.normal);
  // Skor komboyla hızlı arttığı için hızlanmayı yılan boyuna göre yumuşak ve sınırlı tutuyoruz
  const grown = Math.max(0, snake.length - 3);
  const accel = 1 + Math.min(0.42, grown * 0.012);
  let ms = base / accel;
  if (slowFrames > 0) ms *= 1.45;
  if (turboActive) ms *= 0.66;
  return ms;
}

// ---------- UI Yardımcıları ----------
function updateSoundBtns() {
  if (soundBtn) soundBtn.textContent = audioSettings.soundOn ? '🔊 Efekt: Açık' : '🔇 Efekt: Kapalı';
  if (musicBtn) musicBtn.textContent = audioSettings.musicOn ? '🎵 Müzik: Açık' : '🎵 Müzik: Kapalı';
  if (volumeRange) volumeRange.value = Math.round(audioSettings.volume * 100);
  if (volumeIcon) {
    if (audioSettings.volume <= 0.01) volumeIcon.textContent = '🔇';
    else if (audioSettings.volume < 0.35) volumeIcon.textContent = '🔈';
    else if (audioSettings.volume < 0.7) volumeIcon.textContent = '🔉';
    else volumeIcon.textContent = '🔊';
  }
}

function updateCoinUI() {
  if ($('menu-coins')) $('menu-coins').textContent = S.coins;
  if ($('shop-coins')) $('shop-coins').textContent = S.coins;
  if (hudCoins) hudCoins.textContent = runCoins;
}

function renderMenuSkins() {
  document.querySelectorAll('#menu-skin-row .skin-btn').forEach(btn => {
    const key = btn.dataset.skin;
    const sk = SNAKE_SKINS[key];
    if (!sk) return;
    const unlocked = S.unlockedSkins.includes(key);
    btn.style.background = sk.swatch;
    btn.classList.toggle('locked', !unlocked);
    btn.classList.toggle('active', S.skin === key);
    btn.title = unlocked ? sk.name : `${sk.name} (${sk.cost} 🪙 - Mağazada)`;
  });
}

function updatePowerBadges() {
  if (!powerBadges) return;
  const items = [];
  if (ghostFrames > 0) items.push(`👻 ${Math.ceil(ghostFrames / 60)}s`);
  if (slowFrames > 0) items.push(`❄️ ${Math.ceil(slowFrames / 60)}s`);
  if (x2Left > 0) items.push(`💎 2x (${x2Left})`);

  const sig = items.join('|');
  if (sig === lastBadgeSig) return;
  lastBadgeSig = sig;
  powerBadges.innerHTML = items.map(t => `<span class="power-badge">${t}</span>`).join('');
}

function updateComboUI() {
  if (!hudCombo) return;
  if (combo >= 2 && comboTimer > 0) {
    hudCombo.textContent = `🔥 Kombo x${combo}`;
    show(hudCombo);
  } else {
    hide(hudCombo);
  }
}

function medalFor(sc) {
  if (sc >= 55) return { icon: '👑', text: 'EFSANE' };
  if (sc >= 38) return { icon: '💎', text: 'PLATİN' };
  if (sc >= 24) return { icon: '🥇', text: 'ALTIN' };
  if (sc >= 14) return { icon: '🥈', text: 'GÜMÜŞ' };
  if (sc >= 7)  return { icon: '🥉', text: 'BRONZ' };
  return null;
}

// ---------- Oyunu Başlat ----------
function resetMenuDemoSnake() {
  const cy = Math.floor(GRID / 2);
  snake = [{ x: 4, y: cy }, { x: 3, y: cy }, { x: 2, y: cy }];
  prevSnake = snake.map(s => ({ ...s }));
  dir = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };
}

function startGame(isMP) {
  getAC();
  computeBoardLayout();

  if (isMP && MP.connected) {
    foodRng = mulberry32(MP.seed || 1);
    bonusRng = mulberry32((MP.seed || 1) ^ 0x9E3779B9);
    currentDiff = MP.matchDiff || S.difficulty;
    currentMode = MP.matchMode || S.mode;
  } else {
    foodRng = Math.random;
    bonusRng = Math.random;
    currentDiff = S.difficulty;
    currentMode = S.mode;
  }

  obstacles = buildMazeObstacles();

  // DÜZELTME: Kafa (snake[0]) ilerleme yönünde ÖNDE başlar!
  const isGuest = isMP && MP.connected && !MP.isHost;
  const cy = Math.floor(GRID / 2);
  if (isGuest) {
    snake = [
      { x: GRID - 5, y: cy }, { x: GRID - 4, y: cy }, { x: GRID - 3, y: cy }
    ];
    dir = { x: -1, y: 0 };
    nextDir = { x: -1, y: 0 };
  } else {
    snake = [
      { x: 4, y: cy }, { x: 3, y: cy }, { x: 2, y: cy }
    ];
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
  }

  dirQueue = [];
  prevSnake = snake.map(s => ({ ...s }));
  foodSeq = 0;
  bonusItem = null;
  lootApples = [];
  score = 0;
  runApples = 0;
  runCoins = 0;
  combo = 0;
  comboTimer = 0;
  slowFrames = 0;
  ghostFrames = 0;
  x2Left = 0;
  stamina = 100;
  turboHeld = false;
  turboActive = false;
  scoreSavedThisRun = false;
  lastBadgeSig = '';

  stepAcc = 0;
  moveProgress = 0;
  frames = 0;
  flashAlpha = 0;
  shakeT = 0;
  tongueT = 0;
  popParticles = [];
  popups = [];

  spawnFood();

  scoreDisplay.textContent = '0';
  if (powerBadges) powerBadges.innerHTML = '';
  updateCoinUI();
  updateComboUI();
  if (MP.connected) hide(tapHint); else show(tapHint);
  show(hud);
  hide(menuScreen); hide(gameoverScreen); hide(pauseScreen);
  hide(shopScreen); hide(lbScreen); hide(statsScreen);
  hide(mpScreen); hide(mpGameoverScreen);

  state = STATE.READY;
}

// ---------- Adım (Grid İlerlemesi) ----------
function spawnBurst(gx, gy, col1, col2, count = 14) {
  const px = boardX + (gx + 0.5) * cell;
  const py = boardY + (gy + 0.5) * cell;
  for (let i = 0; i < count; i++) {
    popParticles.push({
      x: px, y: py,
      vx: (Math.random() - 0.5) * 4.4,
      vy: (Math.random() - 0.5) * 4.4 - 1.2,
      life: 26, r: 2 + Math.random() * 2.8,
      color: i % 2 === 0 ? col1 : col2
    });
  }
}

function awardPoints(gx, gy, basePts, coinsEarned, customLabel, customColor) {
  let pts = basePts;
  if (comboTimer > 0) {
    combo++;
    if (combo > (S.bestCombo || 0)) S.bestCombo = combo;
    if (combo >= 2) pts += Math.min(3, combo - 1);
  } else {
    combo = 1;
  }
  comboTimer = COMBO_MAX_FRAMES;

  if (x2Left > 0) {
    pts *= 2;
    x2Left--;
  }

  score += pts;
  scoreDisplay.textContent = score;

  if (coinsEarned > 0) {
    runCoins += coinsEarned;
    S.coins += coinsEarned;
    S.totalCoins = (S.totalCoins || 0) + coinsEarned;
    updateCoinUI();
  }

  updateComboUI();
  updatePowerBadges();

  const px = boardX + (gx + 0.5) * cell;
  const py = boardY + (gy + 0.2) * cell;
  const txt = customLabel ? `${customLabel} +${pts}` : (combo >= 2 ? `🔥 x${combo} +${pts}` : (pts > 1 ? `+${pts}` : '+1'));
  popups.push({ x: px, y: py, txt, color: customColor || (combo >= 2 ? '#FFD700' : '#7CFF9E'), life: 42 });
}

function applyBonusItem(item) {
  sfx.bonus();
  const info = BONUS_TYPES[item.type];
  spawnBurst(item.x, item.y, info.color, '#ffffff', 16);

  switch (item.type) {
    case 'gold':
      awardPoints(item.x, item.y, 3, 3, '🌟 ALTIN!', '#FFD700');
      break;
    case 'ice':
      slowFrames = 300;
      awardPoints(item.x, item.y, 1, 1, '❄️ YAVAŞ!', '#40C4FF');
      break;
    case 'trim':
      if (snake.length > 4) {
        const cut = Math.min(3, snake.length - 3);
        for (let i = 0; i < cut; i++) {
          const tail = snake.pop();
          if (tail) spawnBurst(tail.x, tail.y, '#FF80AB', '#ffffff', 6);
        }
      }
      awardPoints(item.x, item.y, 2, 1, '✂️ KISALDI!', '#FF80AB');
      break;
    case 'ghost':
      ghostFrames = 270;
      awardPoints(item.x, item.y, 1, 1, '👻 HAYALET!', '#64FFDA');
      break;
    case 'x2':
      x2Left += 4;
      awardPoints(item.x, item.y, 1, 1, '💎 2x PUAN!', '#E040FB');
      break;
  }
  updatePowerBadges();
}

function step() {
  if (state !== STATE.PLAYING) return;

  applyQueuedDir();
  dir = nextDir;
  let head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  // Duvar kontrolü (Portal modu veya Labirentte Hayalet aktifken karşıdan çıkar)
  if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) {
    if (currentMode === 'portal' || ghostFrames > 0) {
      head.x = (head.x + GRID) % GRID;
      head.y = (head.y + GRID) % GRID;
    } else {
      die();
      return;
    }
  }

  // Labirent engeli kontrolü
  if (ghostFrames <= 0 && isObstacle(head.x, head.y)) {
    die();
    return;
  }

  // Kendine çarpma (kuyruk ucu hareket edeceği için snake.length - 1'e kadar)
  if (ghostFrames <= 0) {
    for (let i = 0; i < snake.length - 1; i++) {
      if (snake[i].x === head.x && snake[i].y === head.y) {
        die();
        return;
      }
    }
  }

  // MP: Rakip yılanın canlı gövdesine çarpma
  if (MP.connected && MP.oppAlive && MP.oppSnake && ghostFrames <= 0) {
    for (const [ox, oy] of MP.oppSnake) {
      if (head.x === ox && head.y === oy) {
        die();
        return;
      }
    }
  }

  prevSnake = snake.map(s => ({ ...s }));
  snake.unshift(head);

  let grew = false;

  // 1) Ana elma yeme
  if (food && head.x === food.x && head.y === food.y) {
    grew = true;
    runApples++;
    S.apples = (S.apples || 0) + 1;
    if (combo >= 1 && comboTimer > 0) sfx.combo(); else sfx.eat();
    spawnBurst(food.x, food.y, 'rgba(255,80,80,0.95)', 'rgba(255,215,0,0.9)', 14);
    awardPoints(food.x, food.y, 1, 1);

    const eatenSeq = foodSeq;
    advanceFoodToSeq(eatenSeq + 1);
    if (MP.connected) {
      mpSend({ t: 'eat', seq: eatenSeq });
      if (MP.isHost && foodSeq > 0 && foodSeq % 3 === 0 && !bonusItem) {
        maybeSpawnBonus();
        if (bonusItem) mpSend({ t: 'bonus_spawn', item: bonusItem });
      }
    } else if (runApples % 3 === 0) {
      maybeSpawnBonus();
    }
  }

  // 2) Süreli özel meyve / güçlendirme yeme
  if (bonusItem && head.x === bonusItem.x && head.y === bonusItem.y) {
    const it = bonusItem;
    bonusItem = null;
    if (MP.connected) mpSend({ t: 'bonus_eat' });
    if (it.type === 'gold') grew = true;
    applyBonusItem(it);
  }

  // 3) MP ganimet elmaları
  for (let i = lootApples.length - 1; i >= 0; i--) {
    const la = lootApples[i];
    if (head.x === la.x && head.y === la.y) {
      grew = true;
      sfx.eat();
      spawnBurst(la.x, la.y, '#FFD700', '#40C4FF', 10);
      awardPoints(la.x, la.y, 2, 1, '💰 GANİMET!', '#FFD700');
      lootApples.splice(i, 1);
    }
  }

  if (!grew) {
    snake.pop();
  }

  if (snake.length > (S.bestLen || 3)) {
    S.bestLen = snake.length;
  }

  if (MP.connected) {
    mpSendSnakeNow();
  }
}

function die() {
  if (state === STATE.GAMEOVER) return;
  state = STATE.GAMEOVER;
  turboHeld = false;
  turboActive = false;
  if (turboBtn) turboBtn.classList.remove('active');
  flashAlpha = 0.65;
  shakeT = 1;
  combo = 0;
  comboTimer = 0;
  updateComboUI();
  sfx.die();

  if (snake.length) {
    const sk = SNAKE_SKINS[S.skin] || SNAKE_SKINS.emerald;
    spawnBurst(snake[0].x, snake[0].y, sk.head, '#ffffff', 18);
  }

  S.games++;
  if (snake.length > (S.bestLen || 3)) S.bestLen = snake.length;
  const isRecord = score > S.bestScore;
  if (isRecord) S.bestScore = score;
  persist();
  updateCoinUI();

  if (MP.connected) {
    mpSendSnakeNow();
    MP.deathDelayFrames = 26;
    return;
  }

  $('final-score').textContent = score;
  $('best-score-go').textContent = S.bestScore;
  if ($('final-len')) $('final-len').textContent = snake.length;
  if ($('run-coins-go')) $('run-coins-go').textContent = `🪙 +${runCoins}`;
  if (isRecord && score > 0) show(newRecord); else hide(newRecord);

  // Skor kaydetme satırı
  const saveRow = $('name-save-row');
  const saveBtn = $('save-score-btn');
  const nameInp = $('player-name');
  if (score > 0 && saveRow && saveBtn && nameInp) {
    nameInp.value = S.playerName || '';
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 Kaydet';
    show(saveRow);
  } else if (saveRow) {
    hide(saveRow);
  }

  const m = medalFor(score);
  if (m && medalDisplay) {
    show(medalDisplay);
    medalIcon.textContent = m.icon;
    medalText.textContent = m.text;
    setTimeout(sfx.medal, 320);
  } else if (medalDisplay) {
    hide(medalDisplay);
  }

  setTimeout(() => {
    if (state === STATE.GAMEOVER && !MP.connected) {
      show(gameoverScreen);
      hide(hud);
    }
  }, 550);
}

// ---------- Girdi: Hassas Yön Kuyruğu & Turbo ----------
function queueDir(nx, ny) {
  if (dirQueue.length >= MAX_QUEUE) dirQueue.shift();
  dirQueue.push({ x: nx, y: ny });
}

function applyQueuedDir() {
  while (dirQueue.length) {
    const d = dirQueue.shift();
    if (d.x === -dir.x && d.y === -dir.y) continue;
    if (d.x === dir.x && d.y === dir.y) continue;
    nextDir = d;
    sfx.turn();
    return;
  }
}

function setDir(nx, ny) {
  if (state !== STATE.PLAYING && state !== STATE.READY) return;
  const ref = dirQueue.length ? dirQueue[dirQueue.length - 1] : nextDir;
  if (nx === -ref.x && ny === -ref.y) return;
  if (nx === ref.x && ny === ref.y) return;
  queueDir(nx, ny);
}

function setTurbo(on) {
  turboHeld = !!on;
  if (turboBtn) turboBtn.classList.toggle('active', turboHeld);
}

document.addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();

  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (state === STATE.PLAYING || state === STATE.PAUSED) togglePause();
    return;
  }
  if (e.code === 'Enter' && state === STATE.GAMEOVER && !MP.connected) {
    startGame();
    return;
  }
  if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    if (state === STATE.MENU && menuScreen && !menuScreen.classList.contains('hidden') &&
        shopScreen.classList.contains('hidden') && lbScreen.classList.contains('hidden') &&
        statsScreen.classList.contains('hidden')) {
      startGame();
      return;
    }
    if (state === STATE.READY) {
      beginPlay();
      return;
    }
    setTurbo(true);
    return;
  }

  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD'].includes(e.code)) {
    if (state === STATE.READY) beginPlay();
    switch (e.code) {
      case 'ArrowUp': case 'KeyW': setDir(0, -1); break;
      case 'ArrowDown': case 'KeyS': setDir(0, 1); break;
      case 'ArrowLeft': case 'KeyA': setDir(-1, 0); break;
      case 'ArrowRight': case 'KeyD': setDir(1, 0); break;
    }
  }
});

document.addEventListener('keyup', e => {
  if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    setTurbo(false);
  }
});

// Mobil dokunmatik + Fare sürükleme
const SWIPE_THRESHOLD = 12;
let touchStart = null;
let touchMoved = false;

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  getAC();
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: performance.now() };
  touchMoved = false;
  if (state === STATE.READY) beginPlay();
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!touchStart) return;
  const dx = e.touches[0].clientX - touchStart.x;
  const dy = e.touches[0].clientY - touchStart.y;
  if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;
  if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0);
  else setDir(0, dy > 0 ? 1 : -1);
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: touchStart.t };
  touchMoved = true;
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  if (touchStart && !touchMoved && performance.now() - touchStart.t < 300 && state === STATE.READY) beginPlay();
  touchStart = null;
}, { passive: false });

let mouseStart = null;
canvas.addEventListener('mousedown', e => {
  getAC();
  mouseStart = { x: e.clientX, y: e.clientY };
  if (state === STATE.READY) beginPlay();
});
canvas.addEventListener('mousemove', e => {
  if (!mouseStart || e.buttons !== 1) return;
  const dx = e.clientX - mouseStart.x, dy = e.clientY - mouseStart.y;
  if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;
  if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0);
  else setDir(0, dy > 0 ? 1 : -1);
  mouseStart = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('mouseup', () => { mouseStart = null; });

if (turboBtn) {
  turboBtn.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); if (state === STATE.READY) beginPlay(); setTurbo(true); });
  turboBtn.addEventListener('mouseup', () => setTurbo(false));
  turboBtn.addEventListener('mouseleave', () => setTurbo(false));
  turboBtn.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); if (state === STATE.READY) beginPlay(); setTurbo(true); }, { passive: false });
  turboBtn.addEventListener('touchend', e => { e.preventDefault(); setTurbo(false); }, { passive: false });
}

function beginPlay() {
  if (state !== STATE.READY) return;
  if (MP.connected && mpCountdown > 0) return;
  state = STATE.PLAYING;
  hide(tapHint);
}

function togglePause() {
  if (MP.connected) return;
  if (state === STATE.PLAYING) {
    state = STATE.PAUSED;
    setTurbo(false);
    show(pauseScreen);
  } else if (state === STATE.PAUSED) {
    state = STATE.PLAYING;
    hide(pauseScreen);
  }
}

// ---------- Çizim ----------
function drawSnakeBody(pts, skinKey, headDir, isDead, isOpp) {
  if (!pts.length) return;
  const sk = SNAKE_SKINS[skinKey] || SNAKE_SKINS.emerald;
  const n = pts.length;

  ctx.save();
  if (isDead) ctx.globalAlpha *= 0.42;
  else if (ghostFrames > 0 && !isOpp) {
    ctx.globalAlpha *= (ghostFrames < 60 && Math.floor(ghostFrames / 5) % 2 === 0) ? 0.85 : 0.50;
  }

  if (isOpp && !isDead) {
    ctx.shadowColor = 'rgba(0, 191, 255, 0.75)';
    ctx.shadowBlur = 10;
  } else if (turboActive && !isOpp && !isDead) {
    ctx.shadowColor = 'rgba(255, 215, 0, 0.8)';
    ctx.shadowBlur = 12;
  }

  // Kontur + Gövde (Portal sıçramalarını algılayıp ayırır!)
  const maxSegDist = cell * 2.2;
  for (let pass = 0; pass < 2; pass++) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = pass === 0 ? cell * 0.80 : cell * 0.64;

    for (let i = n - 1; i > 0; i--) {
      const a = pts[i], b = pts[i - 1];
      if (Math.hypot(a.x - b.x, a.y - b.y) > maxSegDist) continue; // portal geçişi

      if (pass === 0) {
        ctx.strokeStyle = isOpp ? 'rgba(10,30,65,0.9)' : 'rgba(8,28,18,0.9)';
      } else {
        const t = i / Math.max(1, n - 1);
        if (sk.special === 'prism' && !isDead) {
          const hue = (frames * 4 + i * 18) % 360;
          ctx.strokeStyle = `hsl(${hue}, 92%, 58%)`;
        } else {
          const r = Math.round(sk.c1[0] + (sk.c2[0] - sk.c1[0]) * t);
          const g = Math.round(sk.c1[1] + (sk.c2[1] - sk.c1[1]) * t);
          const bl = Math.round(sk.c1[2] + (sk.c2[2] - sk.c1[2]) * t);
          ctx.strokeStyle = `rgb(${r},${g},${bl})`;
        }
      }
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;

  // Sırt pul deseni
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let i = 2; i < n; i += 2) {
    const t = i / n;
    const pr2 = cell * (0.27 - t * 0.10);
    ctx.beginPath();
    ctx.ellipse(pts[i].x, pts[i].y, pr2 * 0.8, pr2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Kafa Çizimi
  const h = pts[0];
  const ang = Math.atan2(headDir.y, headDir.x);
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(ang);

  // Altın Kobra başlığı (hood)
  if (sk.special === 'cobra') {
    ctx.fillStyle = '#D97706';
    ctx.strokeStyle = '#451A03';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(-cell * 0.12, 0, cell * 0.34, cell * 0.56, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }

  // Kızıl Ejder boynuzları
  if (sk.special === 'dragon') {
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.moveTo(-cell * 0.05, -cell * 0.26);
    ctx.lineTo(-cell * 0.42, -cell * 0.52);
    ctx.lineTo(-cell * 0.22, -cell * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-cell * 0.05, cell * 0.26);
    ctx.lineTo(-cell * 0.42, cell * 0.52);
    ctx.lineTo(-cell * 0.22, cell * 0.16);
    ctx.closePath();
    ctx.fill();
  }

  // Kafa gövdesi
  ctx.fillStyle = sk.special === 'prism' ? `hsl(${(frames * 4) % 360}, 95%, 64%)` : sk.head;
  ctx.strokeStyle = 'rgba(8,28,18,0.9)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, cell * 0.46, cell * 0.38, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  // Çatal dil
  if (!isDead) {
    const tongue = Math.max(0, Math.sin(tongueT)) * cell * 0.48;
    if (tongue > 2) {
      ctx.strokeStyle = '#ff5252';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(cell * 0.4, 0);
      ctx.lineTo(cell * 0.4 + tongue * 0.6, 0);
      ctx.lineTo(cell * 0.4 + tongue, -cell * 0.10);
      ctx.moveTo(cell * 0.4 + tongue * 0.6, 0);
      ctx.lineTo(cell * 0.4 + tongue, cell * 0.10);
      ctx.stroke();
    }
  }

  // Gözler
  const eo = cell * 0.17;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(cell * 0.15, -eo, cell * 0.125, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cell * 0.15, eo, cell * 0.125, 0, Math.PI * 2); ctx.fill();

  if (isDead) {
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.6;
    [-eo, eo].forEach(gy => {
      ctx.beginPath();
      ctx.moveTo(cell * 0.10, gy - 2.5); ctx.lineTo(cell * 0.20, gy + 2.5);
      ctx.moveTo(cell * 0.20, gy - 2.5); ctx.lineTo(cell * 0.10, gy + 2.5);
      ctx.stroke();
    });
  } else {
    ctx.fillStyle = sk.eye;
    ctx.beginPath(); ctx.arc(cell * 0.19, -eo, cell * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cell * 0.19, eo, cell * 0.06, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
  ctx.restore();
}

function draw() {
  const ar = ARENAS[S.arena] || ARENAS.space;

  // Arka plan
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, ar.bg0);
  bg.addColorStop(1, ar.bg1);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  if (!ar.retro) {
    bgStars.forEach(s => {
      ctx.globalAlpha = 0.22 + 0.5 * Math.abs(Math.sin(s.tw));
      ctx.fillStyle = '#cfe8ff';
      ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  ctx.save();
  if (shakeT > 0) {
    shakeT = Math.max(0, shakeT - 0.04);
    const m = shakeT * 8;
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
  }

  // Saha dış çerçevesi (Portal modunda kesikli parlayan kenar!)
  ctx.save();
  ctx.strokeStyle = ar.border;
  ctx.lineWidth = 2.6;
  if (currentMode === 'portal') ctx.setLineDash([8, 6]);
  ctx.strokeRect(boardX - 4, boardY - 4, boardSize + 8, boardSize + 8);
  ctx.restore();

  // Saha zemini
  const fld = ctx.createLinearGradient(boardX, boardY, boardX, boardY + boardSize);
  fld.addColorStop(0, ar.fld0);
  fld.addColorStop(1, ar.fld1);
  ctx.fillStyle = fld;
  ctx.fillRect(boardX, boardY, boardSize, boardSize);

  // Çayır dama deseni
  if (ar.checker) {
    ctx.fillStyle = ar.checker;
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if ((x + y) % 2 === 0) ctx.fillRect(boardX + x * cell, boardY + y * cell, cell, cell);
      }
    }
  }

  // Izgara çizgileri
  ctx.strokeStyle = ar.grid;
  ctx.lineWidth = 1;
  for (let i = 1; i < GRID; i++) {
    ctx.beginPath(); ctx.moveTo(boardX + i * cell, boardY); ctx.lineTo(boardX + i * cell, boardY + boardSize); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(boardX, boardY + i * cell); ctx.lineTo(boardX + boardSize, boardY + i * cell); ctx.stroke();
  }

  // Labirent Engelleri
  if (obstacles.length) {
    obstacles.forEach(ob => {
      const ox = boardX + ob.x * cell + 1.5;
      const oy = boardY + ob.y * cell + 1.5;
      const os = cell - 3;
      ctx.fillStyle = ar.retro ? '#1f3b12' : 'rgba(0, 191, 255, 0.22)';
      ctx.strokeStyle = ar.border;
      ctx.lineWidth = 2;
      ctx.fillRect(ox, oy, os, os);
      ctx.strokeRect(ox, oy, os, os);
    });
  }

  // Ana Elma
  if (food) {
    const pr = cell * 0.35 * (1 + 0.12 * Math.sin(foodPulse));
    const fx = boardX + (food.x + 0.5) * cell;
    const fy = boardY + (food.y + 0.5) * cell;
    const g = ctx.createRadialGradient(fx, fy, 1, fx, fy, cell * 0.9);
    g.addColorStop(0, 'rgba(255,100,60,0.55)');
    g.addColorStop(1, 'rgba(255,60,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(fx - cell, fy - cell, cell * 2, cell * 2);

    ctx.fillStyle = ar.retro ? '#0f380f' : '#e8384f';
    ctx.beginPath(); ctx.arc(fx, fy, pr, 0, Math.PI * 2); ctx.fill();
    if (!ar.retro) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath(); ctx.arc(fx - pr * 0.3, fy - pr * 0.35, pr * 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6ecf68';
      ctx.beginPath(); ctx.ellipse(fx + 4, fy - pr - 3, 4.5, 2.2, -0.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  // MP Ganimet Elmaları
  lootApples.forEach(la => {
    const fx = boardX + (la.x + 0.5) * cell;
    const fy = boardY + (la.y + 0.5) * cell;
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(fx, fy, cell * 0.28 * (1 + 0.1 * Math.sin(foodPulse * 1.6)), 0, Math.PI * 2);
    ctx.fill();
  });

  // Süreli Özel Meyve / Güçlendirme
  if (bonusItem) {
    const info = BONUS_TYPES[bonusItem.type];
    const bx = boardX + (bonusItem.x + 0.5) * cell;
    const by = boardY + (bonusItem.y + 0.5) * cell;
    const ratio = Math.max(0, bonusItem.ttl / bonusItem.maxTtl);

    ctx.save();
    ctx.strokeStyle = info.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(bx, by, cell * 0.46, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
    ctx.stroke();

    ctx.font = `700 ${Math.round(cell * 0.62)}px "Segoe UI", Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(info.icon, bx, by + 1);
    ctx.restore();
  }

  // Rakip Yılan (Çevrimiçi — İzleyici modunda sahnenin tek yıldızı!)
  if (MP.connected && MP.oppSnake && MP.oppSnake.length) {
    const oppPts = oppDisplayPts();
    drawSnakeBody(oppPts, MP.oppSkin || 'cyber', MP.oppDir || { x: -1, y: 0 }, !MP.oppAlive, true);
    if (oppPts.length) {
      const lbl = MP.spectating ? `🎥 ${MP.oppName} · ${MP.oppScore}` : MP.oppName;
      ctx.save();
      ctx.font = MP.spectating ? '800 12px "Segoe UI", Arial' : '700 10px "Segoe UI", Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillText(lbl, oppPts[0].x + 1, oppPts[0].y - cell * 0.72 + 1);
      ctx.fillStyle = MP.spectating ? '#ffd700' : (MP.oppAlive ? '#7ec8ff' : '#9fb8d1');
      ctx.fillText(lbl, oppPts[0].x, oppPts[0].y - cell * 0.72);
      ctx.restore();
    }
  }

  // Ana Yılan (İzleyici moduna geçince ganimete dönüşüp sahneyi rakibe bırakır!)
  if (!MP.spectating) {
    const n = snake.length;
    const prog = state === STATE.PLAYING ? moveProgress : 0;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const cur = snake[i];
      const prev = prevSnake && prevSnake[i] ? prevSnake[i] : cur;
      const ref = i === 0 && prevSnake && prevSnake[0] ? prevSnake[0] : prev;
      const jump = Math.abs(ref.x - cur.x) > 1 || Math.abs(ref.y - cur.y) > 1;
      const ix = jump ? cur.x : cur.x + (ref.x - cur.x) * (1 - prog);
      const iy = jump ? cur.y : cur.y + (ref.y - cur.y) * (1 - prog);
      pts.push({
        x: boardX + (ix + 0.5) * cell,
        y: boardY + (iy + 0.5) * cell
      });
    }
    drawSnakeBody(pts, S.skin, dir, state === STATE.GAMEOVER, false);
  }

  // Üst Saha Çubukları: Sol = Kombo Süresi, Sağ = ⚡ Turbo Enerji
  if (state === STATE.PLAYING || state === STATE.READY) {
    // Turbo Enerji Barı (Sağ Üst)
    const barW = 68, barH = 6;
    const bx = boardX + boardSize - barW, by = boardY - 15;
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(bx, by, barW, barH);
    ctx.fillStyle = turboActive ? '#FFD700' : '#00E5FF';
    ctx.fillRect(bx, by, barW * (stamina / 100), barH);
    ctx.font = '700 10px "Segoe UI", Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('⚡ TURBO', bx - 48, by + 6);

    // Kombo Süre Barı (Sol Üst)
    if (comboTimer > 0 && combo >= 1) {
      const cx = boardX, cy2 = boardY - 15;
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(cx, cy2, 64, 5);
      ctx.fillStyle = '#FF9800';
      ctx.fillRect(cx, cy2, 64 * (comboTimer / COMBO_MAX_FRAMES), 5);
    }
  }

  // Partiküller
  popParticles.forEach(pt => {
    const a = Math.min(1, pt.life / 24);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });

  // Yüzen Yazılar
  ctx.font = '900 16px "Segoe UI", Arial';
  ctx.textAlign = 'center';
  popups.forEach(p => {
    ctx.globalAlpha = Math.min(1, p.life / 24);
    const dy = (42 - p.life) * 0.5;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillText(p.txt, p.x + 1, p.y - dy + 1);
    ctx.fillStyle = p.color || '#7CFF9E';
    ctx.fillText(p.txt, p.x, p.y - dy);
  });
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';

  ctx.restore();

  if (MP.connected) {
    mpDrawCountdown();
    if (MP.spectating) mpDrawSpectatorTopBanner();
  }

  if (flashAlpha > 0) {
    flashAlpha = Math.max(0, flashAlpha - 0.04);
    ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
    ctx.fillRect(0, 0, W, H);
  }
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.74);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,10,25,0.42)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

// ---------- Ana Döngü ----------
const STEP_MS = 1000 / 60;
let acc = 0, lastT = performance.now();

function loop(now) {
  const dt = Math.min(now - lastT, 100);
  lastT = now;
  acc += dt;
  if (acc > 200) acc = STEP_MS;

  while (acc >= STEP_MS) {
    acc -= STEP_MS;
    frames++;
    mpCountdownTick();

    if (state === STATE.PLAYING) {
      // Turbo enerji yönetimi
      if (turboHeld && stamina > 4) {
        turboActive = true;
        stamina = Math.max(0, stamina - 0.65);
        if (stamina <= 0) turboHeld = false;
        if (frames % 3 === 0 && snake.length) {
          const tail = snake[snake.length - 1];
          popParticles.push({
            x: boardX + (tail.x + 0.5) * cell,
            y: boardY + (tail.y + 0.5) * cell,
            vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5,
            life: 14, r: 2, color: '#FFD700'
          });
        }
      } else {
        turboActive = false;
        stamina = Math.min(100, stamina + 0.36);
      }

      if (comboTimer > 0) {
        comboTimer--;
        if (comboTimer === 0) { combo = 0; updateComboUI(); }
      }
      if (slowFrames > 0) slowFrames--;
      if (ghostFrames > 0) ghostFrames--;
      if (bonusItem) {
        bonusItem.ttl--;
        if (bonusItem.ttl <= 0) bonusItem = null;
      }
      if (frames % 10 === 0) updatePowerBadges();

      const ms = currentStepMs();
      stepAcc += STEP_MS;
      moveProgress = Math.min(1, stepAcc / ms);
      if (stepAcc >= ms) {
        stepAcc -= ms;
        moveProgress = 0;
        step();
      }
      tongueT += 0.08;
    } else {
      moveProgress = 0;
      tongueT += 0.05;
      if (MP.connected && MP.spectating && bonusItem) {
        bonusItem.ttl--;
        if (bonusItem.ttl <= 0) bonusItem = null;
      }
    }

    if (MP.deathDelayFrames > 0) {
      MP.deathDelayFrames--;
      if (MP.deathDelayFrames === 0) mpOnDeath();
    }
    if (MP.spectating && MP.specEndFrames > 0) {
      MP.specEndFrames--;
      if (MP.specEndFrames === 0) {
        MP.spectating = false;
        mpFinishDuel();
      }
    }

    mpTick();
    if (oppAnim < 1) oppAnim += 0.08;
    bgStars.forEach(s => { s.tw += s.tws; });
    foodPulse += 0.09;
    popParticles.forEach(pt => { pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.10; pt.life--; });
    popParticles = popParticles.filter(pt => pt.life > 0);
    popups.forEach(p => { p.life--; });
    popups = popups.filter(p => p.life > 0);
  }

  draw();
  requestAnimationFrame(loop);
}

// ---------- Mağaza & Skor Tablosu ----------
let currentShopTab = 'skins';

function openShop(tab, customMsg) {
  sfx.click();
  currentShopTab = tab || 'skins';
  document.querySelectorAll('.shop-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === currentShopTab);
  });
  $('shop-msg').textContent = customMsg || 'Elma ve altın elmaları toplayarak yeni görünümler aç!';
  renderShopList();
  updateCoinUI();
  show(shopScreen);
}

function renderShopList() {
  const list = $('shop-list');
  if (!list) return;
  const isSkins = currentShopTab === 'skins';
  const dict = isSkins ? SNAKE_SKINS : ARENAS;
  const unlockedArr = isSkins ? S.unlockedSkins : S.unlockedArenas;
  const equippedKey = isSkins ? S.skin : S.arena;

  list.innerHTML = '';
  Object.keys(dict).forEach(key => {
    const item = dict[key];
    const unlocked = unlockedArr.includes(key);
    const equipped = equippedKey === key;
    const canAfford = S.coins >= item.cost;

    const row = document.createElement('div');
    row.className = 'shop-item' + (equipped ? ' equipped' : '');
    const btnClass = equipped ? 'active' : (unlocked ? 'equip' : 'buy');
    const btnText = equipped ? '✓ Seçili' : (unlocked ? 'Kuşan' : `🪙 ${item.cost}`);

    row.innerHTML = `
      <div class="shop-swatch" style="background:${item.swatch}">${item.emoji}</div>
      <div class="shop-info">
        <div class="shop-name">${item.name}</div>
        <div class="shop-desc">${item.desc}</div>
      </div>
      <button class="shop-buy-btn ${btnClass}" ${(!unlocked && !canAfford) ? 'disabled' : ''}>${btnText}</button>
    `;

    row.querySelector('button').addEventListener('click', () => {
      if (equipped) return;
      if (unlocked) {
        sfx.click();
        if (isSkins) S.skin = key; else S.arena = key;
        persist();
        renderMenuSkins();
        renderShopList();
      } else if (S.coins >= item.cost) {
        S.coins -= item.cost;
        unlockedArr.push(key);
        if (isSkins) S.skin = key; else S.arena = key;
        sfx.buy();
        $('shop-msg').textContent = `🎉 ${item.name} açıldı ve kuşanıldı!`;
        persist();
        updateCoinUI();
        renderMenuSkins();
        renderShopList();
      }
    });
    list.appendChild(row);
  });
}

function saveCurrentScore() {
  if (scoreSavedThisRun || score <= 0) return;
  const nameInp = $('player-name');
  const rawName = (nameInp ? nameInp.value.trim() : '') || S.playerName || 'Oyuncu';
  const cleanName = rawName.slice(0, 12);
  S.playerName = cleanName;
  if (!Array.isArray(S.scoreboard)) S.scoreboard = [];
  S.scoreboard.push({
    name: cleanName,
    score,
    diff: MODE_LABELS[currentMode] || DIFF_LABELS[currentDiff] || 'Klasik',
    ts: Date.now()
  });
  S.scoreboard.sort((a, b) => b.score - a.score || b.ts - a.ts);
  S.scoreboard = S.scoreboard.slice(0, 15);
  scoreSavedThisRun = true;
  persist();
  sfx.buy();

  const btn = $('save-score-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '✓ Kaydedildi';
  }
}

function renderLeaderboard() {
  const list = $('lb-list');
  if (!list) return;
  const board = Array.isArray(S.scoreboard) ? S.scoreboard : [];
  if (!board.length) {
    list.innerHTML = `<div class="lb-empty">Henüz kayıtlı skor yok.<br>Oyun sonunda adını yazıp kaydet!</div>`;
    return;
  }
  list.innerHTML = board.map((row, idx) => {
    const rankIcon = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
    const safeName = String(row.name || 'Oyuncu').replace(/[<>&"]/g, '');
    return `
      <div class="lb-row ${idx === 0 ? 'top1' : ''}">
        <span class="lb-rank">${rankIcon}</span>
        <span class="lb-name">${safeName}</span>
        <span class="lb-diff">${row.diff || ''}</span>
        <span class="lb-score">${row.score}</span>
      </div>
    `;
  }).join('');
}

// ---------- Menü & Buton Olayları ----------
function goMenu() {
  state = STATE.MENU;
  setTurbo(false);
  resetMenuDemoSnake();
  obstacles = buildMazeObstacles();
  hide(hud); hide(gameoverScreen); hide(pauseScreen);
  hide(shopScreen); hide(lbScreen); hide(statsScreen);
  hide(mpScreen); hide(mpGameoverScreen);
  hide($('mp-opp-bar'));
  hide($('mp-spectate-bar'));
  $('best-score-display').textContent = `🏆 Rekor: ${S.bestScore}`;
  updateCoinUI();
  renderMenuSkins();
  show(menuScreen);
}

$('start-btn').addEventListener('click', () => { sfx.click(); startGame(); });
$('retry-btn').addEventListener('click', () => { sfx.click(); startGame(); });
$('home-btn').addEventListener('click', () => { sfx.click(); goMenu(); });
$('quit-btn').addEventListener('click', () => { sfx.click(); goMenu(); });
$('back-to-hub-btn').addEventListener('click', () => { sfx.click(); location.href = 'index.html'; });
$('resume-btn').addEventListener('click', () => { sfx.click(); togglePause(); });
$('pause-btn').addEventListener('click', () => togglePause());

if (soundBtn) {
  soundBtn.addEventListener('click', () => {
    getAC();
    audioSettings.soundOn = !audioSettings.soundOn;
    updateSoundBtns();
    persist();
    sfx.click();
  });
}
if (musicBtn) {
  musicBtn.addEventListener('click', () => {
    getAC();
    audioSettings.musicOn = !audioSettings.musicOn;
    updateSoundBtns();
    persist();
    sfx.click();
  });
}
if (volumeRange) {
  volumeRange.addEventListener('input', () => {
    getAC();
    audioSettings.volume = Number(volumeRange.value) / 100;
    updateSoundBtns();
    persist();
  });
}

// Mod & Hız sekmeleri
document.querySelectorAll('#mode-tabs .mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    sfx.click();
    document.querySelectorAll('#mode-tabs .mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    S.mode = btn.dataset.mode;
    currentMode = S.mode;
    obstacles = buildMazeObstacles();
    persist();
  });
});

document.querySelectorAll('#speed-tabs .speed-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    sfx.click();
    document.querySelectorAll('#speed-tabs .speed-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    S.difficulty = btn.dataset.diff;
    currentDiff = S.difficulty;
    persist();
  });
});

document.querySelectorAll('#menu-skin-row .skin-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.skin;
    if (!S.unlockedSkins.includes(key)) {
      openShop('skins', `🔒 ${SNAKE_SKINS[key].name} kostümünü ${SNAKE_SKINS[key].cost} 🪙 ile açabilirsin!`);
      return;
    }
    sfx.click();
    S.skin = key;
    persist();
    renderMenuSkins();
  });
});

if ($('shop-btn')) $('shop-btn').addEventListener('click', () => openShop('skins'));
if ($('menu-coin-pill')) $('menu-coin-pill').addEventListener('click', () => openShop('skins'));
if ($('shop-close-btn')) $('shop-close-btn').addEventListener('click', () => { sfx.click(); hide(shopScreen); });
document.querySelectorAll('.shop-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    sfx.click();
    currentShopTab = btn.dataset.tab;
    document.querySelectorAll('.shop-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderShopList();
  });
});

if ($('lb-btn')) {
  $('lb-btn').addEventListener('click', () => {
    sfx.click();
    renderLeaderboard();
    show(lbScreen);
  });
}
if ($('lb-close-btn')) $('lb-close-btn').addEventListener('click', () => { sfx.click(); hide(lbScreen); });
if ($('save-score-btn')) $('save-score-btn').addEventListener('click', saveCurrentScore);
if ($('player-name')) {
  $('player-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveCurrentScore();
  });
}

if ($('stats-btn')) {
  $('stats-btn').addEventListener('click', () => {
    sfx.click();
    $('st-best').textContent = S.bestScore;
    $('st-len').textContent = S.bestLen || 3;
    $('st-apples').textContent = S.apples || 0;
    $('st-games').textContent = S.games || 0;
    $('st-combo').textContent = S.bestCombo || 0;
    $('st-coins').textContent = S.totalCoins || S.coins || 0;
    show(statsScreen);
  });
}
if ($('stats-close-btn')) $('stats-close-btn').addEventListener('click', () => { sfx.click(); hide(statsScreen); });

// =====================================================
//            ÇEVRİMİÇİ DÜELLO (PeerJS) — Yılan
// Sıra numaralı kusursuz yem senkronu + ganimet patlaması!
// =====================================================
const MP = {
  peer: null, conn: null,
  isHost: false, connected: false,
  spectating: false,
  deathDelayFrames: 0,
  specEndFrames: 0,
  roomCode: '',
  myName: 'Sen',
  oppName: 'Rakip',
  oppSkin: 'cyber',
  oppDir: { x: -1, y: 0 },
  oppScore: 0, oppAlive: false,
  oppSnake: [],
  seed: 1, matchDiff: null, matchMode: null,
  rematchVotes: 0, oppRematch: false
};

const MP_PEER_OPTS = {
  debug: 1,
  pingInterval: 5000,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  }
};

let mpHostWaiting = false;
let mpReconnectTimer = null;
let mpIdRetryCount = 0;
let mpJoinTimer = null;
let mpJoinTries = 0;
const MP_MAX_JOIN_TRIES = 10;
let mpWakeLock = null;

function mpRequestWakeLock() {
  try {
    if (typeof navigator !== 'undefined' && navigator.wakeLock && navigator.wakeLock.request) {
      navigator.wakeLock.request('screen').then(lock => { mpWakeLock = lock; }).catch(() => {});
    }
  } catch (e) {}
}

function mpReleaseWakeLock() {
  try {
    if (mpWakeLock && mpWakeLock.release) mpWakeLock.release().catch(() => {});
  } catch (e) {}
  mpWakeLock = null;
}

function mpClearTimers() {
  if (mpReconnectTimer) { clearTimeout(mpReconnectTimer); mpReconnectTimer = null; }
  if (mpJoinTimer) { clearTimeout(mpJoinTimer); mpJoinTimer = null; }
}

function mpGetMyName() {
  const inp = $('mp-name-input');
  const val = (inp ? inp.value.trim() : '') || S.playerName || '';
  if (val) {
    S.playerName = val.slice(0, 12);
    persist();
    return S.playerName;
  }
  return MP.isHost ? 'Ev Sahibi' : 'Konuk';
}

function mpMakeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function mpCleanup() {
  mpHostWaiting = false;
  MP.spectating = false;
  MP.deathDelayFrames = 0;
  MP.specEndFrames = 0;
  hide($('mp-spectate-bar'));
  mpClearTimers();
  mpReleaseWakeLock();
  if (MP.conn) { try { MP.conn.close(); } catch (e) {} }
  if (MP.peer) { try { MP.peer.destroy(); } catch (e) {} }
  MP.conn = null; MP.peer = null;
  MP.connected = false; MP.isHost = false;
}

function mpSend(data) {
  if (MP.conn && MP.connected) { try { MP.conn.send(data); } catch (e) {} }
}

function mpGetInviteUrl() {
  try {
    if (typeof location !== 'undefined' && location.origin && location.pathname) {
      return location.origin + location.pathname + '?room=' + MP.roomCode;
    }
  } catch (e) {}
  return '?room=' + MP.roomCode;
}

function mpCopyText(txt) {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(txt).then(() => true).catch(() => false);
    }
  } catch (e) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = txt;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return Promise.resolve(true);
  } catch (e) {
    return Promise.resolve(false);
  }
}

function mpCopyCode() {
  if (!MP.roomCode) return;
  sfx.click();
  mpCopyText(MP.roomCode).then(() => {
    const btn = $('mp-copy-btn');
    if (btn) {
      btn.textContent = '✅ Kopyalandı!';
      setTimeout(() => { btn.textContent = '📋 Kodu Kopyala'; }, 1800);
    }
  });
}

function mpShareInvite() {
  if (!MP.roomCode) return;
  sfx.click();
  const url = mpGetInviteUrl();
  const text = `🐍 Yılan düellosuna gel! Oda Kodu: ${MP.roomCode}`;
  if (typeof navigator !== 'undefined' && navigator.share) {
    navigator.share({ title: 'Yılan Düellosu', text, url }).catch(() => {});
    return;
  }
  mpCopyText(text + ' ' + url).then(() => {
    const btn = $('mp-share-btn');
    if (btn) {
      btn.textContent = '✅ Link Kopyalandı!';
      setTimeout(() => { btn.textContent = '📤 Davet Gönder'; }, 1800);
    }
  });
}

function mpOpenUI() {
  sfx.click();
  show(mpScreen);
  hide(menuScreen);
  $('mp-error').textContent = '';
  show($('mp-btn-row'));
  hide($('mp-host-area'));
  hide($('mp-join-area'));
  $('mp-join-status').textContent = '';
  $('mp-code-input').value = '';
  if ($('mp-name-input')) $('mp-name-input').value = S.playerName || '';
}

function mpScheduleHostReconnect(delayMs, forceRecreate) {
  if (mpReconnectTimer) clearTimeout(mpReconnectTimer);
  mpReconnectTimer = setTimeout(() => {
    mpReconnectTimer = null;
    mpEnsureHostAlive(!!forceRecreate);
  }, delayMs);
}

function mpOpenHostPeer() {
  if (!mpHostWaiting || MP.connected || !MP.roomCode) return;
  if (MP.peer) {
    try { MP.peer.destroy(); } catch (e) {}
    MP.peer = null;
  }

  const peer = new Peer('snake-' + MP.roomCode, MP_PEER_OPTS);
  MP.peer = peer;

  peer.on('open', () => {
    if (MP.peer !== peer) return;
    mpIdRetryCount = 0;
    $('mp-error').textContent = '';
    $('mp-room-code').textContent = MP.roomCode;
    $('mp-wait-text').textContent = '✅ Oda aktif! Kodu gönderip bu ekranda bekle.';
  });

  peer.on('connection', conn => {
    if (MP.peer !== peer) return;
    if (MP.conn) { try { conn.close(); } catch (e) {} return; }
    mpHostWaiting = false;
    mpClearTimers();
    MP.conn = conn;
    setupConn();
  });

  peer.on('disconnected', () => {
    if (MP.peer !== peer || !mpHostWaiting || MP.connected) return;
    $('mp-error').textContent = '';
    $('mp-wait-text').textContent = '🔄 Arka plandan dönüldü, oda yenileniyor...';
    mpScheduleHostReconnect(500, false);
  });

  peer.on('error', err => {
    if (MP.peer !== peer) return;
    const type = (err && err.type) || '';
    if (mpHostWaiting && !MP.connected) {
      if (type === 'unavailable-id') {
        mpIdRetryCount++;
        if (mpIdRetryCount <= 6) {
          $('mp-error').textContent = '';
          $('mp-wait-text').textContent = '🔄 Oda kodu yeniden bağlanıyor...';
          mpScheduleHostReconnect(1700, true);
          return;
        }
        MP.roomCode = mpMakeRoomCode();
        mpIdRetryCount = 0;
        $('mp-room-code').textContent = MP.roomCode;
        mpScheduleHostReconnect(300, true);
        return;
      }
      if (['network', 'disconnected', 'server-error', 'socket-error', 'socket-closed', 'webrtc'].includes(type)) {
        $('mp-error').textContent = '';
        $('mp-wait-text').textContent = '⏳ Sekmeden çıkıldığı için bağlantı uyudu — ekranda kal, yenileniyor...';
        mpScheduleHostReconnect(1200, true);
        return;
      }
    }
    $('mp-error').textContent = 'Bağlantı hatası: ' + (type || 'bilinmiyor');
  });
}

function mpEnsureHostAlive(forceRecreate) {
  if (!mpHostWaiting || MP.connected || !MP.isHost || !MP.roomCode) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  mpRequestWakeLock();
  if (forceRecreate || !MP.peer || MP.peer.destroyed) {
    mpOpenHostPeer();
    return;
  }
  if (MP.peer.disconnected || MP.peer.open === false) {
    try {
      MP.peer.reconnect();
      mpScheduleHostReconnect(2200, true);
    } catch (e) {
      mpOpenHostPeer();
    }
  }
}

function mpHost() {
  sfx.click();
  mpCleanup();
  MP.myName = mpGetMyName();
  hide($('mp-btn-row'));
  show($('mp-host-area'));
  $('mp-error').textContent = '';
  mpHelloFromGuest = false;

  MP.roomCode = mpMakeRoomCode();
  MP.isHost = true;
  mpHostWaiting = true;
  mpIdRetryCount = 0;
  $('mp-room-code').textContent = MP.roomCode;
  $('mp-wait-text').textContent = 'Sunucuya bağlanılıyor...';

  mpRequestWakeLock();
  mpOpenHostPeer();
}

function mpJoin() {
  sfx.click();
  MP.myName = mpGetMyName();
  hide($('mp-btn-row'));
  show($('mp-join-area'));
  $('mp-error').textContent = '';
  $('mp-join-status').textContent = '';
}

function mpAttemptJoin() {
  if (MP.connected || MP.isHost || !MP.roomCode) return;
  mpClearTimers();
  if (MP.conn) { try { MP.conn.close(); } catch (e) {} MP.conn = null; }
  if (MP.peer) { try { MP.peer.destroy(); } catch (e) {} MP.peer = null; }

  mpJoinTries++;
  $('mp-error').textContent = '';
  $('mp-join-status').textContent = mpJoinTries === 1
    ? 'Bağlanılıyor...'
    : `⏳ Ev sahibinin oyuna dönmesi bekleniyor... (${mpJoinTries}/${MP_MAX_JOIN_TRIES})`;

  const peer = new Peer(null, MP_PEER_OPTS);
  MP.peer = peer;

  const retryOrFail = (reason) => {
    if (MP.peer !== peer || MP.connected) return;
    mpClearTimers();
    if (mpJoinTries < MP_MAX_JOIN_TRIES) {
      mpJoinTimer = setTimeout(mpAttemptJoin, 2000);
    } else {
      $('mp-join-status').textContent = reason || 'Oda bulunamadı! Ev sahibinin oyun ekranında açık olduğundan emin ol.';
    }
  };

  mpJoinTimer = setTimeout(() => {
    if (!MP.connected && MP.peer === peer) retryOrFail('Oda yanıt vermedi, kodu ve ev sahibinin ekranını kontrol et.');
  }, 3800);

  peer.on('open', () => {
    if (MP.peer !== peer || MP.connected) return;
    MP.conn = peer.connect('snake-' + MP.roomCode, { reliable: true });
    setupConn();
  });

  peer.on('error', err => {
    if (MP.peer !== peer || MP.connected) return;
    const type = (err && err.type) || '';
    if (type === 'peer-unavailable' || type === 'network' || type === 'disconnected' || type === 'socket-error') {
      retryOrFail('Oda bulunamadı, kodu kontrol et!');
    } else {
      mpClearTimers();
      $('mp-join-status').textContent = 'Hata: ' + (type || 'bilinmiyor');
    }
  });
}

function mpJoinConfirm() {
  const code = $('mp-code-input').value.trim().toUpperCase();
  if (code.length !== 5) { $('mp-join-status').textContent = '5 haneli kod gir!'; return; }
  sfx.click();
  mpCleanup();
  MP.myName = mpGetMyName();
  MP.roomCode = code;
  MP.isHost = false;
  mpJoinTries = 0;
  mpAttemptJoin();
}

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && mpHostWaiting && !MP.connected) {
      mpEnsureHostAlive(false);
    }
  });
}
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('focus', () => {
    if (mpHostWaiting && !MP.connected) mpEnsureHostAlive(false);
  });
  window.addEventListener('online', () => {
    if (mpHostWaiting && !MP.connected) mpEnsureHostAlive(true);
  });
}

let mpHelloFromGuest = false;

function spawnOpponentLoot() {
  if (!MP.oppSnake || !MP.oppSnake.length) return;
  for (let i = 0; i < MP.oppSnake.length; i += 2) {
    const [lx, ly] = MP.oppSnake[i];
    if (!isObstacle(lx, ly)) {
      lootApples.push({ x: lx, y: ly });
      spawnBurst(lx, ly, '#FFD700', '#40C4FF', 6);
    }
  }
  popups.push({ x: W / 2, y: boardY + 30, txt: `💥 ${MP.oppName} elendi! Ganimetleri topla!`, color: '#FFD700', life: 60 });
}

function setupConn() {
  MP.conn.on('open', () => {
    mpClearTimers();
    mpHostWaiting = false;
    MP.connected = true;
    mpSend({ t: 'hello', name: MP.myName, skin: S.skin });
    if (MP.isHost) {
      setTimeout(() => {
        if (MP.connected && !mpHelloFromGuest) {
          mpHelloFromGuest = true;
          mpBeginMatch();
        }
      }, 3000);
    }
  });

  MP.conn.on('data', data => {
    if (!data || !data.t) return;
    switch (data.t) {
      case 'hello':
        if (data.name) MP.oppName = String(data.name).slice(0, 12);
        if (data.skin) MP.oppSkin = data.skin;
        if (MP.isHost && !mpHelloFromGuest) {
          mpHelloFromGuest = true;
          mpBeginMatch();
        }
        break;
      case 'match':
        if (!MP.isHost) {
          MP.connected = true;
          MP.seed = data.seed;
          MP.matchDiff = data.diff || S.difficulty;
          MP.matchMode = data.mode || S.mode;
          if (data.name) MP.oppName = String(data.name).slice(0, 12);
          if (data.skin) MP.oppSkin = data.skin;
          mpBeginMatch();
        }
        break;
      case 'snake':
        storeOppFrame(data.s);
        if (data.d) MP.oppDir = data.d;
        MP.oppScore = data.sc;
        if (MP.spectating && data.s && data.s.length) {
          const [hx, hy] = data.s[0];
          for (let i = lootApples.length - 1; i >= 0; i--) {
            if (lootApples[i].x === hx && lootApples[i].y === hy) {
              spawnBurst(hx, hy, '#FFD700', '#40C4FF', 9);
              sfx.eat();
              lootApples.splice(i, 1);
            }
          }
          mpUpdateSpectateBar();
        }
        if (MP.oppAlive && !data.a && !MP.spectating) spawnOpponentLoot();
        MP.oppAlive = data.a;
        mpUpdateLiveBar();
        break;
      case 'eat':
        if (typeof data.seq === 'number' && data.seq >= foodSeq) {
          if (MP.spectating && food) {
            spawnBurst(food.x, food.y, 'rgba(255,80,80,0.95)', 'rgba(255,215,0,0.9)', 12);
            sfx.eat();
          }
          advanceFoodToSeq(data.seq + 1);
          if (MP.isHost && foodSeq > 0 && foodSeq % 3 === 0 && !bonusItem) {
            maybeSpawnBonus();
            if (bonusItem) mpSend({ t: 'bonus_spawn', item: bonusItem });
          }
        }
        break;
      case 'bonus_spawn':
        if (data.item && typeof data.item.x === 'number' && typeof data.item.y === 'number') {
          bonusItem = { ...data.item };
        }
        break;
      case 'bonus_eat':
        if (MP.spectating && bonusItem) {
          spawnBurst(bonusItem.x, bonusItem.y, '#FFD700', '#ffffff', 14);
          sfx.bonus();
        }
        bonusItem = null;
        break;
      case 'gameover':
        if (MP.oppAlive) {
          if (MP.spectating) {
            if (MP.oppSnake && MP.oppSnake.length) {
              const [ox, oy] = MP.oppSnake[0];
              spawnBurst(ox, oy, '#FF5252', '#ffffff', 18);
            }
            sfx.die();
            shakeT = 0.65;
            flashAlpha = 0.35;
          } else {
            spawnOpponentLoot();
          }
        }
        MP.oppScore = data.s;
        MP.oppAlive = false;
        mpUpdateLiveBar();
        mpUpdateSpectateBar();
        if (MP.spectating) {
          MP.specEndFrames = 36;
        } else if (state === STATE.GAMEOVER && MP.connected) {
          MP.deathDelayFrames = 0;
          mpFinishDuel();
        }
        break;
      case 'rematch':
        MP.oppRematch = true;
        if (MP.isHost && MP.rematchVotes > 0) mpBeginMatch();
        break;
    }
  });

  MP.conn.on('close', () => {
    MP.connected = false;
    if (state !== STATE.MENU) {
      mpCleanup();
      goMenu();
    }
  });
}

function mpShowSpectateBar() {
  let bar = $('mp-spectate-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'mp-spectate-bar';
    bar.className = 'mp-spectate-bar';
    bar.innerHTML = `
      <div class="mp-spec-left">
        <span class="mp-live-dot"></span>
        <span id="mp-spec-title">Canlı İzleniyor</span>
      </div>
      <span class="mp-spec-scores" id="mp-spec-scores">0 - 0</span>
      <button type="button" class="mp-spec-exit" id="mp-spec-exit-btn">🏠 Çık</button>
    `;
    document.getElementById('game-wrapper').appendChild(bar);
    const exitBtn = $('mp-spec-exit-btn');
    if (exitBtn) exitBtn.addEventListener('click', mpLeave);
  }
  mpUpdateSpectateBar();
  show(bar);
}

function mpUpdateSpectateBar() {
  const t = $('mp-spec-title');
  const s = $('mp-spec-scores');
  if (t) t.textContent = MP.oppAlive ? `🎥 ${MP.oppName} oynuyor` : `💥 ${MP.oppName} elendi!`;
  if (s) s.textContent = `Sen: ${score} · O: ${MP.oppScore}`;
}

function mpDrawSpectatorTopBanner() {
  ctx.save();
  const txt = `🔴 CANLI İZLENİYOR — ${MP.oppName.toUpperCase()} (${MP.oppScore})`;
  ctx.font = '800 13px "Segoe UI", Arial';
  const tw = Math.max(190, ctx.measureText(txt).width + 28);
  const bx = (W - tw) / 2, by = 14, bh = 30;
  ctx.fillStyle = 'rgba(10, 18, 34, 0.78)';
  ctx.strokeStyle = 'rgba(255, 82, 82, 0.65)';
  ctx.lineWidth = 1.5;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(bx, by, tw, bh, 15);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(bx, by, tw, bh);
    ctx.strokeRect(bx, by, tw, bh);
  }
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(txt, W / 2, by + bh / 2 + 0.5);
  ctx.restore();
}

function mpStartMatchUI() {
  hide($('mp-spectate-bar'));
  let bar = $('mp-opp-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'mp-opp-bar';
    bar.className = 'mp-opp-bar';
    document.getElementById('game-wrapper').appendChild(bar);
  }
  bar.innerHTML = `🐍 <span id="mp-opp-bar-name"></span>: <span class="opp-score" id="mp-opp-live">0</span>`;
  $('mp-opp-bar-name').textContent = MP.oppName;
  show(bar);
}

function mpUpdateLiveBar() {
  const el = $('mp-opp-live');
  if (el) el.textContent = MP.oppScore + (MP.oppAlive ? '' : ' ☠');
}

let mpCountdown = 0;

function mpBeginMatch() {
  MP.spectating = false;
  MP.deathDelayFrames = 0;
  MP.specEndFrames = 0;
  hide($('mp-spectate-bar'));
  if (MP.isHost) {
    MP.seed = Math.floor(Math.random() * 1e9);
    MP.matchDiff = S.difficulty;
    MP.matchMode = S.mode;
    mpSend({ t: 'match', seed: MP.seed, diff: S.difficulty, mode: S.mode, name: MP.myName, skin: S.skin });
  }
  startGame(true);
  mpStartMatchUI();
  mpCountdown = 3 * 60;
  MP.oppScore = 0;
  MP.oppAlive = true;
  MP.oppSnake = [];
  oppPrev = null;
  MP.oppRematch = false;
  MP.rematchVotes = 0;
  mpUpdateLiveBar();
}

function mpCountdownTick() {
  if (mpCountdown <= 0) return;
  mpCountdown--;
  if (mpCountdown === 0) beginPlay();
}

function mpDrawCountdown() {
  if (mpCountdown <= 0) return;
  const n = Math.ceil(mpCountdown / 60);
  const phase = (mpCountdown % 60) / 60;
  ctx.save();
  ctx.globalAlpha = 0.4 + 0.6 * phase;
  ctx.translate(W / 2, H * 0.32);
  ctx.scale(0.8 + 0.5 * phase, 0.8 + 0.5 * phase);
  ctx.font = '900 90px "Segoe UI", Arial';
  ctx.textAlign = 'center';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.strokeText(String(n), 0, 0);
  ctx.fillStyle = '#ffd700';
  ctx.fillText(String(n), 0, 0);
  ctx.restore();
  ctx.font = '800 17px "Segoe UI", Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText('Düello eşzamanlı başlayacak!', W / 2, H * 0.32 + 34);
  ctx.textAlign = 'left';
}

function mpOnDeath() {
  MP.deathDelayFrames = 0;
  if (!MP.connected) return;
  mpSend({ t: 'gameover', s: score });
  $('mp-final-me').textContent = score;
  $('mp-final-opp').textContent = MP.oppScore;
  $('mp-me-label').textContent = MP.myName || 'Sen';
  $('mp-opp-label').textContent = MP.oppName || 'Rakip';

  if (MP.oppAlive) {
    // Kendi yılanımızın bıraktığı ganimet elmaları sahnede göster ki rakibin toplamasını da canlı izleyelim!
    for (let i = 0; i < snake.length; i += 2) {
      const seg = snake[i];
      if (!isObstacle(seg.x, seg.y)) {
        lootApples.push({ x: seg.x, y: seg.y });
      }
    }
    MP.spectating = true;
    MP.specEndFrames = 0;
    hide(gameoverScreen);
    hide(mpGameoverScreen);
    hide(hud);
    hide($('mp-opp-bar'));
    mpShowSpectateBar();
    popups.push({ x: W / 2, y: boardY + 34, txt: `🎥 ${MP.oppName} canlı izleniyor!`, color: '#00E5FF', life: 60 });
  } else {
    mpFinishDuel();
  }
}

function mpFinishDuel() {
  MP.spectating = false;
  MP.deathDelayFrames = 0;
  MP.specEndFrames = 0;
  hide($('mp-spectate-bar'));
  $('mp-final-me').textContent = score;
  $('mp-final-opp').textContent = MP.oppScore;
  $('mp-me-label').textContent = MP.myName || 'Sen';
  $('mp-opp-label').textContent = MP.oppName || 'Rakip';
  let txt;
  if (score > MP.oppScore) txt = '🏆 KAZANDIN!';
  else if (score < MP.oppScore) txt = '💀 KAYBETTİN...';
  else txt = '🤝 BERABERE!';
  $('mp-result-text').textContent = txt;
  hide(gameoverScreen);
  show(mpGameoverScreen);
  hide(hud);
}

function mpLeave() {
  sfx.click();
  mpCleanup();
  goMenu();
}

function mpSendSnakeNow() {
  if (!MP.connected) return;
  mpSend({
    t: 'snake',
    s: snake.map(seg => [seg.x, seg.y]),
    d: dir,
    sc: score,
    a: state === STATE.PLAYING || state === STATE.READY
  });
}

let mpSendAcc = 0;
function mpTick() {
  if (!MP.connected) return;
  if (MP.spectating) {
    mpUpdateSpectateBar();
    return;
  }
  mpSendAcc++;
  if (mpSendAcc % 6 !== 0) return;
  mpSendSnakeNow();
}

let oppPrev = null;
let oppAnim = 1;

function storeOppFrame(segs) {
  oppPrev = MP.oppSnake;
  MP.oppSnake = segs;
  oppAnim = 0;
}

function oppDisplayPts() {
  const cur = MP.oppSnake || [];
  const prev = oppPrev || cur;
  const alpha = Math.min(1, oppAnim);
  const pts = [];
  for (let i = 0; i < cur.length; i++) {
    const c = cur[i];
    const p = prev[i] || c;
    const ref = (i === 0 && prev.length && cur.length > prev.length) ? prev[0] : p;
    const jump = Math.abs(ref[0] - c[0]) > 1 || Math.abs(ref[1] - c[1]) > 1;
    const ix = jump ? c[0] : c[0] + (ref[0] - c[0]) * (1 - alpha);
    const iy = jump ? c[1] : c[1] + (ref[1] - c[1]) * (1 - alpha);
    pts.push({ x: boardX + (ix + 0.5) * cell, y: boardY + (iy + 0.5) * cell });
  }
  return pts;
}

$('mp-btn').addEventListener('click', mpOpenUI);
$('mp-host-btn').addEventListener('click', mpHost);
$('mp-join-btn').addEventListener('click', mpJoin);
$('mp-join-confirm').addEventListener('click', mpJoinConfirm);
if ($('mp-copy-btn')) $('mp-copy-btn').addEventListener('click', mpCopyCode);
if ($('mp-share-btn')) $('mp-share-btn').addEventListener('click', mpShareInvite);
$('mp-code-input').addEventListener('keydown', e => { if (e.key === 'Enter') mpJoinConfirm(); });
$('mp-quit-btn').addEventListener('click', () => {
  sfx.click();
  mpCleanup();
  goMenu();
});
$('mp-rematch-btn').addEventListener('click', () => {
  sfx.click();
  if (!MP.connected) { mpLeave(); return; }
  MP.rematchVotes = 1;
  mpSend({ t: 'rematch' });
  if (MP.isHost && MP.oppRematch) mpBeginMatch();
  $('mp-result-text').textContent = MP.isHost
    ? (MP.oppRematch ? 'Başlıyor!' : 'Rakibin onayı bekleniyor...')
    : 'Host başlatacak — onay bekleniyor...';
});
$('mp-leave-btn').addEventListener('click', mpLeave);

// ---------- Başlat ----------
function init() {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  currentMode = S.mode;
  currentDiff = S.difficulty;
  obstacles = buildMazeObstacles();
  resetMenuDemoSnake();

  document.querySelectorAll('#mode-tabs .mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === S.mode);
  });
  document.querySelectorAll('#speed-tabs .speed-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.diff === S.difficulty);
  });

  updateSoundBtns();
  updateCoinUI();
  renderMenuSkins();
  $('best-score-display').textContent = `🏆 Rekor: ${S.bestScore}`;
  initBgStars();
  ensureMusicLoop();

  // Davet linkinden (?room=XXXXX) gelindiyse otomatik odaya katıl!
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
        $('mp-code-input').value = autoCode;
        mpJoinConfirm();
      }
    }
  } catch (e) {}

  requestAnimationFrame(loop);
}

init();
