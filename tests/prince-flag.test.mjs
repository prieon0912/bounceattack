
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Runtime} from '../public/src/runtime.js';
import {registerOriginal} from '../public/src/original-program.js';
const project=JSON.parse(fs.readFileSync(new URL('../public/data/project.json',import.meta.url)));
function game(side){
 const r=new Runtime(structuredClone(project),{headless:true});registerOriginal(r);
 r.start({p1:22,p2:22,skills:side===1?['secondary','primary']:['primary','secondary'],seed:52});
 for(let i=0;i<240;i++)r.step();for(const t of [...r.threads,...r.pending])t.cancelled=true;r.threads=[];r.pending=[];
 for(const [s,id] of [[1,'00h9'],[2,'n8fg']]){Object.assign(r.originals.get(id),{x:s===side?0:180,y:0,visible:true});r.globals.set(s===1?'qn98':'thom',100);r.globals.set(s===1?'8w41':'wyyq',0);}
 r.globals.set('r71b',0);r.collisionProvider=()=>false;
 r.run=(n,keys=[])=>{r.keys=new Set(keys);for(let i=0;i<n;i++)r.step();};return r;
}
const flags=r=>r.entities.filter(e=>!e.dead&&e.secondaryEffect==='prince-flag');
for(const side of [1,2]){
 const key=side===1?82:80,boost=side===1?'1g8o':'bct6',shield=side===1?'cfmd':'g4sc';
 test(`Royal flag side ${side}: HP1, radius65, multiple overlapping flags, ten-second lifetime`,()=>{
  const r=game(side),weapon=r.originals.get(side===1?'z4wa':'l8ny'),caster=r.originals.get(side===1?'00h9':'n8fg');
  r.run(1,[key]);const first=flags(r)[0];assert.ok(first);assert.equal(first.installationHealth,1);
  assert.equal(r.globals.get(side===1?'qn98':'thom'),65);
  r.run(59);r.globals.set(side===1?'qn98':'thom',100);r.run(1,[key]);
  assert.equal(flags(r).length,2);assert.equal(flags(r)[0].x,flags(r)[1].x);
  r.command({e:weapon},'set_variable',[boost,0]);assert.equal(r.globals.get(boost),-4.7);
  r.globals.set(shield,0);
  for(let i=0;i<4;i++)r.secondarySkills.onFunction({e:weapon,block:side===1?'j55n':'ce17'},side===1?'qy83':'05j0',[-7,10,1]);
  assert.equal(r.globals.get(shield),6);
  caster.x=66;r.command({e:weapon},'set_variable',[boost,0]);assert.equal(r.globals.get(boost),0);
  r.globals.set(shield,0);r.secondarySkills.onFunction({e:weapon,block:side===1?'j55n':'ce17'},side===1?'qy83':'05j0',[-7,10,1]);assert.equal(r.globals.get(shield),0);
  r.run(540);assert.equal(first.dead,true);assert.equal(flags(r).length,1);
  r.run(60);assert.equal(flags(r).length,0);assert.deepEqual(r.faults,[]);
 });
 test(`Royal flag side ${side}: one enemy bullet destroys a flag, friendly bullets pass`,()=>{
  const r=game(side);r.run(1,[key]);const flag=flags(r)[0],gun=r.originals.get('pvlq');
  function bullet(source){
   const e=r.makeEntity(gun.def,gun);Object.assign(e,{clone:true,combatSide:source,barricadeProjectileDamage:4,x:flag.x-30,y:flag.y,width:4,height:4,regX:2,regY:2,scaleX:1,scaleY:1,visible:true});
   r.entities.push(e);r.move(e,60,0);return e;
  }
  assert.equal(bullet(side).dead,false);assert.equal(flag.installationHealth,1);
  assert.equal(bullet(3-side).dead,true);assert.equal(flag.installationHealth,0);
  r.run(1);assert.equal(flag.dead,true);assert.equal(flags(r).length,0);
  assert.ok(!r.entities.some(e=>!e.dead&&e.flagOwnerUid===flag.uid));assert.deepEqual(r.faults,[]);
 });
}
