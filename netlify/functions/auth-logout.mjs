import { buildClearSessionCookie, isRequestHttps } from "./_lib/auth.mjs";
import { jsonResponse } from "./_lib/http.mjs";

export default async function handler(req) {
  const cookie = buildClearSessionCookie(isRequestHttps(req));
  return jsonResponse(
    { ok: true, message: "Signed out successfully." },
    200,
    { "Set-Cookie": cookie }
  );
}
