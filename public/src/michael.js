import { damageInstallationsInRadius, projectileInstallationContact } from './barricade.js';

export const MICHAEL_ID = 36;
const SPORTS = ['basketball', 'football', 'baseball'];
const BALL = {
  basketball: { size: 12, gravity: .19, bounce: .86, life: 112 },
  football: { size: 9, gravity: .025, bounce: .91, life: 100 },
  baseball: { size: 6, gravity: .14, bounce: .73, life: 102 },
};
const CONTROLS = [
  { character: 'y75t', body: '00h9', hero: 'n230', mana: 'qn98', facing: 'etjn', attack: 69, skill: 82, ultimate: 83, preview: 'j5y7', weapon: '31us' },
  { character: 's5vb', body: 'n8fg', hero: 'ocqj', mana: 'thom', facing: '846x', attack: 13, skill: 80, ultimate: 40, preview: 'zyy3', weapon: 'mimn' },
];
const data = side => CONTROLS[side - 1];
export const michaelDefense = {
  character: MICHAEL_ID, name: '수비 전술', manaCost: 24, cooldownTicks: 0, lockVariable: false,
  icon: 'assets/michael/defense.svg', secondaryPictureId: 'michael-defense',
  primaryName: '공격 전술', primaryDescription: '레이업, 감아차기, 토스 배팅 중 현재 종목의 기술을 사용합니다.',
  description: '스텝백, 트래핑, 받아치기 중 현재 종목의 기술을 사용합니다.',
  prepare(project) {
    const pictures = project.objects.find(object => object.id === 'o9rj').sprite.pictures;
    const primary = pictures.find(picture => picture.id === 'michael-o9rj');
    if (!primary) return;
    this.primaryPictureId = primary.id;
    this.primaryIcon = primary.fileurl;
    if (!pictures.some(picture => picture.id === this.secondaryPictureId))
      pictures.push({ ...primary, id: this.secondaryPictureId, fileurl: this.icon });
  },
  canCast() { return false; },
  *cast() {},
};

export class MichaelSystem {
  constructor(runtime) { this.r = runtime; }

  active(side) {
    return this.r.scene === '7dwq' && Number(this.r.globals.get(data(side).character)) === MICHAEL_ID;
  }

  state(side) { return this.r.globals.get('michael:' + side); }
  body(side) { return this.r.originals.get(data(side).body); }
  facing(side) { return Number(this.r.globals.get(data(side).facing)) === 1 ? 1 : -1; }

  blocksKey(key) {
    return CONTROLS.some(({ attack, skill, ultimate }, index) =>
      this.active(index + 1) && [attack, skill, ultimate].includes(key));
  }

  spend(side, amount) {
    const id = data(side).mana;
    const mana = this.r.num(this.r.globals.get(id));
    if (mana < amount) return false;
    this.r.set(this.body(side), id, mana - amount);
    return true;
  }

  step() {
    const r = this.r;
    for (const side of [1, 2]) {
      if (!this.active(side)) continue;
      if (!this.state(side)) {
        r.globals.set('michael:' + side, {
          sport: SPORTS[Math.floor(r.random() * SPORTS.length)],
          attackAt: 0, skillAt: 0, ultimateAt: 0, swingAt: -100, guardUntil: 0,
        });
        continue;
      }
      const st = this.state(side), keys = data(side);
      const skill = r.keys.has(keys.skill), ultimate = r.keys.has(keys.ultimate);
      const skillEdge = skill && !st.skillDown, ultimateEdge = ultimate && !st.ultimateDown;
      st.skillDown = skill;
      st.ultimateDown = ultimate;
      if (!r.castle.alive(side) || r.castle.blocked(side)) continue;
      if (ultimateEdge && r.tick >= st.ultimateAt && this.spend(side, 62)) {
        st.ultimateAt = r.tick + 180;
        this.ultimate(side);
      } else if (skillEdge && r.tick >= st.skillAt && this.spend(side, 24)) {
        st.skillAt = r.tick + 60;
        this.skill(side, r.secondarySkills.state(side).mode === 'secondary');
      } else if (r.keys.has(keys.attack) && r.tick >= st.attackAt) {
        st.attackAt = r.tick + 32;
        this.basic(side);
      }
    }
  }

  visual(side, art, x, y, size, label) {
    const entity = this.r.castle.visual(side, art, x, y, size, label);
    delete entity.castleEffect;
    entity.michaelEffect = label;
    return entity;
  }

  afterStep() {
    const r = this.r;
    if (r.scene === '1ckl') {
      for (const keys of CONTROLS) {
        if (Number(r.globals.get(keys.character)) !== MICHAEL_ID) continue;
        const ball = r.originals.get(keys.preview), held = r.originals.get(keys.weapon);
        const direction = keys.attack === 69 ? 1 : -1;
        r.setPicture(held, 'michael-preview-' + keys.weapon);
        r.setSize(held, 23);
        Object.assign(held, { x: ball.x + direction * 19, y: ball.y - 6, rotation: 0, visible: ball.visible });
      }
      return;
    }
    for (const side of [1, 2]) {
      if (!this.active(side) || !this.state(side)) continue;
      const keys = data(side), st = this.state(side), player = this.body(side);
      const hero = r.originals.get(keys.hero);
      r.setPicture(hero, 'michael-' + keys.hero);
      r.setSize(hero, 16);
      const art = 'michael-' + (st.sport === 'baseball' ? 'bat' : st.sport);
      const held = r.entities.find(e => e.michaelEffect === 'held' && e.combatSide === side)
        || this.visual(side, art, player.x, player.y, st.sport === 'baseball' ? 14 : 10, 'held');
      const direction = this.facing(side), age = r.tick - st.swingAt;
      held.x = player.x + direction * 8;
      held.y = player.y - 2;
      held.scaleX = direction * Math.abs(held.scaleX);
      held.rotation = age < 12 ? direction * Math.sin(age / 12 * Math.PI) * 75 : 0;
      held.visible = hero.visible && r.castle.alive(side)
        && !r.num(r.globals.get(side === 1 ? 'ob2m' : 'rav6'));
    }
  }

  launch(side, vx, vy, damage, options = {}) {
    const player = this.body(side);
    return this.projectile(side, {
      ...BALL[this.state(side).sport], vx, vy, damage,
      art: 'michael-' + this.state(side).sport,
      x: player.x + Math.sign(vx) * 10, y: player.y + 4,
      ...options,
    });
  }

  terrain(e) { return this.r.reach(e, '6tzq') || this.r.reach(e, '2bx4'); }

  projectile(side, config) {
    const r = this.r;
    const e = this.visual(side, config.art, config.x, config.y, config.size, 'ball');
    const ball = e.michaelBall = { ...config, side };
    const radius = config.size / 2;
    e.x = Math.max(-240 + radius, Math.min(240 - radius, e.x));
    e.y = Math.min(135 - radius, e.y);
    // A shot fired alongside a platform starts at the nearest free point.
    if (this.terrain(e)) {
      for (const offset of [0, 4, 8, 12, 16]) {
        e.x = Math.max(-240 + radius, Math.min(240 - radius, this.body(side).x));
        e.y = Math.min(135 - radius, config.y + offset);
        if (!this.terrain(e)) break;
      }
      if (this.terrain(e)) { e.dead = true; return e; }
    }
    r.spawn(e, function* fly(rt, context) {
      try {
        for (let age = 0; age < ball.life && rt.castle.alive(ball.side) && rt.castle.alive(3 - ball.side); age++) {
          ball.vy = Math.max(-8, ball.vy - ball.gravity);
          const steps = Math.max(1, Math.ceil(Math.max(Math.abs(ball.vx), Math.abs(ball.vy)) / 2));
          for (let i = 0; i < steps; i++) {
            const x = e.x, y = e.y;
            e.x += ball.vx / steps;
            if (Math.abs(e.x) > 240 - radius || rt.michael.terrain(e)) {
              e.x = x;
              ball.vx *= -ball.bounce;
            }
            e.y += ball.vy / steps;
            if (e.y > 135 - radius || rt.michael.terrain(e)) {
              e.y = y;
              const falling = ball.vy < 0;
              ball.vy *= -ball.bounce;
              if (falling && ball.gravity >= .1 && ball.vy < 1) ball.vy = 1;
            }
            if (e.y < -135 - radius) return;
            if (projectileInstallationContact(rt, e)) {
              damageInstallationsInRadius(rt, ball.side, e, radius + 1, ball.damage);
              return;
            }
            const target = 3 - ball.side;
            const victim = rt.michael.body(target);
            if (Math.hypot(e.x - victim.x, e.y - victim.y) > radius + 8 || !rt.castle.canHit(ball.side)) continue;
            const st = rt.michael.state(ball.side);
            if (ball.volley && st?.lastVolleyHit?.id === ball.volley && st.lastVolleyHit.until > rt.tick) continue;
            if (rt.michael.intercept(e, target, ball.damage)) {
              if (e.dead) return;
              break;
            }
            if (ball.volley && st) {
              st.lastVolleyHit = { id: ball.volley, until: rt.tick + 18 };
            }
            yield* rt.call(context, ball.side === 1 ? 'qy83' : '05j0', [-ball.damage, 0, 1]);
            return;
          }
          e.rotation += ball.vx * 4;
          yield 1;
        }
      } finally { e.dead = true; }
    }, 'michael_ball');
    return e;
  }

  intercept(entity, side, damage) {
    const st = this.state(side), r = this.r;
    if (!this.active(side) || !st || st.guardUntil <= r.tick || r.castle.blocked(side)) return false;
    const ball = entity.michaelBall;
    const chessShot = entity.castleEffect === 'projectile';
    const native = entity.clone && entity.def.barricadeDamage &&
      r.threads.some(thread => thread.e === entity && !thread.cancelled && thread.event === 'when_clone_start');
    const owner = ball?.side ?? entity.combatSide ?? (native ? 3 - side : null);
    if ((!ball && !native && !chessShot) || owner !== 3 - side) return false;
    const player = this.body(side), direction = this.facing(side);
    if ((entity.x - player.x) * direction < -2) return false;
    st.guardUntil = 0;
    if (st.sport === 'football') {
      entity.dead = true;
      st.trapped = true;
    } else if (ball) {
      ball.side = side;
      ball.vx = direction * Math.max(4, Math.abs(ball.vx));
      ball.vy = Math.max(.5, ball.vy);
      ball.volley = null;
      entity.combatSide = side;
      entity.x = player.x + direction * (ball.size / 2 + 9);
    } else {
      entity.dead = true;
      this.launch(side, direction * 6, .8, damage, {
        art: entity.picture, size: Math.min(15, r.size(entity)),
      });
    }
    return true;
  }

  basic(side) {
    const st = this.state(side), direction = this.facing(side);
    st.swingAt = this.r.tick;
    if (st.sport === 'basketball') this.launch(side, direction * 3.5, -2.8, 5);
    else if (st.sport === 'football') {
      this.launch(side, direction * 6, 0, 5, { life: st.trapped ? 135 : 100 });
      st.trapped = false;
    } else {
      const r = this.r;
      r.spawn(this.body(side), function* swing(rt, context) {
        for (let age = 0; age < 6; age++) {
          const player = rt.michael.body(side), enemy = rt.michael.body(3 - side);
          const ahead = (enemy.x - player.x) * direction, height = enemy.y - player.y;
          if (ahead >= -3 && ahead <= 27 && height >= -10 && height <= 22 && rt.castle.canHit(side)) {
            yield* rt.call(context, side === 1 ? 'qy83' : '05j0', [-7, 0, 1]);
            return;
          }
          yield 1;
        }
      }, 'michael_swing');
    }
  }

  skill(side, defense) {
    const r = this.r, st = this.state(side), direction = this.facing(side);
    st.swingAt = r.tick;
    if (defense && st.sport !== 'basketball') {
      st.guardUntil = r.tick + 18;
      return;
    }
    if (st.sport === 'basketball') {
      if (defense) this.launch(side, direction * 1.6, -4, 4, { x: this.body(side).x });
      r.spawn(this.body(side), function* step(rt) {
        for (let age = 0; age < 6 && !rt.castle.blocked(side); age++) {
          rt.castle.move(side, defense ? -direction * 3 : 0, defense ? 0 : 2);
          yield 1;
        }
        if (!defense && !rt.castle.blocked(side)) rt.michael.launch(side, direction * 4, 4.5, 8);
      }, 'michael_step');
    } else if (st.sport === 'football') this.launch(side, direction * 5.1, 2.8, 8, { gravity: .09 });
    else this.launch(side, direction * 5.2, 3.8, 8);
  }

  ultimate(side) {
    const r = this.r, st = this.state(side), direction = this.facing(side);
    st.swingAt = r.tick;
    const volley = r.tick;
    const options = { volley, life: 150 };
    if (st.sport === 'basketball') {
      for (let i = 0; i < 5; i++) this.launch(side, direction * (2 + i * .95), -2 - i * .65, 4, options);
    } else if (st.sport === 'football') {
      r.spawn(this.body(side), function* volleys(rt) {
        for (const height of [-1.6, 0, 1.6]) {
          if (!rt.castle.alive(side) || rt.castle.blocked(side)) return;
          for (const offset of [-.32, .32])
            rt.michael.launch(side, direction * 6.5, height + offset, 4, options);
          if (height < 1.6) yield 5;
        }
      }, 'michael_volleys');
    } else {
      for (let i = 0; i < 7; i++) {
        const angle = (-25 + i * 16) * Math.PI / 180;
        this.launch(side, direction * Math.cos(angle) * 6, Math.sin(angle) * 6, 4, options);
      }
    }
  }
}
