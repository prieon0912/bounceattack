import {
  randomBytes,
  randomInt,
  randomUUID,
  createHash,
  timingSafeEqual,
} from "node:crypto";
const ONLINE_MAP = 6;
const TTL = 7200,
  prefix = "bounce:v1:",
  roomKey = (c) => prefix + "room:" + c,
  channel = (c) => prefix + "events:" + c;
const hash = (s) => createHash("sha256").update(String(s)).digest("hex");
const validInt = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
const skillChoice = (character, choice) => {
  if (choice !== undefined && choice !== "primary" && choice !== "secondary")
    throw new RoomError("스킬 선택을 확인해 주세요.");
  if (choice === "secondary" && ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36].includes(character))
    throw new RoomError("이 캐릭터는 아직 세컨드 스킬이 없어요.");
  return choice || "primary";
};
const same = (a, b) =>
  typeof a === "string" &&
  typeof b === "string" &&
  a.length === b.length &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
export class RoomError extends Error {}
export class RoomHub {
  constructor(store) {
    this.store = store;
  }
  public(room) {
    return {
      code: room.code,
      rev: room.rev || 0,
      phase: room.phase,
      map: room.map,
      players: room.players.map((p) =>
        p ? { ready: p.ready, connected: p.connected } : null,
      ),
      match: room.match,
      build: room.build,
    };
  }
  async state(code) {
    const raw = await this.store.get(roomKey(code));
    if (!raw)
      throw new RoomError("방이 없거나 만료됐어요. 새 방을 만들어 주세요.");
    return JSON.parse(raw);
  }
  async update(code, fn) {
    for (let i = 0; i < 8; i++) {
      const old = await this.store.get(roomKey(code));
      if (!old) throw new RoomError("방이 만료됐어요.");
      const room = JSON.parse(old);
      await fn(room);
      room.rev = (room.rev || 0) + 1;
      if (await this.store.cas(roomKey(code), old, JSON.stringify(room), TTL)) {
        await this.publish(code, { type: "room", room: this.public(room) });
        return room;
      }
    }
    throw new RoomError("방 상태가 바뀌었어요. 다시 시도해 주세요.");
  }
  async publish(code, message) {
    await this.store.publish(channel(code), JSON.stringify(message));
  }
  async watch(code, fn) {
    return this.store.subscribe(channel(code), (raw) => {
      try {
        fn(JSON.parse(raw));
      } catch {}
    });
  }
  authorize(room, ctx) {
    const p = room.players[ctx.role];
    if (!p || !same(p.token, hash(ctx.token)) || p.session !== ctx.session)
      throw new RoomError("접속이 만료됐거나 다른 창에서 다시 연결했어요.");
    return p;
  }
  validateBuild(build) {
    if (typeof build !== "string" || !/^[a-f0-9]{64}$/.test(build))
      throw new RoomError("버전 정보를 불러오지 못했어요. 새로고침해 주세요.");
  }
  async create(ctx, msg) {
    this.validateBuild(msg.build);
    if (!validInt(msg.character, 1, 36) || !validInt(msg.map, 1, 6))
      throw new RoomError("캐릭터와 전장을 확인해 주세요.");
    skillChoice(msg.character, msg.skill);
    ctx.token = randomBytes(24).toString("hex");
    ctx.role = 0;
    ctx.session = randomUUID();
    for (let i = 0; i < 8; i++) {
      const code = randomBytes(5).toString("hex").toUpperCase().slice(0, 8),
        room = {
          code,
          rev: 0,
          build: msg.build,
          map: msg.map,
          phase: "lobby",
          players: [
            {
              token: hash(ctx.token),
              session: ctx.session,
              character: msg.character,
              skill: skillChoice(msg.character, msg.skill),
              ready: false,
              connected: true,
            },
            null,
          ],
          match: null,
        };
      if (await this.store.create(roomKey(code), JSON.stringify(room), TTL)) {
        ctx.code = code;
        return room;
      }
    }
    throw new RoomError("방을 만들지 못했어요. 다시 시도해 주세요.");
  }
  async join(ctx, msg) {
    this.validateBuild(msg.build);
    const code = String(msg.code || "").toUpperCase();
    if (!/^[A-F0-9]{8}$/.test(code) || !validInt(msg.character, 1, 36))
      throw new RoomError("8자리 방 코드를 확인해 주세요.");
    skillChoice(msg.character, msg.skill);
    ctx.token = randomBytes(24).toString("hex");
    ctx.role = 1;
    ctx.session = randomUUID();
    const room = await this.update(code, (r) => {
      if (r.build !== msg.build)
        throw new RoomError(
          "친구와 게임 버전이 달라요. 둘 다 새로고침해 주세요.",
        );
      if (r.players[1])
        throw new RoomError("이미 다른 친구가 들어온 방이에요.");
      if (r.phase !== "lobby") throw new RoomError("이미 대전 중인 방이에요.");
      r.players[1] = {
        token: hash(ctx.token),
        session: ctx.session,
        character: msg.character,
        skill: skillChoice(msg.character, msg.skill),
        ready: false,
        connected: true,
      };
      r.players[0].ready = false;
    });
    ctx.code = code;
    return room;
  }
  async matchmake(ctx, msg) {
    this.validateBuild(msg.build);
    if (!validInt(msg.character, 1, 36))
      throw new RoomError("캐릭터를 선택해 주세요.");
    // Online matchmaking always plays on 미션존 (map 6) for now.
    const own = await this.create(ctx, { ...msg, map: ONLINE_MAP });
    const ownContext = { ...ctx };
    const key = prefix + "matchmaking:" + msg.build;
    for (let attempt = 0; attempt < 32; attempt++) {
      const old = await this.store.get(key);
      const entries = old
        ? JSON.parse(old).filter((e) => e.expires > Date.now())
        : [];
      let candidate = null;
      for (const entry of entries) {
        try {
          const room = await this.state(entry.code);
          if (
            room.phase === "lobby" &&
            room.players[0]?.connected &&
            !room.players[1]
          ) {
            candidate = entry;
            break;
          }
        } catch {}
      }
      const next = candidate
        ? entries.filter((e) => e !== candidate)
        : [
            ...entries,
            {
              code: own.code,
              character: msg.character,
              expires: Date.now() + TTL * 1000,
            },
          ];
      const encoded = JSON.stringify(next);
      const won =
        old === null
          ? await this.store.create(key, encoded, TTL)
          : await this.store.cas(key, old, encoded, TTL);
      if (!won) continue;
      if (!candidate) return own;
      try {
        await this.join(ctx, { ...msg, code: candidate.code });
        await this.update(ctx.code, (room) => {
          room.players[0].ready = true;
        });
        return await this.action(ctx, { type: "ready", ready: true });
      } catch {
        Object.assign(ctx, ownContext);
        // A disconnected candidate cannot consume this player's ticket.
        continue;
      }
    }
    throw new RoomError("접속이 몰리고 있어요. 다시 상대를 찾아 주세요.");
  }
  async resume(ctx, msg) {
    const code = String(msg.code || "").toUpperCase();
    if (
      !/^[A-F0-9]{8}$/.test(code) ||
      !validInt(msg.role, 0, 1) ||
      typeof msg.token !== "string" ||
      msg.token.length !== 48
    )
      throw new RoomError("다시 연결하지 못했어요.");
    ctx.token = msg.token;
    ctx.role = msg.role;
    ctx.session = randomUUID();
    const room = await this.update(code, (r) => {
      const p = r.players[ctx.role];
      if (!p || !same(p.token, hash(ctx.token)))
        throw new RoomError("방 접속 정보를 확인할 수 없어요.");
      p.session = ctx.session;
      p.connected = true;
    });
    ctx.code = code;
    return room;
  }
  async action(ctx, msg) {
    if (!ctx.code) throw new RoomError("방에 먼저 입장해 주세요.");
    return this.update(ctx.code, (r) => {
      const p = this.authorize(r, ctx);
      if (msg.type === "claim") {
        // Lockstep stalled: whichever player still reaches the server first
        // is the winner. Only the first claim counts, so both can't win.
        if (r.phase !== "playing" || !r.match || msg.epoch !== r.match.epoch)
          throw new RoomError("이미 끝난 대전이에요.");
        if (r.match.winner === undefined) r.match.winner = ctx.role;
      } else if (msg.type === "pick") {
        if (r.phase !== "lobby" || !validInt(msg.character, 1, 36))
          throw new RoomError("지금은 캐릭터를 바꿀 수 없어요.");
        p.skill = skillChoice(msg.character, msg.skill);
        p.character = msg.character;
        p.ready = false;
      } else if (msg.type === "map") {
        if (ctx.role !== 0 || r.phase !== "lobby" || !validInt(msg.map, 1, 6))
          throw new RoomError("방장만 전장을 바꿀 수 있어요.");
        r.map = msg.map;
        for (const player of r.players) if (player) player.ready = false;
      } else if (msg.type === "ready") {
        if (r.phase !== "lobby") throw new RoomError("이미 시작한 대전이에요.");
        p.ready = !!msg.ready;
        if (r.players.every((x) => x?.ready && x.connected)) {
          r.notice = null;
          r.phase = "playing";
          r.match = {
            epoch: randomUUID(),
            seed: randomInt(0, 0x100000000),
            p1: r.players[0].character,
            p2: r.players[1].character,
            skills: r.players.map(player => player.skill || "primary"),
            sportRolls: r.players.map(player => player.character === 36 ? randomInt(3) : null),
            map: r.map,
            // Starting input delay (2 frames ≈ 33 ms); each client then adapts
            // its own delay to the measured ping (entry-app.js adaptDelay).
            delay: 2,
          };
        }
      } else if (msg.type === "rematch") {
        r.phase = "lobby";
        r.match = null;
        for (const player of r.players) if (player) player.ready = false;
      } else throw new RoomError("알 수 없는 방 요청이에요.");
    });
  }
  async relay(ctx, msg) {
    const fast = ["input", "checksum", "sync", "netping", "netpong"].includes(msg.type) && this.store.publishMatchInput;
    const r = fast ? null : await this.state(ctx.code);
    if (!fast) this.authorize(r, ctx);
    const out = { type: msg.type, role: ctx.role };
    if (msg.type === "signal") {
      if (!msg.data || JSON.stringify(msg.data).length > 18000)
        throw new RoomError("연결 요청이 너무 커요.");
      out.data = msg.data;
    } else {
      if (!fast && (r.phase !== "playing" || msg.epoch !== r.match.epoch))
        throw new RoomError("종료된 대전의 입력이에요.");
      out.epoch = msg.epoch;
      if (msg.type === "input") {
        if (
          !Array.isArray(msg.frames) ||
          msg.frames.length < 1 ||
          msg.frames.length > 32 ||
          !msg.frames.every(
            (f) =>
              Array.isArray(f) &&
              f.length === 2 &&
              validInt(f[0], 1, 10_000_000) &&
              validInt(f[1], 0, 63),
          )
        )
          throw new RoomError("올바르지 않은 대전 입력이에요.");
        out.frames = msg.frames;
      } else if (["netping", "netpong"].includes(msg.type)) {
        if (!Number.isFinite(msg.at) || msg.at < 0)
          throw new RoomError("잘못된 지연 측정이에요.");
        out.at = msg.at;
      } else if (msg.type === "sync") {
        if (!validInt(msg.from, 1, 10_000_000))
          throw new RoomError("입력 순서를 확인할 수 없어요.");
        out.from = msg.from;
      } else if (msg.type === "checksum") {
        if (
          !validInt(msg.frame, 1, 10_000_000) ||
          !validInt(msg.hash, 0, 0xffffffff)
        )
          throw new RoomError("잘못된 상태 확인이에요.");
        out.frame = msg.frame;
        out.hash = msg.hash;
      } else if (msg.type === "pause") {
        out.paused = !!msg.paused;
      } else if (msg.type === "forfeit") {
        // The sender left the match; the opponent is declared the winner.
      } else throw new RoomError("지원하지 않는 대전 요청이에요.");
    }
    if (fast) {
      const result = await this.store.publishMatchInput(roomKey(ctx.code), channel(ctx.code),
        ctx.role, hash(ctx.token), ctx.session, msg.epoch, JSON.stringify(out));
      if (result === 1) return;
      if (result === -1) throw new RoomError("접속이 만료됐거나 다른 창에서 다시 연결했어요.");
      throw new RoomError("종료되었거나 만료된 대전의 입력이에요.");
    }
    await this.publish(ctx.code, out);
  }
  async leave(ctx) {
    if (!ctx.code) return;
    try {
      await this.update(ctx.code, (r) => {
        const p = r.players[ctx.role];
        if (p?.session === ctx.session) {
          p.connected = false;
          p.ready = false;
        }
      });
    } catch {}
  }
}
