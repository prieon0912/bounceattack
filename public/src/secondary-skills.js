// Add future character skills here: { character, manaCost, cooldownTicks, *cast(r, c, context) }.
import { brandFireZone } from "./brand-fire-zone.js";
export const SECONDARY_SKILLS = [brandFireZone];
export function prepareSecondarySkills(project, definitions = SECONDARY_SKILLS) {
  for (const definition of definitions) definition.prepare?.(project);
}
const PREFIX = "secondary-skill:";
const SIDES = {
  1: { key: 82, character: "y75t", body: "00h9", foe: "n8fg", mana: "qn98", hp: "akf6", stun: "8w41", busy: "rr24" },
  2: { key: 80, character: "s5vb", body: "n8fg", foe: "00h9", mana: "thom", hp: "7ir2", stun: "wyyq", busy: "qvkr" },
};
export class SecondarySkillSystem {
  constructor(runtime, definitions = SECONDARY_SKILLS) {
    this.runtime = runtime;
    this.definitions = new Map();
    for (const definition of definitions) {
      const { character, manaCost = 0, cooldownTicks = 0, cast } = definition;
      if (!Number.isInteger(character) || character < 1 || character > 34 ||
          this.definitions.has(character) || !Number.isFinite(manaCost) || manaCost < 0 ||
          !Number.isInteger(cooldownTicks) || cooldownTicks < 0 || typeof cast !== "function")
        throw Error("Invalid secondary skill definition");
      this.definitions.set(character, Object.freeze({ ...definition, manaCost, cooldownTicks }));
    }
  }
  reset() {
    for (const key of this.runtime.globals.keys())
      if (String(key).startsWith(PREFIX)) this.runtime.globals.delete(key);
  }
  definition(side) {
    return this.definitions.get(Number(this.runtime.globals.get(SIDES[side]?.character)));
  }
  slowValue(e, id, raw) {
    let value = raw;
    for (const side of [1, 2]) {
      const definition = this.definition(side);
      if (definition?.slowValue)
        value = definition.slowValue(this.runtime, e, id, value, this.state(side), side);
    }
    return value;
  }
  state(side) {
    if (!SIDES[side]) throw Error("Invalid player side");
    return this.runtime.globals.get(PREFIX + side) ?? { mode: "primary", pressed: false, active: false, readyAt: 0 };
  }
  // Used by the original block interpreter, so primary and secondary never fire together.
  replacesKey(key) {
    if (this.runtime.scene !== "7dwq") return false;
    const side = key === 82 ? 1 : key === 80 ? 2 : null;
    return side !== null && !!this.definition(side);
  }
  step() {
    const r = this.runtime;
    if (r.scene !== "7dwq") return;
    for (const side of [1, 2]) {
      const definition = this.definition(side);
      if (!definition) continue;
      const ids = SIDES[side], state = this.state(side), pressed = r.keys.has(ids.key);
      r.globals.set(PREFIX + side, state);
      const trigger = pressed && !state.pressed;
      state.pressed = pressed;
      const body = r.originals.get(ids.body);
      if (!trigger || state.active || r.tick < state.readyAt || !body || body.dead ||
          !body.visible || Number(r.globals.get(ids.hp)) <= 0 || Number(r.globals.get("r71b")) !== 0 ||
          Number(r.globals.get(ids.stun)) !== 0 || Number(r.globals.get(ids.busy)) !== 0 ||
          Number(r.globals.get(ids.mana)) < definition.manaCost) continue;
      state.mode = "secondary";
      state.active = true;
      state.readyAt = r.tick + definition.cooldownTicks;
      r.globals.set(ids.mana, r.num(r.globals.get(ids.mana)) - definition.manaCost);
      r.globals.set(ids.busy, 1);
      r.spawn(body, function*(runtime, c) {
        try {
          // Use runtime ticks/yields and seeded runtime.random for deterministic online play.
          const effect = definition.cast(runtime, c, {
            side, character: Number(runtime.globals.get(ids.character)),
            caster: body, target: runtime.originals.get(ids.foe), state,
          });
          if (!effect || typeof effect.next !== "function") throw Error("Secondary skill cast must be a generator");
          yield* effect;
        } finally {
          state.active = false;
          // Do not release a lock owned by another action.
          if (Number(runtime.globals.get(ids.busy)) === 1) runtime.globals.set(ids.busy, 0);
        }
      }, "secondary_skill");
    }
  }
}
