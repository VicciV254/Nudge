# Nudge

Nudge is a to-do web app for people who want their tasks and their Google Calendar in one place. This repository holds the React frontend and the Express API, both at version 1.0.0.

## Overview

You add tasks with a due date, priority and category, and work through them in the Today, Tasks and Calendar views. Recurring tasks follow RFC 5545 repeat rules (daily, weekly, monthly or yearly), and you can delete one occurrence, that occurrence and the ones after it, or the whole series.

Once you connect Google Calendar, dated tasks you mark for sync become events, changes flow both ways by default, and events you add in Google appear as tasks. When both sides change a task, Nudge shows both versions and lets you keep either. You sign in with email and password or with Google, and the installed web app (PWA) reminds you shortly before a task is due while it is open.

## Getting started

You need:

- Node.js 20 (20.19 or later), 22 (22.12 or later) or 24+, with npm
- Docker with Compose, for the local PostgreSQL 16 database
- `openssl`, to generate secrets

### Set up the backend

From the repository root:

```bash
docker compose up -d db
cd backend
cp .env.example .env
npm ci
```

Then edit `backend/.env`:

- Set both `DATABASE_URL` and `DIRECT_URL` to `postgresql://nudge:nudge@localhost:5432/nudge`, the database in `docker-compose.yml`. For a hosted database with connection pooling, such as Neon, the comments in [`backend/.env.example`](backend/.env.example) explain which URL goes where.
- Set `JWT_SECRET` to the output of `openssl rand -base64 48`.

### Start the API

In `backend/`:

```bash
npm run db:migrate   # applies the migrations in prisma/migrations
npm run db:seed      # adds a demo user with sample tasks and prints its email and password
npm run dev          # API on http://localhost:5000
```

### Start the frontend

In a second terminal, from the repository root:

```bash
cd frontend
npm ci
npm run dev          # serves the app on http://localhost:3000
```

Open `http://localhost:3000` and sign in as the demo user. The dev server forwards `/api` requests to the API, so the frontend needs no `.env` file.

### Google sign-in and Calendar sync (optional)

Google sign-in needs `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_REDIRECT_URI` in `backend/.env`; the comments in `backend/.env.example` cover the Google Cloud setup. Calendar sync also needs `ENCRYPTION_KEY`, set to the output of `openssl rand -hex 32`. Without an HTTPS `GOOGLE_WEBHOOK_URL`, Google does not notify the API of changes, so use **Sync now** in Settings to pull them.

## Verification

Run these from the repository root:

```bash
curl http://localhost:5000/api/health   # with the API running: {"ok":true,"service":"nudge-api",...}
npm run test:backend                    # backend tests; the database is mocked
npm --prefix frontend run lint          # ESLint on frontend/src
npm run build:frontend                  # builds the frontend into frontend/dist
npm run audit:contrast                  # WCAG AA contrast check of the main pages, light and dark
```

The contrast check needs `npm ci` and `npx playwright install chromium` at the repository root, and the build served by `npm --prefix frontend run preview -- --port 4173` in another terminal. It checks `http://127.0.0.1:4173` unless you pass another base URL: `npm run audit:contrast -- BASE_URL`. The frontend has a Vitest setup but no test files.

## Tech stack

- Frontend: React 18, React Router 6, Vite 8 with vite-plugin-pwa, Framer Motion, date-fns
- Backend: Node.js, Express 4, Prisma 5, PostgreSQL, Zod, jsonwebtoken, bcryptjs
- Integrations: Google OAuth 2.0 and the Google Calendar API
- Testing and tooling: `node:test`, Vitest 4, ESLint 8, Playwright

## Project structure

```text
backend/
  prisma/             schema, migrations and demo seed
  src/                Express API: routes, controllers, middleware, services
  tests/              node:test suites
frontend/
  public/             favicon and PWA icons
  src/                React app: pages, components, contexts, API client
  vite.config.js      dev server port, /api proxy and PWA settings
scripts/
  audit-contrast.mjs  contrast check behind npm run audit:contrast
docker-compose.yml    local PostgreSQL 16
package.json          root scripts: test:backend, build:frontend, audit:contrast
```
