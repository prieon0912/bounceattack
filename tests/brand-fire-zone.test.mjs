import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Runtime } from "../public/src/runtime.js";
import { registerOriginal } from "../public/src/original-program.js";
import { applyInputs, stateHash } from "../public/src/frame-sync.js";
import { FIRE_ZONE } from "../public/src/brand-fire-zone.js";
const project = JSON.parse(fs.readFileSync(new URL("../public/data/project.json", import.meta.url)));
function game(p1 = 1, p2 = 2, skills = [p1, p2].map(ch => ch === 1 ? "secondary" : "primary")) {
  const r = new Runtime(structuredClone(project), { headless: true });
  registerOriginal(r); r.start({ p1, p2, seed: 19, skills });
  for (let t = 0; t < 240; t++) r.step();
  for (const thread of [...r.threads, ...r.pending])
    if (["00h9", "n8fg"].includes(thread.e.objectId)) thread.cancelled = true;
  Object.assign(r.originals.get("00h9"), { x: 0, y: 0 });
  Object.assign(r.originals.get("n8fg"), { x: 70, y: 0 });
  for (const id of ["qn98", "thom"]) r.globals.set(id, 100);
  return r;
}
function step(r, p1 = 0, p2 = 0) { applyInputs(r, [p1, p2]); r.step(); }
// Isolate area ticks from the normal fireball damage by delivering its real spawn/impact hooks.
function installZone(r, side = 1) {
  step(r, side === 1 ? 16 : 0, side === 2 ? 16 : 0);
  const owner = r.originals.get(side === 1 ? "m9km" : "iaqy");
  const c = { e: owner, block: side === 1 ? "jntz" : "qrc5", args: {}, thread: { cancelled: false } };
  r.command(c, "create_clone", ["self"]);
  const shot = r.entities.find(e => e.uid === r.secondarySkills.state(side).pendingShot);
  assert.ok(shot);
  const body = r.originals.get(side === 1 ? "00h9" : "n8fg");
  Object.assign(shot, { x: body.x, y: body.y });
  r.command({ ...c, e: shot }, "change_to_some_shape", [side === 1 ? "1v1m" : "x49z"]);
  shot.dead = true;
}

test("Brand fire zone deals 5 every second, five times, and cleans up after five seconds", () => {
  const r = game(), hp = r.globals.get("7ir2");
  installZone(r); const zone = r.secondarySkills.state(1).zone;
  assert.deepEqual([zone.x, zone.y, zone.radius], [0, 0, 10]);
  assert.ok(r.num(r.globals.get("qn98")) < 69);
  for (let t = 1; t <= 301; t++) {
    step(r);
    assert.equal(hp - r.num(r.globals.get("7ir2")), 5 * Math.min(5, Math.floor(t / 60)), `tick ${t}`);
    if (t === 20) assert.equal(r.num(r.globals.get("rr24")), 0, "placement does not lock player for five seconds");
  }
  assert.equal(r.secondarySkills.state(1).zone, undefined);
  assert.ok(!r.entities.some(e => e.secondaryEffect === "brand-fire-zone"));
  assert.deepEqual(r.faults, []);
});
test("installed area stays put; slow applies only inside and preserves other slows", () => {
  const r = game(), target = r.originals.get("n8fg");
  installZone(r);
  r.originals.get("00h9").x = -150;
  for (let i = 0; i < FIRE_ZONE.expandTicks; i++) step(r);
  assert.equal(r.secondarySkills.state(1).zone.x, 0);
  assert.equal(r.get(target, "nccn"), FIRE_ZONE.slow);
  assert.equal(r.num(r.globals.get("nccn")), 0, "secondary slow does not contaminate original decay state");
  target.x = 101; assert.equal(r.num(r.get(target, "nccn")), 0);
  target.x = 0; target.y = 101; assert.equal(r.num(r.get(target, "nccn")), 0);
  target.y = 0; target.x = 100; assert.equal(r.get(target, "nccn"), FIRE_ZONE.slow);
  r.globals.set("nccn", 15); assert.equal(r.get(target, "nccn"), 15);
  target.x = 150; assert.equal(r.get(target, "nccn"), 15);
});
test("outside players take no damage; entering and leaving changes subsequent ticks", () => {
  const r = game(), target = r.originals.get("n8fg"), hp = r.globals.get("7ir2");
  target.x = 120; installZone(r);
  for (let t = 1; t <= 60; t++) step(r);
  assert.equal(r.globals.get("7ir2"), hp);
  target.x = 50;
  for (let t = 0; t < 60; t++) step(r);
  assert.equal(r.globals.get("7ir2"), hp - 5);
  target.x = 120;
  for (let t = 0; t < 60; t++) step(r);
  assert.equal(r.globals.get("7ir2"), hp - 5);
});
test("fire zone damage uses original shield handling", () => {
  const r = game(), hp = r.globals.get("7ir2");
  r.globals.set("g4sc", 10); installZone(r);
  for (let t = 0; t < 60; t++) step(r);
  assert.equal(r.globals.get("7ir2"), hp);
  assert.equal(r.num(r.globals.get("g4sc")), 5);
});
test("P works for second player; simultaneous mirror fields stay deterministic and independent", () => {
  for (const [p1, p2] of [[2, 1], [1, 1]]) {
    const a = game(p1, p2), b = game(p1, p2);
    const hp = [a.globals.get("akf6"), a.globals.get("7ir2")];
    for (const r of [a, b]) { if (p1 === 1) installZone(r, 1); installZone(r, 2); }
    for (let t = 0; t <= 301; t++) {
      for (const r of [a, b]) step(r);
      assert.equal(stateHash(a), stateHash(b));
    }
    assert.equal(a.num(a.globals.get("akf6")), hp[0] - 25);
    assert.equal(a.num(a.globals.get("7ir2")), hp[1] - (p1 === 1 ? 25 : 0));
    assert.deepEqual(a.faults, []);
  }
});
test("original selector uses the new icon and matching skill description", () => {
  const r = game();
  const first = id => r.project.variables.find(v => v.id === id).array[0].data;
  assert.equal(first("x7mx"), "폭발표식");
  assert.match(first("gsve"), /적의 위치에 표식/);
  assert.ok(!r.defs.get("o9rj").sprite.pictures[0].fileurl.includes("secondary"));
  assert.ok(r.defs.get("o9rj").sprite.pictures.some(p => p.id === "brand-secondary-icon"));
  assert.ok(!r.defs.get("hb4u").sprite.pictures.some(p => p.id === "brand-fire-zone-area"));
  const names = project.objects.find(o => o.id === "hb4u").sprite.pictures;
  assert.ok(!names.some(p => p.id === "brand-fire-zone-area"), "archived metadata is not modified on disk");
});

test("primary loadout repeatedly uses original mark; combat R/P never toggles skill", () => {
  for (const [p1, p2, side] of [[1, 2, 1], [2, 1, 2], [1, 1, 1], [1, 1, 2]]) {
    const r = game(p1, p2, ["primary", "primary"]), key = side === 1 ? 82 : 80;
    const mana = side === 1 ? "qn98" : "thom";
    for (let cast = 0; cast < 2; cast++) {
      r.globals.set(mana, 100); r.keys.add(key); r.step(); r.step();
      assert.equal(r.secondarySkills.state(side).mode, "primary");
      assert.equal(r.secondarySkills.state(side).zone, undefined);
      assert.ok(r.entities.some(e => e.clone && e.objectId === (side === 1 ? "m9km" : "iaqy")), "original mark exists");
      assert.equal(r.secondarySkills.selectKey(key), false, "cannot change loadout in combat");
      r.keys.clear(); for (let i = 0; i < 110; i++) r.step();
    }
    assert.deepEqual(r.faults, []);
  }
});
test("secondary loadout stays secondary for repeated casts and cannot fire original mark", () => {
  const r = game();
  for (let cast = 0; cast < 2; cast++) {
    r.globals.set("qn98", 100); installZone(r); step(r);
    assert.ok(r.secondarySkills.state(1).zone);
    assert.equal(r.secondarySkills.state(1).readyAt - r.secondarySkills.state(1).zone.startsAt, 300);
    assert.equal(r.secondarySkills.state(1).mode, "secondary");
    assert.ok(!r.entities.some(e => e.clone && e.objectId === "m9km"));
    for (let i = 0; i < 305; i++) step(r);
  }
  assert.deepEqual(r.faults, []);
});
test("only original blurred description accepts R/P; 1P commit resets 2P draft without losing 1P choice", () => {
  const r = game(1, 1); r.loadScene("1ckl");
  r.globals.set("y75t", 1); r.globals.set("s5vb", 1);
  r.globals.set("16fh", 1); r.globals.set("jx38", 1); r.globals.set("yraj", 0);
  assert.equal(r.secondarySkills.selectKey(82), false, "plain roster is not the skill picker");
  r.globals.set("yraj", 1); r.secondarySkills.syncSelection();
  assert.equal(r.secondarySkills.selectionInfo(1).name, "폭발표식");
  assert.equal(r.secondarySkills.selectKey(80), false, "P cannot edit the inactive player");
  assert.equal(r.secondarySkills.selectKey(82), true);
  assert.equal(r.originals.get("o9rj").picture.id, "brand-secondary-icon");
  assert.equal(r.originals.get("3my6").text, "다음 일반 공격이 맞거나 폭발한 자리에 5초간 적에게 피해와 둔화를 주는 화염지대를 설치합니다.");
  assert.deepEqual(r.secondarySkills.loadout(), ["primary", "primary"], "preview is not committed yet");
  r.globals.set("skill-loadout:2:1", "secondary"); // stale previous preview must never bleed into 2P
  r.command({ e:r.originals.get("o9rj") }, "set_variable", ["jx38", 2]);
  r.secondarySkills.syncSelection();
  assert.deepEqual(r.secondarySkills.loadout(), ["secondary", "primary"]);
  assert.equal(r.secondarySkills.selectionInfo(2).name, "폭발표식");
  assert.equal(r.originals.get("o9rj").picture.id, "lexo");
  assert.equal(r.secondarySkills.selectKey(82), false);
  assert.equal(r.secondarySkills.selectKey(80), true);
  r.command({ e:r.originals.get("o9rj") }, "set_variable", ["jx38", 0]);
  r.loadScene("s27s"); r.loadScene("7dwq");
  assert.equal(r.secondarySkills.state(1).mode, "secondary");
  assert.equal(r.secondarySkills.state(2).mode, "secondary");
  assert.equal(r.secondarySkills.selectKey(82), false);
  r.loadScene("1ckl");
  assert.deepEqual(r.secondarySkills.loadout(), ["primary", "primary"]);
});
test("previewing another character resets original-skill default; extra selection UI is removed", () => {
  const r = game(); r.loadScene("1ckl");
  r.globals.set("jx38", 1); r.globals.set("yraj", 1); r.globals.set("16fh", 1);
  r.secondarySkills.syncSelection(); r.secondarySkills.selectKey(82);
  r.globals.set("16fh", 26); r.secondarySkills.syncSelection();
  assert.equal(r.secondarySkills.selectKey(82), false);
  r.globals.set("16fh", 1); r.secondarySkills.syncSelection();
  assert.equal(r.secondarySkills.selectionInfo(1).name, "폭발표식");
  for (const file of ["../public/index.html", "../public/entry.css", "../public/src/entry-app.js"])
    assert.ok(!fs.readFileSync(new URL(file, import.meta.url), "utf8").includes("skill-selection"), "no added selection panel: " + file);
});
test("real original roster click commits 1P skill and presents fresh 2P default on the same character", () => {
  const r = game(); r.loadScene("1ckl"); r.globals.set("jx38",1);
  for (let i=0;i<120;i++) r.step();
  const tile = r.entities.find(e => e.objectId === "3y3g" && e.clone && Number(r.get(e,"9k0l")) === 1);
  assert.ok(tile, "original Brand roster clone exists");
  Object.assign(r.mouse,{x:tile.x,y:tile.y});
  for (let i=0;i<30;i++) r.step();
  assert.equal(Number(r.globals.get("yraj")),1);
  assert.equal(Number(r.globals.get("16fh")),1);
  assert.equal(r.secondarySkills.selectKey(82),true);
  r.click(tile.x,tile.y);
  for (let i=0;i<45;i++) r.step();
  assert.equal(Number(r.globals.get("jx38")),2);
  assert.equal(r.secondarySkills.choice(1),"secondary");
  assert.equal(r.secondarySkills.selectionInfo(2).name,"폭발표식");
  assert.equal(r.originals.get("o9rj").picture.id,"lexo");
  assert.equal(r.secondarySkills.selectKey(80),true);
  // Confirm a different original roster character for 2P; its skill starts at primary.
  const secondTile = r.entities.find(e => e.objectId === "3y3g" && e.clone && Number(r.get(e,"9k0l")) === 2);
  Object.assign(r.mouse,{x:secondTile.x,y:secondTile.y});
  for (let i=0;i<30;i++) r.step();
  assert.equal(r.secondarySkills.selectionInfo(2).secondary,false);
  assert.equal(r.secondarySkills.selectionInfo(2).name,"충격총");
  r.click(secondTile.x,secondTile.y);
  for (let i=0;i<45;i++) r.step();
  assert.equal(r.secondarySkills.choice(1),"secondary");
  assert.equal(r.secondarySkills.choice(2),"primary");
  assert.deepEqual(r.faults,[]);
});
test("zone shows only the original red circle, without flame particles", () => {
  const r = game(); installZone(r); step(r);
  const originals = new Set([...r.defs.get("m9km").sprite.pictures, ...r.defs.get("iaqy").sprite.pictures].map(p => p.fileurl));
  const effects = r.entities.filter(e => e.secondaryEffect === "brand-fire-zone");
  assert.equal(effects.length, 1);
  assert.equal(effects[0].effects.transparency, 30);
  assert.ok(r.size(effects[0]) > 20 && r.size(effects[0]) < 200);
  for (let i = 0; i < FIRE_ZONE.expandTicks; i++) step(r);
  assert.equal(r.size(effects[0]), 200);
  assert.ok(effects.every(e => originals.has(e.picture.fileurl)));
});

test("online clients receive identical mixed mirror loadouts and never exchange skills during combat", () => {
  const options = { p1: 1, p2: 1, map: 6, seed: 731, skills: ["primary", "secondary"] };
  const a = game(1, 1, options.skills), b = game(1, 1, options.skills);
  for (const r of [a, b]) {
    r.start(JSON.parse(JSON.stringify(options)));
    for (let i = 0; i < 240; i++) r.step();
    for (const id of ["qn98", "thom"]) r.globals.set(id, 100);
  }
  for (let frame = 0; frame < 180; frame++) {
    for (const r of [a, b]) step(r, frame === 0 || frame === 120 ? 16 : 0, frame === 0 ? 16 : frame === 2 || frame === 3 ? 8 : 0);
    assert.equal(stateHash(a), stateHash(b));
    assert.equal(a.secondarySkills.state(1).mode, "primary");
    assert.equal(a.secondarySkills.state(2).mode, "secondary");
  }
  assert.ok(a.entities.some(e => e.secondaryEffect === "brand-fire-zone" && e.combatSide === 2));
  assert.ok(!a.entities.some(e => e.secondaryEffect === "brand-fire-zone" && e.combatSide === 1));
  assert.deepEqual(a.faults, []);
});

test("fire zone arms first, follows the next actual basic fireball, and installs at its impact/explosion point", () => {
  for (const [p1, p2, side, collide] of [[1,2,1,true],[1,2,1,false],[2,1,2,true],[2,1,2,false]]) {
    const r = game(p1,p2), body = r.originals.get(side===1?"00h9":"n8fg");
    const castPoint = {x:body.x,y:body.y};
    if (!collide) r.collisionProvider = () => false;
    step(r,side===1?16:0,side===2?16:0);
    const state = r.secondarySkills.state(side), armedAt = r.tick;
    assert.equal(state.armed,true); assert.equal(state.zone,undefined);
    assert.equal(state.readyAt,armedAt+300);
    body.x += side===1 ? -30 : 30;
    step(r); step(r,side===1?8:0,side===2?8:0); step(r,side===1?8:0,side===2?8:0);
    let impact = null;
    const command = r.command;
    r.command = function(c,type,args) {
      if(c.e.fireZoneOwner===side && type==="change_to_some_shape" && args[0]===(side===1?"1v1m":"x49z")) impact={x:c.e.x,y:c.e.y};
      return command.call(this,c,type,args);
    };
    for(let i=0;i<100&&!state.zone;i++) step(r);
    assert.ok(state.zone,`side ${side}, collision ${collide}`);
    assert.deepEqual({x:state.zone.x,y:state.zone.y},impact);
    assert.notDeepEqual(impact,castPoint);
    assert.notEqual(state.zone.x,body.x,"area is not at the caster's current position");
    assert.equal(state.armed,false); assert.equal(state.pendingShot,undefined);
    const zones = state.zones.length;
    for(let i=0;i<30;i++)step(r);
    assert.equal(state.zones.length,zones,"one fireball installs only one area");
    assert.deepEqual(r.faults,[]);
  }
});
test("already flying fireball does not consume armed zone; subsequent basic does",()=>{
  const r=game();r.collisionProvider=()=>false;
  step(r,8);step(r,8);step(r);
  assert.ok(r.entities.some(e=>e.clone&&e.objectId==="m9km"));
  step(r,16);for(let i=0;i<110;i++)step(r);
  const state=r.secondarySkills.state(1);
  assert.equal(state.armed,true);assert.equal(state.zone,undefined);
  r.globals.set("qn98",100);const mana=r.num(r.globals.get("qn98"));
  for(let i=0;i<310;i++)step(r);step(r,16);
  assert.ok(r.num(r.globals.get("qn98"))>=mana,"rearming an unconsumed skill does not spend mana");
  step(r);step(r,8);step(r,8);for(let i=0;i<100&&!state.zone;i++)step(r);
  assert.ok(state.zone);assert.equal(state.armed,false);assert.deepEqual(r.faults,[]);
});
test("Eclipse skill description matches requested wording",()=>{
  const r=game();
  assert.equal(r.project.variables.find(v=>v.id==="gsve").array[3].data,"패시브의 사정거리, 공전속도, 피해량을 증가시킵니다. 끄고 킬 수 있습니다.");
});

test("simultaneous real mirror fireballs install independent zones on both clients",()=>{
 const a=game(1,1),b=game(1,1);
 for(let frame=0;frame<180;frame++){
  for(const r of [a,b])step(r,frame===0?16:frame===2||frame===3?8:0,frame===0?16:frame===2||frame===3?8:0);
  assert.equal(stateHash(a),stateHash(b));
 }
 assert.ok(a.secondarySkills.state(1).zone);
 assert.ok(a.secondarySkills.state(2).zone);
 assert.notEqual(a.secondarySkills.state(1).zone,a.secondarySkills.state(2).zone);
 assert.equal(a.entities.filter(e=>e.secondaryEffect==="brand-fire-zone").length,2);
 assert.deepEqual(a.faults,[]);
});

test("fire zone becomes reusable only after next-basic placement and area expiry, without another cooldown",()=>{
 for(const [p1,p2,side]of [[1,2,1],[2,1,2]]){
  const r=game(p1,p2);r.collisionProvider=()=>false;
  const press=()=>step(r,side===1?16:0,side===2?16:0);
  press();const armedAt=r.tick,state=r.secondarySkills.state(side);
  for(let i=0;i<150;i++)step(r); // Delay the basic after arming.
  step(r,side===1?8:0,side===2?8:0);step(r,side===1?8:0,side===2?8:0);
  for(let i=0;i<100&&!state.zone;i++)step(r);
  assert.ok(state.zone);const end=state.zone.endsAt;
  assert.equal(state.readyAt,end);
  while(r.tick<armedAt+305)step(r);
  const mp=side===1?"qn98":"thom";r.globals.set(mp,100);press();
  assert.ok(r.num(r.globals.get(mp))>=100,"no mana spent while existing area remains");
  assert.equal(state.armed,false);
  assert.equal(r.entities.filter(e=>e.secondaryEffect==="brand-fire-zone").length,1);
  while(state.zone)step(r);
  assert.equal(r.tick,end,"area expires at its own end time");
  r.globals.set(mp,100);press();
  assert.equal(state.armed,true,"reusable immediately after expiry");
  assert.ok(Math.abs(r.num(r.globals.get(mp))-63)<.5);
  assert.deepEqual(r.faults,[]);
 }
});

test("fire zone grows smoothly from the original explosion size and its radius matches the visible circle",()=>{
 const r=game();installZone(r);
 const area=r.entities.find(e=>e.secondaryEffect==="brand-fire-zone"),z=r.secondarySkills.state(1).zone;
 assert.equal(r.size(area),20);assert.equal(z.radius,10);
 let last=20;
 for(let tick=1;tick<=FIRE_ZONE.expandTicks;tick++){
  step(r);const size=r.size(area);
  assert.ok(size>last && size<=200);
  assert.ok(Math.abs(z.radius-size/2)<1e-9);
  assert.ok(size-last<25,"no full-size pop");last=size;
 }
 assert.equal(last,200);assert.equal(z.radius,100);
 assert.deepEqual(r.faults,[]);
});


test("fire zone skips stealthed targets and resumes damage/slow after reveal on both sides", () => {
  for (const side of [1, 2]) {
    const r = game(side === 1 ? 1 : 2, side === 2 ? 1 : 2);
    const target = r.originals.get(side === 1 ? "n8fg" : "00h9");
    const hpId = side === 1 ? "7ir2" : "akf6", stealth = side === 1 ? "rav6" : "ob2m";
    const slow = side === 1 ? "nccn" : "9af4", hp = r.num(r.globals.get(hpId));
    installZone(r, side);
    r.globals.set(stealth, 1);
    for (let t = 0; t < 60; t++) step(r);
    assert.equal(r.num(r.globals.get(hpId)), hp);
    assert.equal(r.num(r.get(target, slow)), 0);
    r.globals.set(slow, 15);
    assert.equal(r.num(r.get(target, slow)), 15, "unrelated slow is preserved");
    r.globals.set(slow, 0);
    r.globals.set(stealth, 0);
    assert.equal(r.num(r.get(target, slow)), FIRE_ZONE.slow);
    for (let t = 0; t < 60; t++) step(r);
    assert.equal(r.num(r.globals.get(hpId)), hp - 5, "skipped damage never catches up");
    r.globals.set(stealth, 1);
    for (let t = 0; t < 60; t++) step(r);
    assert.equal(r.num(r.globals.get(hpId)), hp - 5);
    assert.equal(r.num(r.get(target, slow)), 0);
    assert.deepEqual(r.faults, []);
  }
});
