import crypto from "node:crypto";
import {
  buildSessionCookie,
  hashPassword,
  isRequestHttps,
  sanitizeUser,
  signToken,
} from "./_lib/auth.mjs";
import {
  cleanMultiline,
  cleanString,
  errorResponse,
  isValidEmail,
  jsonResponse,
  parseJsonBody,
} from "./_lib/http.mjs";
import { getSeedMembers, getSeedUsers, readCollection, writeCollection } from "./_lib/store.mjs";

export default async function handler(req) {
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const body = await parseJsonBody(req);
  if (!body) return errorResponse("Invalid JSON payload", 400);

  const fullName = cleanString(body.fullName, 120);
  const email = cleanString(body.email, 160).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const institution = cleanString(body.institution, 160) || "Campus Researcher";
  const academicLevel = cleanString(body.academicLevel, 80) || "Undergraduate";
  const discipline = cleanString(body.discipline, 140) || "Interdisciplinary Research";
  const bio = cleanMultiline(body.bio || "", 600);
  const inviteCode = cleanString(body.inviteCode || "", 100);

  if (fullName.length < 2) return errorResponse("Please provide your full name.", 400);
  if (!isValidEmail(email)) return errorResponse("Please provide a valid academic or personal email address.", 400);
  if (password.length < 8) return errorResponse("Password must be at least 8 characters long.", 400);

  // Executive role is granted ONLY if a private ICR_EXEC_CODE env var is configured and matched exactly
  const envExecCode = (process.env.ICR_EXEC_CODE || "").trim();
  let assignedRole = "member";
  if (inviteCode) {
    if (!envExecCode) {
      return errorResponse("Executive invite codes are not currently enabled. Leave the code blank to register as a member.", 400);
    }
    const a = Buffer.from(inviteCode);
    const b = Buffer.from(envExecCode);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return errorResponse("Invalid Executive Council invite code.", 403);
    }
    assignedRole = "executive";
  }

  const users = await readCollection("users", getSeedUsers);
  if (users.some((u) => u.email.toLowerCase() === email)) {
    return errorResponse("An ICR account with this email already exists. Please sign in instead.", 409);
  }

  const newUser = {
    id: `user-${crypto.randomUUID()}`,
    fullName,
    email,
    passwordHash: hashPassword(password),
    role: assignedRole,
    institution,
    academicLevel,
    discipline,
    orcid: cleanString(body.orcid || "", 40),
    bio: bio || `Member of the Innovative Campus Researchers community studying ${discipline}.`,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  await writeCollection("users", users);

  // Also add to public community researchers directory
  const directory = await readCollection("members", getSeedMembers);
  if (!directory.researchers.some((r) => r.name.toLowerCase() === fullName.toLowerCase())) {
    directory.researchers.unshift({
      id: newUser.id,
      name: fullName,
      cohort: "Current Researcher",
      discipline,
      institution,
      papersCount: 0,
      bio: newUser.bio,
    });
    await writeCollection("members", directory);
  }

  const token = signToken({ sub: newUser.id, email: newUser.email, role: newUser.role });
  const cookie = buildSessionCookie(token, isRequestHttps(req));

  return jsonResponse(
    { ok: true, user: sanitizeUser(newUser), token },
    201,
    { "Set-Cookie": cookie }
  );
}
