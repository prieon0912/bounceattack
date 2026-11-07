import test from "node:test";
import assert from "node:assert/strict";
import { RoomHub } from "../server/rooms.js";
import { MemoryStore } from "../server/store.js";
const build = "a".repeat(64);
test("matchmaking pairs waiting players across hubs and starts automatically", async () => {
  const store = new MemoryStore(),
    a = new RoomHub(store),
    b = new RoomHub(store),
    p = {},
    q = {};
  const waiting = await a.matchmake(p, { build, character: 1 });
  assert.equal(waiting.phase, "lobby");
  const match = await b.matchmake(q, { build, character: 2 });
  assert.equal(p.code, q.code);
  assert.equal(match.phase, "playing");
  assert.equal(match.match.p1, 1);
  assert.equal(match.match.p2, 2);
  assert.ok(!("character" in a.public(match).players[0]));
});
test("matchmaking allows mirrors and skips disconnected tickets and other builds", async () => {
  const store = new MemoryStore(),
    hub = new RoomHub(store),
    a = {},
    b = {},
    c = {},
    d = {},
    e = {};
  await hub.matchmake(a, { build, character: 1 });
  await hub.matchmake(b, { build, character: 1 });
  assert.equal(a.code, b.code);
  assert.equal((await hub.state(a.code)).phase, "playing");
  const stale = {};
  await hub.matchmake(stale, { build, character: 3 });
  await hub.leave(stale);
  await hub.matchmake(c, { build, character: 2 });
  assert.notEqual(c.code, stale.code);
  await hub.matchmake(d, { build: "b".repeat(64), character: 3 });
  await hub.matchmake(e, { build, character: 4 });
  assert.notEqual(d.code, e.code);
});
test("concurrent matchmaking never assigns three players to one match", async () => {
  const store = new MemoryStore(),
    hubs = [new RoomHub(store), new RoomHub(store)],
    players = Array.from({ length: 10 }, () => ({}));
  await Promise.all(
    players.map((p, i) =>
      hubs[i % 2].matchmake(p, { build, character: i + 1 }),
    ),
  );
  const groups = new Map();
  for (const p of players) {
    groups.set(p.code, (groups.get(p.code) || 0) + 1);
  }
  assert.equal(groups.size, 5);
  assert.ok([...groups.values()].every((n) => n === 2));
});

test("matchmaking preserves different skill loadouts in a mirror match without leaking lobby choices", async () => {
  const hub = new RoomHub(new MemoryStore()), a = {}, b = {};
  await hub.matchmake(a, { build, character: 1, skill: "secondary" });
  const match = await hub.matchmake(b, { build, character: 1, skill: "primary" });
  assert.deepEqual(match.match.skills, ["secondary", "primary"]);
  assert.ok(!("skill" in hub.public(match).players[0]));
  await assert.rejects(hub.matchmake({}, { build, character: 22, skill: "secondary" }));
  await assert.rejects(hub.matchmake({}, { build, character: 1, skill: "invalid" }));
});
