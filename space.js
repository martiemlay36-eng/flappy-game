"use strict";

/* =====================================================
   UZAY AVCISI (SPACE SHOOTER ULTRA) — Oyun Salonu 4. Oyunu
   - 60 FPS Neon Vektör Grafik Motoru:
     * Çok katmanlı paralaks yıldız alanı, bulutsu (nebula) bulutları & siber ızgara
     * 6 açılabilir uzay gemisi, yatış (bank) animasyonu, itici plazma alevi & art-görüntü
     * Lv.1..Lv.4 otomatik lazer yükseltmeleri, 5 güçlendirme, şarjlı 💥 EMP Süper Bomba
     * 5 düşman sınıfı + her dalga sonunda çok fazlı Mega Dreadnought Boss savaşları!
   - Mobil Hassasiyet Mükemmelliği:
     * 2B Göreceli Trackpad sürükleme (parmak gemiyi kapatmaz, zıplama yapmaz)
     * Canlı ayarlanabilir Hassasiyet Sürgüsü (%60–%220) + Doğrudan mod + Klavye (WASD/Oklar)
   - MPCore Tam Entegre Çevrimiçi Filo Düellosu (PeerJS):
     * Sabit 420×700 sanal uzay simülasyonu ile masaüstü & mobil %100 adil eşzamanlı dalgalar
     * Kanat arkadaşı hayalet gemisi & canlı lazer atışları
     * Erken elenince Canlı İzleyici Modu (Spectator), QR Kod, Canlı Ping & Oyunlar Arası Oda Taşıma
   ===================================================== */

// ---------- Sabit Sanal Uzay Boyutu (Çapraz Cihaz %100 Adalet) ----------
const VIRT_W = 420;
const VIRT_H = 700;

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
let W = 420, H = 700, DPR = 1;

function sx(v) { return v * (W / VIRT_W); }
function sy(v) { return v * (H / VIRT_H); }
function sr(v) { return v * Math.min(W / VIRT_W, H / VIRT_H); }

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = rect.width || 420;
  H = rect.height || 700;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

// ---------- DOM ----------
const $ = id => document.getElementById(id);
const hud = $('hud'), menuScreen = $('menu-screen'), gameoverScreen = $('gameover-screen');
const pauseScreen = $('pause-screen'), shopScreen = $('shop-screen');
const lbScreen = $('leaderboard-screen'), statsScreen = $('stats-screen');
const mpScreen = $('mp-screen'), mpGameoverScreen = $('mp-gameover-screen');
const tapHint = $('tap-hint'), empBtn = $('emp-btn'), pauseBtn = $('pause-btn');
const soundBtn = $('sound-btn'), musicBtn = $('music-btn');
const volumeRange = $('volume-range'), volumeIcon = $('volume-icon');
const sensRange = $('sens-range'), sensLabel = $('sens-label');
const pauseSensRange = $('pause-sens-range'), pauseSensLabel = $('pause-sens-label');
const ctrlModeBtn = $('ctrl-mode-btn'), pauseCtrlBtn = $('pause-ctrl-btn');

function show(el) { if (el) el.classList.remove('hidden'); }
function hide(el) { if (el) el.classList.add('hidden'); }

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- Gemiler & Galaksi Sektörleri ----------
const SHIPS = {
  falcon: {
    name: 'Şahin Avcı', emoji: '🚀', cost: 0,
    hull: '#00e5ff', wing: '#0077ff', cockpit: '#e0ffff', laser: '#00f5d4', flame: '#00d2ff',
    desc: 'Dengeli plazma avcı gemisi'
  },
  phoenix: {
    name: 'Kızıl Anka', emoji: '🔥', cost: 45,
    hull: '#ff4d4d', wing: '#ff9900', cockpit: '#fff3b0', laser: '#ff7b00', flame: '#ffbe0b',
    desc: 'Ateş kanatlı taarruz gemisi'
  },
  phantom: {
    name: 'Mor Hayalet', emoji: '👾', cost: 85,
    hull: '#b5179e', wing: '#7209b7', cockpit: '#f72585', laser: '#ff5de8', flame: '#e0aaff',
    desc: 'Gizli siber hayalet avcı'
  },
  frost: {
    name: 'Buzul Kruvazör', emoji: '❄️', cost: 130,
    hull: '#80ffdb', wing: '#48bfe3', cockpit: '#ffffff', laser: '#90e0ef', flame: '#caf0f8',
    desc: 'Kriyojenik kalkan kruvazörü'
  },
  titan: {
    name: 'Altın Titan', emoji: '👑', cost: 190,
    hull: '#ffd700', wing: '#ff9e00', cockpit: '#ffffff', laser: '#ffe600', flame: '#ffaa00',
    desc: 'Kraliyet altın zırhlısı'
  },
  nova: {
    name: 'Süpernova X', emoji: '🌟', cost: 260,
    hull: '#ff007f', wing: '#00f5d4', cockpit: '#fff75e', laser: '#7bf1a8', flame: '#ff66c4',
    desc: 'Prizmatik hiper-çekirdek prototipi'
  }
};

const SECTORS = {
  nebula: {
    name: 'Derin Bulutsu', emoji: '🌌', cost: 0,
    bg0: '#030614', bg1: '#09142e', bg2: '#130b2e',
    nebulaA: 'rgba(0, 195, 255, 0.14)', nebulaB: 'rgba(155, 45, 255, 0.14)',
    grid: 'rgba(0, 210, 255, 0.06)', starTint: '#d8f3ff',
    desc: 'Mavi-mor yıldızlararası bulutsu'
  },
  crimson: {
    name: 'Kızıl Yörünge', emoji: '☄️', cost: 60,
    bg0: '#140308', bg1: '#2a0814', bg2: '#3b120c',
    nebulaA: 'rgba(255, 65, 90, 0.16)', nebulaB: 'rgba(255, 155, 40, 0.13)',
    grid: 'rgba(255, 90, 70, 0.07)', starTint: '#ffe3d8',
    desc: 'Volkanik süpernova kalıntıları'
  },
  cyber: {
    name: 'Siber Matris', emoji: '⚡', cost: 110,
    bg0: '#050214', bg1: '#150630', bg2: '#290a4a',
    nebulaA: 'rgba(255, 0, 180, 0.16)', nebulaB: 'rgba(0, 245, 212, 0.13)',
    grid: 'rgba(255, 0, 180, 0.11)', starTint: '#ffd6ff',
    desc: 'Neon synthwave hiper-uzay ağı'
  },
  emerald: {
    name: 'Zümrüt Kuasar', emoji: '🧪', cost: 160,
    bg0: '#02120e', bg1: '#072920', bg2: '#0c3d2e',
    nebulaA: 'rgba(0, 245, 160, 0.15)', nebulaB: 'rgba(0, 180, 216, 0.13)',
    grid: 'rgba(80, 255, 180, 0.08)', starTint: '#d8fff0',
    desc: 'Radyoaktif kuasar fırtınası'
  }
};

const DIFFICULTIES = {
  easy:   { label: 'Kolay',  spawnInt: 52, enemySpd: 0.82, bulletSpd: 0.80, hpMul: 0.85, fireRateMul: 0.72 },
  normal: { label: 'Normal', spawnInt: 40, enemySpd: 1.00, bulletSpd: 1.00, hpMul: 1.00, fireRateMul: 1.00 },
  hard:   { label: 'Zor',    spawnInt: 31, enemySpd: 1.22, bulletSpd: 1.20, hpMul: 1.20, fireRateMul: 1.28 }
};

const POWERUPS = {
  weapon: { emoji: '🔫', label: 'Silah +1', color: '#ff9e00', dur: 0 },
  shield: { emoji: '🛡️', label: 'Kalkan',   color: '#00e5ff', dur: 0 },
  rapid:  { emoji: '⚡', label: 'Seri Ateş', color: '#ffe600', dur: 450 },
  magnet: { emoji: '🧲', label: 'Mıknatıs', color: '#ff4d94', dur: 520 },
  x2:     { emoji: '✨', label: '2x Skor',  color: '#b5179e', dur: 480 }
};

// ---------- Kalıcı Veri (oyun-salonu-v2 uyumlu) ----------
const STORAGE_KEY = 'oyun-salonu-v2';

function defaultSaved() {
  return {
    bestScore: 0,
    coins: 0,
    totalCoins: 0,
    games: 0,
    totalKills: 0,
    bossKills: 0,
    bestWave: 1,
    bestCombo: 0,
    difficulty: 'normal',
    ctrlMode: 'trackpad',
    sensitivity: 1.35,
    ship: 'falcon',
    unlockedShips: ['falcon'],
    sector: 'nebula',
    unlockedSectors: ['nebula'],
    playerName: '',
    scoreboard: []
  };
}

let audioSettings = { soundOn: true, musicOn: true, volume: 0.7 };

function loadSaved() {
  const d = defaultSaved();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const root = JSON.parse(raw);
      if (root && typeof root === 'object') {
        if (typeof root.soundOn === 'boolean') audioSettings.soundOn = root.soundOn;
        if (typeof root.musicOn === 'boolean') audioSettings.musicOn = root.musicOn;
        if (typeof root.volume === 'number') audioSettings.volume = Math.max(0, Math.min(1, root.volume));
        const fallbackName =
          (root.flappy && root.flappy.playerName) ||
          (root.snake && root.snake.playerName) ||
          (root.pong && root.pong.playerName) || '';
        if (root.space && typeof root.space === 'object') {
          Object.keys(d).forEach(k => {
            if (root.space[k] !== undefined) d[k] = root.space[k];
          });
        }
        if (!d.playerName && fallbackName) d.playerName = fallbackName;
      }
    }
  } catch (e) {}
  if (!SHIPS[d.ship]) d.ship = 'falcon';
  if (!Array.isArray(d.unlockedShips) || !d.unlockedShips.includes('falcon')) d.unlockedShips = ['falcon'];
  if (!SECTORS[d.sector]) d.sector = 'nebula';
  if (!Array.isArray(d.unlockedSectors) || !d.unlockedSectors.includes('nebula')) d.unlockedSectors = ['nebula'];
  if (!DIFFICULTIES[d.difficulty]) d.difficulty = 'normal';
  if (d.ctrlMode !== 'trackpad' && d.ctrlMode !== 'direct') d.ctrlMode = 'trackpad';
  d.sensitivity = Math.max(0.6, Math.min(2.2, Number(d.sensitivity) || 1.35));
  if (!Array.isArray(d.scoreboard)) d.scoreboard = [];
  return d;
}

const SP = loadSaved();

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
    if (typeof root.space !== 'object' || !root.space) root.space = {};
    Object.assign(root.space, SP);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
  } catch (e) {}
}

// ---------- Deterministik PRNG (Çevrimiçi %100 Aynı Dalgalar & Boss) ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let waveRng = Math.random;

// ---------- Ses & Synthwave Müzik Motoru (Web Audio API) ----------
let audioCtx = null;
function getAC() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      try { audioCtx = new Ctx(); } catch (e) {}
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    try { audioCtx.resume(); } catch (e) {}
  }
  return audioCtx;
}

function tone(freq, dur, type = 'sine', gainVal = 0.12, slideTo = null, delay = 0) {
  if (!audioSettings.soundOn || audioSettings.volume <= 0.001) return;
  const ac = getAC();
  if (!ac) return;
  try {
    const t0 = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    const v = Math.min(0.5, gainVal * audioSettings.volume);
    g.gain.setValueAtTime(v, t0);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.015);
  } catch (e) {}
}

const sfx = {
  click:   () => tone(660, 0.05, 'triangle', 0.12, 880),
  laser:   (wlv) => tone(780 + (wlv || 1) * 70, 0.065, 'sawtooth', 0.055, 290),
  hit:     () => tone(210, 0.06, 'square', 0.08, 110),
  boom:    (big) => {
    tone(big ? 120 : 175, big ? 0.28 : 0.14, 'sawtooth', big ? 0.20 : 0.12, 38);
    if (big) tone(90, 0.34, 'triangle', 0.18, 28, 0.04);
  },
  hurt:    () => {
    tone(190, 0.18, 'sawtooth', 0.22, 65);
    tone(140, 0.22, 'square', 0.16, 52, 0.06);
  },
  shield:  () => { tone(520, 0.10, 'sine', 0.15, 960); tone(960, 0.12, 'triangle', 0.12, 640, 0.06); },
  power:   () => { tone(523, 0.08, 'triangle', 0.14, 659); tone(659, 0.10, 'triangle', 0.14, 1046, 0.07); },
  coin:    () => { tone(988, 0.06, 'sine', 0.12); tone(1319, 0.11, 'sine', 0.12, null, 0.05); },
  emp:     () => {
    tone(140, 0.42, 'sawtooth', 0.24, 880);
    tone(640, 0.38, 'sine', 0.20, 75, 0.06);
  },
  bossWarn: () => {
    tone(220, 0.18, 'sawtooth', 0.18, 180);
    tone(220, 0.18, 'sawtooth', 0.18, 180, 0.22);
  },
  buy:     () => { tone(587, 0.08, 'triangle', 0.15); tone(880, 0.14, 'triangle', 0.16, null, 0.07); },
  gameover: () => {
    tone(392, 0.16, 'sawtooth', 0.16, 330);
    tone(330, 0.18, 'sawtooth', 0.16, 262, 0.15);
    tone(262, 0.30, 'sawtooth', 0.18, 140, 0.32);
  },
  win:     () => {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.13, 'triangle', 0.15, null, i * 0.08));
  }
};

let musicTimer = null;
let musicStep = 0;
const ARP_NOTES = [130.81, 164.81, 196.00, 246.94, 261.63, 246.94, 196.00, 164.81,
                   146.83, 174.61, 220.00, 261.63, 293.66, 261.63, 220.00, 174.61];

function ensureMusicLoop() {
  if (musicTimer) return;
  musicTimer = setInterval(() => {
    if (!audioSettings.musicOn || audioSettings.volume <= 0.001) return;
    if (state !== STATE.PLAYING && state !== STATE.READY) return;
    if (!audioCtx || audioCtx.state !== 'running') return;
    const f = ARP_NOTES[musicStep % ARP_NOTES.length];
    musicStep++;
    try {
      const t0 = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = (musicStep % 4 === 1) ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(musicStep % 4 === 1 ? f * 0.5 : f, t0);
      const v = 0.032 * audioSettings.volume;
      g.gain.setValueAtTime(v, t0);
      g.gain.exponentialRampToValueAtTime(0.0006, t0 + 0.16);
      osc.connect(g);
      g.connect(audioCtx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.17);
    } catch (e) {}
  }, 185);
  if (musicTimer && typeof musicTimer.unref === 'function') musicTimer.unref();
}

// ---------- Oyun Durumu & Nesneler ----------
const STATE = { MENU: 0, READY: 1, PLAYING: 2, PAUSED: 3, GAMEOVER: 4, MP: 5 };
let state = STATE.MENU;

let currentDiff = 'normal';
let currentSector = 'nebula';
let frames = 0;
let runFrames = 0;
let spawnsCount = 0;
let wave = 1;
let score = 0;
let runCoins = 0;
let runKills = 0;
let runBosses = 0;
let combo = 0;
let comboTimer = 0;
let empCharge = 100; // İlk oyuna tam dolu 💥 EMP ile başla!
let scoreSavedThisRun = false;

let flashAlpha = 0;
let flashColor = '#ffffff';
let shakeT = 0;
let bossBannerFrames = 0;

const player = {
  x: VIRT_W * 0.5,
  y: VIRT_H * 0.80,
  tx: VIRT_W * 0.5,
  ty: VIRT_H * 0.80,
  vx: 0,
  vy: 0,
  r: 15,
  hp: 3,
  maxHp: 3,
  invuln: 0,
  weaponLv: 1,
  shield: false,
  rapidTimer: 0,
  magnetTimer: 0,
  x2Timer: 0,
  fireCd: 0,
  bank: 0,
  trail: []
};

let bullets = [];      // {x, y, vx, vy, r, dmg, color, friendly}
let eBullets = [];     // {x, y, vx, vy, r, color}
let enemies = [];      // {id, type, x, y, vx, vy, r, hp, maxHp, rot, fireCd, phase, color, pts, dropRoll, dropType}
let boss = null;       // {x, y, vx, r, hp, maxHp, fireCd, phase, rot, waveNum}
let pickups = [];      // {x, y, vx, vy, kind, r, bob}
let particles = [];    // {x, y, vx, vy, r, color, life, maxLife}
let shockwaves = [];   // {x, y, r, maxR, color, life, maxLife}
let popups = [];       // {x, y, txt, color, life}

// Paralaks Yıldızlar & Bulutsu Katmanları (0..1 normalize koordinat)
const stars = [];
const nebulas = [];
function initStarfield() {
  stars.length = 0;
  for (let i = 0; i < 75; i++) {
    const layer = i < 35 ? 0 : (i < 60 ? 1 : 2);
    stars.push({
      nx: Math.random(),
      ny: Math.random(),
      sp: [0.0012, 0.0028, 0.0056][layer],
      r: [1.0, 1.5, 2.2][layer],
      tw: Math.random() * Math.PI * 2
    });
  }
  nebulas.length = 0;
  for (let i = 0; i < 4; i++) {
    nebulas.push({
      nx: 0.18 + (i * 0.23) % 0.72,
      ny: i * 0.27,
      r: 0.34 + (i % 2) * 0.12,
      sp: 0.00065 + i * 0.00018,
      alt: i % 2 === 1
    });
  }
}

// ---------- Yardımcı Efekt Üreticileri ----------
function spawnExplosion(vx, vy, color, count = 14, speedMul = 1) {
  for (let i = 0; i < count; i++) {
    const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
    const sp = (1.4 + Math.random() * 4.2) * speedMul;
    const life = 18 + Math.floor(Math.random() * 18);
    particles.push({
      x: vx, y: vy,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      r: 1.8 + Math.random() * 2.6,
      color,
      life, maxLife: life
    });
  }
}

function spawnShock(vx, vy, color, maxR = 68, life = 22) {
  shockwaves.push({ x: vx, y: vy, r: 6, maxR, color, life, maxLife: life });
}

function addPopup(vx, vy, txt, color = '#ffd700') {
  popups.push({ x: vx, y: vy, txt, color, life: 42 });
}

// ---------- HUD & Arayüz Güncellemeleri ----------
function updateCoinUI() {
  if ($('menu-coins')) $('menu-coins').textContent = SP.coins;
  if ($('shop-coins')) $('shop-coins').textContent = SP.coins;
  if ($('hud-coins')) $('hud-coins').textContent = SP.coins;
}

function updateHpUI() {
  const el = $('hud-hp');
  if (!el) return;
  let hearts = '';
  for (let i = 0; i < player.maxHp; i++) {
    hearts += i < player.hp ? '❤️' : '🖤';
  }
  if (player.shield) hearts += '🛡️';
  el.textContent = hearts;
}

function updateScoreUI() {
  if ($('score-display')) $('score-display').textContent = score;
  const cb = $('hud-combo');
  if (cb) {
    if (combo >= 2) {
      const mult = Math.min(5, 1 + Math.floor(combo / 4));
      cb.textContent = `🔥 x${mult} (${combo})`;
      show(cb);
    } else {
      hide(cb);
    }
  }
}

function updatePowerBadgesUI() {
  const box = $('power-badges');
  if (!box) return;
  const parts = [];
  if (player.weaponLv > 1) {
    parts.push(`<div class="p-badge" style="border-color:#ff9e00">🔫 Lv.${player.weaponLv}</div>`);
  }
  if (player.rapidTimer > 0) {
    parts.push(`<div class="p-badge" style="border-color:#ffe600">⚡ ${Math.ceil(player.rapidTimer / 60)}s</div>`);
  }
  if (player.magnetTimer > 0) {
    parts.push(`<div class="p-badge" style="border-color:#ff4d94">🧲 ${Math.ceil(player.magnetTimer / 60)}s</div>`);
  }
  if (player.x2Timer > 0) {
    parts.push(`<div class="p-badge" style="border-color:#d580ff">✨ 2x ${Math.ceil(player.x2Timer / 60)}s</div>`);
  }
  box.innerHTML = parts.join('');
}

function updateEmpUI() {
  if (!empBtn) return;
  const pct = Math.min(100, Math.floor(empCharge));
  if (pct >= 100) {
    empBtn.classList.add('ready');
    empBtn.textContent = '💥';
    empBtn.title = 'EMP Süper Bomba Hazır! (Boşluk / B)';
  } else {
    empBtn.classList.remove('ready');
    empBtn.textContent = `${pct}%`;
    empBtn.title = `EMP Şarj Oluyor: %${pct}`;
  }
}

function updateSettingsUI() {
  const pct = Math.round(SP.sensitivity * 100);
  if (sensRange) sensRange.value = String(pct);
  if (pauseSensRange) pauseSensRange.value = String(pct);
  if (sensLabel) sensLabel.textContent = `📱 Hassasiyet: %${pct}`;
  if (pauseSensLabel) pauseSensLabel.textContent = `📱 Hassasiyet: %${pct}`;

  const modeTxt = SP.ctrlMode === 'trackpad' ? '🎯 Kontrol: Trackpad' : '👆 Kontrol: Doğrudan';
  if (ctrlModeBtn) ctrlModeBtn.textContent = modeTxt;
  if (pauseCtrlBtn) pauseCtrlBtn.textContent = modeTxt;

  if (soundBtn) soundBtn.textContent = audioSettings.soundOn ? '🔊 Efekt: Açık' : '🔇 Efekt: Kapalı';
  if (musicBtn) musicBtn.textContent = audioSettings.musicOn ? '🎵 Müzik: Açık' : '🎵 Müzik: Kapalı';
  if (volumeRange) volumeRange.value = String(Math.round(audioSettings.volume * 100));
  if (volumeIcon) volumeIcon.textContent = audioSettings.volume <= 0.01 ? '🔇' : (audioSettings.volume < 0.5 ? '🔉' : '🔊');

  document.querySelectorAll('#diff-tabs .diff-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.diff === SP.difficulty);
  });
  if ($('best-score-display')) {
    $('best-score-display').textContent = `🏆 Rekor: ${SP.bestScore} · En Yüksek Dalga: ${SP.bestWave}`;
  }
  updateCoinUI();
  renderMenuSkins();
}

function renderMenuSkins() {
  document.querySelectorAll('#menu-skin-row .skin-btn').forEach(btn => {
    const key = btn.dataset.skin;
    const sh = SHIPS[key];
    if (!sh) return;
    const unlocked = SP.unlockedShips.includes(key);
    btn.style.background = `radial-gradient(circle at 35% 30%, ${sh.hull}, ${sh.wing})`;
    btn.textContent = unlocked ? sh.emoji : '🔒';
    btn.classList.toggle('active', SP.ship === key);
    btn.classList.toggle('locked', !unlocked);
  });
}

// ---------- Oyun Başlatma & Sıfırlama ----------
function resetRunState(seedVal) {
  waveRng = (typeof seedVal === 'number') ? mulberry32(seedVal) : Math.random;
  runFrames = 0;
  spawnsCount = 0;
  wave = 1;
  score = 0;
  runCoins = 0;
  runKills = 0;
  runBosses = 0;
  combo = 0;
  comboTimer = 0;
  empCharge = 100;
  scoreSavedThisRun = false;
  bossBannerFrames = 0;
  flashAlpha = 0;
  shakeT = 0;

  player.x = VIRT_W * 0.5;
  player.y = VIRT_H * 0.80;
  player.tx = player.x;
  player.ty = player.y;
  player.vx = 0;
  player.vy = 0;
  player.hp = 3;
  player.maxHp = 3;
  player.invuln = 45;
  player.weaponLv = 1;
  player.shield = false;
  player.rapidTimer = 0;
  player.magnetTimer = 0;
  player.x2Timer = 0;
  player.fireCd = 0;
  player.bank = 0;
  player.trail = [];

  bullets = [];
  eBullets = [];
  enemies = [];
  boss = null;
  pickups = [];
  particles = [];
  shockwaves = [];
  popups = [];

  updateHpUI();
  updateScoreUI();
  updatePowerBadgesUI();
  updateEmpUI();
  updateCoinUI();
}

function startGame() {
  getAC();
  const isMP = MP.connected || MP.reconnecting;
  currentDiff = isMP ? (MP.matchDiff || MP.lobbyDiff || SP.difficulty) : SP.difficulty;
  currentSector = isMP ? (MP.matchSector || MP.lobbySector || SP.sector) : SP.sector;
  if (!DIFFICULTIES[currentDiff]) currentDiff = 'normal';
  if (!SECTORS[currentSector]) currentSector = 'nebula';

  resetRunState(isMP ? MP.seed : undefined);

  hide(menuScreen);
  hide(gameoverScreen);
  hide(mpGameoverScreen);
  hide(pauseScreen);
  hide(shopScreen);
  hide(lbScreen);
  hide(statsScreen);
  hide(mpScreen);
  show(hud);
  if (pauseBtn) pauseBtn.style.display = isMP ? 'none' : '';

  if (isMP && mpCountdown > 0) {
    state = STATE.READY;
  } else {
    state = STATE.PLAYING;
    show(tapHint);
    setTimeout(() => hide(tapHint), 2600);
  }
}

// ---------- Ateşleme & 💥 EMP Süper Bomba ----------
function firePlayerWeapons() {
  const sh = SHIPS[SP.ship] || SHIPS.falcon;
  const col = sh.laser;
  const x = player.x;
  const y = player.y - 16;
  const lv = player.weaponLv;

  if (lv === 1) {
    bullets.push({ x, y, vx: 0, vy: -11.5, r: 3.6, dmg: 1, color: col });
  } else if (lv === 2) {
    bullets.push({ x: x - 9, y: y + 3, vx: 0, vy: -11.8, r: 3.5, dmg: 1, color: col });
    bullets.push({ x: x + 9, y: y + 3, vx: 0, vy: -11.8, r: 3.5, dmg: 1, color: col });
  } else if (lv === 3) {
    bullets.push({ x, y: y - 2, vx: 0, vy: -12.2, r: 4.0, dmg: 1.25, color: col });
    bullets.push({ x: x - 11, y: y + 4, vx: -1.35, vy: -11.5, r: 3.4, dmg: 1, color: col });
    bullets.push({ x: x + 11, y: y + 4, vx:  1.35, vy: -11.5, r: 3.4, dmg: 1, color: col });
  } else {
    bullets.push({ x: x - 6, y: y - 2, vx: 0, vy: -12.6, r: 3.8, dmg: 1.2, color: col });
    bullets.push({ x: x + 6, y: y - 2, vx: 0, vy: -12.6, r: 3.8, dmg: 1.2, color: col });
    bullets.push({ x: x - 15, y: y + 5, vx: -2.1, vy: -11.4, r: 3.4, dmg: 1.0, color: '#ffe600' });
    bullets.push({ x: x + 15, y: y + 5, vx:  2.1, vy: -11.4, r: 3.4, dmg: 1.0, color: '#ffe600' });
  }
  sfx.laser(lv);
}

function triggerEMP() {
  if (state !== STATE.PLAYING || MP.spectating || MP.reconnecting) return;
  if (empCharge < 100) return;

  empCharge = 0;
  updateEmpUI();
  sfx.emp();
  flashColor = '#00e5ff';
  flashAlpha = 0.55;
  shakeT = 0.85;
  spawnShock(player.x, player.y, '#00e5ff', VIRT_H * 0.95, 34);
  spawnShock(player.x, player.y, '#ffd700', VIRT_W * 0.85, 26);

  // Tüm düşman mermilerini buharlaştır
  for (let i = 0; i < eBullets.length; i++) {
    const b = eBullets[i];
    particles.push({
      x: b.x, y: b.y, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2,
      r: 2.2, color: '#00e5ff', life: 14, maxLife: 14
    });
  }
  eBullets.length = 0;

  // Ekrandaki tüm düşmanlara ağır EMP hasarı uygula
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.hp -= 8;
    if (e.hp <= 0) {
      onEnemyKilled(e, i);
    } else {
      spawnExplosion(e.x, e.y, '#00e5ff', 6, 0.7);
    }
  }

  // Boss varsa kalkanını sars!
  if (boss) {
    boss.hp -= 16;
    spawnExplosion(boss.x, boss.y, '#00e5ff', 18, 1.2);
    if (boss.hp <= 0) onBossKilled();
  }

  addPopup(player.x, player.y - 28, '💥 EMP SÜPER DALGA!', '#00e5ff');
  if (MP.connected) mpSend({ t: 'emp' });
}

// ---------- Deterministik Dalga & Boss Üretimi ----------
const DROP_KINDS = ['weapon', 'shield', 'rapid', 'magnet', 'x2'];

function spawnDeterministicWaveStep() {
  const df = DIFFICULTIES[currentDiff] || DIFFICULTIES.normal;
  // Boss sahnedeyken küçük düşman akışını seyrelt
  const interval = boss
    ? Math.round(df.spawnInt * 2.5)
    : Math.max(18, Math.round(df.spawnInt - Math.min(14, (wave - 1) * 2)));

  if (runFrames % interval !== 0) return;

  spawnsCount++;

  // Her 24 doğuşta bir (ve sahnede Boss yokken) Mega Dreadnought Boss indir!
  if (!boss && spawnsCount % 24 === 0) {
    const bossWave = Math.floor(spawnsCount / 24);
    const maxHp = Math.round((46 + bossWave * 22) * df.hpMul);
    boss = {
      x: VIRT_W * 0.5,
      y: -55,
      vx: 1.75 * df.enemySpd,
      r: 40,
      hp: maxHp,
      maxHp,
      fireCd: 50,
      phase: 0,
      rot: 0,
      waveNum: bossWave
    };
    bossBannerFrames = 110;
    sfx.bossWarn();
    addPopup(VIRT_W * 0.5, VIRT_H * 0.28, `⚠️ BOSS DALGA ${bossWave}!`, '#ff3366');
    return;
  }

  const rType = waveRng();
  const rX = waveRng();
  const rDrop = waveRng();
  const rKind = waveRng();

  let type = 'scout';
  if (rType < 0.24) type = 'meteor';
  else if (rType < 0.54) type = 'scout';
  else if (rType < 0.76) type = 'shooter';
  else if (rType < 0.90) type = 'kamikaze';
  else type = 'tank';

  const margin = 34;
  const x = margin + rX * (VIRT_W - margin * 2);
  const spdMul = df.enemySpd * (1 + Math.min(0.45, (wave - 1) * 0.05));
  const hpMul = df.hpMul * (1 + Math.min(0.8, (wave - 1) * 0.10));

  let cfg;
  switch (type) {
    case 'meteor':
      cfg = { r: 17, hp: Math.max(2, Math.round(2.4 * hpMul)), vx: (rDrop - 0.5) * 1.3, vy: 2.3 * spdMul, color: '#a89f91', pts: 12 };
      break;
    case 'scout':
      cfg = { r: 14, hp: Math.max(1, Math.round(1.6 * hpMul)), vx: 0, vy: 2.8 * spdMul, color: '#00f5d4', pts: 15 };
      break;
    case 'shooter':
      cfg = { r: 16, hp: Math.max(2, Math.round(2.8 * hpMul)), vx: 0, vy: 1.85 * spdMul, color: '#ff3366', pts: 24 };
      break;
    case 'kamikaze':
      cfg = { r: 13, hp: Math.max(1, Math.round(1.5 * hpMul)), vx: 0, vy: 3.3 * spdMul, color: '#ff9e00', pts: 22 };
      break;
    default: // tank
      cfg = { r: 22, hp: Math.max(5, Math.round(6.0 * hpMul)), vx: 0, vy: 1.25 * spdMul, color: '#b5179e', pts: 40 };
      break;
  }

  // Deterministik ganimet (altın veya güçlendirme) zarları doğuşta kilitlenir!
  let dropType = null;
  if (rDrop < 0.16) {
    dropType = DROP_KINDS[Math.floor(rKind * DROP_KINDS.length) % DROP_KINDS.length];
  } else if (rDrop < 0.48) {
    dropType = 'coin';
  }

  enemies.push({
    type,
    x,
    y: -28,
    vx: cfg.vx,
    vy: cfg.vy,
    r: cfg.r,
    hp: cfg.hp,
    maxHp: cfg.hp,
    rot: rX * Math.PI * 2,
    fireCd: Math.round((46 + rKind * 35) / df.fireRateMul),
    phase: rX * Math.PI * 2,
    color: cfg.color,
    pts: cfg.pts,
    dropType
  });
}

function addScorePoints(basePts, vx, vy) {
  combo++;
  comboTimer = 175;
  if (combo > SP.bestCombo) SP.bestCombo = combo;
  const comboMul = Math.min(5, 1 + Math.floor(combo / 4));
  const x2Mul = player.x2Timer > 0 ? 2 : 1;
  const gain = Math.round(basePts * comboMul * x2Mul);
  score += gain;
  updateScoreUI();
  if (comboMul >= 2 || x2Mul > 1) {
    addPopup(vx, vy, `+${gain}`, x2Mul > 1 ? '#f72585' : '#ffd700');
  }
  if (MP.connected) mpOnScore();
}

function onEnemyKilled(e, idx) {
  enemies.splice(idx, 1);
  runKills++;
  empCharge = Math.min(100, empCharge + (e.type === 'tank' ? 14 : 7));
  updateEmpUI();

  sfx.boom(e.type === 'tank');
  spawnExplosion(e.x, e.y, e.color, e.type === 'tank' ? 20 : 12, e.type === 'tank' ? 1.2 : 0.9);
  spawnShock(e.x, e.y, e.color, e.r * 2.6, 16);
  addScorePoints(e.pts, e.x, e.y);

  if (e.dropType) {
    pickups.push({
      x: e.x,
      y: e.y,
      vx: ( (e.phase % 1) - 0.5 ) * 0.8,
      vy: 1.55,
      kind: e.dropType,
      r: 12,
      bob: 0
    });
  }
}

function onBossKilled() {
  if (!boss) return;
  const bx = boss.x, by = boss.y;
  const bw = boss.waveNum;
  boss = null;
  runBosses++;
  wave = bw + 1;
  if (wave > SP.bestWave) SP.bestWave = wave;

  empCharge = 100;
  updateEmpUI();
  sfx.boom(true);
  sfx.win();
  flashColor = '#ffd700';
  flashAlpha = 0.6;
  shakeT = 1.0;

  spawnExplosion(bx, by, '#ff3366', 32, 1.5);
  spawnExplosion(bx, by, '#ffd700', 22, 1.2);
  spawnShock(bx, by, '#ffd700', 170, 32);

  // Boss 3 altın + 1 silah yükseltmesi düşürür
  for (let i = -1; i <= 1; i++) {
    pickups.push({ x: bx + i * 24, y: by, vx: i * 0.8, vy: 1.5, kind: 'coin', r: 12, bob: i });
  }
  pickups.push({ x: bx, y: by - 14, vx: 0, vy: 1.3, kind: 'weapon', r: 13, bob: 0 });

  addScorePoints(200 + bw * 50, bx, by);
  addPopup(VIRT_W * 0.5, VIRT_H * 0.34, `🏆 BOSS YIKILDI! DALGA ${wave}`, '#00f5d4');
}

function applyPickup(p) {
  if (p.kind === 'coin') {
    runCoins += 2;
    SP.coins += 2;
    SP.totalCoins = (SP.totalCoins || 0) + 2;
    sfx.coin();
    addPopup(p.x, p.y, '🪙 +2', '#ffd700');
    updateCoinUI();
    return;
  }

  sfx.power();
  const info = POWERUPS[p.kind];
  switch (p.kind) {
    case 'weapon':
      if (player.weaponLv < 4) {
        player.weaponLv++;
        addPopup(p.x, p.y, `🔫 Silah Lv.${player.weaponLv}!`, info.color);
      } else {
        score += 50;
        updateScoreUI();
        addPopup(p.x, p.y, '🔫 MAKS +50', info.color);
        if (MP.connected) mpOnScore();
      }
      break;
    case 'shield':
      player.shield = true;
      updateHpUI();
      addPopup(p.x, p.y, '🛡️ Kalkan Aktif!', info.color);
      break;
    case 'rapid':
      player.rapidTimer = info.dur;
      addPopup(p.x, p.y, '⚡ Seri Ateş!', info.color);
      break;
    case 'magnet':
      player.magnetTimer = info.dur;
      addPopup(p.x, p.y, '🧲 Mıknatıs!', info.color);
      break;
    case 'x2':
      player.x2Timer = info.dur;
      addPopup(p.x, p.y, '✨ 2x Skor!', info.color);
      break;
  }
  updatePowerBadgesUI();
}

function damagePlayer() {
  if (player.invuln > 0 || MP.spectating || state !== STATE.PLAYING) return;

  if (player.shield) {
    player.shield = false;
    player.invuln = 65;
    sfx.shield();
    spawnShock(player.x, player.y, '#00e5ff', 68, 20);
    addPopup(player.x, player.y - 20, '🛡️ Kalkan Korudu!', '#00e5ff');
    updateHpUI();
    return;
  }

  player.hp--;
  player.invuln = 80;
  if (player.weaponLv > 1) player.weaponLv--;
  combo = 0;
  comboTimer = 0;
  shakeT = 0.75;
  flashColor = '#ff3366';
  flashAlpha = 0.42;
  sfx.hurt();
  spawnExplosion(player.x, player.y, '#ff4d4d', 16, 1.0);
  updateHpUI();
  updateScoreUI();
  updatePowerBadgesUI();

  if (player.hp <= 0) {
    handlePlayerDeath();
  }
}

function handlePlayerDeath() {
  sfx.gameover();
  spawnExplosion(player.x, player.y, '#ff9e00', 30, 1.4);
  spawnShock(player.x, player.y, '#ff3366', 120, 28);

  SP.games = (SP.games || 0) + 1;
  SP.totalKills = (SP.totalKills || 0) + runKills;
  SP.bossKills = (SP.bossKills || 0) + runBosses;
  if (wave > (SP.bestWave || 1)) SP.bestWave = wave;

  const isNewRecord = score > (SP.bestScore || 0);
  if (isNewRecord) SP.bestScore = score;
  persist();

  if (MP.connected || MP.reconnecting) {
    mpOnDeath();
    return;
  }

  state = STATE.GAMEOVER;
  hide(hud);
  hide(tapHint);

  $('final-score').textContent = score;
  $('final-wave').textContent = wave;
  $('best-score-go').textContent = SP.bestScore;
  $('run-coins-go').textContent = `🪙 +${runCoins}`;
  if (isNewRecord && score > 0) show($('new-record'));
  else hide($('new-record'));

  const medalBox = $('medal-display');
  if (score >= 300) {
    show(medalBox);
    if (score >= 2200) { $('medal-icon').textContent = '💎'; $('medal-text').textContent = 'GALAKTİK EFSANE'; }
    else if (score >= 1200) { $('medal-icon').textContent = '🥇'; $('medal-text').textContent = 'ALTIN AMİRAL'; }
    else if (score >= 650) { $('medal-icon').textContent = '🥈'; $('medal-text').textContent = 'GÜMÜŞ KAPTAN'; }
    else { $('medal-icon').textContent = '🥉'; $('medal-text').textContent = 'BRONZ PİLOT'; }
  } else {
    hide(medalBox);
  }

  const nameRow = $('name-save-row');
  const saveBtn = $('save-score-btn');
  const nameInp = $('player-name');
  if (score > 0) {
    show(nameRow);
    if (nameInp) nameInp.value = SP.playerName || '';
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '🏅 Kaydet'; }
  } else {
    hide(nameRow);
  }

  show(gameoverScreen);
}

// ---------- Kontroller (2B Mobil Trackpad + Doğrudan + Klavye) ----------
const keys = {};
const drag = { active: false, lastX: 0, lastY: 0 };
const touchIndicator = { x: 0, y: 0, alpha: 0, active: false };

function clientToVirt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const rw = Math.max(1, rect.width || W);
  const rh = Math.max(1, rect.height || H);
  return {
    x: ((clientX - rect.left) / rw) * VIRT_W,
    y: ((clientY - rect.top) / rh) * VIRT_H
  };
}

function clampPlayerTarget() {
  player.tx = Math.max(20, Math.min(VIRT_W - 20, player.tx));
  player.ty = Math.max(54, Math.min(VIRT_H - 26, player.ty));
}

function onPointerStart(clientX, clientY) {
  getAC();
  if (state !== STATE.PLAYING && state !== STATE.READY) return;
  if (MP.spectating || MP.reconnecting) return;
  const pt = clientToVirt(clientX, clientY);
  drag.active = true;
  drag.lastX = pt.x;
  drag.lastY = pt.y;
  touchIndicator.x = sx(pt.x);
  touchIndicator.y = sy(pt.y);
  touchIndicator.alpha = 1;
  touchIndicator.active = true;

  if (SP.ctrlMode === 'direct') {
    player.tx = pt.x;
    player.ty = pt.y - 52; // Parmak gemiyi kapatmasın diye 52px üstte tut!
    clampPlayerTarget();
  }
}

function onPointerMove(clientX, clientY) {
  if (!drag.active) return;
  if (state !== STATE.PLAYING && state !== STATE.READY) return;
  if (MP.spectating || MP.reconnecting) return;
  const pt = clientToVirt(clientX, clientY);
  touchIndicator.x = sx(pt.x);
  touchIndicator.y = sy(pt.y);
  touchIndicator.alpha = 1;

  if (SP.ctrlMode === 'trackpad') {
    const dx = (pt.x - drag.lastX) * SP.sensitivity;
    const dy = (pt.y - drag.lastY) * SP.sensitivity;
    player.tx += dx;
    player.ty += dy;
  } else {
    player.tx = pt.x;
    player.ty = pt.y - 52;
  }
  drag.lastX = pt.x;
  drag.lastY = pt.y;
  clampPlayerTarget();
}

function onPointerEnd() {
  drag.active = false;
  touchIndicator.active = false;
}

canvas.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  e.preventDefault();
  onPointerStart(e.clientX, e.clientY);
});
window.addEventListener('mousemove', e => {
  if (drag.active) onPointerMove(e.clientX, e.clientY);
});
window.addEventListener('mouseup', onPointerEnd);

canvas.addEventListener('touchstart', e => {
  if (!e.touches || !e.touches.length) return;
  e.preventDefault();
  const t = e.touches[0];
  onPointerStart(t.clientX, t.clientY);
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  if (!e.touches || !e.touches.length) return;
  e.preventDefault();
  const t = e.touches[0];
  onPointerMove(t.clientX, t.clientY);
}, { passive: false });

canvas.addEventListener('touchend', onPointerEnd);
canvas.addEventListener('touchcancel', onPointerEnd);

document.addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  keys[e.code] = true;

  if (e.code === 'Space' || e.code === 'KeyB') {
    if (state === STATE.PLAYING) {
      e.preventDefault();
      triggerEMP();
    } else if (state === STATE.MENU && menuScreen && !menuScreen.classList.contains('hidden') &&
               shopScreen.classList.contains('hidden') && lbScreen.classList.contains('hidden') &&
               statsScreen.classList.contains('hidden')) {
      e.preventDefault();
      startGame();
    }
  }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (state === STATE.PLAYING || state === STATE.PAUSED) togglePause();
  }
  if (e.code === 'Enter' && state === STATE.GAMEOVER && !MP.connected) {
    startGame();
  }
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

function stepPlayerMovement() {
  const kSpd = 5.4;
  let kx = 0, ky = 0;
  if (keys['ArrowLeft'] || keys['KeyA']) kx -= 1;
  if (keys['ArrowRight'] || keys['KeyD']) kx += 1;
  if (keys['ArrowUp'] || keys['KeyW']) ky -= 1;
  if (keys['ArrowDown'] || keys['KeyS']) ky += 1;
  if (kx !== 0 || ky !== 0) {
    const len = Math.hypot(kx, ky) || 1;
    player.tx += (kx / len) * kSpd;
    player.ty += (ky / len) * kSpd;
    clampPlayerTarget();
  }

  const prevX = player.x;
  const prevY = player.y;
  player.x += (player.tx - player.x) * 0.42;
  player.y += (player.ty - player.y) * 0.42;
  player.vx = player.x - prevX;
  player.vy = player.y - prevY;
  player.bank += (Math.max(-1, Math.min(1, player.vx * 0.14)) - player.bank) * 0.25;

  if (frames % 2 === 0) {
    player.trail.push({ x: player.x, y: player.y, bank: player.bank });
    if (player.trail.length > 6) player.trail.shift();
  }
}

// ---------- Fizik & Dünya Simülasyonu (60 Hz) ----------
function stepBackground() {
  const warp = state === STATE.PLAYING ? (player.rapidTimer > 0 ? 1.65 : 1.15) : 0.55;
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    s.ny += s.sp * warp;
    s.tw += 0.06;
    if (s.ny > 1.03) {
      s.ny = -0.03;
      s.nx = (s.nx * 7.13 + 0.37) % 1;
    }
  }
  for (let i = 0; i < nebulas.length; i++) {
    const nb = nebulas[i];
    nb.ny += nb.sp * warp;
    if (nb.ny - nb.r > 1.1) nb.ny = -nb.r;
  }
}

function stepWorld() {
  runFrames++;
  if (bossBannerFrames > 0) bossBannerFrames--;

  // EMP pasif şarj + zamanlayıcılar
  if (!MP.spectating) {
    if (empCharge < 100) {
      empCharge = Math.min(100, empCharge + 0.055);
      if (runFrames % 12 === 0) updateEmpUI();
    }
    if (player.invuln > 0) player.invuln--;

    let badgeDirty = false;
    if (player.rapidTimer > 0) {
      player.rapidTimer--;
      if (player.rapidTimer === 0 || player.rapidTimer % 30 === 0) badgeDirty = true;
    }
    if (player.magnetTimer > 0) {
      player.magnetTimer--;
      if (player.magnetTimer === 0 || player.magnetTimer % 30 === 0) badgeDirty = true;
    }
    if (player.x2Timer > 0) {
      player.x2Timer--;
      if (player.x2Timer === 0 || player.x2Timer % 30 === 0) badgeDirty = true;
    }
    if (badgeDirty) updatePowerBadgesUI();

    if (comboTimer > 0) {
      comboTimer--;
      if (comboTimer === 0) {
        combo = 0;
        updateScoreUI();
      }
    }

    stepPlayerMovement();

    // Otomatik Lazer Ateşi
    if (player.fireCd > 0) player.fireCd--;
    if (player.fireCd <= 0) {
      firePlayerWeapons();
      const baseCd = player.weaponLv >= 4 ? 10 : 12;
      player.fireCd = player.rapidTimer > 0 ? Math.max(5, Math.round(baseCd * 0.55)) : baseCd;
    }
  } else if (MP.specEndFrames > 0) {
    MP.specEndFrames--;
    if (MP.specEndFrames === 0) {
      mpFinishDuel();
      return;
    }
  }

  // Kanat arkadaşı (Rakip hayalet gemisi) yumuşak interpolasyon + görsel hayalet ateşi
  if (MP.connected && MP.oppAlive) {
    MP.oppShip.x += (MP.oppShip.tx - MP.oppShip.x) * 0.38;
    MP.oppShip.y += (MP.oppShip.ty - MP.oppShip.y) * 0.38;
    MP.oppShip.bank += (MP.oppShip.tbank - MP.oppShip.bank) * 0.3;
    if (MP.spectating && runFrames % 10 === 0) {
      // İzleyici modunda rakibin gemisi mermileriyle görsel olarak ateş eder
      const osh = SHIPS[MP.oppShip.ship] || SHIPS.falcon;
      bullets.push({ x: MP.oppShip.x, y: MP.oppShip.y - 16, vx: 0, vy: -11.5, r: 3.2, dmg: 1, color: osh.laser, ghost: true });
    }
  }

  // Dalga & Boss üretimi
  spawnDeterministicWaveStep();

  const df = DIFFICULTIES[currentDiff] || DIFFICULTIES.normal;
  const targetX = MP.spectating ? MP.oppShip.x : player.x;
  const targetY = MP.spectating ? MP.oppShip.y : player.y;

  // Düşman hareketleri & ateşleri
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.phase += 0.06;
    if (e.type === 'meteor') {
      e.rot += 0.04;
      e.x += e.vx;
      e.y += e.vy;
    } else if (e.type === 'scout') {
      e.x += Math.sin(e.phase * 1.4) * 1.65;
      e.y += e.vy;
    } else if (e.type === 'shooter') {
      e.x += Math.sin(e.phase) * 1.1;
      e.y += e.vy;
      e.fireCd--;
      if (e.fireCd <= 0 && e.y > 24 && e.y < VIRT_H * 0.68) {
        const ang = Math.atan2(targetY - e.y, targetX - e.x);
        const bsp = 4.4 * df.bulletSpd;
        eBullets.push({ x: e.x, y: e.y + 12, vx: Math.cos(ang) * bsp, vy: Math.sin(ang) * bsp, r: 4.2, color: '#ff3366' });
        e.fireCd = Math.round(78 / df.fireRateMul);
      }
    } else if (e.type === 'kamikaze') {
      const dx = targetX - e.x;
      e.x += Math.max(-2.1, Math.min(2.1, dx * 0.032));
      e.y += e.vy;
    } else { // tank
      e.x += Math.sin(e.phase * 0.7) * 0.7;
      e.y += e.vy;
      e.fireCd--;
      if (e.fireCd <= 0 && e.y > 20 && e.y < VIRT_H * 0.65) {
        const bsp = 3.9 * df.bulletSpd;
        for (let k = -1; k <= 1; k++) {
          const ang = Math.PI * 0.5 + k * 0.28;
          eBullets.push({ x: e.x + k * 8, y: e.y + 16, vx: Math.cos(ang) * bsp, vy: Math.sin(ang) * bsp, r: 4.5, color: '#ff5de8' });
        }
        e.fireCd = Math.round(92 / df.fireRateMul);
      }
    }

    e.x = Math.max(18, Math.min(VIRT_W - 18, e.x));
    if (e.y > VIRT_H + 40) {
      enemies.splice(i, 1);
      continue;
    }

    // Oyuncu çarpışma testi
    if (!MP.spectating && state === STATE.PLAYING) {
      const dist = Math.hypot(e.x - player.x, e.y - player.y);
      if (dist < e.r + player.r - 4) {
        enemies.splice(i, 1);
        spawnExplosion(e.x, e.y, e.color, 10, 0.9);
        damagePlayer();
        if (state !== STATE.PLAYING && !MP.spectating) return;
      }
    }
  }

  // Mega Dreadnought Boss davranışı
  if (boss) {
    boss.rot += 0.03;
    if (boss.y < 96) {
      boss.y += 1.6;
    } else {
      boss.x += boss.vx;
      if (boss.x < 62) { boss.x = 62; boss.vx = Math.abs(boss.vx); }
      if (boss.x > VIRT_W - 62) { boss.x = VIRT_W - 62; boss.vx = -Math.abs(boss.vx); }
      boss.y = 96 + Math.sin(runFrames * 0.03) * 10;
    }

    boss.fireCd--;
    if (boss.fireCd <= 0 && boss.y >= 85) {
      boss.phase = (boss.phase + 1) % 3;
      const bsp = 4.3 * df.bulletSpd;
      if (boss.phase === 0) {
        // 5'li yelpaze yaylım ateşi
        for (let k = -2; k <= 2; k++) {
          const ang = Math.PI * 0.5 + k * 0.22;
          eBullets.push({ x: boss.x + k * 10, y: boss.y + 28, vx: Math.cos(ang) * bsp, vy: Math.sin(ang) * bsp, r: 4.8, color: '#ff3366' });
        }
      } else if (boss.phase === 1) {
        // Oyuncuya hedefli çift plazma topu
        const ang = Math.atan2(targetY - boss.y, targetX - boss.x);
        eBullets.push({ x: boss.x - 22, y: boss.y + 22, vx: Math.cos(ang) * (bsp + 0.8), vy: Math.sin(ang) * (bsp + 0.8), r: 5.2, color: '#ff9e00' });
        eBullets.push({ x: boss.x + 22, y: boss.y + 22, vx: Math.cos(ang) * (bsp + 0.8), vy: Math.sin(ang) * (bsp + 0.8), r: 5.2, color: '#ff9e00' });
      } else {
        // Döner halka mermileri
        for (let k = 0; k < 6; k++) {
          const ang = boss.rot + (Math.PI * 2 * k) / 6;
          if (Math.sin(ang) > -0.15) {
            eBullets.push({ x: boss.x, y: boss.y + 14, vx: Math.cos(ang) * (bsp * 0.9), vy: Math.sin(ang) * (bsp * 0.9), r: 4.4, color: '#ff5de8' });
          }
        }
      }
      boss.fireCd = Math.max(32, Math.round((64 - Math.min(18, boss.waveNum * 4)) / df.fireRateMul));
    }

    if (!MP.spectating && state === STATE.PLAYING) {
      if (Math.hypot(boss.x - player.x, boss.y - player.y) < boss.r + player.r - 4) {
        damagePlayer();
        if (state !== STATE.PLAYING && !MP.spectating) return;
      }
    }
  }

  // Dost lazer mermileri
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;
    if (b.y < -20 || b.x < -20 || b.x > VIRT_W + 20) {
      bullets.splice(i, 1);
      continue;
    }

    let hit = false;
    // Boss isabeti
    if (boss && Math.hypot(b.x - boss.x, b.y - boss.y) < boss.r + b.r) {
      bullets.splice(i, 1);
      hit = true;
      particles.push({ x: b.x, y: b.y, vx: (Math.random() - 0.5) * 3, vy: 1.8, r: 2.2, color: b.color, life: 10, maxLife: 10 });
      if (!b.ghost) {
        boss.hp -= b.dmg;
        sfx.hit();
        if (boss.hp <= 0) onBossKilled();
      }
      continue;
    }

    // Normal düşman isabeti
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + b.r + 2) {
        bullets.splice(i, 1);
        hit = true;
        particles.push({ x: b.x, y: b.y, vx: (Math.random() - 0.5) * 2.6, vy: 1.2, r: 2.0, color: b.color, life: 9, maxLife: 9 });
        if (!b.ghost) {
          e.hp -= b.dmg;
          if (e.hp <= 0) onEnemyKilled(e, j);
          else sfx.hit();
        } else {
          e.hp -= 0.7;
          if (e.hp <= 0) {
            enemies.splice(j, 1);
            spawnExplosion(e.x, e.y, e.color, 10, 0.8);
          }
        }
        break;
      }
    }
    if (hit) continue;
  }

  // Düşman mermileri
  for (let i = eBullets.length - 1; i >= 0; i--) {
    const eb = eBullets[i];
    eb.x += eb.vx;
    eb.y += eb.vy;
    if (eb.y > VIRT_H + 24 || eb.y < -24 || eb.x < -24 || eb.x > VIRT_W + 24) {
      eBullets.splice(i, 1);
      continue;
    }
    if (!MP.spectating && state === STATE.PLAYING) {
      if (Math.hypot(eb.x - player.x, eb.y - player.y) < eb.r + player.r - 5) {
        eBullets.splice(i, 1);
        damagePlayer();
        if (state !== STATE.PLAYING && !MP.spectating) return;
      }
    }
  }

  // Ganimetler & Mıknatıs Çekimi
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.bob += 0.1;
    if (!MP.spectating && player.magnetTimer > 0) {
      const dx = player.x - p.x;
      const dy = player.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 190) {
        p.vx += (dx / d) * 0.75;
        p.vy += (dy / d) * 0.75;
      }
    }
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.96;
    if (p.vy < 1.5 && (!player.magnetTimer || MP.spectating)) p.vy += 0.06;

    if (p.y > VIRT_H + 26) {
      pickups.splice(i, 1);
      continue;
    }
    if (!MP.spectating && state === STATE.PLAYING) {
      if (Math.hypot(p.x - player.x, p.y - player.y) < p.r + player.r + 6) {
        pickups.splice(i, 1);
        applyPickup(p);
      }
    }
  }
}

function stepEffects() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const pt = particles[i];
    pt.x += pt.vx;
    pt.y += pt.vy;
    pt.vx *= 0.95;
    pt.vy *= 0.95;
    pt.life--;
    if (pt.life <= 0) particles.splice(i, 1);
  }
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i];
    sw.r += (sw.maxR - sw.r) * 0.22;
    sw.life--;
    if (sw.life <= 0) shockwaves.splice(i, 1);
  }
  for (let i = popups.length - 1; i >= 0; i--) {
    const pp = popups[i];
    pp.y -= 0.7;
    pp.life--;
    if (pp.life <= 0) popups.splice(i, 1);
  }
}

// =====================================================
//          60 FPS NEON VEKTÖR GRAFİK MOTORU
// =====================================================
function drawSpaceship(vx, vy, shipKey, bank, alpha, shieldOn, isGhost, nameTag) {
  const sh = SHIPS[shipKey] || SHIPS.falcon;
  const cx = sx(vx);
  const cy = sy(vy);
  const sc = Math.min(W / VIRT_W, H / VIRT_H);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.rotate(bank * 0.22);
  ctx.scale(sc * (1 - Math.abs(bank) * 0.10), sc);

  // İtici Plazma Alevi
  const flicker = 14 + Math.sin(frames * 0.65) * 5;
  const fg = ctx.createLinearGradient(0, 12, 0, 12 + flicker + 8);
  fg.addColorStop(0, '#ffffff');
  fg.addColorStop(0.45, sh.flame);
  fg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(-6, 13);
  ctx.lineTo(0, 15 + flicker);
  ctx.lineTo(6, 13);
  ctx.closePath();
  ctx.fill();

  // Neon Dış Gölge
  if (!isGhost) {
    ctx.shadowColor = sh.hull;
    ctx.shadowBlur = 14;
  }

  // Kanatlar
  ctx.fillStyle = sh.wing;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(-22, 13);
  ctx.lineTo(-9, 9);
  ctx.lineTo(0, 14);
  ctx.lineTo(9, 9);
  ctx.lineTo(22, 13);
  ctx.closePath();
  ctx.fill();

  // Ana Gövde
  ctx.fillStyle = sh.hull;
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(-10, 11);
  ctx.lineTo(0, 16);
  ctx.lineTo(10, 11);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Kokpit Camı
  ctx.fillStyle = sh.cockpit;
  ctx.beginPath();
  ctx.ellipse(0, -4, 4, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Kalkan Küresi
  if (shieldOn) {
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2.2;
    ctx.globalAlpha = alpha * (0.55 + 0.25 * Math.sin(frames * 0.18));
    ctx.beginPath();
    ctx.arc(0, 0, 27, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();

  if (nameTag) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha + 0.2);
    ctx.font = '800 11px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = isGhost ? '#7bdff2' : '#ffffff';
    ctx.fillText(nameTag, cx, cy + sr(30));
    ctx.restore();
  }
}

function drawEnemy(e) {
  const cx = sx(e.x), cy = sy(e.y);
  const r = sr(e.r);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.shadowColor = e.color;
  ctx.shadowBlur = 10;

  if (e.type === 'meteor') {
    ctx.rotate(e.rot);
    ctx.fillStyle = '#6b6257';
    ctx.strokeStyle = '#c2b8a3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k < 7; k++) {
      const a = (Math.PI * 2 * k) / 7;
      const rad = r * (k % 2 === 0 ? 1.0 : 0.78);
      if (k === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (e.type === 'scout') {
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.moveTo(0, r);
    ctx.lineTo(-r, -r * 0.8);
    ctx.lineTo(0, -r * 0.35);
    ctx.lineTo(r, -r * 0.8);
    ctx.closePath();
    ctx.fill();
  } else if (e.type === 'shooter') {
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.moveTo(0, r * 1.1);
    ctx.lineTo(-r * 1.15, -r * 0.5);
    ctx.lineTo(-r * 0.4, -r * 0.9);
    ctx.lineTo(r * 0.4, -r * 0.9);
    ctx.lineTo(r * 1.15, -r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.type === 'kamikaze') {
    ctx.rotate(Math.sin(frames * 0.3) * 0.15);
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.moveTo(0, r * 1.25);
    ctx.lineTo(-r * 0.85, -r * 0.85);
    ctx.lineTo(r * 0.85, -r * 0.85);
    ctx.closePath();
    ctx.fill();
  } else { // tank
    ctx.fillStyle = e.color;
    roundRect(-r, -r * 0.75, r * 2, r * 1.5, 6);
    ctx.fill();
    ctx.strokeStyle = '#ffd6ff';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Can çubuğu
    if (e.hp < e.maxHp) {
      const bw = r * 1.8;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(-bw / 2, -r - 8, bw, 4);
      ctx.fillStyle = '#00f5d4';
      ctx.fillRect(-bw / 2, -r - 8, bw * Math.max(0, e.hp / e.maxHp), 4);
    }
  }
  ctx.restore();
}

function drawBoss() {
  if (!boss) return;
  const cx = sx(boss.x), cy = sy(boss.y);
  const r = sr(boss.r);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.shadowColor = '#ff3366';
  ctx.shadowBlur = 20;

  // Dış Zırh Kanatları
  ctx.fillStyle = '#800f2f';
  ctx.beginPath();
  ctx.moveTo(0, r * 0.95);
  ctx.lineTo(-r * 1.45, -r * 0.2);
  ctx.lineTo(-r * 1.05, -r * 0.85);
  ctx.lineTo(r * 1.05, -r * 0.85);
  ctx.lineTo(r * 1.45, -r * 0.2);
  ctx.closePath();
  ctx.fill();

  // Merkez Dreadnought Gövdesi
  ctx.fillStyle = '#ff3366';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
  ctx.fill();

  // Döner Reaktör Çekirdeği
  ctx.rotate(boss.rot);
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.42, 0, Math.PI * 1.4);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Ekran Üstü Boss Can Çubuğu
  const barW = Math.min(W * 0.68, 280);
  const bx = (W - barW) / 2;
  const by = 54;
  ctx.save();
  ctx.fillStyle = 'rgba(8, 12, 26, 0.82)';
  roundRect(bx - 4, by - 4, barW + 8, 16, 8);
  ctx.fill();
  const ratio = Math.max(0, boss.hp / boss.maxHp);
  const bg = ctx.createLinearGradient(bx, by, bx + barW, by);
  bg.addColorStop(0, '#ff3366');
  bg.addColorStop(1, '#ff9e00');
  ctx.fillStyle = bg;
  roundRect(bx, by, barW * ratio, 8, 4);
  ctx.fill();
  ctx.font = '800 10px "Segoe UI", Arial';
  ctx.fillStyle = '#ffd6e0';
  ctx.textAlign = 'center';
  ctx.fillText(`👹 DREADNOUGHT BOSS (DALGA ${boss.waveNum})`, W / 2, by - 8);
  ctx.restore();
}

function draw() {
  const secKey = (state === STATE.MENU || state === STATE.MP) ? SP.sector : currentSector;
  const sec = SECTORS[secKey] || SECTORS.nebula;

  ctx.save();
  if (shakeT > 0) {
    shakeT = Math.max(0, shakeT - 0.045);
    const m = shakeT * 9;
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
  }

  // 1) Uzay Arka Plan Degradesi
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, sec.bg0);
  bg.addColorStop(0.55, sec.bg1);
  bg.addColorStop(1, sec.bg2);
  ctx.fillStyle = bg;
  ctx.fillRect(-14, -14, W + 28, H + 28);

  // 2) Bulutsu (Nebula) Bulutları
  for (let i = 0; i < nebulas.length; i++) {
    const nb = nebulas[i];
    const gx = nb.nx * W, gy = nb.ny * H, gr = nb.r * W;
    const ng = ctx.createRadialGradient(gx, gy, 4, gx, gy, gr);
    ng.addColorStop(0, nb.alt ? sec.nebulaB : sec.nebulaA);
    ng.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ng;
    ctx.fillRect(0, 0, W, H);
  }

  // 3) Siber Perspektif Izgarası
  ctx.strokeStyle = sec.grid;
  ctx.lineWidth = 1;
  const gs = 46;
  const gOff = (frames * 1.4) % gs;
  for (let x = 0; x < W + gs; x += gs) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = -gs + gOff; y < H + gs; y += gs) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // 4) Paralaks Yıldızlar
  ctx.fillStyle = sec.starTint;
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    ctx.globalAlpha = 0.35 + 0.55 * Math.abs(Math.sin(s.tw));
    ctx.beginPath();
    ctx.arc(s.nx * W, s.ny * H, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Menüdeyken Dekoratif Devriye Gemisi Çiz
  if (state === STATE.MENU || state === STATE.MP) {
    const mx = VIRT_W * 0.5 + Math.sin(frames * 0.03) * 65;
    const my = VIRT_H * 0.74 + Math.cos(frames * 0.04) * 14;
    drawSpaceship(mx, my, SP.ship, Math.cos(frames * 0.03) * 0.65, 0.9, false, false, '');
    ctx.restore();
    return;
  }

  // 5) Şok Halkaları
  for (let i = 0; i < shockwaves.length; i++) {
    const sw = shockwaves[i];
    ctx.save();
    ctx.globalAlpha = (sw.life / sw.maxLife) * 0.75;
    ctx.strokeStyle = sw.color;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(sx(sw.x), sy(sw.y), sr(sw.r), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 6) Ganimetler (Altın & Güçlendirmeler)
  for (let i = 0; i < pickups.length; i++) {
    const p = pickups[i];
    const px = sx(p.x), py = sy(p.y + Math.sin(p.bob) * 3);
    const pr = sr(p.r);
    const col = p.kind === 'coin' ? '#ffd700' : (POWERUPS[p.kind] ? POWERUPS[p.kind].color : '#00e5ff');
    const emo = p.kind === 'coin' ? '🪙' : (POWERUPS[p.kind] ? POWERUPS[p.kind].emoji : '⭐');

    ctx.save();
    ctx.shadowColor = col;
    ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(10, 18, 36, 0.85)';
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.font = `${Math.round(pr * 1.15)}px "Segoe UI Emoji", Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emo, px, py + 1);
    ctx.restore();
  }

  // 7) Dost Lazer Mermileri
  for (let i = 0; i < bullets.length; i++) {
    const b = bullets[i];
    const bx = sx(b.x), by = sy(b.y);
    ctx.save();
    ctx.globalAlpha = b.ghost ? 0.45 : 1;
    ctx.strokeStyle = b.color;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = b.ghost ? 0 : 10;
    ctx.lineWidth = sr(b.r * 1.3);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx, by - sy(6));
    ctx.lineTo(bx - sx(b.vx * 0.8), by + sy(7));
    ctx.stroke();
    ctx.restore();
  }

  // 8) Düşmanlar & Boss
  for (let i = 0; i < enemies.length; i++) drawEnemy(enemies[i]);
  drawBoss();

  // 9) Düşman Mermileri
  for (let i = 0; i < eBullets.length; i++) {
    const eb = eBullets[i];
    const ex = sx(eb.x), ey = sy(eb.y);
    const er = sr(eb.r);
    ctx.save();
    ctx.shadowColor = eb.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = eb.color;
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex, ey, er * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 10) Kanat Arkadaşı (Çevrimiçi Rakip Gemisi)
  if ((MP.connected || MP.reconnecting) && MP.oppAlive) {
    const ghostAlpha = MP.spectating ? 0.95 : 0.46;
    drawSpaceship(
      MP.oppShip.x, MP.oppShip.y,
      MP.oppShip.ship || 'falcon',
      MP.oppShip.bank || 0,
      ghostAlpha,
      false,
      !MP.spectating,
      MP.oppName || 'Rakip'
    );
  }

  // 11) Yerel Oyuncu Gemisi & Hareket İzi
  if (!MP.spectating && (state === STATE.PLAYING || state === STATE.READY || state === STATE.PAUSED)) {
    const blinkSkip = player.invuln > 0 && Math.floor(player.invuln / 4) % 2 === 1;
    if (!blinkSkip) {
      const sh = SHIPS[SP.ship] || SHIPS.falcon;
      for (let i = 0; i < player.trail.length; i++) {
        const tr = player.trail[i];
        ctx.save();
        ctx.globalAlpha = ((i + 1) / player.trail.length) * 0.16;
        ctx.fillStyle = sh.hull;
        ctx.beginPath();
        ctx.arc(sx(tr.x), sy(tr.y), sr(9), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      drawSpaceship(
        player.x, player.y,
        SP.ship,
        player.bank,
        1.0,
        player.shield,
        false,
        (MP.connected || MP.reconnecting) ? (MP.myName || 'Sen') : ''
      );
    }
  }

  // 12) Kıvılcım Partikülleri & Uçan Yazılar
  for (let i = 0; i < particles.length; i++) {
    const pt = particles[i];
    ctx.save();
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(sx(pt.x), sy(pt.y), sr(pt.r), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (let i = 0; i < popups.length; i++) {
    const pp = popups[i];
    ctx.save();
    ctx.globalAlpha = Math.min(1, pp.life / 24);
    ctx.font = '800 14px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = 3;
    ctx.strokeText(pp.txt, sx(pp.x), sy(pp.y));
    ctx.fillStyle = pp.color;
    ctx.fillText(pp.txt, sx(pp.x), sy(pp.y));
    ctx.restore();
  }

  // 13) Dokunma Trackpad Halkası
  if (touchIndicator.alpha > 0.02 && (state === STATE.PLAYING || state === STATE.READY)) {
    ctx.save();
    ctx.globalAlpha = touchIndicator.alpha * 0.34;
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(touchIndicator.x, touchIndicator.y, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    if (!touchIndicator.active) touchIndicator.alpha *= 0.88;
  }

  // 14) Boss Uyarı Afişi & Canlı İzleyici Üst Bandı & MP Geri Sayım
  if (bossBannerFrames > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, bossBannerFrames / 20) * (0.65 + 0.35 * Math.sin(frames * 0.3));
    ctx.fillStyle = 'rgba(255, 25, 75, 0.22)';
    ctx.fillRect(0, H * 0.24 - 22, W, 44);
    ctx.font = '900 20px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff4d6d';
    ctx.fillText('⚠️ UYARI: DREADNOUGHT BOSS YAKLAŞIYOR! ⚠️', W / 2, H * 0.24 + 6);
    ctx.restore();
  }

  if (MP.spectating) {
    mpDrawSpectatorTopBanner();
  }

  if ((MP.connected || MP.reconnecting) && mpCountdown > 0) {
    mpDrawCountdown();
  }

  if (flashAlpha > 0) {
    flashAlpha = Math.max(0, flashAlpha - 0.035);
    ctx.globalAlpha = flashAlpha;
    ctx.fillStyle = flashColor;
    ctx.fillRect(-14, -14, W + 28, H + 28);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

// ---------- Hangar Mağazası, Skor Tablosu & İstatistik ----------
let currentShopTab = 'ships';

function openShop(tab, customMsg) {
  sfx.click();
  currentShopTab = tab || 'ships';
  document.querySelectorAll('.shop-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === currentShopTab);
  });
  $('shop-msg').textContent = customMsg || 'Düşmanları ve Boss\'ları avlayarak 🪙 altın topla!';
  renderShopList();
  updateCoinUI();
  show(shopScreen);
}

function renderShopList() {
  const list = $('shop-list');
  if (!list) return;
  const isShips = currentShopTab === 'ships';
  const dict = isShips ? SHIPS : SECTORS;
  const unlockedArr = isShips ? SP.unlockedShips : SP.unlockedSectors;
  const currentEquipped = isShips ? SP.ship : SP.sector;

  list.innerHTML = '';
  Object.keys(dict).forEach(key => {
    const item = dict[key];
    const unlocked = unlockedArr.includes(key);
    const equipped = currentEquipped === key;
    const row = document.createElement('div');
    row.className = 'shop-item' + (equipped ? ' equipped' : '');

    const swatchBg = isShips
      ? `radial-gradient(circle at 35% 30%, ${item.hull}, ${item.wing})`
      : `linear-gradient(135deg, ${item.bg1}, ${item.bg2})`;
    const btnClass = equipped ? 'active' : (unlocked ? 'equip' : 'buy');
    const btnText = equipped ? '✓ Seçili' : (unlocked ? 'Seç' : `🪙 ${item.cost}`);
    const canAfford = SP.coins >= item.cost;

    row.innerHTML = `
      <div class="shop-swatch" style="background:${swatchBg}">${item.emoji}</div>
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
        if (isShips) SP.ship = key;
        else SP.sector = key;
        persist();
        renderMenuSkins();
        renderShopList();
      } else if (SP.coins >= item.cost) {
        SP.coins -= item.cost;
        unlockedArr.push(key);
        if (isShips) SP.ship = key;
        else SP.sector = key;
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
  const rawName = (nameInp ? nameInp.value.trim() : '') || SP.playerName || 'Pilot';
  const cleanName = rawName.slice(0, 12);
  SP.playerName = cleanName;
  if (!Array.isArray(SP.scoreboard)) SP.scoreboard = [];
  SP.scoreboard.push({
    name: cleanName,
    score,
    diff: DIFFICULTIES[currentDiff] ? DIFFICULTIES[currentDiff].label : 'Normal',
    ts: Date.now()
  });
  SP.scoreboard.sort((a, b) => b.score - a.score || b.ts - a.ts);
  SP.scoreboard = SP.scoreboard.slice(0, 15);
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
  const board = Array.isArray(SP.scoreboard) ? SP.scoreboard : [];
  if (!board.length) {
    list.innerHTML = `<div class="lb-empty">Henüz kayıtlı uçuş yok.<br>Oyun sonunda adını yazıp kaydet!</div>`;
    return;
  }
  list.innerHTML = board.map((row, idx) => {
    const rankIcon = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
    const safeName = String(row.name || 'Pilot').replace(/[<>&"]/g, '');
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

function togglePause() {
  if (MP.connected || MP.reconnecting) return;
  if (state === STATE.PLAYING) {
    state = STATE.PAUSED;
    show(pauseScreen);
  } else if (state === STATE.PAUSED) {
    state = STATE.PLAYING;
    hide(pauseScreen);
  }
}

function goHome() {
  state = STATE.MENU;
  hide(hud);
  hide(gameoverScreen);
  hide(mpGameoverScreen);
  hide(pauseScreen);
  hide(shopScreen);
  hide(lbScreen);
  hide(statsScreen);
  hide(mpScreen);
  hide(tapHint);
  hide($('mp-opp-bar'));
  hide($('mp-spectate-bar'));
  hide($('mp-grace-banner'));
  updateSettingsUI();
  show(menuScreen);
}

// =====================================================
//   ÇEVRİMİÇİ FİLO DÜELLOSU (MPCore + PeerJS WebRTC)
// =====================================================
const MPC = typeof MPCore !== 'undefined' ? MPCore : null;
const MP_PEER_OPTS = MPC ? MPC.PEER_OPTS : { debug: 1 };

const MP = {
  peer: null,
  conn: null,
  isHost: false,
  connected: false,
  inLobby: false,
  inMatch: false,
  reconnecting: false,
  graceFrames: 0,
  peerLeftCleanly: false,
  switching: false,
  switchDest: '',
  roomCode: '',
  seed: 0,
  myName: 'Pilot',
  oppName: 'Rakip',
  myReady: false,
  oppReady: false,
  lobbyDiff: 'normal',
  lobbySector: 'nebula',
  matchDiff: 'normal',
  matchSector: 'nebula',
  oppScore: 0,
  oppAlive: true,
  oppRematch: false,
  rematchVotes: 0,
  seriesMe: 0,
  seriesOpp: 0,
  scoredThisMatch: false,
  spectating: false,
  specEndFrames: 0,
  pingMs: 0,
  lastRxAt: 0,
  oppShip: {
    x: VIRT_W * 0.5,
    y: VIRT_H * 0.80,
    tx: VIRT_W * 0.5,
    ty: VIRT_H * 0.80,
    bank: 0,
    tbank: 0,
    ship: 'falcon'
  }
};

let mpCountdown = 0;
let mpPingAcc = 0;
let mpShipSyncAcc = 0;
let mpHostWaiting = false;
let mpIdRetryCount = 0;
let mpJoinTries = 0;
const MP_MAX_JOIN_TRIES = 12;
let mpReconnectTimer = null;
let mpJoinTimer = null;
let mpSwitchTimer = null;
let mpCancelProbe = null;
let mpWakeLock = null;

function mpMakeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 5; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function mpGetMyName() {
  const inp = $('mp-name-input');
  const v = (inp ? inp.value.trim() : '') || SP.playerName || 'Pilot';
  const clean = v.slice(0, 12);
  if (clean && clean !== 'Pilot') {
    SP.playerName = clean;
    persist();
  }
  return clean;
}

function mpGetInviteUrl() {
  try {
    if (typeof location !== 'undefined' && location.href) {
      const base = location.href.split('?')[0].split('#')[0];
      return `${base}?room=${MP.roomCode}`;
    }
  } catch (e) {}
  return `space.html?room=${MP.roomCode}`;
}

async function mpRequestWakeLock() {
  try {
    if (typeof navigator !== 'undefined' && navigator.wakeLock && !mpWakeLock) {
      mpWakeLock = await navigator.wakeLock.request('screen');
      if (mpWakeLock && mpWakeLock.addEventListener) {
        mpWakeLock.addEventListener('release', () => { mpWakeLock = null; });
      }
    }
  } catch (e) {}
}

function mpReleaseWakeLock() {
  if (mpWakeLock) {
    try { mpWakeLock.release(); } catch (e) {}
    mpWakeLock = null;
  }
}

function mpClearTimers() {
  if (mpReconnectTimer) { clearTimeout(mpReconnectTimer); mpReconnectTimer = null; }
  if (mpJoinTimer) { clearTimeout(mpJoinTimer); mpJoinTimer = null; }
  if (mpSwitchTimer) { clearTimeout(mpSwitchTimer); mpSwitchTimer = null; }
}

function mpCleanup() {
  mpClearTimers();
  if (mpCancelProbe) { try { mpCancelProbe(); } catch (e) {} mpCancelProbe = null; }
  mpReleaseWakeLock();
  mpHostWaiting = false;
  MP.connected = false;
  MP.inLobby = false;
  MP.inMatch = false;
  MP.reconnecting = false;
  MP.graceFrames = 0;
  MP.switching = false;
  MP.switchDest = '';
  MP.spectating = false;
  MP.specEndFrames = 0;
  MP.myReady = false;
  MP.oppReady = false;
  if (MP.conn) { try { MP.conn.close(); } catch (e) {} MP.conn = null; }
  if (MP.peer) { try { MP.peer.destroy(); } catch (e) {} MP.peer = null; }
}

function mpSend(obj) {
  try {
    if (MP.conn && (MP.connected || MP.conn.open)) MP.conn.send(obj);
  } catch (e) {}
}

function mpOpenUI() {
  sfx.click();
  if (typeof Peer === 'undefined') {
    alert('Çevrimiçi mod için internet bağlantısı gerekir.');
    return;
  }
  state = STATE.MP;
  hide(menuScreen);
  show(mpScreen);
  if ($('mp-name-input')) {
    $('mp-name-input').value = SP.playerName || '';
    show($('mp-name-input'));
  }
  show($('mp-btn-row'));
  hide($('mp-host-area'));
  hide($('mp-join-area'));
  hide($('mp-ready-area'));
  $('mp-error').textContent = '';
}

function mpCopyCode() {
  if (!MP.roomCode) return;
  sfx.click();
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(MP.roomCode);
    }
  } catch (e) {}
  const btn = $('mp-copy-btn');
  if (btn) {
    const old = btn.textContent;
    btn.textContent = '✅ Kopyalandı!';
    setTimeout(() => { btn.textContent = old; }, 1600);
  }
}

function mpShareInvite() {
  if (!MP.roomCode) return;
  sfx.click();
  const url = mpGetInviteUrl();
  const text = `🚀 Uzay Avcısı düellosuna gel! Oda Kodu: ${MP.roomCode}\nDoğrudan katıl: ${url}`;
  if (typeof navigator !== 'undefined' && navigator.share) {
    navigator.share({ title: 'Uzay Avcısı Düello', text, url }).catch(() => {});
  } else {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url);
    } catch (e) {}
    const btn = $('mp-share-btn');
    if (btn) {
      const old = btn.textContent;
      btn.textContent = '🔗 Link Kopyalandı!';
      setTimeout(() => { btn.textContent = old; }, 1600);
    }
  }
}

function mpOpenReadyRoom() {
  MP.inLobby = true;
  hide($('mp-name-input'));
  hide($('mp-btn-row'));
  hide($('mp-host-area'));
  hide($('mp-join-area'));
  $('mp-error').textContent = '';

  if (MPC) {
    const area = MPC.mountReadyRoom($('mp-lobby'), {
      gameId: 'space',
      onToggleReady: mpToggleReady,
      onSwitchGame: mpSwitchGame
    });
    show(area);
    MPC.updatePingDOM(MP.pingMs);
  }
  mpRenderReadyRoom();
}

function mpRenderReadyRoom() {
  if (!MPC) return;
  const curDiff = MP.lobbyDiff || SP.difficulty || 'normal';
  const curSec = MP.lobbySector || SP.sector || 'nebula';
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
        value: curDiff,
        options: [
          { value: 'easy', label: 'Kolay' },
          { value: 'normal', label: 'Normal' },
          { value: 'hard', label: 'Zor' }
        ],
        onChange: val => {
          sfx.click();
          SP.difficulty = val;
          MP.lobbyDiff = val;
          persist();
          updateSettingsUI();
          mpSend({ t: 'lobby_cfg', diff: val, sector: MP.lobbySector, name: MP.myName, ship: SP.ship });
          mpRenderReadyRoom();
        }
      },
      {
        label: 'Sektör',
        value: curSec,
        options: [
          { value: 'nebula', label: '🌌 Bulutsu' },
          { value: 'crimson', label: '☄️ Kızıl' },
          { value: 'cyber', label: '⚡ Siber' },
          { value: 'emerald', label: '🧪 Kuasar' }
        ],
        onChange: val => {
          sfx.click();
          MP.lobbySector = val;
          SP.sector = val;
          updateSettingsUI();
          mpSend({ t: 'lobby_cfg', diff: MP.lobbyDiff, sector: val, name: MP.myName, ship: SP.ship });
          mpRenderReadyRoom();
        }
      }
    ]
  });
}

function mpSetReady(val) {
  MP.myReady = !!val;
  mpSend({ t: 'ready', r: MP.myReady });
  mpRenderReadyRoom();
  if (MP.isHost && MP.inLobby && MP.myReady && MP.oppReady) {
    mpBeginMatch();
  }
}

function mpToggleReady() {
  sfx.click();
  mpSetReady(!MP.myReady);
}

function mpFinishSwitchNavigate() {
  const dest = MP.switchDest;
  if (!dest) return;
  MP.switchDest = '';
  mpCleanup();
  location.href = dest;
}

function mpSwitchGame(targetGame) {
  if (!MPC || !MPC.GAMES[targetGame] || !MP.isHost || MP.switching) return;
  sfx.click();
  MP.peerLeftCleanly = true;

  if (!MP.connected) {
    const code = MP.roomCode || mpMakeRoomCode();
    MPC.saveParty({
      roomCode: code,
      role: 'host',
      myName: MP.myName || mpGetMyName(),
      oppName: '',
      targetGame,
      autoConnect: true,
      seriesMe: MP.seriesMe,
      seriesOpp: MP.seriesOpp
    });
    mpCleanup();
    location.href = MPC.GAMES[targetGame].file;
    return;
  }

  MP.switching = true;
  MP.switchDest = MPC.GAMES[targetGame].file;
  MPC.saveParty({
    roomCode: MP.roomCode,
    role: 'host',
    myName: MP.myName,
    oppName: MP.oppName,
    targetGame,
    autoConnect: true,
    seriesMe: MP.seriesMe,
    seriesOpp: MP.seriesOpp
  });
  const pkt = {
    t: '_switch_game',
    game: targetGame,
    roomCode: MP.roomCode,
    sHost: MP.seriesMe,
    sGuest: MP.seriesOpp
  };
  mpSend(pkt);
  setTimeout(() => { if (MP.switching) mpSend(pkt); }, 110);
  mpSwitchTimer = setTimeout(mpFinishSwitchNavigate, 420);
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

  const peer = new Peer('space-' + MP.roomCode, MP_PEER_OPTS);
  MP.peer = peer;

  peer.on('open', () => {
    if (MP.peer !== peer) return;
    mpIdRetryCount = 0;
    if (!MP.reconnecting) {
      $('mp-error').textContent = '';
      $('mp-room-code').textContent = MP.roomCode;
      $('mp-wait-text').textContent = '✅ Oda aktif! QR okut veya kodu gönder.';
      if (MPC) {
        MPC.mountHostQR($('mp-host-area'), mpGetInviteUrl());
        MPC.mountHostGamePicker($('mp-host-area'), 'space', mpSwitchGame);
      }
    }
  });

  peer.on('connection', conn => {
    if (MP.peer !== peer) return;
    if (MPC && MPC.answerProbeIfAny(conn, 'space', MP.roomCode, MP.connected)) return;
    if (MP.conn && MP.connected) { try { conn.close(); } catch (e) {} return; }
    if (MP.conn) { try { MP.conn.close(); } catch (e) {} }
    mpHostWaiting = false;
    mpClearTimers();
    MP.conn = conn;
    setupConn();
  });

  peer.on('disconnected', () => {
    if (MP.peer !== peer || !mpHostWaiting || MP.connected) return;
    if (!MP.reconnecting) {
      $('mp-error').textContent = '';
      $('mp-wait-text').textContent = '🔄 Arka plandan dönüldü, oda yenileniyor...';
    }
    mpScheduleHostReconnect(500, false);
  });

  peer.on('error', err => {
    if (MP.peer !== peer) return;
    const type = (err && err.type) || '';
    if (mpHostWaiting && !MP.connected) {
      if (type === 'unavailable-id') {
        mpIdRetryCount++;
        if (mpIdRetryCount <= 6 || MP.reconnecting) {
          if (!MP.reconnecting) {
            $('mp-error').textContent = '';
            $('mp-wait-text').textContent = '🔄 Oda kodu yeniden bağlanıyor...';
          }
          mpScheduleHostReconnect(1500, true);
          return;
        }
        MP.roomCode = mpMakeRoomCode();
        mpIdRetryCount = 0;
        $('mp-room-code').textContent = MP.roomCode;
        if (MPC) MPC.mountHostQR($('mp-host-area'), mpGetInviteUrl());
        mpScheduleHostReconnect(300, true);
        return;
      }
      if (['network', 'disconnected', 'server-error', 'socket-error', 'socket-closed', 'webrtc'].includes(type)) {
        if (!MP.reconnecting) {
          $('mp-error').textContent = '';
          $('mp-wait-text').textContent = '⏳ Sekmeden çıkıldığı için bağlantı uyudu — ekranda kal, yenileniyor...';
        }
        mpScheduleHostReconnect(1200, true);
        return;
      }
    }
    if (!MP.reconnecting) $('mp-error').textContent = 'Bağlantı hatası: ' + (type || 'bilinmiyor');
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

function mpHost(existingCode) {
  sfx.click();
  const keepCode = (typeof existingCode === 'string' && existingCode.length === 5) ? existingCode.toUpperCase() : '';
  const prevMe = MP.seriesMe, prevOpp = MP.seriesOpp;
  mpCleanup();
  MP.seriesMe = prevMe;
  MP.seriesOpp = prevOpp;
  MP.myName = mpGetMyName();
  hide($('mp-name-input'));
  hide($('mp-btn-row'));
  hide($('mp-ready-area'));
  show($('mp-host-area'));
  $('mp-error').textContent = '';

  MP.roomCode = keepCode || mpMakeRoomCode();
  MP.isHost = true;
  MP.peerLeftCleanly = false;
  MP.lobbyDiff = SP.difficulty || 'normal';
  MP.lobbySector = SP.sector || 'nebula';
  mpHostWaiting = true;
  mpIdRetryCount = 0;
  $('mp-room-code').textContent = MP.roomCode;
  $('mp-wait-text').textContent = 'Sunucuya bağlanılıyor...';
  if (MPC) {
    MPC.mountHostQR($('mp-host-area'), mpGetInviteUrl());
    MPC.mountHostGamePicker($('mp-host-area'), 'space', mpSwitchGame);
  }

  mpRequestWakeLock();
  mpOpenHostPeer();
}

function mpJoin() {
  sfx.click();
  MP.myName = mpGetMyName();
  hide($('mp-name-input'));
  hide($('mp-btn-row'));
  hide($('mp-ready-area'));
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
  if (!MP.reconnecting) {
    $('mp-error').textContent = '';
    $('mp-join-status').textContent = mpJoinTries === 1
      ? 'Bağlanılıyor...'
      : `⏳ Ev sahibinin oyuna dönmesi bekleniyor... (${mpJoinTries}/${MP_MAX_JOIN_TRIES})`;
  }

  const peer = new Peer(null, MP_PEER_OPTS);
  MP.peer = peer;

  const retryOrFail = (reason) => {
    if (MP.peer !== peer || MP.connected) return;
    mpClearTimers();
    const maxTries = MP.reconnecting ? 20 : MP_MAX_JOIN_TRIES;
    if (mpJoinTries < maxTries) {
      mpJoinTimer = setTimeout(mpAttemptJoin, MP.reconnecting ? 1200 : 2000);
    } else if (!MP.reconnecting) {
      $('mp-join-status').textContent = reason || 'Oda bulunamadı! Ev sahibinin oyun ekranında açık olduğundan emin ol.';
    }
  };

  mpJoinTimer = setTimeout(() => {
    if (!MP.connected && MP.peer === peer) retryOrFail('Oda yanıt vermedi, kodu ve ev sahibinin ekranını kontrol et.');
  }, 3800);

  peer.on('open', () => {
    if (MP.peer !== peer || MP.connected) return;
    const conn = peer.connect('space-' + MP.roomCode, { reliable: true });
    MP.conn = conn;
    setupConn();
  });

  peer.on('error', err => {
    if (MP.peer !== peer || MP.connected || MP.switching) return;
    const type = (err && err.type) || '';
    if (type === 'peer-unavailable' && MPC && !MP.reconnecting && !mpCancelProbe) {
      mpCancelProbe = MPC.probeRoomAcrossGames(Peer, MP.roomCode, 'space-', foundGame => {
        if (MP.connected || MP.switching) return;
        MP.switching = true;
        MP.peerLeftCleanly = true;
        MPC.saveParty({
          roomCode: MP.roomCode,
          role: 'guest',
          myName: MP.myName,
          oppName: 'Ev Sahibi',
          targetGame: foundGame,
          autoConnect: true,
          seriesMe: MP.seriesMe,
          seriesOpp: MP.seriesOpp
        });
        const dest = foundGame === 'hub' ? 'index.html' : (MPC.GAMES[foundGame] && MPC.GAMES[foundGame].file);
        if (dest) {
          mpCleanup();
          location.href = dest;
        }
      });
    }
    if (type === 'peer-unavailable' || type === 'network' || type === 'disconnected' || type === 'socket-error') {
      retryOrFail('Oda bulunamadı, kodu kontrol et!');
    } else if (!MP.reconnecting) {
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
  const prevMe = MP.seriesMe, prevOpp = MP.seriesOpp;
  mpCleanup();
  MP.seriesMe = prevMe;
  MP.seriesOpp = prevOpp;
  MP.myName = mpGetMyName();
  MP.roomCode = code;
  MP.isHost = false;
  MP.peerLeftCleanly = false;
  mpJoinTries = 0;
  mpAttemptJoin();
}

function mpEnterGraceReconnect() {
  if (MP.reconnecting) return;
  MP.connected = false;
  MP.reconnecting = true;
  MP.graceFrames = 12 * 60;
  mpClearTimers();
  if (MP.conn) { try { MP.conn.close(); } catch (e) {} MP.conn = null; }
  if (MP.peer) { try { MP.peer.destroy(); } catch (e) {} MP.peer = null; }

  if (MPC) {
    const banner = MPC.ensureGraceBanner(document.getElementById('game-wrapper'), mpLeave);
    show(banner);
  }
  const sub = $('mp-grace-sub');
  if (sub) sub.textContent = 'Kanat arkadaşının bağlantısı koptu — maç duraklatıldı, yeniden bağlanılıyor (12 sn)';

  if (MP.isHost) {
    mpHostWaiting = true;
    mpIdRetryCount = 0;
    mpOpenHostPeer();
  } else {
    mpJoinTries = 0;
    mpAttemptJoin();
  }
}

function mpGraceTick() {
  if (!MP.reconnecting) return;
  MP.graceFrames--;
  if (MP.graceFrames % 15 === 0) {
    const sec = Math.max(1, Math.ceil(MP.graceFrames / 60));
    const sub = $('mp-grace-sub');
    if (sub) sub.textContent = `Kanat arkadaşının bağlantısı koptu — maç duraklatıldı, yeniden bağlanılıyor (${sec} sn)`;
  }
  if (!MP.connected && MP.graceFrames > 0 && MP.graceFrames % 90 === 0) {
    if (MP.isHost) mpEnsureHostAlive(true);
    else mpAttemptJoin();
  }
  if (MP.graceFrames <= 0) {
    mpCleanup();
    goHome();
  }
}

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && (mpHostWaiting || MP.reconnecting) && !MP.connected) {
      if (MP.isHost) mpEnsureHostAlive(false);
      else if (MP.reconnecting) mpAttemptJoin();
    }
  });
}
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('focus', () => {
    if ((mpHostWaiting || MP.reconnecting) && !MP.connected) {
      if (MP.isHost) mpEnsureHostAlive(false);
      else if (MP.reconnecting) mpAttemptJoin();
    }
  });
  window.addEventListener('online', () => {
    if ((mpHostWaiting || MP.reconnecting) && !MP.connected) {
      if (MP.isHost) mpEnsureHostAlive(true);
      else if (MP.reconnecting) mpAttemptJoin();
    }
  });
}

function setupConn() {
  const conn = MP.conn;
  if (!conn) return;
  let opened = false;
  const onOpen = () => {
    if (opened || MP.conn !== conn) return;
    opened = true;
    mpClearTimers();
    mpHostWaiting = false;
    MP.connected = true;
    MP.peerLeftCleanly = false;
    MP.lastRxAt = performance.now();
    mpSend({ t: '_ping', ts: Math.round(performance.now()) });

    if (MP.inMatch && MP.reconnecting) {
      MP.reconnecting = false;
      MP.graceFrames = 0;
      hide($('mp-grace-banner'));
      mpSend({
        t: '_resume',
        name: MP.myName,
        ship: SP.ship,
        s: score,
        a: (!MP.spectating && (state === STATE.PLAYING || state === STATE.READY))
      });
      return;
    }

    MP.inLobby = true;
    MP.myReady = false;
    MP.oppReady = false;
    mpSend({
      t: 'hello',
      ship: SP.ship,
      name: MP.myName,
      diff: MP.lobbyDiff || SP.difficulty,
      sector: MP.lobbySector || SP.sector
    });
    if (MPC) mpOpenReadyRoom();
    else if (MP.isHost) mpBeginMatch();
  };
  if (conn.open) onOpen();
  else conn.on('open', onOpen);

  conn.on('data', data => {
    if (!data || !data.t) return;
    MP.lastRxAt = performance.now();
    switch (data.t) {
      case '_ping':
        mpSend({ t: '_pong', ts: data.ts });
        break;
      case '_pong': {
        const rtt = Math.max(1, performance.now() - (data.ts || 0));
        MP.pingMs = MP.pingMs > 0 ? MP.pingMs * 0.65 + rtt * 0.35 : rtt;
        if (MPC) MPC.updatePingDOM(MP.pingMs);
        break;
      }
      case '_switch_ack':
        if (MP.switching && MP.isHost) mpFinishSwitchNavigate();
        break;
      case '_leave':
        MP.peerLeftCleanly = true;
        if (MPC) MPC.clearParty();
        mpCleanup();
        goHome();
        break;
      case '_resume':
        MP.reconnecting = false;
        MP.graceFrames = 0;
        hide($('mp-grace-banner'));
        if (data.name) MP.oppName = String(data.name).slice(0, 12);
        if (data.ship && SHIPS[data.ship]) MP.oppShip.ship = data.ship;
        if (typeof data.s === 'number') MP.oppScore = data.s;
        if (typeof data.a === 'boolean') MP.oppAlive = data.a;
        mpUpdateLiveBar();
        if (MP.spectating) mpUpdateSpectateBar();
        break;
      case '_switch_game':
        if (MPC && MPC.GAMES[data.game] && !MP.switching) {
          MP.switching = true;
          MP.peerLeftCleanly = true;
          MP.switchDest = MPC.GAMES[data.game].file;
          MPC.saveParty({
            roomCode: data.roomCode || MP.roomCode,
            role: 'guest',
            myName: MP.myName,
            oppName: MP.oppName,
            targetGame: data.game,
            autoConnect: true,
            seriesMe: typeof data.sGuest === 'number' ? data.sGuest : MP.seriesMe,
            seriesOpp: typeof data.sHost === 'number' ? data.sHost : MP.seriesOpp
          });
          mpSend({ t: '_switch_ack', game: data.game });
          mpSwitchTimer = setTimeout(mpFinishSwitchNavigate, 90);
        }
        break;
      case 'hello':
        if (data.ship && SHIPS[data.ship]) MP.oppShip.ship = data.ship;
        if (data.name) MP.oppName = String(data.name).slice(0, 12);
        if (!MP.isHost) {
          if (data.diff && DIFFICULTIES[data.diff]) MP.lobbyDiff = data.diff;
          if (data.sector && SECTORS[data.sector]) MP.lobbySector = data.sector;
        }
        if (MP.isHost) {
          mpSend({
            t: 'lobby_cfg',
            diff: MP.lobbyDiff || SP.difficulty,
            sector: MP.lobbySector || SP.sector,
            name: MP.myName,
            ship: SP.ship
          });
        }
        if (!MP.inMatch) {
          if (MPC) mpOpenReadyRoom();
          else if (MP.isHost) mpBeginMatch();
        }
        break;
      case 'lobby_cfg':
        if (!MP.isHost) {
          if (data.diff && DIFFICULTIES[data.diff]) {
            MP.lobbyDiff = data.diff;
            MP.matchDiff = data.diff;
          }
          if (data.sector && SECTORS[data.sector]) {
            MP.lobbySector = data.sector;
            MP.matchSector = data.sector;
          }
        }
        if (data.name) MP.oppName = String(data.name).slice(0, 12);
        if (data.ship && SHIPS[data.ship]) MP.oppShip.ship = data.ship;
        mpRenderReadyRoom();
        break;
      case 'ready':
        MP.oppReady = !!data.r;
        mpRenderReadyRoom();
        if (MP.isHost && MP.inLobby && MP.myReady && MP.oppReady) {
          mpBeginMatch();
        }
        break;
      case 'match':
        if (!MP.isHost) {
          MP.connected = true;
          MP.inLobby = false;
          MP.seed = data.seed;
          MP.matchDiff = data.diff || MP.lobbyDiff || SP.difficulty;
          MP.matchSector = data.sector || MP.lobbySector || SP.sector;
          if (data.ship && SHIPS[data.ship]) MP.oppShip.ship = data.ship;
          if (data.name) MP.oppName = String(data.name).slice(0, 12);
          mpBeginMatch(data.cd);
        }
        break;
      case 'ship':
        MP.oppShip.tx = typeof data.nx === 'number' ? data.nx * VIRT_W : (data.x || VIRT_W * 0.5);
        MP.oppShip.ty = typeof data.ny === 'number' ? data.ny * VIRT_H : (data.y || VIRT_H * 0.8);
        MP.oppShip.tbank = data.b || 0;
        if (MP.oppAlive && !data.a) {
          spawnExplosion(MP.oppShip.x, MP.oppShip.y, '#00e5ff', 18, 1.1);
        }
        MP.oppAlive = !!data.a;
        break;
      case 'emp':
        spawnShock(MP.oppShip.x, MP.oppShip.y, '#00e5ff', VIRT_W * 0.65, 22);
        break;
      case 'score':
        MP.oppScore = data.s || 0;
        mpUpdateLiveBar();
        if (MP.spectating) mpUpdateSpectateBar();
        break;
      case 'gameover':
        if (MP.oppAlive) {
          spawnExplosion(MP.oppShip.x, MP.oppShip.y, '#ff9e00', 22, 1.2);
          if (MP.spectating) {
            sfx.boom(true);
            shakeT = 0.65;
          }
        }
        MP.oppScore = data.s || 0;
        MP.oppAlive = false;
        mpUpdateLiveBar();
        mpUpdateSpectateBar();
        if (MP.spectating) {
          MP.specEndFrames = 38;
        } else if (state === STATE.GAMEOVER && MP.connected && !mpGameoverScreen.classList.contains('hidden')) {
          mpFinishDuel();
        }
        break;
      case 'rematch':
        MP.oppRematch = true;
        if (MP.isHost && MP.rematchVotes > 0) mpBeginMatch();
        break;
    }
  });

  conn.on('close', () => {
    MP.connected = false;
    if (MP.switching) {
      if (MP.switchDest) mpFinishSwitchNavigate();
      return;
    }
    if (!MP.peerLeftCleanly && MP.inMatch && (state === STATE.PLAYING || state === STATE.READY || MP.spectating)) {
      mpEnterGraceReconnect();
      return;
    }
    if (state !== STATE.MENU) {
      mpCleanup();
      goHome();
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
  if (t) t.textContent = MP.oppAlive ? `🎥 ${MP.oppName} savaşıyor` : `💥 ${MP.oppName} düştü!`;
  if (s) s.textContent = `Sen: ${score} · O: ${MP.oppScore}`;
}

function mpDrawSpectatorTopBanner() {
  ctx.save();
  const txt = `🔴 CANLI İZLENİYOR — ${MP.oppName.toUpperCase()} (${MP.oppScore})`;
  ctx.font = '800 13px "Segoe UI", Arial';
  const tw = Math.max(195, ctx.measureText(txt).width + 28);
  const bx = (W - tw) / 2, by = 14, bh = 30;
  ctx.fillStyle = 'rgba(10, 18, 34, 0.78)';
  ctx.strokeStyle = 'rgba(255, 82, 82, 0.65)';
  ctx.lineWidth = 1.5;
  roundRect(bx, by, tw, bh, 15);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(txt, W / 2, by + bh / 2 + 0.5);
  ctx.restore();
}

function mpStartMatchUI() {
  hide($('mp-spectate-bar'));
  hide($('mp-grace-banner'));
  let bar = $('mp-opp-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'mp-opp-bar';
    bar.className = 'mp-opp-bar';
    document.getElementById('game-wrapper').appendChild(bar);
  }
  bar.innerHTML = `🚀 <span id="mp-opp-bar-name"></span>: <span class="opp-score" id="mp-opp-live">0</span> <span id="mp-hud-ping" class="mp-ping-pill ping-idle">⚪ -- ms</span>`;
  $('mp-opp-bar-name').textContent = MP.oppName;
  if (MPC) MPC.updatePingDOM(MP.pingMs);
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
  if (!MP.connected && !MP.reconnecting) return;
  mpSend({ t: 'gameover', s: score });
  $('mp-final-me').textContent = score;
  $('mp-me-label').textContent = MP.myName || 'Sen';
  $('mp-final-opp').textContent = MP.oppScore;
  $('mp-opp-label').textContent = MP.oppName || 'Rakip';

  if (MP.oppAlive) {
    MP.spectating = true;
    MP.specEndFrames = 0;
    state = STATE.PLAYING;
    hide(gameoverScreen);
    hide(mpGameoverScreen);
    hide(hud);
    hide($('mp-opp-bar'));
    mpShowSpectateBar();
    addPopup(VIRT_W * 0.5, VIRT_H * 0.28, `🎥 ${MP.oppName} canlı izleniyor!`, '#00e5ff');
  } else {
    mpFinishDuel();
  }
}

function mpFinishDuel() {
  MP.inMatch = false;
  MP.spectating = false;
  MP.specEndFrames = 0;
  state = STATE.GAMEOVER;
  hide($('mp-spectate-bar'));
  hide($('mp-grace-banner'));
  hide($('mp-opp-bar'));
  $('mp-final-me').textContent = score;
  $('mp-final-opp').textContent = MP.oppScore;
  $('mp-me-label').textContent = MP.myName || 'Sen';
  $('mp-opp-label').textContent = MP.oppName || 'Rakip';

  let txt;
  if (score > MP.oppScore) {
    txt = '🏆 KAZANDIN!';
    if (!MP.scoredThisMatch) { MP.seriesMe++; MP.scoredThisMatch = true; }
    sfx.win();
  } else if (score < MP.oppScore) {
    txt = '💀 KAYBETTİN...';
    if (!MP.scoredThisMatch) { MP.seriesOpp++; MP.scoredThisMatch = true; }
  } else {
    txt = '🤝 BERABERE!';
    MP.scoredThisMatch = true;
  }
  $('mp-result-text').textContent = txt;
  const serEl = $('mp-series-text');
  if (serEl) serEl.textContent = `🏅 Seri: ${MP.myName} ${MP.seriesMe} - ${MP.seriesOpp} ${MP.oppName}`;
  if (MPC) MPC.mountGameoverSwitcher(mpGameoverScreen, 'space', () => MP.isHost && MP.connected, mpSwitchGame);
  hide(gameoverScreen);
  hide(hud);
  show(mpGameoverScreen);
}

function mpLeave() {
  sfx.click();
  MP.peerLeftCleanly = true;
  mpSend({ t: '_leave' });
  if (MPC) MPC.clearParty();
  mpCleanup();
  goHome();
}

function mpBeginMatch(guestCdFrames) {
  MP.inLobby = false;
  MP.inMatch = true;
  MP.reconnecting = false;
  MP.graceFrames = 0;
  MP.myReady = false;
  MP.oppReady = false;
  MP.scoredThisMatch = false;
  MP.spectating = false;
  MP.specEndFrames = 0;
  hide($('mp-spectate-bar'));
  hide($('mp-grace-banner'));
  hide(mpScreen);

  const baseCd = 3 * 60;
  if (MP.isHost) {
    MP.seed = Math.floor(Math.random() * 1e9);
    MP.matchDiff = MP.lobbyDiff || SP.difficulty || 'normal';
    MP.matchSector = MP.lobbySector || SP.sector || 'nebula';
    mpSend({
      t: 'match',
      seed: MP.seed,
      diff: MP.matchDiff,
      sector: MP.matchSector,
      ship: SP.ship,
      name: MP.myName,
      cd: baseCd
    });
    mpCountdown = baseCd;
  } else {
    mpCountdown = MPC ? MPC.compensatedCountdownFrames(guestCdFrames || baseCd, MP.pingMs) : baseCd;
  }

  startGame();
  MP.oppShip.x = MP.oppShip.tx = VIRT_W * 0.5;
  MP.oppShip.y = MP.oppShip.ty = VIRT_H * 0.80;
  MP.oppShip.bank = MP.oppShip.tbank = 0;
  MP.oppAlive = true;
  MP.oppScore = 0;
  MP.oppRematch = false;
  MP.rematchVotes = 0;
  mpStartMatchUI();
}

function mpCountdownTick() {
  if (mpCountdown <= 0) return;
  mpCountdown--;
  if (mpCountdown === 0 && state === STATE.READY) {
    state = STATE.PLAYING;
  }
}

function mpDrawCountdown() {
  if (mpCountdown <= 0) return;
  const n = Math.ceil(mpCountdown / 60);
  const phase = (mpCountdown % 60) / 60;
  const scale = 0.8 + 0.5 * phase;
  ctx.save();
  ctx.globalAlpha = 0.4 + 0.6 * phase;
  ctx.translate(W / 2, H * 0.36);
  ctx.scale(scale, scale);
  ctx.font = '900 88px "Segoe UI", Arial';
  ctx.textAlign = 'center';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.strokeText(String(n), 0, 0);
  ctx.fillStyle = '#ffd700';
  ctx.fillText(String(n), 0, 0);
  ctx.restore();
  ctx.font = '800 16px "Segoe UI", Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText('Filolar eşzamanlı havalanıyor!', W / 2, H * 0.36 + 34);
  ctx.textAlign = 'left';
}

function mpBgTick() {
  if (!MP.connected) return;
  mpPingAcc++;
  if (mpPingAcc % 60 === 0) {
    mpSend({ t: '_ping', ts: Math.round(performance.now()) });
  }
}

function mpShipTick() {
  if (!MP.connected) return;
  mpShipSyncAcc++;
  if (mpShipSyncAcc % 2 === 0 && !MP.spectating) {
    mpSend({
      t: 'ship',
      nx: Math.round((player.x / VIRT_W) * 1000) / 1000,
      ny: Math.round((player.y / VIRT_H) * 1000) / 1000,
      b: Math.round(player.bank * 100) / 100,
      a: (state === STATE.PLAYING || state === STATE.READY) && player.hp > 0
    });
  }
  mpUpdateLiveBar();
}

// ---------- UI Olay Bağlantıları ----------
$('start-btn').addEventListener('click', () => { sfx.click(); startGame(); });
$('retry-btn').addEventListener('click', () => { sfx.click(); startGame(); });
$('home-btn').addEventListener('click', () => { sfx.click(); goHome(); });
$('quit-btn').addEventListener('click', () => { sfx.click(); goHome(); });
$('resume-btn').addEventListener('click', () => { sfx.click(); togglePause(); });
if (pauseBtn) pauseBtn.addEventListener('click', togglePause);
if (empBtn) {
  empBtn.addEventListener('click', e => {
    e.stopPropagation();
    triggerEMP();
  });
  empBtn.addEventListener('touchstart', e => {
    e.preventDefault();
    e.stopPropagation();
    triggerEMP();
  }, { passive: false });
}

$('back-to-hub-btn').addEventListener('click', () => { sfx.click(); location.href = 'index.html'; });

// Zorluk ve Gemi Seçimi
document.querySelectorAll('#diff-tabs .diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    sfx.click();
    SP.difficulty = btn.dataset.diff;
    updateSettingsUI();
    persist();
  });
});

document.querySelectorAll('#menu-skin-row .skin-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.skin;
    if (!SP.unlockedShips.includes(key)) {
      openShop('ships', `🔒 ${SHIPS[key].name} gemisini ${SHIPS[key].cost} 🪙 ile açabilirsin!`);
      return;
    }
    sfx.click();
    SP.ship = key;
    persist();
    renderMenuSkins();
  });
});

// Mobil Kontrol Modu & Hassasiyet
function toggleCtrlMode() {
  sfx.click();
  SP.ctrlMode = SP.ctrlMode === 'trackpad' ? 'direct' : 'trackpad';
  updateSettingsUI();
  persist();
}
if (ctrlModeBtn) ctrlModeBtn.addEventListener('click', toggleCtrlMode);
if (pauseCtrlBtn) pauseCtrlBtn.addEventListener('click', toggleCtrlMode);

function onSensInput(val) {
  SP.sensitivity = Math.max(0.6, Math.min(2.2, Number(val) / 100));
  updateSettingsUI();
  persist();
}
if (sensRange) sensRange.addEventListener('input', () => onSensInput(sensRange.value));
if (pauseSensRange) pauseSensRange.addEventListener('input', () => onSensInput(pauseSensRange.value));

// Ses & Müzik
if (soundBtn) {
  soundBtn.addEventListener('click', () => {
    getAC();
    audioSettings.soundOn = !audioSettings.soundOn;
    updateSettingsUI();
    persist();
    sfx.click();
  });
}
if (musicBtn) {
  musicBtn.addEventListener('click', () => {
    getAC();
    audioSettings.musicOn = !audioSettings.musicOn;
    updateSettingsUI();
    persist();
    sfx.click();
  });
}
if (volumeRange) {
  volumeRange.addEventListener('input', () => {
    getAC();
    audioSettings.volume = Number(volumeRange.value) / 100;
    updateSettingsUI();
    persist();
  });
}

// Hangar Mağazası, Skor Tablosu & İstatistik
$('shop-btn').addEventListener('click', () => openShop('ships'));
$('menu-coin-pill').addEventListener('click', () => openShop('ships'));
$('shop-close-btn').addEventListener('click', () => { sfx.click(); hide(shopScreen); });
document.querySelectorAll('.shop-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    sfx.click();
    currentShopTab = btn.dataset.tab;
    document.querySelectorAll('.shop-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderShopList();
  });
});

$('lb-btn').addEventListener('click', () => {
  sfx.click();
  renderLeaderboard();
  show(lbScreen);
});
$('lb-close-btn').addEventListener('click', () => { sfx.click(); hide(lbScreen); });
if ($('save-score-btn')) $('save-score-btn').addEventListener('click', saveCurrentScore);
if ($('player-name')) {
  $('player-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveCurrentScore();
  });
}

$('stats-btn').addEventListener('click', () => {
  sfx.click();
  $('st-best').textContent = SP.bestScore || 0;
  $('st-kills').textContent = SP.totalKills || 0;
  $('st-bosses').textContent = SP.bossKills || 0;
  $('st-wave').textContent = SP.bestWave || 1;
  $('st-combo').textContent = SP.bestCombo || 0;
  $('st-games').textContent = SP.games || 0;
  $('st-coins').textContent = SP.totalCoins || SP.coins || 0;
  show(statsScreen);
});
$('stats-close-btn').addEventListener('click', () => { sfx.click(); hide(statsScreen); });

// Çevrimiçi Lobi Olayları
$('mp-btn').addEventListener('click', mpOpenUI);
$('mp-host-btn').addEventListener('click', () => mpHost());
$('mp-join-btn').addEventListener('click', mpJoin);
$('mp-join-confirm').addEventListener('click', mpJoinConfirm);
if ($('mp-copy-btn')) $('mp-copy-btn').addEventListener('click', mpCopyCode);
if ($('mp-share-btn')) $('mp-share-btn').addEventListener('click', mpShareInvite);
$('mp-code-input').addEventListener('keydown', e => { if (e.key === 'Enter') mpJoinConfirm(); });
$('mp-quit-btn').addEventListener('click', () => {
  sfx.click();
  MP.peerLeftCleanly = true;
  mpSend({ t: '_leave' });
  if (MPC) MPC.clearParty();
  mpCleanup();
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

// ---------- Ana Oyun Döngüsü (Sabit 60 Hz Adım) ----------
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
    mpBgTick();
    stepBackground();

    if (MP.reconnecting) {
      mpGraceTick();
      continue;
    }

    if (state === STATE.READY) {
      stepPlayerMovement();
      if (MP.connected) {
        mpCountdownTick();
        mpShipTick();
      } else {
        state = STATE.PLAYING;
      }
      stepEffects();
    } else if (state === STATE.PLAYING) {
      stepWorld();
      if (MP.connected) mpShipTick();
      stepEffects();
    } else if (state !== STATE.PAUSED) {
      stepEffects();
    }
  }

  draw();
  requestAnimationFrame(loop);
}

// ---------- Başlat ----------
function init() {
  initStarfield();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  updateSettingsUI();
  ensureMusicLoop();
  show(menuScreen);

  // 1) Oyunlar arası ortak oda taşıma (sessionStorage Parti Oturumu)
  const party = MPC ? MPC.loadParty() : null;
  if (party && party.autoConnect && (!party.targetGame || party.targetGame === 'space')) {
    MPC.saveParty({ ...party, autoConnect: false });
    MP.seriesMe = party.seriesMe || 0;
    MP.seriesOpp = party.seriesOpp || 0;
    if (party.myName) SP.playerName = party.myName;
    if (party.oppName) MP.oppName = party.oppName;
    mpOpenUI();
    if ($('mp-name-input') && party.myName) $('mp-name-input').value = party.myName;
    if (party.role === 'host') {
      mpHost(party.roomCode);
    } else {
      mpJoin();
      $('mp-code-input').value = party.roomCode;
      mpJoinConfirm();
    }
  } else {
    // 2) Davet linkinden (?room=XXXXX) gelindiyse otomatik odaya katıl!
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
  }

  requestAnimationFrame(loop);
}

init();
