// test-brick.js — Tuğla Kırıcı Birim, Mantık ve 10.000 Kare Stres Testi
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
  roundRect: noop, fill: noop, stroke: noop, fillText: noop, strokeText: noop,
  save: noop, restore: noop, translate: noop, rotate: noop, scale: noop,
  setLineDash: noop, measureText: () => ({ width: 40 })
};

const store = {
  'oyun-salonu-v2': JSON.stringify({
    soundOn: true,
    musicOn: false,
    volume: 0.65,
    flappy: { bestScore: 60, coins: 150, playerName: 'Can' },
    snake: { bestScore: 95, coins: 85 },
    pong: { wins: 9, bestDiff: 11 },
    space: { bestScore: 4200 }
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
global.location = { href: 'http://localhost/brick.html', search: '', pathname: '/brick.html' };
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
const brickCode = fs.readFileSync(path.join(__dirname, 'brick.js'), 'utf8');

vm.runInThisContext(mpCoreCode);
vm.runInThisContext(brickCode);

console.log('1) YUKLEME: OK — miras alinan oyuncu adi =', BK.playerName);
assert.strictEqual(BK.playerName, 'Can', 'Flappy kaydindaki isim miras alinmali');

// 2) Baslatma & Dokunmatik / Klavye Raket Hareketi
startGame();
assert.strictEqual(state, STATE.PLAYING, 'startGame sonrasi oyun PLAYING olmali');
assert.strictEqual(balls.length, 1, 'Baslangicta 1 top olmali');
assert.strictEqual(balls[0].attached, true, 'Baslangicta top rakete yapisik olmali');

onPointerStart(280);
onPointerMove(320);
onPointerEnd();
for (let i = 0; i < 15; i++) stepWorld();
assert.ok(paddle.x > 210, 'Raket saga dogru hareket etmeli');
assert.strictEqual(balls[0].attached, false, 'Dokunulunca top firlatilmali');
console.log('2) RAKET DOKUNMATIK SURUKLEME & TOP FIRLATMA: OK');

// 3) Tuğla Yok Etme, Kombo ve TNT Bomba Patlaması
const initialBricksCount = bricks.length;
assert.ok(initialBricksCount > 0, 'Seviye 1 tuglalari yuklenmis olmali');

// Birinci tuğlayı kır
const targetBr = bricks[0];
const targetX = targetBr.x + targetBr.w * 0.5;
const targetY = targetBr.y + targetBr.h * 0.5;
destroyBrick(0);
assert.strictEqual(bricks.length, initialBricksCount - 1, 'Tugla kirilinca listeden silinmeli');
assert.ok(score > 0, 'Tugla kirilinca skor artmali');
assert.strictEqual(combo, 1, 'Tugla kirilinca kombo baslamali');

// TNT Tuğlası ekleyip komşuları patlatma testi
bricks.push({ x: 100, y: 100, w: 40, h: 16, hp: 1, pts: 35, color: '#e63946', tnt: true });
bricks.push({ x: 120, y: 100, w: 40, h: 16, hp: 1, pts: 20, color: '#ff3366' });
bricks.push({ x: 100, y: 120, w: 40, h: 16, hp: 1, pts: 20, color: '#ff3366' });
const tntIdx = bricks.findIndex(b => b.tnt);
const countBeforeTnt = bricks.length;
destroyBrick(tntIdx);
assert.ok(bricks.length < countBeforeTnt - 1, 'TNT patlayinca komsu tuglalari da havaya ucurmali');
console.log('3) TUGLA KIRMA, KOMBO & TNT BOMBA ZINCIRI: OK');

// 4) 7 Güçlendirme Testi (Multi, Laser, Wide, Fire, Floor, Heart, Coin)
applyPickup({ type: 'multi', x: paddle.x, y: paddle.y });
assert.ok(balls.length >= 2, 'Coklu top gucu top sayisini artirmali');

applyPickup({ type: 'laser', x: paddle.x, y: paddle.y });
assert.ok(paddle.laserTimer > 0, 'Lazer suresi baslatilmali');
const lasersCountBefore = lasers.length;
firePaddleLasers();
assert.ok(lasers.length >= lasersCountBefore + 2, 'Lazer atesi cift mermi firlatmali');

applyPickup({ type: 'wide', x: paddle.x, y: paddle.y });
assert.ok(paddle.wideTimer > 0, 'Genis raket suresi baslatilmali');

applyPickup({ type: 'fire', x: paddle.x, y: paddle.y });
assert.ok(paddle.fireballTimer > 0, 'Ates topu suresi baslatilmali');

applyPickup({ type: 'floor', x: paddle.x, y: paddle.y });
assert.strictEqual(paddle.floorShield, true, 'Zemin kalkani aktiflesmeli');

paddle.hp = 2;
applyPickup({ type: 'heart', x: paddle.x, y: paddle.y });
assert.strictEqual(paddle.hp, 3, 'Kalp alma cani 3e cikarmali');

const coinsBefore = runCoins;
applyPickup({ type: 'coin', x: paddle.x, y: paddle.y });
assert.ok(runCoins > coinsBefore, 'Altin alma kazanilan altini artirmali');
console.log('4) 7 GUCLENDIRME KAPSULU (MULTI, LASER, WIDE, FIRE, FLOOR, HEART, COIN): OK');

// 5) Zemin Kalkanı Bariyeri ile Top Kurtarma
balls = [{
  x: 200, y: VIRT_H - 16,
  vx: 0, vy: 5,
  r: 6.5, speed: 5, attached: false, trail: []
}];
paddle.floorShield = true;
stepWorld();
assert.ok(balls[0].vy < 0, 'Zemin kalkani asagi dusen topu yukari sektirmeli');
assert.strictEqual(paddle.floorShield, false, 'Kurtarma sonrasi kalkan tukenmeli');
console.log('5) ZEMIN KALKANI BARIZYERI ILE TOP KURTARMA: OK');

// 6) Bölüm Tamamlama & Seviye Atlama
bricks = []; // Tum tuglalar temizlendi
onLevelCompleted();
assert.strictEqual(level, 2, 'Tuglalar bitince Seviye 2ye gecilmeli');
assert.ok(bricks.length > 0, 'Yeni seviyenin tuglalari dizilmeli');
console.log('6) BOLUM TAMAMLAMA & SEVIYE ATLAMA: OK — Yeni Seviye =', level);

// 7) 6 Raket Kostümü x 4 Top Teması Çizim Testi
Object.keys(PADDLES).forEach(pKey => {
  BK.paddle = pKey;
  Object.keys(BALLS).forEach(bKey => {
    BK.ball = bKey;
    draw();
  });
});
console.log('7) 6 RAKET x 4 TOP TEMASI CIZIM MOTORU: OK');

// 8) Kalıcı Veri Bütünlüğü (oyun-salonu-v2)
handlePlayerDeath();
persist();
const savedRoot = JSON.parse(store['oyun-salonu-v2']);
assert.strictEqual(savedRoot.flappy.bestScore, 60, 'Flappy verisi korunmali');
assert.strictEqual(savedRoot.snake.bestScore, 95, 'Snake verisi korunmali');
assert.strictEqual(savedRoot.pong.wins, 9, 'Pong verisi korunmali');
assert.strictEqual(savedRoot.space.bestScore, 4200, 'Space verisi korunmali');
assert.ok(savedRoot.brick && typeof savedRoot.brick === 'object', 'Brick verisi kaydedilmeli');
console.log('8) OYUN-SALONU-V2 VERI BUTUNLUGU: OK');

// 9) 10.000 Kare Kesintisiz Simülasyon Stres Testi
startGame();
launchBalls();
let simNow = performance.now();
for (let f = 0; f < 10000; f++) {
  simNow += 16.67;
  // Otopilot raket: en alttaki topu takip etsin
  if (balls.length > 0) {
    paddle.targetX = balls[0].x;
  }
  if (paddle.hp <= 1) paddle.hp = 3; // Uzun sureli stres testi icin hayatta tut
  loop(simNow);
}
assert.strictEqual(state, STATE.PLAYING, '10.000 kare sonunda oyun donmadan PLAYING kalmali');
console.log('9) 10.000 KARE STRES SIMULASYONU: OK — Skor =', score, 'Seviye =', level);

console.log('\n✅ TUGLA KIRICI TUM TESTLERI KUSURSUZ GECTI!');
