export class Renderer {
  constructor(canvas, assets) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.assets = assets;
    const ratio = Math.min(2, devicePixelRatio || 1);
    canvas.width = 960 * ratio;
    canvas.height = 540 * ratio;
  }
  draw(runtime) {
    const c = this.ctx,
      s = this.canvas.width / 480;
    c.setTransform(s, 0, 0, s, 240 * s, 135 * s);
    c.fillStyle = "#09151e";
    c.fillRect(-240, -135, 480, 270);
    c.save();
    c.beginPath();
    c.rect(-240, -135, 480, 270);
    c.clip();
    for (const e of runtime.entities.slice().reverse()) {
      if (e.dead || runtime.secondarySkills.hidden(e) || runtime.castle.hidden(e)) continue;
      // Entry's brush has flat (butt) ends; round caps made the HP/MP bars
      // poke out of the slanted (trapezoid) frame. Consecutive segments with
      // the same style are stroked as one polyline so corners stay joined.
      const paths = e.pen?.paths || [];
      for (let i = 0; i < paths.length; ) {
        const p = paths[i];
        c.save();
        c.globalAlpha = p.alpha;
        c.strokeStyle = p.color;
        c.lineWidth = p.width;
        c.lineCap = "butt";
        c.lineJoin = "miter";
        c.beginPath();
        c.moveTo(p.x1, -p.y1);
        c.lineTo(p.x2, -p.y2);
        let last = p;
        for (i++; i < paths.length; i++) {
          const q = paths[i];
          if (
            q.x1 !== last.x2 ||
            q.y1 !== last.y2 ||
            q.color !== p.color ||
            q.width !== p.width ||
            q.alpha !== p.alpha
          )
            break;
          c.lineTo(q.x2, -q.y2);
          last = q;
        }
        c.stroke();
        c.restore();
      }
      if (!e.visible) continue;
      c.save();
      c.translate(e.x, -e.y);
      c.rotate((e.rotation * Math.PI) / 180);
      c.scale(e.scaleX, e.scaleY);
      c.globalAlpha = Math.max(
        0,
        Math.min(1, 1 - (e.effects.transparency || 0) / 100),
      );
      const filters = [];
      if (e.effects.brightness)
        filters.push(`brightness(${Math.max(0, 100 + e.effects.brightness)}%)`);
      if (e.effects.color)
        filters.push(`hue-rotate(${e.effects.color * 3.6}deg)`);
      c.filter = filters.join(" ") || "none";
      if (e.def.objectType === "textBox") {
        c.font = e.font || "20px sans-serif";
        c.textBaseline = "middle";
        c.textAlign = ["center", "left", "right"][e.textAlign ?? 0] || "center";
        c.fillStyle = e.colour || "#fff";
        const text = String(e.text ?? e.def.text ?? "");
        if (!e.lineBreak && e.objectId === "3my6" && runtime.scene === "1ckl" &&
            [1, 3, 4, 6, 7, 10, 12, 14, 16, 18, 20, 27, 30, 32, 35].includes(Number(runtime.globals.get("16fh")))) {
          // Fit the changed descriptions inside their original slot, with no new UI.
          const limit = (230 - e.x) / Math.max(.01, Math.abs(e.scaleX));
          const lines = []; let line = "";
          for (const char of text) {
            if (line && c.measureText(line + char).width > limit) { lines.push(line); line = ""; }
            line += char;
          }
          lines.push(line);
          lines.forEach((value, i) => c.fillText(value, 0, i * ((parseFloat(e.font) || 20) + 2)));
        } else if (!e.lineBreak) c.fillText(text, 0, 0);
        else {
          const lines = [];
          for (const paragraph of text.split("\n")) {
            let line = "";
            for (const char of paragraph) {
              if (line && c.measureText(line + char).width > e.width) {
                lines.push(line);
                line = "";
              }
              line += char;
            }
            lines.push(line);
          }
          const height = (parseFloat(e.font) || 20) + 2;
          const x =
            c.textAlign === "left"
              ? -e.width / 2
              : c.textAlign === "right"
                ? e.width / 2
                : 0;
          lines.forEach((line, i) =>
            c.fillText(line, x, -e.height / 2 + height / 2 + 5 + i * height),
          );
        }
      } else {
        const asset = this.assets.get(e.picture);
        if (asset)
          c.drawImage(asset.image, -e.regX, -e.regY, e.width, e.height);
      }
      c.restore();
    }
    runtime.castle?.draw(c);
    c.restore();
  }
}
