import { ICR, submitNetlifyForm } from "./api.js";
import { escapeHtml, getInitials, showToast } from "./app.js";

let currentUser = null;
let cachedEvents = [];
let cachedExecutives = [];
let cachedAdminUsers = [];

function setAuthTab(mode) {
  const loginForm = document.getElementById("login-form");
  const regForm = document.getElementById("register-form");
  const resetView = document.getElementById("reset-view");
  const authAlert = document.getElementById("auth-alert");
  if (authAlert) authAlert.className = "alert";
  document.querySelectorAll("[data-auth-tab]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.authTab === mode);
  });
  if (loginForm) loginForm.style.display = mode === "login" ? "block" : "none";
  if (regForm) regForm.style.display = mode === "register" ? "block" : "none";
  if (resetView) resetView.style.display = mode === "reset" ? "block" : "none";
}

function setPortalPanel(panelId) {
  document.querySelectorAll("[data-portal-tab]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.portalTab === panelId);
  });
  document.querySelectorAll("[data-portal-panel]").forEach((panel) => {
    panel.style.display = panel.dataset.portalPanel === panelId ? "block" : "none";
  });
}

function renderAvatarEl(el, fullName, photoUrl) {
  if (!el) return;
  if (photoUrl) {
    el.innerHTML = `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(fullName || "Profile")}" style="width:100%; height:100%; object-fit:cover;" />`;
  } else {
    el.textContent = getInitials(fullName);
  }
}

function setEventFlyerPreview(url) {
  const wrap = document.getElementById("ev-flyer-preview-wrap");
  const img = document.getElementById("ev-flyer-preview-img");
  if (!wrap || !img) return;
  if (url) {
    img.src = url;
    wrap.style.display = "block";
  } else {
    img.src = "";
    wrap.style.display = "none";
  }
}

function bindFileUploader(fileInputId, targetUrlId, statusId, kind, onUploaded) {
  const fileInput = document.getElementById(fileInputId);
  const urlInput = document.getElementById(targetUrlId);
  const statusEl = document.getElementById(statusId);
  if (!fileInput || !urlInput) return;

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    // PDFs cap at 4.5 MB; images auto-optimize in-browser so accept up to 25 MB source files!
    const maxMb = kind === "pdf" ? 4.5 : 25;
    if (file.size > maxMb * 1024 * 1024) {
      showToast(`File is too large. Max size is ${maxMb} MB.`, "error");
      fileInput.value = "";
      return;
    }

    const parentForm = fileInput.closest("form");
    const submitBtn = parentForm?.querySelector('button[type="submit"]');
    const origBtnText = submitBtn?.textContent;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Uploading file...";
    }
    if (statusEl) statusEl.textContent = kind === "pdf" ? `Uploading ${file.name}...` : `Optimizing & uploading ${file.name}...`;
    try {
      const res = await ICR.uploadFile(file, kind);
      urlInput.value = res.url;
      if (statusEl) statusEl.textContent = `Uploaded: ${res.fileName} (${Math.round(res.size / 1024)} KB) — ready to save!`;
      showToast(`Uploaded ${res.fileName} to ICR Cloud Storage!`, "success");
      if (typeof onUploaded === "function") onUploaded(res);
    } catch (err) {
      if (statusEl) statusEl.textContent = err.message || "Upload failed.";
      showToast(err.message || "File upload failed.", "error");
      fileInput.value = "";
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = origBtnText;
      }
    }
  });
}

async function renderDashboard(user) {
  currentUser = user;
  document.getElementById("auth-view").style.display = "none";
  document.getElementById("dashboard-view").style.display = "block";

  renderAvatarEl(document.getElementById("dash-avatar"), user.fullName, user.photoUrl);
  renderAvatarEl(document.getElementById("prof-avatar-preview"), user.fullName, user.photoUrl);
  document.getElementById("dash-name").textContent = user.fullName;
  const roleLabel = user.role === "executive" ? "Executive Council" : "ICR Member";
  document.getElementById("dash-role").textContent = roleLabel;
  document.getElementById("dash-institution").textContent = user.institution || "ICR Campus Network";

  const emailDisp = document.getElementById("prof-email-display");
  const roleDisp = document.getElementById("prof-role-display");
  if (emailDisp) emailDisp.textContent = user.email || "";
  if (roleDisp) roleDisp.textContent = `${roleLabel}${user.academicLevel ? ` · ${user.academicLevel}` : ""}`;

  const selfDeleteSec = document.getElementById("self-delete-section");
  if (selfDeleteSec) {
    selfDeleteSec.style.display = user.isEnvPrimary ? "none" : "block";
  }

  const execNavGroup = document.getElementById("exec-nav-group");
  if (execNavGroup) {
    execNavGroup.style.display = user.role === "executive" ? "grid" : "none";
  }

  // Hydrate profile form
  const pf = document.getElementById("profile-form");
  if (pf) {
    pf.fullName.value = user.fullName || "";
    pf.institution.value = user.institution || "";
    const levelSel = pf.academicLevel;
    const savedLevel = user.academicLevel || "Undergraduate (BSc / BA / BEd)";
    if (levelSel && levelSel.tagName === "SELECT") {
      const hasMatch = Array.from(levelSel.options).some((opt) => opt.value === savedLevel);
      if (!hasMatch && savedLevel) {
        const customOpt = document.createElement("option");
        customOpt.value = savedLevel;
        customOpt.textContent = savedLevel;
        levelSel.appendChild(customOpt);
      }
      levelSel.value = savedLevel;
    } else if (levelSel) {
      levelSel.value = savedLevel;
    }
    pf.discipline.value = user.discipline || "";
    if (pf.phone) pf.phone.value = user.phone || "";
    pf.orcid.value = user.orcid || "";
    if (pf.profileUrl) pf.profileUrl.value = user.profileUrl || "";
    if (pf.photoUrl) pf.photoUrl.value = user.photoUrl || "";
    pf.bio.value = user.bio || "";
  }

  // Hydrate author default on paper form
  const paperAuthor = document.getElementById("paper-authors");
  if (paperAuthor && !paperAuthor.value) paperAuthor.value = user.fullName;

  if (window.location.hash === "#profile") {
    setPortalPanel("profile");
  }

  await refreshMyActivity();
}

function renderExecEventsList(events) {
  cachedEvents = events || [];
  const wrap = document.getElementById("exec-events-list");
  if (!wrap) return;

  wrap.innerHTML = cachedEvents.length
    ? cachedEvents
        .map(
          (ev) => `
        <div class="card" style="padding:16px; gap:10px;">
          <div style="display:flex; justify-content:space-between; gap:14px; align-items:center; flex-wrap:wrap;">
            <div style="display:flex; gap:14px; align-items:center;">
              ${
                ev.flyerUrl
                  ? `<img src="${escapeHtml(ev.flyerUrl)}" alt="" style="width:56px; height:74px; object-fit:contain; border-radius:8px; border:1px solid var(--border); background:#f8fafc;" />`
                  : `<div style="width:56px; height:74px; border-radius:8px; border:1px dashed var(--border-strong); display:flex; align-items:center; justify-content:center; font-size:0.68rem; color:var(--ink-400); text-align:center; padding:4px;">No Flyer</div>`
              }
              <div>
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <strong>${escapeHtml(ev.title)}</strong>
                  ${ev.featured ? `<span class="badge badge-gold">Flagship</span>` : ""}
                </div>
                <div style="font-size:0.82rem; color:var(--ink-400); margin-top:2px;">${escapeHtml(ev.dateLabel)} · ${escapeHtml(ev.venue || "Hybrid")} · ${ev.rsvpCount || 0} RSVPs</div>
              </div>
            </div>
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
              <button type="button" class="btn btn-primary btn-sm" data-quick-flyer="${escapeHtml(ev.id)}">Update Flyer</button>
              <button type="button" class="btn btn-outline btn-sm" data-edit-event="${escapeHtml(ev.id)}">Edit Details</button>
              <button type="button" class="btn btn-ghost btn-sm" style="color:var(--danger);" data-delete-event="${escapeHtml(ev.id)}">Delete</button>
            </div>
          </div>
        </div>`
        )
        .join("")
    : `<p style="color:var(--ink-400);">No events published yet.</p>`;
}

function renderExecTeamList(executives) {
  cachedExecutives = executives || [];
  const wrap = document.getElementById("exec-team-list");
  if (!wrap) return;

  wrap.innerHTML = cachedExecutives.length
    ? cachedExecutives
        .map(
          (ex) => `
        <div class="card" style="padding:16px; gap:10px;">
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap;">
            <div style="display:flex; gap:12px; align-items:center;">
              <div class="avatar-circle" style="width:44px; height:44px; font-size:0.85rem; overflow:hidden;">
                ${
                  ex.photoUrl
                    ? `<img src="${escapeHtml(ex.photoUrl)}" alt="" style="width:100%; height:100%; object-fit:cover;" />`
                    : escapeHtml(ex.initials || getInitials(ex.name))
                }
              </div>
              <div>
                <strong>${escapeHtml(ex.name)}</strong>
                <div style="font-size:0.82rem; color:var(--crimson-600); font-weight:600;">${escapeHtml(ex.role)}</div>
              </div>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <button type="button" class="btn btn-outline btn-sm" data-edit-exec="${escapeHtml(ex.id)}">Edit</button>
              <button type="button" class="btn btn-ghost btn-sm" style="color:var(--danger);" data-delete-exec="${escapeHtml(ex.id)}">Remove</button>
            </div>
          </div>
        </div>`
        )
        .join("")
    : `<p style="color:var(--ink-400);">No Executive Council officers added yet.</p>`;
}

function renderExecUsersList(users, filterQuery = "") {
  const wrap = document.getElementById("exec-users-list");
  if (!wrap) return;
  const q = filterQuery.trim().toLowerCase();
  const filtered = (users || []).filter((u) => {
    if (!q) return true;
    return [u.fullName, u.email, u.institution, u.academicLevel, u.discipline, u.role]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  wrap.innerHTML = filtered.length
    ? filtered
        .map(
          (u) => `
        <div class="card" style="padding:16px; gap:10px;">
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap;">
            <div>
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <strong>${escapeHtml(u.fullName)}</strong>
                <span class="badge ${u.role === "executive" ? "badge-crimson" : "badge-navy"}">${escapeHtml(u.role)}</span>
                ${u.isEnvPrimary ? `<span class="badge badge-gold">Primary Env Executive</span>` : ""}
                ${u.isSelf ? `<span class="badge badge-success">You</span>` : ""}
              </div>
              <div style="font-size:0.84rem; color:var(--ink-600); margin-top:3px;">${escapeHtml(u.email)} · ${escapeHtml(u.academicLevel || "Member")}</div>
              <div style="font-size:0.8rem; color:var(--ink-400);">${escapeHtml(u.institution || "ICR Campus Network")} · ${escapeHtml(u.discipline || "General")}</div>
            </div>
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
              ${
                !u.isEnvPrimary && !u.isSelf
                  ? `<button type="button" class="btn btn-outline btn-sm" data-toggle-role="${escapeHtml(u.id)}" data-next-role="${u.role === "executive" ? "member" : "executive"}">
                       ${u.role === "executive" ? "Set as Member" : "Make Executive"}
                     </button>
                     <button type="button" class="btn btn-ghost btn-sm" style="color:var(--danger);" data-delete-user="${escapeHtml(u.id)}" data-delete-email="${escapeHtml(u.email)}">Delete Account</button>`
                  : `<span style="font-size:0.78rem; color:var(--ink-400);">Protected session</span>`
              }
            </div>
          </div>
        </div>`
        )
        .join("")
    : `<p style="color:var(--ink-400);">No matching member accounts found.</p>`;
}

async function refreshMyActivity() {
  const [papersRes, eventsRes] = await Promise.all([
    ICR.getPapers(currentUser?.role === "executive" ? { scope: "all" } : {}),
    ICR.getEvents(),
  ]);

  const myPapersWrap = document.getElementById("my-papers-list");
  if (myPapersWrap) {
    const mine = (papersRes.papers || []).filter(
      (p) => p.submittedBy === currentUser?.id || (p.authors || []).some((a) => a.toLowerCase() === currentUser?.fullName?.toLowerCase())
    );
    myPapersWrap.innerHTML = mine.length
      ? mine
          .map(
            (p) => `
          <div class="card" style="padding:18px; gap:8px;">
            <div style="display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap;">
              <strong>${escapeHtml(p.title)}</strong>
              <span class="badge ${p.status === "published" ? "badge-success" : "badge-warning"}">
                ${p.status === "published" ? "Published" : "Under Peer Review"}
              </span>
            </div>
            <div style="font-size:0.84rem; color:var(--ink-400);">${escapeHtml(p.category)} · Submitted ${escapeHtml(p.publishedAt)}</div>
          </div>`
          )
          .join("")
      : `<p style="color:var(--ink-400);">You have not submitted a research paper yet. Use the Paper Submission Studio to publish to the ICR archive.</p>`;
  }

  const rsvpWrap = document.getElementById("my-rsvps-list");
  if (rsvpWrap) {
    const rsvps = eventsRes.myRsvps || [];
    rsvpWrap.innerHTML = rsvps.length
      ? rsvps
          .map(
            (r) => `
          <div class="card" style="padding:16px; gap:4px;">
            <div style="display:flex; justify-content:space-between; gap:8px;">
              <strong>${escapeHtml(r.eventTitle || r.eventId)}</strong>
              <span class="badge badge-success">Confirmed</span>
            </div>
            <div style="font-size:0.84rem; color:var(--ink-400);">Track: ${escapeHtml(r.trackInterest || "General")} · Registered ${new Date(r.createdAt).toLocaleDateString()}</div>
          </div>`
          )
          .join("")
      : `<p style="color:var(--ink-400);">No event RSVPs recorded yet. <a href="/events.html" style="color:var(--crimson-600); font-weight:600;">Browse Upcoming Events →</a></p>`;
  }

  if (currentUser?.role === "executive") {
    const reviewWrap = document.getElementById("exec-papers-list");
    const appsWrap = document.getElementById("exec-apps-list");
    const allPapers = papersRes.papers || [];

    if (reviewWrap) {
      reviewWrap.innerHTML = allPapers
        .map(
          (p) => `
          <div class="card" style="padding:18px; gap:10px;">
            <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:center;">
              <div style="max-width:560px;">
                <strong>${escapeHtml(p.title)}</strong>
                <div style="font-size:0.82rem; color:var(--ink-400);">${escapeHtml((p.authors || []).join(", "))} · ${escapeHtml(p.category)}</div>
              </div>
              <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <span class="badge ${p.status === "published" ? "badge-success" : "badge-warning"}">${escapeHtml(p.status)}</span>
                ${
                  p.pdfUrl && p.pdfUrl !== "#abstract-reader"
                    ? `<a href="${escapeHtml(p.pdfUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm">View PDF</a>`
                    : ""
                }
                <button type="button" class="btn btn-sm ${p.status === "published" ? "btn-outline" : "btn-primary"}" data-toggle-paper="${escapeHtml(p.id)}" data-next-status="${p.status === "published" ? "under_review" : "published"}">
                  ${p.status === "published" ? "Move to Review" : "Approve & Publish"}
                </button>
                <button type="button" class="btn btn-ghost btn-sm" style="color:var(--danger);" data-delete-paper="${escapeHtml(p.id)}">Delete</button>
              </div>
            </div>
          </div>`
        )
        .join("");
    }

    if (appsWrap) {
      try {
        const appRes = await ICR.getApplications();
        const apps = appRes.applications || [];
        appsWrap.innerHTML = apps.length
          ? apps
              .map((a) => {
                const status = (a.status || "received").toLowerCase();
                const statusBadge =
                  status === "approved"
                    ? `<span class="badge badge-success">Approved &amp; Onboarded</span>`
                    : status === "declined"
                    ? `<span class="badge badge-crimson">Declined</span>`
                    : `<span class="badge badge-warning">Pending Review</span>`;

                const welcomeSubject = "Welcome to Innovative Campus Researchers (ICR) — Next Steps";
                const welcomeBody = `Hello ${a.fullName},\n\nCongratulations! Your membership application to Innovative Campus Researchers (ICR) has been approved.\n\nHere are your 2 quick onboarding steps:\n1. Create your encrypted ICR Member Portal account (leave the Executive Invite Code blank): https://icresearchers.netlify.app/portal\n2. Join our ICR Community WhatsApp Group: https://chat.whatsapp.com/DAj9PPNiuiGDWyl37SsImX\n\nOnce signed in, you can upload your profile headshot, submit working papers, and RSVP for upcoming summits and clinics.\n\nWarm regards,\nICR Executive Council\nicr2026@gmail.com`;
                const mailHref = `mailto:${encodeURIComponent(a.email)}?subject=${encodeURIComponent(welcomeSubject)}&body=${encodeURIComponent(welcomeBody)}`;

                let waBtn = "";
                if (a.phone) {
                  const digits = String(a.phone).replace(/\D/g, "");
                  const waNum = digits.startsWith("0") && digits.length === 11 ? `234${digits.slice(1)}` : digits;
                  if (waNum.length >= 10) {
                    const waText = `Hello ${a.fullName}! Welcome to Innovative Campus Researchers (ICR). Your membership application has been approved! Please create your Member Portal account at https://icresearchers.netlify.app/portal and join our WhatsApp community: https://chat.whatsapp.com/DAj9PPNiuiGDWyl37SsImX`;
                    waBtn = `<a href="https://wa.me/${waNum}?text=${encodeURIComponent(waText)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm">WhatsApp Welcome</a>`;
                  }
                }

                return `
              <div class="card" style="padding:18px; gap:10px;">
                <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; align-items:center;">
                  <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <strong>${escapeHtml(a.fullName)}</strong>
                    <span class="badge badge-navy">${escapeHtml(a.academicLevel || "Applicant")}</span>
                    ${statusBadge}
                  </div>
                  <span style="font-size:0.8rem; color:var(--ink-400);">${escapeHtml(a.institution)}${a.submittedAt ? ` · ${new Date(a.submittedAt).toLocaleDateString()}` : ""}</span>
                </div>
                <div style="font-size:0.84rem; color:var(--ink-600);">
                  ${escapeHtml(a.email)}${a.phone ? ` · ${escapeHtml(a.phone)}` : ""} · ${escapeHtml(a.discipline || "Interdisciplinary")}
                </div>
                ${a.interests ? `<div style="font-size:0.82rem; color:var(--navy-800);"><strong>Interests:</strong> ${escapeHtml(a.interests)}</div>` : ""}
                <p style="font-size:0.88rem; margin:2px 0 4px;">${escapeHtml(a.motivation)}</p>
                <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; padding-top:10px; border-top:1px solid var(--border);">
                  ${
                    status === "approved"
                      ? `<button type="button" class="btn btn-outline btn-sm" data-app-status="${escapeHtml(a.id)}" data-next-app-status="received">Move to Pending</button>`
                      : `<button type="button" class="btn btn-primary btn-sm" data-app-status="${escapeHtml(a.id)}" data-next-app-status="approved">Approve &amp; Onboard</button>`
                  }
                  <a href="${mailHref}" class="btn btn-navy btn-sm">Email Welcome</a>
                  ${waBtn}
                  ${
                    status === "received"
                      ? `<button type="button" class="btn btn-outline btn-sm" data-app-status="${escapeHtml(a.id)}" data-next-app-status="declined">Decline</button>`
                      : ""
                  }
                  <button type="button" class="btn btn-ghost btn-sm" style="color:var(--danger); margin-left:auto;" data-delete-app="${escapeHtml(a.id)}" data-delete-app-name="${escapeHtml(a.fullName)}">Delete</button>
                </div>
              </div>`;
              })
              .join("")
          : `<p style="color:var(--ink-400);">No new membership applications in the queue yet.</p>`;
      } catch {
        appsWrap.innerHTML = `<p style="color:var(--ink-400);">Applications queue loads once deployed with Netlify Blobs.</p>`;
      }
    }

    renderExecEventsList(eventsRes.events || []);

    const resetsWrap = document.getElementById("exec-resets-list");
    if (resetsWrap) {
      try {
        const rstRes = await ICR.getResetRequests();
        const requests = rstRes.requests || [];
        resetsWrap.innerHTML = requests.length
          ? requests
              .map((r) => {
                const minsLeft = Math.max(1, Math.round((new Date(r.expiresAt).getTime() - Date.now()) / 60000));
                const mailBody = `Hello ${r.fullName},\n\nHere is your 1-time ICR Member Portal password reset code (expires in ${minsLeft} minutes):\n\nReset Code: ${r.code}\n\nVisit https://icresearchers.netlify.app/portal, click "Forgot password?", and enter this code under Step 2 to set your new password.\n\n— ICR Executive Council`;
                const mailHref = `mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent("ICR Member Portal — Your Password Reset Code")}&body=${encodeURIComponent(mailBody)}`;
                return `
              <div class="card" style="padding:16px; gap:10px;">
                <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap;">
                  <div>
                    <strong>${escapeHtml(r.fullName)}</strong>
                    <div style="font-size:0.84rem; color:var(--ink-600);">${escapeHtml(r.email)} · Expires in ~${minsLeft} min</div>
                  </div>
                  <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                    <span class="badge badge-crimson" style="font-family:monospace; font-size:0.92rem; letter-spacing:0.12em;">${escapeHtml(r.code)}</span>
                    <button type="button" class="btn btn-outline btn-sm" data-copy-reset="${escapeHtml(r.code)}">Copy Code</button>
                    <a href="${mailHref}" class="btn btn-primary btn-sm">Email Code</a>
                    <button type="button" class="btn btn-ghost btn-sm" style="color:var(--danger);" data-dismiss-reset="${escapeHtml(r.id)}">Dismiss</button>
                  </div>
                </div>
              </div>`;
              })
              .join("")
          : `<p style="color:var(--ink-400);">No active password reset requests right now.</p>`;
      } catch {
        resetsWrap.innerHTML = `<p style="color:var(--ink-400);">No active password reset requests right now.</p>`;
      }
    }

    try {
      const membersRes = await ICR.getMembers();
      renderExecTeamList(membersRes.executives || []);
    } catch {
      // ignore
    }

    try {
      const usersRes = await ICR.getAdminUsers();
      cachedAdminUsers = usersRes.users || [];
      const searchVal = document.getElementById("exec-users-search")?.value || "";
      renderExecUsersList(cachedAdminUsers, searchVal);
    } catch {
      // ignore
    }
  }
}

async function init() {
  // Bind direct cloud file uploaders
  bindFileUploader("paper-pdf-file", "paper-pdf", "paper-pdf-status", "pdf");
  bindFileUploader("ev-flyer-file", "ev-flyer-url", "ev-flyer-status", "image", (res) => {
    setEventFlyerPreview(res.url);
  });
  bindFileUploader("ex-photo-file", "ex-photo-url", "ex-photo-status", "image");
  bindFileUploader("prof-photo-file", "prof-photo-url", "prof-photo-status", "avatar", (res) => {
    renderAvatarEl(document.getElementById("prof-avatar-preview"), currentUser?.fullName, res.url);
    renderAvatarEl(document.getElementById("dash-avatar"), currentUser?.fullName, res.url);
  });

  // Quick "Edit Profile" shortcut in sidebar header
  document.getElementById("quick-edit-profile-btn")?.addEventListener("click", () => {
    setPortalPanel("profile");
  });

  // Auth tabs
  document.querySelectorAll("[data-auth-tab]").forEach((btn) => {
    btn.addEventListener("click", () => setAuthTab(btn.dataset.authTab));
  });

  // Forgot password toggle
  document.getElementById("forgot-password-btn")?.addEventListener("click", () => {
    const typedEmail = document.getElementById("login-email")?.value?.trim() || "";
    setAuthTab("reset");
    if (typedEmail) {
      const reqEmail = document.getElementById("reset-req-email");
      const confEmail = document.getElementById("reset-conf-email");
      if (reqEmail) reqEmail.value = typedEmail;
      if (confEmail) confEmail.value = typedEmail;
    }
  });

  document.getElementById("back-to-login-btn")?.addEventListener("click", () => {
    setAuthTab("login");
  });

  // Reset Password — Step 1: Request 6-digit code
  const resetReqForm = document.getElementById("reset-request-form");
  resetReqForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const authAlert = document.getElementById("auth-alert");
    authAlert.className = "alert";
    const btn = resetReqForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Generating Code...";
    try {
      const email = resetReqForm.email.value.trim();
      const res = await ICR.requestPasswordReset(email);
      const confEmail = document.getElementById("reset-conf-email");
      if (confEmail) confEmail.value = email;
      authAlert.textContent = res.message || "Reset code requested.";
      authAlert.className = "alert alert-success show";
      showToast("Password reset request processed.", "success");
    } catch (err) {
      authAlert.textContent = err.message || "Could not process password reset request.";
      authAlert.className = "alert alert-error show";
    } finally {
      btn.disabled = false;
      btn.textContent = "Request Reset Code";
    }
  });

  // Reset Password — Step 2: Confirm code & set new password
  const resetConfForm = document.getElementById("reset-confirm-form");
  resetConfForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const authAlert = document.getElementById("auth-alert");
    authAlert.className = "alert";
    const newPassword = resetConfForm.newPassword.value;
    const confirmPassword = resetConfForm.confirmPassword.value;
    if (newPassword !== confirmPassword) {
      authAlert.textContent = "New password and confirmation do not match.";
      authAlert.className = "alert alert-error show";
      return;
    }
    const btn = resetConfForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Resetting Password...";
    try {
      const res = await ICR.confirmPasswordReset({
        email: resetConfForm.email.value.trim(),
        code: resetConfForm.code.value.trim(),
        newPassword,
      });
      resetConfForm.reset();
      resetReqForm?.reset();
      showToast(res.message || "Password reset! Welcome back.", "success");
      await renderDashboard(res.user);
    } catch (err) {
      authAlert.textContent = err.message || "Password reset failed.";
      authAlert.className = "alert alert-error show";
    } finally {
      btn.disabled = false;
      btn.textContent = "Reset Password & Sign In";
    }
  });

  // Signed-in Change Password form
  const changePassForm = document.getElementById("change-password-form");
  const changePassAlert = document.getElementById("change-pass-alert");
  changePassForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (changePassAlert) changePassAlert.className = "alert";
    const newPassword = changePassForm.newPassword.value;
    const confirmPassword = changePassForm.confirmPassword.value;
    if (newPassword !== confirmPassword) {
      if (changePassAlert) {
        changePassAlert.textContent = "New password and confirmation do not match.";
        changePassAlert.className = "alert alert-error show";
      }
      return;
    }
    const btn = changePassForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Updating...";
    try {
      const res = await ICR.changePassword({
        currentPassword: changePassForm.currentPassword.value,
        newPassword,
      });
      changePassForm.reset();
      if (changePassAlert) {
        changePassAlert.textContent = res.message || "Password updated successfully!";
        changePassAlert.className = "alert alert-success show";
      }
      showToast("Password updated!", "success");
    } catch (err) {
      if (changePassAlert) {
        changePassAlert.textContent = err.message || "Could not update password.";
        changePassAlert.className = "alert alert-error show";
      }
    } finally {
      btn.disabled = false;
      btn.textContent = "Update Password";
    }
  });

  // Executive Password Reset Desk actions (Copy Code / Dismiss)
  document.getElementById("exec-resets-list")?.addEventListener("click", async (e) => {
    const copyBtn = e.target.closest("[data-copy-reset]");
    const dismissBtn = e.target.closest("[data-dismiss-reset]");
    if (copyBtn) {
      try {
        await navigator.clipboard.writeText(copyBtn.dataset.copyReset);
        showToast("1-time reset code copied!", "success");
      } catch {
        showToast(`Reset code: ${copyBtn.dataset.copyReset}`, "info");
      }
    } else if (dismissBtn) {
      dismissBtn.disabled = true;
      try {
        await ICR.dismissResetRequest(dismissBtn.dataset.dismissReset);
        showToast("Reset request dismissed.", "info");
        await refreshMyActivity();
      } catch (err) {
        showToast(err.message || "Could not dismiss request.", "error");
        dismissBtn.disabled = false;
      }
    }
  });

  // Portal sidebar tabs
  document.querySelectorAll("[data-portal-tab]").forEach((btn) => {
    btn.addEventListener("click", () => setPortalPanel(btn.dataset.portalTab));
  });

  // Login submit
  const loginForm = document.getElementById("login-form");
  const authAlert = document.getElementById("auth-alert");
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    authAlert.className = "alert";
    const btn = loginForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Signing In...";
    try {
      const res = await ICR.login({
        email: loginForm.email.value.trim(),
        password: loginForm.password.value,
      });
      showToast(`Welcome back, ${res.user.fullName}!`, "success");
      await renderDashboard(res.user);
    } catch (err) {
      authAlert.textContent = err.message || "Sign in failed.";
      authAlert.className = "alert alert-error show";
    } finally {
      btn.disabled = false;
      btn.textContent = "Sign In to Member Portal";
    }
  });

  // Register submit
  const regForm = document.getElementById("register-form");
  regForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    authAlert.className = "alert";
    const btn = regForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Creating Account...";
    try {
      const res = await ICR.register({
        fullName: regForm.fullName.value.trim(),
        email: regForm.email.value.trim(),
        password: regForm.password.value,
        institution: regForm.institution.value.trim(),
        academicLevel: regForm.academicLevel.value,
        discipline: regForm.discipline.value.trim(),
        inviteCode: regForm.inviteCode ? regForm.inviteCode.value.trim() : "",
      });
      showToast("ICR account created!", "success");
      await renderDashboard(res.user);
    } catch (err) {
      authAlert.textContent = err.message || "Could not create account.";
      authAlert.className = "alert alert-error show";
    } finally {
      btn.disabled = false;
      btn.textContent = "Create Researcher Account";
    }
  });

  // Profile update
  const profileForm = document.getElementById("profile-form");
  const profileAlert = document.getElementById("profile-alert");
  profileForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (profileAlert) profileAlert.className = "alert";
    const btn = profileForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Saving...";
    try {
      const res = await ICR.updateProfile({
        fullName: profileForm.fullName.value.trim(),
        institution: profileForm.institution.value.trim(),
        academicLevel: profileForm.academicLevel.value,
        discipline: profileForm.discipline.value.trim(),
        phone: profileForm.phone ? profileForm.phone.value.trim() : "",
        orcid: profileForm.orcid.value.trim(),
        profileUrl: profileForm.profileUrl ? profileForm.profileUrl.value.trim() : "",
        photoUrl: profileForm.photoUrl ? profileForm.photoUrl.value.trim() : "",
        bio: profileForm.bio.value.trim(),
      });
      if (profileAlert) {
        profileAlert.textContent = "Profile updated and synced with the ICR Community Directory!";
        profileAlert.className = "alert alert-success show";
      }
      showToast("Researcher profile updated!", "success");
      await renderDashboard(res.user);
    } catch (err) {
      if (profileAlert) {
        profileAlert.textContent = err.message || "Could not update profile.";
        profileAlert.className = "alert alert-error show";
      }
      showToast(err.message || "Could not update profile.", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Save Profile Changes";
    }
  });

  // Self-delete account (Danger Zone)
  const deleteAccForm = document.getElementById("delete-account-form");
  const deleteAccAlert = document.getElementById("delete-acc-alert");
  deleteAccForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!confirm("Are you sure you want to permanently delete your ICR account? This cannot be undone.")) return;
    if (deleteAccAlert) deleteAccAlert.className = "alert";
    const btn = deleteAccForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Deleting...";
    try {
      await ICR.deleteMyAccount(deleteAccForm.password.value);
      deleteAccForm.reset();
      currentUser = null;
      document.getElementById("dashboard-view").style.display = "none";
      document.getElementById("auth-view").style.display = "block";
      showToast("Your ICR account has been permanently deleted.", "info");
    } catch (err) {
      if (deleteAccAlert) {
        deleteAccAlert.textContent = err.message || "Could not delete account.";
        deleteAccAlert.className = "alert alert-error show";
      }
    } finally {
      btn.disabled = false;
      btn.textContent = "Delete My Account";
    }
  });

  // Paper submission
  const paperForm = document.getElementById("paper-submit-form");
  const paperAlert = document.getElementById("paper-submit-alert");
  paperForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = paperForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Submitting Paper...";
    paperAlert.className = "alert";
    try {
      await submitNetlifyForm(paperForm);
      const res = await ICR.submitPaper({
        title: paperForm.title.value.trim(),
        authors: paperForm.authors.value.trim(),
        category: paperForm.category.value,
        type: paperForm.type.value,
        keywords: paperForm.keywords.value.trim(),
        abstract: paperForm.abstract.value.trim(),
        pdfUrl: paperForm.pdfUrl.value.trim(),
      });
      paperAlert.textContent =
        res.paper.status === "published"
          ? "Paper published immediately to the ICR Research Archive!"
          : "Paper submitted! It is now in the Executive Peer-Review Queue and visible in your submissions list.";
      paperAlert.className = "alert alert-success show";
      showToast("Research paper submitted!", "success");
      paperForm.reset();
      const statusEl = document.getElementById("paper-pdf-status");
      if (statusEl) statusEl.textContent = "Uploads directly to ICR Cloud Storage (Netlify Blobs).";
      if (currentUser) paperForm.authors.value = currentUser.fullName;
      await refreshMyActivity();
    } catch (err) {
      paperAlert.textContent = err.message || "Could not submit paper.";
      paperAlert.className = "alert alert-error show";
    } finally {
      btn.disabled = false;
      btn.textContent = "Submit Paper to ICR Archive";
    }
  });

  // Executive review actions (Publish / Delete)
  document.getElementById("exec-papers-list")?.addEventListener("click", async (e) => {
    const toggleBtn = e.target.closest("[data-toggle-paper]");
    const delBtn = e.target.closest("[data-delete-paper]");
    if (toggleBtn) {
      toggleBtn.disabled = true;
      try {
        await ICR.updatePaperStatus(toggleBtn.dataset.togglePaper, toggleBtn.dataset.nextStatus);
        showToast("Paper review status updated!", "success");
        await refreshMyActivity();
      } catch (err) {
        showToast(err.message || "Update failed.", "error");
        toggleBtn.disabled = false;
      }
    } else if (delBtn) {
      if (!confirm("Delete this paper from the archive?")) return;
      delBtn.disabled = true;
      try {
        await ICR.deletePaper(delBtn.dataset.deletePaper);
        showToast("Paper removed from archive.", "info");
        await refreshMyActivity();
      } catch (err) {
        showToast(err.message || "Delete failed.", "error");
        delBtn.disabled = false;
      }
    }
  });

  // Executive Events CMS form
  const evForm = document.getElementById("exec-event-form");
  const evAlert = document.getElementById("exec-event-alert");
  const evHeading = document.getElementById("ev-form-heading");
  const quickFlyerInput = document.getElementById("quick-flyer-file");
  let pendingQuickFlyerEventId = null;

  document.getElementById("ev-reset-btn")?.addEventListener("click", () => {
    evForm?.reset();
    document.getElementById("ev-id").value = "";
    if (evHeading) evHeading.textContent = "Create or Edit Upcoming Event";
    setEventFlyerPreview("");
    const st = document.getElementById("ev-flyer-status");
    if (st) st.textContent = "Displayed full & uncropped on /events and the Homepage.";
  });

  document.getElementById("ev-flyer-url")?.addEventListener("input", (e) => {
    setEventFlyerPreview(e.target.value.trim());
  });

  quickFlyerInput?.addEventListener("change", async () => {
    const file = quickFlyerInput.files?.[0];
    const targetId = pendingQuickFlyerEventId;
    pendingQuickFlyerEventId = null;
    if (!file || !targetId) return;

    const triggerBtn = document.querySelector(`[data-quick-flyer="${CSS.escape(targetId)}"]`);
    if (triggerBtn) {
      triggerBtn.disabled = true;
      triggerBtn.textContent = "Uploading Flyer...";
    }
    try {
      const uploaded = await ICR.uploadFile(file, "image");
      const saved = await ICR.updateEventFlyer(targetId, uploaded.url);
      renderExecEventsList(saved.events || []);
      if (evAlert) {
        evAlert.textContent = `Flyer updated and published live to /events and Homepage (${Math.round(uploaded.size / 1024)} KB)!`;
        evAlert.className = "alert alert-success show";
      }
      showToast("Event flyer updated live!", "success");
    } catch (err) {
      showToast(err.message || "Could not update flyer. Please try a JPG or PNG image.", "error");
      if (evAlert) {
        evAlert.textContent = err.message || "Could not update flyer.";
        evAlert.className = "alert alert-error show";
      }
      if (triggerBtn) {
        triggerBtn.disabled = false;
        triggerBtn.textContent = "Update Flyer";
      }
    } finally {
      quickFlyerInput.value = "";
    }
  });

  evForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = evForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Saving Event...";
    evAlert.className = "alert";
    try {
      const res = await ICR.saveEvent({
        id: evForm.id.value.trim(),
        title: evForm.title.value.trim(),
        tagline: evForm.tagline.value.trim(),
        badge: evForm.badge.value,
        dateLabel: evForm.dateLabel.value.trim(),
        timeLabel: evForm.timeLabel.value.trim(),
        venue: evForm.venue.value.trim(),
        whatsappUrl: evForm.whatsappUrl.value.trim(),
        flyerUrl: evForm.flyerUrl.value.trim(),
        description: evForm.description.value.trim(),
        tracksText: evForm.tracksText.value,
        featured: evForm.featured.checked,
      });
      evAlert.textContent = "Event saved and published live to /events and Homepage!";
      evAlert.className = "alert alert-success show";
      showToast("Event published live!", "success");
      evForm.reset();
      document.getElementById("ev-id").value = "";
      if (evHeading) evHeading.textContent = "Create or Edit Upcoming Event";
      setEventFlyerPreview("");
      renderExecEventsList(res.events || []);
    } catch (err) {
      evAlert.textContent = err.message || "Could not save event.";
      evAlert.className = "alert alert-error show";
    } finally {
      btn.disabled = false;
      btn.textContent = "Save & Publish Event";
    }
  });

  document.getElementById("exec-events-list")?.addEventListener("click", async (e) => {
    const quickFlyerBtn = e.target.closest("[data-quick-flyer]");
    const editBtn = e.target.closest("[data-edit-event]");
    const delBtn = e.target.closest("[data-delete-event]");
    if (quickFlyerBtn) {
      pendingQuickFlyerEventId = quickFlyerBtn.dataset.quickFlyer;
      quickFlyerInput?.click();
      return;
    }
    if (editBtn) {
      const ev = cachedEvents.find((item) => item.id === editBtn.dataset.editEvent);
      if (!ev || !evForm) return;
      evForm.id.value = ev.id;
      evForm.title.value = ev.title || "";
      evForm.tagline.value = ev.tagline || "";
      evForm.badge.value = ev.badge || "Flagship Summit";
      evForm.dateLabel.value = ev.dateLabel || "";
      evForm.timeLabel.value = ev.timeLabel || "";
      evForm.venue.value = ev.venue || "";
      evForm.whatsappUrl.value = ev.whatsappUrl || "";
      evForm.flyerUrl.value = ev.flyerUrl || "";
      evForm.description.value = ev.description || "";
      evForm.tracksText.value = (ev.tracks || []).map((t) => `${t.title}: ${t.detail}`).join("\n");
      evForm.featured.checked = Boolean(ev.featured);
      if (evHeading) evHeading.textContent = `Editing: ${ev.title}`;
      setEventFlyerPreview(ev.flyerUrl || "");
      evForm.scrollIntoView({ behavior: "smooth", block: "start" });
      showToast(`Editing "${ev.title}"`, "info");
    } else if (delBtn) {
      if (!confirm("Delete this event from the live site?")) return;
      delBtn.disabled = true;
      try {
        const res = await ICR.deleteEvent(delBtn.dataset.deleteEvent);
        showToast("Event deleted.", "info");
        renderExecEventsList(res.events || []);
      } catch (err) {
        showToast(err.message || "Delete failed.", "error");
        delBtn.disabled = false;
      }
    }
  });

  // Executive Council Roster CMS form
  const teamForm = document.getElementById("exec-team-form");
  const teamAlert = document.getElementById("exec-team-alert");
  document.getElementById("ex-reset-btn")?.addEventListener("click", () => {
    teamForm?.reset();
    document.getElementById("ex-id").value = "";
    const st = document.getElementById("ex-photo-status");
    if (st) st.textContent = "Square portrait photos look sharpest.";
  });

  teamForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = teamForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Saving Officer...";
    teamAlert.className = "alert";
    try {
      const res = await ICR.saveExecutive({
        id: teamForm.id.value.trim(),
        name: teamForm.name.value.trim(),
        role: teamForm.role.value.trim(),
        photoUrl: teamForm.photoUrl.value.trim(),
        focus: teamForm.focus.value.trim(),
      });
      teamAlert.textContent = "Executive Council officer saved and updated live on /community!";
      teamAlert.className = "alert alert-success show";
      showToast("Executive Council updated!", "success");
      teamForm.reset();
      document.getElementById("ex-id").value = "";
      renderExecTeamList(res.executives || []);
    } catch (err) {
      teamAlert.textContent = err.message || "Could not save executive officer.";
      teamAlert.className = "alert alert-error show";
    } finally {
      btn.disabled = false;
      btn.textContent = "Save Executive Officer";
    }
  });

  document.getElementById("exec-team-list")?.addEventListener("click", async (e) => {
    const editBtn = e.target.closest("[data-edit-exec]");
    const delBtn = e.target.closest("[data-delete-exec]");
    if (editBtn) {
      const ex = cachedExecutives.find((item) => item.id === editBtn.dataset.editExec);
      if (!ex || !teamForm) return;
      teamForm.id.value = ex.id;
      teamForm.name.value = ex.name || "";
      teamForm.role.value = ex.role || "";
      teamForm.photoUrl.value = ex.photoUrl || "";
      teamForm.focus.value = ex.focus || "";
      teamForm.scrollIntoView({ behavior: "smooth", block: "start" });
      showToast(`Editing "${ex.name}"`, "info");
    } else if (delBtn) {
      if (!confirm("Remove this officer from the Executive Council roster?")) return;
      delBtn.disabled = true;
      try {
        const res = await ICR.deleteExecutive(delBtn.dataset.deleteExec);
        showToast("Officer removed.", "info");
        renderExecTeamList(res.executives || []);
      } catch (err) {
        showToast(err.message || "Remove failed.", "error");
        delBtn.disabled = false;
      }
    }
  });

  // Executive Membership Applications 1-Click Onboarding (Approve / Decline / Delete)
  document.getElementById("exec-apps-list")?.addEventListener("click", async (e) => {
    const statusBtn = e.target.closest("[data-app-status]");
    const delBtn = e.target.closest("[data-delete-app]");
    if (statusBtn) {
      statusBtn.disabled = true;
      try {
        const res = await ICR.updateApplicationStatus(statusBtn.dataset.appStatus, statusBtn.dataset.nextAppStatus);
        showToast(res.message || "Application updated!", "success");
        await refreshMyActivity();
      } catch (err) {
        showToast(err.message || "Could not update application.", "error");
        statusBtn.disabled = false;
      }
    } else if (delBtn) {
      const name = delBtn.dataset.deleteAppName || "this applicant";
      if (!confirm(`Remove the membership application from ${name}?`)) return;
      delBtn.disabled = true;
      try {
        await ICR.deleteApplication(delBtn.dataset.deleteApp);
        showToast("Application removed.", "info");
        await refreshMyActivity();
      } catch (err) {
        showToast(err.message || "Could not delete application.", "error");
        delBtn.disabled = false;
      }
    }
  });

  // Executive Member Accounts search + role toggle + delete
  document.getElementById("exec-users-search")?.addEventListener("input", (e) => {
    renderExecUsersList(cachedAdminUsers, e.target.value);
  });

  document.getElementById("exec-users-list")?.addEventListener("click", async (e) => {
    const roleBtn = e.target.closest("[data-toggle-role]");
    const delBtn = e.target.closest("[data-delete-user]");
    if (roleBtn) {
      roleBtn.disabled = true;
      try {
        await ICR.updateUserRole(roleBtn.dataset.toggleRole, roleBtn.dataset.nextRole);
        showToast("Account role updated!", "success");
        await refreshMyActivity();
      } catch (err) {
        showToast(err.message || "Could not update role.", "error");
        roleBtn.disabled = false;
      }
    } else if (delBtn) {
      const email = delBtn.dataset.deleteEmail || "this account";
      if (!confirm(`Permanently delete ${email}? This will also remove them from the Community Researchers directory so the email can register fresh.`)) return;
      delBtn.disabled = true;
      try {
        const res = await ICR.deleteUserAccount(delBtn.dataset.deleteUser);
        showToast(res.message || "Account deleted!", "info");
        await refreshMyActivity();
      } catch (err) {
        showToast(err.message || "Could not delete account.", "error");
        delBtn.disabled = false;
      }
    }
  });

  // Logout
  document.getElementById("logout-btn")?.addEventListener("click", async () => {
    await ICR.logout();
    currentUser = null;
    document.getElementById("dashboard-view").style.display = "none";
    document.getElementById("auth-view").style.display = "block";
    showToast("Signed out safely.", "info");
  });

  // Check active session on page load
  try {
    const me = await ICR.getMe();
    if (me.authenticated && me.user) {
      await renderDashboard(me.user);
      return;
    }
  } catch {
    // show auth view
  }
  document.getElementById("auth-view").style.display = "block";
}

document.addEventListener("DOMContentLoaded", init);
