#!/usr/bin/env node
/**
 * Accessibility gate.
 *
 * Walks every rendered element on every route, in light AND dark mode, resolves
 * each one's *computed* colour against its true painted background (climbing the
 * tree past transparent ancestors), and checks the WCAG AA ratio — applying the
 * large-text exemption correctly.
 *
 * This catches what a token-level audit cannot: a colour that passes on the
 * canvas but fails on a tinted card it actually lands on.
 *
 * Usage:
 *   cd frontend && npm run build && npx vite preview --port 4173 &
 *   node scripts/audit-contrast.mjs [baseUrl]
 *
 * Exits non-zero if anything fails, so it can gate CI.
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://127.0.0.1:4173';
const ROUTES = ['/', '/login', '/register', '/app', '/app/tasks', '/app/calendar', '/app/settings'];

const now = new Date();
const iso = (d, h = 9) => {
  const x = new Date(now);
  x.setDate(x.getDate() + d);
  x.setHours(h, 0, 0, 0);
  return x.toISOString();
};

const USER = { id: 'u1', email: 'amina@studio.co', displayName: 'Amina Odhiambo' };

// Connected calendar + one conflict, so the sync UI is actually rendered during
// the audit rather than silently skipped.
const CAL_STATUS = {
  configured: true, connected: true, enabled: true, calendarId: 'primary',
  direction: 'both', reminderMinutes: 30, lastSyncAt: iso(0, 8),
  watchExpiresAt: iso(6, 8), counts: { pending: 0, errored: 1, conflicts: 1 },
};
const CALENDARS = [
  { id: 'primary', summary: 'amina@studio.co', primary: true },
  { id: 'work', summary: 'Work', primary: false },
];
const TASKS = [
  { id: '1', title: 'Send Q3 report to Amina', dueDate: iso(0, 9), priority: 'urgent', category: 'Work', completed: false, calendarSync: true, createdAt: iso(-3) },
  { id: '2', title: 'Book dentist', dueDate: iso(-2, 11), priority: 'high', completed: false, createdAt: iso(-6) },
  { id: '3', title: 'Renew domain', dueDate: iso(1, 12), priority: 'low', completed: false, createdAt: iso(-1) },
  { id: '4', title: 'Reply to landlord', dueDate: iso(-1, 10), priority: 'normal', completed: true, createdAt: iso(-4) },
  {
    id: '5', title: 'Book dentist', dueDate: iso(-2, 11), priority: 'high', completed: false,
    calendarSync: true, syncStatus: 'conflict', createdAt: iso(-6),
    conflictData: {
      winner: 'google',
      nudge: { title: 'Book dentist', dueDate: iso(-2, 11) },
      google: { title: 'Dentist - moved to Thursday', dueDate: iso(2, 15) },
    },
  },
  // A recurring instance, so the "Repeats" badge is rendered during the audit.
  {
    id: '6', title: 'Send weekly report', dueDate: iso(0, 9), priority: 'high',
    completed: false, seriesId: 's1', calendarSync: true, syncStatus: 'synced',
    category: 'Work', createdAt: iso(-9),
  },
];

const PROBE = () => {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const lum = ([r, g, b]) => 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255);
  const parse = (s) => { const m = s.match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : null; };

  // Climb until we hit something actually opaque — this is the part that makes
  // the audit trustworthy.
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const a = getComputedStyle(n).backgroundColor.match(/[\d.]+/g);
      if (a && (a.length < 4 || parseFloat(a[3]) > 0.5)) return a.slice(0, 3).map(Number);
      n = n.parentElement;
    }
    return parse(getComputedStyle(document.body).backgroundColor) || [255, 255, 255];
  };

  const out = [];
  document.querySelectorAll('body *').forEach((el) => {
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity) < 0.4) return;

    // Only elements holding their own text — avoids double-counting wrappers.
    const txt = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join('');
    if (!txt) return;

    const fg = parse(st.color);
    const bg = bgOf(el);
    if (!fg || !bg) return;

    const L1 = lum(fg), L2 = lum(bg);
    const cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const size = parseFloat(st.fontSize);
    const bold = parseInt(st.fontWeight, 10) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3.0 : 4.5;

    if (cr < need) {
      out.push({
        text: txt.slice(0, 44),
        ratio: +cr.toFixed(2),
        need,
        fontSize: size,
        selector: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''),
      });
    }
  });
  return out;
};

const route = (r) => {
  const u = r.request().url();
  const json = (b) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  if (u.includes('/auth/me')) return json(USER);
  if (u.includes('/calendar/status')) return json(CAL_STATUS);
  if (u.includes('/calendar/calendars')) return json(CALENDARS);
  if (u.includes('/tasks')) return json(TASKS);
  return json({});
};

const browser = await chromium.launch();
let failures = 0;
let checked = 0;

for (const mode of ['light', 'dark']) {
  for (const path of ROUTES) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.route('**/api/**', route);
    await page.addInitScript(
      ([m]) => {
        localStorage.setItem('nudge-mode', m);
        localStorage.setItem('nudge-token', 'audit');
      },
      [mode]
    );
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    const bad = await page.evaluate(PROBE);
    checked += 1;
    for (const f of bad) {
      failures += 1;
      console.log(
        `FAIL  ${mode.padEnd(5)} ${path.padEnd(16)} ${String(f.ratio).padStart(5)}:1 ` +
          `(needs ${f.need}) ${f.selector}  "${f.text}"`
      );
    }
    await page.close();
  }
}

await browser.close();

console.log(
  failures === 0
    ? `\n✓ ${checked} page renders audited — 0 contrast failures (WCAG AA)`
    : `\n✗ ${failures} contrast failure${failures === 1 ? '' : 's'} across ${checked} page renders`
);
process.exit(failures === 0 ? 0 : 1);
