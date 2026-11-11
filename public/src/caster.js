import { damageInstallationsInRadius, projectileInstallationContact } from './barricade.js';

export const OCTOPUS_ID = 41;
export const ZEALOT_ID = 42;
const ATTACK = [null, 'qy83', '05j0'];
const JUMP = [null, 87, 38];
const FALL = [null, 'du2p', 'iblx'];
const EMBER = { damage: 4, speed: 4.3, life: 24 };
const ROCKET_RANGE = 52;
const ROCKET_WIDTH = 13;

export class CasterSystem {
  constructor(runtime) { this.r = runtime; }

  *hit(context, side, amount, group) {
    context.thornAttackGroup = group;
    yield* this.r.call(context, ATTACK[side], [-amount, 0, 1]);
  }

  basic(side, state, character) {
    const r = this.r;
    state.attackAt = r.tick + (character === OCTOPUS_ID ? 34 : 32);
    if (character === ZEALOT_ID) {
      this.ember(side);
      return;
    }
    const body = r.duo.body(side), direction = r.duo.facing(side);
    const origin = { x: body.x, y: body.y };
    const group = 'octopus-basic:' + r.tick;
    this.tentacle(side, origin, direction, 0, 50, 5, 6, group, { follow: body, pull: true });
    if (state.echoUntil > r.tick) {
      state.echoUntil = 0;
      this.tentacle(side, origin, direction, 0, 50, 4, 36, group, { dream: true });
    }
  }

  skill(side, state, character, secondary) {
    const r = this.r;
    if (character === ZEALOT_ID) {
      this.fireworkSkill(side, state, secondary);
      return;
    }
    if (!secondary) {
      this.grapple(side, state);
      return;
    }
    if (state.echoUntil > r.tick || !r.duo.mana(side, -28)) return;
    state.echoUntil = r.tick + 360;
    state.skillAt = r.tick + 330;
  }

  ultimate(side, state, character) {
    const r = this.r;
    if (character === ZEALOT_ID) {
      this.fireworks(side, state);
      return;
    }
    if (!r.duo.mana(side, -60)) return;
    state.ultimateAt = r.tick + 600;
    const body = r.duo.body(side), origin = { x: body.x, y: body.y };
    const volley = { hits: 0, limit: 2 };
    const group = 'octopus-dream:' + r.tick;
    for (const [index, [dx, dy]] of [[-1, 0], [1, 0], [0, 1]].entries())
      this.tentacle(side, origin, dx, dy, 76, 7, 18 + index * 19, group, { dream: true, volley, warning: 18 });
  }

  stretch(effect, x, y, dx, dy, length, thickness) {
    effect.x = x + dx * length / 2;
    effect.y = y + dy * length / 2;
    effect.scaleX = length / effect.width;
    effect.scaleY = thickness / effect.height;
    effect.rotation = -Math.atan2(dy, dx) * 180 / Math.PI;
  }

  tentacle(side, origin, dx, dy, length, damage, delay, group, options) {
    const r = this.r;
    const { dream, follow, pull, volley, warning = dream ? 18 : delay } = options;
    const art = volley ? 'octopus/dream-tentacle' : 'octopus/tentacle';
    const arm = r.duo.visual(side, art, origin.x, origin.y, 1, 'octopus-arm');
    r.spawn(arm, function* attack(rt, context) {
      try {
        for (let age = 0; age < delay + 15; age++) {
          if (!rt.castle.alive(side)) return;
          const source = follow ?? origin;
          const telegraph = age < delay;
          arm.visible = age >= delay - warning;
          arm.effects.transparency = telegraph ? 72 : Math.max(0, (age - delay - 3) * 6);
          arm.effects.color = dream && !volley ? 22 : 0;
          const extension = telegraph && follow ? .34 + .58 * age / delay : 1;
          rt.caster.stretch(arm, source.x, source.y, dx, dy, length * extension, volley ? 46 : 32);
          if (age === delay && !(follow && rt.castle.blocked(side))) {
            const enemy = rt.duo.body(3 - side);
            const along = (enemy.x - source.x) * dx + (enemy.y - source.y) * dy;
            const across = Math.abs((enemy.x - source.x) * dy - (enemy.y - source.y) * dx);
            if (along >= 0 && along <= length && across <= (dream ? 13 : 11)) {
              if (rt.castle.canHit(side) && (!volley || volley.hits < volley.limit)) {
                if (volley) volley.hits++;
                yield* rt.caster.hit(context, side, damage, group);
                if (pull && along >= length - 15) rt.castle.knockback(3 - side, -dx * 10);
              }
            }
            damageInstallationsInRadius(rt, side, arm, length / 2, damage);
          }
          yield 1;
        }
      } finally { arm.dead = true; }
    }, 'octopus_tentacle');
  }

  anchor(body, direction) {
    const r = this.r;
    const probe = { ...body };
    for (const slope of [.52, 0, 1]) {
      for (let distance = 12; distance <= 96; distance += 3) {
        probe.x = body.x + direction * distance;
        probe.y = body.y + slope * distance;
        if (probe.y > 124) break;
        if (Math.abs(probe.x) >= 230 || r.duo.terrain(probe))
          return { x: Math.max(-230, Math.min(230, probe.x)), y: probe.y };
      }
    }
    return null;
  }

  grapple(side, state) {
    const r = this.r, body = r.duo.body(side);
    const point = this.anchor(body, r.duo.facing(side));
    if (!point || !r.duo.mana(side, -24)) return;
    state.skillAt = r.tick + 270;
    const tether = r.duo.visual(side, 'octopus/tentacle', body.x, body.y, 1, 'octopus-grapple');
    r.spawn(tether, function* pull(rt) {
      try {
        for (let age = 0; age < 25 && rt.castle.alive(side) && !rt.castle.blocked(side); age++) {
          const dx = point.x - body.x, dy = point.y - body.y, distance = Math.hypot(dx, dy);
          if (distance < 10) return;
          rt.caster.stretch(tether, body.x, body.y, dx / distance, dy / distance, distance, 19);
          if (rt.keys.has(JUMP[side])) {
            rt.globals.set(FALL[side], 2.5);
            rt.castle.knockback(side, Math.sign(dx) * 15);
            return;
          }
          rt.castle.move(side, dx / distance * 3.3, dy / distance * 3.3);
          yield 1;
        }
      } finally { tether.dead = true; }
    }, 'octopus_grapple');
  }

  ember(side) {
    const r = this.r, body = r.duo.body(side), direction = r.duo.facing(side);
    const spark = r.duo.visual(side, 'zealot/ember', body.x + direction * 9, body.y + 2, 12, 'projectile');
    spark.scaleX *= direction;
    const group = 'zealot-ember:' + r.tick;
    r.spawn(spark, function* fly(rt, context) {
      let vy = .8;
      try {
        for (let age = 0; age < EMBER.life && rt.castle.alive(side); age++) {
          vy -= .10;
          for (let part = 0; part < 3; part++) {
            spark.x += direction * EMBER.speed / 3;
            spark.y += vy / 3;
            if (Math.abs(spark.x) > 240 || rt.duo.terrain(spark)) return;
            const rocket = rt.duo.effects(side, 'zealot-rocket').find(e => e.duoEffect.altar &&
              !e.duoEffect.blastAt && Math.hypot(e.x - spark.x, e.y - spark.y) <= 14);
            if (rocket) {
              rt.caster.light(rocket, 36);
              return;
            }
            rt.duo.hitMinion(3 - side, spark, EMBER.damage);
            if (projectileInstallationContact(rt, spark)) {
              damageInstallationsInRadius(rt, side, spark, 8, EMBER.damage);
              return;
            }
            const enemy = rt.duo.body(3 - side);
            if (rt.castle.canHit(side) && Math.hypot(spark.x - enemy.x, spark.y - enemy.y) <= 12) {
              yield* rt.caster.hit(context, side, EMBER.damage, group);
              rt.duo.flash(side, 'zealot/burst', spark.x, spark.y, 16, 8);
              return;
            }
          }
          yield 1;
        }
      } finally { spark.dead = true; }
    }, 'zealot_ember');
  }

  landing(body, x) {
    const probe = { ...body, x };
    const floor = Math.max(-126, body.y - 100);
    for (let y = Math.min(126, body.y + 8); y >= floor; y -= 2) {
      probe.y = y;
      if (this.r.duo.terrain(probe)) return { x, y: y + 6 };
    }
    return null;
  }

  fireworkSkill(side, state, secondary) {
    const r = this.r, body = r.duo.body(side);
    const point = this.landing(body, body.x);
    if (!point) return;
    if (!secondary && r.duo.effects(side, 'zealot-rocket').filter(e => e.duoEffect.altar).length >= 3) return;
    if (!r.duo.mana(side, secondary ? -28 : -22)) return;
    state.skillAt = r.tick + (secondary ? 360 : 120);
    const rocket = this.rocket(side, point, !secondary);
    if (!secondary) return;
    this.light(rocket, 48);
    const direction = r.duo.facing(side);
    r.globals.set(FALL[side], 2.6);
    r.spawn(body, function* leap(rt) {
      for (let age = 0; age < 9 && rt.castle.alive(side) && !rt.castle.blocked(side); age++) {
        rt.castle.move(side, direction * 3.3, 0);
        yield 1;
      }
    }, 'zealot_leap');
  }

  rocket(side, point, altar) {
    const r = this.r;
    const rocket = r.duo.visual(side, 'zealot/rocket', point.x, point.y, 18, 'zealot-rocket', { altar });
    const expires = r.tick + 600;
    r.spawn(rocket, function* fuse(rt, context) {
      try {
        while (rt.castle.alive(side) && (rocket.duoEffect.blastAt || rt.tick < expires)) {
          const { blastAt, volley, group } = rocket.duoEffect;
          if (blastAt && rt.tick >= blastAt) {
            yield* rt.caster.burst(context, side, rocket, volley, group);
            return;
          }
          if (blastAt) rocket.effects.brightness = rt.tick % 12 < 6 ? 35 : 0;
          yield 1;
        }
      } finally { rocket.dead = true; }
    }, 'zealot_fuse');
    return rocket;
  }

  light(rocket, ticks, volley = null, group = null) {
    const r = this.r, effect = rocket.duoEffect;
    effect.blastAt = Math.min(effect.blastAt ?? Infinity, r.tick + ticks);
    effect.volley = volley ?? effect.volley;
    effect.group = group ?? effect.group ?? ('zealot-rocket:' + rocket.uid);
    r.setPicture(rocket, 'zealot/lit');
  }

  *burst(context, side, rocket, volley, group) {
    const r = this.r, { x, y } = rocket;
    rocket.visible = false;
    const column = r.duo.visual(side, 'zealot/ember', x, y + ROCKET_RANGE / 2, 1, 'zealot-column');
    this.stretch(column, x, y, 0, 1, ROCKET_RANGE, 29);
    r.duo.flash(side, 'zealot/burst', x, y + ROCKET_RANGE - 3, 27, 14);
    r.duo.flash(side, 'zealot/burst', x - 13, y + ROCKET_RANGE - 10, 13, 10);
    r.duo.flash(side, 'zealot/burst', x + 12, y + ROCKET_RANGE - 16, 11, 11);
    r.spawn(column, function* flare() {
      for (let age = 0; age < 13; age++) {
        column.effects.transparency = Math.max(0, age - 4) * 9;
        yield 1;
      }
      column.dead = true;
    }, 'zealot_flare');
    const enemy = r.duo.body(3 - side);
    if (r.castle.canHit(side) && Math.abs(enemy.x - x) <= ROCKET_WIDTH &&
        enemy.y >= y - 8 && enemy.y <= y + ROCKET_RANGE && (!volley || volley.hits < 2)) {
      if (volley) volley.hits++;
      yield* this.hit(context, side, 7, group);
    }
    damageInstallationsInRadius(r, side, { x, y: y + ROCKET_RANGE / 2 }, 24, 7);
  }

  fireworks(side, state) {
    const r = this.r, body = r.duo.body(side), direction = r.duo.facing(side);
    const volley = { hits: 0 }, group = 'zealot-show:' + r.tick;
    const existing = r.duo.effects(side, 'zealot-rocket').filter(e => e.duoEffect.altar)
      .sort((a, b) => Math.abs(a.x - body.x) - Math.abs(b.x - body.x) || a.uid - b.uid);
    const points = [21, 49, 77].map(distance => this.landing(body, body.x + direction * distance))
      .filter(point => point && Math.abs(point.x) <= 230);
    if ((!points.length && !existing.length) || !r.duo.mana(side, -60)) return;
    state.ultimateAt = r.tick + 600;
    const placed = points.map(point => this.rocket(side, point, false));
    for (const [index, rocket] of [...placed, ...existing].entries())
      this.light(rocket, 24 + index * 18, volley, group);
  }
}
