"use strict";

/* =====================================================
   PONG — Oyun Salonu'nun 3. oyunu
   Tek kişi (AI) + Çevrimiçi Düello (PeerJS)
   Host topu simüle eder, guest raketini gönderir.
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
const hud = $('hud'), menuScreen = $('menu-screen'), gameoverScreen = $('gameover-screen');
const pauseScreen = $('pause-screen'), tapHint = $('tap-hint');
const newRecord = $('new-record');
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

// ---------- Kayıt ----------
const STORAGE_KEY = 'oyun-salonu-v2';

function defaultSaved() { return { difficulty: 'normal', bestDiff: 0, games: 0, wins: 0 }; }

function loadSaved() {
  const d = defaultSaved();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s.pong && typeof s.pong === 'object') {
        Object.keys(d).forEach(k => { if (s.pong[k] !== undefined) d[k] = s.pong[k]; });
      }
    }
  } catch (e) {}
  return d;
}

let saved = loadSaved();
const P = saved;

function persist() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let root = {};
    try { root = JSON.parse(raw) || {}; } catch (e) {}
    if (typeof root.pong !== 'object' || !root.pong) root.pong = {};
    Object.assign(root.pong, saved);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
  } catch (e) {}
}

// ---------- Sabitler ----------
const AI = { easy: 0.55, normal: 0.75, hard: 0.92 };   // takip hızı çarpanı
const WIN_SCORE = 11;

// ---------- Durum ----------
const STATE = { MENU: 0, READY: 1, SERVE: 2, PLAYING: 3, GAMEOVER: 4, PAUSED: 5 };
let state = STATE.MENU;

// saha (dikey pong): sol raket = sen, sağ = rakip
let padW, padH, padX1, padX2;
let left = { y: 0, target: 0 };    // senin raketi
let right = { y: 0, target: 0 };   // rakip raketi
let ball = { x: 0, y: 0, vx: 0, vy: 0, r: 8, speed: 7 };
let scL = 0, scR = 0;              // skorlar
let serveTo = 1;                   // 1 = soldan (sen) servis
let frames = 0;
let flashAlpha = 0;
let shakeT = 0;
let ballTrail = [];                // top iz efekti
let popParticles = [];
let hitGlowL = 0, hitGlowR = 0;    // raket çarpma ışıması
let scoreFlashL = 0, scoreFlashR = 0;

// ---------- Saha geometrisi ----------
function layout() {
  padW = Math.max(10, W * 0.028);
  padH = H * 0.18;
  padX1 = W * 0.07;
  padX2 = W * 0.93 - padW;
  left.y = H / 2 - padH / 2;
  right.y = H / 2 - padH / 2;
}

// ---------- Ses ----------
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
const sfx = {
  paddle: () => beep(620, 0.06, 'square', 0.14),
  wall:   () => beep(420, 0.05, 'square', 0.10),
  score:  () => { beep(330, 0.12, 'sawtooth', 0.16); setTimeout(() => beep(220, 0.2, 'sawtooth', 0.14), 100); },
  win:    () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.15, 'sine', 0.15), i * 120)); },
  lose:   () => { [400, 320, 240, 160].forEach((f, i) => setTimeout(() => beep(f, 0.18, 'triangle', 0.15), i * 140)); }
};

// ---------- Top ----------
function resetBall(dirSide) {
  ball.x = W / 2;
  ball.y = H / 2;
  ball.speed = 7;
  const ang = (Math.random() - 0.5) * 0.7; // ±40°
  ball.vx = Math.cos(ang) * ball.speed * dirSide;
  ball.vy = Math.sin(ang) * ball.speed;
  serveTo = dirSide;
}

function serve() {
  state = STATE.PLAYING;
  resetBall(serveTo);
}

// ---------- Oyun başlat ----------
function startGame() {
  layout();
  scL = 0; scR = 0;
  updateScoreUI();
  ballTrail = [];
  popParticles = [];
  flashAlpha = 0;
  shakeT = 0;
  show(hud);
  hide(menuScreen); hide(gameoverScreen); hide(pauseScreen);
  hide($('mp-screen')); hide($('mp-gameover-screen'));
  state = STATE.READY;
  serveCountdown = 3 * 60;
  resetBall(1);
}

let serveCountdown = 0;

function updateScoreUI() {
  $('sc-left').textContent = scL;
  $('sc-right').textContent = scR;
}

// ---------- Fizik ----------
function stepBall() {
  // top hareketi
  ball.x += ball.vx;
  ball.y += ball.vy;
  ballTrail.push({ x: ball.x, y: ball.y });
  if (ballTrail.length > 14) ballTrail.shift();

  // üst/alt duvar
  if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); sfx.wall(); }
  if (ball.y + ball.r > H) { ball.y = H - ball.r; ball.vy = -Math.abs(ball.vy); sfx.wall(); }

  // sol raket (senin)
  if (ball.vx < 0 && ball.x - ball.r < padX1 + padW && ball.x - ball.r > padX1 - 14) {
    if (ball.y + ball.r > left.y && ball.y - ball.r < left.y + padH) {
      ball.x = padX1 + padW + ball.r;
      ball.vx = Math.abs(ball.vx);
      // açı: raketin neresinden sekti
      const rel = (ball.y - (left.y + padH / 2)) / (padH / 2);
      const maxAng = 1.05; // ~60°
      const ang = rel * maxAng;
      const sp = Math.min(16, ball.speed + 0.35); // hızlanır
      ball.speed = sp;
      ball.vx = Math.cos(ang) * sp;
      ball.vy = Math.sin(ang) * sp;
      hitGlowL = 1;
      sfx.paddle();
      spawnHitParticles(ball.x, ball.y, '#00ffcc');
    }
  }

  // sağ raket (rakip / AI)
  if (ball.vx > 0 && ball.x + ball.r > padX2 && ball.x + ball.r < padX2 + padW + 14) {
    if (ball.y + ball.r > right.y && ball.y - ball.r < right.y + padH) {
      ball.x = padX2 - ball.r;
      ball.vx = -Math.abs(ball.vx);
      const rel = (ball.y - (right.y + padH / 2)) / (padH / 2);
      const maxAng = 1.05;
      const ang = rel * maxAng;
      const sp = Math.min(16, ball.speed + 0.35);
      ball.speed = sp;
      ball.vx = -Math.cos(ang) * sp;
      ball.vy = Math.sin(ang) * sp;
      hitGlowR = 1;
      sfx.paddle();
      spawnHitParticles(ball.x, ball.y, '#ff5252');
    }
  }

  // gol (sağdan çıktı = sen kazandın)
  if (ball.x - ball.r > W) { scoreL(); return; }
  if (ball.x + ball.r < 0) { scoreR(); return; }
}

function scoreL() {
  scL++;
  scoreFlashL = 1;
  sfx.score();
  spawnGoalParticles(W - 30, H / 2, '#00ffcc');
  updateScoreUI();
  if (scL >= WIN_SCORE) { endGame(true); return; }
  state = STATE.READY;
  serveCountdown = 60; // 1 sn
  serveTo = -1;        // rakibe servis
  resetBall(-1);       // TOPU HEMEN MERKEZE AL — bug düzeltmesi
}

function scoreR() {
  scR++;
  scoreFlashR = 1;
  sfx.score();
  spawnGoalParticles(30, H / 2, '#ff5252');
  updateScoreUI();
  if (scR >= WIN_SCORE) { endGame(false); return; }
  state = STATE.READY;
  serveCountdown = 60;
  serveTo = 1;
  resetBall(1);        // TOPU HEMEN MERKEZE AL — bug düzeltmesi
}

function endGame(won) {
  state = STATE.GAMEOVER;

  // MP: düello sonu akışı — host sonu iletir
  if (MP.connected) {
    if (MP.isHost) {
      mpSend({ t: 'end', sl: scL, sr: scR });
    }
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

  $('go-title').textContent = won ? '🏆 KAZANDIN!' : '💀 KAYBETTİN...';
  $('final-score').textContent = `${scL} : ${scR}`;
  $('best-score-go').textContent = P.bestDiff;
  if (isRecord) show(newRecord); else hide(newRecord);
  setTimeout(() => { show(gameoverScreen); hide(hud); }, 700);
}

function spawnHitParticles(x, y, color) {
  for (let i = 0; i < 8; i++) {
    popParticles.push({
      x, y,
      vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4,
      life: 20, r: 1.5 + Math.random() * 2,
      color: color === '#00ffcc' ? 'rgba(0,255,204,0.9)' : 'rgba(255,82,82,0.9)'
    });
  }
}

function spawnGoalParticles(x, y, color) {
  for (let i = 0; i < 22; i++) {
    popParticles.push({
      x, y,
      vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.5) * 7,
      life: 30, r: 2 + Math.random() * 3,
      color: color === '#00ffcc' ? 'rgba(0,255,204,0.9)' : 'rgba(255,82,82,0.9)'
    });
  }
}

// ---------- AI ----------
function aiMove() {
  const skill = AI[P.difficulty || 'normal'] || AI.normal;
  // topa göre hedef + hafif tahmin
  let target = H / 2;
  if (ball.vx > 0) {
    // topu tahmin et (yansımalı)
    let py = ball.y;
    let px = ball.x;
    let vx = ball.vx, vy = ball.vy;
    while (px < padX2 && py > 0 && py < H) {
      px += vx * 4; py += vy * 4;
      if (py < 0 || py > H) vy = -vy;
    }
    target = py - padH / 2;
  } else {
    target = H / 2 - padH / 2 + Math.sin(frames * 0.03) * 30; // beklemede salınım
  }
  const maxSpeed = 6.5 * skill;
  const dy = target - right.y;
  right.y += Math.max(-maxSpeed, Math.min(maxSpeed, dy * 0.25));
}

// ---------- Girdiler ----------
const keys = {};
document.addEventListener('keydown', e => {
  if (['ArrowUp','ArrowDown','Space'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;

  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (state === STATE.PLAYING || state === STATE.PAUSED) togglePause();
    return;
  }
  if (e.code === 'Enter' && state === STATE.GAMEOVER) { startGame(); return; }
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

// dokunmatik / fare: raket kontrolü
let dragY = null;
function pointerToY(clientY) {
  const rect = canvas.getBoundingClientRect();
  return clientY - rect.top;
}
canvas.addEventListener('touchstart', e => { e.preventDefault(); dragY = pointerToY(e.touches[0].clientY); left.target = dragY - padH / 2; }, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  left.target = pointerToY(e.touches[0].clientY) - padH / 2;
}, { passive: false });
canvas.addEventListener('mousedown', e => { dragY = e.clientY; left.target = pointerToY(e.clientY) - padH / 2; });
canvas.addEventListener('mousemove', e => { if (e.buttons === 1 || dragY !== null) left.target = pointerToY(e.clientY) - padH / 2; });
canvas.addEventListener('mouseup', () => { dragY = null; });

function humanMove() {
  const sp = 9;
  if (keys['ArrowUp'] || keys['KeyW']) left.target -= sp;
  if (keys['ArrowDown'] || keys['KeyS']) left.target += sp;
  left.target = Math.max(0, Math.min(H - padH, left.target));
  // süzülmeli takip
  left.y += (left.target - left.y) * 0.35;
}

function togglePause() {
  if (state === STATE.PLAYING || state === STATE.READY) {
    state = STATE.PAUSED;
    show(pauseScreen);
  } else if (state === STATE.PAUSED) {
    state = STATE.PLAYING;
    hide(pauseScreen);
  }
}

// =====================================================
//            ÇEVRİMİÇİ DÜELLO (PeerJS) — Pong
// Host topu simüle eder ve gönderir; herkes kendi
// raketini yönetir. 11 puana ulaşan kazanır.
// =====================================================
const MP = {
  peer: null, conn: null,
  isHost: false, connected: false,
  roomCode: '', oppScore: 0, myScore: 0,
  oppY: 0, oppReady: false,
  rematchVotes: 0, oppRematch: false
};

const mpScreen = $('mp-screen'), mpGameoverScreen = $('mp-gameover-screen');

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
  if (MP.conn && MP.connected) { try { MP.conn.send(data); } catch (e) {} }
}

function mpOpenUI() {
  show(mpScreen);
  hide(menuScreen);
  $('mp-error').textContent = '';
  show($('mp-btn-row'));
  hide($('mp-host-area'));
  hide($('mp-join-area'));
  $('mp-join-status').textContent = '';
  $('mp-code-input').value = '';
}

function mpHost() {
  hide($('mp-btn-row'));
  show($('mp-host-area'));
  $('mp-room-code').textContent = '...';
  $('mp-wait-text').textContent = 'Sunucuya bağlanılıyor...';

  MP.roomCode = mpMakeRoomCode();
  MP.isHost = true;

  MP.peer = new Peer('pong-' + MP.roomCode, { debug: 1 });

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

function mpJoin() {
  hide($('mp-btn-row'));
  show($('mp-join-area'));
  $('mp-join-status').textContent = '';
}

function mpJoinConfirm() {
  const code = $('mp-code-input').value.trim().toUpperCase();
  if (code.length !== 5) { $('mp-join-status').textContent = '5 haneli kod gir!'; return; }
  $('mp-join-status').textContent = 'Bağlanılıyor...';
  MP.roomCode = code;
  MP.isHost = false;

  MP.peer = new Peer(null, { debug: 1 });
  MP.peer.on('open', () => {
    MP.conn = MP.peer.connect('pong-' + code, { reliable: true });
    setupConn();
  });
  MP.peer.on('error', err => {
    $('mp-join-status').textContent = 'Hata: ' + (err && err.type === 'peer-unavailable' ? 'oda bulunamadı!' : (err.type || 'bilinmiyor'));
  });
}

let mpHelloFromGuest = false;

function setupConn() {
  MP.conn.on('open', () => {
    MP.connected = true;
    mpSend({ t: 'hello' });
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
        if (MP.isHost && !mpHelloFromGuest) {
          mpHelloFromGuest = true;
          mpBeginMatch();
        }
        break;
      case 'match':
        if (!MP.isHost) {
          MP.connected = true;
          mpBeginMatch();
        }
        break;
      case 'paddle':
        // rakibin raket konumu (onun sol raketinin y'si)
        MP.oppY = data.y;
        MP.oppReady = true;
        break;
      case 'ball':
        // host -> guest: top durumu + skorlar + state
        if (!MP.isHost) {
          ball.x = data.x; ball.y = data.y;
          ball.vx = data.vx; ball.vy = data.vy;
          if (scL !== data.sl || scR !== data.sr) {
            // hangi taraf gol attı?
            if (data.sl > scL) { scoreFlashL = 1; sfx.score(); }
            if (data.sr > scR) { scoreFlashR = 1; sfx.score(); }
            scL = data.sl; scR = data.sr;
            updateScoreUI();
          }
          // state senkronu: host PLAYING ise guest de PLAYING
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
    if (state !== STATE.MENU) {
      mpCleanup();
      goMenu();
    }
  });
}

// ---------- Maç akışı ----------
let mpCountdown = 0;

function mpBeginMatch() {
  if (MP.isHost) mpSend({ t: 'match' });
  layout();
  scL = 0; scR = 0;
  updateScoreUI();
  ballTrail = [];
  popParticles = [];
  flashAlpha = 0;
  show(hud);
  hide(menuScreen); hide(gameoverScreen); hide(pauseScreen);
  hide(mpScreen); hide(mpGameoverScreen);
  state = STATE.READY;
  mpCountdown = 3 * 60;
  resetBall(1);
  MP.oppY = H / 2 - padH / 2;
  MP.oppReady = false;
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

// MP fizik adımı: sadece host topu hareket ettirir.
function mpStepPhysics() {
  if (MP.isHost) {
    // guest'in raketini uygula (sağ raket)
    right.y = MP.oppY;
    if (state === STATE.PLAYING) {
      stepBall();
      mpOnScoreCheck();
    }
    // top durumunu gönder (PLAYING + READY — servis anında da)
    if (frames % 2 === 0) {
      mpSend({
        t: 'ball',
        x: Math.round(ball.x * 10) / 10, y: Math.round(ball.y * 10) / 10,
        vx: Math.round(ball.vx * 10) / 10, vy: Math.round(ball.vy * 10) / 10,
        sl: scL, sr: scR,
        st: state === STATE.PLAYING ? 3 : 1 // guest state senkronu
      });
    }
  } else {
    // guest: top host'tan gelir, sadece kendi sol raketini yönet
    right.y = MP.oppY;
  }
}

// host: maç bitti mi kontrol + bildir
function mpOnScoreCheck() {
  if (scL >= WIN_SCORE || scR >= WIN_SCORE) {
    mpSend({ t: 'end', sl: scL, sr: scR });
    mpMatchEnd(scL, scR);
  }
}

function mpMatchEnd(finalL, finalR) {
  state = STATE.GAMEOVER;
  // host solda: sen = sol. guest = sağ
  const my = MP.isHost ? finalL : finalR;
  const opp = MP.isHost ? finalR : finalL;
  $('mp-final-me').textContent = my;
  $('mp-final-opp').textContent = opp;
  $('mp-me-label').textContent = 'Sen';
  $('mp-opp-label').textContent = 'Rakip';
  let txt;
  if (my > opp) { txt = '🏆 KAZANDIN!'; sfx.win(); }
  else if (my < opp) { txt = '💀 KAYBETTİN...'; sfx.lose(); }
  else txt = '🤝 BERABERE!';
  $('mp-result-text').textContent = txt;
  show(mpGameoverScreen);
  hide(hud);
}

function mpLeave() {
  mpCleanup();
  hide(mpGameoverScreen);
  goMenu();
}

function goMenu() {
  state = STATE.MENU;
  hide(hud); hide(gameoverScreen); hide(pauseScreen); hide(mpScreen); hide(mpGameoverScreen);
  show(menuScreen);
  $('best-score-display').textContent = `🏆 Rekor galibiyet farkı: ${P.bestDiff}`;
}

// MP: raket konumunu gönder (her 2 frame)
let mpPadAcc = 0;
function mpPadTick() {
  if (!MP.connected) return;
  mpPadAcc++;
  if (mpPadAcc % 2 !== 0) return;
  mpSend({ t: 'paddle', y: Math.round(left.y) });
}

// MP butonları
$('mp-btn').addEventListener('click', mpOpenUI);
$('mp-host-btn').addEventListener('click', mpHost);
$('mp-join-btn').addEventListener('click', mpJoin);
$('mp-join-confirm').addEventListener('click', mpJoinConfirm);
$('mp-code-input').addEventListener('keydown', e => { if (e.key === 'Enter') mpJoinConfirm(); });
$('mp-quit-btn').addEventListener('click', () => { mpCleanup(); hide(mpScreen); goMenu(); });
$('mp-rematch-btn').addEventListener('click', () => {
  if (!MP.connected) { mpLeave(); return; }
  MP.rematchVotes = 1;
  mpSend({ t: 'rematch' });
  if (MP.isHost && MP.oppRematch) mpBeginMatch();
  $('mp-result-text').textContent = MP.isHost
    ? (MP.oppRematch ? 'Başlıyor!' : 'Rakibin onayı bekleniyor...')
    : 'Host başlatacak — onay bekleniyor...';
});
$('mp-leave-btn').addEventListener('click', mpLeave);

// ---------- Diğer butonlar ----------
$('start-btn').addEventListener('click', startGame);
$('retry-btn').addEventListener('click', startGame);
$('home-btn').addEventListener('click', () => location.href = 'index.html');
$('quit-btn').addEventListener('click', () => location.href = 'index.html');
$('back-to-hub-btn').addEventListener('click', () => location.href = 'index.html');
$('resume-btn').addEventListener('click', togglePause);
$('pause-btn').addEventListener('click', togglePause);

document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    P.difficulty = btn.dataset.diff;
    persist();
  });
});

// ---------- Çizim ----------
function draw() {
  // arka plan
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#050a14');
  bg.addColorStop(1, '#0a1522');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // arena ışıması
  const cg = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W * 0.75);
  cg.addColorStop(0, 'rgba(0,191,255,0.07)');
  cg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cg;
  ctx.fillRect(0, 0, W, H);

  // orta çizgi (neon kesikli)
  ctx.strokeStyle = 'rgba(0,191,255,0.35)';
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(W / 2, 8);
  ctx.lineTo(W / 2, H - 8);
  ctx.stroke();
  ctx.setLineDash([]);

  // orta daire
  ctx.strokeStyle = 'rgba(0,191,255,0.2)';
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, W * 0.16, 0, Math.PI * 2);
  ctx.stroke();

  // skor flaşları (gol atan taraf)
  if (scoreFlashL > 0) {
    scoreFlashL -= 0.02;
    const g = ctx.createLinearGradient(0, 0, W * 0.5, 0);
    g.addColorStop(0, `rgba(0,255,204,${scoreFlashL * 0.25})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W * 0.5, H);
  }
  if (scoreFlashR > 0) {
    scoreFlashR -= 0.02;
    const g = ctx.createLinearGradient(W, 0, W * 0.5, 0);
    g.addColorStop(0, `rgba(255,82,82,${scoreFlashR * 0.25})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(W * 0.5, 0, W * 0.5, H);
  }

  // duvarlar
  ctx.fillStyle = 'rgba(0,191,255,0.5)';
  ctx.fillRect(0, 0, W, 4);
  ctx.fillRect(0, H - 4, W, 4);

  // sol raket (sen — cyan neon)
  drawPaddle(padX1, left.y, '#00ffcc', hitGlowL);
  // sağ raket (rakip — kırmızı neon)
  drawPaddle(padX2, right.y, '#ff5252', hitGlowR);
  if (hitGlowL > 0) hitGlowL -= 0.08;
  if (hitGlowR > 0) hitGlowR -= 0.08;

  // top izi (fade)
  ballTrail.forEach((t, i) => {
    const a = (i / ballTrail.length) * 0.5;
    const r = ball.r * (0.3 + 0.7 * i / ballTrail.length);
    ctx.fillStyle = `rgba(255,255,255,${a * 0.6})`;
    ctx.beginPath();
    ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
    ctx.fill();
  });

  // top (glow'lu beyaz)
  if (state === STATE.PLAYING || state === STATE.READY || state === STATE.PAUSED) {
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // partiküller
  popParticles.forEach(pt => {
    ctx.globalAlpha = Math.min(1, pt.life / 20);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // servis geri sayımı
  if (state === STATE.READY && serveCountdown > 0) {
    const n = Math.ceil(serveCountdown / 60);
    const phase = (serveCountdown % 60) / 60;
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.65 * phase;
    ctx.translate(W / 2, H / 2);
    ctx.scale(0.8 + 0.4 * phase, 0.8 + 0.4 * phase);
    ctx.font = '900 72px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700';
    ctx.fillText(String(n), 0, 24);
    ctx.restore();
  } else if (state === STATE.READY) {
    // dokunma ipucu
    const bob = Math.sin(frames * 0.08) * 3;
    ctx.font = '800 15px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('Kaydır / W-S → oyna', W / 2, H / 2 + bob);
    ctx.textAlign = 'left';
  }

  // MP geri sayım
  if (MP.connected && mpCountdown > 0) {
    const n = Math.ceil(mpCountdown / 60);
    const phase = (mpCountdown % 60) / 60;
    ctx.save();
    ctx.globalAlpha = 0.4 + 0.6 * phase;
    ctx.translate(W / 2, H * 0.35);
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
    ctx.fillText('Maç eşzamanlı başlayacak!', W / 2, H * 0.35 + 34);
    ctx.textAlign = 'left';
  }

  // MP: raketlerin sahiplik etiketi
  if (MP.connected && state === STATE.PLAYING) {
    ctx.font = '700 10px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,255,204,0.7)';
    ctx.fillText('SEN', padX1 + padW / 2, H - 14);
    ctx.fillStyle = 'rgba(255,82,82,0.7)';
    ctx.fillText('RAKİP', padX2 + padW / 2, H - 14);
    ctx.textAlign = 'left';
  }

  // flaş
  if (flashAlpha > 0) {
    flashAlpha = Math.max(0, flashAlpha - 0.04);
    ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawPaddle(x, y, color, glow) {
  ctx.save();
  // ışıma
  ctx.shadowColor = color;
  ctx.shadowBlur = 14 + glow * 22;
  const g = ctx.createLinearGradient(x, y, x + padW, y);
  g.addColorStop(0, color);
  g.addColorStop(0.5, '#ffffff');
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  // yuvarlatılmış raket
  const r = padW / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + padW, y, x + padW, y + padH, r);
  ctx.arcTo(x + padW, y + padH, x, y + padH, r);
  ctx.arcTo(x, y + padH, x, y, r);
  ctx.arcTo(x, y, x + padW, y, r);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // iç çizgi
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x + padW * 0.35, y + 4, padW * 0.3, padH - 8);
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

    if (state === STATE.PLAYING) {
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
          // host: servis geri sayımını yönet
          if (mpCountdown > 0) mpCountdownTick();
          else if (serveCountdown > 0) {
            serveCountdown--;
            if (serveCountdown === 0) state = STATE.PLAYING;
          } else state = STATE.PLAYING;
          mpStepPhysics(); // top durumunu (resetTop dahil) göndermeye devam
        } else {
          // guest: host'un top dururumunu al, geri sayım host'tan
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

    popParticles.forEach(pt => { pt.x += pt.vx; pt.y += pt.vy; pt.vx *= 0.97; pt.vy *= 0.97; pt.life--; });
    popParticles = popParticles.filter(pt => pt.life > 0);
  }
  draw();
  requestAnimationFrame(loop);
}

// ---------- Başlat ----------
function init() {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  layout();

  document.querySelectorAll('.diff-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.diff === P.difficulty);
  });
  $('best-score-display').textContent = `🏆 Rekor galibiyet farkı: ${P.bestDiff}`;

  requestAnimationFrame(loop);
}

init();
