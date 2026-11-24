/**
 * Secure Password Reset & Change Password endpoint backed by @netlify/blobs.
 * - POST { action: "request", email } -> generates 6-digit single-use reset code (30-min TTL).
 *   Automatically emails via Resend if RESEND_API_KEY env var is set; otherwise queues securely
 *   inside the Executive CMS (Executive-only GET /api/auth-reset) so ICR officers can deliver it at $0 cost.
 * - POST { action: "confirm", email, code, newPassword } -> verifies code (timing-safe, max 5 attempts),
 *   updates scrypt password hash, invalidates token, and signs the member in.
 * - POST { action: "change", currentPassword, newPassword } -> signed-in member changes own password.
 * - GET /api/auth-reset (Executive only) -> lists active pending password reset requests.
 * - DELETE /api/auth-reset (Executive only) -> dismisses a pending reset request.
 */
import crypto from "node:crypto";
import {
  buildSessionCookie,
  getSessionFromRequest,
  hashPassword,
  isRequestHttps,
  sanitizeUser,
  signToken,
  verifyPassword,
} from "./_lib/auth.mjs";
import {
  cleanString,
  errorResponse,
  isValidEmail,
  jsonResponse,
  parseJsonBody,
} from "./_lib/http.mjs";
import { getSeedUsers, readCollection, writeCollection } from "./_lib/store.mjs";

const RESET_COLLECTION = "password-resets";
const CODE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_ATTEMPTS = 5;

function sha256(val) {
  return crypto.createHash("sha256").update(String(val)).digest("hex");
}

function safeEqualHex(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

async function trySendResetEmail({ to, fullName, code }) {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) return false;
  const from = (process.env.ICR_EMAIL_FROM || "Innovative Campus Researchers <onboarding@resend.dev>").trim();
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "ICR Member Portal — Password Reset Code",
        html: `
          <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;color:#0f172a;">
            <h2 style="color:#111d30;">Innovative Campus Researchers (ICR)</h2>
            <p>Hi ${fullName || "Researcher"},</p>
            <p>We received a request to reset your ICR Member Portal password. Use the 1-time reset code below (expires in 30 minutes):</p>
            <div style="font-size:28px;font-weight:800;letter-spacing:6px;background:#f7f9fc;border:1px solid #cbd5e1;border-radius:10px;padding:16px;text-align:center;color:#b8292f;margin:18px 0;">
              ${code}
            </div>
            <p style="font-size:13px;color:#475569;">If you did not request this reset, you can safely ignore this email—your password has not changed.</p>
          </div>
        `,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function pruneExpired(records) {
  const now = Date.now();
  return (records || []).filter((r) => r && r.expiresAt && new Date(r.expiresAt).getTime() > now);
}

export default async function handler(req) {
  // Executive-only: list active pending password reset requests
  if (req.method === "GET") {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== "executive") {
      return errorResponse("Executive Council privileges required.", 403);
    }
    const raw = await readCollection(RESET_COLLECTION, () => []);
    const active = pruneExpired(raw);
    if (active.length !== raw.length) {
      await writeCollection(RESET_COLLECTION, active);
    }
    return jsonResponse({
      ok: true,
      emailAutomationEnabled: Boolean((process.env.RESEND_API_KEY || "").trim()),
      requests: active.map((r) => ({
        id: r.id,
        fullName: r.fullName,
        email: r.email,
        code: r.code,
        emailSent: Boolean(r.emailSent),
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
      })),
    });
  }

  // Executive-only: dismiss/cancel a pending reset request
  if (req.method === "DELETE") {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== "executive") {
      return errorResponse("Executive Council privileges required.", 403);
    }
    const body = await parseJsonBody(req);
    const id = cleanString(body?.id || "", 80);
    if (!id) return errorResponse("Request id is required.", 400);

    const active = pruneExpired(await readCollection(RESET_COLLECTION, () => []));
    const next = active.filter((r) => r.id !== id);
    await writeCollection(RESET_COLLECTION, next);
    return jsonResponse({ ok: true, deletedId: id });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const body = await parseJsonBody(req);
  if (!body) return errorResponse("Invalid JSON payload", 400);

  const action = cleanString(body.action || "request", 30).toLowerCase();

  // 1) Signed-in user changing their own password
  if (action === "change") {
    const session = getSessionFromRequest(req);
    if (!session) return errorResponse("Please sign in to change your password.", 401);

    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

    if (!currentPassword || !newPassword) {
      return errorResponse("Current password and new password are required.", 400);
    }
    if (newPassword.length < 8) {
      return errorResponse("New password must be at least 8 characters long.", 400);
    }

    const envExecEmail = (process.env.ICR_EXEC_EMAIL || "").trim().toLowerCase();
    if (envExecEmail && session.email?.toLowerCase() === envExecEmail) {
      return errorResponse(
        "The primary Executive password is managed securely via Netlify Environment Variables (ICR_EXEC_PASSWORD). Update it in your Netlify dashboard.",
        400
      );
    }

    const users = await readCollection("users", getSeedUsers);
    const idx = users.findIndex((u) => u.id === session.sub);
    if (idx === -1) return errorResponse("Account not found.", 404);

    if (!verifyPassword(currentPassword, users[idx].passwordHash)) {
      return errorResponse("Your current password is incorrect.", 401);
    }

    users[idx] = {
      ...users[idx],
      passwordHash: hashPassword(newPassword),
      updatedAt: new Date().toISOString(),
    };
    await writeCollection("users", users);

    return jsonResponse({ ok: true, message: "Your password has been updated securely." });
  }

  // 2) Public forgot-password request
  if (action === "request") {
    const email = cleanString(body.email, 160).toLowerCase();
    if (!isValidEmail(email)) {
      return errorResponse("Please enter a valid email address.", 400);
    }

    // Protect env-var master executive login from web-based reset
    const envExecEmail = (process.env.ICR_EXEC_EMAIL || "").trim().toLowerCase();
    if (envExecEmail && email === envExecEmail) {
      return jsonResponse({
        ok: true,
        deliveryMode: "env",
        message:
          "Primary Executive Council credentials are managed in Netlify Environment Variables (ICR_EXEC_PASSWORD). Please update them in your Netlify dashboard.",
      });
    }

    const users = await readCollection("users", getSeedUsers);
    const user = users.find((u) => u.email.toLowerCase() === email && u.id !== "user-icr-exec-demo");

    let emailSent = false;
    if (user) {
      const code = String(crypto.randomInt(100000, 1000000));
      emailSent = await trySendResetEmail({ to: user.email, fullName: user.fullName, code });

      const active = pruneExpired(await readCollection(RESET_COLLECTION, () => [])).filter(
        (r) => r.email.toLowerCase() !== email
      );
      active.unshift({
        id: `rst-${crypto.randomUUID().slice(0, 8)}`,
        userId: user.id,
        fullName: user.fullName,
        email: user.email,
        code,
        codeHash: sha256(code),
        attempts: 0,
        emailSent,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + CODE_TTL_MS).toISOString(),
      });
      await writeCollection(RESET_COLLECTION, active);
    }

    const hasAutoEmail = Boolean((process.env.RESEND_API_KEY || "").trim());
    return jsonResponse({
      ok: true,
      deliveryMode: hasAutoEmail && emailSent ? "email" : "desk",
      message:
        hasAutoEmail
          ? "If an ICR account matches that email, we sent a 6-digit reset code to your inbox (valid for 30 minutes). Enter it below to choose a new password."
          : "Reset request logged! If an ICR account matches that email, a 1-time 6-digit reset code (valid for 30 minutes) has been generated for the ICR Executive Desk. Message icr2026@gmail.com or WhatsApp +234 802 952 2173 to receive your code, then enter it below.",
    });
  }

  // 3) Confirm reset code + set new password
  if (action === "confirm") {
    const email = cleanString(body.email, 160).toLowerCase();
    const code = cleanString(body.code, 20).replace(/\s+/g, "");
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

    if (!isValidEmail(email)) return errorResponse("Please enter a valid email address.", 400);
    if (!/^\d{6}$/.test(code)) return errorResponse("Please enter the 6-digit reset code.", 400);
    if (newPassword.length < 8) return errorResponse("New password must be at least 8 characters long.", 400);

    const active = pruneExpired(await readCollection(RESET_COLLECTION, () => []));
    const reqIdx = active.findIndex((r) => r.email.toLowerCase() === email);
    if (reqIdx === -1) {
      return errorResponse("Invalid or expired reset code. Please request a new reset code.", 400);
    }

    const record = active[reqIdx];
    const providedHash = sha256(code);
    if (!safeEqualHex(providedHash, record.codeHash)) {
      record.attempts = (record.attempts || 0) + 1;
      if (record.attempts >= MAX_ATTEMPTS) {
        active.splice(reqIdx, 1);
        await writeCollection(RESET_COLLECTION, active);
        return errorResponse("Too many incorrect attempts. This reset code has been invalidated—please request a new one.", 429);
      }
      active[reqIdx] = record;
      await writeCollection(RESET_COLLECTION, active);
      return errorResponse(`Incorrect reset code (${MAX_ATTEMPTS - record.attempts} attempts remaining).`, 400);
    }

    const users = await readCollection("users", getSeedUsers);
    const userIdx = users.findIndex((u) => u.id === record.userId || u.email.toLowerCase() === email);
    if (userIdx === -1) {
      return errorResponse("Account not found.", 404);
    }

    users[userIdx] = {
      ...users[userIdx],
      passwordHash: hashPassword(newPassword),
      updatedAt: new Date().toISOString(),
    };

    // Consume reset token (strictly single-use)
    active.splice(reqIdx, 1);
    await Promise.all([
      writeCollection("users", users),
      writeCollection(RESET_COLLECTION, active),
    ]);

    const updatedUser = users[userIdx];
    const token = signToken({ sub: updatedUser.id, email: updatedUser.email, role: updatedUser.role });
    const cookie = buildSessionCookie(token, isRequestHttps(req));

    return jsonResponse(
      {
        ok: true,
        user: sanitizeUser(updatedUser),
        token,
        message: "Password reset successful! You are now signed in.",
      },
      200,
      { "Set-Cookie": cookie }
    );
  }

  return errorResponse("Unsupported password reset action.", 400);
}
