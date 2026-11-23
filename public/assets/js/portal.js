import { ICR, submitNetlifyForm } from "./api.js";
import { escapeHtml, getInitials, showToast } from "./app.js";

let currentUser = null;
let cachedEvents = [];
let cachedExecutives = [];

function setAuthTab(mode) {
  const loginForm = document.getElementById("login-form");
  const regForm = document.getElementById("register-form");
  document.querySelectorAll("[data-auth-tab]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.authTab === mode);
  });
  if (loginForm) loginForm.style.display = mode === "login" ? "block" : "none";
  if (regForm) regForm.style.display = mode === "register" ? "block" : "none";
}

function setPortalPanel(panelId) {
  document.querySelectorAll("[data-portal-tab]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.portalTab === panelId);
  });
  document.querySelectorAll("[data-portal-panel]").forEach((panel) => {
    panel.style.display = panel.dataset.portalPanel === panelId ? "block" : "none";
  });
}

function bindFileUploader(fileInputId, targetUrlId, statusId, kind) {
  const fileInput = document.getElementById(fileInputId);
  const urlInput = document.getElementById(targetUrlId);
  const statusEl = document.getElementById(statusId);
  if (!fileInput || !urlInput) return;

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const maxMb = kind === "image" ? 3.5 : 4.5;
    if (file.size > maxMb * 1024 * 1024) {
      showToast(`File is too large. Max size is ${maxMb} MB.`, "error");
      fileInput.value = "";
      return;
    }

    if (statusEl) statusEl.textContent = `Uploading ${file.name}...`;
    try {
      const res = await ICR.uploadFile(file, kind);
      urlInput.value = res.url;
      if (statusEl) statusEl.textContent = `Uploaded: ${res.fileName} (${Math.round(res.size / 1024)} KB)`;
      showToast(`Uploaded ${res.fileName} to ICR Cloud Storage!`, "success");
    } catch (err) {
      if (statusEl) statusEl.textContent = err.message || "Upload failed.";
      showToast(err.message || "File upload failed.", "error");
      fileInput.value = "";
    }
  });
}

async function renderDashboard(user) {
  currentUser = user;
  document.getElementById("auth-view").style.display = "none";
  document.getElementById("dashboard-view").style.display = "block";

  document.getElementById("dash-avatar").textContent = getInitials(user.fullName);
  document.getElementById("dash-name").textContent = user.fullName;
  document.getElementById("dash-role").textContent = user.role === "executive" ? "Executive Reviewer" : "ICR Member";
  document.getElementById("dash-institution").textContent = user.institution || "ICR Campus Network";

  const execNavGroup = document.getElementById("exec-nav-group");
  if (execNavGroup) {
    execNavGroup.style.display = user.role === "executive" ? "grid" : "none";
  }

  // Hydrate profile form
  const pf = document.getElementById("profile-form");
  if (pf) {
    pf.fullName.value = user.fullName || "";
    pf.institution.value = user.institution || "";
    pf.academicLevel.value = user.academicLevel || "Undergraduate";
    pf.discipline.value = user.discipline || "";
    pf.orcid.value = user.orcid || "";
    pf.bio.value = user.bio || "";
  }

  // Hydrate author default on paper form
  const paperAuthor = document.getElementById("paper-authors");
  if (paperAuthor && !paperAuthor.value) paperAuthor.value = user.fullName;

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
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap;">
            <div style="display:flex; gap:12px; align-items:center;">
              ${
                ev.flyerUrl
                  ? `<img src="${escapeHtml(ev.flyerUrl)}" alt="" style="width:52px; height:52px; object-fit:cover; border-radius:8px; border:1px solid var(--border);" />`
                  : ""
              }
              <div>
                <strong>${escapeHtml(ev.title)}</strong>
                <div style="font-size:0.82rem; color:var(--ink-400);">${escapeHtml(ev.dateLabel)} · ${escapeHtml(ev.venue || "Hybrid")} · ${ev.rsvpCount || 0} RSVPs</div>
              </div>
            </div>
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
              ${ev.featured ? `<span class="badge badge-gold">Flagship</span>` : ""}
              <button type="button" class="btn btn-outline btn-sm" data-edit-event="${escapeHtml(ev.id)}">Edit</button>
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
              .map(
                (a) => `
              <div class="card" style="padding:16px; gap:6px;">
                <div style="display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap;">
                  <strong>${escapeHtml(a.fullName)} (${escapeHtml(a.academicLevel)})</strong>
                  <span class="badge badge-navy">${escapeHtml(a.institution)}</span>
                </div>
                <div style="font-size:0.84rem; color:var(--ink-600);">${escapeHtml(a.email)} · ${escapeHtml(a.discipline)}</div>
                <p style="font-size:0.88rem; margin-top:4px;">${escapeHtml(a.motivation)}</p>
              </div>`
              )
              .join("")
          : `<p style="color:var(--ink-400);">No new membership applications in the queue yet.</p>`;
      } catch {
        appsWrap.innerHTML = `<p style="color:var(--ink-400);">Applications queue loads once deployed with Netlify Blobs.</p>`;
      }
    }

    renderExecEventsList(eventsRes.events || []);

    try {
      const membersRes = await ICR.getMembers();
      renderExecTeamList(membersRes.executives || []);
    } catch {
      // ignore
    }
  }
}

async function init() {
  // Bind direct cloud file uploaders
  bindFileUploader("paper-pdf-file", "paper-pdf", "paper-pdf-status", "pdf");
  bindFileUploader("ev-flyer-file", "ev-flyer-url", "ev-flyer-status", "image");
  bindFileUploader("ex-photo-file", "ex-photo-url", "ex-photo-status", "image");

  // Auth tabs
  document.querySelectorAll("[data-auth-tab]").forEach((btn) => {
    btn.addEventListener("click", () => setAuthTab(btn.dataset.authTab));
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
  profileForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = profileForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Saving...";
    try {
      const res = await ICR.updateProfile({
        fullName: profileForm.fullName.value.trim(),
        institution: profileForm.institution.value.trim(),
        academicLevel: profileForm.academicLevel.value,
        discipline: profileForm.discipline.value.trim(),
        orcid: profileForm.orcid.value.trim(),
        bio: profileForm.bio.value.trim(),
      });
      showToast("Researcher profile updated!", "success");
      await renderDashboard(res.user);
    } catch (err) {
      showToast(err.message || "Could not update profile.", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Save Profile Changes";
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
  document.getElementById("ev-reset-btn")?.addEventListener("click", () => {
    evForm?.reset();
    document.getElementById("ev-id").value = "";
    const st = document.getElementById("ev-flyer-status");
    if (st) st.textContent = "Displayed full & uncropped on the Events page.";
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
      evAlert.textContent = "Event saved and published live to /events!";
      evAlert.className = "alert alert-success show";
      showToast("Event published live!", "success");
      evForm.reset();
      document.getElementById("ev-id").value = "";
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
    const editBtn = e.target.closest("[data-edit-event]");
    const delBtn = e.target.closest("[data-delete-event]");
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
