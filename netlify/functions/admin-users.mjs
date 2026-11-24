/**
 * Executive-only Member Account Manager backed by @netlify/blobs.
 * - GET    /api/admin-users -> lists all sanitized registered accounts
 * - PATCH  /api/admin-users -> promotes/demotes role ("member" | "executive")
 * - DELETE /api/admin-users -> deletes a user account, removes from /community researchers, and clears pending resets
 */
import { getSessionFromRequest, sanitizeUser } from "./_lib/auth.mjs";
import { cleanString, errorResponse, jsonResponse, parseJsonBody } from "./_lib/http.mjs";
import { getSeedMembers, getSeedUsers, readCollection, writeCollection } from "./_lib/store.mjs";

export default async function handler(req) {
  const session = getSessionFromRequest(req);
  if (!session || session.role !== "executive") {
    return errorResponse("Executive Council privileges required.", 403);
  }

  const envExecEmail = (process.env.ICR_EXEC_EMAIL || "").trim().toLowerCase();
  const rawUsers = await readCollection("users", getSeedUsers);
  const users = rawUsers.filter((u) => u.id !== "user-icr-exec-demo");
  if (users.length !== rawUsers.length) {
    await writeCollection("users", users);
  }

  if (req.method === "GET") {
    const list = users.map((u) => ({
      ...sanitizeUser(u),
      isEnvPrimary: Boolean(envExecEmail && u.email?.toLowerCase() === envExecEmail),
      isSelf: u.id === session.sub,
    }));
    return jsonResponse({ ok: true, count: list.length, users: list });
  }

  if (req.method === "PATCH") {
    const body = await parseJsonBody(req);
    if (!body) return errorResponse("Invalid JSON payload.", 400);

    const id = cleanString(body.id || "", 80);
    const nextRole = cleanString(body.role || "", 30);
    if (!id || !["member", "executive"].includes(nextRole)) {
      return errorResponse("Valid user id and role ('member' or 'executive') are required.", 400);
    }

    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return errorResponse("User account not found.", 404);

    const target = users[idx];
    if (envExecEmail && target.email?.toLowerCase() === envExecEmail && nextRole !== "executive") {
      return errorResponse("The primary Netlify Environment Variable Executive account cannot be demoted.", 400);
    }
    if (target.id === session.sub && nextRole !== "executive") {
      return errorResponse("You cannot demote your own active Executive session.", 400);
    }

    users[idx] = { ...target, role: nextRole, updatedAt: new Date().toISOString() };
    await writeCollection("users", users);
    return jsonResponse({ ok: true, user: sanitizeUser(users[idx]) });
  }

  if (req.method === "DELETE") {
    const body = await parseJsonBody(req);
    if (!body) return errorResponse("Invalid JSON payload.", 400);

    const id = cleanString(body.id || "", 80);
    if (!id) return errorResponse("User id is required.", 400);

    const target = users.find((u) => u.id === id);
    if (!target) return errorResponse("User account not found.", 404);

    if (target.id === session.sub) {
      return errorResponse("You cannot delete the account you are currently signed in with.", 400);
    }
    if (envExecEmail && target.email?.toLowerCase() === envExecEmail) {
      return errorResponse(
        "This email is configured as ICR_EXEC_EMAIL in Netlify Environment Variables. Change ICR_EXEC_EMAIL in Netlify first if you wish to remove it.",
        400
      );
    }

    const nextUsers = users.filter((u) => u.id !== id);

    // Also remove from public /community researchers directory and any pending password resets
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

    return jsonResponse({
      ok: true,
      deletedId: id,
      deletedEmail: target.email,
      message: `Account (${target.email}) deleted and removed from the directory.`,
    });
  }

  return errorResponse("Method not allowed", 405);
}
