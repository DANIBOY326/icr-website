/**
 * Authenticated File & Image Upload endpoint backed by @netlify/blobs ("icr-media").
 * - Any signed-in member can upload a PDF manuscript (<= 4.5 MB)
 * - Executives can also upload JPG / PNG / WebP images (<= 3.5 MB) for headshots & event flyers
 */
import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";
import { getSessionFromRequest } from "./_lib/auth.mjs";
import { cleanString, errorResponse, jsonResponse, parseJsonBody } from "./_lib/http.mjs";

const MEDIA_STORE = "icr-media";
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_PDF_TYPES = new Set(["application/pdf"]);
const MAX_PDF_BYTES = 4.5 * 1024 * 1024;
const MAX_IMG_BYTES = 3.5 * 1024 * 1024;

export default async function handler(req) {
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    return errorResponse("Authentication required to upload files.", 401);
  }

  const body = await parseJsonBody(req);
  if (!body) return errorResponse("Invalid JSON upload payload.", 400);

  const kind = cleanString(body.kind || "pdf", 30); // "pdf" | "image"
  const fileName = cleanString(body.fileName || "upload", 140).replace(/[^a-zA-Z0-9._-]/g, "_");
  const contentType = cleanString(body.contentType || "", 80).toLowerCase();
  const dataBase64 = typeof body.dataBase64 === "string" ? body.dataBase64 : "";

  if (!dataBase64) return errorResponse("Missing file data.", 400);

  if (kind === "image") {
    if (session.role !== "executive") {
      return errorResponse("Executive privileges required to upload site images.", 403);
    }
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      return errorResponse("Only JPG, PNG, or WebP images are allowed.", 400);
    }
  } else {
    if (!ALLOWED_PDF_TYPES.has(contentType)) {
      return errorResponse("Only PDF manuscripts (.pdf) are allowed.", 400);
    }
  }

  const cleanBase64 = dataBase64.includes(",") ? dataBase64.split(",").pop() : dataBase64;
  let buffer;
  try {
    buffer = Buffer.from(cleanBase64, "base64");
  } catch {
    return errorResponse("Could not decode uploaded file.", 400);
  }

  const maxBytes = kind === "image" ? MAX_IMG_BYTES : MAX_PDF_BYTES;
  if (!buffer.length || buffer.length > maxBytes) {
    const mb = (maxBytes / (1024 * 1024)).toFixed(1);
    return errorResponse(`File size must be under ${mb} MB.`, 413);
  }

  const ext =
    contentType === "application/pdf"
      ? "pdf"
      : contentType === "image/png"
      ? "png"
      : contentType === "image/webp"
      ? "webp"
      : "jpg";
  const key = `${kind}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  try {
    const store = getStore(MEDIA_STORE);
    await store.set(key, buffer, {
      metadata: {
        contentType,
        fileName,
        uploadedBy: session.sub,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    return errorResponse("Cloud media storage is unavailable in this environment.", 500, err.message);
  }

  return jsonResponse(
    {
      ok: true,
      key,
      fileName,
      contentType,
      size: buffer.length,
      url: `/api/media?key=${encodeURIComponent(key)}`,
    },
    201
  );
}
