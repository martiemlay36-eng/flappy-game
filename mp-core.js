// ============================================================================
// mp-core.js — Oyun Salonu Gelişmiş Çevrimiçi Altyapı Çekirdeği
// 1) 4G/5G Mobil Veri Uyumlu Çoklu STUN + TURN ICE Havuzu
// 2) Canlı Ping (RTT ms) Ölçümü & Saat-Bağımsız Gecikme Telafisi (RTT/2)
// 3) Saf JS ISO/IEC 18004 QR Kod Üretici (Sıfır Harici Kütüphane)
// 4) Oyunlar Arası Kopmadan Oda Taşıma (sessionStorage Parti Oturumu)
// ============================================================================
(function (root) {
  "use strict";

  const PARTY_KEY = 'oyun-salonu-mp-party-v1';
  const PARTY_TTL_MS = 30 * 60 * 1000; // 30 dakika

  const GAMES = {
    flappy: { id: 'flappy', prefix: 'flappy-', file: 'flappy.html', icon: '🐦', name: 'Flappy Kuş' },
    snake:  { id: 'snake',  prefix: 'snake-',  file: 'snake.html',  icon: '🐍', name: 'Yılan' },
    pong:   { id: 'pong',   prefix: 'pong-',   file: 'pong.html',   icon: '🏓', name: 'Pong' }
  };

  // 4G/5G CGNAT & Farklı Ağlar İçin Çoklu STUN + Ücretsiz Açık TURN (UDP + TCP + TLS 443)
  const PEER_OPTS = {
    debug: 1,
    pingInterval: 5000,
    config: {
      iceCandidatePoolSize: 4,
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
        {
          urls: [
            'turn:openrelay.metered.ca:80',
            'turn:openrelay.metered.ca:443',
            'turn:openrelay.metered.ca:443?transport=tcp'
          ],
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ]
    }
  };

  // ---------- Parti Oturumu (Oyunlar Arası Kopmadan Geçiş) ----------
  function saveParty(info) {
    try {
      if (typeof sessionStorage === 'undefined') return;
      const payload = {
        roomCode: String(info.roomCode || '').toUpperCase(),
        role: info.role === 'host' ? 'host' : 'guest',
        myName: String(info.myName || '').slice(0, 12),
        oppName: String(info.oppName || '').slice(0, 12),
        targetGame: info.targetGame || '',
        autoConnect: !!info.autoConnect,
        seriesMe: Number(info.seriesMe) || 0,
        seriesOpp: Number(info.seriesOpp) || 0,
        ts: Date.now()
      };
      sessionStorage.setItem(PARTY_KEY, JSON.stringify(payload));
    } catch (e) {}
  }

  function loadParty() {
    try {
      if (typeof sessionStorage === 'undefined') return null;
      const raw = sessionStorage.getItem(PARTY_KEY);
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (!p || !p.roomCode || p.roomCode.length !== 5) return null;
      if (Date.now() - (p.ts || 0) > PARTY_TTL_MS) {
        sessionStorage.removeItem(PARTY_KEY);
        return null;
      }
      return p;
    } catch (e) {
      return null;
    }
  }

  function clearParty() {
    try {
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(PARTY_KEY);
    } catch (e) {}
  }

  // ---------- Ping (RTT) & Bağlantı Kalitesi ----------
  function pingInfo(ms) {
    if (typeof ms !== 'number' || !isFinite(ms) || ms <= 0) {
      return { dot: '⚪', text: '-- ms', cls: 'ping-idle' };
    }
    const r = Math.max(1, Math.round(ms));
    if (r < 70)  return { dot: '🟢', text: `${r} ms`, cls: 'ping-good' };
    if (r < 145) return { dot: '🟡', text: `${r} ms`, cls: 'ping-mid' };
    return { dot: '🔴', text: `${r} ms`, cls: 'ping-bad' };
  }

  function compensatedCountdownFrames(baseFrames, pingMs) {
    // Host paketi gönderdiğinde konuğa ulaşması ~pingMs/2 sürer; konuk bu süreyi düşerek
    // gerçek dünyada milisaniyesi milisaniyesine aynı anda 0'a ulaşır!
    const oneWayMs = Math.max(0, Math.min(600, (Number(pingMs) || 0) * 0.5));
    const subFrames = Math.round(oneWayMs / (1000 / 60));
    return Math.max(30, baseFrames - subFrames);
  }

  // ==========================================================================
  // Saf JS QR Kod Üretici (ISO/IEC 18004 — Versiyon 1..6, ECC Seviye L, Byte)
  // ==========================================================================
  const QR_VERSIONS = [
    null,
    { size: 21, total: 26,  ecPerBlock: 7,  blocks: 1, align: [] },
    { size: 25, total: 44,  ecPerBlock: 10, blocks: 1, align: [6, 18] },
    { size: 29, total: 70,  ecPerBlock: 15, blocks: 1, align: [6, 22] },
    { size: 33, total: 100, ecPerBlock: 20, blocks: 1, align: [6, 26] },
    { size: 37, total: 134, ecPerBlock: 26, blocks: 1, align: [6, 30] },
    { size: 41, total: 172, ecPerBlock: 18, blocks: 2, align: [6, 34] }
  ];

  const GF_EXP = new Uint8Array(512);
  const GF_LOG = new Uint8Array(256);
  (function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      GF_EXP[i] = x;
      GF_LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
  })();

  function gfMul(a, b) {
    return (a === 0 || b === 0) ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]];
  }

  function rsGeneratorPoly(deg) {
    let poly = [1];
    for (let i = 0; i < deg; i++) {
      const next = new Array(poly.length + 1).fill(0);
      const rootFactor = GF_EXP[i];
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], rootFactor);
      }
      poly = next;
    }
    return poly;
  }

  function rsComputeEC(dataBytes, ecLen) {
    const gen = rsGeneratorPoly(ecLen);
    const rem = new Uint8Array(ecLen);
    for (let i = 0; i < dataBytes.length; i++) {
      const factor = dataBytes[i] ^ rem[0];
      for (let j = 0; j < ecLen - 1; j++) rem[j] = rem[j + 1];
      rem[ecLen - 1] = 0;
      if (factor !== 0) {
        for (let j = 0; j < ecLen; j++) {
          rem[j] ^= gfMul(gen[j + 1], factor);
        }
      }
    }
    return rem;
  }

  function utf8Bytes(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
      let c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) {
        out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      } else {
        out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      }
    }
    return out;
  }

  function bchFormatBits(ecLevelBits, mask) {
    const data = ((ecLevelBits & 3) << 3) | (mask & 7);
    let rem = data << 10;
    for (let i = 14; i >= 10; i--) {
      if ((rem >> i) & 1) rem ^= (0x537 << (i - 10));
    }
    return ((data << 10) | rem) ^ 0x5412;
  }

  function maskCondition(mask, r, c) {
    switch (mask) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
      case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
      default: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    }
  }

  function encodeQRMatrix(text) {
    const bytes = utf8Bytes(String(text || ''));
    let ver = 1;
    while (ver <= 6) {
      const vInfo = QR_VERSIONS[ver];
      const dataCap = vInfo.total - vInfo.ecPerBlock * vInfo.blocks;
      if (bytes.length + 2 <= dataCap) break;
      ver++;
    }
    if (ver > 6) return null;

    const v = QR_VERSIONS[ver];
    const dataCap = v.total - v.ecPerBlock * v.blocks;
    const bits = [];
    const pushBits = (val, len) => {
      for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
    };

    pushBits(0b0100, 4); // Byte modu
    pushBits(bytes.length, 8);
    for (let i = 0; i < bytes.length; i++) pushBits(bytes[i], 8);

    const maxBits = dataCap * 8;
    const term = Math.min(4, maxBits - bits.length);
    for (let i = 0; i < term; i++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);

    const dataCodewords = new Uint8Array(dataCap);
    for (let i = 0; i < bits.length / 8; i++) {
      let b = 0;
      for (let k = 0; k < 8; k++) b = (b << 1) | bits[i * 8 + k];
      dataCodewords[i] = b;
    }
    const padBytes = [0xec, 0x11];
    for (let i = bits.length / 8, p = 0; i < dataCap; i++, p++) {
      dataCodewords[i] = padBytes[p & 1];
    }

    // Bloklama & Reed-Solomon hata düzeltme
    const blockDataLen = Math.floor(dataCap / v.blocks);
    const dataBlocks = [];
    const ecBlocks = [];
    for (let b = 0; b < v.blocks; b++) {
      const slice = dataCodewords.slice(b * blockDataLen, (b + 1) * blockDataLen);
      dataBlocks.push(slice);
      ecBlocks.push(rsComputeEC(slice, v.ecPerBlock));
    }

    const finalCodewords = [];
    for (let i = 0; i < blockDataLen; i++) {
      for (let b = 0; b < v.blocks; b++) finalCodewords.push(dataBlocks[b][i]);
    }
    for (let i = 0; i < v.ecPerBlock; i++) {
      for (let b = 0; b < v.blocks; b++) finalCodewords.push(ecBlocks[b][i]);
    }

    const N = v.size;
    const modules = Array.from({ length: N }, () => new Uint8Array(N));
    const isFunc  = Array.from({ length: N }, () => new Uint8Array(N));

    const setFunc = (r, c, dark) => {
      if (r < 0 || r >= N || c < 0 || c >= N) return;
      modules[r][c] = dark ? 1 : 0;
      isFunc[r][c] = 1;
    };

    const drawFinder = (r0, c0) => {
      for (let dr = -1; dr <= 7; dr++) {
        for (let dc = -1; dc <= 7; dc++) {
          const r = r0 + dr, c = c0 + dc;
          if (r < 0 || r >= N || c < 0 || c >= N) continue;
          const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
          const border = dr === 0 || dr === 6 || dc === 0 || dc === 6;
          const center = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
          setFunc(r, c, inOuter && (border || center));
        }
      }
    };

    drawFinder(0, 0);
    drawFinder(0, N - 7);
    drawFinder(N - 7, 0);

    // Zamanlama çizgileri
    for (let i = 8; i < N - 8; i++) {
      setFunc(6, i, i % 2 === 0);
      setFunc(i, 6, i % 2 === 0);
    }

    // Hizalama desenleri
    for (let i = 0; i < v.align.length; i++) {
      for (let j = 0; j < v.align.length; j++) {
        const cr = v.align[i], cc = v.align[j];
        if ((cr <= 8 && cc <= 8) || (cr <= 8 && cc >= N - 8) || (cr >= N - 8 && cc <= 8)) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const d = Math.max(Math.abs(dr), Math.abs(dc));
            setFunc(cr + dr, cc + dc, d !== 1);
          }
        }
      }
    }

    // Format bilgisi alanlarını rezerve et + sabit koyu modül
    for (let i = 0; i <= 8; i++) {
      if (!isFunc[8][i]) setFunc(8, i, false);
      if (!isFunc[i][8]) setFunc(i, 8, false);
    }
    for (let i = 0; i < 8; i++) {
      setFunc(8, N - 1 - i, false);
      setFunc(N - 1 - i, 8, false);
    }
    setFunc(N - 8, 8, true);

    // Veri bitlerini zikzak yerleştir
    let bitIdx = 0;
    const totalBits = finalCodewords.length * 8;
    let upward = true;
    for (let right = N - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < N; vert++) {
        const r = upward ? (N - 1 - vert) : vert;
        for (let j = 0; j < 2; j++) {
          const c = right - j;
          if (!isFunc[r][c]) {
            let dark = 0;
            if (bitIdx < totalBits) {
              dark = (finalCodewords[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1;
              bitIdx++;
            }
            modules[r][c] = dark;
          }
        }
      }
      upward = !upward;
    }

    // En düşük ceza puanlı maskeyi seç (0..7)
    const writeFormat = (mat, mask) => {
      const f = bchFormatBits(0b01, mask); // 01 = ECC Level L
      const tlCoords = [
        [8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],
        [7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]
      ];
      for (let i = 0; i < 15; i++) {
        const bit = (f >> (14 - i)) & 1;
        const [r, c] = tlCoords[i];
        mat[r][c] = bit;
      }
      for (let i = 0; i < 7; i++) {
        mat[N - 1 - i][8] = (f >> (14 - i)) & 1;
      }
      for (let i = 0; i < 8; i++) {
        mat[8][N - 8 + i] = (f >> (7 - i)) & 1;
      }
    };

    let bestMask = 0, bestScore = Infinity, bestMat = null;
    for (let m = 0; m < 8; m++) {
      const cand = modules.map(row => new Uint8Array(row));
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          if (!isFunc[r][c] && maskCondition(m, r, c)) cand[r][c] ^= 1;
        }
      }
      writeFormat(cand, m);

      // Basit ardışık modül ceza skoru
      let pen = 0;
      for (let r = 0; r < N; r++) {
        let run = 1;
        for (let c = 1; c < N; c++) {
          if (cand[r][c] === cand[r][c - 1]) {
            run++;
            if (run === 5) pen += 3;
            else if (run > 5) pen += 1;
          } else run = 1;
        }
      }
      for (let c = 0; c < N; c++) {
        let run = 1;
        for (let r = 1; r < N; r++) {
          if (cand[r][c] === cand[r - 1][c]) {
            run++;
            if (run === 5) pen += 3;
            else if (run > 5) pen += 1;
          } else run = 1;
        }
      }
      if (pen < bestScore) { bestScore = pen; bestMask = m; bestMat = cand; }
    }

    return { size: N, modules: bestMat, mask: bestMask, version: ver };
  }

  function renderQR(canvas, text, sizePx) {
    if (!canvas || !canvas.getContext) return false;
    const qr = encodeQRMatrix(text);
    if (!qr) return false;
    const px = sizePx || 136;
    const quiet = 3;
    const totalMods = qr.size + quiet * 2;
    const scale = Math.max(2, Math.floor(px / totalMods));
    const realPx = totalMods * scale;

    canvas.width = realPx;
    canvas.height = realPx;
    canvas.style.width = px + 'px';
    canvas.style.height = px + 'px';

    const c = canvas.getContext('2d');
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, realPx, realPx);
    c.fillStyle = '#071324';
    for (let r = 0; r < qr.size; r++) {
      for (let col = 0; col < qr.size; col++) {
        if (qr.modules[r][col]) {
          c.fillRect((col + quiet) * scale, (r + quiet) * scale, scale, scale);
        }
      }
    }
    return true;
  }

  // ---------- Ortak Lobi, QR Kod, Ping & Oyun Değiştirici UI Yardımcıları ----------
  function mountHostQR(hostAreaEl, url) {
    if (!hostAreaEl || typeof document === 'undefined') return;
    let wrap = document.getElementById('mp-qr-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'mp-qr-wrap';
      wrap.className = 'mp-qr-wrap';
      wrap.innerHTML = `
        <canvas id="mp-qr-canvas" class="mp-qr-canvas"></canvas>
        <span class="mp-qr-caption">📷 Kamerayla okut → anında bağlan</span>
      `;
      const waitEl = document.getElementById('mp-wait-text');
      if (waitEl && waitEl.parentNode === hostAreaEl) {
        hostAreaEl.insertBefore(wrap, waitEl);
      } else {
        hostAreaEl.appendChild(wrap);
      }
    }
    const cv = document.getElementById('mp-qr-canvas');
    if (cv && url) renderQR(cv, url, 104);
  }

  function mountHostGamePicker(hostAreaEl, currentGameId, onSelectGameFn) {
    if (!hostAreaEl || typeof document === 'undefined') return null;
    let bar = document.getElementById('mp-host-game-picker');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'mp-host-game-picker';
      bar.className = 'mp-switch-bar mp-host-picker';
      bar.innerHTML = `
        <span class="mp-switch-lbl" id="mp-host-picker-lbl">🎮 Oyunu Seç:</span>
        <div class="mp-switch-btns" id="mp-host-picker-btns"></div>
      `;
      hostAreaEl.appendChild(bar);
    }
    const lbl = document.getElementById('mp-host-picker-lbl');
    if (lbl) {
      lbl.textContent = currentGameId === 'hub'
        ? '🎮 İstersen Hemen Oyunu Seç (Aynı Kodla):'
        : '🎮 Başka Oyuna Geç (Aynı Kodla):';
    }
    const btns = document.getElementById('mp-host-picker-btns');
    if (btns) {
      btns.innerHTML = '';
      Object.keys(GAMES).forEach(gid => {
        if (gid === currentGameId) return;
        const g = GAMES[gid];
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'mp-game-chip';
        b.textContent = `${g.icon} ${g.name}`;
        b.addEventListener('click', (e) => {
          if (e && e.stopPropagation) e.stopPropagation();
          if (onSelectGameFn) onSelectGameFn(gid);
        });
        btns.appendChild(b);
      });
    }
    return bar;
  }

  function answerProbeIfAny(conn, gameId, roomCode, isBusy) {
    if (!conn || !conn.metadata || !conn.metadata.probe) return false;
    if (isBusy) {
      try { conn.close(); } catch (e) {}
      return true;
    }
    const reply = () => {
      try { conn.send({ t: '_redirect', game: gameId, roomCode }); } catch (e) {}
      setTimeout(() => { try { conn.close(); } catch (e) {} }, 180);
    };
    if (conn.open) reply();
    else conn.on('open', reply);
    return true;
  }

  function probeRoomAcrossGames(PeerClass, roomCode, skipPrefix, onFoundGame) {
    if (!PeerClass || !roomCode) return null;
    const targets = [
      { prefix: 'hub-', id: 'hub' },
      { prefix: 'flappy-', id: 'flappy' },
      { prefix: 'snake-', id: 'snake' },
      { prefix: 'pong-', id: 'pong' }
    ].filter(x => x.prefix !== skipPrefix);
    if (!targets.length) return null;

    let done = false;
    let probePeer = null;
    const finish = (foundId) => {
      if (done) return;
      done = true;
      if (probePeer) {
        const p = probePeer;
        probePeer = null;
        setTimeout(() => { try { p.destroy(); } catch (e) {} }, 60);
      }
      if (foundId && onFoundGame) onFoundGame(foundId);
    };

    try {
      probePeer = new PeerClass(null, PEER_OPTS);
    } catch (e) {
      return null;
    }

    const guardTimer = setTimeout(() => finish(null), 3200);
    probePeer.on('open', () => {
      if (done || !probePeer) return;
      targets.forEach(tg => {
        try {
          const c = probePeer.connect(tg.prefix + roomCode, { reliable: true, metadata: { probe: true } });
          if (!c) return;
          c.on('data', d => {
            if (d && d.t === '_redirect' && d.game) {
              clearTimeout(guardTimer);
              finish(d.game);
            }
          });
        } catch (e) {}
      });
    });
    probePeer.on('error', () => {});
    return () => {
      clearTimeout(guardTimer);
      finish(null);
    };
  }

  function updatePingDOM(pingMs) {
    if (typeof document === 'undefined') return;
    const info = pingInfo(pingMs);
    const ids = ['mp-lobby-ping', 'mp-hud-ping'];
    for (let i = 0; i < ids.length; i++) {
      const el = document.getElementById(ids[i]);
      if (el) {
        el.textContent = `${info.dot} ${info.text}`;
        el.className = 'mp-ping-pill ' + info.cls;
      }
    }
  }

  function mountReadyRoom(lobbyEl, cfg) {
    if (!lobbyEl || typeof document === 'undefined') return null;
    let area = document.getElementById('mp-ready-area');
    if (!area) {
      area = document.createElement('div');
      area.id = 'mp-ready-area';
      area.className = 'mp-ready-area hidden';
      area.innerHTML = `
        <div class="mp-ready-header">
          <span class="mp-room-pill">🔑 Oda: <b id="mp-ready-code">-----</b></span>
          <span id="mp-lobby-ping" class="mp-ping-pill ping-idle">⚪ -- ms</span>
        </div>
        <div class="mp-players-box">
          <div class="mp-pcard" id="mp-pcard-me">
            <span class="mp-pname" id="mp-ready-me-name">Sen</span>
            <span class="mp-pstatus" id="mp-ready-me-st">⏳ Bekliyor</span>
          </div>
          <div class="mp-vs-badge">VS</div>
          <div class="mp-pcard" id="mp-pcard-opp">
            <span class="mp-pname" id="mp-ready-opp-name">Rakip</span>
            <span class="mp-pstatus" id="mp-ready-opp-st">⏳ Bekliyor</span>
          </div>
        </div>
        <div id="mp-ready-settings" class="mp-ready-settings"></div>
        <div id="mp-switch-bar" class="mp-switch-bar hidden">
          <span class="mp-switch-lbl">🎮 Oyun Değiştir:</span>
          <div class="mp-switch-btns" id="mp-switch-btns"></div>
        </div>
        <button type="button" id="mp-ready-toggle-btn" class="big-btn mp-ready-btn">✅ HAZIRIM!</button>
      `;
      const errEl = document.getElementById('mp-error');
      if (errEl && errEl.parentNode === lobbyEl) {
        lobbyEl.insertBefore(area, errEl);
      } else {
        lobbyEl.appendChild(area);
      }

      const rBtn = document.getElementById('mp-ready-toggle-btn');
      if (rBtn && cfg && cfg.onToggleReady) {
        rBtn.addEventListener('click', cfg.onToggleReady);
      }
    }

    // Oyun değiştirme butonları (sadece diğer 2 oyun)
    const swBtns = document.getElementById('mp-switch-btns');
    if (swBtns && cfg && cfg.gameId) {
      swBtns.innerHTML = '';
      Object.keys(GAMES).forEach(gid => {
        if (gid === cfg.gameId) return;
        const g = GAMES[gid];
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'mp-game-chip';
        b.textContent = `${g.icon} ${g.name}`;
        b.addEventListener('click', () => {
          if (cfg.onSwitchGame) cfg.onSwitchGame(gid);
        });
        swBtns.appendChild(b);
      });
    }

    return area;
  }

  function renderReadyState(st) {
    if (typeof document === 'undefined') return;
    const codeEl = document.getElementById('mp-ready-code');
    if (codeEl) codeEl.textContent = st.roomCode || '-----';

    const meName = document.getElementById('mp-ready-me-name');
    const oppName = document.getElementById('mp-ready-opp-name');
    const meSt = document.getElementById('mp-ready-me-st');
    const oppSt = document.getElementById('mp-ready-opp-st');
    const meCard = document.getElementById('mp-pcard-me');
    const oppCard = document.getElementById('mp-pcard-opp');
    const rBtn = document.getElementById('mp-ready-toggle-btn');
    const swBar = document.getElementById('mp-switch-bar');

    if (meName) meName.textContent = (st.isHost ? '👑 ' : '🎮 ') + (st.myName || 'Sen');
    if (oppName) oppName.textContent = (!st.isHost ? '👑 ' : '🎮 ') + (st.oppName || 'Rakip');

    if (meSt) meSt.textContent = st.myReady ? '✅ HAZIR' : '⏳ Hazır Değil';
    if (oppSt) oppSt.textContent = st.oppReady ? '✅ HAZIR' : '⏳ Bekleniyor';
    if (meCard && meCard.classList) meCard.classList.toggle('ready', !!st.myReady);
    if (oppCard && oppCard.classList) oppCard.classList.toggle('ready', !!st.oppReady);

    if (rBtn) {
      rBtn.textContent = st.myReady ? '⏳ Rakip Bekleniyor (İptal)' : '✅ HAZIRIM!';
      if (rBtn.classList) rBtn.classList.toggle('is-ready', !!st.myReady);
    }

    if (swBar && swBar.classList) {
      swBar.classList.toggle('hidden', !st.isHost);
    }

    const setBox = document.getElementById('mp-ready-settings');
    if (setBox && Array.isArray(st.settingsRows)) {
      setBox.innerHTML = '';
      st.settingsRows.forEach(row => {
        const line = document.createElement('div');
        line.className = 'mp-set-row';
        const lbl = document.createElement('span');
        lbl.className = 'mp-set-lbl';
        lbl.textContent = row.label + ':';
        line.appendChild(lbl);

        const optsWrap = document.createElement('div');
        optsWrap.className = 'mp-set-opts';
        row.options.forEach(opt => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'mp-set-chip' + (opt.value === row.value ? ' active' : '');
          btn.textContent = opt.label;
          if (!st.isHost) {
            btn.disabled = true;
          } else if (row.onChange) {
            btn.addEventListener('click', () => row.onChange(opt.value));
          }
          optsWrap.appendChild(btn);
        });
        line.appendChild(optsWrap);
        setBox.appendChild(line);
      });
    }
  }

  function mountGameoverSwitcher(mpGoScreenEl, currentGameId, isHostFn, onSwitchGameFn) {
    if (!mpGoScreenEl || typeof document === 'undefined') return;
    let row = document.getElementById('mp-go-switch-row');
    if (!row) {
      row = document.createElement('div');
      row.id = 'mp-go-switch-row';
      row.className = 'mp-switch-bar mp-go-switch hidden';
      row.innerHTML = `<span class="mp-switch-lbl">🎮 Oda Bozulmadan Geç:</span><div class="mp-switch-btns" id="mp-go-switch-btns"></div>`;
      const menuRow = mpGoScreenEl.querySelector ? mpGoScreenEl.querySelector('.menu-row') : null;
      if (menuRow && menuRow.parentNode === mpGoScreenEl) {
        mpGoScreenEl.insertBefore(row, menuRow);
      } else {
        mpGoScreenEl.appendChild(row);
      }
    }
    const btns = document.getElementById('mp-go-switch-btns');
    if (btns) {
      btns.innerHTML = '';
      Object.keys(GAMES).forEach(gid => {
        if (gid === currentGameId) return;
        const g = GAMES[gid];
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'mp-game-chip';
        b.textContent = `${g.icon} ${g.name}`;
        b.addEventListener('click', (e) => {
          if (e && e.stopPropagation) e.stopPropagation();
          onSwitchGameFn(gid);
        });
        btns.appendChild(b);
      });
    }
    if (row.classList) row.classList.toggle('hidden', !isHostFn());
  }

  function ensureGraceBanner(wrapperEl, onQuitFn) {
    if (!wrapperEl || typeof document === 'undefined') return null;
    let el = document.getElementById('mp-grace-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'mp-grace-banner';
      el.className = 'mp-grace-banner hidden';
      el.innerHTML = `
        <div class="mp-grace-box">
          <div class="mp-grace-title">⏳ Bağlantı Yenileniyor...</div>
          <p class="mp-grace-sub" id="mp-grace-sub">Rakibin bağlantısı koptu, yeniden bağlanması bekleniyor (12 sn)</p>
          <button type="button" class="small-btn" id="mp-grace-quit">🏠 Maçtan Çık</button>
        </div>
      `;
      wrapperEl.appendChild(el);
      const qb = document.getElementById('mp-grace-quit');
      if (qb && onQuitFn) qb.addEventListener('click', onQuitFn);
    }
    return el;
  }

  root.MPCore = {
    GAMES,
    PEER_OPTS,
    saveParty,
    loadParty,
    clearParty,
    pingInfo,
    updatePingDOM,
    compensatedCountdownFrames,
    encodeQRMatrix,
    renderQR,
    mountHostQR,
    mountHostGamePicker,
    answerProbeIfAny,
    probeRoomAcrossGames,
    mountReadyRoom,
    renderReadyState,
    mountGameoverSwitcher,
    ensureGraceBanner
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
