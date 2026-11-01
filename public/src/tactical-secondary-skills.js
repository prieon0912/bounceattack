import { prepareSkill as prepare, skillVisual as visual } from './additional-secondary-skills.js';
import { showStatusVisual } from './expanded-secondary-skills.js';
export const RAGE_QUIT=Object.freeze({manaCost:34,radius:55,damage:7,push:25,slow:8,slowTicks:90,cooldownTicks:300});
export const HUNTING_TRAP=Object.freeze({manaCost:30,durationTicks:360,rootTicks:90,speed:6,radius:18,cooldownTicks:300});
export const TURRET=Object.freeze({manaCost:50,durationTicks:540,intervalTicks:180,cooldownTicks:720});
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
export const amazonesHuntingTrap=definition(9,'사냥용 덫',HUNTING_TRAP,'amazones-hunting-trap','다음 일반 공격으로 적의 위치에 그물 덫을 발사합니다. 적중한 적을 속박합니다.',{
 effectPictures:[['hunting-net','assets/secondary/amazones-net.svg',{width:100,height:100}]],
 canCast(r,s){const st=r.secondarySkills.state(s);return !st.armed&&!st.netUid;},
 *cast(r,c,{state}){state.armed=true;},
 onClone(r,c,child,side,state){if(!state.armed||c.e.clone||c.e.objectId!==id(side,'5rp3','6xoo')||c.block!=='7jk9'||!visible(r,side)||!visible(r,3-side))return;
  state.armed=false;child.dead=true;this.launch(r,side,state);
 },
 launch(r,side,state){const cfg=HUNTING_TRAP,caster=body(r,side),target=body(r,3-side),destination={x:target.x,y:target.y},net=visual(r,side,'hunting-net',caster.x,caster.y+4,12,'hunting-net');state.netUid=net.uid;
  r.spawn(net,function*(rt){let landed=false,landedAt=0;try{for(let age=0;age<480&&alive(rt,side);age++){
   if(!landed){const dx=destination.x-net.x,dy=destination.y-net.y,d=Math.hypot(dx,dy),step=Math.min(cfg.speed,d),parts=Math.max(1,Math.ceil(step));
    if(d<=.01){net.x=destination.x;net.y=destination.y;landed=true;landedAt=rt.tick;}else for(let n=0;n<parts;n++){const old={x:net.x,y:net.y};net.x+=dx/d*step/parts;net.y+=dy/d*step/parts;if(rt.reach(net,'6tzq')){net.x=old.x;net.y=old.y;landed=true;landedAt=rt.tick;break;}}
   }
   if(landed){const age=rt.tick-landedAt;if(age>=cfg.durationTicks)return;rt.setSize(net,12+(cfg.radius*2-12)*Math.min(1,age/12));net.effects.transparency=age>cfg.durationTicks-30?(age-cfg.durationTicks+30)/30*100:0;}
   if(alive(rt,3-side)&&visible(rt,side)&&visible(rt,3-side)&&Math.hypot(net.x-target.x,net.y-target.y)<=(landed?cfg.radius:8)+8){root(rt,side,cfg.rootTicks);return;}yield 1;
  }}finally{net.dead=true;if(state.netUid===net.uid)delete state.netUid;}},'hunting_net');
 }
});
export const boomTurret=definition(23,'터렛',TURRET,'boom-turret','터렛을 설치합니다. 몇 초 동안 3초마다 앞뒤로 바주카를 발사합니다.',{
 effectPictures:[['boom-turret-body','assets/secondary/boom-turret.svg',{width:240,height:180}]],
 canCast(r,s){return !r.secondarySkills.state(s).turretUid;},
 *cast(r,c,{side,caster,state}){const cfg=TURRET,turret=visual(r,side,'boom-turret-body',caster.x,caster.y-2,28,'boom-turret');state.turretUid=turret.uid;state.turretShots=0;
  try{for(let age=1;age<=cfg.durationTicks&&alive(r,side);age++){yield 1;if(!alive(r,side))break;if(age%cfg.intervalTicks===0){for(const direction of [-1,1]){this.fire(r,side,turret.x,turret.y+4,direction);state.turretShots++;}}turret.effects.transparency=age>cfg.durationTicks-20?(age-cfg.durationTicks+20)/20*100:0;}}
  finally{turret.dead=true;if(state.turretUid===turret.uid)delete state.turretUid;}
 },
 fire(r,side,x,y,direction){const owner=r.originals.get(id(side,'6115','g1va')),shot=r.makeEntity(owner.def,owner);Object.assign(shot,{clone:true,combatSide:side,secondaryEffect:'turret-rocket',turretOrigin:{side,x,y},nativeSkillVariables:{[id(side,'rr24','qvkr')]:0,[id(side,'etjn','846x')]:direction>0?1:0},x,y,rotation:direction>0?0:180});r.entities.unshift(shot);r.dispatchEntity(shot,'when_clone_start');return shot;},
 onCommand(r,c,type,args,side){if(c.e.turretOrigin?.side!==side||type!=='locate'||args[0]!==id(side,'00h9','n8fg'))return;c.e.x=c.e.turretOrigin.x;c.e.y=c.e.turretOrigin.y;return false;}
});
export const TACTICAL_SECONDARY_SKILLS=[logitechRageQuit,amazonesHuntingTrap,boomTurret];
