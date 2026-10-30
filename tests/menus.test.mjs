import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Runtime } from "../public/src/runtime.js";
import { registerOriginal } from "../public/src/original-program.js";
const project = JSON.parse(
  fs.readFileSync(new URL("../public/data/project.json", import.meta.url)),
);
function menu() {
  const r = new Runtime(project, { headless: true });
  r.originalUI = true;
  registerOriginal(r);
  r.startProject();
  r.loadScene("1ckl");
  for (let i = 0; i < 15; i++) r.step();
  return r;
}
test("original selector initializes all 35 clone positions before shared counters are reused", () => {
  const r = menu(),
    groups = ["3y3g", "k089", "646h", "a091", "ncwe"];
  const tiles = r.entities.filter(
    (e) => e.clone && groups.includes(e.objectId),
  );
  assert.equal(tiles.length, 35);
  for (const id of groups) {
    const row = tiles.filter((e) => e.objectId === id);
    assert.equal(new Set(row.map((e) => e.x)).size, row.length);
    assert.ok(row.every((e) => e.x >= -140 && e.x <= 140));
  }
  assert.deepEqual(r.faults, []);
});
test("source menu scenes initialize and transitions cancel the previous scene", () => {
  const r = menu();
  for (const scene of ["qc29", "ub0s", "1323", "1ckl", "s27s"]) {
    r.loadScene(scene);
    for (let i = 0; i < 120; i++) r.step();
    assert.equal(r.scene, scene);
    assert.deepEqual(r.faults, []);
    assert.ok(r.entities.every((e) => e.def.scene === scene));
  }
  r.mouse.down = true;
  r.keys.add(65);
  r.startProject();
  assert.equal(r.mouse.down, false);
  assert.equal(r.keys.size, 0);
  assert.equal(r.scene, "qc29");
});

const selectorIndex={ '3y3g':'9k0l',k089:'ttn8','646h':'olrb',a091:'dytc',ncwe:'eti2' };
const advance=(r,n)=>{for(let i=0;i<n;i++)r.step();};
function tileFor(r,character){r.globals.set('iqtj',character>24?1:0);advance(r,2);return r.entities.find(e=>e.clone&&selectorIndex[e.objectId]&&r.num(r.get(e,selectorIndex[e.objectId]))===character);}
test('all 35 offline choices dim and reject reselection, but an unchosen tile still confirms for 2P',()=>{for(let character=1;character<=35;character++){const r=menu(),tile=tileFor(r,character);assert.ok(tile);r.click(tile.x,tile.y);advance(r,3);assert.equal(r.num(r.globals.get('jc9i')),character);assert.equal(r.num(r.globals.get('jx38')),2);r.mouse.x=230;r.mouse.y=120;advance(r,35);assert.equal(tile.effects.brightness,-50);r.click(tile.x,tile.y);advance(r,3);assert.equal(r.num(r.globals.get('jx38')),2,`locked ${character}`);assert.notEqual(r.num(r.globals.get('s5vb')),character);const other=character%35+1,next=tileFor(r,other);r.click(next.x,next.y);advance(r,3);assert.equal(r.num(r.globals.get('ymu4')),other);assert.equal(r.num(r.globals.get('jx38')),0);assert.deepEqual(r.faults,[]);}});
test('random offline picks record the same confirmed locks and cannot be reselected manually',()=>{const r=menu(),random=r.originals.get('yvxw');r.random=()=>.999;r.click(random.x,random.y);advance(r,3);assert.equal(r.globals.get('jc9i'),35);r.mouse.x=230;r.mouse.y=120;advance(r,35);const tile=tileFor(r,35);r.click(tile.x,tile.y);advance(r,3);assert.equal(r.num(r.globals.get('jx38')),2);r.random=()=>0;r.click(random.x,random.y);advance(r,4);assert.equal(r.globals.get('ymu4'),1);assert.equal(r.num(r.globals.get('jx38')),0);assert.deepEqual(r.faults,[]);});
