import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Runtime } from '../public/src/runtime.js';
import { registerOriginal } from '../public/src/original-program.js';
import { stateHash } from '../public/src/frame-sync.js';
import { RoomHub } from '../server/rooms.js';
import { MemoryStore } from '../server/store.js';

const project = JSON.parse(fs.readFileSync(new URL('../public/data/project.json', import.meta.url)));
function game(options = {}) {
  const r = new Runtime(structuredClone(project), { headless: true });
  registerOriginal(r);
  r.start({ p1: 37, p2: 37, map: 6, ...options });
  advance(r, 4);
  return r;
}
function advance(r, ticks) {
  for (let i = 0; i < ticks; i++) r.step();
}
function press(r, key) {
  r.keys.add(key);
  r.step();
  r.keys.delete(key);
}

test('all evolution forms persist until a new roll and reset between rounds', () => {
  const r = game();
  const hero = r.originals.get('n230');
  assert.equal(hero.picture.id, 'ecola-base');
  const shapes = new Set([hero.picture.fileurl]);
  for (const [roll, expected] of [[.1, 'flagella'], [.3, 'cannon'], [.5, 'shell'], [.7, 'spore'], [.99, 'wilt']]) {
    r.random = () => roll;
    r.globals.set('qn98', 100);
    press(r, 83);
    assert.equal(r.globals.get('qn98') < 41, true);
    advance(r, 24);
    assert.equal(r.ecola.state(1).form, expected);
    shapes.add(hero.ecolaPose.picture.fileurl);
    assert.equal(r.ecola.state(2).form, 'base');
    advance(r, 180);
  }
  advance(r, 620);
  assert.equal(r.ecola.state(1).form, 'wilt');
  assert.equal(shapes.size, 6);
  assert.equal(hero.picture.id, 'ecola-base');
  r.start({ p1: 37, p2: 37, map: 6 });
  advance(r, 4);
  assert.equal(r.ecola.state(1).form, 'base');
  assert.deepEqual(r.faults, []);
});

test('nutrient absorption grants four pulses and an attack cancels it early', () => {
  const r = game();
  r.globals.set('qn98', 0);
  r.globals.set('thom', 0);
  press(r, 82);
  advance(r, 120);
  assert.ok(Math.abs(r.globals.get('qn98') - r.globals.get('thom') - 28) < .01);
  advance(r, 300);
  r.globals.set('qn98', 0);
  r.globals.set('thom', 0);
  press(r, 82);
  advance(r, 32);
  press(r, 69);
  advance(r, 90);
  assert.ok(Math.abs(r.globals.get('qn98') - r.globals.get('thom') - 7) < .01);
  assert.deepEqual(r.faults, []);
});

test('fission doubles twice after the first split and fakes evolve without dealing damage', () => {
  const r = game({ skills: ['secondary', 'primary'] });
  r.collisionProvider = (e, target) => target === '6tzq' && e.y < -80;
  r.globals.set('qn98', 100);
  const hp = r.globals.get('7ir2');
  press(r, 82);
  assert.equal(r.ecola.decoys(1).length, 1);
  assert.equal(r.originals.get('aadi').ecolaHidden, true);
  advance(r, 36);
  assert.equal(r.ecola.decoys(1).length, 3);
  advance(r, 36);
  const clones = r.ecola.decoys(1);
  assert.equal(clones.length, 7);
  assert.ok(new Set(clones.map(clone => clone.x)).size > 3);
  r.random = () => .7;
  press(r, 83);
  advance(r, 24);
  assert.ok(clones.every(clone => clone.picture.id === 'ecola-spore'));
  advance(r, 240);
  assert.equal(r.ecola.decoys(1).length, 0);
  assert.equal(r.originals.get('aadi').ecolaHidden, false);
  assert.equal(r.globals.get('7ir2'), hp);
  assert.deepEqual(r.faults, []);
});

test('cytoplasm damages real opponents and shell form reduces damage and recoil', () => {
  const r = game();
  r.collisionProvider = () => false;
  Object.assign(r.ecola.body(1), { x: -20, y: 60 });
  Object.assign(r.ecola.body(2), { x: 20, y: 60 });
  r.globals.set('etjn', 1);
  r.ecola.state(2).form = 'shell';
  const hp = r.globals.get('7ir2');
  press(r, 69);
  advance(r, 10);
  assert.equal(r.globals.get('7ir2'), hp - 3.75);
  const recoil = r.globals.get('lgp6');
  r.add(r.ecola.body(2), 'lgp6', 20);
  assert.equal(r.globals.get('lgp6'), Number(recoil) + 13);
  assert.deepEqual(r.faults, []);
});

test('evolved basics steer, burst, rebound, spread or drop according to form', () => {
  const setup = form => {
    const r = game();
    r.collisionProvider = () => false;
    Object.assign(r.ecola.body(1), { x: -65, y: 50 });
    Object.assign(r.ecola.body(2), { x: 65, y: 80 });
    r.globals.set('etjn', 1);
    r.ecola.state(1).form = form;
    return r;
  };
  const shots = r => r.entities.filter(e => e.ecolaEffect === 'shot');

  const flagella = setup('flagella');
  press(flagella, 69);
  advance(flagella, 5);
  assert.ok(shots(flagella)[0].y > 53);

  const cannon = setup('cannon');
  cannon.collisionProvider = (e, id) => id === '6tzq' && e.ecolaEffect === 'shot' && e.x >= -43;
  Object.assign(cannon.ecola.body(2), { x: -34, y: 62 });
  const hp = Number(cannon.globals.get('7ir2'));
  press(cannon, 69);
  advance(cannon, 7);
  assert.equal(Number(cannon.globals.get('7ir2')), hp - 7);

  const shell = setup('shell');
  Object.assign(shell.ecola.body(1), { x: 222, y: 50 });
  press(shell, 69);
  advance(shell, 5);
  assert.ok(shots(shell)[0].x < 237 && shots(shell)[0].scaleX < 0);

  const spore = setup('spore');
  press(spore, 69);
  advance(spore, 5);
  assert.equal(new Set(shots(spore).map(e => e.y)).size, 3);

  const wilt = setup('wilt');
  press(wilt, 69);
  advance(wilt, 16);
  assert.ok(shots(wilt)[0].y < 45);
  advance(wilt, 7);
  assert.equal(shots(wilt).length, 0);
});

test('online matchmaking accepts both loadouts and seeded mirrors stay in sync', async () => {
  const build = JSON.parse(fs.readFileSync(new URL('../public/data/build.json', import.meta.url))).id;
  const hub = new RoomHub(new MemoryStore());
  await hub.matchmake({}, { build, character: 37, skill: 'secondary' });
  const { match } = await hub.matchmake({}, { build, character: 37, skill: 'primary' });
  assert.deepEqual([match.p1, match.p2, ...match.skills], [37, 37, 'secondary', 'primary']);
  const a = game(match), b = game(match);
  for (let tick = 0; tick < 230; tick++) {
    for (const r of [a, b]) {
      r.keys.clear();
      if (tick === 0 || tick === 90) {
        r.globals.set('qn98', 100);
        r.globals.set('thom', 100);
      }
      if (tick === 0) for (const key of [82, 80]) r.keys.add(key);
      if (tick === 90) for (const key of [83, 40]) r.keys.add(key);
      if (tick > 120) for (const key of [69, 13]) r.keys.add(key);
      r.step();
    }
    assert.equal(stateHash(a), stateHash(b), 'tick ' + tick);
  }
  assert.notEqual(a.ecola.state(1).form, 'base');
  assert.notEqual(a.ecola.state(2).form, 'base');
});
