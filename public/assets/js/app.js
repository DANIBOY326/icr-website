/**
 * Shared UI Controller: Header scroll elevation, mobile drawer, auth status indicator,
 * toast notifications, and mailing list subscription handler across all ICR pages.
 */
import { ICR, submitNetlifyForm } from "./api.js";

export function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function showToast(message, type = "info") {
  let stack = document.getElementById("icr-toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "icr-toast-stack";
    stack.className = "toast-stack";
    stack.setAttribute("aria-live", "polite");
    document.body.appendChild(stack);
  }
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    el.style.transition = "all 0.2s ease";
    setTimeout(() => el.remove(), 220);
  }, 4200);
}

export function getInitials(name = "ICR") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "IC";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function initHeaderAndDrawer() {
  const header = document.querySelector(".site-header");
  if (header) {
    const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  const menuBtn = document.getElementById("mobile-menu-btn");
  const drawer = document.getElementById("mobile-drawer");
  if (menuBtn && drawer) {
    const toggle = (force) => {
      const open = typeof force === "boolean" ? force : !drawer.classList.contains("open");
      drawer.classList.toggle("open", open);
      menuBtn.setAttribute("aria-expanded", String(open));
      document.body.style.overflow = open ? "hidden" : "";
    };
    menuBtn.addEventListener("click", () => toggle());
    drawer.addEventListener("click", (e) => {
      if (e.target === drawer) toggle(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && drawer.classList.contains("open")) toggle(false);
    });
  }
}

async function initAuthHeaderBadge() {
  const portalBtns = document.querySelectorAll("[data-portal-btn]");
  if (!portalBtns.length) return;
  try {
    const res = await ICR.getMe();
    if (res.authenticated && res.user) {
      const firstName = res.user.fullName.split(" ")[0];
      portalBtns.forEach((btn) => {
        btn.textContent = `${firstName} · Portal`;
        btn.classList.remove("btn-outline");
        btn.classList.add("btn-navy");
      });
    }
  } catch {
    // ignore
  }
}

function initNewsletterForms() {
  document.querySelectorAll("[data-newsletter-form]").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = form.querySelector('input[type="email"]');
      const btn = form.querySelector('button[type="submit"]');
      const email = input?.value?.trim() || "";
      if (!email) return;

      const origText = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Subscribing...";

      try {
        await submitNetlifyForm(form);
        const res = await ICR.subscribeNewsletter(email);
        showToast(res.message || "Subscribed to ICR Research Digest!", "success");
        form.reset();
      } catch (err) {
        showToast(err.message || "Could not subscribe right now.", "error");
      } finally {
        btn.disabled = false;
        btn.textContent = origText;
      }
    });
  });
}

async function initHomeSummitSync() {
  const flyerImg = document.getElementById("home-summit-flyer");
  if (!flyerImg) return;
  try {
    const res = await ICR.getEvents();
    const events = res.events || [];
    const featured = events.find((e) => e.featured) || events[0];
    if (!featured) return;

    if (featured.flyerUrl) {
      flyerImg.src = featured.flyerUrl;
      flyerImg.alt = `${featured.title} official event flyer`;
    }
    const eyebrow = document.getElementById("home-summit-eyebrow");
    const title = document.getElementById("home-summit-title");
    const tagline = document.getElementById("home-summit-tagline");
    const desc = document.getElementById("home-summit-desc");
    const caption = document.getElementById("home-summit-caption");
    const tracksEl = document.getElementById("home-summit-tracks");

    if (eyebrow && featured.dateLabel) {
      eyebrow.innerHTML = `<span class="dot"></span>${escapeHtml(featured.badge || "Upcoming Flagship Event")} · ${escapeHtml(featured.dateLabel)}`;
    }
    if (title && featured.title) title.textContent = featured.title;
    if (tagline && featured.tagline) tagline.textContent = featured.tagline;
    if (desc && featured.description) desc.textContent = featured.description;
    if (caption) {
      caption.textContent = [featured.dateLabel, featured.timeLabel, featured.venue].filter(Boolean).join(" · ");
    }
    if (tracksEl && Array.isArray(featured.tracks) && featured.tracks.length) {
      tracksEl.innerHTML = featured.tracks
        .slice(0, 4)
        .map((t, i) => `<div class="track-item"><strong>0${i + 1} · ${escapeHtml(t.title)}</strong><span>${escapeHtml(t.detail)}</span></div>`)
        .join("");
    }
  } catch {
    // keep static fallback intact
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initHeaderAndDrawer();
  initAuthHeaderBadge();
  initNewsletterForms();
  initHomeSummitSync();
});
