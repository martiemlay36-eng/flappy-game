"use strict";

/* =====================================================
   OYUN SALONU - çok oyunlu mimari
   Şu an 1 oyun aktif: Flappy Kuş. Yeni oyunlar
   GAMES listesine eklenerek salona bağlanabilir.
   Sesler Web Audio API ile üretilir, harici dosya yok.
   ===================================================== */

// ---------- Canvas kurulumu ----------
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

let W = 420, H = 700, DPR = 1;

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = rect.width; H = rect.height;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

// ---------- DOM referansları ----------
const $ = id => document.getElementById(id);
const hud = $('hud'), scoreDisplay = $('score-display'), powerBadges = $('power-badges');
const menuScreen = $('menu-screen'), gameoverScreen = $('gameover-screen');
const pauseScreen = $('pause-screen'), statsScreen = $('stats-screen');
const mpScreen = $('mp-screen'), mpGameoverScreen = $('mp-gameover-screen');
const tapHint = $('tap-hint');
const medalDisplay = $('medal-display'), medalIcon = $('medal-icon'), medalText = $('medal-text');
const newRecord = $('new-record');
const soundBtn = $('sound-btn'), musicBtn = $('music-btn'), pauseBtn = $('pause-btn');

// ---------- Zorluk seviyeleri ----------
const DIFFICULTIES = {
  easy:   { gravity: 0.22, flapSpeed: -5.6, pipeGap: 190, pipeSpeed: 2.0, pipeInterval: 130, accSpeed: 0.00005, accGap: 0.2 },
  normal: { gravity: 0.27, flapSpeed: -6.2, pipeGap: 155, pipeSpeed: 2.6, pipeInterval: 105, accSpeed: 0.00009, accGap: 0.35 },
  hard:   { gravity: 0.33, flapSpeed: -6.9, pipeGap: 125, pipeSpeed: 3.3, pipeInterval: 85,  accSpeed: 0.00014, accGap: 0.5 }
};
let currentDiff = 'normal';

// ---------- Kuş skinleri ----------
const SKINS = {
  yellow: { body: '#FFD700', belly: '#FFF3C4', wing: '#FFAA00', outline: '#8a5a00', wingOut: '#b3541e', beak: '#FF7043', beakOut: '#c0392b' },
  red:    { body: '#FF5252', belly: '#FFD9D0', wing: '#E53935', outline: '#7a1512', wingOut: '#7a1010', beak: '#FFB300', beakOut: '#b26a00' },
  blue:   { body: '#40C4FF', belly: '#D9F4FF', wing: '#0288D1', outline: '#0b4a76', wingOut: '#094a76', beak: '#FFB300', beakOut: '#b26a00' },
  purple: { body: '#B388FF', belly: '#EDE0FF', wing: '#7C4DFF', outline: '#45229e', wingOut: '#401a92', beak: '#FFD54F', beakOut: '#a8841b' }
};

function skinColors() { return SKINS[F.skin] || SKINS.yellow; }

// ---------- Kalıcı veriler (çok oyunlu yapı) ----------
const STORAGE_KEY = 'oyun-salonu-v2';
let saved = loadSaved();

function defaultSaved() {
  return {
    soundOn: true,
    musicOn: true,
    volume: 0.7,
    flappy: {
      difficulty: 'normal',
      skin: 'yellow',
      bestScore: 0,
      games: 0,
      totalTime: 0,
      recentScores: [],
      scoreboard: []
    }
  };
}

function migrateOld(d, old) {
  // v1'den gelen düz yapı -> flappy altına taşı
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
    const raw = localStorage.getItem('satican-flappy-v1');
    if (raw) migrateOld(d, JSON.parse(raw)); // eski kayıtları koru
  } catch (e) {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      d.soundOn = !!s.soundOn;
      d.musicOn = s.musicOn !== false;
      d.volume = typeof s.volume === 'number' ? s.volume : 0.7;
      if (s.flappy && typeof s.flappy === 'object') {
        Object.keys(d.flappy).forEach(k => {
          if (s.flappy[k] !== undefined) d.flappy[k] = s.flappy[k];
        });
      }
    }
  } catch (e) {}
  return d;
}

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch (e) {}
}

// kısaltma: flapy oyun verileri
const F = saved.flappy;

// ---------- Ses motoru (Web Audio API) ----------
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function beep(freq, duration, type = 'square', volume = 0.15, slide = 0) {
  if (!saved.soundOn) return;
  const ac = getAudioCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ac.currentTime + duration);
  gain.gain.setValueAtTime(volume, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + duration);
}

const sfx = {
  flap:    () => beep(520, 0.10, 'sine', 0.18, 180),
  score:   () => { beep(880, 0.09, 'square', 0.12); setTimeout(() => beep(1174, 0.12, 'square', 0.12), 80); },
  hit:     () => beep(180, 0.25, 'sawtooth', 0.25, -110),
  die:     () => { beep(300, 0.3, 'triangle', 0.2, -220); setTimeout(() => beep(150, 0.4, 'triangle', 0.2, -100), 200); },
  medal:   () => { [660, 880, 1100, 1320].forEach((f, i) => setTimeout(() => beep(f, 0.15, 'sine', 0.15), i * 110)); },
  click:   () => beep(700, 0.06, 'sine', 0.1)
};

// ---------- Oyun durumu ----------
const STATE = { READY: 1, PLAYING: 2, DYING: 3, GAMEOVER: 4, PAUSED: 5, MENU: 6, MP: 7 };
let state = STATE.MENU;

const bird = {
  x: 0, y: 0, vy: 0, r: 14,
  rot: 0, wing: 0, wingDir: 1
};

let pipes = [];
let powers = [];      // power-up nesneleri
let popups = [];      // "+2" gibi yüzen yazılar
let particles = [];
let score = 0;
let frames = 0;
let pipeTimer = 0;
let playStartMs = 0;
let flashAlpha = 0;
let groundX = 0;
let themeNess = 0; // 0=gündüz 1=gece

// power-up durumları
let shieldActive = false;   // tek kullanımlık kalkan
let slowFrames = 0;         // boruların yavaşladığı süre (frame)
let x2Left = 0;             // çift puan sayılacak boru sayısı
// görsel cila
let shakeT = 0;             // ekran sarsıntısı süresi
let dyingTicks = 0;         // ölümde slow-motion sayacı

// Parallax bulutlar & yıldızlar
let clouds = [];
let stars = [];
let hills = [];
let trees = [];
let shootingStars = [];

// ---------- Ekran metinleri / yardımcılar ----------
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

function updateSoundBtn() {
  soundBtn.textContent = saved.soundOn ? '🔊 Ses: Açık' : '🔇 Ses: Kapalı';
}

function medalFor(s) {
  if (s >= 40) return { icon: '💎', text: 'PLATİN' };
  if (s >= 25) return { icon: '🥇', text: 'ALTIN' };
  if (s >= 15) return { icon: '🥈', text: 'GÜMÜŞ' };
  if (s >= 8)  return { icon: '🥉', text: 'BRONZ' };
  return null;
}

// ---------- Dünya nesnelerini doldur ----------
function initClouds() {
  clouds = [];
  for (let i = 0; i < 6; i++) {
    clouds.push({
      x: Math.random() * W,
      y: 40 + Math.random() * (H * 0.35),
      s: 0.5 + Math.random() * 0.7,
      sp: 0.15 + Math.random() * 0.35
    });
  }
  stars = [];
  for (let i = 0; i < 45; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H * 0.7,
      r: 0.6 + Math.random() * 1.4,
      tw: Math.random() * Math.PI * 2,
      tws: 0.02 + Math.random() * 0.05
    });
  }
  hills = [];
  for (let i = 0; i < 8; i++) {
    hills.push({ x: i * 90, h: 60 + Math.random() * 70, w: 80 + Math.random() * 60 });
  }
  trees = [];
  for (let i = 0; i < 10; i++) {
    trees.push({ x: i * 70 + Math.random() * 40, h: 24 + Math.random() * 20, w: 22 + Math.random() * 12 });
  }
}

// ---------- Oyuna başlama ----------
function startGame() {
  // çevrimiçi modda: host'la aynı tohum ve zorluk (deterministik senkron)
  if (MP.connected) {
    if (MP.isHost) {
      MP.seed = Math.floor(Math.random() * 1e9);
      MP.matchDiff = F.difficulty;
      // tohum + zorluğu rakibe bildir (ilk bağlantı ve her rövanş)
      mpSend({ t: 'hello', skin: F.skin, seed: MP.seed, diff: F.difficulty });
    }
    seedRng(MP.seed || 1);
    currentDiff = MP.matchDiff || F.difficulty;
  } else {
    currentDiff = F.difficulty;
  }
  const d = DIFFICULTIES[currentDiff];

  bird.x = W * 0.28;
  bird.y = H * 0.42;
  bird.vy = 0;
  bird.rot = 0;

  pipes = [];
  powers = [];
  popups = [];
  particles = [];
  score = 0;
  pipeTimer = -30; // ilk boru biraz gecikmeli
  frames = 0;
  flashAlpha = 0;
  themeNess = 0;

  // power-up durumlarını sıfırla
  shieldActive = false;
  slowFrames = 0;
  x2Left = 0;
  shakeT = 0;

  if (MP.connected) {
    MP.oppScore = 0;
    MP.oppAlive = true;
    MP.oppRematch = false;
    MP.rematchVotes = 0;
  }

  scoreDisplay.textContent = '0';
  powerBadges.innerHTML = '';
  show(hud); show(tapHint);
  hide(menuScreen); hide(gameoverScreen); hide(pauseScreen); hide(statsScreen);
  hide(mpScreen); hide(mpGameoverScreen);

  state = STATE.READY;
  playStartMs = performance.now();
}

function beginPlay() {
  state = STATE.PLAYING;
  hide(tapHint);
  flap();
}

function flap() {
  if (state !== STATE.PLAYING && state !== STATE.READY) return;
  if (state === STATE.READY) beginPlay();
  bird.vy = DIFFICULTIES[currentDiff].flapSpeed;
  bird.wingDir = -1;
  sfx.flap();
  // zıplama partikülü
  for (let i = 0; i < 4; i++) {
    particles.push({
      x: bird.x - 10, y: bird.y + 8,
      vx: -0.6 - Math.random() * 1.2, vy: (Math.random() - 0.2) * 1.2,
      life: 18, r: 2 + Math.random() * 2, color: 'rgba(255,255,255,0.7)'
    });
  }
}

function addScore(p, amount = 1) {
  score += amount;
  scoreDisplay.textContent = score;
  sfx.score();

  // "+2" gibi yüzen yazı
  if (amount > 1) popups.push({ x: p.x, y: p.y - 12, txt: `+${amount}`, life: 44 });

  // skor baloncukları
  for (let i = 0; i < 6; i++) {
    particles.push({
      x: p.x, y: p.y,
      vx: (Math.random() - 0.5) * 3, vy: -1 - Math.random() * 2,
      life: 26, r: 2 + Math.random() * 2.5, color: amount > 1 ? 'rgba(0,255,180,0.9)' : 'rgba(255,215,0,0.9)'
    });
  }
}

function die(grounded) {
  if (state !== STATE.PLAYING) return;
  state = STATE.DYING;
  sfx.hit();
  flashAlpha = 0.7;
  shakeT = 1;
  hide(tapHint);

  // çarpma partikülleri
  for (let i = 0; i < 14; i++) {
    particles.push({
      x: bird.x, y: bird.y,
      vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.7) * 7,
      life: 30 + Math.random() * 20, r: 2 + Math.random() * 3,
      color: Math.random() > 0.5 ? 'rgba(255,120,60,0.9)' : 'rgba(255,215,0,0.9)'
    });
  }

  if (grounded) killConfirm();
}

function killConfirm() {
  if (state !== STATE.DYING) return;
  state = STATE.GAMEOVER;
  sfx.die();

  // istatistikleri güncelle
  const playMs = performance.now() - playStartMs;
  F.games++;
  F.totalTime += playMs / 1000;
  F.recentScores.unshift(score);
  F.recentScores = F.recentScores.slice(0, 5);

  const isRecord = score > F.bestScore;
  if (isRecord) F.bestScore = score;
  persist();

  if (MP.connected) {
    mpOnDeath();
    return; // çok oyunculu ekranı göster, normal ekranı atla
  }

  // ekrana yansıt
  $('final-score').textContent = score;
  $('best-score-go').textContent = F.bestScore;
  if (isRecord && score > 0) show(newRecord); else hide(newRecord);

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

// ---------- Borular ----------
// deterministik rastgele üretici: host ve guest aynı tohumla aynı boruları üretir
function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

let rng = Math.random;

function seedRng(s) { rng = mulberry32(s); }

function spawnPipe() {
  const d = DIFFICULTIES[currentDiff];
  // zamanla zorlaşma
  const progress = Math.min(1, score / 40);
  const gap = Math.max(d.pipeGap * 0.65, d.pipeGap - d.pipeGap * d.accGap * progress);
  const speed = d.pipeSpeed + d.accSpeed * score * 100;
  const margin = 70;
  const topH = margin + rng() * (H - gap - margin * 2 - groundH());

  pipes.push({
    x: W + 30, topH: topH, gap: gap,
    w: 58, speed: speed,
    passed: false
  });
}

function groundH() { return H * 0.11; }

// ---------- Güncelleme ----------
function update() {
  frames++;
  const d = DIFFICULTIES[currentDiff];

  // hedef tema: skora göre mahallede gece
  const targetTheme = Math.floor(score / 15) % 2;
  themeNess += (targetTheme - themeNess) * 0.02;

  // bulutlar her zaman hareket etsin
  clouds.forEach(c => {
    c.x -= c.sp * (state === STATE.PLAYING ? 1 : 0.4);
    if (c.x < -80) { c.x = W + 80; c.y = 40 + Math.random() * (H * 0.35); }
  });
  stars.forEach(s => { s.tw += s.tws; });

  // zemin kaydırma
  if (state === STATE.PLAYING || state === STATE.DYING) {
    groundX -= (state === STATE.PLAYING ? d.pipeSpeed : 0);
    if (groundX <= -48) groundX += 48;
  }

  if (state === STATE.READY) {
    // kuş havada süzülür
    bird.y = H * 0.42 + Math.sin(frames * 0.08) * 8;
    bird.wing += bird.wingDir * 0.28;
    if (bird.wing > 1) { bird.wing = 1; bird.wingDir = -1; }
    if (bird.wing < -1) { bird.wing = -1; bird.wingDir = 1; }
  }

  if (state === STATE.PLAYING) {
    bird.vy += d.gravity;
    bird.y += bird.vy;

    // rotasyon hıza göre
    const targetRot = Math.max(-0.5, Math.min(1.35, bird.vy * 0.09));
    bird.rot += (targetRot - bird.rot) * 0.2;

    // kanat animasyonu
    bird.wing += bird.wingDir * 0.3;
    if (bird.wing > 1) { bird.wing = 1; bird.wingDir = -1; }
    if (bird.wing < -1) { bird.wing = -1; bird.wingDir = 1; }
    if (bird.vy > 3) bird.wingDir = 0; // düşerken kanatlar sabit

    // borular: her oyuncu kendi dünya kopyasını simüle eder (senkron başlangıç)
    pipeTimer++;
    if (pipeTimer >= d.pipeInterval) { spawnPipe(); pipeTimer = 0; }

    pipes.forEach(p => { p.x -= p.speed; });

    // skor & çarpışma
    const gh = groundH();
    for (const p of pipes) {
      if (!p.passed && p.x + p.w < bird.x - bird.r) {
        p.passed = true;
        addScore({ x: bird.x + 24, y: bird.y });
        mpOnScore();
      }
      if (hitPipe(p)) { die(false); break; }
    }

    if (bird.y + bird.r > H - gh) { bird.y = H - gh - bird.r; die(true); }
    if (bird.y - bird.r < -60) bird.y = -60 + bird.r; // üst sınıra çarparsan süzül

    pipes = pipes.filter(p => p.x + p.w > -60);
  }

  if (state === STATE.DYING) {
    // kuş düşmeye devam eder
    bird.vy += d.gravity * 1.4;
    bird.y += bird.vy;
    bird.rot = Math.min(bird.rot + 0.08, Math.PI / 2);
    if (bird.y + bird.r >= H - groundH()) killConfirm();
  }

  // partiküller
  particles.forEach(pt => {
    pt.x += pt.vx; pt.y += pt.vy;
    pt.vy += 0.05; pt.life--;
  });
  particles = particles.filter(pt => pt.life > 0);

  // ekran flaşı sönsün
  if (flashAlpha > 0) flashAlpha = Math.max(0, flashAlpha - 0.04);
}

function hitPipe(p) {
  const bh = bird.r * 0.78; // laıka tolerant çarpışma
  if (bird.x + bh < p.x || bird.x - bh > p.x + p.w) return false;
  if (bird.y - bh < p.topH || bird.y + bh > p.topH + p.gap) return true;
  return false;
}

// ---------- Çizim ----------
function lerpColor(a, b, t) {
  return `rgb(${Math.round(a[0]+(b[0]-a[0])*t)},${Math.round(a[1]+(b[1]-a[1])*t)},${Math.round(a[2]+(b[2]-a[2])*t)})`;
}

function mix(a, b, t) { return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
function hexRGB(hex) { return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)]; }
function mixC(a, b, t) { return lerpColor(Array.isArray(a) ? a : hexRGB(a), Array.isArray(b) ? b : hexRGB(b), t); }

// Ekran sarsıntısı (ölümde)
function shakeCtx() {
  if (shakeT <= 0) return;
  const m = shakeT * 6;
  ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
}

function draw() {
  const night = themeNess;

  ctx.save();
  if (shakeT > 0) shakeT -= 0.02;

  // --- Gökyüzü (atmosferik degradeli, 4 durak) ---
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0,   lerpColor([88, 170, 245], [8, 14, 38], night));
  grd.addColorStop(0.35, lerpColor([140, 200, 255], [16, 26, 58], night));
  grd.addColorStop(0.7, lerpColor([186, 224, 255], [24, 38, 72], night));
  grd.addColorStop(1,   lerpColor([224, 244, 255], [34, 50, 84], night));
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  // --- Yıldızlar + kayan yıldızlar (gece) ---
  if (night > 0.05) {
    stars.forEach(s => {
      ctx.globalAlpha = night * (0.35 + 0.65 * Math.abs(Math.sin(s.tw)));
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    if (Math.random() < 0.004 * night && shootingStars.length < 2) {
      shootingStars.push({ x: Math.random() * W, y: Math.random() * H * 0.3, vx: -6 - Math.random() * 4, vy: 3 + Math.random() * 2, life: 26 });
    }
    shootingStars.forEach(ss => {
      ss.x += ss.vx; ss.y += ss.vy; ss.life--;
      ctx.strokeStyle = `rgba(255,255,255,${ss.life / 26 * night})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ss.x, ss.y);
      ctx.lineTo(ss.x - ss.vx * 4, ss.y - ss.vy * 4);
      ctx.stroke();
    });
    shootingStars = shootingStars.filter(ss => ss.life > 0);
  }

  // --- Güneş / Ay (parlama ile) ---
  const sunX = W * 0.78, sunY = H * 0.12;
  if (night < 0.5) {
    const glow = ctx.createRadialGradient(sunX, sunY, 5, sunX, sunY, 90);
    glow.addColorStop(0, 'rgba(255,244,180,0.85)');
    glow.addColorStop(0.35, 'rgba(255,224,102,0.35)');
    glow.addColorStop(1, 'rgba(255,224,102,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 90, sunY - 90, 180, 180);
    ctx.fillStyle = '#FFE066';
    ctx.beginPath(); ctx.arc(sunX, sunY, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(sunX - 8, sunY - 9, 8, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.save();
    ctx.globalAlpha = Math.min(1, (night - 0.3) * 3);
    const mGlow = ctx.createRadialGradient(sunX, sunY, 5, sunX, sunY, 70);
    mGlow.addColorStop(0, 'rgba(244,246,240,0.5)');
    mGlow.addColorStop(1, 'rgba(244,246,240,0)');
    ctx.fillStyle = mGlow;
    ctx.fillRect(sunX - 70, sunY - 70, 140, 140);
    ctx.fillStyle = '#F4F6F0';
    ctx.beginPath(); ctx.arc(sunX, sunY, 22, 0, Math.PI * 2); ctx.fill();
    // ay yüzeyi kraterleri
    ctx.fillStyle = 'rgba(180,184,176,0.5)';
    ctx.beginPath(); ctx.arc(sunX + 6, sunY - 4, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(sunX - 7, sunY + 7, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(sunX + 2, sunY + 10, 2, 0, Math.PI *2); ctx.fill();
    ctx.restore();
  }

  // --- Bulutlar (üst katman, yumuşak + gölgeli) ---
  clouds.forEach(c => {
    ctx.globalAlpha = lerp(0.85, 0.12, night);
    drawCloud(c.x, c.y, c.s, true);
    ctx.globalAlpha = 1;
  });

  // --- Parallax tepeler (3 katman, ışık/gölge detayı) ---
  const yBase = H - groundH();
  for (let layer = 0; layer < 3; layer++) {
    const speedMul = [0.15, 0.3, 0.5][layer];
    const step = layer === 0 ? 110 : layer === 1 ? 90 : 70;
    const hMul = layer === 0 ? 1.9 : layer === 1 ? 1.3 : 0.85;
    const off = ((-groundX * speedMul) % step + step) % step;
    const base = [
      mix([98, 182, 148], [16, 30, 56], night),
      mix([76, 158, 104], [13, 26, 48], night),
      mix([60, 138, 74], [11, 22, 42], night)
    ][layer];
    // katman degradesi: üst açık alt koyu
    const g2 = ctx.createLinearGradient(0, yBase - 160, 0, yBase + 10);
    g2.addColorStop(0, lerpColor(mix(base, [255,255,255], 0.18), mix(base, [255,255,255], 0.06), night));
    g2.addColorStop(1, lerpColor(base, mix(base, [0,0,0], 0.25), night));
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

  // --- Ağaçlar (en yakın tepe katmanında) ---
  ctx.save();
  ctx.globalAlpha = 0.9;
  const treeStep = 70;
  const tOff = ((-groundX * 0.5) % treeStep + treeStep) % treeStep;
  for (let i = 0; i < 9; i++) {
    const t = trees[i % trees.length];
    const x = W - ((tOff + i * treeStep) % (W + 140));
    if (x < -60 || x > W + 60) continue;
    drawTree(x, yBase + 4, t, night);
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  // --- Borular ---
  pipes.forEach(p => drawPipe(p, night));

  // --- Partiküller (glow'lu) ---
  particles.forEach(pt => {
    const a = Math.min(1, pt.life / 25);
    const glow = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, pt.r * 2.5);
    glow.addColorStop(0, pt.color);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.r * 2.5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // --- Zemin (katmanlı toprak) ---
  const gh = groundH();
  const soil = ctx.createLinearGradient(0, H - gh, 0, H);
  soil.addColorStop(0, lerpColor([198, 158, 106], [34, 30, 27], night));
  soil.addColorStop(1, lerpColor([158, 116, 74], [24, 21, 19], night));
  ctx.fillStyle = soil;
  ctx.fillRect(0, H - gh, W, gh);
  // çim şeridi
  const grass = ctx.createLinearGradient(0, H - gh, 0, H - gh + gh * 0.42);
  grass.addColorStop(0, lerpColor([108, 214, 86], [38, 84, 60], night));
  grass.addColorStop(1, lerpColor([64, 168, 56], [24, 58, 44], night));
  ctx.fillStyle = grass;
  ctx.fillRect(0, H - gh, W, gh * 0.42);
  // çim pürüzleri
  ctx.fillStyle = lerpColor([88, 190, 70], [30, 66, 50], night);
  const grassOff = ((-groundX * 1.2) % 24 + 24) % 24;
  for (let x = -24 + grassOff; x < W + 24; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, H - gh);
    ctx.quadraticCurveTo(x + 4, H - gh - 9, x + 8, H - gh);
    ctx.closePath();
    ctx.fill();
  }
  // toprak çizgileri
  ctx.strokeStyle = lerpColor('rgba(120,84,50,0.35)', 'rgba(10,8,6,0.4)', night);
  ctx.strokeStyle = 'rgba(90,60,35,0.4)';
  ctx.lineWidth = 2;
  for (let x = groundX; x < W + 48; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, H - gh + gh * 0.5);
    ctx.lineTo(x + 18, H);
    ctx.stroke();
  }
  // çim kenar gölgesi
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, H - gh + gh * 0.42, W, 5);

  // --- Yüzen puan yazıları ---
  ctx.font = '900 20px "Segoe UI", Arial';
  ctx.textAlign = 'center';
  popups.forEach(p => {
    ctx.globalAlpha = Math.min(1, p.life / 30);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(p.txt, p.x + 1.5, p.y - (44 - p.life) * 0.5 + 1.5);
    ctx.fillStyle = '#7CFFB2';
    ctx.fillText(p.txt, p.x, p.y - (44 - p.life) * 0.5);
  });
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  popups.forEach(p => { p.life--; });
  popups = popups.filter(p => p.life > 0);

  // --- Kuş ---
  drawBird();

  // --- Rakip kuş (çevrimiçi) ---
  if (MP.connected && MP.oppAlive && state !== STATE.GAMEOVER) {
    drawOpponentBird();
  }

  // --- Ekran flaşı + vinyet ---
  if (flashAlpha > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
    ctx.fillRect(0, 0, W, H);
  }
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, `rgba(0,0,20,${0.18 + 0.22 * night})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  ctx.restore();
}

function lerp(a, b, t) { return a + (b - a) * t; }

// yumuşak gölgeli bulut
function drawCloud(x, y, s, fancy) {
  const r = 16 * s;
  const g = ctx.createRadialGradient(x + 18 * s, y - 10 * s, r * 0.3, x + 18 * s, y + 4 * s, r * 3);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = fancy ? g : '#fff';
  ctx.beginPath();
  ctx.arc(x, y, 16 * s, 0, Math.PI * 2);
  ctx.arc(x + 18 * s, y - 8 * s, 14 * s, 0, Math.PI * 2);
  ctx.arc(x + 36 * s, y, 16 * s, 0, Math.PI * 2);
  ctx.arc(x + 18 * s, y + 6 * s, 13 * s, 0, Math.PI * 2);
  ctx.fill();
  // alt gölge
  if (fancy) {
    ctx.fillStyle = 'rgba(160,190,220,0.25)';
    ctx.beginPath();
    ctx.arc(x + 18 * s, y + 12 * s, 15 * s, 0, Math.PI, false);
    ctx.fill();
  }
}

// basit ağaç (çam)
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
  const bodyDay = [58, 205, 90], bodyNight = [40, 78, 62];
  const body = lerpColor(bodyDay, bodyNight, night);

  function pipeRect(x, y, w, h) {
    if (h <= 0) return;
    // gövde degrade: soldan sağa ışık
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, lerpColor([38, 158, 62], [24, 52, 42], night));
    g.addColorStop(0.25, lerpColor([82, 224, 106], [52, 96, 76], night));
    g.addColorStop(0.5, lerpColor([58, 205, 90], [40, 78, 62], night));
    g.addColorStop(0.85, lerpColor([38, 152, 60], [26, 56, 44], night));
    g.addColorStop(1, lerpColor([26, 110, 44], [18, 40, 32], night));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    // parlak şerit
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x + w * 0.18, y, 6, h);
    // dış hat
    ctx.strokeStyle = lerpColor('rgba(20,90,40,0.6)', 'rgba(8,24,18,0.7)', night);
    ctx.strokeStyle = 'rgba(20,90,40,0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }

  const capH = 24, capW = p.w + 10;

  // üst boru
  pipeRect(p.x, -10, p.w, p.topH - capH + 10);
  pipeRect(p.x - 5, p.topH - capH, capW, capH);

  // alt boru
  const by = p.topH + p.gap;
  pipeRect(p.x - 5, by, capW, capH);
  pipeRect(p.x, by + capH, p.w, H - by - capH - groundH() + 4);
}

function drawBird() {
  const S = skinColors();

  // yer gölgesi
  const gh = groundH();
  const shadowScale = Math.max(0.25, 1 - (H - gh - bird.y) / (H * 0.6));
  ctx.save();
  ctx.globalAlpha = 0.25 * shadowScale;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(bird.x, H - gh + 6, 14 * shadowScale, 4 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(bird.rot);

  // gövde (radyal degrade)
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

  // kuyruk tüyü
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

  // göbek (yumuşak)
  ctx.fillStyle = S.belly;
  ctx.beginPath();
  ctx.ellipse(-2, 4.5, 9, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // kanat (degradeli)
  const wingY = bird.wing * 8;
  ctx.save();
  ctx.translate(-3, 2);
  ctx.rotate(bird.wing * 0.5);
  const wg = ctx.createLinearGradient(0, -6, 0, 8);
  wg.addColorStop(0, mixC('#ffffff', S.wing, 0.35));
  wg.addColorStop(0.6, S.wing);
  wg.addColorStop(1, mixC('#ffffff', S.wing, 0.5));
  ctx.fillStyle = wg;
  ctx.beginPath();
  ctx.ellipse(0, wingY * 0.5, 11, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = S.wingOut;
  ctx.stroke();
  ctx.restore();

  // göz (parlak)
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(8, -4.5, 4.8, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = S.outline; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(9.5, -4.5, 2.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.arc(8.5, -5.8, 0.9, 0, Math.PI * 2); ctx.fill();

  // gaga (degradeli, iki katmanlı)
  const beakG = ctx.createLinearGradient(13, -1, 23, 5);
  beakG.addColorStop(0, mixC('#ffffff', S.beak, 0.3));
  beakG.addColorStop(1, S.beak);
  ctx.fillStyle = beakG;
  ctx.beginPath();
  ctx.moveTo(13, -1);
  ctx.lineTo(23, 1.5);
  ctx.lineTo(13, 5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = S.beakOut;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // gaga alt parçası
  ctx.fillStyle = mixC('#000000', S.beak, 0.7);
  ctx.beginPath();
  ctx.moveTo(13, 3.2);
  ctx.lineTo(21, 2.8);
  ctx.lineTo(13, 5);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // kalkan halkası (glow'lu)
  if (shieldActive) {
    ctx.save();
    const pulse = 0.5 + 0.3 * Math.sin(frames * 0.15);
    const shieldGlow = ctx.createRadialGradient(bird.x, bird.y, bird.r + 3, bird.x, bird.y, bird.r + 16);
    shieldGlow.addColorStop(0, 'rgba(0,191,255,0)');
    shieldGlow.addColorStop(0.7, `rgba(0,191,255,${pulse * 0.35})`);
    shieldGlow.addColorStop(1, 'rgba(0,191,255,0)');
    ctx.fillStyle = shieldGlow;
    ctx.beginPath();
    ctx.arc(bird.x, bird.y, bird.r + 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(120,220,255,${pulse})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(bird.x, bird.y, bird.r + 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// ---------- Ana döngü (sabit zaman adımı: her ekran hizasında aynı hız) ----------
const STEP_MS = 1000 / 60;
let acc = 0;
let lastT = performance.now();

function menuUpdate() {
  // menüde bile arka plan canlı olsun
  frames++;
  clouds.forEach(c => {
    c.x -= c.sp * 0.4;
    if (c.x < -80) { c.x = W + 80; }
  });
  stars.forEach(s => { s.tw += s.tws; });
  groundX -= 0.5;
  if (groundX <= -48) groundX += 48;
  // menü kuşu süzülsün
  bird.x = W * 0.28;
  bird.y = H * 0.42 + Math.sin(frames * 0.08) * 8;
  bird.rot = Math.sin(frames * 0.05) * 0.1;
  bird.wing += bird.wingDir * 0.28;
  if (bird.wing > 1) { bird.wing = 1; bird.wingDir = -1; }
  if (bird.wing < -1) { bird.wing = -1; bird.wingDir = 1; }
  themeNess += (0 - themeNess) * 0.02;
}

function loop(now) {
  const dt = Math.min(now - lastT, 100);
  lastT = now;
  acc += dt;
  if (acc > 200) acc = STEP_MS; // sekmeye dönünce birikimi at
		
  while (acc >= STEP_MS) {
    acc -= STEP_MS;
    if (state === STATE.MENU) menuUpdate();
    else if (state === STATE.MP) menuUpdate();
    else if (state !== STATE.PAUSED) {
      update();
      mpTick();
    }
  }

  draw();
  requestAnimationFrame(loop);}

// ---------- Girdiler ----------
function primaryAction() {
  if (state === STATE.READY || state === STATE.PLAYING) flap();
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

document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    if (state === STATE.MENU) startGame();
    else primaryAction();
  }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (state === STATE.PLAYING || state === STATE.PAUSED) togglePause();
  }
  if (e.code === 'Enter' && state === STATE.GAMEOVER) startGame();
});

canvas.addEventListener('mousedown', e => { e.preventDefault(); primaryAction(); });
canvas.addEventListener('touchstart', e => { e.preventDefault(); primaryAction(); }, { passive: false });

// ---------- UI butonları ----------
$('start-btn').addEventListener('click', () => { sfx.click(); startGame(); });
$('retry-btn').addEventListener('click', () => { sfx.click(); startGame(); });
$('home-btn').addEventListener('click', () => { sfx.click(); goHome(); });
$('quit-btn').addEventListener('click', () => { sfx.click(); goHome(); });
$('resume-btn').addEventListener('click', () => { sfx.click(); togglePause(); });
pauseBtn.addEventListener('click', () => togglePause());
soundBtn.addEventListener('click', () => {
  saved.soundOn = !saved.soundOn;
  updateSoundBtn();
  persist();
  sfx.click();
});

// ---------- Salon (hub) sayfasına dön ----------
$('back-to-hub-btn').addEventListener('click', () => { sfx.click(); location.href = 'index.html'; });

$('stats-btn').addEventListener('click', () => {
  sfx.click();
  $('st-best').textContent = F.bestScore;
  $('st-games').textContent = F.games;
  const t = F.totalTime;
  $('st-time').textContent = t >= 60 ? Math.floor(t / 60) + ' dk ' + Math.round(t % 60) + ' sn' : Math.round(t) + ' sn';
  $('st-recent').textContent = F.recentScores.length ? F.recentScores.join(' · ') : '-';
  show(statsScreen);
});
$('stats-close-btn').addEventListener('click', () => { sfx.click(); hide(statsScreen); });

document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    sfx.click();
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    F.difficulty = btn.dataset.diff;
    persist();
  });
});

function goHome() {
  state = STATE.MENU;
  hide(hud); hide(gameoverScreen); hide(pauseScreen);
  $('best-score-display').textContent = `🏆 Rekor: ${F.bestScore}`;
  show(menuScreen);
}

document.querySelectorAll('.skin-btn').forEach(btn => {
  btn.style.background = SKINS[btn.dataset.skin].body;
  btn.addEventListener('click', () => {
    sfx.click();
    document.querySelectorAll('.skin-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    F.skin = btn.dataset.skin;
    persist();
  });
});

// rakip kuş (yarı saydam, kendi kuşunun arkasında)
function drawOpponentBird() {
  const S = SKINS[MP.oppBird.skin] || SKINS.yellow;
  const ox = MP.oppBird.x + (W * 0.28 - bird.x) * 0; // rakip kendi konumunda
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.translate(MP.oppBird.x, MP.oppBird.y);
  ctx.rotate(MP.oppBird.rot);
  ctx.scale(0.9, 0.9);

  // gövde
  const bg = ctx.createRadialGradient(-4, -5, 3, 0, 2, 18);
  bg.addColorStop(0, S.belly);
  bg.addColorStop(0.45, S.body);
  bg.addColorStop(1, mixC(S.body, '#000000', 0.28));
  ctx.fillStyle = bg;
  ctx.strokeStyle = S.outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 12.5, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  // göz
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(8, -4.5, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(9.5, -4.5, 2.2, 0, Math.PI * 2); ctx.fill();

  // gaga
  ctx.fillStyle = S.beak;
  ctx.beginPath();
  ctx.moveTo(13, -1);
  ctx.lineTo(23, 1.5);
  ctx.lineTo(13, 5);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // rakip adı etiketi
  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.font = '700 11px "Segoe UI", Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillText(MP.oppName, MP.oppBird.x + 1, MP.oppBird.y - 24 + 1);
  ctx.fillStyle = '#ffec8b';
  ctx.fillText(MP.oppName, MP.oppBird.x, MP.oppBird.y - 24);
  ctx.restore();
}

// =====================================================
//            ÇEVRİMİÇİ DÜELLO (PeerJS)
// Oda kuran = HOST (dünyayı simüle eder, boruları gönderir)
// Katılan = GUEST (sadece kendi kuşunu gönderir)
// =====================================================
const MP = {
  peer: null,
  conn: null,
  isHost: false,
  connected: false,
  roomCode: '',
  oppName: 'Rakip',
  oppScore: 0,
  oppAlive: true,
  oppBird: { x: 0, y: 0, rot: 0, skin: 'yellow' },
  seed: 0,
  matchDiff: null,
  rematchVotes: 0,
  oppRematch: false
};

const MP_PEER_OPTS = { debug: 1 };

function mpShow(el) { show(el); }
function mpHide(el) { hide(el); }

function mpMakeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function mpCleanup() {
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

function mpOpenUI() {
  sfx.click();
  hide(menuScreen);
  show(mpScreen);
  show($('mp-lobby'));
  $('mp-error').textContent = '';
  mpHide($('mp-host-area'));
  mpHide($('mp-join-area'));
  $('mp-join-status').textContent = '';
  $('mp-code-input').value = '';
  state = STATE.MP;
}

// ---------- HOST ----------
function mpHost() {
  sfx.click();
  mpHide($('mp-btn-row'));
  show($('mp-host-area'));
  $('mp-room-code').textContent = '...';
  $('mp-wait-text').textContent = 'Sunucuya bağlanılıyor...';

  MP.roomCode = mpMakeRoomCode();
  MP.isHost = true;

  MP.peer = new Peer('flappy-' + MP.roomCode, MP_PEER_OPTS);

  MP.peer.on('open', () => {
    $('mp-room-code').textContent = MP.roomCode;
    $('mp-wait-text').textContent = 'Arkadaşın bekleniyor... kodu gönder!';
  });

  MP.peer.on('connection', conn => {
    if (MP.conn) { try { conn.close(); } catch (e) {} return; }
    MP.conn = conn;
    setupConn();
  });

  MP.peer.on('error', err => {
    $('mp-error').textContent = 'Bağlantı hatası: ' + (err && err.type ? err.type : 'bilinmiyor');
    $('mp-room-code').textContent = '-----';
  });
}

// ---------- GUEST ----------
function mpJoin() {
  sfx.click();
  mpHide($('mp-btn-row'));
  show($('mp-join-area'));
  $('mp-join-status').textContent = '';
}

function mpJoinConfirm() {
  const code = $('mp-code-input').value.trim().toUpperCase();
  if (code.length !== 5) {
    $('mp-join-status').textContent = '5 haneli kod gir!';
    return;
  }
  sfx.click();
  $('mp-join-status').textContent = 'Bağlanılıyor...';
  MP.roomCode = code;
  MP.isHost = false;

  MP.peer = new Peer(null, MP_PEER_OPTS);
  MP.peer.on('open', () => {
    const conn = MP.peer.connect('flappy-' + code, { reliable: true });
    MP.conn = conn;
    setupConn();
  });
  MP.peer.on('error', err => {
    $('mp-join-status').textContent = 'Hata: ' + (err && err.type === 'peer-unavailable' ? 'oda bulunamadı, kodu kontrol et!' : (err.type || 'bilinmiyor'));
  });
}

// ---------- Ortak bağlantı kurulumu ----------
function setupConn() {
  MP.conn.on('open', () => {
    MP.connected = true;
    mpSend({ t: 'hello', skin: F.skin });
  });

  MP.conn.on('data', data => {
    if (!data || !data.t) return;
    switch (data.t) {
      case 'hello':
        MP.oppBird.skin = data.skin || 'yellow';
        if (MP.isHost) {
          // guest katildi: host oyunu baslatir (seed'i uretip gonderir)
          startGame();
          mpStartMatchUI();
        } else if (typeof data.seed === 'number') {
          // host'tan gelen esitleme: ayni tohum + zorlukla basla
          MP.seed = data.seed;
          MP.matchDiff = data.diff || F.difficulty;
          startGame();
          mpStartMatchUI();
        }
        break;
      case 'bird':
        MP.oppBird.x = data.x; MP.oppBird.y = data.y; MP.oppBird.rot = data.r;
        MP.oppAlive = data.a;
        break;
      case 'score':
        MP.oppScore = data.s;
        break;
      case 'gameover':
        MP.oppScore = data.s;
        MP.oppAlive = false;
        if (state === STATE.GAMEOVER && MP.connected && !mpGameoverScreen.classList.contains('hidden')) {
          mpFinishDuel();
        }
        break;
      case 'rematch':
        MP.oppRematch = true;
        if (MP.rematchVotes > 0) mpDoRematch();
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
  const bar = $('mp-opp-bar');
  if (!bar) {
    const el = document.createElement('div');
    el.id = 'mp-opp-bar';
    el.className = 'mp-opp-bar';
    el.innerHTML = '👻 Rakip: <span class="opp-score" id="mp-opp-live">0</span>';
    document.getElementById('game-wrapper').appendChild(el);
  } else {
    show(bar);
  }
}

function mpUpdateLiveBar() {
  const el = $('mp-opp-live');
  if (el) el.textContent = MP.oppScore + (MP.oppAlive ? '' : ' ☠');
}

// ---------- Oyun içi MP entegrasyonu ----------
function mpOnScore() {
  if (!MP.connected) return;
  mpSend({ t: 'score', s: score });
  MP.myScoreSent = score;
}

function mpOnDeath() {
  if (!MP.connected) return;
  mpSend({ t: 'gameover', s: score });
  $('mp-final-me').textContent = score;
  $('mp-me-label').textContent = 'Sen';
  $('mp-final-opp').textContent = MP.oppScore;
  $('mp-opp-label').textContent = 'Rakip';

  if (MP.oppAlive) {
    $('mp-result-text').textContent = 'Rakip hâlâ oynuyor... skorunu geçmeye çalış!';
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
  let txt;
  if (score > MP.oppScore) txt = '🏆 KAZANDIN!';
  else if (score < MP.oppScore) txt = '💀 KAYBETTİN...';
  else txt = '🤝 BERABERE!';
  $('mp-result-text').textContent = txt;
  hide(gameoverScreen);
  show(mpGameoverScreen);
  hide(hud);
}

function mpDoRematch() {
  hide(mpGameoverScreen);
  startGame();
  mpStartMatchUI();
  MP.oppAlive = true;
  MP.oppScore = 0;
  MP.oppRematch = false;
  MP.rematchVotes = 0;
}

function mpLeave() {
  sfx.click();
  mpCleanup();
  hide(mpGameoverScreen);
  hide($('mp-opp-bar'));
  goHome();
}

// ---------- MP döngü gönderimi ----------
function mpTick() {
  if (!MP.connected) return;
  // kendi kuşunu gönder
  mpSend({
    t: 'bird',
    x: Math.round(bird.x), y: Math.round(bird.y),
    r: Math.round(bird.rot * 100) / 100, a: (state === STATE.PLAYING)
  });
  if (MP.isHost && (state === STATE.PLAYING || state === STATE.READY)) {
    // boruları gönder
    if (frames % 6 === 0) {
      mpSend({
        t: 'world',
        p: pipes.map(pr => ({ x: Math.round(pr.x), h: Math.round(pr.topH), g: Math.round(pr.gap), ps: pr.passed })),
        sp: DIFFICULTIES[currentDiff].pipeSpeed,
        s: MP.oppScore
      });
    }
  }
  mpUpdateLiveBar();
}

// ---------- MP butonları ----------
$('mp-btn').addEventListener('click', mpOpenUI);
$('mp-host-btn').addEventListener('click', mpHost);
$('mp-join-btn').addEventListener('click', mpJoin);
$('mp-join-confirm').addEventListener('click', mpJoinConfirm);
$('mp-code-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') mpJoinConfirm();
});
$('mp-quit-btn').addEventListener('click', () => {
  sfx.click();
  mpCleanup();
  hide(mpScreen);
  show($('mp-btn-row'));
  mpHide($('mp-host-area'));
  mpHide($('mp-join-area'));
  $('mp-error').textContent = '';
  goHome();
});
$('mp-rematch-btn').addEventListener('click', () => {
  sfx.click();
  if (!MP.connected) { mpLeave(); return; }
  MP.rematchVotes = 1;
  mpSend({ t: 'rematch' });
  if (MP.oppRematch) mpDoRematch();
  $('mp-result-text').textContent = 'Rakibin onayı bekleniyor...';
});
$('mp-leave-btn').addEventListener('click', mpLeave);

// ---------- Başlat ----------
function init() {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // kayıtlı zorluğu işaretle
  document.querySelectorAll('.diff-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.diff === F.difficulty);
  });
  updateSoundBtn();
  $('best-score-display').textContent = `🏆 Rekor: ${F.bestScore}`;

  initClouds();
  const activeSkin = document.querySelector(`.skin-btn[data-skin="${F.skin}"]`);
  if (activeSkin) activeSkin.classList.add('active');
  show(menuScreen);
  requestAnimationFrame(loop);
}

init();
