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
let wallWrap = false;   // duvardan geçiş (kolay modda mı? hayır, hep çarpışma)
let playStartMs = 0;

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
  dir = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };
  score = 0;
  stepMs = 1000 / SPEEDS[S.difficulty || 'normal'];
  stepAcc = 0;
  frames = 0;
  flashAlpha = 0;
  shakeT = 0;
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

  snake.unshift(head);

  // yem yeme
  if (food && head.x === food.x && head.y === food.y) {
    score += 1;
    scoreDisplay.textContent = score;
    S.apples = (S.apples || 0) + 1;
    sfxEat();
    // yem patlama partikülleri
    for (let i = 0; i < 10; i++) {
      popParticles.push({
        x: boardX + (food.x + 0.5) * cell,
        y: boardY + (food.y + 0.5) * cell,
        vx: (Math.random() - 0.5) * 3.5, vy: (Math.random() - 0.5) * 3.5 - 1,
        life: 24, r: 2 + Math.random() * 2.5,
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
  // arka plan
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#12283f');
  bg.addColorStop(1, '#1b3a52');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  if (shakeT > 0) {
    shakeT -= 0.03;
    const m = shakeT * 7;
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
  }

  // tahta çerçevesi
  ctx.strokeStyle = 'rgba(0,191,255,0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(boardX - 4, boardY - 4, boardSize + 8, boardSize + 8);

  // damalı zemin
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.10)';
      ctx.fillRect(boardX + x * cell, boardY + y * cell, cell, cell);
    }
  }

  // yem (elma, nabız atan)
  if (food) {
    foodPulse += 0.1;
    const pr = cell * 0.32 * (1 + 0.1 * Math.sin(foodPulse));
    const fx = boardX + (food.x + 0.5) * cell;
    const fy = boardY + (food.y + 0.5) * cell;
    // glow
    const g = ctx.createRadialGradient(fx, fy, 1, fx, fy, cell * 0.8);
    g.addColorStop(0, 'rgba(255,80,80,0.5)');
    g.addColorStop(1, 'rgba(255,80,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(fx - cell * 0.8, fy - cell * 0.8, cell * 1.6, cell * 1.6);
    // gövde
    ctx.fillStyle = '#e8384f';
    ctx.beginPath(); ctx.arc(fx, fy, pr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(fx - pr * 0.3, fy - pr * 0.35, pr * 0.32, 0, Math.PI * 2); ctx.fill();
    // sap
    ctx.strokeStyle = '#7a4a21'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(fx, fy - pr); ctx.lineTo(fx + 3, fy - pr - 4); ctx.stroke();
    // yaprak
    ctx.fillStyle = '#6ecf68';
    ctx.beginPath(); ctx.ellipse(fx + 5, fy - pr - 4, 4.5, 2.2, -0.5, 0, Math.PI * 2); ctx.fill();
  }

  // yılan (yumuşak gövde + göz)
  const n = snake.length;
  snake.forEach((seg, i) => {
    const t = i / Math.max(1, n - 1); // 0 = kafa, 1 = kuyruk
    const x = boardX + seg.x * cell;
    const y = boardY + seg.y * cell;
    const inset = cell * 0.08 + t * cell * 0.14;
    const body = ctx.createLinearGradient(x, y, x + cell, y + cell);
    const headCol = i === 0 ? '#7CFF9E' : null;
    const base = i === 0
      ? [92, 230, 120]
      : [Math.round(60 - t * 20), Math.round(200 - t * 70), Math.round(90 - t * 25)];
    body.addColorStop(0, `rgb(${base[0]+25},${base[1]+25},${base[2]+25})`);
    body.addColorStop(1, `rgb(${base[0]},${base[1]},${base[2]})`);
    ctx.fillStyle = body;
    // yuvarlatılmış kare
    const r = cell * 0.28;
    const xx = x + inset, yy = y + inset, ww = cell - inset * 2;
    ctx.beginPath();
    ctx.moveTo(xx + r, yy);
    ctx.arcTo(xx + ww, yy, xx + ww, yy + ww, r);
    ctx.arcTo(xx + ww, yy + ww, xx, yy + ww, r);
    ctx.arcTo(xx, yy + ww, xx, yy, r);
    ctx.arcTo(xx, yy, xx + ww, yy, r);
    ctx.closePath();
    ctx.fill();
  });

  // kafa gözleri + dil
  if (snake.length) {
    const h = snake[0];
    const hx = boardX + (h.x + 0.5) * cell;
    const hy = boardY + (h.y + 0.5) * cell;
    const er = cell * 0.11;
    const off = cell * 0.16;
    const px = dir.y !== 0 ? off : 0; // dikey hareketken gözler yana
    const py = dir.x !== 0 ? off : 0;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(hx - (dir.x !== 0 ? dir.x * off * 0.4 : off), hy - off + py * 0, er, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + (dir.x !== 0 ? dir.x * off * 0.4 + off : off), hy + off, er, 0, Math.PI * 2); ctx.fill();
    // bebekler
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(hx - (dir.x !== 0 ? dir.x * off * 0.4 : off) + dir.x * er * 0.4, hy - off + dir.y * er * 0.4, er * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + (dir.x !== 0 ? dir.x * off * 0.4 + off : off) + dir.x * er * 0.4, hy + off + dir.y * er * 0.4, er * 0.5, 0, Math.PI * 2); ctx.fill();
  }

  // partiküller
  popParticles.forEach(pt => {
    ctx.globalAlpha = Math.min(1, pt.life / 24);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1;

  ctx.restore();

  // hazır ipucu
  if (state === STATE.READY) {
    ctx.font = '800 17px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillText('Yön tuşu / kaydır → başla', W / 2, boardY - 18);
    ctx.textAlign = 'left';
  }

  // flaş
  if (flashAlpha > 0) {
    flashAlpha = Math.max(0, flashAlpha - 0.04);
    ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
    ctx.fillRect(0, 0, W, H);
  }
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
      stepAcc += STEP_MS;
      if (stepAcc >= stepMs) { stepAcc = 0; step(); }
    }
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

  requestAnimationFrame(loop);
}

init();
