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
  return r.start({ p1, p2, seed: 77 });
}
test("each side may change its own input delay mid-match without desync", () => {
  for (const [p1, p2] of [[1, 2], [5, 9], [14, 14], [20, 33], [35, 35]]) {
    const rs = [runtime(p1, p2), runtime(p1, p2)],
      queue = [],
      faults = [];
    let clock = 0,
      seed = p1 * 31 + p2;
    const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    const syncs = [0, 1].map(
      (role) =>
        new FrameSync(role, {
          delay: 3,
          onSend: (frames) =>
            queue.push({ role, frames, due: clock + Math.floor(rand() * 6) }),
          onFault: (m) => faults.push(m),
        }),
    );
    for (clock = 0; clock < 6000 && rs.some((r) => r.tick < 600); clock++) {
      for (let i = queue.length - 1; i >= 0; i--)
        if (queue[i].due <= clock) {
          const packet = queue.splice(i, 1)[0];
          syncs[1 - packet.role].receive(packet.role, packet.frames);
        }
      for (let role = 0; role < 2; role++) {
        if (rs[role].tick >= 600) continue;
        if (clock % 37 === role * 11) syncs[role].setDelay(1 + Math.floor(rand() * 7));
        syncs[role].mask = Math.floor(rand() * 64);
        syncs[role].advance(rs[role]);
      }
    }
    assert.deepEqual(faults, []);
    assert.equal(rs[0].tick, 600);
    assert.equal(rs[1].tick, 600);
    assert.equal(stateHash(rs[0]), stateHash(rs[1]));
  }
});
