// 바운스어택 밸런스 패치 최종안 — 1차 테스트 (docs/04_밸런스패치_1차.md)
//
// Applied by tools/compile-original.cjs to the archived source project before
// compiling. Every edit targets an exact block id inside a specific object and
// asserts the original value first, so a wrong id or an unexpected source
// change stops the build instead of silently patching the wrong block.
// All changes are applied to the 1P and the 2P version of each object.
"use strict";

module.exports = function applyBalancePatch(project) {
  const objects = new Map(project.objects.map((o) => [o.id, o]));
  const scripts = new Map();
  const varId = new Map(project.variables.map((v) => [v.name, v.id]));
  const V = (name) => {
    const id = varId.get(name);
    if (!id) throw Error("Balance patch: unknown variable " + name);
    return id;
  };
  const stacksOf = (objectId) => {
    if (!scripts.has(objectId)) {
      const o = objects.get(objectId);
      if (!o) throw Error("Balance patch: unknown object " + objectId);
      scripts.set(objectId, JSON.parse(o.script));
    }
    return scripts.get(objectId);
  };
  // ---- block lookup -------------------------------------------------------
  function locate(objectId, blockId) {
    const hits = [];
    const visitList = (list) => {
      if (!Array.isArray(list)) return;
      list.forEach((b, i) => {
        if (!b || typeof b !== "object") return;
        if (b.id === blockId) hits.push({ block: b, list, index: i });
        for (const s of b.statements || []) visitList(s);
        for (const p of b.params || []) visitParam(p);
      });
    };
    const visitParam = (p) => {
      if (!p || typeof p !== "object") return;
      if (p.id === blockId) hits.push({ block: p, list: null, index: -1 });
      for (const q of p.params || []) visitParam(q);
    };
    for (const stack of stacksOf(objectId)) visitList(stack);
    if (hits.length !== 1)
      throw Error(`Balance patch: block ${blockId} in ${objectId} matched ${hits.length} times`);
    return hits[0];
  }
  // Change one numeric literal. `path` walks params from the block to the
  // literal (e.g. [0, 2] = condition -> right-hand operand of an _if).
  function setNumber(objectId, blockId, path, from, to) {
    let node = locate(objectId, blockId).block;
    for (let i = 0; i < path.length - 1; i++) node = node.params[path[i]];
    const last = path[path.length - 1];
    const lit = node.params[last];
    const holder = lit && typeof lit === "object" ? lit : null;
    if (holder && !["number", "text", "angle"].includes(holder.type))
      throw Error(`Balance patch: ${objectId}/${blockId} is not a literal`);
    const old = Number(holder ? holder.params[0] : lit);
    if (old !== from)
      throw Error(`Balance patch: ${objectId}/${blockId} expected ${from}, found ${old}`);
    if (holder) holder.params[0] = String(to);
    else node.params[last] = String(to);
  }
  // ---- block builders (Entry block JSON) ----------------------------------
  let seq = 0;
  const id = () => "bp" + (seq++).toString(36).padStart(3, "0");
  const blk = (type, params, statements = []) => ({ id: id(), x: 0, y: 0, type, params, statements });
  const num = (v) => blk("number", [String(v)]);
  const get = (name) => blk("get_variable", [V(name), null]);
  const set = (name, value) => blk("set_variable", [V(name), value, null]);
  const change = (name, value) => blk("change_variable", [V(name), value, null]);
  const cmp = (a, op, b) => blk("boolean_basic_operator", [a, op, b]);
  const and = (a, b) => blk("boolean_and_or", [a, "AND", b]);
  const calc = (a, op, b) => blk("calc_basic", [a, op, b]);
  const iff = (cond, body) => blk("_if", [cond, null], [body]);
  const ifElse = (cond, a, b) => blk("if_else", [cond, null, null], [a, b]);
  const call = (fn, args) => blk("func_" + fn, [...args, null]);
  const forever = (body) => blk("repeat_inf", [null, null], [body]);
  const onStart = () => blk("when_scene_start", [null]);
  function insertAfter(objectId, blockId, newBlocks) {
    const { list, index } = locate(objectId, blockId);
    if (!list) throw Error(`Balance patch: ${blockId} is not a statement`);
    list.splice(index + 1, 0, ...newBlocks);
  }
  function replace(objectId, blockId, newBlocks) {
    const { list, index } = locate(objectId, blockId);
    if (!list) throw Error(`Balance patch: ${blockId} is not a statement`);
    list.splice(index, 1, ...newBlocks);
  }
  function addStack(objectId, stack) {
    stacksOf(objectId).push(stack);
  }
  function addVariable(name, value) {
    if (varId.has(name)) throw Error("Balance patch: variable exists " + name);
    const used = new Set(project.variables.map((v) => v.id));
    let n = 0, vid;
    do vid = "bpv" + (n++).toString(36); while (used.has(vid));
    project.variables.push({ name, id: vid, visible: false, value: String(value), variableType: "variable", isCloud: false, isRealTime: false, cloudDate: false, object: null, x: 0, y: 0 });
    varId.set(name, vid);
  }

  // ======================================================================
  // 1. 엑스 — 보호막 자연 만료 회복 3 → 0, 보호막 MP 31 → 28
  for (const axe of ["f5gc", "45b6"]) {
    setNumber(axe, "t71x", [0, 2], 31, 28);
    setNumber(axe, "4g8a", [1], -31, -28);
  }
  setNumber("9srf", "olxu", [0], 3, 0); // 1P 방어막 만료 → func_albn(0)
  setNumber("9thh", "q4yu", [0], 3, 0); // 2P 방어막 만료 → func_41z4(0)

  // 2. 데빌메이지 — 궁 MP 55 → 59, 적중 환급 64 → 66
  for (const [o, cond, cost, refund] of [["dg09", "t71x", "4g8a", "vvgx"], ["zzbm", "qhr9", "g0xa", "3n8g"]]) {
    setNumber(o, cond, [0, 2], 55, 59);
    setNumber(o, cost, [1], -55, -59);
    setNumber(o, refund, [1], 64, 66);
  }

  // 3. 하란 — 칼을 회수할 수 있는 범위 30 → 45.
  //    바꾸는 것은 멈춘 단검이 "주인이 가까이 올 때까지 기다렸다가 회수"하는
  //    판정(wait_until)뿐이다. 날아가거나 튕기는 단검이 주인 근처에서 멈추는
  //    조건(stop_repeat, 30)과 적 공격 판정·비행 궤적·순보는 그대로 둔다.
  const haran = { nijg: ["zl72", "ej2e", "fxex"], e7ip: ["zl72", "61ge", "fxex"] };
  for (const [o, ids] of Object.entries(haran))
    for (const b of ids) {
      if (locate(o, b).block.type !== "wait_until_true") throw Error("Balance patch: 하란 pickup block " + b);
      setNumber(o, b, [0, 2], 30, 45);
    }

  // 4. 프린스
  // 기본 피해 5 → 7; 궁극기 강화 추가 피해는 유지.
  setNumber("z4wa", "1mm1", [0], -5, -7);
  setNumber("l8ny", "wqwk", [0], -5, -7);
  project.variables.find(v => v.id === "gsve").array[0].data = "적의 위치에 표식을 남기고 0.8초 뒤 표식 위치에서 폭발이 일어납니다.";
  project.variables.find(v => v.id === "gsve").array[21].data = "적을 끌어당기며 띄우고 강하게 찌릅니다";
  //  - 기본 이동 분모 20 → 17, 접근 보정 −7.7 → −4.7 (접근 중 분모 12.3 유지)
  setNumber("m9cz", "se3v", [1], 20, 17);
  setNumber("m9cz", "72e2", [1], 20, 17);
  for (const [o, ids] of [["z4wa", ["3hgs", "lkt2"]], ["l8ny", ["lr3u", "hm80"]]])
    for (const b of ids) setNumber(o, b, [1], -7.7, -4.7);
  //  - R 준비 25회 → 15회. 창을 뒤로 빼는 궤적은 같은 모양(감속하며 멈춤)과
  //    같은 끝 위치(−13)를 유지: 시작 −1 → −1.625, 증가 0.04 → 13/120.
  for (const [o, init, step, rep] of [["z4wa", "dpbu", "6ch6", "udcb"], ["l8ny", "abwd", "yx9v", "nfm0"]]) {
    setNumber(o, rep, [0], 25, 15);
    setNumber(o, init, [1], -1, -1.625);
    setNumber(o, step, [1], 0.04, 0.10833333333333334);
  }
  //  - R 적중 시 짧은 에어본: 공격당 최초 적중 1회, 상승 1.25(일반 점프 2.5의
  //    50%), 행동 제한 0.15초(9프레임, 적중 다음 프레임부터). 이미 기절·속박·CC면역 상태면 적용하지
  //    않고, 그동안 다른 기절이 새로 걸렸다면 해제하지 않는다.
  for (const side of ["1P", "2P"]) {
    addVariable(`${side} 기절 세대`, 0);
    addVariable(`${side} 프린스 에어본 대기`, 0);
    addVariable(`${side} 프린스 에어본 락`, 0);
    addVariable(`${side} 프린스 에어본 세대`, 0);
    addVariable(`${side} 프린스 R 에어본 적용`, 0);
  }
  const princeR = [
    // [attacker object, attacker, target, MP-cost block, hit block]
    ["z4wa", "1P", "2P", "xfn3", "wvb0"],
    ["l8ny", "2P", "1P", "xfn3", "vdfs"],
  ];
  const free = (foe) =>
    and(
      and(cmp(get(`${foe} 기절`), "EQUAL", num(0)), cmp(get(`${foe} 속박`), "LESS_OR_EQUAL", num(0))),
      cmp(get(`${foe} cc 저항`), "EQUAL", num(0)),
    );
  for (const [o, me, foe, costBlock, hitBlock] of princeR) {
    insertAfter(o, costBlock, [set(`${me} 프린스 R 에어본 적용`, num(0))]);
    // The hit only queues the airborne. It is applied one frame later by the
    // countdown below, so when both 프린스 hit each other in the same frame
    // both hits land (the stun would otherwise cancel whichever R runs later).
    insertAfter(o, hitBlock, [
      iff(and(cmp(get(`${me} 프린스 R 에어본 적용`), "EQUAL", num(0)), free(foe)), [
        set(`${me} 프린스 R 에어본 적용`, num(1)),
        set(`${foe} 프린스 에어본 대기`, num(1)),
      ]),
    ]);
    addStack(o, [
      onStart(),
      iff(cmp(get(`${me} 능력`), "EQUAL", num(22)), [
        forever([
          iff(cmp(get(`${foe} 프린스 에어본 대기`), "EQUAL", num(2)), [
            set(`${foe} 프린스 에어본 대기`, num(0)),
            iff(free(foe), [
              iff(cmp(get(`${foe} 중력`), "LESS", num(1.25)), [set(`${foe} 중력`, num(1.25))]),
              set(`${foe} 기절`, num(1)), // stun-generation bump + snapshot are added below
              // counts down in this same frame too → 9 locked frames = 0.15초
              set(`${foe} 프린스 에어본 락`, num(10)),
            ]),
          ]),
          iff(cmp(get(`${foe} 프린스 에어본 대기`), "EQUAL", num(1)), [set(`${foe} 프린스 에어본 대기`, num(2))]),
          iff(cmp(get(`${foe} 프린스 에어본 락`), "GREATER", num(0)), [
            change(`${foe} 프린스 에어본 락`, num(-1)),
            iff(cmp(get(`${foe} 프린스 에어본 락`), "LESS_OR_EQUAL", num(0)), [
              iff(
                and(cmp(get(`${foe} 기절 세대`), "EQUAL", get(`${foe} 프린스 에어본 세대`)), cmp(get(`${foe} 기절`), "EQUAL", num(1))),
                [set(`${foe} 기절`, num(0))],
              ),
            ]),
          ]),
        ]),
      ]),
    ]);
  }

  // 5. 스모크
  //  - 일반 평타 포션이 비행 중 적에게 직접 닿으면 추가 피해 3 (포션당 1회,
  //    바닥 폭발 범위만 닿은 경우 제외). 기존 폭발 피해 6은 그대로.
  for (const [o, fn] of [["tz68", "qy83"], ["6lns", "05j0"]]) {
    const branch = locate(o, "cdsm").block;
    branch.statements[0].unshift(call(fn, [num(-3), num(10), num(1)]));
  }
  //  - 독의 세기를 중독될 때 대상에게 기록 (강화 독은 궁이 끝나도 남은 횟수
  //    동안 3 유지). 안개 세기는 소유자별 변수로 분리해 동일 캐릭터 대전에서도
  //    서로 섞이지 않게 한다. 약한 독이 강한 독을 덮어쓰거나 늘리지 않는다.
  addVariable("1P 독안개 추가딜", 1);
  addVariable("2P 독안개 추가딜", 1);
  addVariable("1P 맹독 피해", 0);
  addVariable("2P 맹독 피해", 0);
  const fogStrength = { "1P": ["dxcb", "nqj7", "6zae", "d5yx"], "2P": ["q7jr", "pye5", "ncem", "8obs"] };
  for (const [owner, ids] of Object.entries(fogStrength))
    for (const b of ids) {
      const blk0 = locate("wqxb", b).block;
      if (blk0.type !== "set_variable" || blk0.params[0] !== V("독안개 추가딜"))
        throw Error("Balance patch: unexpected fog block " + b);
      blk0.params[0] = V(`${owner} 독안개 추가딜`);
    }
  const poisonApply = { "2P": ["b5zd", "y978", "nthh", "patl"], "1P": ["hm2i", "14mc", "jodq", "acl1"] };
  for (const [target, ids] of Object.entries(poisonApply)) {
    const owner = target === "2P" ? "1P" : "2P";
    for (const b of ids) {
      const old = locate("wqxb", b).block;
      if (old.type !== "set_variable" || old.params[0] !== V(`${target} 맹독`))
        throw Error("Balance patch: unexpected poison block " + b);
      replace("wqxb", b, [
        ifElse(
          and(cmp(get(`${target} 맹독`), "GREATER", num(0)), cmp(get(`${target} 맹독 피해`), "GREATER", get(`${owner} 독안개 추가딜`))),
          [], // a stronger poison is running: keep its damage and remaining ticks
          [set(`${target} 맹독`, num(3)), set(`${target} 맹독 피해`, get(`${owner} 독안개 추가딜`))],
        ),
      ]);
    }
  }
  for (const [o, b, target] of [["ocqj", "omuk", "2P"], ["n230", "ryuv", "1P"]]) {
    const tick = locate(o, b).block; // func_xxx((독안개 추가딜 * -1), 6, 0)
    const amount = tick.params[0];
    if (amount.type !== "calc_basic" || amount.params[0].params[0] !== V("독안개 추가딜"))
      throw Error("Balance patch: unexpected poison tick " + b);
    amount.params[0] = get(`${target} 맹독 피해`);
  }

  // 6. 테슬라 — 평타 준비 70 → 55 (일반·3타 강화 분기 모두). 무기를 뒤로
  //    빼는 진행값은 같은 곡선과 같은 끝 위치(−6.0375)를 유지:
  //    차징2 시작 −7 → −8.9444, 증가 0.1 → 0.16263. 발사 후 대기 70은 유지.
  const TS = 0.1626262626262626, T0 = -55 * TS;
  for (const o of ["5c1h", "8rb4"]) {
    for (const rep of ["vhf5", "1b7h"]) setNumber(o, rep, [0], 70, 55);
    for (const init of ["igpv", "ml35"]) setNumber(o, init, [1], -7, T0);
    for (const step of ["01we", "bgzv"]) setNumber(o, step, [1], 0.1, TS);
  }

  // ======================================================================
  // 추가 밸런스 패치 — 칸·가드·워트·엔릴·캐논 (docs/05_밸런스패치_2차.md)

  // 칸 — 평타·R의 실제 주먹 판정에 수평 1, 수직 2 여유. 그림·궤적·타격 횟수 유지.
  // reach_something의 추가 인자(여유 x, y)는 runtime.js reach()가 처리한다.
  for (const [o, ids] of [["ri23", ["uywk", "2but"]], ["4mt9", ["vgdd", "hb94"]], ["m2p4", ["uywk", "2but"]], ["uxuo", ["vgdd", "hb94"]]])
    for (const b of ids) {
      const reach = locate(o, b).block;
      if (reach.type !== "reach_something" || reach.params.length !== 3)
        throw Error("Balance patch: 칸 fist check " + o + "/" + b);
      reach.params.push(num(1), num(2));
    }

  // 가드 — 평타 피해 9 → 10, 평타 속박을 실제 0.5초(30틱)로.
  // 속박 변수는 매 틱 0.02씩 줄고 설정한 틱에도 한 번 줄어들므로(원본 0.5 = 24틱)
  // 30틱이 되려면 0.62.
  for (const [o, dmg] of [["sn6j", "62cf"], ["rlr8", "2gar"]]) {
    setNumber(o, dmg, [0], -9, -10);
    setNumber(o, "0sez", [1], 0.5, 0.62);
  }

  // 워트 — 평타 사거리 1.5배: 두 물결의 시작 위치와 속도·감속을 1.5배
  // (지속 시간·그림 크기·판정은 그대로). 궁 딜레이 30 → 24틱(0.8배)과
  // 기 모으기 연출 3×10 → 3×8.
  const wart = {
    f9zp: { off12: ["fo7w", "osrh"], off22: ["7mpt", "3um4"], sp2: "33wq", dec1: "pkm6", sp3: "qdsl", dec2: "ze3m" },
    "52i7": { off12: ["g9et", "towp"], off22: ["kf0b", "jk9y"], sp2: "rv0m", dec1: "wbwg", sp3: "7jfz", dec2: "an80" },
  };
  for (const [o, w] of Object.entries(wart)) {
    for (const b of w.off12) setNumber(o, b, [0], Number(locate(o, b).block.params[0].params[0]), 1.5 * Number(locate(o, b).block.params[0].params[0]));
    for (const b of w.off22) setNumber(o, b, [0], Number(locate(o, b).block.params[0].params[0]), 1.5 * Number(locate(o, b).block.params[0].params[0]));
    setNumber(o, w.sp2, [1], 2, 3);
    setNumber(o, w.dec1, [1], -0.1, -0.15);
    setNumber(o, w.sp3, [1], 3, 4.5);
    setNumber(o, w.dec2, [1], -0.15, -0.225);
    setNumber(o, "6mtk", [0], 30, 24);
    // 스킬(물폭탄) 폭파까지 20 + 180 = 200틱 → 20 + 140 = 160틱(0.8배).
    // 도화선 불꽃이 한 바퀴(360°)를 그 시간 안에 돌도록 각도 증가량도 360/140.
    setNumber(o, "8mmv", [0], 180, 140);
    setNumber(o, "c913", [2], 180, 140);
  }
  setNumber("dcos", "3y7d", [0], 10, 8);
  {
    const fade = locate("dcos", "zf85").block.params[1]; // (-100 / 30)
    if (fade.type !== "calc_basic" || Number(fade.params[2].params[0]) !== 30) throw Error("Balance patch: 기 모으기 fade");
    fade.params[2].params[0] = "24";
    const ease = locate("dcos", "31p1").block.params[0]; // ((16 - size) / 5)
    if (ease.type !== "calc_basic" || Number(ease.params[2].params[0]) !== 5) throw Error("Balance patch: 기 모으기 scale");
    ease.params[2].params[0] = "4"; // same end size in 24 frames
  }

  // 엔릴 — 평타 사거리 1.1배(바람 속도 7 → 7.7, 지속 14틱 그대로), 피해 4 → 5.
  for (const [o, dmg] of [["awbu", "0hxh"], ["kuhk", "7j9a"]]) {
    setNumber(o, "u2k2", [1], 7, 7.7);
    setNumber(o, dmg, [0], -4, -5);
  }

  // 캐논
  for (const [o, side, hits, phys] of [["plg8", "1P", ["88c8", "hv2p"], "1P 물리엔진"], ["cvkh", "2P", ["515j", "m826"], "2P 물리엔진"]]) {
    //  - 평타 사거리 1.2배: 발사구 5 → 6, 속도 6 → 7.2, 감속 0.15 → 0.18
    setNumber(o, "jz5w", [0], 5, 6);
    setNumber(o, "s6wa", [1], 6, 7.2);
    setNumber(o, "bin3", [1], -0.15, -0.18);
    //  - 궁 타겟 거리 제한 삭제: 항상 적의 실제 위치를 타겟으로
    const pick = locate(o, "48hh");
    if (pick.block.type !== "if_else") throw Error("Balance patch: 캐논 target");
    pick.list.splice(pick.index, 1, ...pick.block.statements[0]);
    //  - 강화포 적중 시 기어 3개를 120도 간격으로 발사 (최대 보유량 10).
    for (const h of hits)
      insertAfter(o, h, [iff(cmp(get("초과정수"), "LESS_OR_EQUAL", num(9)), [blk("create_clone", ["cba1", null, num(3)])])]);
  }
  //  - 궁 피해 7 → 6
  setNumber("hyk2", "s6b7", [0], -7, -6);
  setNumber("hyk2", "lelx", [0], -7, -6);
  //  - 연속 발사 미사일은 생성 순간의 캐논 위치(물리엔진 + 발사구 7)에서 출발.
  //    몸 그림(1player)은 한 틱 늦게 따라오므로 쓰지 않는다. 발사된 탄은 따라가지 않음.
  for (const [b, phys] of [["lqt1", "00h9"], ["qcv4", "n8fg"]]) {
    const loc = locate("p041", b).block;
    if (loc.type !== "locate") throw Error("Balance patch: 미사일 locate " + b);
    loc.params[0] = phys;
    insertAfter("p041", b, [blk("move_y", [num(7), null])]);
  }

  // ---- stun generation counter --------------------------------------------
  // After every "기절 = 1" in the game (including the ones added above), bump
  // the target's stun generation so the 프린스 airborne lock only releases a
  // stun it started itself.
  const stunVar = { [V("1P 기절")]: "1P", [V("2P 기절")]: "2P" };
  for (const o of project.objects) {
    const stacks = stacksOf(o.id);
    const visit = (list) => {
      if (!Array.isArray(list)) return;
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        if (!b || typeof b !== "object") continue;
        for (const s of b.statements || []) visit(s);
        const side = b.type === "set_variable" && stunVar[b.params[0]];
        const val = side && b.params[1];
        if (side && val && typeof val === "object" && ["number", "text"].includes(val.type) && Number(val.params[0]) === 1) {
          const extra = [change(`${side} 기절 세대`, num(1))];
          list.splice(i + 1, 0, ...extra);
          i += extra.length;
        }
      }
    };
    for (const stack of stacks) visit(stack);
  }
  // the airborne lock records the generation right after its own stun
  for (const [o, , foe] of princeR) {
    const stack = stacksOf(o)[stacksOf(o).length - 1];
    let done = false;
    const visit = (list) => {
      for (let i = 0; list && i < list.length; i++) {
        const b = list[i];
        if (b.type === "change_variable" && b.params[0] === V(`${foe} 기절 세대`) && !done) {
          list.splice(i + 1, 0, set(`${foe} 프린스 에어본 세대`, get(`${foe} 기절 세대`)));
          done = true;
        }
        for (const st of b.statements || []) visit(st);
      }
    };
    visit(stack);
    if (!done) throw Error("Balance patch: airborne stun generation missing");
  }

  // 캐논 궁 조준: 저장된 거리 차 대신 매번 상대의 현재 좌표를 사용한다.
  // 기존 locate 기준을 유지하여 미러전의 양쪽 역할 판별도 그대로 보존한다.
  const coordinate = (objectId, axis) => blk("coordinate_object", [null, objectId, null, axis]);
  const followTarget = (objectId, blockId, origin, target, axis) => {
    const b = locate(objectId, blockId).block;
    if (b.type !== `move_${axis}` || b.params[0]?.type !== "get_variable" ||
        b.params[0].params[0] !== V(axis === "x" ? "대공포격x" : "대공포격y"))
      throw Error(`Balance patch: cannon tracking ${objectId}/${blockId}`);
    b.params[0] = calc(coordinate(target, axis), "MINUS", coordinate(origin, axis));
  };
  for (const [o, origin, target] of [["plg8", "00h9", "n8fg"], ["cvkh", "n8fg", "00h9"]]) {
    // 큰 파란 원 전용 복제본은 생성하지 않는다. 실제 조준 표식은 유지한다.
    const ring = locate(o, "gr95");
    if (ring.block.type !== "create_clone" || ring.block.params[0] !== "self")
      throw Error("Balance patch: cannon large ring " + o);
    ring.list.splice(ring.index, 1);
    for (const b of ["cga3", "fhpu"]) followTarget(o, b, origin, target, "x");
    for (const b of ["ovjz", "ipoe"]) followTarget(o, b, origin, target, "y");
  }
  // 각 포격의 착탄 위치는 해당 발사 시점의 상대 위치에서 결정한다.
  for (const [origin, target, bx, by] of [["n230", "n8fg", "et78", "77fn"], ["ocqj", "00h9", "kilr", "803l"]]) {
    followTarget("hyk2", bx, origin, target, "x");
    followTarget("hyk2", by, origin, target, "y");
  }

  // 2026-11-02: reduce both phases of Devil Mage's actual ultimate dash by 7.5%.
  for (const [o,before,blocks] of [
    ["dg09",100,["ilh4","88lb"]],["dg09",150,["dwf9","wwpu"]],
    ["zzbm",150,["ilh4","88lb"]],["zzbm",150,["05e8","5qgr"]],
  ]) for(const [index,b] of blocks.entries()) setNumber(o,b,[1],index===0?-before:before,(index===0?-before:before)*.925);
  // Exact-zero HP must take the same native defeat/result path as overkill.
  for(const [o,b] of [["tw3p","li0g"],["vrl3","wy03"]]){
    const condition=locate(o,b).block.params[0];
    if(condition.type!=="boolean_basic_operator"||condition.params[1]!=="LESS")throw Error("Unexpected defeat condition "+o);
    condition.params[1]="LESS_OR_EQUAL";
  }

  // Explosion Mark only: 48 ticks and a blast target of 156 instead of 145, with the original damage curve.
  for(const [o,wait,initial,grow,hit] of [
    ["m9km","mabe","kl6v","306w","ivss"],["iaqy","fj0m","rbsn","f3xy","or82"],
  ]){
    setNumber(o,wait,[0],45,48);
    setNumber(o,initial,[0],20,20*156/145);
    setNumber(o,grow,[0,0,0],145,156);
    const damage=locate(o,hit).block.params[0].params[0];
    damage.params[2]=calc(damage.params[2],"DIVIDE",num(156/145));
  }

  // Eclipse: remove the slow from empowered orbit hits only.
  for (const [objectId, blockId] of [["q6zw", "4ki0"], ["kxwh", "1bdg"]]) {
    const slow = locate(objectId, blockId);
    if (slow.block.type !== "set_variable") throw Error("Unexpected Eclipse slow block");
    slow.list.splice(slow.index, 1);
  }

  // Invader: shorten both directional branches of Mental Weakening by 40%.
  for (const [objectId, blocks] of [["wkk5", ["dq2o", "u3p5"]], ["6r3z", ["dq2o", "f3pt"]]]) {
    for (const blockId of blocks) setNumber(objectId, blockId, [0], 100, 60);
  }

  // Retire recast timers in the native skills. Their action stacks still
  // finish normally, including cast animation, movement and recovery.
  for (const [objectId, blockId, previous, unlocked] of [
    ["sn6j", "v6jb", 0.6, 0], ["rlr8", "69v8", 0.6, 0],
    ["plg8", "8l2c", 8, -1], ["cvkh", "8l2c", 8, -1], ["cvkh", "86b5", 8, -1],
    ["7h6f", "gbl6", 18, -1], ["zwgp", "gbl6", 18, -1],
    ["6ct7", "8r9z", 2, -1], ["5p2k", "c0u8", 2, -1],
    ["ri23", "38sr", 0.7, 0], ["m2p4", "38sr", 0.7, 0],
    ["jk2d", "eyx9", 6, -1], ["5isi", "eyx9", 6, -1],
    ["6y87", "3vhp", 4.5, -1], ["6y87", "sk8j", 4.5, -1],
    ["8boq", "3vhp", 4.5, -1], ["8boq", "3xdo", 4.5, -1],
  ]) setNumber(objectId, blockId, [1], previous, unlocked);

  for (const [objectId, stacks] of scripts) objects.get(objectId).script = JSON.stringify(stacks);
  project.variables.find(v => v.id === "x7mx").array[16].data = "응축 에너지";
  return project;
};
