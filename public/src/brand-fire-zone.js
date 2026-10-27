// Brand's second skill. All gameplay sizes use Entry's 480 x 270 stage units.
export const FIRE_ZONE = Object.freeze({
  durationTicks: 300, radius: 110, intervalTicks: 60, damage: 5,
  slow: 8, manaCost: 32, cooldownTicks: 480, castTicks: 12,
});
export const brandFireZone = {
  character: 1, name: "화염지대", manaCost: FIRE_ZONE.manaCost, cooldownTicks: FIRE_ZONE.cooldownTicks,
  lockVariable: false, // Brand uses the legacy skill variable as a clone mode, not a busy flag.
  primaryName: "폭발표식",
  primaryDescription: "적의 위치에 표식을 남기고 몇초뒤 표식 위치에서 폭발이 일어납니다.",
  primaryIcon: "assets/temp/1e/2e/image/1e2e8c27mvpihd8500064431d38w0i4x.svg",
  icon: "assets/secondary/brand-fire-zone-icon.svg",
  description: "자신의 자리에 몇 초간 적에게 피해와 둔화를 주는 화염지대를 설치합니다.",
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
    const z = state.zone;
    return z && r.tick < z.endsAt && Math.hypot(e.x - z.x, e.y - z.y) <= z.radius
      ? Math.max(r.num(raw), FIRE_ZONE.slow) : raw;
  },
  *cast(r, c, { side, caster, target, state }) {
    const config = FIRE_ZONE;
    const z = { x: caster.x, y: caster.y, radius: config.radius, startsAt: r.tick, endsAt: r.tick + config.durationTicks };
    state.zone = z;
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
    const area = addVisual(originalFlames[3], z.x, z.y, config.radius * 2, 75);
    r.spawn(area, function*(runtime, effectContext) {
      try {
        while (runtime.tick <= z.endsAt) {
          const elapsed = runtime.tick - z.startsAt;
          if (Number(runtime.globals.get("r71b")) !== 0) break;
          if (elapsed > 0 && elapsed % config.intervalTicks === 0 && !target.dead &&
              Math.hypot(target.x - z.x, target.y - z.y) <= config.radius &&
              runtime.num(runtime.globals.get(side === 1 ? "7ir2" : "akf6")) > 0) {
            // Original damage functions preserve shields, mitigation and on-hit interactions.
            yield* runtime.call(effectContext, side === 1 ? "qy83" : "05j0", [-config.damage, 0, 3]);
          }
          if (elapsed === config.durationTicks) break;
          const fade = elapsed < 282 ? 0 : (elapsed - 282) / 18;
          area.effects.transparency = 75 + fade * 25;
          yield 1;
        }
      } finally {
        for (const e of visuals) e.dead = true;
        if (state.zone === z) delete state.zone;
      }
    }, "secondary_skill_effect");
    // Only the short placement motion locks the caster; the installed area is independent.
    yield config.castTicks;
  },
};
