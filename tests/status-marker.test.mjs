
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Runtime} from '../public/src/runtime.js';
import {registerOriginal} from '../public/src/original-program.js';
const project=JSON.parse(fs.readFileSync(new URL('../public/data/project.json',import.meta.url)));
function setup(character,side,mirror){
 const r=new Runtime(structuredClone(project),{headless:true});registerOriginal(r);
 r.start({p1:side===1||mirror?character:2,p2:side===2||mirror?character:2,seed:42});
 for(const t of [...r.threads,...r.pending])t.cancelled=true;
 r.threads=[];r.pending=[];
 r.run=n=>{for(let i=0;i<n;i++)r.step();};
 return r;
}
for(const [character,object,variable,timer] of [[13,'ah4d','oafg','s9yw'],[15,'xjlj','ha8n','lq8z']]){
 for(const side of [1,2])for(const mirror of [false,true]){
  test(`Native stack marker ${character} side ${side}, mirror ${mirror}: appears after long idle, updates and disappears`,()=>{
   const r=setup(character,side,mirror);
   const marker=mirror&&side===2?r.mirrorOriginals.get(object):r.originals.get(object);
   const opposite=mirror?(side===1?r.mirrorOriginals.get(object):r.originals.get(object)):null;
   r.dispatchEntity(marker,'when_scene_start');if(opposite)r.dispatchEntity(opposite,'when_scene_start');
   r.run(1200);assert.equal(marker.visible,false);
   assert.ok(marker.effects.transparency>=0&&marker.effects.transparency<=100);
   r.set(marker,variable,2);r.set(marker,timer,1);r.run(25);
   assert.equal(marker.visible,true);assert.equal(marker.effects.transparency,0);
   const first=marker.picture.id;
   r.set(marker,variable,4);r.run(2);assert.notEqual(marker.picture.id,first);
   if(opposite){assert.equal(r.num(r.get(opposite,variable)),0);assert.equal(opposite.visible,false);}
   r.set(marker,variable,0);r.run(25);assert.equal(marker.visible,false);
   r.run(1000);r.set(marker,variable,2);r.set(marker,timer,1);r.run(25);
   assert.equal(marker.visible,true);assert.equal(marker.effects.transparency,0);
   assert.deepEqual(r.faults,[]);
  });
 }
}
test('Transparency commands clamp stored values, including repeated fades',()=>{
 const r=setup(13,1,false),e=r.originals.get('ah4d'),c={e};
 r.command(c,'change_effect_amount',['transparency',250]);assert.equal(e.effects.transparency,100);
 r.command(c,'add_effect_amount',['transparency',-10]);assert.equal(e.effects.transparency,90);
 r.command(c,'add_effect_amount',['transparency',-200]);assert.equal(e.effects.transparency,0);
 r.command(c,'change_effect_amount',['transparency',-20]);assert.equal(e.effects.transparency,0);
});
