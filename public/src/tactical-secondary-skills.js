import { prepareSkill as prepare, skillVisual as visual } from './additional-secondary-skills.js';
import { showStatusVisual } from './expanded-secondary-skills.js';
export const RAGE_QUIT=Object.freeze({manaCost:34,radius:55,damage:7,push:25,slow:8,slowTicks:90,cooldownTicks:300});
export const HUNTING_TRAP=Object.freeze({manaCost:30,durationTicks:360,rootTicks:90,initialSpeed:8,speedDecay:.02,initialTilt:1.5,tiltDecay:.06,flightTicks:130,radius:28,cooldownTicks:300});
export const TURRET=Object.freeze({manaCost:60,durationTicks:540,intervalTicks:180,cooldownTicks:720,triggerRadius:35,damagePerShot:3,push:25,slow:8,slowTicks:90});
const id=(s,a,b)=>s===1?a:b,body=(r,s)=>r.originals.get(id(s,'00h9','n8fg'));
const alive=(r,s)=>r.scene==='7dwq'&&r.num(r.globals.get(id(s,'akf6','7ir2')))>0&&r.num(r.globals.get('r71b'))===0;
const visible=(r,s)=>r.num(r.globals.get(id(s,'ob2m','rav6')))===0;
const vulnerable=(r,s)=>r.num(r.globals.get(id(s,'jcf6','ec6d')))===0;
const picture=(p,object,index=0)=>p.objects.find(o=>o.id===object).sprite.pictures[index];
const alias=(p,object,key,index=0)=>{const q=picture(p,object,index);return[key,q.fileurl,q.dimension];};
function definition(character,name,cfg,key,description,extra){return{character,name,manaCost:cfg.manaCost,cooldownTicks:cfg.cooldownTicks,lockVariable:false,prepare,icon:`assets/secondary/${key}-icon.svg`,secondaryPictureId:key+'-icon',description,...extra};}
function root(r,source,ticks){const foe=3-source,e=body(r,foe);if(!vulnerable(r,foe))return false;const variable=id(foe,'05ze','1vu0');r.set(e,variable,Math.max(r.num(r.get(e,variable)),(ticks+1)*.02));showStatusVisual(r,source,'root',ticks+1);return true;}
export const logitechRageQuit=definition(34,'빡종',RAGE_QUIT,'logitech-rage-quit','주변 적에게 피해를 주고 밀쳐내며 둔화시킵니다.',{
 effectPictures:[],prepare(p){this.effectPictures=[alias(p,'chu8','rage-original-wave')];prepare.call(this,p);},
 slowValue(r,e,variable,raw,st){const slow=st.slow;if(slow?.until>r.tick&&visible(r,slow.side)&&vulnerable(r,slow.side)&&variable===id(slow.side,'9af4','nccn'))return Math.max(r.num(raw),slow.value);return raw;},
 *cast(r,c,{side,caster,target,state}){const cfg=RAGE_QUIT,wave=visual(r,side,'rage-original-wave',caster.x,caster.y,2,'rage-wave');
  r.spawn(wave,function*(rt){try{for(let i=1;i<=18&&alive(rt,side);i++){rt.setSize(wave,2+(cfg.radius*2-2)*(1-(1-i/18)**2));wave.effects.transparency=40+i/18*60;yield 1;}}finally{wave.dead=true;}},'rage_wave');
  if(!alive(r,3-side)||!visible(r,side)||!visible(r,3-side)||Math.hypot(caster.x-target.x,caster.y-target.y)>cfg.radius)return;
  yield* r.call(c,id(side,'qy83','05j0'),[-cfg.damage,0,1]);if(!vulnerable(r,3-side))return;
  const direction=Math.sign(target.x-caster.x)||(r.num(r.globals.get(id(side,'etjn','846x')))===1?1:-1);r.add(target,id(3-side,'c9o4','lgp6'),direction*cfg.push*.625);state.slow={side:3-side,value:cfg.slow,until:r.tick+cfg.slowTicks};showStatusVisual(r,side,'slow',cfg.slowTicks);
 }
});
export const amazonesHuntingTrap=definition(9,'사냥용 덫',HUNTING_TRAP,'amazones-hunting-trap','적을 속박시키는 그물 덫을 발사합니다.',{
 effectPictures:[['hunting-net','assets/secondary/amazones-net.svg',{width:100,height:100}]],
 canCast(r,s){return !r.secondarySkills.state(s).netUid;},
 *cast(r,c,{side,caster,state}){this.launch(r,side,state,{x:caster.x,y:caster.y+4});},
 launch(r,side,state,origin){const cfg=HUNTING_TRAP,caster=body(r,side),target=body(r,3-side),direction=r.num(r.globals.get(id(side,'etjn','846x')))===1?1:-1,net=visual(r,side,'hunting-net',origin?.x??caster.x,origin?.y??caster.y,12,'hunting-net');state.netUid=net.uid;
  r.spawn(net,function*(rt){let landed=false,landedAt=0,speed=cfg.initialSpeed,tilt=cfg.initialTilt;try{for(let age=0;age<cfg.flightTicks+cfg.durationTicks+20&&alive(rt,side);age++){
   if(!landed){if(age>=cfg.flightTicks||net.y < -155||Math.abs(net.x)>255)return;
    // The original spear changes speed and pitch by these exact amounts each tick.
    speed-=cfg.speedDecay;tilt-=cfg.tiltDecay;const angle=tilt*5*Math.PI/180,dx=direction*Math.cos(angle)*speed/1.4,dy=Math.sin(angle)*speed/1.4,parts=Math.max(1,Math.ceil(Math.hypot(dx,dy)));net.rotation=direction>0?-tilt*5:tilt*5;
    for(let n=0;n<parts;n++){net.x+=dx/parts;if(rt.reach(net,'6tzq')||rt.reach(net,'2bx4'))return;const oldY=net.y;net.y+=dy/parts;if(rt.reach(net,'6tzq')||rt.reach(net,'2bx4')){net.y=oldY;if(dy<=0){landed=true;landedAt=rt.tick;net.rotation=0;net.scaleY=net.scaleX*.22;net.trapLanded=true;}else return;break;}}
   }
   if(landed){const age=rt.tick-landedAt;if(age>=cfg.durationTicks)return;const width=12+(cfg.radius*2-12)*Math.min(1,age/12);net.scaleX=width/net.width;net.scaleY=net.scaleX*.22;net.effects.transparency=age>cfg.durationTicks-30?(age-cfg.durationTicks+30)/30*100:0;
    // A ground net catches feet, rather than rooting players jumping above it.
    const targetHeight=rt.size(target)||18,inside=Math.abs(net.x-target.x)<=width/2+targetHeight/2&&Math.abs(net.y-(target.y-targetHeight/2))<=10;
    if(alive(rt,3-side)&&visible(rt,side)&&visible(rt,3-side)&&inside){root(rt,side,cfg.rootTicks);return;}
   }yield 1;
  }}finally{net.dead=true;if(state.netUid===net.uid)delete state.netUid;}},'hunting_net');
 }

});
export const boomTurret=definition(23,'터렛',TURRET,'boom-turret','앞뒤로 바주카를 발사합니다. 적이 접근한다면 자폭하며 적에게 피해를 줍니다.',{
 effectPictures:[],prepare(p){this.effectPictures=[['boom-turret-body','assets/secondary/boom-turret.svg',{width:240,height:180}],alias(p,'6115','turret-original-explosion',4)];prepare.call(this,p);},
 slowValue:logitechRageQuit.slowValue,
 canCast(r,s){return !r.secondarySkills.state(s).turretUid;},
 *cast(r,c,{side,caster,target,state}){const cfg=TURRET,turret=visual(r,side,'boom-turret-body',caster.x,caster.y-2,28,'boom-turret');state.turretUid=turret.uid;state.turretShots=0;
  try{for(let age=0;age<=cfg.durationTicks&&alive(r,side);age++){
   if(alive(r,3-side)&&visible(r,side)&&visible(r,3-side)&&Math.hypot(target.x-turret.x,target.y-turret.y)<=cfg.triggerRadius){
    const remaining=Math.max(0,2*Math.floor(cfg.durationTicks/cfg.intervalTicks)-state.turretShots);state.turretBurstDamage=remaining*cfg.damagePerShot;turret.dead=true;
    const blast=visual(r,side,'turret-original-explosion',turret.x,turret.y,10,'turret-burst');r.spawn(blast,function*(rt){try{for(let i=0;i<18;i++){rt.setSize(blast,10+(cfg.triggerRadius*2-10)*(1-(1-i/18)**2));blast.effects.transparency=i/18*100;yield 1;}}finally{blast.dead=true;}},'turret_burst');
    if(remaining>0)yield* r.call(c,id(side,'qy83','05j0'),[-state.turretBurstDamage,0,1]);
    if(vulnerable(r,3-side)){const direction=Math.sign(target.x-turret.x)||(r.num(r.globals.get(id(side,'etjn','846x')))===1?1:-1);r.add(target,id(3-side,'c9o4','lgp6'),direction*cfg.push*.625);state.slow={side:3-side,value:cfg.slow,until:r.tick+cfg.slowTicks};showStatusVisual(r,side,'slow',cfg.slowTicks);}break;
   }
   if(age>0&&age%cfg.intervalTicks===0){for(const direction of [-1,1]){this.fire(r,side,turret.x,turret.y+4,direction);state.turretShots++;}}
   if(age===cfg.durationTicks)break;turret.effects.transparency=age>cfg.durationTicks-20?(age-cfg.durationTicks+20)/20*100:0;yield 1;
  }}
  finally{turret.dead=true;if(state.turretUid===turret.uid)delete state.turretUid;}
 },
 fire(r,side,x,y,direction){const owner=r.originals.get(id(side,'6115','g1va')),shot=r.makeEntity(owner.def,owner);Object.assign(shot,{clone:true,combatSide:side,secondaryEffect:'turret-rocket',turretOrigin:{side,x,y},nativeSkillVariables:{[id(side,'rr24','qvkr')]:0,[id(side,'etjn','846x')]:direction>0?1:0},x,y,rotation:direction>0?0:180});r.entities.unshift(shot);r.dispatchEntity(shot,'when_clone_start');return shot;},
 onCommand(r,c,type,args,side){if(c.e.turretOrigin?.side!==side||type!=='locate'||args[0]!==id(side,'00h9','n8fg'))return;c.e.x=c.e.turretOrigin.x;c.e.y=c.e.turretOrigin.y;return false;}
});
const JAB={manaCost:18,cooldownTicks:48,range:44.2,damage:5};
const PILLAR={manaCost:26,cooldownTicks:180,offset:24,width:24,height:56,damage:4,lift:1.35,slow:8,slowTicks:120};
const canStrike=(r,s)=>[s,3-s].every(p=>alive(r,p)&&visible(r,p)&&!r.secondarySkills.hidden(body(r,p))&&!r.castle.hidden(body(r,p)));
const facing=(r,s)=>r.num(r.globals.get(id(s,'etjn','846x')))===1?1:-1;
export const kanJab=definition(8,'잽',JAB,'kan-jab','앞쪽으로 주먹을 빠르게 뻗습니다.',{
 prepare(p){this.effectPictures=[alias(p,'ri23','kan-jab-fist')];prepare.call(this,p);},
 hidden(r,e,side,state){return state.jabHand===e.objectId&&!e.clone;},
 blocksKey(r,key,side,state){return !!state.jabHand&&key===id(side,69,13);},
 *cast(r,c,{side,caster,target,state}){
  const dir=facing(r,side);
  const hands=id(side,['ri23','4mt9'],['uxuo','m2p4']).map(key=>r.originals.get(key));
  const hand=hands.reduce((front,e)=>dir*(e.x-front.x)>0?e:front);
  const start=Math.max(5,(hand.x-caster.x)*dir),height=hand.y-caster.y;
  const size=r.size(hand),fist=visual(r,side,'kan-jab-fist',hand.x,hand.y,size,'kan-jab');
  Object.assign(fist,{picture:hand.picture,width:hand.width,height:hand.height,regX:hand.regX,regY:hand.regY,scaleX:hand.scaleX,scaleY:hand.scaleY,rotation:hand.rotation});
  state.jabHand=hand.objectId;
  try{for(let frame=0;frame<=10&&alive(r,side);frame++){
   const progress=frame<=3?1-(1-frame/3)**2:(1-(frame-3)/7)**2;
   const reach=JAB.range-size/2;
   fist.x=caster.x+dir*(start+(reach-start)*progress);
   fist.y=caster.y+height*(1-progress);
   if(frame===3&&canStrike(r,side)){
    const dx=(target.x-caster.x)*dir;
    if(dx>=0&&dx<=JAB.range&&Math.abs(target.y-caster.y)<=10)
      yield* r.call(c,id(side,'qy83','05j0'),[-JAB.damage,0,1]);
   }
   yield 1;
  }}finally{fist.dead=true;delete state.jabHand;}
 }
});
function pillarFloor(r,caster,x){
 const probe=r.makeEntity(caster.def,caster);
 Object.assign(probe,{x,visible:true,rotation:0,regX:probe.width/2,regY:probe.height/2,scaleX:1/probe.width,scaleY:1/probe.height});
 const solid=()=>r.reach(probe,'6tzq')||r.reach(probe,'2bx4');
 const start=Math.min(134,r.bounds(caster).bottom+10);
 probe.y=start;
 if(solid())return null;
 for(let y=start-1;y>=-134;y--){
  probe.y=y;if(!solid())continue;
  let lo=y,hi=y+1;
  for(let i=0;i<6;i++){probe.y=(lo+hi)/2;if(solid())lo=probe.y;else hi=probe.y;}
  return (lo+hi)/2-.5;
 }
 return null;
}
export const wartWaterPillar=definition(21,'물기둥',PILLAR,'wart-water-pillar','앞쪽 바닥에서 물기둥을 솟게 합니다. 물기둥에 닿은 적은 피해를 받으며 떠오릅니다.',{
 prepare(p){this.effectPictures=[alias(p,'f9zp','wart-pillar-water',2),alias(p,'o3uq','wart-pillar-spray',2)];prepare.call(this,p);},
 slowValue(r,e,variable,raw,state){return logitechRageQuit.slowValue(r,e,variable,raw,state);},
 canCast(r,side){
  const caster=body(r,side),x=caster.x+facing(r,side)*PILLAR.offset;
  if(Math.abs(x)>228)return false;
  const y=pillarFloor(r,caster,x);
  if(y===null)return false;
  r.secondarySkills.state(side).pillarOrigin={x,y};return true;
 },
 *cast(r,c,{side,state,target}){
  const origin=state.pillarOrigin;delete state.pillarOrigin;if(!origin)return;
  const effect=visual(r,side,'wart-pillar-water',origin.x,origin.y,1,'wart-water-pillar');
  effect.regY=effect.height;
  const spray=Array.from({length:5},(_,i)=>visual(r,side,'wart-pillar-spray',origin.x,origin.y,4+i%2,'wart-water-spray'));
  let hit=false;
  try{for(let frame=0;frame<18&&alive(r,side);frame++){
   const rise=Math.min(1,(frame+1)/6);
   const height=PILLAR.height*(frame<10?rise:Math.max(.08,1-((frame-9)/9)**2));
   spray.forEach((drop,i)=>{
    const t=frame/17, spread=(i-2)*5;
    drop.x=origin.x+spread*(.5+t*1.6);
    drop.y=origin.y+Math.max(0,(PILLAR.height+i*3)*4*t*(1-t));
    drop.rotation=i*18+frame*4;drop.effects.transparency=Math.max(0,(frame-10)*13);
   });
   effect.scaleX=PILLAR.width/effect.width;effect.scaleY=height/effect.height;
   effect.effects.transparency=Math.max(0,frame-9)*11;
   if(!hit&&frame<10&&canStrike(r,side)&&Math.abs(target.x-origin.x)<=PILLAR.width/2+7&&target.y>=origin.y&&target.y<=origin.y+height){
    hit=true;
    yield* r.call(c,id(side,'qy83','05j0'),[-PILLAR.damage,0,1]);
    if(vulnerable(r,3-side)){
     const vy=id(side,'iblx','du2p');r.globals.set(vy,Math.max(PILLAR.lift,r.num(r.globals.get(vy))));
     r.spawn(target,function*(rt){
      for(let tick=0;tick<180&&alive(rt,3-side)&&alive(rt,side);tick++){
       if(rt.num(rt.globals.get(vy))<=0){
        if(vulnerable(rt,3-side)){
         state.slow={side:3-side,value:PILLAR.slow,until:rt.tick+PILLAR.slowTicks};
         // The native slow emitter reads slowValue and draws its usual particles.
        }return;
       }
       yield 1;
      }
     },'wart_pillar_slow_on_descent');
    }
   }
   yield 1;
  }}finally{effect.dead=true;for(const drop of spray)drop.dead=true;}
 }
});
const ELEMENT={manaCost:41,cooldownTicks:240,attackCooldownTicks:60};
const elementOf=(r,s)=>r.num(r.get(body(r,s),'arfp'));
const stunKey=s=>id(s,'8w41','wyyq');
const areaRadius=44;
export const elementSwordArts=definition(24,'원소술',ELEMENT,'element-sword-arts','현재 강화 속성에 맞는 검술을 사용합니다.',{
 prepare(p){
  this.effectPictures=[0,1,2].map(i=>alias(p,'4cof','element-art-'+i,i));
  this.effectPictures.push(alias(p,'m54n','element-fire-sword',0));
  this.effectPictures.push(['element-water-area','assets/secondary/element-water-area.svg',{width:100,height:100}]);
  prepare.call(this,p);
 },
 hidden(r,e,side,state){return !!state.fireSwing&&!e.clone&&e.objectId===id(side,'m54n','rj41');},
 tick(r,side,state){if(state.waterBoost&&(r.tick>=state.waterBoost.until||elementOf(r,side)!==2))delete state.waterBoost;},
 blocksKey(r,key,side,state){return !!state.elementSwing&&[id(side,69,13),id(side,83,40)].includes(key);},
 slowValue(r,e,variable,raw,state){return logitechRageQuit.slowValue(r,e,variable,raw,state);},
 onFunction(r,c,fn,args,side,state){
  const area=state.waterBoost,caster=body(r,side);
  if(area&&r.tick<area.until&&Math.hypot(caster.x-area.x,caster.y-area.y)<=areaRadius&&alive(r,side)&&elementOf(r,side)===2&&fn===id(side,'qy83','05j0')&&c.e!==body(r,3-side)&&r.num(args[0])<0)
   args[0]=r.num(args[0])*1.2;
 },
 *cast(r,c,{side,caster,target,state}){
  const element=elementOf(r,side),dir=facing(r,side),x=caster.x,y=caster.y;
  if(element!==2)state.readyAt=r.tick+ELEMENT.attackCooldownTicks;
  const slash=visual(r,side,element===0?'element-fire-sword':'element-art-'+element,x,y,element===0?47:element===1?36:29,'element-slash');
  if(element===0){slash.regX=106;slash.regY=279;state.fireSwing=true;}
  let hit=false;state.elementSwing=true;
  try{
   if(element===2){
    state.waterBoost={x,y,until:r.tick+180};
    const area=visual(r,side,'element-water-area',x,y,areaRadius*2,'element-water-area');
    r.spawn(area,function*(rt,ctx){try{for(let n=1;n<=180;n++){
     yield 1;if(!alive(rt,side))return;
     if(n%60===0&&Math.hypot(caster.x-x,caster.y-y)<=areaRadius){
      const hp=id(side,'akf6','7ir2'),max=id(side,'xr74','67ko');
      const amount=Math.min(1,rt.num(rt.globals.get(max))-rt.num(rt.globals.get(hp)));
      if(amount>0)yield* rt.call(ctx,id(side,'albn','41z4'),[amount]);
     }
     area.effects.transparency=Math.max(0,n-164)*6;
    }}finally{area.dead=true;}},'element_water_heal');
   }
   for(let frame=0;frame<12&&alive(r,side)&&!r.num(r.globals.get(stunKey(side)));frame++){
    if(element===1&&frame<8&&!r.num(r.globals.get(id(side,'05ze','1vu0')))){
     for(let step=0;step<6;step++){const old=caster.x;caster.x+=dir;if(Math.abs(caster.x)>232||r.reach(caster,'6tzq')){caster.x=old;break;}}
    }
    const angle=dir*(frame/11*2*Math.PI);
    slash.x=caster.x+(element===2?Math.cos(angle)*22:dir*(element===0?6:13));
    slash.y=caster.y+(element===2?Math.sin(angle)*22:0);
    slash.scaleX=Math.abs(slash.scaleX)*dir;
    slash.rotation=element===2?-angle*180/Math.PI:element===0?dir*(-63+frame*13):0;
    slash.effects.transparency=Math.max(0,frame-8)*22;
    const dx=(target.x-caster.x)*dir,dy=target.y-caster.y;
    const inRange=element===2?Math.hypot(target.x-x,target.y-y)<=areaRadius:
      element===1?dx>=-8&&dx<=26&&Math.abs(dy)<=16:
      frame>=3&&frame<=8&&dx>=-4&&dx<=48&&Math.abs(dy)<=24;
    if(!hit&&inRange&&canStrike(r,side)){
     hit=true;yield* r.call(c,id(side,'qy83','05j0'),[-[8,7,5][element],0,1]);
     if(element===0){
      if(vulnerable(r,3-side))state.slow={side:3-side,value:8,until:r.tick+180};
      if(state.burn)state.burn.until=r.tick+180;
      else{
       const burn=state.burn={until:r.tick+180};
       let nextBurn=r.tick+60;
       r.spawn(caster,function*(rt,ctx){
        try{while(alive(rt,side)&&alive(rt,3-side)){
         yield Math.max(1,nextBurn-rt.tick);nextBurn+=60;
         if(rt.tick>burn.until||!alive(rt,side)||!alive(rt,3-side))return;
         if(canStrike(rt,side))yield* rt.call(ctx,id(side,'qy83','05j0'),[-2,0,1]);
         if(rt.tick>=burn.until)return;
        }}finally{if(state.burn===burn)delete state.burn;}
       },'element_burn');
      }
     }
     if(element===1&&vulnerable(r,3-side)){
      const key=stunKey(3-side),gen=id(side,'bpv5','bpv0');
      r.add(target,gen,1);const token=r.get(target,gen);r.set(target,key,1);
      showStatusVisual(r,side,'stun',30);
      r.spawn(target,function*(rt){yield 30;if(rt.get(target,gen)===token)rt.set(target,key,0);},'element_stun');
     }
    }
    yield 1;
   }
  }finally{slash.dead=true;delete state.elementSwing;delete state.fireSwing;}
 }
});
function cleanse(r,side,caster){
 const foe=3-side,opponent=r.secondarySkills.state(foe);
 const keys=side===1?['8w41','05ze','9af4','mfr0','td66','bpvc','v5ew','f7zw','omu7','wr8j','96zg']:
   ['wyyq','1vu0','nccn','mnus','ziwi','bpvd','f1dk','932j','igdl','u3f8','7rtf'];
 for(const key of keys)r.set(caster,key,['96zg','7rtf'].includes(key)?1:0);
 r.add(caster,id(side,'bpv0','bpv5'),1);
 if(opponent.slow?.side===side)delete opponent.slow;
 if(opponent.burn)opponent.burn.until=r.tick-1;
 if(opponent.fear)opponent.fear.until=r.tick-1;
 const chess=r.castle.state(foe);
 if(chess?.slow?.side===side)delete chess.slow;
 if(chess?.crown?.target===side)chess.crown=null;
 const enemy=body(r,foe);
 if(r.num(r.globals.get(id(foe,'y75t','s5vb')))===25)r.set(enemy,'zxd6',0);
 const fearObject=id(side,'e7ip','nijg'),fearMessage=id(side,'w9n1','smzv');
 const originalFear=r.events.get(fearObject)?.find(e=>e.type==='when_message_cast'&&e.params[1]===fearMessage)?.fn;
 for(const t of [...r.threads,...r.pending])if(t.fn===originalFear)t.cancelled=true;
}
const BLESSING={manaCost:42,cooldownTicks:600,ticks:180};
export const michaelBlessing=definition(33,'대 천사의 축복',BLESSING,'michael-blessing','모든 부정적인 효과를 제거하고, 3초간 받는 피해가 30% 감소하며 공격력이 30% 증가합니다.',{
 castWhileStunned:true,
 prepare(p){this.effectPictures=[alias(p,'q4lr','michael-blessing-light')];prepare.call(this,p);},
 damageMultiplier(r,key,value,side,state){
  return key===id(side,'mm0r','nmkh')&&state.blessingUntil>r.tick&&alive(r,side)?r.num(value)*.7:value;
 },
 onFunction(r,c,fn,args,side,state){
  if(state.blessingUntil>r.tick&&alive(r,side)&&fn===id(side,'qy83','05j0')&&c.e!==body(r,3-side)&&r.num(args[0])<0)args[0]=r.num(args[0])*1.3;
 },
 *cast(r,c,{side,caster,state}){
  cleanse(r,side,caster);state.blessingUntil=r.tick+BLESSING.ticks;
  const light=visual(r,side,'michael-blessing-light',caster.x,caster.y,35,'michael-blessing');
  try{while(state.blessingUntil>r.tick&&alive(r,side)){
   light.x=caster.x;light.y=caster.y;light.effects.transparency=66+Math.sin(r.tick/7)*12;yield 1;
  }}finally{light.dead=true;delete state.blessingUntil;}
 }
});
const DARKNESS={manaCost:50,cooldownTicks:540,ticks:300,slow:7,fearTicks:48};
export const lycanDarkness=definition(29,'어둠',DARKNESS,'lycan-darkness','5초에 걸쳐 초당 에너지 8%를 충전하고 적을 둔화시킵니다. 어둠 중 늑대의 공격에 맞은 적은 도망갑니다.',{
 prepare(p){this.effectPictures=[alias(p,'x1zv','lycan-darkness-eyes')];prepare.call(this,p);},
 slowValue(r,e,key,raw,state){return logitechRageQuit.slowValue(r,e,key,raw,state);},
 onFunction(r,c,fn,args,side,state){
  if(!(state.darkUntil>r.tick)||fn!==id(side,'qy83','05j0')||r.num(args[0])>=0||
    !id(side,['jk2d','dsht'],['5isi','qdoq']).includes(c.e.objectId)||r.num(r.get(c.e,'0m2d'))!==1||
    !canStrike(r,side)||!vulnerable(r,3-side))return;
  if(state.fear&&state.fear.until>=r.tick){state.fear.until=r.tick+DARKNESS.fearTicks;return;}
  const target=body(r,3-side),caster=body(r,side),fear=state.fear={until:r.tick+DARKNESS.fearTicks};
  const flag=id(side,'mnus','mfr0'),turn=id(side,'846x','etjn'),speed=id(side,'j88w','utbg');
  const nativeFearObject=id(side,'nijg','e7ip'),nativeFearMsg=id(side,'smzv','w9n1');
  r.set(target,flag,1);
  r.spawn(target,function*(rt){try{
   while(rt.tick<fear.until&&alive(rt,side)&&alive(rt,3-side)&&vulnerable(rt,3-side)){
    // Same forced facing and acceleration as Harlan's original fear.
    const direction=Math.sign(target.x-caster.x)||facing(rt,side);
    rt.set(target,turn,direction>0?1:0);rt.add(target,speed,direction*.15);yield 1;
   }
  }finally{
   if(state.fear===fear){
    delete state.fear;
    const native=rt.events.get(nativeFearObject)?.find(e=>e.params[1]===nativeFearMsg)?.fn;
    if(!rt.threads.some(t=>!t.cancelled&&t.fn===native))rt.set(target,flag,0);
   }
  }},'lycan_darkness_fear');
 },
 *cast(r,c,{side,caster,state}){
  const start=r.tick,mana=id(side,'qn98','thom');
  state.darkUntil=start+DARKNESS.ticks;
  if(vulnerable(r,3-side))state.slow={side:3-side,value:DARKNESS.slow,until:state.darkUntil};
  const eyes=visual(r,side,'lycan-darkness-eyes',caster.x,caster.y+9,20,'lycan-darkness');
  let awarded=0;
  try{while(alive(r,side)){
   const elapsed=r.tick-start,earned=Math.min(5,Math.floor(elapsed/60));
   if(earned>awarded){r.set(caster,mana,Math.min(100,r.num(r.get(caster,mana))+8*(earned-awarded)));awarded=earned;}
   if(elapsed>=DARKNESS.ticks)break;
   eyes.x=caster.x;eyes.y=caster.y+9;eyes.effects.transparency=22+Math.sin(elapsed/9)*16;
   yield 1;
  }}finally{eyes.dead=true;delete state.darkUntil;}
 }
});
const FIREWORK={manaCost:39,cooldownTicks:270,speed:9,range:180,radius:31};
export const artenesFirework=definition(25,'폭죽 사냥',FIREWORK,'artenes-firework','범위 피해를 주는 폭죽을 발사합니다. 화살에 적중하면 그 자리에서 즉시 폭발합니다.',{
 prepare(p){this.effectPictures=[alias(p,'hctz','artenes-firework-arrow',4),alias(p,'6115','artenes-firework-blast',4)];prepare.call(this,p);},
 *cast(r,c,{side,caster,target}){
  const dir=facing(r,side),arrow=visual(r,side,'artenes-firework-arrow',caster.x,caster.y,19,'firework-arrow');
  arrow.scaleX=Math.abs(arrow.scaleX)*dir;
  let direct=false;
  try{
   flight:for(let traveled=0;traveled<FIREWORK.range&&alive(r,side);){
    for(let i=0;i<FIREWORK.speed&&traveled<FIREWORK.range;i++,traveled++){
     const old=arrow.x;arrow.x+=dir;
     if(Math.abs(arrow.x)>239||r.reach(arrow,'6tzq')||r.reach(arrow,'2bx4')){arrow.x=old;break flight;}
     if(canStrike(r,side)&&Math.hypot(arrow.x-target.x,arrow.y-target.y)<=10){direct=true;break flight;}
    }
    yield 1;
   }
   if(!alive(r,side))return;
   const marked=r.num(r.get(caster,'zxd6'))>0;
   const splash=canStrike(r,side)&&Math.hypot(arrow.x-target.x,arrow.y-target.y)<=FIREWORK.radius;
   if(marked&&(direct||splash))r.set(caster,'zxd6',0);
   const blast=visual(r,side,'artenes-firework-blast',arrow.x,arrow.y,16,'firework-blast');arrow.dead=true;
   r.spawn(blast,function*(rt){try{for(let n=0;n<16;n++){rt.setSize(blast,16+46*(1-(1-n/15)**2));blast.effects.transparency=n/15*100;yield 1;}}finally{blast.dead=true;}},'firework_blast');
   const fn=id(side,'qy83','05j0'),bonus=marked?3:0;
   if(direct)yield* r.call(c,fn,[-(5+bonus),0,1]);
   if(splash)yield* r.call(c,fn,[-(9+bonus),0,1]);
  }finally{arrow.dead=true;}
 }
});
export const TACTICAL_SECONDARY_SKILLS=[logitechRageQuit,amazonesHuntingTrap,boomTurret,kanJab,wartWaterPillar,elementSwordArts,michaelBlessing,lycanDarkness,artenesFirework];
