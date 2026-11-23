/**
 * Executive-only Roster CMS endpoint (Add, Edit, Remove Executive Council Officers & Headshots).
 */
import crypto from "node:crypto";
import { getSessionFromRequest } from "./_lib/auth.mjs";
import { cleanString, errorResponse, jsonResponse, parseJsonBody } from "./_lib/http.mjs";
import { getSeedMembers, readCollection, writeCollection } from "./_lib/store.mjs";

function makeInitials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "EX";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default async function handler(req) {
  const session = getSessionFromRequest(req);
  if (!session || session.role !== "executive") {
    return errorResponse("Executive Council privileges required.", 403);
  }

  const directory = await readCollection("members", getSeedMembers);
  if (!Array.isArray(directory.executives)) directory.executives = [];

  if (req.method === "POST" || req.method === "PUT") {
    const body = await parseJsonBody(req);
    if (!body) return errorResponse("Invalid JSON payload.", 400);

    const id = cleanString(body.id || "", 80);
    const name = cleanString(body.name, 120);
    const role = cleanString(body.role, 120);
    const focus = cleanString(body.focus, 320);
    const status = cleanString(body.status, 60) || "Executive Council";
    const photoUrl = cleanString(body.photoUrl || "", 320);

    if (name.length < 2) return errorResponse("Officer name is required.", 400);
    if (role.length < 2) return errorResponse("Officer role/title is required.", 400);

    const idx = id ? directory.executives.findIndex((ex) => ex.id === id) : -1;
    let saved;
    if (idx >= 0) {
      saved = {
        ...directory.executives[idx],
        name,
        role,
        focus: focus || directory.executives[idx].focus,
        status,
        initials: makeInitials(name),
        photoUrl: body.clearPhoto ? "" : photoUrl || directory.executives[idx].photoUrl || "",
      };
      directory.executives[idx] = saved;
    } else {
      saved = {
        id: `exec-${crypto.randomUUID().slice(0, 8)}`,
        name,
        role,
        focus: focus || "Stewarding ICR academic research programs and community standards.",
        status,
        initials: makeInitials(name),
        photoUrl,
      };
      directory.executives.push(saved);
    }

    await writeCollection("members", directory);
    return jsonResponse({ ok: true, executive: saved, executives: directory.executives }, idx >= 0 ? 200 : 201);
  }

  if (req.method === "DELETE") {
    const body = await parseJsonBody(req);
    const id = cleanString(body?.id || "", 80);
    if (!id) return errorResponse("Executive id is required.", 400);

    const next = directory.executives.filter((ex) => ex.id !== id);
    if (next.length === directory.executives.length) return errorResponse("Officer not found.", 404);
    directory.executives = next;
    await writeCollection("members", directory);
    return jsonResponse({ ok: true, deletedId: id, executives: directory.executives });
  }

  return errorResponse("Method not allowed", 405);
}
