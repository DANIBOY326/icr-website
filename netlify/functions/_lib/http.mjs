/**
 * Shared HTTP, JSON response, and input-sanitization helpers for Netlify Functions v2.
 */

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

export function errorResponse(message, status = 400, details = undefined) {
  const payload = { ok: false, error: message };
  if (details) payload.details = details;
  return jsonResponse(payload, status);
}

export async function parseJsonBody(req) {
  try {
    const text = await req.text();
    if (!text) return {};
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function cleanString(value, maxLen = 500) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLen);
}

export function cleanMultiline(value, maxLen = 4000) {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").trim().slice(0, maxLen);
}

export function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function parseCookies(cookieHeader) {
  const map = {};
  if (!cookieHeader) return map;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      map[key] = decodeURIComponent(val);
    } catch {
      map[key] = val;
    }
  }
  return map;
}
