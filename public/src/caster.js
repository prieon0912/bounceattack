import { damageInstallationsInRadius, damageInstallationsOnContact, projectileInstallationContact } from './barricade.js';

export const OCTOPUS_ID = 41;
export const ZEALOT_ID = 42;
const ATTACK = [null, 'qy83', '05j0'];
const JUMP = [null, 87, 38];
const FALL = [null, 'du2p', 'iblx'];
const EMBER = { damage: 6, speed: 4.8, life: 27 };
const ROCKET_RANGE = 63;
const ROCKET_WIDTH = 16;
const ROCKET_DAMAGE = 6;
const ROCKET_ANGLES = [-30, 0, 30];

export class CasterSystem {
  constructor(runtime) { this.r = runtime; }

  *hit(context, side, amount, group) {
    context.thornAttackGroup = group;
    yield* this.r.call(context, ATTACK[side], [-amount, 0, 1]);
  }

  basic(side, state, character) {
    const r = this.r;
    state.attackAt = r.tick + (character === OCTOPUS_ID ? 33 : 27);
    if (character === ZEALOT_ID) {
      this.ember(side);
      return;
    }
    const body = r.duo.body(side), direction = r.duo.facing(side);
    const origin = { x: body.x, y: body.y };
    const group = 'octopus-basic:' + r.tick;
    this.spinArm(side, body, direction, 7, group);
    if (state.echoUntil > r.tick) {
      state.echoUntil = 0;
      this.spinArm(side, origin, direction, 5, group, true);
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
    const body = r.duo.body(side);
    r.duo.flash(side, 'octopus/dream-tentacle', body.x, body.y + 8, 20, 12);
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
      this.dreamArm(side, origin, dx, dy, 18 + index * 16, group, volley);
  }

  stretch(effect, x, y, dx, dy, length, thickness) {
    effect.x = x + dx * length / 2;
    effect.y = y + dy * length / 2;
    effect.scaleX = length / effect.width;
    effect.scaleY = thickness / effect.height;
    effect.rotation = -Math.atan2(dy, dx) * 180 / Math.PI;
  }

  spinArm(side, origin, direction, damage, group, dream = false) {
    const r = this.r;
    const art = dream ? 'octopus/dream-tentacle' : 'octopus/tentacle';
    const arm = r.duo.visual(side, art, origin.x, origin.y, 1, 'octopus-arm');
    arm.visible = !dream;
    r.spawn(arm, function* swing(rt, context) {
      const struck = new Set();
      const enemy = rt.originals.get(side === 1 ? 'ocqj' : 'n230');
      try {
        if (dream) yield 30;
        for (let age = 0; age < 32 && rt.castle.alive(side); age++) {
          if (!dream && rt.castle.blocked(side)) return;
          const reach = Math.min(1, age / 5, (31 - age) / 5);
          const turn = Math.max(0, Math.min(1, (age - 4) / 23));
          // A little windup and a loose tip give the sweep a wrist-like snap.
          const angle = -0.27 - .30 * Math.sin(Math.PI * Math.min(1, age / 5)) +
            turn * Math.PI * 2 + .19 * Math.sin(turn * Math.PI * 2);
          const dx = direction * Math.cos(angle), dy = Math.sin(angle);
          const length = 16 + reach * (dream ? 44 : 41) + reach * 3 * Math.sin(turn * 9);
          arm.visible = true;
          arm.effects.transparency = dream ? 27 : 0;
          rt.caster.stretch(arm, origin.x, origin.y, dx, dy, length, 24 + reach * 6);
          if (age >= 5 && age <= 27) {
            rt.duo.trace(arm, dream ? '#c596fa' : '#9962d3', origin.x + dx * length * .86, origin.y + dy * length * .86);
            yield* rt.caster.armContact(context, side, arm, enemy, damage, group, struck, dream ? null : { origin, dx, dy, length });
          }
          yield 1;
        }
      } finally { arm.dead = true; }
    }, 'octopus_spin');
  }

  *armContact(context, side, arm, enemy, damage, group, struck, tip = null, volley = null) {
    const r = this.r;
    if ((!volley || volley.hits < 2) && !struck.has(enemy) && r.castle.canHit(side) && r.overlap(arm, enemy)) {
      struck.add(enemy);
      if (volley) volley.hits++;
      yield* this.hit(context, side, damage, group);
      if (tip) {
        const { origin, dx, dy, length } = tip;
        const along = (enemy.x - origin.x) * dx + (enemy.y - origin.y) * dy;
        if (along >= length * .68) r.castle.knockback(3 - side, -dx * 14);
      }
    }
    for (const minion of r.duo.effects(3 - side, 'minion')) {
      if (struck.has(minion) || !r.overlap(arm, minion)) continue;
      struck.add(minion);
      r.duo.damageMinion(minion, damage);
    }
    damageInstallationsOnContact(r, arm, damage, struck);
  }

  dreamArm(side, origin, dx, dy, delay, group, volley) {
    const r = this.r;
    const arm = r.duo.visual(side, 'octopus/dream-tentacle', origin.x, origin.y, 1, 'octopus-arm');
    arm.visible = false;
    r.spawn(arm, function* attack(rt, context) {
      const struck = new Set();
      const enemy = rt.originals.get(side === 1 ? 'ocqj' : 'n230');
      try {
        if (delay > 14) yield delay - 14;
        for (let age = -14; age < 17 && rt.castle.alive(side); age++) {
          arm.visible = true;
          arm.effects.transparency = age < 0 ? 77 : Math.max(0, (age - 6) * 9);
          const length = age < 0 ? 89 : 89 - Math.max(0, age - 7) * 5;
          rt.caster.stretch(arm, origin.x, origin.y, dx, dy, length, 52);
          if (age >= 0 && age <= 7)
            yield* rt.caster.armContact(context, side, arm, enemy, 9, group, struck, null, volley);
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
            rt.globals.set(FALL[side], 3.1);
            rt.castle.knockback(side, Math.sign(dx) * 19);
            return;
          }
          rt.duo.trace(tether, '#b484eb', body.x, body.y);
          const speed = Math.min(4.5, 2.3 + age * .55);
          rt.castle.move(side, dx / distance * speed, dy / distance * speed);
          yield 1;
        }
      } finally { tether.dead = true; }
    }, 'octopus_grapple');
  }

  ember(side) {
    const r = this.r, body = r.duo.body(side), direction = r.duo.facing(side);
    const spark = r.duo.visual(side, 'zealot/ember', body.x + direction * 9, body.y + 2, 15, 'projectile');
    spark.scaleX *= direction;
    const group = 'zealot-ember:' + r.tick;
    r.spawn(spark, function* fly(rt, context) {
      let vy = 1.15;
      try {
        for (let age = 0; age < EMBER.life && rt.castle.alive(side); age++) {
          vy -= .10;
          rt.duo.trace(spark, '#ff8b31');
          spark.rotation = -direction * Math.atan2(vy, EMBER.speed) * 180 / Math.PI + Math.sin(age * .7) * 7;
          for (let part = 0; part < 3; part++) {
            spark.x += direction * EMBER.speed / 3;
            spark.y += vy / 3;
            if (Math.abs(spark.x) > 240 || rt.duo.terrain(spark)) return;
            const rocket = rt.duo.effects(side, 'zealot-rocket').find(e => e.duoEffect.altar &&
              !e.duoEffect.blastAt && Math.hypot(e.x - spark.x, e.y - spark.y) <= 14);
            if (rocket) {
              rt.caster.light(rocket, 26);
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
    this.light(rocket, 42);
    const direction = r.duo.facing(side);
    r.globals.set(FALL[side], 3.1);
    r.spawn(body, function* leap(rt) {
      for (let age = 0; age < 9 && rt.castle.alive(side) && !rt.castle.blocked(side); age++) {
        rt.castle.move(side, direction * (4.8 - age * .25), 0);
        yield 1;
      }
    }, 'zealot_leap');
  }

  rocket(side, point, altar, origin = null) {
    const r = this.r;
    const rocket = r.duo.visual(side, 'zealot/rocket', origin?.x ?? point.x, origin?.y ?? point.y, 18, 'zealot-rocket', { altar });
    const expires = r.tick + 600;
    r.spawn(rocket, function* fuse(rt, context) {
      const support = { ...rt.duo.body(side) };
      let age = 0, fall = 0;
      try {
        while (rt.castle.alive(side) && (rocket.duoEffect.blastAt || rt.tick < expires)) {
          if (origin && age < 18) {
            const progress = ++age / 18;
            rocket.x = origin.x + (point.x - origin.x) * progress;
            rocket.y = origin.y + (point.y - origin.y) * progress + 23 * Math.sin(Math.PI * progress);
            rocket.rotation = (point.x < origin.x ? -1 : 1) * 360 * progress;
            yield 1;
            continue;
          }
          support.x = rocket.x;
          support.y = rocket.y - 6;
          if (rt.duo.terrain(support)) fall = 0;
          else {
            const previousY = rocket.y;
            fall = Math.min(6, fall + .24);
            for (let drop = Math.min(1, fall); drop <= fall; drop = Math.min(drop + 1, fall)) {
              support.y = previousY - drop - 6;
              rocket.y = previousY - drop;
              if (rt.duo.terrain(support)) { fall = 0; break; }
              if (drop === fall) break;
            }
          }
          if (rocket.y < -142) return;
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
    const enemy = r.duo.body(3 - side);
    const relativeX = enemy.x - x, relativeY = enemy.y - y;
    let hits = 0, flashHits = 0;
    for (const angle of ROCKET_ANGLES) {
      const radians = angle * Math.PI / 180;
      const dx = Math.sin(radians), dy = Math.cos(radians);
      const column = r.duo.visual(side, 'zealot/ember', x, y, 1, 'zealot-column');
      this.stretch(column, x, y, dx, dy, ROCKET_RANGE, 29);
      const tipX = dx * (ROCKET_RANGE - 3), tipY = dy * (ROCKET_RANGE - 3);
      r.duo.flash(side, 'zealot/burst', x + tipX, y + tipY, 27, 17);
      if (Math.hypot(relativeX - tipX, relativeY - tipY) <= 13.5) flashHits++;
      r.spawn(column, function* flare() {
        try {
          for (let age = 0; age < 13; age++) {
            column.effects.transparency = Math.max(0, age - 4) * 9;
            yield 1;
          }
        } finally { column.dead = true; }
      }, 'zealot_flare');
      const along = relativeX * dx + relativeY * dy;
      const across = Math.abs(relativeX * dy - relativeY * dx);
      if (along >= -8 && along <= ROCKET_RANGE && across <= ROCKET_WIDTH) hits++;
      damageInstallationsOnContact(r, column, ROCKET_DAMAGE, new Set());
    }
    if ((hits || flashHits) && r.castle.canHit(side) && (!volley || volley.hits < 2)) {
      if (volley) volley.hits++;
      for (let hit = 0; hit < hits; hit++)
        yield* this.hit(context, side, ROCKET_DAMAGE, group);
      for (let hit = 0; hit < flashHits; hit++)
        yield* this.hit(context, side, 3, group);
    }
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
    const origin = { x: body.x + direction * 10, y: body.y + 2 };
    const placed = points.map(point => this.rocket(side, point, false, origin));
    for (const [index, rocket] of [...placed, ...existing].entries())
      this.light(rocket, 24 + index * 18, volley, group);
  }
}
