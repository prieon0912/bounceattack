// Brand's second skill. All gameplay sizes use Entry's 480 x 270 stage units.
export const FIRE_ZONE = Object.freeze({
  durationTicks: 300, radius: 100, intervalTicks: 60, damage: 5,
  slow: 8, manaCost: 37, cooldownTicks: 300, castTicks: 12, expandTicks: 24, initialSize: 20,
});
export const brandFireZone = {
  character: 1, name: "화염지대", manaCost: FIRE_ZONE.manaCost, cooldownTicks: FIRE_ZONE.cooldownTicks,
  lockVariable: false, // Brand uses the legacy skill variable as a clone mode, not a busy flag.
  primaryPictureId: "lexo", secondaryPictureId: "brand-secondary-icon",
  primaryName: "폭발표식",
  primaryDescription: "적의 위치에 표식을 남기고 0.8초 뒤 표식 위치에서 폭발이 일어납니다.",
  primaryIcon: "assets/temp/1e/2e/image/1e2e8c27mvpihd8500064431d38w0i4x.svg",
  icon: "assets/secondary/brand-fire-zone-icon.svg",
  description: "다음 일반 공격이 맞거나 폭발한 자리에 5초간 적에게 피해와 둔화를 주는 화염지대를 설치합니다.",
  prepare(project) {
    const name = project.variables.find(v => v.id === "x7mx")?.array?.[0];
    const description = project.variables.find(v => v.id === "gsve")?.array?.[0];
    if (name) name.data = this.primaryName;
    if (description) description.data = this.primaryDescription;
    const pictures = project.objects.find(o => o.id === "o9rj")?.sprite.pictures;
    if (pictures) {
      pictures[0].fileurl = this.primaryIcon;
      if (!pictures.some(p => p.id === "brand-secondary-icon"))
        pictures.push({ ...structuredClone(pictures[0]), id: "brand-secondary-icon", name: this.name, fileurl: this.icon });
    }
  },
  slowValue(r, e, id, raw, state, side) {
    const targetSide = side === 1 ? 2 : 1;
    if (e.objectId !== (targetSide === 1 ? "00h9" : "n8fg") ||
        id !== (targetSide === 1 ? "9af4" : "nccn")) return raw;
    if (r.num(r.globals.get(targetSide === 1 ? "ob2m" : "rav6")) !== 0) return raw;
    const inside = (state.zones || (state.zone ? [state.zone] : [])).some(z =>
      r.tick < z.endsAt && Math.hypot(e.x - z.x, e.y - z.y) <= z.radius);
    return inside
      ? Math.max(r.num(raw), FIRE_ZONE.slow) : raw;
  },
  canCast(r, side) {
    const state = r.secondarySkills.state(side);
    return !state.armed && !state.pendingShot && !state.zone && !(state.zones?.length);
  },
  *cast(r, c, { state }) {
    state.armed = true;
    yield FIRE_ZONE.castTicks;
  },
  onClone(r, c, child, side, state) {
    const object = side === 1 ? "m9km" : "iaqy", block = side === 1 ? "jntz" : "qrc5";
    if (!state.armed || c.e.objectId !== object || c.e.clone || c.block !== block) return;
    state.armed = false;
    state.pendingShot = child.uid;
    child.fireZoneOwner = side;
  },
  onCommand(r, c, type, args, side, state) {
    const shape = side === 1 ? "1v1m" : "x49z";
    if (c.e.fireZoneOwner !== side || state.pendingShot !== c.e.uid ||
        type !== "change_to_some_shape" || args[0] !== shape) return;
    delete c.e.fireZoneOwner;
    delete state.pendingShot;
    this.install(r, c, { side, state }, { x: c.e.x, y: c.e.y });
  },
  install(r, c, { side, state }, point) {
    const target = r.originals.get(side === 1 ? "n8fg" : "00h9");
    const config = FIRE_ZONE;
    const z = { x: point.x, y: point.y, radius: config.initialSize / 2, startsAt: r.tick, endsAt: r.tick + config.durationTicks };
    state.readyAt = z.endsAt;
    state.zone = z;
    (state.zones ??= []).push(z);
    // Reuse only original Brand drawings, on visual-only entities with no original clone scripts.
    const effectDef = r.defs.get("hb4u");
    const originalFlames = r.defs.get(side === 1 ? "m9km" : "iaqy").sprite.pictures;
    const visuals = [];
    const addVisual = (picture, x, y, size, transparency) => {
      const e = r.makeEntity(effectDef);
      e.clone = true; e.combatSide = side; e.secondaryEffect = "brand-fire-zone";
      Object.assign(e, { picture, width: picture.dimension.width, height: picture.dimension.height,
        regX: picture.dimension.width / 2, regY: picture.dimension.height / 2,
        x, y, rotation: 0, direction: 90, scaleX: 1, scaleY: 1, visible: true });
      r.setSize(e, size); e.effects.transparency = transparency;
      const back = r.entities.findIndex(body => ["00h9", "n8fg"].includes(body.objectId));
      r.entities.splice(back < 0 ? r.entities.length : back + 1, 0, e);
      visuals.push(e);
      return e;
    };
    // The original circular explosion drawing forms a faint filled boundary (no new ring).
    const area = addVisual(originalFlames[3], z.x, z.y, config.initialSize, 30);
    r.spawn(area, function*(runtime, effectContext) {
      try {
        while (runtime.tick <= z.endsAt) {
          const elapsed = runtime.tick - z.startsAt;
          if (Number(runtime.globals.get("r71b")) !== 0) break;
          // Same 0.9 easing as the original fireball explosion, reaching full size
          // in 0.4 seconds. Slow/collision radius follows the visible boundary.
          const progress = elapsed >= config.expandTicks ? 1 :
            (1 - Math.pow(.9, elapsed)) / (1 - Math.pow(.9, config.expandTicks));
          const size = config.initialSize + (config.radius * 2 - config.initialSize) * progress;
          runtime.setSize(area, size);
          z.radius = size / 2;
          if (elapsed > 0 && elapsed % config.intervalTicks === 0 && !target.dead &&
              runtime.num(runtime.globals.get(side === 1 ? "rav6" : "ob2m")) === 0 &&
              Math.hypot(target.x - z.x, target.y - z.y) <= config.radius &&
              runtime.num(runtime.globals.get(side === 1 ? "7ir2" : "akf6")) > 0) {
            // Original damage functions preserve shields, mitigation and on-hit interactions.
            yield* runtime.call(effectContext, side === 1 ? "qy83" : "05j0", [-config.damage, 0, 3]);
          }
          if (elapsed === config.durationTicks) break;
          const fade = elapsed < 282 ? 0 : (elapsed - 282) / 18;
          area.effects.transparency = 30 + fade * 70;
          yield 1;
        }
      } finally {
        for (const e of visuals) e.dead = true;
        state.zones = (state.zones || []).filter(zone => zone !== z);
        if (state.zone === z) {
          if (state.zones.length) state.zone = state.zones[state.zones.length - 1];
          else delete state.zone;
        }
        if (!state.zones.length) delete state.zones;
      }
    }, "secondary_skill_effect");
  },
};
