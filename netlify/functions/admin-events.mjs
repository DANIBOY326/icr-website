/**
 * Executive-only Events CMS endpoint (Create, Update, Delete Upcoming Events + Flyer Images).
 */
import crypto from "node:crypto";
import { getSessionFromRequest } from "./_lib/auth.mjs";
import {
  cleanMultiline,
  cleanString,
  errorResponse,
  jsonResponse,
  parseJsonBody,
} from "./_lib/http.mjs";
import { getSeedEvents, readCollection, writeCollection } from "./_lib/store.mjs";

export default async function handler(req) {
  const session = getSessionFromRequest(req);
  if (!session || session.role !== "executive") {
    return errorResponse("Executive Council privileges required.", 403);
  }

  const events = await readCollection("events", getSeedEvents);

  if (req.method === "POST" || req.method === "PUT") {
    const body = await parseJsonBody(req);
    if (!body) return errorResponse("Invalid JSON payload.", 400);

    const id = cleanString(body.id || "", 80);
    const title = cleanString(body.title, 180);
    const tagline = cleanString(body.tagline, 160);
    const badge = cleanString(body.badge, 50) || "ICR Event";
    const dateLabel = cleanString(body.dateLabel, 100);
    const timeLabel = cleanString(body.timeLabel, 100);
    const venue = cleanString(body.venue, 180);
    const audience = cleanString(body.audience, 160) || "Students, Researchers & Innovators";
    const whatsappUrl = cleanString(body.whatsappUrl, 300);
    const flyerUrl = cleanString(body.flyerUrl, 320);
    const description = cleanMultiline(body.description, 2000);
    const featured = Boolean(body.featured);

    if (title.length < 4) return errorResponse("Event title must be at least 4 characters.", 400);
    if (!dateLabel) return errorResponse("Please enter the event date or schedule.", 400);
    if (description.length < 15) return errorResponse("Please enter a short event description.", 400);

    // Parse optional newline-separated tracks: "Track Title: Track detail"
    let tracks = [];
    if (Array.isArray(body.tracks)) {
      tracks = body.tracks
        .map((t) => ({
          title: cleanString(t.title, 100),
          detail: cleanString(t.detail, 240),
        }))
        .filter((t) => t.title);
    } else if (typeof body.tracksText === "string" && body.tracksText.trim()) {
      tracks = body.tracksText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [tTitle, ...rest] = line.split(":");
          return {
            title: cleanString(tTitle, 100),
            detail: cleanString(rest.join(":") || "Interactive session led by ICR scholars.", 240),
          };
        });
    }

    if (featured) {
      events.forEach((ev) => {
        ev.featured = false;
      });
    }

    const existingIdx = id ? events.findIndex((e) => e.id === id) : -1;
    let saved;
    if (existingIdx >= 0) {
      saved = {
        ...events[existingIdx],
        title,
        tagline,
        badge,
        dateLabel,
        timeLabel,
        venue,
        audience,
        whatsappUrl,
        flyerUrl: flyerUrl || events[existingIdx].flyerUrl || "",
        description,
        featured,
        tracks: tracks.length ? tracks : events[existingIdx].tracks || [],
        updatedAt: new Date().toISOString(),
      };
      events[existingIdx] = saved;
    } else {
      saved = {
        id: `evt-${crypto.randomUUID().slice(0, 8)}`,
        title,
        tagline,
        badge,
        featured,
        dateLabel,
        isoDate: new Date().toISOString(),
        timeLabel: timeLabel || "TBA",
        venue: venue || "Hybrid / Virtual",
        audience,
        whatsappUrl: whatsappUrl || "https://chat.whatsapp.com/DAj9PPNiuiGDWyl37SsImX",
        flyerUrl,
        description,
        tracks,
        rsvpCount: 0,
        createdAt: new Date().toISOString(),
      };
      events.unshift(saved);
    }

    await writeCollection("events", events);
    return jsonResponse({ ok: true, event: saved, events }, existingIdx >= 0 ? 200 : 201);
  }

  if (req.method === "DELETE") {
    const body = await parseJsonBody(req);
    const id = cleanString(body?.id || "", 80);
    if (!id) return errorResponse("Event id is required.", 400);

    const next = events.filter((e) => e.id !== id);
    if (next.length === events.length) return errorResponse("Event not found.", 404);
    await writeCollection("events", next);
    return jsonResponse({ ok: true, deletedId: id, events: next });
  }

  return errorResponse("Method not allowed", 405);
}
