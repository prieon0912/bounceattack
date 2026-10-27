// Stage units and tick timing match the original Entry game (60 ticks/second).
export const HEALING_POTION = Object.freeze({ manaCost: 43, radius: 40, expandTicks: 18, durationTicks: 180, intervalTicks: 60, healing: 2 });
export const SWORD_WAVE = Object.freeze({ manaCost: 30, charges: 3, damage: 3, speed: 4, durationTicks: 35 });
export const BARRAGE = Object.freeze({ manaCost: 56, durationTicks: 180, offset: 3 });
const bodyId = side => side === 1 ? "00h9" : "n8fg";
const prepare = function(project) {
  const icons = project.objects.find(o => o.id === "o9rj").sprite.pictures;
  const base = icons[this.character - 1];
  this.primaryPictureId = base.id;
  this.primaryIcon = base.fileurl;
  this.primaryName = project.variables.find(v => v.id === "x7mx").array[this.character - 1].data;
  this.primaryDescription = project.variables.find(v => v.id === "gsve").array[this.character - 1].data;
  for (const [id, fileurl, dimension] of [
    [this.secondaryPictureId, this.icon, base.dimension],
    ...(this.effectPictures || []),
  ]) if (!icons.some(p => p.id === id)) icons.push({ ...structuredClone(base), id, name: id, fileurl, dimension });
};
function visual(r, side, pictureId, x, y, size, label) {
  const picture = r.defs.get("o9rj").sprite.pictures.find(p => p.id === pictureId);
  const e = r.makeEntity(r.defs.get("hb4u"));
  Object.assign(e, { clone: true, combatSide: side, secondaryEffect: label, picture,
    width: picture.dimension.width, height: picture.dimension.height,
    regX: picture.dimension.width / 2, regY: picture.dimension.height / 2,
    x, y, rotation: 0, direction: 90, scaleX: 1, scaleY: 1, visible: true });
  r.setSize(e, size); r.entities.unshift(e); return e;
}
export const smokeHealingPotion = {
  character: 16, name: "치유 포션", manaCost: HEALING_POTION.manaCost, cooldownTicks: 0, lockVariable: false,
  icon: "assets/secondary/smoke-healing-icon.svg", secondaryPictureId: "smoke-healing-icon", prepare,
  description: "자신의 자리에 치유 포션을 설치합니다. 영역 안에 있으면 3초간 초당 HP를 2 회복합니다.",
  effectPictures: [["smoke-healing-area", "assets/secondary/smoke-healing-area.svg", { width: 100, height: 100 }]],
  *cast(r, c, { side, caster, state }) {
    const cfg = HEALING_POTION, x = caster.x, y = caster.y;
    const area = visual(r, side, "smoke-healing-area", x, y, 2, "smoke-healing-area");
    const hp = side === 1 ? "akf6" : "7ir2", max = side === 1 ? "xr74" : "67ko";
    state.healingArea = { x, y, endsAt: r.tick + cfg.durationTicks };
    try {
      for (let tick = 1; tick <= cfg.durationTicks; tick++) {
        yield 1;
        if (Number(r.globals.get("r71b")) !== 0 || caster.dead || r.num(r.globals.get(hp)) <= 0) break;
        // Expand smoothly from the cast position; the healing window stays three seconds.
        const progress = tick >= cfg.expandTicks ? 1 :
          (1 - Math.pow(.85, tick)) / (1 - Math.pow(.85, cfg.expandTicks));
        r.setSize(area, 2 + (cfg.radius * 2 - 2) * progress);
        if (tick % cfg.intervalTicks === 0 && Math.hypot(caster.x - x, caster.y - y) <= cfg.radius) {
          const healed = Math.max(0, Math.min(cfg.healing, r.num(r.globals.get(max)) - r.num(r.globals.get(hp))));
          // Original healing path also feeds the existing green floating recovery text.
          if (healed > 0) yield* r.call(c, side === 1 ? "albn" : "41z4", [healed]);
        }
        area.effects.transparency = tick > 160 ? (tick - 160) * 5 : 0;
      }
    } finally { area.dead = true; delete state.healingArea; }
  },
};
export const atlenSwordWave = {
  character: 7, name: "검기", manaCost: SWORD_WAVE.manaCost, cooldownTicks: 0, lockVariable: false,
  icon: "assets/secondary/atlen-sword-wave-icon.svg", secondaryPictureId: "atlen-sword-wave-icon", prepare,
  description: "다음 3회의 일반 공격에 전방으로 날아가 피해를 3 주는 검기가 추가됩니다.",
  effectPictures: [["atlen-sword-wave", "assets/secondary/atlen-sword-wave.svg", { width: 24, height: 44 }],
    ["atlen-sword-wind", "assets/secondary/atlen-sword-wind.svg", { width: 48, height: 44 }]],
  canCast(r, side) { return !(r.secondarySkills.state(side).charges > 0); },
  *cast(r, c, { state }) { state.charges = SWORD_WAVE.charges; },
  onCommand(r, c, type, args, side, state) {
    if (c.e.objectId !== (side === 1 ? "0j72" : "3uq6") || c.e.clone ||
        type !== "set_variable" || !["1txk", "e7u6"].includes(c.block) || !(state.charges > 0)) return;
    if (r.num(r.globals.get(side === 1 ? "ob2m" : "rav6")) !== 0) return;
    state.charges--;
    const caster = r.originals.get(bodyId(side)), target = r.originals.get(bodyId(side === 1 ? 2 : 1));
    const direction = r.num(r.globals.get(side === 1 ? "etjn" : "846x")) === 1 ? 1 : -1;
    const wave = visual(r, side, "atlen-sword-wave", caster.x + direction * 12, caster.y + 6, 34, "atlen-sword-wave");
    wave.scaleX = direction;
    // Visual-only wind trails behind the damaging arc, mirrored with its direction.
    const wind = visual(r, side, "atlen-sword-wind", wave.x - direction * 25, wave.y, 46, "atlen-sword-wind");
    wind.scaleX = direction; wind.effects.transparency = 100;
    r.spawn(wave, function*(runtime, context) {
      try {
        for (let tick = 0; tick < SWORD_WAVE.durationTicks; tick++) {
          if (Number(runtime.globals.get("r71b")) !== 0) return;
          runtime.move(wave, direction * SWORD_WAVE.speed, 0);
          wind.x = wave.x - direction * 25; wind.y = wave.y;
          const opacity = Math.min(1, (tick + 1) / 4, (SWORD_WAVE.durationTicks - tick) / 6);
          wind.effects.transparency = 100 - opacity * 55;
          // Swept horizontal margin prevents tunnelling; the arc extends above the wielder.
          if (!target.dead && runtime.num(runtime.globals.get(side === 1 ? "ob2m" : "rav6")) === 0 &&
              runtime.num(runtime.globals.get(side === 1 ? "rav6" : "ob2m")) === 0 &&
              Math.abs(target.x - wave.x) <= 12 && Math.abs(target.y - wave.y) <= 22) {
            yield* runtime.call(context, side === 1 ? "qy83" : "05j0", [-SWORD_WAVE.damage, 0, 1]); return;
          }
          if (Math.abs(wave.x) > 255) return;
          yield 1;
        }
      } finally { wave.dead = wind.dead = true; }
    }, "secondary_skill_effect");
  },
};
export const brookeBarrage = {
  character: 10, name: "탄막", manaCost: BARRAGE.manaCost, cooldownTicks: 0, lockVariable: false,
  icon: "assets/secondary/brooke-barrage-icon.svg", secondaryPictureId: "brooke-barrage-icon", prepare,
  description: "3초간 일반 공격의 총알을 위아래로 2개씩 동시에 발사합니다.",
  *cast(r, c, { state }) { state.barrageEndsAt = r.tick + BARRAGE.durationTicks; yield BARRAGE.durationTicks; },
  onClone(r, c, child, side, state) {
    if (r.tick >= (state.barrageEndsAt || 0) || c.e.clone || c.block !== "qptm" ||
        c.e.objectId !== (side === 1 ? "5h1u" : "xcmn")) return;
    // Both rounds retain original art, recoil spread, range, damage and hit scripts.
    child.barrageOffset = BARRAGE.offset;
    const second = r.makeEntity(child.def, child); second.barrageOffset = -BARRAGE.offset;
    r.entities.splice(r.entities.indexOf(child) + 1, 0, second);
    r.dispatchEntity(second, "when_clone_start");
  },
  onCommand(r, c, type, args, side) {
    if (c.e.objectId !== (side === 1 ? "5h1u" : "xcmn")) return;
    if (c.e.clone && c.e.barrageOffset && type === "move_y" && c.block === "dvo1")
      args[0] = r.num(args[0]) + c.e.barrageOffset;
  },
};
