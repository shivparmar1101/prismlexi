"use strict";

/**
 * PrismLexi image-generation proxy.
 *
 * Used two ways (identical logic):
 *   • Locally  → required by server.js and mounted at /api/generate
 *   • On Netlify → deployed as /.netlify/functions/generate
 *     (netlify.toml rewrites /api/generate → this function)
 *
 * Why it exists:
 *   1. The Pollinations paid API now REQUIRES an "Authorization: Bearer <key>"
 *      header — sending ?key= in the query returns 401 UNAUTHORIZED.
 *   2. The key must never ship in browser code, so it lives in
 *      POLLINATIONS_API_KEY (env).
 *   3. Browsers get clean JSON ({url} / {b64} / {error}) instead of an
 *      opaque image-probe failure ("API unreachable").
 *
 * Strategy:
 *   paid tier (gen.pollinations.ai + Bearer, when balance > 0)
 *     → free tier (image.pollinations.ai, no key, retry w/ new seed on 429)
 *     → structured error.
 */

const PAID = "https://gen.pollinations.ai";
const ANON = "https://image.pollinations.ai";
const ANON_MODEL = "flux";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type,accept",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
};

const ok = (body) => ({
  statusCode: 200,
  headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(body)
});

const fail = (statusCode, error) => ({
  statusCode,
  headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ error: String(error).slice(0, 500) })
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function clampInt(v, min, max, dflt) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return dflt;
  return Math.min(max, Math.max(min, n));
}

function extractMessage(text) {
  try {
    const j = JSON.parse(text);
    if (j && j.error) return j.error.message || j.error;
    if (j && j.message) return j.message;
  } catch (e) {}
  return String(text || "").slice(0, 240) || "empty upstream response";
}

function dataUrl(buf, mime) {
  const type = (mime || "image/jpeg").split(";")[0];
  return `data:${type};base64,${Buffer.from(buf).toString("base64")}`;
}

/* ---------- text-to-image ---------- */

async function paidText(p, key) {
  const url =
    `${PAID}/image/${encodeURIComponent(p.prompt)}` +
    `?width=${p.width}&height=${p.height}&seed=${p.seed}` +
    `&model=${encodeURIComponent(p.model)}&referrer=${encodeURIComponent(p.referrer)}`;

  const r = await fetch(url, {
    headers: { Authorization: "Bearer " + key },
    redirect: "follow",
    signal: AbortSignal.timeout(120000)
  });
  const ct = r.headers.get("content-type") || "";

  if (r.ok && ct.includes("image")) {
    if (r.redirected) {
      try { r.body.cancel(); } catch (e) {}
      return { url: r.url, tier: "paid" };
    }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 5500000) return { error: "paid tier: response too large" };
    return { b64: dataUrl(buf, ct), tier: "paid" };
  }

  const txt = await r.text().catch(() => "");
  return { error: `paid tier ${r.status}: ${extractMessage(txt)}` };
}

async function anonText(p) {
  let last = "free tier unavailable";
  for (let i = 0; i < 4; i++) {
    const seed = i === 0 ? p.seed : Math.floor(Math.random() * 2147483647);
    const url =
      `${ANON}/prompt/${encodeURIComponent(p.prompt)}` +
      `?width=${p.width}&height=${p.height}&seed=${seed}` +
      `&model=${ANON_MODEL}&nologo=true&referrer=${encodeURIComponent(p.referrer)}`;
    try {
      const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(120000) });
      const ct = r.headers.get("content-type") || "";
      if (r.ok && ct.includes("image")) {
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length > 5500000) {
          last = "free tier: response too large";
        } else {
          return { b64: dataUrl(buf, ct), tier: "anonymous" };
        }
      } else {
        const txt = await r.text().catch(() => "");
        last = `free tier ${r.status}: ${extractMessage(txt)}`;
      }
    } catch (e) {
      last = "free tier: " + (e && e.message ? e.message : e);
    }
    if (i < 3) await sleep(700 * (i + 1));
  }
  return { error: last };
}

async function handleText(qs) {
  const prompt = String(qs.prompt || "").trim();
  if (!prompt) return fail(400, "missing prompt");
  if (prompt.length > 4000) return fail(400, "prompt too long (max 4000 chars)");

  const params = {
    prompt,
    width: clampInt(qs.width, 256, 2048, 1024),
    height: clampInt(qs.height, 256, 2048, 1024),
    seed: clampInt(qs.seed, 0, 2147483647, Math.floor(Math.random() * 2147483647)),
    model: String(qs.model || "tongyi-mai/z-image-turbo").replace(/[^\w./-]/g, ""),
    referrer: String(qs.referrer || "prismlexi").replace(/[^\w.\- ]/g, "")
  };

  const key = process.env.POLLINATIONS_API_KEY || "";
  let paidError = null;

  if (key) {
    try {
      const paid = await paidText(params, key);
      if (!paid.error) return ok(paid);
      paidError = paid.error;
    } catch (e) {
      paidError = "paid tier: " + (e && e.message ? e.message : e);
    }
  } else {
    paidError = "paid tier: POLLINATIONS_API_KEY not set";
  }

  const anon = await anonText(params);
  if (!anon.error) {
    return ok(paidError ? { ...anon, paidError } : anon);
  }
  return fail(502, paidError ? `${paidError} — ${anon.error}` : anon.error);
}

/* ---------- image edit (paid tier only) ---------- */

function decodeDataUrl(s) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(String(s || ""));
  if (!m) return null;
  const mime = m[1] || "image/png";
  const buf = m[2] ? Buffer.from(m[3], "base64") : Buffer.from(decodeURIComponent(m[3]), "utf8");
  return { buf, mime };
}

async function handleEdit(body) {
  let payload;
  try {
    payload = JSON.parse(body || "{}");
  } catch (e) {
    return fail(400, "invalid JSON body");
  }

  const prompt = String(payload.prompt || "").trim();
  if (!prompt) return fail(400, "missing prompt");

  const key = process.env.POLLINATIONS_API_KEY || "";
  if (!key) {
    return fail(503, "edits require POLLINATIONS_API_KEY in site env — top up pollen at enter.pollinations.ai/top-up");
  }

  const img = decodeDataUrl(payload.image);
  if (!img || !img.buf.length) return fail(400, "missing base image (data URL expected)");
  if (img.buf.length > 8000000) return fail(400, "base image too large");

  const fd = new FormData();
  fd.append("image", new Blob([img.buf], { type: img.mime }), "base." + (img.mime.split("/")[1] || "png"));
  fd.append("prompt", prompt);
  fd.append("model", String(payload.model || "kontext").replace(/[^\w-]/g, ""));
  fd.append("response_format", "url");

  const r = await fetch(PAID + "/v1/images/edits", {
    method: "POST",
    headers: { Authorization: "Bearer " + key },
    body: fd,
    signal: AbortSignal.timeout(180000)
  });

  const txt = await r.text().catch(() => "");
  if (!r.ok) return fail(502, `edit ${r.status}: ${extractMessage(txt)}`);

  try {
    const j = JSON.parse(txt);
    const url = (j.data && j.data[0] && j.data[0].url) || j.url || "";
    if (!url) return fail(502, "edit returned no image url: " + txt.slice(0, 200));
    return ok({ url, tier: "paid" });
  } catch (e) {
    return fail(502, "edit response was not JSON: " + txt.slice(0, 200));
  }
}

/* ---------- handler ---------- */

exports.handler = async (event) => {
  const method = (event && event.httpMethod) || "GET";

  if (method === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  try {
    if (method === "POST") return await handleEdit(event.body);
    if (method === "GET") return await handleText((event && event.queryStringParameters) || {});
    return fail(405, "method not allowed");
  } catch (e) {
    return fail(500, "proxy error: " + (e && e.message ? e.message : e));
  }
};
