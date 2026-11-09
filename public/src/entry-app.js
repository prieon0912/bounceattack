import { Assets } from "./assets.js";
import { Renderer } from "./renderer.js";
import { Runtime } from "./runtime.js";
import { registerOriginal } from "./original-program.js";
import { OnlineConnection } from "./online.js";
import { FrameSync, KEYS } from "./frame-sync.js";
import { InputDelayController } from "./network-delay.js";
const canvas = document.getElementById("stage"),
  status = document.getElementById("status");
const assets = new Assets(),
  renderer = new Renderer(canvas, assets);
let runtime,
  build,
  last = 0,
  elapsed = 0,
  onlineMode = false,
  connection = null,
  sync = null,
  epoch = null,
  searching = false,
  lastProgress = 0,
  lastRequest = 0,
  ready = false;
const menu = document.getElementById("main-menu"),
  panel = document.getElementById("match-panel"),
  message = document.getElementById("match-message");
function stopOnline() {
  // Leaving a running match forfeits it, so the opponent wins.
  if (sync) connection?.gameplay({ type: "forfeit" });
  connection?.close();
  connection = null;
  sync = null;
  epoch = null;
  searching = false;
  panel.hidden = true;
}
function home() {
  stopOnline();
  forfeitWin = false;
  postMatch = false;
  onlineMode = false;
  hideNet();
  for (const a of runtime?.playing || []) a.pause();
  runtime?.startProject();
  status.textContent = "";
}
// Online character select: the opponent is not known yet, so the 2P preview
// (character, weapon, cannon) is replaced by a "?" slot.
const unknownP2 = document.getElementById("unknown-p2");
const P2_PREVIEW = new Set(["zyy3", "mimn", "pe89"]);
function sceneUI() {
  menu.hidden = !ready || runtime.scene !== "qc29";
  const hideP2 = onlineMode && !sync && runtime.scene === "1ckl";
  unknownP2.hidden = !hideP2;
  if (hideP2)
    for (const e of runtime.entities)
      if (P2_PREVIEW.has(e.objectId)) e.visible = false;
  if (runtime.scene === "qc29") {
    for (const id of ["syvy", "3amf"]) {
      const e = runtime.originals.get(id);
      if (e) e.visible = false;
    }
  }
}
// Connection overlay shown over the game while waiting / when decided.
const netOverlay = document.getElementById("net-overlay"),
  netTitle = document.getElementById("net-title"),
  netText = document.getElementById("net-text");
let netHideTimer = null;
function showNet(title, text = "", { result = false } = {}) {
  clearTimeout(netHideTimer);
  netTitle.textContent = title;
  netText.textContent = text;
  netOverlay.classList.toggle("result", result);
  netOverlay.hidden = false;
  if (result) netHideTimer = setTimeout(hideNet, 2200);
}
function hideNet() {
  clearTimeout(netHideTimer);
  netOverlay.hidden = true;
}
// Opponent left (forfeit message), or the server picked a winner after the
// match stalled for FORFEIT_AFTER ms (see "claim" in server/rooms.js).
// Lockstep ends and the match finishes locally with the loser's HP below 0,
// so the original "승리" ending plays.
const FORFEIT_AFTER = 15000;
let claimSent = false;
let forfeitWin = false,
  forfeitHp = null;
// Size the buffer from the actual peer path, including a Redis relay.
const FRAME_MS = 1000 / 60;
let delayController = new InputDelayController();
function adaptDelay(mode, ping) {
  sync.setDelay(delayController.observe(ping, mode));
}
let postMatch = false;
function endMatch() {
  if (!sync) return;
  sync = null;
  epoch = null;
  connection?.close();
  connection = null;
  postMatch = true;
  heldOnline.clear();
  runtime.keys.clear();
  hideNet();
  status.textContent = "대전 종료 · 뒤로가기를 누르면 처음 화면으로 돌아가요.";
}
function winByForfeit(won = true) {
  if (!sync || !connection) return;
  const role = connection.identity.role;
  const loserIsOpponent = won;
  sync = null;
  epoch = null;
  connection.close();
  connection = null;
  forfeitWin = true;
  postMatch = true;
  heldOnline.clear();
  runtime.keys.clear();
  runtime.paused = false;
  // The original ends the round when HP drops *below* 0 (2P 체력 7ir2 / 1P 체력 akf6).
  const loser = loserIsOpponent ? 1 - role : role;
  forfeitHp = loser === 1 ? "7ir2" : "akf6";
  elapsed = 0;
  if (won) {
    status.textContent = "상대 연결이 끊겨 승리했어요!";
    showNet("승리!", "상대 연결이 끊겼어요", { result: true });
  } else {
    status.textContent = "연결이 끊겨 패배 처리됐어요.";
    showNet("연결 끊김", "패배 처리됐어요", { result: true });
  }
}
window.addEventListener("pagehide", () => {
  if (sync) connection?.gameplay({ type: "forfeit" });
});
function search() {
  if (searching) return;
  searching = true;
  panel.hidden = false;
  message.textContent = "상대를 찾고 있어요… (1 / 2)";
  runtime.keys.clear();
  connection = new OnlineConnection({
    onJoined: () => {
      if (!sync) message.textContent = "상대를 찾고 있어요… (1 / 2)";
    },
    onRoom: (room) => {
      if (
        sync &&
        room.match?.epoch === epoch &&
        room.match.winner !== undefined &&
        room.match.winner !== null
      ) {
        winByForfeit(room.match.winner === connection.identity.role);
        return;
      }
      if (room.phase === "playing" && room.match?.epoch !== epoch) {
        const match = room.match;
        epoch = match.epoch;
        forfeitWin = false;
        postMatch = false;
        searching = false;
        panel.hidden = true;
        runtime.start(match);
        runtime.originalUI = true;
        Object.assign(runtime.mouse, { x: -9999, y: -9999, down: false });
        delayController = new InputDelayController();
        sync = new FrameSync(connection.identity.role, {
          delay: match.delay,
          onSend: (frames) => connection.input(frames),
          onFault: (text) => {
            runtime.paused = true;
            status.textContent = text;
          },
        });
        elapsed = 0;
        claimSent = false;
        hideNet();
        lastProgress = performance.now();
        connection.gameplay({ type: "sync", from: 1 });
        status.textContent = `온라인 대전 · ${connection.identity.role + 1}P · A/D·←/→ 이동, W·↑ 점프, E/R/S·Enter/P/↓ 공격`;
      }
    },
    onGameplay: (msg) => {
      if (!sync) return;
      if (msg.type === "forfeit") winByForfeit();
      else if (msg.type === "input") sync.receive(msg.role, msg.frames);
      else if (msg.type === "checksum") sync.checksum(msg.frame, msg.hash);
      else if (msg.type === "sync") connection.replay(sync.replay(msg.from));
    },
    onReconnect: () => {
      if (sync) connection.gameplay({ type: "sync", from: runtime.tick + 1 });
    },
    onError: (text) => {
      message.textContent = text;
      panel.hidden = false;
    },
    onNotice: (text) => {
      status.textContent = text;
    },
    onStatus: (s) => {
      if (sync && s.peerPing) adaptDelay(s.mode, s.ping);
      if (sync && s.ping !== undefined)
        status.textContent = `온라인 대전 · ${connection.identity.role + 1}P · ${s.peerPing ? "상대 핑" : "서버 핑"} ${Math.round(s.ping)}ms · ${s.mode === "direct" ? "직접 연결" : "서버 중계"} · 입력 지연 ${Math.round(sync.delay * FRAME_MS)}ms`;
    },
  });
  connection.command({
    type: "matchmake",
    build: build.id,
    character: Number(runtime.globals.get("y75t")),
    map: 6,
    skill: runtime.secondarySkills.choice(1),
  });
}
document.getElementById("play-offline").onclick = () => {
  onlineMode = false;
  runtime.loadScene("ub0s");
  sceneUI();
};
document.getElementById("play-online").onclick = () => {
  stopOnline();
  onlineMode = true;
  runtime.globals.set("rks6", 0);
  runtime.loadScene("1ckl");
  status.textContent =
    "캐릭터를 고르면 자동으로 상대를 찾아요. 같은 캐릭터끼리도 대전할 수 있어요.";
  sceneUI();
};
document.getElementById("how-to").onclick = () => {
  runtime.loadScene("1323");
  sceneUI();
};
document.getElementById("cancel-match").onclick = home;
function position(event) {
  const b = canvas.getBoundingClientRect();
  return [
    ((event.clientX - b.left) / b.width) * 480 - 240,
    135 - ((event.clientY - b.top) / b.height) * 270,
  ];
}
canvas.addEventListener("pointermove", (event) => {
  // The mouse is local to each player; in an online match it stays pinned
  // off-screen on both clients so mouse checks can't desync the simulation.
  if (runtime && !sync) {
    const [x, y] = position(event);
    Object.assign(runtime.mouse, { x, y });
  }
});
canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  canvas.focus();
  if (ready && runtime && !searching && !sync) {
    runtime.click(...position(event));
    runtime.mouseRelease = null;
    canvas.setPointerCapture(event.pointerId);
  }
});
window.addEventListener("pointerup", () => {
  if (runtime) {
    runtime.mouseRelease = runtime.tick + 2;
  }
});
// Online: the local player may use either the 1P (A/D/W, E/R/S) or the 2P
// (arrows, O/P/↓) key set, whichever side the match assigns them.
const heldOnline = new Set();
function onlineBit(code) {
  const bit = KEYS[0].indexOf(code);
  return bit >= 0 ? bit : KEYS[1].indexOf(code);
}
function onlineMask() {
  let mask = 0;
  for (const code of heldOnline) {
    const bit = onlineBit(code);
    if (bit >= 0) mask |= 1 << bit;
  }
  return mask;
}
// A page button keeps focus after it is clicked, and Enter / Space would then
// "click" it again instead of reaching the game (2P's Enter skill). Drop the
// focus after every button click, and never let game keys activate a button.
document.addEventListener("click", (event) => {
  if (event.target.closest?.("button")) event.target.closest("button").blur();
});
const GAME_KEYS = new Set([...KEYS.flat(), 32]);
window.addEventListener("keydown", (event) => {
  const onButton = event.target.tagName === "BUTTON";
  if (onButton && GAME_KEYS.has(event.keyCode) && ready && runtime)
    event.preventDefault();
  else if (onButton) return;
  if (!ready || !runtime || searching || forfeitWin || postMatch) return;
  if (runtime.scene === "1ckl" && [82, 80].includes(event.keyCode)) {
    event.preventDefault();
    if (!event.repeat) runtime.secondarySkills.selectKey(event.keyCode, onlineMode ? 1 : null);
    sceneUI();
    return;
  }
  if (sync) {
    if (onlineBit(event.keyCode) >= 0) {
      event.preventDefault();
      heldOnline.add(event.keyCode);
      sync.mask = onlineMask();
    }
    return;
  }
  if ([32, 37, 38, 39, 40].includes(event.keyCode)) event.preventDefault();
  if (!runtime.keys.has(event.keyCode)) {
    runtime.keys.add(event.keyCode);
    for (const e of runtime.entities)
      runtime.dispatchEntity(e, "when_keypress", String(event.keyCode));
  }
});
window.addEventListener("keyup", (event) => {
  runtime?.keys.delete(event.keyCode);
  heldOnline.delete(event.keyCode);
  if (sync) sync.mask = onlineMask();
});
window.addEventListener("blur", () => {
  runtime?.keys.clear();
  heldOnline.clear();
  if (sync) sync.mask = 0;
  if (runtime) runtime.mouse.down = false;
});
document.getElementById("restart").onclick = home;
document.getElementById("sound").onclick = (event) => {
  if (runtime) {
    runtime.muted = !runtime.muted;
    if (runtime.muted) for (const a of runtime.playing || []) a.pause();
    event.target.textContent = runtime.muted ? "소리 꺼짐" : "소리 켜짐";
  }
};
document.getElementById("fullscreen").onclick = () =>
  canvas.requestFullscreen();
function update(now) {
  if (!last) last = now;
  // Keep real elapsed time when drawing is suspended; dropping it extended timed skills.
  elapsed += Math.max(0, now - last);
  last = now;
  let onlineSteps = 0;
  while (elapsed + 1e-7 >= 1000 / 60) {
    if (sync && onlineSteps++ >= 8) break;
    if (sync) {
      // The original sets 게임 끝 (r71b) when a fighter falls. Both clients
      // reach that frame identically, so lockstep can end here: the ending
      // plays locally and 뒤로가기 works right away (no forfeit / timeout).
      if (Number(runtime.globals.get("r71b")) === 1) {
        endMatch();
        continue;
      }
      if (!sync.advance(runtime)) {
        // Keep the elapsed backlog until shared input arrives. Never advance
        // one client's skill timers independently of the other client.
        break;
      }
      lastProgress = now;
      if (runtime.tick % 120 === 0)
        connection.gameplay({
          type: "checksum",
          frame: runtime.tick,
          hash: sync.checkpoint(runtime),
        });
    } else if (!searching) {
      if (forfeitWin) runtime.globals.set(forfeitHp, -1);
      runtime.step();
      if (
        onlineMode &&
        runtime.scene === "1ckl" &&
        Number(runtime.globals.get("jx38")) === 2
      )
        search();
    }
    elapsed = Math.max(0, elapsed - 1000 / 60);
  }
  const stalled = sync ? now - lastProgress : 0;
  if (sync && stalled > 600) {
    if (stalled < FORFEIT_AFTER)
      showNet(
        "연결 대기 중",
        `상대 연결을 기다리고 있어요… ${Math.ceil((FORFEIT_AFTER - stalled) / 1000)}초`,
      );
    else if (stalled < FORFEIT_AFTER + 10000)
      showNet("연결 확인 중", "서버에서 승패를 확인하고 있어요…");
    else showNet("연결 확인 중", "인터넷 연결을 확인해 주세요…");
    if (now - lastRequest > 1500) {
      lastRequest = now;
      connection.gameplay({ type: "sync", from: runtime.tick + 1 });
    }
    // Ask the server to referee; it only accepts the first claim.
    if (stalled > FORFEIT_AFTER && !claimSent) {
      claimSent = true;
      connection.command({ type: "claim", epoch });
    }
  } else if (sync && !netOverlay.hidden) hideNet();
}
function frame(now) {
  // Keep the loop alive even if one frame throws (e.g. a network error).
  requestAnimationFrame(frame);
  try {
    update(now);
  } catch (error) {
    console.error(error);
  }
  sceneUI();
  renderer.draw(runtime);
}
// Browsers pause requestAnimationFrame while the tab is hidden or the window
// is minimised. Continue both offline and online battles in a worker-driven
// loop. Any suspended worker time is caught up on resume, before drawing.
try {
  const ticker = new Worker(
    URL.createObjectURL(
      new Blob(["setInterval(() => postMessage(0), 16);"], {
        type: "text/javascript",
      }),
    ),
  );
  ticker.onmessage = () => {
    if (document.hidden && runtime && (sync || runtime.scene === "7dwq"))
      try {
        update(performance.now());
      } catch (error) {
        console.error(error);
      }
  };
} catch {}

const loading = document.getElementById("loading"),
  loadingFill = document.getElementById("loading-fill"),
  loadingLabel = document.getElementById("loading-label"),
  loadingPercent = document.getElementById("loading-percent");
function showProgress(ratio) {
  const percent = Math.floor(ratio * 100);
  loadingFill.style.width = percent + "%";
  loadingPercent.textContent = percent + "%";
}

try {
  const response = await fetch("data/project.json");
  if (!response.ok) throw Error("원본 자료 불러오기 실패");
  const project = await response.json();
  // Character descriptions (select screen hover): keep the original wording,
  // only correct numbers that no longer match the balance-patched code.
  const DESCRIPTION_FIXES = [
    // [list id, character no., from, to]
    ["dw8v", 33, "6의 피해", "7의 피해"], // 성 미카엘 패시브: 기절 추가 피해 7
    ["gsve", 12, "5초간 둔화", "6초간 둔화"], // 뉴크 스킬: 접착 360프레임
    ["9m7u", 12, "보호막 20", "보호막 15"], // 뉴크 궁극기: 방어력 15
  ];
  for (const [id, no, from, to] of DESCRIPTION_FIXES) {
    const item = project.variables.find((v) => v.id === id)?.array?.[no - 1];
    if (item && String(item.data).includes(from))
      item.data = String(item.data).replace(from, to);
  }
  // Display-only: every original text box uses the game's main font
  // (the few SDCinemaTheater ones were the odd ones out).
  for (const o of project.objects)
    if (o.entity?.font)
      o.entity.font = o.entity.font.replace("SDCinemaTheater", "SDComicStencil");
  build = await (await fetch("data/build.json")).json();
  // Fonts are optional: never let a slow/blocked font CDN hold the game.
  const fonts = Promise.race([
    Promise.all([
      document.fonts.load("20px SDComicStencil"),
      document.fonts.load("20px SDCinemaTheater"),
    ]).catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
  // 1) Only the original main screen's pictures, so the real title screen
  //    can be shown as the loading background right away.
  const mainObjects = project.objects.filter((o) => o.scene === "qc29");
  await assets.preload(mainObjects);
  await fonts;
  runtime = new Runtime(project, {
    assets,
    onFault: (f) => {
      status.textContent = "원본 실행 오류: " + f.error;
      console.error(f);
    },
  });
  runtime.originalUI = true;
  runtime.beforeScene = (id) => {
    // After an online match (normal end or forfeit) 뒤로가기 returns home.
    if (postMatch || forfeitWin) {
      setTimeout(home);
      return false;
    }
    if (sync) {
      status.textContent =
        "대전 종료 · 처음부터 버튼으로 다시 플레이할 수 있어요.";
      runtime.running = false;
      return false;
    }
    if (onlineMode && ["s27s", "7dwq"].includes(id)) {
      search();
      return false;
    }
    return true;
  };
  registerOriginal(runtime);
  runtime.startProject();
  status.textContent = "";
  requestAnimationFrame(frame);
  loading.classList.add("ready");
  // 2) Everything else, while the original main screen is already playing.
  const failures = await assets.preload(project.objects, (done, total, failed) => {
    showProgress(done / total);
    status.textContent =
      `원본 이미지 ${done} / ${total}` + (failed ? ` (실패 ${failed})` : "");
  });
  if (failures.length) console.warn("불러오지 못한 이미지", failures);
  status.textContent = failures.length
    ? `그림 ${failures.length}개를 불러오지 못했어요. 새로고침하면 다시 시도해요.`
    : "";
  ready = true;
  loading.classList.add("done");
} catch (error) {
  status.textContent = "불러오기 실패: " + error;
  loading.classList.add("error");
  loadingLabel.textContent = "불러오기 실패 · 새로고침해 주세요";
  console.error(error);
}
