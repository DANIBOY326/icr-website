import { ICR } from "./api.js";
import { escapeHtml, getInitials } from "./app.js";

let researchersList = [];
let activeCohort = "all";

function renderExecutives(executives) {
  const grid = document.getElementById("executives-grid");
  if (!grid) return;
  grid.innerHTML = executives
    .map(
      (ex) => `
      <article class="card card-interactive person-card">
        <div class="person-top">
          <div class="avatar-circle" style="overflow:hidden;">
            ${
              ex.photoUrl
                ? `<img src="${escapeHtml(ex.photoUrl)}" alt="${escapeHtml(ex.name)}" style="width:100%; height:100%; object-fit:cover;" />`
                : escapeHtml(ex.initials || getInitials(ex.name))
            }
          </div>
          <div>
            <h3 style="font-size:1.08rem; margin-bottom:2px;">${escapeHtml(ex.name)}</h3>
            <div class="person-role">${escapeHtml(ex.role)}</div>
          </div>
        </div>
        <p style="font-size:0.92rem;">${escapeHtml(ex.focus)}</p>
        <div style="margin-top:auto;">
          <span class="badge badge-gold">${escapeHtml(ex.status)}</span>
        </div>
      </article>`
    )
    .join("");
}

function renderResearchers() {
  const grid = document.getElementById("researchers-grid");
  if (!grid) return;
  const q = (document.getElementById("member-search")?.value || "").trim().toLowerCase();

  const filtered = researchersList.filter((r) => {
    const cohortOk = activeCohort === "all" || r.cohort === activeCohort;
    if (!cohortOk) return false;
    if (!q) return true;
    return [r.name, r.discipline, r.institution, r.bio].join(" ").toLowerCase().includes(q);
  });

  if (!filtered.length) {
    grid.innerHTML = `<div class="card" style="grid-column:1/-1; text-align:center; padding:36px;"><h3>No matching researchers</h3><p>Try another name or research discipline.</p></div>`;
    return;
  }

  grid.innerHTML = filtered
    .map(
      (r) => `
      <article class="card card-interactive person-card">
        <div class="person-top">
          <div class="avatar-circle" style="background:linear-gradient(135deg,var(--navy-900),var(--navy-700)); overflow:hidden;">
            ${
              r.photoUrl
                ? `<img src="${escapeHtml(r.photoUrl)}" alt="${escapeHtml(r.name)}" style="width:100%; height:100%; object-fit:cover;" />`
                : escapeHtml(getInitials(r.name))
            }
          </div>
          <div>
            <h3 style="font-size:1.08rem; margin-bottom:2px;">${escapeHtml(r.name)}</h3>
            <div class="person-role">${escapeHtml(r.academicLevel ? `${r.cohort} · ${r.academicLevel}` : r.cohort)}</div>
          </div>
        </div>
        <div style="font-size:0.86rem; font-weight:600; color:var(--navy-800);">${escapeHtml(r.discipline)}</div>
        <p style="font-size:0.92rem;">${escapeHtml(r.bio)}</p>
        <div class="paper-footer" style="padding-top:12px;">
          <span style="font-size:0.8rem; color:var(--ink-400);">${escapeHtml(r.institution)}</span>
          <span class="badge badge-navy">${r.papersCount || 0} ${r.papersCount === 1 ? "Paper" : "Papers"}</span>
        </div>
      </article>`
    )
    .join("");
}

async function init() {
  const data = await ICR.getMembers();
  renderExecutives(data.executives || []);
  researchersList = data.researchers || [];
  renderResearchers();

  document.getElementById("member-search")?.addEventListener("input", renderResearchers);
  document.getElementById("cohort-chips")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cohort]");
    if (!btn) return;
    activeCohort = btn.dataset.cohort;
    document.querySelectorAll("#cohort-chips .chip").forEach((c) => c.classList.toggle("active", c === btn));
    renderResearchers();
  });
}

document.addEventListener("DOMContentLoaded", init);
