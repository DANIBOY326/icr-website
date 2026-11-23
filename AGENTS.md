# Innovative Campus Researchers (ICR) — Project Context & Rules

This file preserves the full architectural context, design decisions, security rules, and deployment details established during the original ICR website audit and build so every future conversation in `icr-website` has complete continuity automatically.

## 1. Project Identity & Deployment

- **Organization:** Innovative Campus Researchers (ICR) — a collaborative, non-profit academic community empowering students and early-career researchers (`icr2026@gmail.com`).
- **Purpose:** Standalone full-stack web platform replacing the legacy Carrd splash page (`icresearchers.carrd.co`) and legacy Google Sites site (`sites.google.com/view/innovative-campus-researchers/home`).
- **Workspace:** Standalone repository at `C:\Users\budge\OneDrive\Documents\Dan\IDEAS_Dan\icr-website` (completely independent from `Budget AI Translator`).
- **GitHub Repository:** `https://github.com/DANIBOY326/icr-website` (branch: `main`).
- **Production URL:** `https://icr-website.netlify.app/`
- **Netlify Site ID:** `e365070f-6bdb-4e68-a495-e996ee649ef8` (connected to `DANIBOY326/icr-website` for automatic deploys on `git push` to `main`).
- **Cost Constraint:** Keep hosting, storage, authentication, and forms **100% free** on Netlify's starter tier unless the owner explicitly requests paid services or a custom `.org` domain.

## 2. Design System & UI/UX Standards

Maintain the editorial academic visual identity derived from the ICR shield crest (`public/favicon.svg`):

- **Palette (`public/assets/css/styles.css`):**
  - Deep Academic Navy: `--navy-950: #0b1320`, `--navy-900: #111d30`, `--navy-800: #1a2c47`
  - Academic Crimson: `--crimson-600: #b8292f`, `--crimson-500: #d13b3b`, `--crimson-700: #941e23`
  - Gold Laurel Accent: `--gold-500: #c99b3b`, `--gold-400: #e5be67`
  - Surfaces & Ink: `#ffffff`, `#f7f9fc`, `#0f172a`, `#334155`, `#475569`
- **Typography:** Display `Plus Jakarta Sans`, Body `Inter`, Editorial accents `Newsreader`. Left-align body prose (avoid justified text rivers and avoid Times New Roman).
- **Fluid 92% Width Layout:** Keep `.container` at true **`92%` viewport width** (`--container-width: 92%`, with `94%` on small mobile `<= 420px`) with **no narrow pixel `max-width` cap**, a solid high-contrast single-line sticky navbar, and zero horizontal overflow across desktop (`1920px`, `1440px`), tablet (`768px`), and mobile (`375px`).
- **Media & Imagery:**
  - Never crop the ICR crest or use it as a noisy full-bleed background behind text.
  - Render uploaded event flyers uncropped (`height: auto; object-fit: contain`) and executive council portraits as clean circular covers (`object-fit: cover`).
- **CSS Cache Busting:** `netlify.toml` serves `/assets/*` with `Cache-Control: public, max-age=0, must-revalidate`. Whenever making significant stylesheet updates in `public/assets/css/styles.css`, bump the `?v=...` version query string (currently `?v=4`) across all 7 HTML files in `public/`.

## 3. Architecture Overview (Phase 1 + Phase 2 Executive CMS)

- **Static Multi-Page Frontend (`public/`):**
  - `index.html` — Hero, 4 pillars, unified Vision/Mission/Core Values cards, campus community showcase, featured working papers, flagship summit spotlight, mailing list.
  - `research.html` (`/research`, `/projects`) — Searchable, discipline-filterable Projects & Research Archive, Abstract Reader modal, 1-click APA citations, and full PDF download links.
  - `events.html` (`/events`) — Flagship **First Campus Mega Research Summit**, event flyer display, tracks, recurring clinics, WhatsApp link, and live RSVP form.
  - `community.html` (`/community`) — Executive Council cards (with optional uploaded headshots) and filterable Community Researchers directory.
  - `join.html` (`/join`) — Membership benefits + validated Netlify Membership Application form.
  - `constitution.html` (`/constitution`) — Interactive ICR Constitution reader with sticky Table of Contents, live search, and print/PDF styling.
  - `portal.html` (`/portal`, `/login`) — Encrypted Member Portal & Phase 2 No-Code Executive CMS.
  - Frontend scripts (`public/assets/js/`): `api.js` (REST client with local preview fallback), `app.js`, `research.js`, `events.js`, `community.js`, `join.js`, `constitution.js`, `portal.js`.
- **Serverless Backend (`netlify/functions/`, ESM, `esbuild` bundler, `@netlify/blobs`):**
  - Shared helpers (`netlify/functions/_lib/`): `auth.mjs` (`scrypt` password hashing + `HMAC-SHA256` signed `HttpOnly` session cookies), `http.mjs` (sanitization/responses), `store.mjs` (Blob collections & seed data).
  - Auth endpoints: `auth-register.mjs`, `auth-login.mjs`, `auth-logout.mjs`, `auth-me.mjs`.
  - Public/Member endpoints: `papers.mjs` (GET/POST/PATCH/DELETE), `events.mjs` (GET/POST RSVP), `members.mjs`, `newsletter.mjs`, `applications.mjs`.
  - Phase 2 No-Code Executive CMS endpoints:
    - `uploads.mjs` — Authenticated file upload to `@netlify/blobs` store `"icr-media"`: signed-in members can upload PDF manuscripts (`<= 4.5 MB`); executives can upload JPG/PNG/WebP images (`<= 3.5 MB`) for event flyers and executive headshots.
    - `media.mjs` — Serves uploaded PDFs and images via `GET /api/media?key=<id>`.
    - `admin-events.mjs` — Executive-only CRUD for creating, editing, deleting events, uploading flyers, and toggling the flagship featured event.
    - `admin-executives.mjs` — Executive-only CRUD for adding, editing, removing Executive Council officers and uploading portrait headshots.
- **Netlify Forms:** `icr-newsletter`, `icr-event-rsvp`, `icr-membership`, `icr-paper-submission` (all wired with `data-netlify="true"` and honeypot spam fields).

## 4. Security & Role-Based Access Rules (Mandatory)

1. **No Public Admin/Demo Shortcuts:** Never add or re-enable any "Try Executive Demo" button, pre-filled admin credentials, or seeded/hardcoded executive accounts in frontend or backend code. Keep the legacy `user-icr-exec-demo` purge guards intact in `auth-login.mjs` and `auth-me.mjs`.
2. **Environment-Variable Executive Access:** Executive logins are controlled strictly via Netlify Environment Variables (never commit `.env` or secrets to Git):
   - `ICR_EXEC_EMAIL` — Primary executive login email.
   - `ICR_EXEC_PASSWORD` — Private executive password (marked secret in Netlify).
   - `ICR_EXEC_NAME` *(optional)* — Display name.
   - `ICR_EXEC_CODE` *(optional)* — Private invite code allowing additional Executive Council officers to self-register as `role: "executive"` via `/portal`.
   - `ICR_JWT_SECRET` *(recommended)* — Secret key for signing `HttpOnly` session cookies.
3. **Server-Side RBAC Enforcement:** Every administrative mutation (approving/unpublishing/deleting papers, viewing membership applications, managing events/executives, uploading site images) must verify `session && session.role === "executive"` on the backend. Regular members (`role: "member"`) may only submit manuscripts (defaulting to `"Under Peer Review"`), upload manuscript PDFs, edit their own Scholar Profile, and view their own submissions/RSVPs.

## 5. Development & Deployment Workflow

- Run locally: `npm run dev` (requires `npm install`).
- Deploy: Push commits to `origin/main` (`https://github.com/DANIBOY326/icr-website`) for automatic Netlify builds, or deploy manually via `npm run deploy:prod` / Netlify MCP (`siteId: e365070f-6bdb-4e68-a495-e996ee649ef8`).
- Original audit conversation reference: `Website Audit And Visual Suggestions` (ID `fba20036-a788-4840-b71f-55a3ad29494a`, audit report at `C:\Users\budge\.gemini\antigravity\brain\fba20036-a788-4840-b71f-55a3ad29494a\icr_website_audit.md`).
