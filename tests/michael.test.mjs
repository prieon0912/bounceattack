import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Runtime } from '../public/src/runtime.js';
import { registerOriginal } from '../public/src/original-program.js';
import { RoomHub } from '../server/rooms.js';
import { MemoryStore } from '../server/store.js';
import { stateHash } from '../public/src/frame-sync.js';

const project = JSON.parse(fs.readFileSync(new URL('../public/data/project.json', import.meta.url)));
const runtime = () => {
  const r = new Runtime(structuredClone(project), { headless: true });
  registerOriginal(r);
  return r;
};
const balls = r => r.entities.filter(e => e.michaelBall && !e.dead);
const run = (r, ticks) => { for (let i = 0; i < ticks; i++) r.step(); };
function fixture(sport, secondary = false) {
  const r = runtime().start({ p1: 36, p2: 2, seed: 22, skills: [secondary ? 'secondary' : 'primary'], sportRolls: [['basketball','football','baseball'].indexOf(sport)] });
  run(r, 240);
  for (const thread of [...r.threads, ...r.pending]) thread.cancelled = true;
  r.michael.state(1).sport = sport;
  r.globals.set('qn98', 100);
  r.globals.set('etjn', 1);
  Object.assign(r.michael.body(1), { x: -30, y: 0 });
  Object.assign(r.michael.body(2), { x: -200, y: 80 });
  r.collisionProvider = () => false;
  return r;
}

test('Michael is selectable in the native menu with both loadouts', () => {
  const r = runtime();
  r.originalUI = true;
  r.startProject();
  r.loadScene('1ckl');
  run(r, 15);
  const tile = r.entities.find(e => e.objectId === 'ncwe' && e.clone && r.get(e, 'eti2') == 36);
  assert.equal(tile?.picture.id, 'michael-select');
  r.globals.set('jx38', 1);
  r.globals.set('16fh', 36);
  r.globals.set('yraj', 1);
  assert.equal(r.secondarySkills.selectKey(82), true);
  assert.equal(r.secondarySkills.selectionInfo(1).name, '수비 전술');
  assert.deepEqual(r.faults, []);
});

for (const [sport, count] of [['basketball', 5], ['football', 6], ['baseball', 7]]) {
  test(sport + ' ultimate releases the correct number of balls from the normal controls', () => {
    const r = fixture(sport);
    r.keys.add(83);
    run(r, 12);
    assert.equal(r.originals.get('afvb').picture.fileurl, 'assets/michael/profile-' + sport + '.svg');
    assert.equal(balls(r).length, count);
    assert.equal(r.globals.get('qn98'), 38);
    assert.deepEqual(r.faults, []);
  });
}

test('projectiles reflect off both side walls, ceiling and terrain, and fall out through the void', () => {
  const r = fixture('basketball');
  r.collisionProvider = (e, id) => id === '6tzq' && e.x > -15 && e.x < 15 && e.y < -10 && e.y > -20;
  const left = r.michael.launch(1, -6, 0, 5, { x: -233, y: 0 });
  const right = r.michael.launch(1, 6, 0, 5, { x: 233, y: 0 });
  const top = r.michael.launch(1, 0, 6, 5, { x: 80, y: 128 });
  const ground = r.michael.launch(1, 0, -6, 5, { x: 0, y: -8 });
  const voidBall = r.michael.launch(1, 0, -6, 5, { x: 100, y: -140 });
  run(r, 2);
  assert.ok(left.michaelBall.vx > 0);
  assert.ok(right.michaelBall.vx < 0);
  assert.ok(top.michaelBall.vy < 0);
  assert.ok(ground.michaelBall.vy > 0);
  assert.ok(voidBall.dead);
  assert.deepEqual(r.faults, []);
});

test('overlapping balls from one ultimate cannot stack damage on the same tick', () => {
  const r = fixture('baseball');
  Object.assign(r.michael.body(2), { x: -15, y: 4 });
  const hp = r.globals.get('7ir2');
  r.keys.add(83);
  run(r, 1);
  assert.equal(r.globals.get('7ir2'), hp - 4);
  assert.deepEqual(r.faults, []);
});

test('football secondary loadout traps a frontal ball and buffs the next shot', () => {
  const r = fixture('football', true);
  r.keys.add(82);
  run(r, 1);
  assert.ok(r.michael.state(1).guardUntil > r.tick);
  Object.assign(r.michael.body(2), { x: 30, y: 0 });
  const incoming = r.michael.launch(1, -6, 0, 5, { x: -12, y: 0 });
  incoming.michaelBall.side = 2;
  incoming.combatSide = 2;
  r.keys.clear();
  run(r, 2);
  assert.ok(incoming.dead);
  assert.equal(r.michael.state(1).trapped, true);
  r.keys.add(69);
  run(r, 1);
  assert.equal(balls(r)[0].michaelBall.life, 68);
  assert.equal(r.michael.state(1).trapped, false);
});

test('seeded mirror matches roll independently and reproduce the same state', () => {
  const a = runtime().start({ p1: 36, p2: 36, seed: 22 });
  const b = runtime().start({ p1: 36, p2: 36, seed: 22 });
  for (const r of [a,b]) {
    run(r, 240);
    assert.notEqual(r.michael.state(1), r.michael.state(2));
    for (const [side, id] of [[1, 'afvb'], [2, '8svk']]) {
      const profile = r.originals.get(id);
      assert.equal(profile.visible, true);
      assert.equal(profile.picture.fileurl, 'assets/michael/profile-' + r.michael.state(side).sport + '.svg');
    }
    r.globals.set('qn98', 100);
    r.globals.set('thom', 100);
    r.keys = new Set([83, 40, 69, 13]);
    run(r, 160);
    assert.deepEqual(r.faults, []);
  }
  assert.equal(stateHash(a), stateHash(b));
});


test('online matchmaking preserves both Michael loadouts', async () => {
  const hub = new RoomHub(new MemoryStore());
  const build = 'a'.repeat(64);
  await hub.matchmake({}, { build, character: 36, skill: 'primary' });
  const room = await hub.matchmake({}, { build, character: 36, skill: 'secondary' });
  assert.deepEqual([room.match.p1, room.match.p2], [36,36]);
  assert.deepEqual(room.match.skills, ['primary','secondary']);
  assert.equal(room.match.sportRolls.length, 2);
  assert.ok(room.match.sportRolls.every(roll => [0,1,2].includes(roll)));
});

test('baseball uses a melee basic and reflects a frontal shot with the second skill', () => {
  const r = fixture('baseball', true);
  Object.assign(r.michael.body(2), { x: 8, y: 0 });
  const hp = r.globals.get('7ir2');
  r.keys.add(69);
  run(r, 9);
  assert.equal(r.globals.get('7ir2'), hp - 10);
  const bat = r.entities.find(e => e.michaelEffect === 'held' && e.combatSide === 1);
  assert.deepEqual([bat.regX, bat.regY, r.size(bat)], [24, 77, 34]);
  assert.equal(balls(r).length, 0);
  r.keys = new Set([82]);
  run(r, 1);
  Object.assign(r.michael.body(2), { x: 50, y: 0 });
  const incoming = r.michael.launch(1, -6, 0, 5, { x: -12, y: 0 });
  incoming.michaelBall.side = 2;
  incoming.combatSide = 2;
  r.keys.clear();
  run(r, 2);
  assert.equal(incoming.michaelBall.side, 1);
  assert.ok(incoming.michaelBall.vx > 0);
  assert.deepEqual(r.faults, []);
});


test('new online and offline matches can start in all three sports', () => {
  const r = runtime();
  for (const [index, sport] of ['basketball', 'football', 'baseball'].entries()) {
    r.start({ p1: 36, p2: 36, seed: 22, sportRolls: [index, 2 - index] });
    run(r, 1);
    assert.equal(r.michael.state(1).sport, sport);
    assert.equal(r.michael.state(2).sport, ['baseball','football','basketball'][index]);
    r.randomSource = () => (index + .5) / 3;
    r.startProject();
    r.globals.set('y75t', 36);
    r.globals.set('s5vb', 2);
    r.loadScene('7dwq');
    run(r, 1);
    assert.equal(r.michael.state(1).sport, sport);
  }
});
test('football starts at the held ball, halves basic travel and curves with a hit slow', () => {
  const r = fixture('football');
  r.michael.afterStep();
  const held = r.entities.find(e => e.michaelEffect === 'held' && e.combatSide === 1);
  r.michael.basic(1);
  const basic = balls(r)[0];
  assert.deepEqual([basic.x, basic.y, basic.michaelBall.life], [held.x, held.y, 50]);
  basic.dead = true;
  for (const height of [-40, 40]) {
    Object.assign(r.michael.body(2), { x: 120, y: height });
    r.michael.skill(1, false);
    const shot = balls(r)[0];
    run(r, 3);
    assert.equal(Math.sign(shot.michaelBall.vy), Math.sign(height));
    shot.dead = true;
  }
  Object.assign(r.michael.body(2), { x: 0, y: 3 });
  r.michael.skill(1, false);
  run(r, 5);
  assert.equal(r.get(r.michael.body(2), 'nccn'), 4);
  assert.ok(r.secondarySkills.state(1).slow.until > r.tick);
  assert.deepEqual(r.faults, []);
});
