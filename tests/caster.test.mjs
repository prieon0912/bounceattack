import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Runtime } from '../public/src/runtime.js';
import { registerOriginal } from '../public/src/original-program.js';
import { stateHash } from '../public/src/frame-sync.js';
import { RoomHub } from '../server/rooms.js';
import { MemoryStore } from '../server/store.js';

const project = JSON.parse(fs.readFileSync(new URL('../public/data/project.json', import.meta.url)));
const build = JSON.parse(fs.readFileSync(new URL('../public/data/build.json', import.meta.url))).id;
const advance = (r, count) => { for (let i = 0; i < count; i++) r.step(); };
const hp = r => Number(r.globals.get('7ir2'));
const rockets = r => r.duo.effects(1, 'zealot-rocket');

function game(p1, p2 = 2, skills = []) {
  const r = new Runtime(structuredClone(project), { headless: true });
  registerOriginal(r);
  r.start({ p1, p2, seed: 22, skills });
  r.collisionProvider = (e, id) => id === '6tzq' && e.y < -50;
  advance(r, 4);
  for (const [side, x] of [[1, -60], [2, -17]])
    Object.assign(r.duo.body(side), { x, y: -47 });
  r.globals.set('etjn', 1);
  r.globals.set('qn98', 100);
  r.globals.set('thom', 100);
  return r;
}

function press(r, ...keys) {
  for (const key of keys) r.keys.add(key);
  r.step();
  r.keys.clear();
}

test('octopus rotates, deals damage once, and its echo strikes where the attack started', () => {
  const r = game(41, 2, ['secondary']);
  press(r, 82);
  const before = hp(r);
  press(r, 69);
  advance(r, 8);
  assert.equal(hp(r), before - 7);
  assert.ok(Number(r.globals.get('lgp6')) < 0);
  r.duo.body(1).x = 110;
  advance(r, 35);
  assert.equal(hp(r), before - 12);
  assert.equal(r.duo.state(1).echoUntil, 0);
  assert.deepEqual(r.faults, []);
});

test('octopus hits an enemy behind it when the visible arm sweeps past', () => {
  const r = game(41), enemy = r.duo.body(2), before = hp(r);
  enemy.x = -102;
  press(r, 69);
  advance(r, 7);
  const arm = r.duo.effects(1, 'octopus-arm')[0];
  const firstAngle = arm.rotation;
  assert.equal(hp(r), before);
  advance(r, 12);
  assert.ok(Math.abs(arm.rotation - firstAngle) > 90);
  assert.equal(hp(r), before - 7);
  advance(r, 15);
  assert.equal(hp(r), before - 7);
  assert.equal(r.duo.effects(1, 'octopus-arm').length, 0);
  assert.deepEqual(r.faults, []);
});

test('octopus can grab a platform and release it with jump', () => {
  const r = game(41);
  const body = r.duo.body(1), x = body.x;
  r.collisionProvider = (e, id) => id === '6tzq' && (e.y < -50 || (e.x >= -22 && e.y > -38));
  press(r, 82);
  advance(r, 3);
  assert.ok(body.x > x);
  assert.equal(r.duo.effects(1, 'octopus-grapple').length, 1);
  press(r, 87);
  assert.equal(r.duo.effects(1, 'octopus-grapple').length, 0);
  assert.ok(Number(r.globals.get('du2p')) > 0);
  assert.deepEqual(r.faults, []);
});

test('octopus dream attacks left, then right, then up with at most two hits', () => {
  const r = game(41), enemy = r.duo.body(2), before = hp(r);
  Object.assign(enemy, { x: -94, y: -47 });
  press(r, 83);
  advance(r, 20);
  assert.equal(hp(r), before - 9);
  Object.assign(enemy, { x: -24, y: -47 });
  advance(r, 19);
  assert.equal(hp(r), before - 18);
  Object.assign(enemy, { x: -60, y: -18 });
  advance(r, 21);
  assert.equal(hp(r), before - 18);
  assert.deepEqual(r.faults, []);
});

test('zealot lights an altar with an ember and all three overlapping branches hit after the fuse', () => {
  const r = game(42), body = r.duo.body(1), enemy = r.duo.body(2);
  press(r, 82);
  const rocket = rockets(r)[0];
  assert.equal(rocket.duoEffect.blastAt, undefined);
  body.x = rocket.x - 27;
  enemy.x = rocket.x;
  const before = hp(r);
  press(r, 69);
  advance(r, 10);
  assert.ok(rocket.duoEffect.blastAt > r.tick);
  assert.equal(rocket.picture.id, 'zealot/lit');
  assert.equal(hp(r), before);
  advance(r, rocket.duoEffect.blastAt - r.tick);
  assert.equal(hp(r), before - 18);
  assert.equal(rockets(r).length, 0);
  assert.deepEqual(r.faults, []);
});

test('zealot leap places a delayed rocket, and fireworks damage with at most two rockets across the chain', () => {
  const leap = game(42, 2, ['secondary']);
  const x = leap.duo.body(1).x;
  press(leap, 82);
  const [rocket] = rockets(leap);
  assert.equal(rocket.x, x);
  assert.equal(rocket.duoEffect.blastAt - leap.tick, 42);
  advance(leap, 12);
  assert.ok(leap.duo.body(1).x > x + 15);

  const r = game(42), enemy = r.duo.body(2), before = hp(r);
  press(r, 82);
  press(r, 83);
  const armed = rockets(r).sort((a, b) => a.duoEffect.blastAt - b.duoEffect.blastAt);
  assert.equal(armed.length, 4);
  assert.ok(armed.every((e, index) => index === 0 || e.duoEffect.blastAt - armed[index - 1].duoEffect.blastAt === 18));
  for (const e of armed) {
    Object.assign(enemy, { x: e.x, y: e.y });
    advance(r, e.duoEffect.blastAt - r.tick);
  }
  assert.equal(hp(r), before - 36);
  assert.deepEqual([...r.faults, ...leap.faults], []);
});

test('the new loadouts enter online rooms and replay the same inputs deterministically', async () => {
  const hub = new RoomHub(new MemoryStore());
  await hub.matchmake({}, { build, character: 41, skill: 'secondary' });
  const { match } = await hub.matchmake({}, { build, character: 42, skill: 'primary' });
  assert.deepEqual([match.p1, match.p2, ...match.skills], [41, 42, 'secondary', 'primary']);
  const a = game(match.p1, match.p2, match.skills), b = game(match.p1, match.p2, match.skills);
  for (let tick = 0; tick < 110; tick++) {
    for (const r of [a, b]) {
      if (tick === 0) press(r, 82, 80);
      else if (tick === 5) press(r, 69, 13);
      else if (tick === 15) press(r, 83, 40);
      else r.step();
    }
    assert.equal(stateHash(a), stateHash(b));
  }
  assert.deepEqual([...a.faults, ...b.faults], []);
});
