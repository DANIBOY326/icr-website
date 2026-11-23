/**
 * Cryptographic authentication helpers (Node built-in crypto only: scrypt + HMAC-SHA256 JWT).
 * Zero third-party auth dependencies; works natively in Netlify Functions v2.
 */
import crypto from "node:crypto";
import { parseCookies } from "./http.mjs";

const COOKIE_NAME = "icr_session";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret() {
  // Set ICR_JWT_SECRET in Netlify Environment Variables for production security.
  // Falls back cleanly to a deterministic site-scoped secret if not configured yet.
  return (
    process.env.ICR_JWT_SECRET ||
    process.env.SITE_ID ||
    "icr-academic-research-community-2026-default-signing-key"
  );
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== "string") return false;
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, originalHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, "hex");
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

function base64UrlEncode(input) {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

export function signToken(payload) {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64UrlEncode(
    JSON.stringify({
      ...payload,
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
    })
  );
  const signature = base64UrlEncode(
    crypto.createHmac("sha256", getSecret()).update(`${header}.${body}`).digest()
  );
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = base64UrlEncode(
    crypto.createHmac("sha256", getSecret()).update(`${header}.${body}`).digest()
  );
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const decoded = JSON.parse(base64UrlDecode(body));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function buildSessionCookie(token, isHttps = true) {
  const flags = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${TOKEN_TTL_SECONDS}`,
  ];
  if (isHttps) flags.push("Secure");
  return flags.join("; ");
}

export function buildClearSessionCookie(isHttps = true) {
  const flags = [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (isHttps) flags.push("Secure");
  return flags.join("; ");
}

export function getSessionFromRequest(req) {
  const cookies = parseCookies(req.headers.get("cookie") || "");
  let token = cookies[COOKIE_NAME];
  if (!token) {
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    }
  }
  return verifyToken(token);
}

export function isRequestHttps(req) {
  const proto = req.headers.get("x-forwarded-proto") || "";
  if (proto) return proto === "https";
  return req.url.startsWith("https://");
}

export function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}
