"use strict";

/* =====================================================
   PONG ULTRA — Oyun Salonu 3. Oyunu (Gelişmiş Sürüm)
   - Sinematik 60 FPS Grafik Motoru:
     * Dinamik top zemin aydınlatması & uçuşan enerji partikülleri
     * Akışkan kurdele kuyruk (ribbon trail), hız esnemesi & falso halkaları
     * 3D metalik-plazma raketler, hareket izi (afterimage) & darbe yaylanması
     * Duvar çarpma dalgaları, şok halkaları, kale lazerleri & 4 Arena Teması
   - Mobil Hassasiyet Mükemmelliği:
     * Göreceli Trackpad sürükleme (parmak raketi kapatmaz, zıplama yapmaz)
     * Canlı ayarlanabilir Hassasiyet Sürgüsü (%60–%220) + Doğrudan mod seçeneği
     * Falsolu vuruş (spin) + alt-adım (sub-step) sıfır kaçırma fiziği
   - Kusursuz Ayna (Mirror) Senkronlu Çevrimiçi Düello (PeerJS)
   ===================================================== */

// ---------- Canvas ----------
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
let W = 420, H = 700, DPR = 1;

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = rect.width || 420;
  H = rect.height || 700;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  layout(true);
}

// ---------- DOM ----------
const $ = id => document.getElementById(id);
const hud = $('hud'), menuScreen = $('menu-screen'), gameoverScreen = $('gameover-screen');
const pauseScreen = $('pause-screen'), tapHint = $('tap-hint');
const newRecord = $('new-record');
const soundBtn = $('sound-btn'), musicBtn = $('music-btn');
const volumeRange = $('volume-range'), volumeIcon = $('volume-icon');
const sensRange = $('sens-range'), sensLabel = $('sens-label');
const pauseSensRange = $('pause-sens-range'), pauseSensLabel = $('pause-sens-label');
const ctrlModeBtn = $('ctrl-mode-btn'), pauseCtrlBtn = $('pause-ctrl-btn');

function show(el) { if (el) el.classList.remove('hidden'); }
function hide(el) { if (el) el.classList.add('hidden'); }

// ---------- 4 Görsel Arena Teması ----------
const THEMES = {
  cyber: {
    name: 'Siber',
    bg0: '#030712', bg1: '#071326', bg2: '#0c1f38',
    grid: 'rgba(0, 210, 255, 0.08)',
    line: 'rgba(0, 210, 255, 0.42)',
    wall: '#5ce1e6',
    padL: '#00f5d4', padL2: '#00bbf9',
    padR: '#ff3366', padR2: '#ff758f',
    ballGlow: [0, 245, 212],
    fastGlow: [255, 200, 55]
  },
  ice: {
    name: 'Buz',
    bg0: '#091929', bg1: '#102a42', bg2: '#173b59',
    grid: 'rgba(180, 235, 255, 0.09)',
    line: 'rgba(120, 210, 255, 0.48)',
    wall: '#b3e5fc',
    padL: '#40c4ff', padL2: '#80d8ff',
    padR: '#ff5252', padR2: '#ff8a80',
    ballGlow: [128, 216, 255],
    fastGlow: [255, 235, 130],
    iceScratches: true
  },
  synth: {
    name: 'Synth',
    bg0: '#100321', bg1: '#260842', bg2: '#420e5c',
    grid: 'rgba(255, 0, 160, 0.11)',
    line: 'rgba(255, 90, 200, 0.45)',
    wall: '#ff66c4',
    padL: '#ffd700', padL2: '#ff9e00',
    padR: '#ff00a0', padR2: '#b5179e',
    ballGlow: [255, 110, 210],
    fastGlow: [255, 230, 80]
  },
  court: {
    name: 'Kort',
    bg0: '#061a14', bg1: '#0b3024', bg2: '#104534',
    grid: 'rgba(255, 255, 255, 0.06)',
    line: 'rgba(255, 255, 255, 0.52)',
    wall: '#a7f3d0',
    padL: '#aeea00', padL2: '#64dd17',
    padR: '#ff6d00', padR2: '#ff9100',
    ballGlow: [190, 255, 120],
    fastGlow: [255, 215, 64]
  }
};

// ---------- Kalıcı Veri (oyun-salonu-v2 uyumlu) ----------
const STORAGE_KEY = 'oyun-salonu-v2';

function defaultSaved() {
  return {
    difficulty: 'normal',
    theme: 'cyber',
    ctrlMode: 'trackpad', // 'trackpad' (göreceli) veya 'direct' (doğrudan)
    sensitivity: 1.35,    // mobil sürükleme çarpanı (0.60 .. 2.20)
    bestDiff: 0,
    bestRally: 0,
    games: 0,
    wins: 0,
    playerName: ''
  };
}

let audioSettings = { soundOn: true, musicOn: true, volume: 0.7 };

function loadSaved() {
  const d = defaultSaved();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (typeof s.soundOn === 'boolean') audioSettings.soundOn = s.soundOn;
      if (typeof s.musicOn === 'boolean') audioSettings.musicOn = s.musicOn;
      if (typeof s.volume === 'number') audioSettings.volume = Math.max(0, Math.min(1, s.volume));
      if (!d.playerName && s.flappy && s.flappy.playerName) d.playerName = s.flappy.playerName;
      if (s.pong && typeof s.pong === 'object') {
        Object.keys(d).forEach(k => { if (s.pong[k] !== undefined) d[k] = s.pong[k]; });
      }
    }
  } catch (e) {}
  if (!THEMES[d.theme]) d.theme = 'cyber';
  if (d.ctrlMode !== 'trackpad' && d.ctrlMode !== 'direct') d.ctrlMode = 'trackpad';
  d.sensitivity = Math.max(0.6, Math.min(2.2, Number(d.sensitivity) || 1.35));
  return d;
}

let saved = loadSaved();
const P = saved;

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
    if (typeof root.pong !== 'object' || !root.pong) root.pong = {};
    Object.assign(root.pong, saved);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
  } catch (e) {}
}

// ---------- Sabitler & Durum ----------
const AI = { easy: 0.54, normal: 0.76, hard: 0.94 };
const WIN_SCORE = 11;
let currentWinScore = WIN_SCORE;

const STATE = { MENU: 0, READY: 1, SERVE: 2, PLAYING: 3, GAMEOVER: 4, PAUSED: 5 };
let state = STATE.MENU;

let padW = 12, padH = 126, padX1 = 28, padX2 = 380;
let left  = { y: 280, prevY: 280, vy: 0, target: 280, recoil: 0, trail: [] };
let right = { y: 280, prevY: 280, vy: 0, target: 280, recoil: 0, trail: [] };
let ball  = { x: 210, y: 350, vx: 6, vy: 2, r: 8.5, speed: 6.2, spin: 0, squash: 0 };

let scL = 0, scR = 0;
let rally = 0, matchBestRally = 0;
let serveTo = 1;
let serveCountdown = 0;
let frames = 0;
let flashAlpha = 0;
let shakeT = 0;

// Görsel Efekt Dizileri
let ballTrail = [];
let popParticles = [];
let shockwaves = [];   // {x, y, r, maxR, color, life, maxLife}
let wallRipples = [];  // {x, y, w, color, life, maxLife}
let ambientMotes = []; // süzülen ışık zerrecikleri
let hitGlowL = 0, hitGlowR = 0;
let scoreFlashL = 0, scoreFlashR = 0;
let touchIndicator = { active: false, x: 0, y: 0, alpha: 0 };

// Menü arka planı için canlı demo topu
let demoBall = { x: 210, y: 350, vx: 4.8, vy: 3.1, spin: 0.03 };
let demoPadL = 290, demoPadR = 290;

function initMotes() {
  ambientMotes = [];
  for (let i = 0; i < 34; i++) {
    ambientMotes.push({
      x: Math.random(),
      y: Math.random(),
      r: 0.7 + Math.random() * 1.6,
      vx: (Math.random() - 0.5) * 0.0006,
      vy: -0.0003 - Math.random() * 0.0007,
      ph: Math.random() * Math.PI * 2
    });
  }
}

function layout(keepPositions) {
  padW = Math.max(11, Math.round(W * 0.030));
  padH = Math.round(H * 0.185);
  padX1 = Math.round(W * 0.068);
  padX2 = Math.round(W * 0.932 - padW);
  ball.r = Math.max(6, Math.round(W * 0.020 * 10) / 10);
  if (!keepPositions) {
    left.y = left.prevY = left.target = H / 2 - padH / 2;
    right.y = right.prevY = right.target = H / 2 - padH / 2;
    left.trail = [];
    right.trail = [];
  } else {
    left.y = Math.max(6, Math.min(H - padH - 6, left.y));
    left.target = Math.max(6, Math.min(H - padH - 6, left.target));
    right.y = Math.max(6, Math.min(H - padH - 6, right.y));
  }
}

// ---------- Ses & Arcade Synthwave Müzik ----------
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
  osc.start(); osc.stop(ac.currentTime + dur);
}

const sfx = {
  paddle: (fast) => {
    beep(fast ? 740 : 580, 0.065, 'triangle', 0.16, 120);
    if (fast) beep(1100, 0.05, 'sine', 0.10);
  },
  wall:   () => beep(390, 0.045, 'sine', 0.10, -40),
  score:  () => { beep(330, 0.12, 'sawtooth', 0.15, -60); setTimeout(() => beep(220, 0.20, 'triangle', 0.13), 95); },
  goalMe: () => { [587, 880].forEach((f, i) => setTimeout(() => beep(f, 0.11, 'triangle', 0.15), i * 75)); },
  win:    () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.15, 'sine', 0.15), i * 115)); },
  lose:   () => { [400, 320, 240, 160].forEach((f, i) => setTimeout(() => beep(f, 0.17, 'triangle', 0.14), i * 130)); },
  click:  () => beep(700, 0.045, 'sine', 0.09)
};

const PONG_ARP  = [220, 261.63, 329.63, 440, 329.63, 261.63, 196, 246.94, 293.66, 392, 293.66, 246.94, 174.61, 220, 261.63, 349.23];
let musicStep = 0, musicTimer = null;

function tickMusic() {
  if (!audioSettings.musicOn || audioSettings.volume <= 0.005) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  if (!audioCtx || audioCtx.state !== 'running') return;
  if (state === STATE.PAUSED || state === STATE.GAMEOVER) return;

  const idx = musicStep % PONG_ARP.length;
  musicStep++;
  const f = PONG_ARP[idx];
  const v = (state === STATE.PLAYING ? 0.036 : 0.022) * audioSettings.volume;
  if (v <= 0.001) return;
  const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
  osc.type = state === STATE.PLAYING ? 'triangle' : 'sine';
  osc.frequency.setValueAtTime(f, audioCtx.currentTime);
  gain.gain.setValueAtTime(v, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0005, audioCtx.currentTime + 0.15);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + 0.15);
}

function ensureMusicLoop() {
  if (musicTimer) clearInterval(musicTimer);
  if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
    musicTimer = setInterval(tickMusic, 175);
  }
}

// ---------- UI Güncelleyiciler ----------
function updateSettingsUI() {
  if (soundBtn) soundBtn.textContent = audioSettings.soundOn ? '🔊 Efekt: Açık' : '🔇 Efekt: Kapalı';
  if (musicBtn) musicBtn.textContent = audioSettings.musicOn ? '🎵 Müzik: Açık' : '🎵 Müzik: Kapalı';
  if (volumeRange) volumeRange.value = Math.round(audioSettings.volume * 100);
  if (volumeIcon) {
    if (audioSettings.volume <= 0.01) volumeIcon.textContent = '🔇';
    else if (audioSettings.volume < 0.35) volumeIcon.textContent = '🔈';
    else if (audioSettings.volume < 0.7) volumeIcon.textContent = '🔉';
    else volumeIcon.textContent = '🔊';
  }
  const pct = Math.round(P.sensitivity * 100);
  if (sensRange) sensRange.value = pct;
  if (pauseSensRange) pauseSensRange.value = pct;
  if (sensLabel) sensLabel.textContent = `📱 Hassasiyet: %${pct}`;
  if (pauseSensLabel) pauseSensLabel.textContent = `📱 Hassasiyet: %${pct}`;

  const modeTxt = P.ctrlMode === 'trackpad' ? '🎯 Kontrol: Trackpad' : '👆 Kontrol: Doğrudan';
  if (ctrlModeBtn) ctrlModeBtn.textContent = modeTxt;
  if (pauseCtrlBtn) pauseCtrlBtn.textContent = modeTxt;

  document.querySelectorAll('#theme-tabs .theme-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === P.theme);
  });
  document.querySelectorAll('#diff-tabs .ai-diff-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.diff === P.difficulty);
  });
  if ($('best-score-display')) {
    $('best-score-display').textContent = `🏆 Galibiyet: ${P.wins || 0} · Rekor fark: ${P.bestDiff || 0}`;
  }
}

// ---------- Top & Fizik ----------
function resetBall(dirSide) {
  ball.x = W / 2;
  ball.y = H / 2;
  // Ekran genişliğine orantılı kontrollü hız (420px genişlikte ~6.0)
  const wMul = Math.max(0.8, Math.min(1.25, W / 420));
  ball.speed = 6.0 * wMul;
  const ang = (Math.random() - 0.5) * 0.62;
  ball.vx = Math.cos(ang) * ball.speed * dirSide;
  ball.vy = Math.sin(ang) * ball.speed;
  ball.spin = 0;
  ball.squash = 0;
  ballTrail = [];
  rally = 0;
  serveTo = dirSide;
}

function serve() {
  state = STATE.PLAYING;
  resetBall(serveTo);
}

function startGame() {
  getAC();
  currentWinScore = WIN_SCORE;
  layout(false);
  scL = 0; scR = 0;
  rally = 0; matchBestRally = 0;
  updateScoreUI();
  ballTrail = [];
  popParticles = [];
  shockwaves = [];
  wallRipples = [];
  flashAlpha = 0;
  shakeT = 0;
  show(hud);
  if (tapHint) {
    show(tapHint);
    setTimeout(() => hide(tapHint), 3200);
  }
  hide(menuScreen); hide(gameoverScreen); hide(pauseScreen);
  hide($('mp-screen')); hide($('mp-gameover-screen'));
  state = STATE.READY;
  serveCountdown = 3 * 60;
  resetBall(1);
}

function updateScoreUI() {
  $('sc-left').textContent = scL;
  $('sc-right').textContent = scR;
}

function spawnShockwave(x, y, color, maxR = 65) {
  shockwaves.push({ x, y, r: 8, maxR, color, life: 22, maxLife: 22 });
}

function spawnHitParticles(x, y, color, dirX, count = 12) {
  for (let i = 0; i < count; i++) {
    const sp = 2 + Math.random() * 4.5;
    const ang = (Math.random() - 0.5) * 1.8;
    popParticles.push({
      x, y,
      vx: Math.cos(ang) * sp * dirX,
      vy: Math.sin(ang) * sp,
      life: 22 + Math.random() * 10,
      maxLife: 32,
      r: 1.6 + Math.random() * 2.4,
      color
    });
  }
}

function spawnGoalParticles(x, y, color) {
  spawnShockwave(x, y, color, 130);
  for (let i = 0; i < 28; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 2 + Math.random() * 7;
    popParticles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 32 + Math.random() * 14,
      maxLife: 46,
      r: 2 + Math.random() * 3.2,
      color
    });
  }
}

// Alt-adımlı (sub-step) hassas top fiziği + Falso (Spin)
function stepBall() {
  const th = THEMES[P.theme] || THEMES.cyber;
  const subSteps = Math.abs(ball.vx) > 9 ? 2 : 1;

  for (let s = 0; s < subSteps; s++) {
    const dt = 1 / subSteps;

    // Falso (spin) dikey hıza tatlı bir kavis katar
    if (Math.abs(ball.spin) > 0.002) {
      ball.vy += ball.spin * 0.14 * dt;
      ball.spin *= Math.pow(0.992, dt);
    }

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Üst / Alt Duvar Çarpışması + Dalga Efekti
    if (ball.y - ball.r < 4) {
      ball.y = 4 + ball.r;
      ball.vy = Math.abs(ball.vy);
      ball.squash = 0.65;
      wallRipples.push({ x: ball.x, y: 3, w: 12, color: th.wall, life: 22, maxLife: 22 });
      sfx.wall();
    } else if (ball.y + ball.r > H - 4) {
      ball.y = H - 4 - ball.r;
      ball.vy = -Math.abs(ball.vy);
      ball.squash = 0.65;
      wallRipples.push({ x: ball.x, y: H - 3, w: 12, color: th.wall, life: 22, maxLife: 22 });
      sfx.wall();
    }

    // Sol Raket (Sen — 4px köşe yakalama toleransı ile mobil dostu!)
    if (ball.vx < 0 && ball.x - ball.r <= padX1 + padW && ball.x - ball.r >= padX1 - 14) {
      if (ball.y + ball.r + 4 >= left.y && ball.y - ball.r - 4 <= left.y + padH) {
        ball.x = padX1 + padW + ball.r;
        const rel = Math.max(-1, Math.min(1, (ball.y - (left.y + padH / 2)) / (padH / 2)));
        const maxAng = 1.02;
        const ang = rel * maxAng;
        const maxSpd = 14.2 * Math.max(0.85, W / 420);
        const sp = Math.min(maxSpd, ball.speed + 0.32);
        ball.speed = sp;
        ball.vx = Math.cos(ang) * sp;
        ball.vy = Math.sin(ang) * sp;

        // Raket hareket hızından falso (spin) aktarımı
        ball.spin = Math.max(-0.9, Math.min(0.9, left.vy * 0.055));
        ball.squash = 1.0;
        left.recoil = 6.5;
        hitGlowL = 1;
        rally++;
        if (rally > matchBestRally) matchBestRally = rally;
        if (rally > (P.bestRally || 0)) P.bestRally = rally;

        const isFast = sp > 9.5 || Math.abs(ball.spin) > 0.35;
        if (isFast) shakeT = 0.35;
        sfx.paddle(isFast);
        spawnShockwave(ball.x, ball.y, th.padL, isFast ? 72 : 48);
        spawnHitParticles(ball.x, ball.y, th.padL, 1, isFast ? 18 : 11);
        break;
      }
    }

    // Sağ Raket (Rakip / AI)
    if (ball.vx > 0 && ball.x + ball.r >= padX2 && ball.x + ball.r <= padX2 + padW + 14) {
      if (ball.y + ball.r + 3 >= right.y && ball.y - ball.r - 3 <= right.y + padH) {
        ball.x = padX2 - ball.r;
        const rel = Math.max(-1, Math.min(1, (ball.y - (right.y + padH / 2)) / (padH / 2)));
        const maxAng = 1.02;
        const ang = rel * maxAng;
        const maxSpd = 14.2 * Math.max(0.85, W / 420);
        const sp = Math.min(maxSpd, ball.speed + 0.32);
        ball.speed = sp;
        ball.vx = -Math.cos(ang) * sp;
        ball.vy = Math.sin(ang) * sp;
        ball.spin = Math.max(-0.9, Math.min(0.9, right.vy * 0.045));
        ball.squash = 1.0;
        right.recoil = 6.5;
        hitGlowR = 1;
        rally++;
        if (rally > matchBestRally) matchBestRally = rally;

        const isFast = sp > 9.5;
        if (isFast) shakeT = 0.35;
        sfx.paddle(isFast);
        spawnShockwave(ball.x, ball.y, th.padR, isFast ? 72 : 48);
        spawnHitParticles(ball.x, ball.y, th.padR, -1, isFast ? 18 : 11);
        break;
      }
    }
  }

  ballTrail.push({ x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy });
  if (ballTrail.length > 18) ballTrail.shift();
  if (ball.squash > 0) ball.squash = Math.max(0, ball.squash - 0.12);

  // Gol Kontrolü
  if (ball.x - ball.r > W) { scoreL(); return; }
  if (ball.x + ball.r < 0) { scoreR(); return; }
}

function scoreL() {
  const th = THEMES[P.theme] || THEMES.cyber;
  scL++;
  scoreFlashL = 1;
  shakeT = 0.85;
  flashAlpha = 0.28;
  sfx.goalMe();
  spawnGoalParticles(W - 22, ball.y, th.padL);
  updateScoreUI();
  if (scL >= currentWinScore) { endGame(true); return; }
  state = STATE.READY;
  serveCountdown = 60;
  serveTo = -1;
  resetBall(-1);
}

function scoreR() {
  const th = THEMES[P.theme] || THEMES.cyber;
  scR++;
  scoreFlashR = 1;
  shakeT = 0.85;
  flashAlpha = 0.28;
  sfx.score();
  spawnGoalParticles(22, ball.y, th.padR);
  updateScoreUI();
  if (scR >= currentWinScore) { endGame(false); return; }
  state = STATE.READY;
  serveCountdown = 60;
  serveTo = 1;
  resetBall(1);
}

function endGame(won) {
  state = STATE.GAMEOVER;

  if (MP.connected) {
    if (MP.isHost) mpSend({ t: 'end', sl: scL, sr: scR });
    mpMatchEnd(scL, scR);
    return;
  }

  if (won) sfx.win(); else sfx.lose();

  const diff = scL - scR;
  P.games++;
  if (won) P.wins++;
  const isRecord = won && diff > P.bestDiff;
  if (isRecord) P.bestDiff = diff;
  persist();
  updateSettingsUI();

  $('go-title').textContent = won ? '🏆 KAZANDIN!' : '💀 KAYBETTİN...';
  $('final-score').textContent = `${scL} : ${scR}`;
  if ($('best-rally-go')) $('best-rally-go').textContent = matchBestRally;
  $('best-score-go').textContent = P.bestDiff;
  if (isRecord) show(newRecord); else hide(newRecord);
  setTimeout(() => {
    if (state === STATE.GAMEOVER && !MP.connected) {
      show(gameoverScreen);
      hide(hud);
    }
  }, 650);
}

// ---------- Akıllı AI ----------
function aiMove() {
  const skill = AI[P.difficulty || 'normal'] || AI.normal;
  let target = H / 2 - padH / 2;
  if (ball.vx > 0) {
    let py = ball.y, px = ball.x, vx = ball.vx, vy = ball.vy;
    let guard = 0;
    while (px < padX2 && guard++ < 120) {
      px += vx * 3;
      py += (vy + ball.spin * 0.25) * 3;
      if (py < ball.r) { py = ball.r; vy = Math.abs(vy); }
      if (py > H - ball.r) { py = H - ball.r; vy = -Math.abs(vy); }
    }
    target = py - padH / 2;
  } else {
    target = H / 2 - padH / 2 + Math.sin(frames * 0.03) * 28;
  }
  right.prevY = right.y;
  const maxSpeed = 6.8 * skill;
  const dy = target - right.y;
  right.y += Math.max(-maxSpeed, Math.min(maxSpeed, dy * 0.26));
  right.y = Math.max(6, Math.min(H - padH - 6, right.y));
  right.vy = right.y - right.prevY;
}

// =====================================================
//   MOBİL HASSASİYET & KONTROL SİSTEMİ (Sıfır Gecikme)
// =====================================================
const keys = {};
document.addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  if (['ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;

  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (state === STATE.PLAYING || state === STATE.READY || state === STATE.PAUSED) togglePause();
    return;
  }
  if (e.code === 'Enter' && state === STATE.GAMEOVER && !MP.connected) startGame();
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

let activeTouchId = null;
let lastPointerY = null;
let pointerActive = false;

function pointerCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: W, height: H };
  const scaleX = rect.width ? W / rect.width : 1;
  const scaleY = rect.height ? H / rect.height : 1;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

function onPointerDown(cx, cy) {
  getAC();
  const pt = pointerCoords(cx, cy);
  lastPointerY = pt.y;
  pointerActive = true;
  touchIndicator.active = true;
  touchIndicator.x = pt.x;
  touchIndicator.y = pt.y;
  touchIndicator.alpha = 0.85;

  if (P.ctrlMode === 'direct') {
    // Doğrudan takip: parmağın raketi kapatmaması için hafif yukarı ofset
    left.target = pt.y - padH * 0.62;
    left.target = Math.max(6, Math.min(H - padH - 6, left.target));
  }
}

function onPointerMove(cx, cy) {
  if (!pointerActive) return;
  const pt = pointerCoords(cx, cy);
  touchIndicator.x = pt.x;
  touchIndicator.y = pt.y;
  touchIndicator.alpha = 0.85;

  if (P.ctrlMode === 'trackpad') {
    // Göreceli Trackpad: Parmak nereye dokunursa dokunsun raket zıplamaz,
    // hareket miktarı x hassasiyet kadar anında kayar!
    const dy = (pt.y - lastPointerY) * P.sensitivity;
    left.target = Math.max(6, Math.min(H - padH - 6, left.target + dy));
  } else {
    left.target = Math.max(6, Math.min(H - padH - 6, pt.y - padH * 0.62));
  }
  lastPointerY = pt.y;
}

function onPointerUp() {
  pointerActive = false;
  activeTouchId = null;
  lastPointerY = null;
  touchIndicator.active = false;
}

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  if (e.changedTouches && e.changedTouches.length) {
    const t = e.changedTouches[0];
    activeTouchId = t.identifier;
    onPointerDown(t.clientX, t.clientY);
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!e.touches) return;
  let t = e.touches[0];
  if (activeTouchId !== null) {
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === activeTouchId) { t = e.touches[i]; break; }
    }
  }
  if (t) onPointerMove(t.clientX, t.clientY);
}, { passive: false });

canvas.addEventListener('touchend', e => { e.preventDefault(); onPointerUp(); }, { passive: false });
canvas.addEventListener('touchcancel', e => { e.preventDefault(); onPointerUp(); }, { passive: false });

canvas.addEventListener('mousedown', e => { onPointerDown(e.clientX, e.clientY); });
canvas.addEventListener('mousemove', e => {
  if (e.buttons === 1 || pointerActive) onPointerMove(e.clientX, e.clientY);
});
canvas.addEventListener('mouseup', onPointerUp);

function humanMove() {
  left.prevY = left.y;
  const kbSpeed = 9.5;
  const kbUsed = keys['ArrowUp'] || keys['KeyW'] || keys['ArrowDown'] || keys['KeyS'];
  if (keys['ArrowUp'] || keys['KeyW']) left.target -= kbSpeed;
  if (keys['ArrowDown'] || keys['KeyS']) left.target += kbSpeed;
  left.target = Math.max(6, Math.min(H - padH - 6, left.target));

  // Dokunmatikte 0.84 ile ultra-keskin anlık takip, klavyede akıcı süzülme
  const follow = pointerActive && !kbUsed ? 0.84 : 0.48;
  left.y += (left.target - left.y) * follow;
  left.vy = left.y - left.prevY;

  // Raket hareket izi (afterimage)
  if (Math.abs(left.vy) > 1.8) {
    left.trail.push({ y: left.y, a: Math.min(0.45, Math.abs(left.vy) * 0.03) });
    if (left.trail.length > 5) left.trail.shift();
  } else if (left.trail.length) {
    left.trail.shift();
  }

  if (Math.abs(right.vy) > 1.8) {
    right.trail.push({ y: right.y, a: Math.min(0.42, Math.abs(right.vy) * 0.03) });
    if (right.trail.length > 5) right.trail.shift();
  } else if (right.trail.length) {
    right.trail.shift();
  }

  if (left.recoil > 0) left.recoil = Math.max(0, left.recoil - 0.8);
  if (right.recoil > 0) right.recoil = Math.max(0, right.recoil - 0.8);
}

function togglePause() {
  if (MP.connected || MP.reconnecting) return;
  if (state === STATE.PLAYING || state === STATE.READY) {
    state = STATE.PAUSED;
    show(pauseScreen);
  } else if (state === STATE.PAUSED) {
    state = STATE.PLAYING;
    hide(pauseScreen);
  }
}

// =====================================================
//   ÇEVRİMİÇİ DÜELLO (PeerJS + MPCore) — Ayna & Tahminli
// - 4G/5G Uyumlu Çoklu STUN + TURN Havuzu & Saf JS QR Kod
// - Canlı Ping (RTT ms) + RTT/2 Saat-Bağımsız Geri Sayım
// - Hazırlık Lobisi (Ready Room), Hedef Skor/Tema & Oyun Değiştirme
// - Maç İçi 12sn Kopma Koruması + Guest İstemci Tahmini (Prediction)
// =====================================================
const MPC = typeof MPCore !== 'undefined' ? MPCore : null;

const MP = {
  peer: null, conn: null,
  isHost: false, connected: false,
  inLobby: false, inMatch: false,
  reconnecting: false, graceFrames: 0, peerLeftCleanly: false,
  myReady: false, oppReady: false,
  lobbyWinScore: 11, lobbyTheme: null,
  matchWinScore: 11, matchTheme: null,
  pingMs: 0, lastRxAt: 0,
  seriesMe: 0, seriesOpp: 0, scoredThisMatch: false,
  localBounceCooldown: 0,
  roomCode: '',
  myName: 'Sen', oppName: 'Rakip',
  oppNormY: 0.4, oppTargetY: 280,
  targetBallX: 210, targetBallY: 350,
  ballFresh: false,
  rematchVotes: 0, oppRematch: false
};

const mpScreen = $('mp-screen'), mpGameoverScreen = $('mp-gameover-screen');

const MP_PEER_OPTS = MPC ? MPC.PEER_OPTS : {
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
let mpPingAcc = 0;

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
  const val = (inp ? inp.value.trim() : '') || P.playerName || '';
  if (val) {
    P.playerName = val.slice(0, 12);
    persist();
    return P.playerName;
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
  MP.inLobby = false;
  MP.inMatch = false;
  MP.reconnecting = false;
  MP.graceFrames = 0;
  MP.myReady = false;
  MP.oppReady = false;
  MP.localBounceCooldown = 0;
  hide($('mp-opp-bar'));
  hide($('mp-grace-banner'));
  hide($('mp-ready-area'));
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
  const text = `🏓 Pong düellosuna gel! Oda Kodu: ${MP.roomCode}`;
  if (typeof navigator !== 'undefined' && navigator.share) {
    navigator.share({ title: 'Pong Düellosu', text, url }).catch(() => {});
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
  hide($('mp-ready-area'));
  $('mp-join-status').textContent = '';
  $('mp-code-input').value = '';
  if ($('mp-name-input')) $('mp-name-input').value = P.playerName || '';
}

function mpOpenReadyRoom() {
  MP.inLobby = true;
  if (!MP.lobbyTheme) MP.lobbyTheme = P.theme || 'cyber';
  if (!MP.lobbyWinScore) MP.lobbyWinScore = WIN_SCORE;
  show(mpScreen);
  hide(menuScreen);
  hide($('mp-btn-row'));
  hide($('mp-host-area'));
  hide($('mp-join-area'));
  $('mp-error').textContent = '';
  if (MPC) {
    const area = MPC.mountReadyRoom($('mp-lobby'), {
      gameId: 'pong',
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
  const curWin = MP.lobbyWinScore || WIN_SCORE;
  const curTheme = MP.lobbyTheme || P.theme || 'cyber';
  MPC.renderReadyState({
    roomCode: MP.roomCode,
    isHost: MP.isHost,
    myName: MP.myName,
    oppName: MP.oppName,
    myReady: MP.myReady,
    oppReady: MP.oppReady,
    settingsRows: [
      {
        label: 'Hedef Skor',
        value: curWin,
        options: [
          { value: 5, label: '5 Puan' },
          { value: 11, label: '11 Puan' },
          { value: 15, label: '15 Puan' }
        ],
        onChange: val => {
          sfx.click();
          MP.lobbyWinScore = Number(val) || 11;
          mpSend({ t: 'lobby_cfg', winScore: MP.lobbyWinScore, theme: MP.lobbyTheme || P.theme, name: MP.myName });
          mpRenderReadyRoom();
        }
      },
      {
        label: 'Arena',
        value: curTheme,
        options: [
          { value: 'cyber', label: '🌌 Siber' },
          { value: 'ice', label: '❄️ Buz' },
          { value: 'synth', label: '🌅 Synth' },
          { value: 'court', label: '💚 Kort' }
        ],
        onChange: val => {
          sfx.click();
          P.theme = val;
          MP.lobbyTheme = val;
          updateSettingsUI();
          persist();
          mpSend({ t: 'lobby_cfg', winScore: MP.lobbyWinScore || WIN_SCORE, theme: val, name: MP.myName });
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

function mpSwitchGame(targetGame) {
  if (!MPC || !MPC.GAMES[targetGame] || !MP.isHost || !MP.connected) return;
  sfx.click();
  MP.peerLeftCleanly = true;
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
  mpSend({
    t: '_switch_game',
    game: targetGame,
    roomCode: MP.roomCode,
    sHost: MP.seriesMe,
    sGuest: MP.seriesOpp
  });
  mpCleanup();
  location.href = MPC.GAMES[targetGame].file;
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

  const peer = new Peer('pong-' + MP.roomCode, MP_PEER_OPTS);
  MP.peer = peer;

  peer.on('open', () => {
    if (MP.peer !== peer) return;
    mpIdRetryCount = 0;
    if (!MP.reconnecting) {
      $('mp-error').textContent = '';
      $('mp-room-code').textContent = MP.roomCode;
      $('mp-wait-text').textContent = '✅ Oda aktif! QR okut veya kodu gönder.';
      if (MPC) MPC.mountHostQR($('mp-host-area'), mpGetInviteUrl());
    }
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
  MP.seriesMe = prevMe; MP.seriesOpp = prevOpp;
  MP.myName = mpGetMyName();
  hide($('mp-btn-row'));
  hide($('mp-ready-area'));
  show($('mp-host-area'));
  $('mp-error').textContent = '';

  MP.roomCode = keepCode || mpMakeRoomCode();
  MP.isHost = true;
  MP.peerLeftCleanly = false;
  MP.lobbyWinScore = WIN_SCORE;
  MP.lobbyTheme = P.theme || 'cyber';
  mpHostWaiting = true;
  mpIdRetryCount = 0;
  $('mp-room-code').textContent = MP.roomCode;
  $('mp-wait-text').textContent = 'Sunucuya bağlanılıyor...';
  if (MPC) MPC.mountHostQR($('mp-host-area'), mpGetInviteUrl());

  mpRequestWakeLock();
  mpOpenHostPeer();
}

function mpJoin() {
  sfx.click();
  MP.myName = mpGetMyName();
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
    MP.conn = peer.connect('pong-' + MP.roomCode, { reliable: true });
    setupConn();
  });

  peer.on('error', err => {
    if (MP.peer !== peer || MP.connected) return;
    const type = (err && err.type) || '';
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
  if (code.length !== 5) { $('mp-join-status').textContent = '5 haneli kod gir!'; return; }
  sfx.click();
  const prevMe = MP.seriesMe, prevOpp = MP.seriesOpp;
  mpCleanup();
  MP.seriesMe = prevMe; MP.seriesOpp = prevOpp;
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
  if (sub) sub.textContent = 'Rakibin bağlantısı koptu — maç duraklatıldı, yeniden bağlanılıyor (12 sn)';

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
    if (sub) sub.textContent = `Rakibin bağlantısı koptu — maç duraklatıldı, yeniden bağlanılıyor (${sec} sn)`;
  }
  if (!MP.connected && MP.graceFrames > 0 && MP.graceFrames % 90 === 0) {
    if (MP.isHost) mpEnsureHostAlive(true);
    else mpAttemptJoin();
  }
  if (MP.graceFrames <= 0) {
    mpCleanup();
    goMenu();
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
  MP.conn.on('open', () => {
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
        sl: MP.isHost ? scL : undefined,
        sr: MP.isHost ? scR : undefined
      });
      return;
    }

    MP.inLobby = true;
    MP.myReady = false;
    MP.oppReady = false;
    mpSend({
      t: 'hello',
      name: MP.myName,
      winScore: MP.lobbyWinScore || WIN_SCORE,
      theme: MP.lobbyTheme || P.theme
    });
    if (MPC) mpOpenReadyRoom();
    else if (MP.isHost) mpBeginMatch();
  });

  MP.conn.on('data', data => {
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
      case '_leave':
        MP.peerLeftCleanly = true;
        if (MPC) MPC.clearParty();
        mpCleanup();
        goMenu();
        break;
      case '_resume':
        MP.reconnecting = false;
        MP.graceFrames = 0;
        hide($('mp-grace-banner'));
        if (data.name) MP.oppName = String(data.name).slice(0, 12);
        if (!MP.isHost && typeof data.sl === 'number' && typeof data.sr === 'number') {
          scL = data.sr;
          scR = data.sl;
          updateScoreUI();
        }
        break;
      case '_switch_game':
        if (MPC && MPC.GAMES[data.game]) {
          MP.peerLeftCleanly = true;
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
          mpCleanup();
          location.href = MPC.GAMES[data.game].file;
        }
        break;
      case 'hello':
        if (data.name) MP.oppName = String(data.name).slice(0, 12);
        if (!MP.isHost) {
          if (data.winScore) MP.lobbyWinScore = Number(data.winScore) || WIN_SCORE;
          if (data.theme && THEMES[data.theme]) MP.lobbyTheme = data.theme;
        }
        if (MP.isHost) {
          mpSend({
            t: 'lobby_cfg',
            winScore: MP.lobbyWinScore || WIN_SCORE,
            theme: MP.lobbyTheme || P.theme,
            name: MP.myName
          });
        }
        if (!MP.inMatch) {
          if (MPC) mpOpenReadyRoom();
          else if (MP.isHost) mpBeginMatch();
        }
        break;
      case 'lobby_cfg':
        if (!MP.isHost) {
          if (data.winScore) MP.lobbyWinScore = Number(data.winScore) || WIN_SCORE;
          if (data.theme && THEMES[data.theme]) {
            MP.lobbyTheme = data.theme;
            P.theme = data.theme;
            updateSettingsUI();
          }
        }
        if (data.name) MP.oppName = String(data.name).slice(0, 12);
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
          if (data.name) MP.oppName = String(data.name).slice(0, 12);
          if (data.winScore) MP.matchWinScore = Number(data.winScore) || WIN_SCORE;
          if (data.theme && THEMES[data.theme]) {
            MP.matchTheme = data.theme;
            P.theme = data.theme;
            updateSettingsUI();
          }
          mpBeginMatch(data.cd);
        }
        break;
      case 'paddle': {
        const span = Math.max(1, H - padH);
        MP.oppTargetY = typeof data.ny === 'number' ? data.ny * span : data.y;
        break;
      }
      case 'ball':
        // Host -> Guest: Yatay AYNALAMA (1 - nx) + RTT/2 İleri Projeksiyon + Yumuşak Uzlaştırma!
        if (!MP.isHost) {
          const th = THEMES[P.theme] || THEMES.cyber;
          const rxX = typeof data.nx === 'number' ? (1 - data.nx) * W : (W - data.x);
          const rxY = typeof data.ny === 'number' ? data.ny * H : data.y;
          const rxVx = typeof data.nvx === 'number' ? -data.nvx * W : -(data.vx || 0);
          const rxVy = typeof data.nvy === 'number' ? data.nvy * H : (data.vy || 0);
          const rxSp = data.sp || 0;

          // Guest açısından: sol skor = Guest (Host'un sr'si), sağ skor = Host (Host'un sl'si)
          const mySc = data.sr, oppSc = data.sl;
          const scoreChanged = (scL !== mySc || scR !== oppSc);
          if (scoreChanged) {
            if (mySc > scL) { scoreFlashL = 1; shakeT = 0.7; sfx.goalMe(); spawnGoalParticles(W - 22, rxY, th.padL); }
            if (oppSc > scR) { scoreFlashR = 1; shakeT = 0.7; sfx.score(); spawnGoalParticles(22, rxY, th.padR); }
            scL = mySc; scR = oppSc;
            MP.localBounceCooldown = 0;
            updateScoreUI();
            ball.x = rxX; ball.y = rxY;
            ball.vx = rxVx; ball.vy = rxVy;
            ball.speed = Math.hypot(rxVx, rxVy) || 6;
            ball.spin = rxSp;
            MP.ballFresh = true;
          } else {
            // Tek yönlü gecikme (pingMs/2) kadar topu ileri taşı
            const leadFrames = Math.min(6, Math.max(0, ((MP.pingMs || 0) * 0.5) / (1000 / 60)));
            let projX = rxX, projY = rxY, projVy = rxVy;
            if (leadFrames > 0.05 && data.st === 3) {
              projX += rxVx * leadFrames;
              projY += (projVy + rxSp * 0.14) * leadFrames;
              if (projY - ball.r < 4) { projY = 4 + ball.r + (4 + ball.r - projY); projVy = Math.abs(projVy); }
              else if (projY + ball.r > H - 4) { projY = (H - 4 - ball.r) - (projY - (H - 4 - ball.r)); projVy = -Math.abs(projVy); }
              if (rxVx < 0 && projX < padX1 + padW + ball.r && rxX >= padX1 + padW) {
                projX = padX1 + padW + ball.r;
              }
            }

            // Guest az önce kendi sol raketiyle yerel tahmin (prediction) yaptıysa ve Host paketi henüz eski yöndeyse ezme!
            if (MP.localBounceCooldown > 0 && rxVx < 0) {
              // Yerel vuruş korunuyor
            } else {
              const prevVx = ball.vx;
              if (prevVx > 0 && rxVx < 0) {
                hitGlowR = 1; right.recoil = 6;
                sfx.paddle(Math.hypot(rxVx, projVy) > 9.5);
                spawnShockwave(projX, projY, th.padR, 52);
              } else if (prevVx < 0 && rxVx > 0 && MP.localBounceCooldown <= 0) {
                hitGlowL = 1; left.recoil = 6;
                sfx.paddle(Math.hypot(rxVx, projVy) > 9.5);
                spawnShockwave(projX, projY, th.padL, 52);
              }

              const dist = Math.hypot(projX - ball.x, projY - ball.y);
              const sameDir = (ball.vx * rxVx) > 0;
              if (sameDir && dist < 46 && data.st === 3) {
                ball.x += (projX - ball.x) * 0.45;
                ball.y += (projY - ball.y) * 0.45;
              } else {
                ball.x = projX;
                ball.y = projY;
              }
              ball.vx = rxVx;
              ball.vy = projVy;
              ball.speed = Math.hypot(ball.vx, ball.vy) || 6;
              ball.spin = rxSp;
              MP.ballFresh = true;
            }
          }

          if (typeof data.st === 'number') {
            if (data.st === 3 && state === STATE.READY) state = STATE.PLAYING;
            else if (data.st === 1 && state === STATE.PLAYING) state = STATE.READY;
          }
        }
        break;
      case 'end':
        mpMatchEnd(data.sl, data.sr);
        break;
      case 'rematch':
        MP.oppRematch = true;
        if (MP.isHost && MP.rematchVotes > 0) mpBeginMatch();
        break;
    }
  });

  MP.conn.on('close', () => {
    MP.connected = false;
    if (!MP.peerLeftCleanly && MP.inMatch && (state === STATE.PLAYING || state === STATE.READY)) {
      mpEnterGraceReconnect();
      return;
    }
    if (state !== STATE.MENU) {
      mpCleanup();
      goMenu();
    }
  });
}

function mpStartMatchUI() {
  hide($('mp-grace-banner'));
  let bar = $('mp-opp-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'mp-opp-bar';
    bar.className = 'mp-opp-bar';
    document.getElementById('game-wrapper').appendChild(bar);
  }
  bar.innerHTML = `🏓 Hedef: <span class="opp-score">${currentWinScore}</span> <span id="mp-hud-ping" class="mp-ping-pill ping-idle">⚪ -- ms</span>`;
  if (MPC) MPC.updatePingDOM(MP.pingMs);
  show(bar);
}

let mpCountdown = 0;

function mpBeginMatch(guestCdFrames) {
  MP.inLobby = false;
  MP.inMatch = true;
  MP.reconnecting = false;
  MP.graceFrames = 0;
  MP.myReady = false;
  MP.oppReady = false;
  MP.scoredThisMatch = false;
  MP.localBounceCooldown = 0;
  hide($('mp-grace-banner'));

  const baseCd = 3 * 60;
  if (MP.isHost) {
    MP.matchWinScore = MP.lobbyWinScore || WIN_SCORE;
    MP.matchTheme = MP.lobbyTheme || P.theme || 'cyber';
    currentWinScore = MP.matchWinScore;
    mpSend({
      t: 'match',
      name: MP.myName,
      winScore: MP.matchWinScore,
      theme: MP.matchTheme,
      cd: baseCd
    });
    mpCountdown = baseCd;
  } else {
    currentWinScore = MP.matchWinScore || MP.lobbyWinScore || WIN_SCORE;
    mpCountdown = MPC ? MPC.compensatedCountdownFrames(guestCdFrames || baseCd, MP.pingMs) : baseCd;
  }

  layout(false);
  scL = 0; scR = 0;
  rally = 0; matchBestRally = 0;
  updateScoreUI();
  ballTrail = [];
  popParticles = [];
  shockwaves = [];
  wallRipples = [];
  flashAlpha = 0;
  show(hud);
  mpStartMatchUI();
  hide(menuScreen); hide(gameoverScreen); hide(pauseScreen);
  hide(mpScreen); hide(mpGameoverScreen);
  state = STATE.READY;
  resetBall(1);
  MP.oppTargetY = H / 2 - padH / 2;
  MP.rematchVotes = 0;
  MP.oppRematch = false;
}

function mpCountdownTick() {
  if (mpCountdown <= 0) return;
  mpCountdown--;
  if (mpCountdown === 0) {
    state = STATE.PLAYING;
    resetBall(serveTo);
  }
}

function mpBgTick() {
  if (!MP.connected) return;
  mpPingAcc++;
  if (mpPingAcc % 60 === 0) {
    mpSend({ t: '_ping', ts: Math.round(performance.now()) });
  }
}

function mpStepPhysics() {
  right.prevY = right.y;
  right.y += (MP.oppTargetY - right.y) * 0.45;
  right.vy = right.y - right.prevY;

  if (MP.isHost) {
    if (state === STATE.PLAYING) {
      stepBall();
      mpOnScoreCheck();
    }
    if (frames % 2 === 0) {
      mpSend({
        t: 'ball',
        nx: Math.round((ball.x / Math.max(1, W)) * 1000) / 1000,
        ny: Math.round((ball.y / Math.max(1, H)) * 1000) / 1000,
        nvx: Math.round((ball.vx / Math.max(1, W)) * 10000) / 10000,
        nvy: Math.round((ball.vy / Math.max(1, H)) * 10000) / 10000,
        vx: Math.round(ball.vx * 10) / 10,
        vy: Math.round(ball.vy * 10) / 10,
        sp: Math.round(ball.spin * 100) / 100,
        sl: scL, sr: scR,
        st: state === STATE.PLAYING ? 3 : 1
      });
    }
  } else if (state === STATE.PLAYING) {
    if (MP.localBounceCooldown > 0) MP.localBounceCooldown--;

    if (MP.ballFresh) {
      MP.ballFresh = false;
    } else {
      if (Math.abs(ball.spin) > 0.002) {
        ball.vy += ball.spin * 0.14;
        ball.spin *= 0.992;
      }
      ball.x += ball.vx;
      ball.y += ball.vy;
    }

    // Guest Yerel Duvar & Sol Raket Tahmini (0ms Gecikmesiz Vuruş Hissi!)
    const th = THEMES[P.theme] || THEMES.cyber;
    if (ball.y - ball.r < 4) {
      ball.y = 4 + ball.r;
      ball.vy = Math.abs(ball.vy);
      ball.squash = 0.65;
      wallRipples.push({ x: ball.x, y: 3, w: 12, color: th.wall, life: 22, maxLife: 22 });
      sfx.wall();
    } else if (ball.y + ball.r > H - 4) {
      ball.y = H - 4 - ball.r;
      ball.vy = -Math.abs(ball.vy);
      ball.squash = 0.65;
      wallRipples.push({ x: ball.x, y: H - 3, w: 12, color: th.wall, life: 22, maxLife: 22 });
      sfx.wall();
    }

    if (ball.vx < 0 && ball.x - ball.r <= padX1 + padW && ball.x - ball.r >= padX1 - 14) {
      if (ball.y + ball.r + 4 >= left.y && ball.y - ball.r - 4 <= left.y + padH) {
        ball.x = padX1 + padW + ball.r;
        const rel = Math.max(-1, Math.min(1, (ball.y - (left.y + padH / 2)) / (padH / 2)));
        const ang = rel * 1.02;
        const maxSpd = 14.2 * Math.max(0.85, W / 420);
        const sp = Math.min(maxSpd, (ball.speed || 6) + 0.32);
        ball.speed = sp;
        ball.vx = Math.cos(ang) * sp;
        ball.vy = Math.sin(ang) * sp;
        ball.spin = Math.max(-0.9, Math.min(0.9, left.vy * 0.055));
        ball.squash = 1.0;
        left.recoil = 6.5;
        hitGlowL = 1;
        MP.localBounceCooldown = 12;

        const isFast = sp > 9.5 || Math.abs(ball.spin) > 0.35;
        if (isFast) shakeT = 0.35;
        sfx.paddle(isFast);
        spawnShockwave(ball.x, ball.y, th.padL, isFast ? 72 : 48);
        spawnHitParticles(ball.x, ball.y, th.padL, 1, isFast ? 18 : 11);
      }
    }

    if (ball.squash > 0) ball.squash = Math.max(0, ball.squash - 0.12);
    ballTrail.push({ x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy });
    if (ballTrail.length > 18) ballTrail.shift();
  }
}

function mpOnScoreCheck() {
  if (scL >= currentWinScore || scR >= currentWinScore) {
    mpSend({ t: 'end', sl: scL, sr: scR });
    mpMatchEnd(scL, scR);
  }
}

function mpMatchEnd(finalL, finalR) {
  MP.inMatch = false;
  state = STATE.GAMEOVER;
  hide($('mp-opp-bar'));
  hide($('mp-grace-banner'));
  const my = MP.isHost ? finalL : finalR;
  const opp = MP.isHost ? finalR : finalL;
  $('mp-final-me').textContent = my;
  $('mp-final-opp').textContent = opp;
  $('mp-me-label').textContent = MP.myName || 'Sen';
  $('mp-opp-label').textContent = MP.oppName || 'Rakip';
  let txt;
  if (my > opp) {
    txt = '🏆 KAZANDIN!';
    if (!MP.scoredThisMatch) {
      MP.seriesMe++;
      P.wins = (P.wins || 0) + 1;
      persist();
      MP.scoredThisMatch = true;
    }
    sfx.win();
  } else if (my < opp) {
    txt = '💀 KAYBETTİN...';
    if (!MP.scoredThisMatch) { MP.seriesOpp++; MP.scoredThisMatch = true; }
    sfx.lose();
  } else {
    txt = '🤝 BERABERE!';
    MP.scoredThisMatch = true;
  }
  $('mp-result-text').textContent = txt;
  const serEl = $('mp-series-text');
  if (serEl) serEl.textContent = `🏅 Seri: ${MP.myName} ${MP.seriesMe} - ${MP.seriesOpp} ${MP.oppName}`;
  if (MPC) MPC.mountGameoverSwitcher(mpGameoverScreen, 'pong', () => MP.isHost && MP.connected, mpSwitchGame);
  show(mpGameoverScreen);
  hide(hud);
}

function mpLeave() {
  sfx.click();
  MP.peerLeftCleanly = true;
  mpSend({ t: '_leave' });
  if (MPC) MPC.clearParty();
  mpCleanup();
  hide(mpGameoverScreen);
  goMenu();
}

function goMenu() {
  state = STATE.MENU;
  hide(hud); hide(gameoverScreen); hide(pauseScreen); hide(mpScreen); hide(mpGameoverScreen);
  hide($('mp-opp-bar')); hide($('mp-grace-banner')); hide($('mp-ready-area'));
  updateSettingsUI();
  show(menuScreen);
}

let mpPadAcc = 0;
function mpPadTick() {
  if (!MP.connected) return;
  mpPadAcc++;
  if (mpPadAcc % 2 !== 0) return;
  const span = Math.max(1, H - padH);
  mpSend({ t: 'paddle', ny: Math.round((left.y / span) * 1000) / 1000, y: Math.round(left.y) });
}

// ---------- UI Olay Bağlantıları ----------
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
  hide(mpScreen);
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

$('start-btn').addEventListener('click', () => { sfx.click(); startGame(); });
$('retry-btn').addEventListener('click', () => { sfx.click(); startGame(); });
$('home-btn').addEventListener('click', () => { sfx.click(); goMenu(); });
$('quit-btn').addEventListener('click', () => { sfx.click(); goMenu(); });
$('back-to-hub-btn').addEventListener('click', () => { sfx.click(); location.href = 'index.html'; });
$('resume-btn').addEventListener('click', () => { sfx.click(); togglePause(); });
$('pause-btn').addEventListener('click', togglePause);

// Arena Tema & Zorluk butonları
document.querySelectorAll('#theme-tabs .theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    sfx.click();
    P.theme = btn.dataset.theme;
    updateSettingsUI();
    persist();
  });
});

document.querySelectorAll('#diff-tabs .ai-diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    sfx.click();
    P.difficulty = btn.dataset.diff;
    updateSettingsUI();
    persist();
  });
});

// Mobil Kontrol Modu & Hassasiyet Sürgüsü (Menü + Duraklat Ekranı)
function toggleCtrlMode() {
  sfx.click();
  P.ctrlMode = P.ctrlMode === 'trackpad' ? 'direct' : 'trackpad';
  updateSettingsUI();
  persist();
}
if (ctrlModeBtn) ctrlModeBtn.addEventListener('click', toggleCtrlMode);
if (pauseCtrlBtn) pauseCtrlBtn.addEventListener('click', toggleCtrlMode);

function onSensInput(val) {
  P.sensitivity = Math.max(0.6, Math.min(2.2, Number(val) / 100));
  updateSettingsUI();
  persist();
}
if (sensRange) sensRange.addEventListener('input', () => onSensInput(sensRange.value));
if (pauseSensRange) pauseSensRange.addEventListener('input', () => onSensInput(pauseSensRange.value));

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

// =====================================================
//          ULTRA GRAFİK MOTORU (60 FPS CANVAS)
// =====================================================
let gridPulse = 0;

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawUltraPaddle(x, y, mainCol, secCol, glow, recoilDir, trailArr) {
  const rx = x + recoilDir;
  const r = padW / 2;

  // 1) Hareket Hayalet İzi (Motion Afterimage)
  for (let i = 0; i < trailArr.length; i++) {
    const tr = trailArr[i];
    ctx.save();
    ctx.globalAlpha = tr.a * ((i + 1) / trailArr.length) * 0.55;
    ctx.fillStyle = mainCol;
    roundRect(rx, tr.y, padW, padH, r);
    ctx.fill();
    ctx.restore();
  }

  // 2) Geniş Dış Plazma Halesi
  ctx.save();
  const aura = ctx.createRadialGradient(rx + padW / 2, y + padH / 2, 4, rx + padW / 2, y + padH / 2, padH * 0.65);
  aura.addColorStop(0, mainCol);
  aura.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.16 + glow * 0.28;
  ctx.fillStyle = aura;
  ctx.fillRect(rx - 32, y - 24, padW + 64, padH + 48);
  ctx.restore();

  // 3) Ana Gövde (3D Silindirik Degrade + Neon Gölge)
  ctx.save();
  ctx.shadowColor = mainCol;
  ctx.shadowBlur = 16 + glow * 26;
  const g = ctx.createLinearGradient(rx, y, rx + padW, y);
  g.addColorStop(0, secCol);
  g.addColorStop(0.32, mainCol);
  g.addColorStop(0.52, '#ffffff');
  g.addColorStop(0.75, mainCol);
  g.addColorStop(1, secCol);
  ctx.fillStyle = g;
  roundRect(rx, y, padW, padH, r);
  ctx.fill();
  ctx.restore();

  // 4) Krom Metalik Uç Kapaklar (End-Caps)
  const capH = Math.min(14, padH * 0.12);
  ctx.fillStyle = 'rgba(15, 25, 40, 0.72)';
  ctx.fillRect(rx + 1, y + capH, padW - 2, 2.5);
  ctx.fillRect(rx + 1, y + padH - capH - 2.5, padW - 2, 2.5);

  // 5) İç Plazma Enerji Çekirdeği (Nabızlı Merkez Şerit)
  const corePulse = 0.65 + 0.35 * Math.sin(gridPulse * 4);
  ctx.save();
  ctx.globalAlpha = corePulse;
  ctx.fillStyle = '#ffffff';
  roundRect(rx + padW * 0.32, y + capH + 5, padW * 0.36, padH - (capH + 5) * 2, 2);
  ctx.fill();
  ctx.restore();

  // 6) Çarpma Anında Beyaz Şok Parlaması
  if (glow > 0.25) {
    ctx.save();
    ctx.globalAlpha = (glow - 0.25) * 0.95;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    roundRect(rx - 3, y - 3, padW + 6, padH + 6, r + 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawBallAndRibbon(bx, by, bvx, bvy, bspeed, bspin, bsquash, trail, th) {
  const speedNorm = Math.max(0, Math.min(1, (bspeed - 6) / 7.5));
  const c0 = th.ballGlow, c1 = th.fastGlow;
  const gr = Math.round(c0[0] + (c1[0] - c0[0]) * speedNorm);
  const gg = Math.round(c0[1] + (c1[1] - c0[1]) * speedNorm);
  const gb = Math.round(c0[2] + (c1[2] - c0[2]) * speedNorm);

  // 1) Akışkan Kurdele Kuyruk (Smooth Tapered Ribbon Trail)
  if (trail.length > 2) {
    for (let i = 1; i < trail.length; i++) {
      const p0 = trail[i - 1], p1 = trail[i];
      const t = i / trail.length;
      ctx.strokeStyle = `rgba(${gr},${gg},${gb},${t * (0.28 + 0.38 * speedNorm)})`;
      ctx.lineWidth = Math.max(1.5, ball.r * 1.75 * t);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
  }

  // 2) Falso (Spin) Döner Enerji Halkaları
  if (Math.abs(bspin) > 0.08) {
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(frames * (bspin > 0 ? 0.28 : -0.28));
    ctx.strokeStyle = `rgba(255, 215, 0, ${Math.min(0.85, Math.abs(bspin))})`;
    ctx.lineWidth = 2;
    for (let k = 0; k < 2; k++) {
      ctx.beginPath();
      ctx.arc(0, 0, ball.r + 5, k * Math.PI, k * Math.PI + 1.3);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 3) Radyal Top Aydınlatması & Çekirdek (Hız Esnemesi + Çarpma Yassılaşması)
  ctx.save();
  ctx.translate(bx, by);
  const moveAng = Math.atan2(bvy, bvx);
  ctx.rotate(moveAng);

  const stretch = 1 + speedNorm * 0.24 - bsquash * 0.28;
  const squash  = 1 / Math.max(0.72, stretch);
  ctx.scale(stretch, squash);

  const bglow = ctx.createRadialGradient(0, 0, 1, 0, 0, ball.r * 4.4);
  bglow.addColorStop(0, `rgba(255,255,255,${0.65 + 0.25 * speedNorm})`);
  bglow.addColorStop(0.35, `rgba(${gr},${gg},${gb},0.42)`);
  bglow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bglow;
  ctx.beginPath();
  ctx.arc(0, 0, ball.r * 4.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = `rgb(${gr},${gg},${gb})`;
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, ball.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Parlak İç Çekirdek Halkası
  ctx.strokeStyle = `rgba(${gr},${gg},${gb},0.85)`;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, ball.r * 0.62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function draw() {
  const th = THEMES[P.theme] || THEMES.cyber;
  gridPulse += 0.022;

  ctx.save();
  if (shakeT > 0) {
    shakeT = Math.max(0, shakeT - 0.045);
    const m = shakeT * 8;
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
  }

  // --- 1) Derinlikli Arena Zemini ---
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, th.bg0);
  bg.addColorStop(0.5, th.bg1);
  bg.addColorStop(1, th.bg2);
  ctx.fillStyle = bg;
  ctx.fillRect(-12, -12, W + 24, H + 24);

  // Aktif top konumu (menüdeyse demo topu)
  const activeBX = state === STATE.MENU ? demoBall.x : ball.x;
  const activeBY = state === STATE.MENU ? demoBall.y : ball.y;
  const activeSpd = state === STATE.MENU ? 7.2 : ball.speed;

  // --- 2) Dinamik Top Zemin Aydınlatması (Real-Time Point Light) ---
  const lightR = W * 0.62;
  const c0 = th.ballGlow;
  const floorGlow = ctx.createRadialGradient(activeBX, activeBY, 8, activeBX, activeBY, lightR);
  floorGlow.addColorStop(0, `rgba(${c0[0]},${c0[1]},${c0[2]},0.16)`);
  floorGlow.addColorStop(0.5, `rgba(${c0[0]},${c0[1]},${c0[2]},0.05)`);
  floorGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = floorGlow;
  ctx.fillRect(0, 0, W, H);

  // --- 3) Hareketli Enerji Izgarası & Buz Çizikleri ---
  ctx.strokeStyle = th.grid;
  ctx.lineWidth = 1;
  const gs = 42;
  const gOff = (gridPulse * 9) % gs;
  for (let x = 0; x < W + gs; x += gs) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = -gs + gOff; y < H + gs; y += gs) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  if (th.iceScratches) {
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 6; i++) {
      const sy = ((i * 117) % (H - 80)) + 40;
      ctx.beginPath();
      ctx.moveTo(40 + (i * 53) % 140, sy);
      ctx.lineTo(130 + (i * 67) % 190, sy + 18);
      ctx.stroke();
    }
  }

  // --- 4) Süzülen Ortam Işık Zerrecikleri (Ambient Motes) ---
  ambientMotes.forEach(m => {
    m.x += m.vx; m.y += m.vy; m.ph += 0.03;
    if (m.y < 0) m.y = 1;
    if (m.x < 0) m.x = 1;
    if (m.x > 1) m.x = 0;
    ctx.globalAlpha = 0.18 + 0.25 * Math.abs(Math.sin(m.ph));
    ctx.fillStyle = th.wall;
    ctx.beginPath();
    ctx.arc(m.x * W, m.y * H, m.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // --- 5) Döner Siber Merkez Halkası & Orta Çizgi ---
  const ringR = W * 0.17;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.strokeStyle = th.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, ringR, 0, Math.PI * 2);
  ctx.stroke();

  // Zıt yönlü dönen dış enerji yayları
  ctx.rotate(gridPulse * 0.45);
  ctx.setLineDash([18, 14]);
  ctx.strokeStyle = th.grid.replace('0.08', '0.28').replace('0.06', '0.24');
  ctx.beginPath();
  ctx.arc(0, 0, ringR + 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Holografik Ralli Sayacı (Saha ortasında)
  if (state === STATE.PLAYING && rally >= 2) {
    ctx.save();
    ctx.font = '900 56px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.16, 0.07 + rally * 0.008)})`;
    ctx.fillText(String(rally), W / 2, H / 2 + 20);
    ctx.font = '800 10px "Segoe UI", Arial';
    ctx.fillText('RALLİ', W / 2, H / 2 + 36);
    ctx.restore();
  }

  // Orta kesikli lazer çizgisi
  ctx.save();
  ctx.strokeStyle = th.line;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([12, 12]);
  ctx.beginPath();
  ctx.moveTo(W / 2, 10);
  ctx.lineTo(W / 2, H - 10);
  ctx.stroke();
  ctx.restore();
  ctx.setLineDash([]);

  // Kale dikey lazer sınır çizgileri (sol & sağ)
  ctx.strokeStyle = `${th.padL}26`;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(8, 6); ctx.lineTo(8, H - 6); ctx.stroke();
  ctx.strokeStyle = `${th.padR}26`;
  ctx.beginPath(); ctx.moveTo(W - 8, 6); ctx.lineTo(W - 8, H - 6); ctx.stroke();

  // --- 6) Gol Flaşları ---
  if (scoreFlashL > 0) {
    scoreFlashL = Math.max(0, scoreFlashL - 0.02);
    const g = ctx.createLinearGradient(0, 0, W * 0.55, 0);
    g.addColorStop(0, `${th.padL}66`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W * 0.55, H);
  }
  if (scoreFlashR > 0) {
    scoreFlashR = Math.max(0, scoreFlashR - 0.02);
    const g = ctx.createLinearGradient(W, 0, W * 0.45, 0);
    g.addColorStop(0, `${th.padR}66`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(W * 0.45, 0, W * 0.55, H);
  }

  // --- 7) Üst/Alt Neon Duvarlar & Çarpma Dalgaları ---
  ctx.save();
  ctx.shadowColor = th.wall;
  ctx.shadowBlur = 12;
  ctx.fillStyle = th.wall;
  ctx.fillRect(0, 0, W, 4);
  ctx.fillRect(0, H - 4, W, 4);
  ctx.restore();

  wallRipples.forEach(wr => {
    wr.w += 9;
    wr.life--;
    ctx.save();
    ctx.globalAlpha = wr.life / wr.maxLife;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(wr.x - wr.w / 2, wr.y - 2, wr.w, 5);
    ctx.restore();
  });
  wallRipples = wallRipples.filter(wr => wr.life > 0);

  // --- 8) Şok Halkaları (Impact Shockwaves) ---
  shockwaves.forEach(sw => {
    sw.r += (sw.maxR - sw.r) * 0.22;
    sw.life--;
    ctx.save();
    ctx.globalAlpha = (sw.life / sw.maxLife) * 0.75;
    ctx.strokeStyle = sw.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
  shockwaves = shockwaves.filter(sw => sw.life > 0);

  // --- 9) Raketler & Top (Menüdeyken Canlı Demo, Oyundayken Gerçek Maç!) ---
  if (state === STATE.MENU) {
    drawUltraPaddle(padX1, demoPadL, th.padL, th.padL2, 0.2, 0, []);
    drawUltraPaddle(padX2, demoPadR, th.padR, th.padR2, 0.2, 0, []);
    drawBallAndRibbon(demoBall.x, demoBall.y, demoBall.vx, demoBall.vy, activeSpd, demoBall.spin, 0, ballTrail, th);
  } else {
    drawUltraPaddle(padX1, left.y, th.padL, th.padL2, hitGlowL, -left.recoil, left.trail);
    drawUltraPaddle(padX2, right.y, th.padR, th.padR2, hitGlowR, right.recoil, right.trail);
    if (hitGlowL > 0) hitGlowL = Math.max(0, hitGlowL - 0.06);
    if (hitGlowR > 0) hitGlowR = Math.max(0, hitGlowR - 0.06);

    if (state === STATE.PLAYING || state === STATE.READY || state === STATE.PAUSED) {
      drawBallAndRibbon(ball.x, ball.y, ball.vx, ball.vy, ball.speed, ball.spin, ball.squash, ballTrail, th);
    }
  }

  // --- 10) Kıvılcım Partikülleri ---
  popParticles.forEach(pt => {
    const a = Math.min(1, pt.life / (pt.maxLife || 24));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // --- 11) Mobil Dokunma Halkası (Zarif Trackpad Geri Bildirimi) ---
  if (touchIndicator.alpha > 0.02 && (state === STATE.PLAYING || state === STATE.READY)) {
    ctx.save();
    ctx.globalAlpha = touchIndicator.alpha * 0.35;
    ctx.strokeStyle = th.padL;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(touchIndicator.x, touchIndicator.y, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    if (!touchIndicator.active) touchIndicator.alpha *= 0.88;
  }

  // --- 12) Servis & MP Geri Sayımları ---
  if (!MP.connected && !MP.reconnecting && state === STATE.READY && serveCountdown > 0) {
    const n = Math.ceil(serveCountdown / 60);
    const phase = (serveCountdown % 60) / 60;
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.65 * phase;
    ctx.translate(W / 2, H / 2);
    ctx.scale(0.8 + 0.4 * phase, 0.8 + 0.4 * phase);
    ctx.font = '900 72px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeText(String(n), 0, 24);
    ctx.fillStyle = '#ffd700';
    ctx.fillText(String(n), 0, 24);
    ctx.restore();
  }

  if ((MP.connected || MP.reconnecting) && mpCountdown > 0) {
    const n = Math.ceil(mpCountdown / 60);
    const phase = (mpCountdown % 60) / 60;
    ctx.save();
    ctx.globalAlpha = 0.4 + 0.6 * phase;
    ctx.translate(W / 2, H * 0.35);
    ctx.scale(0.8 + 0.5 * phase, 0.8 + 0.5 * phase);
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
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText('Maç eşzamanlı başlayacak!', W / 2, H * 0.35 + 32);
    ctx.textAlign = 'left';
  }

  // MP Oyuncu İsim Plakaları
  if ((MP.connected || MP.reconnecting) && (state === STATE.PLAYING || state === STATE.READY)) {
    ctx.font = '800 11px "Segoe UI", Arial';
    ctx.textAlign = 'left';
    ctx.fillStyle = th.padL;
    ctx.fillText(MP.myName || 'SEN', padX1, H - 14);
    ctx.textAlign = 'right';
    ctx.fillStyle = th.padR;
    ctx.fillText(MP.oppName || 'RAKİP', padX2 + padW, H - 14);
    ctx.textAlign = 'left';
  }

  // İnce Sinematik Vinyet & Flaş
  if (flashAlpha > 0) {
    flashAlpha = Math.max(0, flashAlpha - 0.04);
    ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
    ctx.fillRect(-12, -12, W + 24, H + 24);
  }
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.40, W / 2, H / 2, H * 0.76);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,4,14,0.46)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  ctx.restore();
}

// ---------- Menü Arka Plan Demo Simülasyonu ----------
function stepMenuDemo() {
  demoBall.x += demoBall.vx;
  demoBall.y += demoBall.vy;
  if (demoBall.y < 14 || demoBall.y > H - 14) demoBall.vy = -demoBall.vy;
  if (demoBall.x < padX1 + padW + 8) { demoBall.x = padX1 + padW + 8; demoBall.vx = Math.abs(demoBall.vx); }
  if (demoBall.x > padX2 - 8) { demoBall.x = padX2 - 8; demoBall.vx = -Math.abs(demoBall.vx); }
  demoPadL += ((demoBall.y - padH / 2) - demoPadL) * 0.12;
  demoPadR += ((demoBall.y - padH / 2) - demoPadR) * 0.12;
  demoPadL = Math.max(10, Math.min(H - padH - 10, demoPadL));
  demoPadR = Math.max(10, Math.min(H - padH - 10, demoPadR));
  ballTrail.push({ x: demoBall.x, y: demoBall.y, vx: demoBall.vx, vy: demoBall.vy });
  if (ballTrail.length > 14) ballTrail.shift();
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
    mpBgTick();

    if (MP.reconnecting) {
      mpGraceTick();
      continue;
    }

    if (state === STATE.MENU) {
      stepMenuDemo();
    } else if (state === STATE.PLAYING) {
      if (MP.connected) {
        humanMove();
        mpStepPhysics();
        mpPadTick();
      } else {
        humanMove();
        aiMove();
        stepBall();
      }
    } else if (state === STATE.READY) {
      humanMove();
      if (MP.connected) {
        if (MP.isHost) {
          if (mpCountdown > 0) mpCountdownTick();
          else if (serveCountdown > 0) {
            serveCountdown--;
            if (serveCountdown === 0) state = STATE.PLAYING;
          } else state = STATE.PLAYING;
          mpStepPhysics();
          mpPadTick();
        } else {
          if (mpCountdown > 0) {
            mpCountdown--;
            if (mpCountdown === 0 && state === STATE.READY) state = STATE.PLAYING;
          }
          right.prevY = right.y;
          right.y += (MP.oppTargetY - right.y) * 0.45;
          right.vy = right.y - right.prevY;
          mpPadTick();
        }
      } else {
        if (serveCountdown > 0) {
          serveCountdown--;
          if (serveCountdown === 0) state = STATE.PLAYING;
        } else {
          state = STATE.PLAYING;
        }
      }
    }

    popParticles.forEach(pt => { pt.x += pt.vx; pt.y += pt.vy; pt.vx *= 0.96; pt.vy *= 0.96; pt.life--; });
    popParticles = popParticles.filter(pt => pt.life > 0);
  }

  draw();
  requestAnimationFrame(loop);
}

// ---------- Başlat ----------
function init() {
  initMotes();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  layout(false);
  updateSettingsUI();
  ensureMusicLoop();

  // 1) Oyunlar arası ortak oda taşıma (sessionStorage Parti Oturumu)
  const party = MPC ? MPC.loadParty() : null;
  if (party && party.autoConnect && (!party.targetGame || party.targetGame === 'pong')) {
    MPC.saveParty({ ...party, autoConnect: false });
    MP.seriesMe = party.seriesMe || 0;
    MP.seriesOpp = party.seriesOpp || 0;
    if (party.myName) P.playerName = party.myName;
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
