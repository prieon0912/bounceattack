// Peer RTT includes both WebSocket legs and Redis, unlike a server-only ping.
export class InputDelayController {
  constructor() { this.samples = []; this.delay = 2; }
  observe(rtt, mode = "peer") {
    if (!Number.isFinite(rtt) || rtt < 0 || rtt > 30000) return this.delay;
    if (this.mode !== mode) { this.mode = mode; this.samples = []; this.delay = 2; }
    this.samples.push(rtt);
    if (this.samples.length > 8) this.samples.shift();
    const values = [...this.samples].sort((a, b) => a - b);
    const base = values[Math.floor((values.length - 1) / 2)];
    const jitter = Math.min(25, Math.max(0, rtt - base) / 2);
    const target = Math.max(1, Math.min(12, Math.ceil((base / 2 + jitter + 4) / (1000 / 60))));
    // React immediately to a slower path; reduce by one frame at a time.
    this.delay = target >= this.delay ? target : Math.max(target, this.delay - 1);
    return this.delay;
  }
}
