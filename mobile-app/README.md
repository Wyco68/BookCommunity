# Books and Friends (Mobile)

React Native + Expo mobile client for Books and Friends, using the same Supabase backend as the web app.

## Features implemented

- Email/password sign in and sign up
- Session discovery with search, visibility filter, and active/archived tabs
- Create session (title, author, chapters, description, visibility, join policy)
- Join open sessions, request to join request-based sessions, and leave sessions
- Progress updates by chapter with progress bars
- Session detail view with member progress
- Single-thread comments and like toggles
- Join request approve/reject flow for session owner
- Archive/restore for session owner
- Realtime refresh for comments, likes, progress, members, and join requests

## Environment

Create a .env file in this folder:

EXPO_PUBLIC_SUPABASE_URL=<your-supabase-url>
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-supabase-publishable-key>

You can copy values from the web app env if you are using the same Supabase project.

## Run

npm install
npm run start

Then use Expo Go or a simulator to open the app.
