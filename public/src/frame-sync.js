export const KEYS = [
  [65, 68, 87, 69, 82, 83],
  [37, 39, 38, 79, 80, 40],
];
export function applyInputs(runtime, masks) {
  runtime.keys.clear();
  for (let side = 0; side < 2; side++)
    for (let bit = 0; bit < 6; bit++)
      if (masks[side] & (1 << bit)) runtime.keys.add(KEYS[side][bit]);
}
export function stateHash(runtime) {
  let h = 2166136261;
  const add = (value) => {
    const s = String(value);
    for (let i = 0; i < s.length; i++)
      h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    h = Math.imul(h ^ 124, 16777619);
  };
  add(runtime.tick);
  for (const [key, value] of runtime.globals) {
    add(key);
    add(JSON.stringify(value));
  }
  for (const e of runtime.entities) {
    add(e.uid);
    add(e.objectId);
    for (const v of [
      e.x,
      e.y,
      e.scaleX,
      e.scaleY,
      e.rotation,
      e.direction,
      e.regX,
      e.regY,
    ])
      add(Number(v).toFixed(6));
    add(e.visible);
    add(e.picture?.id);
    for (const [key, value] of e.locals) {
      add(key);
      add(JSON.stringify(value));
    }
  }
  return h >>> 0;
}
export class FrameSync {
  constructor(role, { delay = 3, onSend = () => {}, onFault = () => {} } = {}) {
    if (
      ![0, 1].includes(role) ||
      !Number.isInteger(delay) ||
      delay < 1 ||
      delay > 12
    )
      throw Error("Invalid input sync configuration");
    this.role = role;
    this.delay = delay;
    this.onSend = onSend;
    this.onFault = onFault;
    this.inputs = [new Map(), new Map()];
    this.history = new Map();
    this.mask = 0;
    this.failed = false;
    this.lastFrame = 0;
    this.lastVerifiedFrame = 0;
    this.lastSent = delay;
    for (let f = 1; f <= delay; f++) {
      this.inputs[0].set(f, 0);
      this.inputs[1].set(f, 0);
      this.history.set(f, 0);
    }
    this.localHashes = new Map();
    this.remoteHashes = new Map();
  }
  receive(role, frames) {
    if (![0, 1].includes(role) || role === this.role || !Array.isArray(frames))
      return;
    for (const pair of frames) {
      if (!Array.isArray(pair) || pair.length !== 2) {
        this.fail("잘못된 입력을 받았어요.");
        return;
      }
      const [frame, mask] = pair;
      if (
        !Number.isInteger(frame) ||
        frame < 1 ||
        frame > this.lastFrame + 4096 ||
        !Number.isInteger(mask) ||
        mask < 0 ||
        mask > 63
      ) {
        this.fail("대전 입력 순서가 올바르지 않아요.");
        return;
      }
      if (frame <= this.lastFrame) continue;
      const prior = this.inputs[role].get(frame);
      if (prior !== undefined && prior !== mask) {
        this.fail("같은 프레임에 서로 다른 입력이 도착했어요.");
        return;
      }
      this.inputs[role].set(frame, mask);
    }
  }
  advance(runtime) {
    if (this.failed || runtime.paused || !runtime.running) return false;
    // Local input is scheduled `delay` frames ahead. The delay may change
    // during a match (setDelay): raising it fills the skipped frames with the
    // current input; lowering it simply waits until the schedule catches up.
    // The opponent only needs one input per frame, so no agreement is needed.
    const target = runtime.tick + this.delay + 1;
    if (target > this.lastSent) {
      const out = [];
      for (let f = this.lastSent + 1; f <= target; f++) {
        this.history.set(f, this.mask);
        this.inputs[this.role].set(f, this.mask);
        out.push([f, this.mask]);
      }
      this.lastSent = target;
      this.onSend(out);
    }
    const frame = runtime.tick + 1;
    if (!this.inputs.every((m) => m.has(frame))) return false;
    applyInputs(
      runtime,
      this.inputs.map((m) => m.get(frame)),
    );
    runtime.step();
    this.lastFrame = runtime.tick;
    for (const map of this.inputs) map.delete(frame);
    if (this.history.size > 4096)
      this.history.delete(this.history.keys().next().value);
    return true;
  }
  setDelay(delay) {
    if (Number.isInteger(delay)) this.delay = Math.max(1, Math.min(12, delay));
  }
  replay(from) {
    if (from < this.lastFrame - 4095) {
      this.fail("연결이 너무 오래 끊겼어요. 다시 대전해 주세요.");
      return [];
    }
    return [...this.history].filter(([frame]) => frame >= from);
  }
  checkpoint(runtime) {
    const hash = stateHash(runtime);
    this.localHashes.set(runtime.tick, hash);
    this.compare(runtime.tick);
    while (this.localHashes.size > 8)
      this.localHashes.delete(this.localHashes.keys().next().value);
    return hash;
  }
  checksum(frame, hash) {
    if (!Number.isInteger(frame) || !Number.isInteger(hash)) return;
    this.remoteHashes.set(frame, hash);
    this.compare(frame);
    while (this.remoteHashes.size > 8)
      this.remoteHashes.delete(this.remoteHashes.keys().next().value);
  }
  compare(frame) {
    if (this.localHashes.has(frame) && this.remoteHashes.has(frame)) {
      if (this.localHashes.get(frame) !== this.remoteHashes.get(frame))
        this.fail("두 화면의 전투 상태가 달라졌어요. 다시 대전해 주세요.");
      else this.lastVerifiedFrame = Math.max(this.lastVerifiedFrame, frame);
    }
  }
  fail(message) {
    if (this.failed) return;
    this.failed = true;
    this.onFault(message);
  }
}
