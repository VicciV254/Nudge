"""Map Nudge/Ember semantic colours onto Google Calendar's fixed 11-slot event palette
by perceptual (OKLab) distance -- not by eyeballing hex codes."""
import sys, math, json
sys.path.insert(0, "src")
from palette import _lin

# Google Calendar events.colorId -> modern UI hex (verified against Google's colors.get)
GCAL = {
 "1":  ("Lavender",  "#7986CB"), "2":  ("Sage",      "#33B679"),
 "3":  ("Grape",     "#8E24AA"), "4":  ("Flamingo",  "#E67C73"),
 "5":  ("Banana",    "#F6BF26"), "6":  ("Tangerine", "#F4511E"),
 "7":  ("Peacock",   "#039BE5"), "8":  ("Graphite",  "#616161"),
 "9":  ("Blueberry", "#3F51B5"), "10": ("Basil",     "#0B8043"),
 "11": ("Tomato",    "#D50000"),
}

def hex2oklab(hx):
    hx = hx.lstrip("#")
    r, g, b = [_lin(int(hx[i:i+2], 16)/255) for i in (0, 2, 4)]
    l = 0.4122214708*r + 0.5363325363*g + 0.0514459929*b
    m = 0.2119034982*r + 0.6806995451*g + 0.1073969566*b
    s = 0.0883024619*r + 0.2817188376*g + 0.6299787005*b
    l_, m_, s_ = l**(1/3), m**(1/3), s**(1/3)
    return (0.2104542553*l_ + 0.7936177850*m_ - 0.0040720468*s_,
            1.9779984951*l_ - 2.4285922050*m_ + 0.4505937099*s_,
            0.0259040371*l_ + 0.7827717662*m_ - 0.8086757660*s_)

def dist(a, b):
    """OKLab dE, with hue/chroma weighted over lightness: Google renders every
    chip at its own fixed lightness, so hue match matters far more than L match."""
    la, aa, ba = hex2oklab(a); lb, ab, bb = hex2oklab(b)
    return math.sqrt(0.35*(la-lb)**2 + (aa-ab)**2 + (ba-bb)**2)

def nearest(hx, exclude=()):
    cands = [(dist(hx, g[1]), cid, g[0], g[1]) for cid, g in GCAL.items() if cid not in exclude]
    return sorted(cands)[0]

if __name__ == "__main__":
    tok = json.load(open("tokens.json"))
    E = tok["ramps"]["ember"]
    import json as _j
    cal = _j.load(open("calendar/cal-tokens.json"))["light"]
    targets = {
        "priority-urgent":  cal["prio-urgent"],
        "priority-high":    cal["prio-high"],
        "priority-normal":  cal["prio-normal"],
        "priority-low":     cal["prio-low"],
        "completed":        tok["themes"]["ember"]["light"]["success"],
        "brand-default":    tok["themes"]["ember"]["light"]["brand-solid"],
    }
    # Optimal 1:1 assignment. Two objectives, both of which matter:
    #   fidelity  -- how close the Google slot is to our brand colour
    #   spread    -- how distinguishable the chosen slots are FROM EACH OTHER
    # Spread is weighted higher: a user scanning a month view in Google needs to
    # tell urgent from high at a glance, and Google's own palette is what they see.
    from itertools import permutations
    roles = list(targets)
    slots = list(GCAL)
    best, best_score = None, -1e9
    for combo in permutations(slots, len(roles)):
        fid = sum(dist(targets[r], GCAL[c][1]) for r, c in zip(roles, combo))
        sep = min(dist(GCAL[a][1], GCAL[b][1])
                  for i, a in enumerate(combo) for b in combo[i+1:])
        score = 3.0*sep - fid          # spread dominates
        if score > best_score:
            best_score, best = score, combo
    print(f"{'nudge role':<18}{'nudge hex':<11}-> {'id':<4}{'google':<11}{'hex':<10}dE")
    print("-"*66)
    out = {}
    for r, cid in zip(roles, best):
        nm, ghex = GCAL[cid]
        d = dist(targets[r], ghex)
        out[r] = {"nudge": targets[r], "colorId": cid, "google": nm,
                  "googleHex": ghex, "dE": round(d, 3)}
        print(f"{r:<18}{targets[r]:<11}-> {cid:<4}{nm:<11}{ghex:<10}{d:.3f}")
    msep = min(dist(GCAL[a][1], GCAL[b][1])
               for i, a in enumerate(best) for b in best[i+1:])
    print(f"\nmin separation between chosen Google slots: dE {msep:.3f}")

    json.dump(out, open("calendar/gcal-color-map.json", "w"), indent=2)

    print("\n--- spec's original mapping, audited ---")
    spec = [("High",   "#E74C3C", "11"), ("Medium", "#F39C12", "6"),
            ("Low",    "#4A90E2", "1"),  ("Completed", "#27AE60", "3")]
    for nm, hx, cid in spec:
        gname, ghex = GCAL[cid]
        d = dist(hx, ghex)
        best = nearest(hx)
        verdict = "OK" if d < 0.09 else f"WRONG -> should be {best[1]} ({best[2]} {best[3]})"
        print(f"{nm:<10}{hx}  colorId {cid:<3}= {gname:<10}{ghex}  dE={d:.3f}  {verdict}")
