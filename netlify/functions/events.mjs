import crypto from "node:crypto";
import { getSessionFromRequest } from "./_lib/auth.mjs";
import {
  cleanString,
  errorResponse,
  isValidEmail,
  jsonResponse,
  parseJsonBody,
} from "./_lib/http.mjs";
import { getSeedEvents, readCollection, writeCollection } from "./_lib/store.mjs";

export default async function handler(req) {
  if (req.method === "GET") {
    const events = await readCollection("events", getSeedEvents);
    const session = getSessionFromRequest(req);
    let myRsvps = [];
    if (session) {
      const rsvps = await readCollection("rsvps", () => []);
      myRsvps = rsvps.filter((r) => r.userId === session.sub || r.email === session.email);
    }
    return jsonResponse({ ok: true, events, myRsvps });
  }

  if (req.method === "POST") {
    const body = await parseJsonBody(req);
    if (!body) return errorResponse("Invalid JSON payload", 400);

    const eventId = cleanString(body.eventId, 100);
    const fullName = cleanString(body.fullName, 120);
    const email = cleanString(body.email, 160).toLowerCase();
    const institution = cleanString(body.institution, 160) || "Campus Attendee";
    const trackInterest = cleanString(body.trackInterest, 120) || "General Admission";

    if (!eventId) return errorResponse("Event selection is required.", 400);
    if (fullName.length < 2) return errorResponse("Please provide your full name.", 400);
    if (!isValidEmail(email)) return errorResponse("Please provide a valid email address.", 400);

    const events = await readCollection("events", getSeedEvents);
    const target = events.find((e) => e.id === eventId);
    if (!target) return errorResponse("Selected event was not found.", 404);

    const rsvps = await readCollection("rsvps", () => []);
    const duplicate = rsvps.find((r) => r.eventId === eventId && r.email === email);
    if (duplicate) {
      return jsonResponse({
        ok: true,
        alreadyRegistered: true,
        rsvp: duplicate,
        eventTitle: target.title,
        message: "You are already registered for this event.",
      });
    }

    const session = getSessionFromRequest(req);
    const rsvp = {
      id: `rsvp-${crypto.randomUUID().slice(0, 8)}`,
      eventId,
      eventTitle: target.title,
      fullName,
      email,
      institution,
      trackInterest,
      userId: session?.sub || null,
      createdAt: new Date().toISOString(),
    };

    rsvps.unshift(rsvp);
    target.rsvpCount = (target.rsvpCount || 0) + 1;

    await Promise.all([
      writeCollection("rsvps", rsvps),
      writeCollection("events", events),
    ]);

    return jsonResponse(
      {
        ok: true,
        rsvp,
        eventTitle: target.title,
        rsvpCount: target.rsvpCount,
        message: `Registration confirmed for ${target.title}.`,
      },
      201
    );
  }

  return errorResponse("Method not allowed", 405);
}
