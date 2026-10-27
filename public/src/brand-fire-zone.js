// Brand's second skill. All gameplay sizes use Entry's 480 x 270 stage units.
export const FIRE_ZONE = Object.freeze({
  durationTicks: 300, radius: 90, intervalTicks: 60, damage: 5,
  slow: 8, manaCost: 32, cooldownTicks: 480, castTicks: 12,
});
const AREA_PICTURE = "brand-fire-zone-area";
export const brandFireZone = {
  character: 1, name: "화염지대", manaCost: FIRE_ZONE.manaCost, cooldownTicks: FIRE_ZONE.cooldownTicks,
  description: "자신의 주변에 5초간 유지되는 넓은 화염지대를 설치합니다. 영역 안의 적은 1초마다 5의 피해를 입고 이동속도가 느려집니다.",
  prepare(project) {
    for (const [id, text] of [["x7mx", this.name], ["gsve", this.description]]) {
      const item = project.variables.find(v => v.id === id)?.array?.[0];
      if (item) item.data = text;
    }
    const icon = project.objects.find(o => o.id === "o9rj")?.sprite.pictures[0];
    if (icon) icon.fileurl = "assets/secondary/brand-fire-zone-icon.svg";
    const pictures = project.objects.find(o => o.id === "hb4u")?.sprite.pictures;
    if (pictures && !pictures.some(p => p.id === AREA_PICTURE)) pictures.push({
      id: AREA_PICTURE, name: "화염지대", fileurl: "assets/secondary/brand-fire-zone.svg",
      dimension: { width: 200, height: 200 },
    });
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
    // A visual-only entity reuses the original effect object's rendering path.
    // Do not dispatch its original clone scripts (those belong to another attack).
    const area = r.makeEntity(r.defs.get("hb4u"));
    area.clone = true; area.combatSide = side; area.secondaryEffect = "brand-fire-zone";
    r.setPicture(area, AREA_PICTURE);
    Object.assign(area, { x: z.x, y: z.y, regX: 100, regY: 100,
      rotation: 0, direction: 90, scaleX: config.radius / 100, scaleY: config.radius / 100, visible: true });
    // Put the area behind fighters and in front of the existing map/background.
    const back = r.entities.findIndex(e => ["00h9", "n8fg"].includes(e.objectId));
    r.entities.splice(back < 0 ? r.entities.length : back + 1, 0, area);
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
          area.effects.transparency = elapsed < 282 ? 2 + 3 * Math.sin(elapsed * Math.PI / 15) : (elapsed - 282) / 18 * 100;
          yield 1;
        }
      } finally {
        area.dead = true;
        if (state.zone === z) delete state.zone;
      }
    }, "secondary_skill_effect");
    // Only the short placement motion locks the caster; the installed area is independent.
    yield config.castTicks;
  },
};
