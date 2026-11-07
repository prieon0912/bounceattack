
import {prepareSkill,skillVisual} from './additional-secondary-skills.js';
import {installationCombat} from './barricade.js';

export const ROYAL_FLAG=Object.freeze({
 manaCost:35,cooldownTicks:60,radius:65,durationTicks:600,health:1,
 shieldGain:2,shieldCap:6,approachBoost:-4.7,
});
const sid=(s,a,b)=>s===1?a:b;
const body=(r,s)=>r.originals.get(sid(s,'00h9','n8fg'));
function flags(r,side){
 return r.entities.filter(e=>!e.dead&&e.secondaryEffect==='prince-flag'&&
  e.installationOwner===side&&e.installationHealth>0&&e.flagUntil>r.tick);
}
function inside(r,side){
 const caster=body(r,side);
 return flags(r,side).some(flag=>Math.hypot(caster.x-flag.x,caster.y-flag.flagGroundY)<=ROYAL_FLAG.radius);
}
export const princeRoyalFlag={
 ...installationCombat,
 character:22,name:'왕실의 깃발',manaCost:ROYAL_FLAG.manaCost,
 cooldownTicks:ROYAL_FLAG.cooldownTicks,lockVariable:false,
 icon:'assets/secondary/prince-royal-flag-icon.svg',secondaryPictureId:'prince-royal-flag-icon',
 description:'10초간 유지되는 깃발을 설치합니다. 깃발 주위에 있으면 사기가 올라갑니다.',
 effectPictures:[
  ['prince-royal-flag','assets/secondary/prince-royal-flag.svg',{width:60,height:90}],
  ['prince-royal-flag-radius','assets/secondary/prince-royal-flag-radius.svg',{width:100,height:100}],
 ],
 prepare:prepareSkill,
 *cast(r,c,{side,caster}){
  const flag=skillVisual(r,side,'prince-royal-flag',caster.x,caster.y+10,28,'prince-flag');
  flag.y=r.bounds(caster).bottom+40*flag.scaleY;
  flag.combatSide=null;flag.installationOwner=side;flag.installationHealth=ROYAL_FLAG.health;
  flag.flagUntil=r.tick+ROYAL_FLAG.durationTicks;
  flag.flagGroundY=caster.y;
  const area=skillVisual(r,side,'prince-royal-flag-radius',caster.x,caster.y,ROYAL_FLAG.radius*2,'prince-flag-radius');
  area.effects.transparency=65;area.flagOwnerUid=flag.uid;
 },
 afterStep(r,side){
  for(const flag of r.entities){
   if(flag.secondaryEffect!=='prince-flag'||flag.installationOwner!==side||flag.dead)continue;
   if(flag.installationHealth<=0||flag.flagUntil<=r.tick||
    r.num(r.globals.get(sid(side,'akf6','7ir2')))<=0){
    flag.dead=true;
    for(const area of r.entities)if(area.flagOwnerUid===flag.uid)area.dead=true;
   }
  }
 },
 onCommand(r,c,type,args,side){
  if(installationCombat.onCommand(r,c,type,args)===false)return false;
  if(type==='set_variable'&&c.e.objectId===sid(side,'z4wa','l8ny')&&
   args[0]===sid(side,'1g8o','bct6')&&inside(r,side)){
   args[1]=Math.min(r.num(args[1]),ROYAL_FLAG.approachBoost);
  }
 },
 onFunction(r,c,id,args,side){
  if(id!==sid(side,'qy83','05j0')||c.e.objectId!==sid(side,'z4wa','l8ny')||
    c.block!==sid(side,'j55n','ce17')||r.num(args[0])>=0||!inside(r,side))return;
  const shield=sid(side,'cfmd','g4sc'),caster=body(r,side),current=r.num(r.get(caster,shield));
  const gain=Math.min(ROYAL_FLAG.shieldGain,Math.max(0,ROYAL_FLAG.shieldCap-current));
  if(gain>0)r.add(caster,shield,gain);
 },
};
