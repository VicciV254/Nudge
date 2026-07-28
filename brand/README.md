# Brand assets

Design source for the Nudge identity. **Nothing here is needed to run the app** —
the shipped theme lives in `frontend/src/styles/tokens.css` and the logo is drawn as
vector geometry in `frontend/src/components/common/Logo.jsx`.

Keep this folder for press kits, handing the brand to a designer, or changing the
palette.

## Contents

| Path | What it is |
|---|---|
| `logos/` | All 27 SVGs — the chosen mark plus the 5 rejected concepts, in lockup / mono / app-icon variants |
| `reference/brand-board.html` | The full brand board: 6 logo concepts, 3 palettes, UI mockups, type scale, and the rationale for choosing "n in motion" |
| `reference/nudge-google-calendar.html` | The Google Calendar integration spec, branded |
| `tokens.json` | Every colour ramp + semantic token, machine-readable |
| `palettes.json` | The three palette directions (Ember, Focus Violet, Quiet Teal) |
| `gcal-color-map.json` | Nudge priority → Google `colorId`, with OKLab distances |
| `generators/` | Python scripts that produced all of the above |

Both HTML files are fully self-contained (images inlined as base64) — open them
directly in a browser, no server needed.

## Logo variants

The app only ships `A-n-motion.svg` and its app icon. These extras are here when
you need them:

- `A-n-motion-lockup-h.svg` / `-v.svg` — mark + wordmark, horizontal and stacked
- `A-lockup-h-dark.svg` — for dark backgrounds
- `A-n-motion-mono.svg` — single colour, for print or embroidery
- `wordmark.svg` / `wordmark-dark.svg` — type alone
- `B-` / `C-` / `D-` / `E-` / `F-` — the rejected concepts (push, check, ping, stack, swipe)

## Regenerating the palette

Colours are generated in OKLCH, not hand-picked, so the whole system can be
re-derived from a few hue values:

```bash
cd generators
pip install cairosvg pillow
python3 tokens.py      # rebuilds tokens.json + runs the contrast audit
python3 emit_css.py    # emits tokens.css
python3 make_logos.py  # redraws the marks
python3 board.py       # rebuilds the brand board
```

Verified working: `palette.ramp_vivid(62, 0.20, -16)[600]` returns `#C16900`, which
matches the `--ember-600` token the app actually ships.

If you change a hue, copy the regenerated `tokens.css` over
`frontend/src/styles/tokens.css` and re-run the accessibility gate from the repo
root:

```bash
cd frontend && npm run build && npx vite preview --port 4173 &
node scripts/audit-contrast.mjs
```
