import {prepareSkill as prepare, skillVisual as visual} from './additional-secondary-skills.js';
const body=(r,s)=>r.originals.get(s===1?'00h9':'n8fg');
const ids=(s,a,b)=>s===1?a:b;
const alive=(r,s)=>r.num(r.globals.get(ids(s,'akf6','7ir2')))>0&&r.num(r.globals.get('r71b'))===0;
const visibleTarget=(r,s)=>r.num(r.globals.get(ids(s,'rav6','ob2m')))===0;
const dir=(r,s)=>r.num(r.globals.get(ids(s,'etjn','846x')))===1?1:-1;
const context=(r,s)=>r.originals.get(({20:ids(s,'f5xk','t3w4'),30:ids(s,'0dj2','5tsu'),32:ids(s,'plg8','cvkh')})[r.num(r.globals.get(ids(s,'y75t','s5vb')))])||body(r,s);
function status(r,s,type,amount,ticks){
 const foe=3-s,e=body(r,foe);if(r.num(r.globals.get(ids(foe,'jcf6','ec6d')))!==0)return;
 statusVisual(r,s,type,ticks);
 if(type==='root'){const id=ids(foe,'05ze','1vu0');r.set(e,id,Math.max(r.num(r.get(e,id)),ticks/60));return;}
 if(type==='slow'){const st=r.secondarySkills.state(s);st.slow={side:foe,value:amount,until:r.tick+ticks};return;}
 const id=ids(foe,'8w41','wyyq'),generation=ids(foe,'bpv0','bpv5');r.add(e,generation,1);const token=r.get(e,generation);r.set(e,id,1);
 r.spawn(e,function*(rt){yield ticks;if(rt.get(e,generation)===token)rt.set(e,id,0);},'secondary_status');
}
// Use the original status artwork even when its native script is character-gated.
function statusVisual(r,s,type,ticks,{fitBody=false,white=false}={}){
 const foe=3-s,object=type==='root'?ids(foe,'n095','2eo3'):type==='slow'?ids(foe,'5kuy','t0fv'):ids(foe,'hk0k','j2qx');
 const original=r.originals.get(object),picture=original.def.sprite.pictures[type==='slow'?1:0];
 const marker=r.makeEntity(r.defs.get('hb4u'));Object.assign(marker,{clone:true,combatSide:foe,secondaryEffect:`secondary-${type}`,picture,width:picture.dimension.width,height:picture.dimension.height,regX:picture.dimension.width/2,regY:picture.dimension.height/2,x:body(r,foe).x,y:body(r,foe).y,visible:true,scaleX:1,scaleY:1,rotation:0});
 const avatar=r.originals.get(ids(foe,'n230','ocqj'));
 if(white)marker.effects.whiteSilhouette=true;
 r.setSize(marker,fitBody?r.size(avatar):type==='stun'?18:type==='root'?26:22);r.entities.unshift(marker);
 r.spawn(marker,function*(rt){try{for(let tick=0;tick<ticks&&alive(rt,foe);tick++){
  if(type==='root'&&rt.num(rt.globals.get(ids(foe,'05ze','1vu0')))<=0)break;
  if(type==='stun'&&rt.num(rt.globals.get(ids(foe,'8w41','wyyq')))===0)break;
  const target=body(rt,foe);marker.x=target.x;marker.y=target.y+(type==='stun'?15:type==='slow'?-7:0);marker.visible=visibleTarget(rt,s)&&!(type==='stun'&&original.visible);
  if(fitBody)rt.setSize(marker,rt.size(avatar));
  if(type==='stun')marker.rotation=Math.sin(tick/6)*12;
  if(type==='slow')marker.effects.transparency=20+30*(tick%20)/20;
  yield 1;
 }}finally{marker.dead=true;}},'secondary_status_visual');
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
export const glamsRush=definition(20,'돌진 / 점멸 / 박치기',43,'glams-rush','방어막을 얻으며 돌진/앞 방향으로 순간이동/기절시키며 돌진을 합니다.',{
 *cast(r,c,{side,caster,target}){const owner=context(r,side),size=r.num(r.get(owner,'uh0p')),direction=dir(r,side);
  if(size===1){const start=caster.x;let found=false;for(let d=70;d>=0;d--){caster.x=Math.max(-232,Math.min(232,start+direction*d));if(!r.reach(caster,'6tzq')){found=true;break;}}if(!found)caster.x=start;return;}
  if(size===0){const id=ids(side,'cfmd','g4sc'),before=r.num(r.get(caster,id)),grant=Math.max(0,8-before);if(grant){r.add(caster,id,grant);r.spawn(caster,function*(rt){yield 120;rt.set(caster,id,Math.max(0,rt.num(rt.get(caster,id))-grant));},'secondary_shield');}}
  let struck=false;for(let i=0;i<12&&alive(r,side)&&r.num(r.globals.get(ids(side,'8w41','wyyq')))===0;i++){safeMove(r,caster,direction*70/12);if(size===2&&!struck&&Math.hypot(caster.x-target.x,caster.y-target.y)<=28&&visibleTarget(r,side)){struck=true;yield* hit(r,c,side,8,'stun',0,60);}yield 1;}
 }
});
export const guardGiantStrike=definition(14,'거인의 일격',28,'guard-giant','몸집을 키워 다음 일반 공격을 강화합니다.',{
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
export const kenenShadow=definition(6,'그림자 속으로',39,'kenen-shadow','주변에 피해와 둔화를 주며 그림자 속으로 3초간 숨습니다.',{
 canCast(r,s){return r.num(r.globals.get(ids(s,'ob2m','rav6')))===0;},
 *cast(r,c,{side,caster,target,state}){if(Math.hypot(caster.x-target.x,caster.y-target.y)<=45)yield* hit(r,c,side,4,'slow',5,60);
  const id=ids(side,'ob2m','rav6');state.shadowUntil=r.tick+180;r.set(caster,id,1);try{yield 180;}finally{r.set(caster,id,0);state.shadowUntil=0;}},
 blocksKey(r,key,s,st){return st.shadowUntil>r.tick&&[ids(s,69,13),ids(s,83,40)].includes(key);},
 onFunction(r,c,id,args,s,st){if(st.shadowUntil>r.tick&&c.e.combatSide===s&&id===ids(s,'qy83','05j0'))return false;},
 hidden(r,e,s,st){return st.shadowUntil>r.tick&&([ids(s,'00h9','n8fg'),ids(s,'n230','ocqj'),ids(s,'zlk5','79eo'),ids(s,'aadi','0y61')].includes(e.objectId)||(['0oxa','siav','5c3y','w3fb'].includes(e.objectId)&&e.combatSide===s));}
});
export const cannonGrenade=definition(32,'유탄',72,'cannon-grenade','기어의 절반을 소모하며 적에게 유도되는 유도탄을 발사합니다.',{
 range:130,
 effectPictures:[],
 prepare(project){this.effectPictures=[nativePicture(project,'plg8','cannon-grenade-projectile', '4zk0')];prepare.call(this,project);},
 *cast(r,c,{side,caster,target,state}){const owner=context(r,side),held=Math.max(0,Math.min(10,Math.floor(r.num(r.get(owner,'ck61'))))),spent=Math.ceil(held/2);r.set(owner,'ck61',held-spent);r.set(owner,'7rns',Math.max(0,r.num(r.get(owner,'7rns'))-spent));state.lastGearsSpent=spent;
  const missile=visual(r,side,'cannon-grenade-projectile',caster.x,caster.y,16,'cannon-grenade');
  let traveled=0;try{for(let i=0;i<120&&alive(r,side);i++){const dx=target.x-missile.x,dy=target.y-missile.y,d=Math.hypot(dx,dy);missile.rotation=-Math.atan2(dy,dx)*180/Math.PI;
   if(d<=12&&visibleTarget(r,side)){yield* hit(r,c,side,spent+5,spent===5?'stun':spent>=3?'root':spent===2?'slow':null,8,120);return;}
   if(traveled>=cannonGrenade.range)return;if(d===0){yield 1;continue;}
   const step=Math.min(4,d,cannonGrenade.range-traveled);
   missile.x+=dx/d*step;missile.y+=dy/d*step;traveled+=step;yield 1;}
  }finally{missile.dead=true;}
 }
});
function nativePicture(project,object,id,pictureId=null){const pictures=project.objects.find(o=>o.id===object).sprite.pictures;const p=pictures.find(p=>p.id===pictureId)||pictures[0];return [id,p.fileurl,p.dimension];}
const orbit=(e,s)=>e.objectId===ids(s,'q6zw','kxwh');
export const eclipseDeparture=definition(4,'궤도 이탈',30,'eclipse-departure','회전검을 적에게 발사합니다.',{
 canCast(r,s){return r.entities.some(e=>orbit(e,s)&&e.clone&&!e.dead);},
 onActivate(r,s,state){
  // Original blades orbit by using a pivot outside the image. Capture their visible
  // world centres BEFORE native threads advance, then detach each blade's pivot.
  state.swordLaunch=r.entities.filter(e=>orbit(e,s)&&e.clone&&!e.dead).map(e=>{
   const bounds=r.bounds(e);return {x:(bounds.left+bounds.right)/2,y:(bounds.bottom+bounds.top)/2,
    objectId:e.objectId,pictureId:e.picture.id,width:e.width,height:e.height,scaleX:e.scaleX,scaleY:e.scaleY,rotation:e.rotation};
  });
  state.swordAway=true;
 },
 prepare(project){this.effectPictures=[nativePicture(project,'q6zw','eclipse-flying-sword')];prepare.call(this,project);},
 blocksCollision(r,e,s,st){return !!st.swordAway&&orbit(e,s);},
 hidden(r,e,s,st){return !!st.swordAway&&!st.orbitReturnAt&&orbit(e,s);},
 afterStep(r,s,st){if(!st.orbitReturnAt)return;const p=Math.min(1,(r.tick-st.orbitReturnAt)/18),caster=body(r,s);for(const e of r.entities)if(orbit(e,s)&&e.clone&&!e.dead){savePresentation(e);e.x=caster.x+(e.x-caster.x)*p;e.y=caster.y+(e.y-caster.y)*p;e.scaleX*=p;e.scaleY*=p;}},
 *cast(r,c,{side,caster,target,state}){
  const origins=state.swordLaunch||[];
  const swords=origins.map(origin=>{
   const blade=visual(r,side,'eclipse-flying-sword',origin.x,origin.y,24,'eclipse-flying-sword');
   blade.picture=r.defs.get(origin.objectId).sprite.pictures.find(p=>p.id===origin.pictureId);
   Object.assign(blade,{width:origin.width,height:origin.height,regX:origin.width/2,regY:origin.height/2,scaleX:origin.scaleX,scaleY:origin.scaleY,rotation:origin.rotation});
   return {blade,startRotation:origin.rotation,phase:'aim',struck:false};
  });
  delete state.swordLaunch;
  if(!swords.length){state.swordAway=false;return;}
  try{
   // Turn about each blade's own centre, without moving its world position.
   // Track the enemy during the turn, then freeze one shared destination at release.
   for(let tick=1;tick<=12;tick++){
    for(const entry of swords){const e=entry.blade,angle=45-Math.atan2(target.y-e.y,target.x-e.x)*180/Math.PI,
     delta=((angle-entry.startRotation+540)%360)-180;e.rotation=entry.startRotation+delta*tick/12;}
    if(tick<12)yield 1;
   }
   const destination={x:target.x,y:target.y};
   for(const entry of swords){const e=entry.blade,dx=destination.x-e.x,dy=destination.y-e.y,len=Math.hypot(dx,dy);
    entry.dx=len?dx/len:0;entry.dy=len?dy/len:0;entry.remaining=Math.min(150,len+10);entry.phase='outbound';
    entry.destination={x:e.x+entry.dx*entry.remaining,y:e.y+entry.dy*entry.remaining};
    e.secondaryDestination={...entry.destination};
   }
   while(swords.some(entry=>entry.phase!=='caught')&&alive(r,side)){
    for(const entry of swords){const e=entry.blade;if(entry.phase==='caught')continue;
     if(entry.phase==='outbound'){
      const step=Math.min(5,entry.remaining);e.x+=entry.dx*step;e.y+=entry.dy*step;entry.remaining-=step;
      if(!entry.struck&&Math.hypot(e.x-target.x,e.y-target.y)<=18&&visibleTarget(r,side)){entry.struck=true;yield* hit(r,c,side,4);}
      if(entry.remaining<=1e-8){e.x=entry.destination.x;e.y=entry.destination.y;entry.phase='return';}
     }else{const dx=caster.x-e.x,dy=caster.y-e.y,len=Math.hypot(dx,dy);if(len<=8){entry.phase='caught';e.dead=true;continue;}e.x+=dx/len*Math.min(7,len);e.y+=dy/len*Math.min(7,len);e.rotation=45-Math.atan2(dy,dx)*180/Math.PI;}
    }yield 1;
   }
   state.orbitReturnAt=r.tick;yield 18;
  }finally{for(const {blade} of swords)blade.dead=true;state.swordAway=false;delete state.orbitReturnAt;}
 }

});
export const enrilUpdraft=definition(27,'상승기류',16,'enril-updraft','즉시 점프합니다.',{
 cooldownTicks:60,
 *cast(r,c,{side}){if(r.num(r.globals.get(ids(side,'05ze','1vu0')))>0)return;r.globals.set(ids(side,'du2p','iblx'),2.5);}
});
export const NEW_SECONDARY_SKILLS=[nationTransplant,glamsRush,guardGiantStrike,kenenShadow,cannonGrenade,eclipseDeparture,enrilUpdraft];

export { statusVisual as showStatusVisual };
