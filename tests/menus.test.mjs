import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Runtime } from "../public/src/runtime.js";
import { registerOriginal } from "../public/src/original-program.js";
const project = JSON.parse(
  fs.readFileSync(new URL("../public/data/project.json", import.meta.url)),
);
function menu() {
  const r = new Runtime(project, { headless: true });
  r.originalUI = true;
  registerOriginal(r);
  r.startProject();
  r.loadScene("1ckl");
  for (let i = 0; i < 15; i++) r.step();
  return r;
}
test("original selector initializes all 34 clone positions before shared counters are reused", () => {
  const r = menu(),
    groups = ["3y3g", "k089", "646h", "a091", "ncwe"];
  const tiles = r.entities.filter(
    (e) => e.clone && groups.includes(e.objectId),
  );
  assert.equal(tiles.length, 34);
  for (const id of groups) {
    const row = tiles.filter((e) => e.objectId === id);
    assert.equal(new Set(row.map((e) => e.x)).size, row.length);
    assert.ok(row.every((e) => e.x >= -140 && e.x <= 140));
  }
  assert.deepEqual(r.faults, []);
});
test("source menu scenes initialize and transitions cancel the previous scene", () => {
  const r = menu();
  for (const scene of ["qc29", "ub0s", "1323", "1ckl", "s27s"]) {
    r.loadScene(scene);
    for (let i = 0; i < 120; i++) r.step();
    assert.equal(r.scene, scene);
    assert.deepEqual(r.faults, []);
    assert.ok(r.entities.every((e) => e.def.scene === scene));
  }
  r.mouse.down = true;
  r.keys.add(65);
  r.startProject();
  assert.equal(r.mouse.down, false);
  assert.equal(r.keys.size, 0);
  assert.equal(r.scene, "qc29");
});
