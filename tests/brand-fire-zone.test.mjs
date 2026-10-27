import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Runtime } from "../public/src/runtime.js";
import { registerOriginal } from "../public/src/original-program.js";
import { applyInputs, stateHash } from "../public/src/frame-sync.js";
import { FIRE_ZONE } from "../public/src/brand-fire-zone.js";
const project = JSON.parse(fs.readFileSync(new URL("../public/data/project.json", import.meta.url)));
function game(p1 = 1, p2 = 2) {
  const r = new Runtime(structuredClone(project), { headless: true });
  registerOriginal(r); r.start({ p1, p2, seed: 19 });
  for (let t = 0; t < 240; t++) r.step();
  for (const thread of [...r.threads, ...r.pending])
    if (["00h9", "n8fg"].includes(thread.e.objectId)) thread.cancelled = true;
  Object.assign(r.originals.get("00h9"), { x: 0, y: 0 });
  Object.assign(r.originals.get("n8fg"), { x: 70, y: 0 });
  for (const id of ["qn98", "thom"]) r.globals.set(id, 100);
  return r;
}
function step(r, p1 = 0, p2 = 0) { applyInputs(r, [p1, p2]); r.step(); }
test("Brand fire zone deals 5 every second, five times, and cleans up after five seconds", () => {
  const r = game(), hp = r.globals.get("7ir2");
  step(r, 16); const zone = r.secondarySkills.state(1).zone;
  assert.deepEqual([zone.x, zone.y, zone.radius], [0, 0, 90]);
  assert.ok(r.num(r.globals.get("qn98")) < 69);
  for (let t = 1; t <= 301; t++) {
    step(r);
    assert.equal(hp - r.num(r.globals.get("7ir2")), 5 * Math.min(5, Math.floor(t / 60)), `tick ${t}`);
    if (t === 20) assert.equal(r.num(r.globals.get("rr24")), 0, "placement does not lock player for five seconds");
  }
  assert.equal(r.secondarySkills.state(1).zone, undefined);
  assert.ok(!r.entities.some(e => e.secondaryEffect === "brand-fire-zone"));
  assert.deepEqual(r.faults, []);
});
test("installed area stays put; slow applies only inside and preserves other slows", () => {
  const r = game(), target = r.originals.get("n8fg");
  step(r, 16);
  r.originals.get("00h9").x = -150;
  step(r);
  assert.equal(r.secondarySkills.state(1).zone.x, 0);
  assert.equal(r.get(target, "nccn"), FIRE_ZONE.slow);
  assert.equal(r.num(r.globals.get("nccn")), 0, "secondary slow does not contaminate original decay state");
  target.x = 91; assert.equal(r.num(r.get(target, "nccn")), 0);
  target.x = 0; target.y = 91; assert.equal(r.num(r.get(target, "nccn")), 0);
  target.y = 0; target.x = 90; assert.equal(r.get(target, "nccn"), FIRE_ZONE.slow);
  r.globals.set("nccn", 15); assert.equal(r.get(target, "nccn"), 15);
  target.x = 150; assert.equal(r.get(target, "nccn"), 15);
});
test("outside players take no damage; entering and leaving changes subsequent ticks", () => {
  const r = game(), target = r.originals.get("n8fg"), hp = r.globals.get("7ir2");
  target.x = 120; step(r, 16);
  for (let t = 1; t <= 60; t++) step(r);
  assert.equal(r.globals.get("7ir2"), hp);
  target.x = 50;
  for (let t = 0; t < 60; t++) step(r);
  assert.equal(r.globals.get("7ir2"), hp - 5);
  target.x = 120;
  for (let t = 0; t < 60; t++) step(r);
  assert.equal(r.globals.get("7ir2"), hp - 5);
});
test("fire zone damage uses original shield handling", () => {
  const r = game(), hp = r.globals.get("7ir2");
  r.globals.set("g4sc", 10); step(r, 16);
  for (let t = 0; t < 60; t++) step(r);
  assert.equal(r.globals.get("7ir2"), hp);
  assert.equal(r.num(r.globals.get("g4sc")), 5);
});
test("P works for second player; simultaneous mirror fields stay deterministic and independent", () => {
  for (const [p1, p2] of [[2, 1], [1, 1]]) {
    const a = game(p1, p2), b = game(p1, p2);
    const hp = [a.globals.get("akf6"), a.globals.get("7ir2")];
    for (let t = 0; t <= 301; t++) {
      for (const r of [a, b]) step(r, t === 0 && p1 === 1 ? 16 : 0, t === 0 ? 16 : 0);
      assert.equal(stateHash(a), stateHash(b));
    }
    assert.equal(a.num(a.globals.get("akf6")), hp[0] - 25);
    assert.equal(a.num(a.globals.get("7ir2")), hp[1] - (p1 === 1 ? 25 : 0));
    assert.deepEqual(a.faults, []);
  }
});
test("original selector uses the new icon and matching skill description", () => {
  const r = game();
  const first = id => r.project.variables.find(v => v.id === id).array[0].data;
  assert.equal(first("x7mx"), "화염지대");
  assert.match(first("gsve"), /1초마다 5/);
  assert.match(r.defs.get("o9rj").sprite.pictures[0].fileurl, /brand-fire-zone-icon/);
  assert.ok(r.defs.get("hb4u").sprite.pictures.some(p => p.id === "brand-fire-zone-area"));
  const names = project.objects.find(o => o.id === "hb4u").sprite.pictures;
  assert.ok(!names.some(p => p.id === "brand-fire-zone-area"), "archived metadata is not modified on disk");
});
