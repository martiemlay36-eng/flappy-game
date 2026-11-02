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

// Herhangi bir yakalanmis loop hatasi varsa aninda patlasin!
const origConsoleError = console.error;
console.error = (...args) => {
  origConsoleError(...args);
  throw new Error('Beklenmeyen console.error: ' + args.map(String).join(' '));
};

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

// 3) 6 Guclendirme + Baslangic Kalkani + Can Tamiri + Darbe Mermi Temizligi testi
assert.strictEqual(player.hp, 5, '5 can ile baslamali');
assert.strictEqual(player.shield, true, 'Baslangicta enerji kalkani aktif olmali');

applyPickup({ kind: 'weapon', x: player.x, y: player.y });
applyPickup({ kind: 'weapon', x: player.x, y: player.y });
applyPickup({ kind: 'weapon', x: player.x, y: player.y });
assert.strictEqual(player.weaponLv, 4, 'Silah seviyesi Lv.4 olmali');
applyPickup({ kind: 'rapid', x: player.x, y: player.y });
applyPickup({ kind: 'magnet', x: player.x, y: player.y });
applyPickup({ kind: 'x2', x: player.x, y: player.y });

// Yakinda ikinci bir mermi varken darbe alinca kalkan kirilmali VE etraftaki mermiler silinmeli!
eBullets.push({ x: player.x + 30, y: player.y - 20, vx: 0, vy: 3, r: 4, color: '#ff3366' });
player.invuln = 0;
damagePlayer();
assert.strictEqual(player.shield, false, 'Hasar gelince kalkan kirilmali');
assert.strictEqual(player.hp, 5, 'Kalkan varken can dusmemeli');
assert.strictEqual(eBullets.length, 0, 'Darbe aninda yakindaki dusman mermileri temizlenmeli');

// Govde hasari alinca silah seviyesi dusmemeli, ❤️ Tamir Kiti cani geri doldurmali!
player.invuln = 0;
damagePlayer();
assert.strictEqual(player.hp, 4, 'Kalkansiz darbede can 4e inmeli');
assert.strictEqual(player.weaponLv, 4, 'Hasar alinca silah seviyesi dusmemeli');
applyPickup({ kind: 'heal', x: player.x, y: player.y });
assert.strictEqual(player.hp, 5, 'Tamir kiti +1 can onarmali');
console.log('3) 5 CAN + BASLANGIC KALKANI + TAMIR KITI & DARBE KORUMASI: OK');

// 4) Boss dogusu, EMP Super Bomba ve Boss yikimi
eBullets.push({ x: 120, y: 200, vx: 0, vy: 4, r: 4, color: '#ff3366' });
enemies.push({ type: 'scout', x: 180, y: 180, vx: 0, vy: 2, r: 14, hp: 2, maxHp: 2, rot: 0, fireCd: 30, phase: 0, color: '#00f5d4', pts: 15, dropType: 'coin' });
spawnsCount = 27;
runFrames = DIFFICULTIES[currentDiff].spawnInt - 1;
stepWorld(); // spawnsCount = 28 -> Boss dogar!
assert.ok(boss !== null, '28. dogusta Dreadnought Boss sahneye inmeli');

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

// 7) REGRESYON: Coklu dusman mermisi varken mermi carpismasi (3762 puan donma hatasi testi)
startGame();
player.invuln = 0;
player.shield = true;
eBullets = [
  { x: player.x - 25, y: player.y - 15, vx: 0, vy: 2, r: 4, color: '#ff3366' }, // index 0 (yakinda -> silinecek)
  { x: player.x + 30, y: player.y + 10, vx: 0, vy: 2, r: 4, color: '#ff3366' }, // index 1 (yakinda -> silinecek)
  { x: player.x,      y: player.y,      vx: 0, vy: 0, r: 5, color: '#ff3366' }, // index 2 (oyuncuya carpan!)
  { x: 20,            y: 30,            vx: 0, vy: 2, r: 4, color: '#ff3366' }, // index 3 (uzakta -> kalacak)
  { x: player.x - 10, y: player.y + 20, vx: 0, vy: 2, r: 4, color: '#ff3366' }  // index 4 (yakinda)
];
stepWorld(); // Kalkan kirilir + clearNearbyThreats(145) diziyi kucultur -> cokmemeli!
assert.strictEqual(player.shield, false, 'Coklu mermi ortasinda isabette kalkan kirilmali');

player.invuln = 0;
eBullets.push(
  { x: player.x + 20, y: player.y - 10, vx: 0, vy: 2, r: 4, color: '#ff3366' },
  { x: player.x - 20, y: player.y + 10, vx: 0, vy: 2, r: 4, color: '#ff3366' },
  { x: player.x,      y: player.y,      vx: 0, vy: 0, r: 5, color: '#ff3366' }
);
stepWorld(); // Govde hasari + clearNearbyThreats(170) diziyi kucultur -> cokmemeli!
assert.strictEqual(player.hp, 4, 'Coklu mermi ortasinda govde darbesi hatasiz islenmeli');
console.log('7) REGRESYON (COKLU MERMI CARPISMASI / DIZI INDEKS KORUMASI): OK');

// 8) 40.000 KARE STRES TESTI (10.000+ Puan & Coklu Boss Savaslari)
startGame();
player.weaponLv = 4;
let simNow = performance.now();
for (let f = 0; f < 40000; f++) {
  simNow += 16.67;
  // Basit otomatik pilot: aktif hedefe veya merkeze salin, EMP dolunca patlat, can azalirsa koru
  player.targetX = 210 + Math.sin(f * 0.04) * 150;
  player.targetY = 560 + Math.cos(f * 0.03) * 50;
  if (empCharge >= 100) triggerEMP();
  if (player.hp <= 1) player.hp = 3; // Uzun sureli yüksek dalga/skor stres testi icin hayatta tut
  loop(simNow);
  assert.ok(Number.isFinite(player.x) && Number.isFinite(player.y), 'Gemi koordinatlari gecerli olmali');
}
assert.strictEqual(state, STATE.PLAYING, '40.000 kare sonunda oyun donmadan PLAYING kalmali');
assert.ok(score > 10000, 'Stres testinde 10.000+ puana ulasilmali (ulasildi: ' + score + ')');
console.log('8) 40.000 KARE STRES SIMULASYONU: OK — Ulasilan Skor =', score, 'Dalga =', wave);

console.log('\n✅ UZAY AVCISI TUM TESTLERI KUSURSUZ GECTI!');
