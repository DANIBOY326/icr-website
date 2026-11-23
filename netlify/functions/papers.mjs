import crypto from "node:crypto";
import { getSessionFromRequest } from "./_lib/auth.mjs";
import {
  cleanMultiline,
  cleanString,
  errorResponse,
  jsonResponse,
  parseJsonBody,
} from "./_lib/http.mjs";
import { getSeedPapers, getSeedUsers, readCollection, writeCollection } from "./_lib/store.mjs";

export default async function handler(req) {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const papers = await readCollection("papers", getSeedPapers);
    const session = getSessionFromRequest(req);
    const includePending = session && session.role === "executive" && url.searchParams.get("scope") === "all";
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const category = (url.searchParams.get("category") || "").trim().toLowerCase();

    let results = includePending
      ? papers
      : papers.filter((p) => p.status === "published" || (session && p.submittedBy === session.sub));

    if (category && category !== "all") {
      results = results.filter((p) => p.category.toLowerCase() === category);
    }

    if (q) {
      results = results.filter((p) => {
        const hay = [p.title, ...(p.authors || []), p.category, p.abstract, ...(p.keywords || [])]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    return jsonResponse({ ok: true, count: results.length, papers: results });
  }

  if (req.method === "POST") {
    const session = getSessionFromRequest(req);
    if (!session) {
      return errorResponse("Please sign in to the ICR Member Portal to submit a research paper.", 401);
    }

    const body = await parseJsonBody(req);
    if (!body) return errorResponse("Invalid JSON payload", 400);

    const title = cleanString(body.title, 240);
    const category = cleanString(body.category, 100) || "Interdisciplinary Research";
    const type = cleanString(body.type, 60) || "Research Paper";
    const abstract = cleanMultiline(body.abstract, 3500);
    const authorsRaw = cleanString(body.authors, 240);
    const keywordsRaw = cleanString(body.keywords, 240);
    const pdfUrl = cleanString(body.pdfUrl, 300) || "#abstract-reader";

    if (title.length < 8) return errorResponse("Please enter a complete paper title (at least 8 characters).", 400);
    if (abstract.length < 40) return errorResponse("Please provide a substantive abstract (at least 40 characters).", 400);

    const users = await readCollection("users", getSeedUsers);
    const authorUser = users.find((u) => u.id === session.sub);
    const authors = authorsRaw
      ? authorsRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : [authorUser?.fullName || "ICR Researcher"];
    const keywords = keywordsRaw
      ? keywordsRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : [category];

    const year = new Date().getFullYear();
    const papers = await readCollection("papers", getSeedPapers);
    const newPaper = {
      id: `paper-${crypto.randomUUID().slice(0, 8)}`,
      title,
      authors,
      category,
      type,
      year,
      publishedAt: new Date().toISOString().slice(0, 10),
      status: session.role === "executive" ? "published" : "under_review",
      institution: authorUser?.institution || "Innovative Campus Researchers (ICR)",
      keywords,
      abstract,
      citationApa: `${authors.join(", ")} (${year}). ${title}. Innovative Campus Researchers Working Paper Series.`,
      downloads: 0,
      pdfUrl,
      submittedBy: session.sub,
    };

    papers.unshift(newPaper);
    await writeCollection("papers", papers);

    return jsonResponse({ ok: true, paper: newPaper }, 201);
  }

  if (req.method === "PATCH") {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== "executive") {
      return errorResponse("Executive reviewer privileges required.", 403);
    }

    const body = await parseJsonBody(req);
    if (!body || !body.id || !["published", "under_review"].includes(body.status)) {
      return errorResponse("Valid paper id and status are required.", 400);
    }

    const papers = await readCollection("papers", getSeedPapers);
    const target = papers.find((p) => p.id === body.id);
    if (!target) return errorResponse("Paper not found.", 404);
    target.status = body.status;
    await writeCollection("papers", papers);

    return jsonResponse({ ok: true, paper: target });
  }

  if (req.method === "DELETE") {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== "executive") {
      return errorResponse("Executive reviewer privileges required.", 403);
    }

    const body = await parseJsonBody(req);
    const id = cleanString(body?.id || "", 80);
    if (!id) return errorResponse("Paper id is required.", 400);

    const papers = await readCollection("papers", getSeedPapers);
    const next = papers.filter((p) => p.id !== id);
    if (next.length === papers.length) return errorResponse("Paper not found.", 404);
    await writeCollection("papers", next);

    return jsonResponse({ ok: true, deletedId: id });
  }

  return errorResponse("Method not allowed", 405);
}
