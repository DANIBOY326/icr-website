import { errorResponse, jsonResponse } from "./_lib/http.mjs";
import { getSeedMembers, readCollection } from "./_lib/store.mjs";

export default async function handler(req) {
  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }
  const members = await readCollection("members", getSeedMembers);
  return jsonResponse({ ok: true, ...members });
}
