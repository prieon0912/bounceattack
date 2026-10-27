// Brand's second skill. All gameplay sizes use Entry's 480 x 270 stage units.
export const FIRE_ZONE = Object.freeze({
  durationTicks: 300, radius: 90, intervalTicks: 60, damage: 5,
  slow: 8, manaCost: 32, cooldownTicks: 480, castTicks: 12,
});
export const brandFireZone = {
  character: 1, name: "화염지대", manaCost: FIRE_ZONE.manaCost, cooldownTicks: FIRE_ZONE.cooldownTicks,
  lockVariable: false, // Brand uses the legacy skill variable as a clone mode, not a busy flag.
  primaryName: "폭발표식",
  primaryDescription: "적의 위치에 표식을 남기고 몇초뒤 표식 위치에서 폭발이 일어납니다.",
  primaryIcon: "assets/temp/1e/2e/image/1e2e8c27mvpihd8500064431d38w0i4x.svg",
  icon: "assets/secondary/brand-fire-zone-icon.svg",
  description: "5초간 화염지대 설치. 영역 내 적에게 1초마다 5 피해와 둔화를 줍니다.",
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
    const area = addVisual(originalFlames[3], z.x, z.y, config.radius * 2, 85);
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI * 2 / 12;
      addVisual(originalFlames[0], z.x + Math.cos(angle) * 68, z.y + Math.sin(angle) * 68, 16, 12);
    }
    for (const [x, y] of [[0, 0], [-26, -24], [26, -24], [-26, 24], [26, 24]])
      addVisual(originalFlames[0], z.x + x, z.y + y, 17, 12);
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
          area.effects.transparency = 85 + fade * 15;
          for (let i = 1; i < visuals.length; i++) {
            const flame = visuals[i];
            const picture = originalFlames[Math.floor((elapsed + i * 3) / 9) % 3];
            flame.picture = picture;
            flame.width = picture.dimension.width; flame.height = picture.dimension.height;
            flame.regX = flame.width / 2; flame.regY = flame.height / 2;
            flame.scaleX = flame.scaleY = 1;
            runtime.setSize(flame, 16 + 2 * Math.sin((elapsed + i * 4) / 7));
            flame.effects.transparency = 12 + fade * 88;
          }
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
