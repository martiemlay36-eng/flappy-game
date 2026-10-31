// test-mp-sync.js — 3 oyunun tamamı için 2-İstemcili (Masaüstü 420x700 Host <-> Mobil 360x640 Guest)
// PeerJS P2P senkronizasyon doğrulama testi
"use strict";

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

// Bellekte anlık çalışan sahte PeerJS sinyal & veri kanalı
function createPeerBroker() {
  const peers = new Map();

  class MockConn {
    constructor() {
      this.handlers = {};
      this.peerConn = null;
      this.open = false;
    }
    on(ev, fn) {
      (this.handlers[ev] = this.handlers[ev] || []).push(fn);
    }
    emit(ev, payload) {
      (this.handlers[ev] || []).forEach(fn => fn(payload));
    }
    send(data) {
      if (!this.open || !this.peerConn) return;
      const cloned = JSON.parse(JSON.stringify(data));
      this.peerConn.emit('data', cloned);
    }
    close() {
      if (!this.open) return;
      this.open = false;
      this.emit('close');
      if (this.peerConn && this.peerConn.open) {
        this.peerConn.open = false;
        this.peerConn.emit('close');
      }
    }
  }

  class MockPeer {
    constructor(id) {
      this.id = id || ('guest-' + Math.random().toString(36).slice(2, 8));
      this.handlers = {};
      peers.set(this.id, this);
      Promise.resolve().then(() => this.emit('open', this.id));
    }
    on(ev, fn) {
      (this.handlers[ev] = this.handlers[ev] || []).push(fn);
    }
    emit(ev, payload) {
      (this.handlers[ev] || []).forEach(fn => fn(payload));
    }
    connect(targetId, opts) {
      const guestConn = new MockConn();
      guestConn.metadata = (opts && opts.metadata) || null;
      if (MockPeer.offline) {
        Promise.resolve().then(() => this.emit('error', { type: 'network' }));
        return guestConn;
      }
      const hostPeer = peers.get(targetId);
      if (!hostPeer) {
        Promise.resolve().then(() => this.emit('error', { type: 'peer-unavailable' }));
        return guestConn;
      }
      const hostConn = new MockConn();
      hostConn.metadata = (opts && opts.metadata) || null;
      guestConn.peerConn = hostConn;
      hostConn.peerConn = guestConn;
      Promise.resolve().then(() => {
        hostPeer.emit('connection', hostConn);
        hostConn.open = true;
        guestConn.open = true;
        hostConn.emit('open');
        guestConn.emit('open');
      });
      return guestConn;
    }
    destroy() {
      peers.delete(this.id);
    }
  }
  MockPeer.offline = false;

  return MockPeer;
}

function createClientSandbox(scriptFile, width, height, MockPeer, customSessionStore) {
  const noop = () => {};
  const ctx2d = {
    setTransform: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    fillRect: noop, strokeRect: noop, clearRect: noop,
    beginPath: noop, arc: noop, arcTo: noop, ellipse: noop,
    moveTo: noop, lineTo: noop, quadraticCurveTo: noop, bezierCurveTo: noop, closePath: noop,
    fill: noop, stroke: noop, fillText: noop, strokeText: noop,
    save: noop, restore: noop, translate: noop, rotate: noop, scale: noop,
    setLineDash: noop, measureText: () => ({ width: 12 })
  };

  const makeEl = () => {
    const classes = new Set(['hidden']);
    const el = {
      classList: {
        add: (...cs) => cs.forEach(c => classes.add(c)),
        remove: (...cs) => cs.forEach(c => classes.delete(c)),
        toggle: (c, force) => {
          const next = force !== undefined ? !!force : !classes.has(c);
          if (next) classes.add(c); else classes.delete(c);
        },
        contains: c => classes.has(c)
      },
      addEventListener: noop,
      textContent: '',
      innerHTML: '',
      value: '',
      disabled: false,
      style: {},
      dataset: {},
      appendChild: noop,
      insertBefore: noop,
      getContext: () => ctx2d,
      getBoundingClientRect: () => ({ left: 0, top: 0, width, height }),
      parentElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width, height }) }
    };
    return el;
  };

  const els = {};
  const canvasEl = { ...makeEl(), getContext: () => ctx2d, width, height };
  let simNow = 1000;
  let rafCb = null;
  const store = {};
  const sess = customSessionStore || {};

  const sandbox = {
    console,
    Math, Date, JSON, Object, Array, String, Number, Boolean, Set, Map, Promise, Uint8Array,
    parseInt, parseFloat, isNaN, isFinite, Infinity,
    Peer: MockPeer,
    performance: { now: () => simNow },
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    sessionStorage: {
      getItem: k => (k in sess ? sess[k] : null),
      setItem: (k, v) => { sess[k] = String(v); },
      removeItem: k => { delete sess[k]; }
    },
    document: {
      hidden: false,
      getElementById: id => {
        if (id === 'game-canvas') return canvasEl;
        if (!els[id]) els[id] = makeEl();
        return els[id];
      },
      querySelectorAll: () => [],
      addEventListener: noop,
      createElement: () => makeEl()
    },
    window: {
      devicePixelRatio: 1,
      addEventListener: noop,
      AudioContext: undefined,
      webkitAudioContext: undefined
    },
    location: { href: '', origin: 'https://example.com', pathname: '/' + scriptFile.replace('.js', '.html'), search: '' },
    requestAnimationFrame: cb => { rafCb = cb; return 1; },
    setTimeout: fn => { /* kontrollü test */ return 0; },
    clearTimeout: noop,
    setInterval: () => 0,
    clearInterval: noop
  };
  sandbox.window.document = sandbox.document;
  sandbox.globalThis = sandbox;

  const mpCoreCode = fs.readFileSync(path.join(__dirname, 'mp-core.js'), 'utf8');
  const code = mpCoreCode + '\n;' + fs.readFileSync(path.join(__dirname, scriptFile), 'utf8') + `
    ;globalThis.__test = {
      getState: () => state,
      getMP: () => MP,
      els: id => document.getElementById(id),
      evalExpr: fn => eval(fn)
    };
  `;

  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);

  return {
    sandbox,
    els,
    sess,
    advanceClock(ms) { simNow += ms; },
    stepFrame() {
      simNow += 1000 / 60;
      if (rafCb) {
        const cb = rafCb;
        rafCb = null;
        cb(simNow);
      }
    },
    eval(expr) {
      return sandbox.__test.evalExpr(expr);
    }
  };
}

function bothReady(host, guest) {
  host.eval('mpSetReady(true)');
  guest.eval('mpSetReady(true)');
}

async function flushMicrotasks() {
  for (let i = 0; i < 6; i++) await Promise.resolve();
}

(async () => {
  // =========================================================================
  // 1) FLAPPY KUŞ ONLINE SENKRON TESTİ (420x700 PC <-> 360x640 Mobil)
  // =========================================================================
  {
    const MockPeer = createPeerBroker();
    const host = createClientSandbox('game.js', 420, 700, MockPeer);
    const guest = createClientSandbox('game.js', 360, 640, MockPeer);

    host.sandbox.document.getElementById('mp-name-input').value = 'NuriPC';
    guest.sandbox.document.getElementById('mp-name-input').value = 'MobilKral';

    host.eval('mpHost()');
    await flushMicrotasks();
    const code = host.eval('MP.roomCode');
    assert.strictEqual(code.length, 5, 'Flappy 5 haneli oda kodu üretmeli');

    guest.sandbox.document.getElementById('mp-code-input').value = code;
    guest.eval('mpJoinConfirm()');
    await flushMicrotasks();

    assert.strictEqual(host.eval('MP.connected'), true, 'Flappy Host bağlı olmalı');
    assert.strictEqual(guest.eval('MP.connected'), true, 'Flappy Guest bağlı olmalı');
    assert.strictEqual(host.eval('MP.inLobby'), true, 'Flappy bağlantı sonrası Hazırlık Lobisinde başlamalı');
    bothReady(host, guest);
    assert.strictEqual(host.eval('MP.seed'), guest.eval('MP.seed'), 'Flappy RNG seed eşleşmeli');

    // 3sn geri sayımı geç (185 kare)
    for (let i = 0; i < 185; i++) {
      host.stepFrame();
      guest.stepFrame();
    }
    assert.strictEqual(host.eval('state === STATE.PLAYING'), true, 'Flappy Host PLAYING olmalı');
    assert.strictEqual(guest.eval('state === STATE.PLAYING'), true, 'Flappy Guest PLAYING olmalı');

    // Host kombo ile yüksek skor yapsa bile (score=25 vs Guest score=2) boru tipleri ve normalize X konumları AYNI kalmalı!
    host.eval('score = 25;');
    guest.eval('score = 2;');

    for (let f = 0; f < 650; f++) {
      // Kuşlar ölmesin diye ortada tutalım
      host.eval('bird.y = playH() * 0.5; bird.vy = 0; phaseFrames = 10;');
      guest.eval('bird.y = playH() * 0.3; bird.vy = 0; phaseFrames = 10;');
      host.stepFrame();
      guest.stepFrame();
    }

    const hostPipes = host.eval('pipes.map(p => ({ nx: +(p.x / W).toFixed(3), t: p.type, topV: +p.baseTopV.toFixed(2) }))');
    const guestPipes = guest.eval('pipes.map(p => ({ nx: +(p.x / W).toFixed(3), t: p.type, topV: +p.baseTopV.toFixed(2) }))');
    assert.ok(hostPipes.length >= 2, 'Flappy en az 2 aktif boru üretmiş olmalı');
    assert.strictEqual(hostPipes.length, guestPipes.length, 'Flappy iki ekranda boru sayısı eşit olmalı');

    for (let i = 0; i < hostPipes.length; i++) {
      assert.strictEqual(hostPipes[i].t, guestPipes[i].t, 'Flappy boru tipleri skor farkına rağmen %100 aynı olmalı');
      assert.strictEqual(hostPipes[i].topV, guestPipes[i].topV, 'Flappy boru dikey yüksekliği %100 aynı olmalı');
      assert.ok(Math.abs(hostPipes[i].nx - guestPipes[i].nx) <= 0.015, `Flappy normalize boru X konumu eşleşmeli (${hostPipes[i].nx} vs ${guestPipes[i].nx})`);
    }

    // Rakip kuş normalize Y konumu kontrolü: Guest y = 0.30 * playH() -> Host ekranında oppBird.ty ~= 0.30 * host.playH()
    const hostExpectedOppY = host.eval('playH() * 0.3');
    const hostActualOppTy = host.eval('MP.oppBird.ty');
    assert.ok(Math.abs(hostActualOppTy - hostExpectedOppY) < 2.0, 'Flappy rakip kuş normalize dikey konumu farklı ekranlarda eşleşmeli');

    console.log('✅ FLAPPY ONLINE SENKRON TESTİ GEÇTİ (Boru tipleri, RNG, normalize X/Y %100 senkron)');
  }

  // =========================================================================
  // 2) YILAN ONLINE SENKRON TESTİ (420x700 PC <-> 360x640 Mobil)
  // =========================================================================
  {
    const MockPeer = createPeerBroker();
    const host = createClientSandbox('snake.js', 420, 700, MockPeer);
    const guest = createClientSandbox('snake.js', 360, 640, MockPeer);

    host.eval('S.mode = "portal"; mpHost();');
    await flushMicrotasks();
    const code = host.eval('MP.roomCode');
    guest.sandbox.document.getElementById('mp-code-input').value = code;
    guest.eval('mpJoinConfirm()');
    await flushMicrotasks();

    assert.strictEqual(host.eval('MP.connected'), true, 'Snake Host bağlı olmalı');
    assert.strictEqual(guest.eval('MP.connected'), true, 'Snake Guest bağlı olmalı');
    bothReady(host, guest);
    assert.strictEqual(guest.eval('currentMode'), 'portal', 'Snake Guest Host oyun modunu (portal) almalı');

    // İlk yem her iki ekranda birebir aynı hücrede olmalı
    assert.strictEqual(JSON.stringify(host.eval('food')), JSON.stringify(guest.eval('food')), 'Snake başlangıç elması iki ekranda aynı olmalı');

    // Geri sayımı bitir (185 kare) + birkaç adım ilerlet (çarpışmasız başlangıç kontrolü)
    for (let i = 0; i < 210; i++) {
      host.stepFrame();
      guest.stepFrame();
    }
    assert.strictEqual(host.eval('state === STATE.PLAYING'), true, 'Snake Host PLAYING kalmalı');
    assert.strictEqual(guest.eval('state === STATE.PLAYING'), true, 'Snake Guest PLAYING kalmalı');
    assert.ok(guest.eval('MP.oppSnake.length >= 3'), 'Snake Guest Host yılan gövdesini almalı');
    assert.ok(host.eval('MP.oppSnake.length >= 3'), 'Snake Host Guest yılan gövdesini almalı');

    // 3 kez elma yedirelim (1. Host, 2. Guest, 3. Guest) -> hem ana yem hem 3. elmadaki bonus meyve senkron olmalı!
    for (let k = 0; k < 3; k++) {
      const eater = k === 0 ? host : guest;
      // bonus kesin çıksın diye Host bonusRng'yi küçük değer döndürecek şekilde test edelim
      if (k === 2) host.eval('bonusRng = mulberry32(42);');
      eater.eval('snake[0] = { x: food.x - dir.x, y: food.y - dir.y }; step();');
      assert.strictEqual(JSON.stringify(host.eval('food')), JSON.stringify(guest.eval('food')), `Snake ${k + 1}. elma sonrası yeni yem iki ekranda aynı olmalı`);
    }

    // Eğer bonusItem oluştuysa her iki ekranda birebir aynı olmalı ve Guest yediğinde Host'ta da silinmeli!
    const hostBonus = host.eval('bonusItem');
    const guestBonus = guest.eval('bonusItem');
    assert.strictEqual(JSON.stringify(hostBonus), JSON.stringify(guestBonus), 'Snake süreli bonus meyve Host ve Guest ekranında birebir aynı olmalı');
    if (guestBonus) {
      guest.eval('snake[0] = { x: bonusItem.x - dir.x, y: bonusItem.y - dir.y }; step();');
      assert.strictEqual(host.eval('bonusItem'), null, 'Guest bonus meyveyi yediğinde Host ekranında da anında silinmeli');
    }

    // Rakip elendiğinde ganimet elmaları düşmeli
    guest.eval('mpOnDeath()');
    assert.strictEqual(host.eval('MP.oppAlive'), false, 'Guest ölünce Host oppAlive=false olmalı');
    assert.ok(host.eval('lootApples.length > 0'), 'Guest ölünce Host haritasına ganimet elmaları saçılmalı');

    console.log('✅ YILAN ONLINE SENKRON TESTİ GEÇTİ (Mod, sıralı elma, bonus meyve, gövde & ganimet %100 senkron)');
  }

  // =========================================================================
  // 3) PONG ONLINE SENKRON TESTİ (420x700 PC <-> 360x640 Mobil)
  // =========================================================================
  {
    const MockPeer = createPeerBroker();
    const host = createClientSandbox('pong.js', 420, 700, MockPeer);
    const guest = createClientSandbox('pong.js', 360, 640, MockPeer);

    host.eval('mpHost()');
    await flushMicrotasks();
    const code = host.eval('MP.roomCode');
    guest.sandbox.document.getElementById('mp-code-input').value = code;
    guest.eval('mpJoinConfirm()');
    await flushMicrotasks();

    assert.strictEqual(host.eval('MP.connected'), true, 'Pong Host bağlı olmalı');
    assert.strictEqual(guest.eval('MP.connected'), true, 'Pong Guest bağlı olmalı');
    bothReady(host, guest);

    // 3sn geri sayımı bitir
    for (let i = 0; i < 185; i++) {
      host.stepFrame();
      guest.stepFrame();
    }
    assert.strictEqual(host.eval('state === STATE.PLAYING'), true, 'Pong Host PLAYING olmalı');
    assert.strictEqual(guest.eval('state === STATE.PLAYING'), true, 'Pong Guest PLAYING olmalı');

    // 40 kare ralli simülasyonu + Guest mobil raketini yukarı taşısın
    guest.eval('left.target = 80;');
    for (let i = 0; i < 40; i++) {
      host.stepFrame();
      guest.stepFrame();
    }

    // Yatay ayna kontrolü: Host nx + Guest nx ~= 1.0 olmalı!
    const hostNx = host.eval('ball.x / W');
    const guestNx = guest.eval('ball.x / W');
    assert.ok(Math.abs((hostNx + guestNx) - 1.0) < 0.025, `Pong ayna top X konumu toplamı ~1.0 olmalı (${hostNx.toFixed(3)} + ${guestNx.toFixed(3)})`);

    const hostNy = host.eval('ball.y / H');
    const guestNy = guest.eval('ball.y / H');
    assert.ok(Math.abs(hostNy - guestNy) < 0.02, 'Pong normalize top Y konumu farklı çözünürlüklerde eşleşmeli');

    // Guest sol raketi yukarı çıktığında Host'un sağ raketi de aynı normalize oranda yukarı çıkmalı
    const guestPadNorm = guest.eval('left.y / (H - padH)');
    const hostOppPadNorm = host.eval('right.y / (H - padH)');
    assert.ok(Math.abs(guestPadNorm - hostOppPadNorm) < 0.06, 'Pong raket normalize Y pozisyonları eşleşmeli');

    // Host gol attığında: Host ekranında 1:0, Guest ekranında 0:1 görünmeli!
    host.eval('ball.x = W + 40;');
    for (let i = 0; i < 4; i++) {
      host.stepFrame();
      guest.stepFrame();
    }
    assert.strictEqual(host.eval('scL'), 1, 'Host gol sonrası scL=1 olmalı');
    assert.strictEqual(guest.eval('scL'), 0, 'Guest açısından kendi skoru scL=0 olmalı');
    assert.strictEqual(guest.eval('scR'), 1, 'Guest açısından rakip skoru scR=1 olmalı');

    console.log('✅ PONG ONLINE SENKRON TESTİ GEÇTİ (1-nx ayna fizik, normalize hız/raket, ters skor %100 senkron)');
  }

  // =========================================================================
  // 4) MOBİL SEKMEDEN ÇIKMA (WHATSAPP KOD PAYLAŞIMI) KURTARMA TESTİ
  // =========================================================================
  for (const scriptFile of ['game.js', 'snake.js', 'pong.js']) {
    const MockPeer = createPeerBroker();
    const host = createClientSandbox(scriptFile, 360, 640, MockPeer);
    const guest = createClientSandbox(scriptFile, 360, 640, MockPeer);

    host.eval('mpHost()');
    await flushMicrotasks();
    const savedCode = host.eval('MP.roomCode');

    // Ev sahibi WhatsApp'a geçince tarayıcı soketi düşürür ve PeerJS 'network' hatası fırlatır:
    host.eval('MP.peer.destroy(); MP.peer.emit("error", { type: "network" });');
    await flushMicrotasks();

    // Oda kodu ASLA '-----' olmamalı ve kırmızı hata basmamalı!
    assert.strictEqual(host.sandbox.document.getElementById('mp-room-code').textContent, savedCode, `${scriptFile}: Sekmeden çıkınca oda kodu silinmemeli`);
    assert.strictEqual(host.sandbox.document.getElementById('mp-error').textContent, '', `${scriptFile}: Sekmeden çıkınca network hatası ekrana basılmamalı`);

    // Bu sırada arkadaşı kodu girip Katıl'a basar (ev sahibi henüz sekmede değil -> ilk deneme boşta kalır ama otomatik tekrar bekler)
    guest.sandbox.document.getElementById('mp-code-input').value = savedCode;
    guest.eval('mpJoinConfirm()');
    await flushMicrotasks();
    assert.strictEqual(guest.eval('MP.connected'), false, `${scriptFile}: Ev sahibi yokken henüz bağlanmamalı`);

    // Ev sahibi WhatsApp'tan sekmeye geri döner -> AYNI ODA KODUYLA yeniden kayıt olur!
    host.eval('mpEnsureHostAlive(true)');
    await flushMicrotasks();

    // Arkadaşının otomatik yeniden denemesi çalışır ve AYNI KODLA eşleşirler!
    guest.eval('mpAttemptJoin()');
    await flushMicrotasks();

    assert.strictEqual(host.eval('MP.connected'), true, `${scriptFile}: Sekmeye dönünce aynı kodla Host bağlanmalı`);
    assert.strictEqual(guest.eval('MP.connected'), true, `${scriptFile}: Sekmeye dönünce aynı kodla Guest bağlanmalı`);
  }
  console.log('✅ MOBİL SEKMEDEN ÇIKIP DÖNME (NETWORK HATASI & ODA BULUNAMADI KURTARMA) TESTİ 3 OYUNDA DA GEÇTİ!');

  // =========================================================================
  // 5) 1. OYUNCU ÖLÜNCE 2. OYUNCUYU CANLI İZLEME (SPECTATOR MODE) TESTİ
  // =========================================================================
  {
    // A) Flappy Kuş Canlı İzleyici Modu
    const MockPeer = createPeerBroker();
    const p1 = createClientSandbox('game.js', 420, 700, MockPeer);
    const p2 = createClientSandbox('game.js', 360, 640, MockPeer);

    p1.eval('mpHost()');
    await flushMicrotasks();
    p2.sandbox.document.getElementById('mp-code-input').value = p1.eval('MP.roomCode');
    p2.eval('mpJoinConfirm()');
    await flushMicrotasks();
    bothReady(p1, p2);

    for (let i = 0; i < 190; i++) { p1.stepFrame(); p2.stepFrame(); }

    // P1 boruya çarpar (die(false) -> DYING -> GAMEOVER -> MP.spectating = true)
    p1.eval('die(false)');
    for (let i = 0; i < 60; i++) {
      p2.eval('bird.y = playH() * 0.42; bird.vy = 0; phaseFrames = 10;');
      p1.stepFrame();
      p2.stepFrame();
    }
    assert.strictEqual(p1.eval('MP.spectating'), true, 'Flappy: P1 ölünce MP.spectating aktif olmalı');
    assert.strictEqual(p1.sandbox.document.getElementById('mp-gameover-screen').classList.contains('hidden'), true, 'Flappy: P2 hayattayken sonuç ekranı kapalı kalmalı');

    // 140 kare boyunca P1 izleyici modunda P2'yi izlesin — borular hala %100 senkron akmalı!
    for (let i = 0; i < 140; i++) {
      p2.eval('bird.y = playH() * 0.35; bird.vy = 0; phaseFrames = 10;');
      p1.stepFrame();
      p2.stepFrame();
    }
    const p1Pipes = p1.eval('pipes.map(p => +(p.x / W).toFixed(3))');
    const p2Pipes = p2.eval('pipes.map(p => +(p.x / W).toFixed(3))');
    assert.strictEqual(p1Pipes.length, p2Pipes.length, 'Flappy İzleyici: boru sayıları eşleşmeli');
    for (let i = 0; i < p1Pipes.length; i++) {
      assert.ok(Math.abs(p1Pipes[i] - p2Pipes[i]) <= 0.015, 'Flappy İzleyici: P1 öldükten sonra da borular P2 ile %100 senkron akmalı');
    }

    // Şimdi P2 de ölsün -> P1 çarpma animasyonunu izleyip (specEndFrames) sonuç ekranına geçmeli!
    p2.eval('die(true)');
    for (let i = 0; i < 45; i++) { p1.stepFrame(); p2.stepFrame(); }
    assert.strictEqual(p1.eval('MP.spectating'), false, 'Flappy: P2 de ölünce izleyici modu kapanmalı');
    assert.strictEqual(p1.sandbox.document.getElementById('mp-gameover-screen').classList.contains('hidden'), false, 'Flappy: İki oyuncu da ölünce sonuç ekranı açılmalı');

    // B) Yılan Canlı İzleyici Modu
    const MockPeer2 = createPeerBroker();
    const s1 = createClientSandbox('snake.js', 420, 700, MockPeer2);
    const s2 = createClientSandbox('snake.js', 360, 640, MockPeer2);

    s1.eval('mpHost()');
    await flushMicrotasks();
    s2.sandbox.document.getElementById('mp-code-input').value = s1.eval('MP.roomCode');
    s2.eval('mpJoinConfirm()');
    await flushMicrotasks();
    bothReady(s1, s2);

    for (let i = 0; i < 195; i++) { s1.stepFrame(); s2.stepFrame(); }

    // S1 ölür -> 26 kare sonra MP.spectating = true ve ekran açık kalır!
    s1.eval('die()');
    for (let i = 0; i < 35; i++) { s1.stepFrame(); s2.stepFrame(); }
    assert.strictEqual(s1.eval('MP.spectating'), true, 'Snake: S1 ölünce MP.spectating aktif olmalı');
    assert.strictEqual(s1.sandbox.document.getElementById('mp-gameover-screen').classList.contains('hidden'), true, 'Snake: S2 hayattayken sonuç ekranı kapalı kalmalı');

    // S2 elma yerken S1 canlı izler ve yem senkron ilerler
    s2.eval('snake[0] = { x: food.x - dir.x, y: food.y - dir.y }; step();');
    assert.strictEqual(JSON.stringify(s1.eval('food')), JSON.stringify(s2.eval('food')), 'Snake İzleyici: S2 elma yediğinde S1 ekranında da yeni elma görünmeli');

    // S2 de ölünce S1'de sonuç ekranı açılmalı!
    s2.eval('die()');
    for (let i = 0; i < 70; i++) { s1.stepFrame(); s2.stepFrame(); }
    assert.strictEqual(s1.eval('MP.spectating'), false, 'Snake: S2 de ölünce izleyici modu bitmeli');
    assert.strictEqual(s1.sandbox.document.getElementById('mp-gameover-screen').classList.contains('hidden'), false, 'Snake: İki oyuncu da ölünce sonuç ekranı açılmalı');

    console.log('✅ CANLI İZLEYİCİ MODU (SPECTATOR MODE) TESTİ FLAPPY VE YILAN İÇİN GEÇTİ!');
  }

  // =========================================================================
  // 6) KATEGORİ 1: 4G/5G TURN ICE HAVUZU, SAF JS QR KOD & CANLI PING ÖLÇÜMÜ
  // =========================================================================
  {
    const MockPeer = createPeerBroker();
    const host = createClientSandbox('game.js', 420, 700, MockPeer);
    const guest = createClientSandbox('game.js', 360, 640, MockPeer);

    // A) TURN + Çoklu STUN yapılandırması doğrulaması
    const hasTurnTcp = host.eval('MPCore.PEER_OPTS.config.iceServers.some(s => Array.isArray(s.urls) && s.urls.some(u => u.includes("turn:openrelay.metered.ca:443?transport=tcp")))');
    assert.strictEqual(hasTurnTcp, true, '4G/5G CGNAT için TCP 443 TURN sunucusu tanımlı olmalı');

    // B) Saf JS ISO/IEC 18004 QR Kod matris ve köşe bulucu (finder pattern) doğrulaması
    const qrCheck = host.eval(`(() => {
      const q = MPCore.encodeQRMatrix("https://example.com/flappy.html?room=KZ84P");
      if (!q || !q.modules || q.size < 29) return false;
      const m = q.modules, N = q.size;
      // 3 köşedeki 7x7 finder pattern merkezleri (3,3), (3,N-4), (N-4,3) koyu (1) olmalı
      return m[3][3] === 1 && m[3][N - 4] === 1 && m[N - 4][3] === 1 && m[0][0] === 1 && m[1][1] === 0;
    })()`);
    assert.strictEqual(qrCheck, true, 'Saf JS QR Kod üretici geçerli ISO finder desenleri üretmeli');

    // C) Canlı Ping (RTT) ölçümü & kalite rozeti
    host.eval('mpHost()');
    await flushMicrotasks();
    guest.sandbox.document.getElementById('mp-code-input').value = host.eval('MP.roomCode');
    guest.eval('mpJoinConfirm()');
    await flushMicrotasks();

    // Saati 42ms ilerletip ping gönderelim -> _pong anında dönerken simNow - ts = 42ms ölçmeli!
    host.eval('MP.pingMs = 0;');
    const tsSent = host.eval('Math.round(performance.now())');
    host.advanceClock(42);
    host.eval(`MP.conn.emit('data', { t: '_pong', ts: ${tsSent} })`);
    const measuredPing = host.eval('Math.round(MP.pingMs)');
    assert.strictEqual(measuredPing, 42, 'Canlı Ping RTT milisaniye ölçümü doğru hesaplanmalı');
    assert.strictEqual(host.eval('MPCore.pingInfo(MP.pingMs).cls'), 'ping-good', '42ms ping yeşil (ping-good) kalitede olmalı');

    console.log('✅ KATEGORİ 1 (TURN ICE HAVUZU, SAF JS QR KOD & CANLI PING RTT) TESTİ GEÇTİ!');
  }

  // =========================================================================
  // 7) KATEGORİ 2: HAZIRLIK LOBİSİ, ODA AYARLARI SENKRONU & OYUN DEĞİŞTİRME
  // =========================================================================
  {
    const MockPeer = createPeerBroker();
    const hostSess = {};
    const guestSess = {};
    const fHost = createClientSandbox('game.js', 420, 700, MockPeer, hostSess);
    const fGuest = createClientSandbox('game.js', 360, 640, MockPeer, guestSess);

    fHost.sandbox.document.getElementById('mp-name-input').value = 'Kaptan';
    fGuest.sandbox.document.getElementById('mp-name-input').value = 'Dost';

    fHost.eval('mpHost()');
    await flushMicrotasks();
    const originalRoomCode = fHost.eval('MP.roomCode');
    fGuest.sandbox.document.getElementById('mp-code-input').value = originalRoomCode;
    fGuest.eval('mpJoinConfirm()');
    await flushMicrotasks();

    // Sadece tek taraf Hazır dediğinde maç başlamamalı!
    fHost.eval('mpSetReady(true)');
    assert.strictEqual(fHost.eval('MP.inLobby'), true, 'Tek oyuncu hazırken hala lobide beklenmeli');
    assert.strictEqual(fGuest.eval('MP.oppReady'), true, 'Guest Host hazır bilgisini görmeli');

    // Seri skoru 2-1 iken Host odayı bozmadan PONG oyununa geçiş başlatsın (_switch_game + _switch_ack)!
    fHost.eval('MP.seriesMe = 2; MP.seriesOpp = 1; mpSwitchGame("pong");');
    await new Promise(r => setTimeout(r, 110));
    assert.strictEqual(fHost.sandbox.location.href, 'pong.html', 'Host pong.html sayfasına yönlenmeli');
    assert.strictEqual(fGuest.sandbox.location.href, 'pong.html', 'Guest otomatik pong.html sayfasına yönlenmeli');

    // Şimdi iki istemci de aynı sessionStorage ile pong.js yüklesin -> AYNI KODLA otomatik bağlanmalılar!
    const pHost = createClientSandbox('pong.js', 420, 700, MockPeer, hostSess);
    await flushMicrotasks();
    const pGuest = createClientSandbox('pong.js', 360, 640, MockPeer, guestSess);
    await flushMicrotasks();

    assert.strictEqual(pHost.eval('MP.roomCode'), originalRoomCode, 'Pong Host aynı 5 haneli oda kodunu korumalı');
    assert.strictEqual(pGuest.eval('MP.roomCode'), originalRoomCode, 'Pong Guest aynı 5 haneli oda koduna otomatik katılmalı');
    assert.strictEqual(pHost.eval('MP.connected && MP.inLobby'), true, 'Pong Host otomatik bağlanıp Hazırlık Lobisini açmalı');
    assert.strictEqual(pGuest.eval('MP.connected && MP.inLobby'), true, 'Pong Guest otomatik bağlanıp Hazırlık Lobisini açmalı');
    assert.strictEqual(pHost.eval('MP.seriesMe'), 2, 'Seri skoru oyun değiştirince korunmalı (Host)');
    assert.strictEqual(pGuest.eval('MP.seriesMe'), 1, 'Seri skoru oyun değiştirince ters perspektifle korunmalı (Guest)');

    // Host lobide Pong Hedef Skorunu 5, Temayı 'synth' yapsın -> Guest anında görmeli!
    pHost.eval('MP.lobbyWinScore = 5; MP.lobbyTheme = "synth"; P.theme = "synth"; mpSend({ t: "lobby_cfg", winScore: 5, theme: "synth", name: MP.myName });');
    assert.strictEqual(pGuest.eval('MP.lobbyWinScore'), 5, 'Guest lobide hedef skorun 5 olduğunu canlı görmeli');
    assert.strictEqual(pGuest.eval('P.theme'), 'synth', 'Guest lobide Synth temasını canlı almalı');

    bothReady(pHost, pGuest);
    assert.strictEqual(pHost.eval('currentWinScore'), 5, 'Maç başlayınca hedef skor 5 olarak uygulanmalı (Host)');
    assert.strictEqual(pGuest.eval('currentWinScore'), 5, 'Maç başlayınca hedef skor 5 olarak uygulanmalı (Guest)');

    console.log('✅ KATEGORİ 2 (HAZIRLIK LOBİSİ, AYAR SENKRONU & OYUNLAR ARASI ODA TAŞIMA) TESTİ GEÇTİ!');
  }

  // =========================================================================
  // 8) KATEGORİ 1: MAÇ İÇİ 12SN KOPMA KORUMASI (GRACE RECONNECT & AUTO-RESUME)
  // =========================================================================
  {
    const MockPeer = createPeerBroker();
    const host = createClientSandbox('game.js', 420, 700, MockPeer);
    const guest = createClientSandbox('game.js', 360, 640, MockPeer);

    host.eval('mpHost()');
    await flushMicrotasks();
    guest.sandbox.document.getElementById('mp-code-input').value = host.eval('MP.roomCode');
    guest.eval('mpJoinConfirm()');
    await flushMicrotasks();
    bothReady(host, guest);

    for (let i = 0; i < 190; i++) { host.stepFrame(); guest.stepFrame(); }
    host.eval('score = 9; bird.y = playH() * 0.45; bird.vy = 0;');
    guest.eval('score = 6; bird.y = playH() * 0.45; bird.vy = 0;');
    host.eval('mpOnScore()');
    guest.eval('mpOnScore()');

    // Maçın tam ortasında anlık bildirim / ağ geçişi yüzünden WebRTC kanalı kopsun!
    const frozenY = host.eval('bird.y');
    MockPeer.offline = true;
    host.eval('MP.conn.close()');
    await flushMicrotasks();

    // Oyuncular menüye ATILMAMALI — 12sn Grace Reconnect moduna girmeli ve fizik donmalı!
    assert.strictEqual(host.eval('MP.reconnecting'), true, 'Maç içi kopmada Host MP.reconnecting moduna girmeli');
    assert.strictEqual(guest.eval('MP.reconnecting'), true, 'Maç içi kopmada Guest MP.reconnecting moduna girmeli');
    assert.strictEqual(host.eval('state === STATE.PLAYING'), true, 'Host menüye atılmamalı, PLAYING korunmalı');

    // 10 kare ilerletelim: fizik duraklatıldığı için kuş düşmemeli!
    for (let i = 0; i < 10; i++) { host.stepFrame(); }
    assert.strictEqual(host.eval('bird.y'), frozenY, 'Yeniden bağlanma beklenirken kuş fiziği duraklatılmalı');

    // Ağ geri geldiğinde otomatik yeniden bağlanma gerçekleşsin:
    MockPeer.offline = false;
    host.eval('mpEnsureHostAlive(true)');
    await flushMicrotasks();
    guest.eval('mpAttemptJoin()');
    await flushMicrotasks();

    assert.strictEqual(host.eval('MP.connected && !MP.reconnecting'), true, 'Host kopma sonrası kaldığı yerden bağlanmalı');
    assert.strictEqual(guest.eval('MP.connected && !MP.reconnecting'), true, 'Guest kopma sonrası kaldığı yerden bağlanmalı');
    assert.strictEqual(host.eval('score'), 9, 'Host skoru (9) kopma sonrası korunmalı');
    assert.strictEqual(guest.eval('score'), 6, 'Guest skoru (6) kopma sonrası korunmalı');
    assert.strictEqual(host.eval('MP.oppScore'), 6, 'Host rakip skorunu (6) _resume ile geri almalı');

    console.log('✅ KATEGORİ 1 (MAÇ İÇİ 12SN KOPMA KORUMASI & KALDIĞI YERDEN DEVAM ETME) TESTİ GEÇTİ!');
  }

  // =========================================================================
  // 9) KATEGORİ 4: RTT/2 GERİ SAYIM TELAFİSİ & PONG İSTEMCİ TAHMİNİ (PREDICTION)
  // =========================================================================
  {
    const MockPeer = createPeerBroker();
    const host = createClientSandbox('pong.js', 420, 700, MockPeer);
    const guest = createClientSandbox('pong.js', 360, 640, MockPeer);

    host.eval('mpHost()');
    await flushMicrotasks();
    guest.sandbox.document.getElementById('mp-code-input').value = host.eval('MP.roomCode');
    guest.eval('mpJoinConfirm()');
    await flushMicrotasks();

    // Guest'te 100ms RTT ping varken (tek yön = 50ms = 3 kare) maç başlasın:
    guest.eval('MP.pingMs = 100;');
    bothReady(host, guest);
    assert.strictEqual(host.eval('mpCountdown'), 180, 'Host 180 kareden geri saymalı');
    assert.strictEqual(guest.eval('mpCountdown'), 177, 'Guest 100ms RTT için 50ms (3 kare) düşerek 177 kareden başlamalı');

    // Geri sayımı bitirip PLAYING durumuna geçelim
    for (let i = 0; i < 185; i++) { host.stepFrame(); guest.stepFrame(); }

    // Top Guest'in sol raketine çarpmak üzereyken (vx < 0) Guest raketi topun hizasında olsun:
    guest.eval(`
      left.y = 220; left.target = 220; left.vy = -4;
      ball.x = padX1 + padW + ball.r - 1;
      ball.y = 220 + padH * 0.5;
      ball.vx = -7.5;
      ball.vy = 1.0;
      ball.speed = 7.6;
      MP.ballFresh = true;
    `);
    guest.eval('mpStepPhysics()');

    // Host paketini beklemeden (0ms gecikmeyle!) Guest topu anında sağa sektirmeli!
    assert.ok(guest.eval('ball.vx > 0'), 'Pong Guest sol raket vuruşunu 0ms gecikmeyle yerel tahmin etmeli (vx > 0)');
    assert.strictEqual(guest.eval('MP.localBounceCooldown'), 12, 'Pong Guest yerel vuruş koruma sayacını başlatmalı');
    assert.strictEqual(guest.eval('hitGlowL'), 1, 'Pong Guest raket parlama efektini anında tetiklemeli');

    // Hemen 1 kare sonra Host'tan henüz vuruş öncesi gecikmiş bir paket (Host açısından sağa = nvx > 0 -> Guest açısından sola = rxVx < 0) gelse bile ezmemeli!
    guest.eval(`MP.conn.emit('data', { t: 'ball', nx: 0.90, ny: 0.4, nvx: 0.018, nvy: 0.002, sp: 0, sl: 0, sr: 0, st: 3 })`);
    assert.ok(guest.eval('ball.vx > 0'), 'Gecikmiş eski yönlü Host paketi Guest yerel raket vuruşunu geri sarmamalı');

    console.log('✅ KATEGORİ 4 (RTT/2 GERİ SAYIM TELAFİSİ & PONG İSTEMCİ TAHMİNİ) TESTİ GEÇTİ!');
  }

  // =========================================================================
  // 10) EV SAHİBİ ANINDA OYUN SEÇİMİ & ÇAPRAZ ODA OTOMATİK YÖNLENDİRME (_redirect)
  // =========================================================================
  {
    const MockPeer = createPeerBroker();
    const hostSess = {};
    const guestSess = {};

    // Senaryo A: Ev sahibi Ana Salon'da oda kurup daha konuk gelmeden hemen Yılan'ı seçsin!
    const hubHost = createClientSandbox('hub.js', 420, 700, MockPeer, hostSess);
    hubHost.sandbox.document.getElementById('mp-host-btn').dispatchEvent
      ? null : null;
    // Oda kurulsun ve henüz konuk yokken Flappy/Pong'da test edelim:
    const fHost = createClientSandbox('game.js', 420, 700, MockPeer, hostSess);
    fHost.eval('mpHost()');
    await flushMicrotasks();
    const code = fHost.eval('MP.roomCode');

    // Ev sahibi daha konuk bağlanmadan doğrudan Yılan'ı seçebilmeli!
    fHost.eval('mpSwitchGame("snake")');
    assert.strictEqual(fHost.sandbox.location.href, 'snake.html', 'Ev sahibi konuk gelmeden de oyun seçebilmeli');

    // Ev sahibi Yılan odasını aynı kodla açsın:
    const sHost = createClientSandbox('snake.js', 420, 700, MockPeer, hostSess);
    await flushMicrotasks();
    assert.strictEqual(sHost.eval('MP.roomCode'), code, 'Yılan odası aynı 5 haneli kodu korumalı');

    // Senaryo B: Konuk yanlışlıkla Pong ekranından bu kodu girse bile Yılan odasını otomatik bulup geçmeli!
    const wrongGameGuest = createClientSandbox('pong.js', 360, 640, MockPeer, guestSess);
    wrongGameGuest.sandbox.document.getElementById('mp-code-input').value = code;
    wrongGameGuest.eval('mpJoinConfirm()');
    await new Promise(r => setTimeout(r, 80));
    assert.strictEqual(wrongGameGuest.sandbox.location.href, 'snake.html', 'Farklı ekrandan kod giren konuk otomatik Yılan odasına yönlenmeli');

    // Konuk snake.html yüklediğinde Ev Sahibi ile otomatik bağlanmalı!
    const sGuest = createClientSandbox('snake.js', 360, 640, MockPeer, guestSess);
    await flushMicrotasks();
    assert.strictEqual(sHost.eval('MP.connected && MP.inLobby'), true, 'Ev sahibi ve konuk Yılan lobisinde buluşmalı (Host)');
    assert.strictEqual(sGuest.eval('MP.connected && MP.inLobby'), true, 'Ev sahibi ve konuk Yılan lobisinde buluşmalı (Guest)');

    console.log('✅ EV SAHİBİ OYUN SEÇİMİ & ÇAPRAZ ODA OTOMATİK YÖNLENDİRME TESTİ GEÇTİ!');
  }

  console.log('\n🎉 TÜM OYUNLARIN ÇEVRİMİÇİ (ONLINE) SENKRONİZASYON TESTLERİ KUSURSUZ GEÇTİ!');
})().catch(err => {
  console.error('TEST HATASI:', err);
  process.exit(1);
});
