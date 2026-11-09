import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Runtime } from "../public/src/runtime.js";
import { registerOriginal } from "../public/src/original-program.js";
import { FrameSync, stateHash } from "../public/src/frame-sync.js";
const project = JSON.parse(
  fs.readFileSync(new URL("../public/data/project.json", import.meta.url)),
);
function runtime(p1, p2) {
  const r = new Runtime(project, { headless: true });
  registerOriginal(r);
  return r.start({ p1, p2, seed: 20261027 });
}
test("all 35 fighters stay identical across clients with delayed, reordered input batches", () => {
  for (let character = 1; character <= 35; character++) {
    const rs = [
        runtime(character, character === 2 ? 1 : 2),
        runtime(character, character === 2 ? 1 : 2),
      ],
      queue = [],
      faults = [];
    let clock = 0;
    const syncs = [0, 1].map(
      (role) =>
        new FrameSync(role, {
          onSend: (frames) =>
            queue.push({
              role,
              frames,
              due: clock + ((frames[0][0] * 7 + role * 3) % 9),
            }),
          onFault: (m) => faults.push(m),
        }),
    );
    for (clock = 0; clock < 3000 && rs.some((r) => r.tick < 240); clock++) {
      for (let i = queue.length - 1; i >= 0; i--)
        if (queue[i].due <= clock) {
          const packet = queue.splice(i, 1)[0];
          syncs[1 - packet.role].receive(packet.role, packet.frames);
        }
      for (let role = 0; role < 2; role++) {
        if (rs[role].tick >= 240) continue;
        const target = rs[role].tick + 4;
        syncs[role].mask =
          target % 100 < 30
            ? 8
            : target % 100 < 50
              ? 16
              : target % 100 < 65
                ? 32
                : 0;
        syncs[role].advance(rs[role]);
      }
    }
    assert.deepEqual(
      rs.map((r) => r.tick),
      [240, 240],
      `character ${character} stalled`,
    );
    assert.equal(
      stateHash(rs[0]),
      stateHash(rs[1]),
      `character ${character} desynced`,
    );
    assert.deepEqual(faults, []);
    for (const r of rs) assert.deepEqual(r.faults, []);
  }
});
test("missing input stalls safely, history replay resumes without changing state", () => {
  const rs = [runtime(14, 20), runtime(14, 20)],
    syncs = [];
  let dropped = false;
  for (let role = 0; role < 2; role++)
    syncs.push(
      new FrameSync(role, {
        onSend: (frames) => {
          if (role === 0 && frames[0][0] === 20 && !dropped) {
            dropped = true;
            return;
          }
          syncs[1 - role].receive(role, frames);
        },
      }),
    );
  for (let i = 0; i < 80; i++)
    for (let role = 0; role < 2; role++) syncs[role].advance(rs[role]);
  assert.equal(rs[1].tick, 19);
  syncs[1].receive(0, syncs[0].replay(20));
  for (let i = 0; i < 80; i++)
    for (let role = 0; role < 2; role++)
      if (rs[role].tick < 60) syncs[role].advance(rs[role]);
  assert.deepEqual(
    rs.map((r) => r.tick),
    [60, 60],
  );
  assert.equal(stateHash(rs[0]), stateHash(rs[1]));
});
test("conflicting inputs and divergent checksums stop instead of silently drifting", () => {
  let errors = [];
  const sync = new FrameSync(0, { onFault: (m) => errors.push(m) });
  sync.receive(1, [[4, 1]]);
  sync.receive(1, [[4, 2]]);
  assert.equal(sync.failed, true);
  assert.equal(errors.length, 1);
  const r = runtime(1, 2),
    other = new FrameSync(0);
  const hash = other.checkpoint(r);
  other.checksum(0, (hash ^ 1) >>> 0);
  assert.equal(other.failed, true);
});
