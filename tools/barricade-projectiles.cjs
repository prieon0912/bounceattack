
"use strict";
// Keep each native projectile's normal damage for durability collisions. Rooted-target
// bonuses are excluded by taking the smaller literal within the current firing mode.
module.exports = function annotateProjectiles(project) {
  const literal = value => value && typeof value === "object" &&
    ["number", "text"].includes(value.type) ? Number(value.params[0]) :
    typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  function condition(node, mode) {
    if (node?.type !== "boolean_basic_operator") return null;
    const [left, op, right] = node.params;
    if (left?.type !== "get_variable" || !["rr24", "qvkr"].includes(left.params[0])) return null;
    const value = literal(right);
    if (!Number.isFinite(value)) return null;
    if (op === "EQUAL") return mode === value;
    if (op === "NOT_EQUAL") return mode !== value;
    return null;
  }
  function scan(node, mode, result) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(value => scan(value, mode, result)); return; }
    if (["move_direction", "move_to_angle", "move_x", "move_y"].includes(node.type)) result.moves = true;
    if (["func_qy83", "func_05j0"].includes(node.type)) {
      const damage = -literal(node.params[0]);
      if (damage > 0) result.damage.push(damage);
    }
    if (["_if", "if_else"].includes(node.type)) {
      const value = condition(node.params[0], mode);
      if (value !== null) {
        scan(node.statements?.[value ? 0 : 1], mode, result);
        return;
      }
    }
    Object.values(node).forEach(value => scan(value, mode, result));
  }
  for (const object of project.objects) {
    // Returning weapons retain their original recall lifecycle.
    if (/부메랑|단검|낫|도끼/.test(object.name)) continue;
    const clones = JSON.parse(object.script).filter(stack => stack[0]?.type === "when_clone_start");
    const modes = {};
    for (const mode of [0, 1, 2]) {
      const result = { moves: false, damage: [] };
      scan(clones, mode, result);
      if (result.moves && result.damage.length) modes[mode] = Math.min(...result.damage);
    }
    if (Object.keys(modes).length) {
      object.barricadeDamage = modes;
      function containsMovement(node) {
        if(!node||typeof node!=="object")return false;
        if(["move_direction","move_to_angle","move_x","move_y"].includes(node.type))return true;
        return Object.values(node).some(containsMovement);
      }
      function markFlight(node,insideFlight=false) {
        if(!node||typeof node!=="object")return;
        let flight=insideFlight;
        if(node.type==="repeat_basic"&&!insideFlight&&containsMovement(node.statements)){
          node.barricadeFlight=true;object.barricadeEndpoint=true;flight=true;
        }
        Object.values(node).forEach(value=>{
          if(Array.isArray(value))value.forEach(child=>markFlight(child,flight));
          else if(value&&typeof value==="object")markFlight(value,flight);
        });
      }
      clones.forEach(stack=>stack.forEach(block=>markFlight(block)));
      // The annotated loops are consumed by the compiler, not the archived source.
      const stacks=JSON.parse(object.script);
      for(let i=0;i<stacks.length;i++)if(stacks[i][0]?.type==="when_clone_start"){
        stacks[i]=clones.shift();
      }
      object.script=JSON.stringify(stacks);
    }
  }
};
