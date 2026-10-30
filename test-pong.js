// pong.js runtime smoke test
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const noop = () => {};
const makeEl = () => ({
  classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  addEventListener: noop,
  textContent: '', innerHTML: '', style: {},
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
  querySelectorAll: () => [],
  addEventListener: noop,
  createElement: () => makeEl()
};
global.window = { devicePixelRatio: 1, addEventListener: noop, AudioContext: undefined };
global.localStorage = { getItem: () => null, setItem: noop };
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => 0;
global.setTimeout = fn => 0;

const code = fs.readFileSync(path.join(__dirname, 'pong.js'), 'utf8');
try { vm.runInThisContext(code); console.log('YUKLEME: OK'); }
catch (e) { console.log('YUKLEME HATASI:', e.message); process.exit(1); }

try { startGame(); console.log('STARTGAME: OK — state =', state); }
catch (e) { console.log('STARTGAME HATASI:', e.message); process.exit(1); }

try {
  state = 3; // PLAYING
  ball.x = 30; ball.vx = -5; ball.y = left.y + 5;
  for (let i = 0; i < 300; i++) stepBall();
  console.log('STEPBALL x300: OK — skor =', scL, ':', scR);
}
catch (e) { console.log('FIZIK HATASI:', e.message); process.exit(1); }

console.log('TUM TESTLER GECTI');
