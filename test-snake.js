// snake.js v4 kapsamlı runtime ve mekanik testi
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
  translate: noop, rotate: noop, scale: noop, clip: noop, setLineDash: noop,
  measureText: () => ({ width: 10 })
};

const els = {};
const canvasEl = { ...makeEl('game-canvas'), getContext: () => ctx2d, width: 0, height: 0, addEventListener: noop };

const store = {
  'oyun-salonu-v2': JSON.stringify({
    flappy: { bestScore: 33, coins: 15 },
    pong: { wins: 9, bestDiff: 11 }
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
global.window = { devicePixelRatio: 1, addEventListener: noop, AudioContext: undefined, webkitAudioContext: undefined };
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

const code = fs.readFileSync(path.join(__dirname, 'snake.js'), 'utf8');
vm.runInThisContext(code);
console.log('1. YUKLEME: OK');

function simFrames(n) {
  for (let i = 0; i < n; i++) {
    nowMs += 1000 / 60;
    if (rafCb) { const cb = rafCb; rafCb = null; cb(nowMs); }
  }
}

// 2. Kritik başlangıç yönü testi: ilk 5 adımda kendi boynuna ÇARPMAMALI!
S.mode = 'classic';
startGame();
beginPlay();
for (let i = 0; i < 5; i++) step();
if (state !== 2) throw new Error('HATA: Yilan baslangicta kendi boynuna carpti! state=' + state);
console.log('2. BASLANGIC YON DUZELTMESI (5 adim hayatta): OK — kafa x =', snake[0].x);

// 3. Portal modu testi (duvardan girip karşıdan çıkma)
S.mode = 'portal';
startGame();
beginPlay();
for (let i = 0; i < 20; i++) step();
if (state !== 2) throw new Error('Portal modunda duvarda olmemeliydi!');
console.log('3. PORTAL MODU (duvarsiz gecis): OK — kafa x =', snake[0].x);

// 4. Labirent modu + Hayalet gücü + 5 Özel Meyve + Kombo
S.mode = 'maze';
startGame();
beginPlay();
if (!obstacles.length) throw new Error('Labirent engelleri olusturulmadi!');

// Elma & kombo testi
food = { x: snake[0].x + 1, y: snake[0].y };
step();
food = { x: snake[0].x + 1, y: snake[0].y };
step();
if (combo < 2 || score < 3) throw new Error('Kombo sistemi calismadi! combo=' + combo + ' score=' + score);

// 5 özel meyve testi
['gold', 'ice', 'x2', 'ghost', 'trim'].forEach(bt => {
  applyBonusItem({ x: snake[0].x, y: snake[0].y, type: bt });
});
if (slowFrames <= 0 || ghostFrames <= 0 || x2Left <= 0) {
  throw new Error('Ozel meyve guclendirmeleri aktif olmadi!');
}

// Hayalet aktifken labirent engelinin içinden geçebilmeli
const ob = obstacles[0];
snake[0] = { x: ob.x - 1, y: ob.y };
dir = { x: 1, y: 0 }; nextDir = { x: 1, y: 0 };
step();
if (state !== 2) throw new Error('Hayalet modunda engelden gecebilmeliydi!');
console.log('4. LABIRENT, KOMBO & 5 OZEL MEYVE: OK — skor =', score, 'kombo =', combo);

// 5. Turbo (stamina) ve tüm 6 kostüm x 4 saha çizim testi
setTurbo(true);
['emerald', 'cyber', 'dragon', 'frost', 'cobra', 'prism'].forEach(sk => {
  S.skin = sk;
  ['space', 'meadow', 'retro', 'lava'].forEach(ar => {
    S.arena = ar;
    simFrames(3);
  });
});
if (stamina >= 100) throw new Error('Turbo enerji harcamaliydi!');
setTurbo(false);
console.log('5. TURBO ENERJI, 6 KOSTUM & 4 SAHA CIZIMI: OK (stamina =', Math.round(stamina) + ')');

// 6. MP Konuk (Guest) başlangıç yönü + sıra numaralı yem senkronu
MP.connected = true;
MP.isHost = false;
MP.seed = 987654;
MP.matchDiff = 'normal';
MP.matchMode = 'classic';
startGame(true);
beginPlay();
const guestFirstFood = { ...food };
step(); step();
if (state !== 2) throw new Error('MP Guest baslangicta kendi boynuna carpti!');
advanceFoodToSeq(3);
const guestFood3 = { ...food };

// Host tarafında aynı seed ile 3. yem birebir aynı olmalı
MP.isHost = true;
startGame(true);
if (food.x !== guestFirstFood.x || food.y !== guestFirstFood.y) {
  throw new Error('MP ilk yem senkron degil!');
}
advanceFoodToSeq(3);
if (food.x !== guestFood3.x || food.y !== guestFood3.y) {
  throw new Error('MP sira numarali 3. yem senkron degil!');
}
MP.connected = false;
MP.isHost = false;
console.log('6. MP GUEST YON & SIRA NUMARALI YEM SENKRONU: OK');

// 7. Ölüm, Skor Tablosu, Mağaza ve localStorage koruma testi
score = 28;
die();
els['player-name'].value = 'Nuri';
saveCurrentScore();
renderLeaderboard();
openShop('skins');
openShop('arenas');

const savedRoot = JSON.parse(store['oyun-salonu-v2']);
if (!savedRoot.flappy || savedRoot.flappy.bestScore !== 33 || !savedRoot.pong || savedRoot.pong.wins !== 9) {
  throw new Error('Flappy veya Pong kayitlari ezildi!');
}
if (savedRoot.snake.bestScore !== 28 || savedRoot.snake.scoreboard[0].name !== 'Nuri') {
  throw new Error('Yilan rekoru veya skor tablosu kaydedilmedi!');
}
console.log('7. KAYIT KORUMA (Flappy+Pong korundu), MAGAZA & SKOR TABLOSU: OK');

console.log('TUM TESTLER BASARIYLA GECTI!');
