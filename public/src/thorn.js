import { damageInstallationsOnContact } from './barricade.js';

export const THORN_ID = 40;
const HP = ['akf6', '7ir2'];
const DAMAGE_DISPLAY = ['c19k', '9bgr'];
const ARENA_HAZARDS = new Set(['6npu', 'h6v1', '6tzq', '2bx4']);
export const THORN_IDLE_WEAPON_SIZE = 20;
const THORN_WEAPON_SIZE = 48;
const BASIC_ATTACK_TICKS = 33;
export const THORN_WEAPON_OFFSET = 8;
const SPIN_TICKS = 144;
const SPIN_DAMAGE = 3;
const SMOKE_RADIUS = 66;
const SMOKE_TICKS = 180;

export class ThornSystem {
  constructor(runtime) { this.r = runtime; }

  state(side) {
    return this.r.duo.character(side) === THORN_ID ? this.r.duo.state(side) : undefined;
  }

  walk(side) {
    const state = this.state(side);
    return state ? 1.28 * (state.spinUntil > this.r.tick ? .92 : 1) : 1;
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
      if (!r.castle.blocked(side)) this.sweep(side, SPIN_DAMAGE, state.spinUntil);
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
        Math.hypot(body.x - enemy.x, body.y - enemy.y) <= 29)
      this.hit(side, 3, 'smoke:' + zone.until);
  }

  skill(side, state, secondary) {
    const r = this.r;
    if (!r.duo.mana(side, secondary ? -32 : -25)) return;
    if (secondary) {
      state.skillAt = r.tick + 420;
      state.spinUntil = r.tick + SPIN_TICKS;
      state.spinAt = r.tick + 24;
      state.attackAt = Math.max(state.attackAt, state.spinUntil);
      this.sweep(side, SPIN_DAMAGE, state.spinUntil);
    } else {
      state.skillAt = r.tick + 480;
      state.guardUntil = r.tick + 180;
    }
  }

  basic(side, state) {
    state.attackAt = this.r.tick + BASIC_ATTACK_TICKS;
    this.sweep(side, 7);
  }

  animateWeapon(side, duration, damage = 0, group = null) {
    const r = this.r, body = r.duo.body(side), state = this.state(side);
    const direction = r.duo.facing(side);
    const previous = r.duo.effects(side, 'thorn-weapon')[0];
    if (!damage && previous?.duoEffect.damaging) return;
    if (previous) previous.dead = true;
    const restingOffset = THORN_WEAPON_OFFSET * direction;
    const weapon = r.duo.visual(side, 'thorn/weapon-folded', body.x + restingOffset, body.y, THORN_IDLE_WEAPON_SIZE, 'thorn-weapon', { damaging: damage > 0 });
    state.weaponSpinUntil = r.tick + duration;
    weapon.scaleX *= -direction;
    r.spawn(weapon, function* animate(rt) {
      const struck = new Set();
      const enemy = rt.originals.get(side === 1 ? 'ocqj' : 'n230');
      try {
        for (let age = 0; age < duration && !weapon.dead; age++) {
          const approach = Math.min(1, age / 4, (duration - 1 - age) / 4);
          const ease = approach * approach * (3 - 2 * approach);
          const turn = Math.min(1, Math.max(0, (age - 4) / (duration - 9)));
          weapon.x = body.x + restingOffset * (1 - ease);
          weapon.y = body.y;
          weapon.rotation = direction * (turn * 360 - Math.sin(turn * Math.PI * 2) * 12);
          rt.setPicture(weapon, age < 2 || age >= duration - 2 ? 'thorn/weapon-folded' : 'thorn/weapon');
          rt.setSize(weapon, THORN_IDLE_WEAPON_SIZE + (THORN_WEAPON_SIZE - THORN_IDLE_WEAPON_SIZE) * ease);
          if (damage && age >= 4 && age <= duration - 5) {
            const angle = (weapon.rotation - direction * 55) * Math.PI / 180;
            rt.duo.trace(weapon, '#707a91', weapon.x - Math.cos(angle) * direction * 20, weapon.y + Math.sin(angle) * direction * 20);
            if (!struck.has(enemy) && rt.castle.canHit(side) && rt.overlap(weapon, enemy)) {
              struck.add(enemy);
              rt.thorn.hit(side, damage, group);
            }
            for (const minion of rt.duo.effects(3 - side, 'minion')) {
              if (struck.has(minion) || !rt.overlap(weapon, minion)) continue;
              struck.add(minion);
              rt.duo.damageMinion(minion, damage);
            }
            damageInstallationsOnContact(rt, weapon, damage, struck);
          }
          yield 1;
        }
      } finally { weapon.dead = true; }
    }, 'thorn_weapon_visual');
  }

  sweep(side, damage, spin) {
    const group = spin ? 'spin:' + spin : 'basic:' + this.r.tick;
    this.animateWeapon(side, spin ? 24 : BASIC_ATTACK_TICKS, damage, group);
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
    r.duo.flash(side, 'thorn/reflect-impact', body.x, body.y, 30, 14);
    this.animateWeapon(side, 18);
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
      ctx.clip();
      ctx.fillStyle = 'rgba(94, 76, 129, .12)';
      for (let i = 0; i < 6; i++) {
        const phase = r.tick * (.021 + i * .002) + i * 2.4;
        ctx.beginPath();
        ctx.ellipse(zone.x + Math.cos(phase) * (25 + i * 5), -zone.y + Math.sin(phase) * (18 + i * 6),
          22 + i % 3 * 6, 6 + i % 3 * 2, Math.sin(phase) * .3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}
