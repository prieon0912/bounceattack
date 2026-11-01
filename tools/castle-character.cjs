// Adds Castle without modifying the archived Entry project or any original image.
module.exports=function(project){
 const picture=(id,file,width=100,height=100)=>({id,name:id,fileurl:'assets/castle/'+file,dimension:{width,height},imageType:'svg'});
 const arrays={'5pvu':'체크메티트','xxgw':'체스의 영혼','of7a':'기물 전환','dw8v':'마나 자동 수급량이 줄어드나, 공격을 적중시키면 마나를 획득합니다.','twcx':'템포','wynm':'기물에 맞게 적을 공격합니다.','x7mx':'체크','gsve':'현재 기물의 공격 전술을 사용합니다.','74ed':'프로모션','9m7u':'무작위 비폰 기물로 변신합니다. 변신 상태는 몇 초 뒤 해제됩니다.'};
 for(const [id,data]of Object.entries(arrays)){const list=project.variables.find(v=>v.id===id).array;while(list.length<35)list.push({data:0});list[34]={...list[34],data};}
 for(const id of ['j5y7','zyy3','n230','ocqj']){const o=project.objects.find(o=>o.id===id);o.sprite.pictures.splice(34,0,picture('castle-pawn-'+id,'pawn.svg',180,180));if(['n230','ocqj'].includes(id))for(const form of ['knight','bishop','rook','queen','king'])o.sprite.pictures.push(picture('castle-'+form+'-'+id,form+'.svg',180,180));}
 // 평타 아이콘(템포)은 캐릭터 아이콘과 다른 체스 시계 그림.
 for(const [id,key]of [['o9rj','check'],['4ffm','promotion'],['pyez','tempo']])project.objects.find(o=>o.id===id).sprite.pictures.splice(34,0,picture('castle-'+key+'-'+id,key+'-icon.svg',380,380));
 for(const id of ['afvb','8svk'])project.objects.find(o=>o.id===id).sprite.pictures.splice(34,0,picture('castle-profile-'+id,'profile.svg',500,500));
 for(const id of ['31us','mimn'])project.objects.find(o=>o.id===id).sprite.pictures.push(picture('castle-held-pawn-'+id,'pawn-held.svg'));
 const effect=project.objects.find(o=>o.id==='hb4u');for(const form of ['pawn','knight','bishop','rook','queen','king'])effect.sprite.pictures.push(picture('castle-shot-'+form,form+'-shot.svg'));for(const form of ['pawn','knight','bishop','rook','queen','king'])effect.sprite.pictures.push(picture('castle-held-'+form,form+'-held.svg'));
 effect.sprite.pictures.push(picture('castle-crown','crown.svg',100,80));
 const tile=project.objects.find(o=>o.id==='ncwe');tile.sprite.pictures[2]=picture('castle-select','portrait-icon.svg',380,380);const stacks=JSON.parse(tile.script),init=stacks.find(s=>s[0]?.id==='ndxn');init.push({id:'castle-select-create',type:'create_clone',params:['self',null],statements:[]});tile.script=JSON.stringify(stacks);
 // A dimmed tile is a confirmed choice, not merely the currently hovered preview.
 // Apply the same lock to every selector row; online matchmaking still permits mirrors.
 const variable=id=>({type:'get_variable',params:[id,null]});
 const equals=(a,b)=>({type:'boolean_basic_operator',params:[a,'EQUAL',b]});
 for(const [oid,index]of [['3y3g','9k0l'],['k089','ttn8'],['646h','olrb'],['a091','dytc'],['ncwe','eti2']]){
  const o=project.objects.find(o=>o.id===oid),st=JSON.parse(o.script);
  const available=()=>({type:'boolean_not',params:[null,{type:'boolean_and_or',params:[equals(variable(index),variable('jc9i')),'OR',equals(variable(index),variable('ymu4'))]},null]});
  const visit=x=>{if(!x||typeof x!=='object')return;
   if(['fsnl','1n1w'].includes(x.id))x.params[0]={type:'boolean_and_or',params:[x.params[0],'AND',available()]};
   if(x.id==='1zel')x.statements[0].push({id:'selector-wrap-'+oid,type:'_if',params:[equals(variable('s5vb'),{type:'number',params:[36]}),null],statements:[[{id:'selector-wrap-reset-'+oid,type:'set_variable',params:['s5vb',{type:'number',params:[1]},null],statements:[]}]]});
   if(Array.isArray(x))x.forEach(visit);else Object.values(x).forEach(visit);
  };visit(st);o.script=JSON.stringify(st);
 }
 // Include Castle in the existing random-choice button.
 const random=project.objects.find(o=>o.id==='yvxw');const walk=x=>{if(!x||typeof x!=='object')return;if(x.type==='calc_rand'&&x.params?.[3]?.params?.[0]==34)x.params[3].params[0]=35;if(Array.isArray(x))x.forEach(walk);else Object.values(x).forEach(walk);};const scripts=JSON.parse(random.script);walk(scripts);
 const markRandom=x=>{if(!x||typeof x!=='object')return;if(Array.isArray(x)){for(let i=x.length-1;i>=0;i--){const b=x[i];if(b?.type==='set_variable'&&b.params[0]==='jx38'){const phase=String(b.params[1]?.params?.[0]??b.params[1]);if(['2','0'].includes(phase))x.splice(i+1,0,{id:'random-confirm-'+phase,type:'set_variable',params:[phase==='2'?'jc9i':'ymu4',variable(phase==='2'?'y75t':'s5vb'),null],statements:[]});}markRandom(b);}}else Object.values(x).forEach(markRandom);};markRandom(scripts);random.script=JSON.stringify(scripts);
};
