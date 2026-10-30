"use strict";

/* =====================================================
   YILAN — Oyun Salonu'nun 2. oyunu
   Flappy ile aynı kayıt sistemini (localStorage) kullanır.
   ===================================================== */

// ---------- Canvas ----------
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

// ---------- DOM ----------
const $ = id => document.getElementById(id);
const hud = $('hud'), scoreDisplay = $('score-display');
const menuScreen = $('menu-screen'), gameoverScreen = $('gameover-screen'), pauseScreen = $('pause-screen');
const tapHint = $('tap-hint');
const newRecord = $('new-record');
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

// ---------- Hız seviyeleri ----------
const SPEEDS = { easy: 8, normal: 11, fast: 15 }; // adım/sn

// ---------- Kayıt ----------
const STORAGE_KEY = 'oyun-salonu-v2';

function defaultSaved() {
  return { difficulty: 'normal', bestScore: 0, games: 0, apples: 0 };
}

function loadSaved() {
  const d = defaultSaved();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s.snake && typeof s.snake === 'object') {
        Object.keys(d).forEach(k => { if (s.snake[k] !== undefined) d[k] = s.snake[k]; });
      }
    }
  } catch (e) {}
  return d;
}

let saved = loadSaved();
const S = saved; // kısaltma

function persist() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let root = {};
    try { root = JSON.parse(raw) || {}; } catch (e) {}
    if (typeof root.snake !== 'object' || !root.snake) root.snake = {};
    Object.assign(root.snake, saved);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
  } catch (e) {}
}

// ---------- Durum ----------
const STATE = { MENU: 0, READY: 1, PLAYING: 2, GAMEOVER: 3, PAUSED: 4 };
let state = STATE.MENU;

// oyun alanı: hücre grid
let GRID = 17;          // yatay hücre sayısı (kare olacak)
let cell = 24;          // hücre boyutu (px) — resize'da hesaplanır
let boardX = 0, boardY = 0, boardSize = 0;

let snake = [];         // {x, y} hücre koordinatları
let dir = { x: 1, y: 0 };
let nextDir = { x: 1, y: 0 };
let food = null;        // {x, y}
let foodPulse = 0;
let score = 0;
let stepMs = 1000 / SPEEDS.normal;
let stepAcc = 0;
let frames = 0;
let flashAlpha = 0;
let shakeT = 0;
let popParticles = [];
let playStartMs = 0;
let prevSnake = null;   // interpolasyon için önceki pozisyonlar
let moveProgress = 0;   // 0..1 arası adım ilerlemesi
let tongueT = 0;        // dil animasyonu
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

// anlık hız: skor arttıkça hızlanır (yumuşak eğri, üst sınır var)
function currentStepMs() {
  const base = 1000 / (SPEEDS[S.difficulty || 'normal'] || SPEEDS.normal);
  const accel = 1 + Math.min(2.0, score * 0.035); // her elmada ~%3.5 hız
  return base / accel;
}

// ---------- Yem yerleştir ----------
function spawnFood() {
  let tries = 0;
  while (tries++ < 400) {
    const f = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
    if (!snake.some(s => s.x === f.x && s.y === f.y)) { food = f; return; }
  }
  food = null; // alan doldu
}

// ---------- Oyunu başlat ----------
function startGame() {
  boardSize = Math.min(W, H * 0.86);
  cell = boardSize / GRID;
  boardX = (W - boardSize) / 2;
  boardY = (H - boardSize) / 2 - 20;

  const cy = Math.floor(GRID / 2);
  snake = [
    { x: 8, y: cy }, { x: 7, y: cy }, { x: 6, y: cy }
  ];
  prevSnake = snake.map(s => ({ ...s }));
  dir = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };
  score = 0;
  stepAcc = 0;
  moveProgress = 0;
  frames = 0;
  flashAlpha = 0;
  shakeT = 0;
  tongueT = 0;
  popParticles = [];
  spawnFood();

  scoreDisplay.textContent = '0';
  show(hud);
  hide(menuScreen); hide(gameoverScreen); hide(pauseScreen);
  state = STATE.READY;
  playStartMs = performance.now();
}

// ---------- Adım ----------
function step() {
  dir = nextDir;
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  // duvar çarpışması
  if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) { die(); return; }
  // kendine çarpma (kuyruk hariç — kuyruk hareket edecek)
  for (let i = 0; i < snake.length - 1; i++) {
    if (snake[i].x === head.x && snake[i].y === head.y) { die(); return; }
  }

  prevSnake = snake.map(s => ({ ...s })); // interpolasyon kaydı
  snake.unshift(head);

  // yem yeme
  if (food && head.x === food.x && head.y === food.y) {
    score += 1;
    scoreDisplay.textContent = score;
    S.apples = (S.apples || 0) + 1;
    sfxEat();
    // yem patlama partikülleri
    for (let i = 0; i < 14; i++) {
      popParticles.push({
        x: boardX + (food.x + 0.5) * cell,
        y: boardY + (food.y + 0.5) * cell,
        vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4 - 1.5,
        life: 26, r: 2 + Math.random() * 3,
        color: Math.random() > 0.4 ? 'rgba(255,80,80,0.95)' : 'rgba(255,215,0,0.9)'
      });
    }
    spawnFood();
  } else {
    snake.pop(); // kuyruğu kırp
  }
}

function die() {
  state = STATE.GAMEOVER;
  flashAlpha = 0.6;
  shakeT = 1;
  sfxDie();

  // istatistik
  S.games++;
  const isRecord = score > S.bestScore;
  if (isRecord) S.bestScore = score;
  persist();

  $('final-score').textContent = score;
  $('best-score-go').textContent = S.bestScore;
  if (isRecord && score > 0) show(newRecord); else hide(newRecord);

  setTimeout(() => {
    show(gameoverScreen);
    hide(hud);
  }, 600);
}

// ---------- Girdi ----------
function setDir(nx, ny) {
  // 180 derece dönüş yasak
  if (dir.x === -nx && dir.y === -ny) return;
  if (nextDir.x === -nx && nextDir.y === -ny) return;
  nextDir = { x: nx, y: ny };
}

document.addEventListener('keydown', e => {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();

  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (state === STATE.PLAYING || state === STATE.PAUSED) togglePause();
    return;
  }
  if (e.code === 'Enter' && state === STATE.GAMEOVER) { startGame(); return; }
  if (e.code === 'Space') {
    if (state === STATE.READY) beginPlay();
    return;
  }

  if (state === STATE.READY) beginPlay();

  switch (e.code) {
    case 'ArrowUp': case 'KeyW': setDir(0, -1); break;
    case 'ArrowDown': case 'KeyS': setDir(0, 1); break;
    case 'ArrowLeft': case 'KeyA': setDir(-1, 0); break;
    case 'ArrowRight': case 'KeyD': setDir(1, 0); break;
  }
});

// dokunmatik kaydırma
let touchStart = null;
canvas.addEventListener('touchstart', e => { e.preventDefault(); touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY }; if (state === STATE.READY) beginPlay(); }, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!touchStart) return;
  const dx = e.touches[0].clientX - touchStart.x;
  const dy = e.touches[0].clientY - touchStart.y;
  if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
  if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0);
  else setDir(0, dy > 0 ? 1 : -1);
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: false });

function beginPlay() {
  state = STATE.PLAYING;
  hide(tapHint);
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

// ---------- Ses (Web Audio) ----------
let audioCtx = null;
function getAC() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function beep(freq, dur, type, vol) {
  const ac = getAC();
  if (!ac) return;
  const osc = ac.createOscillator(), gain = ac.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  gain.gain.setValueAtTime(vol || 0.12, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(); osc.stop(ac.currentTime + dur);
}
function sfxEat() { beep(660, 0.08, 'sine', 0.14); setTimeout(() => beep(990, 0.10, 'sine', 0.12), 60); }
function sfxDie() { beep(220, 0.3, 'sawtooth', 0.2); setTimeout(() => beep(140, 0.4, 'triangle', 0.16), 150); }

// ---------- Çizim ----------
function draw() {
  // arka plan (derin uzay degradesi + yıldızlar)
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0a1626');
  bg.addColorStop(0.5, '#12283f');
  bg.addColorStop(1, '#1b3a52');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  bgStars.forEach(s => {
    ctx.globalAlpha = 0.25 + 0.55 * Math.abs(Math.sin(s.tw));
    ctx.fillStyle = '#cfe8ff';
    ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1;

  ctx.save();
  if (shakeT > 0) {
    shakeT -= 0.03;
    const m = shakeT * 8;
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
  }

  // tahta: ışıma + çift çerçeve
  const glow = ctx.createRadialGradient(W/2, boardY + boardSize/2, boardSize * 0.2, W/2, boardY + boardSize/2, boardSize * 0.85);
  glow.addColorStop(0, 'rgba(0,191,255,0.10)');
  glow.addColorStop(1, 'rgba(0,191,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(0,191,255,0.55)';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(boardX - 5, boardY - 5, boardSize + 10, boardSize + 10);
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  ctx.strokeRect(boardX - 9, boardY - 9, boardSize + 18, boardSize + 18);

  // zemin: degrade + ince grid
  const fld = ctx.createLinearGradient(boardX, boardY, boardX, boardY + boardSize);
  fld.addColorStop(0, 'rgba(16,40,58,0.95)');
  fld.addColorStop(1, 'rgba(10,26,40,0.95)');
  ctx.fillStyle = fld;
  ctx.fillRect(boardX, boardY, boardSize, boardSize);
  ctx.strokeStyle = 'rgba(0,191,255,0.07)';
  ctx.lineWidth = 1;
  for (let i = 1; i < GRID; i++) {
    ctx.beginPath(); ctx.moveTo(boardX + i * cell, boardY); ctx.lineTo(boardX + i * cell, boardY + boardSize); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(boardX, boardY + i * cell); ctx.lineTo(boardX + boardSize, boardY + i * cell); ctx.stroke();
  }
  // köşe vurguları
  ctx.strokeStyle = 'rgba(0,191,255,0.5)';
  ctx.lineWidth = 3;
  const cl = cell * 0.9;
  [[0,0,1,1],[1,0,-1,1],[0,1,1,-1],[1,1,-1,-1]].forEach(([cx, cy, dx, dy]) => {
    const px = boardX + cx * boardSize, py = boardY + cy * boardSize;
    ctx.beginPath();
    ctx.moveTo(px + dx * cl, py);
    ctx.lineTo(px, py);
    ctx.lineTo(px, py + dy * cl);
    ctx.stroke();
  });

  // yem: altın elma (nabız + parlama)
  if (food) {
    const pr = cell * 0.34 * (1 + 0.12 * Math.sin(foodPulse));
    const fx = boardX + (food.x + 0.5) * cell;
    const fy = boardY + (food.y + 0.5) * cell;
    const g = ctx.createRadialGradient(fx, fy, 1, fx, fy, cell * 0.9);
    g.addColorStop(0, 'rgba(255,120,60,0.55)');
    g.addColorStop(0.5, 'rgba(255,60,60,0.22)');
    g.addColorStop(1, 'rgba(255,60,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(fx - cell, fy - cell, cell * 2, cell * 2);
    // gövde (degrade)
    const fb = ctx.createRadialGradient(fx - pr * 0.3, fy - pr * 0.4, pr * 0.1, fx, fy, pr);
    fb.addColorStop(0, '#ff9e80');
    fb.addColorStop(0.55, '#e8384f');
    fb.addColorStop(1, '#a01830');
    ctx.fillStyle = fb;
    ctx.beginPath(); ctx.arc(fx, fy, pr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.arc(fx - pr * 0.32, fy - pr * 0.38, pr * 0.26, 0, Math.PI * 2); ctx.fill();
    // sap + yaprak
    ctx.strokeStyle = '#8a5a21'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(fx, fy - pr); ctx.quadraticCurveTo(fx + 2, fy - pr - 3, fx + 4, fy - pr - 5); ctx.stroke();
    ctx.fillStyle = '#6ecf68';
    ctx.beginPath(); ctx.ellipse(fx + 6, fy - pr - 5, 5, 2.4, -0.55, 0, Math.PI * 2); ctx.fill();
  }

  // yılan: kesintisiz gövde (interpolasyonlu) + pul deseni
  const n = snake.length;
  const prog = state === STATE.PLAYING ? moveProgress : 0;

  // gövdeyi baştan sona path olarak çiz — segment merkezleri interpolasyonlu
  const pts = [];
  for (let i = 0; i < n; i++) {
    const cur = snake[i];
    const prev = prevSnake && prevSnake[i] ? prevSnake[i] : cur;
    // yeni segment (kafa) prev'de yok — 1. segmentten kaydır
    const ref = i === 0 && prevSnake && prevSnake[0] ? prevSnake[0] : prev;
    const ix = cur.x + (ref.x - cur.x) * (1 - prog);
    const iy = cur.y + (ref.y - cur.y) * (1 - prog);
    pts.push({
      x: boardX + (ix + 0.5) * cell,
      y: boardY + (iy + 0.5) * cell
    });
  }

  // dış hat (koyu kontur) — kalın çizgi
  for (let pass = 0; pass < 2; pass++) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (pass === 0) {
      // kontur
      ctx.strokeStyle = 'rgba(8,30,18,0.9)';
      ctx.lineWidth = cell * 0.82;
    } else {
      // gövde degrade — baştan kuyruğa renk geçişi tek path'te olmaz, segment segment çiz
      ctx.lineWidth = cell * 0.66;
    }
    for (let i = n - 1; i > 0; i--) {
      const t = i / Math.max(1, n - 1);
      if (pass === 1) {
        const c = ctx.createLinearGradient(pts[i].x, pts[i].y, pts[i-1].x, pts[i-1].y);
        const r1 = Math.round(70 - t * 26), g1 = Math.round(225 - t * 80), b1 = Math.round(105 - t * 30);
        c.addColorStop(0, `rgb(${r1},${g1},${b1})`);
        c.addColorStop(1, `rgb(${r1-18},${g1-30},${b1-14})`);
        ctx.strokeStyle = c;
      }
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[i-1].x, pts[i-1].y);
      ctx.stroke();
    }
  }

  // sırt deseni: pul zinciri
  ctx.fillStyle = 'rgba(20,90,50,0.55)';
  for (let i = 2; i < n; i += 2) {
    const t = i / n;
    const pr2 = cell * (0.30 - t * 0.12);
    ctx.beginPath();
    ctx.ellipse(pts[i].x, pts[i].y, pr2 * 0.8, pr2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // karın highlight
  ctx.strokeStyle = 'rgba(190,255,200,0.18)';
  ctx.lineWidth = cell * 0.16;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    if (i === 0) ctx.moveTo(pts[i].x, pts[i].y + cell * 0.14);
    else ctx.lineTo(pts[i].x, pts[i].y + cell * 0.14);
  }
  ctx.stroke();

  // kafa: gözler + çatal dil
  if (n) {
    const h = pts[0];
    const ang = Math.atan2(dir.y, dir.x);
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(ang);
    // kafa biraz büyük
    ctx.fillStyle = 'rgb(105,245,135)';
    ctx.strokeStyle = 'rgba(8,30,18,0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, cell * 0.46, cell * 0.38, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // parlama
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(-cell * 0.1, -cell * 0.12, cell * 0.2, cell * 0.12, -0.4, 0, Math.PI * 2);
    ctx.fill();
    // dil (periyodik çıkıp girer)
    const tongue = Math.max(0, Math.sin(tongueT)) * cell * 0.5;
    if (tongue > 2) {
      ctx.strokeStyle = '#ff5252';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cell * 0.4, 0);
      ctx.lineTo(cell * 0.4 + tongue * 0.6, 0);
      ctx.lineTo(cell * 0.4 + tongue, -cell * 0.10);
      ctx.moveTo(cell * 0.4 + tongue * 0.6, 0);
      ctx.lineTo(cell * 0.4 + tongue, cell * 0.10);
      ctx.stroke();
    }
    // gözler (öne bakan)
    const eo = cell * 0.17;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cell * 0.16, -eo, cell * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cell * 0.16, eo, cell * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.arc(cell * 0.2, -eo, cell * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cell * 0.2, eo, cell * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(cell * 0.19, -eo - 1, cell * 0.025, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cell * 0.19, eo - 1, cell * 0.025, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // hız göstergesi (sağ üstte küçük bar)
  if (state === STATE.PLAYING || state === STATE.READY) {
    const spd = Math.min(1, (currentStepMs() < 1000/SPEEDS[S.difficulty||'normal'] ? 1 - (currentStepMs() / (1000/SPEEDS[S.difficulty||'normal'])) : 0));
    const barW = 54, barH = 5;
    const bx = boardX + boardSize - barW, by = boardY - 16;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(bx, by, barW, barH);
    const sg = ctx.createLinearGradient(bx, 0, bx + barW, 0);
    sg.addColorStop(0, '#7CFF9E');
    sg.addColorStop(1, '#ff5252');
    ctx.fillStyle = sg;
    ctx.fillRect(bx, by, barW * Math.max(0.05, spd), barH);
    ctx.font = '700 9px "Segoe UI", Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('HIZ', bx - 26, by + 5);
  }

  // partiküller (glow'lu)
  popParticles.forEach(pt => {
    const a = Math.min(1, pt.life / 24);
    const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, pt.r * 2.2);
    g.addColorStop(0, pt.color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r * 2.2, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1;

  ctx.restore();

  // hazır ipucu
  if (state === STATE.READY) {
    const bob = Math.sin(frames * 0.08) * 3;
    ctx.font = '800 17px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText('Yön tuşu / kaydır → başla', W / 2 + 1, boardY - 24 + bob + 1);
    ctx.fillStyle = '#9fe8ff';
    ctx.fillText('Yön tuşu / kaydır → başla', W / 2, boardY - 24 + bob);
    ctx.textAlign = 'left';
  }

  // flaş + vinyet
  if (flashAlpha > 0) {
    flashAlpha = Math.max(0, flashAlpha - 0.04);
    ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
    ctx.fillRect(0, 0, W, H);
  }
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,10,25,0.45)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

// ---------- Ana döngü ----------
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
    foodPulse += 0; // (draw'da artıyor)
    if (state === STATE.PLAYING) {
      const ms = currentStepMs();
      stepAcc += STEP_MS;
      moveProgress = Math.min(1, stepAcc / ms);
      if (stepAcc >= ms) { stepAcc = 0; moveProgress = 0; step(); }
      tongueT += 0.08;
    } else {
      moveProgress = 0;
    }
    bgStars.forEach(s => { s.tw += s.tws; });
    foodPulse += 0.09;
    popParticles.forEach(pt => { pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.12; pt.life--; });
    popParticles = popParticles.filter(pt => pt.life > 0);
  }
  draw();
  requestAnimationFrame(loop);
}

// ---------- Butonlar ----------
$('start-btn').addEventListener('click', () => startGame());
$('retry-btn').addEventListener('click', () => startGame());
$('home-btn').addEventListener('click', () => location.href = 'index.html');
$('quit-btn').addEventListener('click', () => location.href = 'index.html');
$('back-to-hub-btn').addEventListener('click', () => location.href = 'index.html');
$('resume-btn').addEventListener('click', () => togglePause());
$('pause-btn').addEventListener('click', () => togglePause());

document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    S.difficulty = btn.dataset.diff;
    persist();
  });
});

// ---------- Başlat ----------
function init() {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  document.querySelectorAll('.diff-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.diff === S.difficulty);
  });
  $('best-score-display').textContent = `🏆 Rekor: ${S.bestScore}`;
  initBgStars();
  requestAnimationFrame(loop);
}

init();
