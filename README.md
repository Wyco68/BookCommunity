# BookCom

Authenticated social reading groups: shared sessions, chapter media, member progress, and discussion — backed by Supabase and built with React.

## Overview

BookCom lets signed-in users create reading sessions for books, discover public sessions by category, join open sessions or request access, and collaborate inside a session:

- **Sessions** — title, author, chapters, visibility, join policy, single category tag
- **Media** — owner uploads chapter images or book files (PDF/EPUB); sequential chapters only
- **Progress** — members record current chapter (owners do not track reading progress)
- **Discussion** — one thread per session with like-only reactions
- **Realtime** — live updates for comments, likes, progress, members, and join requests

Product and database contracts: **[docs/projectspec.md](docs/projectspec.md)**  
UI design system: **[docs/DESIGN.md](docs/DESIGN.md)**

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite, React Router |
| Backend | Supabase (PostgreSQL, Auth, Realtime, Storage) |
| Security | Row Level Security, triggers, `security definer` helpers |

## Prerequisites

- Node.js 20+
- npm
- A [Supabase](https://supabase.com) project with Email auth enabled (Google OAuth optional for web)

## Setup

### 1. Clone and install

```bash
git clone <repository-url>
cd Bookcom
npm install
```

### 2. Environment variables

Create `.env.local` in the project root:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_or_publishable_key
```

For Google sign-in, add your site URL and `http://localhost:5173/auth/callback` (or your dev origin + `/auth/callback`) under **Authentication → URL configuration** in the Supabase dashboard.

### 3. Database

1. Open the Supabase **SQL Editor**.
2. Paste and run the full contents of **`supabase/schema.sql`** (drop + create).
3. Confirm seeded categories and RLS policies exist.

For an existing database that still has `session_categories` / `category_members`, run **`supabase/migrations/one_category_per_session.sql`** first, then reconcile with `schema.sql` as needed.

On an existing project with profiles already in place, also run **`supabase/migrations/20260526_identity_and_account_delete.sql`** once (deduplicates usernames, avatar path trigger, revokes profile INSERT).

### 3b. Account deletion (Edge Function)

Deploy the `delete-account` function (requires [Supabase CLI](https://supabase.com/docs/guides/cli)):

```bash
supabase functions deploy delete-account
```

The function uses `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` from the project environment (set automatically when deployed). Account deletion in the app calls this function only — never delete auth users or profile rows from the client.

### 3c. Notifications (database + Edge Functions)

1. Run **`supabase/migrations/20260526053341_notifications_system.sql`** in the SQL Editor (or apply via CLI on a linked project).
2. Run **`supabase/migrations/20260526120000_notification_fixes.sql`** (COMMENT_LIKED, session-delete persistence).
3. Deploy notification functions:

```bash
supabase functions deploy create-notification
supabase functions deploy send-email
```

4. Set Edge Function secrets: `RESEND_API_KEY`, `EMAIL_FROM`, `NOTIFICATION_INTERNAL_SECRET`, and optionally `APP_URL` (defaults to `https://bookcom.app`).

`create-notification` requires a valid user JWT and verifies `actorId` matches the caller. `send-email` is internal-only (called from `create-notification`).

### 4. Run locally

```bash
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173`).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Typecheck (`tsc -b`) + production build |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |
| `npm run test` | Vitest (node environment) |

## Project layout

```
src/                 React app (pages, components, hooks, i18n)
supabase/
  schema.sql         Database source of truth (full recreate)
  migrations/        Incremental upgrades for existing DBs
  functions/         Edge Functions (e.g. delete-account)
docs/
  projectspec.md     Product + schema contract
  DESIGN.md          Visual design system
```

## Documentation

- [Project specification](docs/projectspec.md) — domain model, RLS, triggers, API patterns
