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
const step = (r, ticks) => { for (let i = 0; i < ticks; i++) r.step(); };
function key(r, ...codes) {
  for (const code of codes) r.keys.add(code);
  r.step();
  r.keys.clear();
}

function game(options = {}) {
  const r = new Runtime(structuredClone(project), { headless: true });
  registerOriginal(r);
  r.start({ p1: 38, p2: 39, map: 6, seed: 22, ...options });
  step(r, 4);
  r.collisionProvider = (e, id) => id === '6tzq' && e.y < -50;
  return r;
}

function faceOff(r, distance = 27) {
  Object.assign(r.duo.body(1), { x: -distance / 2, y: -47 });
  Object.assign(r.duo.body(2), { x: distance / 2, y: -47 });
  r.globals.set('du2p', 0);
  r.globals.set('iblx', 0);
  r.globals.set('etjn', 1);
  r.globals.set('846x', 0);
}

test('dormancy prevents health loss, recoil, movement and attacks, then returns mana', () => {
  const r = game();
  faceOff(r);
  r.globals.set('qn98', 50);
  key(r, 82);
  const phage = r.duo.body(1), position = [phage.x, phage.y];
  r.globals.set('akf6', r.globals.get('xr74') - 5);
  const hp = r.globals.get('akf6'), enemyHp = r.globals.get('7ir2');
  const until = r.duo.state(1).dormantUntil;
  assert.equal(r.originals.get('n230').duoPicture.id, 'phage/dormant');
  r.spawn(r.duo.body(2), function* hit(rt, context) {
    yield* rt.call(context, '05j0', [-30, 0, 1]);
    rt.add(phage, 'akf6', -10);
    rt.castle.knockback(1, 35);
  }, 'test_hit');
  for (const code of [68, 87, 69]) r.keys.add(code);
  step(r, 45);
  r.keys.clear();
  assert.deepEqual([phage.x, phage.y], position);
  assert.equal(r.globals.get('akf6'), hp);
  assert.equal(r.globals.get('7ir2'), enemyHp);
  assert.equal(r.globals.get('c9o4'), 0);
  step(r, until - r.tick - 1);
  const before = r.globals.get('qn98');
  step(r, 1);
  assert.ok(r.globals.get('qn98') >= before + 5);
  step(r, 1);
  assert.equal(r.globals.get('akf6'), hp + 1);
  assert.equal(r.duo.dormant(1), false);
  assert.equal(r.originals.get('n230').duoPicture.id, 'phage/core');
  assert.deepEqual(r.faults, []);
});

test('first evolution without a direction rolls either branch', () => {
  for (const [roll, branch] of [[.25, 'armor'], [.75, 'needle']]) {
    const r = game({ skills: ['secondary', 'primary'] });
    r.random = () => roll;
    r.globals.set('qn98', 100);
    key(r, 82);
    assert.equal(r.duo.state(1).tier, 1);
    assert.equal(r.duo.state(1).branch, branch);
  }
});


test('evolution branches are selected by direction and stay separate in mirrors', () => {
  const r = game({ p2: 38, skills: ['secondary', 'secondary'] });
  r.globals.set('qn98', 100);
  r.globals.set('thom', 100);
  key(r, 65, 82, 39, 80);
  const left = r.duo.state(1), right = r.duo.state(2);
  assert.equal(left.branch, 'armor');
  assert.equal(right.branch, 'needle');
  assert.equal(r.originals.get('n230').duoPicture.id, 'phage/armor');
  assert.equal(r.originals.get('ocqj').duoPicture.id, 'phage/needle');
  step(r, 300);
  key(r, 68, 82, 80);
  assert.equal(left.tier, 2);
  assert.equal(left.branch, 'armor');
  assert.equal(right.tier, 2);
  assert.equal(r.duo.stats(left).armor, .82);
  assert.equal(r.duo.stats(right).range, 44);
  assert.deepEqual(r.faults, []);
});

test('ultimate shows previous hit damage and the fifth hit summons ten weak, destructible minions', () => {
  const r = game(), state = r.duo.state(1);
  r.globals.set('qn98', 100);
  const swing = () => { faceOff(r); key(r, 69); step(r, 34); };
  swing();
  swing();
  assert.equal(state.hits, 2);
  assert.equal(state.damage, 10);
  key(r, 83);
  assert.ok(state.armedUntil > r.tick);
  assert.equal(r.duo.effects(1, 'minion').length, 0);
  swing();
  swing();
  swing();
  const swarm = r.duo.effects(1, 'minion');
  assert.equal(swarm.length, 10);
  assert.ok(swarm.every(e => e.duoEffect.hp === 3));
  assert.equal(state.revealed, 25);
  assert.equal(state.hits, 0);
  r.duo.damageMinion(swarm[0], 3);
  assert.equal(r.duo.effects(1, 'minion').length, 9);
  const before = r.globals.get('7ir2');
  step(r, 150);
  const inflicted = before - r.globals.get('7ir2');
  assert.ok(inflicted > 0 && inflicted <= 5, String(inflicted));
  step(r, 430);
  assert.equal(r.duo.effects(1, 'minion').length, 0);
  assert.deepEqual(r.faults, []);
});

test('banana basic deals damage and ultimate peels persist, trip enemies only, and fall when unsupported', () => {
  const r = game({ p1: 39, p2: 39 });
  faceOff(r);
  const start = r.globals.get('7ir2');
  key(r, 69);
  step(r, 18);
  assert.equal(r.globals.get('7ir2'), start - 4);
  r.globals.set('qn98', 100);
  key(r, 83);
  step(r, 105);
  const traps = r.duo.effects(1, 'trap');
  assert.equal(traps.length, 6);
  assert.ok(traps.every(e => e.duoEffect.landed));
  assert.ok(new Set(traps.map(e => e.x)).size >= 5);
  step(r, 500);
  assert.equal(r.duo.effects(1, 'trap').length, 6);
  const { x, y } = traps[0];
  Object.assign(r.duo.body(1), { x, y });
  Object.assign(r.duo.body(2), { x, y });
  r.globals.delete('duo-slip:2');
  step(r, 1);
  assert.equal(r.globals.get('duo-slip:1'), undefined);
  assert.ok(r.globals.get('duo-slip:2').slowUntil > r.tick);
  assert.equal(r.duo.effects(1, 'trap').length, 6);
  r.collisionProvider = (e, id) => e.duoEffect?.kind !== 'trap' && id === '6tzq' && e.y < -50;
  step(r, 55);
  assert.equal(r.duo.effects(1, 'trap').length, 0);
  assert.deepEqual(r.faults, []);
});

test('return ticket recalls once without dropping a peel and expires if unused', () => {
  const r = game({ p1: 39, skills: ['secondary'] });
  faceOff(r);
  r.globals.set('qn98', 70);
  key(r, 82);
  const body = r.duo.body(1), state = r.duo.state(1);
  const { x, y, until } = state.returnPoint;
  assert.equal(until - r.tick, 180);
  assert.equal(r.duo.effects(1, 'return').length, 1);
  assert.equal(r.duo.effects(1, 'trap').length, 0);
  assert.ok(r.globals.get('qn98') < 47);
  body.x += 65;
  step(r, 1);
  r.globals.set('akf6', 66);
  const before = r.globals.get('qn98');
  key(r, 82);
  assert.equal(body.x, x);
  assert.ok(Math.abs(body.y - y) < 1);
  assert.equal(state.returnPoint, undefined);
  assert.equal(r.duo.effects(1, 'return').length, 0);
  assert.equal(r.globals.get('akf6'), 66);
  assert.ok(r.globals.get('qn98') >= before);

  step(r, 420);
  r.globals.set('qn98', 70);
  key(r, 82);
  step(r, 180);
  assert.equal(state.returnPoint, undefined);
  assert.equal(r.duo.effects(1, 'return').length, 0);
  assert.deepEqual(r.faults, []);
});

test('online matchmaking accepts both new secondary loadouts and effects stay in sync', async () => {
  const hub = new RoomHub(new MemoryStore());
  await hub.matchmake({}, { build, character: 38, skill: 'secondary' });
  const { match } = await hub.matchmake({}, { build, character: 39, skill: 'secondary' });
  assert.deepEqual([match.p1, match.p2, ...match.skills], [38, 39, 'secondary', 'secondary']);
  const a = game(match), b = game(match);
  for (const r of [a, b]) {
    faceOff(r);
    r.globals.set('qn98', 100);
    r.globals.set('thom', 100);
    key(r, 68, 82, 80);
  }
  for (let tick = 0; tick < 180; tick++) {
    for (const r of [a, b]) {
      if (tick === 6) r.duo.body(2).x += 45;
      if (tick === 10) r.keys.add(80);
      if (tick === 15) r.keys.add(40);
      if (tick % 32 === 0) r.keys.add(69);
      r.step();
      r.keys.clear();
    }
    assert.equal(stateHash(a), stateHash(b));
  }
  assert.ok(a.duo.effects(2, 'trap').length > 0);
  assert.deepEqual(a.faults, []);
});
