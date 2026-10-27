// 밸런스 패치 1차 테스트 (tools/balance-patch.cjs) — 검증 항목 자동화
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Runtime } from "../public/src/runtime.js";
import { registerOriginal } from "../public/src/original-program.js";
const project = JSON.parse(fs.readFileSync(new URL("../public/data/project.json", import.meta.url)));
function game(p1, p2) {
  const r = new Runtime(project, { headless: true });
  registerOriginal(r);
  r.start({ p1, p2, seed: 5, map: 1 });
  const vid = Object.fromEntries(project.variables.map((v) => [v.name, v.id]));
  r.g = (n) => Number(r.globals.get(vid[n]));
  r.s = (n, v) => r.globals.set(vid[n], v);
  r.s2 = (n, v) => r.globals.set(vid[n] + "@2", v); // 미러전 2P 쪽 캐논 전역 사본
  r.run = (n, keys = []) => {
    for (let i = 0; i < n; i++) {
      r.keys.clear();
      for (const k of keys) r.keys.add(k);
      r.step();
    }
  };
  r.place = (x1, x2) => {
    r.originals.get("00h9").x = x1;
    r.originals.get("n8fg").x = x2;
  };
  r.run(240);
  return r;
}

test("엑스: 보호막 MP 28, 자연 만료는 회복 없음, 파괴 시 5 회복", () => {
  let r = game(5, 2);
  r.s("1P MP", 100); r.s("1P 체력", 50); r.s("1P 마나 재생", 0);
  r.run(2, [82]); r.run(1);
  assert.ok(Math.abs(r.g("1P MP") - 72) < 0.5);
  r.run(420);
  assert.equal(r.g("1P 체력"), 50);
  r = game(5, 2);
  r.s("1P MP", 100); r.s("1P 체력", 50);
  r.run(2, [82]); r.run(30); r.s("1P 방어력", 0); r.run(60);
  assert.equal(r.g("1P 체력"), 55);
});

test("데빌메이지: 궁 MP 57, 적중 환급 65, 초과 MP 피해 1 감소", () => {
  const ult = (mp, gap) => {
    const r = game(19, 2);
    r.place(-gap / 2, gap / 2); r.s("1P MP", mp); r.s("1P 마나 재생", 0);
    const hp = r.g("2P 체력");
    r.run(2, [83]); r.run(60);
    return [r.g("1P MP"), hp - r.g("2P 체력")];
  };
  assert.ok(Math.abs(ult(80, 20)[0] - 91) < 0.6); // 80 − 57 + 65 (+ 재생)
  assert.ok(Math.abs(ult(80, 300)[0] - 26) < 0.6); // 80 − 57 (+ 재생)
  assert.ok(Math.abs(ult(100, 20)[1] - 16.1) < 0.2); // 초과 8 + 기본 8
});

test("프린스: 후퇴 이동만 빨라지고, R 준비 15프레임, 적중 다음 프레임부터 9프레임 에어본", () => {
  const speed = (key) => { const r = game(22, 2); r.place(0, 200); const x = r.originals.get("00h9").x; r.run(120, [key]); return (r.originals.get("00h9").x - x) / 120; };
  assert.ok(Math.abs(speed(68) - 1.251) < 0.002);
  assert.ok(Math.abs(speed(65) + 0.905) < 0.002);
  const r = game(22, 2);
  r.place(-20, 15); r.s("1P MP", 100);
  const hp = r.g("2P 체력");
  let hit = -1; const stun = [];
  for (let t = 0; t < 40; t++) {
    r.run(1, t < 2 ? [82] : []);
    if (hit < 0 && r.g("2P 체력") < hp) hit = t;
    if (hit >= 0) stun.push(r.g("2P 기절"));
  }
  assert.equal(hit, 15);
  assert.equal(hp - r.g("2P 체력"), 11);
  assert.equal(stun.slice(0, 12).join(""), "011111111100");
});

test("프린스: 이미 걸린 기절은 짧게 덮어쓰거나 풀지 않는다", () => {
  const r = game(22, 2);
  r.place(-20, 15); r.s("1P MP", 100); r.s("2P 기절", 1);
  r.run(2, [82]);
  for (let t = 0; t < 40; t++) { r.run(1); assert.equal(r.g("2P 기절"), 1); }
});

test("프린스 미러: 동시에 맞으면 둘 다 맞고 둘 다 에어본", () => {
  const r = game(22, 22);
  r.place(-18, 18); r.s("1P MP", 100); r.s("2P MP", 100); r.s("1P 방향", 1); r.s("2P 방향", 0);
  const h1 = r.g("1P 체력"), h2 = r.g("2P 체력");
  r.run(2, [82, 80]); r.run(40);
  assert.equal(h1 - r.g("1P 체력"), 11);
  assert.equal(h2 - r.g("2P 체력"), 11);
  assert.equal(r.g("1P 프린스 R 에어본 적용"), 1);
  assert.equal(r.g("2P 프린스 R 에어본 적용"), 1);
});

test("스모크: 포션 직격만 추가 피해 3, 강화 독은 궁 종료 후에도 3 유지", () => {
  const potion = (gap) => { const r = game(16, 2); r.place(-gap / 2, gap / 2); r.s("1P 방향", 1); const h = r.g("2P 체력"); r.run(2, [69]); r.run(90); return h - r.g("2P 체력"); };
  assert.equal(potion(50), 9);
  assert.equal(potion(150), 6);
  const r = game(16, 2);
  r.place(-10, 10);
  r.s("2P 맹독", 3); r.s("2P 맹독 피해", 3); r.s("1P 독안개 추가딜", 1);
  const h = r.g("2P 체력"); r.run(200);
  assert.equal(h - r.g("2P 체력"), 9);
});

test("스모크 미러: 2P의 일반 독은 1P 궁 중에도 일반 독으로 기록", () => {
  const r = game(16, 16);
  r.place(-30, 30); r.s("2P 방향", 0); r.s("2P MP", 100);
  r.run(2, [80]);
  for (let t = 0; t < 300; t++) { r.s("1P 독안개 추가딜", 3); r.run(1); }
  assert.equal(r.g("1P 맹독 피해"), 1);
});

test("테슬라: 준비 55프레임, 발사 후 대기 70 유지, 3타 강화 순서 유지", () => {
  const r = game(17, 2);
  r.place(-150, 150);
  const seen = new Set(), fires = [], kinds = [];
  for (let t = 0; t < 700; t++) {
    r.run(1, [69]);
    for (const e of r.entities)
      if (e.objectId === "5c1h" && e.clone && !seen.has(e.uid)) { seen.add(e.uid); fires.push(t); kinds.push(r.g("1P 스킬")); }
  }
  assert.equal(fires[0], 55);
  assert.deepEqual(fires.slice(1, 5).map((f, i) => f - fires[i]), [126, 126, 126, 126]);
  assert.deepEqual(kinds.slice(0, 3), [0, 0, 1]);
});

test("하란: 멈춘 칼은 45 안에서 회수, 비행 궤적은 원본과 같다", () => {
  const r = game(26, 2);
  r.place(-200, 200); r.s("1P 방향", 1);
  r.run(2, [69]); r.run(200);
  const dagger = () => r.entities.find((e) => e.objectId === "nijg" && e.clone && !e.dead);
  let at = null;
  for (let t = 0; t < 600 && dagger(); t++) {
    const d = dagger(), p = r.originals.get("00h9");
    const dist = Math.hypot(d.x - p.x, d.y - p.y);
    r.run(1, [68]);
    if (!dagger()) at = dist;
  }
  assert.ok(at > 40 && at < 47, "pickup distance " + at);
});

// ---- 추가 밸런스 패치 (칸·가드·워트·엔릴·캐논) ----
test("가드: 평타 피해 10, 속박 30틱(0.5초) — 1P·2P", () => {
  for (const [p1, p2, key, foe] of [[14, 2, 69, "2P"], [2, 14, 13, "1P"]]) {
    const r = game(p1, p2);
    r.place(-12, 12); r.s("1P 방향", 1); r.s("2P 방향", 0);
    const h = r.g(`${foe} 체력`); let bind = 0;
    for (let t = 0; t < 120; t++) { r.run(1, t < 2 ? [key] : []); if (r.g(`${foe} 속박`) > 0) bind++; }
    assert.equal(h - r.g(`${foe} 체력`), 10);
    assert.equal(bind, 30);
  }
});

test("칸: 주먹 판정 수평 +1, 수직 +2 여유", () => {
  const hits = (key, gap, dy) => {
    const r = game(8, 2); r.s("1P 방향", 1); r.s("1P MP", 100);
    const h = r.g("2P 체력");
    for (let t = 0; t < 60; t++) { r.place(-gap / 2, gap / 2); r.originals.get("n8fg").y = r.originals.get("00h9").y + dy; r.s("2P 중력", 0); r.run(1, t < 2 ? [key] : []); }
    return h - r.g("2P 체력") > 0;
  };
  assert.ok(hits(69, 30, 0) && !hits(69, 31, 0));
  assert.ok(hits(69, 24, 10) && !hits(69, 24, 11));
  assert.ok(hits(82, 26, 0) && !hits(82, 27, 0));
});

test("워트: 평타 사거리 1.5배, 궁 딜레이 24틱", () => {
  let r = game(21, 2); r.place(-200, 200); r.s("1P 방향", 1);
  const body = r.originals.get("00h9").x; let far = -1e9;
  for (let t = 0; t < 70; t++) { r.run(1, t < 2 ? [69] : []); for (const e of r.entities) if (e.objectId === "f9zp" && e.clone && !e.dead && e.visible) far = Math.max(far, e.x - body); }
  assert.ok(Math.abs(far - 80.25) < 0.5, "reach " + far);
  r = game(21, 2); r.place(-200, 200); r.s("1P MP", 100);
  let dash = -1; for (let t = 0; t < 80; t++) { const mp = r.g("1P MP"); r.run(1, t < 2 ? [83] : []); if (dash < 0 && r.g("1P MP") < mp - 30) dash = t; }
  assert.equal(dash, 24);
});

test("워트: 스킬(물폭탄) 폭파 200 → 160틱 — 1P·2P", () => {
  for (const [p1, p2, key, foe] of [[21, 2, 82, "2P"], [2, 21, 80, "1P"]]) {
    const r = game(p1, p2); r.place(-15, 15); r.s("1P MP", 100); r.s("2P MP", 100);
    r.s(`${foe} 방어력`, 0);
    const h = r.g(`${foe} 체력`); let boom = -1;
    for (let t = 0; t < 260 && boom < 0; t++) { r.run(1, t < 2 ? [key] : []); if (h - r.g(`${foe} 체력`) >= 14) boom = t; }
    assert.ok(boom >= 158 && boom <= 163, "explode at " + boom);
  }
});

test("엔릴: 평타 사거리 1.1배, 피해 5", () => {
  let r = game(27, 2); r.place(-200, 200); r.s("1P 방향", 1);
  let x0 = null, max = -1e9;
  for (let t = 0; t < 60; t++) { r.run(1, t < 2 ? [69] : []); for (const e of r.entities) if (e.objectId === "awbu" && e.clone && !e.dead) { x0 ??= e.x; max = Math.max(max, e.x); } }
  assert.ok(Math.abs(max - x0 - 100.1) < 0.3);
  r = game(27, 2); r.place(-30, 30); r.s("1P 방향", 1);
  const h = r.g("2P 체력"); r.run(2, [69]); r.run(60);
  assert.equal(h - r.g("2P 체력"), 5);
});

test("캐논: 평타 1.2배, 궁 거리 제한 없음·피해 6, R 적중 파편 1, 미사일은 현재 위치에서", () => {
  let r = game(32, 2); r.place(-200, 200); r.s("1P 방향", 1);
  const body = r.originals.get("00h9").x; let far = -1e9;
  for (let t = 0; t < 40; t++) { r.run(1, t < 2 ? [69] : []); for (const e of r.entities) if (e.objectId === "plg8" && e.clone && !e.dead && e.visible) far = Math.max(far, e.x - body); }
  assert.ok(Math.abs(far - 142.9) < 0.5);
  r = game(32, 2); r.place(-150, 150); r.s("1P MP", 100); r.s("정수갯수", 3); r.s("초과정수", 3);
  const h = r.g("2P 체력"); r.run(2, [83]); r.run(260);
  assert.equal(h - r.g("2P 체력"), 18);
  r = game(32, 2); r.place(-20, 20); r.s("1P 방향", 1); r.s("1P MP", 100); r.s("정수갯수", 0); r.s("초과정수", 0);
  r.run(2, [82]); r.run(150);
  assert.equal(r.g("정수갯수"), 1);
  r = game(32, 2); r.place(-200, 200); r.s("1P MP", 100); r.s("정수갯수", 2); r.s("초과정수", 2);
  const seen = new Set();
  for (let t = 0; t < 120; t++) {
    r.run(1, t < 2 ? [83, 68] : [68]);
    const p = r.originals.get("00h9");
    for (const e of r.entities) if (e.objectId === "p041" && e.clone && !e.dead && !seen.has(e.uid)) { seen.add(e.uid); assert.ok(Math.abs(e.x - p.x) < 0.01); }
  }
  assert.ok(seen.size >= 1);
});

test("캐논 미러: 2P 궁은 2P에서 발사되어 1P를 타격", () => {
  const r = game(32, 32); r.place(-150, 150); r.s("2P MP", 100); r.s2("정수갯수", 2); r.s2("초과정수", 2); r.s("2P 방향", 0);
  const h = r.g("1P 체력"); r.run(2, [40]); r.run(200);
  assert.equal(h - r.g("1P 체력"), 12);
});

test("캐논 미러: 두 캐논이 동시에 궁을 써도 각자 상대를 겨냥하고 범위 원이 사라진다", () => {
  for (const delay of [0, 20, 90]) {
    const r = game(32, 32); r.place(-200, 200);
    r.s("1P MP", 100); r.s("2P MP", 100);
    for (const n of ["정수갯수", "초과정수"]) { r.s(n, 3); r.s2(n, 3); }
    const seen = new Set(), marks = { 1: [], 2: [] };
    for (let t = 0; t < 420; t++) {
      r.run(1, [...(t < 2 ? [83] : []), ...(t >= delay && t < delay + 2 ? [40] : [])]);
      for (const e of r.entities) if (e.objectId === "hyk2" && e.clone && !e.dead && !seen.has(e.uid)) { seen.add(e.uid); marks[e.combatSide].push(Math.round(e.x)); }
    }
    assert.deepEqual(marks[1], [200, 200, 200], "1P delay " + delay);
    assert.deepEqual(marks[2], [-200, -200, -200], "2P delay " + delay);
    assert.equal(r.entities.filter((e) => e.clone && !e.dead && ["plg8", "cvkh"].includes(e.objectId)).length, 0);
  }
});

// 좌표를 독립적으로 움직여 시전자 추적과 상대 추적을 구별한다.
test("캐논 궁: 움직이는 상대를 조준하고 큰 파란 원은 생성하지 않는다 (양쪽·미러전)", () => {
  for (const [p1, p2] of [[32, 2], [2, 32], [32, 32]]) {
    const r = game(p1, p2);
    // 착탄 넉백을 제외하고 추적 좌표만 검증한다.
    r.collisionProvider = () => false;
    const command = r.command;
    r.command = function(c, type, args) {
      const result = command.call(this, c, type, args);
      // 조준 갱신 직후 검사한다. 기존 발사 반동 메시지의 별도 시각 이동은 제외한다.
      if (["ovjz", "ipoe"].includes(c.block) && ["plg8", "cvkh"].includes(c.e.objectId)) {
        const side = c.e.objectId === "plg8" ? 1 : 2;
        const target = this.originals.get(side === 1 ? "n8fg" : "00h9");
        assert.ok(Math.abs(c.e.x - target.x) < 0.001, `aim x side ${side}`);
        assert.ok(Math.abs(c.e.y - target.y) < 0.001, `aim y side ${side}`);
        rings[side]++;
      }
      return result;
    };
    for (const t of [...r.threads, ...r.pending])
      if (["00h9", "n8fg"].includes(t.e.objectId)) t.cancelled = true;
    r.s("1P MP", 100); r.s("2P MP", 100);
    r.s("1P 체력", 1000); r.s("2P 체력", 1000);
    for (const name of ["정수갯수", "초과정수"]) {
      r.s(name, 3);
      if (r.mirror) r.s2(name, 3);
    }
    const seen = new Set(), count = { 1: 0, 2: 0 }, rings = { 1: 0, 2: 0 };
    for (let t = 0; t < 260; t++) {
      const a = r.originals.get("00h9"), b = r.originals.get("n8fg");
      a.x = -180 + t * 0.35; a.y = -60 + t * 0.1;
      b.x = 170 - t * 0.15; b.y = 40 - t * 0.2;
      r.run(1, t < 2 ? [...(p1 === 32 ? [83] : []), ...(p2 === 32 ? [40] : [])] : []);
      for (const e of r.entities) {
        if (!e.clone || e.dead) continue;
        if (["plg8", "cvkh"].includes(e.objectId)) {
          assert.ok(!["o1dk", "be9x"].includes(e.picture?.id), "large blue circle must not exist");

        }
        if (e.objectId === "hyk2" && !seen.has(e.uid)) {
          seen.add(e.uid);
          const side = r.mirror ? e.combatSide : p1 === 32 ? 1 : 2;
          const target = side === 1 ? b : a;
          assert.ok(Math.abs(e.x - target.x) < 0.001, `shot x side ${side}`);
          assert.ok(Math.abs(e.y - target.y) < 0.001, `shot y side ${side}`);
          count[side]++;
        }
      }
    }
    for (const side of [1, 2]) if ((side === 1 ? p1 : p2) === 32) {
      assert.equal(count[side], 3, `three shots side ${side}`);
      assert.ok(rings[side] > 30, `target indicator observed side ${side}`);
    }
    assert.deepEqual(r.faults, []);
  }
});
