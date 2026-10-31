// game.js (Flappy Kuş v2) kapsamlı runtime ve özellik testi
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const noop = () => {};
const makeEl = (id = '') => {
  const classes = new Set();
  return {
    id,
    tagName: 'DIV',
    value: '',
    disabled: false,
    title: '',
    textContent: '',
    innerHTML: '',
    style: {},
    dataset: {},
    classList: {
      add: (...c) => c.forEach(x => classes.add(x)),
      remove: (...c) => c.forEach(x => classes.delete(x)),
      toggle: (c, force) => {
        if (force === undefined) {
          if (classes.has(c)) { classes.delete(c); return false; }
          classes.add(c); return true;
        }
        if (force) classes.add(c); else classes.delete(c);
        return !!force;
      },
      contains: c => classes.has(c)
    },
    addEventListener: noop,
    appendChild: noop,
    querySelector: () => makeEl(),
    parentElement: { getBoundingClientRect: () => ({ width: 420, height: 700 }) }
  };
};

const ctx2d = {
  setTransform: noop,
  createLinearGradient: () => ({ addColorStop: noop }),
  createRadialGradient: () => ({ addColorStop: noop }),
  fillRect: noop, strokeRect: noop, beginPath: noop, arc: noop, arcTo: noop,
  ellipse: noop, moveTo: noop, lineTo: noop, quadraticCurveTo: noop, closePath: noop,
  fill: noop, stroke: noop, fillText: noop, strokeText: noop, save: noop, restore: noop,
  translate: noop, rotate: noop, scale: noop, setLineDash: noop,
  measureText: () => ({ width: 10 })
};

const els = {};
const canvasEl = { ...makeEl('game-canvas'), getContext: () => ctx2d, width: 0, height: 0 };

const store = {
  'oyun-salonu-v2': JSON.stringify({
    snake: { bestScore: 42, games: 5 },
    pong: { wins: 7, bestDiff: 9 }
  })
};

global.document = {
  hidden: false,
  getElementById: id => id === 'game-canvas' ? canvasEl : (els[id] = els[id] || makeEl(id)),
  querySelectorAll: () => [],
  querySelector: () => null,
  addEventListener: noop,
  createElement: () => makeEl()
};
global.window = { devicePixelRatio: 1, addEventListener: noop, AudioContext: undefined };
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); }
};
let nowMs = 1000;
global.performance = { now: () => nowMs };
let rafCb = null;
global.requestAnimationFrame = cb => { rafCb = cb; return 0; };
global.setTimeout = () => 0;
global.setInterval = () => 1;
global.clearInterval = noop;

const code = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
vm.runInThisContext(code);
console.log('1. YUKLEME: OK');

function stepFrames(n) {
  for (let i = 0; i < n; i++) {
    nowMs += 1000 / 60;
    if (rafCb) { const cb = rafCb; rafCb = null; cb(nowMs); }
  }
}

// 2. Oyun başlatma ve uçuş
startGame();
beginPlay();
stepFrames(60);
if (state !== 2) throw new Error('Oyun PLAYING olmaliydi');
console.log('2. BASLATMA & FIZIK: OK');

// 3. Tüm güçlendirmeleri ve biyomları test et
['shield', 'slow', 'x2', 'tiny', 'magnet', 'phase'].forEach(pw => activatePower(pw));
if (!shieldActive || slowFrames <= 0 || x2Left <= 0 || tinyFrames <= 0 || magnetFrames <= 0 || phaseFrames <= 0) {
  throw new Error('Guclendirmeler aktif olmadi!');
}
console.log('3. GUCLENDIRMELER (6 tip): OK');

// 4. Kalkan çarpışma koruması testi
phaseFrames = 0;
invulnFrames = 0;
pipes.push({
  x: bird.x - 10, w: 58, baseTopV: 200, baseGapV: 140,
  topH: 200, gap: 140, virtSpeed: 2.6, type: 'moving',
  phase: 0, age: 0, moveAmpV: 25, moveFreq: 0.04, pulseAmpV: 0,
  passed: false, shattered: false
});
bird.y = 50; // üst boruya çarptır
stepFrames(2);
if (state !== 2 || shieldActive !== false) {
  throw new Error('Kalkan kusun olmesini engellemeliydi!');
}
console.log('4. KALKAN KORUMASI: OK');

// 5. Mükemmel geçiş & kombo + farklı biyom çizimleri (0..45 skor)
score = 18;
const testPipe = {
  x: bird.x - 80, w: 58, baseTopV: 180, baseGapV: 150,
  topH: 180, gap: 150, virtSpeed: 2.6, type: 'pulse',
  phase: 0, age: 0, moveAmpV: 0, moveFreq: 0, pulseAmpV: 18,
  passed: false, shattered: false
};
bird.y = testPipe.topH + testPipe.gap * 0.5; // tam merkez!
pipes.push(testPipe);
stepFrames(3);
if (combo < 1 || score <= 18) throw new Error('Mukemmel gecis calismadi!');
score = 42; // kar/fırtına biyomu
stepFrames(20);
console.log('5. MUKEMMEL GECIS, KOMBO & 4 BIYOM CIZIMI: OK (skor =', score, 'kombo =', combo + ')');

// 6. Ölüm, Ghost Replay kaydı, Skor Tablosu ve localStorage koruma testi
die(true);
if (state !== 4) throw new Error('GAMEOVER olmaliydi!');
if (!F.ghostRun || F.ghostRun.length === 0) throw new Error('Ghost replay kaydedilmeliydi!');

els['player-name'].value = 'Nuri';
saveCurrentScore();
renderLeaderboard();
openShop('skins');
openShop('trails');

const savedRoot = JSON.parse(store['oyun-salonu-v2']);
if (!savedRoot.snake || savedRoot.snake.bestScore !== 42 || !savedRoot.pong || savedRoot.pong.wins !== 7) {
  throw new Error('HATA: Snake veya Pong kayitlari ezildi!');
}
if (savedRoot.flappy.bestScore !== score || savedRoot.flappy.scoreboard[0].name !== 'Nuri') {
  throw new Error('Flappy rekoru veya skor tablosu kaydedilmedi!');
}
console.log('6. KAYIT KORUMA (Snake+Pong korundu), GHOST REPLAY, MAGAZA & SKOR TABLOSU: OK');

// 7. Deterministik MP senkron testi
seedRng(123456);
pipes = []; coins = []; powers = []; score = 20;
spawnPipe(); spawnPipe();
const runA = JSON.stringify(pipes.map(p => [p.baseTopV, p.type]));

seedRng(123456);
pipes = []; coins = []; powers = []; score = 20;
spawnPipe(); spawnPipe();
const runB = JSON.stringify(pipes.map(p => [p.baseTopV, p.type]));
if (runA !== runB) throw new Error('MP deterministik boru uretimi eslesmedi!');
console.log('7. MP DETERMINISTIK SENKRON: OK');

// 8. Tüm 8 kostüm, 4 uçuş izi ve Ghost Replay oynatma çizim testi
startGame();
beginPlay();
['yellow', 'red', 'blue', 'purple', 'phoenix', 'robot', 'ghost', 'king'].forEach(sk => {
  F.skin = sk;
  ['none', 'star', 'fire', 'rainbow'].forEach(tr => {
    F.trail = tr;
    stepFrames(4);
  });
});
console.log('8. TUM 8 KOSTUM, 4 UCUS IZI & GHOST REPLAY OYNATMA: OK');

console.log('TUM TESTLER BASARIYLA GECTI!');
