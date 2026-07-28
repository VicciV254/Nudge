<div align="center">
  <img src="frontend/public/icons/app-icon.svg" width="76" alt="Nudge">
  <h1>Nudge</h1>
  <p><b>A to-do app that gently pushes you forward.</b><br>
  React 18 · Express · Prisma · Neon (serverless Postgres)</p>
</div>

![Today](docs/today.png)

---

## What this is

A working full-stack task app built on the **"n in motion"** mark and the **Ember**
theme, in light and dark. The brand is not a skin on top — it is the token layer
the whole UI reads from, and the accessibility of every colour pair is verified
by a script rather than by eye.

**Verified, not claimed:**

| Check | Result |
|---|---|
| Frontend production build | passes, code-split into 5 chunks |
| Frontend lint (ESLint + react-hooks) | 0 problems |
| Backend tests | **102/102 pass** (`node --test`) |
| Prisma schema | valid; migration SQL generates cleanly |
| Live contrast audit — 7 routes × 2 modes | **0 failures** at WCAG AA |

The contrast audit walks the real rendered DOM, resolves each element's actual
computed colour against its true painted background, and applies the WCAG large-text
rule. It is in `scripts/audit-contrast.mjs` — rerun it any time.

---

## Quick start

```bash
# 1 — database
#    Create a project at neon.tech, then copy BOTH connection strings.
cd backend
cp .env.example .env          # paste DATABASE_URL (pooled) + DIRECT_URL (direct)
npm install
npx prisma migrate dev --name init
npm run db:seed               # demo@nudge.app / Demo1234
npm run dev                   # → http://localhost:5000

# 2 — app
cd ../frontend
npm install
npm run dev                   # → http://localhost:3000
```

No Neon account yet? `docker compose up -d` gives you a local Postgres; point both
URLs at `postgresql://nudge:nudge@localhost:5432/nudge`.

---

## Why two database URLs

This is the single most common way a Prisma + Neon setup fails, so it is worth
being explicit:

```
DATABASE_URL  →  ep-xxx-pooler.region.aws.neon.tech   (PgBouncer — the app)
DIRECT_URL    →  ep-xxx.region.aws.neon.tech          (direct — migrations)
```

Neon pools connections through PgBouncer, which does not support the session-level
statements `prisma migrate` needs. Point migrations at the pooled URL and they hang
or fail with confusing advisory-lock errors. The schema declares `directUrl` so each
gets the right one.

---

## Project layout

```
Nudge/
├── frontend/                     React 18 + Vite
│   ├── public/icons/             app icon, favicons, maskable PWA icon
│   └── src/
│       ├── api/                  fetch client (token refresh, typed errors)
│       ├── components/
│       │   ├── common/Logo.jsx   the mark + wordmark as vector geometry
│       │   ├── common/Icon.jsx   monoline icon set, matches the logo's stroke
│       │   ├── tasks/            TaskList / TaskItem / TaskForm / TaskFilters
│       │   ├── calendar/         Google Calendar connection panel
│       │   └── layout/AppShell   sidebar + mobile tab bar
│       ├── context/              Theme · Auth · Tasks · Toast
│       ├── pages/                Landing · Login · Register · Today · Tasks · Calendar · Settings
│       └── styles/
│           ├── tokens.css        generated from the brand system — do not hand-edit
│           └── app.css           components; reads tokens only, no raw hex
├── backend/                      Express + Prisma
│   ├── prisma/schema.prisma      enums, compound indexes, directUrl
│   ├── src/controllers/          auth · tasks
│   ├── src/middleware/           auth · zod validation · error handler
│   ├── src/utils/                jwt · AES-256-GCM for OAuth tokens
│   └── tests/api.test.js         route tests, no DB required
├── brand/                        design source (not needed to run the app)
│   ├── logos/                    27 SVGs: lockups, mono, the rejected concepts
│   ├── reference/                brand board + calendar spec, self-contained HTML
│   └── generators/               Python that regenerates the palette in OKLCH
├── scripts/audit-contrast.mjs    the accessibility gate
└── docker-compose.yml            local Postgres
```

---

## The brand, as code

**Mark A "n in motion"** — a monoline lowercase `n` with two trailing lines. The
trail is the whole idea: it turns a neutral letterform into one being *nudged*. It
holds at 16px, works in one flat colour, and is drawn as geometry (`Logo.jsx`) so it
needs no font and no image asset.

**Ember** — amber on warm sand. The category is saturated with blue (TickTick,
Things, Microsoft To Do) and Todoist owns red; amber is warm and motivating without
red's alarm-clock aggression, which matters for a product whose promise is nudging
rather than nagging.

Colour is consumed **only** through semantic tokens:

```css
.btn { background: var(--brand-solid); color: var(--text-inverse); }
```

Switching mode flips one attribute — no JS re-render, no flash:

```html
<html data-theme="ember" data-mode="dark">
```

The initial mode is written by a blocking inline script in `index.html` *before*
first paint. Without it the app renders light for one frame then snaps to dark,
which is very visible on a warm canvas.

### Three tone rules the code actually enforces

1. **Completing never makes a row vanish.** It desaturates and strikes through, so
   you see what you just finished (`.task--done`).
2. **Overdue tints the metadata, never the row.** A screen full of red makes a
   productivity app feel like a punishment (`.task__due--overdue`).
3. **Errors use a muted brick, not alarm red.** A failed sync is an inconvenience.
   When five rows can fail at once, saturated red makes the whole app look broken.

![Settings](docs/settings.png)

---

## Notable implementation decisions

**Optimistic mutations.** Completing a task is the most-repeated action in the app,
so it must never wait on a round trip. `TaskContext` applies the change immediately
and rolls back on failure. Deletes snapshot the whole list so a failed delete
restores exactly.

**Refresh tokens are opaque, not JWTs.** They live in the `sessions` table, which
makes them revocable — a JWT refresh token cannot be invalidated before it expires,
so "log out everywhere" would be a lie. They also rotate on every use.

**Login is timing-safe.** A missing user is compared against a dummy bcrypt hash, so
response time doesn't reveal whether an account exists.

**Counters are transactional.** `tasksCreated` / `tasksCompleted` are written in the
same `$transaction` as the task, so they cannot drift.

**One Prisma client, cached on `globalThis`.** With `node --watch`, re-imports would
otherwise leak a pool per save and exhaust Neon's free-tier connection limit within
minutes.

**A sync-loop guard is in the schema.** `Task.syncHash` + `revision` let a webhook
tell a genuine Google-side edit from the echo of our own write. Without it, two-way
calendar sync loops infinitely — the most common way this integration fails in
production.

---

## Google Calendar colour bridge

`events.colorId` accepts one of **11 fixed slots**, not arbitrary hex, so brand
colours can't be sent directly. The mapping in `frontend/src/utils/constants.js` was
solved for mutual separation (all ≥ ΔE 0.13 in OKLab) so priorities stay
distinguishable inside Google's own UI:

| Priority | colorId | Google renders |
|---|---|---|
| Urgent | `11` | Tomato |
| High | `5` | Banana |
| Normal | `8` | Graphite |
| Low | `9` | Blueberry |
| Completed | `10` | Basil |

Two corrections worth flagging: **`"3"` is Grape (purple), not green** — a common
mistake that makes every completed task render purple. And high uses Banana rather
than Tangerine, because Tangerine sits only ΔE 0.07 from urgent's Tomato and the two
are indistinguishable in a month view.

![Calendar](docs/calendar.png)

---

## Scripts

```bash
# frontend
npm run dev · build · preview · test · lint

# backend
npm run dev · start
npm run db:migrate · db:deploy · db:seed · db:studio
npm test                       # 9 route tests, no database needed

# accessibility gate (needs the frontend preview running)
cd frontend && npm run build && npx vite preview --port 4173 &
node scripts/audit-contrast.mjs
```

---

## Deploying

**Frontend → Vercel.** Root `frontend/`, `vercel.json` is committed. Set
`VITE_API_URL` to your deployed API.

**Backend → Render / Railway / Fly.** Vercel's serverless functions are a poor fit
for a long-lived Express app with a connection pool. Set every var from
`.env.example`, and run `npm run db:deploy` (not `migrate dev`) on release.

**Database → Neon.** Use a branch per environment: `main` for production, `staging`
for preview. Branching is copy-on-write, so a staging branch of a production dataset
costs almost nothing.

---

## Google Calendar sync

Implemented end to end: OAuth handshake, two-way sync, conflict resolution, push
notifications, and a renewal job. `src/services/` holds `googleClient.js`,
`eventMapper.js`, `calendarSync.js` and `watchRenewal.js`.

**Setup.** Create an OAuth client (Web application) in Google Cloud Console, enable
the Calendar API, and add your `GOOGLE_REDIRECT_URI` verbatim to the authorised
redirect URIs. Fill in the three `GOOGLE_*` vars plus `APP_URL`. Leave
`GOOGLE_WEBHOOK_URL` empty locally — Google only accepts HTTPS on a verified domain,
so the app falls back to hourly polling by itself.

### The five things that make this actually work

**1 — `prompt=consent` is not optional.** Google returns a `refresh_token` only on the
*first* authorisation unless you force the consent screen. Without it the integration
looks connected and dies silently an hour later. The callback treats a missing
refresh token as a hard failure rather than pretending it worked.

**2 — The loop guard.** Every push stores a hash of the fields we own. When a webhook
fires, we re-hash the inbound event: if it matches, the notification is the echo of
our own write and is ignored. Without this, push → webhook → pull → push runs forever.

**3 — `nextSyncToken` only appears on the last page.** The pull loop exhausts every
`nextPageToken` before reading the token. Store a page token by mistake and the next
sync silently returns nothing. Google also rejects `syncToken` combined with
`timeMin`/`timeMax`/`q` with a 400, so the full and incremental queries are built
separately — there is a test asserting exactly that.

**4 — A stale token returns 410, not an error you can retry.** The engine discards it
and re-runs a bounded full sync automatically.

**5 — Watch channels expire and cannot be renewed.** There is no renewal endpoint;
you open a fresh channel and tolerate the overlap (harmless, thanks to the loop
guard). `watchRenewal.js` runs hourly, renews anything expiring within 24h, and polls
any account that hasn't synced in 6h as a safety net. On multiple instances, set
`DISABLE_CALENDAR_JOBS=true` on all but one and drive it from a real cron.

### Conflict policy

Last-write-wins resolves the data, but the losing value is written to
`Task.conflictData` and surfaced in the UI: both versions side by side, the newer one
highlighted, and the user picks. Silent LWW is how people stop trusting a sync.

### Scopes

`calendar.events` + `calendar.readonly` only. The broad `calendar` scope is
deliberately not requested — it permits deleting entire calendars, which this app
never does.

---

## Recurring tasks

Full RFC 5545 RRULE support, round-tripping to Google as a single recurring event.

**The model.** A *series* row holds the rule and never appears in your task list. Each
due occurrence is materialised as a normal task (*instance*) pointing back at it.
Completing an instance creates the next one.

Materialising beats computing occurrences on read: an instance is a real row, so it
can be rescheduled, annotated or synced independently, completion history stays
truthful, and the list query remains a plain indexed read. Only **one open instance
exists per series**, so a daily task can't flood the list with a year of rows.

**Timezone correctness is the whole game here.** "Every weekday at 09:00" must stay
09:00 after the clocks change. Naive UTC arithmetic (add 24h) silently shifts it by an
hour for half the year — verified: a `+24h` loop drifts 09:00 → 10:00 across the
London DST boundary. All stepping happens on wall-clock calendar fields in the user's
zone; only the final instant converts to UTC. There are dedicated tests for London
spring-forward and fall-back, New York, and a no-DST zone.

Also handled: the 31st clamps to the 28th/30th rather than rolling into the next
month, 29 February clamps in non-leap years, `COUNT`/`UNTIL` terminate the series, and
`BYDAY=-1FR` ("last Friday") works.

**A one-off reschedule does not drift the series.** Drag Monday's instance to
Wednesday and the next occurrence is still Monday — stepping is anchored to
`recurrenceStart`, not to the completed instance. That bug is present in several
shipping to-do apps; there's a test pinning the behaviour.

**Scoped edit and delete.** Deleting one occurrence of a series is ambiguous, so the
UI asks rather than guessing: *just this one* / *this and future* / *all*. "This and
future" preserves completed history instead of rewriting it.

**On the Google side** a series becomes ONE recurring event with an `RRULE` line, not
N copies — Google expands it, so the user's calendar shows the whole series. An RRULE
edited in Google flows back to the series row. The loop-guard hash includes the
recurrence line, so a rule change is a real change rather than an ignored echo.

`RepeatPicker` offers six presets rather than a full rule builder — that covers what
people actually create, and any exotic rule arriving from Google still round-trips and
renders as a read-only description.

---

## Not built yet

- **Per-occurrence exceptions (`EXDATE`).** Skipping a single occurrence without
  deleting it is not supported; the scope prompt covers most of the need.
- **Profile persistence.** The display-name field on Settings is local state; the
  calendar panel below it is fully wired.
- **Workspaces, notifications, email digests.** Out of scope for this pass.
