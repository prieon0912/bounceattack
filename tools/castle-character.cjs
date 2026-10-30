// Adds Castle without modifying the archived Entry project or any original image.
module.exports=function(project){
 const picture=(id,file,width=100,height=100)=>({id,name:id,fileurl:'assets/castle/'+file,dimension:{width,height},imageType:'svg'});
 const arrays={'5pvu':'캐슬','xxgw':'체스의 지휘자','of7a':'기물 전환','dw8v':'적중으로만 마나를 회복합니다. 비폰 기물은 20초 후 폰으로 돌아갑니다.','twcx':'기물 공격','wynm':'현재 기물에 따라 공격 방식이 달라집니다.','x7mx':'체크','gsve':'현재 기물의 공격 전술을 사용합니다.','74ed':'프로모션','9m7u':'폰에서 무작위 비폰 기물로 20초간 변신합니다. 변신 중에는 사용할 수 없습니다.'};
 for(const [id,data]of Object.entries(arrays)){const list=project.variables.find(v=>v.id===id).array;while(list.length<35)list.push({data:0});list[34]={...list[34],data};}
 for(const id of ['j5y7','zyy3','n230','ocqj']){const o=project.objects.find(o=>o.id===id);o.sprite.pictures.splice(34,0,picture('castle-pawn-'+id,'pawn.svg',['j5y7','zyy3'].includes(id)?180:100,['j5y7','zyy3'].includes(id)?180:100));if(['n230','ocqj'].includes(id))for(const form of ['knight','bishop','rook','queen','king'])o.sprite.pictures.push(picture('castle-'+form+'-'+id,form+'.svg'));}
 for(const [id,key]of [['o9rj','check'],['4ffm','promotion'],['pyez','portrait']])project.objects.find(o=>o.id===id).sprite.pictures.splice(34,0,picture('castle-'+key+'-'+id,key+'-icon.svg',380,380));
 for(const id of ['afvb','8svk'])project.objects.find(o=>o.id===id).sprite.pictures.splice(34,0,picture('castle-profile-'+id,'profile.svg',500,500));
 const effect=project.objects.find(o=>o.id==='hb4u');for(const form of ['pawn','knight','bishop','rook','queen','king'])effect.sprite.pictures.push(picture('castle-shot-'+form,form+'-shot.svg'));effect.sprite.pictures.push(picture('castle-slash','slash.svg',80,80));
 const tile=project.objects.find(o=>o.id==='ncwe');tile.sprite.pictures[2]=picture('castle-select','portrait-icon.svg',380,380);const stacks=JSON.parse(tile.script),init=stacks.find(s=>s[0]?.id==='ndxn');init.push({id:'castle-select-create',type:'create_clone',params:['self',null],statements:[]});// The archived last-row selector rejects duplicate picks. Allow Castle mirrors
 // without changing the original roster's selection conditions.
 const isCastle={type:'boolean_basic_operator',params:[{type:'get_variable',params:['eti2',null]},'EQUAL',{type:'number',params:[35]}]};
 const patch=x=>{if(!x||typeof x!=='object')return;if(['eqs9','kff7'].includes(x.id))x.params[0]={type:'boolean_and_or',params:[x.params[0],'OR',structuredClone(isCastle)]};if(x.id==='1zel')x.params[0]={type:'boolean_and_or',params:[x.params[0],'AND',{type:'boolean_not',params:[null,structuredClone(isCastle),null]}]};if(Array.isArray(x))x.forEach(patch);else Object.values(x).forEach(patch);};patch(stacks);tile.script=JSON.stringify(stacks);
 // Include Castle in the existing random-choice button.
 const random=project.objects.find(o=>o.id==='yvxw');const walk=x=>{if(!x||typeof x!=='object')return;if(x.type==='calc_rand'&&x.params?.[3]?.params?.[0]==34)x.params[3].params[0]=35;if(Array.isArray(x))x.forEach(walk);else Object.values(x).forEach(walk);};const scripts=JSON.parse(random.script);walk(scripts);random.script=JSON.stringify(scripts);
};
