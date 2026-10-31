"use strict";

/* =====================================================
   FLAPPY KUŞ v2 — Oyun Salonu Gelişmiş Sürüm
   - 6 Güçlendirme (Kalkan, Yavaşlat, 2x, Küçülme, Mıknatıs, Hayalet Faz)
   - Altın Toplama, 8 Kostüm & 4 Uçuş İzi Mağazası
   - Dinamik Borular (Normal, Hareketli, Açılıp-Kapanan)
   - Mükemmel Geçiş & Kombo Sistemi
   - 4 Biyom & Hava Durumu (Gündüz, Gün Batımı, Gece, Fırtına/Kar)
   - Hayalet Rekor Kuşu (Ghost Replay) & Skor Tablosu
   - Web Audio Chiptune Müzik & Ses Seviyesi Kontrolü
   - Ekran Bağımsız Adil Çevrimiçi Düello + İnterpolasyon (PeerJS)
   ===================================================== */

// ---------- Canvas kurulumu ----------
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

let W = 420, H = 700, DPR = 1;
const VIRT_W = 420, VIRT_PLAY_H = 623; // 700 * 0.89

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = rect.width || 420;
  H = rect.height || 700;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

function groundH() { return H * 0.11; }
function playH() { return H - groundH(); }
function vScale() { return playH() / VIRT_PLAY_H; }
function hScale() { return W / VIRT_W; }

// ---------- DOM referansları ----------
const $ = id => document.getElementById(id);
const hud = $('hud'), scoreDisplay = $('score-display'), powerBadges = $('power-badges');
const hudCoins = $('hud-coins'), hudCombo = $('hud-combo');
const menuScreen = $('menu-screen'), gameoverScreen = $('gameover-screen');
const pauseScreen = $('pause-screen'), statsScreen = $('stats-screen');
const shopScreen = $('shop-screen'), lbScreen = $('leaderboard-screen');
const mpScreen = $('mp-screen'), mpGameoverScreen = $('mp-gameover-screen');
const tapHint = $('tap-hint');
const medalDisplay = $('medal-display'), medalIcon = $('medal-icon'), medalText = $('medal-text');
const newRecord = $('new-record');
const soundBtn = $('sound-btn'), musicBtn = $('music-btn'), pauseBtn = $('pause-btn');
const volumeRange = $('volume-range'), volumeIcon = $('volume-icon');

function show(el) { if (el) el.classList.remove('hidden'); }
function hide(el) { if (el) el.classList.add('hidden'); }

// ---------- Zorluk seviyeleri (VIRT_W x VIRT_PLAY_H bazlı) ----------
const DIFFICULTIES = {
  easy:   { label: 'Kolay',  gravity: 0.20, flapSpeed: -5.2, pipeGap: 192, pipeSpeed: 1.85, pipeInterval: 135, accSpeed: 0.00004, accGap: 0.18 },
  normal: { label: 'Normal', gravity: 0.24, flapSpeed: -5.8, pipeGap: 160, pipeSpeed: 2.30, pipeInterval: 112, accSpeed: 0.00007, accGap: 0.28 },
  hard:   { label: 'Zor',    gravity: 0.30, flapSpeed: -6.5, pipeGap: 130, pipeSpeed: 2.95, pipeInterval: 92,  accSpeed: 0.00010, accGap: 0.38 }
};
let currentDiff = 'normal';

// ---------- Kuş Kostümleri (SKINS) ----------
const SKINS = {
  yellow:  { name: 'Sarı Kuş',     desc: 'Klasik neşeli kanarya',     cost: 0,  emoji: '🐤', body: '#FFD700', belly: '#FFF3C4', wing: '#FFAA00', outline: '#8a5a00', wingOut: '#b3541e', beak: '#FF7043', beakOut: '#c0392b' },
  red:     { name: 'Kızıl Şahin',  desc: 'Hızlı ve cesur',            cost: 0,  emoji: '🐦', body: '#FF5252', belly: '#FFD9D0', wing: '#E53935', outline: '#7a1512', wingOut: '#7a1010', beak: '#FFB300', beakOut: '#b26a00' },
  blue:    { name: 'Buz Mavisi',   desc: 'Gökyüzünün hakimi',         cost: 0,  emoji: '💎', body: '#40C4FF', belly: '#D9F4FF', wing: '#0288D1', outline: '#0b4a76', wingOut: '#094a76', beak: '#FFB300', beakOut: '#b26a00' },
  purple:  { name: 'Kristal Kuş',  desc: 'Parlak ametist tüyler',     cost: 0,  emoji: '🔮', body: '#B388FF', belly: '#EDE0FF', wing: '#7C4DFF', outline: '#45229e', wingOut: '#401a92', beak: '#FFD54F', beakOut: '#a8841b' },
  phoenix: { name: 'Ateş Kuşu',    desc: 'Alev sorguçlu efsane',      cost: 25, emoji: '🔥', body: '#FF6D00', belly: '#FFF59D', wing: '#FF3D00', outline: '#7f1d00', wingOut: '#9a1b00', beak: '#FFE082', beakOut: '#bf6000', special: 'phoenix' },
  robot:   { name: 'Sibernetik',   desc: 'Lazer vizörlü titanyum',    cost: 45, emoji: '🤖', body: '#90A4AE', belly: '#ECEFF1', wing: '#546E7A', outline: '#263238', wingOut: '#1c262b', beak: '#00E5FF', beakOut: '#006064', special: 'robot' },
  ghost:   { name: 'Hayalet Kuş',  desc: 'Mistik ruh parıltısı',      cost: 65, emoji: '👻', body: '#80CBC4', belly: '#E0F2F1', wing: '#4DB6AC', outline: '#004D40', wingOut: '#00695C', beak: '#B2EBF2', beakOut: '#00838F', special: 'ghost' },
  king:    { name: 'Kral Kuş',     desc: 'Altın taçlı ve pelerinli',  cost: 90, emoji: '👑', body: '#FFD54F', belly: '#FFFDE7', wing: '#FFA000', outline: '#6d4c00', wingOut: '#8d5600', beak: '#FF5722', beakOut: '#a82800', special: 'king' }
};

// ---------- Uçuş İzleri (TRAILS) ----------
const TRAILS = {
  none:    { name: 'İz Yok',       desc: 'Sade klasik uçuş',          cost: 0,  emoji: '💨', color: 'rgba(255,255,255,0.2)' },
  star:    { name: 'Yıldız Tozu',  desc: 'Parıldayan altın yıldızlar', cost: 20, emoji: '✨', color: '#FFE082' },
  fire:    { name: 'Alev İzi',     desc: 'Yakıcı kor kıvılcımları',   cost: 40, emoji: '🔥', color: '#FF6D00' },
  rainbow: { name: 'Gökkuşağı',    desc: 'Renk değiştiren büyülü iz', cost: 65, emoji: '🌈', color: '#E040FB' }
};

// ---------- Güçlendirme Tanımları ----------
const POWER_TYPES = {
  shield: { icon: '🛡️', label: 'Kalkan',   color: '#29B6F6', glow: 'rgba(41,182,246,0.55)' },
  slow:   { icon: '⏳', label: 'Yavaş',    color: '#AB47BC', glow: 'rgba(171,71,188,0.55)' },
  x2:     { icon: '2x', label: '2x Puan', color: '#00E676', glow: 'rgba(0,230,118,0.55)' },
  tiny:   { icon: '🧪', label: 'Küçük',    color: '#FF4081', glow: 'rgba(255,64,129,0.55)' },
  magnet: { icon: '🧲', label: 'Mıknatıs', color: '#FF7043', glow: 'rgba(255,112,67,0.55)' },
  phase:  { icon: '👻', label: 'Hayalet',  color: '#1DE9B6', glow: 'rgba(29,233,182,0.55)' }
};
const POWER_KEYS = Object.keys(POWER_TYPES);

// ---------- Kalıcı veriler (Diğer oyunların verisini EZMEZ!) ----------
const STORAGE_KEY = 'oyun-salonu-v2';

function defaultSaved() {
  return {
    soundOn: true,
    musicOn: true,
    volume: 0.7,
    flappy: {
      difficulty: 'normal',
      skin: 'yellow',
      trail: 'none',
      unlockedSkins: ['yellow', 'red', 'blue', 'purple'],
      unlockedTrails: ['none'],
      coins: 0,
      totalCoins: 0,
      bestScore: 0,
      bestCombo: 0,
      games: 0,
      totalTime: 0,
      recentScores: [],
      scoreboard: [],
      playerName: '',
      ghostOn: true,
      ghostScore: 0,
      ghostSkin: 'yellow',
      ghostRun: []
    }
  };
}

function migrateOld(d, old) {
  const f = d.flappy;
  if (typeof old.bestScore === 'number') f.bestScore = old.bestScore;
  if (typeof old.games === 'number') f.games = old.games;
  if (typeof old.totalTime === 'number') f.totalTime = old.totalTime;
  if (Array.isArray(old.recentScores)) f.recentScores = old.recentScores;
  if (typeof old.difficulty === 'string' && DIFFICULTIES[old.difficulty]) f.difficulty = old.difficulty;
  if (typeof old.soundOn === 'boolean') d.soundOn = old.soundOn;
}

function loadSaved() {
  const d = defaultSaved();
  try {
    const rawOld = localStorage.getItem('satican-flappy-v1');
    if (rawOld) migrateOld(d, JSON.parse(rawOld));
  } catch (e) {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (typeof s.soundOn === 'boolean') d.soundOn = s.soundOn;
      if (typeof s.musicOn === 'boolean') d.musicOn = s.musicOn;
      if (typeof s.volume === 'number') d.volume = Math.max(0, Math.min(1, s.volume));
      if (s.flappy && typeof s.flappy === 'object') {
        Object.keys(d.flappy).forEach(k => {
          if (s.flappy[k] !== undefined) d.flappy[k] = s.flappy[k];
        });
      }
    }
  } catch (e) {}
  if (!Array.isArray(d.flappy.unlockedSkins) || !d.flappy.unlockedSkins.length) {
    d.flappy.unlockedSkins = ['yellow', 'red', 'blue', 'purple'];
  }
  if (!Array.isArray(d.flappy.unlockedTrails) || !d.flappy.unlockedTrails.length) {
    d.flappy.unlockedTrails = ['none'];
  }
  if (!SKINS[d.flappy.skin] || !d.flappy.unlockedSkins.includes(d.flappy.skin)) {
    d.flappy.skin = 'yellow';
  }
  if (!TRAILS[d.flappy.trail] || !d.flappy.unlockedTrails.includes(d.flappy.trail)) {
    d.flappy.trail = 'none';
  }
  return d;
}

let saved = loadSaved();
const F = saved.flappy;

function persist() {
  try {
    let root = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) root = JSON.parse(raw) || {};
    } catch (e) {}
    root.soundOn = saved.soundOn;
    root.musicOn = saved.musicOn;
    root.volume = saved.volume;
    root.flappy = saved.flappy;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
  } catch (e) {}
}

function skinColors(key) { return SKINS[key || F.skin] || SKINS.yellow; }

// ---------- Ses Motoru & Chiptune Müzik (Web Audio API) ----------
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    try { audioCtx.resume(); } catch (e) {}
  }
  return audioCtx;
}

function beep(freq, duration, type = 'square', volume = 0.15, slide = 0) {
  if (!saved.soundOn || saved.volume <= 0.005) return;
  const ac = getAudioCtx();
  if (!ac) return;
  const vol = Math.max(0.001, volume * saved.volume);
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ac.currentTime + duration);
  gain.gain.setValueAtTime(vol, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0008, ac.currentTime + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + duration);
}

const sfx = {
  flap:        () => beep(520, 0.09, 'sine', 0.17, 180),
  score:       () => { beep(880, 0.08, 'square', 0.11); setTimeout(() => beep(1174, 0.11, 'square', 0.11), 75); },
  perfect:     () => { [987, 1318, 1568].forEach((f, i) => setTimeout(() => beep(f, 0.10, 'triangle', 0.14), i * 55)); },
  coin:        () => { beep(1046, 0.06, 'sine', 0.15); setTimeout(() => beep(1568, 0.12, 'sine', 0.15), 55); },
  powerup:     () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.08, 'triangle', 0.14), i * 45)); },
  shieldBreak: () => { beep(340, 0.18, 'sawtooth', 0.2, -160); setTimeout(() => beep(520, 0.14, 'triangle', 0.15, 120), 60); },
  hit:         () => beep(180, 0.25, 'sawtooth', 0.24, -110),
  die:         () => { beep(300, 0.28, 'triangle', 0.2, -210); setTimeout(() => beep(150, 0.38, 'triangle', 0.2, -90), 190); },
  medal:       () => { [660, 880, 1100, 1320].forEach((f, i) => setTimeout(() => beep(f, 0.14, 'sine', 0.14), i * 105)); },
  buy:         () => { [659, 880, 1318].forEach((f, i) => setTimeout(() => beep(f, 0.11, 'sine', 0.16), i * 70)); },
  thunder:     () => beep(95, 0.35, 'sawtooth', 0.10, -45),
  click:       () => beep(700, 0.05, 'sine', 0.10)
};

// Hafif Chiptune Arka Plan Müziği
const MELODY_PLAY = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880.00, 698.46, 523.25, 659.25, 783.99, 1046.5, 880.00, 783.99, 659.25, 587.33];
const BASS_PLAY   = [261.63, 261.63, 196.00, 196.00, 293.66, 293.66, 220.00, 220.00, 261.63, 261.63, 329.63, 329.63, 349.23, 293.66, 196.00, 246.94];
const MELODY_MENU = [523.25, 0, 659.25, 0, 783.99, 0, 659.25, 0, 587.33, 0, 698.46, 0, 659.25, 0, 523.25, 0];

let musicStep = 0;
let musicTimer = null;

function playMusicNote(freq, dur, type, baseVol) {
  if (!freq || !audioCtx || audioCtx.state !== 'running') return;
  const vol = baseVol * saved.volume;
  if (vol <= 0.001) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0005, audioCtx.currentTime + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + dur);
}

function tickMusic() {
  if (!saved.musicOn || saved.volume <= 0.005) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  if (!audioCtx || audioCtx.state !== 'running') return;
  if (state === STATE.PAUSED || state === STATE.DYING || state === STATE.GAMEOVER) return;

  const idx = musicStep % 16;
  musicStep++;
  if (state === STATE.PLAYING || state === STATE.READY) {
    playMusicNote(MELODY_PLAY[idx], 0.15, 'triangle', 0.045);
    if (idx % 2 === 0) playMusicNote(BASS_PLAY[idx], 0.26, 'sine', 0.04);
  } else {
    if (MELODY_MENU[idx]) playMusicNote(MELODY_MENU[idx], 0.22, 'sine', 0.03);
  }
}

function ensureMusicLoop() {
  if (musicTimer) clearInterval(musicTimer);
  if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
    musicTimer = setInterval(tickMusic, 195);
  }
}

// ---------- Oyun Durumu ----------
const STATE = { READY: 1, PLAYING: 2, DYING: 3, GAMEOVER: 4, PAUSED: 5, MENU: 6, MP: 7 };
let state = STATE.MENU;

const bird = {
  x: 0, y: 0, vy: 0, r: 14,
  rot: 0, wing: 0, wingDir: 1,
  sx: 1, sy: 1 // squash & stretch
};

let pipes = [];
let coins = [];       // toplanabilir altınlar
let powers = [];      // güçlendirme küreleri
let popups = [];      // "+2", "MÜKEMMEL!" yüzen yazılar
let particles = [];   // kıvılcım ve iz partikülleri
let feathers = [];    // çarpma tüyleri
let shockRings = [];  // mükemmel geçiş / kalkan halkaları

let score = 0;
let pipesSpawned = 0;
let runCoins = 0;
let combo = 0;
let scoreSavedThisRun = false;
let frames = 0;
let runFrames = 0;
let pipeTimer = 0;
let playStartMs = 0;
let flashAlpha = 0;
let lightningAlpha = 0;
let groundX = 0;
let biomePos = 0;     // 0=gündüz, 1=günbatımı, 2=gece, 3=fırtına/kar

// Güçlendirme sayaçları
let shieldActive = false;
let invulnFrames = 0;
let slowFrames = 0;
let x2Left = 0;
let tinyFrames = 0;
let magnetFrames = 0;
let phaseFrames = 0;
let lastBadgeSig = '';

// Hayalet Rekor Kuşu (Ghost Replay)
let currentRunGhost = [];

// Görsel atmosfer nesneleri
let shakeT = 0;
let clouds = [];
let stars = [];
let hills = [];
let trees = [];
let shootingStars = [];
let weatherDrops = [];

// ---------- UI Güncelleyiciler ----------
function updateSoundBtns() {
  soundBtn.textContent = saved.soundOn ? '🔊 Efekt: Açık' : '🔇 Efekt: Kapalı';
  musicBtn.textContent = saved.musicOn ? '🎵 Müzik: Açık' : '🎵 Müzik: Kapalı';
  if (volumeRange) volumeRange.value = Math.round(saved.volume * 100);
  if (volumeIcon) {
    if (saved.volume <= 0.01) volumeIcon.textContent = '🔇';
    else if (saved.volume < 0.35) volumeIcon.textContent = '🔈';
    else if (saved.volume < 0.7) volumeIcon.textContent = '🔉';
    else volumeIcon.textContent = '🔊';
  }
}

function updateCoinUI() {
  if ($('menu-coins')) $('menu-coins').textContent = F.coins;
  if ($('shop-coins')) $('shop-coins').textContent = F.coins;
  if (hudCoins) hudCoins.textContent = runCoins;
}

function renderMenuSkins() {
  document.querySelectorAll('#menu-skin-row .skin-btn').forEach(btn => {
    const key = btn.dataset.skin;
    const s = SKINS[key];
    if (!s) return;
    const unlocked = F.unlockedSkins.includes(key);
    btn.style.background = s.body;
    btn.classList.toggle('locked', !unlocked);
    btn.classList.toggle('active', F.skin === key);
    btn.title = unlocked ? s.name : `${s.name} (${s.cost} 🪙 - Mağazada)`;
  });
}

function updatePowerBadges() {
  const items = [];
  if (shieldActive) items.push(`🛡️ Kalkan`);
  if (phaseFrames > 0) items.push(`👻 ${Math.ceil(phaseFrames / 60)}s`);
  if (slowFrames > 0) items.push(`⏳ ${Math.ceil(slowFrames / 60)}s`);
  if (x2Left > 0) items.push(`2x (${x2Left})`);
  if (tinyFrames > 0) items.push(`🧪 ${Math.ceil(tinyFrames / 60)}s`);
  if (magnetFrames > 0) items.push(`🧲 ${Math.ceil(magnetFrames / 60)}s`);

  const sig = items.join('|');
  if (sig === lastBadgeSig) return;
  lastBadgeSig = sig;
  powerBadges.innerHTML = items.map(t => `<span class="power-badge">${t}</span>`).join('');
}

function updateComboUI() {
  if (!hudCombo) return;
  if (combo >= 2) {
    hudCombo.textContent = `🔥 Kombo x${combo}`;
    show(hudCombo);
  } else {
    hide(hudCombo);
  }
}

function medalFor(s) {
  if (s >= 50) return { icon: '👑', text: 'EFSANE' };
  if (s >= 35) return { icon: '💎', text: 'PLATİN' };
  if (s >= 22) return { icon: '🥇', text: 'ALTIN' };
  if (s >= 12) return { icon: '🥈', text: 'GÜMÜŞ' };
  if (s >= 6)  return { icon: '🥉', text: 'BRONZ' };
  return null;
}

// ---------- Dünya Nesnelerini Doldur ----------
function initWorld() {
  clouds = [];
  for (let i = 0; i < 6; i++) {
    clouds.push({
      x: Math.random() * W,
      y: 35 + Math.random() * (H * 0.34),
      s: 0.5 + Math.random() * 0.7,
      sp: 0.15 + Math.random() * 0.35
    });
  }
  stars = [];
  for (let i = 0; i < 48; i++) {
    stars.push({
      x: Math.random(),
      y: Math.random() * 0.68,
      r: 0.6 + Math.random() * 1.4,
      tw: Math.random() * Math.PI * 2,
      tws: 0.02 + Math.random() * 0.05
    });
  }
  hills = [];
  for (let i = 0; i < 8; i++) {
    hills.push({ h: 60 + Math.random() * 70 });
  }
  trees = [];
  for (let i = 0; i < 10; i++) {
    trees.push({ h: 24 + Math.random() * 20, w: 22 + Math.random() * 12 });
  }
  weatherDrops = [];
  for (let i = 0; i < 55; i++) {
    weatherDrops.push({
      x: Math.random() * W,
      y: Math.random() * H,
      len: 8 + Math.random() * 10,
      sp: 7 + Math.random() * 5
    });
  }
}

// ---------- Deterministik RNG (MP senkronu için) ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

let rng = Math.random;
function seedRng(s) { rng = mulberry32(s); pipesSpawned = 0; }

// ---------- Oyuna Başlama ----------
function startGame() {
  getAudioCtx();
  if (MP.connected) {
    seedRng(MP.seed || 1);
    currentDiff = MP.matchDiff || F.difficulty;
  } else {
    rng = Math.random;
    currentDiff = F.difficulty;
  }

  bird.x = W * 0.28;
  bird.y = playH() * 0.47;
  bird.vy = 0;
  bird.rot = 0;
  bird.sx = 1;
  bird.sy = 1;

  pipes = [];
  coins = [];
  powers = [];
  popups = [];
  particles = [];
  feathers = [];
  shockRings = [];
  currentRunGhost = [];

  score = 0;
  pipesSpawned = 0;
  runCoins = 0;
  combo = 0;
  scoreSavedThisRun = false;
  pipeTimer = -30;
  frames = 0;
  runFrames = 0;
  flashAlpha = 0;
  lightningAlpha = 0;
  biomePos = 0;

  shieldActive = false;
  invulnFrames = 0;
  slowFrames = 0;
  x2Left = 0;
  tinyFrames = 0;
  magnetFrames = 0;
  phaseFrames = 0;
  shakeT = 0;
  lastBadgeSig = '';

  if (MP.connected) {
    MP.oppScore = 0;
    MP.oppAlive = true;
    MP.oppRematch = false;
    MP.rematchVotes = 0;
  }

  scoreDisplay.textContent = '0';
  powerBadges.innerHTML = '';
  updateCoinUI();
  updateComboUI();
  if (MP.connected) hide(tapHint); else show(tapHint);
  show(hud);
  hide(menuScreen); hide(gameoverScreen); hide(pauseScreen);
  hide(statsScreen); hide(shopScreen); hide(lbScreen);
  hide(mpScreen); hide(mpGameoverScreen);

  state = STATE.READY;
  playStartMs = performance.now();
}

function beginPlay() {
  state = STATE.PLAYING;
  runFrames = 0;
  playStartMs = performance.now();
  hide(tapHint);
  flap();
}

function birdRadius() {
  return bird.r * (tinyFrames > 0 ? 0.64 : 1) * Math.min(1.15, Math.max(0.85, vScale()));
}

function flap() {
  if (state !== STATE.PLAYING && state !== STATE.READY) return;
  if (MP.connected && state === STATE.READY) return;
  if (state === STATE.READY) {
    state = STATE.PLAYING;
    runFrames = 0;
    playStartMs = performance.now();
    hide(tapHint);
  }
  bird.vy = DIFFICULTIES[currentDiff].flapSpeed * vScale();
  bird.wingDir = -1;
  bird.sx = 0.80;
  bird.sy = 1.22;
  sfx.flap();

  for (let i = 0; i < 4; i++) {
    particles.push({
      x: bird.x - 10, y: bird.y + 6,
      vx: -0.8 - Math.random() * 1.4, vy: (Math.random() - 0.2) * 1.3,
      life: 18, maxLife: 18, r: 2 + Math.random() * 2, color: 'rgba(255,255,255,0.75)'
    });
  }
}

// ---------- Boru, Altın & Güçlendirme Üretimi ----------
function spawnPipe() {
  const d = DIFFICULTIES[currentDiff];
  // MP senkronu için ilerleme skor yerine üretilen boru sayısına (pipesSpawned) bağlıdır;
  // böylece bir oyuncu Mükemmel Geçiş / Kombo / 2x yapsa bile her iki ekranda borular %100 aynı kalır!
  const pipeIdx = pipesSpawned++;
  const progress = Math.min(1, pipeIdx / 60);
  const baseVirtGap = Math.max(d.pipeGap * 0.70, d.pipeGap - d.pipeGap * d.accGap * progress);
  const virtSpeed = d.pipeSpeed + d.accSpeed * Math.min(pipeIdx, 45) * 80;

  const marginV = 66;
  const availV = VIRT_PLAY_H - baseVirtGap - marginV * 2;
  const rPos = rng();
  const baseTopV = marginV + rPos * Math.max(20, availV);

  // Boru tipi (deterministik rng)
  const rType = rng();
  const rPhase = rng() * Math.PI * 2;
  let type = 'normal';
  let moveAmpV = 0, moveFreq = 0, pulseAmpV = 0;

  if (pipeIdx >= 16 && rType < 0.22) {
    type = 'pulse';
    pulseAmpV = 16 + rng() * 10;
  } else if (pipeIdx >= 8 && rType < (0.28 + progress * 0.22)) {
    type = 'moving';
    moveAmpV = 24 + progress * 22;
    moveFreq = 0.032 + rng() * 0.022;
  } else {
    rng(); // rng adımlarını her dalda eşit tutmak için
  }

  const pipeW = Math.round(58 * hScale());
  const spawnX = Math.round((VIRT_W + 32) * hScale());

  const pipeObj = {
    x: spawnX,
    w: pipeW,
    baseTopV,
    baseGapV: baseVirtGap,
    topH: baseTopV * vScale(),
    gap: baseVirtGap * vScale(),
    virtSpeed,
    type,
    phase: rPhase,
    age: 0,
    moveAmpV,
    moveFreq,
    pulseAmpV,
    passed: false,
    shattered: false
  };
  pipes.push(pipeObj);

  // Altın veya Güçlendirme üretimi (boru aralığında veya boru sonrasında)
  const rItem = rng();
  const rSub = rng();
  const centerNormY = (baseTopV + baseVirtGap * 0.5) / VIRT_PLAY_H;

  if (rItem < 0.18 && pipeIdx >= 2) {
    // Güçlendirme küresi (MP modunda zaman akışını bozmamak için 'slow' yerine 'shield' verilir)
    let pKey = POWER_KEYS[Math.floor(rSub * POWER_KEYS.length) % POWER_KEYS.length];
    if (MP.connected && pKey === 'slow') pKey = 'shield';
    powers.push({
      x: spawnX + pipeW * 0.5,
      normY: centerNormY,
      y: centerNormY * playH(),
      r: 13,
      type: pKey,
      virtSpeed,
      bob: rSub * Math.PI * 2
    });
  } else if (rItem < 0.72) {
    // Altın
    const offsetNorm = (rSub - 0.5) * (baseVirtGap * 0.42 / VIRT_PLAY_H);
    const ny = Math.max(0.12, Math.min(0.88, centerNormY + offsetNorm));
    coins.push({
      x: spawnX + pipeW * 0.5,
      normY: ny,
      y: ny * playH(),
      r: 10,
      virtSpeed,
      spin: rSub * Math.PI * 2
    });
  }
}

function activatePower(type) {
  sfx.powerup();
  const info = POWER_TYPES[type];
  popups.push({ x: bird.x, y: bird.y - 24, txt: `${info.icon} ${info.label}!`, color: info.color, life: 48 });
  shockRings.push({ x: bird.x, y: bird.y, r: 10, maxR: 54, color: info.color, life: 20, maxLife: 20 });

  switch (type) {
    case 'shield': shieldActive = true; break;
    case 'slow':   slowFrames = 300; break;
    case 'x2':     x2Left += 5; break;
    case 'tiny':   tinyFrames = 360; break;
    case 'magnet': magnetFrames = 360; break;
    case 'phase':  phaseFrames = 210; break;
  }
  updatePowerBadges();
}

function onPassPipe(p) {
  const centerY = p.topH + p.gap * 0.5;
  const dist = Math.abs(bird.y - centerY);
  const isPerfect = dist <= p.gap * 0.21;

  let pts = 1;
  if (isPerfect) {
    combo++;
    if (combo > F.bestCombo) F.bestCombo = combo;
    pts += (combo >= 3 ? 2 : 1);
  } else {
    combo = 0;
  }

  if (x2Left > 0) {
    pts *= 2;
    x2Left--;
  }

  score += pts;
  scoreDisplay.textContent = score;
  updateComboUI();
  updatePowerBadges();

  if (isPerfect) {
    sfx.perfect();
    const label = combo >= 2 ? `🔥 MÜKEMMEL x${combo}! +${pts}` : `✨ MÜKEMMEL! +${pts}`;
    popups.push({ x: bird.x + 18, y: bird.y - 22, txt: label, color: '#FFD700', life: 50 });
    shockRings.push({ x: p.x + p.w * 0.5, y: centerY, r: 8, maxR: p.gap * 0.55, color: '#FFD700', life: 22, maxLife: 22 });
  } else {
    sfx.score();
    if (pts > 1) popups.push({ x: bird.x + 18, y: bird.y - 16, txt: `+${pts}`, color: '#7CFFB2', life: 42 });
  }

  for (let i = 0; i < (isPerfect ? 10 : 6); i++) {
    particles.push({
      x: bird.x + 14, y: bird.y,
      vx: (Math.random() - 0.5) * 3.6, vy: -1 - Math.random() * 2.4,
      life: 26, maxLife: 26, r: 2 + Math.random() * 2.5,
      color: isPerfect ? '#FFE066' : (pts > 1 ? '#00E676' : '#FFD700')
    });
  }
}

function spawnFeathers(x, y, skinKey, count = 10) {
  const S = skinColors(skinKey);
  for (let i = 0; i < count; i++) {
    feathers.push({
      x, y,
      vx: (Math.random() - 0.5) * 6,
      vy: -2 - Math.random() * 4,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.25,
      life: 55 + Math.random() * 25,
      color: i % 2 === 0 ? S.body : S.wing
    });
  }
}

function breakShieldOnPipe(p) {
  shieldActive = false;
  invulnFrames = 45;
  p.shattered = true;
  shakeT = 0.7;
  flashAlpha = 0.35;
  sfx.shieldBreak();
  updatePowerBadges();
  popups.push({ x: bird.x, y: bird.y - 26, txt: '🛡️ KALKAN KORUDU!', color: '#40C4FF', life: 52 });
  shockRings.push({ x: bird.x, y: bird.y, r: 12, maxR: 75, color: '#40C4FF', life: 24, maxLife: 24 });
  for (let i = 0; i < 16; i++) {
    particles.push({
      x: bird.x + 10, y: bird.y,
      vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8,
      life: 28, maxLife: 28, r: 2.5 + Math.random() * 2.5, color: '#80D8FF'
    });
  }
}

function die(grounded) {
  if (state !== STATE.PLAYING) return;
  state = STATE.DYING;
  sfx.hit();
  flashAlpha = 0.72;
  shakeT = 1.0;
  combo = 0;
  updateComboUI();
  hide(tapHint);

  spawnFeathers(bird.x, bird.y, F.skin, 11);
  for (let i = 0; i < 14; i++) {
    particles.push({
      x: bird.x, y: bird.y,
      vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.7) * 7,
      life: 30 + Math.random() * 18, maxLife: 48, r: 2 + Math.random() * 3,
      color: Math.random() > 0.5 ? '#FF7043' : '#FFD700'
    });
  }

  if (grounded) killConfirm();
}

function killConfirm() {
  if (state !== STATE.DYING) return;
  state = STATE.GAMEOVER;
  sfx.die();

  const playMs = performance.now() - playStartMs;
  F.games++;
  F.totalTime += Math.max(0, playMs / 1000);
  F.recentScores.unshift(score);
  F.recentScores = F.recentScores.slice(0, 5);

  const isRecord = score > F.bestScore;
  if (isRecord) {
    F.bestScore = score;
    if (!MP.connected && currentRunGhost.length > 5) {
      F.ghostRun = currentRunGhost.slice(0, 4500);
      F.ghostScore = score;
      F.ghostSkin = F.skin;
    }
  }
  persist();
  updateCoinUI();

  if (MP.connected) {
    mpOnDeath();
    return;
  }

  $('final-score').textContent = score;
  $('best-score-go').textContent = F.bestScore;
  if ($('run-coins-go')) $('run-coins-go').textContent = `🪙 +${runCoins}`;
  if (isRecord && score > 0) show(newRecord); else hide(newRecord);

  // Skor tablosuna isim kaydetme satırı
  const saveRow = $('name-save-row');
  const saveBtn = $('save-score-btn');
  const nameInp = $('player-name');
  if (score > 0 && saveRow && saveBtn && nameInp) {
    nameInp.value = F.playerName || '';
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 Kaydet';
    show(saveRow);
  } else if (saveRow) {
    hide(saveRow);
  }

  const m = medalFor(score);
  if (m) {
    show(medalDisplay);
    medalIcon.textContent = m.icon;
    medalText.textContent = m.text;
    setTimeout(sfx.medal, 350);
  } else {
    hide(medalDisplay);
  }
  show(gameoverScreen);
  hide(hud);
}

// ---------- Uçuş İzi Üretimi ----------
function emitTrail() {
  if (F.trail === 'none' || state !== STATE.PLAYING) return;
  if (frames % 2 !== 0) return;
  let col = '#FFE082';
  if (F.trail === 'fire') {
    col = Math.random() > 0.45 ? '#FF6D00' : '#FFD54F';
  } else if (F.trail === 'rainbow') {
    col = `hsl(${(frames * 8) % 360}, 95%, 62%)`;
  } else if (F.trail === 'star') {
    col = Math.random() > 0.5 ? '#FFF59D' : '#80D8FF';
  }
  particles.push({
    x: bird.x - 14,
    y: bird.y + (Math.random() - 0.5) * 8,
    vx: -1.4 - Math.random() * 0.8,
    vy: (Math.random() - 0.5) * 0.7,
    life: 22, maxLife: 22,
    r: F.trail === 'rainbow' ? 3.5 : 2.6,
    color: col,
    noGrav: true
  });
}

// ---------- Fizik & Dünya Güncellemesi ----------
function update() {
  frames++;
  const d = DIFFICULTIES[currentDiff];
  const vs = vScale(), hs = hScale();
  const slowMul = slowFrames > 0 ? 0.58 : 1;

  // 4 aşamalı biyom yumuşak geçişi (her 10 puanda bir: 0=gündüz, 1=günbatımı, 2=gece, 3=fırtına)
  const targetBiome = Math.floor(score / 10);
  biomePos += (targetBiome - biomePos) * 0.018;

  clouds.forEach(c => {
    c.x -= c.sp * (state === STATE.PLAYING ? slowMul : 0.4);
    if (c.x < -80) { c.x = W + 80; c.y = 35 + Math.random() * (H * 0.34); }
  });
  stars.forEach(s => { s.tw += s.tws; });

  // Fırtına biyomunda yağmur/kar & şimşek
  const stormWeight = biomeWeight(3);
  if (stormWeight > 0.08) {
    const isSnow = score >= 40;
    weatherDrops.forEach(wd => {
      wd.x -= isSnow ? Math.sin(frames * 0.03 + wd.len) * 0.8 + 0.7 : 2.2;
      wd.y += isSnow ? wd.sp * 0.32 : wd.sp * 1.15;
      if (wd.y > H) { wd.y = -12; wd.x = Math.random() * (W + 60); }
      if (wd.x < -20) wd.x = W + 20;
    });
    if (!isSnow && state === STATE.PLAYING && Math.random() < 0.0025 * stormWeight) {
      lightningAlpha = 0.55;
      sfx.thunder();
    }
  }
  if (lightningAlpha > 0) lightningAlpha = Math.max(0, lightningAlpha - 0.035);

  if (state === STATE.PLAYING || state === STATE.DYING) {
    groundX -= (state === STATE.PLAYING ? d.pipeSpeed * hs * slowMul : 0);
    if (groundX <= -48) groundX += 48;
  }

  // Squash & stretch yaylanması
  bird.sx += (1 - bird.sx) * 0.22;
  bird.sy += (1 - bird.sy) * 0.22;

  if (state === STATE.READY) {
    bird.x = W * 0.28;
    bird.y = playH() * 0.47 + Math.sin(frames * 0.08) * 8;
    bird.wing += bird.wingDir * 0.28;
    if (bird.wing > 1) { bird.wing = 1; bird.wingDir = -1; }
    if (bird.wing < -1) { bird.wing = -1; bird.wingDir = 1; }
  }

  if (state === STATE.PLAYING) {
    runFrames++;

    // Hayalet rekor kaydı (her 2 karede bir normalize Y)
    if (!MP.connected && runFrames % 2 === 0 && currentRunGhost.length < 4500) {
      currentRunGhost.push(Math.round((bird.y / Math.max(1, playH())) * 1000));
    }

    // Güçlendirme sürelerini düşür
    if (invulnFrames > 0) invulnFrames--;
    if (slowFrames > 0) slowFrames--;
    if (tinyFrames > 0) tinyFrames--;
    if (magnetFrames > 0) magnetFrames--;
    if (phaseFrames > 0) phaseFrames--;
    if (frames % 10 === 0) updatePowerBadges();

    bird.vy += d.gravity * vs;
    bird.y += bird.vy;

    const targetRot = Math.max(-0.5, Math.min(1.35, (bird.vy / Math.max(0.5, vs)) * 0.09));
    bird.rot += (targetRot - bird.rot) * 0.2;

    bird.wing += bird.wingDir * 0.3;
    if (bird.wing > 1) { bird.wing = 1; bird.wingDir = -1; }
    if (bird.wing < -1) { bird.wing = -1; bird.wingDir = 1; }
    if (bird.vy > 3.2 * vs) bird.wingDir = 0;

    emitTrail();

    // Boru zamanlayıcı (yavaşlatma aktifse aralık da orantılı uzar ki borular üst üste binmesin!)
    pipeTimer += slowMul;
    if (pipeTimer >= d.pipeInterval) {
      spawnPipe();
      pipeTimer -= d.pipeInterval;
    }

    const br = birdRadius();
    const pH = playH();

    // Boruları güncelle
    pipes.forEach(p => {
      p.age += slowMul;
      p.x -= p.virtSpeed * hs * slowMul;
      let virtTop = p.baseTopV;
      let virtGap = p.baseGapV;
      if (p.type === 'moving') {
        virtTop += Math.sin(p.phase + p.age * p.moveFreq) * p.moveAmpV;
        virtTop = Math.max(48, Math.min(VIRT_PLAY_H - virtGap - 48, virtTop));
      } else if (p.type === 'pulse') {
        const delta = Math.sin(p.phase + p.age * 0.05) * p.pulseAmpV;
        virtGap = Math.max(96, p.baseGapV + delta);
        virtTop = p.baseTopV - delta * 0.5;
      }
      p.topH = virtTop * vs;
      p.gap = virtGap * vs;
    });

    // Altınları güncelle & topla
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      c.spin += 0.1;
      c.x -= c.virtSpeed * hs * slowMul;
      c.y = c.normY * pH;
      if (magnetFrames > 0) {
        const dx = bird.x - c.x, dy = bird.y - c.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 220 && dist > 1) {
          c.x += (dx / dist) * 6.5;
          c.normY += ((dy / dist) * 6.5) / pH;
          c.y = c.normY * pH;
        }
      }
      if (Math.hypot(bird.x - c.x, bird.y - c.y) < br + c.r + 4) {
        runCoins++;
        F.coins++;
        F.totalCoins = (F.totalCoins || 0) + 1;
        sfx.coin();
        updateCoinUI();
        popups.push({ x: c.x, y: c.y - 10, txt: '+1 🪙', color: '#FFD700', life: 34 });
        for (let k = 0; k < 5; k++) {
          particles.push({
            x: c.x, y: c.y,
            vx: (Math.random() - 0.5) * 3, vy: -1 - Math.random() * 2,
            life: 20, maxLife: 20, r: 2, color: '#FFE082'
          });
        }
        coins.splice(i, 1);
      } else if (c.x < -30) {
        coins.splice(i, 1);
      }
    }

    // Güçlendirmeleri güncelle & topla
    for (let i = powers.length - 1; i >= 0; i--) {
      const pw = powers[i];
      pw.bob += 0.08;
      pw.x -= pw.virtSpeed * hs * slowMul;
      pw.y = pw.normY * pH + Math.sin(pw.bob) * 5;
      if (magnetFrames > 0) {
        const dx = bird.x - pw.x, dy = bird.y - pw.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 200 && dist > 1) {
          pw.x += (dx / dist) * 5.2;
          pw.normY += ((dy / dist) * 5.2) / pH;
        }
      }
      if (Math.hypot(bird.x - pw.x, bird.y - pw.y) < br + pw.r + 5) {
        activatePower(pw.type);
        powers.splice(i, 1);
      } else if (pw.x < -35) {
        powers.splice(i, 1);
      }
    }

    // Skor & Boru çarpışması
    for (const p of pipes) {
      if (!p.passed && p.x + p.w < bird.x - br) {
        p.passed = true;
        onPassPipe(p);
        mpOnScore();
      }
      if (!p.shattered && phaseFrames <= 0 && invulnFrames <= 0 && hitPipe(p, br)) {
        if (shieldActive) {
          breakShieldOnPipe(p);
        } else {
          die(false);
          break;
        }
      }
    }

    if (bird.y + br > pH) {
      bird.y = pH - br;
      die(true);
    }
    if (bird.y - br < -50) bird.y = -50 + br;

    pipes = pipes.filter(p => p.x + p.w > -65);
  }

  if (state === STATE.DYING) {
    bird.vy += d.gravity * vs * 1.35;
    bird.y += bird.vy;
    bird.rot = Math.min(bird.rot + 0.09, Math.PI / 2);
    if (bird.y + birdRadius() >= playH()) killConfirm();
  }

  // Partiküller, tüyler ve şok halkaları
  particles.forEach(pt => {
    pt.x += pt.vx; pt.y += pt.vy;
    if (!pt.noGrav) pt.vy += 0.05;
    pt.life--;
  });
  particles = particles.filter(pt => pt.life > 0);

  feathers.forEach(f => {
    f.x += f.vx + Math.sin(f.life * 0.2) * 0.5;
    f.y += f.vy;
    f.vy = Math.min(2.2, f.vy + 0.09);
    f.vx *= 0.96;
    f.rot += f.vrot;
    f.life--;
  });
  feathers = feathers.filter(f => f.life > 0);

  shockRings.forEach(sr => {
    sr.life--;
    sr.r += (sr.maxR - sr.r) * 0.22;
  });
  shockRings = shockRings.filter(sr => sr.life > 0);

  if (flashAlpha > 0) flashAlpha = Math.max(0, flashAlpha - 0.04);
}

function hitPipe(p, br) {
  const bh = br * 0.78;
  if (bird.x + bh < p.x || bird.x - bh > p.x + p.w) return false;
  if (bird.y - bh < p.topH || bird.y + bh > p.topH + p.gap) return true;
  return false;
}

// ---------- Renk & Biyom Yardımcıları ----------
function lerp(a, b, t) { return a + (b - a) * t; }
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function rgbStr(c) { return `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`; }
function lerpColor(a, b, t) { return rgbStr(mix(a, b, t)); }
function hexRGB(hex) { return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]; }
function mixC(a, b, t) { return lerpColor(Array.isArray(a) ? a : hexRGB(a), Array.isArray(b) ? b : hexRGB(b), t); }

// 4 biyom için dairesel interpolasyon: 0=Gündüz, 1=Günbatımı, 2=Gece, 3=Fırtına
const BIOME_SKY = [
  [[88, 170, 245], [140, 200, 255], [186, 224, 255], [224, 244, 255]], // Gündüz
  [[62, 34, 98],   [178, 72, 92],   [245, 138, 66],  [255, 205, 112]], // Gün Batımı
  [[8, 14, 38],    [16, 26, 58],    [24, 38, 72],    [34, 50, 84]],    // Gece
  [[24, 34, 48],   [42, 56, 74],    [64, 80, 98],    [92, 108, 124]]   // Fırtına / Kar
];

function biomePalette(arr4) {
  const cyc = ((biomePos % 4) + 4) % 4;
  const i0 = Math.floor(cyc) % 4;
  const i1 = (i0 + 1) % 4;
  const f = cyc - Math.floor(cyc);
  return mix(arr4[i0], arr4[i1], f);
}

function biomeWeight(idx) {
  const cyc = ((biomePos % 4) + 4) % 4;
  let diff = Math.abs(cyc - idx);
  if (diff > 2) diff = 4 - diff;
  return Math.max(0, 1 - diff);
}

function shakeCtx() {
  if (shakeT <= 0) return;
  const m = shakeT * 7;
  ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
}

// ---------- Çizim ----------
function draw() {
  const nightW = Math.max(biomeWeight(2), biomeWeight(3) * 0.75);
  const sunsetW = biomeWeight(1);
  const stormW = biomeWeight(3);

  ctx.save();
  if (shakeT > 0) {
    shakeCtx();
    shakeT = Math.max(0, shakeT - 0.04);
  }

  // --- Gökyüzü (4 Biyom) ---
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  const stops = [0, 0.35, 0.7, 1];
  for (let s = 0; s < 4; s++) {
    const col = biomePalette([BIOME_SKY[0][s], BIOME_SKY[1][s], BIOME_SKY[2][s], BIOME_SKY[3][s]]);
    grd.addColorStop(stops[s], rgbStr(col));
  }
  ctx.fillStyle = grd;
  ctx.fillRect(-12, -12, W + 24, H + 24);

  // --- Yıldızlar + Kayan Yıldızlar ---
  const starVis = Math.max(biomeWeight(2), sunsetW * 0.35);
  if (starVis > 0.05) {
    stars.forEach(s => {
      ctx.globalAlpha = starVis * (0.35 + 0.65 * Math.abs(Math.sin(s.tw)));
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    if (Math.random() < 0.005 * starVis && shootingStars.length < 2) {
      shootingStars.push({ x: Math.random() * W, y: Math.random() * H * 0.3, vx: -6 - Math.random() * 4, vy: 3 + Math.random() * 2, life: 26 });
    }
    shootingStars.forEach(ss => {
      ss.x += ss.vx; ss.y += ss.vy; ss.life--;
      ctx.strokeStyle = `rgba(255,255,255,${(ss.life / 26) * starVis})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ss.x, ss.y);
      ctx.lineTo(ss.x - ss.vx * 4, ss.y - ss.vy * 4);
      ctx.stroke();
    });
    shootingStars = shootingStars.filter(ss => ss.life > 0);
  }

  // --- Güneş / Batan Güneş / Ay ---
  const sunX = W * 0.78;
  const sunY = H * (0.12 + sunsetW * 0.14);
  if (biomeWeight(2) < 0.5 && stormW < 0.65) {
    const sunCol = sunsetW > 0.3 ? '#FF7043' : '#FFE066';
    const glow = ctx.createRadialGradient(sunX, sunY, 5, sunX, sunY, 95);
    glow.addColorStop(0, sunsetW > 0.3 ? 'rgba(255,140,80,0.85)' : 'rgba(255,244,180,0.85)');
    glow.addColorStop(0.4, sunsetW > 0.3 ? 'rgba(255,90,60,0.32)' : 'rgba(255,224,102,0.35)');
    glow.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 95, sunY - 95, 190, 190);
    ctx.fillStyle = sunCol;
    ctx.beginPath(); ctx.arc(sunX, sunY, 26, 0, Math.PI * 2); ctx.fill();
  } else if (biomeWeight(2) >= 0.4) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, biomeWeight(2) * 1.3);
    const mGlow = ctx.createRadialGradient(sunX, H * 0.12, 5, sunX, H * 0.12, 70);
    mGlow.addColorStop(0, 'rgba(244,246,240,0.5)');
    mGlow.addColorStop(1, 'rgba(244,246,240,0)');
    ctx.fillStyle = mGlow;
    ctx.fillRect(sunX - 70, H * 0.12 - 70, 140, 140);
    ctx.fillStyle = '#F4F6F0';
    ctx.beginPath(); ctx.arc(sunX, H * 0.12, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(180,184,176,0.5)';
    ctx.beginPath(); ctx.arc(sunX + 6, H * 0.12 - 4, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(sunX - 7, H * 0.12 + 7, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // --- Bulutlar ---
  clouds.forEach(c => {
    ctx.globalAlpha = lerp(0.85, 0.22, nightW);
    drawCloud(c.x, c.y, c.s, sunsetW, stormW);
    ctx.globalAlpha = 1;
  });

  // --- Parallax Tepeler ---
  const yBase = playH();
  for (let layer = 0; layer < 3; layer++) {
    const speedMul = [0.15, 0.3, 0.5][layer];
    const step = layer === 0 ? 110 : layer === 1 ? 90 : 70;
    const hMul = layer === 0 ? 1.9 : layer === 1 ? 1.3 : 0.85;
    const off = ((-groundX * speedMul) % step + step) % step;
    const dayC = [[98, 182, 148], [76, 158, 104], [60, 138, 74]][layer];
    const sunC = [[92, 62, 102],  [72, 48, 82],   [54, 36, 64]][layer];
    const ngtC = [[16, 30, 56],   [13, 26, 48],   [11, 22, 42]][layer];
    const stmC = [[38, 52, 66],   [30, 44, 56],   [24, 36, 46]][layer];
    const base = biomePalette([dayC, sunC, ngtC, stmC]);

    const g2 = ctx.createLinearGradient(0, yBase - 160, 0, yBase + 10);
    g2.addColorStop(0, rgbStr(mix(base, [255, 255, 255], 0.14)));
    g2.addColorStop(1, rgbStr(mix(base, [0, 0, 0], 0.25)));
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.moveTo(-step, yBase);
    let idx = layer * 3;
    for (let x = -off - step; x < W + step; x += step) {
      const h = hills[idx % hills.length].h;
      idx++;
      ctx.quadraticCurveTo(x + step / 2, yBase - h * hMul, x + step, yBase);
    }
    ctx.lineTo(W + step, H);
    ctx.lineTo(-step, H);
    ctx.closePath();
    ctx.fill();
  }

  // --- Ağaçlar ---
  ctx.save();
  ctx.globalAlpha = 0.9;
  const treeStep = 70;
  const tOff = ((-groundX * 0.5) % treeStep + treeStep) % treeStep;
  for (let i = 0; i < 9; i++) {
    const t = trees[i % trees.length];
    const x = W - ((tOff + i * treeStep) % (W + 140));
    if (x < -60 || x > W + 60) continue;
    drawTree(x, yBase + 4, t, nightW);
  }
  ctx.restore();

  // --- Borular ---
  pipes.forEach(p => drawPipe(p, nightW));

  // --- Altınlar ---
  coins.forEach(c => drawCoin(c));

  // --- Güçlendirme Küreleri ---
  powers.forEach(pw => drawPowerOrb(pw));

  // --- Şok Halkaları (Mükemmel Geçiş / Kalkan) ---
  shockRings.forEach(sr => {
    ctx.save();
    ctx.globalAlpha = sr.life / sr.maxLife;
    ctx.strokeStyle = sr.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sr.x, sr.y, sr.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });

  // --- Partiküller & Uçuş İzi ---
  particles.forEach(pt => {
    const a = Math.min(1, pt.life / (pt.maxLife || 24));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // --- Dökülen Tüyler ---
  feathers.forEach(f => {
    ctx.save();
    ctx.globalAlpha = Math.min(1, f.life / 30);
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // --- Yağmur / Kar Yağışı (Fırtına Biyomu) ---
  if (stormW > 0.08) {
    const isSnow = score >= 40;
    ctx.save();
    ctx.globalAlpha = stormW * 0.65;
    if (isSnow) {
      ctx.fillStyle = '#fff';
      weatherDrops.forEach(wd => {
        ctx.beginPath();
        ctx.arc(wd.x, wd.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      });
    } else {
      ctx.strokeStyle = 'rgba(190,225,255,0.75)';
      ctx.lineWidth = 1.4;
      weatherDrops.forEach(wd => {
        ctx.beginPath();
        ctx.moveTo(wd.x, wd.y);
        ctx.lineTo(wd.x - 3, wd.y + wd.len);
        ctx.stroke();
      });
    }
    ctx.restore();
  }

  // --- Zemin ---
  const gh = groundH();
  const soil = ctx.createLinearGradient(0, H - gh, 0, H);
  soil.addColorStop(0, lerpColor([198, 158, 106], [34, 30, 27], nightW));
  soil.addColorStop(1, lerpColor([158, 116, 74], [24, 21, 19], nightW));
  ctx.fillStyle = soil;
  ctx.fillRect(0, H - gh, W, gh);

  const grass = ctx.createLinearGradient(0, H - gh, 0, H - gh + gh * 0.42);
  grass.addColorStop(0, lerpColor([108, 214, 86], [38, 84, 60], nightW));
  grass.addColorStop(1, lerpColor([64, 168, 56], [24, 58, 44], nightW));
  ctx.fillStyle = grass;
  ctx.fillRect(0, H - gh, W, gh * 0.42);

  ctx.strokeStyle = 'rgba(90,60,35,0.38)';
  ctx.lineWidth = 2;
  for (let x = groundX; x < W + 48; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, H - gh + gh * 0.48);
    ctx.lineTo(x + 18, H);
    ctx.stroke();
  }

  // --- Hayalet Rekor Kuşu (Tek Kişilik Ghost Replay) ---
  if (!MP.connected && F.ghostOn !== false && state === STATE.PLAYING && F.ghostRun && F.ghostRun.length > 0) {
    const gIdx = Math.floor(runFrames / 2);
    if (gIdx < F.ghostRun.length) {
      const gy = (F.ghostRun[gIdx] / 1000) * playH();
      const nextY = (F.ghostRun[Math.min(F.ghostRun.length - 1, gIdx + 1)] / 1000) * playH();
      const gRot = Math.max(-0.4, Math.min(1.0, (nextY - gy) * 0.08));
      drawGhostBird(W * 0.28, gy, gRot, F.ghostSkin || 'yellow', `👻 Rekor (${F.ghostScore})`);
    }
  }

  // --- Rakip Kuş (Çevrimiçi Düello — İnterpolasyonlu) ---
  if (MP.connected && MP.oppAlive && state !== STATE.GAMEOVER) {
    MP.oppBird.x += (MP.oppBird.tx - MP.oppBird.x) * 0.35;
    MP.oppBird.y += (MP.oppBird.ty - MP.oppBird.y) * 0.35;
    MP.oppBird.rot += (MP.oppBird.trot - MP.oppBird.rot) * 0.35;
    drawGhostBird(MP.oppBird.x, MP.oppBird.y, MP.oppBird.rot, MP.oppBird.skin, MP.oppName, true);
  }

  // --- Ana Kuş ---
  drawBird();

  // --- Yüzen Puan Yazıları ---
  ctx.font = '900 18px "Segoe UI", Arial';
  ctx.textAlign = 'center';
  popups.forEach(p => {
    ctx.globalAlpha = Math.min(1, p.life / 26);
    const dy = (50 - p.life) * 0.55;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(p.txt, p.x + 1.5, p.y - dy + 1.5);
    ctx.fillStyle = p.color || '#7CFFB2';
    ctx.fillText(p.txt, p.x, p.y - dy);
    p.life--;
  });
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  popups = popups.filter(p => p.life > 0);

  // --- Çevrimiçi Geri Sayım ---
  if (MP.connected) mpDrawCountdown();

  // --- Şimşek & Çarpma Flaşı + Vinyet ---
  const totalFlash = Math.min(0.85, flashAlpha + lightningAlpha);
  if (totalFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${totalFlash})`;
    ctx.fillRect(-12, -12, W + 24, H + 24);
  }
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.44, W / 2, H / 2, H * 0.76);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, `rgba(0,0,20,${0.16 + 0.22 * nightW})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  ctx.restore();
}

function drawCloud(x, y, s, sunsetW, stormW) {
  let fill = 'rgba(255,255,255,0.92)';
  if (stormW > 0.35) fill = 'rgba(130,148,168,0.82)';
  else if (sunsetW > 0.35) fill = 'rgba(255,215,190,0.88)';
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, 16 * s, 0, Math.PI * 2);
  ctx.arc(x + 18 * s, y - 8 * s, 14 * s, 0, Math.PI * 2);
  ctx.arc(x + 36 * s, y, 16 * s, 0, Math.PI * 2);
  ctx.arc(x + 18 * s, y + 6 * s, 13 * s, 0, Math.PI * 2);
  ctx.fill();
}

function drawTree(x, yBase, t, night) {
  const trunkH = 10;
  ctx.fillStyle = lerpColor([112, 78, 48], [26, 20, 16], night);
  ctx.fillRect(x - 2.5, yBase - trunkH, 5, trunkH);
  const c = [
    lerpColor([64, 150, 66], [14, 34, 44], night),
    lerpColor([82, 168, 76], [18, 44, 52], night),
    lerpColor([96, 184, 84], [22, 54, 60], night)
  ];
  for (let i = 0; i < 3; i++) {
    const w = t.w * (1 - i * 0.22);
    const yy = yBase - trunkH - i * t.h * 0.30;
    ctx.fillStyle = c[i];
    ctx.beginPath();
    ctx.moveTo(x, yy - t.h * 0.8);
    ctx.lineTo(x + w / 2, yy);
    ctx.lineTo(x - w / 2, yy);
    ctx.closePath();
    ctx.fill();
  }
}

function drawPipe(p, night) {
  ctx.save();
  if (p.shattered) ctx.globalAlpha = 0.28;

  // Boru tipine göre renk paleti
  let palette;
  if (p.type === 'moving') {
    palette = [
      lerpColor([20, 120, 165], [14, 48, 68], night),
      lerpColor([64, 205, 245], [38, 98, 124], night),
      lerpColor([36, 168, 215], [26, 76, 98], night),
      lerpColor([18, 96, 136],  [12, 38, 54], night)
    ];
  } else if (p.type === 'pulse') {
    palette = [
      lerpColor([168, 98, 20],  [68, 40, 12], night),
      lerpColor([255, 196, 72], [126, 92, 34], night),
      lerpColor([228, 152, 38], [98, 68, 24], night),
      lerpColor([138, 76, 14],  [52, 30, 10], night)
    ];
  } else {
    palette = [
      lerpColor([38, 158, 62],  [24, 52, 42], night),
      lerpColor([82, 224, 106], [52, 96, 76], night),
      lerpColor([58, 205, 90],  [40, 78, 62], night),
      lerpColor([26, 110, 44],  [18, 40, 32], night)
    ];
  }

  function pipeRect(x, y, w, h) {
    if (h <= 0) return;
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, palette[0]);
    g.addColorStop(0.28, palette[1]);
    g.addColorStop(0.55, palette[2]);
    g.addColorStop(1, palette[3]);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x + w * 0.18, y, 5, h);
    ctx.strokeStyle = 'rgba(15,50,30,0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }

  const capH = 24, capW = p.w + 10;
  pipeRect(p.x, -10, p.w, p.topH - capH + 10);
  pipeRect(p.x - 5, p.topH - capH, capW, capH);

  const by = p.topH + p.gap;
  pipeRect(p.x - 5, by, capW, capH);
  pipeRect(p.x, by + capH, p.w, playH() - by - capH + 4);

  ctx.restore();
}

function drawCoin(c) {
  const scaleX = Math.max(0.22, Math.abs(Math.cos(c.spin)));
  ctx.save();
  ctx.translate(c.x, c.y);
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 18);
  glow.addColorStop(0, 'rgba(255,230,100,0.65)');
  glow.addColorStop(1, 'rgba(255,215,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();

  ctx.scale(scaleX, 1);
  ctx.fillStyle = '#FFD700';
  ctx.strokeStyle = '#B26A00';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, c.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#FFF59D';
  ctx.beginPath();
  ctx.arc(-2, -2, c.r * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPowerOrb(pw) {
  const info = POWER_TYPES[pw.type];
  ctx.save();
  ctx.translate(pw.x, pw.y);
  const glow = ctx.createRadialGradient(0, 0, 3, 0, 0, 22);
  glow.addColorStop(0, info.glow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = 'rgba(12,24,40,0.78)';
  ctx.strokeStyle = info.color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, pw.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.font = '700 13px "Segoe UI", Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(info.icon, 0, 1);
  ctx.restore();
}

function drawBirdSprite(S, wingVal, isDead, scaleMul = 1) {
  ctx.scale(scaleMul, scaleMul);

  // Kral pelerini
  if (S.special === 'king') {
    ctx.fillStyle = '#D32F2F';
    ctx.beginPath();
    ctx.moveTo(-6, 2);
    ctx.lineTo(-24, 11 + Math.sin(frames * 0.25) * 2.5);
    ctx.lineTo(-18, 2);
    ctx.closePath();
    ctx.fill();
  }

  // Ateş Kuşu sorgucu
  if (S.special === 'phoenix') {
    ctx.fillStyle = '#FF3D00';
    ctx.beginPath();
    ctx.moveTo(-2, -11);
    ctx.lineTo(-12, -20);
    ctx.lineTo(-6, -12);
    ctx.lineTo(-15, -15);
    ctx.lineTo(-8, -8);
    ctx.closePath();
    ctx.fill();
  }

  // Robot anteni
  if (S.special === 'robot') {
    ctx.strokeStyle = '#CFD8DC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(-3, -20);
    ctx.stroke();
    ctx.fillStyle = frames % 20 < 10 ? '#FF1744' : '#FF8A80';
    ctx.beginPath();
    ctx.arc(-3, -21, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Gövde
  const bg = ctx.createRadialGradient(-4, -5, 3, 0, 2, 18);
  bg.addColorStop(0, S.belly);
  bg.addColorStop(0.45, S.body);
  bg.addColorStop(1, mixC(S.body, '#000000', 0.28));
  ctx.fillStyle = bg;
  ctx.strokeStyle = S.outline;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 12.5, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  // Kuyruk
  ctx.fillStyle = S.wing;
  ctx.strokeStyle = S.wingOut;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-13, -2);
  ctx.lineTo(-22, -7);
  ctx.lineTo(-20, 0);
  ctx.lineTo(-22, 6);
  ctx.lineTo(-13, 4);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // Göbek
  ctx.fillStyle = S.belly;
  ctx.beginPath();
  ctx.ellipse(-2, 4.5, 9, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Kanat
  const wingY = wingVal * 8;
  ctx.save();
  ctx.translate(-3, 2);
  ctx.rotate(wingVal * 0.5);
  ctx.fillStyle = S.wing;
  ctx.beginPath();
  ctx.ellipse(0, wingY * 0.5, 11, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = S.wingOut;
  ctx.stroke();
  ctx.restore();

  // Göz (Robot vizörü veya normal/X göz)
  if (S.special === 'robot' && !isDead) {
    ctx.fillStyle = '#00E5FF';
    ctx.fillRect(3, -7, 10, 4.5);
    ctx.strokeStyle = '#004D40';
    ctx.lineWidth = 1;
    ctx.strokeRect(3, -7, 10, 4.5);
  } else {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(8, -4.5, 4.8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = S.outline; ctx.lineWidth = 1; ctx.stroke();
    if (isDead) {
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(6.2, -6.3); ctx.lineTo(9.8, -2.7);
      ctx.moveTo(9.8, -6.3); ctx.lineTo(6.2, -2.7);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(9.5, -4.5, 2.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(8.5, -5.8, 0.9, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Gaga
  ctx.fillStyle = S.beak;
  ctx.beginPath();
  ctx.moveTo(13, -1);
  ctx.lineTo(23, 1.5);
  ctx.lineTo(13, 5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = S.beakOut;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Kral Tacı
  if (S.special === 'king') {
    ctx.fillStyle = '#FFD700';
    ctx.strokeStyle = '#8D5600';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-6, -11);
    ctx.lineTo(-7, -19);
    ctx.lineTo(-2, -15);
    ctx.lineTo(2, -21);
    ctx.lineTo(6, -15);
    ctx.lineTo(10, -19);
    ctx.lineTo(9, -11);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
}

function drawBird() {
  const S = skinColors(F.skin);
  const pH = playH();
  const sizeMul = (tinyFrames > 0 ? 0.64 : 1) * Math.min(1.15, Math.max(0.85, vScale()));
  const isDead = state === STATE.DYING || state === STATE.GAMEOVER;

  // Hızla düşerken rüzgar çizgileri
  if (state === STATE.PLAYING && bird.vy > 4.6 * vScale()) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.38)';
    ctx.lineWidth = 1.5;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(bird.x + i * 9, bird.y - 18);
      ctx.lineTo(bird.x + i * 9 + 4, bird.y - 34);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Yer gölgesi
  const shadowScale = Math.max(0.22, 1 - (pH - bird.y) / (H * 0.6)) * sizeMul;
  ctx.save();
  ctx.globalAlpha = 0.24 * shadowScale;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(bird.x, pH + 6, 14 * shadowScale, 4 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  if (phaseFrames > 0) {
    ctx.globalAlpha = phaseFrames < 60 && Math.floor(phaseFrames / 5) % 2 === 0 ? 0.82 : 0.46;
  } else if (invulnFrames > 0 && Math.floor(invulnFrames / 4) % 2 === 0) {
    ctx.globalAlpha = 0.55;
  } else if (S.special === 'ghost') {
    ctx.globalAlpha = 0.78;
  }

  ctx.translate(bird.x, bird.y);
  ctx.rotate(bird.rot);
  ctx.scale(bird.sx, bird.sy);
  drawBirdSprite(S, bird.wing, isDead, sizeMul);
  ctx.restore();

  // Mıknatıs Halesi
  if (magnetFrames > 0) {
    ctx.save();
    ctx.strokeStyle = `rgba(255,112,67,${0.35 + 0.25 * Math.sin(frames * 0.2)})`;
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bird.x, bird.y, birdRadius() + 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Kalkan Halesi
  if (shieldActive) {
    ctx.save();
    const pulse = 0.55 + 0.3 * Math.sin(frames * 0.15);
    const r = birdRadius();
    const shieldGlow = ctx.createRadialGradient(bird.x, bird.y, r + 2, bird.x, bird.y, r + 15);
    shieldGlow.addColorStop(0, 'rgba(0,191,255,0)');
    shieldGlow.addColorStop(0.7, `rgba(0,191,255,${pulse * 0.35})`);
    shieldGlow.addColorStop(1, 'rgba(0,191,255,0)');
    ctx.fillStyle = shieldGlow;
    ctx.beginPath();
    ctx.arc(bird.x, bird.y, r + 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(120,220,255,${pulse})`;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(bird.x, bird.y, r + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawGhostBird(x, y, rot, skinKey, label, isOpponent = false) {
  const S = skinColors(skinKey);
  ctx.save();
  ctx.globalAlpha = isOpponent ? 0.58 : 0.34;
  ctx.translate(x, y);
  ctx.rotate(rot);
  drawBirdSprite(S, Math.sin(frames * 0.25), false, 0.88 * Math.min(1.15, Math.max(0.85, vScale())));
  ctx.restore();

  if (label) {
    ctx.save();
    ctx.globalAlpha = isOpponent ? 0.82 : 0.55;
    ctx.font = '700 11px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(label, x + 1, y - 23);
    ctx.fillStyle = isOpponent ? '#ffec8b' : '#b2ebf2';
    ctx.fillText(label, x, y - 24);
    ctx.restore();
  }
}

// ---------- Ana Oyun Döngüsü ----------
const STEP_MS = 1000 / 60;
let acc = 0;
let lastT = performance.now();

function menuUpdate() {
  frames++;
  clouds.forEach(c => {
    c.x -= c.sp * 0.4;
    if (c.x < -80) c.x = W + 80;
  });
  stars.forEach(s => { s.tw += s.tws; });
  groundX -= 0.5;
  if (groundX <= -48) groundX += 48;
  bird.x = W * 0.28;
  bird.y = playH() * 0.47 + Math.sin(frames * 0.08) * 8;
  bird.rot = Math.sin(frames * 0.05) * 0.1;
  bird.sx = 1; bird.sy = 1;
  bird.wing += bird.wingDir * 0.28;
  if (bird.wing > 1) { bird.wing = 1; bird.wingDir = -1; }
  if (bird.wing < -1) { bird.wing = -1; bird.wingDir = 1; }
  biomePos += (0 - biomePos) * 0.03;
}

function loop(now) {
  const dt = Math.min(now - lastT, 100);
  lastT = now;
  acc += dt;
  if (acc > 200) acc = STEP_MS;

  while (acc >= STEP_MS) {
    acc -= STEP_MS;
    if (state === STATE.MENU || state === STATE.MP) menuUpdate();
    else if (state !== STATE.PAUSED) {
      mpCountdownTick();
      update();
      mpTick();
    }
  }

  draw();
  requestAnimationFrame(loop);
}

// ---------- Mağaza (Kostüm & Uçuş İzleri) ----------
let currentShopTab = 'skins';

function openShop(tab, customMsg) {
  sfx.click();
  currentShopTab = tab || 'skins';
  document.querySelectorAll('.shop-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === currentShopTab);
  });
  $('shop-msg').textContent = customMsg || 'Oyun içinde boruların arasındaki altınları topla!';
  renderShopList();
  updateCoinUI();
  show(shopScreen);
}

function renderShopList() {
  const list = $('shop-list');
  if (!list) return;
  const dict = currentShopTab === 'skins' ? SKINS : TRAILS;
  const unlockedArr = currentShopTab === 'skins' ? F.unlockedSkins : F.unlockedTrails;
  const currentEquipped = currentShopTab === 'skins' ? F.skin : F.trail;

  list.innerHTML = '';
  Object.keys(dict).forEach(key => {
    const item = dict[key];
    const unlocked = unlockedArr.includes(key);
    const equipped = currentEquipped === key;

    const row = document.createElement('div');
    row.className = 'shop-item' + (equipped ? ' equipped' : '');

    const swatchBg = currentShopTab === 'skins' ? item.body : item.color;
    const btnClass = equipped ? 'active' : (unlocked ? 'equip' : 'buy');
    const btnText = equipped ? '✓ Seçili' : (unlocked ? 'Kuşan' : `🪙 ${item.cost}`);
    const canAfford = F.coins >= item.cost;

    row.innerHTML = `
      <div class="shop-swatch" style="background:${swatchBg}">${item.emoji}</div>
      <div class="shop-info">
        <div class="shop-name">${item.name}</div>
        <div class="shop-desc">${item.desc}</div>
      </div>
      <button class="shop-buy-btn ${btnClass}" ${(!unlocked && !canAfford) ? 'disabled' : ''}>${btnText}</button>
    `;

    const actionBtn = row.querySelector('button');
    actionBtn.addEventListener('click', () => {
      if (equipped) return;
      if (unlocked) {
        sfx.click();
        if (currentShopTab === 'skins') F.skin = key;
        else F.trail = key;
        persist();
        renderMenuSkins();
        renderShopList();
      } else if (F.coins >= item.cost) {
        F.coins -= item.cost;
        unlockedArr.push(key);
        if (currentShopTab === 'skins') F.skin = key;
        else F.trail = key;
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

// ---------- Skor Tablosu (Leaderboard) ----------
function saveCurrentScore() {
  if (scoreSavedThisRun || score <= 0) return;
  const nameInp = $('player-name');
  const rawName = (nameInp ? nameInp.value.trim() : '') || F.playerName || 'Oyuncu';
  const cleanName = rawName.slice(0, 12);
  F.playerName = cleanName;
  if (!Array.isArray(F.scoreboard)) F.scoreboard = [];
  F.scoreboard.push({
    name: cleanName,
    score,
    diff: DIFFICULTIES[currentDiff] ? DIFFICULTIES[currentDiff].label : 'Normal',
    mine: true,
    ts: Date.now()
  });
  F.scoreboard.sort((a, b) => b.score - a.score || b.ts - a.ts);
  F.scoreboard = F.scoreboard.slice(0, 15);
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
  const board = Array.isArray(F.scoreboard) ? F.scoreboard : [];
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

// ---------- Girdiler & Buton Olayları ----------
function primaryAction() {
  getAudioCtx();
  if (state === STATE.READY || state === STATE.PLAYING) flap();
}

function togglePause() {
  if (MP.connected) return; // çevrimiçi düelloda duraklatma kapalı
  if (state === STATE.PLAYING) {
    state = STATE.PAUSED;
    show(pauseScreen);
  } else if (state === STATE.PAUSED) {
    state = STATE.PLAYING;
    hide(pauseScreen);
  }
}

document.addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    if (state === STATE.MENU && menuScreen && !menuScreen.classList.contains('hidden') &&
        shopScreen.classList.contains('hidden') && lbScreen.classList.contains('hidden') &&
        statsScreen.classList.contains('hidden')) {
      startGame();
    } else {
      primaryAction();
    }
  }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (state === STATE.PLAYING || state === STATE.PAUSED) togglePause();
  }
  if (e.code === 'Enter' && state === STATE.GAMEOVER && !MP.connected) startGame();
});

canvas.addEventListener('mousedown', e => { e.preventDefault(); primaryAction(); });
canvas.addEventListener('touchstart', e => { e.preventDefault(); primaryAction(); }, { passive: false });

$('start-btn').addEventListener('click', () => { sfx.click(); startGame(); });
$('retry-btn').addEventListener('click', () => { sfx.click(); startGame(); });
$('home-btn').addEventListener('click', () => { sfx.click(); goHome(); });
$('quit-btn').addEventListener('click', () => { sfx.click(); goHome(); });
$('resume-btn').addEventListener('click', () => { sfx.click(); togglePause(); });
pauseBtn.addEventListener('click', () => togglePause());

soundBtn.addEventListener('click', () => {
  getAudioCtx();
  saved.soundOn = !saved.soundOn;
  updateSoundBtns();
  persist();
  sfx.click();
});

musicBtn.addEventListener('click', () => {
  getAudioCtx();
  saved.musicOn = !saved.musicOn;
  updateSoundBtns();
  persist();
  sfx.click();
});

if (volumeRange) {
  volumeRange.addEventListener('input', () => {
    getAudioCtx();
    saved.volume = Number(volumeRange.value) / 100;
    updateSoundBtns();
    persist();
  });
}

$('back-to-hub-btn').addEventListener('click', () => { sfx.click(); location.href = 'index.html'; });

// Mağaza butonları
$('shop-btn').addEventListener('click', () => openShop('skins'));
$('menu-coin-pill').addEventListener('click', () => openShop('skins'));
$('shop-close-btn').addEventListener('click', () => { sfx.click(); hide(shopScreen); });
document.querySelectorAll('.shop-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    sfx.click();
    currentShopTab = btn.dataset.tab;
    document.querySelectorAll('.shop-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderShopList();
  });
});

// Skor tablosu butonları
$('lb-btn').addEventListener('click', () => {
  sfx.click();
  renderLeaderboard();
  show(lbScreen);
});
$('lb-close-btn').addEventListener('click', () => { sfx.click(); hide(lbScreen); });
if ($('save-score-btn')) {
  $('save-score-btn').addEventListener('click', saveCurrentScore);
}
if ($('player-name')) {
  $('player-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveCurrentScore();
  });
}

// İstatistik ekranı + Hayalet Kuş ayarı
function updateGhostBtn() {
  const btn = $('ghost-toggle-btn');
  if (btn) btn.textContent = F.ghostOn !== false ? '👻 Hayalet Rekor Kuşu: Açık' : '👻 Hayalet Rekor Kuşu: Kapalı';
}

$('stats-btn').addEventListener('click', () => {
  sfx.click();
  $('st-best').textContent = F.bestScore;
  $('st-games').textContent = F.games;
  const t = F.totalTime;
  $('st-time').textContent = t >= 60 ? Math.floor(t / 60) + ' dk ' + Math.round(t % 60) + ' sn' : Math.round(t) + ' sn';
  if ($('st-coins')) $('st-coins').textContent = F.totalCoins || F.coins || 0;
  if ($('st-combo')) $('st-combo').textContent = F.bestCombo || 0;
  $('st-recent').textContent = F.recentScores.length ? F.recentScores.join(' · ') : '-';
  updateGhostBtn();
  show(statsScreen);
});
$('stats-close-btn').addEventListener('click', () => { sfx.click(); hide(statsScreen); });

if ($('ghost-toggle-btn')) {
  $('ghost-toggle-btn').addEventListener('click', () => {
    sfx.click();
    F.ghostOn = F.ghostOn === false;
    updateGhostBtn();
    persist();
  });
}

document.querySelectorAll('#menu-screen .diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    sfx.click();
    document.querySelectorAll('#menu-screen .diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    F.difficulty = btn.dataset.diff;
    persist();
  });
});

document.querySelectorAll('#menu-skin-row .skin-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.skin;
    if (!F.unlockedSkins.includes(key)) {
      openShop('skins', `🔒 ${SKINS[key].name} kostümünü ${SKINS[key].cost} 🪙 ile açabilirsin!`);
      return;
    }
    sfx.click();
    F.skin = key;
    persist();
    renderMenuSkins();
  });
});

function goHome() {
  state = STATE.MENU;
  hide(hud); hide(gameoverScreen); hide(pauseScreen);
  hide(shopScreen); hide(lbScreen); hide(statsScreen);
  $('best-score-display').textContent = `🏆 Rekor: ${F.bestScore}`;
  updateCoinUI();
  renderMenuSkins();
  show(menuScreen);
}

// =====================================================
//            ÇEVRİMİÇİ DÜELLO (PeerJS)
// Ekran yüksekliğinden bağımsız normalize koordinat +
// akıcı interpolasyon + özel oyuncu adı & kostüm!
// =====================================================
const MP = {
  peer: null,
  conn: null,
  isHost: false,
  connected: false,
  roomCode: '',
  myName: 'Sen',
  oppName: 'Rakip',
  oppScore: 0,
  oppAlive: true,
  oppBird: { x: 118, y: 280, tx: 118, ty: 280, rot: 0, trot: 0, skin: 'yellow' },
  seed: 0,
  matchDiff: null,
  rematchVotes: 0,
  oppRematch: false
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
  const val = (inp ? inp.value.trim() : '') || F.playerName || '';
  if (val) {
    F.playerName = val.slice(0, 12);
    persist();
    return F.playerName;
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
  mpClearTimers();
  mpReleaseWakeLock();
  if (MP.conn) { try { MP.conn.close(); } catch (e) {} }
  if (MP.peer) { try { MP.peer.destroy(); } catch (e) {} }
  MP.conn = null; MP.peer = null;
  MP.connected = false; MP.isHost = false;
}

function mpSend(data) {
  if (MP.conn && MP.connected) {
    try { MP.conn.send(data); } catch (e) {}
  }
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
  const text = `🐦 Flappy Kuş düellosuna gel! Oda Kodu: ${MP.roomCode}`;
  if (typeof navigator !== 'undefined' && navigator.share) {
    navigator.share({ title: 'Flappy Kuş Düello', text, url }).catch(() => {});
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
  hide(menuScreen);
  show(mpScreen);
  show($('mp-lobby'));
  show($('mp-btn-row'));
  $('mp-error').textContent = '';
  hide($('mp-host-area'));
  hide($('mp-join-area'));
  $('mp-join-status').textContent = '';
  $('mp-code-input').value = '';
  if ($('mp-name-input')) $('mp-name-input').value = F.playerName || '';
  state = STATE.MP;
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

  const peer = new Peer('flappy-' + MP.roomCode, MP_PEER_OPTS);
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

  // Ev sahibi WhatsApp'tayken zombi sokette takılı kalırsa 3.8sn sonra yeniden dene
  mpJoinTimer = setTimeout(() => {
    if (!MP.connected && MP.peer === peer) retryOrFail('Oda yanıt vermedi, kodu ve ev sahibinin ekranını kontrol et.');
  }, 3800);

  peer.on('open', () => {
    if (MP.peer !== peer || MP.connected) return;
    const conn = peer.connect('flappy-' + MP.roomCode, { reliable: true });
    MP.conn = conn;
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
  if (code.length !== 5) {
    $('mp-join-status').textContent = '5 haneli kod gir!';
    return;
  }
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

function setupConn() {
  MP.conn.on('open', () => {
    mpClearTimers();
    mpHostWaiting = false;
    MP.connected = true;
    mpSend({ t: 'hello', skin: F.skin, name: MP.myName });
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
        MP.oppBird.skin = data.skin || 'yellow';
        if (data.name) MP.oppName = String(data.name).slice(0, 12);
        if (MP.isHost && !mpHelloFromGuest && typeof data.seed !== 'number') {
          mpHelloFromGuest = true;
          mpBeginMatch();
        }
        break;
      case 'match':
        if (!MP.isHost) {
          MP.connected = true;
          MP.seed = data.seed;
          MP.matchDiff = data.diff || F.difficulty;
          MP.oppBird.skin = data.skin || 'yellow';
          if (data.name) MP.oppName = String(data.name).slice(0, 12);
          mpBeginMatch();
        }
        break;
      case 'bird': {
        const tx = typeof data.nx === 'number' ? data.nx * W : data.x;
        const ty = typeof data.ny === 'number' ? data.ny * playH() : data.y;
        MP.oppBird.tx = tx;
        MP.oppBird.ty = ty;
        MP.oppBird.trot = data.r || 0;
        if (MP.oppAlive && !data.a) {
          spawnFeathers(MP.oppBird.x, MP.oppBird.y, MP.oppBird.skin, 7);
        }
        MP.oppAlive = data.a;
        break;
      }
      case 'score':
        MP.oppScore = data.s;
        break;
      case 'gameover':
        if (MP.oppAlive) spawnFeathers(MP.oppBird.x, MP.oppBird.y, MP.oppBird.skin, 8);
        MP.oppScore = data.s;
        MP.oppAlive = false;
        if (state === STATE.GAMEOVER && MP.connected && !mpGameoverScreen.classList.contains('hidden')) {
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
      hide($('mp-opp-bar'));
      hide(mpGameoverScreen);
      goHome();
    }
  });
}

function mpStartMatchUI() {
  let bar = $('mp-opp-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'mp-opp-bar';
    bar.className = 'mp-opp-bar';
    document.getElementById('game-wrapper').appendChild(bar);
  }
  bar.innerHTML = `👻 <span id="mp-opp-bar-name"></span>: <span class="opp-score" id="mp-opp-live">0</span>`;
  $('mp-opp-bar-name').textContent = MP.oppName;
  show(bar);
}

function mpUpdateLiveBar() {
  const el = $('mp-opp-live');
  if (el) el.textContent = MP.oppScore + (MP.oppAlive ? '' : ' ☠');
}

function mpOnScore() {
  if (!MP.connected) return;
  mpSend({ t: 'score', s: score });
}

function mpOnDeath() {
  if (!MP.connected) return;
  mpSend({ t: 'gameover', s: score });
  $('mp-final-me').textContent = score;
  $('mp-me-label').textContent = MP.myName || 'Sen';
  $('mp-final-opp').textContent = MP.oppScore;
  $('mp-opp-label').textContent = MP.oppName || 'Rakip';

  if (MP.oppAlive) {
    $('mp-result-text').textContent = `${MP.oppName} hâlâ uçuyor... sonuç bekleniyor!`;
    hide(gameoverScreen);
    show(mpGameoverScreen);
    hide(hud);
  } else {
    mpFinishDuel();
  }
}

function mpFinishDuel() {
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
  hide(mpGameoverScreen);
  hide($('mp-opp-bar'));
  goHome();
}

let mpCountdown = 0;

function mpBeginMatch() {
  if (MP.isHost) {
    MP.seed = Math.floor(Math.random() * 1e9);
    MP.matchDiff = F.difficulty;
    mpSend({ t: 'match', seed: MP.seed, diff: F.difficulty, skin: F.skin, name: MP.myName });
  }
  startGame();
  MP.oppBird.x = MP.oppBird.tx = W * 0.28;
  MP.oppBird.y = MP.oppBird.ty = playH() * 0.47;
  MP.oppBird.rot = MP.oppBird.trot = 0;
  mpStartMatchUI();
  mpCountdown = 3 * 60;
  MP.oppAlive = true;
  MP.oppScore = 0;
  MP.oppRematch = false;
  MP.rematchVotes = 0;
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
  const scale = 0.8 + 0.5 * phase;
  ctx.save();
  ctx.globalAlpha = 0.4 + 0.6 * phase;
  ctx.translate(W / 2, H * 0.35);
  ctx.scale(scale, scale);
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
  ctx.fillText('Hazırlan... maç eşzamanlı başlayacak!', W / 2, H * 0.35 + 34);
  ctx.textAlign = 'left';
}

function mpTick() {
  if (!MP.connected) return;
  mpSend({
    t: 'bird',
    nx: Math.round((bird.x / Math.max(1, W)) * 1000) / 1000,
    ny: Math.round((bird.y / Math.max(1, playH())) * 1000) / 1000,
    r: Math.round(bird.rot * 100) / 100,
    a: (state === STATE.PLAYING || state === STATE.READY)
  });
  mpUpdateLiveBar();
}

$('mp-btn').addEventListener('click', mpOpenUI);
$('mp-host-btn').addEventListener('click', mpHost);
$('mp-join-btn').addEventListener('click', mpJoin);
$('mp-join-confirm').addEventListener('click', mpJoinConfirm);
if ($('mp-copy-btn')) $('mp-copy-btn').addEventListener('click', mpCopyCode);
if ($('mp-share-btn')) $('mp-share-btn').addEventListener('click', mpShareInvite);
$('mp-code-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') mpJoinConfirm();
});
$('mp-quit-btn').addEventListener('click', () => {
  sfx.click();
  mpCleanup();
  hide(mpScreen);
  show($('mp-btn-row'));
  hide($('mp-host-area'));
  hide($('mp-join-area'));
  $('mp-error').textContent = '';
  goHome();
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

  document.querySelectorAll('#menu-screen .diff-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.diff === F.difficulty);
  });
  updateSoundBtns();
  updateCoinUI();
  renderMenuSkins();
  updateGhostBtn();
  $('best-score-display').textContent = `🏆 Rekor: ${F.bestScore}`;

  initWorld();
  ensureMusicLoop();
  show(menuScreen);

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
