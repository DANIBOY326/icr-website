/**
 * ICR Unified API Client
 * Connects natively to Netlify Functions (/api/*) with automatic seamless local fallback
 * if previewed statically without a Netlify Functions server running.
 */

const LOCAL_KEYS = {
  papers: "icr_local_papers_v1",
  events: "icr_local_events_v1",
  members: "icr_local_members_v1",
  user: "icr_local_user_v1",
  users: "icr_local_users_v1",
  rsvps: "icr_local_rsvps_v1",
  newsletter: "icr_local_newsletter_v1",
  apps: "icr_local_apps_v1",
};

const SEED_PAPERS = [
  {
    id: "paper-ai-healthcare-2026-01",
    title: "The Role of Artificial Intelligence in Healthcare Delivery: Opportunities, Ethical Implications, and Future Directions",
    authors: ["Adebayo Blessing"],
    category: "Artificial Intelligence & Healthcare",
    type: "Research Paper",
    year: 2026,
    publishedAt: "2026-02-18",
    status: "published",
    institution: "Innovative Campus Researchers (ICR)",
    keywords: ["Artificial Intelligence", "Healthcare Delivery", "Bioethics", "Developing Countries", "Clinical Diagnostics"],
    abstract:
      "This paper explores how artificial intelligence is transforming modern healthcare delivery across diagnosis, treatment planning, and continuous patient monitoring. Alongside evaluating measurable clinical gains, the study critically examines pressing ethical challenges including patient data privacy, algorithmic bias, and equitable governance—highlighting pathways for responsible AI integration within healthcare systems in developing countries.",
    citationApa:
      "Adebayo, B. (2026). The role of artificial intelligence in healthcare delivery: Opportunities, ethical implications, and future directions. Innovative Campus Researchers Working Paper Series, ICR-2026-01.",
    downloads: 48,
    pdfUrl: "#abstract-reader",
  },
  {
    id: "paper-ai-clinical-2026-02",
    title: "Evaluating Applied AI Systems in Campus & Community Clinical Workflows: Challenges and Adoption Readiness",
    authors: ["Odelade Janet Anuoluwa"],
    category: "Artificial Intelligence & Healthcare",
    type: "Research Paper",
    year: 2026,
    publishedAt: "2026-03-04",
    status: "published",
    institution: "Innovative Campus Researchers (ICR)",
    keywords: ["Applied AI", "Clinical Workflows", "Health Informatics", "Ethics", "Policy"],
    abstract:
      "Focusing on practical adoption barriers within resource-constrained health ecosystems, this study analyzes clinician readiness, institutional infrastructure, and ethical safeguards required to move artificial intelligence from research prototypes to reliable patient-facing healthcare workflows.",
    citationApa:
      "Odelade, J. A. (2026). Evaluating applied AI systems in campus and community clinical workflows: Challenges and adoption readiness. Innovative Campus Researchers Working Paper Series, ICR-2026-02.",
    downloads: 34,
    pdfUrl: "#abstract-reader",
  },
  {
    id: "paper-ethics-methodology-2026-03",
    title: "Responsible AI Tools in Undergraduate & Postgraduate Academic Writing: A Framework for Scholarly Integrity",
    authors: ["ICR Research Methods Working Group", "Samson Grace"],
    category: "Research Methodology & Ethics",
    type: "Policy Brief",
    year: 2026,
    publishedAt: "2026-04-12",
    status: "published",
    institution: "Innovative Campus Researchers (ICR)",
    keywords: ["Academic Integrity", "AI Literacy", "Peer Review", "Citation Standards"],
    abstract:
      "As generative AI tools reshape literature discovery, editing, and data analysis across campuses, early-career scholars need clear guardrails. This ICR policy brief outlines transparent disclosure norms, citation verification checklists, and anti-plagiarism standards aligned with international academic publishing ethics.",
    citationApa:
      "ICR Research Methods Working Group, & Samson, G. (2026). Responsible AI tools in undergraduate and postgraduate academic writing: A framework for scholarly integrity. Innovative Campus Researchers Policy Brief, ICR-PB-03.",
    downloads: 61,
    pdfUrl: "#abstract-reader",
  },
];

const SEED_EVENTS = [
  {
    id: "evt-mega-summit-2026",
    title: "First Campus Mega Research Summit",
    tagline: "Research Smarter. Achieve More.",
    badge: "Flagship Summit",
    featured: true,
    dateLabel: "Upcoming Cohort · 2026",
    isoDate: "2026-12-12T10:00:00+01:00",
    timeLabel: "10:00 AM – 3:00 PM WAT",
    venue: "Hybrid (Campus Auditorium & Live Virtual Stream)",
    audience: "Students, Lecturers, Early-Career Researchers & Innovators",
    whatsappUrl: "https://chat.whatsapp.com/DAj9PPNiuiGDWyl37SsImX",
    description:
      "A collaborative campus-wide platform for students, researchers, academics, and innovation enthusiasts ready to transform how academic research is conducted using Artificial Intelligence responsibly and rigorously.",
    tracks: [
      { title: "AI-Powered Research", detail: "Use modern AI tools for systematic literature reviews, discovery, and academic exploration." },
      { title: "Academic Writing Mastery", detail: "Strengthen academic writing, manuscript editing, proofreading, and referencing precision." },
      { title: "Data Analysis & Visualization", detail: "Explore AI-assisted quantitative and qualitative analysis, interpretation, and chart design." },
      { title: "Research Productivity", detail: "Discover structured workflows and citation pipelines that save hours across every study." },
      { title: "Ethical AI Practices", detail: "Master responsible AI disclosure, academic integrity, plagiarism prevention, and proper referencing." },
    ],
    rsvpCount: 142,
  },
  {
    id: "evt-methodology-clinic-2026",
    title: "Monthly Research Methodology & Peer-Review Clinic",
    tagline: "From Rough Idea to Publishable Proposal",
    badge: "Hands-On Clinic",
    featured: false,
    dateLabel: "Last Saturday Monthly",
    isoDate: "2026-11-28T16:00:00+01:00",
    timeLabel: "4:00 PM – 6:00 PM WAT",
    venue: "Virtual Seminar Room (Registered Members)",
    audience: "ICR Members & Undergraduate/Postgraduate Candidates",
    whatsappUrl: "https://chat.whatsapp.com/DAj9PPNiuiGDWyl37SsImX",
    description:
      "Bring your research question, thesis chapter, or draft abstract for structured peer critique, research design feedback, and live mentorship from senior campus scholars.",
    tracks: [
      { title: "Problem Statement Framing", detail: "Tighten scope, novelty, and testable hypotheses." },
      { title: "Methodology Selection", detail: "Match quantitative, qualitative, or mixed methods to your data." },
      { title: "Peer Review Walkthrough", detail: "Live constructive manuscript feedback in small breakout rooms." },
    ],
    rsvpCount: 58,
  },
  {
    id: "evt-publication-bootcamp-2027",
    title: "Academic Publishing & Journal Readiness Workshop",
    tagline: "Navigating Peer Review & Indexing",
    badge: "Workshop",
    featured: false,
    dateLabel: "Q1 2027 Cohort",
    isoDate: "2027-01-23T14:00:00+01:00",
    timeLabel: "2:00 PM – 4:30 PM WAT",
    venue: "Virtual Workshop (Open Registration)",
    audience: "Early-Career Scholars & Final-Year Students",
    whatsappUrl: "https://chat.whatsapp.com/DAj9PPNiuiGDWyl37SsImX",
    description:
      "Learn how to select reputable peer-reviewed journals, avoid predatory outlets, format manuscripts cleanly, and respond professionally to reviewer comments.",
    tracks: [
      { title: "Journal Selection", detail: "Evaluating scope, indexing, and open-access policies." },
      { title: "Manuscript Polish", detail: "Structuring abstracts, methods, tables, and references." },
    ],
    rsvpCount: 39,
  },
];

const SEED_MEMBERS = {
  executives: [
    { id: "exec-1", name: "ICR President", role: "President & Community Lead", focus: "Strategic Vision, Cross-Campus Partnerships & Academic Governance", status: "Executive Council", initials: "PR" },
    { id: "exec-2", name: "ICR Vice President", role: "Vice President", focus: "Programs Coordination, Research Clinics & Mentorship", status: "Executive Council", initials: "VP" },
    { id: "exec-3", name: "Director of Research", role: "Research & Publications Lead", focus: "Peer-Review Standards, Working Papers & Interdisciplinary Grants", status: "Executive Council", initials: "DR" },
    { id: "exec-4", name: "Secretary General", role: "Secretary", focus: "Constitutional Records, Member Onboarding & Meeting Documentation", status: "Executive Council", initials: "SG" },
    { id: "exec-5", name: "Programs & Events Lead", role: "Events & Summit Coordinator", focus: "Mega Research Summit, Workshops & Speaker Relations", status: "Executive Council", initials: "PE" },
    { id: "exec-6", name: "Editorial & Communications Lead", role: "Media & Editorial Lead", focus: "Academic Publishing, Research Digest & Campus Outreach", status: "Executive Council", initials: "EC" },
  ],
  researchers: [
    { id: "res-1", name: "Adebayo Blessing", cohort: "Current Researcher", discipline: "Artificial Intelligence & Healthcare Delivery", institution: "ICR Campus Network", papersCount: 1, bio: "Researches AI applications in diagnostics, treatment planning, and ethical healthcare systems in developing countries." },
    { id: "res-2", name: "Odelade Janet Anuoluwa", cohort: "Current Researcher", discipline: "Health Informatics & Applied AI", institution: "ICR Campus Network", papersCount: 1, bio: "Focuses on clinical adoption readiness and ethical implementation of intelligent health tools." },
    { id: "res-3", name: "Samson Grace", cohort: "Current Researcher", discipline: "Research Methodology & Academic Integrity", institution: "ICR Campus Network", papersCount: 1, bio: "Active community researcher contributing to collaborative inquiry, peer learning, and scholarly ethics." },
    { id: "res-4", name: "Oladipupo Funke", cohort: "Current Researcher", discipline: "Interdisciplinary Applied Research", institution: "ICR Campus Network", papersCount: 0, bio: "Dedicated early-career researcher advancing campus-based collaboration and applied methodology clinics." },
    { id: "res-5", name: "ICR Alumni Fellows Cohort", cohort: "Past Community Researchers", discipline: "Multi-Disciplinary Scholars (7 Founding Alumni)", institution: "Partner Tertiary Institutions", papersCount: 4, bio: "Seven pioneering ICR campus researchers who laid the foundation for collaborative peer review, mentorship, and open academic inquiry." },
  ],
};

function readLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // ignore quota errors
  }
}

async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    throw new Error("NON_JSON_FALLBACK");
  }
  const data = await res.json();
  if (!res.ok && !data.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.isApiError = true;
    throw err;
  }
  return data;
}

export async function submitNetlifyForm(formElement) {
  try {
    const body = new URLSearchParams(new FormData(formElement)).toString();
    await fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch {
    // Non-fatal in local preview
  }
}

export const ICR = {
  async getMe() {
    try {
      return await apiFetch("/api/auth-me");
    } catch (e) {
      if (e.isApiError) throw e;
      const user = readLocal(LOCAL_KEYS.user, null);
      return { ok: !!user, authenticated: !!user, user };
    }
  },

  async login(payload) {
    try {
      return await apiFetch("/api/auth-login", { method: "POST", body: JSON.stringify(payload) });
    } catch (e) {
      if (e.isApiError) throw e;
      // Local static fallback
      const users = readLocal(LOCAL_KEYS.users, []);
      const found = users.find((u) => u.email.toLowerCase() === payload.email.toLowerCase() && u.password === payload.password);
      if (!found) throw new Error("Invalid email or password.");
      const { password, ...safe } = found;
      writeLocal(LOCAL_KEYS.user, safe);
      return { ok: true, user: safe };
    }
  },

  async register(payload) {
    try {
      return await apiFetch("/api/auth-register", { method: "POST", body: JSON.stringify(payload) });
    } catch (e) {
      if (e.isApiError) throw e;
      const users = readLocal(LOCAL_KEYS.users, []);
      if (users.some((u) => u.email.toLowerCase() === payload.email.toLowerCase())) {
        throw new Error("An account with this email already exists.");
      }
      const created = {
        id: `local-${Date.now()}`,
        role: "member",
        ...payload,
        createdAt: new Date().toISOString(),
      };
      users.push(created);
      writeLocal(LOCAL_KEYS.users, users);
      const { password, ...safe } = created;
      writeLocal(LOCAL_KEYS.user, safe);
      return { ok: true, user: safe };
    }
  },

  async updateProfile(payload) {
    try {
      return await apiFetch("/api/auth-me", { method: "PATCH", body: JSON.stringify(payload) });
    } catch (e) {
      if (e.isApiError) throw e;
      const cur = readLocal(LOCAL_KEYS.user, null);
      if (!cur) throw new Error("Not signed in.");
      const updated = { ...cur, ...payload };
      writeLocal(LOCAL_KEYS.user, updated);
      return { ok: true, authenticated: true, user: updated };
    }
  },

  async logout() {
    try {
      return await apiFetch("/api/auth-logout", { method: "POST" });
    } catch {
      writeLocal(LOCAL_KEYS.user, null);
      return { ok: true };
    }
  },

  async getPapers(params = {}) {
    try {
      const qs = new URLSearchParams(params).toString();
      return await apiFetch(`/api/papers${qs ? `?${qs}` : ""}`);
    } catch (e) {
      if (e.isApiError) throw e;
      let papers = readLocal(LOCAL_KEYS.papers, SEED_PAPERS);
      if (params.category && params.category !== "all") {
        papers = papers.filter((p) => p.category.toLowerCase() === params.category.toLowerCase());
      }
      if (params.q) {
        const q = params.q.toLowerCase();
        papers = papers.filter((p) =>
          [p.title, ...(p.authors || []), p.category, p.abstract, ...(p.keywords || [])].join(" ").toLowerCase().includes(q)
        );
      }
      return { ok: true, count: papers.length, papers };
    }
  },

  async submitPaper(payload) {
    try {
      return await apiFetch("/api/papers", { method: "POST", body: JSON.stringify(payload) });
    } catch (e) {
      if (e.isApiError) throw e;
      const user = readLocal(LOCAL_KEYS.user, null);
      if (!user) throw new Error("Please sign in to submit a paper.");
      const papers = readLocal(LOCAL_KEYS.papers, SEED_PAPERS);
      const paper = {
        id: `paper-${Date.now()}`,
        title: payload.title,
        authors: (payload.authors || user.fullName).split(",").map((s) => s.trim()).filter(Boolean),
        category: payload.category || "Interdisciplinary Research",
        type: payload.type || "Research Paper",
        year: new Date().getFullYear(),
        publishedAt: new Date().toISOString().slice(0, 10),
        status: user.role === "executive" ? "published" : "under_review",
        institution: user.institution || "ICR Campus Network",
        keywords: (payload.keywords || payload.category || "Research").split(",").map((s) => s.trim()).filter(Boolean),
        abstract: payload.abstract,
        citationApa: `${payload.authors || user.fullName} (${new Date().getFullYear()}). ${payload.title}. Innovative Campus Researchers Working Paper Series.`,
        downloads: 0,
        pdfUrl: payload.pdfUrl || "#abstract-reader",
        submittedBy: user.id,
      };
      papers.unshift(paper);
      writeLocal(LOCAL_KEYS.papers, papers);
      return { ok: true, paper };
    }
  },

  async updatePaperStatus(id, status) {
    try {
      return await apiFetch("/api/papers", { method: "PATCH", body: JSON.stringify({ id, status }) });
    } catch (e) {
      if (e.isApiError) throw e;
      const papers = readLocal(LOCAL_KEYS.papers, SEED_PAPERS);
      const t = papers.find((p) => p.id === id);
      if (t) t.status = status;
      writeLocal(LOCAL_KEYS.papers, papers);
      return { ok: true, paper: t };
    }
  },

  async getEvents() {
    try {
      return await apiFetch("/api/events");
    } catch (e) {
      if (e.isApiError) throw e;
      return {
        ok: true,
        events: readLocal(LOCAL_KEYS.events, SEED_EVENTS),
        myRsvps: readLocal(LOCAL_KEYS.rsvps, []),
      };
    }
  },

  async rsvpEvent(payload) {
    try {
      return await apiFetch("/api/events", { method: "POST", body: JSON.stringify(payload) });
    } catch (e) {
      if (e.isApiError) throw e;
      const rsvps = readLocal(LOCAL_KEYS.rsvps, []);
      const rec = { id: `rsvp-${Date.now()}`, ...payload, createdAt: new Date().toISOString() };
      rsvps.unshift(rec);
      writeLocal(LOCAL_KEYS.rsvps, rsvps);
      return { ok: true, rsvp: rec, message: "Your seat is reserved!" };
    }
  },

  async getMembers() {
    try {
      return await apiFetch("/api/members");
    } catch {
      return { ok: true, ...readLocal(LOCAL_KEYS.members, SEED_MEMBERS) };
    }
  },

  async subscribeNewsletter(email) {
    try {
      return await apiFetch("/api/newsletter", { method: "POST", body: JSON.stringify({ email }) });
    } catch (e) {
      if (e.isApiError) throw e;
      const subs = readLocal(LOCAL_KEYS.newsletter, []);
      if (subs.includes(email.toLowerCase())) {
        return { ok: true, message: "You are already subscribed to the ICR Research Digest." };
      }
      subs.push(email.toLowerCase());
      writeLocal(LOCAL_KEYS.newsletter, subs);
      return { ok: true, message: "Welcome aboard! You are subscribed to the ICR Research Digest." };
    }
  },

  async submitApplication(payload) {
    try {
      return await apiFetch("/api/applications", { method: "POST", body: JSON.stringify(payload) });
    } catch (e) {
      if (e.isApiError) throw e;
      const apps = readLocal(LOCAL_KEYS.apps, []);
      const rec = { id: `app-${Date.now()}`, ...payload, submittedAt: new Date().toISOString() };
      apps.unshift(rec);
      writeLocal(LOCAL_KEYS.apps, apps);
      return { ok: true, applicationId: rec.id, message: "Your ICR membership application has been received!" };
    }
  },

  async getApplications() {
    try {
      return await apiFetch("/api/applications");
    } catch (e) {
      if (e.isApiError) throw e;
      return { ok: true, applications: readLocal(LOCAL_KEYS.apps, []) };
    }
  },

  async uploadFile(file, kind = "pdf") {
    const dataBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read selected file."));
      reader.readAsDataURL(file);
    });
    return apiFetch("/api/uploads", {
      method: "POST",
      body: JSON.stringify({
        kind,
        fileName: file.name,
        contentType: file.type,
        dataBase64,
      }),
    });
  },

  async deletePaper(id) {
    try {
      return await apiFetch("/api/papers", { method: "DELETE", body: JSON.stringify({ id }) });
    } catch (e) {
      if (e.isApiError) throw e;
      const papers = readLocal(LOCAL_KEYS.papers, SEED_PAPERS).filter((p) => p.id !== id);
      writeLocal(LOCAL_KEYS.papers, papers);
      return { ok: true, deletedId: id };
    }
  },

  async saveEvent(payload) {
    try {
      return await apiFetch("/api/admin-events", { method: "POST", body: JSON.stringify(payload) });
    } catch (e) {
      if (e.isApiError) throw e;
      const events = readLocal(LOCAL_KEYS.events, SEED_EVENTS);
      const saved = { id: payload.id || `evt-${Date.now()}`, rsvpCount: 0, ...payload };
      const idx = events.findIndex((ev) => ev.id === saved.id);
      if (idx >= 0) events[idx] = saved;
      else events.unshift(saved);
      writeLocal(LOCAL_KEYS.events, events);
      return { ok: true, event: saved, events };
    }
  },

  async deleteEvent(id) {
    try {
      return await apiFetch("/api/admin-events", { method: "DELETE", body: JSON.stringify({ id }) });
    } catch (e) {
      if (e.isApiError) throw e;
      const events = readLocal(LOCAL_KEYS.events, SEED_EVENTS).filter((ev) => ev.id !== id);
      writeLocal(LOCAL_KEYS.events, events);
      return { ok: true, deletedId: id, events };
    }
  },

  async saveExecutive(payload) {
    try {
      return await apiFetch("/api/admin-executives", { method: "POST", body: JSON.stringify(payload) });
    } catch (e) {
      if (e.isApiError) throw e;
      const dir = readLocal(LOCAL_KEYS.members, SEED_MEMBERS);
      const saved = { id: payload.id || `exec-${Date.now()}`, ...payload };
      const idx = dir.executives.findIndex((ex) => ex.id === saved.id);
      if (idx >= 0) dir.executives[idx] = saved;
      else dir.executives.push(saved);
      writeLocal(LOCAL_KEYS.members, dir);
      return { ok: true, executive: saved, executives: dir.executives };
    }
  },

  async deleteExecutive(id) {
    try {
      return await apiFetch("/api/admin-executives", { method: "DELETE", body: JSON.stringify({ id }) });
    } catch (e) {
      if (e.isApiError) throw e;
      const dir = readLocal(LOCAL_KEYS.members, SEED_MEMBERS);
      dir.executives = dir.executives.filter((ex) => ex.id !== id);
      writeLocal(LOCAL_KEYS.members, dir);
      return { ok: true, deletedId: id, executives: dir.executives };
    }
  },
};
