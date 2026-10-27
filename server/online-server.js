import http from "node:http";
import { WebSocketServer } from "ws";
import { RoomHub, RoomError } from "./rooms.js";
import { MemoryStore, RedisStore } from "./store.js";
export function createOnlineServer({ local = false, store = null } = {}) {
  const url = process.env.REDIS_URL || process.env.KV_URL;
  store ??= url ? new RedisStore(url) : local ? new MemoryStore() : null;
  const hub = store ? new RoomHub(store) : null;
  const server = http.createServer(async (req, res) => {
    let healthy = false;
    if (hub) {
      try {
        healthy = await store.health();
      } catch {}
    }
    res.writeHead(healthy ? 200 : 503, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(
      JSON.stringify({
        online: healthy,
        local,
        code: healthy ? "READY" : hub ? "REDIS_UNREACHABLE" : "REDIS_REQUIRED",
        message: healthy
          ? "온라인 대전 준비 완료"
          : hub
            ? "Redis에 연결하지 못했어요. 연결 문자열과 저장소 상태를 확인해 주세요."
            : "Vercel에 Redis를 연결하고 REDIS_URL 또는 KV_URL을 설정해 주세요.",
      }),
    );
  });
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 24576,
    perMessageDeflate: false,
  });
  server.on("upgrade", (req, socket, head) => {
    const origin = req.headers.origin;
    let allowed = false;
    try {
      allowed = !origin || new URL(origin).host === req.headers.host;
    } catch {}
    if (
      !hub ||
      !allowed ||
      new URL(req.url, "http://localhost").pathname !== "/api/online"
    ) {
      socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit("connection", ws, req),
    );
  });
  wss.on("connection", (ws) => {
    const ctx = { code: null },
      send = (o) => {
        if (ws.readyState === 1) ws.send(JSON.stringify(o));
      };
    let unwatch = null,
      queue = Promise.resolve(),
      windowStart = Date.now(),
      messages = 0,
      lastPulse = 0;
    const attach = async (room) => {
      let attached = false;
      const buffered = [];
      unwatch = await hub.watch(ctx.code, (message) => {
        if (message.role === ctx.role && message.type !== "room") return;
        if (attached) send(message);
        else buffered.push(message);
      });
      room = await hub.state(ctx.code);
      send({
        type: "joined",
        role: ctx.role,
        code: ctx.code,
        token: ctx.token,
        room: hub.public(room),
        iceServers: iceServers(),
      });
      attached = true;
      for (const message of buffered) send(message);
      await hub.publish(ctx.code, { type: "room", room: hub.public(room) });
    };
    ws.on("message", (raw) => {
      if (Date.now() - windowStart > 1000) {
        windowStart = Date.now();
        messages = 0;
      }
      if (++messages > 80) {
        ws.close(1008, "Too many messages");
        return;
      }
      queue = queue
        .then(async () => {
          let msg;
          try {
            msg = JSON.parse(String(raw));
            if (!msg || typeof msg.type !== "string")
              throw new RoomError("올바르지 않은 요청이에요.");
            if (["create", "join", "resume", "matchmake"].includes(msg.type)) {
              if (ctx.code) throw new RoomError("이미 방에 접속해 있어요.");
              await attach(await hub[msg.type](ctx, msg));
            } else if (msg.type === "ping") {
              if (ctx.code && Date.now() - lastPulse > 15000) {
                lastPulse = Date.now();
                await store.touch("bounce:v1:room:" + ctx.code, 7200);
              }
              send({ type: "pong", at: msg.at });
            } else if (["pick", "map", "ready", "rematch"].includes(msg.type)) {
              const room = await hub.action(ctx, msg);
              if (room.notice)
                await hub.publish(ctx.code, {
                  type: "notice",
                  message: room.notice,
                });
            } else if (
              ["signal", "input", "checksum", "sync", "pause"].includes(
                msg.type,
              )
            ) {
              if (!ctx.code) throw new RoomError("먼저 방에 입장해 주세요.");
              await hub.relay(ctx, msg);
            } else throw new RoomError("지원하지 않는 요청이에요.");
          } catch (error) {
            send({
              type: "error",
              message:
                error instanceof RoomError
                  ? error.message
                  : "대전 서버에 연결하지 못했어요. Redis 설정과 연결 상태를 확인해 주세요.",
            });
          }
        })
        .catch(() => {});
    });
    ws.on("close", () => {
      queue
        .finally(async () => {
          await unwatch?.();
          await hub.leave(ctx);
        })
        .catch(() => {});
    });
    ws.on("error", () => {});
  });
  return { server, wss, hub, store };
}
function iceServers() {
  let extra = [];
  try {
    extra = JSON.parse(process.env.TURN_ICE_SERVERS || "[]");
    if (!Array.isArray(extra)) extra = [];
  } catch {}
  return [{ urls: "stun:stun.l.google.com:19302" }, ...extra];
}
