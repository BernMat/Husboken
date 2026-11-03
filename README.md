
[![CodeQL](https://github.com/BernMat/Husboken/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/BernMat/Husboken/actions/workflows/github-code-scanning/codeql)
# Husboken

Keep track of your home projects (garden planning, gardening, renovation and
building). For each project, it handles notes, photos, purchasing list and contacts.
The UI is available in Swedish and English.

https://husboken.vercel.app/

## Architecture

Husboken is a static single-page application with no backend server of its
own. The browser talks directly to Supabase, so the database is the only
trusted layer: everything that must hold for security or data integrity is
enforced there, not in JavaScript.

### Functional layers

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Entry & routing      src/main.js, src/router.js           │  browser
├──────────────────────────────────────────────────────────────┤  (untrusted)
│ 2. Presentation         src/views/, src/components/,         │
│                         src/i18n/, src/styles/               │
├──────────────────────────────────────────────────────────────┤
│ 3. Service / data access src/services/*.js                   │
├──────────────────────────────────────────────────────────────┤
│    supabase-js client   src/supabase_client.js               │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTPS + user JWT
┌──────────────────────────────▼───────────────────────────────┐
│ 4. Platform (Supabase)  Auth, Postgres, Storage              │  server
│    rules defined in     supabase/migrations/*.sql            │  (trusted)
└──────────────────────────────────────────────────────────────┘
```

Each layer only calls the layer directly below it.

1. **Entry and routing** (`main.js`, `router.js`): starts the app, restores the
   login session, builds the header and maps hash URLs such as `#/projects/42`
   to a view. Logged-out users are always sent to the login view.
2. **Presentation** (`views/`, `components/`, `i18n/`, `styles/`): renders pages
   with the safe `el()` DOM builder, handles user input, shows translated
   texts and error messages. Views never call Supabase directly.
3. **Service / data access** (`services/`): one module per entity (auth,
   projects, notes, contacts, shopping items, attachments). Each function wraps
   one Supabase operation, returns plain data and throws on error. This is the
   only code that imports the Supabase client.
4. **Platform** (Supabase): Auth issues the JWT; Postgres stores the data and
   applies constraints, triggers and Row Level Security; Storage holds the files
   in a private bucket. Its behaviour is defined by the SQL migrations.

### Where the business logic resides

Most business rules live in the **database (layer 4)**, defined in
`supabase/migrations/`. The frontend is mostly a thin client on top of it.

| Rule | Where | Location |
|---|---|---|
| Users see and change only their own data | RLS policies on every table (`owner_id = auth.uid()`) | migrations |
| Child rows must belong to one of the user's own projects | RLS `with check` on notes, contacts, shopping items, attachments | migrations |
| Files only under the user's own folder `<user_id>/…` | Storage policies on bucket `attachments` | migrations |
| Owner is set automatically | `owner_id default auth.uid()` | migrations |
| Allowed project types and statuses | `check` constraints | migrations |
| Required fields and maximum text lengths | `check` constraints | migrations |
| File size (20 MB) and allowed file types | Storage bucket settings | migrations |
| `updated_at` kept current | `set_updated_at` triggers | migrations |
| Changing a note, contact, item or file bumps the project's `updated_at` | `touch_parent_project` triggers | migrations |
| Viewing an image does not count as an edit | triggers limited to `update of <columns>` | `20261018120000_attachment_last_viewed.sql` |
| Deleting a project deletes its child rows | `on delete cascade` | migrations |

Some logic lives in the **service layer (layer 3)** because it combines
several platform calls or decides how data is fetched:

- `attachment_service.upload_image()`: builds the storage path
  `<user_id>/<project_id>/<uuid>_<name>`, uploads the file, inserts the
  metadata row, and removes the file again if the insert fails.
- `project_service.delete_project()`: removes the project's files from
  Storage (via `attachment_service.delete_project_files()`) before deleting
  the project row, because the database cannot delete Storage files. If the
  files cannot be removed, the project is kept.
- `attachment_service.get_images()`: orders images by most recently viewed,
  then newest upload.
- `project_service.js`: defines the list of project types and statuses
  (`PROJECT_TYPES`, `PROJECT_STATUSES`) offered in the UI. These must match the
  database `check` constraints.

The **presentation layer (layer 2)** only does input checks for a better user
experience, such as trimming text and rejecting empty required fields before
sending. The database checks the same rules again, so they cannot be bypassed.

## Getting started

1. Install Node.js 20 or later.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure Supabase:
   ```bash
   cp .env.example .env.local
   ```
   Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from
   Supabase dashboard -> Project Settings -> API.
4. Create the database schema (run once, and again after each new migration):
   ```bash
   npx supabase init                       # creates supabase/config.toml, keep existing migrations
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   Alternatively paste `supabase/migrations/20261016120000_initial_schema.sql`
   into the SQL editor in the Supabase dashboard and run it.
5. Start the dev server:
   ```bash
   npm run dev
   ```
   Open http://localhost:5173.

## Project Overview

### Directory structure

| Directory | Description |
|---|---|
| `/` | Entry `index.html`, build config (`vite.config.js`), lint config (`eslint.config.js`), `vercel.json` and `package.json`. |
| `.github/workflows/` | GitHub Actions CI/CD: lint, unit tests and build on every PR and push to `main`; deploys `main` to Vercel production. |
| `public/` | Static files copied as-is to the build: PWA manifest and the minimal service worker. |
| `public/icons/` | App icons used by the manifest (192 px, 512 px, SVG). |
| `public/images/` | Background image for the UI. |
| `src/` | Application code: `main.js` (entry point), `router.js` (hash router), `supabase_client.js` (the single Supabase client). |
| `src/components/` | Reusable UI helpers: safe DOM builder (`dom.js`), language switcher, header title, translated error messages. |
| `src/i18n/` | Small translation module: `t()`, language selection and date formatting. |
| `src/i18n/locales/` | Swedish (`sv.js`) and English (`en.js`) dictionaries with identical keys. |
| `src/services/` | All Supabase calls: auth, projects, notes, contacts, shopping items and attachments. |
| `src/views/` | Page render functions: login, project list and project detail. |
| `src/styles/` | Plain, mobile-first CSS (`main.css`). |
| `supabase/migrations/` | Version-controlled SQL migrations: tables, triggers, RLS policies and the storage bucket. |
| `tests/` | Vitest unit tests (jsdom) with a Supabase mock. |

Generated, git-ignored directories: `node_modules/`, `dist/` (production build), `.vercel/`, `supabase/.temp/`.

### Tech stack

| Layer | Technology |
|---|---|
| Language | JavaScript (ES2022, ES modules), no TypeScript |
| UI | Vanilla JavaScript and plain CSS, no UI framework |
| Build tool / dev server | Vite |
| Routing | Own hash-based router (`#/projects/42`) |
| Internationalisation | Own i18n module, Swedish and English |
| Backend | Supabase (no server code of our own) |
| Authentication | Supabase Auth, email + password |
| Database | Supabase Postgres with Row Level Security |
| File storage | Supabase Storage, private bucket `attachments` |
| Client library | `@supabase/supabase-js` |
| PWA | Web app manifest + minimal service worker |
| Testing | Vitest + jsdom |
| Linting | ESLint |
| CI/CD | GitHub Actions |
| Hosting | Vercel |

### Limitations

- **No offline mode.** The service worker only makes the app installable; it
  caches nothing, so the app needs a network connection.
- **No sharing.** Every project belongs to one user; projects cannot be shared
  with family members or contractors.
- **No search.** There is no full-text search across projects, notes or contacts.
- **No drawing tool.** Drawings must be made elsewhere and uploaded as files.
- **Attachments:** the upload button accepts images only, at most 20 MB per file.
  The storage bucket also allows PDF, but there is no UI for uploading it yet.
  Image links are signed URLs that expire after one hour.
- **Measurements** exist in the database schema but have no service or UI yet.
- **Two UI languages only:** Swedish and English. User-entered content is never translated.
- **Email + password login only:** no social login or two-factor authentication.
- **Depends on hosted services:** Supabase and Vercel; free-tier quotas apply.

### Supabase Auth settings

In the Supabase dashboard -> Authentication -> URL Configuration, set
**Site URL** to your Vercel URL and add `http://localhost:5173` under
**Redirect URLs**, so the email confirmation link returns to the app.

### Deploy (Vercel)

1. Import the GitHub repository in Vercel (framework preset: Vite).
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables.
3. Every push to `main` builds and deploys automatically.

## Developed with
Claude Code (agentic development) as part of the course "Next-Generation Software Development with AI."

