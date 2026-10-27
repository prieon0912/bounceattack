import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {Runtime} from "../public/src/runtime.js";
import {registerOriginal} from "../public/src/original-program.js";
import {HEALING_POTION} from "../public/src/additional-secondary-skills.js";
import {stateHash} from "../public/src/frame-sync.js";
import {RoomHub} from "../server/rooms.js";
import {MemoryStore} from "../server/store.js";
const project=JSON.parse(fs.readFileSync(new URL("../public/data/project.json",import.meta.url)));
function game(p1,p2=2,skills=["secondary","primary"]){
 const r=new Runtime(structuredClone(project),{headless:true});registerOriginal(r);r.start({p1,p2,seed:21,skills});
 for(let i=0;i<240;i++)r.step();
 const names=Object.fromEntries(project.variables.map(v=>[v.name,v.id]));
 r.g=n=>Number(r.globals.get(names[n]));r.s=(n,v)=>r.globals.set(names[n],v);
 r.run=(n,keys=[])=>{for(let i=0;i<n;i++){r.keys.clear();keys.forEach(k=>r.keys.add(k));r.step();}};
 r.s("1P MP",100);r.s("2P MP",100);r.s("1P 마나 재생",0);r.s("2P 마나 재생",0);
 return r;
}
function freeze(r){for(const t of [...r.threads,...r.pending])if(["00h9","n8fg"].includes(t.e.objectId))t.cancelled=true;
 Object.assign(r.originals.get("00h9"),{x:-20,y:0});Object.assign(r.originals.get("n8fg"),{x:20,y:0});}
test("healing potion heals owner 2 per second, max 6, never enemy, and expires for both sides",()=>{
 for(const side of [1,2]){const r=game(side===1?16:2,side===2?16:2,side===1?["secondary","primary"]:["primary","secondary"]);freeze(r);
 r.s(`${side}P 체력`,50);const foe=side===1?2:1,enemy=r.g(`${foe}P 체력`);
 r.run(1,[side===1?82:80]);assert.ok(Math.abs(r.g(`${side}P MP`)-57)<.5);
 r.run(59);assert.equal(r.g(`${side}P 체력`),50);
 r.run(1);assert.equal(r.g(`${side}P 체력`),52);
 r.run(120);assert.equal(r.g(`${side}P 체력`),56);assert.equal(r.g(`${foe}P 체력`),enemy);
 assert.equal(r.secondarySkills.state(side).healingArea,undefined);assert.deepEqual(r.faults,[]);
 }
});
test("healing requires small stationary area, cannot overheal or stack",()=>{
 const r=game(16);freeze(r);r.s("1P 체력",50);r.run(1,[82]);r.run(1);r.run(1,[82]);assert.ok(Math.abs(r.g("1P MP")-57)<.5);
 const caster=r.originals.get("00h9"),zone=r.secondarySkills.state(1).healingArea;caster.x=zone.x+41;
 r.run(58);assert.equal(r.g("1P 체력"),50);caster.x=zone.x;
 r.s("1P 체력",r.g("1P 최대체력")-1);r.run(60);assert.equal(r.g("1P 체력"),r.g("1P 최대체력"));
});
test("sword wave consumes exactly three actual basic attacks, not held frames, and charges cannot stack",()=>{
 for(const side of [1,2]){const r=game(side===1?7:2,side===2?7:2,side===1?["secondary","primary"]:["primary","secondary"]);freeze(r);
 r.s(`${side}P 방향`,side===1?1:0);r.run(1,[side===1?82:80]);assert.equal(r.secondarySkills.state(side).charges,3);
 r.run(1);r.run(1,[side===1?82:80]);assert.ok(Math.abs(r.g(`${side}P MP`)-70)<.5);
 for(let attack=0;attack<3;attack++){r.run(2,[side===1?69:13]);r.run(110);assert.equal(r.secondarySkills.state(side).charges,2-attack);}
 r.run(2,[side===1?69:13]);r.run(110);assert.equal(r.secondarySkills.state(side).charges,0);assert.deepEqual(r.faults,[]);
 }
});
test("sword wave flies forward, hits airborne targets once for 3, respects stealth",()=>{
 for(const hidden of [false,true]){const r=game(7);freeze(r);r.s("1P 방향",1);r.originals.get("n8fg").x=80;r.originals.get("n8fg").y=20;
 const hp=r.g("2P 체력");r.globals.set("rav6",hidden?1:0);r.run(1,[82]);r.run(1);r.run(2,[69]);r.run(60);
 assert.equal(hp-r.g("2P 체력"),hidden?0:3);assert.ok(!r.entities.some(e=>e.secondaryEffect==="atlen-sword-wave"));}
});
test("barrage doubles real original bullets at upper/lower offsets for three seconds, on either side",()=>{
 for(const side of [1,2]){const r=game(side===1?10:2,side===2?10:2,side===1?["secondary","primary"]:["primary","secondary"]);freeze(r);
 r.run(1,[side===1?82:80]);assert.ok(Math.abs(r.g(`${side}P MP`)-44)<.5);r.run(2,[side===1?69:13]);
 const rounds=r.entities.filter(e=>e.clone&&e.objectId===(side===1?"5h1u":"xcmn"));assert.equal(rounds.length,2);
 assert.deepEqual(rounds.map(e=>e.barrageOffset).sort((a,b)=>a-b),[-3,3]);assert.ok(Math.abs(Math.abs(rounds[0].y-rounds[1].y)-6)<1e-9);
 r.run(200);r.run(2,[side===1?69:13]);const after=r.entities.filter(e=>e.clone&&e.objectId===(side===1?"5h1u":"xcmn"));assert.equal(after.length,1);assert.ok(!after[0].barrageOffset);assert.deepEqual(r.faults,[]);
 }
});
test("all three secondary mirror matches remain deterministic with independent player states",()=>{
 for(const ch of [7,10,16]){const a=game(ch,ch,["secondary","secondary"]),b=game(ch,ch,["secondary","secondary"]);
 for(const r of [a,b]){freeze(r);r.s("1P 체력",50);r.s("2P 체력",50);r.run(1,[82,80]);}
 for(let tick=0;tick<220;tick++){for(const r of [a,b])r.run(1,tick%50<2?[69,13]:[]);assert.equal(stateHash(a),stateHash(b));}
 assert.deepEqual(a.faults,[]);assert.deepEqual(b.faults,[]);}
});


test("new skills use original blurred selector, defaults stay primary and offline 2P resets",()=>{
 for(const [ch,name] of [[7,"검기"],[10,"탄막"],[16,"치유 포션"]]){
 const r=game(ch);r.loadScene("1ckl");r.globals.set("jx38",1);r.globals.set("16fh",ch);r.globals.set("yraj",1);
 r.secondarySkills.syncSelection();const primary=r.originals.get("c72k").text;
 r.secondarySkills.toggleSelection(1);r.secondarySkills.syncSelection();assert.equal(r.originals.get("c72k").text,"스킬 : "+name);
 r.globals.set("y75t",ch);r.command({e:r.originals.get("c72k")},"set_variable",["jx38",2]);
 r.globals.set("s5vb",ch);r.secondarySkills.syncSelection();assert.equal(r.originals.get("c72k").text,primary);
 assert.deepEqual(r.secondarySkills.loadout(),["secondary","primary"]);
 }
});
test("matchmaking carries all three new secondaries independently in mirror matches",async()=>{
 for(const ch of [7,10,16]){const hub=new RoomHub(new MemoryStore()),a={},b={};
 await hub.matchmake(a,{build:"a".repeat(64),character:ch,skill:"secondary"});
 const result=await hub.matchmake(b,{build:"a".repeat(64),character:ch,skill:"primary"});
 assert.deepEqual(result.match.skills,["secondary","primary"]);}
});


test("sword wind follows behind both directions, fades in and cleans up without dealing extra damage",()=>{
 for(const direction of [0,1]){
 const r=game(7);freeze(r);r.s("1P 방향",direction);r.originals.get("n8fg").x=direction?200:-200;
 r.run(1,[82]);r.run(1);r.run(2,[69]);
 let saw=false;
 for(let tick=0;tick<100;tick++){
 r.run(1);const wave=r.entities.find(e=>e.secondaryEffect==="atlen-sword-wave"),wind=r.entities.find(e=>e.secondaryEffect==="atlen-sword-wind");
 if(wave&&!wave.dead){assert.ok(wind&&!wind.dead);assert.equal(wind.x,wave.x-(direction?25:-25));assert.equal(wind.y,wave.y);assert.ok(wind.effects.transparency>=45&&wind.effects.transparency<=100);saw=true;}
 }
 assert.ok(saw);assert.ok(!r.entities.some(e=>e.secondaryEffect==="atlen-sword-wind"));assert.deepEqual(r.faults,[]);
 }
});


test("healing area expands from center without bottle or outlines; sword arc keeps only white fill",()=>{
 const r=game(16);freeze(r);r.run(1,[82]);
 const area=r.entities.find(e=>e.secondaryEffect==="smoke-healing-area");assert.equal(r.size(area),2);
 let last=2;
 for(let tick=0;tick<HEALING_POTION.expandTicks;tick++){
 r.run(1);const size=r.size(area);assert.ok(size>last&&size<=80);last=size;
 assert.ok(!r.entities.some(e=>e.secondaryEffect==="smoke-healing-potion"));
 }
 assert.equal(last,80);
 for(const file of ["smoke-healing-area.svg","atlen-sword-wave.svg"]){
 const svg=fs.readFileSync(new URL("../public/assets/secondary/"+file,import.meta.url),"utf8");
 assert.ok(!svg.includes("stroke="));
 }
});
