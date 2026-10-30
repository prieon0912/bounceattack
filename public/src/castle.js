import { showStatusVisual } from './expanded-secondary-skills.js';
// Castle's values are kept together so each piece can be tuned independently.
export const CASTLE = Object.freeze({id:35,startMana:20,maxMana:100,skillMana:40,ultimateMana:60,transformTicks:1200,promotionTicks:18,ultimateCooldown:360});
export const PIECES = Object.freeze({
 pawn:{name:'폰',damage:4,range:25,interval:33},knight:{name:'나이트',damage:6,range:55,interval:39},
 bishop:{name:'비숍',damage:6,range:110,interval:39},rook:{name:'룩',damage:8,range:120,interval:42},
 queen:{name:'퀸',damage:9,range:140,interval:36},king:{name:'킹',damage:11,range:140,interval:39}
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
 mana(s,delta){const r=this.r,id=info(s).mana;r.globals.set(id,Math.min(100,Math.max(0,r.num(r.globals.get(id))+delta)));}
 alive(s){const r=this.r;return r.scene==='7dwq'&&r.num(r.globals.get(info(s).hp))>0&&r.num(r.globals.get('r71b'))===0;}
 blocked(s){return this.r.num(this.r.globals.get(info(s).stun))!==0;}
 reward(s,attack){if(attack.rewarded)return;attack.rewarded=true;this.mana(s,attack.kind==='basic'?(attack.form==='pawn'?20:10):(attack.form==='pawn'?30:20));}
 *hit(c,s,damage,attack,effect=null){const r=this.r,foe=3-s;if(!this.alive(s)||!this.alive(foe)||r.num(r.globals.get(info(foe).stealth))!==0)return false;
  yield* r.call(c,s===1?'qy83':'05j0',[-damage,0,1]);this.reward(s,attack);if(effect)this.status(foe,effect);return true;
 }
 status(s,effect){const r=this.r,e=body(r,s);if(r.num(r.globals.get(sid(s,'jcf6','ec6d')))!==0)return;
  if(effect.root){r.set(e,info(s).root,Math.max(r.num(r.get(e,info(s).root)),effect.root*.02+.02));showStatusVisual(r,3-s,'root',effect.root);}
  if(effect.push)this.move(s,effect.push,0);
  if(effect.slow){const state=this.state(3-s);if(state)state.slow={side:s,value:effect.slow,until:r.tick+(effect.ticks||60)};showStatusVisual(r,3-s,'slow',effect.ticks||60);}
 }
 slowValue(id,raw){for(const s of [1,2]){const slow=this.state(s)?.slow;if(this.active(s)&&slow?.until>this.r.tick&&id===sid(slow.side,'9af4','nccn'))raw=Math.max(Number(raw),slow.value);}return raw;}
 move(s,dx,dy){const r=this.r,e=body(r,s);if(r.num(r.globals.get(info(s).root))>0)return;const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)));for(let i=0;i<steps;i++){const x=e.x,y=e.y;e.x+=dx/steps;e.y+=dy/steps;if(Math.abs(e.x)>232||e.y>130||r.reach(e,'6tzq')){e.x=x;e.y=y;break;}}}
 blink(s,dx,dy){const r=this.r,e=body(r,s);if(r.num(r.globals.get(info(s).root))>0)return;const x=e.x,y=e.y;for(let t=1;t>=0;t-=.025){e.x=Math.max(-232,Math.min(232,x+dx*t));e.y=Math.min(125,y+dy*t);if(!r.reach(e,'6tzq'))return;}e.x=x;e.y=y;}
 shield(s,amount,ticks){const r=this.r,e=body(r,s),id=info(s).shield,before=r.num(r.get(e,id)),grant=Math.max(0,amount-before);if(!grant)return;r.add(e,id,grant);const state=this.state(s);state.shieldUntil=r.tick+ticks;r.spawn(e,function*(rt){yield ticks;rt.set(e,id,Math.max(0,rt.num(rt.get(e,id))-grant));},'castle_shield');}
 visual(s,pictureId,x,y,size,label){const r=this.r,picture=r.defs.get('hb4u').sprite.pictures.find(p=>p.id===pictureId),e=r.makeEntity(r.defs.get('hb4u'));Object.assign(e,{clone:true,combatSide:s,castleEffect:label,picture,width:picture.dimension.width,height:picture.dimension.height,regX:picture.dimension.width/2,regY:picture.dimension.height/2,x,y,rotation:0,scaleX:1,scaleY:1,visible:true});r.setSize(e,size);r.entities.unshift(e);return e;}
 shot(s,attack,{x=body(this.r,s).x,y=body(this.r,s).y,a,speed=5,range,damage,size=12,effect=null}){
  const r=this.r,e=this.visual(s,'castle-shot-'+attack.form,x,y,size,'projectile');e.rotation=90-a*180/Math.PI;
  r.spawn(e,function*(rt,c){let distance=0;try{while(distance<range&&rt.castle.alive(s)){const step=Math.min(speed,range-distance);e.x+=Math.cos(a)*step;e.y+=Math.sin(a)*step;distance+=step;const target=body(rt,3-s);
   if(Math.hypot(e.x-target.x,e.y-target.y)<=size*.5+8&&rt.num(rt.globals.get(info(3-s).stealth))===0){yield* rt.castle.hit(c,s,damage,attack,effect);break;}yield 1;}
  }finally{e.dead=true;}},'castle_projectile');
 }
 *melee(c,s,attack,{range,damage,dash=0,ticks=6,height=20,effect=null}){const r=this.r,e=body(r,s),direction=turn(r,s),slash=this.visual(s,'castle-slash',e.x+direction*range*.5,e.y,range,'melee');slash.scaleX*=direction;let struck=false;
  try{for(let t=0;t<ticks&&this.alive(s)&&!this.blocked(s);t++){if(dash)this.move(s,direction*dash/ticks,0);slash.x=e.x+direction*range*.5;slash.y=e.y;slash.effects.transparency=t/ticks*85;const target=body(r,3-s),dx=(target.x-e.x)*direction;
   if(!struck&&dx>=-8&&dx<=range&&Math.abs(target.y-e.y)<=height&&r.num(r.globals.get(info(3-s).stealth))===0){struck=true;yield* this.hit(c,s,damage,attack,effect);}yield 1;}
  }finally{slash.dead=true;}
 }
 basic(s){const r=this.r,state=this.state(s),form=state.form,piece=PIECES[form],attack={kind:'basic',form,rewarded:false},e=body(r,s),foe=body(r,3-s),direction=turn(r,s);state.attackAt=r.tick+piece.interval;
  if(form==='pawn'||form==='knight'){state.actionUntil=r.tick+6;r.spawn(e,function*(rt,c){yield* rt.castle.melee(c,s,attack,{range:form==='pawn'?25:20,damage:piece.damage,dash:form==='knight'?35:0});},'castle_basic');return;}
  if(form==='bishop'){for(const dy of [-1,1])this.shot(s,attack,{a:angle(direction,dy),range:110,damage:6});return;}
  this.shot(s,attack,{a:form==='rook'?angle(direction,0):angle(foe.x-e.x,foe.y-e.y),range:piece.range,damage:piece.damage,size:form==='rook'?20:form==='king'?22:14,speed:form==='rook'?4:form==='king'?5:6,effect:form==='king'?{slow:4,ticks:24}:null});
 }
 skill(s){const r=this.r,state=this.state(s),form=state.form,e=body(r,s),foe=body(r,3-s),direction=turn(r,s),defensive=r.secondarySkills.state(s).mode==='secondary';
  if(r.tick<state.skillAt||r.num(r.globals.get(info(s).mana))<40)return;this.mana(s,-40);state.skillAt=r.tick+((defensive&&['rook','queen','king'].includes(form))?360:300);
  if(defensive){
   if(form==='pawn')this.shield(s,3,60);
   if(form==='knight'){state.actionUntil=r.tick+10;r.spawn(e,function*(rt){for(let i=0;i<10&&rt.castle.alive(s)&&!rt.castle.blocked(s);i++){rt.castle.move(s,-direction*4.5,i<5?2:-2);yield 1;}},'castle_retreat');}
   if(form==='bishop')this.blink(s,direction*50/Math.SQRT2,50/Math.SQRT2);
   if(form==='rook'||form==='king'){this.shield(s,form==='rook'?12:16,120);if(Math.hypot(e.x-foe.x,e.y-foe.y)<=45){if(form==='rook')this.status(3-s,{push:Math.sign(foe.x-e.x||direction)*15});else this.status(3-s,{slow:7,ticks:60});}}
   if(form==='queen'){let dx=0,dy=0;for(const [key,x,y]of(s===1?[[65,-1,0],[68,1,0],[87,0,1],[83,0,-1]]:[[37,-1,0],[39,1,0],[38,0,1],[40,0,-1]]))if(r.keys.has(key)){dx+=x;dy+=y;}if(!dx&&!dy)dx=-direction;const len=Math.hypot(dx,dy)||1;this.blink(s,dx/len*55,dy/len*55);}
   return;
  }
  const attack={kind:'skill',form,rewarded:false};
  if(form==='pawn'||form==='knight'){state.actionUntil=r.tick+8;r.spawn(e,function*(rt,c){yield* rt.castle.melee(c,s,attack,{range:form==='pawn'?15:22,damage:form==='pawn'?3:8,dash:form==='pawn'?25:40,ticks:8});if(form==='knight'&&rt.castle.alive(s))yield* rt.castle.melee(c,s,attack,{range:24,damage:3,ticks:4,height:38});},'castle_check');return;}
  if(form==='bishop'){const x=e.x,y=e.y;for(const sign of [-1,1])this.shot(s,attack,{x,y:y+sign*50,a:angle(direction,-sign),range:140,damage:5,size:12});return;}
  if(form==='rook'){this.shot(s,attack,{a:angle(direction,0),range:140,damage:11,size:24,speed:4,effect:{push:direction*15}});return;}
  if(form==='queen'){const a=angle(foe.x-e.x,foe.y-e.y);state.actionUntil=r.tick+12;r.spawn(e,function*(rt){for(let i=0;i<3&&rt.castle.alive(s)&&!rt.castle.blocked(s);i++){rt.castle.shot(s,attack,{a,range:150,damage:5,size:14,speed:6});yield 4;}},'castle_volley');return;}
  this.shot(s,attack,{a:angle(foe.x-e.x,foe.y-e.y),range:150,damage:15,size:26,speed:5,effect:{root:36}});
 }
 step(){const r=this.r;if(r.scene!=='7dwq')return;
  for(const s of [1,2]){if(!this.active(s))continue;let state=this.state(s);if(!state){state={initialized:false,form:'pawn',until:0,attackAt:0,skillAt:0,ultimateAt:0,actionUntil:0,promotionUntil:0,skillDown:false,ultimateDown:false};r.globals.set(`castle:${s}`,state);}if(!state.initialized)continue;
   if(state.promotionUntil&&r.tick>=state.promotionUntil){state.promotionUntil=0;state.form=promotedPiece(r.random);state.until=r.tick+1200;}
   if(state.form!=='pawn'&&r.tick>=state.until){state.form='pawn';state.until=0;}
   const skill=r.keys.has(s===1?82:80),ultimate=r.keys.has(s===1?83:40),skillEdge=skill&&!state.skillDown,ultimateEdge=ultimate&&!state.ultimateDown;state.skillDown=skill;state.ultimateDown=ultimate;
   if(!this.alive(s)||this.blocked(s)||state.promotionUntil||r.tick<state.actionUntil)continue;
   if(ultimateEdge&&state.form==='pawn'&&r.tick>=state.ultimateAt&&r.num(r.globals.get(info(s).mana))>=60){this.mana(s,-60);state.promotionUntil=r.tick+18;state.ultimateAt=r.tick+360;state.lockX=body(r,s).x;state.lockY=body(r,s).y;continue;}
   if(skillEdge){this.skill(s);continue;}
   if(r.keys.has(s===1?69:13)&&r.tick>=state.attackAt)this.basic(s);
  }
 }
 afterStep(){const r=this.r;
  // Suppress stale preview weapons when the new ball-only character is selected.
  if(r.scene==='1ckl'){for(const [s,weapon]of [[1,'31us'],[2,'mimn']]){const e=r.originals.get(weapon);if(!e)continue;if(r.num(r.globals.get(info(s).character))===35){e.visible=false;e.castlePreviewHidden=true;}else if(e.castlePreviewHidden){e.visible=true;delete e.castlePreviewHidden;}}return;}
  for(const s of [1,2]){if(!this.active(s))continue;const state=this.state(s);if(!state)continue;if(!state.initialized){r.globals.set(info(s).mana,20);state.initialized=true;}
   if(state.promotionUntil){body(r,s).x=state.lockX;body(r,s).y=state.lockY;}
   const e=r.originals.get(sid(s,'n230','ocqj'));if(e){r.setPicture(e,`castle-${state.form}-${e.objectId}`);r.setSize(e,20);e.rotation=0;}
  }
 }
 blocksKey(key){for(const s of [1,2])if(this.active(s)){if([sid(s,69,13),sid(s,82,80),sid(s,83,40)].includes(key))return true;if(this.state(s)?.promotionUntil&&[...(s===1?[65,68,87]:[37,39,38])].includes(key))return true;}return false;}
 draw(c){const r=this.r;for(const s of [1,2]){if(!this.active(s)||!this.alive(s))continue;const state=this.state(s),e=body(r,s);if(!state||r.num(r.globals.get(info(s).stealth)))continue;c.save();c.lineWidth=1.4;c.strokeStyle='#c69c35';if(state.form!=='pawn'){c.beginPath();c.arc(e.x,-e.y,14,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(0,state.until-r.tick)/1200);c.stroke();}if(state.shieldUntil>r.tick&&r.num(r.globals.get(info(s).shield))>0){c.strokeStyle='#97b9e0';c.beginPath();c.arc(e.x,-e.y,12,0,Math.PI*2);c.stroke();}c.font='bold 5px sans-serif';c.textAlign='center';c.lineWidth=1.2;c.strokeStyle='#fff';c.fillStyle='#333';c.strokeText(PIECES[state.form].name,e.x,-e.y+21);c.fillText(PIECES[state.form].name,e.x,-e.y+21);c.restore();}}
}
