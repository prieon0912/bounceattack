const fs=require('node:fs');const path=require('node:path');const root=path.resolve(__dirname,'..');
const project=JSON.parse(fs.readFileSync(path.join(root,'source/original-project.json'),'utf8'));
// Explicit, qualified numeric overrides keep balancing edits separate from the archived source.
const configDir=path.join(root,'source/characters');
for(const file of fs.readdirSync(configDir).filter(f=>f.endsWith('.json')).sort()){
 const config=JSON.parse(fs.readFileSync(path.join(configDir,file),'utf8'));
 for(const change of config.overrides||[]){
  const object=project.objects.find(o=>o.id===change.objectId);if(!object)throw Error('Unknown tuning object '+change.objectId);
  const stacks=JSON.parse(object.script);let matches=[];
  const visit=x=>{if(!x||typeof x!=='object')return;if(x.id===change.blockId)matches.push(x);if(Array.isArray(x))x.forEach(visit);else {for(const v of Object.values(x))if(v&&typeof v==='object')visit(v);}};visit(stacks);
  if(matches.length!==1)throw Error('Override must identify one block: '+JSON.stringify(change));
  const block=matches[0],i=Number(change.parameter),old=block.params[i];
  if(!Number.isFinite(change.value)||!Number.isInteger(i)||i<0||i>=block.params.length)throw Error('Invalid numeric override '+JSON.stringify(change));
  if(old&&typeof old==='object'){if(!['number','angle'].includes(old.type))throw Error('Only literal number inputs may be tuned');old.params[0]=change.value;}else {if(!Number.isFinite(Number(old)))throw Error('Non-numeric original input');block.params[i]=change.value;}
  object.script=JSON.stringify(stacks);
 }
}
// Balance patch (block-level edits that numeric overrides cannot express).
require('./balance-patch.cjs')(project);
// Mirror matches isolate the original effects that were shared by both players.
const sharedCore=new Set(['m0id','ocqj','n230','n8fg','00h9','m9cz']);
for(const object of project.objects){
 if(object.scene!=='7dwq')continue;
 const selectors=new Set();
 const visit=x=>{if(!x||typeof x!=='object')return;if(x.type==='get_variable'&&['y75t','s5vb'].includes(x.params?.[0]))selectors.add(x.params[0]);if(Array.isArray(x))x.forEach(visit);else Object.values(x).forEach(visit);};
 visit(JSON.parse(object.script));
 object.combatSide=['n230','00h9'].includes(object.id)?1:['ocqj','n8fg'].includes(object.id)?2:selectors.size===1?(selectors.has('y75t')?1:2):null;
 // An object that reads only one selector can still hold the other player's logic in the
 // else-branch of `if (<selector> == n) ... else ...` (e.g. 독안개, 에너지필드, 용접가면, 미사일·폭격표식 that locate the 2P body).
 // It must be split per side in mirror matches too, or the 2P copy runs the 1P branch.
 const otherSide=(sel)=>{const want=sel==='y75t'?/^2p/i:/^1p/i;const names=new Map(project.variables.map(v=>[v.id,v.name]));const objs=new Set(project.objects.filter(o=>want.test(o.name)).map(o=>o.id));let hit=false;const scan=x=>{if(hit||!x||typeof x!=='object')return;if(x.type==='get_variable'&&want.test(names.get(x.params?.[0])||''))hit=true;if(Array.isArray(x.params)&&x.params.some(p=>typeof p==='string'&&objs.has(p)))hit=true;if(Array.isArray(x))x.forEach(scan);else Object.values(x).forEach(scan);};const find=x=>{if(hit||!x||typeof x!=='object')return;if(x.type==='if_else'&&JSON.stringify(x.params?.[0]||null).includes('"'+sel+'"')&&x.statements?.[1])scan(x.statements[1]);if(Array.isArray(x))x.forEach(find);else Object.values(x).forEach(find);};find(JSON.parse(object.script));return hit;};
 const elseHoldsOther=selectors.size===1&&otherSide([...selectors][0]);
 if(elseHoldsOther)object.combatSide=null;
 object.mirrorShared=(selectors.size===2||elseHoldsOther)&&!sharedCore.has(object.id);
 object.sharedCore=sharedCore.has(object.id);
}
const metadata={...project,objects:project.objects.map(({script,...rest})=>structuredClone(rest)),functions:[]};
for(const o of metadata.objects)for(const asset of [...o.sprite.pictures,...o.sprite.sounds])if(asset.fileurl?.startsWith('temp/'))asset.fileurl='assets/'+asset.fileurl;
fs.writeFileSync(path.join(root,'public/data/project.json'),JSON.stringify(metadata));
const exprOps=new Set(['get_variable','coordinate_object','calc_basic','boolean_basic_operator','boolean_and_or','boolean_not','calc_rand','calc_operation','distance_something','reach_something','is_press_some_key','is_clicked','value_of_index_from_list','get_project_timer_value','get_sound_duration','get_sound_volume','combine_something','get_pictures','get_sounds']);
const commands=new Set(['set_variable','change_variable','move_x','move_y','locate','locate_xy','locate_x','locate_y','move_direction','move_to_angle','rotate_relative','rotate_absolute','direction_relative','direction_absolute','see_angle_object','set_scale_size','change_scale_size','change_to_some_shape','change_to_next_shape','flip_x','flip_y','show','hide','create_clone','delete_clone','message_cast','stop_object','change_object_index','change_effect_amount','add_effect_amount','start_scene','restart_project','bounce_wall','brush_erase_all','start_drawing','stop_drawing','set_color','set_thickness','change_thickness','set_brush_tranparency','change_brush_transparency','text_write','text_change_font_color','sound_something_with_block','sound_something_second_with_block','sound_silent_all','sound_volume_set','sound_volume_change','choose_project_timer_action','set_visible_project_timer','change_value_list_index']);
const counts={},detached=[],emitted=[];let loop=0;
const q=JSON.stringify;
function expression(b){if(b===null||typeof b!=='object')return q(b);if(Array.isArray(b))return '['+b.map(expression).join(',')+']';const t=b.type;const a=b.params||[];if(['text','number','angle'].includes(t))return q(a[0]);if(t==='True')return 'true';if(t.startsWith('stringParam_'))return `c.args[${q(t)}]??0`;if(!exprOps.has(t))throw Error('Unsupported expression '+t+' / '+b.id);return `r.value(c,${q(t)},[${a.map(expression).join(',')}])`;}
function body(blocks,depth=0,loopDepth=0){let out='';for(const b of blocks){const t=b.type,a=b.params||[],s=b.statements||[];counts[t]=(counts[t]||0)+1;emitted.push(b.id);out+=`c.block=${q(b.id)};r.guard(c);\n`;if(t==='_if'||t==='if_else'){out+=`if(r.truth(${expression(a[0])})){\n${body(s[0]||[],depth+1,loopDepth)}}`;if(t==='if_else')out+=`else{\n${body(s[1]||[],depth+1,loopDepth)}}`;out+='\n';}
else if(t==='repeat_basic'){const n=loop++;out+=`for(let i${n}=0,n${n}=Math.max(0,Math.floor(r.num(${expression(a[0])})));i${n}<n${n};i${n}++){\n${body(s[0]||[],depth+1,loopDepth+1)}yield 1;\n}\n`;}
else if(t==='repeat_inf'){out+=`while(true){\n${body(s[0]||[],depth+1,loopDepth+1)}yield 1;\n}\n`;}
else if(t==='repeat_while_true'){const cond=`r.truth(${expression(a[0])})`;out+=`while(${a[1]==='until'?'!':''}${cond}){\n${body(s[0]||[],depth+1,loopDepth+1)}yield 1;\n}\n`;}
else if(t==='stop_repeat'){if(!loopDepth)throw Error('Break outside loop '+b.id);out+='break;\n';}
else if(t==='wait_until_true')out+=`while(!r.truth(${expression(a[0])})){yield 1;}\n`;
else if(t==='wait_second')out+=`yield* r.wait(c,${expression(a[0])});\n`;
else if(t==='locate_xy_time')out+=`yield* r.tween(c,${a.slice(0,3).map(expression).join(',')});\n`;
else if(t==='sound_from_to_and_wait')out+=`yield* r.soundWait(c,${a.slice(0,3).map(expression).join(',')});\n`;
else if(t.startsWith('func_'))out+=`yield* r.call(c,${q(t.slice(5))},[${a.filter(x=>x!==null).map(expression).join(',')}]);\n`;
else if(commands.has(t)){out+=`r.command(c,${q(t)},[${a.map(expression).join(',')}]);\n`;if(['delete_clone','stop_object','start_scene','restart_project'].includes(t))out+='if(c.thread.cancelled||c.e.dead)return;\n';}
else if(exprOps.has(t)||t.startsWith('get_'))out+=expression(b)+';\n';
else throw Error('Unsupported statement '+t+' / '+b.id);}
return out;}
let output='// Generated from source/original-project.json. Edit the source or compiler; do not hand-edit generated rules.\nexport function registerOriginal(r){\n';
for(const f of project.functions){const stacks=JSON.parse(f.content);const def=stacks.find(s=>s[0]?.type==='function_create')?.[0];if(!def)throw Error('Missing function '+f.id);let params=[];function find(x){if(!x||typeof x!=='object')return;if(x.type==='function_field_string'&&x.params?.[0]?.type?.startsWith('stringParam_'))params.push(x.params[0].type);if(Array.isArray(x))x.forEach(find);else (x.params||[]).forEach(find);}find(def.params);output+=`r.registerFunction(${q(f.id)},${q(params)},function*(r,c){\n${body(def.statements[0]||[])}\n});\n`;}
let threads=0;
for(const o of project.objects){output+='\n// '+o.name+' / '+o.id+'\n';for(const [i,stack]of JSON.parse(o.script).entries()){if(!stack.length||!stack[0].type.startsWith('when_')){detached.push({object:o.id,thread:i});continue;}const head=stack[0];output+=`r.register(${q(o.id)},${q(head.type)},${q(head.params)},function*(r,c){\n${body(stack.slice(1))}\n});\n`;threads++;}}
output+='}\n';fs.mkdirSync(path.join(root,'public/src'),{recursive:true});fs.writeFileSync(path.join(root,'public/src/original-program.js'),output);fs.writeFileSync(path.join(root,'source/compile-coverage.json'),JSON.stringify({objects:project.objects.length,threads,emittedStatementCount:emitted.length,emittedBlockIds:emitted,opcodes:counts,detached,unimplemented:[]},null,2));console.log(`Compiled ${threads} original threads; ${emitted.length} statements; no unsupported opcodes.`);
