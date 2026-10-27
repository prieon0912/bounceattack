import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { once } from "node:events";
import { MemoryStore } from "../server/store.js";
import { createOnlineServer } from "../server/online-server.js";
const build = "a".repeat(64);
class Client {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.inbox = [];
    this.waiters = [];
    this.ws.on("message", (raw) => {
      const msg = JSON.parse(String(raw));
      const i = this.waiters.findIndex((w) => w.test(msg));
      if (i >= 0) {
        const w = this.waiters.splice(i, 1)[0];
        clearTimeout(w.timer);
        w.resolve(msg);
      } else this.inbox.push(msg);
    });
  }
  async open() {
    await once(this.ws, "open");
    return this;
  }
  send(msg) {
    this.ws.send(JSON.stringify(msg));
  }
  wait(test, timeout = 3000) {
    const i = this.inbox.findIndex(test);
    if (i >= 0) return Promise.resolve(this.inbox.splice(i, 1)[0]);
    return new Promise((resolve, reject) => {
      const w = {
        test,
        resolve,
        timer: setTimeout(() => {
          this.waiters = this.waiters.filter((x) => x !== w);
          reject(Error("Timed out waiting for server message"));
        }, timeout),
      };
      this.waiters.push(w);
    });
  }
  close() {
    this.ws.terminate();
    for (const w of this.waiters) clearTimeout(w.timer);
  }
}
async function setup(t) {
  const store = new MemoryStore(),
    servers = [createOnlineServer({ store }), createOnlineServer({ store })],
    clients = [];
  for (const { server } of servers) {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
  }
  t.after(async () => {
    for (const c of clients) c.close();
    for (const { wss, server } of servers) {
      for (const c of wss.clients) c.terminate();
      await new Promise((resolve) => server.close(resolve));
    }
    await store.close();
  });
  return {
    servers,
    client: async (index) => {
      const c = await new Client(
        `ws://127.0.0.1:${servers[index].server.address().port}/api/online`,
      ).open();
      clients.push(c);
      return c;
    },
  };
}
test("players on different server instances share a blind lobby, start seed and input relay", async (t) => {
  const { client } = await setup(t),
    a = await client(0),
    b = await client(1);
  a.send({ type: "create", build, character: 14, map: 2 });
  const host = await a.wait((m) => m.type === "joined");
  b.send({ type: "join", build, code: host.code, character: 20 });
  const guest = await b.wait((m) => m.type === "joined");
  assert.equal(guest.role, 1);
  assert.equal(guest.room.players[0].character, undefined);
  assert.equal(guest.room.players[1].token, undefined);
  a.send({ type: "ready", ready: true });
  b.send({ type: "ready", ready: true });
  const started = await b.wait(
      (m) => m.type === "room" && m.room.phase === "playing",
    ),
    other = await a.wait(
      (m) => m.type === "room" && m.room.phase === "playing",
    );
  assert.deepEqual(started.room.match, other.room.match);
  assert.equal(started.room.match.p1, 14);
  assert.equal(started.room.match.p2, 20);
  const epoch = started.room.match.epoch;
  a.send({ type: "input", epoch, frames: [[4, 8]] });
  const input = await b.wait((m) => m.type === "input");
  assert.deepEqual(input.frames, [[4, 8]]);
  assert.equal(input.role, 0);
  b.send({ type: "input", role: 0, epoch, frames: [[4, 16]] });
  assert.equal((await a.wait((m) => m.type === "input")).role, 1);
  a.send({ type: "rematch" });
  assert.equal(
    (await b.wait((m) => m.type === "room" && m.room.phase === "lobby")).room
      .match,
    null,
  );
});
test("room ownership, full rooms, build mismatch and reconnect authentication are enforced", async (t) => {
  const { client } = await setup(t),
    a = await client(0),
    b = await client(1),
    c = await client(0);
  a.send({ type: "create", build, character: 1, map: 1 });
  const host = await a.wait((m) => m.type === "joined");
  b.send({
    type: "join",
    build: "b".repeat(64),
    code: host.code,
    character: 2,
  });
  assert.match((await b.wait((m) => m.type === "error")).message, /버전/);
  b.send({ type: "join", build, code: host.code, character: 2 });
  await b.wait((m) => m.type === "joined");
  b.send({ type: "map", map: 2 });
  assert.match((await b.wait((m) => m.type === "error")).message, /방장/);
  c.send({ type: "join", build, code: host.code, character: 3 });
  assert.match((await c.wait((m) => m.type === "error")).message, /이미/);
  c.send({ type: "resume", code: host.code, role: 0, token: "0".repeat(48) });
  assert.match((await c.wait((m) => m.type === "error")).message, /접속/);
  c.send({ type: "resume", code: host.code, role: 0, token: host.token });
  assert.equal((await c.wait((m) => m.type === "joined")).role, 0);
  a.send({ type: "pick", character: 3 });
  assert.match((await a.wait((m) => m.type === "error")).message, /만료/);
});
test("same character choices start an online mirror match", async (t) => {
  const { client } = await setup(t),
    a = await client(0),
    b = await client(1);
  a.send({ type: "create", build, character: 14, map: 1 });
  const host = await a.wait((m) => m.type === "joined");
  b.send({ type: "join", build, code: host.code, character: 14 });
  await b.wait((m) => m.type === "joined");
  a.send({ type: "ready", ready: true });
  b.send({ type: "ready", ready: true });
  const started = await a.wait(
    (m) => m.type === "room" && m.room.phase === "playing",
  );
  assert.equal(started.room.match.p1, 14);
  assert.equal(started.room.match.p2, 14);
});
