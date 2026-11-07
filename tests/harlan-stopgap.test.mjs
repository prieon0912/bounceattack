
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Runtime} from '../public/src/runtime.js';
import {registerOriginal} from '../public/src/original-program.js';
const project=JSON.parse(fs.readFileSync(new URL('../public/data/project.json',import.meta.url)));
const sid=(s,a,b)=>s===1?a:b,body=(r,s)=>r.originals.get(sid(s,'00h9','n8fg')),weapon=(r,s)=>r.originals.get(sid(s,'nijg','e7ip'));
function game(p1,p2){
 const r=new Runtime(structuredClone(project),{headless:true});registerOriginal(r);r.start({p1,p2,skills:['secondary','secondary'],seed:17});
 for(let i=0;i<240;i++)r.step();for(const t of [...r.threads,...r.pending])t.cancelled=true;r.threads=[];r.pending=[];
 for(const s of [1,2]){
  Object.assign(body(r,s),{x:s===1?0:15,y:0,visible:true});
  for(const [id,value]of [[sid(s,'akf6','7ir2'),500],[sid(s,'qn98','thom'),100],[sid(s,'8w41','wyyq'),0],
   [sid(s,'mfr0','mnus'),0],[sid(s,'utbg','j88w'),0],[sid(s,'jcf6','ec6d'),0],[sid(s,'96zg','7rtf'),1]])r.globals.set(id,value);
 }
 r.globals.set('etjn',1);r.globals.set('846x',0);r.globals.set('r71b',0);r.collisionProvider=()=>false;
 r.run=(n,keys=[])=>{r.keys=new Set(keys);for(let i=0;i<n;i++)r.step();};return r;
}
for(const side of [1,2]){
 const key=sid(side,82,80),attack=sid(side,69,13);
 test(`Stopgap side ${side}: MP32, melee and wave deal 4+4, or 8+6 against fear`,()=>{
  for(const feared of [false,true]){
   const r=game(side===1?26:2,side===2?26:2),w=weapon(r,side);
   r.set(w,'zhz6',1);r.globals.set(sid(3-side,'mfr0','mnus'),feared?1:0);
   const hits=[],call=r.call.bind(r);r.call=function*(c,id,args){if(id===sid(side,'qy83','05j0'))hits.push(args[0]);yield*call(c,id,args);};
   r.run(10,[key,attack]);assert.deepEqual(hits,feared?[-8,-6]:[-4,-4]);
   assert.equal(r.globals.get(sid(side,'qn98','thom')),68);
   assert.ok(r.secondarySkills.replacesKey(attack));
   assert.equal(r.entities.filter(e=>e.objectId===w.objectId&&e.clone).length,0);
   r.run(300);assert.equal(r.secondarySkills.state(side).stopgapUntil,undefined);
   assert.equal(r.get(w,'zhz6'),1);assert.deepEqual(r.faults,[]);
  }
 });
 test(`Stopgap side ${side}: native pickup immediately removes temporary blade and restores the original throw`,()=>{
  const r=game(side===1?26:2,side===2?26:2),w=weapon(r,side);
  r.set(w,'zhz6',1);r.dispatchEntity(w,'when_scene_start');r.run(1,[key]);r.run(10,[attack]);
  const blade=r.entities.find(e=>e.secondaryEffect==='harlan-stopgap');assert.ok(blade);
  assert.equal(r.entities.filter(e=>e.objectId===w.objectId&&e.clone).length,0);
  r.command({e:w},'set_variable',['zhz6',0]);
  assert.equal(blade.dead,true);assert.equal(r.secondarySkills.state(side).stopgapUntil,undefined);
  assert.equal(r.secondarySkills.replacesKey(attack),false);
  r.run(1,[attack]);assert.ok(r.entities.some(e=>e.objectId===w.objectId&&e.clone));
  assert.deepEqual(r.faults,[]);
 });
}
test('Mirrored Harans track their real daggers and temporary blades independently',()=>{
 const r=game(26,26);r.set(weapon(r,1),'zhz6',1);r.set(weapon(r,2),'zhz6',1);
 r.run(1,[82,80]);assert.ok(r.secondarySkills.state(1).stopgapUntil);assert.ok(r.secondarySkills.state(2).stopgapUntil);
 r.command({e:weapon(r,1)},'set_variable',['zhz6',0]);
 assert.equal(r.secondarySkills.state(1).stopgapUntil,undefined);assert.ok(r.secondarySkills.state(2).stopgapUntil);
 assert.equal(r.get(weapon(r,2),'zhz6'),1);
});
for(const michael of [1,2]){
 const foe=3-michael,key=sid(michael,82,80),fear=sid(michael,'mfr0','mnus'),speed=sid(michael,'utbg','j88w');
 test(`Blessing side ${michael} terminates native Haran fear and its forced movement`,()=>{
  const r=game(michael===1?33:26,michael===2?33:26),harlan=weapon(r,foe),msg=sid(michael,'w9n1','smzv');
  r.dispatchEntity(harlan,'when_message_cast',msg);r.run(2);
  assert.equal(r.num(r.globals.get(fear)),1);assert.notEqual(r.num(r.globals.get(speed)),0);
  r.globals.set(sid(michael,'96zg','7rtf'),1.5);r.run(1,[key]);
  assert.equal(r.num(r.globals.get(fear)),0);assert.equal(r.num(r.globals.get(speed)),0);
  assert.equal(r.num(r.globals.get(sid(michael,'96zg','7rtf'))),1);
  r.run(30);assert.equal(r.num(r.globals.get(fear)),0);assert.equal(r.num(r.globals.get(speed)),0);assert.deepEqual(r.faults,[]);
 });
 test(`Blessing side ${michael} terminates Lycan darkness fear without reapplication`,()=>{
  const r=game(michael===1?33:29,michael===2?33:29);
  r.run(1,[sid(foe,82,80)]);
  const wolf=r.originals.get(sid(foe,'jk2d','5isi'));r.set(wolf,'0m2d',1);
  r.secondarySkills.onFunction({e:wolf},sid(foe,'qy83','05j0'),[-7,0,1]);r.run(1);
  assert.equal(r.num(r.globals.get(fear)),1);
  r.run(1,[key]);assert.equal(r.num(r.globals.get(fear)),0);assert.equal(r.num(r.globals.get(speed)),0);
  r.run(30);assert.equal(r.num(r.globals.get(fear)),0);assert.equal(r.secondarySkills.state(foe).fear,undefined);
  assert.equal(r.num(r.globals.get(speed)),0);assert.deepEqual(r.faults,[]);
 });
}

for(const michael of [1,2]){
 test(`Haran temporary knife loses its fear bonus immediately after side ${michael} uses Blessing`,()=>{
  const side=3-michael,r=game(side===1?26:33,side===2?26:33),w=weapon(r,side);
  r.set(w,'zhz6',1);r.dispatchEntity(w,'when_message_cast',sid(michael,'w9n1','smzv'));r.run(1);
  r.run(1,[sid(michael,82,80)]);
  const hits=[],call=r.call.bind(r);r.call=function*(c,id,args){if(id===sid(side,'qy83','05j0'))hits.push(args[0]);yield*call(c,id,args);};
  r.run(10,[sid(side,82,80),sid(side,69,13)]);
  assert.deepEqual(hits,[-4,-4]);assert.equal(r.num(r.globals.get(sid(michael,'mfr0','mnus'))),0);assert.deepEqual(r.faults,[]);
 });
}

for(const side of [1,2]){
 test(`Stopgap side ${side}: native dagger size, native hilt pivot, muted tint and ranged wave`,()=>{
  const r=game(side===1?26:2,side===2?26:2),w=weapon(r,side),target=body(r,3-side),caster=body(r,side);
  r.set(w,'zhz6',1);
  const direction=side===1?1:-1;target.x=caster.x+direction*60;
  const hits=[],call=r.call.bind(r);r.call=function*(c,id,args){if(id===sid(side,'qy83','05j0'))hits.push(args[0]);yield*call(c,id,args);};
  r.run(1,[sid(side,82,80)]);
  const blade=r.entities.find(e=>e.secondaryEffect==='harlan-stopgap');
  assert.deepEqual([blade.width,blade.height,blade.regX,blade.regY],[w.width,w.height,w.regX,w.regY]);
  assert.equal(Math.abs(blade.scaleX),Math.abs(w.scaleX));assert.equal(Math.abs(blade.scaleY),Math.abs(w.scaleY));
  assert.ok(Math.abs(r.size(blade)-21)<1e-8);
  assert.equal(blade.picture.fileurl,'assets/secondary/harlan-stopgap-blade.svg');
  r.run(20,[sid(side,69,13)]);assert.deepEqual(hits,[-4]);assert.deepEqual(r.faults,[]);
 });
 test(`Stopgap side ${side}: wave checks fear on impact and stops after real dagger pickup`,()=>{
  const r=game(side===1?26:33,side===2?26:33),w=weapon(r,side),caster=body(r,side),target=body(r,3-side);
  r.set(w,'zhz6',1);target.x=caster.x+(side===1?1:-1)*60;
  r.globals.set(sid(3-side,'mfr0','mnus'),1);
  const hits=[],call=r.call.bind(r);r.call=function*(c,id,args){if(id===sid(side,'qy83','05j0'))hits.push(args[0]);yield*call(c,id,args);};
  r.run(1,[sid(side,82,80)]);r.run(6,[sid(side,69,13)]);
  assert.ok(r.entities.some(e=>e.secondaryEffect==='harlan-stopgap-wave'&&!e.dead));
  r.run(1,[sid(3-side,82,80)]);r.run(15);
  assert.deepEqual(hits,[-4]);
  r.run(36,[sid(side,69,13)]);r.command({e:w},'set_variable',['zhz6',0]);r.run(1);
  assert.ok(!r.entities.some(e=>e.secondaryEffect==='harlan-stopgap-wave'&&!e.dead));
  assert.deepEqual(r.faults,[]);
 });
}
