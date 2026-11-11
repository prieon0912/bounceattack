import { THORN_ID } from './thorn.js';
import { phageEvolution, bananaReturn, thornSpin } from './duo.js';
import { ecolaFission } from './ecola.js';
import { michaelDefense } from './michael.js';
import { harlanStopgap } from './harlan-stopgap.js';
import { princeRoyalFlag } from './prince-flag.js';
import { stenBarricade } from './barricade.js';
import { STRATEGIC_SECONDARY_SKILLS } from './strategic-secondary-skills.js';
import { TACTICAL_SECONDARY_SKILLS } from './tactical-secondary-skills.js';
import { castleCastling } from './castle.js';
import { NEW_SECONDARY_SKILLS, restorePresentation } from './expanded-secondary-skills.js';
// Add future character skills here: { character, manaCost, cooldownTicks, *cast(r, c, context) }.
import { brandFireZone } from "./brand-fire-zone.js";
import { nevilHomingBoomerang } from "./nevil-homing-boomerang.js";
import { smokeHealingPotion, atlenSwordWave, brookeBarrage, nukeMaximumFirepower, matrixReversalMagic } from "./additional-secondary-skills.js";
export const SECONDARY_SKILLS = [harlanStopgap, princeRoyalFlag, stenBarricade, brandFireZone, nevilHomingBoomerang, smokeHealingPotion, atlenSwordWave, brookeBarrage, nukeMaximumFirepower, matrixReversalMagic, ...NEW_SECONDARY_SKILLS, ...TACTICAL_SECONDARY_SKILLS, ...STRATEGIC_SECONDARY_SKILLS, castleCastling, michaelDefense, ecolaFission, phageEvolution, bananaReturn, thornSpin];
export function prepareSecondarySkills(project, definitions = SECONDARY_SKILLS) {
  // Nevil's archived 1P body references a black/green variant; use the same orange
  // body as 2P and the original selector, preserving picture id, size and hit geometry.
  const nevilP1 = project.objects.find(o => o.id === "n230")?.sprite.pictures[2];
  const nevilP2 = project.objects.find(o => o.id === "ocqj")?.sprite.pictures[2];
  if (nevilP1 && nevilP2) nevilP1.fileurl = nevilP2.fileurl;
  // Keep Creation's command names readable without the archived empty brackets.
  for (const [id, name] of [["x7mx", "명령: 자력"], ["74ed", "명령: 전자기파"]]) {
    const entry = project.variables.find(v => v.id === id)?.array?.[10];
    if (entry) entry.data = name;
  }
  const eclipse = project.variables.find(v => v.id === "gsve")?.array?.[3];
  if (eclipse) eclipse.data = "패시브의 사정거리, 공전속도, 피해량을 증가시킵니다. 끄고 킬 수 있습니다.";
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
      if (!Number.isInteger(character) || character < 1 || character > THORN_ID ||
          this.definitions.has(character) || !Number.isFinite(manaCost) || manaCost < 0 ||
          !Number.isInteger(cooldownTicks) || cooldownTicks < 0 || typeof cast !== "function")
        throw Error("Invalid secondary skill definition");
      this.definitions.set(character, Object.freeze({ ...definition, manaCost, cooldownTicks }));
    }
  }
  reset() {
    for (const key of this.runtime.globals.keys())
      if (String(key).startsWith(PREFIX) || key === "skill-selection-draft") this.runtime.globals.delete(key);
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
  damageMultiplier(id, value) {
    for (const side of [1, 2]) { const state=this.state(side),definition=this.definition(side);
      if(state.mode==='secondary'&&definition?.damageMultiplier) value=definition.damageMultiplier(this.runtime,id,value,side,state);
    } return value;
  }
  state(side) {
    if (!SIDES[side]) throw Error("Invalid player side");
    return this.runtime.globals.get(PREFIX + side) ?? { mode: "primary", pressed: false, active: false, readyAt: 0 };
  }
  onClone(c, child) {
    if (this.runtime.scene !== "7dwq") return;
    for (const side of [1, 2]) {
      const definition = this.definition(side), state = this.state(side);
      if (state.mode === "secondary") definition?.onClone?.(this.runtime, c, child, side, state);
    }
  }
  onCommand(c, type, args) {
    if (this.runtime.scene !== "7dwq") return;
    for (const side of [1, 2]) {
      const definition = this.definition(side), state = this.state(side);
      if (state.mode === "secondary") if (definition?.onCommand?.(this.runtime, c, type, args, side, state) === false) return false;
    }
  }
  onFunction(c, id, args) {
    if(this.eachHook("blocksFunction",c,id,args))return false;
    if (this.runtime.scene !== "7dwq") return;
    for (const side of [1, 2]) {
      const definition = this.definition(side), state = this.state(side);
      if (state.mode === "secondary") if (definition?.onFunction?.(this.runtime, c, id, args, side, state) === false) return false;
    }
  }
  onHealthChange(e, id, before, after) {
    if (this.reflecting || this.runtime.scene !== "7dwq" || Number(this.runtime.globals.get("r71b")) !== 0) return;
    const side = id === "akf6" ? 1 : id === "7ir2" ? 2 : null;
    if (!side) return;
    const definition = this.definition(side), state = this.state(side);
    if (state.mode === "secondary") definition?.onHealthChange?.(this.runtime, e, id, before, after, side, state);
  }
  selectionSide() {
    const turn = Number(this.runtime.globals.get("jx38"));
    return this.runtime.scene === "1ckl" && [1, 2].includes(turn) ? turn : null;
  }
  syncSelection() {
    const r = this.runtime, side = this.selectionSide();
    if (!side) return;
    const character = Number(r.globals.get("16fh"));
    let draft = r.globals.get("skill-selection-draft");
    // A newly previewed character, including 2P previewing the same character,
    // starts at its original skill. Confirmed 1P choices remain separate.
    if (!draft || draft.side !== side || draft.character !== character) {
      draft = { side, character, mode: "primary" };
      r.globals.set("skill-selection-draft", draft);
    }
    if (Number(r.globals.get("yraj")) !== 1) return;
    const definition = this.definitions.get(character);
    if (!definition) return;
    const secondary = draft.mode === "secondary";
    const name = secondary ? definition.name : definition.primaryName;
    const description = secondary ? definition.description : definition.primaryDescription;
    const title = r.originals.get("c72k"), detail = r.originals.get("3my6"), icon = r.originals.get("o9rj");
    if (title) title.text = "스킬 : " + name;
    if (detail) detail.text = description;
    if (icon && definition.primaryPictureId && definition.secondaryPictureId)
      r.setPicture(icon, secondary ? definition.secondaryPictureId : definition.primaryPictureId);
  }
  choice(side) {
    const character = Number(this.runtime.globals.get(SIDES[side]?.character));
    return this.definitions.has(character) && this.runtime.globals.get(`skill-loadout:${side}:${character}`) === "secondary"
      ? "secondary" : "primary";
  }
  toggleSelection(side) {
    const r = this.runtime;
    if (this.selectionSide() !== side || Number(r.globals.get("yraj")) !== 1) return false;
    this.syncSelection();
    const draft = r.globals.get("skill-selection-draft");
    if (!this.definitions.has(draft?.character)) return false;
    draft.mode = draft.mode === "primary" ? "secondary" : "primary";
    this.syncSelection();
    return true;
  }
  selectKey(key, ownSide = null) {
    const side = ownSide ?? (key === 82 ? 1 : key === 80 ? 2 : null);
    return [82, 80].includes(key) && side !== null && this.toggleSelection(side);
  }
  onSelectionCommand(type, args) {
    const r = this.runtime;
    if (r.scene !== "1ckl" || type !== "set_variable" || args[0] !== "jx38") return;
    const previous = Number(r.globals.get("jx38")), next = Number(args[1]);
    if (!((previous === 1 && next === 2) || (previous === 2 && next === 0))) return;
    const character = Number(r.globals.get(SIDES[previous].character));
    const draft = r.globals.get("skill-selection-draft");
    const mode = draft?.side === previous && draft.character === character ? draft.mode : "primary";
    // Commit at the exact original character-confirmation command, before the turn changes.
    r.globals.set(`skill-loadout:${previous}:${character}`, this.definitions.has(character) ? mode : "primary");
    r.globals.delete("skill-selection-draft");
    if (next === 2) for (const key of r.globals.keys())
      if (String(key).startsWith("skill-loadout:2:")) r.globals.delete(key);
  }
  loadout() { return [this.choice(1), this.choice(2)]; }
  configureMatch(choices = this.loadout()) {
    for (const side of [1, 2]) if (this.definition(side))
      this.runtime.globals.set(PREFIX + side, {
        mode: choices[side - 1] === "secondary" ? "secondary" : "primary",
        pressed: false, active: false, readyAt: 0,
      });
  }
  selectionInfo(side) {
    const draft = this.runtime.globals.get("skill-selection-draft");
    const definition = draft?.side === side ? this.definitions.get(draft.character) : this.definition(side);
    if (!definition) return null;
    const secondary = draft?.side === side ? draft.mode === "secondary" : this.choice(side) === "secondary";
    return { secondary, name: secondary ? definition.name : definition.primaryName,
      description: secondary ? definition.description : definition.primaryDescription,
      icon: secondary ? definition.icon : definition.primaryIcon };
  }
  // The match loadout is frozen; pressing R/P can never change it in combat.
  eachHook(name, ...args) {
    if (this.runtime.scene !== "7dwq") return false;
    for (const side of [1, 2]) { const state=this.state(side), def=this.definition(side);
      if(state.mode === "secondary" && def?.[name]?.(this.runtime,...args,side,state)) return true;
    } return false;
  }
  beforeStep() { restorePresentation(this.runtime); }
  afterStep() { this.eachHook("afterStep"); }
  hidden(e) { return this.eachHook("hidden",e); }
  reachValue(c, target, value) {
    for(const side of [1,2]){
      const state=this.state(side),def=this.definition(side);
      if(state.mode==='secondary'&&def?.reachValue)value=def.reachValue(this.runtime,c,target,value,side,state);
    }
    return value;
  }
  targetDistanceValue(c, target, value) {
    for(const side of [1,2]){
      const state=this.state(side),def=this.definition(side);
      if(state.mode==='secondary'&&def?.targetDistanceValue)value=def.targetDistanceValue(this.runtime,c,target,value,side,state);
    }
    return value;
  }
  blocksMove(e, dx, dy) { return this.eachHook("blocksMove",e,dx,dy); }
  blocksCollision(e) { return this.eachHook("blocksCollision",e); }
  skipThread(t) { return this.eachHook("skipThread",t); }
  distanceValue(c,id,value) { for(const side of [1,2]) {const st=this.state(side),def=this.definition(side);if(st.mode==="secondary"&&def?.distanceValue)value=def.distanceValue(this.runtime,c,id,value,side,st);}return value; }
  replacesKey(key) {
    if (this.runtime.scene !== "7dwq") return false;
    if(this.eachHook("blocksKey",key)) return true;
    const side = key === 82 ? 1 : key === 80 ? 2 : null;
    return side !== null && !!this.definition(side) && this.state(side).mode === "secondary";
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
      if (state.mode === "primary") continue;
      definition.tick?.(r,side,state);
      const body = r.originals.get(ids.body);
      if (!trigger || state.active || r.tick < state.readyAt || !body || body.dead ||
          !body.visible || Number(r.globals.get(ids.hp)) <= 0 || Number(r.globals.get("r71b")) !== 0 ||
          (!definition.castWhileStunned && Number(r.globals.get(ids.stun)) !== 0) || (definition.lockVariable !== false && Number(r.globals.get(ids.busy)) !== 0) ||
          Number(r.globals.get(ids.mana)) < definition.manaCost ||
          (definition.canCast && !definition.canCast(r, side))) continue;
      state.active = true;
      state.readyAt = r.tick + definition.cooldownTicks;
      r.globals.set(ids.mana, r.num(r.globals.get(ids.mana)) - definition.manaCost);
      if (definition.lockVariable !== false) r.globals.set(ids.busy, 1);
      definition.onActivate?.(r, side, state);
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
          if (definition.lockVariable !== false && Number(runtime.globals.get(ids.busy)) === 1) runtime.globals.set(ids.busy, 0);
        }
      }, "secondary_skill");
    }
  }
}
