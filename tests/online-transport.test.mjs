import test from "node:test";
import { WebSocket as SocketClient } from "ws";
import assert from "node:assert/strict";
import fs from "node:fs";
import { once } from "node:events";
import { createOnlineServer } from "../server/online-server.js";
import { MemoryStore } from "../server/store.js";
import { OnlineConnection } from "../public/src/online.js";
import { FrameSync, stateHash } from "../public/src/frame-sync.js";
import { Runtime } from "../public/src/runtime.js";
import { registerOriginal } from "../public/src/original-program.js";
const project = JSON.parse(
  fs.readFileSync(new URL("../public/data/project.json", import.meta.url)),
);
test("production client transport fallback resumes lost WebSockets and preserves combat state", async (t) => {
  const { server, wss } = createOnlineServer({ store: new MemoryStore() });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const previous = globalThis.location;
  const previousSocket = globalThis.WebSocket;
  globalThis.WebSocket ??= SocketClient;
  globalThis.location = {
    protocol: "http:",
    host: `127.0.0.1:${server.address().port}`,
  };
  const clients = [],
    runtimes = [],
    syncs = [],
    faults = [];
  let codeResolve;
  const codePromise = new Promise((resolve) => (codeResolve = resolve));
  let doneResolve, doneReject;
  const done = new Promise((resolve, reject) => {
    doneResolve = resolve;
    doneReject = reject;
  });
  const timeout = setTimeout(
    () => doneReject(Error("Online transport timed out")),
    10000,
  );
  let closedOnce = false;
  t.after(async () => {
    clearTimeout(timeout);
    for (const c of clients) c.close();
    for (const ws of wss.clients) ws.terminate();
    await new Promise((resolve) => server.close(resolve));
    if (previousSocket === undefined) delete globalThis.WebSocket;
    if (previous === undefined) delete globalThis.location;
    else globalThis.location = previous;
  });
  for (let role = 0; role < 2; role++) {
    clients[role] = new OnlineConnection({
      onJoined: (info) => {
        if (role === 0) codeResolve(info.code);
      },
      onError: (message) => doneReject(Error(message)),
      onRoom: (room) => {
        if (room.phase !== "playing" || runtimes[role]) return;
        const r = new Runtime(project, { headless: true });
        registerOriginal(r);
        r.start(room.match);
        runtimes[role] = r;
        syncs[role] = new FrameSync(role, {
          onSend: (frames) => clients[role].input(frames),
          onFault: (message) => faults.push(message),
        });
      },
      onReconnect: () => {
        if (syncs[role])
          clients[role].gameplay({
            type: "sync",
            from: runtimes[role].tick + 1,
          });
      },
      onGameplay: (msg) => {
        const s = syncs[role];
        if (!s) return;
        if (msg.type === "input") s.receive(msg.role, msg.frames);
        else if (msg.type === "sync") clients[role].replay(s.replay(msg.from));
      },
    });
  }
  clients[0].create("a".repeat(64), 14, 1);
  const code = await codePromise;
  clients[1].join("a".repeat(64), code, 20);
  await new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      if (clients[1].identity) {
        clearInterval(timer);
        resolve();
      }
    }, 5);
    setTimeout(() => {
      clearInterval(timer);
      reject(Error("Guest did not join"));
    }, 2000).unref();
  });
  clients[0].command({ type: "ready", ready: true });
  clients[1].command({ type: "ready", ready: true });
  const pump = setInterval(() => {
    for (let role = 0; role < 2; role++) {
      if (!syncs[role] || runtimes[role].tick >= 120) continue;
      syncs[role].mask = runtimes[role].tick % 80 < 20 ? 8 : 0;
      syncs[role].advance(runtimes[role]);
    }
    if (!closedOnce && runtimes[0]?.tick > 30) {
      closedOnce = true;
      clients[0].ws.close();
    }
    if (runtimes.length === 2 && runtimes.every((r) => r?.tick === 120)) {
      clearInterval(pump);
      doneResolve();
    }
  }, 1);
  t.after(() => clearInterval(pump));
  await done;
  assert.equal(closedOnce, true);
  assert.deepEqual(faults, []);
  assert.deepEqual(
    runtimes.map((r) => r.faults),
    [[], []],
  );
  assert.equal(stateHash(runtimes[0]), stateHash(runtimes[1]));
});
