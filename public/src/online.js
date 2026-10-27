export class OnlineConnection {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.identity = null;
    this.room = null;
    this.ws = null;
    this.pc = null;
    this.channel = null;
    this.pending = [];
    this.closed = false;
    this.detached = false;
    this.iceQueue = [];
    this.inputQueue = [];
    this.mode = "relay";
    this.timer = setInterval(() => this.flush(), 33);
    this.pinger = setInterval(() => this.ping(), 3000);
    this.reconnectDelay = 500;
    this.leaseTimer = setInterval(
      () => {
        if (
          this.identity &&
          this.room?.phase === "playing" &&
          this.directReady()
        )
          this.command({ type: "ping", at: performance.now() });
      },
      15 * 60 * 1000,
    );
  }
  emit(name, value) {
    this.callbacks[name]?.(value);
  }
  command(message) {
    if (this.closed) return;
    if (
      this.identity &&
      ["pick", "map", "ready", "rematch"].includes(message.type)
    )
      this.direct({ type: "wake" });
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(message));
    else {
      if (this.pending.length > 128) {
        this.emit(
          "onError",
          "서버 연결이 오래 끊겼어요. 방에 다시 입장해 주세요.",
        );
        return;
      }
      this.pending.push(message);
      this.connect();
    }
  }
  connect() {
    if (this.closed || [0, 1].includes(this.ws?.readyState)) return;
    this.detached = false;
    const scheme = location.protocol === "https:" ? "wss:" : "ws:";
    this.ws = new WebSocket(`${scheme}//${location.host}/api/online`);
    const socket = this.ws;
    socket.onopen = () => {
      if (socket !== this.ws) return;
      this.reconnectDelay = 500;
      if (this.identity)
        socket.send(JSON.stringify({ type: "resume", ...this.identity }));
      for (const message of this.pending.splice(0))
        socket.send(JSON.stringify(message));
      this.emit("onStatus", {
        mode: this.directReady() ? "direct" : "relay",
        connected: true,
      });
    };
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        Promise.resolve(this.message(message, false)).catch(() =>
          this.emit("onNotice", "직접 연결 대신 서버 중계를 사용해요."),
        );
      } catch {
        this.emit("onError", "대전 서버 응답을 읽지 못했어요.");
      }
    };
    socket.onclose = () => {
      if (socket !== this.ws || this.closed || this.detached) return;
      if (!this.identity) {
        fetch("/api/online", { cache: "no-store" })
          .then((r) => r.json())
          .then((info) =>
            this.emit(
              "onError",
              info.online
                ? "방 서버에 접속하지 못했어요. 잠시 후 다시 시도해 주세요."
                : info.message,
            ),
          )
          .catch(() =>
            this.emit(
              "onError",
              "서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.",
            ),
          );
        return;
      }
      if (this.directReady()) {
        this.detached = true;
        return;
      }
      this.emit("onStatus", { mode: "relay", connected: false });
      clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => this.connect(), this.reconnectDelay);
      this.reconnectDelay = Math.min(3000, this.reconnectDelay * 2);
    };
    socket.onerror = () => {};
  }
  create(build, character, map) {
    this.command({ type: "create", build, character, map });
  }
  join(build, code, character) {
    this.command({ type: "join", build, code, character });
  }
  async message(msg, direct) {
    if (direct) {
      if (msg.type === "wake") {
        this.connect();
        return;
      }
      if (msg.type === "netping") {
        this.direct({ type: "netpong", at: msg.at });
        return;
      }
      if (msg.type === "netpong") {
        this.emit("onStatus", {
          mode: "direct",
          connected: true,
          ping: Math.round(performance.now() - msg.at),
        });
        return;
      }
      if (!this.identity || msg.role === this.identity.role) return;
    }
    if (msg.type === "joined") {
      const resumed = !!this.identity;
      this.identity = { code: msg.code, role: msg.role, token: msg.token };
      this.iceServers = msg.iceServers;
      this.emit("onJoined", { role: msg.role, code: msg.code });
      this.acceptRoom(msg.room);
      if (msg.role === 1)
        this.command({ type: "signal", data: { hello: true } });
      if (msg.role === 0)
        this.command({ type: "signal", data: { requestHello: true } });
      if (resumed) this.emit("onReconnect");
      return;
    }
    if (msg.type === "room") {
      this.acceptRoom(msg.room);
      return;
    }
    if (msg.type === "error") {
      this.emit("onError", msg.message);
      return;
    }
    if (msg.type === "notice") {
      this.emit("onNotice", msg.message);
      return;
    }
    if (msg.type === "pong") {
      this.emit("onStatus", {
        mode: "relay",
        connected: true,
        ping: Math.round(performance.now() - msg.at),
      });
      return;
    }
    if (msg.type === "signal") {
      await this.signal(msg.data);
      return;
    }
    if (
      ["input", "checksum", "sync", "pause"].includes(msg.type) &&
      msg.epoch === this.room?.match?.epoch &&
      msg.role !== this.identity?.role
    )
      this.emit("onGameplay", msg);
  }
  acceptRoom(room) {
    if (this.room?.code === room.code && (room.rev || 0) < (this.room.rev || 0))
      return;
    this.room = room;
    this.emit("onRoom", room);
    if (this.directReady() && room.phase === "playing") this.detachLater();
  }
  createPeer() {
    if (this.pc) return this.pc;
    const pc = new RTCPeerConnection({
      iceServers: this.iceServers || [{ urls: "stun:stun.l.google.com:19302" }],
    });
    this.pc = pc;
    pc.onicecandidate = (event) => {
      if (event.candidate)
        this.command({
          type: "signal",
          data: { candidate: event.candidate.toJSON() },
        });
    };
    pc.ondatachannel = (event) => this.bindChannel(event.channel);
    pc.onconnectionstatechange = () => {
      if (["failed", "disconnected"].includes(pc.connectionState)) {
        clearTimeout(this.peerFailure);
        this.peerFailure = setTimeout(() => {
          if (
            this.pc === pc &&
            ["failed", "disconnected"].includes(pc.connectionState)
          ) {
            this.mode = "relay";
            this.emit("onStatus", {
              mode: "relay",
              connected: this.ws?.readyState === 1,
            });
            this.connect();
          }
        }, 1500);
      }
    };
    return pc;
  }
  resetPeer() {
    if (this.channel) this.channel.onclose = null;
    if (this.pc) this.pc.onconnectionstatechange = null;
    this.channel?.close();
    this.pc?.close();
    this.channel = null;
    this.pc = null;
    this.iceQueue = [];
  }
  async offer() {
    if (!globalThis.RTCPeerConnection) return;
    this.offerAt = Date.now();
    const pc = this.createPeer();
    this.bindChannel(pc.createDataChannel("battle", { ordered: true }));
    await pc.setLocalDescription(await pc.createOffer());
    this.command({
      type: "signal",
      data: { description: pc.localDescription.toJSON() },
    });
  }
  async signal(data) {
    if (!globalThis.RTCPeerConnection) return;
    if (data.requestHello) {
      if (this.identity.role === 1)
        this.command({ type: "signal", data: { hello: true } });
      return;
    }
    if (data.hello) {
      if (
        this.identity.role === 0 &&
        !this.directReady() &&
        (!this.pc ||
          this.pc.connectionState === "failed" ||
          Date.now() - (this.offerAt || 0) > 5000)
      ) {
        this.resetPeer();
        await this.offer();
      }
      return;
    }
    if (
      data.description?.type === "offer" &&
      this.pc &&
      ["failed", "disconnected", "closed"].includes(this.pc.connectionState)
    )
      this.resetPeer();
    const pc = this.createPeer();
    if (data.description) {
      if (data.description.type === "offer" && this.identity.role !== 1) return;
      await pc.setRemoteDescription(data.description);
      for (const candidate of this.iceQueue.splice(0))
        await pc.addIceCandidate(candidate);
      if (data.description.type === "offer") {
        await pc.setLocalDescription(await pc.createAnswer());
        this.command({
          type: "signal",
          data: { description: pc.localDescription.toJSON() },
        });
      }
    } else if (data.candidate) {
      if (pc.remoteDescription) await pc.addIceCandidate(data.candidate);
      else this.iceQueue.push(data.candidate);
    }
  }
  bindChannel(channel) {
    this.channel = channel;
    channel.onopen = () => {
      this.mode = "direct";
      this.emit("onStatus", { mode: "direct", connected: true });
      this.emit("onReconnect");
      if (this.room?.phase === "playing") this.detachLater();
    };
    channel.onmessage = (event) => {
      if (typeof event.data !== "string" || event.data.length > 24576) return;
      try {
        this.message(JSON.parse(event.data), true);
      } catch {}
    };
    channel.onclose = () => {
      if (this.closed) return;
      this.mode = "relay";
      this.emit("onStatus", { mode: "relay", connected: false });
      this.connect();
    };
    channel.onerror = () => {};
  }
  detachLater() {
    clearTimeout(this.detachTimer);
    this.detachTimer = setTimeout(() => {
      if (this.directReady() && this.room?.phase === "playing") {
        this.detached = true;
        this.ws?.close(1000, "Direct peer connected");
      }
    }, 2000);
  }
  directReady() {
    return (
      this.channel?.readyState === "open" &&
      this.pc?.connectionState === "connected"
    );
  }
  direct(message) {
    if (!this.directReady() || this.channel.bufferedAmount > 262144)
      return false;
    this.channel.send(JSON.stringify(message));
    return true;
  }
  gameplay(message) {
    if (!this.identity || !this.room?.match) return;
    const out = {
      ...message,
      epoch: this.room.match.epoch,
      role: this.identity.role,
    };
    if (!this.direct(out)) {
      const { role, ...serverMessage } = out;
      this.command(serverMessage);
    }
  }
  input(frames) {
    this.inputQueue.push(...frames);
  }
  flush() {
    if (this.inputQueue.length) {
      const frames = this.inputQueue.splice(0, 24);
      this.gameplay({ type: "input", frames });
    }
  }
  replay(frames) {
    for (let i = 0; i < frames.length; i += 24)
      this.gameplay({ type: "input", frames: frames.slice(i, i + 24) });
  }
  ping() {
    if (this.closed || !this.identity) return;
    const at = performance.now();
    if (this.directReady()) this.direct({ type: "netping", at });
    else if (this.ws?.readyState === 1) this.command({ type: "ping", at });
  }
  close() {
    this.closed = true;
    clearInterval(this.timer);
    clearInterval(this.pinger);
    clearInterval(this.leaseTimer);
    for (const key of ["retryTimer", "detachTimer", "peerFailure"])
      clearTimeout(this[key]);
    this.channel?.close();
    this.pc?.close();
    this.ws?.close();
    this.pending = [];
  }
}
