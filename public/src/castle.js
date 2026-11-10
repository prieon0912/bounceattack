import BigNumber from './vendor/bignumber.mjs';
import { showStatusVisual } from './expanded-secondary-skills.js';
// Castle's values are kept together so each piece can be tuned independently.
export const CASTLE = Object.freeze({id:35,startMana:100,maxMana:100,skillMana:40,ultimateMana:60,transformTicks:600,promotionTicks:18,ultimateCooldown:360,heldSize:11.25,previewHeldSize:31.25});
export const PIECES = Object.freeze({
 pawn:{name:'폰',damage:4,range:62.5,interval:33},knight:{name:'나이트',damage:6,range:96.1125,dash:54.8625,interval:39},
 bishop:{name:'비숍',damage:7,range:110,interval:39},rook:{name:'룩',damage:8,range:158.4,interval:42},
 queen:{name:'퀸',damage:10,range:184.8,interval:36},king:{name:'킹',damage:12,range:140,interval:39}
});
export function promotedPiece(random){const n=random()*100;return n<30?'knight':n<60?'bishop':n<80?'rook':n<95?'queen':'king';}
const sid=(s,a,b)=>s===1?a:b,body=(r,s)=>r.originals.get(sid(s,'00h9','n8fg'));
const info=s=>({character:sid(s,'y75t','s5vb'),mana:sid(s,'qn98','thom'),hp:sid(s,'akf6','7ir2'),stun:sid(s,'8w41','wyyq'),root:sid(s,'05ze','1vu0'),stealth:sid(s,'ob2m','rav6'),shield:sid(s,'cfmd','g4sc')});
const angle=(x,y)=>Math.atan2(y,x),turn=(r,s)=>r.num(r.globals.get(sid(s,'etjn','846x')))===1?1:-1;
export const castleCastling={character:35,name:'캐슬링',manaCost:40,cooldownTicks:0,lockVariable:false,
 icon:'assets/castle/castling-icon.svg',secondaryPictureId:'castle-castling-icon',description:'현재 기물의 방어 전술을 사용합니다.',
 prepare(project){const icons=project.objects.find(o=>o.id==='o9rj').sprite.pictures;this.primaryPictureId=icons[34].id;this.primaryIcon=icons[34].fileurl;this.primaryName='체크';this.primaryDescription='현재 기물의 공격 전술을 사용합니다.';if(!icons.some(p=>p.id===this.secondaryPictureId))icons.push({...structuredClone(icons[34]),id:this.secondaryPictureId,fileurl:this.icon});},
 // Both loadouts are executed by CastleSystem, sharing the same piece-aware cooldown.
 canCast(){return false;},*cast(){}
};
export class CastleSystem{
 constructor(runtime){this.r=runtime;}
 active(s){return this.r.scene==='7dwq'&&this.r.num(this.r.globals.get(info(s).character))===35;}
 state(s){return this.r.globals.get(`castle:${s}`);}
 manaWrite(id,value){const s=id==='qn98'?1:id==='thom'?2:0;if(!s||!this.active(s)||!this.state(s)?.initialized)return value;const old=this.r.num(this.r.globals.get(id));return Math.min(CASTLE.maxMana,Math.max(0,Math.min(old,this.r.num(value))));}
 mana(s,delta){const r=this.r,id=info(s).mana;r.globals.set(id,Math.min(100,Math.max(0,new BigNumber(r.num(r.globals.get(id))).plus(delta).toNumber())));}
 alive(s){const r=this.r;return r.scene==='7dwq'&&r.num(r.globals.get(info(s).hp))>0&&r.num(r.globals.get('r71b'))===0;}
 manaRate(){return ({1:.05,2:.08,3:.15})[this.r.num(this.r.globals.get('75q1'))]??.08;}
 blocked(s){return this.r.num(this.r.globals.get(info(s).stun))!==0;}
 reward(s,attack){if(attack.rewarded)return;attack.rewarded=true;
  // Match native passive regeneration ratios (0.05 / 0.08 / 0.15), with mode 2 as the existing baseline.
  const rate=this.manaRate();
  this.mana(s,(attack.kind==='basic'?(attack.form==='pawn'?20:10):(attack.form==='pawn'?30:20))*rate/.08);
 }
 *hit(c,s,damage,attack,effect=null){const r=this.r,foe=3-s;if(!this.canHit(s))return false;
  yield* r.call(c,s===1?'qy83':'05j0',[-damage,0,1]);this.reward(s,attack);if(effect)this.status(foe,effect);return true;
 }
 status(s,effect){const r=this.r,e=body(r,s);if(r.num(r.globals.get(sid(s,'jcf6','ec6d')))!==0)return;
  if(effect.root&&!effect.push){r.set(e,info(s).root,Math.max(r.num(r.get(e,info(s).root)),effect.root*.02+.02));showStatusVisual(r,3-s,'root',effect.root);}
  if(effect.push){this.knockback(s,effect.push,effect.root?12:0);if(effect.root)r.spawn(e,function*(rt){yield 12;if(rt.castle.alive(s))rt.castle.status(s,{root:effect.root});},'castle_push_root');}
  if(effect.stun&&r.num(r.get(e,info(s).stun))===0){const id=info(s).stun,generation=sid(s,'bpv0','bpv5');r.add(e,generation,1);const token=r.get(e,generation);r.set(e,id,1);showStatusVisual(r,3-s,'stun',effect.stun);r.spawn(e,function*(rt){yield effect.stun;if(rt.get(e,generation)===token)rt.set(e,id,0);},'castle_stun');}
  if(effect.slow){const state=this.state(3-s);if(state)state.slow={side:s,value:effect.slow,until:r.tick+(effect.ticks||60)};showStatusVisual(r,3-s,'slow',effect.ticks||60);}
 }
 canHit(s){const r=this.r;return this.alive(s)&&this.alive(3-s)&&r.num(r.globals.get(info(s).stealth))===0&&r.num(r.globals.get(info(3-s).stealth))===0;}
 hidden(e){for(const side of [1,2])if(this.active(side)&&this.state(side)?.stealthUntil>this.r.tick&&([sid(side,'00h9','n8fg'),sid(side,'n230','ocqj'),sid(side,'zlk5','79eo'),sid(side,'aadi','0y61')].includes(e.objectId)||(e.combatSide===side&&['held','native-shield'].includes(e.castleEffect))))return true;return false;}
 blocksAttackCollision(a,b){return (this.hidden(a)&&b.combatSide&&b.combatSide!==a.combatSide)||(this.hidden(b)&&a.combatSide&&a.combatSide!==b.combatSide);}
 onDamage(side,source){const st=this.state(side);if(this.active(side)&&source===3-side&&st?.crown)st.crown=null;}
 slowValue(id,raw){for(const side of [1,2]){const st=this.state(side);if(!this.active(side)||!st)continue;const slow=st.slow;if(slow?.until>this.r.tick&&id===sid(slow.side,'9af4','nccn'))raw=Math.max(Number(raw),slow.value);
  if(st.crown&&st.form==='king'&&id===sid(st.crown.target,'9af4','nccn')&&this.canHit(side)&&this.r.num(this.r.globals.get(sid(st.crown.target,'jcf6','ec6d')))===0)raw=Math.max(Number(raw),4);
 }return raw;}
 conceal(side,stun=false){const r=this.r,st=this.state(side);st.stealthUntil=r.tick+180;st.stealthStun=stun;r.set(body(r,side),info(side).stealth,1);if(stun)this.nearbyStun(side);}
 nearbyStun(side){if(this.canHit(side)||this.r.num(this.r.globals.get(info(side).stealth))>0){const r=this.r;if(this.alive(side)&&this.alive(3-side)&&r.num(r.globals.get(info(3-side).stealth))===0&&Math.hypot(body(r,side).x-body(r,3-side).x,body(r,side).y-body(r,3-side).y)<=45)this.status(3-side,{stun:30});}}
 endConceal(side){const r=this.r,st=this.state(side);if(!st?.stealthUntil)return;st.stealthUntil=0;r.set(body(r,side),info(side).stealth,0);if(st.stealthStun)this.nearbyStun(side);st.stealthStun=false;}
 crown(side){if(!this.canHit(side))return;const r=this.r,st=this.state(side),target=3-side,token={target,next:r.tick+60};st.crown=token;
  const attack={kind:'skill',form:'king',rewarded:false};this.reward(side,attack);
  const mark=this.visual(side,'castle-crown',body(r,target).x,body(r,target).y+19,14,'crown');
  const slowPicture=r.defs.get(sid(target,'5kuy','t0fv')).sprite.pictures[1],slow=this.visual(side,slowPicture,0,0,22,'crown-slow');
  r.spawn(mark,function*(rt,c){try{while(rt.castle.active(side)&&st.form==='king'&&st.crown===token&&rt.castle.alive(side)&&rt.castle.alive(target)){
   const victim=body(rt,target),visible=rt.castle.canHit(side);mark.x=victim.x;mark.y=victim.y+19;mark.visible=visible;
   slow.x=victim.x;slow.y=victim.y-7;slow.visible=visible&&rt.num(rt.globals.get(sid(target,'jcf6','ec6d')))===0;slow.effects.transparency=20+30*(rt.tick%20)/20;
   if(rt.tick>=token.next){token.next+=60;if(visible)yield* rt.castle.hit(c,side,4,attack);}yield 1;
  }}finally{mark.dead=true;slow.dead=true;if(st.crown===token)st.crown=null;}},'castle_crown');
 }
 recall(side){if(!this.canHit(side))return;const r=this.r,target=3-side,victim=body(r,target),home=this.state(side).spawn;if(!home||r.num(r.globals.get(sid(target,'jcf6','ec6d')))!==0)return;
  const old={x:victim.x,y:victim.y};let found=false;
  for(const [dx,dy]of [[0,0],...[4,8,12,16,24,32].flatMap(n=>[[0,n],[-n,0],[n,0],[-n,n],[n,n]])]){victim.x=Math.max(-232,Math.min(232,home.x+dx));victim.y=Math.min(125,home.y+dy);if(!r.reach(victim,'6tzq')){found=true;break;}}
  if(!found){victim.x=old.x;victim.y=old.y;return;}r.set(victim,sid(target,'du2p','iblx'),0);r.set(victim,sid(target,'c9o4','lgp6'),0);this.status(target,{root:120});
 }
 move(s,dx,dy){const r=this.r,e=body(r,s);if(r.num(r.globals.get(info(s).root))>0)return;const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)));for(let i=0;i<steps;i++){const x=e.x,y=e.y;e.x+=dx/steps;e.y+=dy/steps;if(Math.abs(e.x)>232||e.y>130||r.reach(e,'6tzq')){e.x=x;e.y=y;break;}}}
 knockback(s,distance,settleTicks=0){const r=this.r,e=body(r,s);
  // Native recoil: each frame applies impulse * .96 / 15, so .625 preserves total travel.
  r.add(e,sid(s,'c9o4','lgp6'),distance*(settleTicks ? .6/(.96*(1-.96**settleTicks)) : .625));
 }
 blink(s,dx,dy){const r=this.r,e=body(r,s);if(r.num(r.globals.get(info(s).root))>0)return;const x=e.x,y=e.y;for(let t=1;t>=0;t-=.025){e.x=Math.max(-232,Math.min(232,x+dx*t));e.y=Math.min(125,y+dy*t);if(!r.reach(e,'6tzq'))return;}e.x=x;e.y=y;}
 shield(s,amount,ticks){const r=this.r,e=body(r,s),id=info(s).shield,before=r.num(r.get(e,id)),grant=Math.max(0,amount-before);if(!grant)return;r.add(e,id,grant);const state=this.state(s);state.shieldUntil=r.tick+ticks;
  r.spawn(e,function*(rt){yield ticks;rt.set(e,id,Math.max(0,rt.num(rt.get(e,id))-grant));},'castle_shield');
  const picture=r.defs.get('5eu9').sprite.pictures[0],marker=this.visual(s,picture,e.x,e.y,1,'native-shield');marker.effects.transparency=45;
  r.spawn(marker,function*(rt){try{while(rt.castle.alive(s)){
   const protectedNow=rt.num(rt.get(e,id))>0&&rt.tick<state.shieldUntil;
   rt.setSize(marker,rt.size(marker)+((protectedNow?24:1)-rt.size(marker))/10);
   marker.x=e.x;marker.y=e.y;marker.visible=rt.num(rt.globals.get(info(s).stealth))===0;
   if(!protectedNow&&rt.size(marker)<1.1)break;yield 1;
  }}finally{marker.dead=true;}},'castle_native_shield');
 }
 visual(s,pictureId,x,y,size,label){const r=this.r,picture=typeof pictureId==='string'?r.defs.get('hb4u').sprite.pictures.find(p=>p.id===pictureId):pictureId,e=r.makeEntity(r.defs.get('hb4u'));Object.assign(e,{clone:true,combatSide:s,castleEffect:label,picture,width:picture.dimension.width,height:picture.dimension.height,regX:picture.dimension.width/2,regY:picture.dimension.height/2,x,y,rotation:0,scaleX:1,scaleY:1,visible:true});r.setSize(e,size);r.entities.unshift(e);return e;}
 shot(s,attack,{x=body(this.r,s).x,y=body(this.r,s).y+2,a,speed=5,range,damage,size=12,effect=null,homing=false,art=attack.form}){
  const r=this.r,e=this.visual(s,'castle-shot-'+art,x,y,size,'projectile');e.rotation=90-a*180/Math.PI;
  r.spawn(e,function*(rt,c){let distance=0;try{while(distance<range&&rt.castle.alive(s)&&rt.castle.alive(3-s)){
   const target=body(rt,3-s);if(homing&&rt.num(rt.globals.get(info(3-s).stealth))===0)a=angle(target.x-e.x,target.y-e.y);e.rotation=90-a*180/Math.PI;
   const step=Math.min(speed,range-distance),parts=Math.max(1,Math.ceil(step));
   for(let i=0;i<parts;i++){e.x+=Math.cos(a)*step/parts;e.y+=Math.sin(a)*step/parts;distance+=step/parts;
    if(Math.abs(e.x)>254||e.y>205||e.y<-205)return;
    if(rt.castle.canHit(s)&&Math.hypot(e.x-target.x,e.y-target.y)<=size*.5+8){yield* rt.castle.hit(c,s,damage,attack,effect);return;}
   }yield 1;
  }}finally{e.dead=true;}},'castle_projectile');return e;
 }
 *melee(c,s,attack,{range,damage,dash=0,ticks=6,height=20,effect=null,centered=false,omni=false}){const r=this.r,e=body(r,s),direction=turn(r,s),slash=this.visual(s,r.defs.get('hpfj').sprite.pictures[0],e.x+direction*range*.5,e.y,range,'melee');slash.scaleX*=direction;slash.scaleY*=Math.min(28,height*2)/range;let struck=false;
  try{for(let t=0;t<ticks&&this.alive(s)&&!this.blocked(s);t++){const beforeX=e.x;if(dash)this.move(s,direction*dash/ticks,0);slash.x=e.x+(centered?0:direction*range*.5);slash.y=e.y;slash.effects.transparency=t/ticks*85;const target=body(r,3-s),dx=(target.x-e.x)*direction;
   const swept=omni?target.x>=Math.min(beforeX,e.x)-8&&target.x<=Math.max(beforeX,e.x)+8:dx>=(centered?-range:-8)&&dx<=range;
   if(!struck&&swept&&Math.abs(target.y-e.y)<=height&&this.canHit(s)){struck=true;yield* this.hit(c,s,damage,attack,effect);}yield 1;}
  }finally{slash.dead=true;}
 }
 basic(s){const r=this.r,state=this.state(s),form=state.form,piece=PIECES[form],attack={kind:'basic',form,rewarded:false},e=body(r,s),foe=body(r,3-s),direction=turn(r,s);state.attackAt=r.tick+piece.interval;state.attackVisualAt=r.tick;
  if(form==='pawn'||form==='knight'){state.actionUntil=r.tick+6;r.spawn(e,function*(rt,c){yield* rt.castle.melee(c,s,attack,{range:form==='pawn'?piece.range:41.25,damage:piece.damage,dash:form==='knight'?piece.dash:0});},'castle_basic');return;}
  if(form==='bishop'){for(const dy of [-1,1])this.shot(s,attack,{a:angle(direction,dy),range:110,damage:piece.damage,size:18});return;}
  this.shot(s,attack,{a:form==='rook'?angle(direction,0):angle(foe.x-e.x,foe.y-e.y),range:piece.range,damage:piece.damage,size:form==='rook'?18:form==='king'?22:12.6,speed:form==='rook'?4:form==='king'?5:6,homing:form==='queen'||form==='king',effect:form==='king'?{slow:4,ticks:24}:null});
 }
 skill(s){const r=this.r,state=this.state(s),form=state.form,e=body(r,s),foe=body(r,3-s),direction=turn(r,s),defensive=r.secondarySkills.state(s).mode==='secondary';
  if(r.tick<state.skillAt||r.num(r.globals.get(info(s).mana))<40)return;this.mana(s,-40);state.skillVisualAt=r.tick;state.skillAt=r.tick+(defensive&&form==='pawn'?180:300);
  if(defensive){state.castlingVisualAt=r.tick;
   if(form==='pawn')this.shield(s,3,300);
   if(form==='knight'){state.actionUntil=r.tick+10;r.spawn(e,function*(rt){for(let i=0;i<10&&rt.castle.alive(s)&&!rt.castle.blocked(s);i++){rt.castle.move(s,-direction*4.5,i<5?2:-2);yield 1;}},'castle_retreat');}
   if(form==='bishop')this.conceal(s);
   if(form==='rook'){this.shield(s,12,300);if(this.canHit(s)&&r.num(r.globals.get(sid(3-s,'jcf6','ec6d')))===0&&Math.hypot(e.x-foe.x,e.y-foe.y)<=45){const attack={kind:'defense',form,rewarded:true};r.spawn(e,function*(rt,c){yield* rt.castle.hit(c,s,4,attack,{push:Math.sign(foe.x-e.x||direction)*15});},'castle_rook_defense');}}
   if(form==='queen')this.conceal(s,true);
   if(form==='king')this.recall(s);
   return;
  }
  const attack={kind:'skill',form,rewarded:false};
  if(form==='pawn'||form==='knight'){state.actionUntil=r.tick+(form==='knight'?12:8);r.spawn(e,function*(rt,c){yield* rt.castle.melee(c,s,attack,{range:form==='pawn'?8:22,damage:form==='pawn'?4:8,dash:form==='pawn'?80:53.2,ticks:8,omni:form==='pawn'});if(form==='knight'&&rt.castle.alive(s))yield* rt.castle.melee(c,s,attack,{range:24,damage:4,ticks:4,height:38,centered:true});},'castle_check');return;}
  if(form==='bishop'){const x=e.x,y=e.y;for(const sign of [-1,1])this.shot(s,attack,{x,y:y+sign*50,a:angle(direction,-sign),range:140,damage:5,size:18});return;}
  if(form==='rook'){this.shot(s,attack,{a:angle(direction,0),range:184.8,damage:12,size:21.6,speed:4,effect:{push:direction*15,root:30}});return;}
  if(form==='queen'){for(let i=0;i<8;i++){const cardinal=i%2===0;this.shot(s,attack,{a:i*Math.PI/4,range:cardinal?PIECES.rook.range:PIECES.bishop.range,damage:5,size:18,speed:cardinal?4:5,art:cardinal?'rook':'bishop'});}return;}
  this.crown(s);
 }
 step(){const r=this.r;if(r.scene!=='7dwq')return;
  for(const s of [1,2]){if(!this.active(s))continue;let state=this.state(s);if(!state){state={initialized:false,form:'pawn',until:0,attackAt:0,skillAt:0,ultimateAt:0,actionUntil:0,promotionUntil:0,skillDown:false,ultimateDown:false};r.globals.set(`castle:${s}`,state);}if(!state.initialized)continue;
   if(state.promotionUntil&&r.tick>=state.promotionUntil){state.promotionUntil=0;state.form=promotedPiece(r.random);state.until=r.tick+CASTLE.transformTicks;}
   // Only hidden Bishop/Queen time is excluded; cooldowns and the real-time clock keep advancing.
   if(['bishop','queen'].includes(state.form)&&state.stealthUntil>0&&r.tick<=state.stealthUntil&&r.num(r.globals.get(info(s).stealth))>0&&this.alive(s))state.until++;
   if(this.alive(s)&&r.num(r.globals.get(sid(s,'dqcb','a5tc')))===0)this.mana(s,this.manaRate()*.3);
   if(state.form!=='pawn'&&r.tick>=state.until){state.form='pawn';state.until=0;state.crown=null;}
   if(state.stealthUntil&&r.tick>=state.stealthUntil)this.endConceal(s);
   const skill=r.keys.has(s===1?82:80),ultimate=r.keys.has(s===1?83:40),skillEdge=skill&&!state.skillDown,ultimateEdge=ultimate&&!state.ultimateDown;state.skillDown=skill;state.ultimateDown=ultimate;
   if(!this.alive(s)||this.blocked(s)||state.promotionUntil||state.stealthUntil>r.tick||r.tick<state.actionUntil)continue;
   if(ultimateEdge&&state.form==='pawn'&&r.tick>=state.ultimateAt&&r.num(r.globals.get(info(s).mana))>=60){this.mana(s,-60);state.promotionUntil=r.tick+18;state.ultimateAt=r.tick+360;state.lockX=body(r,s).x;state.lockY=body(r,s).y;continue;}
   if(skillEdge){this.skill(s);continue;}
   if(r.keys.has(s===1?69:13)&&r.tick>=state.attackAt)this.basic(s);
  }
 }
 afterStep(){const r=this.r;
  // Castle uses the same separate held-weapon arrangement as the original roster.
  if(r.scene==='1ckl'){for(const [s,weapon]of [[1,'31us'],[2,'mimn']]){const e=r.originals.get(weapon);if(!e)continue;if(r.num(r.globals.get(info(s).character))===35){const ball=r.originals.get(sid(s,'j5y7','zyy3'));r.setPicture(e,'castle-held-pawn-'+weapon);r.setSize(e,CASTLE.previewHeldSize);e.x=ball.x+(s===1?1:-1)*19;e.y=ball.y-6;e.rotation=0;e.scaleX=Math.abs(e.scaleX)*(s===1?1:-1);e.visible=ball.visible;e.castlePreviewHidden=true;}else if(e.castlePreviewHidden){e.visible=true;delete e.castlePreviewHidden;}}return;}
  for(const s of [1,2]){if(!this.active(s))continue;const state=this.state(s);if(!state)continue;if(!state.initialized){r.globals.set(info(s).mana,CASTLE.startMana);state.spawn={x:body(r,s).x,y:body(r,s).y};state.initialized=true;}
   if(state.promotionUntil){body(r,s).x=state.lockX;body(r,s).y=state.lockY;}
   const e=r.originals.get(sid(s,'n230','ocqj'));if(e){r.setPicture(e,`castle-${state.form}-${e.objectId}`);r.setSize(e,16);e.rotation=0;}
   let held=r.entities.find(e=>!e.dead&&e.castleEffect==='held'&&e.combatSide===s);
   if(!held)held=this.visual(s,'castle-held-'+state.form,0,0,CASTLE.heldSize,'held');
   r.setPicture(held,'castle-held-'+state.form);r.setSize(held,CASTLE.heldSize);const base=body(r,s),direction=turn(r,s);
   held.x=base.x+direction*7;held.y=base.y-2;const motionAge=r.tick-Math.max(state.skillVisualAt??-100,state.attackVisualAt??-100);held.rotation=motionAge<12?direction*Math.sin(motionAge/12*Math.PI)*-25:0;held.scaleX=Math.abs(held.scaleX)*direction;
   held.visible=this.alive(s)&&r.num(r.globals.get(info(s).stealth))===0;
  }
 }
 blocksKey(key){for(const s of [1,2])if(this.active(s)){if([sid(s,69,13),sid(s,82,80),sid(s,83,40)].includes(key))return true;if(this.state(s)?.promotionUntil&&[...(s===1?[65,68,87]:[37,39,38])].includes(key))return true;}return false;}
 draw(){}
}
