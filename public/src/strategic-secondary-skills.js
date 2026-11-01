import {prepareSkill as prepare,skillVisual as visual} from './additional-secondary-skills.js';
export const MAGNET_COMMAND=Object.freeze({manaCost:40,durationTicks:180,cooldownTicks:480});
export const HELL_GATE=Object.freeze({manaCost:38,durationTicks:360,cooldownTicks:600,radius:14,travelCooldown:30});
const id=(s,a,b)=>s===1?a:b,body=(r,s)=>r.originals.get(id(s,'00h9','n8fg'));
const alive=(r,s)=>r.scene==='7dwq'&&r.num(r.globals.get(id(s,'akf6','7ir2')))>0&&r.num(r.globals.get('r71b'))===0;
const magnet=(r,s)=>s===2&&r.mirror?r.mirrorOriginals.get('6b12'):r.originals.get('6b12');
const movement=new Set(['move_x','move_y','move_direction','move_to_angle','locate_xy','locate_x','locate_y','locate']);
const presentation=new Set(['change_to_some_shape','change_to_next_shape','set_scale_size','change_scale_size','change_effect_amount','set_effect_amount','show','hide']);
function zeroMomentum(r,s){for(const key of [id(s,'du2p','iblx'),id(s,'utbg','j88w'),id(s,'wr8j','u3f8'),id(s,'c9o4','lgp6')])r.globals.set(key,0);}
export const creationMove={
 character:11,name:'명령: 이동',manaCost:MAGNET_COMMAND.manaCost,cooldownTicks:MAGNET_COMMAND.cooldownTicks,lockVariable:false,prepare,
 secondaryPictureId:'creation-move-icon',icon:'assets/secondary/creation-move-icon.svg',
 description:'3초간 받는 피해가 50% 감소하며, 캐릭터를 움직이지 못하는 대신 같은 방법으로 자석을 움직입니다.',
 canCast(r,s){return !!magnet(r,s)&&!r.secondarySkills.state(s).control;},
 damageMultiplier(r,variable,value,side,state){return variable===id(side,'mm0r','nmkh')&&state.control&&r.tick<state.control.until&&alive(r,side)?r.num(value)*.5:value;},
 *cast(r,c,{side,caster,state}){
  const m=magnet(r,side);state.control={x:caster.x,y:caster.y,until:r.tick+MAGNET_COMMAND.durationTicks,previousActive:r.get(m,'s9vp')};
  zeroMomentum(r,side);r.set(m,'s9vp',1);
  // Give the existing player physics threads the actual magnet as their actor.
  // The body remains the target for incoming attacks and never becomes a proxy.
  for(const thread of [...r.threads,...r.pending])if(thread.e===caster&&thread.event==='when_scene_start'){
   thread.creationControlSide=side;thread.e=m;thread.context.e=m;
  }
  try{while(state.control&&alive(r,side)&&r.tick<state.control.until)yield 1;}
  finally{this.stop(r,side,state);}
 },
 stop(r,side,state){if(!state.control)return;const e=body(r,side),m=magnet(r,side);e.x=state.control.x;e.y=state.control.y;
  for(const thread of [...r.threads,...r.pending])if(thread.creationControlSide===side){thread.e=e;thread.context.e=e;delete thread.creationControlSide;}
  r.set(m,'s9vp',state.control.previousActive);zeroMomentum(r,side);delete state.control;
 },
 tick(r,side,state){if(state.control&&(r.tick>=state.control.until||!alive(r,side)))this.stop(r,side,state);},
 afterStep(r,side,state){if(state.control){const e=body(r,side);e.x=state.control.x;e.y=state.control.y;}},
 onFunction(r,c,functionId,args,side,state){if(state.control&&c.e===magnet(r,side)&&functionId===id(side,'qy83','05j0')){const target=body(r,3-side);if(r.num(r.globals.get(id(side,'rav6','ob2m')))!==0||r.secondarySkills.hidden(target)||r.castle.hidden(target))return false;}},
 onCommand(r,c,type,args,side,state){if(!state.control)return;
  if(c.thread?.creationControlSide===side){if(presentation.has(type))return false;return;}
  if(movement.has(type)&&(c.e===body(r,side)||c.e===magnet(r,side)))return false;
 }
};
function solid(r,e){return r.reach(e,'6tzq')||r.reach(e,'2bx4');}
export function nearestGateGround(r,source,position){
 // Probe the original player collider; never move an actual player while searching.
 const probe=r.makeEntity(source.def,source);let best=null,bestScore=Infinity;
 const startX=Math.max(-228,Math.min(228,position.x)),xs=[startX];for(let d=6;d<=462;d+=6)for(const sign of [-1,1]){const x=startX+d*sign;if(x>=-228&&x<=228)xs.push(x);}
 for(const x of xs){const dx2=(x-position.x)**2;if(dx2>bestScore)continue;probe.x=x;
  for(let y=126;y>=-124;y-=2){const score=dx2+(y-position.y)**2;if(score>=bestScore)continue;probe.y=y;if(solid(r,probe))continue;probe.y=y-2;if(!solid(r,probe))continue;
   // Require headroom as well as support; reject an exit tucked inside a ceiling.
   probe.y=y+8;if(solid(r,probe))continue;best={x,y};bestScore=score;
  }
 }
 return best;
}
function near(e,p){return Math.abs(e.x-p.x)<=HELL_GATE.radius&&e.y>=p.y-8&&e.y<=p.y+40;}
export const pangramHellGate={
 character:31,name:'지옥문',manaCost:HELL_GATE.manaCost,cooldownTicks:HELL_GATE.cooldownTicks,lockVariable:false,
 secondaryPictureId:'pangram-hell-gate-icon',icon:'assets/secondary/pangram-hell-gate-icon.svg',
 description:'자신과 적의 위치에서 가장 가까운 땅 위에 몇 초간 지옥문을 엽니다. 문에 도달하면 반대편 문으로 순간이동합니다.',
 prepare(p){this.effectPictures=[['pangram-hell-door','assets/secondary/pangram-hell-door.svg',{width:110,height:160}]];prepare.call(this,p);},
 canCast(r,s){const st=r.secondarySkills.state(s);if(st.gates)return false;const own=body(r,s),foe=body(r,3-s);if(r.num(r.globals.get(id(s,'rav6','ob2m')))!==0||r.secondarySkills.hidden(foe)||r.castle.hidden(foe))return false;const a=nearestGateGround(r,own,own),b=nearestGateGround(r,foe,foe);if(!a||!b)return false;st.pendingGates=[a,b];return true;},
 *cast(r,c,{side,state}){
  const pair=state.pendingGates;delete state.pendingGates;if(!pair)return;state.gates=pair;state.gateTravel={};
  for(const s of [1,2])state.gateTravel[s]={armed:!pair.some(p=>near(body(r,s),p))};
  const images=pair.map(p=>visual(r,side,'pangram-hell-door',p.x,p.y+20,1,'hell-gate'));
  try{for(let age=0;age<HELL_GATE.durationTicks&&alive(r,side);age++){
   images.forEach((e,index)=>{r.setSize(e,34*Math.min(1,(age+1)/10));e.y=pair[index].y-2+e.height*Math.abs(e.scaleY)/2;e.effects.transparency=age>HELL_GATE.durationTicks-20?(age-HELL_GATE.durationTicks+20)/20*100:0;});
   for(const s of [1,2]){if(!alive(r,s))continue;const e=body(r,s),travel=state.gateTravel[s],entry=pair.findIndex(p=>near(e,p));
    if(entry<0){travel.armed=true;continue;}
    if(!travel.armed||r.tick<r.num(r.globals.get('hell-gate-lock:'+s)))continue;
    const dest=pair[1-entry];e.x=dest.x;e.y=dest.y;zeroMomentum(r,s);r.globals.set('hell-gate-lock:'+s,r.tick+HELL_GATE.travelCooldown);
    // A second Pangram's pair cannot send an arriving player straight back.
    for(const owner of [1,2]){const other=r.secondarySkills.state(owner);if(other.gateTravel?.[s])other.gateTravel[s].armed=false;}
   }
   yield 1;
  }}finally{for(const e of images)e.dead=true;delete state.gates;delete state.gateTravel;}
 }
};
export const STRATEGIC_SECONDARY_SKILLS=[creationMove,pangramHellGate];
