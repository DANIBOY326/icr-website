# Innovative Campus Researchers (ICR) — Full-Stack Netlify Platform

A complete, publication-grade standalone web platform for **Innovative Campus Researchers (ICR)** built for **Netlify** (Static Editorial Frontend + Netlify Functions v2 + `@netlify/blobs` persistence + Netlify Forms + Cryptographic Member Auth).

## Architecture Overview

- **Frontend (`public/`):**
  - `index.html` — Hero with ICR SVG shield crest, 4 pillars, unified Vision/Mission/Core Values cards, campus community showcase, featured working papers, flagship summit spotlight, and live mailing-list subscription.
  - `research.html` — Live searchable & discipline-filterable Projects & Research Archive with 1-click APA citation copy and Abstract Reader modal.
  - `events.html` — Uncropped flagship **First Campus Mega Research Summit** tracks, recurring clinics/workshops, and live RSVP registration form.
  - `community.html` — Executive Council cards + filterable Community Researchers directory.
  - `join.html` — Membership benefits + validated Netlify Membership Application form.
  - `constitution.html` — Interactive ICR Constitution reader with sticky Table of Contents, instant clause search, and Print/PDF layout.
  - `portal.html` — Authenticated **ICR Member Portal** (Sign In, Create Account, Researcher Profile editor, Paper Submission Studio, My RSVPs, and Executive Review Queue).
- **Backend (`netlify/functions/`):**
  - `auth-register.mjs`, `auth-login.mjs`, `auth-logout.mjs`, `auth-me.mjs` — `scrypt` password hashing + `HMAC-SHA256` signed HttpOnly session cookies + private Env-Var Executive Access & Invite Codes.
  - `papers.mjs`, `events.mjs`, `members.mjs`, `newsletter.mjs`, `applications.mjs` — REST API endpoints backed by `@netlify/blobs`.
  - **Phase 2 Executive CMS (`uploads.mjs`, `media.mjs`, `admin-events.mjs`, `admin-executives.mjs`):**
    - Direct PDF manuscript upload (up to 4.5 MB) and JPG/PNG/WebP image upload (up to 3.5 MB) stored in `@netlify/blobs` (`icr-media`) and served via `/api/media?key=...`.
    - No-code **Events & Flyers Manager** (create/edit/delete summits, clinics, workshops, upload uncropped event flyers, toggle flagship event).
    - No-code **Executive Council & Headshots Manager** (add/edit/remove officers and upload real portrait headshots for `/community`).
- **Netlify Forms:**
  - `icr-newsletter`, `icr-event-rsvp`, `icr-membership`, and `icr-paper-submission` are configured with `data-netlify="true"` and honeypot spam protection.

## Production Configuration (Netlify Dashboard — 100% Free)

Go to **Netlify Dashboard → icr-website → Project configuration → Environment variables** and add:

1. **Executive Council Admin Access (Free & Private):**
   - `ICR_EXEC_EMAIL` — Owner / President's private executive email (e.g., `icr2026@gmail.com`)
   - `ICR_EXEC_PASSWORD` — Strong private password known only to the owner/executives
   - `ICR_EXEC_NAME` *(optional)* — Display name (e.g., `ICR Executive Council`)
   - `ICR_EXEC_CODE` *(optional)* — Secret invite code so additional Executive Council officers can create their own personal Executive accounts on `/portal`
2. **Session Signing Secret (Recommended):**
   - `ICR_JWT_SECRET` — Any long random string (32+ characters) for signing `HttpOnly` member session cookies.
3. **Netlify Form Notifications:**
   - Forms are already enabled on the project (`icr-membership`, `icr-event-rsvp`, `icr-paper-submission`, `icr-newsletter`). Under **Forms → Form notifications**, add `icr2026@gmail.com` to receive instant email alerts whenever someone applies or RSVPs!

## Local Development & Deployment

```bash
npm install
npm run dev          # Runs frontend + Netlify Functions locally
npm run deploy:prod  # Deploys directly to Netlify production
```
