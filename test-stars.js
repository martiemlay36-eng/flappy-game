// test-stars.js — Yıldız Yakalama & Balon Patlatma Birim, Mantık ve Çalışma Zamanı Testi
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const noop = () => {};
const makeEl = () => ({
  classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  addEventListener: noop,
  querySelector: () => makeEl(),
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 420, height: 700 }),
  textContent: '', innerHTML: '', value: '', style: {}, disabled: false,
  parentElement: { getBoundingClientRect: () => ({ width: 420, height: 700 }) },
  dataset: {}, appendChild: noop, insertBefore: noop
});

const ctx2d = {
  setTransform: noop,
  createLinearGradient: () => ({ addColorStop: noop }),
  createRadialGradient: () => ({ addColorStop: noop }),
  fillRect: noop, strokeRect: noop, beginPath: noop, arc: noop, arcTo: noop,
  ellipse: noop, moveTo: noop, lineTo: noop, quadraticCurveTo: noop, closePath: noop,
  fill: noop, stroke: noop, fillText: noop, strokeText: noop, save: noop, restore: noop,
  translate: noop, rotate: noop, scale: noop, setLineDash: noop, measureText: () => ({ width: 32 })
};

const store = {
  'oyun-salonu-v2': JSON.stringify({
    soundOn: true,
    musicOn: false,
    volume: 0.65,
    flappy: { bestScore: 50, coins: 140, playerName: 'Ahmet' },
    snake: { bestScore: 90, coins: 80 },
    pong: { wins: 8, bestDiff: 10 },
    space: { bestScore: 3500 }
  })
};

const els = {};
const canvasEl = { ...makeEl(), getContext: () => ctx2d, width: 420, height: 700 };

global.document = {
  getElementById: id => id === 'game-canvas' ? canvasEl : (els[id] = els[id] || makeEl()),
  querySelectorAll: () => [],
  addEventListener: noop,
  createElement: () => makeEl(),
  hidden: false
};
global.window = { devicePixelRatio: 1, addEventListener: noop, AudioContext: undefined };
global.navigator = { clipboard: { writeText: noop } };
global.location = { href: 'http://localhost/stars.html', search: '', pathname: '/stars.html' };
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); }
};
global.sessionStorage = { getItem: () => null, setItem: noop, removeItem: noop };
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => 0;

// Beklenmeyen hata anında yakalanıp testi başarısız yapsın!
const origConsoleError = console.error;
console.error = (...args) => {
  origConsoleError(...args);
  throw new Error('Beklenmeyen console.error: ' + args.map(String).join(' '));
};

const mpCoreCode = fs.readFileSync(path.join(__dirname, 'mp-core.js'), 'utf8');
const starsCode = fs.readFileSync(path.join(__dirname, 'stars.js'), 'utf8');

vm.runInThisContext(mpCoreCode);
vm.runInThisContext(starsCode);

console.log('1) YUKLEME: OK — miras alinan oyuncu adi =', ST.playerName);
assert.strictEqual(ST.playerName, 'Ahmet', 'Flappy kaydindaki isim cocuk oyununa miras alinmali');

// 2) Baslatma & Dokunmatik Sepet Hareketi
startGame();
assert.strictEqual(state, STATE.PLAYING, 'startGame sonrasi oyun PLAYING olmali');

onPointerDown(280, 600);
onPointerMove(310, 600);
onPointerUp();
for (let i = 0; i < 15; i++) stepWorld();
assert.ok(catcher.x > 210, 'Sepet saga dokunuldugunda saga hareket etmeli');
console.log('2) SEPET DOKUNMATIK SURUKLEME HAREKETI: OK');

// 3) 🎈 Balon Dokunma ve Patlatma Mekanigi
balloons = [
  { x: 150, y: 300, vy: -1.5, r: 22, sway: 0, color: '#ff595e', isGift: false },
  { x: 260, y: 350, vy: -1.5, r: 25, sway: 0, color: '#ff70a6', isGift: true }
];
const poppedNorm = tryPopBalloonAt(150, 300);
assert.strictEqual(poppedNorm, true, 'Dokunulan normal balon patlamali');
assert.ok(score > 0, 'Balon patlatma puan vermeli');
assert.strictEqual(ST.stats.balloonsPopped, 1, 'Patlatilan balon istatistigi artmali');

const poppedGift = tryPopBalloonAt(260, 350);
assert.strictEqual(poppedGift, true, 'Dokunulan surpriz hediye balonu patlamali');
assert.strictEqual(ST.stats.giftsOpened, 1, 'Surpriz hediye istatistigi artmali');
assert.ok(items.length >= 6, 'Hediye balonu etrafa yildiz & sekerler sacmali');
console.log('3) 🎈 BALON DOKUNUP PATLATMA & SURPRIZ HEDIYE: OK');

// 4) ⭐ Yildiz & Guclendirme Nesneleri (Star, Superstar, Rainbow, Giant, Party, Heart)
items = [];
collectItem({ kind: 'star', x: catcher.x, y: catcher.y, r: 17, color: '#ffd166' });
assert.strictEqual(ST.stats.starsCaught, 1, 'Yildiz yakalama istatistigi artmali');
assert.strictEqual(combo, 1, 'Yildiz yakalayinca kombo serisi baslamali');

collectItem({ kind: 'superstar', x: catcher.x, y: catcher.y, r: 21, color: '#ff9f1c' });
assert.strictEqual(ST.stats.starsCaught, 3, 'Super yildiz +2 yildiz saymali');

collectItem({ kind: 'rainbow', x: catcher.x, y: catcher.y, r: 18, color: '#4cc9f0' });
assert.ok(catcher.magnetTimer > 0, 'Gokkusagi miknatis suresi baslatilmali');

collectItem({ kind: 'giant', x: catcher.x, y: catcher.y, r: 18, color: '#8ac926' });
assert.ok(catcher.giantTimer > 0, 'Dev sepet suresi baslatilmali');

collectItem({ kind: 'party', x: catcher.x, y: catcher.y, r: 18, color: '#ff70a6' });
assert.ok(catcher.partyTimer > 0, 'x2 yildiz partisi baslatilmali');

catcher.hp = 3;
collectItem({ kind: 'heart', x: catcher.x, y: catcher.y, r: 18, color: '#ff595e' });
assert.strictEqual(catcher.hp, 4, 'Kalp alma cani artirmali');
console.log('4) ⭐ YILDIZ, SEKER & 4 GUCLENDIRME NESNESI: OK');

// 5) 🌈 Gokkusagi Yagmuru Super Gucu
rainbowCharge = 100;
items.push({ kind: 'cloud', x: 200, y: 150, vx: 0, vy: 1, r: 18, color: '#7f8fa6', sway: 0, rot: 0 });
triggerRainbowShower();
assert.strictEqual(rainbowCharge, 0, 'Gokkusagi super gucu kullanilinca sarj sifirlanmali');
assert.ok(catcher.magnetTimer > 0, 'Gokkusagi yagmuru miknatisi devreye sokmali');
const anyCloud = items.some(it => it.kind === 'cloud');
assert.strictEqual(anyCloud, false, 'Gokkusagi yagmuru yagmur bulutlarini yildiza donusturmeli');
console.log('5) 🌈 GOKKUSAGI YAGMURU SUPER GUCU: OK');

// 6) 3 Yas Modu Davranisi (Minik: Yanmasiz, Neseli: 5 Kalp, Parti: Sureli)
currentMode = 'kids';
catcher.hp = 5;
collectItem({ kind: 'cloud', x: catcher.x, y: catcher.y, r: 18, color: '#7f8fa6' });
assert.strictEqual(catcher.hp, 5, 'Minik modda buluta carpsa bile can dusmemeli (yanma yok!)');

currentMode = 'happy';
catcher.invuln = 0;
collectItem({ kind: 'cloud', x: catcher.x, y: catcher.y, r: 18, color: '#7f8fa6' });
assert.strictEqual(catcher.hp, 4, 'Neseli modda bulut bir kalp goturmeli');
console.log('6) 3 YAS-DOSTU OYUN MODU DAVRANISI: OK');

// 7) 6 Sevimli Karakter x 4 Gokyuzu Temasi Vektor Cizimi
Object.keys(PETS).forEach(pKey => {
  ST.pet = pKey;
  Object.keys(SKIES).forEach(sKey => {
    currentSky = sKey;
    draw();
  });
});
console.log('7) 6 DOST x 4 GOKYUZU CIZIM MOTORU: OK');

// 8) Kalici Veri & Geriye Donuk Uyumluluk
finishCelebration();
persist();
const saved = JSON.parse(store['oyun-salonu-v2']);
assert.strictEqual(saved.flappy.bestScore, 50, 'Flappy verisi korunmali');
assert.strictEqual(saved.snake.bestScore, 90, 'Snake verisi korunmali');
assert.strictEqual(saved.pong.wins, 8, 'Pong verisi korunmali');
assert.strictEqual(saved.space.bestScore, 3500, 'Space verisi korunmali');
assert.ok(saved.stars && typeof saved.stars === 'object', 'Stars verisi kaydedilmeli');
console.log('8) OYUN-SALONU-V2 VERI BUTUNLUGU: OK');

// 9) 10.000 Kare Kesintisiz Calisma Stres Testi
startGame();
let simT = performance.now();
for (let f = 0; f < 10000; f++) {
  simT += 16.67;
  catcher.targetX = 210 + Math.sin(f * 0.05) * 160;
  if (balloons.length > 0 && f % 12 === 0) {
    tryPopBalloonAt(balloons[0].x, balloons[0].y);
  }
  if (rainbowCharge >= 100) triggerRainbowShower();
  loop(simT);
}
assert.strictEqual(state, STATE.PLAYING, '10.000 kare sonra oyun PLAYING kalmali');
console.log('9) 10.000 KARE STRES SIMULASYONU: OK — Skor =', score, 'Toplanan Yildiz =', runStars);

console.log('\n✅ YILDIZ YAKALAMA TUM TESTLERI KUSURSUZ GECTI!');
