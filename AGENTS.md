# BookCom Agents

Dual-client (web + mobile) React/React Native app backed by Supabase.

## Dev Commands

**Web (root)**
```bash
npm run dev          # vite dev server
npm run build        # tsc -b && vite build
npm run lint         # eslint
npm run test         # vitest run (node env)
npm run test:coverage
```

**Mobile (`mobile-app/`)**
```bash
npm run start        # expo start
npm run typecheck    # tsc --noEmit (no lint/test)
```

## Key Quirks

- **Vitest uses `node` environment** (`vitest.config.ts`), not jsdom. Tests cannot use DOM APIs.
- **Test files**: `src/**/*.test.ts` (root only; mobile has no tests)
- **ESLint ignores**: `dist`, `coverage`
- **Build order matters**: `npm run build` runs `tsc -b` before vite build — don't skip the typecheck step
- **No typecheck script in root** — only `mobile-app/` has one

## Environment Variables

| Client | Variable | Prefix |
|--------|----------|--------|
| Web | `.env.local` | `VITE_` |
| Mobile | `mobile-app/.env` | `EXPO_PUBLIC_` |

## Supabase Schema

- Source of truth: `supabase/schema.sql`
- Always run in SQL Editor after setup or schema changes
- **Known issues** (from hard experience):
  - No `create policy if not exists` — use `drop policy if exists` + `create policy`
  - RLS policy recursion — use `public.is_session_member(...)` helper with `security definer` to break cycles
  - Profile FK violations — ensure `public.handle_new_user()` trigger creates profiles row on signup

## Architecture

- `src/` — web app entry points
- `mobile-app/src/` — mobile app (feature-parity with web)
- Both clients share `supabase/` schema and `src/types.ts` patterns
- Auth: email/password only (no OAuth)

## References

- `README.md` — full product/architecture overview
- `projectSpec.md` — MVP decisions, known issues, Supabase setup details

---

# Order/Request & Access Management System

When implementing request/order submission, verification, tracking, or gated access systems:

## Core State Machine

States: `pending` → `approved` | `rejected`
Transitions must be explicit, validated, and auditable.

## Submission
- Strict input validation; flexible schema
- File restrictions (type, size, format)
- Anti-abuse: rate limiting, duplicate detection (hash payloads/files), optional honeypot

## Tracking
- Human-readable tracking code (unique, short)
- Cryptographically secure token (high entropy, unguessable, never reused)

## Verification
- Support manual (admin) and automated (rules/payment APIs) — pluggable without refactoring

## Access Control (CRITICAL)
- Require valid tracking code or token AND `status == approved` AND system flags allow access
- Never expose permanent public URLs for protected resources
- Use short-lived signed URLs or authenticated streaming endpoints
- Generate access URLs on demand, with expiration

## Data Model
- `Request`: trackingCode, secureToken, status, userData (extensible), attachments, hashes, timestamps
- `System`: global availability flag, resource locators (NOT public URLs), feature flags
- Store file references (keys/IDs/paths), NOT direct URLs in database
- Validate all resource locators; prevent directory traversal

## Security (NON-NEGOTIABLE)
- Tokens and signed URLs are secrets — never expose in client-side code
- Use `crypto.getRandomValues()` or equivalent secure randomness for tokens
- Enforce authorization on ALL protected endpoints
- Do NOT log sensitive data (tokens, signed URLs)

## Admin Interface
- Authenticate; view/filter submissions; update status; manage settings and resource locators
- Admin auth must not rely on insecure defaults in production

## Anti-Patterns to AVOID
- Direct file URLs or long-lived permanent access links
- Skipping validation on inputs/uploads
- Weak randomness for tokens
- Storing secrets in frontend code
- Security through obscurity

## Tech Stack
- Tech-stack agnostic — adapt to the project's framework, database, and infrastructure

## Workflow

- **Always request user confirmation before running any command** that makes changes to the system (e.g., file edits, installs, builds, deploys, git operations)
- Use the `question` tool to ask for explicit confirmation when needed
- If the user explicitly asks to run something without confirmation, you may proceed directly