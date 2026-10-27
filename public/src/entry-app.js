import { Assets } from "./assets.js";
import { Renderer } from "./renderer.js";
import { Runtime } from "./runtime.js";
import { registerOriginal } from "./original-program.js";
import { OnlineConnection } from "./online.js";
import { FrameSync, KEYS } from "./frame-sync.js";
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
  connection?.close();
  connection = null;
  sync = null;
  epoch = null;
  searching = false;
  panel.hidden = true;
}
function home() {
  stopOnline();
  onlineMode = false;
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
      if (room.phase === "playing" && room.match?.epoch !== epoch) {
        const match = room.match;
        epoch = match.epoch;
        searching = false;
        panel.hidden = true;
        runtime.start(match);
        runtime.originalUI = true;
        sync = new FrameSync(connection.identity.role, {
          delay: match.delay,
          onSend: (frames) => connection.input(frames),
          onFault: (text) => {
            runtime.paused = true;
            status.textContent = text;
          },
        });
        elapsed = 0;
        lastProgress = performance.now();
        connection.gameplay({ type: "sync", from: 1 });
        status.textContent = `온라인 대전 · ${connection.identity.role + 1}P · A/D·←/→ 이동, W·↑ 점프, E/R/S·O/P/↓ 공격`;
      } else if (sync && room.players.some((p) => !p?.connected)) {
        status.textContent = "상대 연결을 기다리고 있어요…";
      }
    },
    onGameplay: (msg) => {
      if (!sync) return;
      if (msg.type === "input") sync.receive(msg.role, msg.frames);
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
      if (sync && s.ping !== undefined)
        status.textContent = `온라인 대전 · ${connection.identity.role + 1}P · ${Math.round(s.ping)}ms`;
    },
  });
  connection.command({
    type: "matchmake",
    build: build.id,
    character: Number(runtime.globals.get("y75t")),
    map: 6,
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
  if (runtime) {
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
window.addEventListener("keydown", (event) => {
  if (!ready || !runtime || event.target.tagName === "BUTTON" || searching) return;
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
function frame(now) {
  if (!last) last = now;
  elapsed += Math.min(now - last, 100);
  last = now;
  while (elapsed >= 1000 / 60) {
    if (sync) {
      if (!sync.advance(runtime)) {
        elapsed = 0;
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
      runtime.step();
      if (
        onlineMode &&
        runtime.scene === "1ckl" &&
        Number(runtime.globals.get("jx38")) === 2
      )
        search();
    }
    elapsed -= 1000 / 60;
  }
  if (sync && now - lastProgress > 800) {
    status.textContent = "상대 연결을 기다리고 있어요…";
    if (now - lastRequest > 1500) {
      lastRequest = now;
      connection.gameplay({ type: "sync", from: runtime.tick + 1 });
    }
  }
  sceneUI();
  renderer.draw(runtime);
  requestAnimationFrame(frame);
}

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
  // Display-only: HP damage/heal pop-up numbers use the game's main font.
  for (const o of project.objects)
    if (["5c3y", "w3fb"].includes(o.id) && o.entity?.font)
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
