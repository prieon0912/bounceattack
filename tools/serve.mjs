import { createOnlineServer } from "../server/online-server.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../public", import.meta.url)),
  port = Number(process.env.PORT || 4173),
  host = process.env.HOST || "127.0.0.1",
  mime = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
  };
const { server } = createOnlineServer({ local: true });
const onlineRequest = server.listeners("request")[0];
server.removeAllListeners("request");
server.on("request", (req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  if (pathname === "/healthz") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" }).end("ok");
    return;
  }
  if (pathname === "/api/online") {
    onlineRequest(req, res);
    return;
  }
  let file;
  try {
    file = path.resolve(
      root,
      "." + decodeURIComponent(pathname),
    );
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (file !== root && !file.startsWith(root + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    if (fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    const stat = fs.statSync(file);
    res.writeHead(200, {
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": "no-cache",
    });
    fs.createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404).end("Not found");
  }
});
server.listen(port, host, () =>
  console.log(`Bounce Attack listening on ${host}:${server.address().port}`),
);
