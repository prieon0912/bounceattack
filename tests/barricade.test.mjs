
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Runtime} from '../public/src/runtime.js';
import {registerOriginal} from '../public/src/original-program.js';
const project=JSON.parse(fs.readFileSync(new URL('../public/data/project.json',import.meta.url)));
function game(side=1,mirror=false){
 const r=new Runtime(structuredClone(project),{headless:true});registerOriginal(r);
 r.start({p1:side===1||mirror?2:1,p2:side===2||mirror?2:1,seed:42,skills:side===1?['secondary','primary']:['primary','secondary']});
 for(let i=0;i<240;i++)r.step();
 for(const t of [...r.threads,...r.pending])t.cancelled=true;r.threads=[];r.pending=[];
 for(const [s,id] of [[1,'00h9'],[2,'n8fg']]){
  Object.assign(r.originals.get(id),{x:s===side?0:150,y:0,visible:true});
  r.globals.set(s===1?'qn98':'thom',100);r.globals.set(s===1?'8w41':'wyyq',0);
 }
 r.globals.set('r71b',0);r.globals.set(side===1?'etjn':'846x',1);
 r.testGround=r.bounds(r.originals.get(side===1?'00h9':'n8fg')).bottom;
 r.collisionProvider=(e,id)=>id==='6tzq'&&r.bounds(e).bottom < r.testGround-.001;
 r.run=(n,keys=[])=>{r.keys=new Set(keys);for(let i=0;i<n;i++)r.step();};
 return r;
}
const wall=r=>r.entities.find(e=>!e.dead&&e.secondaryEffect==='sten-barricade');
for(const side of [1,2]){
 const key=side===1?82:80;
 test(`Barricade side ${side}: immediate front, cost, expiry and replacement`,()=>{
  const r=game(side),caster=r.originals.get(side===1?'00h9':'n8fg'),bounds=r.bounds(caster);
  r.run(1,[key]);const first=wall(r);assert.ok(first);
  assert.equal(r.globals.get(side===1?'qn98':'thom'),45);assert.equal(first.barricadeHealth,30);
  assert.ok(r.bounds(first).left>=bounds.right+3);assert.equal(r.bounds(first).bottom,bounds.bottom);
  r.run(60);caster.x-=60;r.globals.set(side===1?'qn98':'thom',100);r.run(1,[key]);assert.equal(first.dead,true);
  const next=wall(r);assert.ok(next&&next!==first);r.run(1800);assert.equal(wall(r),undefined);assert.deepEqual(r.faults,[]);
 });
 test(`Barricade side ${side}: obstructed placement retains mana and existing wall`,()=>{
  const r=game(side);r.run(1,[key]);const first=wall(r);r.run(60);
  r.globals.set(side===1?'qn98':'thom',100);
  const caster=r.originals.get(side===1?'00h9':'n8fg'),foe=r.originals.get(side===1?'n8fg':'00h9');
  caster.x-=50;foe.x=caster.x+25;foe.y=0;r.run(1,[key]);
  assert.equal(r.globals.get(side===1?'qn98':'thom'),100);assert.equal(wall(r),first);assert.equal(first.dead,false);
 });
 test(`Barricade side ${side}: blocks both players, permits jumping over, triggers one native wall slam`,()=>{
  const r=game(side),caster=r.originals.get(side===1?'00h9':'n8fg'),foe=r.originals.get(side===1?'n8fg':'00h9');
  r.run(1,[key]);const barrier=wall(r),left=r.bounds(barrier).left;
  r.move(caster,50,0);assert.ok(r.bounds(caster).right<=left);
  foe.x=barrier.x+40;r.move(foe,-60,0);assert.ok(r.bounds(foe).left>=r.bounds(barrier).right);
  const flag=side===1?'s77h':'0231',hp=side===1?'7ir2':'akf6',before=r.num(r.globals.get(hp));
  foe.x=barrier.x+40;r.globals.set(flag,1);r.move(foe,-60,0);r.run(1);
  assert.equal(r.num(r.globals.get(hp)),before-20);assert.equal(r.num(r.globals.get(flag)),0);
  r.move(foe,-60,0);r.run(1);assert.equal(r.num(r.globals.get(hp)),before-20);
  caster.y=r.bounds(barrier).top+20;const x=caster.x;r.move(caster,60,0);assert.equal(caster.x,x+60);
  assert.deepEqual(r.faults,[]);
 });
 test(`Barricade side ${side}: fast native bullets use mode damage and destroy at 30 HP`,()=>{
  const r=game(side);r.run(1,[key]);const barrier=wall(r),gun=r.originals.get('pvlq');
  assert.deepEqual(gun.def.barricadeDamage,{'0':4,'1':1,'2':10});
  for(let i=0;i<8;i++){
   const bullet=r.makeEntity(gun.def,gun);Object.assign(bullet,{clone:true,x:barrier.x-50,y:barrier.y,width:4,height:4,regX:2,regY:2,scaleX:1,scaleY:1,visible:true});
   r.globals.set('rr24',0);r.entities.push(bullet);r.move(bullet,100,0);assert.equal(bullet.dead,true);
   assert.equal(barrier.barricadeHealth,Math.max(0,30-(i+1)*4));
  }
  assert.equal(barrier.dead,true);
 });
}

for(const side of [1,2]){
 test(`Barricade side ${side}: airborne gravity, landing, void damage and owner spawn without displacing players`,()=>{
  const r=game(side),caster=r.originals.get(side===1?'00h9':'n8fg'),foe=r.originals.get(side===1?'n8fg':'00h9');
  r.run(1);const home={...r.secondarySkills.state(side).barricadeSpawn};
  caster.x=80;caster.y=70;r.run(1,[side===1?82:80]);const barrier=wall(r),start=barrier.y,decayAt=barrier.barricadeDecayAt;
  assert.ok(barrier.barricadeFallSpeed>0);r.run(12);assert.ok(barrier.y<start);
  r.run(40);assert.ok(r.bounds(barrier).bottom>=r.testGround-.001);assert.ok(r.bounds(barrier).bottom<r.testGround+1);assert.equal(barrier.barricadeFallSpeed,0);
  caster.x=home.x;caster.y=home.y-9;foe.x=home.x+25;foe.y=caster.y;
  const players=[[caster.x,caster.y],[foe.x,foe.y]];
  r.collisionProvider=()=>false;barrier.y=-251;r.run(1);
  assert.equal(barrier.barricadeHealth,20);assert.equal(barrier.y,home.y);
  assert.notEqual(barrier.x,home.x);assert.ok(!r.overlap(barrier,caster)&&!r.overlap(barrier,foe));
  assert.deepEqual([[caster.x,caster.y],[foe.x,foe.y]],players);
  assert.equal(barrier.barricadeDecayAt,decayAt);
  barrier.y=-251;r.run(1);assert.equal(barrier.barricadeHealth,10);
  barrier.y=-251;r.run(1);assert.equal(barrier.barricadeHealth,0);assert.equal(barrier.dead,true);
  assert.deepEqual(r.faults,[]);
 });
}

for(const side of [1,2]){
 test(`Barricade side ${side}: direct ray damage and subsequent native status effects hit the wall instead`,()=>{
  const r=game(side),key=side===1?82:80;
  r.run(1,[key]);const barrier=wall(r),victim=r.originals.get(side===1?'n8fg':'00h9');
  const gun=r.originals.get(side===1?'pvlq':'wlga')||r.originals.get('pvlq');
  gun.x=barrier.x-50;gun.y=barrier.y;victim.x=barrier.x+50;victim.y=barrier.y;
  const hp=side===1?'7ir2':'akf6',before=r.globals.get(hp),slow=side===1?'nccn':'9af4';
  r.globals.set(slow,0);
  r.spawn(gun,function*(rt,c){
   yield*rt.call(c,side===1?'qy83':'05j0',[-7,10,1]);
   rt.command(c,'set_variable',[slow,18]);rt.command(c,'change_variable',['oafg',1]);
  },'test_barricade_ray');r.run(1);
  assert.equal(barrier.barricadeHealth,23);assert.equal(r.globals.get(hp),before);
  assert.equal(r.globals.get(slow),0);assert.equal(r.num(r.globals.get('oafg')),0);assert.deepEqual(r.faults,[]);
 });
}

test('Barricade health decays once per second, with no native damage calls or floating damage entities',()=>{
 const r=game(),key=82;r.run(1,[key]);const barrier=wall(r);
 const beforeHP=[r.globals.get('akf6'),r.globals.get('7ir2')],calls=[],call=r.call.bind(r);
 const textIds=new Set(r.entities.filter(e=>e.def.objectType==='textBox').map(e=>e.uid));
 r.call=function*(c,id,args){calls.push(id);yield*call(c,id,args);};
 r.run(59);assert.equal(barrier.barricadeHealth,30);
 r.run(1);assert.equal(barrier.barricadeHealth,29);
 assert.equal(barrier.barricadeUntil,undefined);
 r.run(60);assert.equal(barrier.barricadeHealth,28);
 assert.deepEqual(calls,[]);assert.deepEqual([r.globals.get('akf6'),r.globals.get('7ir2')],beforeHP);
 const bullet=r.makeEntity(r.defs.get('pvlq'),r.originals.get('pvlq'));
 Object.assign(bullet,{clone:true,x:barrier.x-30,y:barrier.y,width:4,height:4,regX:2,regY:2,scaleX:1,scaleY:1,visible:true});
 r.globals.set('rr24',0);r.entities.push(bullet);r.move(bullet,60,0);
 assert.equal(barrier.barricadeHealth,24);assert.deepEqual(calls,[]);
 assert.ok(!r.entities.some(e=>!e.dead&&e.def.objectType==='textBox'&&!textIds.has(e.uid)));
});

test('Melee weapons and point-distance punches can damage a barricade without a player behind it',()=>{
 for(const distanceAttack of [false,true]){
  const r=game();r.run(1,[82]);const barrier=wall(r),axe=r.originals.get('f5gc');
  Object.assign(axe,{x:barrier.x,y:barrier.y,width:6,height:6,regX:3,regY:3,scaleX:1,scaleY:1,visible:true});
  r.originals.get('n8fg').x=180;
  const hp=r.globals.get('7ir2');
  r.spawn(axe,function*(rt,c){
   const hit=distanceAttack?rt.value(c,'distance_something',[null,'ocqj',null])<13:
      rt.value(c,'reach_something',[null,'ocqj',null]);
   if(hit)yield*rt.call(c,'qy83',[-10,10,1]);
  },'test_melee_barricade');
  r.run(1);assert.equal(barrier.barricadeHealth,20);assert.equal(r.globals.get('7ir2'),hp);assert.deepEqual(r.faults,[]);
 }
});

test('Destroyed barricade emits three matching non-colliding fragments and cleans them up',()=>{
 const r=game();r.run(1,[82]);const barrier=wall(r);
 barrier.barricadeHealth=1;r.run(60);
 assert.equal(barrier.dead,true);
 const pieces=r.entities.filter(e=>e.secondaryEffect==='barricade-debris');
 assert.equal(pieces.length,3);
 for(const piece of pieces){
  assert.equal(piece.scaleX,barrier.scaleX);assert.equal(piece.scaleY,barrier.scaleY);
  assert.notEqual(piece.objectId,'6tzq');
 }
 const positions=pieces.map(e=>[e.x,e.y,e.rotation]);
 r.run(5);assert.notDeepEqual(pieces.map(e=>[e.x,e.y,e.rotation]),positions);
 r.run(22);assert.ok(pieces.every(e=>e.dead));assert.deepEqual(r.faults,[]);
});
