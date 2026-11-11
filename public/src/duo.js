import { damageInstallationsInRadius, projectileInstallationContact } from './barricade.js';
import { THORN_ID } from './thorn.js';
import { OCTOPUS_ID, ZEALOT_ID } from './caster.js';

export const PHAGE_ID = 38;
export const BANANA_ID = 39;
const SIDES = [
  { character: 'y75t', body: '00h9', hero: 'n230', profile: 'afvb', weapon: '31us', mana: 'qn98',
    hp: 'akf6', shield: 'cfmd', facing: 'etjn', recoil: 'c9o4', fall: 'du2p', momentum: 'utbg',
    left: 65, right: 68, attack: 69, skill: 82, ultimate: 83 },
  { character: 's5vb', body: 'n8fg', hero: 'ocqj', profile: '8svk', weapon: 'mimn', mana: 'thom',
    hp: '7ir2', shield: 'g4sc', facing: '846x', recoil: 'lgp6', fall: 'iblx', momentum: 'j88w',
    left: 37, right: 39, attack: 13, skill: 80, ultimate: 40 },
];
const PROTECTED = new Map([
  ['akf6', 1], ['cfmd', 1], ['8w41', 1], ['05ze', 1], ['9af4', 1], ['c9o4', 1],
  ['7ir2', 2], ['g4sc', 2], ['wyyq', 2], ['1vu0', 2], ['nccn', 2], ['lgp6', 2],
]);
const WALK = new Set(['afct', 'i0j3', 'zwdh', 'xcn9']);
const BASE = { range: 35, interval: 34, damage: 5, walk: 1, armor: 1 };
const EVOLUTION = {
  needle: [
    { ...BASE, range: 41, damage: 4 },
    { ...BASE, range: 44, interval: 29, damage: 4 },
  ],
  armor: [
    { ...BASE, walk: .92, armor: .88 },
    { ...BASE, walk: .88, armor: .82, interval: 37 },
  ],
};
const CALTROP_LIFETIME = 30 * 60;
const isCaster = id => id === OCTOPUS_ID || id === ZEALOT_ID;
const isCustom = id => id === PHAGE_ID || id === BANANA_ID || id === THORN_ID || isCaster(id);
const BODY_ART = {
  [PHAGE_ID]: 'phage/core', [THORN_ID]: 'thorn/body', [BANANA_ID]: 'banana/body',
  [OCTOPUS_ID]: 'octopus/body', [ZEALOT_ID]: 'zealot/body',
};
const HELD_ART = {
  [BANANA_ID]: [['banana/held', 15, 10, -2]],
  [ZEALOT_ID]: [['zealot/candle', 15, 9, -1]],
  [OCTOPUS_ID]: [['octopus/tentacle', 11, 8, -2]],
};

function loadout(character, primaryPictureId, secondaryPictureId, details) {
  const art = id => `assets/${id}-icon.svg`;
  return {
    character, primaryPictureId, secondaryPictureId: secondaryPictureId + '-skill-icon', lockVariable: false,
    primaryIcon: art(primaryPictureId), icon: art(secondaryPictureId), ...details,
    prepare(project) {
      const pictures = project.objects.find(o => o.id === 'o9rj').sprite.pictures;
      const primary = pictures.find(p => p.id === primaryPictureId);
      if (primary && !pictures.some(p => p.id === this.secondaryPictureId))
        pictures.push({ ...primary, id: this.secondaryPictureId, fileurl: this.icon });
    },
    canCast() { return false; },
    *cast() {},
  };
}

export const phageEvolution = loadout(PHAGE_ID, 'phage/dormant', 'phage/needle', {
  name: '진화', primaryName: '휴면 상태',
  primaryDescription: '2.5초동안 굳으며 무적 상태가 됩니다.',
  description: '자신의 진화 방향을 선택하여 진화합니다.',
});
export const bananaReturn = loadout(BANANA_ID, 'banana/slide', 'banana/return', {
  name: '복귀 표식', primaryName: '어깨치기',
  primaryDescription: '앞으로 돌진하며 부딪힌 적을 밀쳐냅니다.',
  description: '현재 위치에 표식을 남깁니다. 3초 안에 다시 사용하면 그 자리로 돌아갑니다.',
});
export const thornSpin = loadout(THORN_ID, 'thorn/guard', 'thorn/spin', {
  name: '회전 연타', primaryName: '교차 가드',
  primaryDescription: '방어 태세를 취해 3초 동안 피해 반사 확률을 40%로 높입니다.',
  description: '2.4초 동안 이동하며 쌍절곤을 연속으로 휘두릅니다.',
});
export const octopusEcho = loadout(OCTOPUS_ID, 'octopus/grapple', 'octopus/echo', {
  name: '잠꼬대', primaryName: '빨판 점프',
  primaryDescription: 'MP 24. 지형에 촉수를 붙입니다. 점프로 놓습니다.',
  description: 'MP 28. 다음 평타 자리에 0.5초 뒤 촉수가 한 번 더 나옵니다.',
});
export const zealotLeap = loadout(ZEALOT_ID, 'zealot/rocket', 'zealot/leap', {
  name: '불꽃걸음', primaryName: '제단',
  primaryDescription: 'MP 22. 폭죽을 최대 세 개 놓습니다.',
  description: 'MP 28. 뛰어오르며 0.8초 뒤 터지는 폭죽을 놓습니다.',
});

export class DuoSystem {
  constructor(runtime) { this.r = runtime; }

  character(side) { return Number(this.r.globals.get(SIDES[side - 1].character)); }
  body(side) { return this.r.originals.get(SIDES[side - 1].body); }
  facing(side) { return this.r.num(this.r.globals.get(SIDES[side - 1].facing)) === 1 ? 1 : -1; }
  state(side) { return this.r.globals.get('duo:' + side); }
  stats(state) { return EVOLUTION[state.branch]?.[state.tier - 1] ?? BASE; }
  dormant(side) { return (this.state(side)?.dormantUntil ?? 0) > this.r.tick; }

  reset() {
    for (const side of [1, 2]) {
      this.r.globals.delete('duo:' + side);
      this.r.globals.delete('duo-slip:' + side);
    }
  }

  blocksKey(key) {
    return this.r.scene === '7dwq' && SIDES.some(({ attack, skill, ultimate }, i) =>
      isCustom(this.character(i + 1)) && (key === attack || key === skill || key === ultimate));
  }

  freezesBody(entity) {
    if (entity.objectId === SIDES[0].body) return this.dormant(1);
    if (entity.objectId === SIDES[1].body) return this.dormant(2);
    return false;
  }

  protectsWrite(id, next) {
    const side = PROTECTED.get(id);
    if (!side || !this.dormant(side)) return false;
    const { hp, shield, recoil } = SIDES[side - 1];
    const change = this.r.num(next) - this.r.num(this.r.globals.get(id));
    return id === recoil || (id === hp || id === shield ? change < 0 : change > 0);
  }

  incomingDamage(side, args) {
    const state = this.state(side), armor = state ? this.stats(state).armor : 1;
    return armor < 1 && this.r.num(args[0]) < 0
      ? [this.r.num(args[0]) * armor, ...args.slice(1)] : args;
  }

  adjustWalk(context, args) {
    if (!WALK.has(context.block)) return;
    const side = SIDES.findIndex(item => item.body === context.e.objectId) + 1;
    if (!side) return;
    const state = this.state(side), slip = this.r.globals.get('duo-slip:' + side);
    const movement = (state ? this.stats(state).walk : 1) * this.r.thorn.walk(side) *
      (slip?.slowUntil > this.r.tick ? .55 : 1);
    if (movement !== 1) args[0] = this.r.num(args[0]) * movement;
  }

  mana(side, change) {
    const id = SIDES[side - 1].mana, current = this.r.num(this.r.globals.get(id));
    if (current + change < 0) return false;
    this.r.set(this.body(side), id, Math.min(100, current + change));
    return true;
  }

  visual(side, art, x, y, size, kind, state = {}) {
    const e = this.r.castle.visual(side, art, x, y, size, kind);
    delete e.castleEffect;
    e.objectId = 'duo-effect';
    e.duoEffect = { kind, ...state };
    return e;
  }

  effects(side, kind) {
    return this.r.entities.filter(e => !e.dead && e.combatSide === side && e.duoEffect?.kind === kind);
  }

  flash(side, art, x, y, size, duration, direction = 1) {
    const r = this.r, e = this.visual(side, art, x, y, size, 'flash');
    e.scaleX *= direction;
    r.spawn(e, function* animate() {
      for (let tick = 0; tick < duration; tick++) {
        e.effects.transparency = 10 + 85 * tick / duration;
        yield 1;
      }
      e.dead = true;
    }, 'duo_flash');
  }

  step() {
    const r = this.r;
    if (r.scene !== '7dwq') return;
    for (const side of [1, 2]) {
      const character = this.character(side);
      if (!isCustom(character)) continue;
      const key = 'duo:' + side, control = SIDES[side - 1];
      if (!this.state(side)) {
        r.globals.set(key, { attackAt: 0, skillAt: 0, ultimateAt: 0, hits: 0, damage: 0, tier: 0 });
        continue;
      }
      const state = this.state(side);
      const skill = r.keys.has(control.skill), ultimate = r.keys.has(control.ultimate);
      const skillEdge = skill && !state.skillDown, ultimateEdge = ultimate && !state.ultimateDown;
      state.skillDown = skill;
      state.ultimateDown = ultimate;
      if (state.returnPoint?.until <= r.tick) delete state.returnPoint;
      if (!r.castle.alive(side) || this.dormant(side)) continue;
      if (character === THORN_ID) r.thorn.tick(side, state);
      if (!r.castle.alive(side)) continue;
      if (state.dormantUntil) {
        state.dormantUntil = 0;
        this.mana(side, 5);
        const maxHp = side === 1 ? 'xr74' : '67ko';
        const healing = Math.min(1, r.num(r.globals.get(maxHp)) - r.num(r.globals.get(control.hp)));
        if (healing > 0) {
          r.spawn(this.body(side), function* recover(rt, context) {
            yield* rt.call(context, side === 1 ? 'albn' : '41z4', [healing]);
          }, 'phage_dormant_recovery');
        }
      }
      if (r.castle.blocked(side) || state.slideUntil > r.tick) continue;
      const secondary = r.secondarySkills.state(side).mode === 'secondary';
      if (ultimateEdge && r.tick >= state.ultimateAt) {
        if (character === PHAGE_ID) this.mark(side, state);
        else if (character === THORN_ID) r.thorn.smoke(side, state);
        else if (isCaster(character)) r.caster.ultimate(side, state, character);
        else this.scatter(side, state);
      } else if (skillEdge && (r.tick >= state.skillAt || state.returnPoint)) {
        if (character === PHAGE_ID) this.phageSkill(side, state, secondary);
        else if (character === THORN_ID) r.thorn.skill(side, state, secondary);
        else if (isCaster(character)) r.caster.skill(side, state, character, secondary);
        else this.bananaSkill(side, state, secondary);
      } else if (r.keys.has(control.attack) && r.tick >= state.attackAt) {
        if (character === PHAGE_ID) this.strike(side, state);
        else if (character === THORN_ID) r.thorn.basic(side, state);
        else if (isCaster(character)) r.caster.basic(side, state, character);
        else {
          state.attackAt = r.tick + 37;
          this.throwPeel(side);
        }
      }
    }
  }

  phageSkill(side, state, secondary) {
    const r = this.r, body = this.body(side), control = SIDES[side - 1];
    if (!secondary) {
      if (!this.mana(side, -30)) return;
      state.dormantUntil = r.tick + 150;
      state.skillAt = r.tick + 300;
      state.lockX = body.x;
      state.lockY = body.y;
      this.freeze(side, state);
      return;
    }
    const left = r.keys.has(control.left), right = r.keys.has(control.right);
    if (state.tier >= 2 || !this.mana(side, state.tier ? -32 : -24)) return;
    state.branch ??= left !== right ? (left ? 'armor' : 'needle') : (r.random() < .5 ? 'armor' : 'needle');
    state.tier++;
    state.skillAt = r.tick + 300;
    this.flash(side, 'phage/mark', body.x, body.y, 26 + state.tier * 3, 23);
  }

  freeze(side, state) {
    const r = this.r, body = this.body(side), { fall, recoil, momentum } = SIDES[side - 1];
    body.x = state.lockX;
    body.y = state.lockY;
    for (const id of [fall, recoil, momentum]) r.globals.set(id, 0);
  }

  vitality(side) {
    const { hp, shield } = SIDES[side - 1], r = this.r;
    return Math.max(0, r.num(r.globals.get(hp))) + Math.max(0, r.num(r.globals.get(shield)));
  }

  strike(side, state) {
    const r = this.r, fighter = this.body(side), direction = this.facing(side), stats = this.stats(state);
    state.attackAt = r.tick + stats.interval;
    const tail = this.visual(side, 'phage/swipe', fighter.x, fighter.y, stats.range + 5, 'swing');
    tail.scaleX *= direction;
    r.spawn(tail, function* animate(rt) {
      try {
        for (let tick = 0; tick < 15 && rt.castle.alive(side) && !rt.castle.blocked(side) && !rt.duo.dormant(side); tick++) {
          const degrees = -68 + 138 * tick / 14;
          const radians = degrees * Math.PI / 180;
          tail.rotation = degrees * direction;
          tail.x = fighter.x + direction * Math.cos(radians) * stats.range / 2;
          tail.y = fighter.y - Math.sin(radians) * stats.range / 2;
          tail.effects.transparency = 10 + Math.max(0, tick - 6) * 10;
          yield 1;
        }
      } finally { tail.dead = true; }
    }, 'phage_tail_animation');
    r.spawn(fighter, function* swing(rt, context) {
      yield 5;
      if (!rt.castle.alive(side) || rt.castle.blocked(side) || rt.duo.dormant(side)) return;
      const enemy = rt.duo.body(3 - side);
      const reaches = (target, extra = 0) => {
        const forward = (target.x - fighter.x) * direction;
        return forward >= -3 && forward <= stats.range + extra && Math.abs(target.y - fighter.y) <= 13 + extra;
      };
      for (const minion of rt.duo.effects(3 - side, 'minion')) {
        if (reaches(minion)) rt.duo.damageMinion(minion, stats.damage);
      }
      if (!reaches(enemy) || !rt.castle.canHit(side)) return;
      const before = rt.duo.vitality(3 - side);
      yield* rt.call(context, side === 1 ? 'qy83' : '05j0', [-stats.damage, 0, 1]);
      const lost = Math.max(0, before - rt.duo.vitality(3 - side));
      if (lost && state.hits < 5) {
        state.hits++;
        state.damage = Math.round((state.damage + lost) * 100) / 100;
      }
    }, 'phage_strike');
  }

  mark(side, state) {
    const r = this.r;
    if (!state.hits || state.swarmUntil > r.tick || !r.castle.alive(3 - side) || !this.mana(side, -52)) return;
    const origin = this.body(side), victim = this.body(3 - side);
    const count = state.hits * 2 + (state.hits === 5 ? 2 : 0);
    state.ultimateAt = r.tick + 420;
    state.hits = 0;
    state.damage = 0;
    state.swarmUntil = r.tick + 420;
    state.swarmHitAt = r.tick + 28;
    this.flash(side, 'phage/mark', origin.x, origin.y, 54, 22);
    for (let index = 0; index < count; index++) this.minion(side, origin, victim, index, count, state);
  }

  minion(side, origin, target, index, count, state) {
    const r = this.r, angle = index * 2 * Math.PI / count;
    const e = this.visual(side, 'phage/core', origin.x, origin.y, 11, 'minion', { hp: 3 });
    r.spawn(e, function* hunt(rt, context) {
      try {
        while (rt.tick < state.swarmUntil && rt.castle.alive(side) && rt.castle.alive(3 - side)) {
          const phase = angle + (rt.tick + index * 7) * .058;
          const radius = 11 + (index % 3) * 6 + Math.sin(phase * 2) * 6;
          const x = target.x + Math.cos(phase) * radius;
          const y = target.y + Math.sin(phase) * radius * .65;
          const dx = Math.max(-1.75, Math.min(1.75, (x - e.x) / 6));
          const dy = Math.max(-1.5, Math.min(1.5, (y - e.y) / 6));
          rt.duo.moveMinion(e, dx, dy);
          if (Math.hypot(e.x - target.x, e.y - target.y) <= 13 && rt.tick >= state.swarmHitAt && rt.castle.canHit(side) && !rt.duo.terrain(e)) {
            state.swarmHitAt = rt.tick + 36;
            yield* rt.call(context, side === 1 ? 'qy83' : '05j0', [-1, 0, 1]);
            rt.duo.flash(side, 'phage/swipe', e.x, e.y, 12, 6);
          }
          yield 1;
        }
      } finally { e.dead = true; }
    }, 'phage_minion');
  }

  moveMinion(e, dx, dy) {
    // Flying minions can pass through platforms while pursuing the target.
    e.x = Math.max(-232, Math.min(232, e.x + dx));
    e.y = Math.max(-127, Math.min(124, e.y + dy));
    e.rotation = dx * 7;
  }

  damageMinion(e, damage) {
    e.duoEffect.hp -= damage;
    e.effects.brightness = e.duoEffect.hp === 1 ? -20 : 45;
    if (e.duoEffect.hp <= 0) {
      e.dead = true;
      this.flash(e.combatSide, 'phage/mark', e.x, e.y, 13, 8);
    }
  }

  noticeAttack(source, targetId) {
    const side = SIDES.findIndex(item => item.body === targetId || item.hero === targetId) + 1;
    if (!side || !(this.state(side)?.swarmUntil > this.r.tick) || !source.clone ||
        source.combatSide === side || source.duoEffect || !source.def.barricadeDamage) return;
    this.hitMinion(side, source, 1);
  }

  hitMinion(side, source, damage) {
    const r = this.r;
    if (!(this.state(side)?.swarmUntil > r.tick) || source.duoMinionHitAt > r.tick) return;
    const hit = this.effects(side, 'minion').find(minion => r.overlap(source, minion));
    if (!hit) return;
    source.duoMinionHitAt = r.tick + 20;
    this.damageMinion(hit, damage);
  }

  terrain(e) { return this.r.reach(e, '6tzq') || this.r.reach(e, '2bx4'); }

  throwPeel(side) {
    const r = this.r, body = this.body(side), direction = this.facing(side);
    const e = this.visual(side, 'banana/peel', body.x + direction * 9, body.y + 2.5, 13, 'projectile');
    r.spawn(e, function* fly(rt, context) {
      let vy = 1.7;
      try {
        flight: for (let age = 0; age < 68 && rt.castle.alive(side); age++) {
          const enemy = rt.duo.body(3 - side);
          vy -= .15;
          for (let part = 0; part < 3; part++) {
            const x = e.x, y = e.y;
            e.x += direction * 1.35;
            e.y += vy / 3;
            if (Math.abs(e.x) > 239 || e.y < -138 || rt.duo.terrain(e)) {
              e.x = x;
              e.y = y;
              break flight;
            }
            rt.duo.hitMinion(3 - side, e, 4);
            if (projectileInstallationContact(rt, e)) {
              damageInstallationsInRadius(rt, side, e, 8, 4);
              return;
            }
            if (rt.castle.canHit(side) && Math.hypot(enemy.x - e.x, enemy.y - e.y) <= 12) {
              yield* rt.call(context, side === 1 ? 'qy83' : '05j0', [-4, 0, 1]);
              return;
            }
          }
          e.rotation += direction * 17;
          yield 1;
        }
        for (let tick = 1; tick <= 12 && rt.castle.alive(side); tick++) {
          e.effects.transparency = tick * 100 / 12;
          yield 1;
        }
      } finally { e.dead = true; }
    }, 'banana_throw');
  }

  bananaSkill(side, state, secondary) {
    const r = this.r, body = this.body(side), direction = this.facing(side);
    if (secondary) {
      this.returnPeel(side, state);
      return;
    }
    if (!this.mana(side, -22)) return;
    state.skillAt = r.tick + 60;
    state.slideUntil = r.tick + 12;
    this.flash(side, 'banana/slide', body.x, body.y, 25, 12, direction);
    r.spawn(body, function* slide(rt, context) {
      let hit = false;
      for (let tick = 0; tick < 12 && rt.castle.alive(side) && !rt.castle.blocked(side); tick++) {
        if (!rt.secondarySkills.blocksMove(body, direction * 3.5, 0)) rt.castle.move(side, direction * 3.5, 0);
        const enemy = rt.duo.body(3 - side);
        if (!hit && rt.castle.canHit(side) && Math.hypot(enemy.x - body.x, enemy.y - body.y) <= 18) {
          hit = true;
          yield* rt.call(context, side === 1 ? 'qy83' : '05j0', [-4, 0, 1]);
          rt.castle.knockback(3 - side, 23 * direction);
        }
        yield 1;
      }
    }, 'banana_slide');
  }

  returnPeel(side, state) {
    const r = this.r, body = this.body(side), point = state.returnPoint;
    if (point) {
      if (r.num(r.globals.get(side === 1 ? '05ze' : '1vu0')) > 0) return;
      const probe = { ...body, x: point.x, y: point.y, visible: true };
      while (probe.y <= Math.min(125, point.y + 6) && this.terrain(probe)) probe.y++;
      if (probe.y > Math.min(125, point.y + 6) ||
          r.entities.some(e => e.secondaryEffect === 'sten-barricade' && r.overlap(probe, e))) return;

      this.flash(side, 'banana/return', body.x, body.y, 23, 13);
      body.x = probe.x;
      body.y = probe.y;
      const { fall, recoil, momentum } = SIDES[side - 1];
      for (const id of [fall, recoil, momentum]) r.globals.set(id, 0);
      delete state.returnPoint;
      this.flash(side, 'banana/return', body.x, body.y, 29, 18);
      return;
    }
    if (Math.abs(body.x) > 232 || body.y < -125 || body.y > 125 || !this.mana(side, -24)) return;
    const ticket = state.returnPoint = { x: body.x, y: body.y, until: r.tick + 180 };
    state.skillAt = r.tick + 180;
    const marker = this.visual(side, 'banana/return', ticket.x, ticket.y + 12, 16, 'return');
    r.spawn(marker, function* showTicket(rt) {
      while (state.returnPoint === ticket && rt.castle.alive(side)) {
        const remaining = ticket.until - rt.tick;
        marker.effects.transparency = remaining < 45 && remaining % 12 < 6 ? 65 : 10;
        marker.y = ticket.y + 12 + Math.sin(rt.tick * .12) * 1.4;
        yield 1;
      }
      marker.dead = true;
    }, 'banana_return');
  }

  scatter(side, state) {
    const r = this.r, body = this.body(side);

    if (!this.mana(side, -55)) return;
    state.ultimateAt = r.tick + 300;
    state.skillAt = Math.max(state.skillAt, r.tick + 36);
    const { x, y } = body;
    r.spawn(body, function* scatterPeels(rt) {
      for (const offset of [-18, 18, -42, 42, -66, 66]) {
        if (!rt.castle.alive(side)) break;
        rt.duo.trap(side, x, y + 7, offset / 20);
        yield 6;
      }
    }, 'banana_scatter');
  }

  trap(side, x, y, vx) {
    const r = this.r, target = 3 - side;
    const e = this.visual(side, 'banana/peel', x, y, 13, 'trap', { landed: false });
    r.spawn(e, function* drop(rt, context) {
      let vy = 2.7;
      try {
        for (let age = 0; age < CALTROP_LIFETIME && !e.dead && rt.castle.alive(side) && rt.castle.alive(target); age++) {
          if (age < 20 && !e.duoEffect.landed) {
            const oldX = e.x;
            e.x += vx;
            if (Math.abs(e.x) > 232 || rt.duo.terrain(e)) e.x = oldX;
          }
          const oldY = e.y;
          e.y += e.duoEffect.landed ? -.8 : (vy -= .18);
          if (e.y > 129 || rt.duo.terrain(e)) {
            e.y = oldY;
            if (vy <= 0) e.duoEffect.landed = true;
            vy = 0;
          } else if (e.duoEffect.landed) {
            e.duoEffect.landed = false;
          }
          if (e.y < -142) return;
          const enemy = rt.duo.body(target);
          const touching = e.duoEffect.landed &&
            Math.abs(enemy.x - e.x) < 9 && Math.abs(enemy.y - e.y) < 9;
          if (!touching) e.duoEffect.triggered = false;
          if (touching && !e.duoEffect.triggered && rt.castle.canHit(side)) {
            e.duoEffect.triggered = true;
            rt.globals.set('duo-slip:' + target, { slowUntil: rt.tick + 36 });
            rt.castle.knockback(target, 18 * (Math.sign(enemy.x - e.x) || rt.duo.facing(target)));
            rt.duo.flash(side, 'banana/slide', enemy.x, enemy.y, 20, 12);
            yield* rt.call(context, side === 1 ? 'qy83' : '05j0', [-1, 0, 1]);
          }
          e.rotation = e.duoEffect.landed ? 0 : e.rotation + (vx < 0 ? -10 : 10);
          yield 1;
        }
      } finally { e.dead = true; }
    }, 'banana_trap');
  }

  afterStep() {
    const r = this.r;
    for (const side of [1, 2]) {
      const control = SIDES[side - 1], character = this.character(side);
      if (r.scene === '1ckl' && isCustom(character)) r.originals.get(control.weapon).visible = false;
      if (r.scene === '7dwq') r.thorn.confine(this.body(side));
      const state = this.state(side);
      if (!state) continue;
      const dormant = this.dormant(side), hero = r.originals.get(control.hero);
      if (dormant) {
        this.freeze(side, state);
        hero.x = state.lockX;
        hero.y = state.lockY;
      }
      const base = BODY_ART[character];
      const art = state.guardUntil > r.tick ? 'thorn/guard'
        : dormant ? 'phage/dormant' : state.branch ? 'phage/' + state.branch : base;
      r.setPicture(hero, base);
      r.setSize(hero, 16);
      const spinning = character === THORN_ID && state.weaponSpinUntil > r.tick;
      const avatar = spinning ? (art === 'thorn/guard' ? 'thorn/guard-bare' : 'thorn/bare')
        : character === BANANA_ID ? 'banana/core' : art;
      hero.duoPicture = r.pictureFrom(hero.def, avatar);
      const profile = r.originals.get(control.profile);
      if (profile) r.setPicture(profile, art);
      this.updateHeld(side, character, hero, state);
    }
  }

  updateHeld(side, character, hero, state) {
    const r = this.r;
    const items = HELD_ART[character];
    if (!items) return;
    const held = state.held ??= items.map(([art, size]) => this.visual(side, art, hero.x, hero.y, size, 'held').uid);
    const direction = this.facing(side);
    const visible = hero.visible && r.castle.alive(side) && !r.num(r.globals.get(side === 1 ? 'ob2m' : 'rav6'));
    const casting = character === OCTOPUS_ID && r.entities.some(e => e.combatSide === side && !e.dead && e.visible &&
      ['octopus-arm', 'octopus-grapple'].includes(e.duoEffect?.kind));
    for (const [index, [, , dx, dy]] of items.entries()) {
      const effect = r.entities.find(e => e.uid === held[index]);
      if (!effect) continue;
      effect.x = hero.x + direction * dx;
      effect.y = hero.y + dy;
      effect.scaleX = Math.abs(effect.scaleX) * direction * Math.sign(dx);
      if (character === OCTOPUS_ID) effect.effects.color = state.echoUntil > r.tick ? 22 : 0;
      effect.visible = visible && !casting;
    }
  }

  draw(ctx) {
    if (this.r.scene !== '7dwq') return;
    for (const side of [1, 2]) {
      const r = this.r, state = this.state(side);
      if (!state || !r.castle.alive(side) || !r.castle.alive(3 - side)) continue;
      if (this.character(side) !== PHAGE_ID || state.hits === 0) continue;
      const fighter = this.body(side);
      const filled = state.hits;
      const x = Math.max(-222, Math.min(222, fighter.x)), y = Math.min(131, -fighter.y + 12);
      ctx.save();
      ctx.lineWidth = .8;
      for (let slot = 0; slot < 5; slot++) {
        const center = x + (slot - 2) * 5;
        ctx.beginPath();
        ctx.moveTo(center, y - 3);
        ctx.lineTo(center + 2, y - 1.25);
        ctx.lineTo(center + 2, y + 1.25);
        ctx.lineTo(center, y + 3);
        ctx.lineTo(center - 2, y + 1.25);
        ctx.lineTo(center - 2, y - 1.25);
        ctx.closePath();
        ctx.fillStyle = slot < filled ? '#a88cf9' : '#392556';
        ctx.strokeStyle = slot < filled ? '#513079' : '#9277b6';
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}
