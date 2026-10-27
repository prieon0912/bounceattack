import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Runtime } from "../public/src/runtime.js";
import { registerOriginal } from "../public/src/original-program.js";
import { applyInputs, stateHash } from "../public/src/frame-sync.js";
const project = JSON.parse(fs.readFileSync(new URL("../public/data/project.json", import.meta.url)));
// Test-only skill; the shipped registry stays empty.
const sample = {
  character: 1, manaCost: 10, cooldownTicks: 12,
  *cast(r, c, { side, caster, target }) {
    assert.equal(c.e, caster);
    assert.equal(target.objectId, side === 1 ? "n8fg" : "00h9");
    r.add(caster, side === 1 ? "7ir2" : "akf6", -7);
    yield 3;
  },
};
function game(definitions = [sample], p1 = 1, p2 = 2) {
  const r = new Runtime(project, { headless: true, secondarySkills: definitions });
  registerOriginal(r); r.start({ p1, p2, seed: 12, skills: [p1, p2].map(ch => definitions.some(d => d.character === ch) ? "secondary" : "primary") });
  for (let i = 0; i < 240; i++) r.step();
  r.originals.get("00h9").x = -180; r.originals.get("n8fg").x = 180;
  for (const id of ["qn98", "thom"]) r.globals.set(id, 100);
  return r;
}
function step(r, a = 0, b = 0) { applyInputs(r, [a, b]); r.step(); }
test("empty registry leaves both original skill keys and combat state unchanged", () => {
  const r = game([]);
  assert.equal(r.secondarySkills.replacesKey(82), false);
  assert.equal(r.secondarySkills.replacesKey(80), false);
  step(r, 16, 16);
  assert.ok(![...r.globals.keys()].some(k => String(k).startsWith("secondary-skill:")));
  assert.deepEqual(r.faults, []);
});
test("R executes the registered effect, replaces only R, and respects mana, hold and cooldown", () => {
  const r = game(); const hp = r.num(r.globals.get("7ir2"));
  r.globals.set("qn98", 5); step(r, 16);
  assert.equal(r.secondarySkills.state(1).mode, "secondary");
  r.globals.set("qn98", 100); step(r); step(r, 16);
  assert.equal(r.secondarySkills.state(1).mode, "secondary");
  assert.equal(r.globals.get("7ir2"), hp - 7);
  assert.ok(r.num(r.globals.get("qn98")) < 91);
  assert.equal(r.secondarySkills.replacesKey(82), true);
  assert.equal(r.secondarySkills.replacesKey(80), false);
  assert.equal(r.secondarySkills.replacesKey(83), false);
  assert.equal(r.value({e:r.originals.get("00h9")}, "is_press_some_key", [82]), false);
  for (let i = 0; i < 20; i++) step(r, 16);
  assert.equal(r.globals.get("7ir2"), hp - 7, "holding does not recast");
  step(r); step(r, 16);
  assert.equal(r.globals.get("7ir2"), hp - 14);
  assert.deepEqual(r.faults, []);
});
test("stun, existing action, pause and cooldown prevent secondary activation", () => {
  const r = game();
  r.globals.set("8w41", 1); step(r, 16);
  assert.equal(r.secondarySkills.state(1).mode, "secondary");
  step(r); r.globals.set("8w41", 0); r.globals.set("rr24", 2); step(r, 16);
  assert.equal(r.secondarySkills.state(1).mode, "secondary");
  step(r); r.globals.set("rr24", 0); r.paused = true; step(r, 16);
  assert.equal(r.secondarySkills.state(1).mode, "secondary");
  r.paused = false; step(r, 16);
  const ready = r.secondarySkills.state(1).readyAt;
  step(r); step(r, 16);
  assert.equal(r.secondarySkills.state(1).readyAt, ready);
});
test("R/P mirror effects and state are independent, deterministic, and reset for a new match", () => {
  const a = game([sample], 1, 1), b = game([sample], 1, 1);
  const hp = [a.globals.get("akf6"), a.globals.get("7ir2")];
  for (let i = 0; i < 40; i++) {
    for (const r of [a, b]) step(r, i === 0 ? 16 : 0, i === 5 ? 16 : 0);
    assert.equal(stateHash(a), stateHash(b));
  }
  assert.equal(a.globals.get("akf6"), hp[0] - 7);
  assert.equal(a.globals.get("7ir2"), hp[1] - 7);
  assert.equal(a.secondarySkills.state(1).mode, "secondary");
  assert.equal(a.secondarySkills.state(2).mode, "secondary");
  assert.notEqual(a.secondarySkills.state(1).readyAt, a.secondarySkills.state(2).readyAt);
  a.start({ p1: 1, p2: 1, seed: 12 });
  assert.equal(a.secondarySkills.state(1).mode, "primary");
  assert.equal(a.secondarySkills.state(2).readyAt, 0);
  assert.deepEqual(a.faults, []);
});
