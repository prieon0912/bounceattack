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
function press(r, key) {
  r.keys.add(key);
  r.step();
  r.keys.delete(key);
}
function game(options = {}) {
  const r = new Runtime(structuredClone(project), { headless: true });
  registerOriginal(r);
  r.start({ p1: 40, p2: 40, seed: 22, ...options });
  r.collisionProvider = (e, id) => id === '6tzq' && e.y < -50;
  advance(r, 4);
  for (const [side, x] of [[1, -10], [2, 4]]) {
    Object.assign(r.duo.body(side), { x, y: -47 });
  }
  r.globals.set('qn98', 100);
  r.globals.set('thom', 100);
  return r;
}
const hp = (r, side) => Number(r.globals.get(side === 1 ? 'akf6' : '7ir2'));

function attack(r, group, damage = 5) {
  r.spawn(r.duo.body(2), function* strike(rt, context) {
    context.thornAttackGroup = group;
    yield* rt.call(context, '05j0', [-damage, 0, 1]);
  }, 'test_attack');
  r.step();
}

test('reflection uses actual HP loss, rolls once per attack, and guard raises the threshold', () => {
  const r = game();
  let rolls = 0;
  r.random = () => { rolls++; return .19; };
  const first = hp(r, 1), enemy = hp(r, 2);
  r.globals.set('cfmd', 2);
  attack(r, 'combo');
  assert.equal(hp(r, 2), enemy - 2 * (first - hp(r, 1)));
  assert.ok(hp(r, 1) < first);
  const reflected = hp(r, 2);
  attack(r, 'combo');
  assert.equal(hp(r, 2), reflected);
  assert.equal(rolls, 1);
  r.random = () => .39;
  attack(r, 'outside-guard');
  assert.equal(hp(r, 2), reflected);
  press(r, 82);
  assert.equal(r.originals.get('n230').duoPicture.id, 'thorn/guard');
  attack(r, 'during-guard');
  assert.equal(hp(r, 2), reflected - 10);
  assert.deepEqual(r.faults, []);
});

test('HP drains at two-second intervals and the circular basic hits behind the fighter once', () => {
  const r = game({ p2: 2 });
  const state = r.duo.state(1), first = hp(r, 1);
  advance(r, state.drainAt - r.tick - 1);
  assert.equal(hp(r, 1), first);
  advance(r, 1);
  assert.equal(hp(r, 1), first - 1);
  assert.equal(r.thorn.walk(1), 1.2);
  const fighter = r.duo.body(1), enemy = r.duo.body(2);
  Object.assign(enemy, { x: fighter.x - 12, y: fighter.y });
  r.globals.set('etjn', 1);
  const before = hp(r, 2);
  press(r, 69);
  advance(r, 18);
  assert.equal(hp(r, 2), before - 5);
  assert.deepEqual(r.faults, []);
});

test('spin has six scheduled hits, replaces the basic during its window and slows walking', () => {
  const r = game({ p2: 2, skills: ['secondary'] });
  const before = hp(r, 2);
  press(r, 82);
  assert.equal(r.thorn.walk(1), 1.02);
  assert.equal(hp(r, 2), before - 2.5);
  r.keys.add(69);
  advance(r, 143);
  r.keys.clear();
  assert.equal(hp(r, 2), before - 15);
  advance(r, 1);
  assert.equal(r.thorn.walk(1), 1.2);
  assert.deepEqual(r.faults, []);
});

test('smoke confines only the caught opponent, deals proximity damage, and expires', () => {
  const r = game({ p2: 2 });
  const enemy = r.duo.body(2), owner = r.duo.body(1);
  press(r, 83);
  const zone = r.duo.state(1).smoke;
  const before = hp(r, 2);
  assert.equal(zone.caught, true);
  advance(r, 30);
  assert.equal(hp(r, 2), before - 2);
  r.move(enemy, 200, 0, false);
  assert.ok(Math.hypot(enemy.x - zone.x, enemy.y - zone.y) <= 60);
  r.move(owner, -90, 0, false);
  assert.ok(owner.x < zone.x - 60);
  advance(r, 40);
  assert.equal(hp(r, 2), before - 2);
  advance(r, zone.until - r.tick + 1);
  r.move(enemy, 50, 0, false);
  assert.ok(enemy.x > zone.x + 60);

  const outside = game({ p2: 2 });
  outside.duo.body(2).x = 90;
  press(outside, 83);
  assert.equal(outside.duo.state(1).smoke.caught, false);
  assert.deepEqual([...r.faults, ...outside.faults], []);
});

test('online rooms accept both loadouts and seeded mirror matches stay synchronized', async () => {
  const hub = new RoomHub(new MemoryStore());
  await hub.matchmake({}, { build, character: 40, skill: 'primary' });
  const { match } = await hub.matchmake({}, { build, character: 40, skill: 'secondary' });
  assert.deepEqual([match.p1, match.p2, ...match.skills], [40, 40, 'primary', 'secondary']);
  const a = game(match), b = game(match);
  for (let tick = 0; tick < 175; tick++) {
    for (const r of [a, b]) {
      if (tick === 0) for (const key of [82, 80]) r.keys.add(key);
      if (tick === 5) r.keys.add(83);
      if (tick % 36 === 8) r.keys.add(69);
      r.step();
      r.keys.clear();
    }
    assert.equal(stateHash(a), stateHash(b));
  }
  assert.deepEqual([...a.faults, ...b.faults], []);
});
