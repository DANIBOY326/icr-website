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
import { readCollection, writeCollection } from "./_lib/store.mjs";

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

  return errorResponse("Method not allowed", 405);
}
