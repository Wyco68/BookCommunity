# Books and Friends (Web)

Web-first implementation of Books and Friends using React + Vite + Supabase.

## Implemented in this iteration

- Email/password authentication with Supabase
- Authenticated-only web app shell
- Create reading session (title, author, chapters, visibility, join policy)
- Join session
- Submit chapter progress with a progress bar display
- Responsive UI for mobile, tablet, and desktop

## Project structure

- `src/App.tsx`: main app logic and UI
- `src/lib/supabase.ts`: Supabase client
- `src/types.ts`: shared domain types
- `supabase/schema.sql`: starter schema and RLS policies

## Environment variables

Local env is already configured in `.env.local`.

Example:

```bash
VITE_SUPABASE_URL=https://rihvnpuuxuhlcdlwxkbf.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_vmRSaZqMRnxC2LFYnCxL-Q_ZKig1-i8
```

## Run locally

```bash
npm install
npm run dev
```

## Initialize database

1. Open Supabase SQL Editor.
2. Run `supabase/schema.sql`.
3. Make sure email/password sign-up is enabled in Supabase Auth settings.

## Notes

- Current web implementation focuses on auth, sessions, and chapter progress.
- Discussion thread and like reactions are already modeled in schema, but UI for them is planned in the next iteration.
