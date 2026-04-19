# BookCom

BookCom is a dual-client reading community app built on Supabase.

- Web client: React + Vite + TypeScript
- Mobile client: React Native + Expo + TypeScript
- Backend: Supabase Auth, Postgres, Realtime, Storage, RPC, and RLS

The app is authenticated-only: users sign in, join reading sessions, post chapter progress, discuss in one session thread, and react with like-only reactions.

## Product summary

BookCom supports shared reading sessions where members track chapter progress together.

### Core MVP behavior

- Email/password authentication
- Create sessions with title, author, chapters, description, visibility, and join policy
- Discover sessions using search and visibility filters
- Open join and request-to-join membership flows
- Session owner archive/restore controls
- Chapter-based progress updates with progress bars
- Single discussion thread per session
- Like-only reactions on comments
- Owner approval/rejection of join requests
- Live UI refresh through Supabase Realtime

## Architecture

Both clients use the same Supabase project and schema.

1. Auth: Supabase Auth issues sessions for web and mobile.
2. Data model: shared Postgres tables in supabase/schema.sql.
3. Security: RLS policies enforce per-user access by role, membership, and ownership.
4. Session creation safety: create_reading_session RPC validates and inserts deterministic session records.
5. Realtime: clients subscribe to table change events and refresh detail/list state.
6. Avatars: web currently uploads profile images to Supabase Storage avatars bucket.

## Source code walkthrough

### Root web app

- src/App.tsx
	- Main web UI and state orchestration.
	- Handles auth flow, session list/detail loading, profile updates, avatar upload, membership actions, comments/likes, join request moderation, and realtime subscriptions.
- src/lib/supabase.ts
	- Initializes Supabase client from VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.
- src/types.ts
	- Shared TypeScript domain contracts for sessions, members, progress, comments, likes, profiles, and join requests.
- src/i18n/
	- English and Burmese translation dictionaries and language typing.

### Mobile client

- mobile-app/App.tsx
	- Main React Native app with feature parity for auth, session flows, comments, likes, progress, and join request moderation.
	- Uses AsyncStorage for persisted language preference.
- mobile-app/src/lib/supabase.ts
	- Creates Supabase client with AsyncStorage-backed auth persistence.
	- Reads EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
- mobile-app/src/types.ts
	- Mobile-side shared domain contracts (aligned with web).
- mobile-app/src/i18n/
	- Mobile translation dictionaries (English/Burmese).

### Backend schema and policies

- supabase/schema.sql
	- Extensions, tables, constraints, functions, trigger, grants, RLS enablement, and policies.
	- Main tables:
		- profiles
		- reading_sessions
		- session_members
		- progress_updates
		- comments
		- comment_likes
		- session_join_requests
	- Main functions:
		- public.handle_new_user()
		- public.create_reading_session(...)
		- public.is_session_member(...)

## Local setup

### Prerequisites

- Node.js 20+ recommended
- npm
- A Supabase project with email/password auth enabled
- Expo CLI/runtime tooling for mobile testing

### 1) Configure environment variables

Web (project root .env.local):

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Mobile (mobile-app/.env):

```bash
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

### 2) Initialize database

1. Open Supabase SQL Editor.
2. Run supabase/schema.sql.
3. Verify Auth > Providers has Email enabled.

### 3) Run web app

```bash
npm install
npm run dev
```

### 4) Run mobile app

```bash
cd mobile-app
npm install
npm run start
```

## Scripts

Root project:

- npm run dev
- npm run build
- npm run lint
- npm run preview

Mobile project:

- npm run start
- npm run android
- npm run ios
- npm run web
- npm run typecheck

## Current implementation notes

- Web and mobile are largely MVP-parity against the project spec.
- Both clients already include bilingual UI support (English and Burmese).
- Avatar upload is currently implemented on web; mobile supports display_name editing but not avatar upload UI yet.
- Session owner comment moderation/delete of other users is not implemented.
- OAuth login and guest browsing are intentionally out of scope for current MVP.

## Project status

- Web: MVP features implemented and integrated with Supabase.
- Mobile: MVP features implemented with Expo + Supabase.
- Backend: schema, RPC, and RLS policies support current functional scope.

For detailed product decisions and rollout context, see projectSpec.md.
