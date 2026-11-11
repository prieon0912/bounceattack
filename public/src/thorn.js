import { damageInstallationsInRadius } from './barricade.js';

export const THORN_ID = 40;
const HP = ['akf6', '7ir2'];
const DAMAGE_DISPLAY = ['c19k', '9bgr'];
const ARENA_HAZARDS = new Set(['6npu', 'h6v1', '6tzq', '2bx4']);
const SPIN_TICKS = 144;
const SMOKE_RADIUS = 60;
const SMOKE_TICKS = 180;

export class ThornSystem {
  constructor(runtime) { this.r = runtime; }

  state(side) {
    return this.r.duo.character(side) === THORN_ID ? this.r.duo.state(side) : undefined;
  }

  walk(side) {
    const state = this.state(side);
    return state ? 1.2 * (state.spinUntil > this.r.tick ? .85 : 1) : 1;
  }

  tick(side, state) {
    const r = this.r;
    state.drainAt ??= r.tick + 119;
    if (r.tick >= state.drainAt) {
      state.drainAt += 120;
      r.add(r.duo.body(side), HP[side - 1], -1);
    }
    if (!r.castle.alive(side)) return;
    if (r.tick < state.spinUntil && r.tick >= state.spinAt) {
      state.spinAt += 24;
      if (!r.castle.blocked(side)) this.sweep(side, 2.5, state.spinUntil);
    }
    const zone = state.smoke;
    if (!zone) return;
    if (r.tick > zone.until) {
      delete state.smoke;
      return;
    }
    if (r.tick < zone.nextHit || !zone.caught) return;
    zone.nextHit += 30;
    const body = r.duo.body(side), enemy = r.duo.body(3 - side);
    if (Math.hypot(body.x - zone.x, body.y - zone.y) <= SMOKE_RADIUS &&
        Math.hypot(body.x - enemy.x, body.y - enemy.y) <= 24)
      this.hit(side, 2, 'smoke:' + zone.until);
  }

  skill(side, state, secondary) {
    const r = this.r;
    if (!r.duo.mana(side, secondary ? -32 : -25)) return;
    if (secondary) {
      state.skillAt = r.tick + 420;
      state.spinUntil = r.tick + SPIN_TICKS;
      state.spinAt = r.tick + 24;
      state.attackAt = Math.max(state.attackAt, state.spinUntil);
      this.sweep(side, 2.5, state.spinUntil);
    } else {
      state.skillAt = r.tick + 480;
      state.guardUntil = r.tick + 180;
    }
  }

  basic(side, state) {
    state.attackAt = this.r.tick + 36;
    this.sweep(side, 5);
  }

  sweep(side, damage, spin) {
    const r = this.r, body = r.duo.body(side);
    const effect = r.duo.visual(side, 'thorn/sweep', body.x, body.y, 42, 'thorn-sweep');
    r.spawn(effect, function* animate() {
      const duration = spin ? 24 : 14;
      for (let age = 0; age < duration; age++) {
        effect.x = body.x;
        effect.y = body.y;
        effect.rotation = age * 360 / duration;
        effect.effects.transparency = 10 + age * 65 / duration;
        yield 1;
      }
      effect.dead = true;
    }, 'thorn_sweep_visual');
    const enemy = r.duo.body(3 - side);
    damageInstallationsInRadius(r, side, body, 22, damage);
    for (const minion of r.duo.effects(3 - side, 'minion')) {
      if (Math.hypot(body.x - minion.x, body.y - minion.y) <= 22)
        r.duo.damageMinion(minion, damage);
    }
    if (Math.hypot(body.x - enemy.x, body.y - enemy.y) <= 22)
      this.hit(side, damage, spin ? 'spin:' + spin : 'basic:' + r.tick);
  }

  hit(side, damage, group) {
    const r = this.r;
    r.spawn(r.duo.body(side), function* strike(rt, context) {
      if (!rt.castle.canHit(side)) return;
      context.thornAttackGroup = group;
      yield* rt.call(context, side === 1 ? 'qy83' : '05j0', [-damage, 0, 1]);
    }, 'thorn_hit');
  }

  smoke(side, state) {
    const r = this.r;
    if (!r.duo.mana(side, -60)) return;
    const { x, y } = r.duo.body(side), enemy = r.duo.body(3 - side);
    state.ultimateAt = r.tick + 720;
    state.smoke = {
      x, y, until: r.tick + SMOKE_TICKS, nextHit: r.tick + 30,
      caught: r.castle.alive(3 - side) && Math.hypot(enemy.x - x, enemy.y - y) <= SMOKE_RADIUS,
      safeX: enemy.x, safeY: enemy.y,
    };
  }

  confine(body) {
    const side = body?.objectId === '00h9' ? 1 : body?.objectId === 'n8fg' ? 2 : 0;
    if (!side || this.r.scene !== '7dwq') return;
    const r = this.r, zone = this.state(3 - side)?.smoke;
    if (!zone?.caught || r.tick > zone.until || !r.castle.alive(3 - side)) return;
    const dx = body.x - zone.x, dy = body.y - zone.y, distance = Math.hypot(dx, dy);
    if (distance <= SMOKE_RADIUS) {
      zone.safeX = body.x;
      zone.safeY = body.y;
      return;
    }
    const x = zone.x + dx / distance * (SMOKE_RADIUS - .01);
    const y = zone.y + dy / distance * (SMOKE_RADIUS - .01);
    const probe = { ...body, x, y };
    if (r.duo.terrain(probe)) {
      body.x = zone.safeX;
      body.y = zone.safeY;
    } else {
      body.x = zone.safeX = x;
      body.y = zone.safeY = y;
    }
  }

  reflectionHp(side, context) {
    const source = context.e;
    if (!this.state(side) || source.combatSide === side || ARENA_HAZARDS.has(source.objectId)) return null;
    return Math.max(0, this.r.num(this.r.globals.get(HP[side - 1])));
  }

  reflect(side, context, before) {
    const r = this.r, state = this.state(side);
    const loss = before - Math.max(0, r.num(r.globals.get(HP[side - 1])));
    const attacker = 3 - side;
    if (loss <= 0 || !r.castle.alive(attacker) || r.duo.dormant(attacker)) return;

    // Native objects can hit several times while executing one attack.
    const group = context.thornAttackGroup ?? context.e.thornAttackGroup;
    const key = group ? 'group:' + group : 'source:' + context.e.uid;
    state.reflectedAt ??= {};
    const previous = state.reflectedAt[key];
    for (const [attack, tick] of Object.entries(state.reflectedAt)) {
      if (r.tick - tick > 600) delete state.reflectedAt[attack];
    }
    state.reflectedAt[key] = r.tick;
    if (previous !== undefined && r.tick - previous < (group ? 600 : 30)) return;
    if (r.random() >= (state.guardUntil > r.tick ? .4 : .2)) return;

    const body = r.duo.body(attacker), amount = loss * 2;
    const reflecting = r.secondarySkills.reflecting;
    r.secondarySkills.reflecting = true;
    try {
      r.add(body, HP[attacker - 1], -amount);
      r.add(body, DAMAGE_DISPLAY[attacker - 1], -amount);
    } finally {
      r.secondarySkills.reflecting = reflecting;
    }
    r.duo.flash(side, 'thorn/sweep', body.x, body.y, 30, 14);
  }

  tagClone(context, child) {
    const r = this.r;
    if (!this.state(1) && !this.state(2)) return;
    if (!context.thread) return;
    const thread = context.thread;
    if (thread.thornAttackAt === undefined || r.tick - thread.thornAttackAt >= 24)
      thread.thornAttackAt = r.tick;
    child.thornAttackGroup = context.e.thornAttackGroup ?? `${context.e.uid}:${thread.thornAttackAt}`;
  }

  draw(ctx) {
    for (const side of [1, 2]) {
      const zone = this.state(side)?.smoke, r = this.r;
      if (!zone || r.tick > zone.until || !r.castle.alive(side)) continue;
      const fade = Math.min(1, (zone.until - r.tick + 1) / 18);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.beginPath();
      ctx.arc(zone.x, -zone.y, SMOKE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(94, 76, 129, .26)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = zone.caught ? '#8f69cd' : '#aaa0be';
      ctx.setLineDash(zone.caught ? [] : [4, 4]);
      ctx.stroke();
      ctx.restore();
    }
  }
}
