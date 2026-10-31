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
    connect(targetId) {
      const hostPeer = peers.get(targetId);
      const guestConn = new MockConn();
      if (!hostPeer) {
        Promise.resolve().then(() => this.emit('error', { type: 'peer-unavailable' }));
        return guestConn;
      }
      const hostConn = new MockConn();
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

  return MockPeer;
}

function createClientSandbox(scriptFile, width, height, MockPeer) {
  const noop = () => {};
  const makeEl = () => {
    const classes = new Set(['hidden']);
    return {
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
      getBoundingClientRect: () => ({ left: 0, top: 0, width, height }),
      parentElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width, height }) }
    };
  };

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

  const els = {};
  const canvasEl = { ...makeEl(), getContext: () => ctx2d, width, height };
  let simNow = 0;
  let rafCb = null;
  const store = {};

  const sandbox = {
    console,
    Math, Date, JSON, Object, Array, String, Number, Boolean, Set, Map, Promise,
    parseInt, parseFloat, isNaN,
    Peer: MockPeer,
    performance: { now: () => simNow },
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); }
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
    location: { href: '' },
    requestAnimationFrame: cb => { rafCb = cb; return 1; },
    setTimeout: fn => { /* kontrollü test */ return 0; },
    clearTimeout: noop,
    setInterval: () => 0,
    clearInterval: noop
  };
  sandbox.window.document = sandbox.document;

  // global let/const değişkenlerini okuyabilmek için yardımcı erişimciler ekleyelim
  const code = fs.readFileSync(path.join(__dirname, scriptFile), 'utf8') + `
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

  console.log('\n🎉 TÜM OYUNLARIN ÇEVRİMİÇİ (ONLINE) SENKRONİZASYON TESTLERİ KUSURSUZ GEÇTİ!');
})().catch(err => {
  console.error('TEST HATASI:', err);
  process.exit(1);
});
