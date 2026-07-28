import math, os
OUT = "logos"; os.makedirs(OUT, exist_ok=True)

def wrap(inner, defs="", vb=512):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{vb}" height="{vb}" '
            f'viewBox="0 0 {vb} {vb}" fill="none">{defs}\n{inner}\n</svg>')

def grad(gid, c1, c2, x1, y1, x2, y2):
    return (f'<defs><linearGradient id="{gid}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" '
            f'gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="{c2}"/>'
            f'<stop offset="1" stop-color="{c1}"/></linearGradient></defs>')

def save(n, s): open(os.path.join(OUT, n), "w").write(s); return n

# ============================== A: "n in motion" ============================
# True lowercase-n letterform (vertical stems + shoulder) with two speed lines.
def mark_n(c1="#C16900", c2="#E9A052", mono=None, flat=None):
    P = flat or mono or "url(#gA)"
    d = "" if (mono or flat) else grad("gA", c1, c2, 190, 150, 400, 400)
    sw = 68
    lx, rx = 232, 388          # stem centres  -> counter 156
    ay, by = 248, 372          # shoulder centre y, baseline y
    r = (rx-lx)/2              # 78
    trail = flat or mono or c1
    g = f'''
  <g stroke="{P}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M {lx} {by} L {lx} {ay}"/>
    <path d="M {lx} {ay} A {r} {r} 0 0 1 {rx} {ay} L {rx} {by}"/>
  </g>
  <g stroke="{trail}" stroke-width="{sw}" stroke-linecap="round">
    <path d="M 118 214 L 150 214" opacity="0.34"/>
    <path d="M 62 318 L 140 318" opacity="0.20"/>
  </g>'''
    return wrap(g, d)

# ============================== B: "push" ===================================
# A paddle arc nudging a dot forward. The most literal read of the name.
def mark_push(c1="#C16900", c2="#E9A052", mono=None, flat=None):
    P = flat or mono or "url(#gB)"
    d = "" if (mono or flat) else grad("gB", c1, c2, 130, 140, 380, 380)
    dot = flat or mono or c2
    tr = flat or mono or c1
    g = f'''
  <path d="M 168 118 A 172 172 0 0 1 168 394" stroke="{P}" stroke-width="74"
        stroke-linecap="round" fill="none"/>
  <circle cx="384" cy="256" r="62" fill="{dot}"/>
  <g stroke="{tr}" stroke-width="36" stroke-linecap="round" fill="none">
    <path d="M 92 196 L 124 196" opacity="0.34"/>
    <path d="M 74 316 L 122 316" opacity="0.20"/>
  </g>'''
    return wrap(g, d)

# ============================== C: "check in motion" ========================
def mark_check(c1="#007E70", c2="#00B1A7", mono=None, flat=None):
    P = flat or mono or "url(#gC)"
    d = "" if (mono or flat) else grad("gC", c1, c2, 160, 160, 400, 360)
    tr = flat or mono or c1
    g = f'''
  <path d="M 190 274 L 250 334 L 392 192" stroke="{P}" stroke-width="74"
        stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <g stroke="{tr}" stroke-width="42" stroke-linecap="round" fill="none">
    <path d="M 104 226 L 136 226" opacity="0.34"/>
    <path d="M 82 322 L 130 322" opacity="0.20"/>
  </g>'''
    return wrap(g, d)

# ============================== D: "ping" ===================================
def mark_ping(c1="#8E59FF", c2="#C3C3FF", mono=None, flat=None):
    core = flat or mono or c1
    r2   = flat or mono or c1
    r3   = flat or mono or c2
    g = f'''
  <circle cx="196" cy="256" r="76" fill="{core}"/>
  <g fill="none" stroke-linecap="round">
    <path d="M 292 172 A 118 118 0 0 1 292 340" stroke="{r2}" stroke-width="44"
          opacity="{0.75 if not (mono or flat) else 0.6}"/>
    <path d="M 368 120 A 190 190 0 0 1 368 392" stroke="{r3}" stroke-width="40"
          opacity="{1 if not (mono or flat) else 0.3}"/>
  </g>'''
    return wrap(g)

# ============================== E: "task stack" =============================
def mark_pill(c1="#C16900", c2="#E9A052", mono=None, flat=None):
    base = flat or mono or c1
    disc = flat or mono or c2
    tick = "#FFFFFF"
    o = (0.60, 0.28)
    g = f'''
  <g>
    <rect x="86" y="140" width="330" height="72" rx="36" fill="{base}"/>
    <rect x="86" y="252" width="232" height="72" rx="36" fill="{base}" opacity="{o[0]}"/>
    <rect x="86" y="364" width="138" height="72" rx="36" fill="{base}" opacity="{o[1]}"/>
    <circle cx="374" cy="292" r="90" fill="{disc}"/>
    <path d="M 337 292 L 364 319 L 412 265" stroke="{tick}" stroke-width="30"
          stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </g>'''
    return wrap(g)

# ============================== F: "swipe-through" ==========================
# A task pill with a line struck through it, resolving into a dot: done + moved on.
def mark_swipe(c1="#8E59FF", c2="#00B1A7", mono=None, flat=None):
    base = flat or mono or c1
    dot  = flat or mono or c2
    g = f'''
  <rect x="78" y="196" width="290" height="120" rx="60" fill="{base}"
        opacity="{0.30 if not (mono or flat) else 0.28}"/>
  <path d="M 130 256 L 316 256" stroke="{base}" stroke-width="52" stroke-linecap="round"/>
  <circle cx="398" cy="256" r="62" fill="{dot}"/>'''
    return wrap(g)

MARKS = {
 "A-n-motion": (mark_n,     ("#C16900", "#E9A052")),
 "B-push":     (mark_push,  ("#C16900", "#E9A052")),
 "C-check":    (mark_check, ("#007E70", "#00B1A7")),
 "D-ping":     (mark_ping,  ("#8E59FF", "#C3C3FF")),
 "E-stack":    (mark_pill,  ("#C16900", "#E9A052")),
 "F-swipe":    (mark_swipe, ("#8E59FF", "#00B1A7")),
}
if __name__ == "__main__":
    for n, (fn, (a, b)) in MARKS.items():
        save(f"{n}.svg", fn(a, b))
        save(f"{n}-mono.svg", fn(mono="#1D1813"))
    print("ok", len(MARKS))
