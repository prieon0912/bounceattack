import { damageInstallationsInRadius, projectileInstallationContact } from './barricade.js';

export const ECOLA_ID = 37;
const BODY_SIZE = 24;
const FISSION_TICKS = 300;
const FORMS = {
  base: {},
  flagella: { weight: 25, walk: 1.25, jump: 1.15 },
  cannon: { weight: 20, damage: 7, size: 13, speed: 3.4 },
  shell: { weight: 20, walk: .9, armor: .75, recoil: .65 },
  spore: { weight: 20, interval: 25, speed: 4.8, size: 7, damage: 2 },
  wilt: { weight: 15, walk: .8, jump: .85, size: 7, damage: 4 },
};
const CONTROLS = [
  { character: 'y75t', body: '00h9', hero: 'n230', profile: 'afvb', marker: 'aadi', previewWeapon: '31us', mana: 'qn98', facing: 'etjn', jump: 87, attack: 69, skill: 82, ultimate: 83 },
  { character: 's5vb', body: 'n8fg', hero: 'ocqj', profile: '8svk', marker: '0y61', previewWeapon: 'mimn', mana: 'thom', facing: '846x', jump: 38, attack: 13, skill: 80, ultimate: 40 },
];
const WALK_BLOCKS = new Set(['afct', 'i0j3', 'zwdh', 'xcn9']);

export const ecolaFission = {
  character: ECOLA_ID, name: '이분법', manaCost: 28, cooldownTicks: 480, lockVariable: false,
  icon: 'assets/ecola/fission.svg', secondaryPictureId: 'ecola-fission',
  primaryName: '양분흡수', primaryPictureId: 'ecola-absorb', primaryIcon: 'assets/ecola/absorb.svg',
  primaryDescription: '2초 동안 이속 35% 감소, 마나 최대 28 회복.',
  description: 'MP 28. 가짜가 최대 7마리로 늘고 5초 뒤 사라집니다.',
  prepare(project) {
    const pictures = project.objects.find(o => o.id === 'o9rj').sprite.pictures;
    const primary = pictures.find(p => p.id === this.primaryPictureId);
    if (primary && !pictures.some(p => p.id === this.secondaryPictureId))
      pictures.push({ ...primary, id: this.secondaryPictureId, fileurl: this.icon });
  },
  canCast() { return false; },
  *cast() {},
};

function rollForm(random) {
  let roll = random() * 100;
  for (const [name, { weight = 0 }] of Object.entries(FORMS)) {
    if (roll < weight) return name;
    roll -= weight;
  }
  return 'wilt';
}

export class EcolaSystem {
  constructor(runtime) { this.r = runtime; }

  active(side) {
    return this.r.scene === '7dwq' && Number(this.r.globals.get(CONTROLS[side - 1].character)) === ECOLA_ID;
  }

  state(side) { return this.active(side) ? this.r.globals.get('ecola:' + side) : undefined; }
  body(side) { return this.r.originals.get(CONTROLS[side - 1].body); }
  facing(side) { return Number(this.r.globals.get(CONTROLS[side - 1].facing)) === 1 ? 1 : -1; }

  reset() {
    this.r.globals.delete('ecola:1');
    this.r.globals.delete('ecola:2');
  }

  blocksKey(key) {
    return CONTROLS.some(({ attack, skill, ultimate }, i) =>
      this.active(i + 1) && [attack, skill, ultimate].includes(key));
  }

  adjustMovement(context, type, args) {
    if (!WALK_BLOCKS.has(context.block) && context.block !== 'ufg7') return;
    const side = CONTROLS.findIndex(c => c.body === context.e.objectId) + 1;
    if (!side) return;
    const state = this.state(side);
    if (!state) return;
    const form = FORMS[state.form];
    if (type === 'move_x' && WALK_BLOCKS.has(context.block))
      args[0] = this.r.num(args[0]) * (form.walk ?? 1) * (state.absorbUntil ? .65 : 1);
    // Gravity is fixed, so jump height scales with the square of launch speed.
    if (type === 'set_variable' && context.block === 'ufg7' && form.jump)
      args[1] = this.r.num(args[1]) * Math.sqrt(form.jump);
  }

  recoil(id, value) {
    const side = id === 'c9o4' ? 1 : id === 'lgp6' ? 2 : 0;
    if (!side || this.state(side)?.form !== 'shell') return value;
    return this.r.num(value) * FORMS.shell.recoil;
  }

  damageArgs(side, args) {
    const state = this.state(side);
    if (!state || this.r.num(args[0]) >= 0) return args;
    state.hitAt = this.r.tick;
    return state.form === 'shell' ? [this.r.num(args[0]) * FORMS.shell.armor, ...args.slice(1)] : args;
  }

  mana(side, change) {
    const id = CONTROLS[side - 1].mana, current = this.r.num(this.r.globals.get(id));
    if (current + change < 0) return false;
    this.r.set(this.body(side), id, Math.min(100, current + change));
    return true;
  }

  step() {
    const r = this.r;
    for (const side of [1, 2]) {
      if (!this.active(side)) continue;
      const key = 'ecola:' + side, controls = CONTROLS[side - 1];
      if (!this.state(side)) {
        r.globals.set(key, { form: 'base', attackAt: 0, skillAt: 0, ultimateAt: 0 });
        continue;
      }
      const state = this.state(side);
      const skill = r.keys.has(controls.skill), ultimate = r.keys.has(controls.ultimate);
      const skillEdge = skill && !state.skillDown, ultimateEdge = ultimate && !state.ultimateDown;
      state.skillDown = skill;
      state.ultimateDown = ultimate;
      if (!r.castle.alive(side)) {
        this.clearDecoys(side);
        continue;
      }

      if (state.evolveUntil && r.tick >= state.evolveUntil) {
        state.evolveUntil = 0;
        state.form = state.nextForm;
        state.nextForm = null;
        this.pulseGroup(side, state.form === 'wilt' ? 17 : 31);
      }
      if (state.absorbUntil) {
        if (r.castle.blocked(side) || r.keys.has(controls.attack) || r.keys.has(controls.jump))
          state.absorbUntil = 0;
        else if (r.tick >= state.absorbNext) {
          this.mana(side, 7);
          state.absorbNext += 30;
          this.pulse(side, this.body(side), 20);
          if (r.tick >= state.absorbUntil) state.absorbUntil = 0;
        }
      }
      if (state.fissionUntil) {
        if (r.tick >= state.fissionUntil) this.clearDecoys(side);
        else if (state.splits < 3 && r.tick >= state.splitAt) this.split(side, state);
      }
      if (r.castle.blocked(side) || state.evolveUntil) continue;

      if (ultimateEdge && r.tick >= state.ultimateAt && this.mana(side, -60)) {
        state.absorbUntil = 0;
        state.ultimateAt = r.tick + 180;
        state.evolveUntil = r.tick + 24;
        const first = rollForm(r.random);
        state.nextForm = first === state.form ? rollForm(r.random) : first;
        this.pulseGroup(side, 26, 24);
      } else if (skillEdge && r.tick >= state.skillAt) {
        if (r.secondarySkills.state(side).mode === 'secondary') {
          if (!state.fissionUntil && this.mana(side, -ecolaFission.manaCost)) {
            state.skillAt = r.tick + ecolaFission.cooldownTicks;
            state.fissionUntil = r.tick + FISSION_TICKS;
            state.splits = 0;
            this.split(side, state);
          }
        } else {
          state.skillAt = r.tick + 300;
          state.absorbNext = r.tick + 30;
          state.absorbUntil = r.tick + 120;
        }
      } else if (r.keys.has(controls.attack) && r.tick >= state.attackAt) {
        state.attackAt = r.tick + (FORMS[state.form].interval ?? 33);
        state.fireAt = r.tick;
        this.shot(side, this.body(side), this.facing(side), false);
      }
    }
  }

  visual(side, picture, source, size, label) {
    const entity = this.r.castle.visual(side, picture, source.x, source.y, size, label);
    delete entity.castleEffect;
    entity.objectId = 'ecola-effect';
    entity.ecolaEffect = label;
    return entity;
  }

  pulse(side, source, size, duration = 14) {
    const r = this.r, ring = this.visual(side, 'ecola-pulse', source, 5, 'pulse');
    r.spawn(ring, function* animate(rt) {
      for (let age = 0; age < duration; age++) {
        ring.x = source.x;
        ring.y = source.y;
        rt.setSize(ring, 5 + size * (age + 1) / duration);
        ring.effects.transparency = 18 + 80 * age / duration;
        yield 1;
      }
      ring.dead = true;
    }, 'ecola_pulse');
  }

  decoys(side) {
    return this.r.entities.filter(e => e.ecolaEffect === 'decoy' && e.combatSide === side && !e.dead);
  }

  pulseGroup(side, size, duration) {
    for (const source of [this.body(side), ...this.decoys(side)])
      this.pulse(side, source, size, duration);
  }

  clearDecoys(side) {
    const state = this.state(side);
    if (!state.fissionUntil) return;
    state.fissionUntil = 0;
    for (const e of this.decoys(side)) e.dead = true;
  }

  split(side, state) {
    const parents = [this.body(side), ...this.decoys(side)];
    for (const [index, source] of parents.entries()) {
      const copy = this.visual(side, 'ecola-' + state.form, source, BODY_SIZE, 'decoy');
      const order = parents.length + index;
      copy.decoy = {
        order, direction: order % 2 ? -this.facing(side) : this.facing(side),
        vy: source.decoy?.vy ?? 0, turnAt: this.r.tick + 12 + order * 3,
        jumpAt: this.r.tick + 18 + order * 4, fireAt: this.r.tick + 20 + order * 7,
      };
      this.pulse(side, source, 16, 9);
    }
    state.splits++;
    state.splitAt = this.r.tick + 36;
  }

  terrain(e) { return this.r.reach(e, '6tzq') || this.r.reach(e, '2bx4'); }

  moveDecoy(side, e, form) {
    const r = this.r, ai = e.decoy, body = this.body(side), enemy = this.body(3 - side);
    const probe = { ...body, x: e.x, y: e.y, visible: true };
    const blocked = () => {
      probe.x = e.x;
      probe.y = e.y;
      return r.reach(probe, '6tzq');
    };
    const role = ai.order % 3;
    if (r.tick >= ai.turnAt) {
      const targetX = role === 1 ? enemy.x : body.x;
      if (Math.abs(targetX - e.x) > 20)
        ai.direction = Math.sign(targetX - e.x) * (role === 2 ? -1 : 1);
      ai.turnAt = r.tick + 19 + ai.order * 3;
    }
    const oldX = e.x, oldY = e.y;
    e.x += ai.direction * (1.15 + ai.order % 4 * .13) * (form.walk ?? 1);
    if (Math.abs(e.x) > 230 || blocked()) {
      e.x = oldX;
      ai.direction *= -1;
    }
    ai.vy = Math.max(-3, ai.vy - .15);
    e.y += ai.vy;
    if (e.y > 124 || blocked()) {
      const grounded = ai.vy < 0;
      e.y = oldY;
      ai.vy = 0;
      if (grounded && r.tick >= ai.jumpAt) {
        ai.vy = 2.65 * Math.sqrt(form.jump ?? 1);
        ai.jumpAt = r.tick + 52 + ai.order * 5;
      }
    }
    if (e.y < -120) {
      e.x = body.x;
      e.y = body.y;
      ai.vy = 1;
    }
    if (r.tick >= ai.fireAt && Math.abs(e.y - enemy.y) < 22 && !this.state(side).evolveUntil) {
      ai.direction = Math.sign(enemy.x - e.x) || ai.direction;
      ai.fireAt = r.tick + 35 + ai.order * 3;
      ai.firedAt = r.tick;
      this.shot(side, e, ai.direction, true);
    }
  }

  noticeDecoyContact(source, target) {
    const side = CONTROLS.findIndex(c => c.body === target || c.hero === target) + 1;
    if (!side || !this.state(side)?.fissionUntil || source.combatSide === side || source.ecolaEffect ||
        CONTROLS.some(c => c.body === source.objectId || c.hero === source.objectId)) return;
    for (const fake of this.decoys(side)) {
      if (this.r.overlap(source, fake)) this.flash(fake);
    }
  }

  flash(fake) {
    if (this.r.tick - (fake.decoy.hitAt ?? -20) >= 12)
      fake.decoy.hitAt = this.r.tick;
  }

  shot(side, source, direction, fake) {
    const name = this.state(side).form;
    const volley = { hits: 0, maxHits: name === 'spore' ? 2 : 1 };
    const vertical = name === 'spore' ? [-1.45, 0, 1.45] : [name === 'wilt' ? 1.1 : 0];
    for (const vy of vertical) this.projectile(side, source, direction, fake, name, vy, volley);
  }

  projectile(side, source, direction, fake, name, vy, volley) {
    const r = this.r, form = FORMS[name], size = form.size ?? 10;
    const damage = form.damage ?? 5;
    const start = { x: source.x + direction * 9, y: source.y + 1 };
    const e = this.visual(side, 'ecola-shot-' + name, start, size, 'shot');
    e.ecolaFakeShot = fake;
    e.scaleX = direction * Math.abs(e.scaleX);
    r.spawn(e, function* fly(rt, context) {
      let vx = direction * (form.speed ?? 4), canBounce = name === 'shell';
      const explosive = name === 'cannon';
      const enemy = rt.ecola.body(3 - side);
      const hit = (radius) => rt.castle.canHit(side) &&
        Math.hypot(e.x - enemy.x, e.y - enemy.y) <= radius;
      try {
        const life = name === 'wilt' ? 22 : 44;
        for (let age = 0; age < life && rt.castle.alive(side); age++) {
          if (name === 'flagella' && (enemy.x - e.x) * vx > 0)
            vy += (Math.max(-1.5, Math.min(1.5, (enemy.y - e.y) / 20)) - vy) * .18;
          if (name === 'wilt') vy -= .25;
          e.rotation = -Math.atan2(vy, Math.abs(vx)) * Math.sign(vx) * 180 / Math.PI;
          for (let i = 0; i < 3; i++) {
            const x = e.x, y = e.y;
            e.x += vx / 3;
            const wall = Math.abs(e.x) > 238 || rt.ecola.terrain(e);
            if (wall) e.x = x;
            e.y += vy / 3;
            const ceiling = e.y > 133 || (vy !== 0 && rt.ecola.terrain(e));
            if (ceiling) e.y = y;
            if (e.y < -135) return;
            if ((wall || ceiling) && canBounce) {
              canBounce = false;
              if (wall) vx *= -1;
              if (ceiling) vy *= -1;
              e.scaleX = Math.sign(vx) * Math.abs(e.scaleX);
              continue;
            }
            if ((wall || ceiling) && !explosive) return;
            const installation = !fake && !wall && !ceiling && projectileInstallationContact(rt, e);
            if (!fake) {
              rt.duo.hitMinion(3 - side, e, damage);
              const radius = explosive ? 19 : size / 2 + 8;
              for (const decoy of rt.ecola.decoys(3 - side)) {
                if (Math.hypot(e.x - decoy.x, e.y - decoy.y) <= radius) rt.ecola.flash(decoy);
              }
            }
            const direct = !fake && hit(size / 2 + 8);
            if (wall || ceiling || installation || direct) {
              if (installation || (explosive && !fake))
                damageInstallationsInRadius(rt, side, e, explosive ? 19 : size / 2 + 1, damage);
              if (!fake && (direct || (explosive && hit(19))) && volley.hits < volley.maxHits) {
                volley.hits++;
                yield* rt.call(context, side === 1 ? 'qy83' : '05j0', [-damage, 0, 1]);
              }
              if (!e.dead && (explosive || direct)) rt.ecola.pulse(side, e, explosive ? 33 : 12, explosive ? 13 : 8);
              return;
            }
          }
          yield 1;
        }
      } finally { e.dead = true; }
    }, 'ecola_shot');
  }

  pose(entity, state, fireAt, hitAt, phase = 0) {
    const tick = this.r.tick;
    const charge = state.evolveUntil ? Math.max(0, 1 - (state.evolveUntil - tick) / 24) : 0;
    const fire = Math.max(0, 1 - (tick - (fireAt ?? -20)) / 7);
    const hit = Math.max(0, 1 - (tick - (hitAt ?? -20)) / 8);
    const bob = Math.sin((tick + phase) * (state.form === 'flagella' ? .38 : .18));
    entity.ecolaPose = {
      x: 1 + charge * .48 + fire * .2 + hit * .08,
      y: 1 + charge * .56 - fire * .16 + bob * (state.form === 'wilt' ? .1 : .045),
      tilt: state.form === 'flagella' ? bob * .11 : bob * .035,
      flash: hit > 0 || (charge > .45 && tick % 6 < 3),
    };
  }

  afterStep() {
    const r = this.r;
    for (const side of [1, 2]) {
      const controls = CONTROLS[side - 1];
      if (r.scene === '1ckl' && Number(r.globals.get(controls.character)) === ECOLA_ID)
        r.originals.get(controls.previewWeapon).visible = false;
      const state = this.state(side);
      if (!state) continue;
      const hero = r.originals.get(controls.hero), profile = r.originals.get(controls.profile);
      // The player badge would immediately give away the original during fission.
      const marker = r.originals.get(controls.marker);
      if (marker) marker.ecolaHidden = !!state.fissionUntil;
      const picture = 'ecola-' + state.form;
      r.setPicture(hero, 'ecola-base');
      r.setSize(hero, BODY_SIZE);
      if (profile) r.setPicture(profile, picture);
      this.pose(hero, state, state.fireAt, state.hitAt);
      hero.ecolaPose.picture = r.pictureFrom(hero.def, picture);
      for (const fake of this.decoys(side)) {
        r.setPicture(fake, picture);
        this.moveDecoy(side, fake, FORMS[state.form]);
        fake.scaleX = Math.abs(fake.scaleX) * fake.decoy.direction;
        fake.visible = hero.visible;
        this.pose(fake, state, fake.decoy.firedAt, fake.decoy.hitAt, fake.decoy.order * 9);
      }
    }
  }
}
