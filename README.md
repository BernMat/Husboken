# Husboken

Keep track of your home projects (garden planning, gardening, renovation and
building) with notes, measurements, photos, drawings and contacts.
The UI is available in Swedish and English.

See `CLAUDE.md` for the architecture, data model and code conventions.

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

## Supabase Auth settings

In the Supabase dashboard -> Authentication -> URL Configuration, set
**Site URL** to your Vercel URL and add `http://localhost:5173` under
**Redirect URLs**, so the email confirmation link returns to the app.

## Deploy (Vercel)

1. Import the GitHub repository in Vercel (framework preset: Vite).
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables.
3. Every push to `main` builds and deploys automatically.
