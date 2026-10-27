import fs from "node:fs";
import { createHash } from "node:crypto";
const hash = createHash("sha256");
for (const path of [
  "public/data/project.json",
  "public/src/original-program.js",
  "public/src/runtime.js",
  "public/src/frame-sync.js",
  "public/src/online.js",
  "public/src/app.js",
  "public/src/assets.js",
  "source/assets-manifest.json",
])
  hash.update(fs.readFileSync(new URL("../" + path, import.meta.url)));
fs.writeFileSync(
  new URL("../public/data/build.json", import.meta.url),
  JSON.stringify({ id: hash.digest("hex"), protocol: 1 }),
);
