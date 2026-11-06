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
const JAB={manaCost:18,cooldownTicks:48,range:34,damage:5};
const PILLAR={manaCost:26,cooldownTicks:180,offset:24,width:24,height:56,damage:4,lift:1.35};
const canStrike=(r,s)=>[s,3-s].every(p=>alive(r,p)&&visible(r,p)&&!r.secondarySkills.hidden(body(r,p))&&!r.castle.hidden(body(r,p)));
const facing=(r,s)=>r.num(r.globals.get(id(s,'etjn','846x')))===1?1:-1;
export const kanJab=definition(8,'잽',JAB,'kan-jab','앞쪽으로 주먹을 빠르게 뻗습니다. 훅보다 피해가 낮지만 가로로 조금 더 멀리 닿습니다.',{
 prepare(p){this.effectPictures=[alias(p,'ri23','kan-jab-fist')];prepare.call(this,p);},
 *cast(r,c,{side,caster,target}){
  const dir=facing(r,side),fist=visual(r,side,'kan-jab-fist',caster.x,caster.y,10,'kan-jab');
  try{for(let frame=0;frame<9;frame++){
   fist.x=caster.x+dir*(frame<4?9+frame*6:27-(frame-4)*4);
   fist.y=caster.y;fist.scaleX=Math.abs(fist.scaleX)*dir;
   if(frame===3&&canStrike(r,side)){
    const dx=(target.x-caster.x)*dir;
    if(dx>=0&&dx<=JAB.range&&Math.abs(target.y-caster.y)<=10)
      yield* r.call(c,id(side,'qy83','05j0'),[-JAB.damage,0,1]);
   }
   yield 1;
  }}finally{fist.dead=true;}
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
export const wartWaterPillar=definition(21,'물기둥',PILLAR,'wart-water-pillar','앞쪽 바닥에서 물기둥을 솟게 해 적에게 피해를 주고 살짝 띄웁니다.',{
 prepare(p){this.effectPictures=[alias(p,'xaca','wart-pillar-water',3)];prepare.call(this,p);},
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
  let hit=false;
  try{for(let frame=0;frame<18&&alive(r,side);frame++){
   const height=PILLAR.height*Math.min(1,(frame+1)/6);
   effect.scaleX=PILLAR.width/effect.width;effect.scaleY=height/effect.height;
   effect.effects.transparency=Math.max(0,frame-9)*11;
   if(!hit&&frame<10&&canStrike(r,side)&&Math.abs(target.x-origin.x)<=PILLAR.width/2+7&&target.y>=origin.y&&target.y<=origin.y+height){
    hit=true;
    yield* r.call(c,id(side,'qy83','05j0'),[-PILLAR.damage,0,1]);
    if(vulnerable(r,3-side)){const vy=id(side,'iblx','du2p');r.globals.set(vy,Math.max(PILLAR.lift,r.num(r.globals.get(vy))));}
   }
   yield 1;
  }}finally{effect.dead=true;}
 }
});
export const TACTICAL_SECONDARY_SKILLS=[logitechRageQuit,amazonesHuntingTrap,boomTurret,kanJab,wartWaterPillar];
