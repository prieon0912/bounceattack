
import {prepareSkill,skillVisual} from './additional-secondary-skills.js';
import {damageInstallationsInRadius} from './barricade.js';

export const STOPGAP=Object.freeze({
 manaCost:32,cooldownTicks:60,durationTicks:300,attackTicks:36,
 swingTicks:12,range:22,damage:8,fearBonus:12,
});
const sid=(side,a,b)=>side===1?a:b;
const body=(r,side)=>r.originals.get(sid(side,'00h9','n8fg'));
const owner=(r,side)=>r.originals.get(sid(side,'nijg','e7ip'));
const away=(r,side)=>r.num(r.get(owner(r,side),'zhz6'))===1;
const alive=(r,side)=>r.scene==='7dwq'&&r.num(r.globals.get(sid(side,'akf6','7ir2')))>0&&r.num(r.globals.get('r71b'))===0;
const facing=(r,side)=>r.num(r.globals.get(sid(side,'etjn','846x')))===1?1:-1;
function active(r,side,state){return state.stopgapUntil>r.tick&&away(r,side)&&alive(r,side);}
function finish(r,state){
 const blade=r.entities.find(e=>e.uid===state.stopgapBladeUid);
 if(blade)blade.dead=true;
 delete state.stopgapUntil;delete state.stopgapBladeUid;delete state.stopgapSwing;
}
export const harlanStopgap={
 character:26,name:'임시방편',manaCost:STOPGAP.manaCost,cooldownTicks:STOPGAP.cooldownTicks,
 lockVariable:false,icon:'assets/secondary/harlan-stopgap-icon.svg',secondaryPictureId:'harlan-stopgap-icon',
 description:'다음 5초간 지속되는 임시 칼을 사용합니다. 이 칼은 던지지는 않고 휘두르며 공격하며, 기존 검을 회수한다면 즉시 임시 칼 사용을 멈춥니다.',
 prepare(project){
  const picture=project.objects.find(o=>o.id==='nijg').sprite.pictures[0];
  this.effectPictures=[['harlan-stopgap-blade',picture.fileurl,picture.dimension]];
  prepareSkill.call(this,project);
 },
 canCast(r,side){return away(r,side)&&!r.secondarySkills.state(side).stopgapUntil;},
 blocksKey(r,key,side,state){return key===sid(side,69,13)&&active(r,side,state);},
 onCommand(r,c,type,args,side,state){
  if(type==='set_variable'&&args[0]==='zhz6'&&r.num(args[1])===0&&
   c.e.objectId===sid(side,'nijg','e7ip'))finish(r,state);
 },
 afterStep(r,side,state){
  if(state.stopgapUntil&&!active(r,side,state))finish(r,state);
 },
 *cast(r,c,{side,caster,target,state}){
  const blade=skillVisual(r,side,'harlan-stopgap-blade',caster.x,caster.y,28,'harlan-stopgap');
  blade.installationAreaDamage=true;
  state.stopgapUntil=r.tick+STOPGAP.durationTicks;state.stopgapBladeUid=blade.uid;state.stopgapAttackAt=r.tick;
  try{
   while(active(r,side,state)){
    const direction=facing(r,side),stunned=r.num(r.globals.get(sid(side,'8w41','wyyq')))>0;
    if(r.keys.has(sid(side,69,13))&&!stunned&&r.tick>=state.stopgapAttackAt){
     state.stopgapAttackAt=r.tick+STOPGAP.attackTicks;
     state.stopgapSwing={start:r.tick,direction,hit:false,installationsHit:false};
    }
    blade.x=caster.x+direction*7;blade.y=caster.y;
    blade.scaleX=Math.abs(blade.scaleX)*direction;
    const swing=state.stopgapSwing,age=swing?r.tick-swing.start:STOPGAP.swingTicks;
    blade.rotation=age<STOPGAP.swingTicks?swing.direction*(-75+age/11*150):0;
    if(stunned)delete state.stopgapSwing;
    else if(swing&&age>=3&&age<STOPGAP.swingTicks){
     if(!swing.installationsHit){
      damageInstallationsInRadius(r,side,{x:caster.x+swing.direction*12,y:caster.y},10,STOPGAP.damage);
      swing.installationsHit=true;
     }
     const visible=[side,3-side].every(s=>r.num(r.globals.get(sid(s,'ob2m','rav6')))===0);
     const inFront=(target.x-caster.x)*swing.direction>=0;
     if(!swing.hit&&visible&&alive(r,3-side)&&!r.secondarySkills.hidden(target)&&!r.castle.hidden(target)&&inFront&&
      Math.hypot(target.x-caster.x,target.y-caster.y)<=STOPGAP.range){
      swing.hit=true;
      const context={...c,e:blade};
      yield* r.call(context,sid(side,'qy83','05j0'),[-STOPGAP.damage,10,1]);
      if(r.num(r.globals.get(sid(3-side,'mfr0','mnus')))===1)
       yield* r.call(context,sid(side,'qy83','05j0'),[-STOPGAP.fearBonus,0,10]);
     }
    }
    yield 1;
   }
  }finally{finish(r,state);delete state.stopgapAttackAt;}
 },
};
