import fs from 'node:fs';import {Runtime} from '../public/src/runtime.js';import {registerOriginal} from '../public/src/original-program.js';
const p=JSON.parse(fs.readFileSync(new URL('../public/data/project.json',import.meta.url)));let all=[];
for(let char=1;char<=34;char++)for(const key of [69,82,83]){const r=new Runtime(p,{headless:true});registerOriginal(r);r.start({p1:char,p2:char===2?1:2,seed:20261027});r.globals.set('295r',3);for(let t=0;t<400;t++){r.globals.set('qn98',100);r.globals.set('akf6',1000);r.globals.set('7ir2',1000);if(t>3&&t<160)r.keys.add(key);else r.keys.delete(key);r.step();}if(r.faults.length)all.push({char,key,faults:r.faults.slice(0,3)});}
console.log(JSON.stringify(all,null,2));if(all.length)process.exitCode=1;
