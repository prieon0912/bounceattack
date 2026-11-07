import test from 'node:test';

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Runtime} from '../public/src/runtime.js';
import {registerOriginal} from '../public/src/original-program.js';
const project=JSON.parse(fs.readFileSync(new URL('../public/data/project.json',import.meta.url)));
function game(character,side=1,mirror=false){const r=new Runtime(structuredClone(project),{headless:true});registerOriginal(r);r.start({p1:side===1||mirror?character:2,p2:side===2||mirror?character:2,seed:21,skills:side===1?['secondary','primary']:['primary','secondary']});for(let i=0;i<240;i++)r.step();for(const t of [...r.threads,...r.pending])t.cancelled=true;r.threads=[];r.pending=[];for(const [s,id] of [[1,'00h9'],[2,'n8fg']]){Object.assign(r.originals.get(id),{x:s===1?-20:20,y:0,visible:true});r.globals.set(s===1?'qn98':'thom',100);r.globals.set(s===1?'8w41':'wyyq',0);}r.globals.set('r71b',0);r.run=(n,keys=[])=>{r.keys=new Set(keys);for(let i=0;i<n;i++)r.step();};return r;}
const body=(r,s)=>r.originals.get(s===1?'00h9':'n8fg');
import {RAGE_QUIT,HUNTING_TRAP,TURRET,boomTurret} from '../public/src/tactical-secondary-skills.js';

for(const side of [1,2]){
 const key=side===1?82:80;
 test(`Rage Quit side ${side}: original damage pipeline, native recoil, slow and range`,()=>{const r=game(34,side,true),foe=3-side,calls=[];r.collisionProvider=()=>false;const original=r.call.bind(r);r.call=function*(c,id,args){if(id===(side===1?'qy83':'05j0'))calls.push(args[0]);yield*original(c,id,args);};r.run(3,[key]);assert.deepEqual(calls,[-7]);assert.equal(r.globals.get(side===1?'qn98':'thom'),66);assert.ok(Math.abs(r.globals.get(foe===1?'c9o4':'lgp6'))>0);assert.equal(r.secondarySkills.state(side).slow.value,8);r.run(90);assert.ok(r.secondarySkills.state(side).slow.until<=r.tick);assert.deepEqual(r.faults,[]);
 const far=game(34,side);body(far,foe).x=body(far,side).x+56;far.run(3,[key]);assert.equal(far.secondarySkills.state(side).slow,undefined);
 });
 test(`Rage Quit side ${side}: invisible targets and CC immunity respected`,()=>{for(const stealth of [true,false]){const r=game(34,side),foe=3-side;r.globals.set(stealth?(foe===1?'ob2m':'rav6'):(foe===1?'jcf6':'ec6d'),1);r.run(3,[key]);assert.equal(r.secondarySkills.state(side).slow,undefined);assert.equal(r.num(r.globals.get(foe===1?'c9o4':'lgp6')),0);assert.deepEqual(r.faults,[]);}});
 test(`Hunting Trap side ${side}: original spear arc, ground net, feet-only root and expiry`,()=>{const r=game(9,side),st=r.secondarySkills.state(side),owner=r.originals.get(side===1?'5rp3':'6xoo'),foe=3-side,dir=side===1?1:-1;Object.assign(body(r,side),{x:-dir*180,y:6});r.globals.set(side===1?'etjn':'846x',dir>0?1:0);body(r,foe).y=100;r.collisionProvider=(e,id)=>id==='6tzq'&&e.y<=0;r.run(1,[key]);assert.ok(st.netUid);assert.equal(st.armed,undefined);assert.equal(r.globals.get(side===1?'qn98':'thom'),70);
 const child=r.makeEntity(owner.def,owner);r.secondarySkills.onClone({e:owner,block:'7jk9'},child);assert.equal(child.dead,false);let x=body(r,side).x,y=body(r,side).y+4,speed=8,tilt=1.5;for(let tick=0;tick<10;tick++){speed-=.02;tilt-=.06;x+=dir*Math.cos(tilt*5*Math.PI/180)*speed/1.4;y+=Math.sin(tilt*5*Math.PI/180)*speed/1.4;r.run(1);const net=r.entities.find(e=>e.uid===st.netUid);assert.ok(Math.abs(net.x-x)<1e-8);assert.ok(Math.abs(net.y-y)<1e-8);}r.run(100);const net=r.entities.find(e=>e.uid===st.netUid);assert.ok(net?.trapLanded);assert.ok(net.y>=0&&net.y<1);assert.ok(Math.abs(net.scaleX/net.scaleY-1/.22)<1e-8);body(r,foe).x=net.x;body(r,foe).y=net.y+50;r.run(2);assert.equal(net.dead,false);assert.equal(r.num(r.globals.get(foe===1?'05ze':'1vu0')),0);body(r,foe).y=net.y+r.size(body(r,foe))/2;r.run(2);assert.equal(net.dead,true);assert.ok(r.num(r.globals.get(foe===1?'05ze':'1vu0'))>=1.8);assert.equal(st.netUid,undefined);assert.ok(r.entities.some(e=>e.secondaryEffect==='secondary-root'&&!e.dead));assert.deepEqual(r.faults,[]);
 const expires=game(9,side),o=expires.originals.get(side===1?'5rp3':'6xoo');Object.assign(body(expires,side),{x:-dir*180,y:6});body(expires,foe).y=100;expires.globals.set(side===1?'etjn':'846x',dir>0?1:0);expires.collisionProvider=(e,id)=>id==='6tzq'&&e.y<=0;expires.run(1,[key]);expires.run(500);assert.equal(expires.secondarySkills.state(side).netUid,undefined);assert.deepEqual(expires.faults,[]);
 });
 test(`Turret side ${side}: stationary, every 3 seconds, native basic missiles in both directions`,()=>{const r=game(23,side),st=r.secondarySkills.state(side),caster=body(r,side);r.collisionProvider=()=>false;const x=caster.x,y=caster.y;const busy=side===1?'rr24':'qvkr',facing=side===1?'etjn':'846x';r.globals.set(busy,1);r.globals.set(facing,1);r.run(1,[key]);assert.equal(r.globals.get(side===1?'qn98':'thom'),40);const turret=r.entities.find(e=>e.uid===st.turretUid);caster.x+=100;caster.y+=40;r.run(179);assert.equal(st.turretShots,0);r.run(2);assert.equal(st.turretShots,2);assert.equal(turret.x,x);assert.equal(turret.y,y-2);const shots=r.entities.filter(e=>e.secondaryEffect==='turret-rocket'&&!e.dead);assert.equal(shots.length,2);assert.ok(shots.some(e=>e.rotation===0));assert.ok(shots.some(e=>e.rotation===180));for(const shot of shots){assert.ok(Math.abs(shot.x-x)<30);assert.ok(Math.abs(shot.y-(y-1))<1e-8);assert.equal(r.get(shot,busy),0);assert.equal(shot.picture.id,side===1?'ogvv':'febz');}assert.equal(r.globals.get(busy),1);assert.equal(r.globals.get(facing),1);r.run(360);assert.equal(st.turretShots,6);assert.equal(st.turretUid,undefined);assert.equal(turret.dead,true);assert.deepEqual(r.faults,[]);});
}
test('All three primary skills remain and their new secondary names are registered',()=>{for(const [character,name] of [[34,'빡종'],[9,'사냥용 덫'],[23,'터렛']]){const r=game(character),d=r.secondarySkills.definitions.get(character);assert.equal(d.name,name);assert.ok(d.primaryName);assert.notEqual(d.primaryName,name);assert.ok(d.primaryPictureId);assert.ok(r.project.objects.find(o=>o.id==='o9rj').sprite.pictures.some(p=>p.id===d.secondaryPictureId));}});


import {stateHash} from '../public/src/frame-sync.js';
function liveGame(character){const r=new Runtime(structuredClone(project),{headless:true});registerOriginal(r);r.start({p1:character,p2:character,seed:89,skills:['secondary','secondary']});for(let i=0;i<240;i++)r.step();for(const side of [1,2]){Object.assign(body(r,side),{x:side===1?-80:80,y:0});r.globals.set(side===1?'qn98':'thom',100);}r.collisionProvider=(e,id)=>id==='6tzq'&&!e.clone&&e.y < -5;return r;}
test('Hunting Trap fires immediately on R/P without a basic attack; later E/Enter remain ordinary spears',()=>{const r=liveGame(9);r.keys=new Set([82,80]);r.step();for(const side of [1,2]){assert.ok(r.secondarySkills.state(side).netUid);assert.equal(r.secondarySkills.state(side).armed,undefined);assert.ok(r.globals.get(side===1?'qn98':'thom')>=70&&r.globals.get(side===1?'qn98':'thom')<70.2);}r.keys.clear();r.step();assert.equal(r.entities.filter(e=>e.secondaryEffect==='hunting-net'&&!e.dead).length,2);r.keys=new Set([69,13]);for(let i=0;i<35;i++)r.step();assert.ok(r.entities.some(e=>e.clone&&!e.dead&&e.objectId==='5rp3'));assert.ok(r.entities.some(e=>e.clone&&!e.dead&&e.objectId==='6xoo'));assert.deepEqual(r.faults,[]);});

test('New skills stay deterministic with simultaneous mirrored casts and ongoing native combat',()=>{for(const character of [9,23,34]){const a=liveGame(character),b=liveGame(character);for(let tick=0;tick<400;tick++){for(const r of [a,b]){r.keys=new Set(tick===0?[82,80]:tick>5&&tick<60?[69,13]:[]);r.step();}}assert.deepEqual(a.faults,[],`character ${character}`);assert.equal(stateHash(a),stateHash(b),`character ${character}`);}});

import {RoomHub} from '../server/rooms.js';
import {MemoryStore} from '../server/store.js';
test('Original blurred menu preserves primary skills and resets 2P default for the new skills',()=>{for(const character of [9,23,34]){const r=game(character);r.loadScene('1ckl');r.globals.set('jx38',1);r.globals.set('16fh',character);r.globals.set('yraj',1);r.secondarySkills.syncSelection();const d=r.secondarySkills.definitions.get(character);assert.equal(r.originals.get('o9rj').picture.id,d.primaryPictureId);assert.ok(r.secondarySkills.selectKey(82));assert.equal(r.originals.get('o9rj').picture.id,d.secondaryPictureId);assert.equal(r.originals.get('3my6').text,d.description);r.globals.set('y75t',character);r.command({e:r.originals.get('o9rj')},'set_variable',['jx38',2]);r.secondarySkills.syncSelection();assert.equal(r.secondarySkills.choice(1),'secondary');assert.equal(r.secondarySkills.selectionInfo(2).name,d.primaryName);r.globals.set('yraj',0);assert.equal(r.secondarySkills.selectKey(80),false);}});
test('Matchmaking accepts all three secondaries, including same-character matches',async()=>{for(const character of [9,23,34]){const hub=new RoomHub(new MemoryStore()),build='a'.repeat(64);await hub.matchmake({},{build,character,skill:'secondary'});const room=await hub.matchmake({},{build,character,skill:'secondary'});assert.deepEqual(room.match.skills,['secondary','secondary']);}});

for(const side of [1,2])test(`Turret side ${side}: proximity destroys turret for remaining missiles times three, native CC, MP60`,()=>{for(const elapsed of [0,180,360]){const r=game(23,side),st=r.secondarySkills.state(side),caster=body(r,side),target=body(r,3-side),calls=[];r.collisionProvider=()=>false;target.x=caster.x+120;const original=r.call.bind(r);r.call=function*(c,id,args){if(id===(side===1?'qy83':'05j0'))calls.push(args[0]);yield*original(c,id,args);};r.run(1,[side===1?82:80]);assert.equal(r.globals.get(side===1?'qn98':'thom'),40);r.run(elapsed);const shots=st.turretShots,turret=r.entities.find(e=>e.uid===st.turretUid);target.x=turret.x+10;target.y=turret.y;r.run(2);assert.deepEqual(calls,[-(6-shots)*3]);assert.equal(st.turretBurstDamage,(6-shots)*3);assert.equal(turret.dead,true);assert.equal(st.turretUid,undefined);assert.equal(st.turretShots,shots);assert.equal(st.slow.value,8);assert.ok(r.num(r.globals.get(side===1?'lgp6':'c9o4'))>0);r.run(200);assert.equal(st.turretShots,shots);assert.deepEqual(r.faults,[]);}});

test('Turret proximity does not reveal stealth and respects CC immunity',()=>{for(const side of [1,2])for(const hidden of [true,false]){const r=game(23,side),foe=3-side,st=r.secondarySkills.state(side);body(r,foe).x=body(r,side).x+10;r.globals.set(hidden?(foe===1?'ob2m':'rav6'):(foe===1?'jcf6':'ec6d'),1);r.run(3,[side===1?82:80]);if(hidden){assert.ok(st.turretUid);assert.equal(st.turretBurstDamage,undefined);}else{assert.equal(st.turretUid,undefined);assert.equal(st.turretBurstDamage,18);assert.equal(st.slow,undefined);assert.equal(r.num(r.globals.get(foe===1?'c9o4':'lgp6')),0);}assert.deepEqual(r.faults,[]);}});

for (const side of [1,2]) {
 const key=side===1?82:80,dir=side===1?1:-1;
 test(`Jab side ${side}: strikes in front once without moving the caster`,()=>{
  const r=game(8,side),caster=body(r,side),target=body(r,3-side),x=caster.x;
  target.x=x+dir*42;r.globals.set(side===1?'etjn':'846x',side===1?1:0);
  const hits=[],call=r.call.bind(r);
  r.call=function*(c,id,args){if(id===(side===1?'qy83':'05j0'))hits.push(args[0]);yield*call(c,id,args);};
  r.run(12,[key]);assert.deepEqual(hits,[-5]);assert.equal(caster.x,x);assert.deepEqual(r.faults,[]);
 });
 test(`Water Pillar side ${side}: anchored to ground, hits and lifts once; no floor costs no MP`,()=>{
  const r=game(21,side),caster=body(r,side),target=body(r,3-side);
  r.globals.set(side===1?'etjn':'846x',side===1?1:0);
  target.x=caster.x+dir*24;target.y=22;
  const mana=side===1?'qn98':'thom',hits=[],call=r.call.bind(r);
  r.call=function*(c,id,args){if(id===(side===1?'qy83':'05j0'))hits.push(args[0]);yield*call(c,id,args);};
  r.collisionProvider=()=>false;r.run(1,[key]);assert.equal(r.globals.get(mana),100);
  r.run(1);r.collisionProvider=(e,id)=>id==='6tzq'&&r.bounds(e).bottom<-12;
  r.run(1,[key]);const effect=r.entities.find(e=>e.secondaryEffect==='wart-water-pillar');
  assert.ok(effect);assert.ok(Math.abs(effect.y+12)<.02);assert.equal(effect.regY,effect.height);
  r.run(22);assert.deepEqual(hits,[-4]);assert.equal(r.globals.get(mana),74);
  const vy=side===1?'iblx':'du2p',state=r.secondarySkills.state(side);
  assert.equal(r.num(r.globals.get(vy)),1.35);assert.equal(state.slow,undefined);
  r.globals.set(vy,-.1);r.run(1);assert.equal(state.slow.until-r.tick,120);
  assert.equal(state.slow.side,3-side);assert.deepEqual(r.faults,[]);
 });
}

for(const side of [1,2])test(`Elemental Sword Arts side ${side}: all forms deal damage and apply their distinct effects`,()=>{
 for(const form of [0,1,2]){
  const r=game(24,side,true),e=body(r,side),foe=body(r,3-side),key=side===1?82:80;
  r.set(e,'arfp',form);r.globals.set(side===1?'etjn':'846x',side===1?1:0);
  r.collisionProvider=()=>false;foe.x=e.x+(side===1?25:-25);
  const hp=side===1?'akf6':'7ir2',max=side===1?'xr74':'67ko';
  r.globals.set(max,100);r.globals.set(hp,90);
  const received=[],native=r.functions.get(side===1?'qy83':'05j0'),param=native.params[0];
  r.functions.set(side===1?'qy83':'05j0',{...native,fn:function*(rt,c){received.push(c.args[param]);yield* native.fn(rt,c);}});
  const start=r.tick;r.run(12,[key]);assert.deepEqual(received,[[-8,-7,-6][form]]);
  assert.equal(r.globals.get(side===1?'qn98':'thom'),59);
  assert.equal(r.secondarySkills.state(side).readyAt-start,form===2?241:61);
  if(form===0){assert.ok(r.secondarySkills.state(side).slow.until>r.tick);r.run(185);assert.deepEqual(received,[-8,-2,-2,-2]);}
  if(form===1){const stun=side===1?'wyyq':'8w41';assert.equal(r.num(r.globals.get(stun)),1);r.run(35);assert.equal(r.num(r.globals.get(stun)),0);}
  if(form===2){
   const fire=()=>r.spawn(e,function*(rt,c){yield* rt.call(c,side===1?'qy83':'05j0',[-5,0,1]);},'test_water_boost');
   const x=e.x;e.x=x+45;fire();r.run(1);assert.equal(received.at(-1),-5);
   e.x=x;fire();r.run(1);assert.equal(received.at(-1),-6);
   r.run(173);assert.equal(r.num(r.globals.get(hp)),93);
   fire();r.run(1);assert.equal(received.at(-1),-5);
   r.set(e,'arfp',0);r.run(1);r.set(e,'arfp',2);
   assert.equal(r.secondarySkills.state(side).waterBoost,undefined);
  }
  assert.deepEqual(r.faults,[]);
 }
});

for(const side of [1,2]){
 const key=side===1?82:80,fn=side===1?'qy83':'05j0',stun=side===1?'8w41':'wyyq',root=side===1?'05ze':'1vu0';
 test(`Blessing side ${side}: cleanses through stun, then modifies attack and defense for three seconds`,()=>{
  const r=game(33,side),actor=body(r,side),def=side===1?'mm0r':'nmkh';
  r.globals.set(stun,1);r.globals.set(root,2);r.globals.set(def,1);
  const enemy=body(r,3-side),mark=r.originals.get('z46k');
  r.globals.set(side===1?'s5vb':'y75t',25);r.set(enemy,'zxd6',1.8);mark.visible=true;
  r.run(1,[key]);assert.equal(r.get(enemy,'zxd6'),1.8);assert.equal(mark.visible,true);
  r.set(actor,side===1?'akf6':'7ir2',95);
  assert.equal(r.secondarySkills.state(side).blessingHitAt,r.tick);
  assert.equal(r.num(r.globals.get(stun)),0);assert.equal(r.num(r.globals.get(root)),0);assert.equal(r.get(actor,def),.7);
  const args=[-10,0,1];r.secondarySkills.onFunction({e:actor},fn,args);assert.equal(args[0],-13);
  r.run(180);assert.equal(r.get(actor,def),1);assert.deepEqual(r.faults,[]);
 });
 test(`Darkness side ${side}: charges 40 energy and only wolf hits cause fear`,()=>{
  const r=game(29,side,true),wolf=r.originals.get(side===1?'jk2d':'5isi'),mana=side===1?'qn98':'thom',fear=side===1?'mnus':'mfr0';
  r.globals.set(mana,60);r.run(1,[key]);assert.equal(r.globals.get(mana),10);
  r.set(wolf,'0m2d',0);r.secondarySkills.onFunction({e:wolf},fn,[-7,0,1]);assert.equal(r.secondarySkills.state(side).fear,undefined);
  r.set(wolf,'0m2d',1);r.secondarySkills.onFunction({e:wolf},fn,[-7,0,1]);assert.equal(r.num(r.globals.get(fear)),1);
  r.run(50);assert.equal(r.num(r.globals.get(fear)),0);
  r.run(250);assert.equal(r.globals.get(mana),50);assert.deepEqual(r.faults,[]);
 });
 test(`Firework side ${side}: separate direct and explosion damage, both gain the original mark bonus`,()=>{
  for(const marked of [false,true]){
   const r=game(25,side,true),caster=body(r,side);r.collisionProvider=()=>false;
   r.globals.set(side===1?'etjn':'846x',side===1?1:0);r.set(caster,'zxd6',marked?1.8:0);
   const hits=[],call=r.call.bind(r);r.call=function*(c,id,args){if(id===fn)hits.push(args[0]);yield*call(c,id,args);};
   r.run(10,[key]);assert.deepEqual(hits,marked?[-8,-12]:[-5,-9]);
   assert.equal(r.num(r.get(caster,'zxd6')),0);
   assert.ok(r.entities.some(e=>e.secondaryEffect==='firework-blast'));
   assert.ok(!r.entities.some(e=>e.secondaryEffect==='firework-arrow'));assert.deepEqual(r.faults,[]);
  }
 });
}

for(const side of [1,2]){
 const key=side===1?82:80,foe=3-side,mana=side===1?'thom':'qn98';
 test(`Invader pulse side ${side}: consumes own stacks, damages and drains MP, one-second cooldown`,()=>{
  const r=game(13,side,true),owner=r.originals.get(side===1?'wkk5':'6r3z');
  r.set(owner,'oafg',6);r.set(owner,'s9yw',1);
  const other=r.originals.get(side===1?'6r3z':'wkk5');r.set(other,'oafg',4);
  const hits=[],call=r.call.bind(r);
  r.call=function*(c,id,args){if(id===(side===1?'qy83':'05j0'))hits.push(args[0]);yield*call(c,id,args);};
  r.run(1,[key]);assert.deepEqual(hits,[-10]);assert.equal(r.globals.get(mana),91);
  assert.equal(r.get(owner,'oafg'),0);assert.equal(r.get(other,'oafg'),4);
  const ring=r.entities.find(e=>e.secondaryEffect==='invader-pulse');assert.ok(ring);
  r.run(29,[key]);assert.equal(hits.length,1);
  r.set(owner,'oafg',2);r.run(30);r.run(1,[key]);assert.deepEqual(hits,[-10,-6]);
  assert.equal(r.globals.get(mana),88);assert.deepEqual(r.faults,[]);
 });
 test(`Invader pulse side ${side}: range and stealth preserve stacks and target mana`,()=>{
  for(const mode of ['far','hidden']){
   const r=game(13,side,true),owner=r.originals.get(side===1?'wkk5':'6r3z');
   r.set(owner,'oafg',6);
   if(mode==='far')body(r,foe).x=body(r,side).x+81;
   else r.globals.set(foe===1?'ob2m':'rav6',1);
   r.run(1,[key]);assert.equal(r.get(owner,'oafg'),6);assert.equal(r.globals.get(mana),100);assert.deepEqual(r.faults,[]);
  }
 });
}
