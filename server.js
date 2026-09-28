"use strict";

/**
 * PrismLexi local dev server — zero dependencies.
 *
 *   node server.js        →  http://localhost:8080
 *
 * Serves the static app AND mounts the exact same Netlify function at
 *   GET/POST  /api/generate
 *
 * Reads POLLINATIONS_API_KEY from a .env file (see .env.example) or the
 * process environment. Without a key the proxy still works — it falls back
 * to Pollinations' free tier automatically.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { handler } = require("./netlify/functions/generate.js");

// minimal .env loader (no dependencies)
try {
  const raw = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  });
} catch (e) { /* .env is optional */ }

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json"
};

const PORT = parseInt(process.env.PORT || "8080", 10);

const server = http.createServer(async (req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch (e) {
    res.writeHead(400).end("bad request");
    return;
  }

  // ---- API: adapt Node req → Netlify event, reuse the real function ----
  if (pathname === "/api/generate" || pathname.endsWith("/api/generate")) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const event = {
      httpMethod: req.method,
      path: pathname,
      queryStringParameters: Object.fromEntries(new URL(req.url, "http://localhost").searchParams),
      headers: req.headers,
      body: chunks.length ? Buffer.concat(chunks).toString("utf8") : null,
      isBase64Encoded: false
    };
    try {
      const r = await handler(event);
      res.writeHead(r.statusCode || 200, r.headers || {});
      res.end(r.body || "");
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: String(e && e.message ? e.message : e) }));
    }
    return;
  }

  // ---- static files ----
  const target = path.normalize(path.join(__dirname, pathname));
  if (target !== __dirname && !target.startsWith(__dirname + path.sep)) {
    res.writeHead(403).end("forbidden");
    return;
  }
  let file = target;
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    file = path.join(file, "index.html");
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("404 — not found");
    return;
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  const hasKey = !!process.env.POLLINATIONS_API_KEY;
  console.log("");
  console.log("  PrismLexi dev server");
  console.log("  ─────────────────────────────────────────");
  console.log("  App  →  http://localhost:" + PORT);
  console.log("  API  →  http://localhost:" + PORT + "/api/generate");
  console.log("  Key  →  " + (hasKey ? "POLLINATIONS_API_KEY loaded" : "not set (free-tier fallback only)"));
  console.log("  ─────────────────────────────────────────");
  console.log("");
});
