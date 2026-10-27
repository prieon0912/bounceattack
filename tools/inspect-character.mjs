import fs from 'node:fs';
const id=Number(process.argv[2]);if(!Number.isInteger(id)||id<1||id>34)throw Error('Usage: node tools/inspect-character.mjs <1..34>');
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const config=read(`source/characters/${String(id).padStart(2,'0')}.json`),source=read('source/original-project.json');
console.log(JSON.stringify({...config,objects:source.objects.filter(o=>[...config.primaryObjects,...config.counterpartObjects].includes(o.id)).map(o=>({id:o.id,name:o.name,entity:o.entity,pictures:o.sprite.pictures,script:JSON.parse(o.script)}))},null,2));
