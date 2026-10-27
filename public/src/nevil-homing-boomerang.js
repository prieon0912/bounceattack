// Original Nevil basic: size 20, contact radius 18, 70 outbound ticks,
// velocity 7 / 1.3 with 0.1 deceleration, and one 8-damage hit per leg.
export const HOMING_BOOMERANG = Object.freeze({
  manaCost: 24, damage: 8, size: 20, hitRadius: 18, outboundTicks: 70,
  initialSpeed: 7, acceleration: 0.1, speedDivisor: 1.3, catchRadius: 18,
});
export const nevilHomingBoomerang = {
  character: 3, name: "추적 부메랑", manaCost: HOMING_BOOMERANG.manaCost, cooldownTicks: 0, lockVariable: false,
  primaryName: "3환 부메랑", primaryDescription: "부메랑 3개를 던집니다.",
  primaryIcon: "assets/temp/2e/8c/image/2e8c27c5mvpihd8500064431d38w1lae.svg",
  icon: "assets/secondary/nevil-homing-boomerang-icon.svg",
  primaryPictureId: "pcgv", secondaryPictureId: "nevil-secondary-icon",
  description: "적을 추적하는 부메랑을 던집니다.",
  prepare(project) {
    const pictures = project.objects.find(o => o.id === "o9rj")?.sprite.pictures;
    if (pictures && !pictures.some(p => p.id === this.secondaryPictureId))
      pictures.push({ ...structuredClone(pictures[2]), id: this.secondaryPictureId, name: this.name, fileurl: this.icon });
  },
  canCast(r, side) { return r.num(r.globals.get(side === 1 ? "7a8q" : "97v8")) === 0; },
  *cast(r, c, { side, caster, target, state }) {
    const config = HOMING_BOOMERANG, returningCount = side === 1 ? "7a8q" : "97v8";
    const stealth = side === 1 ? "rav6" : "ob2m";
    const original = r.defs.get(side === 1 ? "gsfk" : "7fy6");
    // Reuse the original projectile picture and sounds without running its old clone scripts.
    const projectile = r.makeEntity({ ...r.defs.get("hb4u"), sprite: original.sprite });
    const picture = original.sprite.pictures[2];
    Object.assign(projectile, { clone: true, combatSide: side, secondaryEffect: "nevil-homing-boomerang",
      picture, width: picture.dimension.width, height: picture.dimension.height,
      regX: picture.dimension.width / 2, regY: picture.dimension.height / 2,
      x: caster.x, y: caster.y, rotation: 0, direction: 90, scaleX: 1, scaleY: 1, visible: true });
    r.setSize(projectile, config.size); r.entities.unshift(projectile);
    const flight = { phase: "outbound", returnTarget: null };
    state.boomerang = flight;
    r.globals.set(returningCount, 1);
    const unit = (x, y) => { const length = Math.hypot(x, y); return length > 1e-9 ? [x / length, y / length] : [0, 0]; };
    const initial = unit(target.x - projectile.x, target.y - projectile.y);
    r.move(projectile, initial[0] * 10, initial[1] * 10);
    // The visual entity is the hit source so original damage / shields / sound effects remain intact.
    const hitContext = { ...c, e: projectile };
    const hit = function*(runtime) {
      if (r.num(r.globals.get(stealth)) !== 0) return false;
      if (Math.hypot(target.x - projectile.x, target.y - projectile.y) > config.hitRadius) return false;
      yield* runtime.call(hitContext, side === 1 ? "qy83" : "05j0", [-config.damage, 7, 0]);
      runtime.play(projectile, side === 1 ? "y1ft" : "6cp3");
      return true;
    };
    try {
      r.play(projectile, side === 1 ? "sg5x" : "6p9l");
      let hitOutbound = false;
      for (let tick = 0; tick < config.outboundTicks; tick++) {
        if (target.dead || Number(r.globals.get("r71b")) !== 0) return;
        const speed = Math.max(0, config.initialSpeed - config.acceleration * tick);
        const [dx, dy] = unit(target.x - projectile.x, target.y - projectile.y);
        const distance = Math.min(speed / config.speedDivisor, Math.hypot(target.x - projectile.x, target.y - projectile.y));
        r.move(projectile, dx * distance, dy * distance);
        r.rotate(projectile, projectile.rotation + speed * 4);
        if (!hitOutbound) hitOutbound = yield* hit(r);
        yield 1;
      }
      // Original basic return: re-aim at the caster every tick, accelerate after
      // moving, and finish when within the original 18-unit catch distance.
      flight.phase = "return";
      r.play(projectile, side === 1 ? "ctma" : "xhhz");
      let speed = Math.max(0, config.initialSpeed - config.acceleration * config.outboundTicks);
      let hitReturn = false;
      while (Math.hypot(caster.x - projectile.x, caster.y - projectile.y) > config.catchRadius) {
        if (Number(r.globals.get("r71b")) !== 0) return;
        flight.returnTarget = { x: caster.x, y: caster.y };
        const [dx, dy] = unit(caster.x - projectile.x, caster.y - projectile.y);
        r.move(projectile, dx * speed / config.speedDivisor, dy * speed / config.speedDivisor);
        speed += config.acceleration;
        r.rotate(projectile, projectile.rotation - speed * 4);
        if (!hitReturn) hitReturn = yield* hit(r);
        yield 1;
      }
    } finally {
      projectile.dead = true;
      r.globals.set(returningCount, Math.max(0, r.num(r.globals.get(returningCount)) - 1));
      if (state.boomerang === flight) delete state.boomerang;
    }
  },
};
