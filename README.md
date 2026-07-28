<div align="center">
  <img src="frontend/public/icons/app-icon.svg" width="76" alt="Nudge">
  <h1>Nudge</h1>
  <p><b>A to-do app that gently pushes you forward.</b><br>
  React 18 · Express · Prisma · Neon (serverless Postgres)</p>
</div>

---

## What this is

A full-stack task app with React, Express, Prisma, and Neon. Includes Google Calendar sync, recurring tasks, and timezone support.

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

---

## Database

Use `DATABASE_URL` (pooled) for the app and `DIRECT_URL` (direct) for migrations. Swapping them causes migrations to hang.

---

## Project structure

```
frontend/          React + Vite, UI components, pages, contexts
backend/           Express + Prisma, controllers, services, auth
scripts/           Accessibility auditing
docker-compose.yml Local Postgres
```

---

## Design

Design tokens in `tokens.css`. Colors are semantic, not hex. Completed tasks desaturate, overdue dates use muted colors, errors use muted brick.



## Key features

- **Optimistic updates** — instant UI feedback with rollback on failure
- **Revocable refresh tokens** — stored in database, not JWTs
- **Timing-safe login** — response times don't leak account existence
- **Sync loop guard** — prevents calendar sync loops
- **Transactional counters** — task counts never drift

## Google Calendar

Two-way sync with conflict resolution. Push notifications via webhooks. Color mapping: Urgent→Tomato, High→Banana, Normal→Graphite, Low→Blueberry, Completed→Basil.

## Scripts

```bash
npm run dev              # start dev server
npm run build            # production build
npm test                 # run tests
npm run lint             # lint code
```

---

## Recurring tasks

Full RFC 5545 RRULE support. One series row, multiple task instances. Timezone-aware (stays at 09:00 after DST). Scoped edits: this one, this and future, or all.

---

## Not yet

Per-occurrence exceptions, profile persistence, team features, email notifications.

