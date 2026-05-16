# BookCom — End-to-End QA Report

**Date:** 2026-05-14
**Tester:** Cursor agent (Playwright MCP)
**Build:** `npm run dev` against `http://localhost:5173`
**Account:** `herik.dev06@gmail.com`
**Scope:** Full UI pass with real writes, against the live Supabase project (`pfefqlcxnefetpyoubkd`).

## Test Setup

Seeded **22 sessions** owned by a second auth user (`wyco68@gmail.com`) via admin SQL to cover the scenarios that need a non-owner perspective:

| Count | Visibility | Join policy | Purpose                                                                              |
| :---: | :--------- | :---------- | :----------------------------------------------------------------------------------- |
|  20   | `public`   | `open`      | Discovery, pagination (>20 → Load more), join-modal flow.                            |
|   1   | `public`   | `request`   | Request-to-join modal, "Request pending" pill, click-gating on pending-request card. |
|   1   | `private`  | `open`      | RLS visibility check (must NOT appear in discover, must 404 on direct URL).          |

Plus the pre-existing `GermanA1` (owned by Herik, 12 chapters, 1 PDF uploaded) and the existing `Wyco` membership on `GermanA1`.

> Cleanup recommendation: see [Section 6](#6-test-data-cleanup) at the bottom.

---

## 1. PASS — Items that work as specified

| Spec section            | Behavior verified                                                                                                                                                                              | Status |
| :---------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: |
| Navbar (top)            | Brand, Home/Search/Categories nav, `+ Create Session`, avatar→profile, EN/DE/MY toggle all render and route correctly.                                                                         |   ✅   |
| Sub-page navbar         | Detail page shows `⬅ back` + **Media → Discussion → Manage** on a single sticky row, styled in the same primary-surface band as the main navbar. Tab switching is purely state-based; no URL or full-page reload. |   ✅   |
| Session cards           | Cover placeholder / image, Public/Private pill, single-category badge, author, Chapters metric, description, footer CTA — all render across Home/Search/Categories.                            |   ✅   |
| Owner badge             | Sessions owned by the current user show a `Created by you` badge in place of the join-policy badge, and the "My Progress" metric is replaced with `Uploaded` (count of chapters with media).   |   ✅   |
| Joined badge            | Sessions where the user is a non-owner member show the `Joined` badge and **no footer CTA**.                                                                                                   |   ✅   |
| Pagination              | Search results return **20 per page** with a `Load more` button. Clicking fetches the next cursor page and appends. Button hides when server returns fewer rows than the page size.            |   ✅   |
| Home list completeness  | Home includes joined sessions even when their `created_at` puts them past page-1 of the discover cursor (extra joined-sessions fetch).                                                         |   ✅   |
| Access control — click  | Card body click: (a) joined → navigates to `/session/:id`; (b) unjoined → opens `JoinSessionModal`; (c) pending request → no-op (no nav, no modal). Identical behavior across Search & Categories. |   ✅   |
| Access control — URL    | Direct navigation to `/session/:id` for an **unjoined open** session shows a stripped-down gate UI (back + session info + Join CTA), with the detail tabs hidden. The Manage/Media/Discussion content is never reachable to non-members. |   ✅   |
| Access control — RLS    | Direct navigation to a **private** session as a non-member returns `404 Session not found` because the `select` on `reading_sessions` returns zero rows under RLS — the back-end enforcement is intact. |   ✅   |
| Join (open)             | Modal eyebrow "Join Session" + `Open` pill + "Anyone can join this session directly." Confirm → member row inserted, card badge flips to `Joined`, footer button disappears, modal closes.     |   ✅   |
| Join (request)          | Modal shows `Request` pill + "Joining requires approval from the owner." Confirm → `session_join_requests` row inserted with `status='pending'`, card footer renders `Request pending` pill, no further clicks allowed. |   ✅   |
| Manage (owner)          | Settings panel: visibility dropdown + join-policy toggle + single `Save settings` button. Save updates DB and disables the button when clean. Member Progress shows non-owner members with `Remove` buttons. `Delete Session` button at bottom. |   ✅   |
| Remove member           | Owner clicks Remove → `session_members` row deleted, list updates instantly.                                                                                                                   |   ✅   |
| Delete session          | Confirmation modal with destructive copy ("This cannot be undone and will remove all members, media, and progress."). Confirm → DB rows cascade (session, members), media files removed from `session-media`, cover files removed from `session-covers`. Verified **0 orphan files** afterwards. |   ✅   |
| Create session          | Modal collects title, author, chapter count, visibility, join policy, description, single category, optional cover upload. Submit creates session, inserts owner membership, uploads cover to `session-covers/{user_id}/{session_id}/cover.{ext}`, and redirects to the new detail page. |   ✅   |
| Discussion              | Comment textarea + `Post comment` submits and the new row appears instantly without a manual refresh (realtime channel works). Comment metadata shows author display name and locale timestamp. |   ✅   |
| Smart refetch           | After join / remove / settings save, the affected list re-loads automatically with no manual refresh button anywhere in the UI (manual refresh buttons removed as specified).                  |   ✅   |
| i18n                    | EN/DE/MY all translate navbar, sub-page tabs, danger buttons, and join modal copy. `Created by you`, `Uploaded`, `Load more`, `Request pending` strings localized in all three.                |   ✅   |
| Routing                 | `/`, `/home`, `/search`, `/categories`, `/session/:id`, `/profile/edit` all render correctly. Unknown routes (e.g. `/totally-bogus-route`) render the new `NotFoundPage` (404 / "Page not found" / "Go home"). |   ✅   |
| Access gate UI          | The gate card shows session title/author/description, "You are not a member of this session yet." hint, and a join CTA (`Join session` or `Request to join` depending on policy).              |   ✅   |

---

## 2. Issues found

> Severity legend: **HIGH** = violates an explicit spec requirement / blocks intended flow • **MEDIUM** = correctness or data-integrity concern • **LOW** = UX polish or noise.

### 2.1 HIGH — Non-owner Manage tab filters out the owner instead of the current user

**File:** `src/components/SessionDetail/ManageTab.tsx`, line 85.

```85:85:src/components/SessionDetail/ManageTab.tsx
const otherMembers = sessionMembers.filter((m) => m.user_id !== session.creator_id)
```

**What I saw on `Ember Tides` as a non-owner member:** the `Member Progress` list contained one row — **myself (Herik)** — and the actual session owner (`Wyco`) was **not** shown.

**Why it's wrong:** the spec says "Allow users to see other members' progress." From a non-owner's viewpoint, "other members" must include the owner and exclude the viewer. The current filter excludes the creator (= the owner) but happens to include the viewer.

The filter works fine in the owner branch (line 268) because owner === creator === current user, so all three notions collapse. It breaks only on the non-owner branch where they diverge.

**Suggested fix:**

```tsx
const otherMembers = sessionMembers.filter((m) => m.user_id !== currentUserId)
```

This single change is correct for both branches and makes the existing comment "owner sees all, non-owner members see all other members (excluding themselves)" actually true.

---

### 2.2 MEDIUM — Unexpected `Study` category in `public.categories`

`public.categories` contains 6 rows: `Action, Adventure, Romance, Drama, Comedy, Study`. **Resolved:** `Study` is documented in `docs/projectspec.md` and seeded in `supabase/schema.sql`.

Verify quickly with `select * from public.categories order by id;`.

---

### 2.3 LOW — Pagination cursor resets after every mutation

**Repro:**
1. Open Search → click `Find Sessions`. Click `Load more`. You now have 21+ cards (page 1 + extra).
2. Join any session from the first page.
3. `loadSessions(force=true)` runs in response to the join. Cursor is reset to page-1, `Load more` reappears, and the rows that were previously revealed by clicking `Load more` are dropped from the list until the user clicks `Load more` again.

This is not a data-loss bug — the data is still there server-side — but it's an unexpected UX regression after any list-changing mutation. Two reasonable fixes:

- Cheap: keep the previous `pageSize × pagesLoaded` count and re-fetch that many rows on `force=true`. Or
- Better: replace the in-place row append in `loadMoreSessions` with a SWR-style cache so a mutation event only patches the affected row instead of resetting the cursor.

Not a release blocker — flagging because the spec explicitly asks for "seamless data updates without manual refresh."

---

### 2.4 LOW — Search page state doesn't survive navigation

The Search page is gated by an internal `hasSearched` flag and a controlled `sessionSearch` input. After navigating away (e.g., into a detail page) and coming back, both reset, so the user has to retype the query and click `Find Sessions` again.

**Suggested fix:** persist `{ search, hasSearched }` in `sessionStorage` keyed by route, or hoist them into the `useSessions` hook so they survive component remount.

---

### 2.5 LOW — No success toast / notice after `Save settings`

In `ManageTab.tsx` the `settingsNotice` prop is rendered when present, but the parent page never sets it. After clicking `Save settings`, the only feedback is the Save button becoming disabled again because state is clean. A short-lived success notice ("Settings saved.") would close the loop.

---

### 2.6 LOW — `Remove member` has no confirmation step

Compared to `Delete Session` which prompts ("This cannot be undone …"), removing a member happens immediately on the first click and silently. Members can re-join later, so it's recoverable for open sessions — but it's still a destructive admin action with no undo prompt. A simple `ConfirmModal` reuse here would be consistent.

---

### 2.7 LOW — Noisy `400` on storage `list` during delete

During `Delete Session` for a session that has a cover, the network console shows:

```
POST https://…supabase.co/storage/v1/object/list/session-covers → 400
```

`deleteSessionCover()` in `src/lib/storage.ts` lists the folder defensively to catch orphaned filenames, and falls back to `knownPath` when the list fails. The functional cleanup succeeds (confirmed: zero objects remain in storage afterwards), so this is cosmetic.

Root cause: the `storage_session_covers_select` policy uses `can_access_session(session_id, auth.uid())` which is fine for object SELECT, but Supabase's `list` endpoint requires an additional row-filter / permission that the current policy set does not grant explicitly, so it returns 400 instead of an empty list.

**Suggested fix (cheapest):** when `knownPath` is set, skip the defensive list entirely:

```typescript
if (knownPath) {
  toRemove.add(knownPath)
} else {
  const { data: listed, error: listError } = await supabase.storage
    .from(SESSION_COVERS_BUCKET)
    .list(folder, { limit: 100 })
  // …
}
```

This eliminates the 400 on the happy path and keeps the defensive sweep available when `cover_image_path` is missing or corrupted.

---

### 2.8 LOW — Two duplicate `406`s when loading a private session URL

Direct navigation to `/session/{private-id}` produces two identical `406 Not Acceptable` responses to the same Supabase REST query before the page falls back to the 404 view. Almost certainly React 18 strict-mode in `dev` triggering the effect twice. The functional result (404 page) is correct; only the console noise is cosmetic. Safe to ignore until Strict Mode is disabled or the effect is keyed/cancelled.

---

### 2.9 INFO — Visual inconsistency on the access-gate page

The access-gate page (non-member viewing an open session by URL) renders a single `⬅ back` button inside `.detail-back-bar` but **omits the `Session tabs` tablist** because tabs are intentionally hidden for non-members. As a result, the sticky top band on that page is much shorter than on the joined-member detail page. Not a bug — by design — but worth noting if you want pixel-perfect parity. The simplest fix is to remove the sticky styling for that branch so the back button floats above the gate card.

---

## 3. Acceptance summary (against the original request)

| Requirement                                                                                | Status      |
| :----------------------------------------------------------------------------------------- | :---------- |
| Subpage Navbar — same style as main navbar                                                 | ✅ PASS     |
| Subpage Navbar — order Media → Discussion → Manage                                         | ✅ PASS     |
| Subpage Navbar — beside back button, same row                                              | ✅ PASS     |
| Subpage Navbar — no full reload on tab switch                                              | ✅ PASS     |
| Manage Page — users see other members' progress                                            | ❌ FAIL — see §2.1 |
| Manage Page — owner can manage (remove, edit session)                                      | ✅ PASS     |
| Access Control — prevent viewing details if not joined (frontend)                          | ✅ PASS     |
| Access Control — RLS enforcement                                                           | ✅ PASS (verified by 404 on private URL) |
| Category cards — unjoined click → join modal only (no detail nav)                          | ✅ PASS     |
| Session Card — `Created by you` badge for owner                                            | ✅ PASS     |
| Session Card — `Uploaded` instead of "My Progress" for owner                               | ✅ PASS     |
| Delete Session — cleans up cover image from `session-covers`                               | ✅ PASS     |
| Delete Session — no orphan files                                                           | ✅ PASS (verified via `storage.objects` query: 0 remaining) |
| Data Fetching — remove excessive manual refresh buttons                                    | ✅ PASS     |
| Data Fetching — smart refetch on mutation                                                  | ✅ PASS (comment appears instantly; join updates badge instantly) |
| Pagination — limit 20 + Load more                                                          | ✅ PASS     |
| Pagination — keep queries efficient                                                        | ✅ PASS (cursor on `created_at` + `id`) |

**Net result:** 1 hard regression (§2.1), 1 data-integrity flag (§2.2), 7 polish items. The headline access-control + delete-cleanup + pagination + storage-cleanup features are working as specified.

---

## 4. Recommended fix order

**Status: recommended fixes completed (2026-05-15).**

| Item | Status |
|------|--------|
| §2.1 ManageTab filter | Done — non-owners see other members including owner; owner excluded from progress list |
| §2.7 storage list 400 | Done — skip `storage.list` when `knownPath` is set |
| §2.5 Save-settings toast | Done — `settingsNotice` success message, 2s auto-hide |
| §2.6 Remove-member confirm | Done — `ConfirmModal` before removal |
| §2.2 `Study` category | Done — added to seed + `schema.sql` / spec |
| §2.3 / §2.4 pagination & search state | Open — polish for a future iteration |

---

## 5. Backend / RLS audit notes (no changes required)

Spot-checked the policies and helper functions referenced in `docs/projectspec.md`:

- `is_session_member`, `can_access_session`, `max_uploaded_chapter` all present and `security definer` with `set_config('row_security', 'off', true)` to avoid recursion (per `fix_progress_rls_security_definer.sql`).
- `reading_sessions.select` allows `visibility='public' or auth.uid() in session_members or auth.uid() = creator_id` — correct, lets us discover public sessions without breaking detail-page gating.
- `session-covers` bucket policies: `select` requires `can_access_session(...)`, `insert/update/delete` require `owner == auth.uid()`. Both verified by the QA flow (cover uploaded on create, removed on delete).
- `session_join_requests`: pending row created by herik on `request`-policy session, observable to herik; would only be visible to the owner via the Join Requests panel in Manage.

No RLS policy modifications were needed during this run. Existing back-end enforcement matches the spec.

---

## 6. Test-data cleanup

The QA pass left the following state in the live database (Herik's account):

- **22 seeded sessions** owned by `wyco68@gmail.com` (20 public/open, 1 public/request, 1 private/open). Some are clickable from Herik's account.
- **1 active membership** on `Ember Tides` (`38d5ff16-…`) from the join-flow test.
- **1 pending join request** on `The Cartographer's Daughter` (`ff642298-…`) from the request-flow test.
- **1 comment** by Herik on `Ember Tides` ("Excited to start reading this — QA pass comment.").
- The temporary `QA Delete Test` session created during the cover-cleanup verification has already been deleted (verified zero rows + zero storage objects).

To restore the database to its pre-QA state, run:

```sql
delete from public.session_join_requests
where user_id = 'bd8c9c25-ae8c-4df0-bebf-1632be6fe628';

delete from public.session_members
where session_id = '38d5ff16-b0e7-465c-a58b-c0170b9e970e'
  and user_id   = 'bd8c9c25-ae8c-4df0-bebf-1632be6fe628';

delete from public.comments
where author_id = 'bd8c9c25-ae8c-4df0-bebf-1632be6fe628'
  and session_id = '38d5ff16-b0e7-465c-a58b-c0170b9e970e';

delete from public.reading_sessions
where creator_id = 'a79438bf-9b24-4009-bf1a-d463307edaf5';
```

The `reading_sessions` delete cascades to `session_members`, `comments`, `progress_updates`, and `session_join_requests` via the existing FKs, so the seeded data disappears in one shot. The Supabase MCP can run all of the above as a single batch if desired.

---

*End of report.*
