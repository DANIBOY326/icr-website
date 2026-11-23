import { ICR, submitNetlifyForm } from "./api.js";
import { escapeHtml, showToast } from "./app.js";

let eventsCache = [];

function renderEvents(events) {
  const featuredWrap = document.getElementById("featured-summit");
  const listWrap = document.getElementById("upcoming-events-grid");
  const selectEl = document.getElementById("rsvp-event-select");

  if (selectEl) {
    selectEl.innerHTML = events
      .map((ev) => `<option value="${escapeHtml(ev.id)}">${escapeHtml(ev.title)} (${escapeHtml(ev.dateLabel)})</option>`)
      .join("");
  }

  const featured = events.find((e) => e.featured) || events[0];
  const others = events.filter((e) => e.id !== featured?.id);

  if (featuredWrap && featured) {
    featuredWrap.innerHTML = `
      <div class="summit-card">
        <div>
          <span class="hero-eyebrow" style="margin-bottom:14px;"><span class="dot"></span>${escapeHtml(featured.badge)}</span>
          <h2 style="font-size:clamp(1.75rem,3vw,2.45rem); margin-bottom:8px;">${escapeHtml(featured.title)}</h2>
          <p style="color:var(--gold-400); font-family:var(--font-display); font-weight:700; font-size:1.05rem; margin-bottom:14px;">${escapeHtml(featured.tagline)}</p>
          <p style="color:rgba(255,255,255,0.82); margin-bottom:18px;">${escapeHtml(featured.description)}</p>
          <div class="summit-meta-grid">
            <div class="summit-meta-box">
              <div class="summit-meta-label">Schedule</div>
              <div class="summit-meta-value">${escapeHtml(featured.dateLabel)}</div>
            </div>
            <div class="summit-meta-box">
              <div class="summit-meta-label">Time</div>
              <div class="summit-meta-value">${escapeHtml(featured.timeLabel)}</div>
            </div>
            <div class="summit-meta-box">
              <div class="summit-meta-label">Venue</div>
              <div class="summit-meta-value">${escapeHtml(featured.venue)}</div>
            </div>
            <div class="summit-meta-box">
              <div class="summit-meta-label">Confirmed Scholars</div>
              <div class="summit-meta-value" id="summit-rsvp-count">${escapeHtml(featured.rsvpCount)} Registered</div>
            </div>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:12px;">
            <a href="#rsvp-section" class="btn btn-primary btn-lg" data-select-event="${escapeHtml(featured.id)}">Reserve Your Seat</a>
            <a href="${escapeHtml(featured.whatsappUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline-light btn-lg">Join Summit WhatsApp Group</a>
          </div>
        </div>
        <div>
          ${
            featured.flyerUrl
              ? `<div style="margin-bottom:18px; border-radius:14px; overflow:hidden; border:1px solid rgba(255,255,255,0.16); background:rgba(255,255,255,0.04);">
                   <img src="${escapeHtml(featured.flyerUrl)}" alt="${escapeHtml(featured.title)} event flyer" style="width:100%; height:auto; display:block;" />
                 </div>`
              : ""
          }
          <h3 style="font-size:0.9rem; text-transform:uppercase; letter-spacing:0.1em; color:var(--gold-400); margin-bottom:14px;">What You Will Master</h3>
          <div class="track-list">
            ${(featured.tracks || [])
              .map(
                (t) => `
              <div class="track-item">
                <strong>${escapeHtml(t.title)}</strong>
                <span>${escapeHtml(t.detail)}</span>
              </div>`
              )
              .join("")}
          </div>
        </div>
      </div>`;
  }

  if (listWrap) {
    listWrap.innerHTML = others
      .map(
        (ev) => `
        <article class="card card-interactive" style="gap:14px;">
          ${
            ev.flyerUrl
              ? `<div style="border-radius:12px; overflow:hidden; border:1px solid var(--border); background:var(--surface-50);">
                   <img src="${escapeHtml(ev.flyerUrl)}" alt="${escapeHtml(ev.title)} flyer" style="width:100%; height:auto; max-height:280px; object-fit:contain; display:block; margin:0 auto;" />
                 </div>`
              : ""
          }
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
            <span class="badge badge-crimson">${escapeHtml(ev.badge)}</span>
            <span class="badge badge-navy">${escapeHtml(ev.dateLabel)}</span>
          </div>
          <h3>${escapeHtml(ev.title)}</h3>
          <p>${escapeHtml(ev.description)}</p>
          <div style="font-size:0.86rem; color:var(--ink-600); display:grid; gap:4px; background:var(--surface-50); padding:12px 14px; border-radius:10px; border:1px solid var(--border);">
            <div><strong>Time:</strong> ${escapeHtml(ev.timeLabel)}</div>
            <div><strong>Format:</strong> ${escapeHtml(ev.venue)}</div>
            <div><strong>Audience:</strong> ${escapeHtml(ev.audience)}</div>
          </div>
          <div class="paper-footer">
            <span style="font-size:0.82rem; font-weight:600; color:var(--navy-800);">${escapeHtml(ev.rsvpCount)} registered</span>
            <a href="#rsvp-section" class="btn btn-primary btn-sm" data-select-event="${escapeHtml(ev.id)}">Register Free</a>
          </div>
        </article>`
      )
      .join("");
  }
}

async function init() {
  const res = await ICR.getEvents();
  eventsCache = res.events || [];
  renderEvents(eventsCache);

  // Pre-fill authenticated member info if signed in
  try {
    const me = await ICR.getMe();
    if (me.authenticated && me.user) {
      const nameInput = document.getElementById("rsvp-name");
      const emailInput = document.getElementById("rsvp-email");
      const instInput = document.getElementById("rsvp-institution");
      if (nameInput && !nameInput.value) nameInput.value = me.user.fullName || "";
      if (emailInput && !emailInput.value) emailInput.value = me.user.email || "";
      if (instInput && !instInput.value) instInput.value = me.user.institution || "";
    }
  } catch {
    // ignore
  }

  document.body.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-select-event]");
    if (!btn) return;
    const select = document.getElementById("rsvp-event-select");
    if (select) select.value = btn.dataset.selectEvent;
  });

  const form = document.getElementById("event-rsvp-form");
  const alertBox = document.getElementById("rsvp-alert");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const origText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Confirming Seat...";
    alertBox.className = "alert";

    const payload = {
      eventId: form.eventId.value,
      fullName: form.fullName.value.trim(),
      email: form.email.value.trim(),
      institution: form.institution.value.trim(),
      trackInterest: form.trackInterest.value,
    };

    try {
      await submitNetlifyForm(form);
      const result = await ICR.rsvpEvent(payload);
      alertBox.textContent = result.message || "Registration confirmed! Check your email for event updates.";
      alertBox.className = "alert alert-success show";
      showToast("Event RSVP confirmed!", "success");

      if (result.rsvpCount && payload.eventId === "evt-mega-summit-2026") {
        const countEl = document.getElementById("summit-rsvp-count");
        if (countEl) countEl.textContent = `${result.rsvpCount} Registered`;
      }
      form.reset();
    } catch (err) {
      alertBox.textContent = err.message || "Could not complete registration. Please check all fields.";
      alertBox.className = "alert alert-error show";
      showToast(err.message || "Registration failed.", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = origText;
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
