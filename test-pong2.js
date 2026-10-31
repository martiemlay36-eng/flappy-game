// pong.js durum makinesi simülasyonu — gerçek loop() ile tam oyun testi
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const noop = () => {};
const makeEl = () => ({
  classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  addEventListener: noop, textContent: '', innerHTML: '', style: {},
  parentElement: { getBoundingClientRect: () => ({ width: 420, height: 700 }) },
  dataset: {}, appendChild: noop
});
const ctx2d = {
  setTransform: noop, createLinearGradient: () => ({ addColorStop: noop }),
  createRadialGradient: () => ({ addColorStop: noop }),
  fillRect: noop, strokeRect: noop, beginPath: noop, arc: noop, arcTo: noop,
  ellipse: noop, moveTo: noop, lineTo: noop, quadraticCurveTo: noop, closePath: noop,
  fill: noop, stroke: noop, fillText: noop, strokeText: noop, save: noop, restore: noop,
  translate: noop, rotate: noop, scale: noop, setLineDash: noop, measureText: () => ({ width: 10 })
};
const els = {};
const canvasEl = { ...makeEl(), getContext: () => ctx2d, width: 0, height: 0 };

global.document = {
  getElementById: id => id === 'game-canvas' ? canvasEl : (els[id] = els[id] || makeEl()),
  querySelectorAll: () => [], addEventListener: noop, createElement: () => makeEl()
};
global.window = { devicePixelRatio: 1, addEventListener: noop, AudioContext: undefined };
global.localStorage = { getItem: () => null, setItem: noop };
global.performance = { now: () => 0 };
let rafCb = null;
global.requestAnimationFrame = cb => { rafCb = cb; return 0; };
global.setTimeout = () => 0;

const code = fs.readFileSync(path.join(__dirname, 'pong.js'), 'utf8');
vm.runInThisContext(code);
console.log('YUKLEME: OK');

// ---- yardımcı: frame sürücü ----
let simT = 0;
function frames(n) {
  for (let i = 0; i < n; i++) {
    simT += 1000 / 60;
    if (rafCb) { const cb = rafCb; rafCb = null; cb(simT); }
  }
}

// ---- TEST 1: tek kişi, gol → servis → devam ----
startGame();
console.log('T1 baslangic: state =', state, 'serveCountdown =', serveCountdown);

frames(200); // 3sn geri sayım biter, oyun başlar
console.log('T1 oyun basladi: state =', state);

// topu sağa zorla (sağdan çıkınca SOL oyuncu gol atar)
frames(10);
ball.x = W + 50;
const scLBefore = scL;
frames(5);
console.log('T1 gol sonrasi: scL =', scL, '(onceki:', scLBefore + ')', 'state =', state, 'top x =', Math.round(ball.x));
if (state !== 1) { console.log('T1 HATA: gol sonrasi READY olmali'); process.exit(1); }
if (ball.x < W / 2 - 10 || ball.x > W / 2 + 10) { console.log('T1 HATA: top merkezde degil!'); process.exit(1); }

frames(70); // 1sn servis bekleme + biraz
console.log('T1 servis sonrasi: state =', state, '(3 = PLAYING olmali)');
if (state !== 3) { console.log('T1 HATA: servis sonrasi PLAYING olmali'); process.exit(1); }

// top hareket ediyor mu?
const bx1 = ball.x;
frames(30);
console.log('T1 top hareketi:', Math.round(bx1), '->', Math.round(ball.x), Math.abs(ball.x - bx1) > 3 ? 'OK' : 'HAREKET YOK!');

// ---- TEST 2: maç sonu (11 gol) ----
for (let i = 0; i < 12; i++) {
  frames(80);
  ball.x = W + 50;   // sol oyuncu gol
  frames(5);
}
console.log('T2 skor:', scL, ':', scR, 'state =', state, '(4 = GAMEOVER olmali)');
if (state !== 4) { console.log('T2 HATA: GAMEOVER olmali'); process.exit(1); }

// ---- TEST 3: sol raket çarpışması ----
startGame();
frames(200);
state = 3;
ball.x = padX1 + padW + ball.r + 1;
ball.y = left.y + 5;
ball.vx = -7; ball.vy = 0;
frames(3);
console.log('T3 raket sekmesi: ball.vx =', ball.vx, '(pozitif olmali)');
if (ball.vx <= 0) { console.log('T3 HATA: top raketten sekmeli'); process.exit(1); }

// ---- TEST 4: Mobil Trackpad Göreceli Sürükleme (zıplama yapmamalı!) & 4 Tema ----
P.ctrlMode = 'trackpad';
P.sensitivity = 1.5;
const beforeTarget = left.target;
onPointerDown(350, 620); // ekranın sağ altına dokun
if (Math.abs(left.target - beforeTarget) > 0.01) {
  console.log('T4 HATA: Trackpad modunda ilk dokunusta raket ziplamamali!');
  process.exit(1);
}
onPointerMove(350, 580); // 40px yukarı kaydır -> -60px hareket etmeli
if (Math.abs(left.target - (beforeTarget - 60)) > 1) {
  console.log('T4 HATA: Hassasiyet carpani yanlis! left.target =', left.target);
  process.exit(1);
}
onPointerUp();
['cyber', 'ice', 'synth', 'court'].forEach(th => {
  P.theme = th;
  frames(4);
});
goMenu();
frames(6); // menü demo ralli çizimi
console.log('T4 Mobil Trackpad & 4 Ultra Tema Cizimi: OK');

console.log('TUM TESTLER GECTI');
