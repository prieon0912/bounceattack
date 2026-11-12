
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Runtime} from '../public/src/runtime.js';
import {registerOriginal} from '../public/src/original-program.js';
const project=JSON.parse(fs.readFileSync(new URL('../public/data/project.json',import.meta.url)));
function game(character,side=1,mirror=false){const r=new Runtime(structuredClone(project),{headless:true});registerOriginal(r);r.start({p1:side===1||mirror?character:2,p2:side===2||mirror?character:2,seed:21,skills:side===1?['secondary','primary']:['primary','secondary']});for(let i=0;i<240;i++)r.step();for(const t of [...r.threads,...r.pending])t.cancelled=true;r.threads=[];r.pending=[];for(const [s,id] of [[1,'00h9'],[2,'n8fg']]){Object.assign(r.originals.get(id),{x:s===1?-20:20,y:0,visible:true});r.globals.set(s===1?'qn98':'thom',100);r.globals.set(s===1?'8w41':'wyyq',0);}r.globals.set('r71b',0);r.run=(n,keys=[])=>{r.keys=new Set(keys);for(let i=0;i<n;i++)r.step();};return r;}
const body=(r,s)=>r.originals.get(s===1?'00h9':'n8fg');
for(const side of [1,2]){
 test(`Cannon side ${side}: ceil half gears, MP72, damage consumed+5, root two seconds`,()=>{const r=game(32,side,true),owner=r.originals.get(side===1?'plg8':'cvkh');r.set(owner,'ck61',7);r.run(1,[side===1?82:80]);assert.equal(r.get(owner,'ck61'),3);assert.equal(r.secondarySkills.state(side).lastGearsSpent,4);assert.equal(r.globals.get(side===1?'qn98':'thom'),28);r.run(20);assert.equal(r.globals.get(side===1?'1vu0':'05ze'),2);assert.deepEqual(r.faults,[]);});
 test(`Nation side ${side}: same seed and water preserved through transplant gravity`,()=>{const r=game(30,side,true),owner=r.originals.get(side===1?'0dj2':'5tsu'),seed=r.makeEntity(r.defs.get('xium'));Object.assign(seed,{clone:true,combatSide:side,visible:true,x:70,y:0});r.setPicture(seed,'nv8a');r.entities.push(seed);r.set(seed,'bqz6',3);body(r,side).y=40;r.collisionProvider=(e,id)=>id==='6tzq'&&e.y<=0;r.run(1,[side===1?82:80]);assert.equal(seed.x,body(r,side).x);assert.equal(r.get(seed,'bqz6'),3);r.run(100);assert.ok(seed.y>=0&&seed.y<1);assert.equal(seed.transplantFalling,false);assert.equal(r.get(seed,'bqz6'),3);assert.deepEqual(r.faults,[]);});
 test(`Glams side ${side}: size-specific blink and large stun`,()=>{for(const size of [0,1,2]){const r=game(20,side),owner=r.originals.get(side===1?'f5xk':'t3w4');r.set(owner,'uh0p',size);r.globals.set(side===1?'etjn':'846x',side===1?1:0);r.collisionProvider=()=>false;const x=body(r,side).x;r.run(1,[side===1?82:80]);if(size===1)assert.equal(Math.abs(body(r,side).x-x),70);r.run(12);if(size===2)assert.equal(r.globals.get(side===1?'wyyq':'8w41'),1);assert.deepEqual(r.faults,[]);}});
 test(`Kenen side ${side}: invisible to both, basic and ult blocked for three seconds`,()=>{const r=game(6,side);r.run(1,[side===1?82:80]);assert.equal(r.secondarySkills.hidden(body(r,side)),true);assert.equal(r.secondarySkills.hidden(r.originals.get(side===1?'aadi':'0y61')),true);assert.equal(r.secondarySkills.replacesKey(side===1?69:13),true);assert.equal(r.secondarySkills.replacesKey(side===1?83:40),true);r.run(180);assert.equal(r.secondarySkills.hidden(body(r,side)),false);assert.equal(r.globals.get(side===1?'ob2m':'rav6'),0);assert.deepEqual(r.faults,[]);});
 test(`Eclipse side ${side}: original passive cannot hit while sword away; restores after return`,()=>{const r=game(4,side),orbit=r.makeEntity(r.defs.get(side===1?'q6zw':'kxwh'));orbit.clone=true;r.entities.push(orbit);r.run(1,[side===1?82:80]);assert.equal(r.secondarySkills.blocksCollision(orbit),true);r.run(100);assert.equal(r.secondarySkills.blocksCollision(orbit),false);assert.equal(r.secondarySkills.state(side).swordAway,false);assert.deepEqual(r.faults,[]);});
 test(`Guard side ${side}: next basic gets 2x range, +5 damage and 0.8 root then consumes`,()=>{const r=game(14,side);r.run(1,[side===1?82:80]);r.run(12);const st=r.secondarySkills.state(side),e=r.originals.get(side===1?'sn6j':'rlr8'),c={e,block:side===1?'1yiq':'81a1'};r.secondarySkills.onCommand(c,'change_to_some_shape',[]);assert.equal(st.armed,false);assert.equal(st.striking,true);assert.equal(r.secondarySkills.distanceValue(c,'gvza',60),30);const args=[-10,12,2];c.block=side===1?'62cf':'2gar';r.secondarySkills.onFunction(c,side===1?'qy83':'05j0',args);assert.equal(args[0],-15);c.block='0sez';const root=[side===1?'1vu0':'05ze',.62];r.secondarySkills.onCommand(c,'set_variable',root);assert.equal(root[1],.8);c.block=side===1?'5krq':'3fxo';r.secondarySkills.onCommand(c,'change_to_some_shape',[]);assert.equal(st.striking,false);r.run(13);assert.equal(st.shrinkAt,undefined);});
}
test('Enril can recast on a fresh press without airborne, falling, height or jump restrictions',()=>{
 const r=game(27);r.collisionProvider=()=>false;body(r,1).y=200;r.globals.set('05ze',0);r.globals.set('f7zw',1);
 for(let cast=0;cast<5;cast++){r.globals.set('qn98',100);r.globals.set('du2p',-5);r.run(1,[82]);assert.equal(r.globals.get('du2p'),2.5);assert.equal(r.globals.get('qn98'),84);r.run(1,[82]);assert.equal(r.globals.get('qn98'),84);r.run(1);}
 assert.deepEqual(r.faults,[]);
});
test('No seed: transplantation does not spend MP',()=>{const r=game(30);r.run(1,[82]);assert.equal(r.globals.get('qn98'),100);});
import test from 'node:test';
import {stateHash} from '../public/src/frame-sync.js';
test('all seven secondaries keep native combat and mirror simulation deterministic',()=>{
 for(const character of [4,6,14,20,27,30,32]){const make=()=>{const r=new Runtime(structuredClone(project),{headless:true});registerOriginal(r);r.start({p1:character,p2:character,seed:73,skills:['secondary','secondary']});for(let i=0;i<240;i++)r.step();return r;};const a=make(),b=make();
 for(let tick=0;tick<360;tick++){for(const r of [a,b]){r.keys.clear();if(tick%90===0){r.globals.set('qn98',100);r.globals.set('thom',100);r.keys.add(82);r.keys.add(80);}if(tick%90>15&&tick%90<55){r.keys.add(69);r.keys.add(13);}r.step();}}
 assert.deepEqual(a.faults,[],`character ${character}`);assert.equal(stateHash(a),stateHash(b),`character ${character}`);
 }
});
test('Cannon all gear tiers use ceil(current/2), spent+5 damage and exact two-second effects',()=>{
 for(let gears=0;gears<=10;gears++){const r=game(32),owner=r.originals.get('plg8'),spent=Math.ceil(gears/2),calls=[];r.set(owner,'ck61',gears);const original=r.call.bind(r);r.call=function*(c,id,args){if(id==='qy83')calls.push(args[0]);yield* original(c,id,args);};r.run(1,[82]);r.run(20);assert.deepEqual(calls,[-(spent+5)]);assert.equal(r.get(owner,'ck61'),gears-spent);if(spent===5){assert.equal(r.globals.get('wyyq'),1);r.run(120);assert.equal(r.globals.get('wyyq'),0);}else if(spent>=3)assert.equal(r.globals.get('1vu0'),2);else if(spent===2)assert.equal(r.secondarySkills.state(1).slow.value,8);else assert.equal(r.secondarySkills.state(1).slow,undefined);}
});
test('all seven choices retain original blurred selector and reset 2P default',()=>{for(const character of [4,6,14,20,27,30,32]){const r=new Runtime(structuredClone(project),{headless:true});registerOriginal(r);r.startProject();r.loadScene('1ckl');r.globals.set('jx38',1);r.globals.set('yraj',1);r.globals.set('16fh',character);r.secondarySkills.syncSelection();assert.equal(r.secondarySkills.selectionInfo(1).secondary,false);assert.equal(r.secondarySkills.selectKey(82),true);assert.equal(r.secondarySkills.selectionInfo(1).secondary,true);r.globals.set('y75t',character);r.secondarySkills.onSelectionCommand('set_variable',['jx38',2]);r.globals.set('jx38',2);r.secondarySkills.syncSelection();assert.equal(r.secondarySkills.selectionInfo(2).secondary,false);assert.equal(r.secondarySkills.choice(1),'secondary');}});
test('real native Guard basic consumes the charge on a miss and returns body to original size',()=>{for(const side of [1,2]){const r=new Runtime(structuredClone(project),{headless:true});registerOriginal(r);r.start({p1:side===1?14:2,p2:side===2?14:2,skills:side===1?['secondary','primary']:['primary','secondary']});for(let i=0;i<240;i++)r.step();r.globals.set(side===1?'qn98':'thom',100);r.keys.add(side===1?82:80);r.step();r.keys.clear();for(let i=0;i<15;i++)r.step();r.keys.add(side===1?69:13);for(let i=0;i<100;i++)r.step();assert.equal(r.secondarySkills.state(side).armed,false);assert.equal(r.secondarySkills.state(side).striking,false);assert.equal(r.secondarySkills.state(side).shrinkAt,undefined);assert.deepEqual(r.faults,[]);}});
test('Eclipse turns at each existing position, samples enemy only on release, and flies toward that point within the 150-unit cap',()=>{
 for(const side of [1,2]){const r=game(4,side),orbitId=side===1?'q6zw':'kxwh',native=r.entities.filter(e=>e.objectId===orbitId&&e.clone&&!e.dead);assert.equal(native.length,3);
  const target=body(r,3-side);target.x=120;target.y=70;
  const origins=native.map(e=>{const b=r.bounds(e);return {x:(b.left+b.right)/2,y:(b.bottom+b.top)/2,rotation:e.rotation};});
  assert.ok(origins.some((p,i)=>Math.hypot(p.x-native[i].x,p.y-native[i].y)>10));
  r.run(1,[side===1?82:80]);const blades=r.entities.filter(e=>e.secondaryEffect==='eclipse-flying-sword'&&!e.dead).sort((a,b)=>a.uid-b.uid);assert.equal(blades.length,3);
  r.run(10);for(let i=0;i<3;i++){assert.ok(Math.abs(blades[i].x-origins[i].x)<1e-8);assert.ok(Math.abs(blades[i].y-origins[i].y)<1e-8);assert.equal(blades[i].secondaryDestination,undefined);}
  // Move during aiming: all blades must select this later point, not cast-time coordinates.
  target.x=310;target.y=111;const destination={x:target.x,y:target.y};r.run(1);
  for(let i=0;i<3;i++){const p=origins[i],e=blades[i],dx=destination.x-p.x,dy=destination.y-p.y,len=Math.hypot(dx,dy);assert.ok(Math.abs(e.secondaryDestination.x-(p.x+dx/len*150))<1e-8);assert.ok(Math.abs(e.secondaryDestination.y-(p.y+dy/len*150))<1e-8);assert.ok(Math.abs(e.x-(p.x+dx/len*5))<1e-8);assert.ok(Math.abs(e.y-(p.y+dy/len*5))<1e-8);const expected=45-Math.atan2(dy,dx)*180/Math.PI;assert.ok(Math.abs(((e.rotation-expected+540)%360)-180)<1e-8);assert.equal(e.regX,e.width/2);assert.equal(e.regY,e.height/2);}
  // Move after launch: no homing, and the blades continue straight toward the capped endpoint.
  target.x=-220;target.y=-80;r.run(26);
  for(let i=0;i<3;i++){const p=origins[i],e=blades[i],dx=destination.x-p.x,dy=destination.y-p.y,len=Math.hypot(dx,dy);assert.ok(len>135);assert.ok(Math.abs(e.x-(p.x+dx/len*135))<1e-8);assert.ok(Math.abs(e.y-(p.y+dy/len*135))<1e-8);}
  let arrived=new Set();for(let tick=0;tick<150&&!blades.every(e=>e.dead);tick++){for(const e of blades)if(!e.dead&&Math.hypot(e.x-e.secondaryDestination.x,e.y-e.secondaryDestination.y)<1e-8)arrived.add(e.uid);r.run(1);}
  assert.equal(arrived.size,3);assert.ok(blades.every(e=>e.dead));r.run(20);assert.equal(r.secondarySkills.state(side).swordAway,false);assert.deepEqual(r.faults,[]);
 }
});
test('Kenen costs 39 MP and lasts exactly 180 ticks; Enril can recast after key release',()=>{
 const r=game(6);r.run(1,[82]);assert.equal(r.globals.get('qn98'),61);r.run(179);assert.equal(r.secondarySkills.hidden(body(r,1)),true);r.run(1);assert.equal(r.secondarySkills.hidden(body(r,1)),false);assert.equal(r.globals.get('ob2m'),0);
 const e=game(27);e.collisionProvider=()=>false;e.run(1,[82]);e.run(1,[82]);assert.equal(e.globals.get('qn98'),84);e.run(1);e.run(1,[82]);assert.equal(e.globals.get('qn98'),68);
});
test('Cannon spending releases the creation cap and native basic attacks can earn gears again',()=>{
 for(const side of [1,2]){const r=game(32,side,true),owner=r.originals.get(side===1?'plg8':'cvkh');r.set(owner,'ck61',10);r.set(owner,'7rns',10);r.run(1,[side===1?82:80]);assert.equal(r.get(owner,'ck61'),5);assert.equal(r.get(owner,'7rns'),5);r.run(25);
  const foe=r.originals.get(side===1?'ocqj':'n230');foe.x=body(r,3-side).x;foe.y=0;r.globals.set(side===1?'etjn':'846x',side===1?1:0);r.globals.set(side===1?'rr24':'qvkr',0);
  r.spawn(owner,function*(rt,c){rt.command(c,'create_clone',['self']);},'test_basic');r.run(240);assert.ok(r.get(owner,'ck61')>5,`side ${side} can acquire after spending`);assert.ok(r.get(owner,'7rns')>5);assert.deepEqual(r.faults,[]);
 }
});
test('Cannon reuses the original blue bullet and displays each status effect on the victim',()=>{
 for(const side of [1,2])for(const [gears,type] of [[4,'slow'],[6,'root'],[10,'stun']]){const r=game(32,side),owner=r.originals.get(side===1?'plg8':'cvkh');r.set(owner,'ck61',gears);r.set(owner,'7rns',gears);r.run(1,[side===1?82:80]);const missile=r.entities.find(e=>e.secondaryEffect==='cannon-grenade');const original=r.defs.get('plg8').sprite.pictures.find(p=>p.id==='4zk0');assert.equal(missile.picture.fileurl,original.fileurl);r.run(20);const marker=r.entities.find(e=>e.secondaryEffect===`secondary-${type}`&&!e.dead);assert.ok(marker,`${type} marker side ${side}`);assert.equal(marker.x,body(r,3-side).x);body(r,3-side).x+=30;r.run(1);assert.equal(marker.x,body(r,3-side).x);r.run(121);assert.ok(marker.dead);assert.deepEqual(r.faults,[]);}
});

test('Eclipse deals four damage once per blade, for three independently hitting swords',()=>{
 for(const side of [1,2]){const r=game(4,side),target=body(r,3-side);target.x=0;target.y=0;for(const sword of r.entities.filter(e=>e.clone&&e.objectId===(side===1?'q6zw':'kxwh'))){const b=r.bounds(sword);sword.x+=-40-(b.left+b.right)/2;sword.y-=(b.top+b.bottom)/2;}const calls=[],original=r.call.bind(r);r.call=function*(c,id,args){if(id===(side===1?'qy83':'05j0'))calls.push(args[0]);yield* original(c,id,args);};r.run(1,[side===1?82:80]);r.run(150);assert.deepEqual(calls,[-4,-4,-4]);assert.deepEqual(r.faults,[]);}
});

test('Enril while rooted spends 16 MP without changing velocity, on either side',()=>{
 for(const side of [1,2]){const r=game(27,side),root=side===1?'05ze':'1vu0',velocity=side===1?'du2p':'iblx',mana=side===1?'qn98':'thom',key=side===1?82:80;
  r.globals.set(root,2);r.globals.set(velocity,-1.25);r.run(1,[key]);assert.equal(r.globals.get(mana),84);assert.equal(r.globals.get(velocity),-1.25);const readyAt=r.secondarySkills.state(side).readyAt;assert.equal(readyAt,r.tick);
  r.globals.set(root,0);r.run(1);r.run(1,[key]);assert.equal(r.globals.get(mana),68);assert.equal(r.globals.get(velocity),2.5);assert.deepEqual(r.faults,[]);
 }
});

test('Cannon grenade has a 130-unit total path budget, including curved homing travel, on both sides',()=>{for(const side of [1,2]){const r=game(32,side),source=body(r,side),target=body(r,3-side);source.x=0;source.y=0;target.x=220;target.y=0;const hp=r.globals.get(side===1?'7ir2':'akf6');r.run(1,[side===1?82:80]);const missile=r.entities.find(e=>e.secondaryEffect==='cannon-grenade');assert.ok(missile);let distance=Math.hypot(missile.x,missile.y),previous={x:missile.x,y:missile.y};for(let i=0;i<80&&!missile.dead;i++){target.y=i%16<8?110:-110;r.run(1);distance+=Math.hypot(missile.x-previous.x,missile.y-previous.y);previous={x:missile.x,y:missile.y};}assert.ok(missile.dead);assert.ok(Math.abs(distance-130)<1e-7);assert.equal(r.globals.get(side===1?'7ir2':'akf6'),hp);assert.deepEqual(r.faults,[]);}});
test('Glams all three size variants cost 43 MP and cannot activate with 42 MP',()=>{for(const side of [1,2])for(const size of [0,1,2]){const r=game(20,side),owner=r.originals.get(side===1?'f5xk':'t3w4'),mana=side===1?'qn98':'thom',key=side===1?82:80;r.set(owner,'uh0p',size);r.globals.set(mana,42);const x=body(r,side).x;r.run(1,[key]);assert.equal(r.globals.get(mana),42);assert.equal(body(r,side).x,x);r.run(1);r.globals.set(mana,100);r.run(1,[key]);assert.equal(r.globals.get(mana),57);assert.deepEqual(r.faults,[]);}});
