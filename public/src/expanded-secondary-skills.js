import {prepareSkill as prepare, skillVisual as visual} from './additional-secondary-skills.js';
const body=(r,s)=>r.originals.get(s===1?'00h9':'n8fg');
const ids=(s,a,b)=>s===1?a:b;
const alive=(r,s)=>r.num(r.globals.get(ids(s,'akf6','7ir2')))>0&&r.num(r.globals.get('r71b'))===0;
const visibleTarget=(r,s)=>r.num(r.globals.get(ids(s,'rav6','ob2m')))===0;
const dir=(r,s)=>r.num(r.globals.get(ids(s,'etjn','846x')))===1?1:-1;
const context=(r,s)=>r.originals.get(({20:ids(s,'f5xk','t3w4'),30:ids(s,'0dj2','5tsu'),32:ids(s,'plg8','cvkh')})[r.num(r.globals.get(ids(s,'y75t','s5vb')))])||body(r,s);
function status(r,s,type,amount,ticks){
 const foe=3-s,e=body(r,foe);if(r.num(r.globals.get(ids(foe,'jcf6','ec6d')))!==0)return;
 if(type==='root'){const id=ids(foe,'05ze','1vu0');r.set(e,id,Math.max(r.num(r.get(e,id)),ticks/60));return;}
 if(type==='slow'){const st=r.secondarySkills.state(s);st.slow={side:foe,value:amount,until:r.tick+ticks};return;}
 const id=ids(foe,'8w41','wyyq'),generation=ids(foe,'bpv0','bpv5');r.add(e,generation,1);const token=r.get(e,generation);r.set(e,id,1);
 r.spawn(e,function*(rt){yield ticks;if(rt.get(e,generation)===token)rt.set(e,id,0);},'secondary_status');
}
function slowValue(r,e,id,raw,state){return state.slow?.until>r.tick&&id===ids(state.slow.side,'9af4','nccn')?Math.max(Number(raw),state.slow.value):raw;}
function* hit(r,c,s,damage,type=null,amount=0,ticks=0){if(!visibleTarget(r,s))return;yield* r.call(c,ids(s,'qy83','05j0'),[-damage,0,1]);if(type)status(r,s,type,amount,ticks);}
function definition(character,name,manaCost,key,description,extra){return {character,name,manaCost,description,cooldownTicks:0,lockVariable:false,prepare,icon:`assets/secondary/${key}-icon.svg`,secondaryPictureId:`${key}-icon`,slowValue,...extra};}
function safeMove(r,e,dx){const steps=Math.max(1,Math.ceil(Math.abs(dx)));let moved=0;for(let i=0;i<steps;i++){const old=e.x;e.x+=dx/steps;if(Math.abs(e.x)>232||r.reach(e,'6tzq')){e.x=old;break;}moved+=dx/steps;}return moved;}
const seedFor=(r,s)=>r.entities.find(e=>e.objectId==='xium'&&e.clone&&!e.dead&&e.picture?.id==='nv8a'&&(e.combatSide===s||(!e.combatSide&&r.num(r.globals.get(ids(s,'y75t','s5vb')))===30)));
export const nationTransplant=definition(30,'옮겨심기',32,'nation-transplant','씨앗의 성장 상태를 유지하며 자신의 위치로 옮겨심습니다.',{
 canCast(r,s){return !!seedFor(r,s);},
 onCommand(r,c,type,args){if(c.e.objectId==='xium'&&c.e.preserveWater&&c.block==='7wmm'&&type==='set_variable'){delete c.e.preserveWater;return false;}},
 skipThread(r,t){return t.e.transplantFalling&&t.event!=='secondary_seed_fall';},
 *cast(r,c,{side,caster}){const seed=seedFor(r,side);if(!seed)return;seed.x=caster.x;seed.y=caster.y;seed.preserveWater=true;seed.transplantFalling=true;r.set(seed,'ly81',0);r.set(seed,'30oi',0);
  r.spawn(seed,function*(rt){let velocity=0;try{while(!seed.dead&&seed.y>-205&&alive(rt,side)){velocity=Math.max(-5,velocity-.06);let landed=false;for(let i=0;i<Math.ceil(-velocity);i++){const y=seed.y;seed.y+=velocity/Math.ceil(-velocity);if(rt.reach(seed,'6tzq')){seed.y=y;landed=true;break;}}rt.set(seed,'vogg',seed.x);rt.set(seed,'bw1y',seed.y);if(landed)break;yield 1;}}finally{seed.transplantFalling=false;}},'secondary_seed_fall');
 }
});
export const glamsRush=definition(20,'돌진 / 점멸 / 박치기',32,'glams-rush','크기에 따라 방어막을 얻고 돌진하거나, 점멸하거나, 적을 기절시키며 돌진합니다.',{
 *cast(r,c,{side,caster,target}){const owner=context(r,side),size=r.num(r.get(owner,'uh0p')),direction=dir(r,side);
  if(size===1){const start=caster.x;let found=false;for(let d=70;d>=0;d--){caster.x=Math.max(-232,Math.min(232,start+direction*d));if(!r.reach(caster,'6tzq')){found=true;break;}}if(!found)caster.x=start;return;}
  if(size===0){const id=ids(side,'cfmd','g4sc'),before=r.num(r.get(caster,id)),grant=Math.max(0,8-before);if(grant){r.add(caster,id,grant);r.spawn(caster,function*(rt){yield 120;rt.set(caster,id,Math.max(0,rt.num(rt.get(caster,id))-grant));},'secondary_shield');}}
  let struck=false;for(let i=0;i<12&&alive(r,side)&&r.num(r.globals.get(ids(side,'8w41','wyyq')))===0;i++){safeMove(r,caster,direction*70/12);if(size===2&&!struck&&Math.hypot(caster.x-target.x,caster.y-target.y)<=28&&visibleTarget(r,side)){struck=true;yield* hit(r,c,side,8,'stun',0,60);}yield 1;}
 }
});
export const guardGiantStrike=definition(14,'거인의 일격',28,'guard-giant','몸집을 키워 다음 일반공격의 범위와 피해량, 속박 시간을 증가시킵니다.',{
 canCast(r,s){const st=r.secondarySkills.state(s);return !st.armed&&!st.striking&&!st.shrinkAt;},
 *cast(r,c,{state}){state.armed=true;state.growAt=r.tick;},
 blocksKey(r,key,s,st){return key===ids(s,69,13)&&st.armed&&r.tick-st.growAt<12;},
 onCommand(r,c,type,args,s,st){if(c.e.objectId!==ids(s,'sn6j','rlr8'))return;
  if(type==='change_to_some_shape'&&[ids(s,'1yiq','81a1')].includes(c.block)&&st.armed){st.armed=false;st.striking=true;}
  if(type==='set_variable'&&c.block==='0sez'&&st.striking)args[1]=.8;
  if(type==='change_to_some_shape'&&c.block===ids(s,'5krq','3fxo')&&st.striking){st.striking=false;st.shrinkAt=r.tick;}
 },
 onFunction(r,c,id,args,s,st){if(st.striking&&c.e.objectId===ids(s,'sn6j','rlr8')&&c.block===ids(s,'62cf','2gar'))args[0]=-15;},
 distanceValue(r,c,id,value,s,st){return st.striking&&c.e.objectId===ids(s,'sn6j','rlr8')&&id==='gvza'?value/2:value;},
 afterStep(r,s,st){let f=1;if(st.armed||st.striking)f=1+Math.min(1,(r.tick-st.growAt)/12);else if(st.shrinkAt){f=2-Math.min(1,(r.tick-st.shrinkAt)/12);if(f===1)delete st.shrinkAt;}
  if(f===1)return;for(const e of r.entities)if(!e.dead&&[ids(s,'00h9','n8fg'),ids(s,'n230','ocqj'),ids(s,'sn6j','rlr8')].includes(e.objectId)){savePresentation(e);e.scaleX*=f;e.scaleY*=f;}}
});
function savePresentation(e){e.secondaryPresentation={x:e.x,y:e.y,scaleX:e.scaleX,scaleY:e.scaleY};}
export function restorePresentation(r){for(const e of r.entities)if(e.secondaryPresentation){Object.assign(e,e.secondaryPresentation);delete e.secondaryPresentation;}}
export const kenenShadow=definition(6,'그림자 속으로',40,'kenen-shadow','주변 적에게 피해와 둔화를 주고 5초간 그림자 속에 숨습니다. 은신 중 공격과 궁극기를 사용할 수 없습니다.',{
 canCast(r,s){return r.num(r.globals.get(ids(s,'ob2m','rav6')))===0;},
 *cast(r,c,{side,caster,target,state}){if(Math.hypot(caster.x-target.x,caster.y-target.y)<=45)yield* hit(r,c,side,4,'slow',5,60);
  const id=ids(side,'ob2m','rav6');state.shadowUntil=r.tick+300;r.set(caster,id,1);try{yield 300;}finally{r.set(caster,id,0);state.shadowUntil=0;}},
 blocksKey(r,key,s,st){return st.shadowUntil>r.tick&&[ids(s,69,13),ids(s,83,40)].includes(key);},
 onFunction(r,c,id,args,s,st){if(st.shadowUntil>r.tick&&c.e.combatSide===s&&id===ids(s,'qy83','05j0'))return false;},
 hidden(r,e,s,st){return st.shadowUntil>r.tick&&([ids(s,'00h9','n8fg'),ids(s,'n230','ocqj'),ids(s,'zlk5','79eo'),ids(s,'aadi','0y61')].includes(e.objectId)||(['0oxa','siav','5c3y','w3fb'].includes(e.objectId)&&e.combatSide===s));}
});
export const cannonGrenade=definition(32,'유탄',72,'cannon-grenade','기어의 절반을 소모해 유도탄을 발사합니다. 소모한 기어에 따라 피해와 부가 효과가 증가합니다.',{
 effectPictures:[],
 prepare(project){this.effectPictures=[nativePicture(project,'hyk2','cannon-grenade-projectile')];prepare.call(this,project);},
 *cast(r,c,{side,caster,target,state}){const owner=context(r,side),held=Math.max(0,Math.min(10,Math.floor(r.num(r.get(owner,'ck61'))))),spent=Math.ceil(held/2);r.set(owner,'ck61',held-spent);state.lastGearsSpent=spent;
  const missile=visual(r,side,'cannon-grenade-projectile',caster.x,caster.y,16,'cannon-grenade');
  try{for(let i=0;i<120&&alive(r,side);i++){const dx=target.x-missile.x,dy=target.y-missile.y,d=Math.hypot(dx,dy);missile.rotation=-Math.atan2(dy,dx)*180/Math.PI;
   if(d<=12&&visibleTarget(r,side)){yield* hit(r,c,side,spent+5,spent===5?'stun':spent>=3?'root':spent===2?'slow':null,8,120);return;}
   if(d>0){missile.x+=dx/d*Math.min(4,d);missile.y+=dy/d*Math.min(4,d);}yield 1;}
  }finally{missile.dead=true;}
 }
});
function nativePicture(project,object,id){const p=project.objects.find(o=>o.id===object).sprite.pictures[0];return [id,p.fileurl,p.dimension];}
const orbit=(e,s)=>e.objectId===ids(s,'q6zw','kxwh');
export const eclipseDeparture=definition(4,'궤도 이탈',30,'eclipse-departure','회전검을 적 방향으로 발사합니다. 적중 시 피해와 둔화를 주며, 돌아오는 동안 회전검을 사용할 수 없습니다.',{
 prepare(project){this.effectPictures=[nativePicture(project,'q6zw','eclipse-flying-sword')];prepare.call(this,project);},
 blocksCollision(r,e,s,st){return !!st.swordAway&&orbit(e,s);},
 hidden(r,e,s,st){return !!st.swordAway&&!st.orbitReturnAt&&orbit(e,s);},
 afterStep(r,s,st){if(!st.orbitReturnAt)return;const p=Math.min(1,(r.tick-st.orbitReturnAt)/18),caster=body(r,s);for(const e of r.entities)if(orbit(e,s)&&e.clone&&!e.dead){savePresentation(e);e.x=caster.x+(e.x-caster.x)*p;e.y=caster.y+(e.y-caster.y)*p;e.scaleX*=p;e.scaleY*=p;}},
 *cast(r,c,{side,caster,target,state}){state.swordAway=true;const sword=visual(r,side,'eclipse-flying-sword',caster.x,caster.y,24,'eclipse-flying-sword');const dx=target.x-caster.x,dy=target.y-caster.y,d=Math.hypot(dx,dy)||1;let struck=false;
  try{for(let distance=0;distance<130&&alive(r,side);distance+=5){sword.x+=dx/d*5;sword.y+=dy/d*5;sword.rotation+=25;if(!struck&&Math.hypot(sword.x-target.x,sword.y-target.y)<=18&&visibleTarget(r,side)){struck=true;yield* hit(r,c,side,9,'slow',6,60);break;}yield 1;}
   while(alive(r,side)&&Math.hypot(sword.x-caster.x,sword.y-caster.y)>8){const x=caster.x-sword.x,y=caster.y-sword.y,len=Math.hypot(x,y);sword.x+=x/len*Math.min(7,len);sword.y+=y/len*Math.min(7,len);sword.rotation+=25;yield 1;}
   sword.dead=true;state.orbitReturnAt=r.tick;yield 18;
  }finally{sword.dead=true;state.swordAway=false;delete state.orbitReturnAt;}
 }
});
export const enrilUpdraft=definition(27,'상승기류',16,'enril-updraft','즉시 점프합니다. 재사용 대기시간은 3초이며 공중에서는 두 번까지, 두 번째는 낙하 중에 사용할 수 있습니다.',{
 cooldownTicks:180,
 tick(r,s,st){const e=body(r,s);if(!e)return;const velocity=r.num(r.globals.get(ids(s,'du2p','iblx')));if(velocity>0){st.airborne=true;return;}const y=e.y,clear=!r.reach(e,'6tzq');let grounded=false;try{e.y-=.6;grounded=clear&&r.reach(e,'6tzq');}finally{e.y=y;}if(grounded&&st.airborne){st.airUses=0;st.airborne=false;}else if(!grounded)st.airborne=true;},
 canCast(r,s){const st=r.secondarySkills.state(s),e=body(r,s),vy=r.num(r.globals.get(ids(s,'du2p','iblx')));return (st.airUses||0)<2&&(!(st.airUses>0)||vy<0)&&r.num(r.globals.get(ids(s,'05ze','1vu0')))<=0&&r.num(r.globals.get(ids(s,'f7zw','932j')))===0&&e.y<125;},
 *cast(r,c,{side,state}){state.airUses=(state.airUses||0)+1;state.airborne=true;r.globals.set(ids(side,'du2p','iblx'),2.5);}
});
export const NEW_SECONDARY_SKILLS=[nationTransplant,glamsRush,guardGiantStrike,kenenShadow,cannonGrenade,eclipseDeparture,enrilUpdraft];
