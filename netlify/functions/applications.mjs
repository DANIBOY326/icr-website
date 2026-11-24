import crypto from "node:crypto";
import { getSessionFromRequest } from "./_lib/auth.mjs";
import {
  cleanMultiline,
  cleanString,
  errorResponse,
  isValidEmail,
  jsonResponse,
  parseJsonBody,
} from "./_lib/http.mjs";
import { getSeedMembers, readCollection, writeCollection } from "./_lib/store.mjs";

export default async function handler(req) {
  if (req.method === "GET") {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== "executive") {
      return errorResponse("Executive access required to inspect membership applications.", 403);
    }
    const apps = await readCollection("applications", () => []);
    return jsonResponse({ ok: true, count: apps.length, applications: apps });
  }

  if (req.method === "POST") {
    const body = await parseJsonBody(req);
    if (!body) return errorResponse("Invalid JSON payload", 400);

    const fullName = cleanString(body.fullName, 120);
    const email = cleanString(body.email, 160).toLowerCase();
    const phone = cleanString(body.phone, 40);
    const institution = cleanString(body.institution, 160);
    const academicLevel = cleanString(body.academicLevel, 80);
    const discipline = cleanString(body.discipline, 140);
    const interests = cleanString(body.interests, 240);
    const motivation = cleanMultiline(body.motivation, 2000);

    if (fullName.length < 2) return errorResponse("Full name is required.", 400);
    if (!isValidEmail(email)) return errorResponse("A valid email address is required.", 400);
    if (!institution) return errorResponse("Please enter your campus or institution.", 400);
    if (motivation.length < 20) return errorResponse("Please share a short statement of research interest (at least 20 characters).", 400);

    const apps = await readCollection("applications", () => []);
    const record = {
      id: `app-${crypto.randomUUID().slice(0, 8)}`,
      fullName,
      email,
      phone,
      institution,
      academicLevel: academicLevel || "Undergraduate",
      discipline: discipline || "Interdisciplinary",
      interests,
      motivation,
      status: "received",
      submittedAt: new Date().toISOString(),
    };

    apps.unshift(record);
    await writeCollection("applications", apps);

    return jsonResponse(
      {
        ok: true,
        applicationId: record.id,
        message: "Your ICR membership application has been received! Our Executive Council will reach out via email.",
      },
      201
    );
  }

  if (req.method === "PATCH") {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== "executive") {
      return errorResponse("Executive Council privileges required to manage membership applications.", 403);
    }

    const body = await parseJsonBody(req);
    if (!body) return errorResponse("Invalid JSON payload", 400);

    const id = cleanString(body.id || "", 80);
    const status = cleanString(body.status || "", 30).toLowerCase();
    if (!id || !["approved", "declined", "received"].includes(status)) {
      return errorResponse("Valid application id and status ('approved', 'declined', or 'received') are required.", 400);
    }

    const apps = await readCollection("applications", () => []);
    const idx = apps.findIndex((a) => a.id === id);
    if (idx === -1) return errorResponse("Application not found.", 404);

    const updated = {
      ...apps[idx],
      status,
      reviewedAt: new Date().toISOString(),
      reviewedBy: session.email || session.sub,
    };
    apps[idx] = updated;
    await writeCollection("applications", apps);

    // Automatically add approved applicants to the public /community Researchers Directory
    let addedToDirectory = false;
    if (status === "approved") {
      try {
        const directory = await readCollection("members", getSeedMembers);
        const researchers = Array.isArray(directory.researchers) ? directory.researchers : [];
        const exists = researchers.some(
          (r) =>
            r.id === `res-${updated.id}` ||
            r.name?.toLowerCase() === updated.fullName.toLowerCase()
        );
        if (!exists) {
          researchers.unshift({
            id: `res-${updated.id}`,
            name: updated.fullName,
            cohort: "Current Researcher",
            academicLevel: updated.academicLevel || "Member",
            discipline: updated.discipline || "Interdisciplinary Research",
            institution: updated.institution || "ICR Campus Network",
            papersCount: 0,
            bio:
              updated.interests
                ? `Research interests: ${updated.interests}. ${updated.motivation.slice(0, 220)}`
                : updated.motivation.slice(0, 260),
          });
          await writeCollection("members", { ...directory, researchers });
          addedToDirectory = true;
        }
      } catch {
        // non-fatal directory sync
      }
    }

    return jsonResponse({
      ok: true,
      application: updated,
      addedToDirectory,
      message:
        status === "approved"
          ? addedToDirectory
            ? `${updated.fullName} approved and added to the Community Researchers directory!`
            : `${updated.fullName} marked as approved!`
          : status === "declined"
          ? `Application from ${updated.fullName} marked as declined.`
          : `Application from ${updated.fullName} moved back to pending review.`,
    });
  }

  if (req.method === "DELETE") {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== "executive") {
      return errorResponse("Executive Council privileges required to delete applications.", 403);
    }

    const body = await parseJsonBody(req);
    const id = cleanString(body?.id || "", 80);
    if (!id) return errorResponse("Application id is required.", 400);

    const apps = await readCollection("applications", () => []);
    const next = apps.filter((a) => a.id !== id);
    if (next.length === apps.length) return errorResponse("Application not found.", 404);

    await writeCollection("applications", next);
    return jsonResponse({ ok: true, deletedId: id, message: "Application removed from queue." });
  }

  return errorResponse("Method not allowed", 405);
}
