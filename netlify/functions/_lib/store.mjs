/**
 * Persistent data store using @netlify/blobs with seeded real ICR initial data
 * and graceful in-memory fallback when running outside Netlify Blobs context.
 */
import { getStore } from "@netlify/blobs";
import { hashPassword } from "./auth.mjs";

const STORE_NAME = "icr-community-data";
const memoryFallback = new Map();

function getBlobStore() {
  try {
    return getStore(STORE_NAME);
  } catch {
    return null;
  }
}

export async function readCollection(key, defaultFactory) {
  const store = getBlobStore();
  if (store) {
    try {
      const existing = await store.get(key, { type: "json" });
      if (existing !== null && existing !== undefined) return existing;
      const seeded = defaultFactory();
      await store.setJSON(key, seeded);
      return seeded;
    } catch {
      // Fall through to memory fallback if Blobs isn't initialized in local preview
    }
  }
  if (!memoryFallback.has(key)) {
    memoryFallback.set(key, defaultFactory());
  }
  return memoryFallback.get(key);
}

export async function writeCollection(key, value) {
  const store = getBlobStore();
  if (store) {
    try {
      await store.setJSON(key, value);
      return true;
    } catch {
      // Fall through
    }
  }
  memoryFallback.set(key, value);
  return true;
}

export function getSeedPapers() {
  return [
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
}

export function getSeedEvents() {
  return [
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
        {
          title: "AI-Powered Research",
          detail: "Use modern AI tools for systematic literature reviews, discovery, and academic exploration.",
        },
        {
          title: "Academic Writing Mastery",
          detail: "Strengthen academic writing, manuscript editing, proofreading, and referencing precision.",
        },
        {
          title: "Data Analysis & Visualization",
          detail: "Explore AI-assisted quantitative and qualitative analysis, interpretation, and chart design.",
        },
        {
          title: "Research Productivity",
          detail: "Discover structured workflows and citation pipelines that save hours across every study.",
        },
        {
          title: "Ethical AI Practices",
          detail: "Master responsible AI disclosure, academic integrity, plagiarism prevention, and proper referencing.",
        },
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
}

export function getSeedMembers() {
  return {
    executives: [
      {
        id: "exec-1",
        name: "ICR President",
        role: "President & Community Lead",
        focus: "Strategic Vision, Cross-Campus Partnerships & Academic Governance",
        status: "Executive Council",
        initials: "PR",
      },
      {
        id: "exec-2",
        name: "ICR Vice President",
        role: "Vice President",
        focus: "Programs Coordination, Research Clinics & Mentorship",
        status: "Executive Council",
        initials: "VP",
      },
      {
        id: "exec-3",
        name: "Director of Research",
        role: "Research & Publications Lead",
        focus: "Peer-Review Standards, Working Papers & Interdisciplinary Grants",
        status: "Executive Council",
        initials: "DR",
      },
      {
        id: "exec-4",
        name: "Secretary General",
        role: "Secretary",
        focus: "Constitutional Records, Member Onboarding & Meeting Documentation",
        status: "Executive Council",
        initials: "SG",
      },
      {
        id: "exec-5",
        name: "Programs & Events Lead",
        role: "Events & Summit Coordinator",
        focus: "Mega Research Summit, Workshops & Speaker Relations",
        status: "Executive Council",
        initials: "PE",
      },
      {
        id: "exec-6",
        name: "Editorial & Communications Lead",
        role: "Media & Editorial Lead",
        focus: "Academic Publishing, Research Digest & Campus Outreach",
        status: "Executive Council",
        initials: "EC",
      },
    ],
    researchers: [
      {
        id: "res-1",
        name: "Adebayo Blessing",
        cohort: "Current Researcher",
        discipline: "Artificial Intelligence & Healthcare Delivery",
        institution: "ICR Campus Network",
        papersCount: 1,
        bio: "Researches AI applications in diagnostics, treatment planning, and ethical healthcare systems in developing countries.",
      },
      {
        id: "res-2",
        name: "Odelade Janet Anuoluwa",
        cohort: "Current Researcher",
        discipline: "Health Informatics & Applied AI",
        institution: "ICR Campus Network",
        papersCount: 1,
        bio: "Focuses on clinical adoption readiness and ethical implementation of intelligent health tools.",
      },
      {
        id: "res-3",
        name: "Samson Grace",
        cohort: "Current Researcher",
        discipline: "Research Methodology & Academic Integrity",
        institution: "ICR Campus Network",
        papersCount: 1,
        bio: "Active community researcher contributing to collaborative inquiry, peer learning, and scholarly ethics.",
      },
      {
        id: "res-4",
        name: "Oladipupo Funke",
        cohort: "Current Researcher",
        discipline: "Interdisciplinary Applied Research",
        institution: "ICR Campus Network",
        papersCount: 0,
        bio: "Dedicated early-career researcher advancing campus-based collaboration and applied methodology clinics.",
      },
      {
        id: "res-5",
        name: "ICR Alumni Fellows Cohort",
        cohort: "Past Community Researchers",
        discipline: "Multi-Disciplinary Scholars (7 Founding Alumni)",
        institution: "Partner Tertiary Institutions",
        papersCount: 4,
        bio: "Seven pioneering ICR campus researchers who laid the foundation for collaborative peer review, mentorship, and open academic inquiry.",
      },
    ],
  };
}

export function getSeedUsers() {
  return [];
}
