
import { prepareSkill, skillVisual } from './additional-secondary-skills.js';

export const BARRICADE = Object.freeze({
  character: 2, manaCost: 55, cooldownTicks: 60, decayTicks: 60,
  health: 30, width: 12, height: 36, gap: 3, gravity: .2, terminalSpeed: 6, voidY: -250, voidDamage: 10,
});
const bodyId = side => side === 1 ? '00h9' : 'n8fg';
const avatarId = side => side === 1 ? 'n230' : 'ocqj';
const sid = (side, first, second) => side === 1 ? first : second;
function walls(r) { return r.entities.filter(e => !e.dead && e.secondaryEffect === 'sten-barricade'); }
function installations(r) {
  return r.entities.filter(e=>!e.dead&&(e.secondaryEffect==='sten-barricade'||
    (['boom-turret','prince-flag'].includes(e.secondaryEffect)&&e.installationHealth>0)));
}
function canHitInstallation(e,target) {
  return !['boom-turret','prince-flag'].includes(target.secondaryEffect)||target.installationOwner!==e.combatSide;
}

function location(r, side) {
  const caster = r.originals.get(bodyId(side)), bounds = {...r.bounds(caster)};
  const avatar=r.originals.get(avatarId(side)),art=r.bounds(avatar);
  bounds.left=Math.min(bounds.left,caster.x+art.left-avatar.x);
  bounds.right=Math.max(bounds.right,caster.x+art.right-avatar.x);
  const direction = r.num(r.globals.get(sid(side, 'etjn', '846x'))) === 1 ? 1 : -1;
  return {
    x: (direction > 0 ? bounds.right : bounds.left) + direction * (BARRICADE.width / 2 + BARRICADE.gap),
    y: bounds.bottom + BARRICADE.height / 2, direction,
  };
}
function makeWall(r, side) {
  const pos = location(r, side), e = r.makeEntity(r.defs.get('6tzq'));
  const picture = r.defs.get('o9rj').sprite.pictures.find(p => p.id === 'sten-barricade-wall');
  Object.assign(e, { clone: true, combatSide: null, barricadeOwner: side, secondaryEffect: 'sten-barricade',
    picture, width: 24, height: 72, regX: 12, regY: 36,
    scaleX: pos.direction * .5, scaleY: .5, rotation: 0, visible: true,
    x: pos.x, y: pos.y, barricadeHealth: BARRICADE.health,
    barricadeDecayAt: r.tick + BARRICADE.decayTicks, barricadeFallSpeed: 0 });
  return e;
}
function validLocation(r, side, wall) {
  const bounds = r.bounds(wall);
  if (bounds.left <= -239 || bounds.right >= 239 || bounds.top > 135 || bounds.bottom < -135) return false;
  if (r.reach(wall, '6tzq') || r.reach(wall, '2bx4')) return false;
  return !overlapsPlayer(r,wall);
}
function destroy(r,wall) {
  if(wall.dead)return;
  wall.dead=true;
  for(let index=0;index<3;index++){
    const piece=skillVisual(r,wall.barricadeOwner,'sten-barricade-piece-'+index,
      wall.x,wall.y,BARRICADE.width,'barricade-debris');
    piece.scaleX=wall.scaleX;piece.scaleY=wall.scaleY;
    r.spawn(piece,function*(rt){
      let velocityY=.9-index*.25;
      try{
        for(let age=0;age<22;age++){
          piece.x+=(index-1)*.65;
          piece.y+=velocityY;velocityY-=.12;
          piece.rotation+=(index-1)*4;
          piece.effects.transparency=age/21*100;
          yield 1;
        }
      }finally{piece.dead=true;}
    },'barricade_break');
  }
}
function hurt(r, wall, damage) {
  if(['boom-turret','prince-flag'].includes(wall.secondaryEffect)){
    wall.installationHealth=Math.max(0,wall.installationHealth-damage);
    return;
  }
  wall.barricadeHealth = Math.max(0, wall.barricadeHealth - damage);
  if (wall.barricadeHealth === 0) destroy(r,wall);
}
// Sweep in stage units so fast bullets cannot pass through a thin barricade.
function firstContact(r, e, dx, dy) {
  const isPlayer=['00h9','n8fg'].includes(e.objectId);
  const candidates=(isPlayer?walls(r):installations(r)).filter(target=>canHitInstallation(e,target));
  if (!candidates.length) return null;
  const x = e.x, y = e.y, steps = Math.max(1, Math.ceil(Math.hypot(dx, dy)));
  try {
    for (let i = 0; i <= steps; i++) {
      e.x = x + dx * i / steps; e.y = y + dy * i / steps;
      const side=e.objectId==='00h9'?1:e.objectId==='n8fg'?2:0;
      const wall = candidates.find(w => w !== e && (side?overlapsCharacter(r,w,side):r.overlap(e,w)));
      if (wall) return { wall, fraction: Math.max(0, i - 1) / steps };
    }
    return null;
  } finally { e.x = x; e.y = y; }
}
function wallSlam(r, e, side) {
  const flag = sid(side, '0231', 's77h'), force = sid(side, 'c9o4', 'lgp6');
  if (r.num(r.globals.get(flag)) > 0) {
    r.globals.set(flag, 0);
    r.spawn(e, function*(rt, c) {
      yield* rt.call(c, sid(side, '05j0', 'qy83'), [-20, 11, 2]);
    }, 'barricade_wall_slam');
  }
  r.globals.set(force, 0);
}
const targetVariables = side => new Set([
  sid(side,'akf6','7ir2'),sid(side,'qn98','thom'),sid(side,'8w41','wyyq'),
  sid(side,'05ze','1vu0'),sid(side,'9af4','nccn'),sid(side,'c9o4','lgp6'),
  sid(side,'td66','ziwi'),sid(side,'mfr0','mnus'),sid(side,'f7zw','932j'),
  '91k5','ha8n','lq8z','oafg','s9yw','zxd6','ndo3',
]);
function lineContact(r, from, to, ignoredWall=null) {
  let nearest = null;
  for (const wall of installations(r)) {
    if(!wall.visible||wall.uid===ignoredWall||!canHitInstallation(from,wall))continue;
    const b = r.bounds(wall), dx = to.x-from.x, dy = to.y-from.y;
    let low = 0, high = 1;
    for (const [p,q] of [[-dx,from.x-b.left],[dx,b.right-from.x],[-dy,from.y-b.bottom],[dy,b.top-from.y]]) {
      if (p === 0) { if (q < 0) { high = -1; break; } }
      else if (p < 0) low = Math.max(low,q/p);
      else high = Math.min(high,q/p);
    }
    if (low <= high && (!nearest || low < nearest.fraction)) nearest = {wall,fraction:low};
  }
  return nearest?.wall;
}
function canTargetWall(e,target) {
  return !e.clone&&!['00h9','n8fg','n230','ocqj'].includes(e.objectId)&&
    ['00h9','n8fg','n230','ocqj'].includes(target);
}
function overlapsCharacter(r,wall,side) {
  const caster=r.originals.get(bodyId(side)),avatar=r.originals.get(avatarId(side));
  if(r.overlap(wall,caster))return true;
  const saved={x:avatar.x,y:avatar.y,visible:avatar.visible};
  try{
    avatar.x=caster.x;avatar.y=caster.y;avatar.visible=true;
    return r.overlap(wall,avatar);
  }finally{Object.assign(avatar,saved);}
}
function overlapsPlayer(r,wall) {
  return [1,2].some(side=>overlapsCharacter(r,wall,side));
}
function shiftToFreeSpace(r, wall, home) {
  const original={x:wall.x,y:wall.y},preferred=wall.scaleX>0?1:-1;
  wall.visible=true;
  for(let distance=0;distance<=480;distance++){
    for(const direction of distance?[preferred,-preferred]:[preferred]){
      wall.x=home.x+distance*direction;wall.y=home.y;
      const bounds=r.bounds(wall);
      if(bounds.left<=-239||bounds.right>=239)continue;
      if(!overlapsPlayer(r,wall)&&!r.reach(wall,'6tzq')&&!r.reach(wall,'2bx4'))return true;
    }
  }
  wall.x=original.x;wall.y=original.y;
  return false;
}
function fall(r, wall) {
  wall.barricadeFallSpeed=Math.min(BARRICADE.terminalSpeed,wall.barricadeFallSpeed+BARRICADE.gravity);
  const steps=Math.max(1,Math.ceil(wall.barricadeFallSpeed)),amount=wall.barricadeFallSpeed/steps;
  for(let i=0;i<steps;i++){
    const y=wall.y;wall.y-=amount;
    if(r.reach(wall,'6tzq')||r.reach(wall,'2bx4')){
      wall.y=y;wall.barricadeFallSpeed=0;break;
    }
    if(overlapsPlayer(r,wall)){
      if(!shiftToFreeSpace(r,wall,{x:wall.x,y:wall.y})){
        wall.y=y;wall.barricadeFallSpeed=0;break;
      }
    }
  }
}
export const stenBarricade = {
  character: 2, name: '바리케이드', manaCost: BARRICADE.manaCost,
  cooldownTicks: BARRICADE.cooldownTicks, lockVariable: false,
  icon: 'assets/secondary/sten-barricade-icon.svg', secondaryPictureId: 'sten-barricade-icon',
  description: '이동과 공격을 막는 바리케이드를 설치합니다.',
  effectPictures: [
    ['sten-barricade-wall','assets/secondary/sten-barricade-wall.svg',{width:24,height:72}],
    ...[0,1,2].map(index=>['sten-barricade-piece-'+index,'assets/secondary/sten-barricade-piece-'+index+'.svg',{width:24,height:72}]),
  ],
  prepare: prepareSkill,
  canCast(r,side) {
    const probe = makeWall(r,side);
    // The existing wall is retired only after a replacement has a valid location.
    const old = walls(r).find(w=>w.barricadeOwner===side);
    if (old) old.dead = true;
    try { return validLocation(r,side,probe); }
    finally { if (old) old.dead = false; }
  },
  *cast(r,c,{side}) {
    const wall = makeWall(r,side);
    for (const old of walls(r)) if (old.barricadeOwner===side) destroy(r,old);
    r.entities.unshift(wall);
  },
  afterStep(r,side,state) {
    if(!state.barricadeSpawn){
      const caster=r.originals.get(bodyId(side));
      state.barricadeSpawn={x:caster.x,y:r.bounds(caster).bottom+BARRICADE.height/2};
    }
    for(const wall of walls(r)){
      if(wall.barricadeOwner!==side)continue;
      if(r.num(r.globals.get(sid(side,'akf6','7ir2')))<=0){destroy(r,wall);continue;}
      if(r.tick>=wall.barricadeDecayAt){
        const decay=1+Math.floor((r.tick-wall.barricadeDecayAt)/BARRICADE.decayTicks);
        hurt(r,wall,decay);wall.barricadeDecayAt+=decay*BARRICADE.decayTicks;
        if(wall.dead)continue;
      }
      if(wall.barricadePendingReturn){
        if(!shiftToFreeSpace(r,wall,state.barricadeSpawn)){wall.visible=false;continue;}
        wall.barricadePendingReturn=false;
      }
      fall(r,wall);
      if(wall.y<BARRICADE.voidY){
        hurt(r,wall,BARRICADE.voidDamage);wall.barricadeFallSpeed=0;
        if(wall.dead)continue;
        if(!shiftToFreeSpace(r,wall,state.barricadeSpawn)){
          wall.barricadePendingReturn=true;wall.visible=false;
        }
      }
    }
  },
  onClone(r,c,child) {
    const mode=r.num(r.get(c.e,sid(c.e.combatSide||1,'rr24','qvkr')));
    const damage=child.def.barricadeDamage?.[mode];
    if(damage>0)child.barricadeProjectileDamage=damage;
  },
  blocksMove(r,e,dx,dy) {
    if (e.dead || e.barricadeEndpointMode || e.secondaryEffect==='sten-barricade') return false;
    if(e.barricadeImpact)return true;
    const side = e.objectId==='00h9'?1:e.objectId==='n8fg'?2:0;
    const damage = e.clone && (e.barricadeProjectileDamage ?? e.def.barricadeDamage?.[r.num(r.get(e,sid(e.combatSide||1,'rr24','qvkr')))]);
    if (!(side && dx && !dy) && !(damage>0)) return false;
    const hit = firstContact(r,e,dx,dy);
    if (!hit) return false;
    if (side) {
      e.x += dx*hit.fraction;
      wallSlam(r,e,side);
    } else {
      hurt(r,hit.wall,damage);
      const nativeFlight=e.def.barricadeEndpoint&&[...r.threads,...r.pending].some(t=>t.e===e&&!t.cancelled&&t.event==='when_clone_start');
      if(nativeFlight){
        e.x+=dx*hit.fraction;e.y+=dy*hit.fraction;
        e.barricadeImpact=true;e.barricadeImpactWall=hit.wall.uid;
      }else e.dead=true;
    }
    return true;
  },
  reachValue(r,c,target,value) {
    if(c.inFunction||!canTargetWall(c.e,target))return value;
    const wall=installations(r).find(w=>canHitInstallation(c.e,w)&&r.overlap(c.e,w));
    if(!wall)return value;
    c.barricadeHitTarget={uid:wall.uid,tick:r.tick};
    return true;
  },
  targetDistanceValue(r,c,target,value) {
    if(c.inFunction||!canTargetWall(c.e,target))return value;
    let nearest=null,distance=value;
    for(const wall of installations(r)){
      if(!wall.visible||!canHitInstallation(c.e,wall))continue;
      const bounds=r.bounds(wall);
      const dx=Math.max(bounds.left-c.e.x,0,c.e.x-bounds.right);
      const dy=Math.max(bounds.bottom-c.e.y,0,c.e.y-bounds.top);
      const candidate=Math.hypot(dx,dy);
      if(candidate<distance){nearest=wall;distance=candidate;}
    }
    if(nearest)c.barricadeHitTarget={uid:nearest.uid,tick:r.tick};
    return distance;
  },
  blocksFunction(r,c,id,args) {
    const targetSide=id==='qy83'?2:id==='05j0'?1:0;
    if(!targetSide || r.num(args[0])>=0 || !installations(r).length) return;
    const target=r.originals.get(bodyId(targetSide));
    if(c.e===target || c.e.objectId==='n230' || c.e.objectId==='ocqj' || c.e.objectId==='00h9' || c.e.objectId==='n8fg') return;
    const selected=c.barricadeHitTarget;
    delete c.barricadeHitTarget;
    const wall=(selected?.tick===r.tick&&installations(r).find(w=>w.uid===selected.uid))||
      lineContact(r,c.e.projectileOrigin?{...c.e.projectileOrigin,combatSide:c.e.combatSide}:c.e,target,c.e.barricadeEndpointMode?c.e.barricadeImpactWall:null);
    if(!wall)return;
    hurt(r,wall,-r.num(args[0]));
    c.barricadeBlocked={tick:r.tick,side:targetSide};
    return true;
  },
  onCommand(r,c,type,args) {
    const block=c.barricadeBlocked;
    if(block?.tick!==r.tick)return;
    if(type==='message_cast')return false;
    if(['set_variable','change_variable'].includes(type)&&targetVariables(block.side).has(args[0]))return false;
    const attacker=3-block.side;
    if(type==='change_variable'&&r.num(args[1])>0&&
      [sid(attacker,'qn98','thom'),sid(attacker,'akf6','7ir2')].includes(args[0]))return false;
  },
};

// Both installations use the same attack collision and damage-routing rules.
export const installationCombat=Object.fromEntries(
 ['onClone','blocksMove','reachValue','targetDistanceValue','blocksFunction','onCommand']
  .map(name=>[name,stenBarricade[name]])
);
