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

// Pong için galibiyet sayısını göster
(function () {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const wins = s.pong && s.pong.wins ? s.pong.wins : 0;
      $('hub-pong-best').textContent = wins > 0 ? wins + ' maç' : '0';
    }
  } catch (e) {}
})();

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

// ---------- ANA SALON ORTAK ODA LOBİSİ (PeerJS + QR + Canlı Ping) ----------
(function initHubParty() {
  const MPC = typeof MPCore !== 'undefined' ? MPCore : null;
  const mpScreen = $('mp-screen');
  const hubScreen = $('hub-screen');
  if (!mpScreen || !MPC) return;

  function show(el) { if (el) el.classList.remove('hidden'); }
  function hide(el) { if (el) el.classList.add('hidden'); }

  const HMP = {
    peer: null,
    conn: null,
    isHost: false,
    connected: false,
    waiting: false,
    roomCode: '',
    myName: 'Ev Sahibi',
    oppName: 'Rakip',
    pingMs: 0,
    joinTries: 0,
    timer: null,
    pingInterval: null
  };

  function getSavedName() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        return (s.flappy && s.flappy.playerName) || (s.snake && s.snake.playerName) || (s.pong && s.pong.playerName) || '';
      }
    } catch (e) {}
    return '';
  }

  function saveName(nm) {
    try {
      let root = {};
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) root = JSON.parse(raw) || {};
      if (!root.flappy) root.flappy = {};
      root.flappy.playerName = nm;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
    } catch (e) {}
  }

  function getMyName() {
    const inp = $('mp-name-input');
    const v = (inp ? inp.value.trim() : '') || getSavedName();
    if (v) {
      const clean = v.slice(0, 12);
      saveName(clean);
      return clean;
    }
    return HMP.isHost ? 'Ev Sahibi' : 'Konuk';
  }

  function makeCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  function inviteUrl() {
    try {
      if (typeof location !== 'undefined' && location.origin && location.pathname) {
        return location.origin + location.pathname + '?room=' + HMP.roomCode;
      }
    } catch (e) {}
    return '?room=' + HMP.roomCode;
  }

  function cleanup() {
    HMP.waiting = false;
    if (HMP.timer) { clearTimeout(HMP.timer); HMP.timer = null; }
    if (HMP.pingInterval) { clearInterval(HMP.pingInterval); HMP.pingInterval = null; }
    if (HMP.conn) { try { HMP.conn.close(); } catch (e) {} }
    if (HMP.peer) { try { HMP.peer.destroy(); } catch (e) {} }
    HMP.conn = null; HMP.peer = null; HMP.connected = false;
  }

  function send(d) {
    if (HMP.conn && HMP.connected) {
      try { HMP.conn.send(d); } catch (e) {}
    }
  }

  function openModal() {
    hide(hubScreen);
    show(mpScreen);
    show($('mp-btn-row'));
    hide($('mp-host-area'));
    hide($('mp-join-area'));
    hide($('hub-party-ready'));
    $('mp-error').textContent = '';
    $('mp-join-status').textContent = '';
    if ($('mp-name-input')) $('mp-name-input').value = getSavedName();
  }

  function renderHubReady() {
    hide($('mp-btn-row'));
    hide($('mp-host-area'));
    hide($('mp-join-area'));
    show($('hub-party-ready'));
    $('mp-ready-code').textContent = HMP.roomCode;
    $('hub-me-name').textContent = (HMP.isHost ? '👑 ' : '🎮 ') + HMP.myName;
    $('hub-opp-name').textContent = (!HMP.isHost ? '👑 ' : '🎮 ') + HMP.oppName;
    $('hub-picker-lbl').textContent = HMP.isHost ? '🎮 Oyunu Seç — İkiniz Birden Gireceksiniz:' : '⏳ Ev sahibinin oyun seçmesi bekleniyor...';
    document.querySelectorAll('#hub-picker-btns .mp-game-chip').forEach(b => {
      b.disabled = !HMP.isHost;
    });
    MPC.updatePingDOM(HMP.pingMs);
  }

  function setupConn() {
    HMP.conn.on('open', () => {
      HMP.waiting = false;
      HMP.connected = true;
      if (HMP.timer) { clearTimeout(HMP.timer); HMP.timer = null; }
      send({ t: 'hello', name: HMP.myName });
      renderHubReady();
      if (HMP.pingInterval) clearInterval(HMP.pingInterval);
      HMP.pingInterval = setInterval(() => {
        send({ t: '_ping', ts: Math.round(performance.now()) });
      }, 1000);
      send({ t: '_ping', ts: Math.round(performance.now()) });
    });

    HMP.conn.on('data', data => {
      if (!data || !data.t) return;
      if (data.t === '_ping') { send({ t: '_pong', ts: data.ts }); return; }
      if (data.t === '_pong') {
        const rtt = Math.max(1, performance.now() - (data.ts || 0));
        HMP.pingMs = HMP.pingMs > 0 ? HMP.pingMs * 0.65 + rtt * 0.35 : rtt;
        MPC.updatePingDOM(HMP.pingMs);
        return;
      }
      if (data.t === 'hello') {
        if (data.name) HMP.oppName = String(data.name).slice(0, 12);
        renderHubReady();
      } else if (data.t === '_switch_game' && MPC.GAMES[data.game]) {
        MPC.saveParty({
          roomCode: data.roomCode || HMP.roomCode,
          role: 'guest',
          myName: HMP.myName,
          oppName: HMP.oppName,
          targetGame: data.game,
          autoConnect: true
        });
        cleanup();
        location.href = MPC.GAMES[data.game].file;
      } else if (data.t === '_leave') {
        cleanup();
        openModal();
        $('mp-error').textContent = 'Arkadaşın odadan ayrıldı.';
      }
    });

    HMP.conn.on('close', () => {
      if (!HMP.connected) return;
      cleanup();
      openModal();
      $('mp-error').textContent = 'Bağlantı kapandı.';
    });
  }

  function openHostPeer() {
    if (!HMP.waiting || HMP.connected || !HMP.roomCode) return;
    if (HMP.peer) { try { HMP.peer.destroy(); } catch (e) {} HMP.peer = null; }
    const peer = new Peer('hub-' + HMP.roomCode, MPC.PEER_OPTS);
    HMP.peer = peer;
    peer.on('open', () => {
      if (HMP.peer !== peer) return;
      $('mp-error').textContent = '';
      $('mp-room-code').textContent = HMP.roomCode;
      $('mp-wait-text').textContent = '✅ Ortak oda hazır! QR okut veya kodu gönder.';
      MPC.mountHostQR($('mp-host-area'), inviteUrl());
    });
    peer.on('connection', conn => {
      if (HMP.peer !== peer || HMP.conn) return;
      HMP.conn = conn;
      setupConn();
    });
    peer.on('disconnected', () => {
      if (HMP.peer !== peer || !HMP.waiting || HMP.connected) return;
      HMP.timer = setTimeout(openHostPeer, 700);
    });
    peer.on('error', err => {
      if (HMP.peer !== peer || !HMP.waiting || HMP.connected) return;
      const tp = (err && err.type) || '';
      if (tp === 'unavailable-id') {
        HMP.roomCode = makeCode();
        $('mp-room-code').textContent = HMP.roomCode;
      }
      HMP.timer = setTimeout(openHostPeer, 1200);
    });
  }

  function startHost() {
    cleanup();
    HMP.isHost = true;
    HMP.myName = getMyName();
    HMP.roomCode = makeCode();
    HMP.waiting = true;
    hide($('mp-btn-row'));
    show($('mp-host-area'));
    $('mp-room-code').textContent = HMP.roomCode;
    $('mp-wait-text').textContent = 'Sunucuya bağlanılıyor...';
    MPC.mountHostQR($('mp-host-area'), inviteUrl());
    openHostPeer();
  }

  function attemptJoin() {
    if (HMP.connected || HMP.isHost || !HMP.roomCode) return;
    if (HMP.timer) { clearTimeout(HMP.timer); HMP.timer = null; }
    if (HMP.peer) { try { HMP.peer.destroy(); } catch (e) {} HMP.peer = null; }
    HMP.joinTries++;
    $('mp-join-status').textContent = HMP.joinTries === 1
      ? 'Bağlanılıyor...'
      : `⏳ Ev sahibi bekleniyor... (${HMP.joinTries}/10)`;
    const peer = new Peer(null, MPC.PEER_OPTS);
    HMP.peer = peer;
    const retry = (msg) => {
      if (HMP.peer !== peer || HMP.connected) return;
      if (HMP.joinTries < 10) HMP.timer = setTimeout(attemptJoin, 2000);
      else $('mp-join-status').textContent = msg || 'Oda bulunamadı!';
    };
    HMP.timer = setTimeout(() => retry('Oda yanıt vermedi.'), 3800);
    peer.on('open', () => {
      if (HMP.peer !== peer || HMP.connected) return;
      HMP.conn = peer.connect('hub-' + HMP.roomCode, { reliable: true });
      setupConn();
    });
    peer.on('error', () => retry('Oda bulunamadı, kodu kontrol et!'));
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && HMP.waiting && !HMP.connected) openHostPeer();
  });

  $('hub-mp-btn').addEventListener('click', openModal);
  $('mp-host-btn').addEventListener('click', startHost);
  $('mp-join-btn').addEventListener('click', () => {
    HMP.myName = getMyName();
    hide($('mp-btn-row'));
    show($('mp-join-area'));
  });
  $('mp-join-confirm').addEventListener('click', () => {
    const code = $('mp-code-input').value.trim().toUpperCase();
    if (code.length !== 5) { $('mp-join-status').textContent = '5 haneli kod gir!'; return; }
    cleanup();
    HMP.isHost = false;
    HMP.myName = getMyName();
    HMP.roomCode = code;
    HMP.joinTries = 0;
    attemptJoin();
  });
  $('mp-code-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') $('mp-join-confirm').click();
  });
  $('mp-copy-btn').addEventListener('click', () => {
    if (!HMP.roomCode || !navigator.clipboard) return;
    navigator.clipboard.writeText(HMP.roomCode).then(() => {
      $('mp-copy-btn').textContent = '✅ Kopyalandı!';
      setTimeout(() => { $('mp-copy-btn').textContent = '📋 Kodu Kopyala'; }, 1800);
    }).catch(() => {});
  });
  $('mp-share-btn').addEventListener('click', () => {
    if (!HMP.roomCode) return;
    const url = inviteUrl();
    const text = `🎮 Oyun Salonu ortak odama gel! Kod: ${HMP.roomCode}`;
    if (navigator.share) { navigator.share({ title: 'Oyun Salonu', text, url }).catch(() => {}); return; }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text + ' ' + url).then(() => {
        $('mp-share-btn').textContent = '✅ Link Kopyalandı!';
        setTimeout(() => { $('mp-share-btn').textContent = '📤 Davet Gönder'; }, 1800);
      }).catch(() => {});
    }
  });
  document.querySelectorAll('#hub-picker-btns .mp-game-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const gid = btn.dataset.game;
      if (!HMP.isHost || !HMP.connected || !MPC.GAMES[gid]) return;
      MPC.saveParty({
        roomCode: HMP.roomCode,
        role: 'host',
        myName: HMP.myName,
        oppName: HMP.oppName,
        targetGame: gid,
        autoConnect: true
      });
      send({ t: '_switch_game', game: gid, roomCode: HMP.roomCode });
      setTimeout(() => {
        cleanup();
        location.href = MPC.GAMES[gid].file;
      }, 60);
    });
  });
  $('mp-quit-btn').addEventListener('click', () => {
    send({ t: '_leave' });
    MPC.clearParty();
    cleanup();
    hide(mpScreen);
    show(hubScreen);
  });

  try {
    if (typeof location !== 'undefined' && location.search) {
      const m = location.search.match(/[?&]room=([A-Za-z0-9]{5})/);
      if (m && m[1]) {
        const autoCode = m[1].toUpperCase();
        if (history && history.replaceState) history.replaceState(null, '', location.pathname);
        openModal();
        hide($('mp-btn-row'));
        show($('mp-join-area'));
        $('mp-code-input').value = autoCode;
        $('mp-join-confirm').click();
      }
    }
  } catch (e) {}
})();
