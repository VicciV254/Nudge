"""Monoline geometric lowercase wordmark for 'nudge'.
Metrics (units): x-height 100, stroke 19, bowl radius 31 -> counter 43.
x = LEFT STEM CENTRE of each glyph. Advance = 2R + SW + gap."""
import math

SW   = 19.0
BASE = 140.0
XTOP = 40.0          # x-height 100
ASC  = 6.0           # ascender top (d)
DESC = 208.0         # descender bottom (g)
R    = 31.0
GAP  = 30.0
ADV  = 2*R + SW + GAP

def L(x0,y0,x1,y1): return f"M {x0:.2f} {y0:.2f} L {x1:.2f} {y1:.2f}"

def circle(cx,cy,r):
    return (f"M {cx-r:.2f} {cy:.2f} A {r:.2f} {r:.2f} 0 1 1 {cx+r:.2f} {cy:.2f} "
            f"A {r:.2f} {r:.2f} 0 1 1 {cx-r:.2f} {cy:.2f} Z")

def P(cx,cy,r,a):
    return (cx+r*math.cos(math.radians(a)), cy+r*math.sin(math.radians(a)))

def arcp(cx,cy,r,a0,a1,large,sweep):
    x0,y0 = P(cx,cy,r,a0); x1,y1 = P(cx,cy,r,a1)
    return f"M {x0:.2f} {y0:.2f} A {r:.2f} {r:.2f} 0 {large} {sweep} {x1:.2f} {y1:.2f}"

# --- glyphs (SVG y-down: angle 0=E, 90=S, 180=W, 270=N) ---
def glyph_n(x):
    cy = XTOP + R                       # shoulder centre
    return [L(x, BASE, x, cy),
            arcp(x+R, cy, R, 180, 0, 1, 1),      # arch over the top
            L(x+2*R, cy, x+2*R, BASE)]

def glyph_u(x):
    cy = BASE - R
    return [L(x, XTOP, x, cy),
            arcp(x+R, cy, R, 180, 0, 1, 0),      # bowl under the bottom
            L(x+2*R, XTOP, x+2*R, BASE)]

def glyph_d(x):
    cy = BASE - R
    return [circle(x+R, cy, R), L(x+2*R, ASC, x+2*R, BASE)]

def glyph_g(x):
    cy = BASE - R
    hook_r = R*0.80
    sx = x + 2*R
    return [circle(x+R, cy, R),
            (f"M {sx:.2f} {XTOP:.2f} L {sx:.2f} {DESC-hook_r:.2f} "
             f"A {hook_r:.2f} {hook_r:.2f} 0 0 1 {sx-hook_r*1.45:.2f} {DESC-hook_r*0.72:.2f}")]

def glyph_e(x):
    cy = BASE - R
    bar = L(x, cy, x+2*R, cy)
    ring = arcp(x+R, cy, R, 0, 48, 1, 0)   # from E, CCW over top, ends lower-right
    return [bar, ring]

GLYPHS = [glyph_n, glyph_u, glyph_d, glyph_g, glyph_e]

def wordmark_svg(color="#1D1813", tracking=0.0, sw=SW, pad_extra=12.0):
    paths, x = [], 0.0
    for gf in GLYPHS:
        paths += gf(x); x += ADV + tracking
    ink_w = (x - ADV - tracking) + 2*R          # last stem-centre + bowl width
    pad = sw/2 + pad_extra
    vb_w = ink_w + pad*2
    vb_h = (DESC - ASC) + pad*2
    body = "\n  ".join(f'<path d="{p}"/>' for p in paths)
    g = (f'<g transform="translate({pad:.2f},{pad-ASC:.2f})" fill="none" stroke="{color}" '
         f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">\n  {body}\n</g>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vb_w:.2f} {vb_h:.2f}" '
            f'width="{vb_w:.0f}" height="{vb_h:.0f}" fill="none">\n{g}\n</svg>'), vb_w, vb_h

if __name__ == "__main__":
    svg, w, h = wordmark_svg()
    open("logos/wordmark.svg","w").write(svg)
    print("viewBox", round(w,1), round(h,1), "ratio", round(w/h,2))
