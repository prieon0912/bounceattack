import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Runtime } from "../public/src/runtime.js";
import { registerOriginal } from "../public/src/original-program.js";
import { stateHash } from "../public/src/frame-sync.js";
const project = JSON.parse(
  fs.readFileSync(new URL("../public/data/project.json", import.meta.url)),
);
function mirror(character) {
  const r = new Runtime(project, { headless: true });
  registerOriginal(r);
  return r.start({ p1: character, p2: character, seed: 123 });
}
test("all 34 mirror matches execute simultaneous basic, skill and ultimate inputs deterministically", () => {
  for (let character = 1; character <= 34; character++) {
    const a = mirror(character),
      b = mirror(character);
    for (let tick = 0; tick < 400; tick++) {
      for (const r of [a, b]) {
        for (const id of ["qn98", "thom"]) r.globals.set(id, 100);
        for (const id of ["akf6", "7ir2"]) r.globals.set(id, 1000);
        const keys = tick < 100 ? [69, 79] : tick < 220 ? [82, 80] : [83, 40];
        r.keys = new Set(keys);
        r.step();
      }
      if (tick % 60 === 0)
        assert.equal(
          stateHash(a),
          stateHash(b),
          `character=${character},tick=${tick}`,
        );
    }
    assert.deepEqual(a.faults, [], `character=${character}`);
  }
});
test("shared fire clone starts at its actual caster and keeps separate local state", () => {
  const r = mirror(14);
  for (let i = 0; i < 3; i++) r.step();
  r.originals.get("n230").x = -100;
  r.originals.get("ocqj").x = 100;
  const before = r.sequence;
  r.command({ e: r.originals.get("n230") }, "create_clone", ["0s0q"]);
  r.command({ e: r.originals.get("ocqj") }, "create_clone", ["0s0q"]);
  r.step();
  const clones = r.entities.filter(
    (e) => e.objectId === "0s0q" && e.uid > before,
  );
  assert.equal(clones.length, 2);
  assert.ok(clones.find((e) => e.combatSide === 1).x < -80);
  assert.ok(clones.find((e) => e.combatSide === 2).x > 80);
  assert.notEqual(clones[0].locals, clones[1].locals);
  assert.deepEqual(r.faults, []);
});
test("shared effect ownership isolates selector branches and object-local variables", () => {
  const r = mirror(24),
    p1 = r.originals.get("szec"),
    p2 = r.mirrorOriginals.get("szec");
  assert.equal(r.value({ e: p1 }, "get_variable", ["y75t"]), 24);
  assert.equal(r.value({ e: p1 }, "get_variable", ["s5vb"]), 0);
  assert.equal(r.value({ e: p2 }, "get_variable", ["y75t"]), 0);
  assert.equal(r.value({ e: p2 }, "get_variable", ["s5vb"]), 24);
  assert.equal(
    r.value({ e: p2, inFunction: true }, "get_variable", ["y75t"]),
    24,
  );
  const local = project.variables.find((v) => v.object === "szec");
  assert.ok(local);
  r.set(p1, local.id, 123);
  assert.notEqual(r.get(p2, local.id), 123);
  assert.equal(r.target(p2, "szec"), p2);
});
