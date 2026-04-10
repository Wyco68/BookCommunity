# Books and Friends

Books and Friends is implemented with two clients that share the same Supabase backend:

- Web: React + Vite
- Mobile: React Native + Expo

## Implemented in this iteration

- Email/password authentication with Supabase
- Authenticated-only app flow
- Profile editing (display name)
- Create reading session (title, author, chapters, description, visibility, join policy)
- Session discovery (search, visibility filter, active/archived tabs)
- Membership flow (open join, request-to-join, leave)
- Chapter progress updates with progress bars
- Single-thread discussion with like reactions
- Owner actions (archive/restore session, approve/reject join requests)
- Realtime refresh for comments, likes, progress, memberships, and join requests

## Project structure

- `src/App.tsx`: main app logic and UI
- `src/lib/supabase.ts`: Supabase client
- `src/types.ts`: shared domain types
- `supabase/schema.sql`: starter schema and RLS policies
- `mobile-app/`: React Native + Expo client

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

## Run mobile app

```bash
cd mobile-app
npm install
npm run start
```

The mobile client uses `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Initialize database

1. Open Supabase SQL Editor.
2. Run `supabase/schema.sql`.
3. Make sure email/password sign-up is enabled in Supabase Auth settings.

## Notes

- Web and mobile share the same Supabase schema and realtime channels.
- Avatar upload is currently implemented in web only.
