import {
  buildClearSessionCookie,
  getSessionFromRequest,
  isRequestHttps,
  sanitizeUser,
  verifyPassword,
} from "./_lib/auth.mjs";
import {
  cleanMultiline,
  cleanString,
  errorResponse,
  jsonResponse,
  parseJsonBody,
} from "./_lib/http.mjs";
import { getSeedMembers, getSeedUsers, readCollection, writeCollection } from "./_lib/store.mjs";

export default async function handler(req) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return jsonResponse({ ok: false, authenticated: false, user: null }, 200);
  }

  const rawUsers = await readCollection("users", getSeedUsers);
  const users = rawUsers.filter((u) => u.id !== "user-icr-exec-demo");
  if (users.length !== rawUsers.length) {
    await writeCollection("users", users);
  }
  const idx = users.findIndex((u) => u.id === session.sub);
  if (idx === -1) {
    return jsonResponse({ ok: false, authenticated: false, user: null }, 200);
  }

  const envExecEmail = (process.env.ICR_EXEC_EMAIL || "").trim().toLowerCase();
  const isEnvPrimary = Boolean(envExecEmail && users[idx].email?.toLowerCase() === envExecEmail);

  if (req.method === "GET") {
    return jsonResponse({
      ok: true,
      authenticated: true,
      user: { ...sanitizeUser(users[idx]), isEnvPrimary },
    });
  }

  if (req.method === "PATCH" || req.method === "PUT") {
    const body = await parseJsonBody(req);
    if (!body) return errorResponse("Invalid JSON payload", 400);

    const current = users[idx];
    const updated = {
      ...current,
      fullName: cleanString(body.fullName, 120) || current.fullName,
      institution: cleanString(body.institution, 160) || current.institution,
      academicLevel: cleanString(body.academicLevel, 100) || current.academicLevel,
      discipline: cleanString(body.discipline, 140) || current.discipline,
      orcid: cleanString(body.orcid ?? current.orcid ?? "", 40),
      phone: cleanString(body.phone ?? current.phone ?? "", 40),
      profileUrl: cleanString(body.profileUrl ?? current.profileUrl ?? "", 240),
      photoUrl: cleanString(body.photoUrl ?? current.photoUrl ?? "", 320),
      bio: cleanMultiline(body.bio ?? current.bio ?? "", 600),
      updatedAt: new Date().toISOString(),
    };
    users[idx] = updated;
    await writeCollection("users", users);

    // Sync updated profile to public /community researchers directory
    try {
      const directory = await readCollection("members", getSeedMembers);
      const researchers = Array.isArray(directory.researchers) ? directory.researchers : [];
      const rIdx = researchers.findIndex(
        (r) => r.id === updated.id || r.name?.toLowerCase() === current.fullName?.toLowerCase()
      );
      if (rIdx >= 0) {
        researchers[rIdx] = {
          ...researchers[rIdx],
          name: updated.fullName,
          institution: updated.institution,
          academicLevel: updated.academicLevel,
          discipline: updated.discipline,
          photoUrl: updated.photoUrl,
          bio: updated.bio,
        };
      } else {
        researchers.unshift({
          id: updated.id,
          name: updated.fullName,
          cohort: "Current Researcher",
          academicLevel: updated.academicLevel,
          discipline: updated.discipline,
          institution: updated.institution,
          photoUrl: updated.photoUrl,
          papersCount: 0,
          bio: updated.bio,
        });
      }
      await writeCollection("members", { ...directory, researchers });
    } catch {
      // non-fatal directory sync
    }

    return jsonResponse({
      ok: true,
      authenticated: true,
      user: { ...sanitizeUser(updated), isEnvPrimary },
    });
  }

  if (req.method === "DELETE") {
    if (isEnvPrimary) {
      return errorResponse(
        "The primary Executive Council account is managed via Netlify Environment Variables and cannot be deleted here.",
        400
      );
    }

    const body = await parseJsonBody(req);
    const password = typeof body?.password === "string" ? body.password : "";
    if (!password || !verifyPassword(password, users[idx].passwordHash)) {
      return errorResponse("Please enter your current password to confirm account deletion.", 401);
    }

    const target = users[idx];
    const nextUsers = users.filter((u) => u.id !== target.id);
    const directory = await readCollection("members", getSeedMembers);
    const nextResearchers = (directory.researchers || []).filter(
      (r) => r.id !== target.id && r.name?.toLowerCase() !== target.fullName?.toLowerCase()
    );
    const resets = await readCollection("password-resets", () => []);
    const nextResets = resets.filter(
      (r) => r.userId !== target.id && r.email?.toLowerCase() !== target.email?.toLowerCase()
    );

    await Promise.all([
      writeCollection("users", nextUsers),
      writeCollection("members", { ...directory, researchers: nextResearchers }),
      writeCollection("password-resets", nextResets),
    ]);

    return jsonResponse(
      { ok: true, message: "Your ICR account has been deleted." },
      200,
      { "Set-Cookie": buildClearSessionCookie(isRequestHttps(req)) }
    );
  }

  return errorResponse("Method not allowed", 405);
}
