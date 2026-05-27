# BookCom

A dual-client (Web + Mobile) collaborative reading platform allowing users to create, join, and track progress on reading sessions. The platform supports open or request-based access, media uploads per chapter, and real-time notifications.

## Core Features
- **Authentication**: Email/Password and Google OAuth integration via Supabase.
- **Reading Sessions**: Create public or private reading sessions with categorization and sequential chapter tracking.
- **Access Control**: 'Open' or 'Request-based' join policies. Owners can approve/reject join requests.
- **Media Uploads**: Upload images or book files (EPUB/PDF) per chapter with strict sequential enforcement.
- **Progress Tracking**: Individual member chapter progress tracking, capped by the latest uploaded chapter.
- **Collaboration**: Chapter-based commenting and comment liking system.
- **Real-time Notifications**: Live updates for join requests, comments, and session activities.
- **Dual Client**: Shared backend with both React (Web) and React Native/Expo (Mobile) frontends.

## Tech Stack
- **Web Frontend**: React 19, Vite, React Router DOM 7, Zustand, Vanilla CSS.
- **Mobile Frontend**: React Native, Expo 52.
- **Backend & Database**: Supabase (PostgreSQL, Auth, Storage, Realtime).
- **Testing**: Vitest (Node environment) for core logic.
- **Language**: TypeScript.

## Setup Instructions

1. Clone the repository and install dependencies in the root (for web) and `mobile-app/` (for mobile).
2. Start the Supabase local environment or link your remote Supabase project.
3. Apply the database schema by running `supabase/schema.sql` in the SQL Editor.
4. Set up your environment variables.

## Environment Variables

**Web (`.env.local`)**
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Mobile (`mobile-app/.env`)**
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Development Commands

**Web (Root directory)**
- `npm run dev` — Start Vite development server.
- `npm run build` — Run TypeScript compiler (`tsc -b`) and build for production.
- `npm run lint` — Run ESLint.
- `npm run test` — Run Vitest tests (runs in Node environment, no DOM).
- `npm run test:coverage` — Run tests with coverage reports.

**Mobile (`mobile-app/` directory)**
- `npm run start` — Start Expo development server.
- `npm run typecheck` — Run TypeScript compiler without emitting files.

## Production Build
To build the web client for production:
```bash
npm run build
```
This correctly sequences the TypeScript compilation before the Vite build to ensure strict type checking.

## Deployment Notes
- The web app is configured for Vercel deployment (as per `vercel.json` existing in root).
- Ensure that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are configured in the deployment environment variables.
- Supabase edge functions (e.g., `delete-account`, `create-notification`, `send-email`) must be deployed manually via Supabase CLI.

## Security Considerations
- **Row Level Security (RLS)**: Enforced comprehensively across all tables. Users can only access sessions they are members of, or public sessions. Insert/Update/Delete operations are strictly guarded by membership roles (owner vs member).
- **Database Triggers**: Critical business logic (e.g., sequential chapter uploads, progress limit bounds, immutable comment relationships) is enforced at the DB level to prevent frontend bypasses.
- **Storage Security**: Direct storage object access is restricted using RLS policies linked to session membership and ownership. Cover images and media files are stored securely.
