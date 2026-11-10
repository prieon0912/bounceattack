import test from 'node:test';

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Runtime} from '../public/src/runtime.js';
import {registerOriginal} from '../public/src/original-program.js';
const project=JSON.parse(fs.readFileSync(new URL('../public/data/project.json',import.meta.url)));
function game(character,side=1,mirror=false){const r=new Runtime(structuredClone(project),{headless:true});registerOriginal(r);r.start({p1:side===1||mirror?character:2,p2:side===2||mirror?character:2,seed:21,skills:side===1?['secondary','primary']:['primary','secondary']});for(let i=0;i<240;i++)r.step();for(const t of [...r.threads,...r.pending])t.cancelled=true;r.threads=[];r.pending=[];for(const [s,id] of [[1,'00h9'],[2,'n8fg']]){Object.assign(r.originals.get(id),{x:s===1?-20:20,y:0,visible:true});r.globals.set(s===1?'qn98':'thom',100);r.globals.set(s===1?'8w41':'wyyq',0);}r.globals.set('r71b',0);r.run=(n,keys=[])=>{r.keys=new Set(keys);for(let i=0;i<n;i++)r.step();};return r;}
const body=(r,s)=>r.originals.get(s===1?'00h9':'n8fg');
const turretFloor=(e,id)=>id==='6tzq'&&e.secondaryEffect==='boom-turret'&&e.y<-2;
import {RAGE_QUIT,HUNTING_TRAP,TURRET,boomTurret} from '../public/src/tactical-secondary-skills.js';

for(const side of [1,2]){
 const key=side===1?82:80;
 test(`Rage Quit side ${side}: original damage pipeline, native recoil, slow and range`,()=>{const r=game(34,side,true),foe=3-side,calls=[];r.collisionProvider=()=>false;const original=r.call.bind(r);r.call=function*(c,id,args){if(id===(side===1?'qy83':'05j0'))calls.push(args[0]);yield*original(c,id,args);};r.run(3,[key]);assert.deepEqual(calls,[-7]);assert.equal(r.globals.get(side===1?'qn98':'thom'),66);assert.ok(Math.abs(r.globals.get(foe===1?'c9o4':'lgp6'))>0);assert.equal(r.secondarySkills.state(side).slow.value,8);r.run(90);assert.ok(r.secondarySkills.state(side).slow.until<=r.tick);assert.deepEqual(r.faults,[]);
 const far=game(34,side);body(far,foe).x=body(far,side).x+RAGE_QUIT.radius+1;far.run(3,[key]);assert.equal(far.secondarySkills.state(side).slow,undefined);
 });
 test(`Rage Quit side ${side}: invisible targets and CC immunity respected`,()=>{for(const stealth of [true,false]){const r=game(34,side),foe=3-side;r.globals.set(stealth?(foe===1?'ob2m':'rav6'):(foe===1?'jcf6':'ec6d'),1);r.run(3,[key]);assert.equal(r.secondarySkills.state(side).slow,undefined);assert.equal(r.num(r.globals.get(foe===1?'c9o4':'lgp6')),0);assert.deepEqual(r.faults,[]);}});
 test(`Hunting Trap side ${side}: original spear arc, ground net, feet-only root and expiry`,()=>{const r=game(9,side),st=r.secondarySkills.state(side),owner=r.originals.get(side===1?'5rp3':'6xoo'),foe=3-side,dir=side===1?1:-1;Object.assign(body(r,side),{x:-dir*180,y:6});r.globals.set(side===1?'etjn':'846x',dir>0?1:0);body(r,foe).y=100;r.collisionProvider=(e,id)=>id==='6tzq'&&e.y<=0;r.run(1,[key]);assert.ok(st.netUid);assert.equal(st.armed,undefined);assert.equal(r.globals.get(side===1?'qn98':'thom'),70);
 const child=r.makeEntity(owner.def,owner);r.secondarySkills.onClone({e:owner,block:'7jk9'},child);assert.equal(child.dead,false);let x=body(r,side).x,y=body(r,side).y+4,speed=8,tilt=1.5;for(let tick=0;tick<10;tick++){speed-=.02;tilt-=.06;x+=dir*Math.cos(tilt*5*Math.PI/180)*speed/1.4;y+=Math.sin(tilt*5*Math.PI/180)*speed/1.4;r.run(1);const net=r.entities.find(e=>e.uid===st.netUid);assert.ok(Math.abs(net.x-x)<1e-8);assert.ok(Math.abs(net.y-y)<1e-8);}r.run(100);const net=r.entities.find(e=>e.uid===st.netUid);assert.ok(net?.trapLanded);assert.ok(net.y>=0&&net.y<1);assert.ok(Math.abs(net.scaleX/net.scaleY-1/.22)<1e-8);body(r,foe).x=net.x;body(r,foe).y=net.y+50;r.run(2);assert.equal(net.dead,false);assert.equal(r.num(r.globals.get(foe===1?'05ze':'1vu0')),0);body(r,foe).y=net.y+r.size(body(r,foe))/2;r.run(2);assert.equal(net.dead,true);assert.ok(r.num(r.globals.get(foe===1?'05ze':'1vu0'))>=1.8);assert.equal(st.netUid,undefined);assert.ok(r.entities.some(e=>e.secondaryEffect==='secondary-root'&&!e.dead));assert.deepEqual(r.faults,[]);
 const expires=game(9,side),o=expires.originals.get(side===1?'5rp3':'6xoo');Object.assign(body(expires,side),{x:-dir*180,y:6});body(expires,foe).y=100;expires.globals.set(side===1?'etjn':'846x',dir>0?1:0);expires.collisionProvider=(e,id)=>id==='6tzq'&&e.y<=0;expires.run(1,[key]);expires.run(500);assert.equal(expires.secondarySkills.state(side).netUid,undefined);assert.deepEqual(expires.faults,[]);
 });
 test(`Turret side ${side}: stationary, every 3 seconds, native basic missiles in both directions`,()=>{const r=game(23,side),st=r.secondarySkills.state(side),caster=body(r,side);r.collisionProvider=turretFloor;const x=caster.x,y=caster.y;const busy=side===1?'rr24':'qvkr',facing=side===1?'etjn':'846x';r.globals.set(busy,1);r.globals.set(facing,1);r.run(1,[key]);assert.equal(r.globals.get(side===1?'qn98':'thom'),49);const turret=r.entities.find(e=>e.uid===st.turretUid);caster.x+=100;caster.y+=40;r.run(179);assert.equal(st.turretShots,0);r.run(2);assert.equal(st.turretShots,2);assert.equal(turret.x,x);assert.equal(turret.y,y-2);const shots=r.entities.filter(e=>e.secondaryEffect==='turret-rocket'&&!e.dead);assert.equal(shots.length,2);assert.ok(shots.some(e=>e.rotation===0));assert.ok(shots.some(e=>e.rotation===180));for(const shot of shots){assert.ok(Math.abs(shot.x-x)<30);assert.ok(Math.abs(shot.y-(y-1))<1e-8);assert.equal(r.get(shot,busy),0);assert.equal(shot.picture.id,side===1?'ogvv':'febz');}assert.equal(r.globals.get(busy),1);assert.equal(r.globals.get(facing),1);r.run(420);assert.equal(st.turretShots,6);assert.equal(st.turretUid,undefined);assert.equal(turret.dead,true);assert.deepEqual(r.faults,[]);});
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

for(const side of [1,2])test(`Turret side ${side}: proximity is harmless, HP destruction explodes, MP51, immediate replacement`,()=>{
 for(const elapsed of [0,180,360]){
  const r=game(23,side),st=r.secondarySkills.state(side),caster=body(r,side),target=body(r,3-side),calls=[];
  r.collisionProvider=turretFloor;target.x=caster.x+120;
  const original=r.call.bind(r);r.call=function*(c,id,args){if(id===(side===1?'qy83':'05j0'))calls.push(args[0]);yield*original(c,id,args);};
  r.run(1,[side===1?82:80]);assert.equal(r.globals.get(side===1?'qn98':'thom'),49);r.run(elapsed);
  const shots=st.turretShots,turret=r.entities.find(e=>e.uid===st.turretUid);
  target.x=turret.x+10;target.y=turret.y;r.run(2);assert.equal(turret.dead,false);assert.equal(st.turretBurstDamage,undefined);
  turret.installationHealth=0;r.run(2);
  assert.deepEqual(calls,[-(2+(6-shots)*3)]);assert.equal(st.turretBurstDamage,2+(6-shots)*3);
  assert.equal(turret.dead,true);assert.equal(st.turretUid,undefined);assert.equal(st.slow.value,8);
  assert.ok(r.num(r.globals.get(side===1?'lgp6':'c9o4'))>0);
  r.globals.set(side===1?'qn98':'thom',100);r.run(1);r.run(1,[side===1?82:80]);assert.ok(st.turretUid);
  assert.deepEqual(r.faults,[]);
 }
});

test('Turret explosion excludes stealth and respects CC immunity',()=>{
 for(const side of [1,2])for(const hidden of [true,false]){
  const r=game(23,side),foe=3-side,st=r.secondarySkills.state(side);
  body(r,foe).x=body(r,side).x+10;
  r.globals.set(hidden?(foe===1?'ob2m':'rav6'):(foe===1?'jcf6':'ec6d'),1);
  r.run(1,[side===1?82:80]);const turret=r.entities.find(e=>e.uid===st.turretUid);
  turret.installationHealth=0;r.run(2);
  assert.equal(st.turretUid,undefined);assert.equal(st.turretBurstDamage,20);
  assert.equal(st.slow,undefined);assert.equal(r.num(r.globals.get(foe===1?'c9o4':'lgp6')),0);
  assert.deepEqual(r.faults,[]);
 }
});

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

for(const side of [1,2]){
 const key=side===1?82:80,dir=side===1?1:-1;
 test(`Reaper March side ${side}: dash 100, carries foe, roots and hits for 5 plus 3`,()=>{
  const r=game(15,side,true),caster=body(r,side),target=body(r,3-side),start=caster.x;
  r.collisionProvider=()=>false;r.globals.set(side===1?'etjn':'846x',dir>0?1:0);
  target.x=start+dir*100;
  const hits=[],call=r.call.bind(r);r.call=function*(c,id,args){if(id===(side===1?'qy83':'05j0'))hits.push(args[0]);yield*call(c,id,args);};
  r.run(19,[key]);assert.equal(caster.x,start+dir*100);assert.equal(caster.y,0);
  assert.deepEqual(hits,[-5,-3]);assert.equal(target.x,caster.x+dir*18);assert.ok(r.num(r.globals.get(side===1?'1vu0':'05ze'))>=1);assert.equal(r.globals.get(side===1?'qn98':'thom'),68);
  const slash=r.entities.find(e=>e.secondaryEffect==='reaper-march-slash');assert.equal(r.num(r.get(slash,'ha8n')),2);
  assert.equal(r.secondarySkills.state(side).reaperDashing,undefined);assert.deepEqual(r.faults,[]);
 });
 test(`Reaper March side ${side}: exits walls at safe position and respects stealth`,()=>{
  const r=game(15,side),caster=body(r,side),start=caster.x;r.globals.set(side===1?'etjn':'846x',1);
  r.collisionProvider=(e,id)=>id==='6tzq'&&e.x>=start+60;
  r.run(19,[key]);assert.ok(caster.x<start+60&&caster.x>=start+59);assert.equal(r.secondarySkills.state(side).reaperDashing,undefined);assert.deepEqual(r.faults,[]);
  const hidden=game(15,side);hidden.collisionProvider=()=>false;hidden.globals.set(side===1?'etjn':'846x',1);
  body(hidden,3-side).x=body(hidden,side).x+100;hidden.globals.set(side===1?'rav6':'ob2m',1);
  hidden.run(19,[key]);assert.equal(hidden.num(hidden.globals.get('ha8n')),0);assert.deepEqual(hidden.faults,[]);
 });
}

for(const side of [1,2]){
 test(`Axe Rage side ${side}: five seconds, basic-only bonus, speed, passive pull and slow`,()=>{
  const r=game(5,side,true),key=side===1?82:80,caster=body(r,side),axe=r.originals.get(side===1?'f5gc':'45b6'),state=r.secondarySkills.state(side);
  r.run(1,[key]);assert.equal(r.globals.get(side===1?'qn98':'thom'),55);
  const basic=[-10,10,1],ultimate=[-3,10,1],fn=side===1?'qy83':'05j0';
  r.secondarySkills.onFunction({e:axe,block:side===1?'tuno':'l4jj'},fn,basic);
  r.secondarySkills.onFunction({e:axe,block:side===1?'ooe9':'jg3c'},fn,ultimate);
  assert.equal(basic[0],-12);assert.equal(ultimate[0],-3);assert.equal(state.slow.value,8);
  const x=caster.x;r.command({e:caster,block:'afct'},'move_x',[2]);assert.equal(caster.x,x+2.5);
  const force=side===1?'lgp6':'c9o4';r.globals.set(force,0);
  r.command({e:axe,block:'kr83'},'change_variable',[force,-10]);assert.equal(r.globals.get(force),-15);
  const other=body(r,3-side),ox=other.x;r.command({e:other,block:'afct'},'move_x',[2]);assert.equal(other.x,ox+2);
  r.run(300);assert.equal(state.rageUntil,undefined);
  const plain=[-10,10,1];r.secondarySkills.onFunction({e:axe,block:side===1?'tuno':'l4jj'},fn,plain);assert.equal(plain[0],-10);
  const ex=caster.x;r.command({e:caster,block:'afct'},'move_x',[2]);assert.equal(caster.x,ex+2);
  assert.deepEqual(r.faults,[]);
 });
}

for(const side of [1,2]){
 const key=side===1?82:80,dir=side===1?1:-1;
 test(`Tesla Prism side ${side}: next native shot only, fan hit, normal/enhanced and rooted damage reduced ten percent`,()=>{
  for(const enhanced of [false,true])for(const rooted of [false,true]){
   const r=game(17,side,true),caster=body(r,side),target=body(r,3-side),weapon=r.originals.get(side===1?'5c1h':'8rb4');
   r.collisionProvider=()=>false;r.globals.set(side===1?'etjn':'846x',dir>0?1:0);
   target.x=caster.x+dir*60;target.y=caster.y+5;
   r.globals.set(side===1?'1vu0':'05ze',rooted?1:0);r.run(1,[key]);
   assert.equal(r.globals.get(side===1?'qn98':'thom'),76);assert.equal(r.secondarySkills.state(side).prismArmed,true);
   r.globals.set(side===1?'rr24':'qvkr',enhanced?1:0);
   const hits=[],call=r.call.bind(r);r.call=function*(c,id,args){if(id===(side===1?'qy83':'05j0'))hits.push(args[0]);yield*call(c,id,args);};
   r.command({e:weapon,block:enhanced?'cowr':'f7j2'},'create_clone',['self']);
   assert.equal(r.secondarySkills.state(side).prismArmed,false);r.run(45);
   const base=enhanced?(rooted?41:27):(rooted?26:17);
   assert.equal(hits.length,1);assert.ok(Math.abs(hits[0]+base*.9)<1e-9);
   assert.equal(r.num(r.globals.get(side===1?'lgp6':'c9o4')),dir*20);
   if(enhanced)assert.equal(r.num(r.globals.get(side===1?'nccn':'9af4')),18);
   const next=r.makeEntity(weapon.def,weapon);r.secondarySkills.onClone({e:weapon,block:'f7j2'},next);assert.equal(next.dead,false);
   assert.deepEqual(r.faults,[]);
  }
 });
 test(`Tesla Prism side ${side}: rear, outside fan and hidden target are excluded`,()=>{
  for(const mode of ['behind','above','hidden']){
   const r=game(17,side),caster=body(r,side),target=body(r,3-side),weapon=r.originals.get(side===1?'5c1h':'8rb4');
   r.collisionProvider=()=>false;r.globals.set(side===1?'etjn':'846x',dir>0?1:0);
   target.x=caster.x+dir*(mode==='behind'?-60:60);target.y=mode==='above'?100:0;
   if(mode==='hidden')r.globals.set(side===1?'rav6':'ob2m',1);
   r.run(1,[key]);const hp=r.globals.get(side===1?'7ir2':'akf6');
   r.command({e:weapon,block:'f7j2'},'create_clone',['self']);r.run(50);
   assert.equal(r.globals.get(side===1?'7ir2':'akf6'),hp);assert.deepEqual(r.faults,[]);
  }
 });
}

for(const side of [1,2]){
 test(`Tesla Prism side ${side}: normal attack input retains original wind-up and consumes armed skill on firing`,()=>{
  const r=game(17,side),key=side===1?82:80,weapon=r.originals.get(side===1?'5c1h':'8rb4');
  r.collisionProvider=()=>false;r.run(1,[key]);
  r.dispatchEntity(weapon,'when_scene_start');
  r.run(30,[side===1?69:13]);assert.equal(r.secondarySkills.state(side).prismArmed,true);
  r.run(28,[side===1?69:13]);assert.equal(r.secondarySkills.state(side).prismArmed,false);
  assert.ok(r.entities.some(e=>e.secondaryEffect==='tesla-prism'));assert.deepEqual(r.faults,[]);
 });
}

test('Original object and picture geometry is unchanged from the archived Entry project',()=>{
 const original=JSON.parse(fs.readFileSync(new URL('../source/original-project.json',import.meta.url)));
 for(const old of original.objects){
  const current=project.objects.find(o=>o.id===old.id);assert.ok(current,old.id);
  for(const field of ['width','height','scaleX','scaleY','regX','regY'])assert.equal(current.entity[field],old.entity[field],old.id+' '+field);
  for(const picture of old.sprite.pictures){
   const now=current.sprite.pictures.find(p=>p.id===picture.id);
   if(now)assert.deepEqual(now.dimension,picture.dimension,old.id+' '+picture.id);
  }
 }
});
for(const side of [1,2]){
 test(`Axe Rage side ${side} preserves axe size throughout the buff`,()=>{
  const r=game(5,side),axe=r.originals.get(side===1?'f5gc':'45b6');
  const before=[axe.width,axe.height,axe.scaleX,axe.scaleY,axe.regX,axe.regY];
  r.run(1,[side===1?82:80]);r.run(300);
  assert.deepEqual([axe.width,axe.height,axe.scaleX,axe.scaleY,axe.regX,axe.regY],before);
 });
 test(`Tesla Prism side ${side} rejects the former outer half of its cone`,()=>{
  const r=game(17,side),caster=body(r,side),target=body(r,3-side),weapon=r.originals.get(side===1?'5c1h':'8rb4'),direction=side===1?1:-1;
  r.collisionProvider=()=>false;r.globals.set(side===1?'etjn':'846x',direction>0?1:0);
  target.x=caster.x+direction*100;target.y=caster.y-4.5+100*Math.tan(20*Math.PI/180);
  r.run(1,[side===1?82:80]);const hp=r.globals.get(side===1?'7ir2':'akf6');
  r.command({e:weapon,block:'f7j2'},'create_clone',['self']);r.run(50);
  assert.equal(r.globals.get(side===1?'7ir2':'akf6'),hp);assert.deepEqual(r.faults,[]);
 });
}

for(const side of [1,2]){
 const key=side===1?82:80,hp=side===1?'akf6':'7ir2',mp=side===1?'qn98':'thom';
 test(`Taboo side ${side}: direct resource exchange, shields untouched, half-second cooldown and one cast per press`,()=>{
  const r=game(19,side,true),shield=side===1?'cfmd':'g4sc';
  r.globals.set(hp,51);r.globals.set(mp,50);r.globals.set(shield,30);
  r.run(1,[key]);const first=r.tick;
  assert.equal(r.globals.get(hp),41);assert.equal(r.globals.get(mp),60);assert.equal(r.globals.get(shield),30);
  assert.equal(r.secondarySkills.state(side).readyAt,first+30);
  r.run(40,[key]);assert.equal(r.globals.get(hp),41);
  r.run(1);r.run(1,[key]);assert.equal(r.globals.get(hp),31);assert.equal(r.globals.get(mp),70);
  r.run(1);r.run(1,[key]);assert.equal(r.globals.get(hp),31);
  assert.deepEqual(r.faults,[]);
 });
 test(`Taboo side ${side}: low HP, full MP and stun cannot consume resources`,()=>{
  for(const mode of ['low','full','stun']){
   const r=game(19,side);r.globals.set(hp,mode==='low'?10:50);r.globals.set(mp,mode==='full'?91:50);
   if(mode==='stun')r.globals.set(side===1?'8w41':'wyyq',1);
   const before=[r.globals.get(hp),r.globals.get(mp)];r.run(1,[key]);
   assert.deepEqual([r.globals.get(hp),r.globals.get(mp)],before);assert.deepEqual(r.faults,[]);
  }
  const r=game(19,side);r.globals.set(hp,11);r.globals.set(mp,90);r.run(1,[key]);
  assert.equal(r.globals.get(hp),1);assert.equal(r.globals.get(mp),100);
 });
}

for(const side of [1,2]){
 test(`Turret side ${side}: HP20, automatic loss 2 per second, enemy bullets damage it without hitting its owner`,()=>{
  const r=game(23,side),st=r.secondarySkills.state(side),key=side===1?82:80;
  r.collisionProvider=turretFloor;body(r,3-side).x=180;
  r.run(1,[key]);const turret=r.entities.find(e=>e.uid===st.turretUid);
  assert.equal(turret.installationHealth,20);r.run(59);assert.equal(turret.installationHealth,20);
  r.run(1);assert.equal(turret.installationHealth,18);
  const gun=r.originals.get('pvlq'),shot=r.makeEntity(gun.def,gun);
  Object.assign(shot,{clone:true,combatSide:3-side,barricadeProjectileDamage:4,x:turret.x-40,y:turret.y,
   width:4,height:4,regX:2,regY:2,scaleX:1,scaleY:1,visible:true});
  r.entities.push(shot);r.move(shot,80,0);
  assert.equal(shot.dead,true);assert.equal(turret.installationHealth,14);
  const own=r.makeEntity(gun.def,gun);Object.assign(own,{...shot,uid:++r.sequence,dead:false,combatSide:side,x:turret.x-40});
  r.entities.push(own);r.move(own,80,0);assert.equal(own.dead,false);assert.equal(turret.installationHealth,14);
  r.run(420);assert.equal(turret.dead,true);assert.equal(st.turretUid,undefined);
  assert.deepEqual(r.faults,[]);
 });
}

test('Turret explosion radius is 70, twice its previous radius',()=>{
 for(const distance of [69,71]){
  const r=game(23),target=body(r,2),state=r.secondarySkills.state(1);
  r.collisionProvider=()=>false;r.run(1,[82]);
  const turret=r.entities.find(e=>e.uid===state.turretUid);
  target.x=turret.x+distance;target.y=turret.y;
  const before=r.num(r.globals.get('7ir2'));
  turret.installationHealth=0;r.run(2);
  assert.equal(r.num(r.globals.get('7ir2')),distance===69?before-20:before);
  assert.deepEqual(r.faults,[]);
 }
});


for(const side of [1,2]){
 const key=side===1?82:80,dir=side===1?1:-1;
 test(`Alpha Light Surge side ${side}: one projectile produces circular blasts at 30,80,130`,()=>{
  const r=game(28,side,true),caster=body(r,side),target=body(r,3-side),origin={x:caster.x,y:caster.y};
  r.globals.set(side===1?'etjn':'846x',dir>0?1:0);r.collisionProvider=()=>false;target.x=500;
  const blasts=[],launches=[],spawn=r.spawn.bind(r);
  r.spawn=(e,fn,event)=>{
   if(event==='alpha_light_surge')blasts.push({tick:r.tick,x:e.x,y:e.y});
   if(event==='alpha_surge_projectile')launches.push(r.tick);
   return spawn(e,fn,event);
  };
  r.run(1,[key]);assert.equal(r.globals.get(side===1?'qn98':'thom'),69);
  assert.equal(blasts.length,0);assert.ok(r.entities.some(e=>e.secondaryEffect==='alpha-surge-flight'));
  caster.x+=200;caster.y+=60;r.globals.set(side===1?'etjn':'846x',dir>0?0:1);
  r.run(100);
  assert.deepEqual(blasts.map(h=>h.x),[30,80,130].map(x=>origin.x+dir*x));
  assert.ok(blasts.every(h=>h.y===origin.y));
  assert.equal(launches.length,1);
  assert.ok(!r.entities.some(e=>['alpha-light-surge','alpha-surge-flight','alpha-surge-trail'].includes(e.secondaryEffect)&&!e.dead));
  assert.deepEqual(r.faults,[]);
 });
 test(`Alpha Light Surge side ${side}: three four-damage impacts, forward knockback and half-second slow`,()=>{
  const r=game(28,side),caster=body(r,side),target=body(r,3-side),force=side===1?'lgp6':'c9o4';
  r.globals.set(side===1?'etjn':'846x',dir>0?1:0);r.collisionProvider=()=>false;
  target.x=caster.x+dir*30;target.y=caster.y;r.globals.set(force,0);
  const hits=[],call=r.call.bind(r);r.call=function*(c,id,args){if(id===(side===1?'qy83':'05j0'))hits.push(args[0]);yield*call(c,id,args);};
  r.run(1,[key]);r.run(10);
  target.x=caster.x+dir*80;r.run(17);
  target.x=caster.x+dir*130;r.run(17);
  assert.deepEqual(hits,[-4,-4,-4]);assert.equal(r.num(r.globals.get(force)),dir*18*.625*3);
  assert.equal(r.secondarySkills.state(side).slow.value,6);assert.deepEqual(r.faults,[]);
 });
 test(`Alpha Light Surge side ${side}: stealth excludes damage, CC immunity excludes knockback and slow`,()=>{
  for(const hidden of [true,false]){
   const r=game(28,side),caster=body(r,side),target=body(r,3-side),force=side===1?'lgp6':'c9o4';
   r.globals.set(side===1?'etjn':'846x',1);r.collisionProvider=()=>false;target.x=caster.x+30;
   r.globals.set(hidden?(side===1?'rav6':'ob2m'):(side===1?'ec6d':'jcf6'),1);
   r.globals.set(force,0);const hp=side===1?'7ir2':'akf6',before=r.num(r.globals.get(hp));r.run(65,[key]);
   assert.equal(r.secondarySkills.state(side).slow,undefined);assert.equal(r.num(r.globals.get(force)),0);
   assert.equal(r.num(r.globals.get(hp)),hidden?before:before-4);assert.deepEqual(r.faults,[]);
  }
 });
}
test('Alpha Light Surge explodes at terrain contact instead of disappearing',()=>{
 const r=game(28),caster=body(r,1);r.globals.set('etjn',1);body(r,2).x=500;
 r.collisionProvider=(e,id)=>id==='6tzq'&&e.secondaryEffect==='alpha-surge-flight'&&e.x>=caster.x+20;
 const points=[],spawn=r.spawn.bind(r);r.spawn=(e,fn,event)=>{if(event==='alpha_light_surge')points.push(e.x);return spawn(e,fn,event);};
 r.run(60,[82]);assert.deepEqual(points,[caster.x+19]);assert.deepEqual(r.faults,[]);
});

test('Alpha Light Surge circular explosion radius is 40',()=>{
 for(const height of [38,41]){
  const r=game(28),caster=body(r,1),target=body(r,2);r.globals.set('etjn',1);r.collisionProvider=()=>false;
  target.x=caster.x+30;target.y=caster.y+height;
  const before=r.num(r.globals.get('7ir2'));r.run(100,[82]);
  assert.equal(r.num(r.globals.get('7ir2')),height===38?before-4:before);assert.deepEqual(r.faults,[]);
 }
});

test('Alpha explosion pushes away from its center regardless of firing direction',()=>{
 for(const side of [1,2])for(const offset of [-8,8]){
  const r=game(28,side),def=r.secondarySkills.definition(side),caster=body(r,side),target=body(r,3-side);
  const point={x:0,y:0},force=side===1?'lgp6':'c9o4';
  target.x=offset;target.y=0;r.globals.set(force,0);
  r.spawn(caster,function*(rt,c){yield*def.explode(rt,c,side,rt.secondarySkills.state(side),point,-Math.sign(offset));},'test_alpha_explosion');
  r.run(1);assert.equal(r.num(r.globals.get(force)),Math.sign(offset)*18*.625);
  assert.deepEqual(r.faults,[]);
 }
});

test('Alpha radial recoil uses the exact center-to-target vector, including vertical and arbitrary diagonal directions',()=>{
 for(const side of [1,2])for(const [dx,dy] of [[0,12],[0,-12],[3,7],[-8,3],[7,-2],[-4,-9],[0,0]]){
  const r=game(28,side),def=r.secondarySkills.definition(side),caster=body(r,side),target=body(r,3-side);
  const xForce=side===1?'lgp6':'c9o4',yVelocity=side===1?'iblx':'du2p';
  target.x=dx;target.y=dy;r.globals.set(xForce,0);r.globals.set(yVelocity,0);
  r.spawn(caster,function*(rt,c){yield*def.explode(rt,c,side,rt.secondarySkills.state(side),{x:0,y:0},1);},'test_radial_recoil');
  r.run(1);const length=Math.hypot(dx,dy)||1,impulse=18*.625;
  assert.ok(Math.abs(r.num(r.globals.get(xForce))-(dx===0&&dy===0?impulse:dx/length*impulse))<1e-9);
  assert.ok(Math.abs(r.num(r.globals.get(yVelocity))-dy/length*impulse/30)<1e-9);
  if(dx&&dy){
   const horizontal=r.num(r.globals.get(xForce))/15,vertical=r.num(r.globals.get(yVelocity))*2;
   assert.ok(Math.abs(horizontal*dy-vertical*dx)<1e-9);
  }
  assert.deepEqual(r.faults,[]);
 }
});

test('Alpha circular blast excludes square corners and applies slow without an extra status icon',()=>{
 for(const [dx,dy,hit] of [[30,30,false],[25,25,true]]){
  const r=game(28),def=r.secondarySkills.definition(1),target=body(r,2),before=r.num(r.globals.get('7ir2'));
  target.x=dx;target.y=dy;
  r.spawn(body(r,1),function*(rt,c){yield*def.explode(rt,c,1,rt.secondarySkills.state(1),{x:0,y:0},1);},'test_circle');
  r.run(1);assert.equal(r.num(r.globals.get('7ir2')),hit?before-4:before);
  if(hit)assert.equal(r.secondarySkills.state(1).slow.value,6);
  assert.ok(!r.entities.some(e=>e.secondaryEffect==='secondary-slow'));
  const blast=r.entities.find(e=>e.secondaryEffect==='alpha-light-surge');
  assert.equal(blast.picture.fileurl,r.defs.get('7h6f').sprite.pictures[3].fileurl);
  assert.deepEqual(r.faults,[]);
 }
});


test('airborne turret falls onto the stage and stays on the surface', () => {
  const r = game(23);
  r.collisionProvider = turretFloor;
  body(r, 1).y = 45;
  r.run(1, [82]);
  const turret = r.entities.find(e => e.secondaryEffect === 'boom-turret');
  assert.ok(turret.y < 43 && turret.y > 0);
  r.run(60);
  assert.ok(turret.y >= -2 && turret.y < -1);
  const landedY = turret.y;
  r.run(10);
  assert.ok(Math.abs(turret.y - landedY) < 1e-8);
});

test('Darkness can be recast at four seconds and refreshes one continuous charge effect', () => {
  const r = game(29), state = r.secondarySkills.state(1);
  r.run(1, [82]);
  const first = r.tick;
  r.run(239);
  r.run(1, [82]);
  assert.equal(r.tick, first + 240);
  assert.equal(state.darkUntil, r.tick + 300);
  assert.equal(state.slow.until, state.darkUntil);
  assert.equal(r.threads.filter(t => t.event === 'lycan_darkness').length, 1);
  assert.equal(r.globals.get('qn98'), 32);
  r.run(60);
  assert.equal(r.globals.get('qn98'), 40);
  assert.ok(state.darkUntil > r.tick);
  r.run(240);
  assert.equal(r.globals.get('qn98'), 72);
  assert.equal(state.darkUntil, undefined);
});
