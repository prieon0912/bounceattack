import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Runtime } from "../public/src/runtime.js";
import { registerOriginal } from "../public/src/original-program.js";
import { applyInputs, stateHash } from "../public/src/frame-sync.js";
import { RoomHub } from "../server/rooms.js";
import { MemoryStore } from "../server/store.js";
const project = JSON.parse(fs.readFileSync(new URL("../public/data/project.json", import.meta.url)));
function game(p1=3,p2=2,skills=[p1,p2].map(n=>n===3?"secondary":"primary")) {
 const r=new Runtime(structuredClone(project),{headless:true});registerOriginal(r);
 r.start({p1,p2,skills,seed:7});for(let i=0;i<240;i++)r.step();
 for(const t of [...r.threads,...r.pending])if(["00h9","n8fg"].includes(t.e.objectId))t.cancelled=true;
 Object.assign(r.originals.get("00h9"),{x:-80,y:0});Object.assign(r.originals.get("n8fg"),{x:80,y:0});
 r.globals.set("qn98",100);r.globals.set("thom",100);return r;
}
function step(r,a=0,b=0){applyInputs(r,[a,b]);r.step();}
const projectile=r=>r.entities.find(e=>e.secondaryEffect==="nevil-homing-boomerang"&&!e.dead);
test("outbound boomerang follows each new target position using original projectile art",()=>{
 const r=game();step(r,16);let e=projectile(r);assert.ok(e);
 assert.equal(e.picture.fileurl,r.defs.get("gsfk").sprite.pictures[2].fileurl);
 const target=r.originals.get("n8fg");let checks=0;
 for(let t=0;t<40&&r.secondarySkills.state(1).boomerang.phase==="outbound";t++){
  target.y=35*Math.sin(t/8);const x=e.x,y=e.y;step(r);
  const vx=e.x-x,vy=e.y-y,tx=target.x-x,ty=target.y-y;
  if(r.secondarySkills.state(1).boomerang.phase==="outbound"&&Math.hypot(vx,vy)>1e-6){assert.ok(Math.abs(vx*ty-vy*tx)<1e-6);checks++;}
 }
 assert.ok(checks>20);assert.deepEqual(r.faults,[]);
});
test("return re-aims at the moving caster each tick and catches within the original 18 units on both sides",()=>{
 for(const side of [1,2]){
 const r=game(side===1?3:2,side===2?3:2);step(r,side===1?16:0,side===2?16:0);
 while(r.secondarySkills.state(side).boomerang.phase!=="return")step(r);
 const caster=r.originals.get(side===1?"00h9":"n8fg");let checks=0,curves=0,previous=null;
 for(let t=0;t<300&&projectile(r);t++){
  Object.assign(caster,{x:side===1?-100:-20,y:40*Math.sin(t/12)});
  const e=projectile(r),x=e.x,y=e.y,tx=caster.x-x,ty=caster.y-y;step(r);
  const vx=e.x-x,vy=e.y-y;
  if(Math.hypot(vx,vy)>1e-6){
   assert.ok(Math.abs(vx*ty-vy*tx)<1e-6,"return follows current owner position");
   if(previous&&Math.abs(vx*previous[1]-vy*previous[0])>1e-5)curves++;
   previous=[vx,vy];checks++;
  }
  if(!projectile(r))assert.ok(Math.hypot(caster.x-e.x,caster.y-e.y)<=18);
 }
 assert.ok(checks>10);assert.ok(curves>5);assert.ok(!projectile(r));
 assert.equal(r.num(r.globals.get(side===1?"7a8q":"97v8")),0);assert.deepEqual(r.faults,[]);
 }
});

test("each leg deals original basic damage 8 once, with matching 2P behavior",()=>{
 for(const [p1,p2,side]of [[3,2,1],[2,3,2]]){
  const r=game(p1,p2),hpId=side===1?"7ir2":"akf6",hp=r.num(r.globals.get(hpId));
  r.originals.get(side===1?"n8fg":"00h9").x=side===1?30:-30;
  step(r,side===1?16:0,side===2?16:0);
  for(let i=0;i<22;i++)step(r);
  assert.equal(hp-r.num(r.globals.get(hpId)),8,"outbound hit");
  for(let i=0;i<250;i++)step(r);
  assert.equal(hp-r.num(r.globals.get(hpId)),16,"one hit each leg");
  assert.ok(!projectile(r));assert.deepEqual(r.faults,[]);
 }
});
test("mana cost is 24; an existing basic boomerang blocks cast without spending mana",()=>{
 const r=game();r.globals.set("7a8q",1);const mp=r.num(r.globals.get("qn98"));step(r,16);
 assert.ok(!projectile(r));assert.ok(r.num(r.globals.get("qn98"))>=mp);
 step(r);r.globals.set("7a8q",0);r.globals.set("qn98",100);step(r,16);
 assert.ok(projectile(r));assert.ok(Math.abs(r.num(r.globals.get("qn98"))-76)<.5);
});
test("Nevil skill switches only in original blurred description and commits independently for 2P",()=>{
 const r=game();r.loadScene("1ckl");r.globals.set("jx38",1);r.globals.set("16fh",3);r.globals.set("yraj",1);
 r.secondarySkills.syncSelection();assert.equal(r.originals.get("o9rj").picture.id,"pcgv");
 assert.ok(r.secondarySkills.selectKey(82));assert.equal(r.originals.get("o9rj").picture.id,"nevil-secondary-icon");
 assert.equal(r.originals.get("3my6").text,"적을 추적하는 부메랑을 던집니다.");
 r.globals.set("y75t",3);r.command({e:r.originals.get("o9rj")},"set_variable",["jx38",2]);r.secondarySkills.syncSelection();
 assert.equal(r.secondarySkills.choice(1),"secondary");assert.equal(r.secondarySkills.selectionInfo(2).name,"3환 부메랑");
 r.globals.set("yraj",0);assert.equal(r.secondarySkills.selectKey(80),false);
});
test("original skill remains available and does not spawn homing projectile",()=>{
 const r=game(3,2,["primary","primary"]);step(r,16);for(let i=0;i<15;i++)step(r);
 assert.ok(!projectile(r));assert.ok(r.entities.some(e=>e.clone&&e.objectId==="gsfk"));
 assert.equal(r.secondarySkills.state(1).mode,"primary");
});
test("mirror homing projectiles preserve independent ownership and deterministic state",()=>{
 const a=game(3,3),b=game(3,3);
 for(let t=0;t<320;t++){
  for(const r of [a,b])step(r,t===0?16:0,t===5?16:0);
  assert.equal(stateHash(a),stateHash(b));
 }
 assert.equal(a.num(a.globals.get("7a8q")),0);assert.equal(a.num(a.globals.get("97v8")),0);
 assert.deepEqual(a.faults,[]);
});
test("matchmaking accepts Nevil secondary and distributes it to both clients",async()=>{
 const hub=new RoomHub(new MemoryStore()),a={},b={},build="a".repeat(64);
 await hub.matchmake(a,{build,character:3,skill:"secondary"});
 const room=await hub.matchmake(b,{build,character:3,skill:"primary"});
 assert.deepEqual(room.match.skills,["secondary","primary"]);
});

test("Nevil 1P body uses the same original orange art as 2P without changing geometry",()=>{
 for(const skills of [["primary","primary"],["secondary","primary"]]){
  const r=game(3,2,skills),body=r.defs.get("n230").sprite.pictures[2],orange=r.defs.get("ocqj").sprite.pictures[2];
  const original=project.objects.find(o=>o.id==="n230").sprite.pictures[2];
  assert.equal(body.fileurl,orange.fileurl);
  assert.equal(body.id,original.id);
  assert.deepEqual(body.dimension,original.dimension);
  assert.equal(r.originals.get("n230").picture.fileurl,orange.fileurl);
 }
});
