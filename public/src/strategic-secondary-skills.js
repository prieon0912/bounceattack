import {prepareSkill as prepare,skillVisual as visual} from './additional-secondary-skills.js';
export const MAGNET_COMMAND=Object.freeze({manaCost:40,durationTicks:180,cooldownTicks:180});
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
 description:'3초간 자신 대신 자석을 조종합니다.',
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
export function gateSpawnPoint(r,source){
 const bounds=r.bounds(source),point={x:source.x,y:source.y,baseY:bounds.bottom,grounded:false};
 const side=source.objectId==='00h9'?1:2;
 if(Math.abs(r.num(r.globals.get(id(side,'du2p','iblx'))))>.15)return point;
 // The native player's foot collider is offset below its logical position.
 // Measure the actual surface with a tiny, centred probe, not player.y - a constant.
 const probe=r.makeEntity(source.def,source);Object.assign(probe,{regX:probe.width/2,regY:probe.height/2,scaleX:1/probe.width,scaleY:.2/probe.height,rotation:0,x:(bounds.left+bounds.right)/2,visible:true});
 let clear=bounds.bottom+1;
 for(let y=clear;y>=bounds.bottom-4;y-=.25){probe.y=y;if(!solid(r,probe)){clear=y;continue;}
  let low=y,high=clear;for(let i=0;i<10;i++){const mid=(low+high)/2;probe.y=mid;if(solid(r,probe))low=mid;else high=mid;}
  point.baseY=(low+high)/2-.1;point.grounded=true;break;
 }
 return point;
}
function near(e,p){return Math.abs(e.x-p.x)<=HELL_GATE.radius&&e.y>=p.baseY-4&&e.y<=p.baseY+42;}
export const pangramHellGate={
 character:31,name:'지옥문',manaCost:HELL_GATE.manaCost,cooldownTicks:HELL_GATE.cooldownTicks,lockVariable:false,
 secondaryPictureId:'pangram-hell-gate-icon',icon:'assets/secondary/pangram-hell-gate-icon.svg',
 description:'자신과 적의 위치에 지옥문을 엽니다. 지옥문을 통해 이동할 수 있습니다.',
 prepare(p){this.effectPictures=Array.from({length:5},(_,phase)=>['pangram-hell-door-'+phase,phase===4?'assets/secondary/pangram-hell-door.svg':`assets/secondary/pangram-hell-door-opening-${phase}.svg`,{width:110,height:160}]);prepare.call(this,p);},
 canCast(r,s){const st=r.secondarySkills.state(s);if(st.gates)return false;const own=body(r,s),foe=body(r,3-s);if(r.num(r.globals.get(id(s,'rav6','ob2m')))!==0||r.secondarySkills.hidden(foe)||r.castle.hidden(foe))return false;st.pendingGates=[gateSpawnPoint(r,own),gateSpawnPoint(r,foe)];return true;},
 *cast(r,c,{side,state}){
  const pair=state.pendingGates;delete state.pendingGates;if(!pair)return;state.gates=pair;state.gateTravel={};
  for(const s of [side])state.gateTravel[s]={armed:!pair.some(p=>near(body(r,s),p))};
  const images=pair.map(p=>{const e=visual(r,side,'pangram-hell-door-0',p.x,p.baseY,34,'hell-gate');e.regY=155.5;return e;});
  try{for(let age=0;age<HELL_GATE.durationTicks&&alive(r,side);age++){
   images.forEach((e,index)=>{e.picture=r.defs.get('o9rj').sprite.pictures.find(p=>p.id==='pangram-hell-door-'+Math.min(4,Math.floor(age/4)));e.y=pair[index].baseY;e.effects.transparency=age>HELL_GATE.durationTicks-20?(age-HELL_GATE.durationTicks+20)/20*100:0;});
   for(const s of [side]){if(!alive(r,s))continue;const e=body(r,s),travel=state.gateTravel[s],entry=pair.findIndex(p=>near(e,p));
    if(entry<0){travel.armed=true;continue;}
    if(age<16||!travel.armed||r.tick<r.num(r.globals.get('hell-gate-lock:'+s)))continue;
    const dest=pair[1-entry];e.x=dest.x;e.y=dest.y;zeroMomentum(r,s);r.globals.set('hell-gate-lock:'+s,r.tick+HELL_GATE.travelCooldown);
    // A second Pangram's pair cannot send an arriving player straight back.
    for(const owner of [1,2]){const other=r.secondarySkills.state(owner);if(other.gateTravel?.[s])other.gateTravel[s].armed=false;}
   }
   yield 1;
  }}finally{for(const e of images)e.dead=true;delete state.gates;delete state.gateTravel;}
 }
};
export const STRATEGIC_SECONDARY_SKILLS=[creationMove,pangramHellGate];
