// snake.js runtime smoke test — sahte tarayıcı ortamı
const fs = require('fs');
const path = require('path');

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
  translate: noop, rotate: noop, scale: noop, clip: noop,
  measureText: () => ({ width: 10 })
};

const els = {};
const canvasEl = { ...makeEl(), getContext: () => ctx2d, width: 0, height: 0, addEventListener: noop };

global.document = {
  getElementById: id => {
    if (id === 'game-canvas') return canvasEl;
    if (!els[id]) els[id] = makeEl();
    return els[id];
  },
  querySelectorAll: () => [],
  addEventListener: noop,
  createElement: () => makeEl()
};
global.window = { devicePixelRatio: 1, addEventListener: noop, AudioContext: undefined, webkitAudioContext: undefined };
global.localStorage = { getItem: () => null, setItem: noop };
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => 0;
global.setTimeout = fn => 0;

// script'i yükle (vm ile global scope'a)
const vm = require('vm');
const code = fs.readFileSync(path.join(__dirname, 'snake.js'), 'utf8');
try {
  vm.runInThisContext(code);
  console.log('YUKLEME: OK');
} catch (e) {
  console.log('YUKLEME HATASI:', e.message);
  process.exit(1);
}

// startGame'i tetikle (BAŞLA butonu)
try {
  startGame();
  console.log('STARTGAME: OK — state =', state);
} catch (e) {
  console.log('STARTGAME HATASI:', e.message, '(satır yakalandı)');
  process.exit(1);
}

// beginPlay + birkaç adım
try {
  beginPlay();
  console.log('BEGINPLAY: OK — state =', state);
  for (let i = 0; i < 30; i++) step();
  console.log('STEP x30: OK — skor =', score, 'yılan uzunluğu =', snake.length);
} catch (e) {
  console.log('OYUN HATASI:', e.message);
  process.exit(1);
}

// die akışı
try {
  die();
  console.log('DIE: OK — state =', state);
} catch (e) {
  console.log('DIE HATASI:', e.message);
  process.exit(1);
}

console.log('TUM TESTLER GECTI');
