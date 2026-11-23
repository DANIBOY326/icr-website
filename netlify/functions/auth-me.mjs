import { getSessionFromRequest, sanitizeUser } from "./_lib/auth.mjs";
import {
  cleanMultiline,
  cleanString,
  errorResponse,
  jsonResponse,
  parseJsonBody,
} from "./_lib/http.mjs";
import { getSeedUsers, readCollection, writeCollection } from "./_lib/store.mjs";

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

  if (req.method === "GET") {
    return jsonResponse({ ok: true, authenticated: true, user: sanitizeUser(users[idx]) });
  }

  if (req.method === "PATCH" || req.method === "PUT") {
    const body = await parseJsonBody(req);
    if (!body) return errorResponse("Invalid JSON payload", 400);

    const current = users[idx];
    const updated = {
      ...current,
      fullName: cleanString(body.fullName, 120) || current.fullName,
      institution: cleanString(body.institution, 160) || current.institution,
      academicLevel: cleanString(body.academicLevel, 80) || current.academicLevel,
      discipline: cleanString(body.discipline, 140) || current.discipline,
      orcid: cleanString(body.orcid ?? current.orcid, 40),
      bio: cleanMultiline(body.bio ?? current.bio, 600),
      updatedAt: new Date().toISOString(),
    };
    users[idx] = updated;
    await writeCollection("users", users);
    return jsonResponse({ ok: true, authenticated: true, user: sanitizeUser(updated) });
  }

  return errorResponse("Method not allowed", 405);
}
