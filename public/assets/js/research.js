import { ICR } from "./api.js";
import { escapeHtml, showToast } from "./app.js";

let allPapers = [];
let activeCategory = "all";

function renderPapers(list) {
  const grid = document.getElementById("papers-grid");
  const countEl = document.getElementById("papers-count");
  if (!grid) return;

  if (countEl) {
    countEl.textContent = `${list.length} ${list.length === 1 ? "publication" : "publications"}`;
  }

  if (!list.length) {
    grid.innerHTML = `
      <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 48px 24px;">
        <h3>No matching papers found</h3>
        <p style="max-width: 460px; margin: 8px auto 18px;">Try clearing your search query or switching discipline filters—or submit your own working paper through the ICR Member Portal.</p>
        <div><a href="/portal.html" class="btn btn-primary">Submit a Research Paper</a></div>
      </div>`;
    return;
  }

  grid.innerHTML = list
    .map(
      (p) => `
      <article class="card card-interactive paper-card">
        <div class="paper-meta">
          <span class="badge badge-crimson">${escapeHtml(p.category)}</span>
          <span class="badge badge-navy">${escapeHtml(p.type)} · ${escapeHtml(p.year)}</span>
        </div>
        <h3>${escapeHtml(p.title)}</h3>
        <div class="paper-authors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span>${escapeHtml((p.authors || []).join(", "))}</span>
        </div>
        <p class="paper-abstract">${escapeHtml(p.abstract)}</p>
        <div class="tag-row">
          ${(p.keywords || []).slice(0, 4).map((k) => `<span class="tag">${escapeHtml(k)}</span>`).join("")}
        </div>
        <div class="paper-footer">
          <span style="font-size:0.8rem; color: var(--ink-400);">Published ${escapeHtml(p.publishedAt)}</span>
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn btn-outline btn-sm" data-cite-id="${escapeHtml(p.id)}">Cite (APA)</button>
            <button type="button" class="btn btn-primary btn-sm" data-read-id="${escapeHtml(p.id)}">Read Abstract</button>
          </div>
        </div>
      </article>`
    )
    .join("");
}

function applyFilters() {
  const q = (document.getElementById("paper-search")?.value || "").trim().toLowerCase();
  const filtered = allPapers.filter((p) => {
    const catOk = activeCategory === "all" || p.category.toLowerCase() === activeCategory.toLowerCase();
    if (!catOk) return false;
    if (!q) return true;
    const hay = [p.title, ...(p.authors || []), p.category, p.abstract, ...(p.keywords || [])].join(" ").toLowerCase();
    return hay.includes(q);
  });
  renderPapers(filtered);
}

function openPaperModal(paper) {
  const modal = document.getElementById("paper-modal");
  const body = document.getElementById("paper-modal-body");
  if (!modal || !body || !paper) return;

  body.innerHTML = `
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px;">
      <span class="badge badge-crimson">${escapeHtml(paper.category)}</span>
      <span class="badge badge-navy">${escapeHtml(paper.type)} · ${escapeHtml(paper.year)}</span>
    </div>
    <h2 style="font-size:1.55rem; margin-bottom:10px;">${escapeHtml(paper.title)}</h2>
    <p style="font-weight:600; color:var(--navy-800); margin-bottom:16px;">
      By ${escapeHtml((paper.authors || []).join(", "))} · <span style="font-weight:400; color:var(--ink-600);">${escapeHtml(paper.institution || "ICR")}</span>
    </p>
    <h4 style="font-size:0.86rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--ink-400); margin-bottom:8px;">Full Abstract</h4>
    <p style="color:var(--ink-700); line-height:1.75; margin-bottom:18px;">${escapeHtml(paper.abstract)}</p>
    <div class="tag-row" style="margin-bottom:20px;">
      ${(paper.keywords || []).map((k) => `<span class="tag">${escapeHtml(k)}</span>`).join("")}
    </div>
    <h4 style="font-size:0.86rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--ink-400); margin-bottom:6px;">Recommended Citation (APA)</h4>
    <div class="citation-box">${escapeHtml(paper.citationApa)}</div>
    <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:18px;">
      <button type="button" class="btn btn-primary" id="modal-copy-cite">Copy APA Citation</button>
      ${
        paper.pdfUrl && paper.pdfUrl !== "#abstract-reader"
          ? `<a href="${escapeHtml(paper.pdfUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-navy">Open / Download Full PDF →</a>`
          : `<a href="mailto:icr2026@gmail.com?subject=${encodeURIComponent("Manuscript Request: " + paper.title)}" class="btn btn-outline">Request Full PDF via ICR</a>`
      }
    </div>
  `;

  document.getElementById("modal-copy-cite")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(paper.citationApa);
      showToast("APA citation copied to clipboard!", "success");
    } catch {
      showToast("Citation ready to copy from the box above.", "info");
    }
  });

  modal.classList.add("open");
}

async function init() {
  const res = await ICR.getPapers();
  allPapers = res.papers || [];

  const chipWrap = document.getElementById("category-chips");
  if (chipWrap) {
    const categories = ["all", ...new Set(allPapers.map((p) => p.category))];
    chipWrap.innerHTML = categories
      .map(
        (cat) => `
        <button type="button" class="chip ${cat === "all" ? "active" : ""}" data-cat="${escapeHtml(cat)}">
          ${cat === "all" ? "All Disciplines" : escapeHtml(cat)}
        </button>`
      )
      .join("");

    chipWrap.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-cat]");
      if (!btn) return;
      activeCategory = btn.dataset.cat;
      chipWrap.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === btn));
      applyFilters();
    });
  }

  document.getElementById("paper-search")?.addEventListener("input", applyFilters);

  document.getElementById("papers-grid")?.addEventListener("click", async (e) => {
    const readBtn = e.target.closest("[data-read-id]");
    const citeBtn = e.target.closest("[data-cite-id]");
    if (readBtn) {
      const paper = allPapers.find((p) => p.id === readBtn.dataset.readId);
      openPaperModal(paper);
    } else if (citeBtn) {
      const paper = allPapers.find((p) => p.id === citeBtn.dataset.citeId);
      if (paper) {
        try {
          await navigator.clipboard.writeText(paper.citationApa);
          showToast("APA citation copied to clipboard!", "success");
        } catch {
          openPaperModal(paper);
        }
      }
    }
  });

  const modal = document.getElementById("paper-modal");
  document.getElementById("paper-modal-close")?.addEventListener("click", () => modal?.classList.remove("open"));
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.remove("open");
  });

  renderPapers(allPapers);
}

document.addEventListener("DOMContentLoaded", init);
