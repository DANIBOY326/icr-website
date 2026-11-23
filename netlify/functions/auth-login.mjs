import crypto from "node:crypto";
import {
  buildSessionCookie,
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

function safeEquals(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export default async function handler(req) {
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const body = await parseJsonBody(req);
  if (!body) return errorResponse("Invalid JSON payload", 400);

  const email = cleanString(body.email, 160).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";

  if (!isValidEmail(email) || !password) {
    return errorResponse("Email and password are required.", 400);
  }

  const rawUsers = await readCollection("users", getSeedUsers);
  const users = rawUsers.filter((u) => u.id !== "user-icr-exec-demo");
  if (users.length !== rawUsers.length) {
    await writeCollection("users", users);
  }
  let user = users.find((u) => u.email.toLowerCase() === email);

  // Support secure free Executive account configured via Netlify Environment Variables
  const envExecEmail = (process.env.ICR_EXEC_EMAIL || "").trim().toLowerCase();
  const envExecPass = process.env.ICR_EXEC_PASSWORD || "";
  const isEnvExecLogin = envExecEmail && envExecPass && email === envExecEmail && safeEquals(password, envExecPass);

  if (isEnvExecLogin) {
    if (!user) {
      user = {
        id: "user-icr-exec-admin",
        fullName: process.env.ICR_EXEC_NAME || "ICR Executive Council",
        email: envExecEmail,
        passwordHash: hashPassword(envExecPass),
        role: "executive",
        institution: "Innovative Campus Researchers (ICR)",
        academicLevel: "Executive Council",
        discipline: "Research Governance & Peer Review",
        orcid: "",
        bio: "Executive Council administrator overseeing peer review, publications, and member onboarding.",
        createdAt: new Date().toISOString(),
      };
      users.push(user);
      await writeCollection("users", users);
    } else if (user.role !== "executive") {
      user.role = "executive";
      await writeCollection("users", users);
    }
  } else if (!user || !verifyPassword(password, user.passwordHash)) {
    return errorResponse("Invalid email or password.", 401);
  }

  const token = signToken({ sub: user.id, email: user.email, role: user.role });
  const cookie = buildSessionCookie(token, isRequestHttps(req));

  return jsonResponse(
    { ok: true, user: sanitizeUser(user), token },
    200,
    { "Set-Cookie": cookie }
  );
}
