"""Extend the Ember theme with Google-Calendar-integration-specific tokens.
Light + dark, every pair contrast-audited."""
import sys, json
sys.path.insert(0, "src")
from palette import contrast, rating, hexof, ramp, ramp_vivid, neutral

tok = json.load(open("tokens.json"))
E   = tok["ramps"]["ember"]; S = tok["ramps"]["sand"]
GR  = tok["ramps"]["green"]; AM = tok["ramps"]["amber"]
RD  = tok["ramps"]["red"];   BL = tok["ramps"]["blue"]
T   = tok["themes"]["ember"]

def cal_layer(mode):
    t = T[mode]
    d = (mode == "dark")
    def pick(r, lightk, darkk): return r[darkk] if d else r[lightk]
    return {
      # ---- sync state ----
      "sync-ok":        pick(GR, "700", "300"),
      "sync-ok-bg":     pick(GR, "50",  "950"),
      "sync-pending":   pick(AM, "700", "300"),
      "sync-pending-bg":pick(AM, "50",  "950"),
      "sync-error":     pick(RD, "700", "300"),
      "sync-error-bg":  pick(RD, "50",  "950"),
      "sync-conflict":  pick(E,  "700", "300"),
      "sync-conflict-bg":pick(E, "50",  "950"),
      "sync-off":       ("#C2B9AF" if d else "#786E64"),   # solved: 4.5:1 on its own bg
      "sync-off-bg":    pick(S,  "100", "800"),
      # ---- priority ----
      # Hues deliberately spread (red / amber / neutral / blue) so the four are
      # separable at dot size. "normal" is neutral on purpose: the default
      # priority should add no colour noise. Solved for >=4.5:1 on surface AND
      # canvas in both modes; worst pairwise OKLab separation dE 0.12.
      "prio-urgent":    ("#FD7273" if d else "#B02331"),
      "prio-urgent-bg": pick(RD, "50",  "950"),
      "prio-high":      ("#FB9D30" if d else "#A96000"),
      "prio-high-bg":   pick(E,  "50",  "950"),
      "prio-normal":    ("#A8B3B0" if d else "#697270"),
      "prio-normal-bg": pick(S,  "100", "800"),
      "prio-low":       ("#6EB2FE" if d else "#1F6DB9"),
      "prio-low-bg":    pick(BL, "50",  "950"),
      # ---- calendar grid ----
      "grid-line":      t["border-subtle"],
      "grid-line-hour": t["border-default"],
      "grid-now":       pick(E, "600", "400"),
      "grid-today-bg":  pick(E, "50",  "950"),
      "grid-busy-bg":   pick(S, "200", "800"),
      "grid-free-bg":   t["bg-surface"],
      # ---- event blocks ----
      "evt-nudge-bg":   pick(E,  "100", "900"),
      "evt-nudge-br":   pick(E,  "600", "400"),
      "evt-nudge-tx":   pick(E,  "900", "100"),
      "evt-ext-bg":     pick(S,  "100", "800"),
      "evt-ext-br":     ("#988E83" if d else "#958B81"),   # solved: 3:1 on its own bg
      "evt-ext-tx":     pick(S,  "800", "200"),
      "evt-done-bg":    pick(GR, "50",  "950"),
      "evt-done-br":    pick(GR, "600", "500"),
      "evt-done-tx":    pick(GR, "800", "200"),
    }

CAL = {"light": cal_layer("light"), "dark": cal_layer("dark")}
json.dump(CAL, open("calendar/cal-tokens.json", "w"), indent=2)

# ---------------- audit ----------------
pairs = []
for mode in ("light", "dark"):
    t = T[mode]; c = CAL[mode]
    surf = t["bg-surface"]; canvas = t["bg-canvas"]
    for k in ("sync-ok","sync-pending","sync-error","sync-conflict","sync-off",
              "prio-urgent","prio-high","prio-normal","prio-low"):
        pairs.append((mode, f"{k} on surface", c[k], surf, 4.5))
        pairs.append((mode, f"{k} on canvas",  c[k], canvas, 4.5))
        pairs.append((mode, f"{k} on own bg",  c[k], c[k+"-bg"], 4.5))
    for a, b in (("evt-nudge-tx","evt-nudge-bg"),("evt-ext-tx","evt-ext-bg"),
                 ("evt-done-tx","evt-done-bg")):
        pairs.append((mode, f"{a} on {b}", c[a], c[b], 4.5))
    for a, b in (("evt-nudge-br","evt-nudge-bg"),("evt-ext-br","evt-ext-bg"),
                 ("evt-done-br","evt-done-bg"),("grid-now","bg-surface")):
        bg = c[b] if b in c else t[b]
        pairs.append((mode, f"{a} vs {b} (non-text)", c[a], bg, 3.0))

bad = 0
for mode, name, fg, bg, need in pairs:
    cr = contrast(fg, bg)
    if cr < need:
        bad += 1
        print(f"FAIL {mode:<6}{name:<34}{fg} on {bg} = {cr} (need {need})")
print(f"\ncalendar layer: {len(pairs)-bad}/{len(pairs)} pass")
