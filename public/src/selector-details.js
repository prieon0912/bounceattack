const ABILITIES = [
  ["na6g", "87lp"],
  ["io23", "9f3u", "pyez"],
  ["c72k", "3my6", "o9rj"],
  ["7ia7", "m9p6", "4ffm"],
];
const ULTIMATE_NOTES = ["imlv", "xnkl"];
export const SELECTOR_OVERLAY = new Set([
  "68f9", "1t4x", "ysyj", ...ABILITIES.flat(), ...ULTIMATE_NOTES,
]);

export function showsSelectorDetails(runtime) {
  return runtime.scene === "1ckl" && Number(runtime.globals.get("yraj")) === 1;
}

function wrap(context, text, width) {
  const lines = [];
  let line = "";
  for (const word of text.trim().split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && context.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export function drawSelectorDetails(context, runtime, assets) {
  const entity = id => runtime.originals.get(id);
  const read = id => String(entity(id)?.text ?? "");
  const character = Number(runtime.globals.get("16fh"));
  const side = runtime.secondarySkills.selectionSide();
  const canSwitch = side && runtime.secondarySkills.definitions.has(character);
  const notes = ULTIMATE_NOTES.filter(id => entity(id)?.visible).map(read).join(" ");

  context.save();
  context.textBaseline = "top";
  context.beginPath();
  context.roundRect(-214, -126, 189, 90, 6);
  context.roundRect(25, -126, 189, 90, 6);
  context.fillStyle = "#fff";
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = "#6d7df7";
  context.stroke();

  context.fillStyle = "#292f65";
  context.font = "16px SDComicStencil, sans-serif";
  context.fillText(read("1t4x"), -204, -121, 169);
  context.font = "bold 8px system-ui, sans-serif";
  context.fillStyle = "#4b56a9";
  context.fillText(read("ysyj"), 35, -117, canSwitch ? 95 : 169);
  if (canSwitch) {
    context.textAlign = "right";
    context.fillText(`${side === 1 ? "R" : "P"} 키로 스킬 바꾸기`, 204, -117, 71);
    context.textAlign = "left";
  }

  for (const [index, [title, detail, icon]] of ABILITIES.entries()) {
    const x = index % 2 ? 35 : -204;
    const y = index < 2 ? -102 : -73;
    const maxLines = index < 2 ? 2 : 3;
    const art = icon && assets.get(entity(icon)?.picture);
    if (art) context.drawImage(art.image, x, y + 1, 17, 17);
    const left = x + (art ? 21 : 0);
    const width = 169 - (left - x);
    context.font = "bold 8.5px system-ui, sans-serif";
    context.fillStyle = "#3f51c3";
    context.fillText(read(title), left, y, width);
    context.fillStyle = "#282d48";
    let size = 8;
    const description = index === 3 && notes ? `${read(detail)} ${notes}` : read(detail);
    context.font = `${size}px system-ui, sans-serif`;
    let lines = wrap(context, description, width);
    while (lines.length > maxLines && size > 6) {
      size -= .4;
      context.font = `${size}px system-ui, sans-serif`;
      lines = wrap(context, description, width);
    }
    lines.forEach((line, i) => context.fillText(line, left, y + 10 + i * (size - .3), width));
  }
  context.restore();
}
