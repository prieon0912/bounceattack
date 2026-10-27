import { EventEmitter } from "node:events";
import Redis from "ioredis";
export class MemoryStore {
  constructor() {
    this.data = new Map();
    this.events = new EventEmitter();
    this.events.setMaxListeners(1000);
  }
  async health() {
    return true;
  }
  async get(key) {
    const item = this.data.get(key);
    if (!item || item.expires < Date.now()) {
      this.data.delete(key);
      return null;
    }
    return item.value;
  }
  async create(key, value, ttl) {
    if (await this.get(key)) return false;
    this.data.set(key, { value, expires: Date.now() + ttl * 1000 });
    return true;
  }
  async cas(key, old, value, ttl) {
    const item = this.data.get(key);
    if (!item || item.value !== old) return false;
    this.data.set(key, { value, expires: Date.now() + ttl * 1000 });
    return true;
  }
  async touch(key, ttl) {
    const item = this.data.get(key);
    if (item) item.expires = Date.now() + ttl * 1000;
  }
  async publish(channel, value) {
    this.events.emit(channel, value);
  }
  async subscribe(channel, fn) {
    this.events.on(channel, fn);
    return () => this.events.off(channel, fn);
  }
  async close() {}
}
export class RedisStore {
  constructor(url) {
    this.redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 8000,
      lazyConnect: true,
      retryStrategy: (attempt) => Math.min(2000, attempt * 200),
    });
    this.sub = this.redis.duplicate();
    this.listeners = new Map();
    this.redis.on("error", () => {});
    this.sub.on("error", () => {});
    this.sub.on("message", (channel, value) => {
      for (const fn of this.listeners.get(channel) || []) fn(value);
    });
  }
  async health() {
    return (await this.redis.ping()) === "PONG";
  }
  async get(k) {
    return this.redis.get(k);
  }
  async create(k, v, ttl) {
    return (await this.redis.set(k, v, "EX", ttl, "NX")) === "OK";
  }
  async cas(k, old, v, ttl) {
    return !!(await this.redis.eval(
      "if redis.call('get',KEYS[1])==ARGV[1] then redis.call('set',KEYS[1],ARGV[2],'EX',ARGV[3]); return 1 else return 0 end",
      1,
      k,
      old,
      v,
      ttl,
    ));
  }
  async touch(k, ttl) {
    await this.redis.expire(k, ttl);
  }
  async publish(c, v) {
    await this.redis.publish(c, v);
  }
  async subscribe(c, fn) {
    let set = this.listeners.get(c);
    if (!set) {
      set = new Set();
      this.listeners.set(c, set);
      await this.sub.subscribe(c);
    }
    set.add(fn);
    return async () => {
      set.delete(fn);
      if (!set.size) {
        this.listeners.delete(c);
        await this.sub.unsubscribe(c);
      }
    };
  }
  async close() {
    this.redis.disconnect();
    this.sub.disconnect();
  }
}
