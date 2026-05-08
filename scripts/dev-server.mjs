import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.cwd());
const startPort = Number(process.env.PORT || 8080);
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};
const headers = (file) => ({
  "cache-control": "no-store",
  "content-type": types[extname(file)] || "application/octet-stream"
});

function fileFor(url) {
  const path = normalize(decodeURIComponent(new URL(url, "http://localhost").pathname));
  const file = resolve(join(root, path === "/" ? "index.html" : path));
  return file.startsWith(root) ? file : null;
}

function server() {
  return createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405).end();
      return;
    }

    let file = fileFor(request.url);
    if (!file) {
      response.writeHead(403).end();
      return;
    }

    const info = await stat(file).catch((error) => {
      response.writeHead(error.code === "ENOENT" ? 404 : 500, { "content-type": "text/plain; charset=utf-8" });
      response.end(error.message);
      return null;
    });
    if (!info) return;

    if (info.isDirectory()) {
      file = join(file, "index.html");
    }

    response.writeHead(200, headers(file));
    if (request.method === "HEAD") response.end();
    else createReadStream(file).pipe(response);
  });
}

function listen(port) {
  const app = server();
  app.on("error", (error) => {
    if (error.code === "EADDRINUSE") listen(port + 1);
    else throw error;
  });
  app.listen(port, () => console.log(`Glotmaxxing dev server: http://localhost:${port}`));
}

listen(startPort);
