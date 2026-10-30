import { Assets } from "./assets.js";
import { Renderer } from "./renderer.js";
import { Runtime } from "./runtime.js";
import { registerOriginal } from "./original-program.js";
import { OnlineConnection } from "./online.js";
import { FrameSync, KEYS } from "./frame-sync.js";
const $ = (id) => document.getElementById(id),
  stepMs = 1000 / 60;
let runtime = null,
  renderer,
  assets = new Assets(),
  characters,
  project,
  build,
  active = 1,
  picks = [1, 2],
  muted = false,
  last = 0,
  accumulator = 0,
  ending = false,
  loaded = false,
  onlineMode = false,
  online = null,
  sync = null,
  lastEpoch = null,
  ownCharacter = 1,
  lastReady = false,
  lastProgress = 0,
  lastSyncRequest = 0,
  restoringRoom = false;
const pauseOwners = new Set();
function notice(text) {
  $("online-status").textContent = text;
}
function detail() {
  const ch = characters[picks[active - 1] - 1];
  $("skills").replaceChildren(
    ...["attack", "skill", "ultimate"].map((key, i) => {
      const el = document.createElement("div"),
        title = document.createElement("b");
      title.textContent = ch.name + " · " + ["기본 공격", "스킬", "궁극기"][i];
      el.append(title, document.createTextNode(ch[key]));
      return el;
    }),
  );
}
function roster() {
  if (!characters) return;
  for (const el of $("roster").children) {
    const n = Number(el.dataset.id),
      side = onlineMode
        ? n === ownCharacter
          ? active - 1
          : -1
        : picks.indexOf(n);
    el.classList.toggle("chosen1", side === 0);
    el.classList.toggle("chosen2", side === 1);
    el.querySelector(".tag").textContent = side < 0 ? "" : `${side + 1}P`;
    el.setAttribute("aria-pressed", String(side >= 0));
  }
  for (let i = 0; i < 2; i++)
    $("p" + (i + 1) + "name").textContent =
      onlineMode && i !== active - 1
        ? "친구 · 대전 시작 시 공개"
        : characters[picks[i] - 1].name;
  $("choose1").classList.toggle("active", active === 1);
  $("choose2").classList.toggle("active", active === 2);
  $("choose1").hidden = $("choose2").hidden = onlineMode;
  detail();
}
function select(n) {
  if (sync) return;
  if (onlineMode) {
    ownCharacter = n;
    picks[active - 1] = n;
    lastReady = false;
    online?.command({ type: "pick", character: n });
    rememberRoom();
    roster();
    return;
  }
  if (picks[2 - active] === n) {
    $("loading").textContent =
      "상대가 고른 캐릭터예요. 다른 캐릭터를 선택해 주세요.";
    return;
  }
  picks[active - 1] = n;
  if (active === 1) active = 2;
  roster();
}
function overlay(text) {
  $("overlay").textContent = text;
  $("overlay").hidden = !text;
}
function silence() {
  if (runtime)
    runtime.command({ e: runtime.entities[0] }, "sound_silent_all", []);
}
function disposeBattle() {
  silence();
  runtime = null;
  sync = null;
  pauseOwners.clear();
  lastEpoch = null;
  $("battle").hidden = true;
  $("selection").hidden = false;
  overlay("");
}
function start(options = null) {
  silence();
  ending = false;
  pauseOwners.clear();
  runtime = new Runtime(project, {
    assets,
    onFault: () => {
      runtime.paused = true;
      overlay("실행 오류 · 실행 상태를 확인해 주세요.");
      if (sync) online.gameplay({ type: "pause", paused: true });
    },
    onExit: () => {
      ending = true;
      overlay("대전 종료");
    },
  });
  registerOriginal(runtime);
  runtime.muted = muted;
  runtime.start(
    options || { p1: picks[0], p2: picks[1], map: Number($("map").value) },
  );
  $("selection").hidden = true;
  $("battle").hidden = false;
  const ids = options ? [options.p1, options.p2] : picks;
  $("match-title").textContent =
    characters[ids[0] - 1].name + "  vs  " + characters[ids[1] - 1].name;
  $("pause").textContent = "일시정지";
  $("pause").disabled = false;
  $("restart").textContent = options ? "다시 준비" : "다시 대전";
  $("battle").querySelector(".eyebrow").textContent = options
    ? "ONLINE VERSUS · " + (online.identity.role + 1) + "P"
    : "LOCAL VERSUS";
  if (options) {
    sync = new FrameSync(online.identity.role, {
      delay: options.delay,
      onSend: (frames) => online.input(frames),
      onFault: (message) => {
        runtime.paused = true;
        overlay(message);
        online.gameplay({ type: "pause", paused: true });
      },
    });
    lastEpoch = options.epoch;
    lastProgress = performance.now();
    online.gameplay({ type: "sync", from: 1 });
  } else sync = null;
  overlay("");
  accumulator = 0;
  last = performance.now();
  $("stage").focus();
}
function updatePause() {
  if (!runtime) return;
  runtime.paused = pauseOwners.size > 0;
  const own = online?.identity?.role;
  $("pause").disabled = !!sync && pauseOwners.size > 0 && !pauseOwners.has(own);
  $("pause").textContent = runtime.paused
    ? sync && !pauseOwners.has(own)
      ? "친구가 일시정지"
      : "계속하기"
    : "일시정지";
  overlay(runtime.paused ? "일시정지" : "");
}
function pause() {
  if (!runtime || ending) return;
  if (sync) {
    const role = online.identity.role,
      paused = !pauseOwners.has(role);
    if (paused) pauseOwners.add(role);
    else pauseOwners.delete(role);
    sync.mask = 0;
    online.gameplay({ type: "pause", paused });
    updatePause();
  } else {
    runtime.paused = !runtime.paused;
    runtime.keys.clear();
    $("pause").textContent = runtime.paused ? "계속하기" : "일시정지";
    overlay(runtime.paused ? "일시정지" : "");
  }
}
function updateRoom(room) {
  if (room.phase === "lobby") restoringRoom = false;
  $("room-entry").hidden = true;
  $("room-lobby").hidden = false;
  $("room-code").textContent = room.code;
  $("map").value = String(room.map);
  $("map").disabled = online.identity.role !== 0 || room.phase === "playing";
  $("room-players").textContent = room.players
    .map(
      (p, i) =>
        `${i + 1}P ${!p ? "입장 대기" : p.ready ? "준비 완료" : p.connected ? "캐릭터 선택 중" : "연결 대기"}`,
    )
    .join("  /  ");
  lastReady = !!room.players[online.identity.role]?.ready;
  $("ready-room").textContent = lastReady ? "준비 취소" : "준비 완료";
  $("ready-room").disabled =
    !loaded || !room.players[1] || room.phase !== "lobby";
  if (
    room.phase === "playing" &&
    !restoringRoom &&
    room.match?.epoch !== lastEpoch
  )
    start(room.match);
  else if (room.phase === "lobby" && sync) {
    disposeBattle();
    notice("다시 캐릭터를 고르고 준비해 주세요.");
    roster();
  }
}
function rememberRoom() {
  if (!online?.identity) return;
  try {
    sessionStorage.setItem(
      "bounce-online-room",
      JSON.stringify({
        ...online.identity,
        build: build.id,
        character: ownCharacter,
      }),
    );
  } catch {}
}
function forgetRoom() {
  try {
    sessionStorage.removeItem("bounce-online-room");
  } catch {}
}
function newOnline() {
  online?.close();
  lastEpoch = null;
  online = new OnlineConnection({
    onJoined: ({ role, code }) => {
      active = role + 1;
      picks[role] = ownCharacter;
      rememberRoom();
      roster();
      notice(`방 ${code} · 두 사람 모두 준비하면 대전이 시작돼요.`);
      $("create-room").disabled = $("join-room").disabled = false;
    },
    onRoom: updateRoom,
    onNotice: notice,
    onError: (message) => {
      notice(message);
      $("create-room").disabled = $("join-room").disabled = false;
    },
    onStatus: (status) => {
      const text = status.connected
        ? status.mode === "direct"
          ? "친구와 직접 연결"
          : "서버 중계"
        : "다시 연결 중";
      $("network-status").textContent =
        text + (status.ping !== undefined ? ` · ${status.ping}ms` : "");
    },
    onReconnect: () => {
      if (sync) online.gameplay({ type: "sync", from: runtime.tick + 1 });
    },
    onGameplay: (msg) => {
      if (!sync) return;
      if (msg.type === "input") sync.receive(msg.role, msg.frames);
      else if (msg.type === "checksum") sync.checksum(msg.frame, msg.hash);
      else if (msg.type === "sync") online.replay(sync.replay(msg.from));
      else if (msg.type === "pause") {
        if (msg.paused) pauseOwners.add(msg.role);
        else pauseOwners.delete(msg.role);
        updatePause();
      }
    },
  });
  return online;
}
function mode(enabled) {
  if (sync) return;
  if (!enabled) {
    forgetRoom();
    online?.close();
    online = null;
    active = 1;
    $("room-entry").hidden = false;
    $("room-lobby").hidden = true;
    $("map").disabled = false;
  }
  $("online-panel").hidden = !enabled;
  $("start").hidden = enabled;
  onlineMode = enabled;
  $("local-mode").classList.toggle("active", !enabled);
  $("online-mode").classList.toggle("active", enabled);
  roster();
}
function frame(now) {
  const delta = Math.min(250, now - last);
  last = now;
  if (runtime && !$("battle").hidden) {
    if (!runtime.paused && runtime.running) {
      accumulator += delta;
      let count = 0;
      while (accumulator >= stepMs && count++ < 8) {
        if (sync) {
          if (!sync.advance(runtime)) {
            accumulator = Math.min(accumulator, stepMs);
            break;
          }
          lastProgress = now;
          if (runtime.tick % 120 === 0)
            online.gameplay({
              type: "checksum",
              frame: runtime.tick,
              hash: sync.checkpoint(runtime),
            });
        } else runtime.step();
        accumulator -= stepMs;
      }
      if (count >= 8) accumulator = 0;
      if (sync && !sync.failed && !runtime.paused) {
        if (now - lastProgress > 800) {
          overlay("친구의 연결을 기다리고 있어요…");
          if (now - lastSyncRequest > 1500) {
            lastSyncRequest = now;
            online.gameplay({ type: "sync", from: runtime.tick + 1 });
          }
        } else overlay("");
      }
    }
    renderer.draw(runtime);
    if (runtime.tick % 12 === 0 || runtime.faults.length) {
      const s = runtime.snapshot();
      $("battle-status").textContent =
        `HP ${Math.max(0, Math.ceil(s.hp[0]))} : ${Math.max(0, Math.ceil(s.hp[1]))}`;
      $("diagnostics").textContent = JSON.stringify(
        {
          ...s,
          loadedImages: assets.cache.size,
          online: !!sync,
          inputDelay: sync?.delay,
          verifiedFrame: sync?.lastVerifiedFrame,
          role: online?.identity?.role,
        },
        null,
        2,
      );
    }
  }
  requestAnimationFrame(frame);
}
const controlled = new Set(KEYS.flat());
function bitFor(code) {
  return (
    [KEYS[0].indexOf(code), KEYS[1].indexOf(code)].find((i) => i >= 0) ?? -1
  );
}
window.addEventListener("keydown", (event) => {
  if (
    !runtime ||
    $("battle").hidden ||
    ["INPUT", "SELECT", "BUTTON"].includes(event.target.tagName)
  )
    return;
  if (event.code === "Escape") {
    event.preventDefault();
    if (!event.repeat) pause();
    return;
  }
  if (controlled.has(event.keyCode)) {
    event.preventDefault();
    if (!runtime.paused) {
      if (sync) {
        const bit = bitFor(event.keyCode);
        if (bit >= 0) sync.mask |= 1 << bit;
      } else runtime.keys.add(event.keyCode);
    }
  }
});
window.addEventListener("keyup", (event) => {
  if (sync) {
    const bit = bitFor(event.keyCode);
    if (bit >= 0) sync.mask &= ~(1 << bit);
  } else runtime?.keys.delete(event.keyCode);
});
function loseFocus() {
  runtime?.keys.clear();
  if (sync) sync.mask = 0;
  else if (runtime && !runtime.paused && !$("battle").hidden) pause();
}
window.addEventListener("blur", loseFocus);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    loseFocus();
    if (sync && runtime && !pauseOwners.has(online.identity.role) && !ending)
      pause();
  }
});
$("stage").addEventListener("pointermove", (event) => {
  if (!runtime || sync) return;
  const b = $("stage").getBoundingClientRect();
  runtime.mouse.x = ((event.clientX - b.left) / b.width) * 480 - 240;
  runtime.mouse.y = 135 - ((event.clientY - b.top) / b.height) * 270;
});
$("stage").addEventListener("pointerdown", () => {
  if (runtime && !sync) runtime.mouse.down = true;
  $("stage").focus();
});
window.addEventListener("pointerup", () => {
  if (runtime) runtime.mouse.down = false;
});
$("choose1").onclick = () => {
  active = 1;
  roster();
};
$("choose2").onclick = () => {
  active = 2;
  roster();
};
$("start").onclick = () => start();
$("restart").onclick = () => {
  if (sync) online.command({ type: "rematch" });
  else start();
};
$("pause").onclick = pause;
$("back").onclick = () => {
  if (sync) {
    forgetRoom();
    online?.close();
    online = null;
    $("room-entry").hidden = false;
    $("room-lobby").hidden = true;
    notice("방에서 나왔어요. 새 방을 만들거나 다른 방에 입장해 주세요.");
  }
  disposeBattle();
  $("map").disabled = false;
  roster();
};
$("sound").onclick = () => {
  muted = !muted;
  if (runtime) {
    runtime.muted = muted;
    if (muted) silence();
  }
  $("sound").textContent = muted ? "소리 꺼짐" : "소리 켜짐";
  $("sound").setAttribute("aria-pressed", String(!muted));
};
$("fullscreen").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else
      await (
        $("battle").hidden ? document.documentElement : $("battle")
      ).requestFullscreen();
  } catch {}
};
$("local-mode").onclick = () => mode(false);
$("online-mode").onclick = () => mode(true);
$("create-room").onclick = () => {
  if (!loaded) return;
  $("create-room").disabled = true;
  forgetRoom();
  newOnline().create(build.id, ownCharacter, Number($("map").value));
  notice("방을 만들고 있어요…");
};
$("join-room").onclick = () => {
  if (!loaded) return;
  const code = $("join-code").value.trim().toUpperCase();
  if (!/^[A-F0-9]{8}$/.test(code)) {
    notice("8자리 방 코드를 입력해 주세요.");
    return;
  }
  $("join-room").disabled = true;
  forgetRoom();
  newOnline().join(build.id, code, ownCharacter);
  notice("친구의 방에 입장하고 있어요…");
};
$("ready-room").onclick = () =>
  online?.command({ type: "ready", ready: !lastReady });
$("leave-room").onclick = () => {
  forgetRoom();
  online?.close();
  online = null;
  $("room-entry").hidden = false;
  $("room-lobby").hidden = true;
  $("map").disabled = false;
  notice("방에서 나왔어요.");
};
$("copy-room").onclick = async () => {
  if (!online?.identity) return;
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("room", online.identity.code);
  try {
    await navigator.clipboard.writeText(url.href);
    notice("초대 링크를 복사했어요. 친구에게 보내 주세요.");
  } catch {
    notice("방 코드를 친구에게 알려주세요: " + online.identity.code);
  }
};
$("map").onchange = () => {
  if (online?.identity)
    online.command({ type: "map", map: Number($("map").value) });
};
try {
  [project, characters, build] = await Promise.all(
    ["project", "characters", "build"].map(async (name) => {
      const res = await fetch(`data/${name}.json`);
      if (!res.ok) throw Error(`자료 불러오기 실패: ${name}`);
      return res.json();
    }),
  );
  for (const ch of characters) {
    const button = document.createElement("button");
    button.className = "fighter";
    button.dataset.id = ch.id;
    button.setAttribute("aria-label", ch.name + " 선택");
    const tag = document.createElement("span");
    tag.className = "tag";
    const img = document.createElement("img");
    img.src = ch.portrait;
    img.alt = "";
    button.append(tag, img, document.createTextNode(ch.name));
    button.onclick = () => select(ch.id);
    $("roster").append(button);
  }
  roster();
  renderer = new Renderer($("stage"), assets);
  const invite = new URL(location.href).searchParams.get("room");
  if (invite) {
    $("join-code").value = invite.toUpperCase().slice(0, 8);
    mode(true);
  }
  await assets.preload(
    project.objects.filter((o) => o.scene === "7dwq"),
    (done, total) => {
      $("loading").textContent =
        `원작 이미지 준비 ${Math.floor((done / total) * 100)}%`;
      if (!assets.failures.length)
        $("diagnostics").textContent = `이미지 ${done} / ${total}`;
    },
  );
  loaded = true;
  $("start").disabled =
    $("create-room").disabled =
    $("join-room").disabled =
      false;
  $("start").textContent = "대전 시작 →";
  $("loading").textContent = "준비 완료 · 로컬 또는 온라인 대전";
  $("diagnostics").textContent = JSON.stringify(
    {
      characters: characters.length,
      loadedImages: assets.cache.size,
      assetErrors: assets.failures,
      build: build.id,
    },
    null,
    2,
  );
  let saved = null;
  try {
    saved = JSON.parse(sessionStorage.getItem("bounce-online-room"));
  } catch {}
  if (
    saved &&
    Number.isInteger(saved.character) &&
    saved.character >= 1 &&
    saved.character <= 35 &&
    [0, 1].includes(saved.role) &&
    /^[A-F0-9]{8}$/.test(saved.code) &&
    typeof saved.token === "string" &&
    saved.token.length === 48 &&
    saved.build === build.id &&
    (!invite || saved.code === invite.toUpperCase())
  ) {
    ownCharacter = saved.character;
    active = saved.role + 1;
    picks[saved.role] = ownCharacter;
    mode(true);
    restoringRoom = true;
    newOnline().identity = {
      code: saved.code,
      role: saved.role,
      token: saved.token,
    };
    online.command({ type: "rematch" });
    notice("이전 방에 다시 연결하고 있어요. 새로 준비하면 대전할 수 있어요.");
  }
  requestAnimationFrame(frame);
} catch (error) {
  $("loading").textContent =
    "불러오지 못했어요. 새로고침 후 다시 시도해 주세요.";
  $("diagnostics").textContent = String(error);
  console.error(error);
}
