/**
 * Serves uploaded PDFs and Images (Executive headshots, Event flyers) directly from @netlify/blobs ("icr-media").
 */
import { getStore } from "@netlify/blobs";

const MEDIA_STORE = "icr-media";

export default async function handler(req) {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const key = (url.searchParams.get("key") || "").trim();
  if (!key || !/^[a-zA-Z0-9._-]+$/.test(key)) {
    return new Response("Invalid media key", { status: 400 });
  }

  try {
    const store = getStore(MEDIA_STORE);
    const result = await store.getWithMetadata(key, { type: "arrayBuffer" });
    if (!result || !result.data) {
      return new Response("File not found", { status: 404 });
    }

    const contentType = result.metadata?.contentType || "application/octet-stream";
    const fileName = result.metadata?.fileName || key;
    const isPdf = contentType === "application/pdf";

    return new Response(result.data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${isPdf ? "inline" : "inline"}; filename="${fileName}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Failed to retrieve media", { status: 500 });
  }
}
