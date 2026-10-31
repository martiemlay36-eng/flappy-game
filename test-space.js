// space.js kapsamlı birim & çalışma zamanı testi
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
  translate: noop, rotate: noop, scale: noop, setLineDash: noop, measureText: () => ({ width: 42 })
};

const store = {
  'oyun-salonu-v2': JSON.stringify({
    soundOn: true,
    musicOn: false,
    volume: 0.65,
    flappy: { bestScore: 42, coins: 120, playerName: 'Nuri' },
    snake: { bestScore: 88, coins: 75 },
    pong: { wins: 7, bestDiff: 9 }
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
global.location = { href: 'http://localhost/space.html', search: '', pathname: '/space.html' };
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); }
};
global.sessionStorage = { getItem: () => null, setItem: noop, removeItem: noop };
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => 0;

const mpCoreCode = fs.readFileSync(path.join(__dirname, 'mp-core.js'), 'utf8');
const spaceCode = fs.readFileSync(path.join(__dirname, 'space.js'), 'utf8');

vm.runInThisContext(mpCoreCode);
vm.runInThisContext(spaceCode);
console.log('1) YUKLEME: OK — miras alinan oyuncu adi =', SP.playerName);
assert.strictEqual(SP.playerName, 'Nuri', 'Flappy kaydindaki oyuncu adi miras alinmali');

// 2) Baslatma & 2B Trackpad surukleme testi
startGame();
assert.strictEqual(state, STATE.PLAYING, 'startGame sonrasi PLAYING olmali');
const startX = player.x, startY = player.y;
onPointerStart(200, 500);
onPointerMove(240, 460);
onPointerEnd();
for (let i = 0; i < 15; i++) stepWorld();
assert.ok(player.x > startX + 20, 'Trackpad saga suruklemede gemi X artmali');
assert.ok(player.y < startY - 20, 'Trackpad yukari suruklemede gemi Y azalmali');
console.log('2) 2B TRACKPAD SURUKLEME & OTOMATIK ATES: OK — mermi sayisi =', bullets.length);
assert.ok(bullets.length > 0, 'Otomatik lazer atesi mermi uretmeli');

// 3) 5 Guclendirme + Kalkan + EMP Bomba testi
applyPickup({ kind: 'weapon', x: player.x, y: player.y });
applyPickup({ kind: 'weapon', x: player.x, y: player.y });
applyPickup({ kind: 'weapon', x: player.x, y: player.y });
assert.strictEqual(player.weaponLv, 4, 'Silah seviyesi Lv.4 olmali');
applyPickup({ kind: 'shield', x: player.x, y: player.y });
applyPickup({ kind: 'rapid', x: player.x, y: player.y });
applyPickup({ kind: 'magnet', x: player.x, y: player.y });
applyPickup({ kind: 'x2', x: player.x, y: player.y });
assert.strictEqual(player.shield, true, 'Kalkan aktif olmali');

player.invuln = 0;
damagePlayer();
assert.strictEqual(player.shield, false, 'Hasar gelince kalkan kirilmali');
assert.strictEqual(player.hp, 3, 'Kalkan varken can dusmemeli');
console.log('3) 5 GUCLENDIRME & KALKAN KORUMASI: OK');

// 4) Boss dogusu, EMP Super Bomba ve Boss yikimi
eBullets.push({ x: 120, y: 200, vx: 0, vy: 4, r: 4, color: '#ff3366' });
enemies.push({ type: 'scout', x: 180, y: 180, vx: 0, vy: 2, r: 14, hp: 2, maxHp: 2, rot: 0, fireCd: 30, phase: 0, color: '#00f5d4', pts: 15, dropType: 'coin' });
spawnsCount = 23;
runFrames = DIFFICULTIES[currentDiff].spawnInt - 1;
stepWorld(); // spawnsCount = 24 -> Boss dogar!
assert.ok(boss !== null, '24. dogusta Dreadnought Boss sahneye inmeli');

empCharge = 100;
const bossHpBefore = boss.hp;
triggerEMP();
assert.strictEqual(eBullets.length, 0, 'EMP tum dusman mermilerini temizlemeli');
assert.ok(boss.hp < bossHpBefore, 'EMP Bossa agir hasar vermeli');

boss.y = 96;
boss.hp = 1;
bullets.push({ x: boss.x, y: boss.y, vx: 0, vy: -10, r: 4, dmg: 5, color: '#00f5d4' });
stepWorld();
assert.strictEqual(boss, null, 'Son isabetle Boss yikilmali');
assert.strictEqual(wave, 2, 'Boss yikilinca Dalga 2ye gecilmeli');
console.log('4) BOSS SAVASI & EMP SUPER BOMBA: OK — Skor =', score, 'Dalga =', wave);

// 5) Tum 6 gemi ve 4 sektor cizim testi
Object.keys(SHIPS).forEach(shKey => {
  SP.ship = shKey;
  Object.keys(SECTORS).forEach(secKey => {
    currentSector = secKey;
    draw();
  });
});
console.log('5) 6 GEMI x 4 GALAKSI SEKTORU CIZIM MOTORU: OK');

// 6) Kalici veri butunlugu (flappy, snake, pong korunmali)
persist();
const savedRoot = JSON.parse(store['oyun-salonu-v2']);
assert.strictEqual(savedRoot.flappy.bestScore, 42, 'Flappy verisi korunmali');
assert.strictEqual(savedRoot.snake.bestScore, 88, 'Snake verisi korunmali');
assert.strictEqual(savedRoot.pong.wins, 7, 'Pong verisi korunmali');
assert.ok(savedRoot.space && typeof savedRoot.space === 'object', 'Space verisi kaydedilmeli');
console.log('6) OYUN-SALONU-V2 VERI BUTUNLUGU: OK');

console.log('\n✅ UZAY AVCISI TUM TESTLERI KUSURSUZ GECTI!');
