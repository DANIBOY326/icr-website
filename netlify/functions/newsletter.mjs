import crypto from "node:crypto";
import {
  cleanString,
  errorResponse,
  isValidEmail,
  jsonResponse,
  parseJsonBody,
} from "./_lib/http.mjs";
import { readCollection, writeCollection } from "./_lib/store.mjs";

export default async function handler(req) {
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const body = await parseJsonBody(req);
  if (!body) return errorResponse("Invalid JSON payload", 400);

  const email = cleanString(body.email, 160).toLowerCase();
  const fullName = cleanString(body.fullName || "", 120);

  if (!isValidEmail(email)) {
    return errorResponse("Please enter a valid email address.", 400);
  }

  const subscribers = await readCollection("newsletter", () => []);
  if (subscribers.some((s) => s.email === email)) {
    return jsonResponse({
      ok: true,
      alreadySubscribed: true,
      message: "You are already subscribed to the ICR Research Digest.",
    });
  }

  subscribers.unshift({
    id: `sub-${crypto.randomUUID().slice(0, 8)}`,
    email,
    fullName,
    subscribedAt: new Date().toISOString(),
  });
  await writeCollection("newsletter", subscribers);

  return jsonResponse(
    {
      ok: true,
      message: "Welcome aboard! You are now subscribed to the ICR Research Digest.",
    },
    201
  );
}
