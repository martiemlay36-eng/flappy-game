"use strict";

// ---------- ANASAYFA (Oyun Salonu) ----------
// Sadece rekor gösterir ve arka planı çizer.

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

// ---------- Kalıcı veri ----------
const STORAGE_KEY = 'oyun-salonu-v2';

function $(id) { return document.getElementById(id); }

function loadFlappy() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s.flappy && typeof s.flappy.bestScore === 'number') return s.flappy.bestScore;
    }
  } catch (e) {}
  return 0;
}

function loadBest(game) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s[game] && typeof s[game].bestScore === 'number') return s[game].bestScore;
    }
  } catch (e) {}
  return 0;
}

$('hub-flappy-best').textContent = loadFlappy();
$('hub-snake-best').textContent = loadBest('snake');

// ---------- Arka plan animasyonu ----------
let frames = 0;
let clouds = [];
let stars = [];
let groundX = 0;

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
}

function lerpColor(a, b, t) {
  return `rgb(${Math.round(a[0]+(b[0]-a[0])*t)},${Math.round(a[1]+(b[1]-a[1])*t)},${Math.round(a[2]+(b[2]-a[2])*t)})`;
}

function drawCloud(x, y, s) {
  ctx.beginPath();
  ctx.arc(x, y, 16 * s, 0, Math.PI * 2);
  ctx.arc(x + 18 * s, y - 8 * s, 14 * s, 0, Math.PI * 2);
  ctx.arc(x + 36 * s, y, 16 * s, 0, Math.PI * 2);
  ctx.arc(x + 18 * s, y + 6 * s, 13 * s, 0, Math.PI * 2);
  ctx.fill();
}

function groundH() { return H * 0.11; }

function draw() {
  // Gökyüzü (gündüz)
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, 'rgb(155,216,255)');
  grd.addColorStop(0.6, 'rgb(110,190,255)');
  grd.addColorStop(1, 'rgb(220,240,255)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  // Güneş
  const sunX = W * 0.78, sunY = H * 0.12;
  ctx.fillStyle = '#FFE066';
  ctx.beginPath(); ctx.arc(sunX, sunY, 26, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,224,102,0.25)';
  ctx.beginPath(); ctx.arc(sunX, sunY, 40, 0, Math.PI * 2); ctx.fill();

  // Bulutlar
  clouds.forEach(c => {
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#fff';
    drawCloud(c.x, c.y, c.s);
  });
  ctx.globalAlpha = 1;

  // Zemin
  const gh = groundH();
  ctx.fillStyle = 'rgb(222,180,120)';
  ctx.fillRect(0, H - gh, W, gh);
  ctx.fillStyle = 'rgb(92,200,82)';
  ctx.fillRect(0, H - gh, W, gh * 0.35);
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 2;
  for (let x = groundX; x < W + 48; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, H - gh);
    ctx.lineTo(x + 18, H);
    ctx.stroke();
  }
}

function menuUpdate() {
  frames++;
  clouds.forEach(c => {
    c.x -= c.sp * 0.4;
    if (c.x < -80) { c.x = W + 80; }
  });
  groundX -= 0.5;
  if (groundX <= -48) groundX += 48;
}

const STEP_MS = 1000 / 60;
let acc = 0;
let lastT = performance.now();

function loop(now) {
  const dt = Math.min(now - lastT, 100);
  lastT = now;
  acc += dt;
  if (acc > 200) acc = STEP_MS;
  while (acc >= STEP_MS) {
    acc -= STEP_MS;
    menuUpdate();
  }
  draw();
  requestAnimationFrame(loop);
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);
initClouds();
requestAnimationFrame(loop);
